/**
 * EffectEditor - three modes:
 *   - none: nothing happens
 *   - simple: one or more ops over stats/flags. ops are { target, op, value }.
 *   - js: freeform body; receives `c` (the game ctx). Use `c.setState(...)`.
 *
 * "ops" let an effect do multiple state writes in one click (e.g. gold -= 5
 * AND xp += 10). The simple-mode UI lets you append/remove ops.
 */

import { div, span, textarea } from '../../src/elements.js';
import { Select } from '../../src/components/Select.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Button } from '../../src/components/Button.js';
import { Stack } from '../../src/components/Layout.js';
import { onText } from '../helpers.js';
import { effectToFn } from '../codegen.js';
import { LootTableEditor } from './LootTableEditor.js';
import { WeightBonusList } from './WeightBonusEditor.js';
import { ConditionEditor } from './ConditionEditor.js';
import { emptyLootTable, emptyEffect, emptyOneOfOption, emptyOp, emptyOpLimit, emptyCondition } from '../schema.js';
import { groupedOptions } from './FolderedList.js';
import { setState, getState } from '../store.js';

const MODE_OPTS = [
  { value: 'none',        label: 'no effect'                                       },
  { value: 'simple',      label: 'stat / flag ops'                                 },
  { value: 'multi',       label: 'multi - run several steps in order'              },
  { value: 'oneOf',       label: 'oneOf - pick ONE option (weighted, conditional)' },
  { value: 'randomLoot',  label: 'random loot table (multi-pick bag)'              },
  { value: 'navigate',    label: 'navigate - go to a room'                         },
  { value: 'talkTo',      label: 'open NPC dialogue'                               },
  { value: 'enterCombat', label: 'open combat'                                     },
  { value: 'js',          label: 'JS body'                                         },
];

const NUM_STAT_OPS = [
  { value: 'set', label: 'set =' },
  { value: 'add', label: 'add +' },
  { value: 'sub', label: 'sub -' },
];
const STR_STAT_OPS = [
  { value: 'set',    label: 'set =' },
  { value: 'append', label: 'append +' },
  { value: 'clear',  label: 'clear (set "")' },
];
const ARR_STAT_OPS = [
  { value: 'push',        label: 'push' },
  { value: 'removeValue', label: 'remove value' },
  { value: 'clear',       label: 'clear (empty array)' },
  { value: 'set',         label: 'set = (comma-separated)' },
];
const FLAG_OPS = [
  { value: 'set',    label: 'set =' },
  { value: 'toggle', label: 'toggle' },
];
const INV_OPS = [
  { value: 'give', label: 'give +' },
  { value: 'take', label: 'take -' },
  { value: 'set',  label: 'set =' },
];
const SKILL_OPS = [
  { value: 'learn',  label: 'learn'  },
  { value: 'forget', label: 'forget' },
];

// Stat kind disambiguates number / string / array writes (engine handles
// all three; statTypes is `{ key: 'number' | 'string' | 'array' }`).
// Missing entry defaults to 'number' so legacy projects keep behaviour.
const _kindOf = statTypes => target =>
  target.startsWith('flags.')  ? 'flag'
  : target.startsWith('inv.')    ? 'inv'
  : target.startsWith('skills.') ? 'skill'
  : statTypes?.[target] === 'string' ? 'strStat'
  : statTypes?.[target] === 'array'  ? 'arrStat'
  :                                    'numStat';

const _opsForKind = kind =>
    kind === 'flag'    ? FLAG_OPS
  : kind === 'inv'     ? INV_OPS
  : kind === 'skill'   ? SKILL_OPS
  : kind === 'strStat' ? STR_STAT_OPS
  : kind === 'arrStat' ? ARR_STAT_OPS
  :                      NUM_STAT_OPS;

// True when an op carries non-default condition / min / max / etc.
const _isAdvanced = o =>
  (o?.condition && o.condition.mode && o.condition.mode !== 'always') ||
  (o?.min && o.min.enabled) ||
  (o?.max && o.max.enabled);

