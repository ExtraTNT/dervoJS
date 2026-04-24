import { div, Card, TextInput, Select, Checkbox, Button } from '../../src/index.js';
import { setState, getState, submitForm } from '../store.js';

export const inputsPanel = state =>
  div({})([
    Card({ title: 'Validated form' })([
      TextInput({
        id: 'demoName',
        label: 'Full name',
        value: state.name,
        placeholder: 'Jane Doe',
        hint: 'First and last name.',
        error: state.errors.name,
        onInput: e => setState({ name: e.target.value, errors: { ...getState().errors, name: null } }),
      }),

      div({ style: 'margin-top:12px' })([
        TextInput({
          id: 'demoEmail',
          label: 'Email',
          type: 'email',
          value: state.email,
          placeholder: 'jane@example.com',
          hint: 'Validated with [pred, msg] tuple style.',
          error: state.errors.email,
          onInput: e => setState({ email: e.target.value, errors: { ...getState().errors, email: null } }),
        }),
      ]),

      div({ style: 'margin-top:12px' })([
        TextInput({
          id: 'demoAge',
          label: 'Age',
          type: 'number',
          value: state.age,
          placeholder: '25',
          error: state.errors.age,
          hint: 'Validated with [pred, msg] tuples (1–120).',
          onInput: e => setState({ age: e.target.value, errors: { ...getState().errors, age: null } }),
        }),
      ]),

      div({ style: 'margin-top:16px; display:flex; gap:10px' })([
        Button({ onClick: submitForm })(['Submit']),
        Button({ variant: 'secondary',
          onClick: () => setState({
            name: '', email: '', age: '',
            errors: { name: null, email: null, age: null },
            submitted: false,
          }),
        })(['Clear']),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Select & Checkbox' })([
        Select({
          id: 'colorPick',
          label: 'Favorite color',
          placeholder: 'Choose one…',
          options: [
            { value: 'red',    label: 'Red' },
            { value: 'green',  label: 'Green' },
            { value: 'blue',   label: 'Blue' },
            { value: 'yellow', label: 'Yellow' },
          ],
          value: state.color,
          onChange: e => setState({ color: e.target.value }),
        }),

        div({ style: 'margin-top:12px' })([
          Checkbox({
            id: 'agreeCheck',
            checked: state.agreed,
            onChange: e => setState({ agreed: e.target.checked }),
          })(['I agree to the terms and conditions']),
        ]),

        div({ style: 'margin-top:12px; font-size:13px; color:var(--text-muted)' })([
          state.color ? `Picked: ${state.color}` : 'No color picked',
          ' · ',
          state.agreed ? 'Agreed ✓' : 'Not agreed',
        ]),
      ]),
    ]),
  ]);
