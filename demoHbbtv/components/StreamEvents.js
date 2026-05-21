/**
 * Scrollable log of DSM-CC stream events.
 */

import { div, p, span, Badge } from '../../src/index.js';

export const StreamEvents = events =>
  events.length === 0
    ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Waiting for DSM-CC stream events…',
      ])
    : div({
        style: 'display:flex; flex-direction:column; gap:4px; max-height:260px; overflow-y:auto; font-family:ui-monospace,monospace; font-size:12px',
      })(events.map(ev =>
        div({ style: 'display:flex; gap:8px; align-items:baseline; min-width:0' })([
          span({ style: 'color:var(--text-muted); flex-shrink:0' })([new Date(ev.ts).toLocaleTimeString()]),
          Badge({ variant: 'blue' })([ev.name || '?']),
          span({ style: 'min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap' })([ev.text || '']),
        ])
      ));
