import { div, span } from '../elements.js';

/**
 * Toggle — an on/off switch (alternatives to a checkbox for boolean settings).
 *
 * Curried: Toggle(opts)(labelChildren)
 * Pass no children for a label-less toggle.
 *
 * @param {Object}   opts
 * @param {boolean}  [opts.on=false]        Current on/off state.
 * @param {function} [opts.onChange]        Called with the new boolean value on click.
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.className='']    Extra class on the wrapper.
 * @param {string}   [opts.style='']        Extra inline style on the wrapper.
 * @returns {function} labelChildren => vnode
 *
 * @example
 *   Toggle({
 *     on: state.darkMode,
 *     onChange: v => setState({ darkMode: v }),
 *   })(['Dark mode'])
 *
 * @example
 *   // Label-less (icon-only)
 *   Toggle({ on: state.active, onChange: v => setState({ active: v }) })([])
 */
const Toggle = ({
  on = false,
  onChange,
  disabled = false,
  className = '',
  style = '',
} = {}) => children =>
  div({
    className: ['toggle-wrapper', disabled && 'toggle-disabled', className].filter(Boolean).join(' '),
    style,
    onclick: disabled ? undefined : () => onChange?.(!on),
    role: 'switch',
    'aria-checked': String(on),
    tabIndex: disabled ? -1 : 0,
    onkeydown: disabled ? undefined : e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange?.(!on); } },
  })([
    div({ className: ['toggle-track', on && 'toggle-on'].filter(Boolean).join(' ') })([
      span({ className: 'toggle-thumb' })([]),
    ]),
    ...(children && children.length ? [span({ className: 'toggle-label' })(children)] : []),
  ]);

export { Toggle };
