import { button } from '../elements.js';

/**
 * Button component.
 *
 * @param {Object}   opts
 * @param {function} [opts.onClick]              - Click handler.
 * @param {'primary'|'secondary'|'danger'|'success'|'ghost'} [opts.variant='primary']
 * @param {'sm'|'md'|'lg'} [opts.size='md']      - Size modifier.
 * @param {boolean}  [opts.disabled=false]
 * @param {string}   [opts.type='button']        - HTML button type attribute.
 * @param {string}   [opts.toolTip]             - Optional tooltip text (rendered as title attribute).
 * @param {string}   [opts.className]           - Additional CSS class(es) to apply.
 * @param {string}   [opts.style]               - Optional inline styles.
 * @returns {function} children => vnode
 *
 * @example
 *   Button({ onClick: () => alert('hi') })(['Click me'])
 *   Button({ variant: 'danger', size: 'sm', toolTip: 'Delete item' })(['Delete'])
 */
const Button = ({
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  style = '',
  toolTip,
} = {}) => children =>
  button({
    className: ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, className].filter(Boolean).join(' '),
    style,
    onclick: onClick,
    disabled,
    type,
    title: toolTip,
  })(children);

export { Button };
