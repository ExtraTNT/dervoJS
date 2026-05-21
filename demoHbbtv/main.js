/**
 * Entry point: boots HbbTV onto a bus, wires the bus -> store and the bus
 * -> router, then mounts the view. Adding or removing pages requires no
 * changes here — only edits to router.js / pages/.
 */

import { initStyles, mount }                  from '../src/index.js';
import { bootHbbtv }                          from '../src/index.js';
import { store, setBoot, pushKey, pushEvent } from './store.js';
import { wireRouter }                         from './router.js';
import { PageShell }                          from './components/Layout.js';
import { RemotePage }                         from './pages/RemotePage.js';
import { BroadcastPage }                      from './pages/BroadcastPage.js';

initStyles();
document.body.style.cssText = 'margin:0; padding:0; background:var(--bg); color:var(--text); font-family:system-ui, sans-serif';
document.documentElement.style.boxSizing = 'border-box';

// boot HbbTV -> pub/sub bus
const bus = bootHbbtv();              // emits 'boot' | 'key' | 'stream'

// bus -> store wiring
bus.on('boot',   setBoot);
bus.on('key',    ({ key }) => pushKey(key));
bus.on('stream', pushEvent);

// bus -> router
wireRouter(bus);

// page registry + view
const PAGES = { remote: RemotePage, broadcast: BroadcastPage };

const view = state => PageShell(state, [
  (PAGES[state.page] || PAGES.remote)(state),
]);

mount(store)(document.body)(view);
