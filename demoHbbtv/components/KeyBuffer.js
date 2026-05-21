/**
 * Rolling history of the most recent remote keypresses.
 */

import { div, span, p } from '../../src/index.js';

export const KeyBuffer = buffer => buffer.length === 0
  ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })(['Press a remote key…'])
  : div({ style: 'display:flex; flex-wrap:wrap; gap:6px' })(
      buffer.map(b => span({
        style: 'padding:3px 9px; border:1px solid var(--border); border-radius:14px; font-family:ui-monospace,monospace; font-size:12px',
      })([b.key]))
    );
