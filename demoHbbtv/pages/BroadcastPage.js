/**
 * Page 2 — DVB channel info + DSM-CC stream events log.
 */

import { div, Card } from '../../src/index.js';
import { ChannelInfo }  from '../components/ChannelInfo.js';
import { StreamEvents } from '../components/StreamEvents.js';

export const BroadcastPage = state =>
  div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px' })([
    Card({ title: 'DVB channel' })([ChannelInfo(state.channel)]),
    Card({ title: `Stream events (${state.events.length}/24)` })([StreamEvents(state.events)]),
  ]);
