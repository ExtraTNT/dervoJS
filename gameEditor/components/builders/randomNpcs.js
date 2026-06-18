/**
 * randomNpcs builder - bulk-generate a cast from grouped pools.
 *
 * The whole point of this builder is that an NPC carries a set of *group tags*
 * (e.g. "male", "guard", "order") and three other pools - portraits, quests,
 * and conversation topics - can declare which group tags they require. A
 * pool entry is eligible for an NPC only when the entry's required tags are
 * a SUBSET of the NPC's tags. Empty required tags = matches anyone.
 *
 *   Portrait { tags: ['male', 'old'] }
 *     ↳ eligible for NPCs with at least ['male', 'old'] in their tag set
 *   Quest    { tags: ['female'] }
 *     ↳ never gets assigned to a male-only NPC
 *   Topic responses can interpolate ${name} / ${groups} via JS expressions
 *     ↳ "Hi, I'm ${name}. ${groups.includes('order') ? 'I serve.' : 'I trade.'}"
 *
 * Crowd / absent distribution and quest assignment are preserved from the
 * first version. Re-running the builder generates more NPCs in addition -
 * collisions on name slugs auto-suffix.
 */

import { p, div, span, textarea, label as lblEl } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { NumberInput } from '../../../src/components/NumberInput.js';
import { Select } from '../../../src/components/Select.js';
import { Checkbox } from '../../../src/components/Checkbox.js';
import { Button } from '../../../src/components/Button.js';
import { Card } from '../../../src/components/Card.js';
import { Stack, Grid } from '../../../src/components/Layout.js';
import { Badge } from '../../../src/components/Badge.js';
import { onText, onCheck } from '../../helpers.js';
import { AssetInput } from '../AssetInput.js';
import {
  emptyNpc, emptyTopic, emptyChoice, emptyPage, emptyEffect, emptyCondition,
  emptyCombat, emptyEnemyAction,
  _rid,
} from '../../schema.js';
import { slug, uniqueId, ensureFlag, idsOf, flagKeys } from '../../helpers.js';
import {
  ensureQuestLog, appendQuestLogEntries,
  offerTopic, progressTopic, turninTopic, menuChoicesForQuest,
  goalCompletionExpr, injectCombatWinFlag, makeOpSimple,
} from './_quests.js';

// ── rng + helpers ────────────────────────────────────────────────────────────

const _pickRandom = arr => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
const _sampleN    = (arr, n) => {
  const out = [];
  const pool = [...arr];
  const want = Math.min(n, pool.length);
  while (out.length < want) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
};

// Parse the names textarea. Each non-empty line is "name" or "name: g1, g2"
// where the suffix declares the name's group tags. Whitespace is forgiving.
const _parseNames = text => String(text || '')
  .split('\n')
  .map(line => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const [namePart, groupsPart] = trimmed.split(':');
    const name = (namePart || '').trim();
    if (!name) return null;
    const groups = (groupsPart || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return { name, groups };
  })
  .filter(Boolean);

// portrait.tags ⊆ npc.tags - empty required tags match anyone.
const _matchesNpc = (entryGroups, npcGroups) => {
  const set = new Set(npcGroups);
  return (entryGroups || []).every(g => set.has(g));
};

// Build a one-shot ${…} interpolator over a fixed scope. JS expressions are
// evaluated with Function() - same semantics as the editor's runtime ${…}.
// Failures fall back to '' so a typo in one expression doesn't poison the
// whole page text.
const _interpolate = vars => text => {
  if (!text) return '';
  const keys = Object.keys(vars);
  const vals = Object.values(vars);
  return String(text).replace(/\$\{([^}]+)\}/g, (_, expr) => {
    try {
      const fn = new Function(...keys, `return (${expr})`);
      const v = fn(...vals);
      return v == null ? '' : String(v);
    } catch (_) { return ''; }
  });
};

// ── defaults ─────────────────────────────────────────────────────────────────

const defaults = project => {
  const firstRooms = project.rooms.filter(r => r.kind !== 'story').slice(0, 3);
  return {
    groups: [
      { key: 'male',   label: 'Male'   },
      { key: 'female', label: 'Female' },
    ],
    namesText: 'Aldo: male\nBrenna: female\nCorvin: male\nDelia: female\nEnzo: male\nGreta: female\nRiley\nAlex: male,female',
    portraits: [],                  // [{ src, tags: [groupKey...] }]
    placesPicked: Object.fromEntries(firstRooms.map(r => [r.id, true])),
    topics: [
      // Topics can lock to a tag subset (same rule as portraits / quests),
      // carry a runtime GUARD (flag or stat condition gates the menu choice),
      // and pay a once-only reward when the player exits the topic. Reward
      // amount is rolled per NPC at gen time (within [rewardMin, rewardMax])
      // so 20 NPCs carrying the same template each give a different fixed tip.
      { title: 'Greeting',     response: 'Hi there, I\'m ${name}.',                                            tags: [] },
      { title: 'Town gossip',  response: 'Strange lights flicker over the old mill at night.',                  tags: [] },
      { title: 'Army talk',    response: 'The new general is a fool. Half the recruits couldn\'t hold a pike.', tags: ['male'] },
      { title: 'About the gate', response: 'Glad they finally lowered the gate - here, a little something for the road.',
        tags: [], guardMode: 'flag', guardFlag: 'tower_gate_down', guardFlagValue: true,
        rewardStat: 'gold', rewardMin: 1, rewardMax: 3 },
      { title: 'Concerned look', response: 'You look pale. Drink this, on me.',
        tags: [], guardMode: 'stat', guardStat: 'hp', guardOp: '<=', guardStatValue: 7,
        rewardStat: 'hp', rewardMin: 2, rewardMax: 5 },
    ],
    quests: [],                     // [{ title, offer, progressHint, done, tags: [...], goalType, …goal-specific fields }]
    // Name templating - prefix / suffix concatenated around the base name from
    // the names pool. Both interpolate `${name}` (the base), `${groups}`, etc.
    namePrefix:      '',
    nameSuffix:      '',
    // Folder organisation - all generated NPCs and any uploaded portraits get
    // tagged with this prefix so mass-generated entries are easy to clean up.
    folderPrefix:    '',
    count: 5,
    minTopicsPerNpc: 1,
    maxTopicsPerNpc: 2,
    wanderRooms:     3,
    crowdPercent:    30,
    absentPercent:   0,
    offAreaPercent:  0,             // chance per tick that a crowd NPC is off-map (no room)
  };
};

// Quest "templates" - each spawns `copies` concrete quests at build time, with
// per-copy randomisation on fetch (random item + rolled count) and fight
// (rolled stats per copy). Flag goals can either share a flag across copies
// (one-shot world events) or get a per-copy suffix (20 NPCs each with their
// own diary, lost locket, etc.).
const _emptyQuest = () => ({
  title:        '',
  offer:        '',
  progressHint: '',
  done:         '',
  tags:         [],
  copies:       1,                // how many concrete quests this template spawns
  goalType:     'flag',           // 'fetch' | 'fight' | 'flag'

  // ── fetch ────────────────────────────────────────────────────────────────
  fetchMode:      'fixed',        // 'fixed' (one item + one count) | 'random' (pool + range)
  fetchItemId:    '',             // fixed
  fetchCount:     1,              // fixed
  fetchItemPool:  [],             // random - list of item ids
  fetchCountMin:  1,              // random
  fetchCountMax:  3,              // random

  // ── fight ───────────────────────────────────────────────────────────────
  fightMode:        'existing',   // 'existing' | 'create' (rolled enemy stats per copy)
  fightCombatId:    '',           // existing
  fightEnemyName:   'Bandit',     // create - supports ${name} template (the giver NPC's name)
  fightHpMin:       8,            // create - range rolled per copy
  fightHpMax:       16,
  fightDamageMin:   1,
  fightDamageMax:   3,
  fightDefense:     0,

  // ── flag ────────────────────────────────────────────────────────────────
  flagMode:        'new',         // 'existing' | 'new'
  flagKey:         '',            // existing
  newFlagKey:      '',            // new - slugified before declaration
  flagPerCopy:     true,          // when copies > 1, auto-suffix `_<i>` so each copy gets its own flag
  flagValue:       true,
});

const _flagify = s => String(s || '').trim().toLowerCase()
  .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

const _resolvedQuestFlag = q => q.flagMode === 'new'
  ? _flagify(q.newFlagKey)
  : (q.flagKey || '');

// ── small reusable chip checkbox row for group tagging ───────────────────────

const _groupChips = (groups, selected, onToggle) => groups.length === 0
  ? span({ style: 'font-size:11px; color:var(--text-muted)' })(['(no groups defined yet - add some in Step 1)'])
  : div({ style: 'display:flex; flex-wrap:wrap; gap:8px; align-items:center' })(
      groups.map(g => Checkbox({
        checked:  (selected || []).includes(g.key),
        onChange: onCheck(v => onToggle(v
          ? [...(selected || []), g.key]
          : (selected || []).filter(k => k !== g.key))),
      })([g.label || g.key])),
    );