// Tiny in-memory map of which op rows are showing their Advanced drawer.
// Keyed by a stable id derived from the op's position inside the parent
// Effect (the parent threads `rowKey` down). Lives on the editor store so the
// drawer stays open across re-renders.
const _isOpen = rowKey => !!(getState().expandedOpRows || {})[rowKey];
const _toggleOpen = rowKey => () => setState(s => ({
  expandedOpRows: { ...(s.expandedOpRows || {}), [rowKey]: !s.expandedOpRows?.[rowKey] },
}));

// Limit field - renders {enabled, statKey, mul, const} as
//   [Toggle] [stat dropdown] [mul x] [+ const]
// Disabled = no clamp; statKey === '' makes the limit a pure constant
// (mul * 0 + const = const), so the user can either type a flat number or
// derive from a stat.
const _LimitField = ({ label, vars, limit, onChange }) => {
  const cur = limit || emptyOpLimit();
  // Clamp formula = `mul * state[stat] + const`, so the stat picker can
  // only show NUMERIC stats. Strings / arrays would NaN out the formula.
  const statOpts = [
    { value: '', label: '- constant -' },
    ...(vars.numStats || vars.stats || []).map(k => ({ value: k, label: k })),
  ];
  return div({ style: 'border:1px solid var(--border-2); border-radius:var(--radius); padding:8px 10px' })([
    div({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:6px' })([
      Toggle({
        on:       !!cur.enabled,
        onChange: v => onChange({ ...cur, enabled: v }),
      })([`${label} clamp`]),
      span({ style: 'flex:1' })([]),
      ...(cur.enabled
        ? [span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([
            `= ${Number(cur.mul) || 0} x state[${cur.statKey ? JSON.stringify(cur.statKey) : '""'}] + ${Number(cur.const) || 0}`,
          ])]
        : []),
    ]),
    ...(cur.enabled
      ? [div({ style: 'display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px' })([
          Select({
            label:    'Stat',
            options:  statOpts,
            value:    cur.statKey || '',
            onChange: onText(v => onChange({ ...cur, statKey: v })),
          }),
          NumberInput({
            label:    'Multiplier',
            value:    Number(cur.mul) || 0,
            onChange: v => onChange({ ...cur, mul: Number(v) || 0 }),
          }),
          NumberInput({
            label:    'Constant',
            value:    Number(cur.const) || 0,
            onChange: v => onChange({ ...cur, const: Number(v) || 0 }),
          }),
        ])]
      : []),
  ]);
};

