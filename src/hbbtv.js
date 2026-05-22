/**
 * dervoJS — HbbTV module.
 *
 * Thin functional wrapper over the HbbTV / OIPF DOM APIs used by hybrid
 * broadcast-broadband apps running on TVs and set-top boxes. All functions
 * degrade gracefully on desktop browsers (the HbbTV `<object>` elements
 * simply aren't present) so the same app can be developed in Chrome and
 * deployed to an STB.
 *
 * Required DOM (placed once in your HbbTV index.html):
 *   <object id="appmgr"  type="application/oipfApplicationManager"></object>
 *   <object id="oipfcfg" type="application/oipfConfiguration"></object>
 *   <object id="video"   type="video/broadcast"></object>
 *
 * Public surface:
 *   initApp({ show? })                   — show/hide the broadcast-related app
 *   initKeys(mask)                       — request which remote keys the app receives
 *   getChannelInfo()                     — current DVB channel { name, onid, tsid, sid }
 *   getVideoBroadcast()                  — handle to the video/broadcast object + helpers
 *   onRemoteKey(handler)(opts?)          — curried; semantic key listener with optional filter
 *   onStreamEvent({ targetURL, eventName })(handler)
 *                                        — curried; DSM-CC stream event subscription
 *   isHbbtvCapable()                     — boolean
 *   decodeKey(event)                     — pure: KeyboardEvent -> semantic key name
 *   KEYSET                               — bit-mask constants for initKeys
 *
 * @example  (typical app startup)
 *   import { initApp, initKeys, onRemoteKey, KEYSET } from './src/index.js';
 *   initApp({ show: true });
 *   initKeys(KEYSET.ALL);
 *   onRemoteKey((key, e) => router.handle(key))();
 */

import { addListener, getBus } from './listeners.js';

// keyset bit-masks (per HbbTV spec)

const KEYSET = {
  RED:        0x1,
  GREEN:      0x2,
  YELLOW:     0x4,
  BLUE:       0x8,
  NAVIGATION: 0x10,   // up/down/left/right/enter/back
  VCR:        0x20,   // play/pause/stop/next/prev/ff/rew/play_pause
  SCROLL:     0x40,
  INFO:       0x80,
  NUMERIC:    0x100,  // 0-9
  ALPHA:      0x200,
  ALL:        0x33f,  // everything above OR'd together (HbbTV convention)
};

// key code mapping

// Numeric keyCode -> semantic name (TV remote codes). Covers HbbTV defaults
// plus the standard arrow/enter/back codes the browser also dispatches.
const _HBBTV_CODES = {
  // navigation (also covered by e.key strings below)
  37: 'left', 38: 'up', 39: 'right', 40: 'down',
  13: 'ok',
  8:  'back', 27: 'back', 461: 'back',
  // colour buttons
  403: 'red', 404: 'green', 405: 'yellow', 406: 'blue',
  // VCR
  415: 'play', 19: 'pause', 413: 'stop',
  412: 'rewind', 417: 'fast_fwd',
  // info / text / etc.
  457: 'info', 460: 'text',
  // numerics
  48: '0', 49: '1', 50: '2', 51: '3', 52: '4',
  53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
};

// Modern e.key strings (browsers + some STBs).
const _KEY_STRINGS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Enter: 'ok', Escape: 'back', Backspace: 'back',
};

// Desktop fallback so you can develop in Chrome without a remote.
// Letter keys map to colour buttons; space -> OK. Numerics pass through.
const _DEV_FALLBACK = {
  r: 'red', g: 'green', y: 'yellow', b: 'blue',
  ' ': 'ok',
  // VCR fallback
  p: 'play_pause', s: 'stop',
};

/**
 * Pure: decode a KeyboardEvent into a semantic remote-key name, or null
 * when the event isn't one of the recognised keys.
 */
const decodeKey = e =>
     _HBBTV_CODES[e.keyCode]
  || _HBBTV_CODES[e.which]
  || _KEY_STRINGS[e.key]
  || _DEV_FALLBACK[e.key]
  || (/^[0-9]$/.test(e.key) ? e.key : null);

// HbbTV DOM accessors

const _appMgr  = () => document.getElementById('appmgr');
const _oipfCfg = () => document.getElementById('oipfcfg');
const _videoBc = () => document.getElementById('video');

// app lifecycle

let _activated = false;

