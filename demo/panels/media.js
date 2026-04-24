import { div, Card, Row, Col, Stack, p, span, strong } from '../../src/index.js';
import { Img, Video, Audio, VideoStream, Dropzone, Divider, Spacer, AspectBox, Float, Clearfix, Badge, Button } from '../../src/index.js';
import { setState } from '../store.js';

// Seeded picsum URL — seed changes on each visit so the browser fetches a
// different image rather than serving the cached one.
const pic = seed => w => h => `https://picsum.photos/seed/${seed}-${w}x${h}/${w}/${h}`;


export const mediaPanel = state => {
  const pic_ = pic(state.mediaSeed ?? 1);
  return div({})([  
    // ── onMount info ───────────────────────────────────────────────────────
    div({ style: 'margin-bottom:16px; padding:10px 14px; background:var(--surface-2); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius); font-size:12px; color:var(--text-muted); line-height:1.6' })([
      span({ style: 'font-weight:600; color:var(--text)' })(['\u2139\ufe0f  Images refresh on every visit\u2002']),
      'This panel is declared with ',
      span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-3,var(--surface-2)); padding:1px 5px; border-radius:3px' })(['unload: true']),
      ' and ',
      span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-3,var(--surface-2)); padding:1px 5px; border-radius:3px' })(['onMount: () => setState({ mediaSeed: Date.now() })']),
      ' in NAV_ITEMS. The DOM is fully torn down on route change and a new seed is stamped into state on each visit, so picsum serves a different image every time. See the Docs tab for details.',
    ]),
    // ── Images ─────────────────────────────────────────────────────────────
    Card({ title: 'Img — aspect, fit, shape' })([
      Row({ gap: 12 })([
        Col({ span: 12, sm: 6, md: 4 })([
          p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['16/9 rounded cover']),
          Img({ src: pic_(480)(270), alt: 'Landscape', aspect: '16/9', rounded: true }),
        ]),
        Col({ span: 12, sm: 6, md: 4 })([
          p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['4/3 contain']),
          Img({ src: pic_(400)(300), alt: 'Portrait', aspect: '4/3', fit: 'contain', rounded: true }),
        ]),
        Col({ span: 12, sm: 6, md: 4 })([
          p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['Avatar circle 80px']),
          div({ style: 'display:flex; gap:10px; flex-wrap:wrap' })([
            Img({ src: pic_(80)(80), alt: 'Avatar', circle: true, width: 80, height: 80 }),
            Img({ src: pic_(81)(81), alt: 'Avatar', circle: true, width: 80, height: 80 }),
            Img({ src: pic_(82)(82), alt: 'Avatar', circle: true, width: 80, height: 80 }),
          ]),
        ]),
      ]),
    ]),

    // ── Divider ─────────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Divider + Spacer' })([
        Stack({ gap: 0 })([
          p({ style: 'font-size:13px; color:var(--text-muted); margin:0 0 10px' })(['Divider — plain and labeled:']),
          Divider(),
          Divider({ label: 'or continue with' }),
          Divider({ label: 'section 2' }),
          p({ style: 'font-size:13px; color:var(--text-muted); margin:10px 0' })(['Spacer — pushes siblings apart:']),
          div({ style: 'display:flex; align-items:center; border:1px dashed var(--border); border-radius:var(--radius); padding:10px 16px; font-size:13px' })([
            strong({})(['Left']),
            Spacer(),
            Badge({ variant: 'green' })(['Right']),
          ]),
          div({ style: 'display:flex; align-items:center; border:1px dashed var(--border); border-radius:var(--radius); padding:10px 16px; font-size:13px; margin-top:8px' })([
            strong({})(['A']),
            Spacer({ size: 32 }),
            strong({})(['B (fixed 32px gap)']),
          ]),
        ]),
      ]),
    ]),

    // ── AspectBox ───────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'AspectBox — embed-safe aspect ratio' })([
        Row({ gap: 12 })([
          Col({ span: 12, md: 6 })([
            p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['ratio: 16/9']),
            AspectBox({ ratio: '16/9' })([
              div({ style: 'background:var(--surface-2); border:1px dashed var(--border); display:flex; align-items:center; justify-content:center; font-size:13px; color:var(--text-muted); width:100%; height:100%; border-radius:var(--radius)' })(['16 : 9']),
            ]),
          ]),
          Col({ span: 12, md: 6 })([
            p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['ratio: 1/1']),
            AspectBox({ ratio: '1/1' })([
              div({ style: 'background:var(--surface-2); border:1px dashed var(--border); display:flex; align-items:center; justify-content:center; font-size:13px; color:var(--text-muted); width:100%; height:100%; border-radius:var(--radius)' })(['1 : 1']),
            ]),
          ]),
        ]),
      ]),
    ]),

    // ── Float + Clearfix ────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Float + Clearfix' })([
        p({ style: 'margin:0 0 10px; font-size:13px; color:var(--text-muted)' })([
          'Floats image left of body text. Clearfix prevents parent collapse.',
        ]),
        Clearfix()([
          Float({ side: 'left' })([
            Img({ src: pic_(120)(90), alt: 'Float', rounded: true, width: 120, height: 90 }),
          ]),
          p({ style: 'margin:0; font-size:14px' })([
            'This paragraph text flows around the floated image on the left. Clearfix ensures the card\'s container fully wraps both the float and the text, preventing the classic collapsing parent problem that floats are notorious for. Resize the window to see how the text reflows.',
          ]),
        ]),
      ]),
    ]),

    // ── Video player ────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Video — HTML5 player (multi-source + captions)' })([
        Row({ gap: 16 })([
          Col({ span: 12, md: 8 })([
            Video({
              sources: [
                { src: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video/mp4' },
              ],
              poster:   'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217',
              aspect:   '16/9',
              controls: true,
              caption:  'Big Buck Bunny — sample clip (W3Schools)',
            }),
          ]),
          Col({ span: 12, md: 4 })([
            p({ style: 'margin:0 0 6px; font-size:12px; color:var(--text-muted)' })(['9/16 (portrait)']),
            Video({
              src:      'https://www.w3schools.com/html/mov_bbb.mp4',
              aspect:   '9/16',
              controls: true,
              muted:    true,
              caption:  'Portrait crop',
            }),
          ]),
        ]),
        Divider({ label: 'WebVTT subtitle track' }),
        p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
          'Enable CC (\u29c9) in the player controls to see subtitles. Data-URI VTT — works cross-origin.',
        ]),
        Video({
          src:      'https://www.w3schools.com/html/mov_bbb.mp4',
          tracks: [{
            src:     'data:text/vtt;charset=utf-8,WEBVTT%0A%0A00%3A00%3A01.000%20--%3E%2000%3A00%3A04.000%0AWebVTT%20subtitles%20are%20working%0A%0A00%3A00%3A04.500%20--%3E%2000%3A00%3A08.000%0ABig%20Buck%20Bunny%20sample%20clip%0A%0A00%3A00%3A08.500%20--%3E%2000%3A00%3A11.000%0AEnable%20CC%20in%20the%20player%20controls',
            kind:    'subtitles',
            srclang: 'en',
            label:   'English',
            default: true,
          }],
          aspect:   '16/9',
          controls: true,
          caption:  'Video({ tracks: [{ src, kind: "subtitles", srclang: "en", label: "English", default: true }] })',
        }),
      ]),
    ]),

    // ── Audio player ─────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Audio — HTML5 player (multi-format + caption)' })([
        Stack({ gap: 12 })([
          Audio({
            sources: [
              { src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', type: 'audio/mpeg' },
            ],
            controls: true,
            caption:  'SoundHelix Song 1 — royalty-free sample',
          }),
          Audio({
            src:      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            controls: true,
            loop:     true,
            caption:  'SoundHelix Song 2 — looping example',
          }),
        ]),
      ]),
    ]),

    // ── VideoStream (webcam) ──────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'VideoStream — live MediaStream (getUserMedia)' })([
        div({ style: 'display:flex; gap:8px; margin-bottom:12px' })([
          Button({
            variant: state.stream ? 'danger' : 'primary',
            onClick: state.stream
              ? () => {
                  state.stream.getTracks().forEach(t => t.stop());
                  setState({ stream: null, streamError: null });
                }
              : () => navigator.mediaDevices
                  .getUserMedia({ video: true, audio: false })
                  .then(stream => setState({ stream, streamError: null }))
                  .catch(e  => setState({ stream: null, streamError: e.message })),
          })([state.stream ? 'Stop camera' : 'Start camera']),
        ]),
        state.streamError
          ? p({ style: 'margin:0; font-size:13px; color:var(--danger,#e53)' })([state.streamError])
          : div({ style: 'display:none' })([]),
        state.stream
          ? VideoStream({
              ref:    el => { if (el) el.srcObject = state.stream; },
              aspect: '16/9',
              muted:  true,
              caption: 'Live camera feed — mirrored for natural selfie view',
            })
          : div({ style: 'aspect-ratio:16/9; background:var(--surface-2); border:1px dashed var(--border); border-radius:var(--radius); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:13px' })([
              'Camera preview will appear here',
            ]),
      ]),
    ]),

    // ── Dropzone ─────────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Dropzone' })([
        Dropzone({
          accept: 'image/*,.pdf',
          multiple: true,
          active: state.dzActive,
          inputId: 'demo-dz',
          onDragEnter: () => setState({ dzActive: true }),
          onDragLeave: () => setState({ dzActive: false }),
          onDrop: files => setState({ dzActive: false, dzFiles: [...(state.dzFiles || []), ...Array.from(files).map(f => f.name)] }),
          onFileSelect: files => setState({ dzFiles: [...(state.dzFiles || []), ...Array.from(files).map(f => f.name)] }),
        })([]),

        ...(state.dzFiles && state.dzFiles.length
          ? [
              div({ style: 'margin-top:12px' })([
                div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
                  span({ style: 'font-size:13px; font-weight:500; color:var(--text)' })([`${state.dzFiles.length} file(s)`]),
                  Button({ variant: 'ghost', size: 'sm', onClick: () => setState({ dzFiles: [] }) })(['Clear']),
                ]),
                div({ style: 'display:flex; flex-wrap:wrap; gap:6px' })([
                  ...state.dzFiles.map(name =>
                    Badge({ variant: 'blue' })([name])
                  ),
                ]),
              ]),
            ]
          : []
        ),
      ]),
    ]),
  ]);
};