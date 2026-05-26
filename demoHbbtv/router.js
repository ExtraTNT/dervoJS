/**
 * Direct-jump shortcuts. Arrow keys / OK / BACK are entirely owned by the
 * focus manager now that the page tabs are real focusables — the router
 * only handles the always-on shortcuts that bypass spatial nav.
 *
 *   1 … N             -> direct jump to page N
 *   RED / GREEN / …   -> colour-button shortcut to specific pages
 *
 * Both shortcuts also move focus to the matching tab so the user lands in
 * a consistent state.
 */

import { setPage } from './store.js';

// Single source of truth for which pages exist + their order.
export const PAGES = ['remote', 'broadcast', 'list', 'grid'];

const _COLOUR_TO_PAGE = ['red', 'green', 'yellow', 'blue'];

const _jumpTo = (fm, pageId) => {
  setPage(pageId);
  fm?.focus(`tab-${pageId}`);
};

/**
 * @param {Bus}            bus
 * @param {FocusManager}   fm   — focus moves to the target page's tab on jump
 */
export const wireRouter = (bus, fm) => {
  bus.on('key', ({ key }) => {
    // numeric direct jump
    //const n = parseInt(key, 10);
    //if (!Number.isNaN(n) && n >= 1 && n <= PAGES.length) return _jumpTo(fm, PAGES[n - 1]);

    // colour-button direct jump
    //const cIdx = _COLOUR_TO_PAGE.indexOf(key);
    if (cIdx >= 0 && cIdx < PAGES.length) return _jumpTo(fm, PAGES[cIdx]);
  });
};