// ── step renderers ───────────────────────────────────────────────────────────

const _stepPools = ({ values, setValue }) => {
  const groups    = values.groups    || [];
  const portraits = values.portraits || [];

  const _patchGroup  = (i, patch) => setValue('groups', groups.map((g, k) => k === i ? { ...g, ...patch } : g));
  const _removeGroup = i => setValue('groups', groups.filter((_, k) => k !== i));

  return Stack({ gap: 14 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Groups are tags. Each NPC carries a set of them. Portraits, quests and topic templates can reference those tags. Default: ',
      span({ className: 'dv-mono' })(['male']), ' / ',
      span({ className: 'dv-mono' })(['female']),
      ' - add more for factions, professions, age, whatever.',
    ]),

    Card({ title: 'Groups' })([
      Stack({ gap: 6 })([
        ...groups.map((g, i) => Grid({ cols: 3, gap: 8 })([
          TextInput({
            label:   i === 0 ? 'Key (used in templates)' : '',
            value:   g.key || '',
            onInput: e => _patchGroup(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }),
            placeholder: 'male',
          }),
          TextInput({
            label:   i === 0 ? 'Label (display)' : '',
            value:   g.label || '',
            onInput: e => _patchGroup(i, { label: e.target.value }),
            placeholder: 'Male',
          }),
          div({ style: 'display:flex; align-items:end' })([
            Button({ size: 'sm', variant: 'ghost', onClick: () => _removeGroup(i) })(['Remove']),
          ]),
        ])),
        Button({
          size: 'sm', variant: 'ghost',
          onClick: () => setValue('groups', [...groups, { key: '', label: '' }]),
        })(['+ Add group']),
      ]),
    ]),

    Card({ title: 'Names' })([
      Stack({ gap: 6 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:12px' })([
          'One per line. Add a suffix to tag the name with groups: ',
          span({ className: 'dv-mono' })(['Aldo: male']),
          ' or ', span({ className: 'dv-mono' })(['Riley: male, female']),
          ' for unisex. Bare names (no suffix) have no group tags - they\'ll only attract portraits/quests that don\'t require any tag.',
        ]),
        div({ className: 'field' })([
          textarea({
            className: 'input',
            rows:      8,
            value:     values.namesText || '',
            oninput:   e => setValue('namesText', e.target.value),
            placeholder: 'Aldo: male\nBrenna: female\nRiley: male, female\n…',
            style:     'width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-family:inherit; font-size:13px; line-height:1.5; resize:vertical',
          })([]),
        ]),
        // Optional name templating - prefix and suffix wrapped around the base
        // name from the pool. Both support ${...} interpolation with `name`
        // (the base name), `groups` (the NPC's tag array), and `index`.
        div({ style: 'margin-top:6px' })([
          span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })([
            'Optional name templating',
          ]),
          p({ style: 'margin:0 0 6px; color:var(--text-muted); font-size:12px' })([
            'Prefix and suffix get prepended / appended to the rolled base name. ',
            span({ className: 'dv-mono' })(['${groups.includes("guard") ? " the Guard" : ""}']),
            ' for a conditional suffix; ',
            span({ className: 'dv-mono' })(['${groups.includes("priest") ? "Father " : ""}']),
            ' for a conditional prefix. Plain text works too - anything outside ', span({ className: 'dv-mono' })(['${…}']), ' is kept verbatim.',
          ]),
          Grid({ cols: 2, gap: 8 })([
            TextInput({
              label:       'Name prefix template',
              value:       values.namePrefix || '',
              onInput:     e => setValue('namePrefix', e.target.value),
              placeholder: '${groups.includes("priest") ? "Father " : ""}',
            }),
            TextInput({
              label:       'Name suffix template',
              value:       values.nameSuffix || '',
              onInput:     e => setValue('nameSuffix', e.target.value),
              placeholder: '${groups.includes("guard") ? " the Guard" : ""}',
            }),
          ]),
        ]),
      ]),
    ]),

    Card({ title: 'Portraits' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:12px' })([
          'Each portrait declares which groups the NPC must carry. A portrait is eligible only when its required tags are a ',
          span({ style: 'font-weight:600' })(['subset']),
          ' of the NPC\'s tags. Leave required-groups empty for portraits that match anyone.',
        ]),
        ...portraits.map((portrait, i) => div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); display:flex; flex-direction:column; gap:8px' })([
          div({ style: 'display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end' })([
            AssetInput({
              label:    'Portrait',
              value:    portrait.src || '',
              onChange: v => setValue('portraits', portraits.map((p, k) => k === i ? { ...p, src: v } : p)),
              accept:   'image',
            }),
            Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('portraits', portraits.filter((_, k) => k !== i)) })(['x']),
          ]),
          div({})([
            span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Required groups (subset match)']),
            _groupChips(groups, portrait.tags, next => setValue('portraits', portraits.map((p, k) => k === i ? { ...p, tags: next } : p))),
          ]),
        ])),
        Button({
          size: 'sm', variant: 'ghost',
          onClick: () => setValue('portraits', [...portraits, { src: '', tags: [] }]),
        })(['+ Add portrait']),
      ]),
    ]),
  ]);
};

