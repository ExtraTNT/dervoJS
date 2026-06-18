/**
 * Character Creation panel: pre-game wizard config.
 *
 * Step types:
 *   pointBuy: distribute budget across numeric stats. Each row has
 *     { statKey, min, max, start }. Final values land on state.<key>.
 *   choice:   pick one option. Option carries effect (any mode), optional
 *     startRoom override, image, description. Last chosen startRoom wins.
 *
 * Runtime state lives at state._cc; see preview.js / codegen.js for the
 * shape and the engine routing.
 */

import { div, span, h2, h3, p, button } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Badge } from '../../src/components/Badge.js';
import { textarea } from '../../src/elements.js';
import { setProject } from '../store.js';
import { onText, updateAt, removeAt, swapAt, appendTo, projectVars } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';
import { EffectEditor } from '../components/EffectEditor.js';
import { groupedOptions } from '../components/FolderedList.js';
import { emptyCharCreationStep, emptyCharCreationOption } from '../schema.js';

// Store wiring. Mutators return () => void so they drop into onClick.

const _patchCC = patch => setProject(p => ({
  ...p,
  charCreation: { ...(p.charCreation || { enabled: false, steps: [] }), ...patch },
}));

const _withSteps = fn => setProject(p => ({
  ...p,
  charCreation: { ...p.charCreation, steps: fn(p.charCreation.steps) },
}));

const _setStep   = i    => patch => _withSteps(updateAt(i)(patch));
const _addStep   = type => ()    => _withSteps(appendTo(emptyCharCreationStep(type)));
const _delStep   = i    => ()    => _withSteps(removeAt(i));
const _moveStep  = i    => dir   => () => _withSteps(swapAt(i)(dir));

const _vars = projectVars;

// Patch / remove the j-th row of the i-th step's nested list. Both row
// editors below tail-call into these so the list math stays in one place.
const _patchStepList = key => i => idx => next =>
  _setStep(i)(step => ({ ...step, [key]: updateAt(idx)(next)(step[key] || []) }));
const _removeFromStepList = key => i => idx => () =>
  _setStep(i)(step => ({ ...step, [key]: removeAt(idx)(step[key] || []) }));

const _pointBuyPatch  = _patchStepList('stats');
const _pointBuyRemove = _removeFromStepList('stats');

/** Point-buy row editor. Curried i => stats => row => idx => vnode. */
const _pointBuyStatRow = i => stats => row => idx => {
  const patch  = _pointBuyPatch (i)(idx);
  const remove = _pointBuyRemove(i)(idx);
  const numStatOpts = [
    { value: '', label: '- pick stat -' },
    ...stats.map(s => ({ value: s.key, label: s.key })),
  ];
  const numField = label => key => NumberInput({
    label:    idx === 0 ? label : '',
    value:    Number(row[key]) || 0,
    onChange: v => patch({ [key]: Number(v) || 0 }),
  });
  return Grid({ cols: 5, gap: 8 })([
    Select({
      label:    idx === 0 ? 'Stat' : '',
      options:  numStatOpts,
      value:    row.statKey,
      onChange: onText(v => patch({ statKey: v })),
    }),
    numField('Min')  ('min'),
    numField('Max')  ('max'),
    numField('Start')('start'),
    div({ className: 'gef-row-end' })([
      Button({ size: 'sm', variant: 'ghost', onClick: remove })(['Remove']),
    ]),
  ]);
};

const PointBuyEditor = ({ step, idx, project }) => {
  const numStats = project.stats.filter(s => s.key && (s.type || 'number') === 'number');
  return Stack({ gap: 10 })([
    p({ className: 'gef-hint gef-hint-13' })([
      'Distribute ', span({ className: 'dv-mono' })([`${step.budget}`]),
      ' points across the listed numeric stats. Each stat starts at ', span({ className: 'dv-mono' })(['start']),
      ' and the player can spend the remaining budget within ',
      span({ className: 'dv-mono' })(['[min, max]']),
      '. Final stat values land on ', span({ className: 'dv-mono' })(['state.<key>']),
      ' before the next step runs.',
    ]),
    Grid({ cols: 2, gap: 8 })([
      TextInput({
        label:    'Title (heading shown to the player)',
        value:    step.title,
        onChange: onText(v => _setStep(idx)({ title: v })),
      }),
      NumberInput({
        label:    'Budget (total points to spend)',
        value:    Number(step.budget) || 0,
        min:      0,
        onChange: v => _setStep(idx)({ budget: Math.max(0, Number(v) || 0) }),
      }),
    ]),
    TextInput({
      label:    'Prompt (subhead)',
      value:    step.prompt,
      onChange: onText(v => _setStep(idx)({ prompt: v })),
    }),
    ...(numStats.length === 0
      ? [div({ style: 'padding:10px; border:1px dashed var(--border); border-radius:var(--radius); color:var(--text-muted); font-size:12.5px' })([
          'No numeric stats yet - add some in Project → Stats first.',
        ])]
      : []),
    ...(step.stats || []).map((r, k) => _pointBuyStatRow(idx)(numStats)(r)(k)),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => _setStep(idx)(s => ({
        ...s,
        stats: appendTo({ statKey: numStats[0]?.key || '', min: 0, max: 10, start: 0 })(s.stats || []),
      })),
    })(['+ Add stat']),
  ]);
};

const _optionPatch  = _patchStepList('options');
const _optionRemove = _removeFromStepList('options');
const _optionMove   = stepIdx => optIdx => dir => () =>
  _setStep(stepIdx)(step => ({ ...step, options: swapAt(optIdx)(dir)(step.options || []) }));

