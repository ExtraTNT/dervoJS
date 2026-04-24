import { div, label as labelEl, option, select, span } from '../elements.js';

/**
 * Select component — a styled dropdown.
 *
 * @param {Object}    opts
 * @param {string}    [opts.id]
 * @param {string}    [opts.label]                    - Label text above the select.
 * @param {Array}     opts.options                    - Array of { value, label } objects.
 * @param {string}    [opts.value]                    - Currently selected value.
 * @param {boolean}   [opts.disabled=false]
 * @param {string}    [opts.placeholder]              - Blank first option text.
 * @param {function}  [opts.onChange]                 - onchange handler receiving Event.
 * @returns {vnode}
 *
 * @example
 *   Select({
 *     id: 'color',
 *     label: 'Favorite color',
 *     options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }],
 *     value: state.color,
 *     onChange: e => setState({ color: e.target.value }),
 *   })
 */
const Select = ({
  id,
  label: labelText,
  options = [],
  value,
  disabled = false,
  placeholder,
  onChange,
  className = '',
  style = '',
} = {}) =>
  div({ className: ['field', className].filter(Boolean).join(' '), style })([
    ...(labelText ? [labelEl({ htmlFor: id, className: 'field-label' })([labelText])] : []),
    select({ id, className: 'select', disabled, onchange: onChange })([
      ...(placeholder
        ? [option({ value: '', disabled: true, selected: !value })([placeholder])]
        : []),
      ...options.map(opt =>
        option({ value: opt.value, selected: opt.value === value })([opt.label])
      ),
    ]),
  ]);

export { Select };
