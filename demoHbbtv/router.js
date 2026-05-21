/**
 * Tiny router driven by the pub/sub bus.
 *
 *   LEFT       -> previous page
 *   RIGHT      -> next page
 *   1 … N      -> jump straight to page N
 *
 * The router doesn't own page rendering — it only flips state.page. Pages
 * themselves are looked up by id in main.js.
 */

import { getState, setPage } from './store.js';

export const PAGES = ['remote', 'broadcast'];

export const wireRouter = bus => {
  bus.on('key', ({ key }) => {
    const idx = PAGES.indexOf(getState().page);
    if (idx < 0) return;
    if (key === 'left')   setPage(PAGES[(idx - 1 + PAGES.length) % PAGES.length]);
    if (key === 'right')  setPage(PAGES[(idx + 1) % PAGES.length]);
    const n = parseInt(key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= PAGES.length) setPage(PAGES[n - 1]);
  });
};
