/**
 * Page shell — top bar with title + focusable page tabs, content area,
 * footer with key hints.
 *
 * Tabs are real focusables (data-focus="tab-<pageId>"), so spatial nav
 * reaches them from any content focusable. Two visual states:
 *
 *   - active page tab     ->  solid accent fill (looks "selected")
 *   - focused tab         ->  accent box-shadow halo (looks "you're here")
 *
 * The two combine: the active tab that's also focused gets the fill *and*
 * the halo. A non-active focused tab means "press OK to switch".
 */

import { div, h1, span, kbd, Badge } from '../../src/index.js';
import { Focusable } from './Focusable.js';

export const PAGES = ['remote', 'broadcast', 'list', 'grid'];

const PAGE_LABELS = {
  remote:    'Remote',
  broadcast: 'Broadcast',
  list:      'List',
  grid:      'Grid',
};

const _tab = (id, isActive, focus) => {
  const fill = isActive
    ? 'background:var(--accent); color:#fff'
    : 'background:var(--surface); color:var(--text)';
  return Focusable({
    id:    `tab-${id}`,
    focus,
    style: `padding:5px 14px; border-radius:16px; font-size:13px; font-weight:600; border:1px solid var(--border); transition:all 150ms; ${fill}`,
    // Override the default outline with a halo that reads on both accent
    // and surface backgrounds.
    activeStyle: 'box-shadow:0 0 0 3px var(--accent), 0 0 0 5px rgba(255,255,255,0.15); outline:none',
  })([PAGE_LABELS[id] || id]);
};

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
    div({ style: 'display:flex; gap:8px; align-items:center; padding:4px' })([
      ...PAGES.map(p => _tab(p, p === state.page, state.focus)),
      ...(previewing
        ? [span({ style: 'font-size:11px; color:var(--accent); margin-left:6px' })([
            'press ', kbd({})(['OK']), ' to switch',
          ])]
        : []),
    ]),
  ]);
};

export const Footer = state =>
  div({ style: 'border-top:1px solid var(--border); padding-top:10px; font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:14px' })([
    span({})([
      kbd({})(['←']), kbd({})(['->']), kbd({})(['↑']), kbd({})(['↓']),
      ' scroll or jump to the nearest neighbour · ',
      kbd({})(['OK']), ' switch / pick · ',
      kbd({})(['BACK']), ' return to the page tab · ',
      kbd({})(['1']), '-', kbd({})(['4']), ' direct page · ',
      kbd({})(['RED']), '/', kbd({})(['GREEN']), '/', kbd({})(['YELLOW']), '/', kbd({})(['BLUE']), ' shortcut',
    ]),
    span({})([
      'Desktop: ', kbd({})(['r']), kbd({})(['g']), kbd({})(['y']), kbd({})(['b']), ' colours · ',
      kbd({})(['arrows']), ' / ', kbd({})(['space']), ' / ', kbd({})(['esc']),
    ]),
  ]);

export const PageShell = (state, children) =>
  div({
    style: 'box-sizing:border-box; max-height:720px; overflow:hidden; max-width:1280px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:10px',
  })([
    Header(state),
    div({ style: 'flex:1; min-width:0; overflow:hidden' })(children),
    Footer(state),
  ]);
