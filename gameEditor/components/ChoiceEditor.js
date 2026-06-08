/**
 * ChoiceEditor — one choice row.
 *
 * Two modes, picked by the caller via the `topicCtx` prop:
 *
 *   topicCtx: false (default)
 *     Simple/legacy use — rooms and non-advanced NPCs. The Choice is
 *     { label, to, condition, action }: navigate to `to` (or stay if to:'')
 *     after the action fires. No flow selector.
 *
 *   topicCtx: true
 *     Inside an advanced NPC topic. The Choice gets a clear 4-option Flow
 *     selector that decides what happens after the action:
 *       change      — push current topic on the stack, switch to `topicId`
 *       exitBack    — pop the topic stack (returns to the previous topic, or
 *                     to the calling room if the stack is empty)
 *       exitRoom    — leave the NPC entirely, goto `to` (or back if to:'')
 *       exitCombat  — leave the NPC, start combat `combatId`
 *     The picker for the relevant id (room / topic / combat) appears beneath
 *     the Flow select; the others are hidden.
 */

import { div, span } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { ConditionEditor } from './ConditionEditor.js';
import { EffectEditor }    from './EffectEditor.js';
import { onText } from '../helpers.js';

const FLOW_OPTS = [
  { value: 'stay',       label: 'stay — fire effect, no navigation (give item, NPC line, …)' },
  { value: 'change',     label: 'change topic — push & switch to another topic' },
  { value: 'exitBack',   label: 'exit · back to previous topic (or caller)' },
  { value: 'exitRoom',   label: 'exit · to a room' },
  { value: 'exitCombat', label: 'exit · enter combat' },
];

const ChoiceEditor = ({
  choice, vars, roomOpts,
  onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
  topicCtx  = false,
  topicOpts = [],
  combatOpts = [],
}) => {
  const set  = patch => onChange({ ...choice, ...patch });
  // Default flow in advanced topic context is exitBack (most common: "Goodbye");
  // outside advanced context the field is ignored and `to` drives behaviour.
  const flow = topicCtx ? (choice.flow && choice.flow !== 'navigate' ? choice.flow : 'exitBack') : 'navigate';

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
      // Simple mode: room "Goes to" picker. Advanced topic mode: Flow selector.
      ...(topicCtx
        ? [Select({
            label:    'Flow',
            options:  FLOW_OPTS,
            value:    flow,
            onChange: onText(v => set({ flow: v })),
          })]
        : [Select({
            label:    'Goes to',
            options:  [{ value: '', label: '— stay in place —' }, ...roomOpts],
            value:    choice.to,
            onChange: onText(v => set({ to: v })),
          })]),
    ]),

    // Per-flow extras, only in topic context.
    ...(topicCtx && flow === 'change'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label:    'Change to topic',
            options:  [{ value: '', label: '— pick a topic —' }, ...topicOpts],
            value:    choice.topicId,
            onChange: onText(v => set({ topicId: v })),
          }),
        ])]
      : []),
    ...(topicCtx && flow === 'exitRoom'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label:    'Exit to room',
            options:  [{ value: '', label: '— return to caller —' }, ...roomOpts],
            value:    choice.to,
            onChange: onText(v => set({ to: v })),
          }),
        ])]
      : []),
    ...(topicCtx && flow === 'exitCombat'
      ? [div({ style: 'margin-top:8px' })([
          Select({
            label:    'Start combat',
            options:  [{ value: '', label: '— pick a combat —' }, ...combatOpts],
            value:    choice.combatId,
            onChange: onText(v => set({ combatId: v })),
          }),
        ])]
      : []),

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
        rowKey:   `choice:${choice.id}`,
        onChange: v => set({ action: v }),
      }),
    ]),
  ]);
};

export { ChoiceEditor };
