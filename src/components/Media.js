import { div, span, audio, video, source, track } from '../elements.js';
import { cn } from '../utils.js';

// ── Shared helpers ────────────────────────────────────────────────────────

const toPx = v => (typeof v === 'number' ? `${v}px` : v);

/**
 * sourceNodes(sources) — converts a sources array into <source> vnodes.
 * Each entry: { src, type? }
 */
const sourceNodes = sources =>
  (sources || []).map(s => source({ src: s.src, type: s.type || '' })([]));

/**
 * trackNodes(tracks) — converts a tracks array into <track> vnodes.
 * Each entry: { src, kind?, srclang?, label?, default? }
 */
const trackNodes = tracks =>
  (tracks || []).map(t =>
    track({
      src:     t.src,
      kind:    t.kind    || 'subtitles',
      srclang: t.srclang || 'en',
      label:   t.label   || '',
      ...(t.default && { default: true }),
    })([])
  );

// ── Video ─────────────────────────────────────────────────────────────────

/**
 * Video — accessible HTML5 video player with aspect ratio, caption, and track support.
 *
 * Pure: no DOM refs. All state (muted, autoplay, etc.) is expressed via props.
 * For imperative control (play/pause via JS) use the standard `id` + `document.getElementById`.
 *
 * @param {Object}   opts
 * @param {string}   [opts.src]          Single source URL (shorthand; use sources[] for multi).
 * @param {string}   [opts.type]         MIME type for opts.src, e.g. 'video/mp4'.
 * @param {Array}    [opts.sources]      Array of { src, type } — multiple format fallbacks.
 * @param {Array}    [opts.tracks]       Array of { src, kind?, srclang?, label?, default? }.
 * @param {string}   [opts.poster]       Poster image URL shown before play.
 * @param {string}   [opts.aspect='16/9'] CSS aspect-ratio value.
 * @param {boolean}  [opts.controls=true] Show native controls.
 * @param {boolean}  [opts.autoplay=false]
 * @param {boolean}  [opts.muted=false]   Required for autoplay in most browsers.
 * @param {boolean}  [opts.loop=false]
 * @param {boolean}  [opts.playsinline=false] Prevents fullscreen on iOS.
 * @param {boolean}  [opts.preload='metadata'] none | metadata | auto.
 * @param {string}   [opts.caption]      Optional text caption below the player.
 * @param {number|string} [opts.width]   Wrapper width.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   Video({
 *     sources: [
 *       { src: '/intro.webm', type: 'video/webm' },
 *       { src: '/intro.mp4',  type: 'video/mp4'  },
 *     ],
 *     tracks: [{ src: '/subs.vtt', kind: 'subtitles', srclang: 'en', label: 'English', default: true }],
 *     poster: '/thumb.jpg',
 *     aspect: '16/9',
 *     controls: true,
 *   })
 */
const Video = ({
  src,
  type,
  sources = [],
  tracks  = [],
  poster,
  aspect  = '16/9',
  controls     = true,
  autoplay     = false,
  muted        = false,
  loop         = false,
  playsinline  = false,
  preload      = 'metadata',
  caption,
  width,
  className = '',
  style     = '',
} = {}) => {
  const allSources = src
    ? [{ src, type: type || '' }, ...sources]
    : sources;

  const outerStyle = [
    width && `width:${toPx(width)}`,
    style,
  ].filter(Boolean).join('; ');

  const innerStyle = aspect ? `aspect-ratio:${aspect}` : '';

  const videoEl = video({
    className:   'media-video',
    controls,
    autoplay,
    muted,
    loop,
    preload,
    ...(poster      && { poster }),
    ...(playsinline && { playsinline: true }),
  })([
    ...sourceNodes(allSources),
    ...trackNodes(tracks),
  ]);

  return div({ className: cn('media-outer', className), style: outerStyle })([
    div({ className: 'media-wrap', style: innerStyle })([videoEl]),
    ...(caption ? [span({ className: 'media-caption' })([caption])] : []),
  ]);
};

// ── VideoStream ───────────────────────────────────────────────────────────