/**
 * Show or hide the HbbTV broadcast-related application.
 * No-op outside an STB (returns false).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.show=true]
 * @returns {boolean}  true if the call reached an OIPF application object.
 */
const initApp = ({ show = true } = {}) => {
  const mgr = _appMgr();
  if (!mgr?.getOwnerApplication) return false;
  const app = mgr.getOwnerApplication(document);
  if (!app) return false;
  if (show) {
    app.show?.();
    if (!_activated) {
      app.activate?.();
      app.activateInput?.();
      _activated = true;
    }
  } else {
    app.hide?.();
  }
  return true;
};

/**
 * Request which TV-remote keys the running app will receive.
 * Tries the HbbTV 0.5 path (oipfcfg.keyset) and the HbbTV 1.0+ path
 * (appmgr.getOwnerApplication.privateData.keyset) — at least one will
 * succeed on any compliant device.
 *
 * @param {number} mask  bitwise-OR of KEYSET.* constants. Defaults to ALL.
 */
const initKeys = (mask = KEYSET.ALL) => {
  const cfg = _oipfCfg();
  const mgr = _appMgr();
  try { cfg.keyset.value = mask; }      catch (_) {}     // HbbTV 0.5
  try { cfg.keyset.setValue(mask); }    catch (_) {}     // HbbTV 0.5 (newer)
  try { mgr.getOwnerApplication(document).privateData.keyset.setValue(mask); } catch (_) {}   // HbbTV 1.0+
};

// DVB channel info

/**
 * Read the currently tuned DVB channel from the broadcast video object or
 * the OIPF application manager. Returns null when not on an STB.
 *
 * @returns {{ name, onid, tsid, sid } | null}
 */
const getChannelInfo = () => {
  const mgr   = _appMgr();
  const video = _videoBc();
  let channel = null;
  try { channel = mgr?.getOwnerApplication?.(document)?.privateData?.currentChannel; } catch (_) {}
  if (!channel) { try { channel = video?.currentChannel; } catch (_) {} }
  if (!channel) return null;
  return {
    name: channel.name ?? null,
    onid: parseInt(channel.onid, 10) || 0,
    tsid: parseInt(channel.tsid, 10) || 0,
    sid:  parseInt(channel.sid,  10) || 0,
  };
};

// remote-key listener

/**
 * Curried: onRemoteKey(handler)(opts?).
 *
 * Translates each keydown into a semantic remote-key name and invokes
 * `handler(key, event)`. Pass `keys: [...]` to filter to specific keys.
 *
 * Returns a `{ destroy }` handle.
 *
 * @example
 *   onRemoteKey((k) => router.handle(k))();
 *
 * @example
 *   onRemoteKey((k) => paintRed())({ keys: ['red'] });
 */
const onRemoteKey = handler => ({ keys, preventDefault = true } = {}) => {
  const wanted = keys ? new Set(keys) : null;
  const fn = e => {
    const k = decodeKey(e);
    if (!k) return;
    if (wanted && !wanted.has(k)) return;
    if (preventDefault) e.preventDefault();
    handler(k, e);
  };
  const off = addListener(window)('keydown')(fn)();
  return { destroy: off };
};

// video/broadcast

/**
 * Return a small handle around the <object id="video"> broadcast element,
 * with the most useful methods curried into plain functions. Null when
 * the object isn't present.
 */
const getVideoBroadcast = () => {
  const v = _videoBc();
  if (!v) return null;
  return {
    el:        v,
    play:      (speed = 1) => v.play?.(speed),
    pause:     ()          => v.pause?.(),
    stop:      ()          => v.stop?.(),
    seek:      pos         => v.seek?.(pos),
    release:   ()          => v.release?.(),
    bind:      ()          => v.bindToCurrentChannel?.(),
    paused:    ()          => v.paused,
    playState: ()          => v.playState,
    playTime:  ()          => v.playTime,
    position:  ()          => v.playPosition,
    duration:  ()          => v.duration,
    setSize:   ({ x = 0, y = 0, w, h, zIndex } = {}) => {
      v.style.position = 'absolute';
      v.style.left = `${x}px`; v.style.top = `${y}px`;
      if (w != null) v.style.width  = `${w}px`;
      if (h != null) v.style.height = `${h}px`;
      if (zIndex != null) v.style.zIndex = String(zIndex);
    },
  };
};

// stream events (DSM-CC)

