/**
 * Page shell - title + focusable tabs (via the library's TabBar), content
 * area, footer key hints.
 *
 * All tab styling lives in the library - this file just maps page ids to
 * labels and renders the chrome.
 */

import { div, h1, span, kbd } from '../../src/elements.js';
import { Badge } from '../../src/components/Badge.js';
import { TabBar } from '../../src/components/HbbtvWidgets.js';

export const PAGES = ['remote', 'broadcast', 'list', 'grid'];

const PAGE_LABELS = {
  remote:    'Remote',
  broadcast: 'Broadcast',
  list:      'List',
  grid:      'Grid',
};

const _tabDefs = PAGES.map(id => ({ id, label: PAGE_LABELS[id] || id }));

export const Header = state => {
  const focusedTab = state.focus?.id?.startsWith('tab-') && state.focus.id.slice(4);
  const previewing = focusedTab && focusedTab !== state.page;
  return div({ style: 'display:flex; align-items:center; gap:14px; flex-wrap:wrap' })([
    h1({ style: 'margin:0; font-size:20px; font-weight:700' })(['dervoJS · HbbTV demo']),
    Badge({ variant: state.hbbtv ? 'green' : 'gray' })([
      state.hbbtv ? 'HbbTV detected' : 'Desktop fallback',
    ]),
    Badge({ variant: state.focus?.id ? 'green' : 'gray' })([
      state.focus?.id ? `focus: ${state.focus.id}` : 'no focus',
    ]),
    span({ style: 'flex:1; min-width:0' })([]),
    // row:'nav' confines LEFT/RIGHT to top tabs only - it can never drift down to a sub-tab or content.
    TabBar({ tabs: _tabDefs, current: state.page, focus: state.focus, row: 'nav', tabStyle: 'margin:0 4px' }),
    /*...(previewing
      ? [span({ style: 'font-size:11px; color:var(--accent)' })([
          'press ', kbd({})(['OK']), ' to switch',
        ])]
      : []),*/
      ([]),
  ]);
};

export const Footer = () =>
  div({ style: 'border-top:1px solid var(--border); padding-top:10px; font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:14px' })([
    span({})([
      kbd({})(['←']), kbd({})(['→']), kbd({})(['↑']), kbd({})(['↓']),
      ' scroll / jump · ',
      kbd({})(['OK']), ' switch / pick · ',
      kbd({})(['BACK']), ' back to tab · ',
      kbd({})(['RED']), '/', kbd({})(['GREEN']), '/', kbd({})(['YELLOW']), '/', kbd({})(['BLUE']),
    ]),
    span({})([
      'Desktop: ', kbd({})(['rgyb']), ' ', kbd({})(['arrows']), ' ', kbd({})(['space']), ' ', kbd({})(['esc']),
    ]),
  ]);

export const PageShell = (state, children) =>
  div({
    style: 'box-sizing:border-box; max-height:720px; overflow:hidden; max-width:1280px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:10px',
  })([
    Header(state),
    div({ style: 'flex:1; min-width:0; overflow:hidden' })(children),
    Footer(),
  ]);