/**
 * VideoStream — renders a <video> element wired to a MediaStream object
 * (e.g. from getUserMedia / getDisplayMedia). The stream is attached via
 * the `srcObject` DOM property, which cannot be set through a vnode attribute.
 *
 * Because this component must touch the DOM, it does so via a `ref` callback
 * that is called (once) with the real <video> element after the first render.
 * The `stream` prop is compared by identity on each render; if it changes, the
 * ref callback fires again with the updated element so you can reassign srcObject.
 *
 * Pure from the vnode side — all imperative work is isolated in the ref callback.
 *
 * @param {Object}         opts
 * @param {MediaStream}    [opts.stream]         Live stream; null clears src.
 * @param {function}       [opts.ref]            (videoEl) => void — called after mount.
 * @param {string}         [opts.aspect='16/9']
 * @param {boolean}        [opts.muted=true]     Default true (required to avoid echo).
 * @param {boolean}        [opts.autoplay=true]  Default true so the stream plays automatically.
 * @param {boolean}        [opts.controls=false]
 * @param {boolean}        [opts.playsinline=true]
 * @param {string}         [opts.caption]
 * @param {number|string}  [opts.width]
 * @param {string}         [opts.className='']
 * @param {string}         [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   // Start camera:
 *   navigator.mediaDevices.getUserMedia({ video: true, audio: true })
 *     .then(stream => setState({ stream }));
 *
 *   VideoStream({
 *     stream: state.stream,
 *     ref: el => { if (el) el.srcObject = state.stream; },
 *     aspect: '16/9',
 *     muted: true,
 *   })
 */
const VideoStream = ({
  stream,
  ref,
  aspect      = '16/9',
  muted       = true,
  autoplay    = true,
  controls    = false,
  playsinline = true,
  caption,
  width,
  className = '',
  style     = '',
} = {}) => {
  const outerStyle = [
    width && `width:${toPx(width)}`,
    style,
  ].filter(Boolean).join('; ');

  const innerStyle = aspect ? `aspect-ratio:${aspect}` : '';

  // We use a data-stream-id attribute so the patcher's tag-match path detects
  // when the stream identity changes and the ref callback needs to fire.
  // Callers wiring srcObject should do it in the ref callback.
  const streamId = stream ? (stream.id || 'active') : 'none';

  const videoEl = video({
    className:   'media-video media-stream',
    muted,
    autoplay,
    controls,
    playsinline,
    'data-stream': streamId,
    ...(ref && { oncreate: ref, onupdate: ref }),
  })([]);

  return div({ className: cn('media-outer', className), style: outerStyle })([
    div({ className: 'media-wrap', style: innerStyle })([videoEl]),
    ...(caption ? [span({ className: 'media-caption' })([caption])] : []),
  ]);
};

// ── Audio ─────────────────────────────────────────────────────────────────

/**
 * Audio — accessible HTML5 audio player.
 *
 * @param {Object}   opts
 * @param {string}   [opts.src]         Single source URL.
 * @param {string}   [opts.type]        MIME type for opts.src.
 * @param {Array}    [opts.sources]     Array of { src, type } for multi-format fallbacks.
 * @param {Array}    [opts.tracks]      Array of { src, kind?, srclang?, label?, default? }.
 * @param {boolean}  [opts.controls=true]
 * @param {boolean}  [opts.autoplay=false]
 * @param {boolean}  [opts.muted=false]
 * @param {boolean}  [opts.loop=false]
 * @param {string}   [opts.preload='metadata']
 * @param {string}   [opts.caption]     Optional label shown below the player.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   Audio({
 *     sources: [
 *       { src: '/track.ogg', type: 'audio/ogg' },
 *       { src: '/track.mp3', type: 'audio/mpeg' },
 *     ],
 *     controls: true,
 *     caption: 'Episode 1',
 *   })
 */
const Audio = ({
  src,
  type,
  sources  = [],
  tracks   = [],
  controls = true,
  autoplay = false,
  muted    = false,
  loop     = false,
  preload  = 'metadata',
  caption,
  className = '',
  style     = '',
} = {}) => {
  const allSources = src
    ? [{ src, type: type || '' }, ...sources]
    : sources;

  const audioEl = audio({
    className: 'media-audio',
    controls,
    autoplay,
    muted,
    loop,
    preload,
    style: 'width:100%',
  })([
    ...sourceNodes(allSources),
    ...trackNodes(tracks),
  ]);

  return div({ className: cn('media-audio-wrap', className), style })([ 
    audioEl,
    ...(caption ? [span({ className: 'media-caption' })([caption])] : []),
  ]);
};

export { Video, VideoStream, Audio };
