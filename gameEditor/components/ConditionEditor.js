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
const OBJ_OP_OPTS = [
  { value: 'hasField', label: 'has field' },
  { value: 'isEmpty',  label: 'is empty' },
];

// Look up an npc var's declaration ({ key, type, initial }) from a
// 'npcVars.<npcId>.<key>' or 'npcSelf.<key>' key string. Null when the
// npc/var/self-scope no longer exists (stale reference after a delete).
const _npcVarDecl = vars => key => {
  if (key.startsWith('npcVars.')) {
    const rest = key.slice(8);
    const dot  = rest.indexOf('.');
    if (dot < 0) return null;
    const npc = (vars.npcs || []).find(n => n.id === rest.slice(0, dot));
    return npc?.vars?.find(v => v.key === rest.slice(dot + 1)) || null;
  }
  if (key.startsWith('npcSelf.')) {
    const npc = (vars.npcs || []).find(n => n.id === vars.selfNpcId);
    return npc?.vars?.find(v => v.key === key.slice(8)) || null;
  }
  return null;
};

const _statKind = vars => key => {
  if (!key || key.startsWith('flags.')) return 'flag';
  if (key.startsWith('npcVars.') || key.startsWith('npcSelf.')) {
    const t = _npcVarDecl(vars)(key)?.type || 'number';
    return t === 'string' ? 'str' : t === 'array' ? 'arr' : t === 'object' ? 'obj' : 'num';
  }
  return vars.statTypes?.[key] === 'string' ? 'str'
    : vars.statTypes?.[key] === 'array'      ? 'arr'
    :                                          'num';
};

const _opsForStatKind = k =>
  k === 'flag' ? NUM_OP_OPTS : k === 'str' ? STR_OP_OPTS : k === 'arr' ? ARR_OP_OPTS : k === 'obj' ? OBJ_OP_OPTS : NUM_OP_OPTS;

// Commit op + value defaults when the KEY changes. Display-only
// normalisation leaves the stored condition stale (the dropdown shows an
// op the model does not hold, and re-selecting it fires no change event),
// so the runner evaluates something the author never saw.
const _rekeyCond = vars => c => key => {
  const kind  = _statKind(vars)(key);
  const group = _opsForStatKind(kind);
  const op    =
      kind === 'flag' ? (c.op === '==' || c.op === '!=' ? c.op : '==')
    : group.find(x => x.value === c.op) ? c.op : group[0].value;
  const value =
      kind === 'flag' ? (typeof c.value === 'boolean' ? c.value : true)
    : kind === 'num'  ? (Number.isFinite(Number(c.value)) ? Number(c.value) : 0)
    : typeof c.value === 'string' ? c.value : '';
  return { ...c, key, op, value };
};

// Same commit rule for MODE switches: hasItem needs one of its own ops
// (preview would evaluate '>=' as false while codegen emits true).
const _remodeCond = vars => c => mode =>
    mode === 'hasItem' ? { ...c, mode, op: ['has', 'lacks', 'atleast'].includes(c.op) ? c.op : 'has', count: Math.max(1, Number(c.count) || 1) }
  : mode === 'simple'  ? _rekeyCond(vars)({ ...c, mode })(c.key)
  : { ...c, mode };

const ConditionEditor = ({ condition, onChange, vars = { stats: [], flags: [], items: [], statTypes: {}, npcs: [] } }) => {
  const c = condition || { mode: 'always', key: '', op: '>=', value: 0, itemId: '', count: 1, expr: '', p: 0.25 };
  const set = patch => onChange({ ...c, ...patch });
  const p   = _clampP(c.p ?? 0.25);

  // "this NPC" shortcut - only offered when the caller (an NPC's own
  // choice/topic/variant editor) tells us which npc owns this Condition via
  // vars.selfNpcId. Stored as the portable npcSelf.<key> so copying a topic
  // to another NPC keeps pointing at ITS OWN vars, not the original NPC's.
  const selfNpc = vars.selfNpcId ? (vars.npcs || []).find(n => n.id === vars.selfNpcId) : null;
  const npcSelfOpts = selfNpc
    ? (selfNpc.vars || []).map(v => ({
        value: `npcSelf.${v.key}`,
        label: `npc (self): ${v.key}${v.type !== 'number' ? ` (${v.type})` : ''}`,
      }))
    : [];
  // Reach into ANY npc's vars from anywhere (rooms, items, combats, other NPCs).
  const npcGlobalOpts = (vars.npcs || []).flatMap(n =>
    (n.vars || []).map(v => ({
      value: `npcVars.${n.id}.${v.key}`,
      label: `npc: ${n.name || n.id} → ${v.key}${v.type !== 'number' ? ` (${v.type})` : ''}`,
    }))
  );

  const keyOpts = [
    { value: '', label: '- pick -' },
    ...vars.stats.map(k => {
      const t = vars.statTypes?.[k] || 'number';
      const suffix = t === 'number' ? '' : ` (${t})`;
      return { value: k, label: `stat: ${k}${suffix}` };
    }),
    ...vars.flags.map(k => ({ value: `flags.${k}`, label: `flag: ${k}` })),
    ...npcSelfOpts,
    ...npcGlobalOpts,
  ];

  const isFlag    = c.key.startsWith('flags.');
  const statKind  = _statKind(vars)(c.key);
  const opOpts    = isFlag ? NUM_OP_OPTS : _opsForStatKind(statKind);
  // Switching stat (and therefore op group) can leave an op that doesn't
  // exist in the new group - normalise to the first available so the UI
  // never shows an empty Select.
  const safeOp    = opOpts.find(o => o.value === c.op) ? c.op : opOpts[0].value;
  const noValueOp = safeOp === 'isEmpty';

  return div({})([
    Select({ label: 'Condition', options: MODE_OPTS, value: c.mode, onChange: onText(v => onChange(_remodeCond(vars)(c)(v))) }),

    ...(c.mode === 'simple'
      ? [div({ style: 'display:grid; grid-template-columns: 1fr 130px 1fr; gap:8px; margin-top:8px' })([
          Select({ options: keyOpts, value: c.key, onChange: onText(v => onChange(_rekeyCond(vars)(c)(v))) }),
          Select({ options: opOpts, value: safeOp, onChange: onText(v => set({ op: v })) }),
          noValueOp
            ? div({ style: 'display:flex; align-items:center; color:var(--text-muted); font-size:12px' })(['(no value)'])
            : isFlag
              ? Select({
                  // Honest display: non-boolean stored values read as false.
                  options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
                  value: c.value === true ? 'true' : 'false',
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
                  : statKind === 'obj'
                    ? TextInput({
                        // 'hasField' is the only op with a value; isEmpty is noValueOp.
                        value:       typeof c.value === 'string' ? c.value : '',
                        onChange:    onText(v => set({ value: v })),
                        placeholder: 'field name',
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
        c.mode === 'always' ? '(no if - always enabled)' : `if: c => ${condToExpr(c, 'c.state', vars.selfNpcId || null)}`,
      ]),
    ]),
  ]);
};

export { ConditionEditor };
