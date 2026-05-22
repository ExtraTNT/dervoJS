/**
 * Page 3 — long scrollable list (left) + scrollable picks log (right).
 *
 * Both are focusable. The list's outer container is itself a Focusable
 * with scroll='y' so the focus manager scroll-into-views the focused row
 * automatically. The picks log is a single Focusable scroll container —
 * UP/DOWN scrolls it; once at edge, focus jumps to the next neighbour.
 */

import { div, p, span, Card, Badge } from '../../src/index.js';
import { FocusList } from '../components/FocusList.js';
import { PicksLog }  from '../components/PicksLog.js';

export const LIST_ITEMS = Array.from({ length: 20 }, (_, i) => ({
  id:    `row-${(i + 1).toString().padStart(2, '0')}`,
  label: `List item #${(i + 1).toString().padStart(2, '0')}`,
}));

export const FIRST_LIST_FOCUS = LIST_ITEMS[0].id;

export const ListPage = state => {
  const inGroup = Boolean(state.focus?.id);

  return div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px; min-height:0' })([
    Card({ title: 'Scrollable list' })([
      div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
        Badge({ variant: inGroup ? 'green' : 'gray' })([inGroup ? 'navigating' : 'inactive']),
        span({ style: 'font-size:12px; color:var(--text-muted)' })([
          inGroup ? 'Arrows · OK · BACK' : 'Press ↓ to enter',
        ]),
      ]),
      // Plain scroll container — individual rows are focusable, and the
      // manager's scrollIntoView keeps the focused row visible.
      div({ style: 'max-height:420px; overflow-y:auto; padding:6px; border:1px solid var(--border); border-radius:8px' })([
        FocusList({
          items:  LIST_ITEMS,
          focus:  state.focus,
          render: (it, focused) =>
            div({ style: 'display:flex; justify-content:space-between; align-items:center' })([
              span({})([it.label]),
              ...(focused ? [span({ style: 'font-size:11px; color:var(--accent); font-weight:700' })(['◀'])] : []),
            ]),
        }),
      ]),
    ]),

    Card({ title: `Picks (${state.picks.length})` })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted); font-size:12px' })([
        'OK on the focused row appends here. Scroll with ↑/↓ when this card is focused.',
      ]),
      PicksLog({ id: 'list-picks', picks: state.picks, focus: state.focus, maxHeight: '300px' }),
    ]),
  ]);
};
