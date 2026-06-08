/**
 * ChoiceGenerator — modal that maps over a list and produces N choices.
 *
 * Pick a source (items / npcs / rooms / flags / skills / combats / custom list),
 * an optional filter, a label template with placeholders, a flow, and an Effect
 * template. The generator substitutes `{name}` / `{id}` / `{value}` per element
 * and appends the resulting Choices to the calling topic's choice list.
 *
 * Two parts:
 *   - `generateChoices` — PURE function: form → project → bindings → Choice[]
 *   - `ChoiceGenerator` — modal component, reads its form state from
 *      state.generator (kept in the store so it survives re-renders).
 *
 * Curried throughout; no multi-arg helpers.
 */

import { div, span, p, label as lbl } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Modal } from '../../src/components/Modal.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { setState, setProject, getState } from '../store.js';
import { emptyChoice, emptyEffect, emptyTopic, emptyPage, emptyCondition } from '../schema.js';
import { onText } from '../helpers.js';
import { AssetInput } from './AssetInput.js';

// ─── Sources ────────────────────────────────────────────────────────────

// Each source produces a list of { name, id, value } bindings from the project.
// `value` falls back to `name` so custom-list `{value}` templates also work for
// entity sources.
const _bindingsFromItems = project => filter => (project.items || [])
  .filter(it => !filter || filter === '*' || it.kind === filter)
  .map(it => ({ name: it.name || it.id, id: it.id, value: it.name || it.id }));

const _bindingsFromNpcs = project => filter => (project.npcs || [])
  .filter(n => !filter || filter === '*' || n.role === filter)
  .map(n => ({ name: n.name || n.id, id: n.id, value: n.name || n.id }));

const _bindingsFromRooms = project => filter => (project.rooms || [])
  .filter(r => !filter || filter === '*' || r.kind === filter)
  .map(r => ({ name: r.title || r.id, id: r.id, value: r.title || r.id }));

const _bindingsFromFlags = project => () => (project.flags || [])
  .map(f => ({ name: f.key, id: f.key, value: f.key }));

const _bindingsFromSkills = project => () => (project.skills || [])
  .map(s => ({ name: s.name || s.id, id: s.id, value: s.name || s.id }));

const _bindingsFromCombats = project => () => (project.combats || [])
  .map(c => ({ name: c.name || c.id, id: c.id, value: c.name || c.id }));

