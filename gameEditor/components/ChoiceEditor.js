/**
 * ChoiceEditor — a single choice row. The room/npc context decides what targets
 * are reachable (`roomOpts`); the vars (`stats`, `flags`) drive the condition/effect
 * editors.
 *
 * Choice = { label, to, condition, action }
 *   - label: button text shown to the player
 *   - to: target room id (or '' for "no navigation" — the action still fires)
 *   - condition: shown? predicate (see ConditionEditor)
 *   - action: state mutation that runs before navigation (see EffectEditor)
 */

import { div, span } from '../../src/index.js';
import { TextInput, Select, Button } from '../../src/index.js';
import { ConditionEditor } from './ConditionEditor.js';
import { EffectEditor }    from './EffectEditor.js';
import { onText } from '../helpers.js';

const ChoiceEditor = ({ choice, vars, roomOpts, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const set = patch => onChange({ ...choice, ...patch });
  return div({ className: 'gef-choice' })([
    div({ className: 'gef-choice-head' })([
      span({})(['Choice']),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${choice.id.slice(0, 5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveUp,   disabled: isFirst })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveDown, disabled: isLast  })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['Delete']),
    ]),

    div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:8px' })([
      TextInput({
        label:       'Label',
        value:       choice.label,
        onChange:    onText(v => set({ label: v })),
        placeholder: 'Go north',
      }),
      Select({
        label:    'Goes to',
        options:  [{ value: '', label: '— stay in place —' }, ...roomOpts],
        value:    choice.to,
        onChange: onText(v => set({ to: v })),
      }),
    ]),

    div({ style: 'margin-top:10px' })([
      ConditionEditor({
        condition: choice.condition,
        vars,
        onChange:  v => set({ condition: v }),
      }),
    ]),

    div({ style: 'margin-top:10px' })([
      EffectEditor({
        effect:   choice.action,
        vars,
        label:    'Action when clicked',
        onChange: v => set({ action: v }),
      }),
    ]),
  ]);
};

export { ChoiceEditor };