const _stepWorld = ({ values, setValue, project }) => {
  const rooms  = project.rooms.filter(r => r.kind !== 'story');
  const picked = values.placesPicked || {};
  const topics = values.topics || [];
  const _patchTopic = (i, patch) => setValue('topics', topics.map((t, k) => k === i ? { ...t, ...patch } : t));
  return Stack({ gap: 14 })([
    Card({ title: 'Places' })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted); font-size:13px' })([
        'Which rooms NPCs can spawn in. Regular NPCs get one (random); crowd NPCs get a few and wander between them via ',
        span({ className: 'dv-mono' })(['ctx.tickWorld()']),
        '.',
      ]),
      rooms.length === 0
        ? div({ style: 'font-size:12px; color:var(--text-muted)' })(['No non-story rooms in project - add some first.'])
        : div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:6px' })(
            rooms.map(r => Checkbox({
              checked:  !!picked[r.id],
              onChange: onCheck(v => setValue('placesPicked', { ...picked, [r.id]: v })),
            })([`${r.title || r.id} (${r.id})`])),
          ),
    ]),
    Card({ title: 'Conversation topics' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:12px' })([
          'Each NPC gets a random subset (count range in step 4) of topics that pass three filters: tag subset, optional runtime ',
          span({ className: 'dv-mono' })(['guard']),
          ' (flag or stat condition gates the menu choice), and optional ',
          span({ className: 'dv-mono' })(['reward']),
          ' (once-only stat tip given when the player exits the topic - rolled per NPC). Responses interpolate ',
          span({ className: 'dv-mono' })(['${name}']),
          ' / ', span({ className: 'dv-mono' })(['${groups}']),
          ' at gen time; JS expressions in ', span({ className: 'dv-mono' })(['${…}']),
          ' work too.',
        ]),
        ...topics.map((t, i) => {
          const flagOpts = [
            { value: '', label: '- pick flag -' },
            ...(project.flags || []).map(f => ({ value: f.key, label: f.key })),
          ];
          const statOpts = [
            { value: '', label: '- pick stat -' },
            ...(project.stats || []).filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key })),
          ];
          return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); display:flex; flex-direction:column; gap:10px' })([
            div({ style: 'display:grid; grid-template-columns: 1fr 2fr auto; gap:8px; align-items:end' })([
              TextInput({
                label:    'Topic title',
                value:    t.title || '',
                onInput:  e => _patchTopic(i, { title: e.target.value }),
              }),
              TextInput({
                label:       'NPC response (template)',
                value:       t.response || '',
                onInput:     e => _patchTopic(i, { response: e.target.value }),
                placeholder: 'Hi, I\'m ${name}.',
              }),
              Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('topics', topics.filter((_, k) => k !== i)) })(['Remove']),
            ]),

            // ── Required groups ────────────────────────────────────────────
            div({})([
              span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Required groups (subset match)']),
              _groupChips(values.groups || [], t.tags, next => _patchTopic(i, { tags: next })),
            ]),

            // ── Runtime guard ──────────────────────────────────────────────
            div({ style: 'padding-top:8px; border-top:1px dashed var(--border)' })([
              span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Guard (runtime condition for the menu choice)']),
              Grid({ cols: 4, gap: 8 })([
                Select({
                  label:    'Mode',
                  options:  [
                    { value: 'none', label: 'none - always shown' },
                    { value: 'flag', label: 'flag check' },
                    { value: 'stat', label: 'stat compare' },
                  ],
                  value:    t.guardMode || 'none',
                  onChange: onText(v => _patchTopic(i, { guardMode: v })),
                }),
                ...(t.guardMode === 'flag'
                  ? [
                      Select({
                        label:    'Flag',
                        options:  flagOpts,
                        value:    t.guardFlag || '',
                        onChange: onText(v => _patchTopic(i, { guardFlag: v })),
                      }),
                      Select({
                        label:    'Required value',
                        options:  [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                        value:    String(!!t.guardFlagValue),
                        onChange: onText(v => _patchTopic(i, { guardFlagValue: v === 'true' })),
                      }),
                      div({})([]),
                    ]
                  : t.guardMode === 'stat'
                    ? [
                        Select({
                          label:    'Stat',
                          options:  statOpts,
                          value:    t.guardStat || '',
                          onChange: onText(v => _patchTopic(i, { guardStat: v })),
                        }),
                        Select({
                          label:    'Op',
                          options:  [
                            { value: '>=', label: '≥' }, { value: '>', label: '>' },
                            { value: '==', label: '=' }, { value: '!=', label: '≠' },
                            { value: '<=', label: '≤' }, { value: '<', label: '<' },
                          ],
                          value:    t.guardOp || '>=',
                          onChange: onText(v => _patchTopic(i, { guardOp: v })),
                        }),
                        NumberInput({
                          label:    'Value',
                          value:    Number(t.guardStatValue) || 0,
                          onChange: v => _patchTopic(i, { guardStatValue: Number(v) || 0 }),
                          style:    'justify-self:start',
                        }),
                      ]
                    : [div({})([]), div({})([]), div({})([])]),
              ]),
            ]),

            // ── One-time reward ────────────────────────────────────────────
            div({ style: 'padding-top:8px; border-top:1px dashed var(--border)' })([
              span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Once-only reward (rolled per NPC at gen time)']),
              Grid({ cols: 3, gap: 8 })([
                Select({
                  label:    'Reward stat',
                  options:  [{ value: '', label: '- none -' }, ...(project.stats || []).filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key }))],
                  value:    t.rewardStat || '',
                  onChange: onText(v => _patchTopic(i, { rewardStat: v })),
                }),
                NumberInput({
                  label:    'Min',
                  value:    Number(t.rewardMin) || 0,
                  onChange: v => _patchTopic(i, { rewardMin: Number(v) || 0 }),
                  style:    'justify-self:start',
                }),
                NumberInput({
                  label:    'Max',
                  value:    Number(t.rewardMax) || 0,
                  onChange: v => _patchTopic(i, { rewardMax: Number(v) || 0 }),
                  style:    'justify-self:start',
                }),
              ]),
              ...(t.rewardStat && Math.max(0, Number(t.rewardMax) || 0) > 0
                ? [div({ style: 'font-size:11px; color:var(--text-muted)' })([
                    `Each NPC carrying this topic rolls a fixed amount in [${Math.max(0, Number(t.rewardMin) || 0)}, ${Math.max(0, Number(t.rewardMax) || 0)}] at gen time. Fired ONCE per (player x NPC) when the player picks Goodbye on the topic. A per-instance flag (topic_<topicId>_claimed) gates the second fire.`,
                  ])]
                : []),
            ]),
          ]);
        }),
        Button({
          size: 'sm', variant: 'ghost',
          onClick: () => setValue('topics', [...topics, { title: '', response: '', tags: [], guardMode: 'none', rewardStat: '', rewardMin: 0, rewardMax: 0 }]),
        })(['+ Add topic']),
      ]),
    ]),
  ]);
};

