/**
 * Showcase panel - a single dashboard that exercises the renderer end-to-end:
 *
 *   • createBus / getBus     - one named pub-sub bus, multiple subscribers
 *   • createInterval         - five independent emitters, each toggleable
 *   • setState updaters      - pure (state -> state) reducers driven by bus events
 *   • keyed reconciler       - feed list reorders + animates without losing focus
 *   • focus preservation     - search input keeps cursor while feed updates 4x/s
 *   • currying / templates   - emitter rows + stat tiles built via partial app.
 *   • memoization            - Badge is memoised once, reused for every event
 *   • charts                 - BarChart + SparkLine derived from the same store
 */

import {
  div, span, p, strong, code, button, input,
  sdiv, sspan,
  Card, Badge, Row, Col, Toggle, Slider,
  BarChart, SparkLine,
  getBus, createInterval,
  memoComponent, memoLeaf, memoize, freeze,
} from '../../src/index.js';
import { setState, getState } from '../store.js';
import { doc } from '../components/doc.js';

// Constants

const BUS_ID = 'showcase';
const TYPES  = ['click', 'login', 'error', 'metric', 'message'];

const COLOR = {
  click:   '#4e79a7',
  login:   '#59a14f',
  error:   '#e15759',
  metric:  '#f28e2b',
  message: '#76b7b2',
};

const VARIANT = {
  click:   'blue',
  login:   'green',
  error:   'red',
  metric:  'yellow',
  message: 'purple',
};

const SAMPLES = {
  click:   ['btn:save', 'btn:next', 'link:about', 'tab:settings', 'icon:share'],
  login:   ['user:42', 'user:7',   'admin:1',     'guest:anon',   'sso:gh'],
  error:   ['401 unauthorized', '500 internal', 'timeout', 'parse failed', 'rate-limited'],
  metric:  ['cpu 24%', 'mem 1.2GB', 'rps 312', 'lat 18ms', 'conn 87'],
  message: ['hello',   'lgtm',     'shipping it', 'on it',    'ack'],
};

// Pure helpers (curried where it pays off)

const _id   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const _ts   = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const _pick = arr => arr[Math.floor(Math.random() * arr.length)];

// type -> event factory   (curried - capture the type once, reuse)
const eventFor = type => () => ({ id: _id(), type, ts: _ts(), msg: _pick(SAMPLES[type]) });

// state-slice updater   (key -> updater -> setState patch)
const updateShowcase = updater => setState(s => ({ showcase: updater(s.showcase || {}) }));

// Bus + module-level controllers (created lazily, once)

const _bus    = getBus(BUS_ID);     // named - any other module can grab it too
const _ctrls  = {};                 // type -> interval controller
let   _wired  = false;
let   _sampler = null;

const _wire = () => {
  if (_wired) return;
  _wired = true;

  // Subscriber 1 - cap feed at 14, bump per-type counter
  _bus.on('event', ev => updateShowcase(sc => ({
    ...sc,
    feed:     [ev, ...(sc.feed || [])].slice(0, 14),
    counters: { ...(sc.counters || {}), [ev.type]: ((sc.counters || {})[ev.type] || 0) + 1 },
  })));

  // Subscriber 2 - clear-all command channel
  _bus.on('clear', () => updateShowcase(sc => ({
    ...sc, feed: [], counters: {}, history: [], pinned: {},
  })));
};

// Build / rebuild an emitter with the current rate
const _mkCtrl = type => ms =>
  createInterval(() => _bus.emit('event', eventFor(type)()))({ ms });

const _ensureCtrl = type => {
  if (_ctrls[type]) return _ctrls[type];
  const ms = (getState().showcase || {}).rate || 1500;
  _ctrls[type] = _mkCtrl(type)(ms);
  return _ctrls[type];
};

