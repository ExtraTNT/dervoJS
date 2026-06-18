/**
 * WeightBonusList - reusable editor for a list of weight bonuses.
 *
 * Used wherever the engine resolves an effective weight from
 * `base + Σ bonus.amount where bonus.condition`. That's currently:
 *
 *   - LootEntry.bonuses    (random loot table entries)
 *   - OneOfOption.bonuses  (oneOf Effect mode options)
 *
 * Shape (mirrors gameEditor/schema.js):
 *   WeightBonus {
 *     condition  : Condition       (any mode: always / simple / hasItem / js)
 *     amountMode : 'fixed' | 'stat'
 *     amountFixed: number          (when amountMode === 'fixed')
 *     amountStat : string          (state[key] - when amountMode === 'stat')
 *   }
 */

import { div, span } from '../../src/elements.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Stack } from '../../src/components/Layout.js';
import { onText } from '../helpers.js';
import { emptyWeightBonus } from '../schema.js';
import { ConditionEditor } from './ConditionEditor.js';

// One bonus row. Curried `bonus => onPatch => onDelete` so call sites stay flat.
const _bonusRow = vars => bonus => onPatch => onDelete => {
  // Bonus formulas multiply, so numeric stats only.
  const statOpts = [{ value: '', label: '- pick stat -' }, ...(vars.numStats || vars.stats || []).map(k => ({ value: k, label: k }))];
  return div({ style: 'border:1px solid var(--border-2); border-radius:var(--radius); padding:8px; background:var(--bg)' })([
    div({ style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' })([
      span({ style: 'font-size:11px; color:var(--text-muted)' })(['+ if']),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['x']),
    ]),
    ConditionEditor({
      condition: bonus.condition,
      vars,
      onChange:  v => onPatch({ condition: v }),
    }),
    div({ style: 'margin-top:6px; display:grid; grid-template-columns:160px 1fr; gap:8px; align-items:end' })([
      Select({
        label:   'Amount',
        options: [
          { value: 'fixed', label: 'fixed number' },
          { value: 'stat',  label: 'value of stat' },
        ],
        value:    bonus.amountMode || 'fixed',
        onChange: onText(v => onPatch({ amountMode: v })),
      }),
      bonus.amountMode === 'stat'
        ? Select({
            label:    'Stat',
            options:  statOpts,
            value:    bonus.amountStat || '',
            onChange: onText(v => onPatch({ amountStat: v })),
          })
        : NumberInput({
            label:    'Add',
            value:    Number(bonus.amountFixed) || 0,
            onChange: v => onPatch({ amountFixed: Number(v) || 0 }),
          }),
    ]),
  ]);
};

// Public component. `bonuses` is the current list, `onChange` receives the next.
const WeightBonusList = ({ bonuses, vars, onChange, label = 'Weight bonuses' }) => {
  const list = Array.isArray(bonuses) ? bonuses : [];
  const _set  = next => onChange(next);
  const _patch = i => patch => _set(list.map((b, k) => k === i ? { ...b, ...patch } : b));
  const _del   = i     => _set(list.filter((_, k) => k !== i));
  const _add   = ()    => _set([...list, emptyWeightBonus()]);
  return div({ style: 'border-top:1px dashed var(--border-2); padding-top:8px; margin-top:4px' })([
    span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:6px' })([
      `${label} (${list.length})`,
    ]),
    Stack({ gap: 6 })([
      ...list.map((b, i) => _bonusRow(vars)(b)(_patch(i))(() => _del(i))),
      Button({ size: 'sm', variant: 'ghost', onClick: _add })(['+ Add bonus']),
    ]),
  ]);
};

export { WeightBonusList };