const _stepQuests = ({ values, setValue, project }) => {
  const quests = values.quests || [];
  const groups = values.groups || [];
  const _patch  = (i, patch) => setValue('quests', quests.map((q, k) => k === i ? { ...q, ...patch } : q));
  const itemOpts = [
    { value: '', label: '- pick item -' },
    ...project.items.map(it => ({ value: it.id, label: `${it.name || it.id} (${it.id})` })),
  ];
  const combatOpts = [
    { value: '', label: '- pick combat -' },
    ...(project.combats || []).map(c => ({ value: c.id, label: `${c.name || c.id} (${c.id})` })),
  ];
  const flagOpts = [
    { value: '', label: '- pick flag -' },
    ...(project.flags || []).map(f => ({ value: f.key, label: f.key })),
  ];
  return Stack({ gap: 14 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Each quest is a ', span({ style: 'font-weight:600' })(['template']),
      ' that spawns ', _kbdInline('copies'),
      ' concrete quests at build time. Per-copy randomisation: ',
      _kbdInline('fetch'), ' rolls a random item from a pool + random count, ',
      _kbdInline('fight'), ' creates a fresh combat with rolled stats, ',
      _kbdInline('flag'), ' (one-shot, recommended) optionally suffixes ',
      _kbdInline('_<i>'), ' on the flag name so each copy stands alone (set ',
      _kbdInline('flagPerCopy'), ' off for shared world-event flags). Each concrete quest gets pinned to ONE eligible NPC (subset-tag match), and that NPC owns offer / progress / turn-in end to end. Quest log + sidebar 📜 link auto-managed.',
    ]),
    ...quests.map((q, i) => Card({ title: `Quest ${i + 1}: ${q.title || '(untitled)'}` })([
      Stack({ gap: 10 })([
        // ── Header: title + copies + remove ──────────────────────────────────
        div({ style: 'display:grid; grid-template-columns: 3fr 1fr auto; gap:8px; align-items:end' })([
          TextInput({
            label:   'Title (template)',
            value:   q.title || '',
            onInput: e => _patch(i, { title: e.target.value }),
            placeholder: 'Find the ${groups.includes("guard") ? "patrol" : "shipment"}',
          }),
          NumberInput({
            label:    'Copies',
            value:    Math.max(1, Number(q.copies) || 1),
            min:      1, max: 200,
            onChange: v => _patch(i, { copies: Math.max(1, Math.min(200, Number(v) || 1)) }),
            style:    'justify-self:start',
          }),
          Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('quests', quests.filter((_, k) => k !== i)) })(['Remove']),
        ]),
        Grid({ cols: 3, gap: 8 })([
          TextInput({
            label:   'Offer text' + (q.goalType === 'fetch' ? ' (optional - auto: "Bring me ${count} ${item}.")' : ''),
            value:   q.offer || '',
            onInput: e => _patch(i, { offer: e.target.value }),
            placeholder: q.goalType === 'fight' ? 'Defeat the ${enemy}.'
                       : q.goalType === 'flag'  ? 'Lower the tower gate, will you?'
                       : 'Bring me ${count} ${item}.',
          }),
          TextInput({
            label:   'Progress hint',
            value:   q.progressHint || '',
            onInput: e => _patch(i, { progressHint: e.target.value }),
            placeholder: q.goalType === 'fight' ? 'The ${enemy} still walks free.'
                       : q.goalType === 'flag'  ? 'Any luck with that gate?'
                       : 'Still need those ${item}.',
          }),
          TextInput({
            label:   'Done text' + (q.goalType === 'fetch' ? ' (optional - auto: "Thanks for the ${item}.")' : ''),
            value:   q.done || '',
            onInput: e => _patch(i, { done: e.target.value }),
            placeholder: q.goalType === 'fight' ? 'Glad the ${enemy} is dealt with.'
                       : q.goalType === 'flag'  ? 'Thanks, the gate is down.'
                       : 'Thanks for the ${item}.',
          }),
        ]),
        // Available template vars per goal - surfacing what the user can drop
        // into ${…} inside the texts above.
        div({ style: 'font-size:11px; color:var(--text-muted); line-height:1.5' })([
          'Templates: ', _kbdInline('${name}'), ', ', _kbdInline('${groups}'), ' (NPC) + ',
          ...(q.goalType === 'fetch'
            ? [_kbdInline('${item}'), ', ', _kbdInline('${count}'), ', ', _kbdInline('${itemId}'),
               ' (rolled per copy). Leave any field blank to auto-fill from those values.']
            : q.goalType === 'fight' && q.fightMode === 'create'
              ? [_kbdInline('${enemy}'), ', ', _kbdInline('${hp}'), ', ', _kbdInline('${damage}'), ' (rolled per copy).']
              : q.goalType === 'fight'
                ? [_kbdInline('${enemy}'), ' (the picked combat\'s enemy name).']
                : [_kbdInline('${flag}'), ' (the resolved flag key).']),
        ]),

        // ── Goal type ────────────────────────────────────────────────────────
        Select({
          label:    'Goal',
          options:  [
            { value: 'flag',  label: '🏁 flag  - wait for a flag value (recommended one-shot)' },
            { value: 'fetch', label: '📦 fetch - bring N of an item (consumed on turn-in)'      },
            { value: 'fight', label: '⚔️ fight - win a combat'                                  },
          ],
          value:    q.goalType || 'flag',
          onChange: onText(v => _patch(i, { goalType: v })),
        }),

        // ── Fetch goal ───────────────────────────────────────────────────────
        ...(q.goalType === 'fetch'
          ? [
              Select({
                label:    'Fetch mode',
                options:  [
                  { value: 'fixed',  label: 'fixed - same item + same count across copies' },
                  { value: 'random', label: 'random - roll item from pool, roll count from range (mass-gen)' },
                ],
                value:    q.fetchMode || 'fixed',
                onChange: onText(v => _patch(i, { fetchMode: v })),
              }),
              ...(q.fetchMode === 'random'
                ? [
                    div({})([
                      span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Item pool - each copy rolls one of these']),
                      project.items.length === 0
                        ? span({ style: 'font-size:12px; color:var(--text-muted)' })(['(no items in project - add some first)'])
                        : div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:6px' })(
                            project.items.map(it => Checkbox({
                              checked:  (q.fetchItemPool || []).includes(it.id),
                              onChange: onCheck(v => _patch(i, {
                                fetchItemPool: v
                                  ? [...(q.fetchItemPool || []), it.id]
                                  : (q.fetchItemPool || []).filter(x => x !== it.id),
                              })),
                            })([`${it.name || it.id} (${it.id})`])),
                          ),
                    ]),
                    Grid({ cols: 2, gap: 8 })([
                      NumberInput({
                        label:    'Count min',
                        value:    Math.max(1, Number(q.fetchCountMin) || 1),
                        min:      1,
                        onChange: v => _patch(i, { fetchCountMin: Math.max(1, Number(v)) }),
                        style:    'justify-self:start',
                      }),
                      NumberInput({
                        label:    'Count max',
                        value:    Math.max(1, Number(q.fetchCountMax) || 1),
                        min:      1,
                        onChange: v => _patch(i, { fetchCountMax: Math.max(1, Number(v)) }),
                        style:    'justify-self:start',
                      }),
                    ]),
                  ]
                : [
                    Grid({ cols: 2, gap: 8 })([
                      Select({
                        label:    'Item to fetch',
                        options:  itemOpts,
                        value:    q.fetchItemId || '',
                        onChange: onText(v => _patch(i, { fetchItemId: v })),
                      }),
                      NumberInput({
                        label:    'Count needed',
                        value:    Math.max(1, Number(q.fetchCount) || 1),
                        min:      1,
                        onChange: v => _patch(i, { fetchCount: Math.max(1, Number(v) || 1) }),
                        style:    'justify-self:start',
                      }),
                    ]),
                  ]),
            ]
          : []),

        // ── Fight goal ───────────────────────────────────────────────────────
        ...(q.goalType === 'fight'
          ? [
              Select({
                label:    'Fight mode',
                options:  [
                  { value: 'existing', label: 'existing - pick a combat from the project'     },
                  { value: 'create',   label: 'create - generate a fresh combat per copy with rolled stats (mass-gen)' },
                ],
                value:    q.fightMode || 'existing',
                onChange: onText(v => _patch(i, { fightMode: v })),
              }),
              ...(q.fightMode === 'create'
                ? [
                    TextInput({
                      label:       'Enemy name (template)',
                      value:       q.fightEnemyName || '',
                      onInput:     e => _patch(i, { fightEnemyName: e.target.value }),
                      placeholder: '${name}\'s tormentor',
                    }),
                    Grid({ cols: 3, gap: 8 })([
                      NumberInput({
                        label:    'Enemy HP min',
                        value:    Math.max(1, Number(q.fightHpMin) || 1),
                        min:      1,
                        onChange: v => _patch(i, { fightHpMin: Math.max(1, Number(v) || 1) }),
                        style:    'justify-self:start',
                      }),
                      NumberInput({
                        label:    'Enemy HP max',
                        value:    Math.max(1, Number(q.fightHpMax) || 1),
                        min:      1,
                        onChange: v => _patch(i, { fightHpMax: Math.max(1, Number(v) || 1) }),
                        style:    'justify-self:start',
                      }),
                      div()([]),
                    ]),
                    Grid({ cols: 3, gap: 8 })([
                      NumberInput({
                        label:    'Enemy damage min',
                        value:    Math.max(0, Number(q.fightDamageMin) || 0),
                        min:      0,
                        onChange: v => _patch(i, { fightDamageMin: Math.max(0, Number(v) || 0) }),
                        style:    'justify-self:start',
                      }),
                      NumberInput({
                        label:    'Enemy damage max',
                        value:    Math.max(0, Number(q.fightDamageMax) || 0),
                        min:      0,
                        onChange: v => _patch(i, { fightDamageMax: Math.max(0, Number(v) || 0) }),
                        style:    'justify-self:start',
                      }),
                      NumberInput({
                        label:    'Enemy defense',
                        value:    Math.max(0, Number(q.fightDefense) || 0),
                        min:      0,
                        onChange: v => _patch(i, { fightDefense: Math.max(0, Number(v) || 0) }),
                        style:    'justify-self:start',
                      }),
                    ]),
                    div({ style: 'font-size:11px; color:var(--text-muted)' })([
                      'Each copy creates a new combat (', _kbdInline('combat_<questId>_<i>'), '). Enemy stats are rolled uniformly within the ranges; the combat\'s ', _kbdInline('onWin'),
                      ' carries the win-flag op the quest watches.',
                    ]),
                  ]
                : [
                    Select({
                      label:    'Combat to win',
                      options:  combatOpts,
                      value:    q.fightCombatId || '',
                      onChange: onText(v => _patch(i, { fightCombatId: v })),
                    }),
                    div({ style: 'font-size:11px; color:var(--text-muted)' })([
                      'Builder appends ', _kbdInline(`flags.combat_${q.fightCombatId || '<id>'}_won = true`),
                      ' to the combat\'s onWin so the flag flips automatically. All copies share the same combat → they all complete when it\'s won.',
                    ]),
                  ]),
            ]
          : []),

        // ── Flag goal ────────────────────────────────────────────────────────
        ...(q.goalType === 'flag'
          ? [
              Select({
                label:    'Flag source',
                options:  [
                  { value: 'existing', label: 'use existing flag' },
                  { value: 'new',      label: 'create new flag (e.g. tower_gate_up)' },
                ],
                value:    q.flagMode || 'new',
                onChange: onText(v => _patch(i, { flagMode: v })),
              }),
              Grid({ cols: 2, gap: 8 })([
                q.flagMode === 'new'
                  ? TextInput({
                      label:       'New flag name',
                      value:       q.newFlagKey || '',
                      onInput:     e => _patch(i, { newFlagKey: e.target.value }),
                      placeholder: 'tower_gate_up',
                    })
                  : Select({
                      label:    'Flag to watch',
                      options:  flagOpts,
                      value:    q.flagKey || '',
                      onChange: onText(v => _patch(i, { flagKey: v })),
                    }),
                Select({
                  label:    'Expected value',
                  options:  [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                  value:    String(!!q.flagValue),
                  onChange: onText(v => _patch(i, { flagValue: v === 'true' })),
                }),
              ]),
              ...(Math.max(1, Number(q.copies) || 1) > 1
                ? [div({})([
                    Checkbox({
                      checked:  !!q.flagPerCopy,
                      onChange: onCheck(v => _patch(i, { flagPerCopy: v })),
                    })([
                      'Unique flag per copy - appends ',
                      span({ className: 'dv-mono' })(['_<i>']),
                      ` so 20 copies of "${_flagify(q.newFlagKey) || 'flag'}" become "${_flagify(q.newFlagKey) || 'flag'}_1" … "${_flagify(q.newFlagKey) || 'flag'}_${Math.max(1, Number(q.copies) || 1)}". Turn off for a shared world-event flag.`,
                    ]),
                  ])]
                : []),
              div({ style: 'font-size:11px; color:var(--text-muted)' })([
                q.flagMode === 'new' && _flagify(q.newFlagKey)
                  ? `New flag${Math.max(1, Number(q.copies) || 1) > 1 && q.flagPerCopy ? 's' : ''} will be declared with initial false. Wire flags.${_flagify(q.newFlagKey)}${Math.max(1, Number(q.copies) || 1) > 1 && q.flagPerCopy ? '_<i>' : ''} = ${q.flagValue ? 'true' : 'false'} from anywhere (lever, room onEnter, combat onWin) and the quest auto-completes.`
                  : 'Set the chosen flag from anywhere - the quest is ready to turn in the moment state.flags[key] matches.',
              ]),
            ]
          : []),

        // ── Required groups ──────────────────────────────────────────────────
        div({})([
          span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:4px' })(['Required groups (subset match)']),
          _groupChips(groups, q.tags, next => _patch(i, { tags: next })),
        ]),
      ]),
    ])),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => setValue('quests', [...quests, _emptyQuest()]),
    })(['+ Add quest template']),
  ]);
};

