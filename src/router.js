/**
 * dervoJS — client-side router
 *
 * Hash-based (#/path) OR History API (pushState) routing. Pure functional,
 * zero coupling to the framework: the router fires callbacks; you decide
 * what to do (usually setState). Navigation components are plain curried
 * vnode factories that read active route from state.
 *
 * ── Overview ────────────────────────────────────────────────────────────────
 *
 *   createRouter(routes)(handlers)  — attach router to the browser; returns controller
 *   Link(opts)(children)            — curried <a> that navigates without page reload
 *   NavLink(opts)(children)         — Link that adds 'active' class when route matches
 *   NavBar(opts)(children)          — horizontal navigation bar container
 *   NavMenu(opts)(children)         — vertical sidebar navigation container
 *
 * ── Route matching ──────────────────────────────────────────────────────────
 *
 *   Routes are plain objects: { path, handler }
 *   Paths support:
 *     '/about'            — exact segment match
 *     '/user/:id'         — named param (available as params.id)
 *     '/files/*'          — wildcard (greedy; available as params.*)
 *   Order matters — first match wins.
 *
 * ── Minimal setup ───────────────────────────────────────────────────────────
 *
 *   const router = createRouter([
 *     { path: '/',        handler: () => setState({ route: 'home' }) },
 *     { path: '/about',   handler: () => setState({ route: 'about' }) },
 *     { path: '/user/:id',handler: ({ params }) => setState({ route: 'user', userId: params.id }) },
 *     { path: '*',        handler: () => setState({ route: '404' }) },
 *   ])({
 *     onChange: ({ path, params, query }) => console.log('navigated', path),
 *   });
 *
 *   // Navigate programmatically
 *   router.push('/user/42');
 *   router.replace('/about');
 *   router.back();
 *   router.getPath();     // current path string
 *   router.destroy();     // remove listeners
 *
 * ── Navigation components ────────────────────────────────────────────────────
 *
 *   // Link — renders an <a> that uses router.push instead of page reload
 *   Link({ href: '/about', push: router.push })(['About'])
 *
 *   // NavLink — adds className 'active' (or custom) when route matches
 *   NavLink({ href: '/user/42', current: state.route, push: router.push })(['Profile'])
 *
 *   // NavBar — horizontal bar (e.g. top navigation)
 *   NavBar({ gap: 8 })([
 *     NavLink({ href: '/',      current: state.path, push: router.push })(['Home']),
 *     NavLink({ href: '/about', current: state.path, push: router.push })(['About']),
 *   ])
 *
 *   // NavMenu — vertical sidebar list
 *   NavMenu({ width: '220px' })([
 *     NavLink({ href: '/dashboard', current: state.path, push: router.push })(['Dashboard']),
 *     NavLink({ href: '/settings',  current: state.path, push: router.push })(['Settings']),
 *   ])
 */

import { a, nav, div, span } from './elements.js';
import { cn } from './utils.js';

// ── Route parsing helpers ────────────────────────────────────────────────────

/** Convert a route path pattern into a RegExp and extract param names */
const _compileRoute = path => {
  // Wildcard shorthand
  if (path === '*') return { re: /.*/, keys: ['*'] };
  const keys = [];
  const src = path
    .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')  // escape regex special chars
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, k) => { keys.push(k); return '([^/]+)'; })
    .replace(/\\\*/g, () => { keys.push('*'); return '(.*)'; });
  return { re: new RegExp(`^${src}$`), keys };
};

/** Extract pathname from a URL-like string (strips origin and hash if present) */
const _extractPath = mode => raw => {
  if (mode === 'hash') {
    const h = (raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : raw) || '/';
    return h.startsWith('/') ? h : '/' + h;
  }
  try {
    const url = new URL(raw, location.origin);
    return url.pathname || '/';
  } catch (_) {
    return raw.startsWith('/') ? raw : '/' + raw;
  }
};

/** Parse query string '?a=1&b=2' → { a: '1', b: '2' } */
const _parseQuery = search => {
  const q = {};
  new URLSearchParams(search).forEach((v, k) => { q[k] = v; });
  return q;
};

