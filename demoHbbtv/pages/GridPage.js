/**
 * Page 4 — 4×4 grid of focusable cards (left) + scrollable picks log (right).
 * Spatial nav moves between cells; pressing RIGHT past column 4 jumps to
 * the picks log. UP/DOWN inside the log scrolls; once at the edge, focus
 * returns to the nearest grid cell.
 */

import { div, p, span, Card, Badge } from '../../src/index.js';
import { FocusGrid } from '../components/FocusGrid.js';
import { PicksLog }  from '../components/PicksLog.js';

export const GRID_COLS = 4;

export const GRID_ITEMS = Array.from({ length: 16 }, (_, i) => ({
  id:    `cell-${(i + 1).toString().padStart(2, '0')}`,
  label: `#${(i + 1).toString().padStart(2, '0')}`,
}));

export const FIRST_GRID_FOCUS = GRID_ITEMS[0].id;

export const GridPage = state => {
  const inGroup = Boolean(state.focus?.id);
  return div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; min-height:0' })([
    Card({ title: 'Selectable card grid' })([
      div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
        Badge({ variant: inGroup ? 'green' : 'gray' })([inGroup ? 'navigating' : 'inactive']),
        span({ style: 'font-size:12px; color:var(--text-muted)' })([
          inGroup ? 'Arrows · OK · BACK' : 'Press ↓ to enter',
        ]),
      ]),
      FocusGrid({
        items:  GRID_ITEMS,
        cols:   GRID_COLS,
        focus:  state.focus,
        render: (it, focused) =>
          div({ style: `font-size:${focused ? '20px' : '16px'}; transition:font-size 150ms` })([it.label]),
      }),
    ]),

    Card({ title: `Picks (${state.picks.length})` })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted); font-size:12px' })([
        'OK on a cell appends here. Scroll with ↑/↓ when this card is focused.',
      ]),
      PicksLog({ id: 'grid-picks', picks: state.picks, focus: state.focus, maxHeight: '320px' }),
    ]),
  ]);
};
