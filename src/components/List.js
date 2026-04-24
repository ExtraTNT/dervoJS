import { li, p, ul } from '../elements.js';

/**
 * List component — renders an array of items applying a render function to each.
 *
 * @param {Object}   opts
 * @param {Array}    [opts.items=[]]       - Data array.
 * @param {function} opts.renderItem       - (item, index) => vnode — renders one item.
 * @param {vnode}    [opts.empty]          - Vnode to show when items is empty.
 * @returns {vnode}
 *
 * @example
 *   List({
 *     items: ['Alice', 'Bob', 'Carol'],
 *     renderItem: (name, i) => li({ className: 'list-item' })([`${i + 1}. ${name}`]),
 *   })
 */
const List = ({
  items = [],
  renderItem,
  empty = p({})(['No items.']),
  className = '',
  style = '',
} = {}) =>
  items.length > 0
    ? ul({ className: ['list', className].filter(Boolean).join(' '), style })(items.map((item, i) => renderItem(item, i)))
    : empty;

export { List };
