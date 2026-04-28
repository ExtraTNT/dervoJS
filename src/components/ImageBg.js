import { div } from '../elements.js';
import { cn, defaults } from '../utils.js';

// Small, curried helpers (single-arg functions + composition)
const ensureChildren = c => Array.isArray(c) ? c : [c];

const mkWrapperStyle = opts => `height:${opts.height};position:relative;overflow:hidden;${opts.style ? ' ' + opts.style : ''}`;
const mkBgStyle = opts => `background-image:url("${opts.src}");background-size:${opts.size};background-position:${opts.position};background-repeat:${opts.repeat};position:absolute;inset:0;z-index:0;`;
const mkOverlayStyle = opts => opts.overlay ? `position:absolute;inset:0;background:${opts.overlay};z-index:1;` : '';
const contentStyle = 'position:relative;z-index:2;width:100%;height:100%;';

// defaults applied via single-arg curried function
const withDefaults = defaults({
  height: '320px',
  size: 'cover',
  position: 'center',
  repeat: 'no-repeat',
  overlay: 'rgba(0,0,0,0.35)',
  className: '',
  style: '',
});

/**
 * ImageBg :: opts → children → vnode
 *
 * Renders a wrapper with a CSS background image and optional overlay.
 * The component is purely functional (no side effects) and fully curried.
 */
export const ImageBg = (opts = {}) => children => {
  const o = withDefaults(opts);
  const wrapperProps = {
    className: cn(['image-bg', o.className]),
    style: mkWrapperStyle(o),
  };

  const imgNode = div({ className: 'image-bg-img', style: mkBgStyle(o) })([]);
  const overlayNode = o.overlay ? div({ className: 'image-bg-overlay', style: mkOverlayStyle(o) })([]) : null;
  const contentNode = div({ className: 'image-bg-content', style: contentStyle })(ensureChildren(children));

  return div(wrapperProps)([imgNode, overlayNode].filter(Boolean).concat([contentNode]));
};
