import { div, input, label } from '../elements.js';

/**
 * Checkbox component — a labelled checkbox.
 *
 * @param {Object}   opts
 * @param {string}   [opts.id]       - Input id (links label).
 * @param {boolean}  [opts.checked=false]
 * @param {boolean}  [opts.disabled=false]
 * @param {function} [opts.onChange] - onchange handler receiving the Event.
 * @returns {function} labelChildren => vnode
 *
 * @example
 *   Checkbox({
 *     id: 'accept',
 *     checked: state.accepted,
 *     onChange: e => setState({ accepted: e.target.checked }),
 *   })(['I accept the terms'])
 */
const Checkbox = ({
  id,
  checked = false,
  disabled = false,
  onChange,
  className = '',
  style = '',
} = {}) => children =>
  div({ className: ['checkbox-wrapper', className].filter(Boolean).join(' '), style })([
    input({ id, type: 'checkbox', checked, disabled, onchange: onChange })([]),
    label({ htmlFor: id })(children),
  ]);

export { Checkbox };
