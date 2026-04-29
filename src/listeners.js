/**
 * dervoJS — listeners / event system
 *
 * Functional event utilities. Each factory returns a { destroy } object
 * (plus optional helpers) so tear-down is always a single call.
 *
 * Public utilities (also exported for direct use):
 *   addListener(target)(event)(handler)(opts?) → teardownFn
 *   debounce(fn)(ms) → debouncedFn
 */

// ── Shared utilities ───────────────────────────────────────────────────────

//TODO: clean this up, together with clock and timer

/**
 * Attach an event listener and return a function that removes it.
 * Eliminates the symmetric addEventListener / removeEventListener boilerplate.
 *
 * @param {EventTarget}       target
 * @param {string}            event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {AddEventListenerOptions} [opts]
 * @returns {() => void}  teardown
 *
 * @example
 *   const off = addListener(window)('resize')(handler)({ passive: true });
 *   off(); // equivalent to window.removeEventListener('resize', handler)
 */
const addListener = target => event => handler => (opts = undefined) => {
  target.addEventListener(event, handler, opts);
  return () => target.removeEventListener(event, handler, opts);
};

/**
 * Return a debounced version of `fn` that delays invocation by `ms`
 * milliseconds, resetting the timer on every new call.
 *
 * @param {function} fn
 * @param {number}   ms
 * @returns {function}
 */
const debounce = fn => ms => {
  let id;
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
};

// ── Event bus (pub/sub) ────────────────────────────────────────────────────
/**
 * Minimal pub/sub bus.
 *
 * @returns {{ on, off, emit, once, destroy }}
 * @example
 *   const bus = createBus();
 *   const off = bus.on('done', data => console.log(data));
 *   bus.emit('done', { url: '/img.png' });
 *   off();
 */
const createBus = () => {
  const map = new Map();

  const on = (event, handler) => {
    if (!map.has(event)) map.set(event, new Set());
    map.get(event).add(handler);
    return () => off(event, handler);
  };

  const off = (event, handler) => map.get(event)?.delete(handler);

  const emit = (event, payload) => map.get(event)?.forEach(h => h(payload));

  // Unsubscribes before calling so a throwing handler can't leave a ghost
  const once = (event, handler) => {
    const wrap = payload => { off(event, wrap); handler(payload); };
    return on(event, wrap);
  };

  const destroy = () => map.clear();

  // Return a snapshot of events and handlers for debugging/inspection
  const events = () => Array.from(map.entries()).map(([event, handlers]) => ({ event, handlers: Array.from(handlers) }));

  return { on, off, emit, once, destroy, events };
};

// Simple registry for named buses so components can publish/subscribe
// by id. This keeps buses in-memory and avoids global leaks — callers
// can destroy a bus when no longer needed via `getBus(id).destroy()`.
const _busRegistry = new Map();
const getBus = id => {
  if (!id) return null;
  if (!_busRegistry.has(id)) _busRegistry.set(id, createBus());
  return _busRegistry.get(id);
};

const listBusIds = () => Array.from(_busRegistry.keys());

// ── Window resize ──────────────────────────────────────────────────────────
/**
 * Listen to window size changes with a configurable debounce.
 *
 * @param {function} callback  Called with { width, height }
 * @param {object}   [opts]
 * @param {number}   [opts.debounce=50]
 * @returns {{ destroy, getSize }}
 */
const onWindowResize = callback => ({ debounce: wait = 50 } = {}) => {
  const getSize = () => ({ width: window.innerWidth, height: window.innerHeight });
  const destroy = addListener(window)('resize')(debounce(() => callback(getSize()))(wait))({ passive: true });
  return { destroy, getSize };
};

// ── Media query breakpoint ─────────────────────────────────────────────────
/**
 * Fire `callback` whenever the given media query changes, and once immediately.
 *
 * @param {string}   query     CSS media query, e.g. '(max-width: 768px)'
 * @param {function} callback  Called with { matches: boolean }
 * @returns {{ destroy, matches }}
 */
const onBreakpoint = query => callback => {
  const mql = window.matchMedia(query);
  const handler = e => callback({ matches: e.matches });
  const destroy = addListener(mql)('change')(handler)();
  // Fire immediately so the caller doesn't need a separate initial check
  callback({ matches: mql.matches });
  return { destroy, matches: () => mql.matches };
};

// ── Global keyboard listeners ──────────────────────────────────────────────
/**
 * Factory for keydown / keyup listeners with optional key + modifier filter.
 *
 * @param {'keydown'|'keyup'} event
 * @returns {(callback, opts?) => { destroy }}
 */
const _mkKeyListener = event => callback => (opts = {}) => {
  const { key, ctrl, shift, alt } = opts;
  const keys = key != null ? [].concat(key) : null;

  const handler = e => {
    if (keys  && !keys.includes(e.key))       return;
    if (ctrl  != null && e.ctrlKey  !== ctrl) return;
    if (shift != null && e.shiftKey !== shift) return;
    if (alt   != null && e.altKey   !== alt)  return;
    callback(e);
  };

  return { destroy: addListener(window)(event)(handler)() };
};

/**
 * @param {function}         callback  Receives the KeyboardEvent
 * @param {object}           [opts]
 * @param {string|string[]}  [opts.key]
 * @param {boolean}          [opts.ctrl]
 * @param {boolean}          [opts.shift]
 * @param {boolean}          [opts.alt]
 * @returns {{ destroy }}
 */
const onKeydown = _mkKeyListener('keydown');
const onKeyup   = _mkKeyListener('keyup');

// ── Scheduled alarm ────────────────────────────────────────────────────────
/**
 * One-shot or repeating callback scheduler. Curried: `createAlarm(callback)(opts)`.
 *
 * @param {function} callback
 * @returns {function}  opts => { destroy, reset }
 *
 * @param {object}   [opts]
 * @param {number}   [opts.delay=1000]
 * @param {boolean}  [opts.repeat=false]
 * @param {boolean}  [opts.immediate=false]  Call once immediately before first delay
 *
 * @example
 *   // One-shot after 5 s
 *   const alarm = createAlarm(() => showToast('Session expiring'))({ delay: 5000 });
 *
 *   // Repeating every second — like setInterval but destroyable
 *   const tick = createAlarm(() => setState(s => ({ t: s.t + 1 })))({ delay: 1000, repeat: true });
 *   tick.destroy();
 *
 *   // Partial application — clock factory
 *   const everySecond = createAlarm(tick)({ delay: 1000, repeat: true });
 */
const createAlarm = callback => (opts = {}) => {
  const { delay = 1000, repeat = false, immediate = false } = opts;
  let id = null;

  const clear = () => { clearTimeout(id); id = null; };

  const schedule = () => {
    id = setTimeout(() => {
      callback();
      if (repeat) schedule();
      else id = null;
    }, delay);
  };

  const start = () => { clear(); if (immediate) callback(); schedule(); };
  const reset  = start;

  start();
  return { destroy: clear, reset };
};

// ── Page visibility change ─────────────────────────────────────────────────
/**
 * @param {function} callback  Called with { visible: boolean }
 * @returns {{ destroy }}
 */
const onVisibilityChange = callback => {
  const handler = () => callback({ visible: !document.hidden });
  return { destroy: addListener(document)('visibilitychange')(handler)() };
};

export {
  // Low-level utilities (useful for custom listeners)
  addListener,
  debounce,
  // High-level factories
  createBus,
  getBus,
  listBusIds,
  onWindowResize,
  onBreakpoint,
  onKeydown,
  onKeyup,
  createAlarm,
  onVisibilityChange,
};
