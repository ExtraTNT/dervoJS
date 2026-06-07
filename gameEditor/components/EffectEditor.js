/**
 * EffectEditor — three modes:
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
import { Button } from '../../src/components/Button.js';
import { Stack } from '../../src/components/Layout.js';
import { onText } from '../helpers.js';
import { effectToFn } from '../codegen.js';
import { LootTableEditor } from './LootTableEditor.js';
import { WeightBonusList } from './WeightBonusEditor.js';
import { emptyLootTable, emptyEffect, emptyOneOfOption } from '../schema.js';

const MODE_OPTS = [
  { value: 'none',        label: 'no effect'                                       },
  { value: 'simple',      label: 'stat / flag ops'                                 },
  { value: 'multi',       label: 'multi — run several steps in order'              },
  { value: 'oneOf',       label: 'oneOf — pick ONE option (weighted, conditional)' },
  { value: 'randomLoot',  label: 'random loot table (multi-pick bag)'              },
  { value: 'navigate',    label: 'navigate — go to a room'                         },
  { value: 'talkTo',      label: 'open NPC dialogue'                               },
  { value: 'enterCombat', label: 'open combat'                                     },
  { value: 'js',          label: 'JS body'                                         },
];

const STAT_OPS = [
  { value: 'set', label: 'set =' },
  { value: 'add', label: 'add +' },
  { value: 'sub', label: 'sub −' },
];
const FLAG_OPS = [
  { value: 'set',    label: 'set =' },
  { value: 'toggle', label: 'toggle' },
];
const INV_OPS = [
  { value: 'give', label: 'give +' },
  { value: 'take', label: 'take −' },
  { value: 'set',  label: 'set =' },
];
const SKILL_OPS = [
  { value: 'learn',  label: 'learn'  },
  { value: 'forget', label: 'forget' },
];

const _emptyOp = () => ({ target: '', op: 'add', value: 0 });

const _kindOf = target =>
  target.startsWith('flags.')  ? 'flag'
  : target.startsWith('inv.')    ? 'inv'
  : target.startsWith('skills.') ? 'skill'
  : 'stat';

const OpRow = ({ op: o, vars, onChange, onRemove }) => {
  const kind = _kindOf(o.target);
  const targetOpts = [
    { value: '', label: '— pick —' },
    ...vars.stats.map(k => ({ value: k,            label: `stat: ${k}` })),
    ...vars.flags.map(k => ({ value: `flags.${k}`, label: `flag: ${k}` })),
    ...(vars.items  || []).map(it => ({ value: `inv.${it.id}`,    label: `item: ${it.name}` })),
    ...(vars.skills || []).map(sk => ({ value: `skills.${sk.id}`, label: `skill: ${sk.name}` })),
  ];
  const opsForKind = kind === 'flag' ? FLAG_OPS : kind === 'inv' ? INV_OPS : kind === 'skill' ? SKILL_OPS : STAT_OPS;
  // Normalise op when switching kinds — keep "set" since both support it.
  const safeOp = opsForKind.find(x => x.value === o.op) ? o.op : opsForKind[0].value;
  return div({ style: 'display:grid; grid-template-columns: 1fr 110px 1fr 40px; gap:8px; margin-bottom:6px' })([
    Select({ options: targetOpts, value: o.target, onChange: onText(v => onChange({ ...o, target: v })) }),
    Select({ options: opsForKind, value: safeOp, onChange: onText(v => onChange({ ...o, op: v })) }),
    safeOp === 'toggle' || kind === 'skill'
      ? div({ style: 'display:flex; align-items:center; color:var(--text-muted); font-size:12px' })(['(no value)'])
      : kind === 'flag'
        ? Select({
            options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
            value: String(o.value),
            onChange: onText(v => onChange({ ...o, value: v === 'true' })),
          })
        : TextInput({
            value: String(o.value ?? ''),
            onChange: onText(v => {
              const n = Number(v);
              onChange({ ...o, value: Number.isFinite(n) && v.trim() !== '' ? n : v });
            }),
            placeholder: 'number or string',
          }),
    Button({ variant: 'ghost', size: 'sm', onClick: onRemove })(['×']),
  ]);
};

// One option in a `oneOf` Effect: weight + bonuses + a nested Effect. The
// runner picks ONE option per call based on effective weights (base + applied
// bonuses), then fires that option's Effect — which can be anything, including
// another `oneOf` or `multi` (recursion just works).
const _oneOfOptionRow = ({ options, index }) => vars => set => {
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
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface)' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      span({ style: 'font-weight:600; font-size:12px' })([`Option ${index + 1}`]),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${opt.id.slice(-5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move(-1), disabled: index === 0                 })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move( 1), disabled: index === options.length - 1 })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: _delete })(['×']),
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
      label:    'Weight bonuses — raise odds dynamically',
    }),
    div({ style: 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-2)' })([
      span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600; display:block; margin-bottom:6px' })([
        'When this option is picked, fire',
      ]),
      EffectEditor({ effect: opt.effect, vars, label: '', onChange: nxt => _patch({ ...opt, effect: nxt }) }),
    ]),
  ]);
};

// Per-roll odds preview (base weights only — bonuses can shift this at runtime).
const _oneOfOddsLine = options => {
  const total = options.reduce((a, o) => a + Math.max(0, Number(o.weight) || 0), 0);
  if (total <= 0) return null;
  return span({ style: 'font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-muted); line-height:1.6; display:block' })([
    'Base odds: ' + options.map(o => `${((Math.max(0, Number(o.weight) || 0) / total) * 100).toFixed(1)}% → ${o.label || `Opt ${o.id.slice(-3)}`}`).join('  ·  '),
  ]);
};

const _oneOfOptionsEditor = e => vars => set => {
  const options = Array.isArray(e.options) ? e.options : [];
  const odds = _oneOfOddsLine(options);
  return Stack({ gap: 8 })([
    span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600' })([
      `Options (${options.length}) — exactly one fires per call`,
    ]),
    ...(odds ? [odds] : []),
    ...(options.length === 0
      ? [div({ className: 'gef-empty' })(['No options yet. Add one below.'])]
      : options.map((_, i) => _oneOfOptionRow({ options, index: i })(vars)(set))),
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
const _multiStepRow = ({ steps, index }) => vars => set => {
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
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface)' })([
    div({ style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' })([
      span({ style: 'font-weight:600; font-size:12px' })([`Step ${index + 1}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move(-1), disabled: index === 0                })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _move( 1), disabled: index === steps.length - 1 })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: _delete })(['×']),
    ]),
    EffectEditor({ effect: step, vars, label: '', onChange: _patch }),
  ]);
};

const _multiStepsEditor = e => vars => set => {
  const steps = Array.isArray(e.steps) ? e.steps : [];
  return Stack({ gap: 8 })([
    span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600' })([
      `Steps (${steps.length}) — fire in order`,
    ]),
    ...(steps.length === 0
      ? [div({ className: 'gef-empty' })(['No steps yet. Add one below.'])]
      : steps.map((_, i) => _multiStepRow({ steps, index: i })(vars)(set))),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => set({ steps: [...steps, emptyEffect()] }),
    })(['+ Add step']),
  ]);
};

const EffectEditor = ({ effect, onChange, vars = { stats: [], flags: [], items: [], npcs: [], combats: [] }, label = 'Effect' }) => {
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
              onChange: nx => setOps(e.ops.map((x, k) => k === i ? nx : x)),
              onRemove: () => setOps(e.ops.filter((_, k) => k !== i)),
            })
          ),
          Button({ size: 'sm', variant: 'ghost', onClick: () => setOps([...(e.ops || []), _emptyOp()]) })(['+ Add op']),
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
              { value: '', label: '— pick room —' },
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
            span({ style: 'font-family:ui-monospace,monospace' })(['c.goto(toRoom)']),
            '. Use this inside a ', span({ style: 'font-family:ui-monospace,monospace' })(['multi']),
            ' Effect to do "+gold, then go to bar" without writing JS.',
          ]),
        ])]
      : []),

    ...(e.mode === 'multi'
      ? [div({ style: 'margin-top:8px' })([_multiStepsEditor(e)(vars)(set)])]
      : []),

    ...(e.mode === 'oneOf'
      ? [div({ style: 'margin-top:8px' })([_oneOfOptionsEditor(e)(vars)(set)])]
      : []),

    ...(e.mode === 'talkTo'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label: 'NPC',
            options: [
              { value: '', label: '— pick NPC —' },
              ...(vars.npcs || []).map(n => ({ value: n.id, label: `${n.name || n.id} (${n.id})` })),
            ],
            value:    e.npcId || '',
            onChange: onText(v => set({ npcId: v })),
          }),
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Routes through ',
            span({ style: 'font-family:ui-monospace,monospace' })(['ctx.talkTo']),
            ' — the engine returns to the calling room when the NPC\'s "Goodbye" choice fires.',
          ]),
        ])]
      : []),

    ...(e.mode === 'enterCombat'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label: 'Combat',
            options: [
              { value: '', label: '— pick combat —' },
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
            'Receives ', span({ style: 'font-family:ui-monospace,monospace' })(['c']), ' (the game ctx). Use ', span({ style: 'font-family:ui-monospace,monospace' })(['c.setState(...)']), '.',
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
    // — the next scene render shows them as a single Continue interstitial.
    // Scope: state + init (pre-action snapshot) + gain / loss (deltas).
    ...(e.mode !== 'none'
      ? [div({ style: 'margin-top:8px' })([
          span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600; display:block; margin-bottom:4px' })([
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
            'Scope: ', span({ style: 'font-family:ui-monospace,monospace' })(['state']),
            ' + ', span({ style: 'font-family:ui-monospace,monospace' })(['init']),
            ' (pre-action snapshot) + ', span({ style: 'font-family:ui-monospace,monospace' })(['gain']),
            ' / ', span({ style: 'font-family:ui-monospace,monospace' })(['loss']),
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
