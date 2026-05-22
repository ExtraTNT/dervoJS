/**
 * Entry point. Everything below is wiring — the running app is just:
 *
 *   HbbTV  ->  bus.emit('key', ...)
 *   bus    ->  focus manager (owns arrows / OK / BACK)
 *   bus    ->  activation dispatcher (tab id -> setPage, row/cell -> pushPick)
 *   bus    ->  router (numerics + colour-button shortcuts)
 *
 * Focus is always somewhere. On boot the active page's tab gets focus;
 * BACK from anywhere snaps back to it (see `home` below). Arrow keys are
 * spatial — the tabs sit *above* the content, so UP from a content
 * focusable lands on a tab, DOWN from a tab enters the content.
 */

import { initStyles, mount, createFocusManager, bootHbbtv } from '../src/index.js';
import { store, setBoot, pushKey, pushEvent, pushPick, setPage, getState } from './store.js';
import { wireRouter }                                        from './router.js';
import { PageShell }                                         from './components/Layout.js';
import { RemotePage }                                        from './pages/RemotePage.js';
import { BroadcastPage }                                     from './pages/BroadcastPage.js';
import { ListPage }                                          from './pages/ListPage.js';
import { GridPage }                                          from './pages/GridPage.js';

initStyles();
document.body.style.cssText = 'margin:0; padding:0; background:var(--bg); color:var(--text); font-family:system-ui, sans-serif';
document.documentElement.style.boxSizing = 'border-box';

//  ───── boot HbbTV -> pub/sub bus ─────
const bus = bootHbbtv();

//  ───── bus -> store wiring (read-only mirrors) ─────
bus.on('boot',   setBoot);
bus.on('key',    ({ key }) => pushKey(key));
bus.on('stream', pushEvent);

//  ───── focus manager — central, DOM-driven, spatial ─────
const fm = createFocusManager({
  bus, store,
  // BACK destination: always the current page's tab. Pressing BACK from a
  // row jumps back up to the tab bar; pressing BACK while on the tab is a
  // no-op (the user can never get "lost" with focus = null).
  home: () => `tab-${getState().page}`,
});

//  ───── activation dispatcher (decoupled via the bus) ─────
bus.on('activated', ({ id }) => {
  if (id.startsWith('tab-'))  return setPage(id.slice(4));
  if (id.startsWith('row-'))  return pushPick({ from: 'list', item: id });
  if (id.startsWith('cell-')) return pushPick({ from: 'grid', item: id });
  // picks-log activation is a no-op — it's a scroll container, not a pickable.
});

//  ───── direct-jump shortcuts (numerics + colour buttons) ─────
wireRouter(bus, fm);

//  ───── initial focus: the active tab ─────
fm.focus(`tab-${getState().page}`);

//  ───── page registry + view ─────
const PAGES = {
  remote:    RemotePage,
  broadcast: BroadcastPage,
  list:      ListPage,
  grid:      GridPage,
};

const view = state => PageShell(state, [
  (PAGES[state.page] || PAGES.remote)(state),
]);

mount(store)(document.body)(view);
