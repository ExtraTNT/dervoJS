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
import { onText } from '../helpers.js';
import { effectToFn } from '../codegen.js';

const MODE_OPTS = [
  { value: 'none',        label: 'no effect'         },
  { value: 'simple',      label: 'stat / flag ops'   },
  { value: 'talkTo',      label: 'open NPC dialogue' },
  { value: 'enterCombat', label: 'open combat'       },
  { value: 'js',          label: 'JS body'           },
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

const EffectEditor = ({ effect, onChange, vars = { stats: [], flags: [], items: [], npcs: [], combats: [] }, label = 'Effect' }) => {
  const e = effect || { mode: 'none', ops: [], body: '', npcId: '', combatId: '' };
  const set    = patch => onChange({ ...e, ...patch });
  const setOps = ops   => onChange({ ...e, ops });

  return div({})([
    Select({ label, options: MODE_OPTS, value: e.mode, onChange: onText(v => set({ mode: v })) }),

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
