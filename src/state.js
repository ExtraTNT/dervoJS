import { Observable } from '../lib/odocosjs/src/Observable.js';
import { createNode } from '../lib/odocosjs/src/render.js';

// ── Focus helpers ─────────────────────────────────────────────────────────

const TEXT_SELECTION_TYPES = new Set([
  'text', 'search', 'url', 'tel', 'password', 'email',
]);

const supportsSelection = el => {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return TEXT_SELECTION_TYPES.has((el.type || 'text').toLowerCase());
  return false;
};

/** Capture focused element state so it can be restored after patching */
const snapFocus = el => {
  if (!el?.id) return null;
  return {
    id:    el.id,
    start: supportsSelection(el) ? el.selectionStart : null,
    end:   supportsSelection(el) ? el.selectionEnd   : null,
  };
};

/** Re-focus the previously active element if the patcher replaced it */
const restoreFocus = snap => {
  if (!snap || document.activeElement?.id === snap.id) return;
  const next = document.getElementById(snap.id);
  if (!next) return;
  next.focus();
  if (snap.start !== null) {
    try { next.setSelectionRange(snap.start, snap.end); } catch (_) {}
  }
};

// ── Vnode helpers ─────────────────────────────────────────────────────────

/** Flatten and normalise a vnode's children: coerce numbers to strings, drop nulls */
const childList = vnode =>
  (vnode.children || [])
    .map(c => (typeof c === 'number' ? String(c) : c))
    .filter(c => c != null);

/** Extract the framework key from a vnode (null when absent) */
const vnodeKey = c => (c && typeof c === 'object' ? (c.props?.key ?? null) : null);

// ── Structural DOM patcher ────────────────────────────────────────────────
// Walks the live DOM and new vnode tree in parallel, only touching nodes
// that actually changed. Unchanged subtrees are left completely alone.

const _prevProps = new WeakMap();

// ── Tracked node creation ─────────────────────────────────────────────────
// createNode (library) sets DOM props from vnode.props but never touches
// _prevProps. On the first patch of such a node prev={}, so the cleanup loop
// has nothing to remove — props set at creation time (e.g. className:'stack')
// silently persist when the node is later reused for content that omits them.
// _registerProps walks the just-created DOM tree and seeds _prevProps so
// every subsequent patch has accurate "what was previously set" tracking.
const _registerProps = (vnode, dom) => {
  if (!vnode || typeof vnode !== 'object') return;
  if (vnode.props) _prevProps.set(dom, vnode.props);
  const ch = vnode.children || [];
  for (let i = 0; i < ch.length; i++)
    if (dom.childNodes[i]) _registerProps(ch[i], dom.childNodes[i]);
};

const _createNode = vnode => {
  const node = createNode(vnode);
  _registerProps(vnode, node);
  return node;
};

/** Curried: _patchProps(el)(newProps) */
const _patchProps = el => newProps => {
  if (_profiling) _ops.propPatches++;
  const prev = _prevProps.get(el) || {};
  Object.keys(prev)
    .filter(k => !(k in newProps))
    .forEach(k => {
      if      (typeof prev[k] === 'function') el[k] = null;
      else if (typeof prev[k] === 'boolean')  el[k] = false;
      else                                     el[k] = '';
    });
  Object.keys(newProps).forEach(k => {
    if (k === 'style' || el[k] !== newProps[k]) el[k] = newProps[k];
  });
  _prevProps.set(el, newProps);
};