// 1 Hz sampler - converts cumulative counters into a per-second rate stream.
// Created paused (autoStart: false). The user toggles it from the UI so the
// profiler isn't spammed with a setState every second when they're trying to
// inspect a specific render.
const _ensureSampler = () => {
  if (_sampler) return;
  _sampler = createInterval(() => updateShowcase(sc => {
    const total   = Object.values(sc.counters || {}).reduce((a, b) => a + b, 0);
    const last    = (sc.history || []).length ? sc.history[sc.history.length - 1].total : total;
    const rate    = Math.max(0, total - last);
    const history = [...(sc.history || []), { total, rate }].slice(-40);
    return { ...sc, history };
  }))({ ms: 1000 });
};

const toggleSampler = () => {
  _ensureSampler();
  updateShowcase(sc => {
    const next = !sc.sampling;
    if (next) _sampler.start();
    else      _sampler.stop();
    return { ...sc, sampling: next };
  });
};

// Side-effecting actions (pure inputs -> bus / controller mutation)

const toggleEmitter = type => () => {
  _ensureCtrl(type);
  updateShowcase(sc => {
    const running = { ...(sc.running || {}) };
    running[type] = !running[type];
    if (running[type]) _ctrls[type].start();
    else               _ctrls[type].stop();
    return { ...sc, running };
  });
};

const startAll = () => {
  TYPES.forEach(t => { _ensureCtrl(t).start(); });
  updateShowcase(sc => ({
    ...sc, running: TYPES.reduce((a, t) => ({ ...a, [t]: true }), {}),
  }));
};

const stopAll = () => {
  Object.values(_ctrls).forEach(c => c.stop());
  updateShowcase(sc => ({
    ...sc, running: TYPES.reduce((a, t) => ({ ...a, [t]: false }), {}),
  }));
};

const setRate = ms => {
  updateShowcase(sc => ({ ...sc, rate: ms }));
  Object.entries(_ctrls).forEach(([type, c]) => {
    const wasRunning = c.isRunning();
    c.stop();
    _ctrls[type] = _mkCtrl(type)(ms);
    if (wasRunning) _ctrls[type].start();
  });
};

const emitOne = type => () => _bus.emit('event', eventFor(type)());
const clearAll = () => _bus.emit('clear');
const togglePin = id => () => updateShowcase(sc => {
  const pinned = { ...(sc.pinned || {}) };
  if (pinned[id]) delete pinned[id]; else pinned[id] = true;
  return { ...sc, pinned };
});

// Memoised badge - cached by stableKey(opts), reused across every render

const MemoBadge = memoComponent(Badge);

// Styled templates via partial application
//
// sdiv(style) returns a curried vnode factory: props -> children -> vnode.
// Because the style string is baked in once, every reuse skips that arg
// entirely - the renderer also patches a stable style attribute, so React-
// style "did the className change?" diffing wins big when 200+ cells share
// the same shell.

// Outer cube wrapper - a single styled div used for every plane
const planeBox = sdiv([
  'display:flex; flex-direction:column; gap:6px; padding:8px;',
  'background:var(--surface); border:1px solid var(--border);',
  'border-radius:var(--radius);',
].join(' '));

// Row inside a plane - flex row of cells, baked once
const planeRow = sdiv('display:flex; gap:4px;');

// One styled cell template, parameterised only by inline color via props.style
//  (style strings concatenate, so the outer baked style wins for layout
//   while the per-call style supplies the color)
const cellBox = sdiv([
  'flex:1; aspect-ratio:1; border-radius:4px;',
  'display:flex; align-items:center; justify-content:center;',
  'font-size:6px; font-family:monospace; color:rgba(255,255,255,.85);',
  'transition:transform .15s, filter .15s;',
].join(' '));

// Header chip (also styled) - reused per plane
const planeLabel = sspan([
  'font-size:11px; font-weight:700; text-transform:uppercase;',
  'letter-spacing:.06em; color:var(--text-muted);',
].join(' '));

// Color palettes for the n³ grid

