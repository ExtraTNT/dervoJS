import { div, h1, p, button } from '../../src/index.js';
import { SkipLink, VisuallyHidden, ImageBg } from '../../src/index.js';
import { doc } from '../components/doc.js';

const HERO = 'https://picsum.photos/seed/a11y/1200/600';

export const a11yPanel = () =>
  div({})([
    // Skip link placed at top of page — becomes visible when focused
    SkipLink({ target: '.page-layout-main' })(),

    // Simple hero using ImageBg to demonstrate accessible headings + hidden text
    ImageBg({ src: HERO, height: '300px', overlay: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.45))' })([
      div({ style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;padding:24px;color:#fff;text-align:center' })([
        h1({ style: 'margin:0;font-size:32px;line-height:1.05;font-weight:800' })(['Accessible hero header']),
        p({ style: 'margin:0;max-width:720px;opacity:.95;color:rgba(255,255,255,.95);font-size:14px' })([
          'This demo shows `SkipLink` and `VisuallyHidden` in action. Use Tab to reveal the skip link and press Enter to jump to the main content.'
        ]),
        button({ style: 'margin-top:12px;padding:8px 14px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer' })([
          // Icon visually shown + hidden label for screen readers
          '⭐ ', VisuallyHidden()(['Star this demo'])
        ]),
      ])
    ]),

    div({ style: 'margin-top:18px' })([
      doc([`Usage:
- Place SkipLink() early in the DOM so keyboard users can tab to it immediately.
- Use VisuallyHidden() to provide accessible text for icons and visual-only controls.

API:
- SkipLink({ target?: selector, label?: string })()
- VisuallyHidden({ className?, style? })(children)`])
    ])
  ]);