/** Curried: _patch(parent)(oldNode)(newVnode) — recursive vnode reconciler */
const _patch = parent => oldNode => newVnode => {
  if (_profiling) _ops.vnodes++;
  if (typeof newVnode === 'number') newVnode = String(newVnode);

  if (newVnode == null) {
    if (oldNode) { if (_profiling) _ops.removes++; parent.removeChild(oldNode); }
    return;
  }

  if (!oldNode) {
    if (_profiling) _ops.creates++;
    parent.appendChild(_createNode(newVnode));
    return;
  }

  // ── Text node ──────────────────────────────────────────────────────────
  if (typeof newVnode === 'string') {
    if (oldNode.nodeType === Node.TEXT_NODE) {
      if (oldNode.nodeValue !== newVnode) { if (_profiling) _ops.textUpdates++; oldNode.nodeValue = newVnode; }
    } else {
      if (_profiling) _ops.replaces++;
      parent.replaceChild(document.createTextNode(newVnode), oldNode);
    }
    return;
  }

  // ── Element: different tag → full replacement ──────────────────────────
  if (
    oldNode.nodeType !== Node.ELEMENT_NODE ||
    oldNode.tagName.toLowerCase() !== newVnode.tag
  ) {
    if (_profiling) _ops.replaces++;
    parent.replaceChild(_createNode(newVnode), oldNode);
    return;
  }

  // ── Element: same tag → patch props then recurse ───────────────────────
  _patchProps(oldNode)(newVnode.props || {});

  const newCh = childList(newVnode);
  const oldCh = Array.from(oldNode.childNodes);   // static snapshot

  // ── Key-based reconciliation ──────────────────────────────────────────
  if (newCh.some(c => vnodeKey(c) != null)) {
    const keyMap  = new Map(
      oldCh.filter(n => n._dervoKey != null).map(n => [n._dervoKey, n])
    );
    const newKeys = new Set(newCh.map(vnodeKey).filter(k => k != null));
    // remove stale keyed nodes first (before any insertions mutate childNodes)
    oldCh
      .filter(n => n._dervoKey != null && !newKeys.has(n._dervoKey))
      .forEach(n => { if (_profiling) _ops.removes++; oldNode.removeChild(n); });

    newCh.forEach((child, i) => {
      const key = vnodeKey(child);
      const ref = oldNode.childNodes[i] ?? null;
      if (key != null && keyMap.has(key)) {
        const existing = keyMap.get(key);
        if (existing !== ref) { if (_profiling) _ops.inserts++; oldNode.insertBefore(existing, ref); }
        _patch(oldNode)(existing)(child);
      } else if (key == null && ref) {
        // unkeyed child in a keyed list: patch by position
        _patch(oldNode)(ref)(child);
      } else {
        const newDom = _createNode(child);
        if (key != null) newDom._dervoKey = key;
        if (_profiling) _ops.inserts++;
        oldNode.insertBefore(newDom, ref);
      }
    });
    // trim any excess nodes left after the last expected position
    while (oldNode.childNodes.length > newCh.length) {
      if (_profiling) _ops.removes++;
      oldNode.removeChild(oldNode.childNodes[newCh.length]);
    }
    return;
  }

  // ── Index-based reconciliation (no keys) ─────────────────────────────
  const minLen = Math.min(oldCh.length, newCh.length);
  for (let i = 0; i < minLen; i++) _patch(oldNode)(oldCh[i])(newCh[i]);
  newCh.slice(minLen).forEach(child => {
    const newDom = _createNode(child);
    const k = vnodeKey(child);
    if (k != null) newDom._dervoKey = k;
    if (_profiling) _ops.creates++;
    oldNode.appendChild(newDom);
  });
  oldCh.slice(newCh.length).reverse().forEach(n => { if (_profiling) _ops.removes++; oldNode.removeChild(n); });
};

// ── Renderer ─────────────────────────────────────────────────────────────

/** Curried: _render(root)(newVnodes) — patch or initial-render a list of root vnodes */
const _render = root => newVnodes => {
  const list = Array.isArray(newVnodes) ? newVnodes : [newVnodes];
  const snap = snapFocus(document.activeElement);
  const oldCh = Array.from(root.childNodes);
  const minLen = Math.min(oldCh.length, list.length);
  for (let i = 0; i < minLen; i++) _patch(root)(oldCh[i])(list[i]);
  list.slice(minLen).forEach(v => { if (_profiling) _ops.creates++; root.appendChild(_createNode(v)); });
  oldCh.slice(list.length).reverse().forEach(n => { if (_profiling) _ops.removes++; root.removeChild(n); });
  restoreFocus(snap);
};

/**
 * Creates a reactive state store backed by Observable.
 *
 * @param {*} initial - Initial state value (usually a plain object).
 * @returns {{ getState, setState, subscribe }}
 *
 * @example
 *   const store = createStore({ count: 0 });
 *   store.subscribe(s => console.log(s));
 *   store.setState({ count: 1 });          // merge patch
 *   store.setState(s => ({ count: s.count + 1 })); // updater fn
 */