const _optionCard = stepIdx => project => option => optIdx => {
  const patch    = _optionPatch (stepIdx)(optIdx);
  const remove   = _optionRemove(stepIdx)(optIdx);
  const moveUp   = _optionMove  (stepIdx)(optIdx)(-1);
  const moveDown = _optionMove  (stepIdx)(optIdx)(+1);
  const roomOpts = [
    { value: '', label: '- (use meta.start) -' },
    ...groupedOptions(project.rooms.filter(r => r.kind !== 'story'))(r => ({
      value: r.id, label: `${r.title || r.id}`,
    })),
  ];
  return div({ className: 'gef-surface-card' })([
    Stack({ gap: 8 })([
      div({ style: 'display:flex; align-items:center; gap:6px' })([
        Badge({ variant: 'blue' })([`Option ${optIdx + 1}`]),
        div({ style: 'flex:1' })([]),
        Button({ size: 'sm', variant: 'ghost', onClick: moveUp,   disabled: optIdx === 0 })(['↑']),
        Button({ size: 'sm', variant: 'ghost', onClick: moveDown })(['↓']),
        Button({ size: 'sm', variant: 'ghost', onClick: remove })(['Remove']),
      ]),
      Grid({ cols: 2, gap: 8 })([
        TextInput({
          label:    'Label',
          value:    option.label,
          onChange: onText(v => patch({ label: v })),
        }),
        Select({
          label:    'Override starting room (optional)',
          options:  roomOpts,
          value:    option.startRoom || '',
          onChange: onText(v => patch({ startRoom: v })),
        }),
      ]),
      TextInput({
        label:    'Description (shown under the label)',
        value:    option.description,
        onChange: onText(v => patch({ description: v })),
      }),
      AssetInput({
        label:    'Card image (optional)',
        value:    option.image,
        onChange: v => patch({ image: v }),
        accept:   'image',
      }),
      div({})([
        span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:4px' })([
          'When this option is picked, fire',
        ]),
        EffectEditor({
          effect:   option.effect,
          vars:     _vars(project),
          label:    '',
          rowKey:   `cc:${stepIdx}:${optIdx}`,
          onChange: v => patch({ effect: v }),
        }),
      ]),
    ]),
  ]);
};

const ChoiceEditor = ({ step, idx, project }) =>
  Stack({ gap: 10 })([
    p({ className: 'gef-hint gef-hint-13' })([
      'Player picks one option. Effect runs on selection; ',
      span({ className: 'dv-mono' })(['startRoom']),
      ' optionally overrides ', span({ className: 'dv-mono' })(['meta.start']),
      ' (the LAST step\'s pick with a non-empty startRoom wins).',
    ]),
    Grid({ cols: 2, gap: 8 })([
      TextInput({
        label:    'Title',
        value:    step.title,
        onChange: onText(v => _setStep(idx)({ title: v })),
      }),
      TextInput({
        label:    'Prompt',
        value:    step.prompt,
        onChange: onText(v => _setStep(idx)({ prompt: v })),
      }),
    ]),
    ...(step.options || []).map((o, k) => _optionCard(idx)(project)(o)(k)),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => _setStep(idx)(s => ({ ...s, options: appendTo(emptyCharCreationOption())(s.options || []) })),
    })(['+ Add option']),
  ]);

/** Curried project => total => (step, idx) => vnode. */
const StepCard = project => total => (step, idx) =>
  Card({
    title: `${idx + 1}. ${step.type === 'pointBuy' ? '⚖ Point-buy' : '☷ Choice'}${step.title ? ' - ' + step.title : ''}`,
  })([
    Stack({ gap: 10 })([
      div({ style: 'display:flex; align-items:center; gap:6px' })([
        Badge({ variant: 'blue' })([step.type]),
        Badge({ variant: 'gray' })([`#${step.id.slice(-5)}`]),
        div({ style: 'flex:1' })([]),
        Button({ size: 'sm', variant: 'ghost', onClick: _moveStep(idx)(-1), disabled: idx === 0          })(['↑']),
        Button({ size: 'sm', variant: 'ghost', onClick: _moveStep(idx)(+1), disabled: idx === total - 1 })(['↓']),
        Button({ size: 'sm', variant: 'ghost', onClick: _delStep(idx) })(['Delete step']),
      ]),
      ...(step.type === 'pointBuy'
        ? [PointBuyEditor({ step, idx, project })]
        : [ChoiceEditor  ({ step, idx, project })]),
    ]),
  ]);

const CharCreationPanel = state => {
  const { project } = state;
  const cc = project.charCreation || { enabled: false, steps: [] };
  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Character creation']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Optional wizard that runs BEFORE the player sees ',
      span({ className: 'dv-mono' })(['meta.start']),
      '. Add point-buy and choice steps; the engine renders them in order and seeds state from the result. The wizard is skipped entirely when disabled or when no steps are defined.',
    ]),

    Card({ title: 'Visibility' })([
      div({ style: 'display:flex; align-items:center; gap:10px' })([
        Toggle({
          on:       !!cc.enabled,
          onChange: v => _patchCC({ enabled: !!v }),
        })([span({ style: 'font-size:13px' })(['Show character creation at game start'])]),
      ]),
    ]),

    Card({ title: 'Add step' })([
      div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
        Button({ size: 'sm', variant: 'ghost', onClick: _addStep('pointBuy') })(['+ Point-buy step']),
        Button({ size: 'sm', variant: 'ghost', onClick: _addStep('choice') })(['+ Choice step']),
      ]),
    ]),

    ...(cc.steps.length === 0
      ? [div({ className: 'gef-empty' })(['No steps yet. Add one above to start the wizard.'])]
      : cc.steps.map(StepCard(project)(cc.steps.length))),
  ]);
};

export { CharCreationPanel };