const HUES = {
  rainbow: (x, y, z, n) => `hsl(${Math.round((x + y + z) * 360 / (n * 3))}, 70%, ${30 + (z / n) * 40}%)`,
  ocean:   (x, y, z, n) => `hsl(${200 + (x / n) * 40}, ${50 + (y / n) * 40}%, ${20 + (z / n) * 50}%)`,
  ember:   (x, y, z, n) => `hsl(${10 + (x / n) * 40}, ${60 + (y / n) * 30}%, ${25 + (z / n) * 55}%)`,
  mono:    (x, y, z, n) => `hsl(220, 10%, ${15 + ((x + y + z) / (n * 3)) * 70}%)`,
};

// Memoized matrix pipeline
//
// Three layers, each a pure (opts -> vnode) factory wrapped in memoize().
// When the matrix params don't change between renders, every cell is a
// cache hit - vnode construction is essentially free, even for 32³ cells.
//
// At n=32 -> 32³ = 32768 cells. Cap the cell cache at 50k so a full grid
// fits without eviction. Plane and matrix caches stay small (≤ 32 entries).

// Raw factories - wrapped in freeze() so the cached vnodes carry props.memo
// and the renderer can short-circuit on ===-equality next render.
const _cellRaw = ({ x, y, z, color }) =>
  freeze(cellBox({ key: `c-${x}-${y}-${z}`, style: `background:${color}` })([`${x}${y}${z}`]));

const _planeRawWith = cellFn => ({ hue, n, z }) => {
  const hueFn = HUES[hue] || HUES.rainbow;
  return freeze(planeBox({ key: `p-${z}` })([
    planeLabel({})([`z = ${z}`]),
    ...Array.from({ length: n }, (_, y) =>
      planeRow({ key: `r-${z}-${y}` })(
        Array.from({ length: n }, (__, x) =>
          cellFn({ x, y, z, color: hueFn(x, y, z, n) })
        )
      )
    ),
  ]));
};

const _matrixRawWith = planeFn => ({ hue, n }) =>
  freeze(div({
    className: 'cvs-matrix',
    style: `display:grid; gap:8px; grid-template-columns:repeat(${Math.min(n, 4)}, 1fr)`,
  })(Array.from({ length: n }, (_, z) => planeFn({ hue, n, z }))));

// Cached pipeline - chain memoized layers
//  Cell    : memoize(50_000)  - covers n=32 (32k cells) without eviction
//  Plane   : memoize() default - at most n entries (≤ 32)
//  Matrix  : memoLeaf          - single (hue, n) tuple
const Cell        = memoize(50_000)(_cellRaw);
const Plane       = memoize(64)(_planeRawWith(Cell));
const MatrixMemo  = memoLeaf(_matrixRawWith(Plane));

// Uncached pipeline - same code, no memoize wrappers, for A/B comparison
const MatrixRaw   = _matrixRawWith(_planeRawWith(_cellRaw));

const buildMatrix = (hue, n, useMemo) =>
  (useMemo ? MatrixMemo : MatrixRaw)({ hue, n });

// Curried view templates - partial application builds widgets

