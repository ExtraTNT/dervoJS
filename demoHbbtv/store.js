/**
 * Demo state. Pure data — anything that talks to HbbTV or DOM lives elsewhere.
 * Components read state; the bus -> store wiring in main.js writes it.
 */

import { createStore } from '../src/index.js';

export const store = createStore({
  hbbtv:        false,                 // HbbTV capability detected at boot
  channel:      null,                  // { name, onid, tsid, sid } | null
  page:         'remote',              // currently shown page id
  subPages:     { remote: 'pad' },     // per-page sub-view memory: { pageId: subId }
  lastKey:      null,                  // latest semantic remote key name
  buffer:       [],                    // [{ key, code, which, keyStr, ts }] newest first, cap 30
  events:       [],                    // [{ name, text, ts }] newest first, cap 24
  focus:        { id: null },          // managed by createFocusManager
  picks:        [],                    // [{ from, item, ts }] — log for the demo pages
  profilerOpen: false,                 // floating debug panel toggle (combo: 9-9-1)
});

export const { getState, setState } = store;

//  Pure state-update helpers (kept here so the bus wiring in main.js stays short).

export const setBoot       = ({ hbbtv, channel }) => setState({ hbbtv, channel });
export const setPage       = page                  => setState({ page });
export const setSubPage    = (page, sub)           => setState(s => ({
  subPages: { ...s.subPages, [page]: sub },
}));
export const toggleProfiler = () => setState(s => ({ profilerOpen: !s.profilerOpen }));

// Buffer now stores raw event fields too — for the keycode debugging table.
export const pushKey = (key, raw) => setState(s => ({
  lastKey: key,
  buffer:  [{
    key,
    code:   raw?.keyCode ?? null,
    which:  raw?.which   ?? null,
    keyStr: raw?.key     ?? null,
    ts:     Date.now(),
  }, ...s.buffer].slice(0, 30),
}));

export const pushEvent = ev => setState(s => ({
  events: [{ name: ev.name, text: ev.text, ts: Date.now() }, ...s.events].slice(0, 24),
}));

export const pushPick = pick => setState(s => ({
  picks: [{ ...pick, ts: Date.now() }, ...s.picks].slice(0, 120),
}));
