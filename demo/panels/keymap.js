import { div, span, p, kbd, ul, li, strong, button } from '../../src/index.js';
import { Card, Stack, Badge }                         from '../../src/index.js';
import { setState, getState }                         from '../store.js';
import { createKeymap }                               from '../../src/components/KeyMap.js';
import { doc } from '../components/doc.js';
// ── Module-level keymap instance (created once at module load) ────────────────
const _km = createKeymap({ debug: true });

// ── Log helpers ───────────────────────────────────────────────────────────────
const _ts    = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const _entry = scope => key => action => ({ id: String(Date.now()) + String(Math.random()), ts: _ts(), scope, key, action });

const _log = scope => key => action => s => ({
  keymapDemo: {
    ...s.keymapDemo,
    log: [_entry(scope)(key)(action), ...s.keymapDemo.log.slice(0, 49)],
  },
});

// Guard: only act when the keymap demo tab is visible
const _active = () => getState().activeTab === 'keymap';

// ── Global bindings ───────────────────────────────────────────────────────────
//   ?         — toggle help overlay
//   Ctrl+L    — clear event log

_km.addGlobal('?')(_el => e => {
  if (!_active()) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  e.preventDefault();
  setState(s => ({
    keymapDemo: {
      ..._log('global')('?')('toggle help')(s).keymapDemo,
      showHelp: !s.keymapDemo.showHelp,
    },
  }));
});

_km.addGlobal('ctrl+l')(_el => e => {
  if (!_active()) return;
  e.preventDefault();
  setState(s => ({
    keymapDemo: { ...s.keymapDemo, log: [] },
  }));
});

// ── Zone A scoped bindings ────────────────────────────────────────────────────
//   ↑        — increment counter
//   ↓        — decrement counter
//   R        — reset counter to 0

_km.addScoped('zone-a')('arrowup')(_el => e => {
  e.preventDefault();
  setState(s => {
    const next = s.keymapDemo.zoneACount + 1;
    return { keymapDemo: { ..._log('Zone A')('↑')(`count → ${next}`)(s).keymapDemo, zoneACount: next } };
  });
});

_km.addScoped('zone-a')('arrowdown')(_el => e => {
  e.preventDefault();
  setState(s => {
    const next = s.keymapDemo.zoneACount - 1;
    return { keymapDemo: { ..._log('Zone A')('↓')(`count → ${next}`)(s).keymapDemo, zoneACount: next } };
  });
});

_km.addScoped('zone-a')('r')(_el => e => {
  e.preventDefault();
  setState(s => ({ keymapDemo: { ..._log('Zone A')('R')('counter reset')(s).keymapDemo, zoneACount: 0 } }));
});

// ── Zone B scoped bindings ────────────────────────────────────────────────────
//   Enter    — ping (uses the focused element's tag name)
//   Ctrl+↑   — bulk +5 pings
//   Ctrl+↓   — bulk −5 pings (floor 0)

_km.addScoped('zone-b')('enter')(el => e => {
  e.preventDefault();
  const tag = el?.tagName?.toLowerCase() ?? '?';
  setState(s => {
    const next = s.keymapDemo.zoneBPings + 1;
    return { keymapDemo: { ..._log('Zone B')('↵')(`ping #${next} via <${tag}>`)(s).keymapDemo, zoneBPings: next } };
  });
});

_km.addScoped('zone-b')('ctrl+arrowup')(_el => e => {
  e.preventDefault();
  setState(s => {
    const next = s.keymapDemo.zoneBPings + 5;
    return { keymapDemo: { ..._log('Zone B')('Ctrl+↑')(`pings → ${next}`)(s).keymapDemo, zoneBPings: next } };
  });
});

_km.addScoped('zone-b')('ctrl+arrowdown')(_el => e => {
  e.preventDefault();
  setState(s => {
    const next = Math.max(0, s.keymapDemo.zoneBPings - 5);
    return { keymapDemo: { ..._log('Zone B')('Ctrl+↓')(`pings → ${next}`)(s).keymapDemo, zoneBPings: next } };
  });
});

// ── Sub-components ────────────────────────────────────────────────────────────

const _scopeColor = scope =>
  scope === 'zone-a' ? 'var(--accent)'     :
  scope === 'zone-b' ? '#59a14f'         :
  scope === 'global' ? 'var(--text-muted)' : 'var(--text-muted)';

const _scopeLabel = scope =>
  scope === 'zone-a' ? 'Zone A' :
  scope === 'zone-b' ? 'Zone B' :
  scope === 'global' ? 'Global' : scope;

// Keyboard key chip
const Kb = text =>
  kbd({
    style: 'display:inline-flex; align-items:center; padding:1px 6px; font-family:ui-monospace,monospace; font-size:11px; font-weight:600; background:var(--surface-2); border:1px solid var(--border); border-bottom-width:2px; border-radius:4px; white-space:nowrap',
  })([text]);

