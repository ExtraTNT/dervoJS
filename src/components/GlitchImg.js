/**
 * GlitchImg — canvas-based image glitch effect component.
 * 
 * found at https://freefrontend.com/javascript-glitch-effects/
 * shit looks nice
 *
 * All pixel-processing transforms are purely functional and curried:
 *   transform :: config → state → pixels → pixels
 *
 * The imperative shell (RAF loop, canvas I/O) is kept as a thin wrapper
 * around the pure pipeline.  The component does NOT return a vnode — it mounts
 * into an existing element (canvas or container div) and returns controls.
 *
 *── Effects ────────────────────────────────────────────────────────────────
 *   flowLine  — a bright scanline that scrolls down every frame
 *   shiftLine — random horizontal bands shifted left / right
 *   shiftRGB  — chromatic aberration: R, G, B channels shifted independently
 *   scatter   — random rectangles extracted and re-drawn at offset positions
 *
 * ── API ─────────────────────────────────────────────────────────────────────
 *   GlitchImg(opts)(el) → { stop, pause, resume }
 *
 *   opts.src             {string}  Image URL.  Must be CORS-accessible for pixel read.
 *   opts.fps             {number}  Target frame rate.  Default 30.
 *   opts.flowSpeed       {number}  Scanline scroll speed in pixels/frame.  Default 8.
 *   opts.flowBrightness  {number}  Brightness boost applied to scanline.  Default 60.
 *   opts.shiftLines      {number}  Shift-line passes per frame.  Default 6.
 *   opts.scatCount       {number}  Scatter-rect slots.  Default 3.
 *   opts.rgb             {boolean} Enable chromatic aberration.  Default true.
 *
 *   el  — <canvas> element OR any container element (a canvas is created inside).
 *
 * ── CSS helper ──────────────────────────────────────────────────────────────
 *   GlitchCanvas(opts) → vnode   — declare a canvas placeholder in your vnode tree.
 *
 * @example
 *   // 1. Put a canvas in your vnode tree:
 *   GlitchCanvas({ id: 'g1', style: 'width:100%; max-width:640px' })
 *
 *   // 2. After the panel mounts, start the effect:
 *   const fx = GlitchImg({ src: '...', fps: 24 })(document.getElementById('g1'));
 *
 *   // 3. Clean up on unmount / nav away:
 *   fx.stop();
 */

import { canvas } from '../elements.js';

// ── Constants ─────────────────────────────────────────────────────────────
const CH = 4; // RGBA channels per pixel

// ── Pure helpers ──────────────────────────────────────────────────────────

// copyPixels :: TypedArray → Uint8ClampedArray
const copyPixels = data => new Uint8ClampedArray(data);

// rand :: number → number → number   (lo inclusive, hi exclusive, integers)
const rand = lo => hi => Math.floor(Math.random() * (hi - lo) + lo);

// clamp255 :: number → number
const clamp255 = x => x < 0 ? 0 : x > 255 ? 255 : x;

// wrapIdx :: number → number → number   (positive modulo)
const wrapIdx = len => i => ((i % len) + len) % len;

// ── Pixel transforms (config → state → pixels → pixels) ──────────────────

/**
 * flowLine :: { speed, brightness } → { w, h, t } → Uint8ClampedArray → Uint8ClampedArray
 *
 * Brightens the scanline at row `t % h`, producing a glowing horizontal streak.
 */
const flowLine = ({ brightness = 60 }) => ({ w, h, t }) => src => {
  const out = copyPixels(src);
  const y   = Math.floor(t % h);
  for (let x = 0; x < w; x++) {
    const i   = (y * w + x) * CH;
    out[i]   = clamp255(src[i]   + brightness);
    out[i+1] = clamp255(src[i+1] + brightness);
    out[i+2] = clamp255(src[i+2] + brightness);
    out[i+3] = src[i+3];
  }
  return out;
};

