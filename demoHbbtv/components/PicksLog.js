/**
 * PicksLog — formatting of the demo's "what was activated" trail.
 *
 * The scroll-container behaviour lives in the library (FocusScroll); this
 * component is just the row formatting.
 */

import { div, span, p, Badge, FocusScroll } from '../../src/index.js';

/**
 * @param {Object} opts
 * @param {string} opts.id            focus id for the scroll container
 * @param {Array}  opts.picks         [{ from, item, ts }]
 * @param {Object} opts.focus         state.focus
 * @param {string} [opts.maxHeight='300px']
 */
export const PicksLog = ({ id, picks = [], focus, maxHeight = '300px' } = {}) =>
  FocusScroll({ id, focus, axis: 'y', maxHeight })([
    picks.length === 0
      ? p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
          'Nothing picked yet. Focus an item with the arrows, then press OK.',
        ])
      : div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:12px; font-family:ui-monospace, monospace;margin:2px' })(
          picks.map(p => div({ style: 'display:flex; gap:8px; align-items:baseline' })([
            span({ style: 'color:var(--text-muted)' })([new Date(p.ts).toLocaleTimeString()]),
            Badge({ variant: 'blue' })([p.from]),
            span({})([p.item]),
          ]))
        ),
  ]);