const OpRow = ({ op: o, vars, rowKey, onChange, onRemove }) => {
  const kind = _kindOf(vars.statTypes)(o.target);
  const targetOpts = [
    { value: '', label: '- pick -' },
    ...vars.stats.map(k => {
      const t = vars.statTypes?.[k] || 'number';
      const suffix = t === 'number' ? '' : ` (${t})`;
      return { value: k, label: `stat: ${k}${suffix}` };
    }),
    ...vars.flags.map(k => ({ value: `flags.${k}`, label: `flag: ${k}` })),
    ...groupedOptions(vars.items || [])(it => ({ value: `inv.${it.id}`, label: `item: ${it.name}` })),
    ...(vars.skills || []).map(sk => ({ value: `skills.${sk.id}`, label: `skill: ${sk.name}` })),
  ];
  const opsForKind = _opsForKind(kind);
  // Normalise op when switching kinds - keep the previous op if the new
  // group has it (most groups share "set"), else fall back to first.
  const safeOp = opsForKind.find(x => x.value === o.op) ? o.op : opsForKind[0].value;
  // Clamps only make sense on numeric writes (stat add/sub/set, inv give/take/set).
  const clampable = (kind === 'numStat' && (safeOp === 'add' || safeOp === 'sub' || safeOp === 'set'))
                 || (kind === 'inv'     && (safeOp === 'give' || safeOp === 'take' || safeOp === 'set'));
  // Value input shape per kind.
  const noValueOp = safeOp === 'toggle' || safeOp === 'clear' || kind === 'skill';
  const open = _isOpen(rowKey);
  const advFlagged = _isAdvanced(o);
  return div({ style: 'border:1px solid transparent; border-radius:var(--radius); margin-bottom:6px' + (open || advFlagged ? '; border-color:var(--border-2); padding:6px 8px; background:var(--surface-2, transparent)' : '') })([
    div({ style: 'display:grid; grid-template-columns: 1fr 110px 1fr 32px 32px; gap:8px; align-items:center' })([
      Select({ options: targetOpts, value: o.target, onChange: onText(v => onChange({ ...o, target: v })) }),
      Select({ options: opsForKind, value: safeOp, onChange: onText(v => onChange({ ...o, op: v })) }),
      noValueOp
        ? div({ style: 'display:flex; align-items:center; color:var(--text-muted); font-size:12px' })(['(no value)'])
        : kind === 'flag'
          ? Select({
              options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
              value: String(o.value),
              onChange: onText(v => onChange({ ...o, value: v === 'true' })),
            })
          : kind === 'strStat'
            ? TextInput({
                value:       typeof o.value === 'string' ? o.value : String(o.value ?? ''),
                onChange:    onText(v => onChange({ ...o, value: v })),
                placeholder: kind === 'strStat' && safeOp === 'append' ? '- text to append' : 'text',
              })
            : kind === 'arrStat'
              ? TextInput({
                  value:       typeof o.value === 'string' ? o.value : (Array.isArray(o.value) ? o.value.join(', ') : String(o.value ?? '')),
                  onChange:    onText(v => onChange({ ...o, value: v })),
                  placeholder: safeOp === 'set' ? 'a, b, c' : 'one value',
                })
              : TextInput({
                  value: String(o.value ?? ''),
                  onChange: onText(v => {
                    const n = Number(v);
                    onChange({ ...o, value: Number.isFinite(n) && v.trim() !== '' ? n : v });
                  }),
                  placeholder: 'number or string',
                }),
      Button({
        variant: open ? 'primary' : 'ghost', size: 'sm',
        onClick: _toggleOpen(rowKey),
        title:   advFlagged ? 'Advanced - condition / clamp set' : 'Advanced - condition / clamp',
      })([advFlagged ? '⚙•' : '⚙']),
      Button({ variant: 'ghost', size: 'sm', onClick: onRemove })(['x']),
    ]),
    ...(open
      ? [div({ style: 'margin-top:8px; padding-top:8px; border-top:1px dashed var(--border-2); display:flex; flex-direction:column; gap:8px' })([
          div({})([
            span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:4px' })([
              'Run this op only when',
            ]),
            ConditionEditor({
              condition: o.condition || emptyCondition(),
              vars,
              onChange:  v => onChange({ ...o, condition: v }),
            }),
          ]),
          ...(clampable
            ? [div({ style: 'display:grid; grid-template-columns: 1fr 1fr; gap:8px' })([
                _LimitField({
                  label:    'Min',
                  vars,
                  limit:    o.min || emptyOpLimit(),
                  onChange: v => onChange({ ...o, min: v }),
                }),
                _LimitField({
                  label:    'Max',
                  vars,
                  limit:    o.max || emptyOpLimit(),
                  onChange: v => onChange({ ...o, max: v }),
                }),
              ])]
            : [div({ style: 'font-size:11px; color:var(--text-muted)' })([
                'Clamps apply only to numeric writes (stat add/sub/set, inv give/take/set).',
              ])]),
        ])]
      : []),
  ]);
};