// Inline monospace span - saves a few characters in long messages.
const _kbdInline = text => span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2, rgba(0,0,0,.04)); padding:1px 5px; border-radius:3px' })([text]);

// Small helper for the field hints. `field` lays them out with the input on
// top and the hint text right under so they look consistent without each one
// being its own wrapped Stack.
const _genField = (input, hint) => div({ style: 'display:flex; flex-direction:column; gap:4px' })([
  div()([input]),
  div({ style: 'font-size:11.5px; color:var(--text-muted); line-height:1.4' })([hint]),
]);

const _stepGeneration = ({ values, setValue }) => {
  // Live preview of the breakdown so the user sees how the percentages turn
  // into actual NPCs as they tweak them.
  const total    = Number(values.count) || 0;
  const absent   = Math.round(total * (Number(values.absentPercent) || 0) / 100);
  const present  = total - absent;
  const crowd    = Math.round(present * (Number(values.crowdPercent) || 0) / 100);
  const regular  = present - crowd;
  return Stack({ gap: 12 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'How many NPCs and how varied / mobile. The percentages stack: absent comes off the top, then crowd is a slice of what\'s left. Live preview of the breakdown:',
    ]),
    div({ style: 'padding:8px 12px; background:var(--surface-2, rgba(0,0,0,0.04)); border-radius:var(--radius); font-size:12.5px; font-family:ui-monospace,monospace; color:var(--text)' })([
      `${total} total  →  ${regular} regular · ${crowd} crowd · ${absent} absent`,
    ]),

    Grid({ cols: 2, gap: 14 })([
      _genField(
        NumberInput({
          label: 'Count',
          value: Number(values.count) || 1,
          min:   1,
          onChange: v => setValue('count', Math.max(1, Number(v))),
          style: 'justify-self:start',
        }),
        'How many NPCs to generate in total. Names / portraits / topics are sampled per NPC, so duplicates are fine on the inputs - the cast still varies.',
      ),
      _genField(
        NumberInput({
          label: 'Rooms per crowd NPC',
          value: Number(values.wanderRooms) || 1,
          min:   1, max: 20,
          onChange: v => setValue('wanderRooms', Math.max(1, Math.min(20, Number(v) || 1))),
          style: 'justify-self:start',
        }),
        'How many of the picked rooms a "crowd" NPC gets assigned. ctx.tickWorld() then bounces them between those rooms each tick. Regular (non-crowd) NPCs always get exactly one room.',
      ),
    ]),

    Grid({ cols: 2, gap: 14 })([
      _genField(
        NumberInput({
          label: 'Min topics per NPC',
          value: Number(values.minTopicsPerNpc) || 0,
          min:   0, max: 20,
          onChange: v => setValue('minTopicsPerNpc', Math.max(0, Math.min(20, Number(v) || 0))),
          style: 'justify-self:start',
        }),
        'Lower bound on conversation topics per NPC. The actual count is a uniform random pick within [min, max], capped at how many topics survived the per-NPC tag filter. Set to 0 to allow silent NPCs.',
      ),
      _genField(
        NumberInput({
          label: 'Max topics per NPC',
          value: Number(values.maxTopicsPerNpc) || 1,
          min:   0, max: 20,
          onChange: v => setValue('maxTopicsPerNpc', Math.max(0, Math.min(20, Number(v) || 1))),
          style: 'justify-self:start',
        }),
        'Upper bound. Sampling is without replacement, so a single NPC never gets the same topic twice even if the range allows it.',
      ),
    ]),

    Grid({ cols: 2, gap: 14 })([
      _genField(
        NumberInput({
          label: 'Crowd % (wandering)',
          value: Number(values.crowdPercent) || 0,
          min:   0, max: 100,
          onChange: v => setValue('crowdPercent', Math.max(0, Math.min(100, Number(v) || 0))),
          style: 'justify-self:start',
        }),
        'What fraction of NPCs WANDER between rooms (the rest stay rooted to a single room for the whole game). A wanderer gets "Rooms per crowd NPC" locations and the engine moves them between those rooms every time the game calls ctx.tickWorld(). 0 = everyone is stationary; 100 = everyone wanders.',
      ),
      _genField(
        NumberInput({
          label: 'Absent % (no location at all)',
          value: Number(values.absentPercent) || 0,
          min:   0, max: 100,
          onChange: v => setValue('absentPercent', Math.max(0, Math.min(100, Number(v) || 0))),
          style: 'justify-self:start',
        }),
        'Fraction of the TOTAL count that lands with empty locations - they exist as project entities but never spawn anywhere. A "potential cast" you can wire in by hand later (or another wizard run).',
      ),
    ]),

    Grid({ cols: 2, gap: 14 })([
      _genField(
        NumberInput({
          label: 'Wander off-area % (crowd only)',
          value: Number(values.offAreaPercent) || 0,
          min:   0, max: 99,
          onChange: v => setValue('offAreaPercent', Math.max(0, Math.min(99, Number(v) || 0))),
          style: 'justify-self:start',
        }),
        'Per-tick chance a WANDERING NPC is off the playable map (running errands, sleeping, whatever). Implemented by sprinkling empty-string slots into the locations array so ctx.tickWorld() randomly picks "nowhere" with this probability. 0 = always inside one of the picked rooms; capped at 99% because a stuck-off-area NPC is useless.',
      ),
      _genField(
        TextInput({
          label:       'Folder prefix',
          value:       values.folderPrefix || '',
          onInput:     e => setValue('folderPrefix', e.target.value),
          placeholder: 'wave1 / townfolk / batch_2026',
        }),
        'Everything generated lands inside this folder so cleanup is one click. NPCs get folder "<prefix>/<distribution>[/<groups>]" (without the prefix it\'s just "<distribution>/<groups>"). Newly-uploaded portrait assets (via the AssetInput\'s Upload button on step 1) also get this prefix when their folder is currently empty.',
      ),
    ]),
  ]);
};

const _stepReview = ({ values }) => {
  const names    = _parseNames(values.namesText);
  const places   = Object.keys(values.placesPicked || {}).filter(k => values.placesPicked[k]);
  const topics   = (values.topics || []).filter(t => t.title);
  const quests   = (values.quests || []).filter(q => q.title);
  const portraits = (values.portraits || []).filter(p => p.src);
  const total    = Number(values.count) || 0;
  const absent   = Math.round(total * (Number(values.absentPercent) || 0) / 100);
  const present  = total - absent;
  const crowd    = Math.round(present * (Number(values.crowdPercent) || 0) / 100);
  const regular  = present - crowd;
  return Card({ title: 'About to generate' })([
    Stack({ gap: 4 })([
      div({})([`Groups: ${(values.groups || []).length}`]),
      div({})([`Names: ${names.length} (`, ...names.slice(0, 3).map((n, i, a) => span({})([i > 0 ? ', ' : '', n.name, n.groups.length ? ` (${n.groups.join(',')})` : ''])), names.length > 3 ? span({})([', …']) : '', ')']),
      div({})([`Portraits: ${portraits.length}`]),
      div({})([`Places picked: ${places.length}`]),
      div({})([`Topics: ${topics.length}`]),
      div({})([`Quests: ${quests.length}`]),
      div({})([`NPCs total: ${total}`]),
      div({ style: 'padding-left:12px; color:var(--text-muted); font-size:12px' })([
        `→ ${regular} regular · ${crowd} crowd · ${absent} absent`,
      ]),
    ]),
  ]);
};

// ── step validators ──────────────────────────────────────────────────────────

const _validatePools = values => {
  const groups = values.groups || [];
  const seen = new Set();
  for (const g of groups) {
    if (g.key && seen.has(g.key)) return `Duplicate group key "${g.key}".`;
    if (g.key) seen.add(g.key);
  }
  const names = _parseNames(values.namesText);
  if (names.length === 0) return 'Add at least one name to the names pool.';
  return null;
};

const _validateWorld = values => {
  const places = Object.keys(values.placesPicked || {}).filter(k => values.placesPicked[k]);
  if (places.length === 0) return 'Pick at least one place - generated NPCs need somewhere to stand.';
  const topics = (values.topics || []).filter(t => t.title && t.response);
  if (topics.length === 0 && (Number(values.minTopicsPerNpc) || 0) > 0) {
    return 'Add at least one topic, or set "Min topics per NPC" to 0 on the next step.';
  }
  return null;
};

