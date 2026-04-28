import { a } from '../elements.js';

/**
 * SkipLink :: opts → children → vnode
 *
 * Renders a skip-to-content link that becomes visible on keyboard focus.
 * Default target is `.page-layout-main`. The click handler will focus the
 * target element (adding tabindex="-1" if needed) to support keyboard users.
 */
export const SkipLink = ({
  target = '.page-layout-main',
  label  = 'Skip to content',
  className = '',
  style = '',
} = {}) => () =>
  a({
    href: '#',
    className: ['skip-link', className].filter(Boolean).join(' '),
    onclick: e => {
      e.preventDefault();
      try {
        const el = document.querySelector(target);
        if (el) {
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
          el.focus();
        }
      } catch (err) {
        // defensive: if selector fails, do nothing
        console.warn('SkipLink: could not focus target', err);
      }
    },
    style,
  })([label]);
