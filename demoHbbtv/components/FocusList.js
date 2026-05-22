/**
 * FocusList — a vertical stack of focusable items. Items navigate via
 * spatial nav (UP/DOWN moves to the row above/below; LEFT/RIGHT escape to
 * neighbours outside the list). No internal scroll wrapper here — the
 * caller controls the outer scrolling using a Focusable with scroll='y'
 * when desired (see ListPage.js).
 */

import { div } from '../../src/index.js';
import { Focusable } from './Focusable.js';

/**
 * @param {object} opts
 * @param {Array}  opts.items       — [{ id, label, ... }]
 * @param {object} opts.focus       — state.focus = { id }
 * @param {function} [opts.render]  — (item, focused) => vnode
 */
export const FocusList = ({ items = [], focus, render } = {}) =>
  div({ style: 'display:flex; flex-direction:column; gap:6px' })(
    items.map(it => {
      const isFocused = focus?.id === it.id;
      return Focusable({
        id:    it.id,
        focus,
        style: `padding:10px 14px; background:${isFocused ? 'var(--surface-2)' : 'var(--surface)'}; border:1px solid var(--border); border-radius:6px`,
      })([
        render ? render(it, isFocused) : it.label,
      ]);
    })
  );
