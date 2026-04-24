import { div, input, label, button, span } from '../elements.js';

/**
 * NumberInput — labeled numeric field with decrement / increment stepper buttons.
 *
 * @param {Object}   opts
 * @param {string}   [opts.id]
 * @param {string}   [opts.label]           Label text above the control.
 * @param {number}   [opts.value=0]
 * @param {number}   [opts.min=-Infinity]
 * @param {number}   [opts.max=Infinity]
 * @param {number}   [opts.step=1]
 * @param {boolean}  [opts.disabled=false]
 * @param {function} [opts.onChange]        Called with the new number value.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   NumberInput({
 *     label: 'Quantity',
 *     value: state.qty,
 *     min: 0, max: 99, step: 1,
 *     onChange: v => setState({ qty: v }),
 *   })
 */
const NumberInput = ({
  id,
  label: labelText,
  value = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled = false,
  onChange,
  className = '',
  style = '',
} = {}) => {
  const clamp = v => Math.min(max, Math.max(min, v));
  const decrement = () => onChange && onChange(clamp(value - step));
  const increment = () => onChange && onChange(clamp(value + step));
  const onRawInput = e => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && onChange) onChange(clamp(v));
  };

  return div({ className: ['number-input-wrap', className].filter(Boolean).join(' '), style })([
    ...(labelText ? [label({ htmlFor: id, className: 'field-label' })([labelText])] : []),
    div({ className: 'number-input' })([
      button({
        type: 'button',
        className: 'number-input-btn',
        disabled: disabled || value <= min,
        onclick: decrement,
        'aria-label': 'Decrement',
      })(['−']),
      input({
        id,
        type: 'number',
        className: 'number-input-field',
        value: String(value),
        min: isFinite(min) ? String(min) : undefined,
        max: isFinite(max) ? String(max) : undefined,
        step: String(step),
        disabled,
        oninput: onRawInput,
      })([]),
      button({
        type: 'button',
        className: 'number-input-btn',
        disabled: disabled || value >= max,
        onclick: increment,
        'aria-label': 'Increment',
      })(['+']),
    ]),
  ]);
};

export { NumberInput };
