import { createBus } from '../listeners.js';

// ── Key aliases ───────────────────────────────────────────────────────────────
const _ALIASES = {
  ' ':        'space',
  'spacebar': 'space',
  'esc':      'escape',
  'del':      'delete',
  'return':   'enter',
  'up':       'arrowup',
  'down':     'arrowdown',
  'left':     'arrowleft',
  'right':    'arrowright',
};

// ── Pretty display names for special keys ────────────────────────────────────
const _DISPLAY = {
  arrowup:    '↑',
  arrowdown:  '↓',
  arrowleft:  '←',
  arrowright: '→',
  escape:     'Esc',
  enter:      '↵',
  space:      'Space',
  backspace:  '⌫',
  delete:     '⌦',
  tab:        'Tab',
};

// parseCombo :: string -> ComboDescriptor
// 'ctrl+shift+a'  ->  { ctrl, shift, alt, meta, key }
// Supported modifier aliases: ctrl/control, shift, alt/option, meta/cmd/command
const parseCombo = raw => {
  const parts  = raw.toLowerCase().split('+').map(p => p.trim());
  const rawKey = parts[parts.length - 1];
  const key    = _ALIASES[rawKey] ?? rawKey;
  return {
    ctrl:  parts.includes('ctrl')    || parts.includes('control'),
    shift: parts.includes('shift'),
    alt:   parts.includes('alt')     || parts.includes('option'),
    meta:  parts.includes('meta')    || parts.includes('cmd') || parts.includes('command'),
    key,
  };
};

// matchCombo :: ComboDescriptor -> KeyboardEvent -> boolean
const matchCombo = combo => e => {
  const eKey = _ALIASES[e.key.toLowerCase()] ?? e.key.toLowerCase();
  return (
    eKey         === combo.key   &&
    !!e.ctrlKey  === combo.ctrl  &&
    !!e.shiftKey === combo.shift &&
    !!e.altKey   === combo.alt   &&
    !!e.metaKey  === combo.meta
  );
};

// formatCombo :: ComboDescriptor -> string  (human-readable, uses ⌘ for meta)
const formatCombo = combo => {
  const parts = [];
  if (combo.ctrl)  parts.push('Ctrl');
  if (combo.alt)   parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta)  parts.push('⌘');
  const k = combo.key;
  parts.push(_DISPLAY[k] ?? (k.length === 1 ? k.toUpperCase() : k));
  return parts.join('+');
};

// ── createKeymap ──────────────────────────────────────────────────────────────
/**
 * Purely functional keyboard-event manager.
 * Routing is delegated to the shared createBus pub/sub from listeners.js —
 * each (scope × combo) pair becomes a bus event; no custom dispatch logic needed.
 *
 * @param {Object}      [opts]
 * @param {boolean}     [opts.debug=false]    console.debug every keydown event
 * @param {EventTarget} [opts.target=window]  element to attach the listener to
 *
 * @returns Frozen keymap instance.
 *
 * ── Curried API ──────────────────────────────────────────────────────────────
 *
 *  addGlobal  :: combo -> (element -> event -> void) -> (() -> void)
 *    Register a binding that fires on every matching keydown regardless of scope.
 *    Returns an unbind function.
 *
 *  addScoped  :: scopeId -> combo -> (element -> event -> void) -> (() -> void)
 *    Register a binding that fires only when the named scope is active.
 *    Returns an unbind function.
 *
 *  focusScope :: scopeId -> element -> void
 *    Mark `scopeId` as the currently active scope and associate `element` with it.
 *    Call from an onfocus handler; pass e.currentTarget as the element.
 *
 *  blurScope  :: () -> void
 *    Clear the active scope (call from onblur).
 *
 *  getActive  :: () -> { id: string, element: Element | null } | null
 *
 *  getBindings :: () -> { global: [{combo, raw}], scoped: {[id]: [{combo, raw}]} }
 *    Snapshot of all registered bindings — useful for rendering help overlays.
 *
 *  destroy :: () -> void
 *    Remove the keydown listener and destroy the internal bus.
 *
 * ── Handler signature ────────────────────────────────────────────────────────
 *
 *  handler(element)(event)
 *    element — the DOM element passed to focusScope (null when no scope active)
 *    event   — the native KeyboardEvent
 */
