/**
 * questGiver builder — adds one or more quests to either a brand-new NPC or
 * an existing dialogue NPC. Each quest gets its own offer / progress / turn-in
 * topic; the menu choices are appended to a shared "Quests" topic on the NPC.
 *
 * Goal types:
 *   fetch — completion = player has N of an item
 *   fight — completion = player has won a chosen combat. Builder injects a
 *           `combat_<combatId>_won = true` flag-set op into the combat's
 *           onWin so the flag flips automatically.
 *   flag  — completion = player flag matches an expected value (works for
 *           any externally-set flag).
 *
 * Pickup gate (when the "Tell me about <quest>" choice shows up):
 *   always   — visible the moment the player meets the giver
 *   afterFlag — visible only after a chosen flag is set to a chosen value
 *               (use a previous quest's q_<id>_done flag to chain quests)
 *   js       — author's own boolean JS expression with `c` in scope
 *
 * Existing NPCs:
 *   advanced — Quests topic and a "Talk about your work" change-choice are
 *              appended to their existing entry topic. Idempotent on re-run.
 *   simple   — Converted on the fly: existing flat choices become an extra
 *              "Talk" topic, a Menu topic is introduced as the new entry with
 *              Talk + Quests + Goodbye change-choices. Their pages stay as
 *              greeting pages.
 *
 * Quest Log + sidebar link are reused from the original builder (one-time
 * room creation, two display rows per quest).
 */

import { p, div, span, textarea, label as lblEl } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { NumberInput } from '../../../src/components/NumberInput.js';
import { Select } from '../../../src/components/Select.js';
import { Button } from '../../../src/components/Button.js';
import { Stack, Grid } from '../../../src/components/Layout.js';
import { Card } from '../../../src/components/Card.js';
import { Badge } from '../../../src/components/Badge.js';
import { onText } from '../../helpers.js';
import {
  emptyNpc, emptyTopic, emptyChoice, emptyPage, emptyEffect, emptyCondition,
  emptyItem, emptyPrice, _rid,
} from '../../schema.js';
import {
  slug, uniqueId, ensureFlag, ensureSidebarWidget, idsOf, flagKeys,
} from './_helpers.js';

// ── per-quest defaults ───────────────────────────────────────────────────────

const _emptyQuestForm = (project) => ({
  rowKey:        _rid(),                  // stable key for React-style identity
  title:         '',
  questId:       '',
  offerText:     '',
  progressHint:  '',
  turninText:    '',
  // goal
  goalType:      'fetch',                 // 'fetch' | 'fight' | 'flag'
  fetchItemMode: 'existing',              // 'existing' | 'new'
  fetchItemId:   project.items[0]?.id || '',
  fetchItemName: '',
  fetchCount:    1,
  fightCombatId: project.combats?.[0]?.id || '',
  flagMode:      'existing',              // 'existing' | 'new'
  flagKey:       project.flags?.[0]?.key || '',
  newFlagKey:    '',                      // free-form, sanitised on build
  flagValue:     true,
  // pickup gate
  pickupMode:    'always',                // 'always' | 'afterFlag' | 'afterStat' | 'js'
  pickupFlagMode: 'existing',             // 'existing' | 'new'
  pickupFlag:    project.flags?.[0]?.key || '',
  newPickupFlag: '',
  pickupFlagValue: true,
  pickupStat:    project.stats[0]?.key || '',
  pickupOp:      '>=',                    // '>=' | '>' | '==' | '!=' | '<=' | '<'
  pickupStatValue: 0,
  pickupJs:      '',
  // reward
  rewardStat:    project.stats.find(s => s.key === 'gold') ? 'gold' : (project.stats[0]?.key || ''),
  rewardAmount:  20,
});

const defaults = project => {
  const firstRoom = project.rooms.find(r => r.kind !== 'story');
  const dialogueNpcs = project.npcs.filter(n => n.role === 'dialogue');
  return {
    giverMode:     'new',                 // 'new' | 'existing'
    npcName:       'Quest Giver',
    location:      firstRoom?.id || '',
    existingNpcId: dialogueNpcs[0]?.id || '',
    quests:        [{ ..._emptyQuestForm(project), title: 'The Lost Cat', offerText: 'My cat ran off into the woods. Bring her home and I\'ll make it worth your while.', progressHint: 'Still searching for her? She likes shiny things, if that helps.', turninText: 'You found her! Bless you. Here\'s your reward.' }],
  };
};

// ── tiny shape helpers (used by both UI and build) ───────────────────────────

const _effectiveQuestId = q =>
  (q.questId || slug(q.title) || 'q1').replace(/[^a-z0-9_]/g, '_') || 'q1';

// Sanitise a user-typed flag name into a state-key-safe identifier.
// Keeps it lowercase + underscores; empty input → '' so callers can detect
// the "user hasn't typed anything yet" case.
const _flagify = s => String(s || '').trim().toLowerCase()
  .replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

// Resolve a flag-mode + key pair from the form. Returns '' when nothing
// usable was typed/picked so downstream code can short-circuit.
const _resolvedGoalFlag   = q => q.flagMode === 'new'
  ? _flagify(q.newFlagKey)
  : (q.flagKey || '');
const _resolvedPickupFlag = q => q.pickupFlagMode === 'new'
  ? _flagify(q.newPickupFlag)
  : (q.pickupFlag || '');

const _isFightQuestValid  = q => q.goalType === 'fight' && q.fightCombatId;
const _isFlagQuestValid   = q => q.goalType === 'flag'  && !!_resolvedGoalFlag(q);
const _isFetchQuestValid  = q => q.goalType === 'fetch' &&
  (q.fetchItemMode === 'new'
    ? !!q.fetchItemName
    : !!q.fetchItemId);
