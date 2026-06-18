/**
 * ConditionEditor - five modes:
 *   - always:  no check (omit `if` in generated code)
 *   - simple:  `state.<key> <op> <value>` over a stat or flag
 *   - hasItem: inventory check (has / lacks / ≥ N)
 *   - random:  `Math.random() < p` - handy for "X% of the time" gates
 *   - js:      freeform JS expression evaluated with `c` (the game ctx)
 *
 * The editor never mutates the condition itself - it builds a new object and
 * fires onChange with it. Mode switches preserve the cross-mode fields where
 * possible (so flipping back to "simple" doesn't lose your key/op).
 */

import { div, span, textarea, input } from '../../src/elements.js';
import { Select } from '../../src/components/Select.js';
import { TextInput } from '../../src/components/TextInput.js';
import { onText } from '../helpers.js';
import { condToExpr } from '../codegen.js';
import { groupedOptions } from './FolderedList.js';

const MODE_OPTS = [
  { value: 'always',  label: 'always (no check)' },
  { value: 'simple',  label: 'stat or flag check' },
  { value: 'hasItem', label: 'has item in inventory' },
  { value: 'random',  label: 'random (% chance)' },
  { value: 'js',      label: 'JS expression' },
];

// Clamp a user-entered p to [0, 1]. Anything garbage falls back to 0.25.
const _clampP = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.25;
  return Math.max(0, Math.min(1, n));
};

const NUM_OP_OPTS = [
  { value: '>=', label: '>=' },
  { value: '>',  label: '>'  },
  { value: '<=', label: '<=' },
  { value: '<',  label: '<'  },
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
];
const STR_OP_OPTS = [
  { value: '==',         label: '==' },
  { value: '!=',         label: '!=' },
  { value: 'contains',   label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'isEmpty',    label: 'is empty' },
];
const ARR_OP_OPTS = [
  { value: 'includes',  label: 'includes' },
  { value: 'excludes',  label: 'does not include' },
  { value: 'lenAtLeast',label: 'length ≥ N' },
  { value: 'isEmpty',   label: 'is empty' },
];

const _statKind = statTypes => key =>
  !key || key.startsWith('flags.') ? 'flag'
  : statTypes?.[key] === 'string' ? 'str'
  : statTypes?.[key] === 'array'  ? 'arr'
  :                                  'num';

const _opsForStatKind = k =>
  k === 'flag' ? NUM_OP_OPTS : k === 'str' ? STR_OP_OPTS : k === 'arr' ? ARR_OP_OPTS : NUM_OP_OPTS;

const ConditionEditor = ({ condition, onChange, vars = { stats: [], flags: [], items: [], statTypes: {} } }) => {
  const c = condition || { mode: 'always', key: '', op: '>=', value: 0, itemId: '', count: 1, expr: '', p: 0.25 };
  const set = patch => onChange({ ...c, ...patch });
  const p   = _clampP(c.p ?? 0.25);

  const keyOpts = [
    { value: '', label: '- pick -' },
    ...vars.stats.map(k => {
      const t = vars.statTypes?.[k] || 'number';
      const suffix = t === 'number' ? '' : ` (${t})`;
      return { value: k, label: `stat: ${k}${suffix}` };
    }),
    ...vars.flags.map(k => ({ value: `flags.${k}`, label: `flag: ${k}` })),
  ];

  const isFlag    = c.key.startsWith('flags.');
  const statKind  = _statKind(vars.statTypes)(c.key);
  const opOpts    = isFlag ? NUM_OP_OPTS : _opsForStatKind(statKind);
  // Switching stat (and therefore op group) can leave an op that doesn't
  // exist in the new group - normalise to the first available so the UI
  // never shows an empty Select.
  const safeOp    = opOpts.find(o => o.value === c.op) ? c.op : opOpts[0].value;
  const noValueOp = safeOp === 'isEmpty';

  return div({})([
    Select({ label: 'Condition', options: MODE_OPTS, value: c.mode, onChange: onText(v => set({ mode: v })) }),

    ...(c.mode === 'simple'
      ? [div({ style: 'display:grid; grid-template-columns: 1fr 130px 1fr; gap:8px; margin-top:8px' })([
          Select({ options: keyOpts, value: c.key, onChange: onText(v => set({ key: v })) }),
          Select({ options: opOpts, value: safeOp, onChange: onText(v => set({ op: v })) }),
          noValueOp
            ? div({ style: 'display:flex; align-items:center; color:var(--text-muted); font-size:12px' })(['(no value)'])
            : isFlag
              ? Select({
                  options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                  value: String(c.value),
                  onChange: onText(v => set({ value: v === 'true' })),
                })
              : statKind === 'str'
                ? TextInput({
                    value:       typeof c.value === 'string' ? c.value : '',
                    onChange:    onText(v => set({ value: v })),
                    placeholder: safeOp === 'startsWith' ? 'prefix' : 'text',
                  })
                : statKind === 'arr'
                  ? TextInput({
                      value:       typeof c.value === 'string' ? c.value : String(c.value ?? ''),
                      onChange:    onText(v => {
                        if (safeOp === 'lenAtLeast') {
                          const n = Number(v);
                          set({ value: Number.isFinite(n) ? Math.max(0, n) : 0 });
                        } else {
                          set({ value: v });
                        }
                      }),
                      placeholder: safeOp === 'lenAtLeast' ? '1' : 'one value',
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
              { value: '', label: '- pick item -' },
              ...groupedOptions(vars.items)(it => ({ value: it.id, label: `${it.name} (${it.id})` })),
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

    ...(c.mode === 'random'
      ? [div({ style: 'margin-top:8px; display:grid; grid-template-columns: 1fr 90px; gap:8px; align-items:center' })([
          input({
            type: 'range', min: 0, max: 1, step: 0.01,
            value: String(p),
            oninput: e => set({ p: _clampP(e.target.value) }),
            style: 'width:100%',
          })([]),
          TextInput({
            value:    `${Math.round(p * 100)}%`,
            onChange: onText(v => set({ p: _clampP(Number(String(v).replace('%', '').trim()) / 100) })),
          }),
        ])]
      : []),

    ...(c.mode === 'js'
      ? [div({ style: 'margin-top:8px' })([
          span({ style: 'font-size:11px; color:var(--text-muted)' })([
            'Receives ', span({ className: 'dv-mono' })(['c']), ' (the game ctx). Return truthy to enable the choice.',
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
    // Always shown - switching modes updates it immediately.
    div({ style: 'margin-top:8px; padding:6px 10px; background:var(--surface-2, rgba(0,0,0,.03)); border-left:3px solid var(--accent); border-radius:4px; font-size:11px; color:var(--text-muted)' })([
      span({ style: 'text-transform:uppercase; letter-spacing:.05em; margin-right:8px' })(['Generates']),
      span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })([
        c.mode === 'always' ? '(no if - always enabled)' : `if: c => ${condToExpr(c)}`,
      ]),
    ]),
  ]);
};

export { ConditionEditor };