// One option in a `oneOf` Effect: weight + bonuses + a nested Effect. The
// runner picks ONE option per call based on effective weights (base + applied
// bonuses), then fires that option's Effect - which can be anything, including
// another `oneOf` or `multi` (recursion just works).
const _oneOfOptionRow = ({ options, index, rowKey }) => vars => set => {
  const opt = options[index];
  const _patch = next => set({ options: options.map((o, k) => k === index ? next : o) });
  const _delete = () => set({ options: options.filter((_, k) => k !== index) });
  const _move = dir => {
    const j = index + dir;
    if (j < 0 || j >= options.length) return;
    const out = [...options];
    [out[index], out[j]] = [out[j], out[index]];
    set({ options: out });
  };
  return div({ className: 'gef-surface-card' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      span({ style: 'font-weight:600; font-size:12px' })([`Option ${index + 1}`]),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${opt.id.slice(-5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move(-1), disabled: index === 0                 })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move( 1), disabled: index === options.length - 1 })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: _delete })(['x']),
    ]),
    div({ style: 'display:grid; grid-template-columns:1fr 120px; gap:8px; margin-bottom:8px' })([
      TextInput({
        label:       'Label (for editor preview only)',
        value:       opt.label || '',
        onChange:    onText(v => _patch({ ...opt, label: v })),
        placeholder: 'Light beer',
      }),
      TextInput({
        label:       'Base weight',
        value:       String(Number(opt.weight) || 0),
        onChange:    onText(v => _patch({ ...opt, weight: Math.max(0, Number(v) || 0) })),
        placeholder: '1',
      }),
    ]),
    WeightBonusList({
      bonuses:  opt.bonuses || [],
      vars,
      onChange: next => _patch({ ...opt, bonuses: next }),
      label:    'Weight bonuses - raise odds dynamically',
    }),
    div({ style: 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-2)' })([
      span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:6px' })([
        'When this option is picked, fire',
      ]),
      EffectEditor({ effect: opt.effect, vars, label: '', rowKey: `${rowKey}.${index}`, onChange: nxt => _patch({ ...opt, effect: nxt }) }),
    ]),
  ]);
};

// Per-roll odds preview (base weights only - bonuses can shift this at runtime).
const _oneOfOddsLine = options => {
  const total = options.reduce((a, o) => a + Math.max(0, Number(o.weight) || 0), 0);
  if (total <= 0) return null;
  return span({ style: 'font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-muted); line-height:1.6; display:block' })([
    'Base odds: ' + options.map(o => `${((Math.max(0, Number(o.weight) || 0) / total) * 100).toFixed(1)}% → ${o.label || `Opt ${o.id.slice(-3)}`}`).join('  ·  '),
  ]);
};

const _oneOfOptionsEditor = e => vars => set => rowKey => {
  const options = Array.isArray(e.options) ? e.options : [];
  const odds = _oneOfOddsLine(options);
  return Stack({ gap: 8 })([
    span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600' })([
      `Options (${options.length}) - exactly one fires per call`,
    ]),
    ...(odds ? [odds] : []),
    ...(options.length === 0
      ? [div({ className: 'gef-empty' })(['No options yet. Add one below.'])]
      : options.map((_, i) => _oneOfOptionRow({ options, index: i, rowKey: `${rowKey}:oneOf` })(vars)(set))),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => set({ options: [...options, emptyOneOfOption()] }),
    })(['+ Add option']),
  ]);
};