const _validateQuests = values => {
  for (let i = 0; i < (values.quests || []).length; i++) {
    const q = values.quests[i];
    const filled = q.title || q.offer || q.done || q.progressHint;
    if (!filled) continue;
    if (!q.title) {
      return `Quest ${i + 1}: title required (remove the row to skip).`;
    }
    // Fetch fills sensible defaults ("Bring me ${count} ${item}." etc.) when
    // text is blank - only flag and fight need explicit prose since the goal
    // isn't self-describing.
    if (q.goalType !== 'fetch' && (!q.offer || !q.done)) {
      return `Quest ${i + 1}: ${q.goalType} goals need offer + done text (fetch quests auto-fill from the rolled item / count).`;
    }
    if (q.goalType === 'fetch') {
      if (q.fetchMode === 'random') {
        if (!(q.fetchItemPool || []).length) return `Quest ${i + 1}: fetch goal (random) needs at least one item in the pool.`;
        const mn = Math.max(1, Number(q.fetchCountMin) || 1);
        const mx = Math.max(1, Number(q.fetchCountMax) || 1);
        if (mn > mx) return `Quest ${i + 1}: fetch count min must be ≤ max.`;
      } else {
        if (!q.fetchItemId) return `Quest ${i + 1}: fetch goal needs an item picked.`;
      }
    }
    if (q.goalType === 'fight') {
      if (q.fightMode === 'create') {
        if (!q.fightEnemyName || !q.fightEnemyName.trim()) return `Quest ${i + 1}: fight goal (create) needs an enemy name.`;
        const hpMn = Math.max(1, Number(q.fightHpMin) || 1);
        const hpMx = Math.max(1, Number(q.fightHpMax) || 1);
        if (hpMn > hpMx) return `Quest ${i + 1}: enemy HP min must be ≤ max.`;
        const dmMn = Math.max(0, Number(q.fightDamageMin) || 0);
        const dmMx = Math.max(0, Number(q.fightDamageMax) || 0);
        if (dmMn > dmMx) return `Quest ${i + 1}: enemy damage min must be ≤ max.`;
      } else {
        if (!q.fightCombatId) return `Quest ${i + 1}: fight goal needs a combat picked.`;
      }
    }
    if (q.goalType === 'flag' && !_resolvedQuestFlag(q)) {
      return `Quest ${i + 1}: flag goal needs a flag (${q.flagMode === 'new' ? 'type a new flag name' : 'pick an existing flag'}).`;
    }
  }
  return null;
};

const _validateGeneration = values => {
  if ((Number(values.count) || 0) < 1) return 'Generate at least one NPC.';
  if ((Number(values.minTopicsPerNpc) || 0) > (Number(values.maxTopicsPerNpc) || 0)) {
    return 'Min topics per NPC must be ≤ max topics per NPC.';
  }
  return null;
};

const steps = [
  { title: 'Pools',      render: _stepPools,      validate: _validatePools     },
  { title: 'World',      render: _stepWorld,      validate: _validateWorld     },
  { title: 'Quests',     render: _stepQuests,     validate: _validateQuests    },
  { title: 'Generation', render: _stepGeneration, validate: _validateGeneration },
  { title: 'Review',     render: _stepReview                                   },
];

// ── per-NPC topic builders ───────────────────────────────────────────────────

// Goal-aware default text for the four quest fields. Fetch quests come with
// a self-describing default ("Bring me ${count} ${item}.") because the goal
// is concrete; flag and fight quests don't auto-fill because the goal isn't
// self-evident to the player. Used only when the user leaves the field blank.
const _questTextDefaults = quest => {
  if (quest?.goalType === 'fetch') return {
    offer:        'Bring me ${count} ${item}.',
    progressHint: 'Still need those ${item}.',
    done:         'Thanks for the ${item}.',
  };
  return { offer: '', progressHint: '', done: '' };
};

// Extra template vars exposed inside the quest text fields, in addition to
// `${name}` / `${groups}` / `${index}` from the NPC. Lets the user write
// "Defeat the ${enemy}." once and have it interpolate per copy.
const _questGoalVars = (quest, project) => {
  const out = {};
  if (quest.goalType === 'fetch') {
    const item = project.items.find(it => it.id === quest.goal.fetchItemId);
    out.item   = item?.name || quest.goal.fetchItemId || 'item';
    out.itemId = quest.goal.fetchItemId || '';
    out.count  = quest.goal.fetchCount;
  } else if (quest.goalType === 'fight') {
    if (quest.fightMode === 'create') {
      out.hp     = quest.fightRolledHp;
      out.damage = quest.fightRolledDamage;
      // `enemy` is filled in below at emit time after the enemy-name template
      // gets interpolated against the giver NPC's `${name}`.
    } else {
      const combat = (project.combats || []).find(c => c.id === quest.fightCombatId);
      out.enemy  = combat?.enemy?.name || combat?.name || 'foe';
    }
  } else if (quest.goalType === 'flag') {
    out.flag = quest.goal.flagKey || '';
  }
  return out;
};

// Turn a topic template's guard config into a JS expression. Returns '' when
// no guard is set (the menu choice stays unconditional).
const _topicGuardExpr = template => {
  if (template.guardMode === 'flag' && template.guardFlag) {
    return template.guardFlagValue
      ? `!!c.state.flags?.${template.guardFlag}`
      : `!c.state.flags?.${template.guardFlag}`;
  }
  if (template.guardMode === 'stat' && template.guardStat) {
    const op = ['>=','>','==','!=','<=','<'].includes(template.guardOp) ? template.guardOp : '>=';
    const v  = Number(template.guardStatValue) || 0;
    return `(Number(c.state.${template.guardStat}) || 0) ${op} ${v}`;
  }
  return '';
};

// Roll the reward amount in [min, max] when reward is configured. Returns
// `null` when the topic doesn't grant a reward so callers can branch.
const _rollTopicReward = template => {
  if (!template.rewardStat) return null;
  const mn = Math.max(0, Number(template.rewardMin) || 0);
  const mx = Math.max(mn, Number(template.rewardMax) || 0);
  if (mx <= 0) return null;
  return { stat: template.rewardStat, amount: _rollRange(mn, mx) };
};

// A conversation topic. When `reward` is set (and `claimedFlag` provided),
// the Back choice carries a two-op simple effect: add the reward stat AND
// flip the claimed flag, both gated by `!claimed` so a second visit pays
// nothing. The exit reads "Back" - it returns to the NPC's Menu topic, not
// out of the conversation entirely; only the Menu carries "Goodbye".
const _conversationTopic = ({ id, title, response, reward, claimedFlag }) => {
  const back = { ...emptyChoice(), label: 'Back', flow: 'exitBack' };
  if (reward && claimedFlag) {
    const gate = { ...emptyCondition(), mode: 'js', expr: `!c.state.flags?.${claimedFlag}` };
    back.action = {
      ...emptyEffect(),
      mode: 'simple',
      ops: [
        { target: reward.stat,            op: 'add', value: reward.amount, condition: gate,
          min: { enabled: false, statKey: '', mul: 0, const: 0 },
          max: { enabled: false, statKey: '', mul: 0, const: 0 } },
        { target: `flags.${claimedFlag}`, op: 'set', value: true,         condition: gate,
          min: { enabled: false, statKey: '', mul: 0, const: 0 },
          max: { enabled: false, statKey: '', mul: 0, const: 0 } },
      ],
    };
  }
  return {
    ...emptyTopic(),
    ...(id ? { id } : {}),
    name:    title || 'Topic',
    pages:   [{ ...emptyPage(), text: response || '', advanceLabel: 'OK' }],
    choices: [back],
  };
};

// Menu topic for the NPC. Conversation sub-topics carry an optional guard
// expression (compiled from the topic template's guardMode); quest menu
// choices (offer / progress / turn-in) are state-gated. Goodbye lives at the
// bottom and runs `flow: 'exitBack'` on an empty stack - leaves the NPC.
const _menuTopicFor = (convSubTopicSpecs, questMenuChoiceGroups) => ({
  ...emptyTopic(),
  name:  'Menu',
  pages: [{ ...emptyPage(), text: '', advanceLabel: 'More' }],
  choices: [
    ...convSubTopicSpecs.map(({ topic, guardExpr }) => {
      const choice = {
        ...emptyChoice(),
        label:   topic.name,
        flow:    'change',
        topicId: topic.id,
      };
      if (guardExpr) {
        choice.condition = { ...emptyCondition(), mode: 'js', expr: guardExpr };
      }
      return choice;
    }),
    ...questMenuChoiceGroups.flat(),
    { ...emptyChoice(), label: 'Goodbye.', flow: 'exitBack' },
  ],
});

// ── template expansion ──────────────────────────────────────────────────────

// Roll a uniform integer in [mn, mx]. mn and mx are clamped to non-negative
// integers; swap is automatic when mn > mx.
const _rollRange = (mn, mx) => {
  const a = Math.max(0, Math.floor(Number(mn) || 0));
  const b = Math.max(0, Math.floor(Number(mx) || 0));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
};