/**
 * shiftLine :: { w, h } → Uint8ClampedArray → Uint8ClampedArray
 *
 * Shifts a random horizontal band of rows left or right by a random offset.
 * Out-of-bounds reads fall back to the original pixel value.
 */
const shiftLine = ({ w, h }) => src => {
  const out    = copyPixels(src);
  const yMin   = rand(0)(h);
  const yMax   = yMin + rand(1)(h - yMin + 1);
  const offset = CH * rand(-40)(40);
  for (let y = yMin; y < yMax; y++) {
    for (let x = 0; x < w; x++) {
      const i  = (y * w + x) * CH;
      const i2 = i + offset;
      const ok = i2 >= 0 && i2 + 2 < src.length;
      out[i]   = ok ? src[i2]   : src[i];
      out[i+1] = ok ? src[i2+1] : src[i+1];
      out[i+2] = ok ? src[i2+2] : src[i+2];
      out[i+3] = src[i+3];
    }
  }
  return out;
};

/**
 * shiftRGB :: { w, h } → Uint8ClampedArray → Uint8ClampedArray
 *
 * Independently offsets the R, G, and B channels, creating chromatic aberration.
 * Wraps around the pixel buffer so no reads go out of bounds.
 */
const shiftRGB = ({ w }) => src => {
  const out   = copyPixels(src);
  const total = src.length;
  const wrap  = wrapIdx(total);
  const rndOff = () => (rand(-16)(16) * w + rand(-16)(16)) * CH;
  const [oR, oG, oB] = [rndOff(), rndOff(), rndOff()];
  for (let i = 0; i < total; i += CH) {
    out[i]   = src[wrap(i     + oR)];
    out[i+1] = src[wrap(i + 1 + oG)];
    out[i+2] = src[wrap(i + 2 + oB)];
    out[i+3] = src[i+3];
  }
  return out;
};

/**
 * extractRect :: { w, h } → Uint8ClampedArray → { data, rw, rh }
 *
 * Extracts a random rectangular slice of pixels to use as a scatter overlay.
 */
const extractRect = ({ w, h }) => src => {
  const rx   = rand(0)(w - 30);
  const ry   = rand(0)(h - 50);
  const rw   = rand(30)(w - rx);
  const rh   = rand(1)(50);
  const data = new Uint8ClampedArray(rw * rh * CH);
  for (let row = 0; row < rh; row++) {
    for (let col = 0; col < rw; col++) {
      const si = ((ry + row) * w + (rx + col)) * CH;
      const di = (row * rw + col) * CH;
      data[di]   = src[si];
      data[di+1] = src[si+1];
      data[di+2] = src[si+2];
      data[di+3] = src[si+3];
    }
  }
  return { data, rw, rh };
};

// ── Pipeline ───────────────────────────────────────────────────────────────

/**
 * buildPipeline :: config → state → pixels → pixels
 *
 * Composes flowLine → shiftLine×N → shiftRGB into a single transform.
 * Each shift-line pass fires with 50% probability; shiftRGB fires at ~35%.
 */
const buildPipeline = ({ numShiftLines, flowCfg, enableRGB }) => state => src => {
  let p = flowLine(flowCfg)(state)(src);
  for (let i = 0; i < numShiftLines; i++) {
    if (Math.random() > 0.5) p = shiftLine(state)(p);
  }
  if (enableRGB && Math.random() > 0.65) p = shiftRGB(state)(p);
  return p;
};

// ── Mount function — imperative shell, functional API ─────────────────────

/**
 * GlitchImg :: opts → (HTMLElement | HTMLCanvasElement) → { stop, pause, resume }
 */
