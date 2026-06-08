import { div, label as labelEl, optgroup, option, select, span } from '../elements.js';

/**
 * Select component — a styled dropdown.
 *
 * Options accept two shapes, freely mixed in the same array:
 *   - Leaf:    { value, label }                  → <option>
 *   - Group:   { group: 'Header', options: [..] } → <optgroup label="Header">…</optgroup>
 *
 * Groups can only nest leaves (HTML doesn't allow nested optgroups).
 *
 * @param {Object}    opts
 * @param {string}    [opts.id]
 * @param {string}    [opts.label]                    - Label text above the select.
 * @param {Array}     opts.options                    - Array of leaves and/or groups (see above).
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
 *
 * @example  // grouped
 *   Select({
 *     label: 'Room',
 *     options: [
 *       { value: '', label: '— pick —' },
 *       { group: 'town', options: [{ value: 'inn', label: 'Inn' }] },
 *       { group: 'wilds', options: [{ value: 'cave', label: 'Cave' }] },
 *     ],
 *     value: state.roomId,
 *     onChange: e => setState({ roomId: e.target.value }),
 *   })
 */
const _leaf = value => opt =>
  option({ value: opt.value, selected: opt.value === value })([opt.label]);

const _renderOpt = value => opt =>
  opt && Array.isArray(opt.options)
    ? optgroup({ label: opt.group || '' })(opt.options.map(_leaf(value)))
    : _leaf(value)(opt);

const Select = ({
  id,
  label: labelText,
  options = [],
  value,
  disabled = false,
  placeholder,
  hint,
  error,
  onChange,
  className = '',
  style = '',
} = {}) =>
  div({ className: ['field', className].filter(Boolean).join(' '), style })([
    ...(labelText ? [labelEl({ htmlFor: id, className: 'field-label' })([labelText])] : []),
    select({ id, className: ['select', error && 'input-error'].filter(Boolean).join(' '), disabled, onchange: onChange })([
      ...(placeholder
        ? [option({ value: '', disabled: true, selected: !value })([placeholder])]
        : []),
      ...options.map(_renderOpt(value)),
    ]),
    ...(error          ? [span({ className: 'field-error' })([error])] : []),
    ...(hint && !error ? [span({ className: 'field-hint'  })([hint])]  : []),
  ]);

export { Select };