const _isQuestValid = q => !!q.title && (
  _isFightQuestValid(q) || _isFlagQuestValid(q) || _isFetchQuestValid(q)
);

// ── step renderers ───────────────────────────────────────────────────────────

const _stepGiver = ({ values, setValue, project }) => {
  const dialogueNpcs = project.npcs.filter(n => n.role === 'dialogue');
  return Stack({ gap: 10 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Add the quests to a fresh NPC or hand them to one you already have. Existing simple-mode NPCs are converted on the fly — their original choices land on a new "Talk" topic so nothing is lost.',
    ]),
    Select({
      label:    'Giver',
      options:  [
        { value: 'new',      label: '➕ Create a new NPC for these quests' },
        { value: 'existing', label: '👤 Add to an existing dialogue NPC'    },
      ],
      value:    values.giverMode || 'new',
      onChange: onText(v => setValue('giverMode', v)),
    }),
    ...(values.giverMode === 'new'
      ? [
          TextInput({
            label:   'NPC name',
            value:   values.npcName || '',
            onInput: e => setValue('npcName', e.target.value),
          }),
          Select({
            label:   'Location',
            options: [
              { value: '', label: '— pick room (you can change later) —' },
              ...project.rooms.filter(r => r.kind !== 'story').map(r => ({ value: r.id, label: r.title || r.id })),
            ],
            value:    values.location || '',
            onChange: onText(v => setValue('location', v)),
          }),
        ]
      : [
          Select({
            label:    'Existing NPC',
            options:  dialogueNpcs.length === 0
              ? [{ value: '', label: '(no dialogue NPCs in project — switch to "Create new")' }]
              : [{ value: '', label: '— pick NPC —' }, ...dialogueNpcs.map(n => ({
                  value: n.id,
                  label: `${n.name || n.id} (${n.advanced ? 'advanced' : 'simple'})`,
                }))],
            value:    values.existingNpcId || '',
            onChange: onText(v => setValue('existingNpcId', v)),
          }),
          ...(values.existingNpcId
            ? (() => {
                const n = project.npcs.find(x => x.id === values.existingNpcId);
                if (!n) return [];
                return [div({ style: 'font-size:11px; color:var(--text-muted); padding:6px 8px; background:var(--surface-2, rgba(0,0,0,0.04)); border-radius:var(--radius)' })([
                  n.advanced
                    ? '✓ Already advanced — quests will be appended to a "Quests" topic and a single hub choice will land on the entry topic (idempotent).'
                    : 'Will be converted: pages kept as greeting, flat choices wrapped into a "Talk" topic, a new Menu topic becomes the entry with Talk + Quests + Goodbye.',
                ])];
              })()
            : []),
        ]),
  ]);
};

// One quest card. Heavy on inputs — `_textarea` saves a few lines per field.
const _textarea = ({ label, value, onInput, rows = 3, placeholder = '' }) =>
  div({ className: 'field' })([
    lblEl({ className: 'field-label' })([label]),
    textarea({
      className: 'input',
      rows,
      value:    value || '',
      oninput:  onInput,
      placeholder,
      style:    'width:100%; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-family:inherit; font-size:13px; line-height:1.5; resize:vertical',
    })([]),
  ]);

