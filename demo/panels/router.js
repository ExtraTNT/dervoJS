import {
  div, span, p, strong, code,
  Card, Badge, Alert, Row, Col,
  NavBar, NavMenu, NavLink, Breadcrumbs,
  createRouter,
} from '../../src/index.js';
import { setState, getState } from '../store.js';
import { doc } from '../components/doc.js';

// ── Module-level router instance ──────────────────────────────────────────
// Reuse the same instance across renders. Lazily created on first render.
let _router = null;

const _ensureRouter = () => {
  if (_router) return;
  _router = createRouter([
    { path: '/',         handler: ctx => setState({ routerDemo: { ...getState().routerDemo, page: 'home',     ctx } }) },
    { path: '/about',    handler: ctx => setState({ routerDemo: { ...getState().routerDemo, page: 'about',    ctx } }) },
    { path: '/user/:id', handler: ctx => setState({ routerDemo: { ...getState().routerDemo, page: 'user',     ctx } }) },
    { path: '/search',   handler: ctx => setState({ routerDemo: { ...getState().routerDemo, page: 'search',   ctx } }) },
    { path: '*',         handler: ctx => setState({ routerDemo: { ...getState().routerDemo, page: '404',      ctx } }) },
  ], { mode: 'hash', base: '/demo' })({
    onChange: ctx => setState(s => ({ routerDemo: { ...s.routerDemo, currentPath: ctx.path } })),
  });
};

const pConP = p({ style: 'margin:4px 0 0; color:var(--text-muted)' })

const _pageContent = (page, ctx) => {
  if (page === 'home')   return div({})([strong({})(['Home']), pConP(['Welcome to the router demo.'])]);
  if (page === 'about')  return div({})([strong({})(['About']), pConP(['This page was rendered by the router.'])]);
  if (page === 'user')   return div({})([strong({})([`User: ${ctx?.params?.id ?? '?'}`]), pConP(['Named param extracted from the path.'])]);
  if (page === 'search') return div({})([strong({})(['Search']), pConP([`query.q = ${ctx?.query?.q ?? '(none)'}`])]);
  return div({})([strong({ style: 'color:var(--danger)' })(['404']), pConP(['No route matched.'])]);
};

