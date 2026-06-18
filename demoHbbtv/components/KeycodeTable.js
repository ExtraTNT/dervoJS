/**
 * KeycodeTable - debug aid. Shows the raw event fields side-by-side with
 * the decoded semantic name for the last N keypresses, newest first.
 * Useful when bringing a new HbbTV STB up: confirm which keyCode the box
 * actually fires for VK_RED, VK_BACK, etc.
 */

import { div, span, p, Badge, Table } from '../../src/index.js';

const _fmtTime = ts =>
  new Date(ts).toLocaleTimeString() + '.' + String(ts % 1000).padStart(3, '0');

const COLS = [
  { key: 'time',   label: 'Time' },
  { key: 'key',    label: 'Decoded', render: v => Badge({ variant: 'blue' })([String(v)]) },
  { key: 'keyStr', label: 'e.key',   render: v => span({ style: 'font-family:ui-monospace,monospace' })([String(v ?? '-')]) },
  { key: 'code',   label: 'keyCode', render: v => span({ style: 'font-family:ui-monospace,monospace' })([String(v ?? '-')]) },
  { key: 'which',  label: 'which',   render: v => span({ style: 'font-family:ui-monospace,monospace' })([String(v ?? '-')]) },
];

export const KeycodeTable = buffer => buffer.length === 0
  ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Press any remote key to populate.',
    ])
  : Table({
      columns: COLS,
      rows:    buffer.map(b => ({ ...b, time: _fmtTime(b.ts) })),
      scroll:  true,
      maxHeight: '380px',
    });