/** Match a path against compiled routes; return { route, params } or null */
const _match = compiled => path => {
  for (const { route, re, keys } of compiled) {
    const m = path.match(re);
    if (!m) continue;
    const params = {};
    keys.forEach((k, i) => { params[k] = m[i + 1]; });
    return { route, params };
  }
  return null;
};

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Curried router factory.
 *
 * @param {Route[]}  routes          Ordered list of route definitions
 * @param {Object}   [opts={}]
 * @param {string}   [opts.mode='history']  'history' (pushState) | 'hash' (#/path)
 * @param {string}   [opts.base='']         Base path prefix (history mode only)
 *
 * @returns {(handlers: RouterHandlers) => RouterController}
 *
 * @typedef {Object} Route
 * @property {string}   path     URL pattern (supports :param and *)
 * @property {(ctx: RouteContext) => void} handler  Called when this route matches
 *
 * @typedef {Object} RouteContext
 * @property {string} path     Matched pathname (after base prefix)
 * @property {Object} params   Extracted named params and wildcards
 * @property {Object} query    Parsed query string key→value
 *
 * @typedef {Object} RouterHandlers
 * @property {(ctx: RouteContext) => void} [onChange]  Called on every navigation (after handler)
 *
 * @typedef {Object} RouterController
 * @property {(path: string) => void} push     Navigate to path (adds history entry)
 * @property {(path: string) => void} replace  Navigate without adding history entry
 * @property {() => void}             back     Go back in history
 * @property {() => void}             forward  Go forward in history
 * @property {() => string}           getPath  Return current path
 * @property {() => void}             destroy  Remove event listeners
 */
const createRouter = (routes = [], { mode = 'history', base = '' } = {}) => (handlers = {}) => {
  const { onChange = () => {} } = handlers;

  const compiled = routes.map(route => ({
    route,
    ..._compileRoute(base ? route.path.replace(new RegExp(`^${base}`), '') || '/' : route.path),
  }));

  const _dispatch = () => {
    const raw  = mode === 'hash' ? location.hash.slice(1) || '/' : location.pathname;
    const path = _extractPath(mode)(raw);
    const trimmed = base && path.startsWith(base) ? path.slice(base.length) || '/' : path;
    const query = _parseQuery(location.search);
    const ctx = { path: trimmed, params: {}, query };
    const found = _match(compiled)(trimmed);
    if (found) {
      ctx.params = found.params;
      found.route.handler(ctx);
    }
    onChange(ctx);
  };

  const _buildHref = path => {
    const full = base + path;
    return mode === 'hash' ? `#${full}` : full;
  };

  const push = path => {
    if (mode === 'hash') {
      location.hash = base + path;
    } else {
      history.pushState(null, '', base + path);
      _dispatch();
    }
  };

  const replace = path => {
    if (mode === 'hash') {
      location.replace(`${location.pathname}${location.search}#${base + path}`);
    } else {
      history.replaceState(null, '', base + path);
      _dispatch();
    }
  };

  const back    = () => history.back();
  const forward = () => history.forward();
  const getPath = () => _extractPath(mode)(
    mode === 'hash' ? location.hash.slice(1) || '/' : location.pathname
  );
  const getHref = _buildHref;

  const _onPop = () => _dispatch();
  const event  = mode === 'hash' ? 'hashchange' : 'popstate';
  window.addEventListener(event, _onPop);

  const destroy = () => window.removeEventListener(event, _onPop);

  // Fire for the current URL on creation
  _dispatch();

  return { push, replace, back, forward, getPath, getHref, destroy };
};

// ── Navigation components ────────────────────────────────────────────────────

/**
 * Link — curried navigation anchor.
 * Prevents the default page reload and calls push(href) instead.
 *
 * @param {Object}   opts
 * @param {string}   opts.href         Target path (e.g. '/about')
 * @param {function} opts.push         router.push — or any (path) => void
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 * @returns {(children: vnode[]) => vnode}
 *
 * @example
 *   Link({ href: '/about', push: router.push })(['About us'])
 */
const Link = ({ href = '/', push, className = '', style = '' } = {}) => children =>
  a({
    href,
    className: className || undefined,
    style:     style     || undefined,
    onclick:   e => { e.preventDefault(); if (push) push(href); },
  })(children);

/**
 * NavLink — Link that marks itself active when the current path matches.
 *
 * Matching is prefix-based by default (so '/user' matches '/user/42').
 * Set exact: true for exact-only matching.
 *
 * @param {Object}   opts
 * @param {string}   opts.href              Target path
 * @param {string}   opts.current           Current path from state
 * @param {function} opts.push              router.push
 * @param {boolean}  [opts.exact=false]     Only mark active on exact match
 * @param {string}   [opts.activeClass='active']
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 * @returns {(children: vnode[]) => vnode}
 *
 * @example
 *   NavLink({ href: '/about', current: state.path, push: router.push })(['About'])
 */
const NavLink = ({
  href        = '/',
  current     = '/',
  push,
  exact       = false,
  activeClass = 'active',
  className   = '',
  style       = '',
} = {}) => children => {
  const isActive = exact ? current === href : (current === href || current.startsWith(href === '/' ? '\x00' : href));
  return a({
    href,
    className: cn(className, isActive && activeClass) || undefined,
    style:     style || undefined,
    onclick:   e => { e.preventDefault(); if (push) push(href); },
  })(children);
};

/**
 * NavBar — horizontal navigation container.
 * Renders a <nav> with flex-row layout for use as a top bar or tab strip.
 *
 * @param {Object} opts
 * @param {number} [opts.gap=0]       Gap between items in px
 * @param {string} [opts.align='center']  CSS align-items value
 * @param {string} [opts.className]
 * @param {string} [opts.style]
 * @returns {(children: vnode[]) => vnode}
 *
 * @example
 *   NavBar({ gap: 8 })([
 *     NavLink({ href: '/',     current: state.path, push: router.push })(['Home']),
 *     NavLink({ href: '/docs', current: state.path, push: router.push })(['Docs']),
 *   ])
 */
const NavBar = ({ gap = 0, align = 'center', className = '', style = '' } = {}) => children =>
  nav({
    className: cn('nav-bar', className) || undefined,
    style: `display:flex; flex-direction:row; align-items:${align};${gap ? ` gap:${gap}px;` : ''}${style ? ` ${style}` : ''}`,
  })(children);

/**
 * NavMenu — vertical sidebar navigation container.
 * Renders a <nav> with flex-column layout.
 *
 * @param {Object} opts
 * @param {string} [opts.width]       Fixed CSS width (e.g. '220px'). Omit = auto.
 * @param {number} [opts.gap=4]       Gap between items in px
 * @param {string} [opts.className]
 * @param {string} [opts.style]
 * @returns {(children: vnode[]) => vnode}
 *
 * @example
 *   NavMenu({ width: '220px', gap: 4 })([
 *     NavLink({ href: '/dashboard', current: state.path, push: router.push })(['Dashboard']),
 *     NavLink({ href: '/settings',  current: state.path, push: router.push })(['Settings']),
 *   ])
 */
const NavMenu = ({ width, gap = 4, className = '', style = '' } = {}) => children =>
  nav({
    className: cn('nav-menu', className) || undefined,
    style: `display:flex; flex-direction:column;${gap ? ` gap:${gap}px;` : ''}${width ? ` width:${width};` : ''}${style ? ` ${style}` : ''}`,
  })(children);

/**
 * Breadcrumbs — renders a list of { label, href } crumbs separated by a divider.
 * The last crumb is never a link (current page).
 *
 * @param {Object}   opts
 * @param {{ label: string, href?: string }[]} opts.crumbs
 * @param {function} opts.push          router.push
 * @param {string}   [opts.divider='/']
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 *
 * @example
 *   Breadcrumbs({
 *     crumbs: [{ label: 'Home', href: '/' }, { label: 'Users', href: '/users' }, { label: 'Alice' }],
 *     push: router.push,
 *   })
 */
const Breadcrumbs = ({ crumbs = [], push, divider = '/', className = '', style = '' } = {}) =>
  nav({
    className: cn('nav-breadcrumbs', className) || undefined,
    style: `display:flex; align-items:center; gap:6px; flex-wrap:wrap;${style ? ` ${style}` : ''}`,
  })(
    crumbs.flatMap((crumb, i) => {
      const isLast = i === crumbs.length - 1;
      const label  = isLast || !crumb.href
        ? span({ className: 'nav-crumb nav-crumb-current' })([crumb.label])
        : a({
            href:      crumb.href,
            className: 'nav-crumb nav-crumb-link',
            onclick:   e => { e.preventDefault(); if (push) push(crumb.href); },
          })([crumb.label]);
      return i === 0 ? [label] : [span({ className: 'nav-crumb-divider' })([divider]), label];
    })
  );

export { createRouter, Link, NavLink, NavBar, NavMenu, Breadcrumbs };
