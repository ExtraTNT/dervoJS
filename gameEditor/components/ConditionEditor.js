/**
 * ConditionEditor — three modes:
 *   - always: no check (omit `if` in generated code)
 *   - simple: `state.<key> <op> <value>` over a stat or flag
 *   - js:     freeform JS expression evaluated with `c` (the game ctx)
 *
 * The editor never mutates the condition itself — it builds a new object and
 * fires onChange with it. Mode switches preserve the cross-mode fields where
 * possible (so flipping back to "simple" doesn't lose your key/op).
 */

import { div, span, textarea } from '../../src/elements.js';
import { Select } from '../../src/components/Select.js';
import { TextInput } from '../../src/components/TextInput.js';
import { onText } from '../helpers.js';
import { condToExpr } from '../codegen.js';

const MODE_OPTS = [
  { value: 'always',  label: 'always (no check)' },
  { value: 'simple',  label: 'stat or flag check' },
  { value: 'hasItem', label: 'has item in inventory' },
  { value: 'js',      label: 'JS expression' },
];

const OP_OPTS = [
  { value: '>=', label: '>=' },
  { value: '>',  label: '>'  },
  { value: '<=', label: '<=' },
  { value: '<',  label: '<'  },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];

const ConditionEditor = ({ condition, onChange, vars = { stats: [], flags: [], items: [] } }) => {
  const c = condition || { mode: 'always', key: '', op: '>=', value: 0, itemId: '', count: 1, expr: '' };
  const set = patch => onChange({ ...c, ...patch });

  const keyOpts = [
    { value: '', label: '— pick —' },
    ...vars.stats.map(k => ({ value: k,            label: `stat: ${k}` })),
    ...vars.flags.map(k => ({ value: `flags.${k}`, label: `flag: ${k}` })),
  ];

  const isFlag = c.key.startsWith('flags.');

  return div({})([
    Select({ label: 'Condition', options: MODE_OPTS, value: c.mode, onChange: onText(v => set({ mode: v })) }),

    ...(c.mode === 'simple'
      ? [div({ style: 'display:grid; grid-template-columns: 1fr 110px 1fr; gap:8px; margin-top:8px' })([
          Select({ options: keyOpts, value: c.key, onChange: onText(v => set({ key: v })) }),
          Select({ options: OP_OPTS, value: c.op, onChange: onText(v => set({ op: v })) }),
          isFlag
            ? Select({
                options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                value: String(c.value),
                onChange: onText(v => set({ value: v === 'true' })),
              })
            : TextInput({
                value: String(c.value ?? ''),
                onChange: onText(v => {
                  const n = Number(v);
                  set({ value: Number.isFinite(n) && v.trim() !== '' ? n : v });
                }),
                placeholder: 'number or string',
              }),
        ])]
      : []),

    ...(c.mode === 'hasItem'
      ? [div({ style: 'display:grid; grid-template-columns: 2fr 110px 100px; gap:8px; margin-top:8px' })([
          Select({
            options: [
              { value: '', label: '— pick item —' },
              ...vars.items.map(it => ({ value: it.id, label: `${it.name} (${it.id})` })),
            ],
            value:    c.itemId,
            onChange: onText(v => set({ itemId: v })),
          }),
          Select({
            options: [
              { value: 'has',    label: 'has' },
              { value: 'lacks',  label: 'lacks' },
              { value: 'atleast', label: '≥ N' },
            ],
            value:    c.op === '>=' || c.op === 'atleast' ? 'atleast' : (c.op === 'lacks' ? 'lacks' : 'has'),
            onChange: onText(v => set({ op: v })),
          }),
          ...(c.op === 'atleast'
            ? [TextInput({ value: String(c.count || 1), onChange: onText(v => set({ count: Math.max(1, Number(v) || 1) })), placeholder: '1' })]
            : [div({})([])]),
        ])]
      : []),

    ...(c.mode === 'js'
      ? [div({ style: 'margin-top:8px' })([
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Receives ', span({ style: 'font-family:ui-monospace,monospace' })(['c']), ' (the game ctx). Return truthy to enable the choice.',
          ]),
          textarea({
            value: c.expr,
            oninput: e => set({ expr: e.target.value }),
            rows: 3,
            spellcheck: false,
            style: 'width:100%; margin-top:4px; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface); color:var(--text); resize:vertical',
            placeholder: 'c.state.gold >= 5 && c.state.flags.metHermit',
          })([]),
        ])]
      : []),

    // Inline preview of the exact JS the Export tab will write for this condition.
    // Always shown — switching modes updates it immediately.
    div({ style: 'margin-top:8px; padding:6px 10px; background:var(--surface-2, rgba(0,0,0,.03)); border-left:3px solid var(--accent); border-radius:4px; font-size:11px; color:var(--text-muted)' })([
      span({ style: 'text-transform:uppercase; letter-spacing:.05em; margin-right:8px' })(['Generates']),
      span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })([
        c.mode === 'always' ? '(no if — always enabled)' : `if: c => ${condToExpr(c)}`,
      ]),
    ]),
  ]);
};

export { ConditionEditor };
