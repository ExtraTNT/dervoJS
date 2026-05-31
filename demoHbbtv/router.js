/**
 * Direct-jump shortcuts. Arrow keys / OK / BACK are entirely owned by the
 * focus manager now that the page tabs are real focusables — the router
 * only handles the always-on shortcuts that bypass spatial nav.
 *
 *   RED / GREEN / YELLOW / BLUE  -> colour-button shortcut to specific pages
 *
 * Numeric direct jumps (`1`–`N`) were intentionally removed: the colour
 * buttons cover the same use case and don't clash with the 9-9-1 profiler
 * combo or other potential numeric combos.
 *
 * The shortcut also moves focus to the matching tab so the user lands in a
 * consistent state.
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
    return; // comment out for color shortcuts
    const cIdx = _COLOUR_TO_PAGE.indexOf(key);
    if (cIdx >= 0 && cIdx < PAGES.length) return _jumpTo(fm, PAGES[cIdx]);
  });
};