const _questCard = ({ index, quest, project, setValue, values, onRemove }) => {
  const patchQuest = patch => setValue('quests', values.quests.map((q, k) => k === index ? { ...q, ...patch } : q));
  const effectiveId = _effectiveQuestId(quest);
  const goalOpts = [
    { value: 'fetch', label: '📦 fetch — bring N of an item' },
    { value: 'fight', label: '⚔️ fight — win a combat'        },
    { value: 'flag',  label: '🏁 flag — wait for a flag value' },
  ];
  const pickupOpts = [
    { value: 'always',    label: 'always — offered as soon as the player meets the giver'        },
    { value: 'afterFlag', label: 'after flag — only after a chosen flag matches'                 },
    { value: 'afterStat', label: 'after stat — only when a stat is >=, ==, < etc. than a number' },
    { value: 'js',        label: 'js — custom predicate (advanced)'                              },
  ];
  const pickupOpOpts = [
    { value: '>=', label: '≥ (at least)' },
    { value: '>',  label: '> (more than)' },
    { value: '==', label: '= (equals)' },
    { value: '!=', label: '≠ (not equal)' },
    { value: '<=', label: '≤ (at most)' },
    { value: '<',  label: '< (less than)' },
  ];

  return Card({
    title: `Quest ${index + 1}: ${quest.title || '(untitled)'}`,
    style: 'margin-bottom:8px',
  })([
    Stack({ gap: 10 })([
      div({ style: 'display:flex; justify-content:flex-end; gap:6px' })([
        Badge({ variant: 'gray' })([quest.goalType]),
        Badge({ variant: 'gray' })([`id: ${effectiveId}`]),
        Button({ size: 'sm', variant: 'ghost', onClick: onRemove })(['Remove']),
      ]),
      Grid({ cols: 2, gap: 8 })([
        TextInput({
          label:   'Title',
          value:   quest.title || '',
          onInput: e => patchQuest({ title: e.target.value }),
        }),
        TextInput({
          label:       'ID (optional)',
          value:       quest.questId || '',
          onInput:     e => patchQuest({ questId: e.target.value }),
          placeholder: effectiveId,
        }),
      ]),
      _textarea({
        label:   'Offer text',
        value:   quest.offerText,
        onInput: e => patchQuest({ offerText: e.target.value }),
        rows:    3,
      }),
      _textarea({
        label:   'Progress hint',
        value:   quest.progressHint,
        onInput: e => patchQuest({ progressHint: e.target.value }),
        rows:    2,
      }),
      _textarea({
        label:   'Turn-in text',
        value:   quest.turninText,
        onInput: e => patchQuest({ turninText: e.target.value }),
        rows:    2,
      }),

      // ── goal ──
      Select({
        label:    'Goal',
        options:  goalOpts,
        value:    quest.goalType || 'fetch',
        onChange: onText(v => patchQuest({ goalType: v })),
      }),
      ...(quest.goalType === 'fetch'
        ? [
            Grid({ cols: 2, gap: 8 })([
              Select({
                label:    'Item source',
                options:  [
                  { value: 'existing', label: 'use existing item' },
                  { value: 'new',      label: 'create new item'   },
                ],
                value:    quest.fetchItemMode || 'existing',
                onChange: onText(v => patchQuest({ fetchItemMode: v })),
              }),
              NumberInput({
                label:    'Count needed',
                value:    Number(quest.fetchCount) || 1,
                min:      1, max: 99,
                onChange: v => patchQuest({ fetchCount: Math.max(1, Number(v) || 1) }),
                style:    'justify-self:start',
              }),
            ]),
            quest.fetchItemMode === 'existing'
              ? Select({
                  label:    'Item',
                  options:  project.items.length === 0
                    ? [{ value: '', label: '(no items — switch to "create new")' }]
                    : [{ value: '', label: '— pick item —' }, ...project.items.map(it => ({ value: it.id, label: `${it.name || it.id} (${it.id})` }))],
                  value:    quest.fetchItemId || '',
                  onChange: onText(v => patchQuest({ fetchItemId: v })),
                })
              : TextInput({
                  label:       'New item name',
                  value:       quest.fetchItemName || '',
                  onInput:     e => patchQuest({ fetchItemName: e.target.value }),
                  placeholder: 'Lost Cat',
                }),
          ]
        : []),
      ...(quest.goalType === 'fight'
        ? [
            Select({
              label:    'Combat to win',
              options:  (project.combats || []).length === 0
                ? [{ value: '', label: '(no combats — create one in the Combats tab first)' }]
                : [{ value: '', label: '— pick combat —' }, ...(project.combats || []).map(c => ({ value: c.id, label: `${c.name || c.id} (${c.id})` }))],
              value:    quest.fightCombatId || '',
              onChange: onText(v => patchQuest({ fightCombatId: v })),
            }),
            div({ style: 'font-size:11px; color:var(--text-muted)' })([
              'Builder will append a ', span({ style: 'font-family:ui-monospace,monospace' })([`flags.combat_${quest.fightCombatId || '<id>'}_won = true`]),
              ' op to the combat\'s onWin so the flag flips automatically.',
            ]),
          ]
        : []),
      ...(quest.goalType === 'flag'
        ? [
            Select({
              label:    'Flag source',
              options:  [
                { value: 'existing', label: 'use existing flag' },
                { value: 'new',      label: 'create new flag (e.g. tower_gate_up)' },
              ],
              value:    quest.flagMode || 'existing',
              onChange: onText(v => patchQuest({ flagMode: v })),
            }),
            Grid({ cols: 2, gap: 8 })([
              quest.flagMode === 'new'
                ? TextInput({
                    label:       'New flag name',
                    value:       quest.newFlagKey || '',
                    onInput:     e => patchQuest({ newFlagKey: e.target.value }),
                    placeholder: 'tower_gate_up',
                  })
                : Select({
                    label:    'Flag to watch',
                    options:  (project.flags || []).length === 0
                      ? [{ value: '', label: '(no flags — switch to "create new" or add some in Project → Flags)' }]
                      : [{ value: '', label: '— pick flag —' }, ...project.flags.map(f => ({ value: f.key, label: f.key }))],
                    value:    quest.flagKey || '',
                    onChange: onText(v => patchQuest({ flagKey: v })),
                  }),
              Select({
                label:    'Expected value',
                options:  [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                value:    String(!!quest.flagValue),
                onChange: onText(v => patchQuest({ flagValue: v === 'true' })),
              }),
            ]),
            div({ style: 'font-size:11px; color:var(--text-muted)' })([
              quest.flagMode === 'new'
                ? `New flag will be declared with initial false. Wire ${_flagify(quest.newFlagKey) ? `flags.${_flagify(quest.newFlagKey)} = ${quest.flagValue ? 'true' : 'false'}` : 'the flag'} from anywhere (lever switch, room onEnter, combat onWin, …) and the quest auto-completes.`
                : 'Set the flag from anywhere — combat onWin, choice action, room onEnter — and the quest is ready to turn in.',
            ]),
          ]
        : []),

      // ── pickup gate ──
      Select({
        label:    'Pickup gate',
        options:  pickupOpts,
        value:    quest.pickupMode || 'always',
        onChange: onText(v => patchQuest({ pickupMode: v })),
      }),
      ...(quest.pickupMode === 'afterFlag'
        ? [
            Select({
              label:    'Flag source',
              options:  [
                { value: 'existing', label: 'use existing flag' },
                { value: 'new',      label: 'create new flag' },
              ],
              value:    quest.pickupFlagMode || 'existing',
              onChange: onText(v => patchQuest({ pickupFlagMode: v })),
            }),
            Grid({ cols: 2, gap: 8 })([
              quest.pickupFlagMode === 'new'
                ? TextInput({
                    label:       'New flag name',
                    value:       quest.newPickupFlag || '',
                    onInput:     e => patchQuest({ newPickupFlag: e.target.value }),
                    placeholder: 'met_the_king',
                  })
                : Select({
                    label:    'Required flag',
                    options:  (project.flags || []).length === 0
                      ? [{ value: '', label: '(no flags — switch to "create new")' }]
                      : [{ value: '', label: '— pick flag —' }, ...project.flags.map(f => ({ value: f.key, label: f.key }))],
                    value:    quest.pickupFlag || '',
                    onChange: onText(v => patchQuest({ pickupFlag: v })),
                  }),
              Select({
                label:    'Required value',
                options:  [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                value:    String(!!quest.pickupFlagValue),
                onChange: onText(v => patchQuest({ pickupFlagValue: v === 'true' })),
              }),
            ]),
          ]
        : []),
      ...(quest.pickupMode === 'afterStat'
        ? [
            Grid({ cols: 3, gap: 8 })([
              Select({
                label:    'Stat',
                options:  (project.stats || []).length === 0
                  ? [{ value: '', label: '(no stats — add some in Project → Stats)' }]
                  : [{ value: '', label: '— pick stat —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
                value:    quest.pickupStat || '',
                onChange: onText(v => patchQuest({ pickupStat: v })),
              }),
              Select({
                label:    'Operator',
                options:  pickupOpOpts,
                value:    quest.pickupOp || '>=',
                onChange: onText(v => patchQuest({ pickupOp: v })),
              }),
              NumberInput({
                label:    'Value',
                value:    Number(quest.pickupStatValue) || 0,
                onChange: v => patchQuest({ pickupStatValue: Number(v) || 0 }),
                style:    'justify-self:start',
              }),
            ]),
            div({ style: 'font-size:11px; color:var(--text-muted)' })([
              quest.pickupStat
                ? `Gate: (Number(c.state.${quest.pickupStat}) || 0) ${quest.pickupOp || '>='} ${Number(quest.pickupStatValue) || 0}`
                : 'Compiled to a numeric comparison against ', span({ style: 'font-family:ui-monospace,monospace' })(['c.state[stat]']), '.',
            ]),
          ]
        : []),
      ...(quest.pickupMode === 'js'
        ? [_textarea({
            label:   'JS predicate',
            value:   quest.pickupJs,
            onInput: e => patchQuest({ pickupJs: e.target.value }),
            rows:    2,
            placeholder: 'e.g. c.state.level >= 3 && !c.state.flags?.banned',
          })]
        : []),

      // ── reward ──
      Grid({ cols: 2, gap: 8 })([
        Select({
          label:    'Reward stat',
          options:  project.stats.length
            ? project.stats.map(s => ({ value: s.key, label: s.key }))
            : [{ value: '', label: '(no stats yet)' }],
          value:    quest.rewardStat || '',
          onChange: onText(v => patchQuest({ rewardStat: v })),
        }),
        NumberInput({
          label:    'Amount',
          value:    Number(quest.rewardAmount) || 0,
          min:      0, max: 9999,
          onChange: v => patchQuest({ rewardAmount: Math.max(0, Number(v) || 0) }),
          style:    'justify-self:start',
        }),
      ]),
    ]),
  ]);
};

const _stepQuests = ({ values, setValue, project }) => Stack({ gap: 10 })([
  p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
    'One card per quest. Re-running the builder later adds even more — quests with overlapping ids dedupe (', span({ style: 'font-family:ui-monospace,monospace' })(['q_<id>_2_*']),
    '). Up to you how many at a time.',
  ]),
  ...values.quests.map((q, i) => _questCard({
    index: i,
    quest: q,
    project,
    setValue,
    values,
    onRemove: () => setValue('quests', values.quests.filter((_, k) => k !== i)),
  })),
  Button({
    size: 'sm', variant: 'ghost',
    onClick: () => setValue('quests', [...values.quests, _emptyQuestForm(project)]),
  })(['+ Add quest']),
]);

const _stepReview = ({ values, project }) => {
  const npc = values.giverMode === 'existing'
    ? project.npcs.find(n => n.id === values.existingNpcId)
    : null;
  const validQuests = values.quests.filter(_isQuestValid);
  return Card({ title: 'About to add' })([
    Stack({ gap: 4 })([
      div({})([
        values.giverMode === 'existing'
          ? `Giver: ${npc?.name || values.existingNpcId || '(missing)'} — ${npc?.advanced ? 'advanced, appending' : 'simple, will convert'}`
          : `Giver: new NPC "${values.npcName}" at room "${values.location || '— none —'}"`,
      ]),
      div({})([`Valid quests: ${validQuests.length} / ${values.quests.length}`]),
      ...validQuests.map(q => div({ style: 'padding-left:12px; font-size:12px; color:var(--text-muted)' })([
        `• ${q.title} · ${q.goalType}${q.pickupMode !== 'always' ? ` · pickup: ${q.pickupMode}` : ''} · reward +${q.rewardAmount} ${q.rewardStat || '(none)'}`,
      ])),
      ...(validQuests.length === 0 ? [div({ style: 'color:var(--danger); font-size:12px' })(['No valid quests yet — at least one quest needs a title + a configured goal.'])] : []),
      div({})(['Quest Log room + 📜 sidebar link will be created if missing, or extended.']),
    ]),
  ]);
};

// Step validators — return a string error to block Next, or null/true to allow.
// MultiStep renders the message inline (showValidation is on in ComponentBuilder).
const _validateGiver = values => {
  if (values.giverMode === 'existing') {
    if (!values.existingNpcId) return 'Pick an existing NPC, or switch to "Create a new NPC".';
    return null;
  }
  if (!values.npcName || !values.npcName.trim()) return 'Name the new NPC.';
  if (!values.location) return 'Pick a room for the NPC to stand in.';
  return null;
};

const _validateQuests = values => {
  if (!values.quests || values.quests.length === 0) return 'Add at least one quest.';
  const valids = values.quests.filter(_isQuestValid);
  if (valids.length === 0) return 'At least one quest needs a title and a configured goal (item / combat / flag).';
  // Per-quest deeper checks so the user knows which one is incomplete.
  for (let i = 0; i < values.quests.length; i++) {
    const q = values.quests[i];
    if (!q.title || !q.title.trim()) return `Quest ${i + 1}: missing title.`;
    if (q.goalType === 'fetch') {
      if (q.fetchItemMode === 'existing' && !q.fetchItemId) return `Quest ${i + 1}: pick a fetch item (or switch to "create new").`;
      if (q.fetchItemMode === 'new' && !q.fetchItemName) return `Quest ${i + 1}: name the new fetch item.`;
    } else if (q.goalType === 'fight') {
      if (!q.fightCombatId) return `Quest ${i + 1}: pick a combat to win.`;
    } else if (q.goalType === 'flag') {
      if (!_resolvedGoalFlag(q)) return `Quest ${i + 1}: ${q.flagMode === 'new' ? 'name the new flag' : 'pick a flag'}.`;
    }
    if (q.pickupMode === 'afterFlag' && !_resolvedPickupFlag(q)) {
      return `Quest ${i + 1}: pickup gate is "after flag" but no flag is chosen.`;
    }
    if (q.pickupMode === 'afterStat' && !q.pickupStat) {
      return `Quest ${i + 1}: pickup gate is "after stat" but no stat is chosen.`;
    }
    if (q.pickupMode === 'js' && !q.pickupJs.trim()) {
      return `Quest ${i + 1}: pickup gate is "js" but no expression is written.`;
    }
  }
  return null;
};

const steps = [
  { title: 'Giver',  render: _stepGiver,  validate: _validateGiver  },
  { title: 'Quests', render: _stepQuests, validate: _validateQuests },
  { title: 'Review', render: _stepReview },
];

// ── build helpers ────────────────────────────────────────────────────────────

// Stable per-NPC ids so re-running the builder finds existing topics instead
// of producing duplicates.
const _questsTopicIdFor = npcId => `topic_quests_${npcId}`;
const _menuTopicIdFor   = npcId => `topic_menu_${npcId}`;
const _talkTopicIdFor   = npcId => `topic_talk_${npcId}`;

// Idempotent: returns the existing Quest Log room if there is one, else
// creates one and threads the sidebar link at the same time.
const _ensureQuestLog = project => {
  let log = project.rooms.find(r => r.id === 'quest_log');
  let next = project;
  if (!log) {
    const backChoice = {
      ...emptyChoice(),
      label:  '← Back',
      to:     '',
      action: { ...emptyEffect(), mode: 'js', body: 'if (c.history && c.history.length) c.back();' },
    };
    log = {
      id:               'quest_log',
      kind:             'scene',
      title:            'Quest Log',
      folder:           'system',
      music:            '',
      onEnter:          emptyEffect(),
      onEnterCondition: emptyCondition(),
      pages:            [{ ...emptyPage(), text: 'Your active and completed quests.', advanceLabel: 'OK' }],
      choices:          [backChoice],
      onEnd:            emptyEffect(),
      wardrobe:         { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] },
    };
    next = { ...next, rooms: [...next.rooms, log] };
  }
  next = ensureSidebarWidget(w => w.type === 'roomLink' && w.roomId === 'quest_log')({
    id:     _rid(),
    type:   'roomLink',
    label:  'Quests',
    roomId: 'quest_log',
    icon:   '📜',
  })(next);
  return next;
};

const _appendQuestLogEntries = (qid, questTitle) => project => {
  const startedKey = `q_${qid}_started`;
  const doneKey    = `q_${qid}_done`;
  const doneRow = {
    ...emptyChoice(),
    label:     `✓ ${questTitle}`,
    to:        '',
    condition: { ...emptyCondition(), mode: 'simple', key: `flags.${doneKey}`, op: '==', value: true },
  };
  const activeRow = {
    ...emptyChoice(),
    label:     `• ${questTitle} (active)`,
    to:        '',
    condition: { ...emptyCondition(), mode: 'js', expr: `c.state.flags?.${startedKey} && !c.state.flags?.${doneKey}` },
  };
  return {
    ...project,
    rooms: project.rooms.map(r => r.id === 'quest_log'
      ? { ...r, choices: [...(r.choices || []), activeRow, doneRow] }
      : r),
  };
};

// Inject a flag-set op into a combat's onWin so winning the combat flips
// the flag — used by fight-goal quests so the existing flag-watcher topic
// machinery can do its job.
const _injectCombatWinFlag = (combatId, flagKey) => project => {
  const combat = (project.combats || []).find(c => c.id === combatId);
  if (!combat) return project;
  const existingOps = combat.onWin?.mode === 'simple' ? (combat.onWin.ops || []) : [];
  // If the flag op already exists, skip to keep this idempotent across re-runs.
  const already = existingOps.some(o => o.target === `flags.${flagKey}` && o.op === 'set' && o.value === true);
  if (already && combat.onWin?.mode === 'simple') return project;
  // Convert non-simple onWin into a multi that preserves the original.
  const flagOp = {
    target: `flags.${flagKey}`,
    op:     'set',
    value:  true,
    condition: emptyCondition(),
    min: { enabled: false, statKey: '', mul: 0, const: 0 },
    max: { enabled: false, statKey: '', mul: 0, const: 0 },
  };
  let nextOnWin;
  if (!combat.onWin || combat.onWin.mode === 'none') {
    nextOnWin = { ...emptyEffect(), mode: 'simple', ops: [flagOp] };
  } else if (combat.onWin.mode === 'simple') {
    nextOnWin = { ...combat.onWin, ops: [...existingOps, flagOp] };
  } else {
    // Wrap whatever was there in a multi, then append a simple flag-set step.
    nextOnWin = {
      ...emptyEffect(),
      mode: 'multi',
      steps: [combat.onWin, { ...emptyEffect(), mode: 'simple', ops: [flagOp] }],
    };
  }
  return {
    ...project,
    combats: project.combats.map(c => c.id === combatId ? { ...c, onWin: nextOnWin } : c),
  };
};

// ── per-quest topic builders ─────────────────────────────────────────────────

const _completionExpr = (quest, flagOfCombat) => {
  if (quest.goalType === 'fetch') {
    const itemId = quest.fetchItemMode === 'new'
      ? quest._resolvedNewItemId    // patched in by the build loop
      : quest.fetchItemId;
    return itemId
      ? `(c.state.inventory?.[${JSON.stringify(itemId)}] || 0) >= ${Number(quest.fetchCount) || 1}`
      : 'true';
  }
  if (quest.goalType === 'fight') {
    return flagOfCombat ? `!!c.state.flags?.${flagOfCombat}` : 'true';
  }
  if (quest.goalType === 'flag') {
    const k = _resolvedGoalFlag(quest);
    if (!k) return 'true';
    return quest.flagValue
      ? `!!c.state.flags?.${k}`
      : `!c.state.flags?.${k}`;
  }
  return 'true';
};

const _pickupExpr = (quest, startedKey) => {
  const notStarted = `!c.state.flags?.${startedKey}`;
  if (quest.pickupMode === 'afterFlag') {
    const k = _resolvedPickupFlag(quest);
    if (!k) return notStarted;
    const gate = quest.pickupFlagValue
      ? `!!c.state.flags?.${k}`
      : `!c.state.flags?.${k}`;
    return `${notStarted} && (${gate})`;
  }
  if (quest.pickupMode === 'afterStat') {
    const stat = quest.pickupStat;
    if (!stat) return notStarted;
    const op  = ['>=','>','==','!=','<=','<'].includes(quest.pickupOp) ? quest.pickupOp : '>=';
    const val = Number(quest.pickupStatValue) || 0;
    return `${notStarted} && ((Number(c.state.${stat}) || 0) ${op} ${val})`;
  }
  if (quest.pickupMode === 'js' && quest.pickupJs.trim()) {
    return `${notStarted} && (${quest.pickupJs.trim()})`;
  }
  return notStarted;
};

const _makeOpSimple = (target, op, value) => ({
  target, op, value,
  condition: emptyCondition(),
  min: { enabled: false, statKey: '', mul: 0, const: 0 },
  max: { enabled: false, statKey: '', mul: 0, const: 0 },
});

// Three menu choices for one quest. They all live on the SAME shared Quests
// topic, so multiple quests stack into one menu without colliding.
const _menuChoicesForQuest = (quest, qid, subTopicIds, completionExpr) => {
  const startedKey = `q_${qid}_started`;
  const doneKey    = `q_${qid}_done`;
  const pickupExpr = _pickupExpr(quest, startedKey);
  return [
    {
      ...emptyChoice(),
      label:     `Tell me about ${quest.title}.`,
      flow:      'change',
      topicId:   subTopicIds.offer,
      condition: { ...emptyCondition(), mode: 'js', expr: pickupExpr },
    },
    {
      ...emptyChoice(),
      label:     `How is "${quest.title}" going?`,
      flow:      'change',
      topicId:   subTopicIds.progress,
      condition: { ...emptyCondition(), mode: 'js', expr: `c.state.flags?.${startedKey} && !c.state.flags?.${doneKey}` },
    },
    {
      ...emptyChoice(),
      label:     `I've finished "${quest.title}"!`,
      flow:      'change',
      topicId:   subTopicIds.turnin,
      condition: { ...emptyCondition(), mode: 'js', expr: `c.state.flags?.${startedKey} && !c.state.flags?.${doneKey} && (${completionExpr})` },
    },
  ];
};

// All three sub-topics return to the calling topic via `flow: 'exitBack'`
// (not `flow: 'change'` back to Menu). `change` would PUSH the calling
// topic onto the stack again — so after a Menu → turn-in → Menu round trip
// the stack would be [Menu, turnin], and Goodbye's exitBack on the entry
// Menu would pop straight back into turnin instead of leaving. `exitBack`
// POPS the stack, so the player ends up exactly where they came from and
// the entry topic's Goodbye stays on the empty-stack short-circuit that
// leaves the NPC cleanly.
const _offerTopic = (quest, qid, subTopicIds) => ({
  ...emptyTopic(),
  id:    subTopicIds.offer,
  name:  `Offer: ${quest.title}`,
  pages: [{ ...emptyPage(), text: quest.offerText || 'Help me with this task.', advanceLabel: 'More' }],
  choices: [
    {
      ...emptyChoice(),
      label:  'I\'ll do it.',
      flow:   'exitBack',
      action: { ...emptyEffect(), mode: 'simple', ops: [_makeOpSimple(`flags.q_${qid}_started`, 'set', true)] },
    },
    { ...emptyChoice(), label: 'Maybe later.', flow: 'exitBack' },
  ],
});

const _progressTopic = (quest, subTopicIds) => ({
  ...emptyTopic(),
  id:    subTopicIds.progress,
  name:  `Progress: ${quest.title}`,
  pages: [{ ...emptyPage(), text: quest.progressHint || 'Keep at it.', advanceLabel: 'OK' }],
  choices: [{ ...emptyChoice(), label: 'I\'ll get back to it.', flow: 'exitBack' }],
});

const _turninTopic = (quest, qid, subTopicIds) => {
  const doneKey = `q_${qid}_done`;
  // Reward + flag flip in one simple-mode effect. Per-op sequential state lets
  // the consume + reward + flag-set all see each other safely.
  const ops = [];
  // Consume the fetch item(s) on turn-in.
  if (quest.goalType === 'fetch') {
    const itemId = quest.fetchItemMode === 'new' ? quest._resolvedNewItemId : quest.fetchItemId;
    const count  = Number(quest.fetchCount) || 0;
    if (itemId && count > 0) ops.push(_makeOpSimple(`inv.${itemId}`, 'take', count));
  }
  // Pay the reward.
  if (quest.rewardStat && Number(quest.rewardAmount) > 0) {
    ops.push(_makeOpSimple(quest.rewardStat, 'add', Number(quest.rewardAmount)));
  }
  // Flip done last.
  ops.push(_makeOpSimple(`flags.${doneKey}`, 'set', true));
  return {
    ...emptyTopic(),
    id:    subTopicIds.turnin,
    name:  `Turn-in: ${quest.title}`,
    onEnter: { ...emptyEffect(), mode: 'simple', ops },
    pages: [{ ...emptyPage(), text: quest.turninText || 'Thank you.', advanceLabel: 'OK' }],
    choices: [{ ...emptyChoice(), label: 'Anything else?', flow: 'exitBack' }],
  };
};

// ── NPC wiring ───────────────────────────────────────────────────────────────

// Add a Quests sub-topic to the NPC if not present. Returns { project, npc,
// questsTopicId } — caller is expected to keep using `npc` and update project
// at the end (avoids interleaving setProject calls).
const _attachQuestsTopic = npc => project => {
  const questsTopicId = _questsTopicIdFor(npc.id);
  const topics = npc.topics || [];
  if (topics.find(t => t.id === questsTopicId)) {
    return { project, npc, questsTopicId };
  }
  const questsTopic = {
    ...emptyTopic(),
    id:    questsTopicId,
    name:  'Quests',
    pages: [{ ...emptyPage(), text: 'What would you like to discuss?', advanceLabel: 'More' }],
    choices: [{ ...emptyChoice(), label: 'Goodbye.', flow: 'exitBack' }],
  };
  const nextNpc = { ...npc, topics: [...topics, questsTopic] };
  return { project, npc: nextNpc, questsTopicId };
};

// Idempotently inject a "Talk about your work" change-choice into the NPC's
// existing entry topic so the player can reach the Quests sub-topic.
const _injectQuestsHubChoice = (npc, questsTopicId) => {
  const entryId = npc.entryTopicId || npc.topics?.[0]?.id;
  if (!entryId || entryId === questsTopicId) return npc;
  const idx = (npc.topics || []).findIndex(t => t.id === entryId);
  if (idx < 0) return npc;
  const entry = npc.topics[idx];
  if ((entry.choices || []).some(c => c.flow === 'change' && c.topicId === questsTopicId)) return npc;
  const hub = {
    ...emptyChoice(),
    label:   'Talk about your work.',
    flow:    'change',
    topicId: questsTopicId,
  };
  const nextEntry = { ...entry, choices: [...(entry.choices || []), hub] };
  return { ...npc, topics: npc.topics.map((t, k) => k === idx ? nextEntry : t) };
};

// Convert a simple-mode NPC to advanced by:
//   - moving their flat choices into a "Talk" topic (converted to topic-style
//     flow:exitBack / exitRoom so navigation semantics are preserved)
//   - creating a Menu topic with Talk / Quests / Goodbye, set as entry
const _convertSimpleNpcToAdvanced = npc => {
  const talkTopicId = _talkTopicIdFor(npc.id);
  const menuTopicId = _menuTopicIdFor(npc.id);
  // Convert original choices.
  const talkChoices = (npc.choices || []).map(ch => {
    const out = { ...ch };
    out.flow    = ch.to ? 'exitRoom' : 'exitBack';
    // `to` keeps its value for exitRoom; cleared for exitBack to be tidy.
    if (out.flow === 'exitBack') out.to = '';
    return out;
  });
  // Always include Goodbye so the Talk topic has at least one exit.
  if (!talkChoices.some(c => c.flow === 'exitBack')) {
    talkChoices.push({ ...emptyChoice(), label: 'Goodbye.', flow: 'exitBack' });
  }
  const talkTopic = {
    ...emptyTopic(),
    id:      talkTopicId,
    name:    'Talk',
    pages:   [{ ...emptyPage(), text: 'What is it?', advanceLabel: 'More' }],
    choices: talkChoices,
  };
  const menuTopic = {
    ...emptyTopic(),
    id:    menuTopicId,
    name:  'Menu',
    pages: [{ ...emptyPage(), text: 'What can I do for you?', advanceLabel: 'More' }],
    choices: [
      { ...emptyChoice(), label: 'Talk a moment.',         flow: 'change', topicId: talkTopicId },
      // Quests change-choice gets added by _injectQuestsHubChoice afterwards.
      { ...emptyChoice(), label: 'Goodbye.',               flow: 'exitBack' },
    ],
  };
  return {
    ...npc,
    advanced:      true,
    choices:       [],
    topics:        [menuTopic, talkTopic],
    entryTopicId:  menuTopicId,
  };
};

// ── top-level build ──────────────────────────────────────────────────────────

const build = (project, values) => {
  let next = project;

  // ── 1. Resolve / create the giver NPC ──
  let npc;
  if (values.giverMode === 'existing') {
    npc = next.npcs.find(n => n.id === values.existingNpcId);
    if (!npc) {
      return { project, summary: 'No NPC selected — nothing added.' };
    }
    if (!npc.advanced) {
      npc = _convertSimpleNpcToAdvanced(npc);
    }
  } else {
    const npcId = uniqueId(`npc_${slug(values.npcName) || 'giver'}`, idsOf('npcs')(next));
    npc = {
      ...emptyNpc(npcId),
      name:         values.npcName || 'Quest Giver',
      locations:    values.location ? [values.location] : [],
      folder:       'quests',
      greeting:     'Greetings, traveller.',
      role:         'dialogue',
      advanced:     true,
      pages:        [{ ...emptyPage(), text: '', advanceLabel: 'More' }],
      topics:       [],
      entryTopicId: '',
    };
  }

  // ── 2. Ensure a Quests sub-topic exists on the NPC ──
  const attached = _attachQuestsTopic(npc)(next);
  npc           = attached.npc;
  next          = attached.project;
  const questsTopicId = attached.questsTopicId;
  // New NPC: Quests topic is the entry. Existing NPC: keep their entry but
  // route to Quests via a hub choice.
  if (!npc.entryTopicId) npc.entryTopicId = questsTopicId;
  else npc = _injectQuestsHubChoice(npc, questsTopicId);

  // ── 3. Per-quest pass ──
  const summaryQuests = [];
  for (const rawQuest of values.quests) {
    if (!_isQuestValid(rawQuest)) continue;
    const quest = { ...rawQuest };

    // Quest id with collision suffix.
    const rawId = _effectiveQuestId(quest);
    const taken = flagKeys(next);
    let qid = rawId;
    let i = 2;
    while (taken.has(`q_${qid}_started`) || taken.has(`q_${qid}_done`)) {
      qid = `${rawId}_${i++}`;
    }

    // Fetch goal: resolve/create item if needed and record on the quest copy.
    if (quest.goalType === 'fetch' && quest.fetchItemMode === 'new') {
      const newItemId = uniqueId(`item_${slug(quest.fetchItemName) || 'questitem'}`, idsOf('items')(next));
      const newItem = {
        id:          newItemId,
        name:        quest.fetchItemName || 'Quest Item',
        description: 'A quest item.',
        image:       '',
        price:       emptyPrice('gold', 0),
        kind:        'key',
        folder:      'quests',
        useEffect:   emptyEffect(),
        text:        '',
        equipSlot:   '',
      };
      next = { ...next, items: [...next.items, newItem] };
      quest._resolvedNewItemId = newItemId;
    }

    // Fight goal: inject onWin flag-set on the chosen combat and remember
    // its flag for the completion expression.
    let combatWinFlag = '';
    if (quest.goalType === 'fight' && quest.fightCombatId) {
      combatWinFlag = `combat_${quest.fightCombatId}_won`;
      next = ensureFlag(combatWinFlag)(false)(next);
      next = _injectCombatWinFlag(quest.fightCombatId, combatWinFlag)(next);
    }

    // Flag goal: when the user typed a NEW flag name, declare it now so
    // state.flags[key] starts at false and the editor's Flags list shows it.
    if (quest.goalType === 'flag' && quest.flagMode === 'new') {
      const k = _resolvedGoalFlag(quest);
      if (k) next = ensureFlag(k)(false)(next);
    }
    // Same for the afterFlag pickup gate.
    if (quest.pickupMode === 'afterFlag' && quest.pickupFlagMode === 'new') {
      const k = _resolvedPickupFlag(quest);
      if (k) next = ensureFlag(k)(false)(next);
    }

    // Always-declared quest flags.
    next = ensureFlag(`q_${qid}_started`)(false)(next);
    next = ensureFlag(`q_${qid}_done`)(false)(next);

    // Build the three sub-topics for this quest.
    const subTopicIds = {
      offer:    `topic_${_rid()}`,
      progress: `topic_${_rid()}`,
      turnin:   `topic_${_rid()}`,
    };
    const completionExpr = _completionExpr(quest, combatWinFlag);
    const offerT    = _offerTopic(quest, qid, subTopicIds);
    const progressT = _progressTopic(quest, subTopicIds);
    const turninT   = _turninTopic(quest, qid, subTopicIds);

    // Append the three menu choices to the shared Quests topic on the NPC.
    const menuChoices = _menuChoicesForQuest(quest, qid, subTopicIds, completionExpr);
    npc = {
      ...npc,
      topics: npc.topics.map(t => t.id === questsTopicId
        ? {
            ...t,
            // Insert quest menu choices BEFORE the trailing Goodbye choice so
            // Goodbye stays at the bottom.
            choices: [
              ...(t.choices || []).filter(c => c.flow !== 'exitBack'),
              ...menuChoices,
              ...(t.choices || []).filter(c => c.flow === 'exitBack'),
            ],
          }
        : t),
    };

    // Append the three sub-topics to the NPC.
    npc = { ...npc, topics: [...npc.topics, offerT, progressT, turninT] };

    // Quest Log entries.
    next = _ensureQuestLog(next);
    next = _appendQuestLogEntries(qid, quest.title)(next);

    summaryQuests.push({ title: quest.title, qid, goal: quest.goalType });
  }

  // ── 4. Commit the NPC change back into the project ──
  if (values.giverMode === 'existing') {
    next = { ...next, npcs: next.npcs.map(n => n.id === npc.id ? npc : n) };
  } else {
    next = { ...next, npcs: [...next.npcs, npc] };
  }

  if (summaryQuests.length === 0) {
    return { project, summary: 'No valid quests in the form — nothing added.' };
  }
  const giverDesc = values.giverMode === 'existing' ? `existing NPC ${npc.name}` : `new NPC ${npc.name}`;
  return {
    project: next,
    summary: `Added ${summaryQuests.length} quest${summaryQuests.length === 1 ? '' : 's'} to ${giverDesc} (${summaryQuests.map(q => q.title).join(', ')}).`,
  };
};

export const questGiver = {
  id:          'questGiver',
  icon:        '📜',
  name:        'Quest Giver',
  description: 'One or more quests on a new or existing NPC. Goals: fetch / fight / flag. Pickup gate (always, after-flag, JS). Auto Quest Log room + 📜 sidebar link.',
  defaults,
  steps,
  build,
};
