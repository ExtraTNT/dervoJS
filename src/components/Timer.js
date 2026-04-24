import { button, div, span } from '../elements.js';
import Task from '../../lib/odocosjs/src/Task.js';

/**
 * Formats a total number of seconds as HH:MM:SS or MM:SS.
 * @param {number} secs
 * @returns {string}
 */
const formatTime = secs => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
};

// ── Task helpers ──────────────────────────────────────────────────────────

/** Task that resolves after `ms` milliseconds. Pure — no side effects at build time. */
const delay = ms => new Task((_rej, res) => setTimeout(res, ms));

/** Lift a synchronous side-effect into a resolved Task. */
const effect = f => new Task((_rej, res) => { f(); res(); });

/**
 * Creates a timer controller that drives a store slice.
 *
 * Internally, each tick is modelled as a lazy Task chain:
 *   delay(step s) → update state → chain(tick)
 * The loop stops immediately when `cancelled` is flipped by pause/reset —
 * no interval handle to juggle, no leaks.
 *
 * @param {Object}   opts
 * @param {Object}   opts.store       - Store from createStore().
 * @param {string}   [opts.key='timer'] - Namespace prefix for state keys.
 * @param {number}   [opts.step=1]    - Seconds added per tick.
 * @returns {{ start, pause, reset, toggle }}
 *
 * @example
 *   const store  = createStore({ timer: { elapsed: 0, running: false } });
 *   const timer  = createTimer({ store, key: 'timer' });
 *   timer.start();   // starts ticking
 *   timer.pause();   // freezes
 *   timer.reset();   // back to 0:00
 *   timer.toggle();  // flips running
 */
const createTimer = ({ store, key = 'timer', step = 1 } = {}) => {
  let cancelled = true;

  const getSlice = () => store.getState()[key] ?? { elapsed: 0, running: false };
  const setSlice = patch => store.setState({ [key]: { ...getSlice(), ...patch } });

  // Recursive tick loop expressed as a lazy Task chain.
  // Waits `step` seconds, then either stops (if cancelled) or increments
  // elapsed and chains the next tick.
  const tick = () =>
    delay(1000 * step).chain(() =>
      cancelled
        ? Task.of(null)
        : effect(() => setSlice({ elapsed: getSlice().elapsed + step })).chain(tick)
    );

  const start = () => {
    if (!cancelled) return;       // already running
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

/**
 * Timer display component — renders the elapsed time from a timer slice.
 *
 * @param {Object} opts
 * @param {number}  opts.elapsed  - Seconds elapsed (from timer state slice).
 * @param {boolean} opts.running  - Whether the timer is currently running.
 * @param {Object}  [opts.controls]
 *   Optional { start, pause, reset, toggle } controller from createTimer.
 * @returns {vnode}
 *
 * @example
 *   TimerDisplay({
 *     elapsed: state.timer.elapsed,
 *     running: state.timer.running,
 *     controls: timer,
 *   })
 */
const TimerDisplay = ({ elapsed = 0, running = false, controls } = {}) =>
  div({ className: 'timer' })([
    span({ className: `timer-display${running ? ' timer-running' : ''}` })(
      [formatTime(elapsed)]
    ),
    ...(controls
      ? [div({ className: 'timer-controls' })([
          ...(running
            ? [_btn('Pause', controls.pause, 'secondary')]
            : [_btn('Start', controls.start, 'primary')]),
          _btn('Reset', controls.reset, 'ghost'),
        ])]
      : []),
  ]);

const _btn = (label, onClick, variant) =>
  button({ className: `btn btn-${variant} btn-sm`, onclick: onClick, type: 'button' })([label]);

export { createTimer, TimerDisplay, formatTime };

