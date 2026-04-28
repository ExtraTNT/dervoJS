import { span } from '../elements.js';

/**
 * VisuallyHidden :: opts → children → vnode
 *
 * Keeps content available to screen readers while hiding it visually.
 * Curried, single-arg form for composition.
 */
export const VisuallyHidden = ({ className = '', style = '' } = {}) => children =>
  span({ className: ['sr-only', className].filter(Boolean).join(' '), style })(
    Array.isArray(children) ? children : [children]
  );