// One step of a `multi` Effect: a nested EffectEditor card with reorder /
// delete controls. Curried `effect => vars => set` so it composes cleanly.
// The inner EffectEditor reference is resolved at call time (EffectEditor is
// defined below) so this works fine with hoisted const arrows.
const _multiStepRow = ({ steps, index, rowKey }) => vars => set => {
  const step = steps[index];
  const _patch = next => set({ steps: steps.map((s, k) => k === index ? next : s) });
  const _delete = () => set({ steps: steps.filter((_, k) => k !== index) });
  const _move = dir => {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const out = [...steps];
    [out[index], out[j]] = [out[j], out[index]];
    set({ steps: out });
  };
  return div({ className: 'gef-surface-card' })([
    div({ style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' })([
      span({ style: 'font-weight:600; font-size:12px' })([`Step ${index + 1}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move(-1), disabled: index === 0                })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move( 1), disabled: index === steps.length - 1 })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: _delete })(['x']),
    ]),
    EffectEditor({ effect: step, vars, label: '', rowKey: `${rowKey}.${index}`, onChange: _patch }),
  ]);
};

const _multiStepsEditor = e => vars => set => rowKey => {
  const steps = Array.isArray(e.steps) ? e.steps : [];
  return Stack({ gap: 8 })([
    span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600' })([
      `Steps (${steps.length}) - fire in order`,
    ]),
    ...(steps.length === 0
      ? [div({ className: 'gef-empty' })(['No steps yet. Add one below.'])]
      : steps.map((_, i) => _multiStepRow({ steps, index: i, rowKey: `${rowKey}:multi` })(vars)(set))),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => set({ steps: [...steps, emptyEffect()] }),
    })(['+ Add step']),
  ]);
};

const EffectEditor = ({ effect, onChange, vars = { stats: [], flags: [], items: [], npcs: [], combats: [] }, label = 'Effect', rowKey = 'eff' }) => {
  const e = effect || { mode: 'none', ops: [], body: '', npcId: '', combatId: '' };
  const set    = patch => onChange({ ...e, ...patch });
  const setOps = ops   => onChange({ ...e, ops });

  // When switching mode, lazy-create the mode's defining field if missing.
  // Keeps unrelated fields absent on other modes so JSON stays tidy.
  const _setMode = v => {
    if (v === 'randomLoot' && (!e.table || !Array.isArray(e.table.entries))) {
      set({ mode: v, table: emptyLootTable() });
    } else if (v === 'multi' && !Array.isArray(e.steps)) {
      set({ mode: v, steps: [] });
    } else if (v === 'oneOf' && !Array.isArray(e.options)) {
      set({ mode: v, options: [] });
    } else {
      set({ mode: v });
    }
  };

  return div({})([
    Select({ label, options: MODE_OPTS, value: e.mode, onChange: onText(_setMode) }),

    ...(e.mode === 'simple'
      ? [div({ style: 'margin-top:8px' })([
          ...(e.ops || []).map((o, i) =>
            OpRow({
              op: o,
              vars,
              rowKey: `${rowKey}:${i}`,
              onChange: nx => setOps(e.ops.map((x, k) => k === i ? nx : x)),
              onRemove: () => setOps(e.ops.filter((_, k) => k !== i)),
            })
          ),
          Button({ size: 'sm', variant: 'ghost', onClick: () => setOps([...(e.ops || []), emptyOp()]) })(['+ Add op']),
        ])]
      : []),

    ...(e.mode === 'randomLoot'
      ? [div({ style: 'margin-top:8px' })([
          LootTableEditor({
            table:    e.table || emptyLootTable(),
            vars,
            onChange: t => set({ table: t }),
          }),
        ])]
      : []),

    ...(e.mode === 'navigate'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label:    'Target room',
            // Story rooms get a ⭐ so authors see the narrative-arc options.
            options:  [
              { value: '', label: '- pick room -' },
              ...(vars.rooms || []).map(r => ({
                value: r.id,
                label: `${r.kind === 'story' ? '⭐ ' : ''}${r.title || r.id}`,
              })),
            ],
            value:    e.toRoom || '',
            onChange: onText(v => set({ toRoom: v })),
          }),
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Resets the target room\'s page index then ',
            span({ className: 'dv-mono' })(['c.goto(toRoom)']),
            '. Use this inside a ', span({ className: 'dv-mono' })(['multi']),
            ' Effect to do "+gold, then go to bar" without writing JS.',
          ]),
        ])]
      : []),

    ...(e.mode === 'multi'
      ? [div({ style: 'margin-top:8px' })([_multiStepsEditor(e)(vars)(set)(rowKey)])]
      : []),

    ...(e.mode === 'oneOf'
      ? [div({ style: 'margin-top:8px' })([_oneOfOptionsEditor(e)(vars)(set)(rowKey)])]
      : []),

    ...(e.mode === 'talkTo'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label: 'NPC',
            options: [
              { value: '', label: '- pick NPC -' },
              ...groupedOptions(vars.npcs || [])(n => ({ value: n.id, label: `${n.name || n.id} (${n.id})` })),
            ],
            value:    e.npcId || '',
            onChange: onText(v => set({ npcId: v })),
          }),
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Routes through ',
            span({ className: 'dv-mono' })(['ctx.talkTo']),
            ' - the engine returns to the calling room when the NPC\'s "Goodbye" choice fires.',
          ]),
        ])]
      : []),

    ...(e.mode === 'enterCombat'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label: 'Combat',
            options: [
              { value: '', label: '- pick combat -' },
              ...(vars.combats || []).map(c => ({ value: c.id, label: `${c.name || c.id} (${c.id})` })),
            ],
            value:    e.combatId || '',
            onChange: onText(v => set({ combatId: v })),
          }),
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'The engine remembers the current room. Blank win/lose rooms on the combat fall back to it.',
          ]),
        ])]
      : []),

    ...(e.mode === 'js'
      ? [div({ style: 'margin-top:8px' })([
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Receives ', span({ className: 'dv-mono' })(['c']), ' (the game ctx). Use ', span({ className: 'dv-mono' })(['c.setState(...)']), '.',
          ]),
          textarea({
            value: e.body,
            oninput: ev => set({ body: ev.target.value }),
            rows: 4,
            spellcheck: false,
            style: 'width:100%; margin-top:4px; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface); color:var(--text); resize:vertical',
            placeholder: 'c.setState(s => ({ gold: s.gold - 5, xp: s.xp + 10 }));',
          })([]),
        ])]
      : []),

    // Optional Message template. Pushed to state._messageQueue AFTER the
    // core effect runs. Multi steps + randomLoot per-entry messages accumulate
    // - the next scene render shows them as a single Continue interstitial.
    // Scope: state + init (pre-action snapshot) + gain / loss (deltas).
    ...(e.mode !== 'none'
      ? [div({ style: 'margin-top:8px' })([
          span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:4px' })([
            'Message (optional, ${…} template)',
          ]),
          textarea({
            value: e.message || '',
            oninput: ev => set({ message: ev.target.value }),
            rows: 2,
            spellcheck: false,
            style: 'width:100%; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface); color:var(--text); resize:vertical; box-sizing:border-box',
            placeholder: 'You found ${gain.gold} gold (had ${init.gold}, now ${gold}).',
          })([]),
          span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-top:4px' })([
            'Scope: ', span({ className: 'dv-mono' })(['state']),
            ' + ', span({ className: 'dv-mono' })(['init']),
            ' (pre-action snapshot) + ', span({ className: 'dv-mono' })(['gain']),
            ' / ', span({ className: 'dv-mono' })(['loss']),
            ' (per-key deltas). See 📊 State for paths.',
          ]),
        ])]
      : []),

    // Inline preview of the exact JS the Export tab will write for this effect.
    // null means the effect compiles to no action (e.g. mode 'none' or all-empty ops).
    (() => {
      const fn = effectToFn(e);
      return div({ style: 'margin-top:8px; padding:6px 10px; background:var(--surface-2, rgba(0,0,0,.03)); border-left:3px solid var(--accent); border-radius:4px; font-size:11px; color:var(--text-muted)' })([
        span({ style: 'text-transform:uppercase; letter-spacing:.05em; margin-right:8px' })(['Generates']),
        span({ style: 'font-family:ui-monospace,monospace; color:var(--text); white-space:pre-wrap; word-break:break-word' })([
          fn ? `action: ${fn}` : '(no action)',
        ]),
      ]);
    })(),
  ]);
};

export { EffectEditor };
