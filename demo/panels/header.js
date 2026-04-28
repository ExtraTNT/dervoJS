import { div, h1, p, button } from '../../src/index.js';
import { ImageBg } from '../../src/index.js';
import { doc } from '../components/doc.js';

const HERO = `https://picsum.photos/seed/herobg/1600/900`;

export const headerPanel = () =>
  div({})([
    ImageBg({ src: HERO, height: '420px', overlay: 'rgba(0,0,0,0.25)' })([
      div({ style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:24px;color:#fff;text-align:center' })([
        h1({ style: 'margin:0;font-size:36px;line-height:1.05;font-weight:800' })(['dervoJS — Beautiful page headers']),
        p({ style: 'margin:0;max-width:720px;opacity:.95;color:rgba(255,255,255,.95);font-size:15px' })([
          'A composable, purely-functional `ImageBg` component that places an image behind any content. Drop buttons, forms or navigation in front of it.'
        ]),
        div({ style: 'display:flex;gap:8px;margin-top:14px' })([
          button({ style: 'padding:10px 16px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-weight:700;cursor:pointer' })(['Get started']),
          button({ style: 'padding:10px 16px;border-radius:6px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#fff;cursor:pointer' })(['Docs'])
        ]),
      ])
    ]),

    div({ style: 'margin-top:18px' })([
      doc([`ImageBg({ src, height, overlay, size, position })(children)`])
    ])
  ]);
