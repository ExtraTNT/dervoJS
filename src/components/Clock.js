import { button, div, span } from '../elements.js';
import Task from '../../lib/odocosjs/src/Task.js';

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
 * Curried: createInterval(fn)(opts).
 *
 * Completely decoupled from application state — use the returned controller
 * to drive setState calls, fetch data, or trigger any side-effect on a
 * repeating schedule. Start/stop independently of rendering.
 *
 * @param {function} fn               Callback invoked on each tick.
 * @returns {function}                opts => { start, stop, restart, toggle, isRunning }
 *
 * @param {Object}   [opts={}]
 * @param {number}   [opts.ms=1000]   Milliseconds between ticks.
 * @param {boolean}  [opts.autoStart=false]  Call start() immediately on creation.
 *
 * @example
 *   // Count up every second
 *   const ticker = createInterval(
 *     () => setState(s => ({ elapsed: s.elapsed + 1 }))
 *   )({ ms: 1000 });
 *   ticker.start();     // begin
 *   ticker.stop();      // pause
 *   ticker.restart();   // stop then start
 *   ticker.toggle();    // flip state
 *   ticker.isRunning(); // → boolean
 *
 * @example
 *   // Poll every 5 seconds, start immediately
 *   const poller = createInterval(fetchLatest)({ ms: 5000, autoStart: true });
 */
const createInterval = fn => ({ ms = 1000, autoStart = false } = {}) => {
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

// ── Task helpers ──────────────────────────────────────────────────────────

/** Task that resolves after `ms` milliseconds. */
const delay = ms => new Task((_rej, res) => setTimeout(res, ms));

/** Lift a synchronous side-effect into a resolved Task. */
const effect = f => new Task((_rej, res) => { f(); res(); });

/**
 * Creates a timer controller that drives a store slice.
 *
 * Each tick is a lazy Task chain: delay(step s) → update state → chain(tick).
 * The loop stops when `cancelled` is flipped — no interval handle, no leaks.
 *
 * @param {Object}   opts
 * @param {Object}   opts.store         Store from createStore().
 * @param {string}   [opts.key='timer'] Namespace prefix for state keys.
 * @param {number}   [opts.step=1]      Seconds added per tick.
 * @returns {{ start, pause, reset, toggle }}
 *
 * @example
 *   const store = createStore({ timer: { elapsed: 0, running: false } });
 *   const timer = createTimer({ store, key: 'timer' });
 *   timer.start();    // starts ticking
 *   timer.pause();    // freezes
 *   timer.reset();    // back to 0:00
 *   timer.toggle();   // flips running
 *
 *   // In view — pass controls to Clock for built-in buttons:
 *   Clock({ time: state.timer.elapsed, running: state.timer.running, controls: timer })
 */
const createTimer = ({ store, key = 'timer', step = 1 } = {}) => {
  let cancelled = true;

  const getSlice = () => store.getState()[key] ?? { elapsed: 0, running: false };
  const setSlice = patch => store.setState({ [key]: { ...getSlice(), ...patch } });

  const tick = () =>
    delay(1000 * step).chain(() =>
      cancelled
        ? Task.of(null)
        : effect(() => setSlice({ elapsed: getSlice().elapsed + step })).chain(tick)
    );

  const start = () => {
    if (!cancelled) return;
    cancelled = false;
    setSlice({ running: true });
    tick().fork(() => {}, () => {});
  };

  const pause = () => {
    cancelled = true;
    setSlice({ running: false });
  };

  const reset = () => {
    pause();
    setSlice({ elapsed: 0 });
  };

  const toggle = () => (getSlice().running ? pause : start)();

  return { start, pause, reset, toggle };
};

// ── Internal button helper (curried) ──────────────────────────────────────
const _btn = label => onClick => variant =>
  button({ className: `btn btn-${variant} btn-sm`, onclick: onClick, type: 'button' })([label]);

/**
 * Clock — stateless time display, optionally with inline controls.
 *
 * Without `controls`, renders the formatted time (and optional label).
 * With `controls` (a { start, pause, reset, toggle } from createTimer),
 * also renders Start/Pause and Reset buttons — replacing TimerDisplay.
 *
 * @param {Object}           opts
 * @param {number}           [opts.time=0]       Seconds to display (may be negative).
 * @param {string}           [opts.label]        Caption below the digits.
 * @param {'sm'|'md'|'lg'}  [opts.size='md']    Digit display size.
 * @param {boolean}          [opts.running=false] Highlights digits in accent colour.
 * @param {Object}           [opts.controls]     { start, pause, reset } from createTimer.
 * @param {string}           [opts.className=''] Extra CSS class(es) on root element.
 * @param {string}           [opts.style='']     Extra inline CSS on root element.
 * @returns {vnode}
 *
 * @example
 *   // Display only
 *   Clock({ time: state.elapsed, size: 'lg', label: 'elapsed', running: state.running })
 *
 * @example
 *   // With built-in controls via createTimer
 *   const timer = createTimer({ store, key: 'timer' });
 *   Clock({ time: state.timer.elapsed, running: state.timer.running, controls: timer })
 */
const Clock = ({ time = 0, label, size = 'md', running = false, className = '', style = '', controls } = {}) =>
  div({ className: ['clock', `clock-${size}`, className].filter(Boolean).join(' '), style })([
    span({ className: ['clock-display', running && 'clock-running'].filter(Boolean).join(' ') })([formatTime(time)]),
    ...(label    ? [span({ className: 'clock-label' })([label])] : []),
    ...(controls ? [div({ className: 'clock-controls' })([
      ...(running
        ? [_btn('Pause')(controls.pause)('secondary')]
        : [_btn('Start')(controls.start)('primary')]),
      _btn('Reset')(controls.reset)('ghost'),
    ])] : []),
  ]);

/** Alias for Clock — kept for back-compat; prefer Clock({ controls }) directly. */
const TimerDisplay = Clock;

export { formatTime, createInterval, createTimer, Clock, TimerDisplay };
