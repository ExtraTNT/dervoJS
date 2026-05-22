/**
 * Renders the current DVB channel (network/transport/service ids) or a
 * friendly "no broadcast" message when running off a TV.
 */

import { div, p, span } from '../../src/index.js';

const row = k => v => [
  span({ style: 'color:var(--text-muted)' })([k]),
  span({ style: 'font-family:ui-monospace,monospace; word-break:break-all' })([String(v)]),
];

export const ChannelInfo = channel =>
  !channel
    ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'No broadcast channel — running outside a TV.',
      ])
    : div({ style: 'display:grid; grid-template-columns:max-content 1fr; gap:6px 16px; font-size:13px' })([
        row('Name')      (channel.name ?? '—'),
        row('Network')   (channel.onid),
        row('Transport') (channel.tsid),
        row('Service')   (channel.sid),
      ]);
