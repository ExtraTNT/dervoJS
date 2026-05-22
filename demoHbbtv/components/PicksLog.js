/**
 * PicksLog — recently activated items. Wrapped in a single Focusable
 * scroll container so it can take focus from a neighbour; when focused
 * and overflowing, UP/DOWN scroll the log instead of moving focus. Once
 * the log is scrolled to its edge in that direction, the focus manager
 * jumps to the next neighbouring focusable.
 */

import { div, span, p, Badge } from '../../src/index.js';
import { Focusable } from './Focusable.js';

/**
 * @param {object} opts
 * @param {string} opts.id            focus id (e.g. 'list-picks', 'grid-picks')
 * @param {Array}  opts.picks         [{ from, item, ts }]
 * @param {object} opts.focus         state.focus
 * @param {string} [opts.maxHeight='300px']
 */
export const PicksLog = ({ id, picks = [], focus, maxHeight = '300px' } = {}) => {
  const body = picks.length === 0
    ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Nothing picked yet. Focus an item with the arrows, then press OK.',
      ])
    : div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:12px; font-family:ui-monospace, monospace' })(
        picks.map(p => div({ style: 'display:flex; gap:8px; align-items:baseline' })([
          span({ style: 'color:var(--text-muted)' })([new Date(p.ts).toLocaleTimeString()]),
          Badge({ variant: 'blue' })([p.from]),
          span({})([p.item]),
        ]))
      );

  return Focusable({
    id,
    focus,
    scroll: 'y',
    maxHeight,
    style: 'padding:8px; border:1px solid var(--border); border-radius:8px; background:var(--surface)',
  })([body]);
};