const createStore = initial => {
  const obs       = Observable(initial);
  const getState  = () => obs.getValue();
  const subscribe = listener => obs.onChange(listener);
  const setState  = patch => {
    const prev = getState();
    obs.setValue({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) });
  };
  return { getState, setState, subscribe };
};

/**
 * Curried: mount(store)(root)(view)
 *
 * Mounts a view to a DOM root, wiring it to a store so that every
 * state change re-renders via rAF batching (one render per visible frame).
 *
 * @example
 *   mount(store)(document.body)(s => div({})([`count: ${s.count}`]));
 *
 *   // Partial application — one store, multiple roots:
 *   const mountTo = mount(store);
 *   mountTo(document.getElementById('header'))(HeaderView);
 *   mountTo(document.getElementById('main'))(MainView);
 */
const mount = store => root => view => {
  const render = _render(root);
  const toList = v => Array.isArray(v) ? v : [v];
  let pending = false;

  // Two render runners — swapped by enableProfiler / disableProfiler.
  // _runFast is the hot path: zero overhead, no timing calls.
  // _runProfiled measures compute + patch and feeds the ring buffer.
  let _prevRenderState = null;   // snapshot from last completed render, for changedKeys diff
  const _runFast = () => {
    render(toList(view(store.getState())));
    _prevRenderState = store.getState();
  };
  const _runProfiled = () => {
    const prevState = _prevRenderState ?? store.getState();
    _resetOps();
    const t0        = performance.now();
    const vnodes    = toList(view(store.getState()));
    const t1        = performance.now();
    render(vnodes);
    const t2        = performance.now();
    const curState    = store.getState();
    const changedKeys = prevState !== null && typeof prevState === 'object'
      ? Object.keys({ ...prevState, ...curState }).filter(k => prevState[k] !== curState[k])
      : [];
    _prevRenderState = curState;
    _logFrame(t1 - t0, t2 - t1, { ..._ops }, changedKeys);
  };

  // Mutable reference so enableProfiler / disableProfiler can swap it live.
  let _run = _runFast;
  _runners.push({ enable: () => { _run = _runProfiled; }, disable: () => { _run = _runFast; } });

  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; _run(); });
  };
  store.subscribe(schedule);
  _run();   // initial render
};

// ── Render performance log ────────────────────────────────────────────────
// Profiling is OFF by default so the hot render path has zero overhead.
// Call enableProfiler() to start collecting; disableProfiler() to stop.
// getRenderLog() auto-enables profiling and returns the ring buffer.

const _runners = [];   // registered { enable, disable } pairs from mount()
let   _profiling = false;
let   _frameIdx  = 0;
const _renderLog = [];   // [{ frame, computeMs, patchMs, totalMs, ts, ops, changedKeys }], newest-first, max 100

// Per-frame DOM operation counters — only incremented when _profiling is on.
let _ops = { vnodes:0, creates:0, replaces:0, removes:0, inserts:0, propPatches:0, textUpdates:0 };
const _resetOps = () => {
  _ops.vnodes = _ops.creates = _ops.replaces = _ops.removes =
  _ops.inserts = _ops.propPatches = _ops.textUpdates = 0;
};

const _logFrame = (computeMs, patchMs, ops, changedKeys) => {
  _renderLog.unshift({
    frame:       ++_frameIdx,
    computeMs:   +computeMs.toFixed(3),
    patchMs:     +patchMs.toFixed(3),
    totalMs:     +(computeMs + patchMs).toFixed(3),
    ts:          new Date().toTimeString().slice(0, 8),
    ops:         ops        ?? { vnodes:0, creates:0, replaces:0, removes:0, inserts:0, propPatches:0, textUpdates:0 },
    changedKeys: changedKeys ?? [],
  });
  if (_renderLog.length > 100) _renderLog.length = 100;
};

const enableProfiler  = () => { if (_profiling) return; _profiling = true;  _runners.forEach(r => r.enable());  };
const disableProfiler = () => { if (!_profiling) return; _profiling = false; _runners.forEach(r => r.disable()); };
const getRenderLog    = () => { enableProfiler(); return _renderLog; };
const getProfilerFrame = () => _frameIdx;

export { createStore, mount, getRenderLog, getProfilerFrame, enableProfiler, disableProfiler };
