import { div, span } from '../elements.js';

/**
 * Formats a total seconds count as HH:MM:SS (when hours > 0) or MM:SS.
 * Handles negative values (countdown overrun) by prepending '−'.
 *
 * @param {number} secs  Total seconds (integer, may be negative).
 * @returns {string}     e.g. '03:07', '1:02:35', '−00:03'
 *
 * @example
 *   formatTime(65)     // '01:05'
 *   formatTime(3661)   // '1:01:01'
 *   formatTime(-3)     // '−00:03'
 */
const formatTime = secs => {
  const neg  = secs < 0;
  const abs  = Math.abs(Math.round(secs));
  const h    = Math.floor(abs / 3600);
  const m    = Math.floor((abs % 3600) / 60);
  const s    = abs % 60;
  const pad  = n => String(n).padStart(2, '0');
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return neg ? `−${body}` : body;
};

/**
 * Creates a background interval that calls `fn` every `ms` milliseconds.
 *
 * Completely decoupled from application state — use the returned controller
 * to drive setState calls, fetch data, or trigger any side-effect on a
 * repeating schedule. Start/stop independently of rendering.
 *
 * @param {function} fn               Callback invoked on each tick.
 * @param {Object}   [opts={}]
 * @param {number}   [opts.ms=1000]   Milliseconds between ticks.
 * @param {boolean}  [opts.autoStart=false]  Call start() immediately on creation.
 * @returns {{ start, stop, restart, toggle, isRunning }}
 *
 * @example
 *   // Count up every second
 *   const ticker = createInterval(
 *     () => setState(s => ({ elapsed: s.elapsed + 1 })),
 *     { ms: 1000 }
 *   );
 *   ticker.start();     // begin
 *   ticker.stop();      // pause
 *   ticker.restart();   // stop then start
 *   ticker.toggle();    // flip state
 *   ticker.isRunning(); // → boolean
 *
 * @example
 *   // Poll every 5 seconds, start immediately
 *   const poller = createInterval(fetchLatest, { ms: 5000, autoStart: true });
 */
const createInterval = (fn, { ms = 1000, autoStart = false } = {}) => {
  let id      = null;
  let running = false;

  const stop = () => {
    if (!running) return;
    clearInterval(id);
    id      = null;
    running = false;
  };

  const start = () => {
    if (running) return;
    running = true;
    id = setInterval(fn, ms);
  };

  const restart   = () => { stop(); start(); };
  const toggle    = () => (running ? stop : start)();
  const isRunning = () => running;

  if (autoStart) start();

  return { start, stop, restart, toggle, isRunning };
};

/**
 * Clock — a stateless vnode display for a seconds value.
 *
 * Wire it to your store and drive re-renders with `createInterval`:
 *   1. Store the current time in seconds: `{ elapsed: 0 }`
 *   2. Create an interval that calls setState each tick.
 *   3. Pass store value to Clock in your view.
 *
 * @param {Object}           opts
 * @param {number}           [opts.time=0]      Seconds to display (may be negative).
 * @param {string}           [opts.label]       Small caption below the digits.
 * @param {'sm'|'md'|'lg'}  [opts.size='md']   Digit display size.
 * @param {boolean}          [opts.running=false]  Highlights digits in accent colour.
 * @returns {vnode}
 *
 * @example
 *   Clock({ time: state.elapsed, size: 'lg', label: 'elapsed', running: state.running })
 *
 * @example
 *   // Countdown that stops at zero
 *   let ctrl;
 *   ctrl = createInterval(
 *     () => setState(s => {
 *       const next = s.countdown - 1;
 *       if (next <= 0) { ctrl.stop(); return { countdown: 0, running: false }; }
 *       return { countdown: next };
 *     }),
 *     { ms: 1000 }
 *   );
 *   // In view: Clock({ time: state.countdown, running: state.running, label: 'remaining' })
 */
const Clock = ({ time = 0, label, size = 'md', running = false, className = '', style = '' } = {}) =>
  div({ className: ['clock', `clock-${size}`, className].filter(Boolean).join(' '), style })([
    span({ className: ['clock-display', running && 'clock-running'].filter(Boolean).join(' ') })([formatTime(time)]),
    ...(label ? [span({ className: 'clock-label' })([label])] : []),
  ]);

export { createInterval, Clock, formatTime };
