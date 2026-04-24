import { div, img } from '../elements.js';

/**
 * Img — image wrapper with aspect ratio, object-fit, lazy loading, and shape variants.
 *
 * @param {Object}   opts
 * @param {string}   opts.src                  Image URL.
 * @param {string}   [opts.alt='']             Alt text.
 * @param {string}   [opts.aspect]             CSS aspect-ratio value, e.g. '16/9', '1/1'.
 * @param {'cover'|'contain'|'fill'|'none'} [opts.fit='cover']  object-fit.
 * @param {boolean}  [opts.lazy=true]          Use loading="lazy".
 * @param {boolean}  [opts.rounded=false]      Rounded corners (--radius-lg).
 * @param {boolean}  [opts.circle=false]       Circular crop (50%).
 * @param {number|string} [opts.width]         Explicit width in px or CSS value.
 * @param {number|string} [opts.height]        Explicit height in px or CSS value.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   Img({ src: '/hero.jpg', alt: 'Hero', aspect: '16/9', rounded: true })
 *   Img({ src: '/avatar.jpg', circle: true, width: 64, height: 64 })
 */
const Img = ({
  src = '',
  alt = '',
  aspect,
  fit = 'cover',
  lazy = true,
  rounded = false,
  circle = false,
  width,
  height,
  className = '',
  style = '',
} = {}) => {
  const toPx = v => typeof v === 'number' ? `${v}px` : v;
  const wrapCls = [
    'img-wrap',
    aspect  && 'img-aspect',
    rounded && 'img-rounded',
    circle  && 'img-circle',
    className,
  ].filter(Boolean).join(' ');

  const wrapStyle = [
    aspect  && `aspect-ratio:${aspect}`,
    width   && `width:${toPx(width)}`,
    height  && !aspect && `height:${toPx(height)}`,
    style,
  ].filter(Boolean).join('; ');

  return div({ className: wrapCls, style: wrapStyle })([
    img({
      src,
      alt,
      className: 'img-el',
      style: `object-fit:${fit}`,
      loading: lazy ? 'lazy' : 'eager',
    })([]),
  ]);
};

export { Img };