// Each quest template spawns `copies` concrete quest descriptors. Per-copy
// randomisation (fetch item from pool, rolled count, rolled enemy stats) is
// frozen here; per-NPC interpolation of text + (for fight create) combat
// creation happens later in the emit phase.
const _expandTemplate = template => {
  const copies = Math.max(1, Math.floor(Number(template.copies) || 1));
  const out = [];
  for (let copyIdx = 1; copyIdx <= copies; copyIdx++) {
    const base = {
      title:        template.title,
      offer:        template.offer,
      progressHint: template.progressHint,
      done:         template.done,
      tags:         template.tags || [],
      goalType:     template.goalType,
      copyIdx,
      copies,
    };
    if (template.goalType === 'flag') {
      const baseKey = _resolvedQuestFlag(template);
      const resolvedFlagKey = copies > 1 && template.flagPerCopy && baseKey
        ? `${baseKey}_${copyIdx}`
        : baseKey;
      out.push({
        ...base,
        flagMode:        template.flagMode,
        resolvedFlagKey,
        flagValue:       !!template.flagValue,
      });
    } else if (template.goalType === 'fetch') {
      if (template.fetchMode === 'random') {
        const pool = template.fetchItemPool || [];
        const itemId = _pickRandom(pool) || '';
        const count = Math.max(1, _rollRange(template.fetchCountMin, template.fetchCountMax) || 1);
        out.push({ ...base, fetchMode: 'random', fetchItemId: itemId, fetchCount: count });
      } else {
        out.push({
          ...base,
          fetchMode:   'fixed',
          fetchItemId: template.fetchItemId,
          fetchCount:  Math.max(1, Number(template.fetchCount) || 1),
        });
      }
    } else if (template.goalType === 'fight') {
      if (template.fightMode === 'create') {
        out.push({
          ...base,
          fightMode:         'create',
          fightEnemyName:    template.fightEnemyName,
          fightRolledHp:     Math.max(1, _rollRange(template.fightHpMin,     template.fightHpMax)),
          fightRolledDamage: Math.max(0, _rollRange(template.fightDamageMin, template.fightDamageMax)),
          fightDefense:      Math.max(0, Number(template.fightDefense) || 0),
        });
      } else {
        out.push({ ...base, fightMode: 'existing', fightCombatId: template.fightCombatId });
      }
    }
  }
  return out;
};

// ── top-level build ──────────────────────────────────────────────────────────

