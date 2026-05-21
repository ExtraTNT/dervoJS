/**
 * Page shell — top bar with title + page tabs, scrollable content, footer
 * with key hints. TV-friendly 1280px max width.
 */

import { div, h1, span, kbd, Badge } from '../../src/index.js';
import { PAGES } from '../router.js';

const PAGE_LABELS = {
  remote:    'Remote',
  broadcast: 'Broadcast',
};

const _tab = (id, active) =>
  div({
    style: `padding:6px 14px; border-radius:16px; font-size:13px; font-weight:600; border:1px solid var(--border); background:${active ? 'var(--accent)' : 'var(--surface)'}; color:${active ? '#fff' : 'var(--text)'}`,
  })([PAGE_LABELS[id] || id]);

export const Header = state =>
  div({ style: 'display:flex; align-items:center; gap:14px; flex-wrap:wrap' })([
    h1({ style: 'margin:0; font-size:20px; font-weight:700' })(['dervoJS · HbbTV demo']),
    Badge({ variant: state.hbbtv ? 'green' : 'gray' })([
      state.hbbtv ? 'HbbTV detected' : 'Desktop fallback',
    ]),
    span({ style: 'flex:1; min-width:0' })([]),
    div({ style: 'display:flex; gap:6px' })(PAGES.map(p => _tab(p, p === state.page))),
  ]);

export const Footer = () =>
  div({ style: 'border-top:1px solid var(--border); padding-top:10px; font-size:12px; color:var(--text-muted); display:flex; flex-wrap:wrap; gap:12px' })([
    span({})([kbd({})(['←']), ' / ', kbd({})(['->']), ' switch page · ', kbd({})(['1']), '/', kbd({})(['2']), ' jump']),
    span({})(['Desktop: ', kbd({})(['r']), kbd({})(['g']), kbd({})(['y']), kbd({})(['b']), ' colours · ', kbd({})(['arrows']), ' / ', kbd({})(['space']), ' nav/OK · ', kbd({})(['esc']), ' back']),
  ]);

export const PageShell = (state, children) =>
  div({
    style: 'box-sizing:border-box; max-height:720px; overflow: hidden; max-width:1280px; margin:0 auto; padding:16px; display:flex; flex-direction:column; gap:6px',
  })([
    Header(state),
    div({ style: 'flex:1; min-width:0' })(children),
    Footer(),
  ]);
