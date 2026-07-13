/**
 * Page 3 - long scrollable list (left) + scrollable picks log (right).
 * Both sides reachable via spatial nav from the tab bar above.
 */

import { div, p, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Badge } from '../../src/components/Badge.js';
import { FocusList } from '../../src/components/HbbtvWidgets.js';
import { PicksLog } from '../components/PicksLog.js';

export const LIST_ITEMS = Array.from({ length: 20 }, (_, i) => ({
  id:    `row-${(i + 1).toString().padStart(2, '0')}`,
  label: `List item #${(i + 1).toString().padStart(2, '0')}`,
}));

const _twoUp = 'display:grid; grid-template-columns:1fr 1fr; gap:14px; min-height:0';

export const ListPage = state =>
  div({ style: _twoUp })([
    Card({ title: 'Scrollable list' })([
      // Plain scroll container - individual rows are focusable, the
      // manager keeps the focused row visible via scrollIntoView.
      div({ style: 'max-height:420px; overflow-y:auto; padding:6px; border:1px solid var(--border); border-radius:8px' })([
        FocusList({
          items:  LIST_ITEMS,
          focus:  state.focus,
          gap: '4px',
          render: (it, focused) =>
            div({ style: 'display:flex; justify-content:space-between; align-items:center;' })([
              span({})([it.label]),
              ...(focused ? [Badge()(['◀'])] : []),
            ]),
        }),
      ]),
    ]),
    Card({ title: `Picks (${state.picks.length})` })([
      p({ style: 'margin:0 0 8px; color:var(--text-muted); font-size:12px' })([
        'OK on a row appends here. When this card is focused, ↑/↓ scroll it.',
      ]),
      PicksLog({ id: 'list-picks', picks: state.picks, focus: state.focus }),
    ]),
  ]);
