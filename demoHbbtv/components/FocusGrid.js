/**
 * FocusGrid — CSS grid of focusable cells. Spatial nav handles the rest
 * (LEFT/RIGHT within a row, UP/DOWN between rows; escapes to outside
 * neighbours at edges).
 */

import { div } from '../../src/index.js';
import { Focusable } from './Focusable.js';

/**
 * @param {object} opts
 * @param {Array}  opts.items
 * @param {number} opts.cols
 * @param {object} opts.focus
 * @param {function} [opts.render]      — (item, focused) => vnode
 * @param {string} [opts.gap='10px']
 */
export const FocusGrid = ({ items = [], cols = 3, focus, render, gap = '10px' } = {}) =>
  div({ style: `display:grid; grid-template-columns:repeat(${cols}, minmax(0, 1fr)); gap:${gap}` })(
    items.map(it => {
      const isFocused = focus?.id === it.id;
      return Focusable({
        id:    it.id,
        focus,
        style: `padding:14px; background:${isFocused ? 'var(--surface-2)' : 'var(--surface)'}; border:1px solid var(--border); border-radius:8px; text-align:center; font-weight:600`,
      })([
        render ? render(it, isFocused) : it.label,
      ]);
    })
  );
