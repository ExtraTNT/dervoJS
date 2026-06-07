import { div, nav, a, span, sup, ol, li, h1, h2, h3, h4, h5, h6 } from '../elements.js';
import { cn } from '../utils.js';

// Utilities 

/** Convert text to a URL-safe id slug */
const slugify = text =>
  String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

/** Heading tag -> numeric level */
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

// Citations

/**
 * Cite — inline citation marker. Inside Typography, each Cite becomes:
 *   - an accent-coloured link to `href` showing the children as the visible text
 *   - a superscript [N] linking down to the References list at the end
 * Same `href` reused → same [N]. The first occurrence of each [N] is the
 * anchor that the References list's ↑ back-link jumps to.
 *
 * Outside Typography it renders as a plain link, so it degrades cleanly when
 * dropped into prose without the wrapper.
 *
 * @param {Object} opts
 * @param {string} opts.href                   - URL of the source
 * @param {string} [opts.label]                - text in the References list
 *                                               (defaults to the inline text,
 *                                                or to `href` if no children)
 * @param {string} [opts.className='']
 * @param {string} [opts.style='']
 * @returns {function(children): vnode}
 *
 * @example
 *   P({})([
 *     'Article ',
 *     Cite({ href: 'https://example.com/article' })(['by Smith et al.']),
 *     ' shows that…',
 *   ]);
 */
const Cite = ({ href, label, className = '', style = '' } = {}) => children =>
  span({
    className: cn('typo-cite', className),
    style,
    'data-cite-href':  href || '',
    'data-cite-label': label || '',
  })(children);

/** Recognise the marker vnode that `Cite` produces. */
const isCiteVNode = node =>
  node && typeof node === 'object'
    && node.tag === 'span'
    && typeof node.props?.className === 'string'
    && node.props.className.split(/\s+/).includes('typo-cite');

/**
 * Walk the vnode tree in document order and pull out one entry per Cite node.
 * Doesn't descend into Cite children — they're the visible label, not body.
 */
const collectCites = nodes => {
  const out = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (isCiteVNode(node)) {
      out.push({
        href:  node.props['data-cite-href']  || '',
        label: node.props['data-cite-label'] || vnodeText(node) || node.props['data-cite-href'] || '',
        text:  vnodeText(node),
      });
      return;                                   // don't recurse into the marker's children
    }
    if (node.children) for (const c of node.children) walk(c);
  };
  [].concat(nodes).forEach(walk);
  return out;
};

/**
 * Assign citation numbers in document order, deduped by href. Same href reused
 * later in the prose gets the same [N]. Returns a list parallel to the input
 * collectCites output, each item enriched with `.num`.
 */
const numberCites = cites => {
  const hrefToNum = new Map();
  let n = 1;
  return cites.map(c => {
    const key = c.href || `__label:${c.label}`;   // empty-href cites can still dedupe by label
    if (!hrefToNum.has(key)) hrefToNum.set(key, n++);
    return { ...c, num: hrefToNum.get(key) };
  });
};

/**
 * Replace every Cite marker in the tree with its rendered form:
 * an accent-coloured external link + a superscript [N] back-anchor link.
 * Walks once, draining a cursor over the pre-numbered list (so document
 * order matches collectCites).
 *
 * The transformer is curried for clean call sites: `injectCites(numbered)(node)`.
 */
const injectCites = numbered => {
  const occByNum = new Map();
  let cursor = 0;
  const transform = node => {
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (!node || typeof node !== 'object') return node;
    if (isCiteVNode(node)) {
      const entry = numbered[cursor++];
      if (!entry) return node;
      const occ = (occByNum.get(entry.num) || 0) + 1;
      occByNum.set(entry.num, occ);
      const citeId = `cite-${entry.num}-${occ}`;
      // Outer span groups the link + sup so they wrap together inside prose.
      return span({ className: 'typo-cite-rendered' })([
        a({
          href:      entry.href,
          className: 'typo-cite-link',
          target:    '_blank',
          rel:       'noopener noreferrer',
        })(node.children),
        sup({})([
          a({
            id:        citeId,
            href:      `#ref-${entry.num}`,
            className: 'typo-cite-marker',
            title:     `Jump to reference [${entry.num}]`,
          })([`[${entry.num}]`]),
        ]),
      ]);
    }
    if (node.children) return { ...node, children: node.children.map(transform) };
    return node;
  };
  return transform;
};

/**
 * References list rendered at the bottom of Typography. Deduped by [N], so the
 * same source cited twice gets one entry. ↑ back-links to the FIRST inline
 * occurrence; the external link points at the source URL.
 *
 * Returns null when no citations were used so Typography can skip it cleanly.
 */
const renderReferences = title => numbered => {
  if (!numbered.length) return null;
  const byNum = new Map();
  for (const c of numbered) if (!byNum.has(c.num)) byNum.set(c.num, c);
  const entries = [...byNum.values()].sort((a, b) => a.num - b.num);
  return div({ className: 'typo-references' })([
    ...(title ? [div({ className: 'typo-references-title' })([title])] : []),
    ol({ className: 'typo-references-list' })(
      entries.map(e =>
        li({ id: `ref-${e.num}`, className: 'typo-references-item' })([
          span({ className: 'typo-references-label' })([e.label]),
          ...(e.href
            ? [
                span({ className: 'typo-references-sep' })([' — ']),
                a({
                  href:      e.href,
                  className: 'typo-references-href',
                  target:    '_blank',
                  rel:       'noopener noreferrer',
                })([e.href]),
              ]
            : []),
        ])
      )
    ),
  ]);
};

// TOC vnode

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

// Main component 

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
  refsTitle = 'References',     // Falsy = render the list without a heading
  className = '',
  style = '',
} = {}) => children => {
  const childArr = [].concat(children);

  // Citations: number in document order (deduped by href), then rewrite the
  // tree so every `Cite` becomes a styled link + [N] superscript backlink.
  const numbered      = numberCites(collectCites(childArr));
  const withCites     = childArr.map(injectCites(numbered));
  const referencesEl  = renderReferences(refsTitle)(numbered);

  const headings = collectHeadings(withCites);
  const prose    = div({ className: cn('typography', className) })([
    ...withCites.map(injectIds),
    ...(referencesEl ? [referencesEl] : []),
  ]);

  if (!toc || !headings.length) return prose;

  const tocEl = div({ className: cn('toc-panel', tocSticky && 'toc-sticky') })([
    renderTOC(tocTitle)(headings),
  ]);

  return div({ className: `typography-layout toc-${tocPosition}`, style })(
    tocPosition === 'left' ? [tocEl, prose] : [prose, tocEl]
  );
};

// Convenience heading / prose wrappers 

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

export {
  Typography,
  H1, H2, H3, H4, H5, H6, P, Code, Pre, Quote,
  Cite,
  collectHeadings, collectCites, numberCites, slugify,
};
