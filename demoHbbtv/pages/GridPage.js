/**
 * Page 4 — 4×4 grid of focusable cards (left) + scrollable picks log (right).
 */

import { div, p, Card, FocusGrid } from '../../src/index.js';
import { PicksLog } from '../components/PicksLog.js';

export const GRID_COLS  = 4;
export const GRID_ITEMS = Array.from({ length: 16 }, (_, i) => ({
  id:    `cell-${(i + 1).toString().padStart(2, '0')}`,
  label: `#${(i + 1).toString().padStart(2, '0')}`,
}));

const _twoUp = 'display:grid; grid-template-columns:1fr 1fr; gap:14px; min-height:0';

export const GridPage = state =>
  div({ style: _twoUp })([
    Card({ title: 'Selectable card grid' })([
      FocusGrid({
        items: GRID_ITEMS,
        cols:  GRID_COLS,
        focus: state.focus,
        gap: '4px'
      }),
    ]),
    Card({ title: `Picks (${state.picks.length})` })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted); font-size:12px' })([
        'OK on a cell appends here. When this card is focused, ↑/↓ scroll it.',
      ]),
      PicksLog({ id: 'grid-picks', picks: state.picks, focus: state.focus }),
    ]),
  ]);
