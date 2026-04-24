import { div, nav, a, span, h1, h2, h3, h4, h5, h6 } from '../elements.js';
import { cn } from '../utils.js';

// ── Utilities ─────────────────────────────────────────────────────

/** Convert text to a URL-safe id slug */
const slugify = text =>
  String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

/** Heading tag → numeric level */
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const tagLevel = tag => parseInt(tag[1], 10);

/** Recursively extract text content from a vnode tree */
const vnodeText = node => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  if (!node.children) return '';
  return node.children.map(vnodeText).join('');
};

/**
 * Recursively collect heading entries from a vnode tree.
 * Pure: no mutable accumulator — uses flatMap recursion.
 */
const collectHeadings = nodes =>
  [].concat(nodes).flatMap(node => {
    if (!node || typeof node !== 'object') return [];
    const nested = node.children ? collectHeadings(node.children) : [];
    if (!HEADING_TAGS.has(node.tag)) return nested;
    const text = vnodeText(node);
    return [{ level: tagLevel(node.tag), text, id: slugify(text) }, ...nested];
  });

/** Inject id attributes into all heading vnodes so anchor links work */
const injectIds = node => {
  if (!node || typeof node !== 'object') return node;
  if (HEADING_TAGS.has(node.tag)) {
    const text = vnodeText(node);
    return { ...node, props: { ...(node.props || {}), id: slugify(text) } };
  }
  if (node.children) {
    return { ...node, children: node.children.map(injectIds) };
  }
  return node;
};

// ── TOC vnode ────────────────────────────────────────────────────

/**
 * Curried: renderTOC(tocTitle)(headings)
 * Returns null when headings is empty so callers can safely skip it.
 */
const renderTOC = tocTitle => headings => {
  if (!headings.length) return null;
  const minLevel = Math.min(...headings.map(h => h.level));
  return nav({ className: 'toc', 'aria-label': 'Table of Contents' })([
    ...(tocTitle ? [div({ className: 'toc-title' })([tocTitle])] : []),
    ...headings.map(h =>
      div({ className: `toc-item toc-item-h${h.level}`, style: `padding-left:${(h.level - minLevel) * 12}px` })([
        a({ href: `#${h.id}`, className: 'toc-link' })([h.text]),
      ])
    ),
  ]);
};

// ── Main component ───────────────────────────────────────────────────

/**
 * Typography — prose wrapper with optional auto-generated Table of Contents.
 *
 * Scans children for heading vnodes (h1–h6), attaches anchor ids, and renders a
 * side TOC panel. Pure function; works anywhere inside mount / createStore.
 *
 * @param {Object}           [opts]
 * @param {boolean}          [opts.toc=true]
 * @param {'left'|'right'}   [opts.tocPosition='right']
 * @param {string}           [opts.tocTitle='Contents']  Falsy = no heading in TOC.
 * @param {boolean}          [opts.tocSticky=true]
 * @param {string}           [opts.className='']
 * @param {string}           [opts.style='']
 * @returns {function(children): vnode}
 *
 * @example
 *   Typography({ toc: true, tocPosition: 'right' })([
 *     H2({})(['Installation']),
 *     P({})(['npm install …']),
 *   ])
 */
const Typography = ({
  toc = true,
  tocPosition = 'right',
  tocTitle = 'Contents',
  tocSticky = true,
  className = '',
  style = '',
} = {}) => children => {
  const childArr = [].concat(children);
  const headings  = collectHeadings(childArr);
  const prose     = div({ className: cn('typography', className) })(childArr.map(injectIds));

  if (!toc || !headings.length) return prose;

  const tocEl = div({ className: cn('toc-panel', tocSticky && 'toc-sticky') })([
    renderTOC(tocTitle)(headings),
  ]);

  return div({ className: `typography-layout toc-${tocPosition}`, style })(
    tocPosition === 'left' ? [tocEl, prose] : [prose, tocEl]
  );
};

// ── Convenience heading / prose wrappers ───────────────────────────────

const H1 = ({ className = '', style = '', id } = {}) => children =>
  h1({ className: cn('typo-h1', className), style, ...(id && { id }) })(children);

const H2 = ({ className = '', style = '', id } = {}) => children =>
  h2({ className: cn('typo-h2', className), style, ...(id && { id }) })(children);

const H3 = ({ className = '', style = '', id } = {}) => children =>
  h3({ className: cn('typo-h3', className), style, ...(id && { id }) })(children);

const H4 = ({ className = '', style = '', id } = {}) => children =>
  h4({ className: cn('typo-h4', className), style, ...(id && { id }) })(children);

const H5 = ({ className = '', style = '', id } = {}) => children =>
  h5({ className: cn('typo-h5', className), style, ...(id && { id }) })(children);

const H6 = ({ className = '', style = '', id } = {}) => children =>
  h6({ className: cn('typo-h6', className), style, ...(id && { id }) })(children);

/** Paragraph */
const P = ({ className = '', style = '', lead = false } = {}) => children =>
  div({ className: cn('typo-p', lead && 'typo-lead', className), style })(children);

/** Inline code */
const Code = ({ className = '', style = '' } = {}) => children =>
  span({ className: cn('typo-code', className), style })(children);

/** Pre-formatted code block */
const Pre = ({ className = '', style = '', lang = '' } = {}) => children =>
  div({ className: cn('typo-pre', className), style, 'data-lang': lang })(children);

/** Blockquote */
const Quote = ({ className = '', style = '', cite: citeText = '' } = {}) => children =>
  div({ className: cn('typo-blockquote', className), style, ...(citeText && { title: citeText }) })(children);

export { Typography, H1, H2, H3, H4, H5, H6, P, Code, Pre, Quote, collectHeadings, slugify };