export const routerPanel = state => {
  _ensureRouter();
  const rd      = state.routerDemo ?? {};
  const page    = rd.page ?? 'home';
  const path    = rd.currentPath ?? '/';
  const ctx     = rd.ctx ?? {};
  const push    = p => _router.push(p);

  const crumbs = [
    { label: 'Demo', href: '/' },
    ...(page === 'home'   ? [{ label: 'Home' }] : []),
    ...(page === 'about'  ? [{ label: 'About' }] : []),
    ...(page === 'user'   ? [{ label: 'Users', href: '/user/1' }, { label: ctx.params?.id ?? 'User' }] : []),
    ...(page === 'search' ? [{ label: 'Search' }] : []),
    ...(page === '404'    ? [{ label: '404' }] : []),
  ];

  return div({ style: 'display:flex; flex-direction:column; gap:16px' })([
    Card({ title: 'Info' })([
        Alert({ variant: 'warning' })([
            p({style: 'margin:0 0 12px; font-size:13px;'})([
                'This component is supposed to wrap the entire site and not be standalone like in this demo. You\'ve been warned!'
            ]),
        ]),
    ]),
    Card({ title: 'createRouter — hash mode with :param and wildcard' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Routes are matched in order. Named segments (',
        code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })([':id']),
        ') land in ',
        code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })(['params']),
        '. Query strings land in ',
        code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })(['query']),
        '.',
      ]),

      // ── NavBar demo ──────────────────────────────────────────────────
      div({ style: 'margin-bottom:12px' })([
        span({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted)' })(['NavBar (horizontal)']),
        div({ style: 'margin-top:6px; padding:8px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius)' })([
          NavBar({ gap: 20 })([
            NavLink({ href: '/',       current: path, push, exact: true,  style: 'padding:4px 8px; border-radius:var(--radius)' })(['Home']),
            NavLink({ href: '/about',  current: path, push,               style: 'padding:4px 8px; border-radius:var(--radius)' })(['About']),
            NavLink({ href: '/user/1', current: path, push,               style: 'padding:4px 8px; border-radius:var(--radius)' })(['User 1']),
            NavLink({ href: '/search?q=dervo', current: path, push,       style: 'padding:4px 8px; border-radius:var(--radius)' })(['Search']),
          ]),
        ]),
      ]),

      // ── Row: NavMenu + page content ──────────────────────────────────
      Row({ gap: 16 })([
        Col({ span: 12, md: 4 })([
          div({ style: 'padding:8px 0; border-right:1px solid var(--border)' })([
            span({ style: 'display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin-bottom:8px; padding:0 8px' })(['NavMenu (sidebar)']),
            NavMenu({ gap: 2 })([
              NavLink({ href: '/',       current: path, push, exact: true, style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['🏠 Home']),
              NavLink({ href: '/about',  current: path, push,              style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['About']),
              NavLink({ href: '/user/1', current: path, push,              style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['👤 User 1']),
              NavLink({ href: '/user/2', current: path, push,              style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['👤 User 2']),
              NavLink({ href: '/user/3', current: path, push,              style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['👤 User 3']),
              NavLink({ href: '/nope',   current: path, push,              style: 'display:block; padding:6px 12px; border-radius:var(--radius)' })(['💀 404 page']),
            ]),
          ]),
        ]),

        Col({ span: 12, md: 8 })([
          div({ style: 'padding:12px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); min-height:80px' })([
            Breadcrumbs({ crumbs, push, style: 'margin-bottom:10px' }),
            _pageContent(page, ctx),
          ]),
        ]),
      ]),

      // ── Programmatic navigation ──────────────────────────────────────
      div({ style: 'margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center' })([
        span({ style: 'font-size:12px; color:var(--text-muted)' })(['router.push():  ']),
        ...[
          ['/', 'Home'],
          ['/about', 'About'],
          ['/user/42', 'User 42'],
          ['/search?q=hello', 'Search ?q=hello'],
        ].map(([href, label]) =>
          div({
            style: 'padding:4px 10px; font-size:12px; cursor:pointer; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-2)',
            onclick: () => push(href),
          })([label])
        ),
      ]),

      // ── Current route state ───────────────────────────────────────────
      div({ style: 'margin-top:12px; padding:10px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); font-size:12px; font-family:monospace' })([
        div({})([
          span({ style: 'color:var(--text-muted)' })(['page:     ']),
          Badge({ variant: 'blue' })([page]),
        ]),
        div({ style: 'margin-top:4px' })([
          span({ style: 'color:var(--text-muted)' })(['path:     ']),
          span({})([path]),
        ]),
        div({ style: 'margin-top:4px' })([
          span({ style: 'color:var(--text-muted)' })(['params:   ']),
          span({})([JSON.stringify(ctx.params ?? {})]),
        ]),
        div({ style: 'margin-top:4px' })([
          span({ style: 'color:var(--text-muted)' })(['query:    ']),
          span({})([JSON.stringify(ctx.query ?? {})]),
        ]),
      ]),
    ]),

    Card({ title: 'Usage' })([
      doc([`// 1. Create the router once (outside the view function)
const router = createRouter([
  { path: '/',         handler: ctx => setState({ page: 'home' }) },
  { path: '/user/:id', handler: ctx => setState({ page: 'user', userId: ctx.params.id }) },
  { path: '/search',   handler: ctx => setState({ page: 'search', q: ctx.query.q }) },
  { path: '*',         handler: ctx => setState({ page: '404' }) },
], { mode: 'hash' /* or 'history' */ })({
  onChange: ctx => setState({ currentPath: ctx.path }),
});

// 2. Navigate components read from state
NavBar({ gap: 16 })([
  NavLink({ href: '/',     current: state.currentPath, push: router.push })(['Home']),
  NavLink({ href: '/docs', current: state.currentPath, push: router.push })(['Docs']),
])

// 3. Programmatic navigation
router.push('/user/42');
router.replace('/about');
router.back();

// 4. Breadcrumbs
Breadcrumbs({
  crumbs: [{ label: 'Home', href: '/' }, { label: 'Users', href: '/users' }, { label: 'Alice' }],
  push: router.push,
})`
      ]),
    ]),
  ]);
};
