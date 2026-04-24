import { div, span } from '../elements.js';

const ICONS = {
  info:    'ℹ️',
  success: '✅',
  warning: '⚠️',
  error:   '❌',
};

/**
 * Alert component — coloured banner for feedback messages.
 *
 * @param {Object}  opts
 * @param {'info'|'success'|'warning'|'error'} [opts.variant='info']
 * @param {boolean} [opts.showIcon=true]  - Whether to prefix the message with an icon.
 * @returns {function} children => vnode
 *
 * @example
 *   Alert({ variant: 'success' })(['Changes saved successfully.'])
 *   Alert({ variant: 'error', showIcon: false })(['Something went wrong.'])
 */
const Alert = ({ variant = 'info', showIcon = true, className = '', style = '' } = {}) => children =>
  div({ className: ['alert', `alert-${variant}`, className].filter(Boolean).join(' '), style })([
    ...(showIcon ? [span({ className: 'alert-icon' })([ICONS[variant]])] : []),
    div({ className: 'alert-body' })(children),
  ]);

export { Alert };