/**
 * Curried: onStreamEvent({ targetURL, eventName })(handler).
 *
 * Subscribes to a DSM-CC stream event carried in the current DVB transport.
 * Returns `{ destroy }`. On desktop this is a no-op subscription.
 *
 * @example
 *   const sub = onStreamEvent({ targetURL: '/sevent', eventName: 'event' })(
 *     ev => log(`stream ${ev.name}: ${ev.text}`)
 *   );
 *   sub.destroy();
 */
const onStreamEvent = ({ targetURL, eventName }) => handler => {
  const v = _videoBc();
  if (!v?.addStreamEventListener) return { destroy: () => {} };
  let attached = false;
  try {
    v.bindToCurrentChannel?.();
    v.addStreamEventListener(targetURL, eventName, handler);
    attached = true;
  } catch (_) {}
  return {
    destroy: () => {
      if (!attached) return;
      try { v.removeStreamEventListener(targetURL, eventName, handler); } catch (_) {}
      attached = false;
    },
  };
};

// capability check

/** True when the HbbTV OIPF application manager is present and functional. */
const isHbbtvCapable = () =>
  Boolean(_appMgr() && _appMgr().getOwnerApplication);

// one-call boot

/**
 * Boot HbbTV and fan all events onto a named pub/sub bus. Returns the bus
 * so the caller can subscribe immediately. Bus events emitted:
 *
 *   'boot'   -> { hbbtv, channel }   one-shot at startup
 *   'key'    -> { key, raw }         every remote keypress (semantic name)
 *   'stream' -> { name, data, text, status }  DSM-CC stream events
 *
 * @example
 *   import { bootHbbtv, getBus } from './src/index.js';
 *   bootHbbtv();
 *   const bus = getBus('hbbtv');
 *   bus.on('key', ({ key }) => console.log(key));
 *
 * @param {object} [opts]
 * @param {string} [opts.busId='hbbtv']
 * @param {number} [opts.mask=KEYSET.ALL]
 * @param {boolean} [opts.show=true]
 * @param {{ targetURL?: string, eventName?: string }} [opts.streamEvent]
 *   Defaults to { targetURL: '/sevent', eventName: 'event' }.
 * @returns {Bus}
 */
const bootHbbtv = ({
  busId = 'hbbtv',
  mask  = KEYSET.ALL,
  show  = true,
  streamEvent: { targetURL = '/sevent', eventName = 'event' } = {},
} = {}) => {
  const bus = getBus(busId);
  initApp({ show });
  initKeys(mask);
  onRemoteKey((key, raw) => bus.emit('key', { key, raw }))();
  onStreamEvent({ targetURL, eventName })(ev => bus.emit('stream', ev));
  bus.emit('boot', { hbbtv: isHbbtvCapable(), channel: getChannelInfo() });
  return bus;
};

// focus manager — central spatial nav for TV apps

/**
 * createFocusManager — central focus engine driven by spatial DOM layout.
 *
 * Model:
 *   state.<stateKey> = { id: <focusId|null> }
 *
 *   id: null  ->  no focus; the router owns the arrow keys.
 *   id: <x>   ->  the focusable with `data-focus="<x>"` is highlighted;
 *                 arrows + OK + BACK are consumed by the focus manager.
 *
 * No groups, no registration of layouts — every focusable element marks
 * itself with `data-focus="<id>"` (use the Focusable helper component, or
 * add it by hand). On each arrow press the manager:
 *
 *   1. If the focused element is scrollable in that direction
 *      (data-focus-scroll contains 'x' / 'y') AND it still has scroll
 *      distance left -> scroll the container, do not move focus.
 *   2. Otherwise -> find the nearest neighbour `[data-focus]` in that
 *      direction by getBoundingClientRect and move focus to it.
 *
 * Activation is decoupled via the bus: pressing OK on the focused element
 * emits `bus.emit('activated', { id })`. Subscribe and dispatch however
 * you like — no per-focusable callback registration required.
 *
 *   bus.on('activated', ({ id }) => {
 *     if (id.startsWith('row-')) pushPick({ from: 'list', item: id });
 *   });
 *
 * Markup contract (rendered by Focusable):
 *   <div id="focus-<id>" data-focus="<id>" [data-focus-scroll="x|y|xy"]>...</div>
 *
 * @param {object} opts
 * @param {Bus}    opts.bus              pub/sub bus emitting 'key' events
 * @param {Store}  opts.store
 * @param {string} [opts.stateKey='focus']
 * @param {number} [opts.scrollStep=80]  pixels per arrow press inside a scroll container
 * @returns {{ focus, exit, isFocused, get }}
 */