// Binding description row
const BindingRow = combo => desc =>
  div({ style: 'display:flex; align-items:center; gap:8px; padding:3px 0' })([
    span({ style: 'min-width:100px' })([Kb(combo)]),
    span({ style: 'font-size:12px; color:var(--text-muted)' })([desc]),
  ]);

// Focus zone wrapper — tabIndex (camelCase) is required for dervoJS prop assignment;
// onclick calls .focus() explicitly so pointer events reliably activate the scope.
const FocusZone = isFocused => onFocus => onBlur => children =>
  div({
    tabIndex: 0,
    style: [
      'display:flex; flex-direction:column; gap:12px; padding:16px; border-radius:var(--radius);',
      'border:2px solid; cursor:default; outline:none; transition:border-color .15s, background .15s;',
      isFocused
        ? 'border-color:var(--accent); background:color-mix(in srgb, var(--accent) 5%, transparent)'
        : 'border-color:var(--border); background:var(--surface)',
    ].join(' '),
    onclick: e => e.currentTarget.focus(),
    onfocus: onFocus,
    onblur:  onBlur,
  })(children);

// Log entry row
const LogEntry = entry =>
  div({ key: entry.id, style: 'display:flex; align-items:baseline; gap:8px; padding:4px 0; border-bottom:1px solid var(--border); font-size:12px' })([
    span({ style: 'color:var(--text-muted); flex-shrink:0; font-family:monospace' })([entry.ts]),
    span({
      style: `flex-shrink:0; font-size:10px; font-weight:700; padding:1px 5px; border-radius:3px; background:color-mix(in srgb, ${_scopeColor(entry.scope)} 15%, transparent); color:${_scopeColor(entry.scope)}`,
    })([_scopeLabel(entry.scope)]),
    Kb(entry.key),
    span({ style: 'color:var(--text)' })([entry.action]),
  ]);

