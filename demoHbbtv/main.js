/**
 * Entry point. Wiring only:
 *
 *   HbbTV  →  bus.emit('key', ...)
 *   bus    →  focus manager  (arrows / OK / BACK)
 *   bus    →  activation dispatcher (tab/subtab/row/cell ids → state)
 *   bus    →  router  (numeric + colour-button shortcuts, except colours
 *                       that conflict with games - see router.js)
 *   bus    →  onKeyCombo '991' → toggle the floating profiler
 *
 * The profiler itself is the standard dervoJS combo of FloatingPanel +
 * StateDebugger + RenderProfiler + ListenersDebugger.
 */

import { initStyles } from '../src/styles.js';
import { mount, disableProfiler } from '../src/state.js';
import { bootHbbtv, createFocusManager, onKeyCombo } from '../src/hbbtv.js';
import { FloatingPanel } from '../src/components/FloatingPanel.js';
import { StateDebugger } from '../src/components/StateDebugger.js';
import { RenderProfiler } from '../src/components/RenderProfiler.js';
import { ListenersDebugger } from '../src/components/ListenersDebugger.js';
import {
  store, setBoot, pushKey, pushEvent, pushPick,
  setPage, setSubPage, toggleProfiler, getState,
} from './store.js';
import { wireRouter }    from './router.js';
import { PageShell }     from './components/Layout.js';
import { RemotePage }    from './pages/RemotePage.js';
import { BroadcastPage } from './pages/BroadcastPage.js';
import { ListPage }      from './pages/ListPage.js';
import { GridPage }      from './pages/GridPage.js';

initStyles({ noLink: true});
document.body.style.cssText = 'margin:0; padding:0; background:var(--bg); color:var(--text); font-family:system-ui, sans-serif';
document.documentElement.style.boxSizing = 'border-box';

// boot HbbTV → pub/sub bus 
const bus = bootHbbtv();

// bus → store wiring 
bus.on('boot',   setBoot);
bus.on('key',    ({ key, raw }) => pushKey(key, raw));
bus.on('stream', pushEvent);

// focus manager 
const fm = createFocusManager({
  bus, store,
  home: () => `tab-${getState().page}`,
});

// activation dispatcher 
bus.on('activated', ({ id }) => {
  if (id.startsWith('tab-'))    return setPage(id.slice(4));
  if (id.startsWith('subtab-')) return setSubPage(getState().page, id.slice(7));
  if (id.startsWith('row-'))    return pushPick({ from: 'list', item: id });
  if (id.startsWith('cell-'))   return pushPick({ from: 'grid', item: id });
});

//   debug combo: 9-9-1 within 1s toggles the floating profiler 
onKeyCombo(bus, '991', toggleProfiler);

//   direct-jump shortcuts (colour buttons only - numerics intentionally off) 
wireRouter(bus, fm);

//   initial focus: the active tab 
fm.focus(`tab-${getState().page}`);

//   pages + view 
const PAGES = {
  remote:    RemotePage,
  broadcast: BroadcastPage,
  list:      ListPage,
  grid:      GridPage,
};

const profilerPanel = state => FloatingPanel({
  id:       'demo-profiler',
  title:    'Profiler · 9-9-1 toggle',
  open:     state.profilerOpen,
  onClose:  () => { toggleProfiler(); disableProfiler(); },
  initialX: 0, initialY: 0,
  initialW: 920, initialH: 260,
})([
  //StateDebugger({ state, setState: store.setState, getState }),
  RenderProfiler({ setState: store.setState, active: state.profilerOpen }),
  //ListenersDebugger({ setState: store.setState }),
]);

const view = state => [
  PageShell(state, [(PAGES[state.page] || PAGES.remote)(state)]),
  profilerPanel(state),
];

mount(store)(document.body)(view);
