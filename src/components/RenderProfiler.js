import { div, span, button, table, th, td, tr, tbody, thead } from '../elements.js';
import { fst, snd } from '../../lib/odocosjs/src/core.js'
import { cn } from '../utils.js';
import { getRenderLog, getProfilerFrame, enableProfiler, disableProfiler } from '../state.js';
import { Button } from './Button.js';
import { BarChart, MultiLineChart } from './Charts.js';

// ── Module-level UI state ────────────────────────────────────────────────
const _ui = {
  limit:        50,
  showTable:    false,
  expandedFrame: null,   // frame number whose detail row is open
  lastSeenFrame: -1,     // used to auto-detach when the component stops rendering
};

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = n => n < 0.1 ? '<0.1' : n.toFixed(2);
const hot = ms => ms > 16.67;

// Colours
const C_COMPUTE = '#76b7b2';
const C_PATCH   = '#f28e2b';
const C_TOTAL   = '#4e79a7';
const C_HOT     = '#e15759';

// Mini 2-bar breakdown (compute vs patch for a single frame)
const breakdownChart = e =>
  BarChart({
    width: 170, height: 84, paddingX: 44, paddingY: 12, gap: 14, gridLines: false,
    showValues: true,
    valueFmt:   v => (v < 0.1 ? '<0.1' : v.toFixed(2)) + 'ms',
  })([
    { label: 'compute', value: e.computeMs, color: C_COMPUTE },
    { label: 'patch',   value: e.patchMs,   color: C_PATCH   },
  ]);

// Expanded detail for a frame
const frameDetail = e =>
  div({ className: 'rp-detail-inner' })([
    div({})([breakdownChart(e)]),
    keysRow(e),
    opsRow(e),
  ]);

const detailRow = e =>
  tr({ className: 'rp-detail-row', key: `d${e.frame}` })([
    td({ className: 'rp-detail-cell', colSpan: 5 })([
      keysRow(e),
      opsRow(e),
    ]),
  ]);

// Changed-keys badge row
const keysRow = e => {
  const keys = e.changedKeys ?? [];
  return div({ className: 'rp-detail-labels', style: 'gap:4px' })([]
    .concat(span({ className: 'rp-ops-lbl', style: 'margin-right:4px; flex-shrink:0' })(['changed keys']))
    .concat(keys.length > 0
      ? keys.map(k => Button({ className: 'rp-badge', onClick: () => console.log(k(snd)), toolTip: "click to log value" })([k(fst)]))
      : [span({ style: 'color:var(--text-muted)' })(['—'])]
    )
  );
};

// DOM op chip
const opsChip = label => val =>
  span({ className: 'rp-ops-chip' })([
    span({ className: 'rp-ops-val' })([String(val)]),
    span({ className: 'rp-ops-lbl' })([label]),
  ]);

