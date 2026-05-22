/**
 * Focusable — wraps children in a div the focus manager can find.
 *
 * Emits:
 *   <div id="focus-<id>" data-focus="<id>"
 *        data-focus-scroll="<axis>?"   (optional, makes the wrapper a scroll container)
 *        class="...">
 *
 * The wrapper paints an accent outline when `state.focus.id === id`,
 * and lets the caller mix in extra `style` / `className`.
 *
 * Curried: Focusable(opts)(children).
 *
 * @param {object} opts
 * @param {string} opts.id              focus identifier (also used as scroll target)
 * @param {object} opts.focus           state.focus, i.e. { id }
 * @param {'x'|'y'|'xy'} [opts.scroll]  enable internal scrolling on this/these axes
 * @param {string} [opts.style='']      base inline style merged with the focus style
 * @param {string} [opts.className='']  extra class names
 * @param {string} [opts.maxHeight]     convenience — sets max-height + overflow:auto when `scroll='y'`
 * @param {string} [opts.maxWidth]      convenience — sets max-width  + overflow:auto when `scroll='x'`
 */

import { div } from '../../src/index.js';

const _DEFAULT_FOCUS_STYLE = 'outline:2px solid var(--accent); outline-offset:-2px; border-radius:8px';

export const Focusable = ({
  id, focus, scroll, style = '', className = '', maxHeight, maxWidth,
  activeStyle = _DEFAULT_FOCUS_STYLE,
} = {}) => children => {
  const isFocused = focus?.id === id;

  // Auto-build the scroll style when convenience props are passed.
  const scrollStyle = scroll
    ? `${scroll.includes('y') ? 'overflow-y:auto;' : ''}${scroll.includes('x') ? 'overflow-x:auto;' : ''}`
      + `${maxHeight ? `max-height:${maxHeight};` : ''}${maxWidth ? `max-width:${maxWidth};` : ''}`
    : '';

  const props = {
    id:            `focus-${id}`,
    'data-focus':  id,
    className:     ['focusable', className].filter(Boolean).join(' '),
    style:         `${style}; ${scrollStyle} ${isFocused ? activeStyle : ''}`,
  };
  if (scroll) props['data-focus-scroll'] = scroll;

  return div(props)(children);
};