const createKeymap = (opts = {}) => {
  const {
    debug  = false,
    target = typeof window !== 'undefined' ? window : null,
  } = opts;

  // Bus event names:
  //   "any:<comboKey>"              — global bindings
  //   "scope:<scopeId>:<comboKey>"  — scoped bindings
  // Bus payload: { element, event }
  const bus = createBus();

  // Canonical string from a parsed combo (used as part of bus event names)
  const _comboKey = c =>
    `${c.ctrl?1:0}${c.meta?1:0}${c.shift?1:0}${c.alt?1:0}:${c.key}`;

  // Canonical string derived directly from a KeyboardEvent
  const _comboFromEvent = e => {
    const k = _ALIASES[e.key.toLowerCase()] ?? e.key.toLowerCase();
    return _comboKey({ ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey, key: k });
  };

  // Metadata list for getBindings() — only display strings, no handlers
  let _meta   = { global: [], scoped: {} };
  let _active = null; // { id: string, element: Element | null } | null

  const _handleKey = e => {
    const element = _active?.element ?? null;
    const scopeId = _active?.id      ?? null;

    if (debug) {
      const mods = [
        e.ctrlKey  && 'Ctrl',
        e.metaKey  && '⌘',
        e.shiftKey && 'Shift',
        e.altKey   && 'Alt',
      ].filter(Boolean);
      console.debug(
        '[KeyMap] key:', [...mods, e.key].join('+'),
        '| scope:', scopeId ?? '(none)',
        '| element:', element,
      );
    }

    const payload = { element, event: e };
    const ck      = _comboFromEvent(e);

    // Scoped bindings fire first; global bindings always fire
    if (scopeId) bus.emit(`scope:${scopeId}:${ck}`, payload);
    bus.emit(`any:${ck}`, payload);
  };

  if (target) target.addEventListener('keydown', _handleKey);

  // ── Registration helpers ───────────────────────────────────────────────────

  // Wrap the bus off-fn to also remove the metadata entry on unbind
  const _register = busEvent => entry => slot => {
    const off = bus.on(busEvent, ({ element, event }) => entry.handler(element)(event));
    if (slot === 'global') {
      _meta = { ..._meta, global: [..._meta.global, entry.meta] };
    } else {
      _meta = {
        ..._meta,
        scoped: { ..._meta.scoped, [slot]: [...(_meta.scoped[slot] ?? []), entry.meta] },
      };
    }
    return () => {
      off();
      if (slot === 'global') {
        _meta = { ..._meta, global: _meta.global.filter(m => m !== entry.meta) };
      } else {
        _meta = {
          ..._meta,
          scoped: { ..._meta.scoped, [slot]: (_meta.scoped[slot] ?? []).filter(m => m !== entry.meta) },
        };
      }
    };
  };

  // addGlobal :: combo -> handler -> () -> void
  const addGlobal = combo => handler => {
    const parsed = parseCombo(combo);
    return _register(`any:${_comboKey(parsed)}`)
                    ({ handler, meta: { raw: combo, combo: formatCombo(parsed) } })
                    ('global');
  };

  // addScoped :: scopeId -> combo -> handler -> () -> void
  const addScoped = scopeId => combo => handler => {
    const parsed = parseCombo(combo);
    return _register(`scope:${scopeId}:${_comboKey(parsed)}`)
                    ({ handler, meta: { raw: combo, combo: formatCombo(parsed) } })
                    (scopeId);
  };

  // focusScope :: scopeId -> element -> void
  const focusScope = scopeId => element => { _active = { id: scopeId, element }; };

  // blurScope :: () -> void
  const blurScope = () => { _active = null; };

  // getActive :: () -> { id, element } | null
  const getActive = () => _active;

  // getBindings :: () -> { global, scoped }
  const getBindings = () => ({
    global: [..._meta.global],
    scoped: Object.fromEntries(
      Object.entries(_meta.scoped).map(([sid, ms]) => [sid, [...ms]])
    ),
  });

  const destroy = () => {
    if (target) target.removeEventListener('keydown', _handleKey);
    bus.destroy();
    _meta   = { global: [], scoped: {} };
    _active = null;
  };

  return Object.freeze({ addGlobal, addScoped, focusScope, blurScope, getActive, getBindings, destroy });
};

export { createKeymap, parseCombo, matchCombo, formatCombo };