// Help overlay content
const HelpOverlay = () =>
  div({ style: 'display:flex; flex-direction:column; gap:16px; padding:16px; background:var(--surface-2); border-radius:var(--radius); border:1px solid var(--border)' })([
    div({ style: 'font-weight:700; font-size:13px' })(['⌘ KeyMap — binding reference']),
    div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:16px 32px' })([
      div({})([
        div({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:8px' })(['Global (always active)']),
        BindingRow('?')('Toggle this help overlay'),
        BindingRow('Ctrl+L')('Clear the event log'),
      ]),
      div({})([
        div({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:8px' })(['Zone A (when Zone A is focused)']),
        BindingRow('↑')('Increment counter'),
        BindingRow('↓')('Decrement counter'),
        BindingRow('R')('Reset counter to 0'),
      ]),
      div({})([
        div({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:8px' })(['Zone B (when Zone B is focused)']),
        BindingRow('↵')('Ping (logs focused element tag)'),
        BindingRow('Ctrl+↑')('Bulk +5 pings'),
        BindingRow('Ctrl+↓')('Bulk −5 pings'),
      ]),
    ]),
  ]);

// ── Panel ─────────────────────────────────────────────────────────────────────
export const keymapPanel = state => {
  const km          = state.keymapDemo ?? {};
  const log         = km.log ?? [];
  const activeScope = km.activeScope ?? null;
  const zoneACount  = km.zoneACount  ?? 0;
  const zoneBPings  = km.zoneBPings  ?? 0;
  const showHelp    = km.showHelp    ?? false;

  const isZoneA = activeScope === 'zone-a';
  const isZoneB = activeScope === 'zone-b';

  return div({ style: 'display:flex; flex-direction:column; gap:20px' })([

    // ── Header ──────────────────────────────────────────────────────────────
    Card({ title: '⌘ KeyMap' })([
      p({ style: 'margin:0 0 10px; font-size:13px; color:var(--text-muted)' })([
        'Purely functional global keyboard-event system. Bindings fire everywhere; scoped bindings only fire when the matching element has logical focus. Handlers receive the focused element as their first argument.',
      ]),
      div({ style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap' })([
        span({ style: 'font-size:12px; color:var(--text-muted)' })(['Active scope:']),
        activeScope
          ? Badge({ variant: 'primary' })([_scopeLabel(activeScope)])
          : Badge({ variant: 'gray' })(['none']),
        div({ style: 'flex:1' })([]),
        button({
          type:    'button',
          style:   'font-size:12px; padding:4px 10px; border:1px solid var(--border); border-radius:var(--radius); background:none; color:var(--text); cursor:pointer',
          onclick: () => setState(s => ({ keymapDemo: { ...s.keymapDemo, showHelp: !s.keymapDemo.showHelp } })),
        })([showHelp ? 'Hide help' : '? Show help']),
      ]),
    ]),

    // ── Help overlay ─────────────────────────────────────────────────────────
    ...(showHelp ? [HelpOverlay()] : []),

    // ── Focus zones ──────────────────────────────────────────────────────────
    div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:16px' })([

      FocusZone(isZoneA)
        (e => {
          _km.focusScope('zone-a')(e.currentTarget);
          setState(s => ({ keymapDemo: { ...s.keymapDemo, activeScope: 'zone-a' } }));
        })
        (() => {
          _km.blurScope();
          setState(s => ({ keymapDemo: { ...s.keymapDemo, activeScope: null } }));
        })
      ([
        div({ style: 'display:flex; align-items:center; gap:8px' })([
          span({ style: 'font-size:13px; font-weight:700' })(['Zone A']),
          isZoneA
            ? Badge({ variant: 'primary' })(['focused'])
            : span({ style: 'font-size:11px; color:var(--text-muted)' })(['click or Tab to focus']),
        ]),
        div({ style: 'display:flex; align-items:center; gap:12px' })([
          span({ style: 'font-size:32px; font-weight:700; font-variant-numeric:tabular-nums; min-width:52px; text-align:center' })([String(zoneACount)]),
          div({ style: 'display:flex; flex-direction:column; gap:4px' })([
            BindingRow('↑')('increment'),
            BindingRow('↓')('decrement'),
            BindingRow('R')('reset'),
          ]),
        ]),
      ]),

      FocusZone(isZoneB)
        (e => {
          _km.focusScope('zone-b')(e.currentTarget);
          setState(s => ({ keymapDemo: { ...s.keymapDemo, activeScope: 'zone-b' } }));
        })
        (() => {
          _km.blurScope();
          setState(s => ({ keymapDemo: { ...s.keymapDemo, activeScope: null } }));
        })
      ([
        div({ style: 'display:flex; align-items:center; gap:8px' })([
          span({ style: 'font-size:13px; font-weight:700' })(['Zone B']),
          isZoneB
            ? Badge({ variant: 'success' })(['focused'])
            : span({ style: 'font-size:11px; color:var(--text-muted)' })(['click or Tab to focus']),
        ]),
        div({ style: 'display:flex; align-items:center; gap:12px' })([
          span({ style: 'font-size:32px; font-weight:700; font-variant-numeric:tabular-nums; min-width:52px; text-align:center' })([String(zoneBPings)]),
          div({ style: 'display:flex; flex-direction:column; gap:4px' })([
            BindingRow('↵')('ping (logs element tag)'),
            BindingRow('Ctrl+↑')('+5 pings'),
            BindingRow('Ctrl+↓')('−5 pings'),
          ]),
        ]),
        isZoneB
          ? span({ style: 'font-size:11px; color:var(--text-muted); font-style:italic' })([
              'handler receives the focused <div> — tag name appears in log',
            ])
          : div({})([]),
      ]),

    ]),

    // ── Event log ────────────────────────────────────────────────────────────
    Card({ title: 'Event log' })([
      div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:10px' })([
        span({ style: 'font-size:12px; color:var(--text-muted)' })([
          log.length === 0 ? 'No events yet — try pressing ? or focusing a zone.' : `${log.length} event${log.length === 1 ? '' : 's'} (newest first, max 50)`,
        ]),
        div({ style: 'flex:1' })([]),
        button({
          type:    'button',
          style:   'font-size:11px; padding:3px 8px; border:1px solid var(--border); border-radius:var(--radius); background:none; color:var(--text-muted); cursor:pointer',
          onclick: () => setState(s => ({ keymapDemo: { ...s.keymapDemo, log: [] } })),
          title:   'Clear log (also Ctrl+L)',
        })(['⌘ Clear']),
      ]),
      div({ style: 'max-height:260px; overflow-y:auto' })([
        ...log.map(LogEntry),
      ]),
    ]),

    // ── Code snippet ─────────────────────────────────────────────────────────
    Card({ title: 'Usage' })([
      p({ style: 'margin:0 0 10px; font-size:13px; color:var(--text-muted)' })([
        'Create one instance, register bindings, wire focus events on your elements.',
      ]),
      doc([`import { createKeymap } from 'dervojs';

const km = createKeymap({ debug: true });

// Global — fires regardless of focus
km.addGlobal('ctrl+k')(el => e => {
  e.preventDefault();
  openSearch();
});

// Scoped — fires only when 'editor' scope is active
km.addScoped('editor')('ctrl+s')(el => e => {
  e.preventDefault();
  save(el.dataset.docId);  // el is the focused element
});

// Wire focus events on the element
div({
  tabindex: '0',
  onfocus: e => km.focusScope('editor')(e.currentTarget),
  onblur:  () => km.blurScope(),
})([...])

// Unbind later
const unbind = km.addGlobal('?')(el => e => { ... });
unbind(); // removes the binding`
      ]),
    ]),
  ]);
};