// DOM ops summary row
const opsRow = e => {
  const ops   = e.ops ?? {};
  const total = (ops.creates ?? 0) + (ops.replaces ?? 0) + (ops.removes ?? 0) + (ops.inserts ?? 0);
  const rate  = (ops.vnodes ?? 0) > 0 ? Math.round(total / ops.vnodes * 100) : 0;
  return div({ className: 'rp-ops-row' })([
    opsChip('visited')(ops.vnodes       ?? 0),
    opsChip('created')(ops.creates      ?? 0),
    opsChip('replaced')(ops.replaces    ?? 0),
    opsChip('removed')(ops.removes      ?? 0),
    opsChip('moved')(ops.inserts        ?? 0),
    opsChip('propSets')(ops.propPatches  ?? 0),
    opsChip('textEdits')(ops.textUpdates ?? 0),
    span({
      className: 'rp-ops-rate',
      title: `${total} DOM mutations out of ${ops.vnodes ?? 0} nodes visited`,
    })([`${rate}% mutation rate`]),
  ]);
};

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Auto-detaches (calls disableProfiler) when it stops being rendered,
 * e.g. when the debug panel is closed.
 *
 * @param {Object}   opts
 * @param {function} opts.setState  Store setState — used to force re-renders.
 *
 * ── How to read the profiler ─────────────────────────────────────────────
 *
 * STAT CHIPS (top row)
 *   last   — total ms for the most recent frame.
 *   avg    — mean over the visible window (up to 50 frames).
 *   max    — worst frame recorded.
 *   p95    — 95th-percentile: 95 % of frames were at or below this value.
 *            More useful than max for spotting systemic slowness vs one-off spikes.
 *   frames — how many frames are in the ring buffer (max 100).
 *   Values shown in red are over the 16.67 ms budget (i.e. they caused a dropped frame).
 *
 * SPARKLINE BARS
 *   Each bar = one render frame, oldest on the left, newest on the right.
 *   Red bars exceeded 16.67 ms. Click any bar to expand its detail below the chart.
 *
 * TIMING BREAKDOWN (expanded detail, top section)
 *   compute — time spent calling view(state) to produce the new vnode tree.
 *             High compute usually means expensive render logic (heavy map/filter,
 *             string building, etc.). The view function itself is the hotspot.
 *   patch   — time spent walking the old DOM and the new vnode tree together,
 *             diffing and applying changes. High patch usually means a large tree
 *             or many DOM mutations. Check the ops counts below to diagnose.
 *
 * CHANGED KEYS (expanded detail, middle row)
 *   The state keys whose values were !== compared to the previous frame.
 *   "—" means no key changed, which happens on the initial render or on a
 *   setState({}) force-refresh used to redraw the profiler itself.
 *   If you see a key changing every single frame, something is creating a new
 *   object/array on every setState even when the logical value is the same.
 *
 * DOM OPS (expanded detail, bottom row)
 *   visited    — how many times _patch() was entered during this frame. This
 *                counts every node the reconciler LOOKED AT, not just ones it
 *                changed. It grows with tree depth × number of children. A
 *                steady high number here is expected and fine; it just means
 *                you have a large tree. It does NOT mean DOM was mutated.
 *
 *   created    — new DOM nodes appended (appendChild). Happens when the new
 *                vnode list is longer than the old DOM, or when a keyed node
 *                appears for the first time.
 *
 *   replaced   — existing DOM nodes swapped out (replaceChild). Happens when
 *                the tag changes (e.g. div → span), or when a text node is
 *                replaced by an element or vice-versa. Replacements are
 *                expensive because the old subtree is thrown away entirely.
 *                High replaces usually indicate keyed lists with mismatched
 *                or missing keys, or conditional rendering that switches tags.
 *
 *   removed    — DOM nodes deleted (removeChild). Happens when the new vnode
 *                list is shorter than the old DOM, or when a keyed node
 *                disappears. Normal during list filtering.
 *
 *   moved      — existing DOM nodes repositioned (insertBefore on a node
 *                already in the tree). The key-based reconciler reorders keyed
 *                children with insertBefore rather than destroying them. High
 *                moves with low created/replaced = good: keying is working,
 *                DOM nodes are being reused, just repositioned.
 *
 *   propSets   — number of elements that went through prop-diffing. Every
 *                element with the same tag gets its props compared every frame.
 *                This is O(elements in tree), not O(changed props). Normal.
 *
 *   textEdits  — text node nodeValue changes. Each one is a direct DOM write.
 *                High textEdits = many interpolated strings in your view
 *                changing each frame. Usually fine, but worth noting alongside
 *                patch time.
 *
 * MUTATION RATE  (percentage shown after the chips)
 *   (created + replaced + removed + moved) / visited × 100 %.
 *   A low rate (0–5 %) is healthy: the reconciler looked at a lot but changed
 *   little. A rate above ~30 % on a re-render that only changes one key is a
 *   signal that child nodes lack stable keys and are being rebuilt unnecessarily.
 *
 * QUICK DIAGNOSIS GUIDE
 *   Slow compute, normal patch → expensive view function. Profile JS directly.
 *   Normal compute, slow patch → large tree or many mutations. Check counts.
 *   High replaced, low moved   → missing or unstable keys on lists.
 *   High visited, low mutations → healthy. Tree is large but stable.
 *   changed keys = {} on every frame → setState({}) is being called too often
 *                                       (likely a polling or timer re-render).
 */
let _wasActive = false;

