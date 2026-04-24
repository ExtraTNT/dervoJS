import { div, strong, p } from '../../src/index.js';
import { StateDebugger }  from '../../src/index.js';
import { setState, getState } from '../store.js';

export const debugPanel = state =>
  div({ style: 'padding:24px; display:flex; flex-direction:column; gap:16px;' })([
    div({ style: 'display:flex; flex-direction:column; gap:4px' })([
      strong({ style: 'font-size:18px' })(['State Debugger']),
      p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Live inspector for the demo store. Click any value to edit it as JSON. ' +
        'Hover 👁 on a key to watch it — changes will appear in the log on the right. ' +
        '+ Add inserts new keys; ✕ removes them.',
      ]),
    ]),
    StateDebugger({ state, setState, getState }),
  ]);
