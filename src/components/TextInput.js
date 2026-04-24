import { div, input, label, p, span } from '../elements.js';

/**
 * TextInput component — a labeled text input with optional hint and error.
 *
 * @param {Object}   opts
 * @param {string}   [opts.id]           - Input id (links label).
 * @param {string}   [opts.label]        - Label text above the input.
 * @param {string}   [opts.value='']     - Current value.
 * @param {string}   [opts.placeholder]  - Placeholder text.
 * @param {string}   [opts.type='text']  - Input type (text/email/password/number…).
 * @param {boolean}  [opts.disabled]
 * @param {string}   [opts.hint]         - Helper text below the input.
 * @param {string}   [opts.error]        - Error message (also applies error styling).
 * @param {function} [opts.onInput]      - oninput handler receiving the Event.
 * @param {function} [opts.onChange]     - onchange handler receiving the Event.
 * @returns {vnode}
 *
 * @example
 *   TextInput({
 *     id: 'name',
 *     label: 'Full name',
 *     value: state.name,
 *     onInput: e => setState({ name: e.target.value }),
 *   })
 */
const TextInput = ({
  id,
  label: labelText,
  value = '',
  placeholder = '',
  type = 'text',
  disabled = false,
  hint,
  error,
  onInput,
  onChange,
  className = '',
  style = '',
} = {}) =>
  div({ className: ['field', className].filter(Boolean).join(' '), style })([
    ...(labelText ? [label({ htmlFor: id, className: 'field-label' })([labelText])] : []),
    input({
      id,
      className: ['input', error && 'input-error'].filter(Boolean).join(' '),
      type, value, placeholder, disabled,
      oninput: onInput,
      onchange: onChange,
    })([]),
    ...(error           ? [span({ className: 'field-error' })([error])] : []),
    ...(hint && !error  ? [span({ className: 'field-hint'  })([hint])  ] : []),
  ]);

export { TextInput };