const RenderProfiler = ({ setState = () => {}, active = true } = {}) => {
  if (!active) { _wasActive = false; return div({ style: 'display:none' })([]); }
  const justActivated = !_wasActive;
  _wasActive = true;
  enableProfiler();
  const force = () => setState({});

  // On first active render, this frame ran as _runFast (profiling was off
  // when the rAF fired). Kick one follow-up so the first profiled frame
  // captures real data and the UI isn't empty.
  if (justActivated) { queueMicrotask(force); }

  // ── auto-detach: if the frame counter hasn't advanced since last render,
  //    we're still alive; if it HAS advanced but we weren't called, we won't
  //    reach here anyway. Track the frame we last ran at so that calling
  //    disableProfiler from the FloatingPanel onClose is enough — but also
  //    register our "I'm alive" stamp so cleanup is possible from outside.
  _ui.lastSeenFrame = getProfilerFrame();

  const log = getRenderLog().slice(0, _ui.limit);
  if (!log.length)
    return div({ className: 'rp-empty' })(['No renders recorded yet.']);

  // ── aggregate stats ──────────────────────────────────────────────────
  const totals  = log.map(e => e.totalMs);
  const last    = totals[0];
  const avg     = totals.reduce((a, b) => a + b, 0) / totals.length;
  const maximum = Math.max(...totals);
  const sorted  = [...totals].sort((a, b) => a - b);
  const p95     = sorted[Math.floor(sorted.length * 0.95)] ?? maximum;

  // ── chart series (oldest → newest) ────────────────────────────────────────
  const frames       = log.slice().reverse();
  const highlightIdx = _ui.expandedFrame != null
    ? frames.findIndex(f => f.frame === _ui.expandedFrame)
    : null;
  const chartSeries  = [
    { label: 'total',   color: C_TOTAL,   data: frames.map(f => f.totalMs)   },
    { label: 'compute', color: C_COMPUTE, data: frames.map(f => f.computeMs) },
    { label: 'patch',   color: C_PATCH,   data: frames.map(f => f.patchMs)   },
  ];
  const xLabels      = frames.map(f => `#${f.frame}`);

  // ── expanded frame ────────────────────────────────────────────────────
  const expanded = highlightIdx != null ? frames[highlightIdx] : null;

  return div({ className: 'rp-root' })([

    // ── stat chips ───────────────────────────────────────────────────────
    div({ className: 'rp-stats' })([
      statChip('last')(`${fmt(last)}ms`)(hot(last)),
      statChip('avg')(`${fmt(avg)}ms`)(hot(avg)),
      statChip('max')(`${fmt(maximum)}ms`)(hot(maximum)),
      statChip('p95')(`${fmt(p95)}ms`)(hot(p95)),
      statChip('frames')(String(getRenderLog().length))(false),
      div({ style: 'flex:1' })([]),
      button({
        className: 'rp-btn',
        type:      'button',
        title:     'Force a re-render',
        onclick:   force,
      })(['↻']),
      button({
        className: cn('rp-btn', _ui.showTable && 'rp-btn-active'),
        type:      'button',
        title:     'Toggle frame table',
        onclick:   () => { _ui.showTable = !_ui.showTable; force(); },
      })(['≡']),
    ]),

    // ── timing / history multi-line chart ────────────────────────────────────────────
    MultiLineChart({
      width: 840, height: 130, paddingX: 36, paddingY: 14,
      gridLines: true, dots: true, dotR: 3, legend: true,
      xLabels,
      highlightIdx,
      onPointClick: i => {
        _ui.expandedFrame = i === highlightIdx ? null : frames[i].frame;
        force();
      },
    })(chartSeries),

    // ── expanded frame detail ────────────────────────────────────────────────────
    expanded
      ? div({ className: 'rp-chart-detail' })([
          span({ className: 'rp-cd-frame', style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:6px' })([
            `#${expanded.frame}  ${expanded.ts}  —  total ${fmt(expanded.totalMs)}ms`,
          ]),
          frameDetail(expanded),
        ])
      : div({ style: 'display:none' })([]),

    // ── table ────────────────────────────────────────────────────────────
    _ui.showTable
      ? table({ className: 'rp-table' })([
          thead({})([
            tr({ className: 'rp-header', key: 'hdr' })([
              th({ className: 'rp-cell rp-frame' })(['#']),
              th({ className: 'rp-cell rp-ts'    })(['time']),
              th({ className: 'rp-cell rp-num'   })(['compute']),
              th({ className: 'rp-cell rp-num'   })(['patch']),
              th({ className: 'rp-cell rp-num'   })(['total']),
            ]),
          ]),
          tbody({})([
            ...log.flatMap(e => {
              const isOpen = _ui.expandedFrame === e.frame;
              return [
                tr({
                  className: cn('rp-row', hot(e.totalMs) && 'rp-row-hot', isOpen && 'rp-row-selected'),
                  key:       String(e.frame),
                  onclick:   () => { _ui.expandedFrame = isOpen ? null : e.frame; force(); },
                  style:     'cursor:pointer',
                })([
                  td({ className: 'rp-cell rp-frame' })([`#${e.frame}`]),
                  td({ className: 'rp-cell rp-ts'    })([e.ts]),
                  td({ className: 'rp-cell rp-num'   })([`${fmt(e.computeMs)}ms`]),
                  td({ className: 'rp-cell rp-num'   })([`${fmt(e.patchMs)}ms`]),
                  td({ className: cn('rp-cell rp-num', hot(e.totalMs) && 'rp-cell-hot') })([`${fmt(e.totalMs)}ms`]),
                ]),
                ...(isOpen ? [detailRow(e)] : []),
              ];
            }),
          ]),
        ])
      : div({ style: 'display:none' })([]),
  ]);
};

const statChip = label => value => isHot =>
  div({ className: 'rp-stat' })([
    span({ className: 'rp-stat-label' })([label]),
    span({ className: cn('rp-stat-val', isHot && 'rp-stat-hot') })([value]),
  ]);

export { RenderProfiler };
