/**
 * Page 1 - visual mirror of the remote.
 *
 * Has two sub-pages selected via a sub-tab bar (TabBar with idPrefix='subtab-'):
 *
 *   pad    - visual pads + key buffer
 *   codes  - keycode debugging table (raw event vs decoded name)
 *
 * Sub-tab activation is dispatched by main.js via the 'activated' bus
 * event - the prefix tells the dispatcher which slice of state to update.
 */

import { div } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { TabBar } from '../../src/components/HbbtvWidgets.js';
import { ColourPad, NavPad, VcrPad, NumPad }   from '../components/Keypads.js';
import { KeyBuffer }                           from '../components/KeyBuffer.js';
import { KeycodeTable }                        from '../components/KeycodeTable.js';

const SUB_TABS = [
  { id: 'pad',   label: 'Pad'      },
  { id: 'codes', label: 'Keycodes' },
];

const _padView = state =>
  div({ style: 'display:flex; flex-direction:column; gap:6px' })([
    div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px' })([
      ColourPad(state.lastKey),
      VcrPad(state.lastKey),
    ]),
    div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px' })([
      NavPad(state.lastKey),
      NumPad(state.lastKey),
    ]),
    Card({ title: `Key buffer (${state.buffer.length}/30)` })([KeyBuffer(state.buffer)]),
  ]);

const _codesView = state =>
  Card({ title: `Keycodes (${state.buffer.length}/30)` })([
    KeycodeTable(state.buffer),
  ]);

const SUB_VIEWS = { pad: _padView, codes: _codesView };

export const RemotePage = state => {
  const sub  = state.subPages?.remote || 'pad';
  const view = SUB_VIEWS[sub] || _padView;
  return div({ style: 'display:flex; flex-direction:column; gap:8px; min-height:0' })([
    // row:'subnav' isolates LEFT/RIGHT to sub-tabs - UP still reaches the
    // top tabs (row='nav'), DOWN still reaches the content area.
    TabBar({
      tabs:    SUB_TABS,
      current: sub,
      focus:   state.focus,
      idPrefix:'subtab-',
      row:     'subnav',
      tabStyle:'margin:0 4px',
    }),
    view(state),
  ]);
};
