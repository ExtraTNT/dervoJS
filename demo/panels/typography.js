import {
  div, span, p, hr, ul, li, a, strong, em,
  Card, Row, Col, Stack,
  Typography, H1, H2, H3, H4, H5, H6, P, Code, Pre, Quote,
} from '../../src/index.js';

/* ── Sample long-form content rendered once (not reactive) ─────────────── */
const sampleContent = [
  H1({})(['Typography System']),
  P({ lead: true })([
    'dervoJS ships a ', strong({})(['Typography']), ' wrapper that automatically scans',
    ' your heading vnodes and builds an anchored Table of Contents, ',
    'so readers can jump straight to the section they need.',
  ]),

  H2({})(['Headings']),
  P({})(['Six semantic levels are supported, each with consistent typographic scale:']),
  Stack({ gap: 4 })([
    H1({})(['Heading 1 — 2 rem, weight 800']),
    H2({})(['Heading 2 — 1.5 rem, weight 700']),
    H3({})(['Heading 3 — 1.2 rem, weight 700']),
    H4({})(['Heading 4 — 1.05 rem, weight 600']),
    H5({})(['Heading 5 — 0.95 rem, weight 600']),
    H6({})(['Heading 6 — 0.85 rem, uppercase, muted']),
  ]),

  H2({})(['Paragraphs & Lead text']),
  P({ lead: true })(['A ', em({})(['lead paragraph']), ' draws the eye with a slightly larger font size for introductory text.']),
  P({})([
    'Regular paragraphs have a comfortable ', Code({})(['1.75']),
    ' line-height. Pair them with short sentences and clear headings to',
    ' keep prose scannable.',
  ]),

  H2({})(['Inline code & Code blocks']),
  P({})(['Use ', Code({})(['Code({})([…])']), ' for inline snippets inside prose.']),
  Pre({ lang: 'js' })([
    'const greeting = name => `Hello, ${name}!`;\n',
    'console.log(greeting("world"));\n',
    '// → Hello, world!',
  ]),

  H2({})(['Blockquote']),
  Quote({ cite: 'Donald Knuth' })([
    '"Premature optimisation is the root of all evil."',
  ]),
  P({})(['Use ', Code({})(['Quote']), ' for pull-quotes, callouts, or cited excerpts.']),

  H3({})(['Lists (native HTML)']),
  P({})(['Ordered and unordered lists inside a ', Code({})(['.typography']), ' context inherit comfortable spacing:']),
  ul({ style: 'padding-left:1.5rem; margin:.5rem 0' })([
    li({})(['Zero-dependency rendering — no virtual DOM library required']),
    li({})(['Lightweight CSS custom-property theming']),
    li({})(['Reactive with any ', Code({})(['createStore']), ' state']),
  ]),

  H2({})(['Table of Contents']),
  P({})([
    'Wrap your content with ', Code({})(['Typography({ toc: true, tocPosition: "right" })([…])']),
    '. The component recursively scans children for ', Code({})(['h1']), '–', Code({})(['h6']),
    ' vnodes, slugifies their text, injects ', Code({})(['id']),
    ' attributes for anchor links, and renders a sticky TOC panel on the chosen side.',
  ]),
  P({})([
    'On screens ≤ 640 px the TOC collapses to a single column so nothing overflows on mobile.',
  ]),

  H2({})(['API reference']),
  P({})([
    Code({})(['Typography({ toc, tocPosition, tocTitle, tocSticky, className, style })']),
    ' → ', Code({})(['children => vnode']),
  ]),
  P({})(['Convenience exports: ', Code({})(['H1']), ', ', Code({})(['H2']), ', ', Code({})(['H3']),
    ', ', Code({})(['H4']), ', ', Code({})(['H5']), ', ', Code({})(['H6']),
    ', ', Code({})(['P']), ', ', Code({})(['Code']), ', ', Code({})(['Pre']),
    ', ', Code({})(['Quote']),
    '.  Also: ', Code({})(['collectHeadings(vnodes)']),
    ', ', Code({})(['slugify(text)']), ' for lower-level use.']
  ),
];

/* ── Panel (static — no reactive state needed) ─────────────────────────── */
export const typographyPanel = () =>
  div({})([
    Card({ title: 'Typography + Auto-TOC' })([
      p({ style: 'margin-bottom:12px; color:var(--text-muted); font-size:.85rem' })([
        'The panel below is rendered once by ', Code({})(['Typography']),
        '. Headings are detected automatically and linked in the sticky TOC on the right.',
      ]),
      div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:24px; background:var(--surface)' })([
        Typography({ toc: true, tocPosition: 'right', tocSticky: true })(sampleContent),
      ]),
    ]),
  ]);