const build = (project, values) => {
  let next = project;

  // ── normalise inputs ──
  const groupsDef = (values.groups || []).filter(g => g.key);
  const namePool  = _parseNames(values.namesText);
  const portraits = (values.portraits || []).filter(p => p.src);
  const places    = Object.keys(values.placesPicked || {}).filter(k => values.placesPicked[k]);
  const topicsPool = (values.topics || []).filter(t => t.title && t.response);
  const questsPool = (values.quests || []).filter(q => q.title && q.offer);
  const count     = Math.max(1, Number(values.count) || 0);
  const minT      = Math.max(0, Number(values.minTopicsPerNpc) || 0);
  const maxT      = Math.max(minT, Number(values.maxTopicsPerNpc) || 0);
  const wander    = Math.max(1, Number(values.wanderRooms)   || 1);
  const crowdPct  = Math.max(0, Math.min(100, Number(values.crowdPercent)  || 0));
  const absentPct = Math.max(0, Math.min(100, Number(values.absentPercent) || 0));
  const offAreaPct = Math.max(0, Math.min(99,  Number(values.offAreaPercent) || 0));
  const folderPrefix = String(values.folderPrefix || '').trim();
  const namePrefixTpl = String(values.namePrefix || '');
  const nameSuffixTpl = String(values.nameSuffix || '');

  if (namePool.length === 0 || places.length === 0) {
    return { project, summary: 'Nothing generated - names pool or places pool is empty.' };
  }

  // ── expand templates into concrete quests, then pre-allocate their flags
  // and side-effects (existing combats get the onWin flag injection now; fight
  // CREATE-mode combats are built per NPC in the emit phase since the enemy
  // name template needs the assigned NPC's `${name}` in scope).
  const concreteQuests = questsPool.flatMap(_expandTemplate);
  const questsWithIds = concreteQuests.map(q => {
    const taken = flagKeys(next);
    const seed = slug(q.title) || 'quest';
    let qid = seed;
    let n = 2;
    while (taken.has(`q_${qid}_done`)) qid = `${seed}_${n++}`;
    next = ensureFlag(`q_${qid}_started`)(false)(next);
    next = ensureFlag(`q_${qid}_done`)(false)(next);

    const goal = { goalType: q.goalType };
    if (q.goalType === 'flag') {
      const key = q.resolvedFlagKey;
      if (q.flagMode === 'new' && key) next = ensureFlag(key)(false)(next);
      goal.flagKey   = key;
      goal.flagValue = q.flagValue;
    } else if (q.goalType === 'fetch') {
      goal.fetchItemId = q.fetchItemId;
      goal.fetchCount  = q.fetchCount;
    } else if (q.goalType === 'fight') {
      if (q.fightMode === 'existing' && q.fightCombatId) {
        const combatFlag = `combat_${q.fightCombatId}_won`;
        next = ensureFlag(combatFlag)(false)(next);
        next = injectCombatWinFlag(q.fightCombatId, combatFlag)(next);
        goal.fightCombatFlag = combatFlag;
      }
      // fight create-mode: combat created in the emit phase below.
    }
    return { ...q, qid, goal };
  });

  // ── roll each NPC: name → groups → portrait → location → topics ──
  // We defer quest assignment until after all NPCs are rolled so we can
  // pick from the right eligible pool per quest.
  const rolled = [];
  for (let i = 0; i < count; i++) {
    const nameEntry = _pickRandom(namePool);                            // { name, groups }
    const npcGroups = nameEntry.groups || [];
    const baseName  = nameEntry.name;

    // Name templating: the prefix and suffix templates see `${name}` (the
    // base from the pool), `${groups}` (tag array) and `${index}`. The final
    // composed NPC name is what subsequent topic / quest templates see in
    // their `${name}` slot.
    const baseInterp = _interpolate({ name: baseName, groups: npcGroups, index: i });
    const prefixStr  = baseInterp(namePrefixTpl);
    const suffixStr  = baseInterp(nameSuffixTpl);
    const fullName   = `${prefixStr}${baseName}${suffixStr}`.trim() || baseName;
    const interp     = _interpolate({ name: fullName, groups: npcGroups, index: i });

    const eligiblePortraits = portraits.filter(p => _matchesNpc(p.tags, npcGroups));
    const portrait = eligiblePortraits.length ? _pickRandom(eligiblePortraits).src : '';

    const isAbsent = Math.random() * 100 < absentPct;
    const isCrowd  = !isAbsent && Math.random() * 100 < crowdPct;
    let locations  = isAbsent ? [] : (isCrowd ? _sampleN(places, wander) : [_pickRandom(places)]);

    // Crowd-only off-area sentinels: empty strings in the locations array
    // never match a real sceneId in `npcsAt`, so the engine's tickWorld()
    // sometimes picks "nowhere" for this NPC and they vanish for that tick.
    // Ratio math: empty_count / (real + empty) ≈ offAreaPct/100.
    if (isCrowd && offAreaPct > 0 && offAreaPct < 100 && locations.length > 0) {
      const empties = Math.max(1, Math.round(locations.length * offAreaPct / (100 - offAreaPct)));
      locations = [...locations, ...Array(empties).fill('')];
    }

    // Tag-filter the topic pool before sampling - asking a commoner about
    // army stuff doesn't land, and a topic with `tags: []` is open to anyone.
    const eligibleTopics = topicsPool.filter(t => _matchesNpc(t.tags, npcGroups));
    const topicCount     = eligibleTopics.length === 0 ? 0
      : Math.min(maxT, Math.max(minT, Math.floor(Math.random() * (maxT - minT + 1)) + minT));
    const convTemplates = _sampleN(eligibleTopics, topicCount);
    // Each chosen template becomes a per-NPC topic instance with its OWN
    // claimed flag (so 20 NPCs giving the same `gold` tip each track their
    // payout independently). Guard + reward are baked in at this point;
    // the menu choice gets the guard expression at emit time.
    const convSpecs = convTemplates.map(template => {
      const topicId = `topic_${_rid()}`;
      const guardExpr   = _topicGuardExpr(template);
      const reward      = _rollTopicReward(template);
      const claimedFlag = reward ? `${topicId}_claimed` : null;
      const topic = _conversationTopic({
        id:       topicId,
        title:    interp(template.title),
        response: interp(template.response),
        reward,
        claimedFlag,
      });
      return { topic, guardExpr, claimedFlag };
    });

    rolled.push({
      i, name: fullName, groups: npcGroups, portrait, locations,
      isAbsent, isCrowd, convSpecs, interp,
    });
  }

  // ── assign quests: pick eligible NPC per quest, at most one quest per NPC ──
  const giverMap = new Map();
  const claimedNpcs = new Set();
  let skippedQuests = 0;
  for (const q of questsWithIds) {
    const candidates = rolled
      .filter(r => !claimedNpcs.has(r.i))
      .filter(r => _matchesNpc(q.tags, r.groups));
    if (candidates.length === 0) { skippedQuests++; continue; }
    const winner = _pickRandom(candidates);
    claimedNpcs.add(winner.i);
    giverMap.set(winner.i, q);
  }

  // ── ensure Quest Log room + 📜 sidebar link if any quests will actually be
  // assigned (skipped quests don't earn one). Idempotent - questGiver-built
  // quest logs are reused and just get extra rows appended.
  if (giverMap.size > 0) next = ensureQuestLog(next);

  // ── emit NPCs ──
  const summaryRows = [];
  for (const r of rolled) {
    const assignedQuest = giverMap.get(r.i);

    // Per-quest offer / progress / turn-in trio + the three state-gated menu
    // choices that gate them. All three sub-topics live on the SAME NPC so
    // the player turns the quest in with the giver who pitched it. The
    // turn-in topic's extraOps consume the fetch item when applicable (so
    // the quest isn't endlessly repeatable - the items are gone).
    let questSubTopics  = [];
    let questMenuGroups = [];
    if (assignedQuest) {
      const qid = assignedQuest.qid;
      const subTopicIds = {
        offer:    `topic_${_rid()}`,
        progress: `topic_${_rid()}`,
        turnin:   `topic_${_rid()}`,
      };

      // Fight-create combats are built per NPC now (the enemy name template
      // references `${name}` of the giver). The combat carries the
      // win-flag op directly in its onWin so completion compiles as
      // `!!c.state.flags?.combat_<id>_won`.
      let createdEnemyName = '';
      if (assignedQuest.goalType === 'fight' && assignedQuest.fightMode === 'create') {
        createdEnemyName = r.interp(assignedQuest.fightEnemyName) || 'Foe';
        const newCombatId = uniqueId(`combat_${qid}`, idsOf('combats')(next));
        const combatFlag  = `combat_${newCombatId}_won`;
        const newCombat = {
          ...emptyCombat(newCombatId),
          name: createdEnemyName,
          enemy: {
            ...emptyCombat(newCombatId).enemy,
            name:    createdEnemyName,
            hp:      assignedQuest.fightRolledHp,
            defense: assignedQuest.fightDefense,
            actions: [{
              ...emptyEnemyAction(),
              damage: assignedQuest.fightRolledDamage,
            }],
          },
          onWin: { ...emptyEffect(), mode: 'simple', ops: [makeOpSimple(`flags.${combatFlag}`, 'set', true)] },
        };
        next = ensureFlag(combatFlag)(false)(next);
        next = { ...next, combats: [...(next.combats || []), newCombat] };
        assignedQuest.goal.fightCombatFlag = combatFlag;
      }

      // Quest text gets a richer interpolation scope than topic text - NPC
      // vars (name/groups/index) PLUS goal-specific vars (item/count for
      // fetch, enemy/hp/damage for fight, flag for flag). The fight-create
      // enemy name is already interpolated above so it's stashed under
      // ${enemy} alongside the rolled stats.
      const goalVars = _questGoalVars(assignedQuest, next);
      if (createdEnemyName) goalVars.enemy = createdEnemyName;
      const qInterp = _interpolate({ name: r.name, groups: r.groups, index: r.i, ...goalVars });

      const defaults     = _questTextDefaults(assignedQuest);
      const title        = qInterp(assignedQuest.title) || assignedQuest.title || 'Quest';
      const offerText    = qInterp(assignedQuest.offer        || defaults.offer);
      const progressText = qInterp(assignedQuest.progressHint || defaults.progressHint);
      const doneText     = qInterp(assignedQuest.done         || defaults.done);

      const extraOps = [];
      if (assignedQuest.goalType === 'fetch' && assignedQuest.goal.fetchItemId) {
        extraOps.push(makeOpSimple(
          `inv.${assignedQuest.goal.fetchItemId}`,
          'take',
          assignedQuest.goal.fetchCount,
        ));
      }
      questSubTopics = [
        offerTopic   ({ id: subTopicIds.offer,    qid, title, offerText                    }),
        progressTopic({ id: subTopicIds.progress,      title, progressHint: progressText   }),
        turninTopic  ({ id: subTopicIds.turnin,   qid, title, doneText, extraOps           }),
      ];
      questMenuGroups = [menuChoicesForQuest({
        qid, title, subTopicIds,
        completionExpr: goalCompletionExpr(assignedQuest.goal),
      })];
      // Append the two display rows on the quest_log room. Done here (not
      // during quest-id allocation) so the title string is post-interpolation.
      next = appendQuestLogEntries(qid, title)(next);
    }

    // Declare per-instance claimed flags for topic rewards so they appear in
    // Project → Flags from the start at value `false`.
    for (const spec of r.convSpecs) {
      if (spec.claimedFlag) next = ensureFlag(spec.claimedFlag)(false)(next);
    }

    const convTopics    = r.convSpecs.map(s => s.topic);
    const allSubTopics  = [...convTopics, ...questSubTopics];
    const useAdvanced   = allSubTopics.length > 0;

    let topics = [];
    let entryId = '';
    if (useAdvanced) {
      const menu = _menuTopicFor(r.convSpecs, questMenuGroups);
      // Quest sub-topics get appended after conversation sub-topics so the
      // topics array reads top-down: menu / chats / offer / progress / turnin.
      topics  = [menu, ...convTopics, ...questSubTopics];
      entryId = menu.id;
    }

    const folderTag = r.isAbsent ? 'absent' : (r.isCrowd ? 'crowd' : 'random');
    const folderTail = r.groups.length ? `${folderTag}/${r.groups.join('+')}` : folderTag;
    const folder    = folderPrefix ? `${folderPrefix}/${folderTail}` : folderTail;
    const npcId = uniqueId(`npc_${slug(r.name) || 'villager'}`, idsOf('npcs')(next));
    const npc = {
      ...emptyNpc(npcId),
      name:          r.name,
      locations:     r.locations,
      folder,
      greeting:      assignedQuest ? `${r.name} watches you, hopeful.` : `${r.name} nods at you.`,
      portrait:      r.portrait,
      role:          'dialogue',
      advanced:      useAdvanced,
      pages:         [{ ...emptyPage(), text: '', advanceLabel: 'More' }],
      choices:       useAdvanced ? [] : [{ ...emptyChoice(), label: 'Goodbye.', to: '' }],
      topics,
      entryTopicId:  entryId,
    };
    next = { ...next, npcs: [...next.npcs, npc] };
    summaryRows.push({ name: r.name, isAbsent: r.isAbsent, isCrowd: r.isCrowd, gaveQuest: !!assignedQuest });
  }

  // ── tag catalogue assets used as portraits with the folder prefix when
  // they don't already carry one. Only `asset:<id>` refs touched - plain
  // URLs aren't in the project's asset catalogue. Existing non-empty folders
  // are left alone so we never overwrite the user's own organisation.
  let taggedAssets = 0;
  if (folderPrefix) {
    const usedAssetIds = new Set();
    for (const r of rolled) {
      if (typeof r.portrait === 'string' && r.portrait.startsWith('asset:')) {
        usedAssetIds.add(r.portrait.slice('asset:'.length));
      }
    }
    if (usedAssetIds.size > 0) {
      next = {
        ...next,
        assets: (next.assets || []).map(a => {
          if (!usedAssetIds.has(a.id)) return a;
          if (a.folder && a.folder.trim()) return a;
          taggedAssets++;
          return { ...a, folder: folderPrefix };
        }),
      };
    }
  }

  const absentN = summaryRows.filter(r => r.isAbsent).length;
  const crowdN  = summaryRows.filter(r => r.isCrowd).length;
  const questN  = summaryRows.filter(r => r.gaveQuest).length;
  const regular = summaryRows.length - absentN - crowdN;
  const skipNote = skippedQuests > 0 ? ` · ${skippedQuests} quest${skippedQuests === 1 ? '' : 's'} skipped (no eligible NPC)` : '';
  const assetNote = taggedAssets > 0 ? ` · ${taggedAssets} asset${taggedAssets === 1 ? '' : 's'} foldered` : '';
  return {
    project: next,
    summary: `Added ${summaryRows.length} NPCs (${regular} regular · ${crowdN} crowd · ${absentN} absent${questN ? ` · ${questN} carry quests` : ''}${skipNote}${assetNote}).`,
  };
};

export const randomNpcs = {
  id:          'randomNpcs',
  icon:        '👥',
  name:        'Random NPCs',
  description: 'Bulk-generate a cast from grouped pools. Names carry group tags; portraits / quests target tag subsets. Topic responses interpolate ${name} / ${groups} so the same template produces different lines per NPC.',
  defaults,
  steps,
  build,
};
