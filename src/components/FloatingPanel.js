import { div, span, button } from '../elements.js';

// ── Per-panel position/size state ─────────────────────────────────────────
// Keyed by panel id so multiple independent panels can coexist.
const _panels = new Map();

const getPs = id => defaults => {
  if (!_panels.has(id)) _panels.set(id, { ...defaults });
  return _panels.get(id);
};

// ── Active drag/resize handles ────────────────────────────────────────────
// We attach document-level mousemove/mouseup listeners and manipulate the
// DOM element directly for smooth 60fps movement, then save back to _panels.

let _drag = null;   // { id, el, ox, oy }
let _rsz  = null;   // { id, el, ox, oy, w0, h0 }

const onDragMove = e => {
  if (!_drag) return;
  const ps = _panels.get(_drag.id);
  ps.x = e.clientX - _drag.ox;
  ps.y = e.clientY - _drag.oy;
  _drag.el.style.left = ps.x + 'px';
  _drag.el.style.top  = ps.y + 'px';
};
const onDragUp = () => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragUp);
  _drag = null;
};

const onRszMove = e => {
  if (!_rsz) return;
  const ps = _panels.get(_rsz.id);
  ps.w = Math.max(280, _rsz.w0 + e.clientX - _rsz.ox);
  ps.h = Math.max(180, _rsz.h0 + e.clientY - _rsz.oy);
  _rsz.el.style.width  = ps.w + 'px';
  _rsz.el.style.height = ps.h + 'px';
};
const onRszUp = () => {
  document.removeEventListener('mousemove', onRszMove);
  document.removeEventListener('mouseup',   onRszUp);
  _rsz = null;
};

// ── Component ─────────────────────────────────────────────────────────────

/**
 * FloatingPanel — draggable, resizable floating window.
 *
 * Usage (curried — matches the rest of dervoJS):
 *   FloatingPanel({ id, title, open, onClose, initialX, initialY, initialW, initialH })(children)
 *
 * - Drag: grab the title bar
 * - Resize: drag the ⤡ handle in the bottom-right corner
 * - Position/size are stored in module-level state keyed by `id` so they
 *   survive re-renders without touching the app store.
 *
 * @param {string}   opts.id          Unique identifier (used for DOM id and state key).
 * @param {string}   opts.title       Window title.
 * @param {boolean}  opts.open        Whether the panel is visible.
 * @param {function} opts.onClose     Called when the close button is clicked.
 * @param {number}   [opts.initialX=24]
 * @param {number}   [opts.initialY=24]
 * @param {number}   [opts.initialW=460]
 * @param {number}   [opts.initialH=520]
 */
const FloatingPanel = ({
  id       = 'fp',
  title    = '',
  open     = false,
  onClose  = () => {},
  initialX = 24,
  initialY = 24,
  initialW = 460,
  initialH = 520,
}) => children => {
  const ps = getPs(id)({ x: initialX, y: initialY, w: initialW, h: initialH });

  return div({
    id:        `_fp_${id}`,
    className: 'fp-panel',
    style: [
      `display:${open ? 'flex' : 'none'}`,
      `left:${ps.x}px`,
      `top:${ps.y}px`,
      `width:${ps.w}px`,
      `height:${ps.h}px`,
    ].join(';'),
  })([
    // ── title bar (drag handle) ──────────────────────────────────────────
    div({
      className:   'fp-titlebar',
      onmousedown: e => {
        if (e.button !== 0) return;
        const el = document.getElementById(`_fp_${id}`);
        if (!el) return;
        _drag = { id, el, ox: e.clientX - ps.x, oy: e.clientY - ps.y };
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup',   onDragUp);
        e.preventDefault();
      },
    })([
      span({ className: 'fp-title' })([title]),
      div({ className: 'fp-titlebar-actions' })([
        button({
          className: 'fp-close',
          type:      'button',
          title:     'Close',
          onclick:   e => { e.stopPropagation(); onClose(); },
        })(['✕']),
      ]),
    ]),

    // ── content area ────────────────────────────────────────────────────
    div({ className: 'fp-content' })([...children]),

    // ── resize handle (bottom-right corner) ─────────────────────────────
    div({
      className:   'fp-resize-handle',
      title:       'Drag to resize',
      onmousedown: e => {
        if (e.button !== 0) return;
        const el = document.getElementById(`_fp_${id}`);
        if (!el) return;
        _rsz = { id, el, ox: e.clientX, oy: e.clientY, w0: ps.w, h0: ps.h };
        document.addEventListener('mousemove', onRszMove);
        document.addEventListener('mouseup',   onRszUp);
        e.preventDefault();
        e.stopPropagation();
      },
    })([]),
  ]);
};

export { FloatingPanel };