const tile = ({ label: lbl, color, value, sub, onClick, active }) =>
  div({
    onclick: onClick,
    style: [
      'flex:1; min-width:120px; padding:12px 14px; border-radius:var(--radius);',
      `border:1px solid ${active ? color : 'var(--border)'};`,
      `background:${active ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--surface)'};`,
      'cursor:pointer; transition:border-color .15s, background .15s; user-select:none;',
    ].join(' '),
  })([
    div({ style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' })([
      span({ style: `width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block` })([]),
      span({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted)' })([lbl]),
    ]),
    div({ style: 'font-size:24px; font-weight:700; font-variant-numeric:tabular-nums' })([String(value)]),
    div({ style: 'font-size:11px; color:var(--text-muted); margin-top:2px' })([sub]),
  ]);

// emitter-row :: type -> running -> vnode
const emitterRow = type => running =>
  div({
    key: `emit-${type}`,
    style: 'display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:var(--radius); background:var(--surface-2)',
  })([
    span({ style: `width:8px; height:8px; border-radius:50%; background:${COLOR[type]}; flex-shrink:0` })([]),
    span({ style: 'min-width:64px; font-size:12px; font-weight:600' })([type]),
    Toggle({
      on:       running,
      onChange: toggleEmitter(type),
    })([running ? 'streaming' : 'paused']),
    div({ style: 'flex:1' })([]),
    button({
      type:    'button',
      title:   `Emit one ${type} event`,
      onclick: emitOne(type),
      style:   'font-size:11px; padding:3px 9px; border:1px solid var(--border); border-radius:var(--radius); background:none; color:var(--text); cursor:pointer',
    })(['emit one']),
  ]);

// feed-row :: pinned -> ev -> vnode
//  key:ev.id is what lets the keyed reconciler reorder rather than rebuild
const feedRow = pinned => ev =>
  div({
    key: ev.id,
    style: [
      'display:flex; align-items:center; gap:10px; padding:6px 8px; border-radius:var(--radius);',
      `border:1px solid ${pinned[ev.id] ? COLOR[ev.type] : 'transparent'};`,
      `background:${pinned[ev.id] ? `color-mix(in srgb, ${COLOR[ev.type]} 8%, transparent)` : 'var(--surface-2)'};`,
    ].join(' '),
  })([
    span({ style: 'font-family:monospace; font-size:11px; color:var(--text-muted); flex-shrink:0' })([ev.ts]),
    MemoBadge({ variant: VARIANT[ev.type] })([ev.type]),
    span({ style: 'flex:1; font-size:13px; font-family:monospace; color:var(--text)' })([ev.msg]),
    button({
      type:    'button',
      title:   pinned[ev.id] ? 'Unpin' : 'Pin',
      onclick: togglePin(ev.id),
      style:   'font-size:11px; padding:1px 6px; border:1px solid var(--border); border-radius:4px; background:none; color:var(--text-muted); cursor:pointer',
    })([pinned[ev.id] ? '★' : '☆']),
  ]);

// Panel

export const showcasePanel = state => {
  _wire();
  TYPES.forEach(_ensureCtrl);

  const sc       = state.showcase || {};
  const feed     = sc.feed     || [];
  const counters = sc.counters || {};
  const history  = sc.history  || [];
  const running  = sc.running  || {};
  const pinned   = sc.pinned   || {};
  const filter   = sc.filter   || '';
  const selected = sc.selected || null;
  const rate     = sc.rate     || 1500;
  const matrixN    = sc.matrixN    || 6;
  const matrixHue  = sc.matrixHue  || 'rainbow';
  const matrixMemo = sc.matrixMemo !== false;
  const sampling   = !!sc.sampling;

  const total      = Object.values(counters).reduce((a, b) => a + b, 0);
  const lastRate   = history.length ? history[history.length - 1].rate : 0;
  const peakRate   = history.reduce((m, h) => Math.max(m, h.rate), 0);
  const sparkData  = history.map(h => h.rate);
  const barData    = TYPES.map(t => ({ label: t, value: counters[t] || 0 }));
  const visibleEvs = filter
    ? feed.filter(e => (e.type + ' ' + e.msg).toLowerCase().includes(filter.toLowerCase()))
    : feed;
  const shownFeed  = selected ? visibleEvs.filter(e => e.type === selected) : visibleEvs;
  const anyRunning = Object.values(running).some(Boolean);

  return div({ style: 'display:flex; flex-direction:column; gap:16px' })([

    // Intro
    Card({ title: '◆ Live Telemetry - renderer showcase' })([
      p({ style: 'margin:0 0 10px; font-size:13px; color:var(--text-muted); line-height:1.6' })([
        'A single page exercising every renderer feature at once: a named ',
        code({})(['createBus']), ' fans events out to subscribers, ',
        code({})(['createInterval']), ' drives five independent emitters, ',
        'derived state feeds a ', code({})(['BarChart']), ' + ', code({})(['SparkLine']),
        ', and the feed list uses ', strong({})(['keyed reconciliation']), ' so reordering and pinning never tears the DOM. ',
        'Type into the filter while events stream - the cursor stays put.',
      ]),
      div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
        button({
          type: 'button', onclick: startAll,
          style: 'padding:6px 14px; font-size:12px; font-weight:600; background:var(--accent); color:#fff; border:none; border-radius:var(--radius); cursor:pointer',
        })(['▶ Start all streams']),
        button({
          type: 'button', onclick: stopAll,
          style: 'padding:6px 14px; font-size:12px; font-weight:600; background:none; color:var(--text); border:1px solid var(--border); border-radius:var(--radius); cursor:pointer',
        })(['⏸ Stop all']),
        button({
          type: 'button', onclick: clearAll,
          title: "Emits 'clear' on the bus - both subscribers react",
          style: 'padding:6px 14px; font-size:12px; font-weight:600; background:none; color:var(--text); border:1px solid var(--border); border-radius:var(--radius); cursor:pointer',
        })(['⌫ bus.emit("clear")']),
        div({ style: 'flex:1' })([]),
        anyRunning
          ? Badge({ variant: 'green' })([`${Object.values(running).filter(Boolean).length} stream(s) live`])
          : Badge({ variant: 'gray' })(['idle']),
      ]),
    ]),

    // Stat tiles - derived from the SAME counters the chart reads
    div({ style: 'display:flex; gap:12px; flex-wrap:wrap' })([
      tile({
        label: 'Total events', color: 'var(--accent)',
        value: total, sub: 'all-time on this panel',
      }),
      tile({
        label: 'Live rate', color: '#59a14f',
        value: `${lastRate}/s`, sub: `peak ${peakRate}/s`,
      }),
      tile({
        label: 'Bus subscribers', color: '#4e79a7',
        value: 2, sub: '"event" + "clear"',
      }),
      tile({
        label: 'Feed shown', color: '#f28e2b',
        value: `${shownFeed.length}/${feed.length}`,
        sub:   selected ? `filtered by ${selected}` : (filter ? 'text filter active' : 'no filter'),
      }),
    ]),

    // Charts row
    Row({ gap: 16 })([
      Col({ span: 12, md: 7 })([
        Card({ title: 'Counters by type - click a bar to filter the feed' })([
          p({ style: 'margin:0 0 10px; font-size:12px; color:var(--text-muted)' })([
            selected
              ? span({})([
                  'Filtering by ',
                  MemoBadge({ variant: VARIANT[selected] })([selected]),
                  span({
                    style: 'margin-left:8px; font-size:11px; cursor:pointer; color:var(--accent); text-decoration:underline',
                    onclick: () => updateShowcase(s => ({ ...s, selected: null })),
                  })(['clear']),
                ])
              : 'Both this chart and the feed below derive from the same store - one source of truth.',
          ]),
          div({ style: 'overflow-x:auto' })([
            BarChart({
              width:      520,
              height:     180,
              gap:        14,
              onBarHover: item => updateShowcase(s => ({ ...s, selected: item ? item.label : null })),
            })(barData),
          ]),
        ]),
      ]),
      Col({ span: 12, md: 5 })([
        Card({ title: 'Events / second (1Hz sampler -> SparkLine)' })([
          p({ style: 'margin:0 0 10px; font-size:12px; color:var(--text-muted)' })([
            'A second ', code({})(['createInterval']), ' samples the cumulative counter once per second. ',
            strong({})(['Off by default']), ' so the profiler is not spammed - toggle it on to populate the chart.',
          ]),
          div({ style: 'display:flex; gap:10px; align-items:center; margin-bottom:8px' })([
            Toggle({ on: sampling, onChange: toggleSampler })([
              sampling ? '1Hz sampler running' : '1Hz sampler paused',
            ]),
            div({ style: 'flex:1' })([]),
            sampling
              ? Badge({ variant: 'green' })(['live'])
              : Badge({ variant: 'gray' })(['paused']),
          ]),
          div({ style: 'padding:8px 4px' })([
            sparkData.length > 1
              ? SparkLine({ width: 320, height: 80, color: '#59a14f', fill: true, smooth: true })(sparkData)
              : div({ style: 'font-size:12px; color:var(--text-muted); text-align:center; padding:24px' })([
                  sampling ? 'Buffering - wait for the next tick…' : 'Sampler paused. Toggle it on above to start collecting.',
                ]),
          ]),
          div({ style: 'display:flex; gap:8px; align-items:center; font-size:12px; color:var(--text-muted)' })([
            span({})([`buffer: ${sparkData.length}/40`]),
            div({ style: 'flex:1' })([]),
            span({})([`now: ${lastRate}/s · peak: ${peakRate}/s`]),
          ]),
        ]),
      ]),
    ]),

    // Emitters + rate slider
    Row({ gap: 16 })([
      Col({ span: 12, md: 6 })([
        Card({ title: 'Emitters (each is its own createInterval)' })([
          p({ style: 'margin:0 0 10px; font-size:12px; color:var(--text-muted)' })([
            'Toggling a row starts/stops the underlying interval. The bus does not know - and does not care - who publishes.',
          ]),
          div({ style: 'display:flex; flex-direction:column; gap:6px' })(
            TYPES.map(t => emitterRow(t)(!!running[t]))
          ),
        ]),
      ]),
      Col({ span: 12, md: 6 })([
        Card({ title: 'Tick rate (live re-binding)' })([
          p({ style: 'margin:0 0 10px; font-size:12px; color:var(--text-muted)' })([
            'Changing the slider tears down each emitter and rebuilds it at the new interval - without dropping a beat for the running ones.',
          ]),
          Slider({
            id:      'rate-slider',
            label:   `${rate} ms between ticks`,
            value:   rate,
            min:     200,
            max:     3000,
            step:    100,
            onInput: e => setRate(+e.target.value),
          }),
          div({ style: 'margin-top:8px; font-size:11px; color:var(--text-muted)' })([
            'Try sliding while a stream is running and watch the SparkLine respond.',
          ]),
        ]),
      ]),
    ]),

    // Feed - keyed reconciler + focus preservation
    Card({ title: 'Live event feed (keyed list)' })([
      div({ style: 'display:flex; gap:10px; align-items:center; margin-bottom:10px; flex-wrap:wrap' })([
        // Live filter input - focus survives every re-render below it
        input({
          type:        'search',
          placeholder: 'Filter (try "user" or "401")…',
          value:       filter,
          oninput:     e => updateShowcase(s => ({ ...s, filter: e.target.value })),
          style: 'flex:1; min-width:180px; padding:6px 10px; font-size:13px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-2); color:var(--text)',
        }),
        span({ style: 'font-size:11px; color:var(--text-muted)' })([
          'cursor stays put while events stream - focus is restored after every patch',
        ]),
      ]),

      shownFeed.length === 0
        ? div({ style: 'padding:20px; text-align:center; font-size:12px; color:var(--text-muted)' })([
            feed.length === 0
              ? 'No events yet - start a stream above or click "emit one" on a row.'
              : 'No events match the current filter.',
          ])
        : div({ style: 'display:flex; flex-direction:column; gap:4px' })(
            shownFeed.map(feedRow(pinned))
          ),

      Object.keys(pinned).length > 0
        ? div({ style: 'margin-top:8px; padding-top:8px; border-top:1px solid var(--border); font-size:11px; color:var(--text-muted)' })([
            `${Object.keys(pinned).length} pinned - pinned rows survive even after they age out of the feed buffer (state lives in the store, not the DOM).`,
          ])
        : div({})([]),
    ]),

    // How it works
    Card({ title: 'What this demo proves' })([
      div({ style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px' })([
        div({ style: 'padding:10px 12px; background:var(--surface-2); border-radius:var(--radius); border:1px solid var(--border)' })([
          strong({ style: 'font-size:12px' })(['One bus, many ears']),
          p({ style: 'margin:4px 0 0; font-size:12px; color:var(--text-muted)' })([
            'getBus("showcase") is the same instance no matter where it is imported. Two subscribers read the "event" channel; "clear" is a separate command channel.',
          ]),
        ]),
        div({ style: 'padding:10px 12px; background:var(--surface-2); border-radius:var(--radius); border:1px solid var(--border)' })([
          strong({ style: 'font-size:12px' })(['Pure render functions']),
          p({ style: 'margin:4px 0 0; font-size:12px; color:var(--text-muted)' })([
            'Every chart, tile and feed row is derived from the showcase slice. There is no imperative DOM code anywhere in this panel.',
          ]),
        ]),
        div({ style: 'padding:10px 12px; background:var(--surface-2); border-radius:var(--radius); border:1px solid var(--border)' })([
          strong({ style: 'font-size:12px' })(['Keyed reordering']),
          p({ style: 'margin:4px 0 0; font-size:12px; color:var(--text-muted)' })([
            'Each feed row carries key:ev.id, so when a new event arrives the reconciler does an insertBefore - not a full rebuild. That is what keeps the input focused.',
          ]),
        ]),
        div({ style: 'padding:10px 12px; background:var(--surface-2); border-radius:var(--radius); border:1px solid var(--border)' })([
          strong({ style: 'font-size:12px' })(['Currying as templating']),
          p({ style: 'margin:4px 0 0; font-size:12px' })([
            code({})(['emitterRow(type)(running)']), ' and ', code({})(['feedRow(pinned)(ev)']),
            ' are partially-applied templates - each call is one expression, no JSX necessary.',
          ]),
        ]),
      ]),
    ]),

    // n³ template grid - partial application generates thousands of cells
    Card({ title: `Templating with sdiv - ${matrixN}³ = ${matrixN ** 3} cells from one styled template` })([
      p({ style: 'margin:0 0 10px; font-size:13px; color:var(--text-muted); line-height:1.6' })([
        strong({})(['sdiv(style)']), ' bakes a style string into a vnode factory once. ',
        'The pipeline is three pure layers - ',
        code({})(['Cell -> Plane -> Matrix']),
        ' - each wrapped in ', code({})(['memoize()']),
        '. When the matrix params don\'t change between renders, every node is a cache hit, ',
        'so vnode construction for ', strong({})([`${matrixN ** 3}`]), ' cells is essentially free. ',
        'Open the State Debugger ⚙ to watch ', code({})(['computeMs']),
        ' - flip the toggle below for an A/B comparison at the same n.',
      ]),

      div({ style: 'display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-bottom:14px' })([
        div({ style: 'flex:1; min-width:240px' })([
          Slider({
            id:      'matrix-n',
            label:   `n = ${matrixN}  ->  ${matrixN}³ = ${matrixN ** 3} cells, ${matrixN} planes of ${matrixN}x${matrixN}`,
            value:   matrixN,
            min:     2,
            max:     32,
            step:    1,
            onInput: e => updateShowcase(s => ({ ...s, matrixN: +e.target.value })),
          }),
        ]),
        div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })(
          Object.keys(HUES).map(h =>
            button({
              key:     `hue-${h}`,
              type:    'button',
              onclick: () => updateShowcase(s => ({ ...s, matrixHue: h })),
              style: [
                'padding:4px 10px; font-size:11px; font-weight:600;',
                'border-radius:var(--radius); cursor:pointer;',
                matrixHue === h
                  ? 'border:1px solid var(--accent); background:var(--accent); color:#fff'
                  : 'border:1px solid var(--border); background:none; color:var(--text)',
              ].join(' '),
            })([h])
          )
        ),
      ]),

      div({ style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:12px; padding:10px 12px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius)' })([
        Toggle({
          on:       matrixMemo,
          onChange: () => updateShowcase(s => ({ ...s, matrixMemo: !s.matrixMemo })),
        })([matrixMemo ? 'memoize: ON  (Cell + Plane + Matrix all cached)' : 'memoize: OFF (raw construction every render)']),
        div({ style: 'flex:1' })([]),
        matrixMemo
          ? Badge({ variant: 'green' })(['cached pipeline'])
          : Badge({ variant: 'yellow' })(['raw pipeline']),
        button({
          type:    'button',
          title:   'Force a recompute by changing the cache key',
          onclick: () => updateShowcase(s => ({ ...s, matrixTick: (s.matrixTick || 0) + 1 })),
          style:   'padding:4px 10px; font-size:11px; font-weight:600; border:1px solid var(--border); border-radius:var(--radius); background:none; color:var(--text); cursor:pointer',
        })(['↻ trigger render']),
      ]),

      buildMatrix(matrixHue, matrixN, matrixMemo),

      doc([`// 1. Bake style into a vnode factory once
const cellBox = sdiv('flex:1; aspect-ratio:1; border-radius:4px; ...');

// 2. Three pure (opts -> vnode) layers
const _cellRaw   = ({ x, y, z, color }) =>
  cellBox({ key: \`c-\${x}-\${y}-\${z}\`, style: \`background:\${color}\` })([\`\${x}\${y}\${z}\`]);

const _planeRawWith = cellFn => ({ hue, n, z }) => { /* maps n*n cells via cellFn */ };
const _matrixRawWith = planeFn => ({ hue, n }) => { /* maps n planes via planeFn */ };

// 3. Wrap each layer in a memoize cache
//   Cap the cell cache at 50k so n=32 (32768 cells) fits without eviction.
const Cell    = memoize(50_000)(_cellRaw);
const Plane   = memoize(64)(_planeRawWith(Cell));
const Matrix  = memoLeaf(_matrixRawWith(Plane));

// 4. Render - when (hue, n) are unchanged, every cell is a cache hit
const view = state => Matrix({ hue: state.hue, n: state.n });`]),
    ]),

    // Code
    Card({ title: 'Bus + interval wiring' })([
      doc([`// 1. Grab a named bus - same instance everywhere
const bus = getBus('showcase');

// 2. Curried event factory - partial application
const eventFor = type => () =>
  ({ id: _id(), type, ts: _ts(), msg: pickSample(type) });

// 3. Subscribers reduce events into the store
bus.on('event', ev => setState(s => ({
  showcase: {
    ...s.showcase,
    feed:     [ev, ...s.showcase.feed].slice(0, 14),
    counters: { ...s.showcase.counters,
                [ev.type]: (s.showcase.counters[ev.type] || 0) + 1 },
  },
})));

bus.on('clear', () => setState(s =>
  ({ showcase: { ...s.showcase, feed: [], counters: {}, history: [] } })));

// 4. One controllable interval per type
const ctrls = TYPES.reduce((acc, type) => ({
  ...acc,
  [type]: createInterval(() => bus.emit('event', eventFor(type)()))({ ms: 1500 }),
}), {});

// 5. A second interval samples the rate for the SparkLine
createInterval(() => setState(s => {
  const total = Object.values(s.showcase.counters).reduce((a, b) => a + b, 0);
  const last  = s.showcase.history.at(-1)?.total ?? total;
  return { showcase: {
    ...s.showcase,
    history: [...s.showcase.history, { total, rate: total - last }].slice(-40),
  }};
}))({ ms: 1000, autoStart: true });`]),
    ]),

  ]);
};
