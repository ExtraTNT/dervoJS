/**
 * Demo state. Pure data — anything that talks to HbbTV or DOM lives elsewhere.
 * Components read state; the bus -> store wiring in main.js writes it.
 */

import { createStore } from '../src/index.js';

export const store = createStore({
  hbbtv:      false,                 // HbbTV capability detected at boot
  channel:    null,                  // { name, onid, tsid, sid } | null
  page:       'remote',              // 'remote' | 'broadcast'  — currently shown
  pageCursor: 'remote',              // page the user is hovering on (LEFT/RIGHT). OK commits.
  lastKey:    null,                  // latest semantic remote key
  buffer:     [],                    // [{ key, ts }] newest first, capped 16
  events:     [],                    // [{ name, text, ts }] newest first, capped 24
});

export const { getState, setState } = store;

//  Pure state-update helpers (kept here so the bus wiring in main.js stays short).

export const setBoot       = ({ hbbtv, channel }) => setState({ hbbtv, channel });
// Commit a page change — keeps page and pageCursor in sync so a direct
// jump (numeric) immediately moves the cursor too.
export const setPage       = page   => setState({ page, pageCursor: page });
export const setPageCursor = cursor => setState({ pageCursor: cursor });

export const pushKey   = key => setState(s => ({
  lastKey: key,
  buffer:  [{ key, ts: Date.now() }, ...s.buffer].slice(0, 16),
}));

export const pushEvent = ev => setState(s => ({
  events: [{ name: ev.name, text: ev.text, ts: Date.now() }, ...s.events].slice(0, 24),
}));
