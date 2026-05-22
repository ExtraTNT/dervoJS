/**
 * Demo state. Pure data — anything that talks to HbbTV or DOM lives elsewhere.
 * Components read state; the bus -> store wiring in main.js writes it.
 */

import { createStore } from '../src/index.js';

export const store = createStore({
  hbbtv:      false,                 // HbbTV capability detected at boot
  channel:    null,                  // { name, onid, tsid, sid } | null
  page:       'remote',              // currently shown page id — set by the tab-activation dispatcher
  lastKey:    null,                  // latest semantic remote key
  buffer:     [],                    // [{ key, ts }] newest first, capped 16
  events:     [],                    // [{ name, text, ts }] newest first, capped 24
  focus:      { id: null },          // managed by createFocusManager — DOM-driven spatial nav
  picks:      [],                    // [{ from, item, ts }] — log for the demo pages
});

export const { getState, setState } = store;

//  Pure state-update helpers (kept here so the bus wiring in main.js stays short).

export const setBoot = ({ hbbtv, channel }) => setState({ hbbtv, channel });
export const setPage = page                  => setState({ page });
export const pushKey = key => setState(s => ({
  lastKey: key,
  buffer:  [{ key, ts: Date.now() }, ...s.buffer].slice(0, 16),
}));

export const pushEvent = ev => setState(s => ({
  events: [{ name: ev.name, text: ev.text, ts: Date.now() }, ...s.events].slice(0, 24),
}));

// Append to the pick log
export const pushPick = pick => setState(s => ({
  picks: [{ ...pick, ts: Date.now() }, ...s.picks].slice(0, 120),
}));