// Custom list — parsed from a comma-separated string. Each `v` becomes a
// binding where {name}, {id}, and {value} all bind to v.
const _bindingsFromCustom = raw => () => String(raw || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(v => ({ name: v, id: v, value: v }));

// Dispatch on source. Curried `form => project => bindings`.
const _rawBindings = form => project => {
  switch (form.source) {
    case 'items':   return _bindingsFromItems(project)(form.filter);
    case 'npcs':    return _bindingsFromNpcs(project)(form.filter);
    case 'rooms':   return _bindingsFromRooms(project)(form.filter);
    case 'flags':   return _bindingsFromFlags(project)();
    case 'skills':  return _bindingsFromSkills(project)();
    case 'combats': return _bindingsFromCombats(project)();
    case 'custom':  return _bindingsFromCustom(form.customList)();
    default:        return [];
  }
};

// Advanced filters applied on top of the raw list.
//   nameContains : substring match against name OR id (case-insensitive). '' = no filter.
//   excludeIds   : comma-separated id blacklist. Use to skip "self" or already-handled entries.
//   ignoreSelf   : when source is 'npcs', auto-add form.npcId to the exclude set so the
//                  speaking NPC never appears in their own "Talk about X" list.
//   limit        : cap N. '' / 0 = no cap.
const _applyAdvancedFilters = form => list => {
  const needle  = String(form.nameContains || '').trim().toLowerCase();
  const exclude = new Set(String(form.excludeIds || '').split(',').map(s => s.trim()).filter(Boolean));
  if (form.ignoreSelf && form.source === 'npcs' && form.npcId) exclude.add(form.npcId);
  const limit   = Math.max(0, Number(form.limit) || 0);
  const matches = b => {
    if (exclude.has(b.id)) return false;
    if (!needle) return true;
    return (b.name || '').toLowerCase().includes(needle)
        || (b.id   || '').toLowerCase().includes(needle);
  };
  const filtered = list.filter(matches);
  return limit > 0 ? filtered.slice(0, limit) : filtered;
};

// Public: bindings after advanced filtering.
const _bindings = form => project => _applyAdvancedFilters(form)(_rawBindings(form)(project));

// Per-source filter options for the Filter select. [] = no filter shown.
const _filterOptions = source => {
  switch (source) {
    case 'items':  return [
      { value: '*',          label: 'Any kind' },
      { value: 'consumable', label: 'consumable' },
      { value: 'equipment',  label: 'equipment' },
      { value: 'readable',   label: 'readable' },
      { value: 'key',        label: 'key' },
      { value: 'misc',       label: 'misc' },
    ];
    case 'npcs':   return [
      { value: '*',        label: 'Any role' },
      { value: 'dialogue', label: 'dialogue' },
      { value: 'shop',     label: 'shop' },
    ];
    case 'rooms':  return [
      { value: '*',         label: 'Any kind' },
      { value: 'scene',     label: 'scene' },
      { value: 'wardrobe',  label: 'wardrobe' },
      { value: 'inventory', label: 'inventory' },
    ];
    default: return [];
  }
};

// ─── Template substitution ──────────────────────────────────────────────

// Replace {name} / {id} / {value} in a template string. Curried so a template
// becomes a reusable per-binding function.
const _subst = tmpl => binding => String(tmpl || '')
  .replaceAll('{name}',  binding.name  || '')
  .replaceAll('{id}',    binding.id    || '')
  .replaceAll('{value}', binding.value || binding.name || '');

// Substitute then coerce to a number when the result parses cleanly. Used for
// Effect-op value templates where "1" should become 1 but "{name}" stays a string.
const _substNum = tmpl => binding => {
  const out = _subst(tmpl)(binding);
  const n = Number(out);
  return Number.isFinite(n) && out.trim() !== '' ? n : out;
};

// ─── Choice builder ────────────────────────────────────────────────────

// Build the action Effect for one binding based on the form's effect mode.
const _buildEffect = form => binding => {
  if (form.effectMode === 'simple' && form.opTarget) {
    return {
      ...emptyEffect(),
      mode: 'simple',
      ops: [{
        target: _subst(form.opTarget)(binding),
        op:     form.opKind || 'give',
        value:  _substNum(form.opValue)(binding),
      }],
    };
  }
  if (form.effectMode === 'js' && form.jsBody) {
    return { ...emptyEffect(), mode: 'js', body: _subst(form.jsBody)(binding) };
  }
  return emptyEffect();
};

// Build the runtime Condition for one binding. When the user provided a JS
// condition template, substitute placeholders and stamp a js-mode Condition;
// otherwise the choice is unconditional.
const _buildCondition = form => binding => {
  const tmpl = String(form.conditionJs || '').trim();
  if (!tmpl) return emptyCondition();
  return { ...emptyCondition(), mode: 'js', expr: _subst(tmpl)(binding) };
};

// Build one Choice per binding. Pure: form + binding → Choice.
const _buildChoice = form => binding => {
  const base = emptyChoice();
  return {
    ...base,
    label:     _subst(form.labelTemplate || '{name}')(binding),
    flow:      form.flow || 'stay',
    to:        (form.flow === 'navigate' || form.flow === 'exitRoom') ? _subst(form.targetTemplate || '')(binding) : '',
    topicId:   form.flow === 'change'     ? _subst(form.targetTemplate || '')(binding) : '',
    combatId:  form.flow === 'exitCombat' ? _subst(form.targetTemplate || '')(binding) : '',
    action:    _buildEffect(form)(binding),
    condition: _buildCondition(form)(binding),
  };
};

// Per-page builder for the reply topic. Text is templated; image is the
// statically picked asset ref/URL from the AssetInput — used as-is so the
// catalogue preview the user saw maps to what the player gets.
const _buildReplyPage = binding => pg => ({
  ...emptyPage(),
  text:         _subst(pg.text  || '')(binding),
  image:        pg.image || '',
  advanceLabel: pg.advanceLabel || 'More',
});

// Dialogue mode — one binding → { topic, choice }. The new topic holds the
// reply pages and an auto Back button; the choice points to the new topic via
// flow:'change'. Drop both into the NPC at apply time.
const _buildDialoguePair = form => binding => {
  const pages = (Array.isArray(form.pages) && form.pages.length
    ? form.pages
    : [{ text: 'Yeah, {name} is nice.', image: '' }]
  ).map(_buildReplyPage(binding));

  const replyTopic = {
    ...emptyTopic(),
    name:    _subst(form.topicNameTemplate || 'About {name}')(binding),
    pages,
    choices: [{
      ...emptyChoice(),
      label: form.backLabel || 'Back',
      flow:  'exitBack',
    }],
  };
  const linkChoice = {
    ...emptyChoice(),
    label:     _subst(form.labelTemplate || 'Talk about {name}')(binding),
    flow:      'change',
    topicId:   replyTopic.id,
    condition: _buildCondition(form)(binding),
  };
  return { topic: replyTopic, choice: linkChoice };
};

// Public generators.
//   mode 'choices'  → Choice[] appended to the source topic
//   mode 'dialogues'→ { topics: Topic[], choices: Choice[] } pairs
const generateChoices = form => project => _bindings(form)(project).map(_buildChoice(form));

const generateDialogues = form => project => {
  const pairs = _bindings(form)(project).map(_buildDialoguePair(form));
  return {
    topics:  pairs.map(p => p.topic),
    choices: pairs.map(p => p.choice),
  };
};

// ─── Form defaults per source ──────────────────────────────────────────

// When the user picks a new source we pre-fill the rest of the form with a
// reasonable starting point so the modal does something useful out of the box.
// Source-default reply text is also seeded for dialogues mode so switching
// modes doesn't leave nonsensical "Yeah, {name} is nice." copy for, say, rooms.
// `pageOf` packages a default first-page text into the new pages[] shape.
const _pageOf = text => [{ text, image: '', advanceLabel: 'More' }];

const _defaultsForSource = source => {
  switch (source) {
    case 'items':   return { filter: 'consumable', labelTemplate: 'Take {name}',    flow: 'stay',       targetTemplate: '',     effectMode: 'simple', opTarget: 'inv.{id}',    opKind: 'give',   opValue: '1', topicNameTemplate: 'About {name}', pages: _pageOf('{name} — a fine choice.') };
    case 'npcs':    return { filter: '*',          labelTemplate: 'Talk to {name}', flow: 'stay',       targetTemplate: '',     effectMode: 'js',     jsBody:   'c.talkTo("{id}", c.scene);', topicNameTemplate: 'About {name}', pages: _pageOf('Yeah, {name} is nice.') };
    case 'rooms':   return { filter: '*',          labelTemplate: 'Go to {name}',   flow: 'exitRoom',   targetTemplate: '{id}', effectMode: 'none',                          topicNameTemplate: 'About {name}', pages: _pageOf('{name} is just down the road.') };
    case 'flags':   return { filter: '',           labelTemplate: 'Toggle {id}',    flow: 'stay',       targetTemplate: '',     effectMode: 'simple', opTarget: 'flags.{id}',  opKind: 'toggle', opValue: '',  topicNameTemplate: 'About {id}',   pages: _pageOf('') };
    case 'skills':  return { filter: '',           labelTemplate: 'Learn {name}',   flow: 'stay',       targetTemplate: '',     effectMode: 'simple', opTarget: 'skills.{id}', opKind: 'learn',  opValue: '',  topicNameTemplate: 'About {name}', pages: _pageOf('') };
    case 'combats': return { filter: '',           labelTemplate: 'Fight {name}',   flow: 'exitCombat', targetTemplate: '{id}', effectMode: 'none',                          topicNameTemplate: 'About {name}', pages: _pageOf('') };
    case 'custom':  return { filter: '',           labelTemplate: '{value}',        flow: 'stay',       targetTemplate: '',     effectMode: 'none', customList: '1, 2, 3, 4', topicNameTemplate: 'About {value}', pages: _pageOf('') };
    default:        return {};
  }
};

const emptyGeneratorForm = () => ({
  mode:           'choices',   // 'choices' | 'dialogues'
  source:         'items',
  filter:         'consumable',
  customList:     '',
  labelTemplate:  'Take {name}',
  flow:           'stay',
  targetTemplate: '',
  effectMode:     'simple',
  opTarget:       'inv.{id}',
  opKind:         'give',
  opValue:        '1',
  jsBody:         '',
  // Dialogue-mode fields — pages: [{ text, image, advanceLabel? }]
  topicNameTemplate: 'About {name}',
  pages:             [{ text: 'Yeah, {name} is nice.', image: '', advanceLabel: 'More' }],
  backLabel:         'Back',
  // Advanced filters
  nameContains:      '',
  excludeIds:        '',
  limit:             '',
  conditionJs:       '',
  ignoreSelf:        true,        // npcs source only — auto-omit the speaking NPC
});

// ─── Editor wiring ─────────────────────────────────────────────────────

const _setGen = patch => setState(s => ({
  generator: { ...(s.generator || {}), ...patch },
}));

// Open the modal targeting a specific topic on a specific NPC. The user's edits
// land in state.generator; Apply writes the generated Choices back into that
// topic.
const openChoiceGenerator = npcId => topicId => () => setState({
  generator: {
    open:    true,
    npcId,
    topicId,
    ...emptyGeneratorForm(),
  },
});

const closeChoiceGenerator = () => setState(s => ({ generator: { ...(s.generator || {}), open: false } }));

// Append generated content to the target topic, then close. Choices mode adds
// choices in-place; Dialogues mode also adds the reply topics to npc.topics.
const _applyChoicesMode = form => project => {
  const choices = generateChoices(form)(project);
  if (choices.length === 0) return false;
  setProject(p => ({
    ...p,
    npcs: p.npcs.map(n => n.id !== form.npcId ? n : ({
      ...n,
      topics: (n.topics || []).map(t => t.id !== form.topicId ? t : ({
        ...t,
        choices: [...t.choices, ...choices],
      })),
    })),
  }));
  return true;
};

const _applyDialoguesMode = form => project => {
  const { topics, choices } = generateDialogues(form)(project);
  if (choices.length === 0) return false;
  setProject(p => ({
    ...p,
    npcs: p.npcs.map(n => {
      if (n.id !== form.npcId) return n;
      return {
        ...n,
        topics: [
          ...(n.topics || []).map(t => t.id !== form.topicId
            ? t
            : ({ ...t, choices: [...t.choices, ...choices] })),
          ...topics,
        ],
      };
    }),
  }));
  return true;
};

const _apply = (form, project) => {
  const done = form.mode === 'dialogues'
    ? _applyDialoguesMode(form)(project)
    : _applyChoicesMode(form)(project);
  closeChoiceGenerator();
  return done;
};

// ─── Modal UI ──────────────────────────────────────────────────────────

const MODE_OPTS = [
  { value: 'choices',   label: 'Generate choices (N flat choices on this topic)' },
  { value: 'dialogues', label: 'Generate dialogues (one reply topic + change-choice per item)' },
];

const SOURCE_OPTS = [
  { value: 'items',   label: 'Items'           },
  { value: 'npcs',    label: 'NPCs'            },
  { value: 'rooms',   label: 'Rooms'           },
  { value: 'flags',   label: 'Flags'           },
  { value: 'skills',  label: 'Skills'          },
  { value: 'combats', label: 'Combats'         },
  { value: 'custom',  label: 'Custom list …'  },
];

const FLOW_OPTS = [
  { value: 'stay',       label: 'stay (effect only)' },
  { value: 'change',     label: 'change topic'       },
  { value: 'exitBack',   label: 'exit back'          },
  { value: 'exitRoom',   label: 'exit to room'       },
  { value: 'exitCombat', label: 'exit to combat'     },
];

const OP_KIND_OPTS = [
  { value: 'set',    label: 'set' },
  { value: 'add',    label: 'add' },
  { value: 'sub',    label: 'sub' },
  { value: 'toggle', label: 'toggle (flag)' },
  { value: 'give',   label: 'give (inv)' },
  { value: 'take',   label: 'take (inv)' },
  { value: 'learn',  label: 'learn (skill)' },
  { value: 'forget', label: 'forget (skill)' },
];

const EFFECT_MODE_OPTS = [
  { value: 'none',   label: 'none — no effect, just nav' },
  { value: 'simple', label: 'simple op (target/op/value)' },
  { value: 'js',     label: 'JS body'                     },
];

const _placeholdersHint = source => source === 'custom'
  ? 'Placeholders: {value} (or {name} / {id} — all bound to the same string).'
  : 'Placeholders: {name}, {id}.';

// Preview is computed per mode: choices mode → just labels; dialogues mode →
// labels of the link-choices plus a hint of each reply page's text.
const _previewChoicesMode = form => project => {
  const list = generateChoices(form)(project);
  if (list.length === 0) return [p({ style: 'margin:0; color:var(--text-muted)' })(['Nothing to generate. Adjust source/filter.'])];
  const first = list.slice(0, 5);
  const rest  = list.length - first.length;
  return [
    p({ style: 'margin:0; font-size:12.5px' })([`Will generate ${list.length} choice${list.length === 1 ? '' : 's'}.`]),
    ...first.map(c => div({ style: 'font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-muted); padding:2px 0' })([`• ${c.label}`])),
    ...(rest > 0 ? [div({ style: 'font-size:11px; color:var(--text-muted)' })([`(+${rest} more)`])] : []),
  ];
};

const _previewDialoguesMode = form => project => {
  const { topics, choices } = generateDialogues(form)(project);
  if (choices.length === 0) return [p({ style: 'margin:0; color:var(--text-muted)' })(['Nothing to generate. Adjust source/filter.'])];
  const firstC = choices.slice(0, 3);
  const firstT = topics.slice(0, 3);
  const rest   = choices.length - firstC.length;
  return [
    p({ style: 'margin:0; font-size:12.5px' })([
      `Will generate ${choices.length} choice${choices.length === 1 ? '' : 's'} + ${topics.length} reply topic${topics.length === 1 ? '' : 's'}.`,
    ]),
    ...firstC.map((c, i) => div({ style: 'font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-muted); padding:2px 0' })([
      `• "${c.label}" → topic "${firstT[i]?.name || ''}": “${(firstT[i]?.pages?.[0]?.text || '').slice(0, 60)}”`,
    ])),
    ...(rest > 0 ? [div({ style: 'font-size:11px; color:var(--text-muted)' })([`(+${rest} more)`])] : []),
  ];
};

const _preview = form => project => form.mode === 'dialogues'
  ? _previewDialoguesMode(form)(project)
  : _previewChoicesMode(form)(project);

// Form field rendering — broken into per-section helpers so the JSX is flat.
const _sourceFields = form => {
  const opts = _filterOptions(form.source);
  return Stack({ gap: 8 })([
    Grid({ cols: 2, gap: 10 })([
      Select({
        label:    'Source',
        options:  SOURCE_OPTS,
        value:    form.source,
        onChange: onText(v => _setGen({ source: v, ..._defaultsForSource(v) })),
      }),
      ...(opts.length > 0
        ? [Select({
            label:    'Filter',
            options:  opts,
            value:    form.filter || '*',
            onChange: onText(v => _setGen({ filter: v })),
          })]
        : [div({})([])]),
    ]),
    ...(form.source === 'custom'
      ? [TextInput({
          label:       'Custom list (comma-separated)',
          value:       form.customList || '',
          onChange:    onText(v => _setGen({ customList: v })),
          placeholder: '1, 2, 3, 4',
        })]
      : []),
    // Ignore-self shortcut. Only meaningful for the NPCs source — keeps Mara
    // from getting a "Talk about Mara" choice on her own topics.
    ...(form.source === 'npcs'
      ? [Toggle({
          on:       !!form.ignoreSelf,
          onChange: v => _setGen({ ignoreSelf: !!v }),
        })(['Ignore self (the speaking NPC)'])]
      : []),
  ]);
};

const _flowFields = form => Stack({ gap: 8 })([
  Grid({ cols: 2, gap: 10 })([
    TextInput({
      label:       'Label template',
      value:       form.labelTemplate || '',
      onChange:    onText(v => _setGen({ labelTemplate: v })),
      placeholder: 'Take {name}',
    }),
    Select({
      label:    'Flow',
      options:  FLOW_OPTS,
      value:    form.flow,
      onChange: onText(v => _setGen({ flow: v })),
    }),
  ]),
  ...((form.flow === 'navigate' || form.flow === 'exitRoom' || form.flow === 'change' || form.flow === 'exitCombat')
    ? [TextInput({
        label: form.flow === 'change'     ? 'Target topic-id template'
             : form.flow === 'exitCombat' ? 'Target combat-id template'
             :                              'Target room-id template',
        value: form.targetTemplate || '',
        onChange: onText(v => _setGen({ targetTemplate: v })),
        placeholder: form.flow === 'change' ? 'topic_xxx or {id}' : '{id}',
      })]
    : []),
]);

const _effectFields = form => Stack({ gap: 8 })([
  Select({
    label:    'Effect mode',
    options:  EFFECT_MODE_OPTS,
    value:    form.effectMode || 'none',
    onChange: onText(v => _setGen({ effectMode: v })),
  }),
  ...(form.effectMode === 'simple'
    ? [Grid({ cols: 3, gap: 8 })([
        TextInput({ label: 'Op target', value: form.opTarget || '', onChange: onText(v => _setGen({ opTarget: v })), placeholder: 'inv.{id}' }),
        Select({    label: 'Op kind',   options: OP_KIND_OPTS, value: form.opKind || 'give', onChange: onText(v => _setGen({ opKind: v })) }),
        TextInput({ label: 'Op value',  value: form.opValue == null ? '' : String(form.opValue), onChange: onText(v => _setGen({ opValue: v })), placeholder: '1' }),
      ])]
    : []),
  ...(form.effectMode === 'js'
    ? [TextInput({
        label: 'JS body (use placeholders)',
        value: form.jsBody || '',
        onChange: onText(v => _setGen({ jsBody: v })),
        placeholder: 'c.talkTo("{id}", c.scene);',
      })]
    : []),
]);

// One reply-page row: compact TextInput + AssetInput + a Delete button.
// `pages` is the full array and `index` is this row's position — we lift the
// onChange of the full array up so the parent owns immutability.
const _replyPageRow = ({ pages, index }) => {
  const page = pages[index];
  const _set = next => _setGen({ pages: pages.map((p, k) => k === index ? next : p) });
  const _delete = () => _setGen({
    pages: pages.length === 1 ? [{ text: '', image: '', advanceLabel: 'More' }] : pages.filter((_, k) => k !== index),
  });
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:8px 10px; background:var(--surface)' })([
    div({ style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' })([
      span({ style: 'font-weight:600; font-size:12px; color:var(--text-muted)' })([`Page ${index + 1}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: _delete, disabled: pages.length === 1 })(['x']),
    ]),
    TextInput({
      label:       'Text (placeholders OK)',
      value:       page.text || '',
      onChange:    onText(v => _set({ ...page, text: v })),
      placeholder: 'Yeah, {name} is nice.',
    }),
    AssetInput({
      label:    'Image (pick from catalogue)',
      value:    page.image || '',
      onChange: v => _set({ ...page, image: v }),
      accept:   'image',
    }),
  ]);
};

// Dialogue-mode form: reply pages list (text + image picker each) + topic name
// + link label + Back button label.
const _dialogueFields = form => {
  const pages = Array.isArray(form.pages) && form.pages.length
    ? form.pages
    : [{ text: '', image: '', advanceLabel: 'More' }];
  return Stack({ gap: 8 })([
    TextInput({
      label:       'Link choice label (on source topic)',
      value:       form.labelTemplate || '',
      onChange:    onText(v => _setGen({ labelTemplate: v })),
      placeholder: 'Talk about {name}',
    }),
    TextInput({
      label:       'Reply topic name',
      value:       form.topicNameTemplate || '',
      onChange:    onText(v => _setGen({ topicNameTemplate: v })),
      placeholder: 'About {name}',
    }),
    div({})([
      span({ style: 'font-size:12px; color:var(--text-muted); display:block; margin-bottom:6px' })([
        `Reply pages (${pages.length}) — advances via "More"; final page leads to the Back button`,
      ]),
      Stack({ gap: 6 })([
        ...pages.map((_, i) => _replyPageRow({ pages, index: i })),
        Button({
          size: 'sm', variant: 'ghost',
          onClick: () => _setGen({ pages: [...pages, { text: '', image: '', advanceLabel: 'More' }] }),
        })(['+ Add page']),
      ]),
    ]),
    TextInput({
      label:       'Back button label',
      value:       form.backLabel || '',
      onChange:    onText(v => _setGen({ backLabel: v })),
      placeholder: 'Back',
    }),
  ]);
};

// Advanced filters — apply on top of source/filter to narrow the list.
const _advancedFields = form => Stack({ gap: 8 })([
  p({ style: 'margin:0; font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600' })(['Advanced']),
  Grid({ cols: 3, gap: 8 })([
    TextInput({
      label:       'Name/id contains',
      value:       form.nameContains || '',
      onChange:    onText(v => _setGen({ nameContains: v })),
      placeholder: 'substring',
    }),
    TextInput({
      label:       'Exclude ids (comma-sep.)',
      value:       form.excludeIds || '',
      onChange:    onText(v => _setGen({ excludeIds: v })),
      placeholder: 'self,foo',
    }),
    TextInput({
      label:       'Limit count',
      value:       form.limit == null ? '' : String(form.limit),
      onChange:    onText(v => _setGen({ limit: v })),
      placeholder: '∞',
    }),
  ]),
  TextInput({
    label:       'Per-choice condition (JS expr, optional)',
    value:       form.conditionJs || '',
    onChange:    onText(v => _setGen({ conditionJs: v })),
    placeholder: '(c.state.inventory?.["{id}"] ?? 0) === 0',
  }),
]);

const ChoiceGenerator = state => {
  const gen = state.generator || {};
  if (!gen.open) return div({})([]);
  const project   = state.project;
  const preview   = _preview(gen)(project);
  const npc       = (project.npcs || []).find(n => n.id === gen.npcId);
  const topic     = npc && (npc.topics || []).find(t => t.id === gen.topicId);
  const heading   = (npc && topic) ? `${npc.name || npc.id} · ${topic.name || topic.id}` : 'Topic';

  // Count for the Generate button — drives disable + label.
  const count = gen.mode === 'dialogues'
    ? generateDialogues(gen)(project).choices.length
    : generateChoices(gen)(project).length;

  return Modal({
    open:    true,
    title:   `Generate · ${heading}`,
    onClose: closeChoiceGenerator,
  })([
    Stack({ gap: 14 })([
      Select({
        label:    'Mode',
        options:  MODE_OPTS,
        value:    gen.mode || 'choices',
        onChange: onText(v => _setGen({ mode: v })),
      }),
      p({ style: 'margin:0; font-size:12.5px; color:var(--text-muted)' })([_placeholdersHint(gen.source)]),
      _sourceFields(gen),
      _advancedFields(gen),

      // Mode-specific section: choices mode shows Flow + Effect; dialogues mode
      // shows the reply-topic fields.
      ...(gen.mode === 'dialogues'
        ? [_dialogueFields(gen)]
        : [_flowFields(gen), _effectFields(gen)]),

      div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
        lbl({ style: 'font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; display:block; margin-bottom:6px' })(['Preview']),
        Stack({ gap: 4 })(preview),
      ]),
      div({ style: 'display:flex; gap:8px; justify-content:flex-end; padding-top:6px' })([
        Button({ size: 'sm', variant: 'ghost',   onClick: closeChoiceGenerator })(['Cancel']),
        Button({ size: 'sm', variant: 'primary', onClick: () => _apply(gen, project), disabled: count === 0 })([
          `Generate ${count || ''}`.trim(),
        ]),
      ]),
    ]),
  ]);
};

export {
  ChoiceGenerator, openChoiceGenerator, closeChoiceGenerator,
  generateChoices, generateDialogues, emptyGeneratorForm,
};
