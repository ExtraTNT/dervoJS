import { div, h3 } from '../elements.js';

/**
 * Card component — bordered surface with optional header and footer.
 *
 * @param {Object}  opts
 * @param {string}  [opts.title]         - Optional title rendered in the card header.
 * @param {vnode[]} [opts.footer]        - Optional footer content (array of vnodes).
 * @returns {function} bodyChildren => vnode
 *
 * @example
 *   Card({ title: 'Hello' })([
 *     p({})(['Card body content']),
 *   ])
 */
const Card = ({ title, footer, className = '', style = '' } = {}) => children =>
  div({ className: ['card', className].filter(Boolean).join(' '), style })([
    ...(title  ? [div({ className: 'card-header' })([h3({ className: 'card-title' })([title])])] : []),
    div({ className: 'card-body' })(children),
    ...(footer ? [div({ className: 'card-footer' })(footer)] : []),
  ]);

export { Card };
