import { div, p, input, button, Card, TextInput } from '../../src/index.js';
import { MultiStep, Slider } from '../../src/index.js';
import { getBus } from '../../src/listeners.js';
import { validate, required, minLength, range, email } from '../../src/index.js';
import { doc } from '../components/doc.js';
import { setState } from '../store.js';

let _multistepBusRegistered = false;

export const multistepPanel = state => {
  const values = state.multistep || {};
  const idx = state.multistepIdx || 0;

  const setIdx = i => setState({ multistepIdx: i });
  const setValues = patch => setState(s => {
    const cur = s.multistep || {};
    const delta = typeof patch === 'function' ? patch(cur) : patch;
    return { multistep: { ...cur, ...delta } };
  });

  const steps = [
    {
      title: 'Intensity',
      render: ({ values, setValue }) => { !values.intensity && setValue('intensity', 50); return div({})([
        p({ style: 'margin:0 0 8px; color:var(--text-muted)' })(['Choose intensity for the operation']),
        Slider({ id: 'ms-int', label: 'Intensity', value: values.intensity ?? 50, min: 0, max: 100, onInput: e => setValue('intensity', +e.target.value) }),
      ]);},
      validate: { intensity: validate(required(), range(1, 100)) },
    },
    {
      title: 'Details',
      render: ({ values, setValue, validation, showValidation }) => div({})([
        p({ style: 'margin:0 0 8px; color:var(--text-muted)' })(['Enter details']),
        TextInput({ id: 'ms-name', label: 'Name', value: values.name ?? '', placeholder: 'Your name', error: showValidation ? (validation?.errors?.name || null) : null, onInput: e => setValue('name', e.target.value) }),
        div({ style: 'margin-top:12px' })([
          TextInput({ id: 'ms-email', label: 'Email', value: values.email ?? '', placeholder: 'you@example.com', error: showValidation ? (validation?.errors?.email || null) : null, onInput: e => setValue('email', e.target.value) }),
        ]),
      ]),
      validate: { name: validate(required(), minLength(2)), email: validate(required(), email()) },
    },
    {
      title: 'Confirm',
      render: ({ values }) => div({})([
        p({ style: 'margin:0 0 6px' })(['Review selections:']),
        p({ style: 'margin:6px 0' })([ `Intensity: ${values.intensity ?? '—'}` ]),
        p({ style: 'margin:6px 0' })([ `Name: ${values.name ?? '—'}` ]),
      ]),
    },
  ];

  // Register bus handlers once to avoid duplicate subscriptions on re-renders
  const bus = getBus('multistep-demo');
  if (bus && !_multistepBusRegistered) {
    _multistepBusRegistered = true;
    bus.on('done', data => setState({ alert: `Wizard done (bus): ${JSON.stringify(data?.values)}`, multistepDone: true }));
    bus.on('change', data => {
      setValues(data.values);
      setState(s => ({ ...(s || {}), multistepShowValidation: false, multistepValidationMsg: null, multistepErrors: {} }));
    });
    bus.on('step', data => setState(s => ({ ...(s || {}), multistepIdx: data.idx, multistepShowValidation: false, multistepValidationMsg: null, multistepErrors: {} })));
    bus.on('invalid', data => setState({ multistepValidationMsg: data.msg, multistepShowValidation: true, multistepErrors: data.errors || {} }));
  }

  if (state.multistepDone) {
    return div({})([
      Card({ title: 'Wizard complete' })([
        p({ style: 'margin:0 0 8px' })(['Wizard finished successfully.']),
        div({ style: 'white-space:pre-wrap;margin-top:8px' })([ JSON.stringify(values || {}, null, 2) ]),
        div({ style: 'margin-top:12px' })([
          button({ className: 'btn btn-primary', onclick: () => setState({ multistep: {}, multistepIdx: 0, multistepDone: false, multistepShowValidation: false, multistepValidationMsg: null }) })(['Restart'])
        ]),
      ]),
      div({ style: 'margin-top:12px' })([
        doc([`// Uses shared store keys: multistep (values) and multistepIdx (index).
MultiStep({ steps, idx: state.multistepIdx, setIdx, values: state.multistep, setValues })([])
`])
      ]),
    ]);
  }

  return div({})([
    MultiStep({
      steps,
      idx,
      setIdx,
      values,
      setValues,
      busId: 'multistep-demo',
      showValidation: !!state.multistepShowValidation,
      validationMsg: state.multistepValidationMsg || null,
      onDone: ({ values }) => { setState({ alert: `Wizard complete: ${JSON.stringify(values)}`, multistepDone: true }); }
    })([]),
    div({ style: 'margin-top:8px;color:var(--text-muted);font-size:13px' })([ 'Bus: multistep-demo active' ]),
    div({ style: 'margin-top:12px' })([
      doc([`// Uses shared store keys: multistep (values) and multistepIdx (index).
MultiStep({ steps, idx: state.multistepIdx, setIdx, values: state.multistep, setValues })([])
`])
    ]),
  ]);
};