export const GlitchImg = ({
  src,
  fps            = 30,
  flowSpeed      = 8,
  flowBrightness = 60,
  shiftLines     = 6,
  scatCount      = 3,
  rgb            = true,
} = {}) => el => {
  if (!src) throw new Error('GlitchImg: src is required');

  // Accept a <canvas> directly, or create one inside a container
  const cvs = el.tagName === 'CANVAS' ? el : (() => {
    const c = document.createElement('canvas');
    c.className = 'glitch-canvas';
    el.appendChild(c);
    return c;
  })();
  const ctx = cvs.getContext('2d');

  // Mutable loop state (all confined to this closure)
  let rafId        = null;
  let paused       = false;
  let through      = false;     // true = show clean image this frame
  let throughTimer = null;
  let origin       = null;      // Uint8ClampedArray snapshot — never mutated
  let t            = rand(0)(1000);
  let scatter      = Array.from({ length: scatCount }, () => ({ x: 0, y: 0, rect: null }));
  let lastTime     = 0;

  const msPerFrame = 1000 / fps;
  const pipeline   = buildPipeline({
    numShiftLines: shiftLines,
    flowCfg:       { brightness: flowBrightness },
    enableRGB:     rgb,
  });

  // ── Load image ─────────────────────────────────────────────────────────

  const imgEl        = new Image();
  imgEl.crossOrigin  = 'anonymous';
  imgEl.onload = () => {
    cvs.width  = imgEl.naturalWidth;
    cvs.height = imgEl.naturalHeight;
    ctx.drawImage(imgEl, 0, 0);
    // Capture the clean snapshot — this is the immutable origin used every frame
    origin = copyPixels(ctx.getImageData(0, 0, cvs.width, cvs.height).data);
    rafId  = requestAnimationFrame(loop);
  };
  imgEl.src = src;

  // ── Frame loop ──────────────────────────────────────────────────────────

  const loop = now => {
    rafId = requestAnimationFrame(loop);
    if (paused || !origin) return;
    if (now - lastTime < msPerFrame) return;
    lastTime = now;

    const w = cvs.width, h = cvs.height;

    // Occasionally enter pass-through phase: display clean image for 40–400ms
    if (!through && Math.random() > 0.75) {
      through = true;
      clearTimeout(throughTimer);
      throughTimer = setTimeout(() => { through = false; }, rand(40)(400));
    }

    if (through) {
      ctx.putImageData(new ImageData(copyPixels(origin), w, h), 0, 0);
      return;
    }

    // Advance scanline and run the pure glitch pipeline
    t = (t + flowSpeed) % h;
    const glitched = pipeline({ w, h, t })(origin);
    ctx.putImageData(new ImageData(glitched, w, h), 0, 0);

    // Update scatter slots (20% chance each), then draw all active rects
    scatter = scatter.map(s =>
      Math.random() > 0.8
        ? { x: rand(-Math.floor(w * 0.3))(Math.floor(w * 0.7)),
            y: rand(-Math.floor(h * 0.1))(h),
            rect: extractRect({ w, h })(glitched) }
        : s
    );
    scatter.forEach(({ x, y, rect }) => {
      if (rect) ctx.putImageData(new ImageData(rect.data, rect.rw, rect.rh), x, y);
    });
  };

  // ── Controls ────────────────────────────────────────────────────────────
  const stop   = () => { cancelAnimationFrame(rafId); rafId = null; clearTimeout(throughTimer); };
  const pause  = () => { paused = true; };
  const resume = () => { paused = false; };

  return { stop, pause, resume };
};

// ── Vnode helper ──────────────────────────────────────────────────────────

/**
 * GlitchCanvas :: { id?, className?, style?, width?, height? } → vnode
 *
 * Declares a <canvas> placeholder in your vnode tree.
 * Pass the rendered element to GlitchImg(opts) to start the effect.
 *
 * @example
 *   GlitchCanvas({ id: 'g1', style: 'max-width:640px; width:100%' })
 */
export const GlitchCanvas = ({
  id        = '',
  className = '',
  style     = '',
  width,
  height,
} = {}) =>
  canvas({
    ...(id     && { id }),
    ...(width  && { width }),
    ...(height && { height }),
    className: ['glitch-canvas', className].filter(Boolean).join(' '),
    style,
  })([]);