const createFocusManager = ({ bus, store, stateKey = 'focus', scrollStep = 80, home } = {}) => {

  const _get = () => store.getState()[stateKey] || { id: null };
  const _set = id => {
    store.setState({ [stateKey]: { id } });
    if (id) requestAnimationFrame(() => {
      const el = document.querySelector(`[data-focus="${id}"]`);
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  };

  const focus = id => _set(id ?? null);
  const exit  = () => _set(null);
  const isFocused = () => Boolean(_get().id);

  // BACK destination — by default just releases focus; when a `home` callback
  // is supplied, BACK focuses whatever it returns (e.g. the current page's
  // tab). No-op when we're already there, so BACK from home doesn't escape.
  const _back = curId => {
    if (typeof home !== 'function') return exit();
    const h = home();
    if (h && h !== curId) return focus(h);
    /* already on home -> no-op */
  };

  // True iff the element can still scroll further in `dir`.
  const _canScroll = (el, dir) => {
    const axis = el.getAttribute('data-focus-scroll') || '';
    if ((dir === 'up'   || dir === 'down')  && !axis.includes('y')) return false;
    if ((dir === 'left' || dir === 'right') && !axis.includes('x')) return false;
    if (dir === 'up')    return el.scrollTop  > 0;
    if (dir === 'down')  return el.scrollTop  + el.clientHeight < el.scrollHeight - 1;
    if (dir === 'left')  return el.scrollLeft > 0;
    if (dir === 'right') return el.scrollLeft + el.clientWidth  < el.scrollWidth  - 1;
    return false;
  };

  const _scroll = (el, dir) => {
    if (dir === 'up')    el.scrollTop  -= scrollStep;
    if (dir === 'down')  el.scrollTop  += scrollStep;
    if (dir === 'left')  el.scrollLeft -= scrollStep;
    if (dir === 'right') el.scrollLeft += scrollStep;
  };

  // Pick the nearest focusable in a direction by centre + edge geometry.
  // Score = primary-axis distance + perpendicular penalty (×2) so a slightly
  // off-axis neighbour still wins over a far on-axis one.
  const _nearest = (el, dir) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const all = Array.from(document.querySelectorAll('[data-focus]'));

    let best = null, bestScore = Infinity;
    for (const o of all) {
      if (o === el || el.contains(o) || o.contains(el)) continue;
      const ro = o.getBoundingClientRect();
      const ocx = ro.left + ro.width / 2, ocy = ro.top + ro.height / 2;

      // Must be on the correct side. Tolerate slight overlap (1px).
      if (dir === 'left'  && ro.right  > r.left  + 1) continue;
      if (dir === 'right' && ro.left   < r.right - 1) continue;
      if (dir === 'up'    && ro.bottom > r.top   + 1) continue;
      if (dir === 'down'  && ro.top    < r.bottom - 1) continue;

      const dist = dir === 'left'  ? cx - ocx
                 : dir === 'right' ? ocx - cx
                 : dir === 'up'    ? cy - ocy
                                   : ocy - cy;
      const perp = (dir === 'left' || dir === 'right')
        ? Math.abs(cy - ocy)
        : Math.abs(cx - ocx);
      const score = dist + perp * 2;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  };

  bus.on('key', ({ key }) => {
    const cur = _get();
    if (!cur.id) return;
    const el = document.querySelector(`[data-focus="${cur.id}"]`);
    if (!el) { _set(null); return; }     // focused element is gone — release

    if (key === 'left' || key === 'right' || key === 'up' || key === 'down') {
      // 1) scroll the container if it can take more in this direction
      if (_canScroll(el, key)) { _scroll(el, key); return; }
      // 2) otherwise hop to the nearest neighbour
      const next = _nearest(el, key);
      if (next) _set(next.getAttribute('data-focus'));
      return;
    }
    if (key === 'ok')   { bus.emit('activated', { id: cur.id }); return; }
    if (key === 'back') { _back(cur.id);                          return; }
  });

  return { focus, exit, isFocused, get: _get };
};

export {
  KEYSET,
  initApp, initKeys,
  getChannelInfo, getVideoBroadcast,
  onRemoteKey, onStreamEvent,
  isHbbtvCapable,
  decodeKey,
  bootHbbtv,
  createFocusManager,
};
