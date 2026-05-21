/**
 * Page 1 — visual mirror of the remote: colour buttons, D-pad, VCR, numerics,
 * plus the rolling key buffer.
 */

import { div, Card } from '../../src/index.js';
import { ColourPad, NavPad, VcrPad, NumPad } from '../components/Keypads.js';
import { KeyBuffer } from '../components/KeyBuffer.js';

export const RemotePage = state =>
  div({ style: 'display:flex; flex-direction:column; gap:6px' })([
    div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px' })([
      ColourPad(state.lastKey),
      VcrPad(state.lastKey),
    ]),
    div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px' })([
      NavPad(state.lastKey),
      NumPad(state.lastKey),
    ]),
    Card({ title: `Key buffer (${state.buffer.length}/16)` })([KeyBuffer(state.buffer)]),
  ]);
