import { span } from '../elements.js';

/**
 * Badge component — a small pill label for statuses, counts, and tags.
 *
 * @param {Object} opts
 * @param {'blue'|'green'|'red'|'yellow'|'gray'|'purple'} [opts.variant='gray']
 * @returns {function} children => vnode
 *
 * @example
 *   Badge({ variant: 'green' })(['Active'])
 *   Badge({ variant: 'red' })(['Error'])
 */
const Badge = ({ variant = 'gray', className = '', style = '' } = {}) => children =>
  span({ className: ['badge', `badge-${variant}`, className].filter(Boolean).join(' '), style })(children);

export { Badge };
