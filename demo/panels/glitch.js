import { div, p } from '../../src/index.js';
import { Card, GlitchCanvas, GlitchImg, CanvasBg } from '../../src/index.js';
import { doc } from '../components/doc.js';


// Track running effects so we can stop them on unmount
let _handles = [];
const stopAll = () => { _handles.forEach(h => h.stop()); _handles = []; };

// ── Mount helper — called after the vnode tree is in the DOM ─────────────

const mountAll = () => {
  // CORS-friendly images (Unsplash direct URLs are blocked for canvas pixel
  // access; picsum.photos allows it via CORS headers)
  // recalculate url on mount
  const PIC_A = `https://picsum.photos/seed/${Date.now()}/640/400`;
  const PIC_B = `https://picsum.photos/seed/${Date.now() / 29}/640/400`;
  const PIC_C = `https://picsum.photos/seed/${Date.now() * 83}/300/300`;
  stopAll();
  [
    [document.getElementById('glitch-a'), { src: PIC_A }],
    [document.getElementById('glitch-b'), { src: PIC_B, fps: 20, rgb: false, shiftLines: 3 }],
    [document.getElementById('glitch-c'), { src: PIC_C, fps: 15, flowSpeed: 4, flowBrightness: 90, scatCount: 5 }],
    [document.getElementById('glitch-bg'), { src: PIC_A }],
  ].forEach(([el, opts]) => {
    if (el) _handles.push(GlitchImg(opts)(el));
  });
};

// ── Panel ────────────────────────────────────────────────────────────────
// unload:true in NAV_ITEMS tears down the DOM on nav away; each visit
// re-runs glitchPanel, so scheduling mountAll here fires on every visit.

export const glitchPanel = () => {
  setTimeout(mountAll, 0); // defer to ensure the DOM is updated before we query for elements
  return div({})([

    // ── Default preset ───────────────────────────────────────────────────
    Card({ title: 'GlitchImg — default preset' })([
      p({ style: 'font-size:13px; color:var(--text-muted); margin:0 0 12px' })([
        'Default: 30 fps · RGB shift · 6 shift-line passes · 3 scatter slots.',
      ]),
      GlitchCanvas({ id: 'glitch-a', style: 'width:100%; max-width:640px; height:auto' }),
      doc([`// Mount after the panel renders:
const fx = GlitchImg({ src: '/photo.jpg' })(document.getElementById('id'));

fx.pause();   // freeze on current frame
fx.resume();  // continue animation
fx.stop();    // cancel RAF and free resources`]),
    ]),

    // ── RGB off, fewer shift lines ───────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'GlitchImg — no RGB, reduced shift lines' })([
        p({ style: 'font-size:13px; color:var(--text-muted); margin:0 0 12px' })([
          'rgb: false · fps: 20 · shiftLines: 3 — subtler glitch.',
        ]),
        GlitchCanvas({ id: 'glitch-b', style: 'width:100%; max-width:640px; height:auto' }),
        doc([`GlitchImg({ src: '...', fps: 20, rgb: false, shiftLines: 3 })(el)`]),
      ]),
    ]),

    // ── High-brightness scanline + heavy scatter ─────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'GlitchImg — slow scan, heavy scatter' })([
        p({ style: 'font-size:13px; color:var(--text-muted); margin:0 0 12px' })([
          'fps: 15 · flowSpeed: 4 · flowBrightness: 90 · scatCount: 5.',
        ]),
        GlitchCanvas({ id: 'glitch-c', style: 'max-width:300px; width:100%' }),
        doc([`GlitchImg({
  src: '...',
  fps: 15,
  flowSpeed: 4,       // slow scanline scroll
  flowBrightness: 90, // strong glow
  scatCount: 5,       // 5 scatter rect slots
})(el)`]),
      ]),
    ]),

    // ── CanvasBg ────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'CanvasBg — canvas as a background' })([
        CanvasBg({ id: 'glitch-bg', height: '300px' })([
          div({ style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; text-align:center; gap:12px;' })([
            p({ style: 'margin:0; font-size:28px; font-weight:700; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.7); letter-spacing:-0.5px;' })([
              'Any content',
            ]),
            p({ style: 'margin:0; font-size:14px; color:rgba(255,255,255,.82); text-shadow:0 1px 4px rgba(0,0,0,.6); max-width:360px;' })([
              'The canvas effect runs behind. Drop in cards, forms, anything.',
            ]),
          ]),
        ]),
        doc([`// Pure vnode — no side effects:
CanvasBg({ id: 'bg1', height: '320px' })([
  div({ className: 'cvs-bg-content' })([ ...children ]),
])

// After the panel renders, start the effect:
const fx = GlitchImg({ src: '/photo.jpg' })(document.getElementById('bg1'));

// Cleanup on unmount:
fx.stop();

// opts:
//   id        string   id on the <canvas>        default auto
//   height    string   CSS height of the wrapper  default '240px'
//   className string   extra class on wrapper
//   style     string   extra inline style on wrapper`]),
      ]),
    ]),

    // ── API reference ────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'API reference' })([
        doc([`// ── Transform pipeline (all curried) ──────────────────────────────
//   flowLine  :: { brightness } → { w, h, t } → pixels → pixels
//   shiftLine :: { w, h }       → pixels → pixels
//   shiftRGB  :: { w }          → pixels → pixels
//   extractRect :: { w, h }     → pixels → { data, rw, rh }
//   buildPipeline :: config → state → pixels → pixels
//
// ── Mount function ──────────────────────────────────────────────────────
//   GlitchImg(opts)(el) → { stop, pause, resume }
//
// opts:
//   src             string   Image URL (must be CORS-accessible)
//   fps             number   Target frame rate              default 30
//   flowSpeed       number   Scanline scroll px/frame       default 8
//   flowBrightness  number   Scanline brightness boost      default 60
//   shiftLines      number   Shift-line passes per frame    default 6
//   scatCount       number   Scatter-rect slots             default 3
//   rgb             boolean  Chromatic aberration           default true
//
// ── Vnode helper ────────────────────────────────────────────────────────
//   GlitchCanvas({ id?, className?, style?, width?, height? }) → vnode`]),
      ]),
    ]),
  ]);
};
