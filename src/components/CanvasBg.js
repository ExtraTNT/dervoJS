/**
 * CanvasBg — mount any canvas-based effect as a CSS background for arbitrary content.
 *
 * Pure vnode component (no side effects).  The caller is responsible for starting
 * the canvas effect after the DOM renders, exactly like the GlitchImg pattern:
 *
 *   // 1. Declare the layout:
 *   CanvasBg({ id: 'bg1', height: '320px' })([
 *     div({ className: 'cvs-bg-content' })([ h2({})(['Hello']) ])
 *   ])
 *
 *   // 2. After the vnode renders, mount the effect into the canvas element:
 *   const fx = GlitchImg({ src: '/photo.jpg' })(document.getElementById('bg1'));
 *
 *   // 3. On unmount:
 *   fx.stop();
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 *
 *   .cvs-bg            wrapper — position:relative; overflow:hidden; height from prop
 *     <canvas>         absolute; top:50% left:50% translate(-50%,-50%)
 *                      min-width:100% min-height:100% — "object-fit:cover" behaviour
 *     .cvs-bg-content  position:relative; z-index:1  — children live here
 *
 * ── API ──────────────────────────────────────────────────────────────────────
 *   CanvasBg(opts)(children) → vnode
 *
 *   opts.id          {string}   id placed on the <canvas> element so the effect can target it
 *   opts.height      {string}   CSS height of the wrapper.         Default '240px'
 *   opts.className   {string}   Extra class added to the wrapper.  Default ''
 *   opts.style       {string}   Extra inline style on the wrapper. Default ''
 */

import { div, canvas } from '../elements.js';

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CanvasBg :: opts → children → vnode
 */
export const CanvasBg = ({
  id        = '',
  height    = '100%',
  width     = '100%',
  className = '',
  style     = '',
} = {}) => children =>
  div({
    className: ['cvs-bg', className].filter(Boolean).join(' '),
    style: `height:${height};width:${width};${style ? ' ' + style : ''}`,
  })([
    canvas({
      ...(id && { id }),
      className: 'cvs-bg-canvas glitch-canvas',
    })([]),
    div({ className: 'cvs-bg-content' })(
      Array.isArray(children) ? children : [children]
    ),
  ]);
