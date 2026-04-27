/**
 * dervoJS — Chart components
 *
 * Pure SVG charts. All curried, data-driven, zero framework coupling.
 * Requires the SVG-aware renderer (createElementNS + setAttribute).
 *
 * ── Data format ────────────────────────────────────────────────────────────
 *   PieChart / BarChart / LineChart:
 *     [{ label: string, value: number, color?: string }]
 *
 *   SparkLine:
 *     number[]
 *
 * ── Components ─────────────────────────────────────────────────────────────
 *   PieChart(opts)(data)    — pie or donut chart with legend
 *   BarChart(opts)(data)    — vertical bar chart with Y-axis grid
 *   LineChart(opts)(data)   — line chart (fill / dots / smooth all optional)
 *   SparkLine(opts)(values) — minimal inline trend line, no axes
 *
 * ── Hover callbacks ────────────────────────────────────────────────────────
 *   All charts accept onXxxHover: (item | null, index | -1) → void
 *   Manage tooltip state in your store; keep charts declarative.
 *
 * @example
 *   PieChart({ innerRadius: 0.55 })(salesData)
 *   BarChart({ width: 360 })(monthlyData)
 *   LineChart({ fill: true, smooth: true })(trafficData)
 *   SparkLine({ width: 100, height: 28 })([3, 6, 4, 8, 5])
 */

import { vnode } from '../../lib/odocosjs/src/render.js';
import { div, span } from '../elements.js';
import { cn } from '../utils.js';

// ── Local SVG element factories ─────────────────────────────────────────────
const _svg    = vnode('svg');
const _g      = vnode('g');
const _path   = vnode('path');
const _rect   = vnode('rect');
const _circle = vnode('circle');
const _line   = vnode('line');
const _pline  = vnode('polyline');
const _txt    = vnode('text');

// ── Default colour palette ───────────────────────────────────────────────────
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

// ── Pure helpers (all curried) ───────────────────────────────────────────────
const _sum   = xs => xs.reduce((a, b) => a + b, 0);
const _max   = xs => Math.max(...xs);
const _min   = xs => Math.min(...xs);
const _fmt   = n  => Math.round(n * 100) / 100;
const _clamp = lo => hi => x => Math.max(lo, Math.min(hi, x));
const _color = palette => i => palette[i % palette.length];
const _toRad = deg => deg * Math.PI / 180;

/** Map v from [srcLo..srcHi] → [dstLo..dstHi] */
const _scale = srcLo => srcHi => dstLo => dstHi => v => {
  const t = srcHi === srcLo ? 0 : (v - srcLo) / (srcHi - srcLo);
  return dstLo + t * (dstHi - dstLo);
};

/** Polar (radians, radius) → Cartesian {x,y} around centre (cx, cy) */
const _polar = cx => cy => r => angle => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

// ── Nice grid helpers ────────────────────────────────────────────────────────

const _niceStep = max => {
  if (max <= 0) return 1;
  const rough = max / 4;
  const mag   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
};

/** Produce grid values [0 .. niceTop] covering max */
const _gridVals = max => {
  if (max <= 0) return [0];
  const step = _niceStep(max);
  const top  = Math.ceil(max / step) * step;
  const vals = [];
  for (let v = 0; v <= top + step * 0.01; v += step)
    vals.push(Math.round(v * 10000) / 10000);
  return vals;
};

/** Smallest nice number ≥ max */
const _niceTop = max => {
  if (max <= 0) return 1;
  const step = _niceStep(max);
  return Math.ceil(max / step) * step;
};

// ── SVG arc path for a pie/donut slice ──────────────────────────────────────
// cx, cy: centre; r: outer radius; ir: inner radius (0 = solid pie)
// s, e: start/end angles in radians
const _slicePath = cx => cy => r => ir => s => e => {
  const p  = _polar(cx)(cy);
  const o1 = p(r)(s);
  const o2 = p(r)(e);
  const lg = (e - s) > Math.PI ? 1 : 0;
  if (ir <= 0) return [
    `M ${_fmt(cx)} ${_fmt(cy)}`,
    `L ${_fmt(o1.x)} ${_fmt(o1.y)}`,
    `A ${_fmt(r)} ${_fmt(r)} 0 ${lg} 1 ${_fmt(o2.x)} ${_fmt(o2.y)}`,
    'Z',
  ].join(' ');
  const i1 = p(ir)(s);
  const i2 = p(ir)(e);
  return [
    `M ${_fmt(o1.x)} ${_fmt(o1.y)}`,
    `A ${_fmt(r)} ${_fmt(r)} 0 ${lg} 1 ${_fmt(o2.x)} ${_fmt(o2.y)}`,
    `L ${_fmt(i2.x)} ${_fmt(i2.y)}`,
    `A ${_fmt(ir)} ${_fmt(ir)} 0 ${lg} 0 ${_fmt(i1.x)} ${_fmt(i1.y)}`,
    'Z',
  ].join(' ');
};

// ── Catmull-Rom smooth path through [{x,y}] ──────────────────────────────────
const _smoothPath = pts => {
  if (pts.length < 2) return `M ${_fmt(pts[0].x)} ${_fmt(pts[0].y)}`;
  const T    = 0.3;
  const tang = i => ({
    x: ((i < pts.length - 1 ? pts[i+1].x : pts[i].x) - (i > 0 ? pts[i-1].x : pts[i].x)) * T,
    y: ((i < pts.length - 1 ? pts[i+1].y : pts[i].y) - (i > 0 ? pts[i-1].y : pts[i].y)) * T,
  });
  return pts.slice(1).reduce((acc, pt, j) => {
    const f  = pts[j];
    const t1 = tang(j);
    const t2 = tang(j + 1);
    return `${acc} C ${_fmt(f.x+t1.x)} ${_fmt(f.y+t1.y)} ${_fmt(pt.x-t2.x)} ${_fmt(pt.y-t2.y)} ${_fmt(pt.x)} ${_fmt(pt.y)}`;
  }, `M ${_fmt(pts[0].x)} ${_fmt(pts[0].y)}`);
};

// ── Colour legend (HTML) ─────────────────────────────────────────────────────
const _legend = palette => data =>
  div({ style: 'display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; font-size:12px; color:var(--text)' })(
    data.map((d, i) =>
      span({ style: 'display:flex; align-items:center; gap:5px' })([
        span({ style: `width:10px; height:10px; border-radius:50%; flex-shrink:0; background:${d.color || _color(palette)(i)}` })([]),
        d.label,
      ])
    )
  );

// ── PieChart ─────────────────────────────────────────────────────────────────
/**
 * Pie or donut chart. Each item in data becomes one slice.
 *
 * @param {Object}   opts
 * @param {number}   [opts.size=260]           SVG width and height in px
 * @param {number}   [opts.innerRadius=0]      0=pie; 0.1–0.9=donut (fraction of outer radius)
 * @param {number}   [opts.gapDeg=1]           Gap between slices in degrees
 * @param {boolean}  [opts.legend=true]        Show colour swatch legend below chart
 * @param {string[]} [opts.palette=PALETTE]    Colour palette; overridden per-item by item.color
 * @param {Function} [opts.onSliceHover]       (item | null, index | -1) → void
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 *
 * @returns {(data: {label: string, value: number, color?: string}[]) => vnode}
 *
 * @example
 *   PieChart({ size: 240, innerRadius: 0.55 })(salesByRegion)
 *   PieChart({ onSliceHover: (item, i) => setState({ hovered: item }) })(data)
 */
const PieChart = ({
  size        = 260,
  innerRadius = 0,
  gapDeg      = 1,
  legend      = true,
  palette     = PALETTE,
  onSliceHover,
  className   = '',
  style       = '',
} = {}) => data => {
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = cx * 0.78;
  const ir   = innerRadius > 0 ? r * _clamp(0)(0.92)(innerRadius) : 0;
  const tot  = _sum(data.map(d => d.value));
  const gapR = _toRad(gapDeg);
  const getC = _color(palette);

  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const frac  = d.value / tot;
    const sweep = frac * 2 * Math.PI - gapR;
    const s     = angle + gapR / 2;
    const e     = s + sweep;
    angle      += frac * 2 * Math.PI;
    return { d, frac, s, e, mid: (s + e) / 2, color: d.color || getC(i), i };
  });

  const lp = _polar(cx)(cy)(r * 1.18);

  return div({
    className: cn('chart chart-pie', className) || undefined,
    style:     `display:inline-flex; flex-direction:column; align-items:center;${style ? ' ' + style : ''}`,
  })([
    _svg({
      width:   String(size),
      height:  String(size),
      viewBox: `0 0 ${size} ${size}`,
      style:   'overflow:visible; display:block',
    })([
      ...slices.map(sl =>
        _path({
          d:              _slicePath(cx)(cy)(r)(ir)(sl.s)(sl.e),
          fill:           sl.color,
          stroke:         'var(--bg, #fff)',
          'stroke-width': '1.5',
          ...(onSliceHover ? {
            onmouseenter: () => onSliceHover(sl.d, sl.i),
            onmouseleave: () => onSliceHover(null, -1),
            style:        'cursor:pointer',
          } : {}),
        })([])
      ),
      ...slices.filter(sl => sl.frac >= 0.05).map(sl => {
        const pt = lp(sl.mid);
        return _txt({
          x:                   String(_fmt(pt.x)),
          y:                   String(_fmt(pt.y)),
          'text-anchor':       pt.x > cx + 2 ? 'start' : pt.x < cx - 2 ? 'end' : 'middle',
          'dominant-baseline': 'middle',
          'font-size':         '11',
          fill:                'var(--text, #333)',
        })([`${Math.round(sl.frac * 100)}%`]);
      }),
    ]),
    ...(legend ? [_legend(palette)(data)] : []),
  ]);
};

// ── BarChart ──────────────────────────────────────────────────────────────────
/**
 * Vertical bar chart with Y-axis grid lines.
 *
 * @param {Object}   opts
 * @param {number}   [opts.width=400]
 * @param {number}   [opts.height=240]
 * @param {number}   [opts.paddingX=48]        Left/right padding (Y labels live here)
 * @param {number}   [opts.paddingY=24]        Top/bottom padding
 * @param {number}   [opts.gap=6]              Gap between bars in px
 * @param {string}   [opts.color]              Default bar fill; overridden by item.color
 * @param {boolean}  [opts.gridLines=true]
 * @param {boolean}  [opts.legend=false]
 * @param {string[]} [opts.palette=PALETTE]
 * @param {Function} [opts.onBarHover]         (item | null, index | -1) → void
 * @param {Function} [opts.onBarClick]         (item, index) → void
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 *
 * @returns {(data: {label: string, value: number, color?: string}[]) => vnode}
 *
 * @example
 *   BarChart({ width: 360, gap: 8 })(monthlyRevenue)
 */
const BarChart = ({
  width      = 400,
  height     = 240,
  paddingX   = 48,
  paddingY   = 24,
  gap        = 6,
  color,
  gridLines  = true,
  legend     = false,
  palette    = PALETTE,
  showValues = false,
  valueFmt   = v => String(v),
  onBarHover,
  onBarClick,
  className  = '',
  style      = '',
} = {}) => data => {
  const chartW = width  - paddingX * 2;
  const n      = data.length;
  const barW   = Math.max(1, (chartW - gap * (n - 1)) / n);
  const maxVal = _max(data.map(d => d.value));
  const top    = _niceTop(maxVal);
  const yScale = _scale(0)(top)(height - paddingY)(paddingY);
  const getC   = color ? (_i => color) : _color(palette);
  const grids  = gridLines ? _gridVals(maxVal) : [];
  const xOf    = i => paddingX + i * (barW + gap);
  const yOf    = v => yScale(v);
  const hOf    = v => (height - paddingY) - yOf(v);

  return div({
    className: cn('chart chart-bar', className) || undefined,
    style:     style || undefined,
  })([
    _svg({
      width:   String(width),
      height:  String(height),
      viewBox: `0 0 ${width} ${height}`,
      style:   'display:block; overflow:visible',
    })([
      // Y-axis grid lines + labels
      _g({})([
        ...grids.map(v => _g({})([
          _line({
            x1:                String(paddingX),
            y1:                String(_fmt(yOf(v))),
            x2:                String(width - paddingX),
            y2:                String(_fmt(yOf(v))),
            stroke:            'var(--border, #ddd)',
            'stroke-width':    '1',
            'stroke-dasharray': v === 0 ? '0' : '3 3',
          })([]),
          _txt({
            x:                   String(paddingX - 6),
            y:                   String(_fmt(yOf(v))),
            'text-anchor':       'end',
            'dominant-baseline': 'middle',
            'font-size':         '10',
            fill:                'var(--text-muted, #888)',
          })([String(v)]),
        ])),
      ]),
      // Bars + X-axis labels
      _g({})([
        ...data.map((d, i) => {
          const x   = _fmt(xOf(i));
          const y   = _fmt(yOf(d.value));
          const h   = _fmt(hOf(d.value));
          const col = d.color || getC(i);
          return _g({})([
            _rect({
              x:      String(x),
              y:      String(y),
              width:  String(_fmt(barW)),
              height: String(h),
              fill:   col,
              rx:     '3',
              ...((onBarHover || onBarClick) ? { style: 'cursor:pointer' } : {}),
              ...(onBarHover ? {
                onmouseenter: () => onBarHover(d, i),
                onmouseleave: () => onBarHover(null, -1),
              } : {}),
              ...(onBarClick ? {
                onclick: () => onBarClick(d, i),
              } : {}),
            })([]),
            ...(showValues ? [
              _txt({
                x:             String(_fmt(x + barW / 2)),
                y:             String(_fmt(yOf(d.value) - 4)),
                'text-anchor': 'middle',
                'font-size':   '10',
                fill:          col,
              })([valueFmt(d.value)]),
            ] : []),
            _txt({
              x:             String(_fmt(x + barW / 2)),
              y:             String(height - paddingY + 14),
              'text-anchor': 'middle',
              'font-size':   '10',
              fill:          'var(--text-muted, #888)',
            })([d.label]),
          ]);
        }),
      ]),
      // Baseline
      _line({
        x1:             String(paddingX),
        y1:             String(height - paddingY),
        x2:             String(width - paddingX),
        y2:             String(height - paddingY),
        stroke:         'var(--border, #ccc)',
        'stroke-width': '1',
      })([]),
    ]),
    ...(legend ? [_legend(palette)(data)] : []),
  ]);
};

// ── LineChart ─────────────────────────────────────────────────────────────────
/**
 * Line chart. Fill, dots, and smooth Catmull-Rom curves are all optional.
 *
 * @param {Object}   opts
 * @param {number}   [opts.width=400]
 * @param {number}   [opts.height=220]
 * @param {number}   [opts.paddingX=48]
 * @param {number}   [opts.paddingY=24]
 * @param {string}   [opts.color='#4e79a7']
 * @param {boolean}  [opts.fill=false]          Area fill under the line
 * @param {boolean}  [opts.dots=true]           Data-point dots
 * @param {number}   [opts.dotR=3.5]            Dot radius in px
 * @param {boolean}  [opts.smooth=false]        Catmull-Rom smooth curve
 * @param {boolean}  [opts.baseline=true]       Force Y axis to start at 0
 * @param {boolean}  [opts.gridLines=true]
 * @param {Function} [opts.onPointHover]        (item | null, index | -1) → void
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 *
 * @returns {(data: {label: string, value: number}[]) => vnode}
 *
 * @example
 *   LineChart({ fill: true, smooth: true, color: '#e15759' })(trafficData)
 */
const LineChart = ({
  width      = 400,
  height     = 220,
  paddingX   = 48,
  paddingY   = 24,
  color      = '#4e79a7',
  fill       = false,
  dots       = true,
  dotR       = 3.5,
  smooth     = false,
  baseline   = true,
  gridLines  = true,
  onPointHover,
  className  = '',
  style      = '',
} = {}) => data => {
  const n      = data.length;
  const maxVal = _max(data.map(d => d.value));
  const rawMin = _min(data.map(d => d.value));
  const yMin   = baseline ? 0 : rawMin - (maxVal - rawMin) * 0.05;
  const top    = _niceTop(maxVal);
  const grids  = gridLines ? _gridVals(maxVal) : [];
  const yScale = _scale(yMin)(top)(height - paddingY)(paddingY);
  const xScale = _scale(0)(Math.max(n - 1, 1))(paddingX)(width - paddingX);
  const pts    = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value), d, i }));
  const ptStr  = pts.map(p => `${_fmt(p.x)},${_fmt(p.y)}`).join(' ');
  const base   = height - paddingY;
  const areaD  = [
    `M ${_fmt(pts[0].x)} ${base}`,
    ...pts.map(p => `L ${_fmt(p.x)} ${_fmt(p.y)}`),
    `L ${_fmt(pts[n - 1].x)} ${base}`,
    'Z',
  ].join(' ');

  return div({
    className: cn('chart chart-line', className) || undefined,
    style:     style || undefined,
  })([
    _svg({
      width:   String(width),
      height:  String(height),
      viewBox: `0 0 ${width} ${height}`,
      style:   'display:block; overflow:visible',
    })([
      // Grid lines + Y labels
      _g({})([
        ...grids.map(v => _g({})([
          _line({
            x1:                String(paddingX),
            y1:                String(_fmt(yScale(v))),
            x2:                String(width - paddingX),
            y2:                String(_fmt(yScale(v))),
            stroke:            'var(--border, #ddd)',
            'stroke-width':    '1',
            'stroke-dasharray': v === 0 ? '0' : '3 3',
          })([]),
          _txt({
            x:                   String(paddingX - 6),
            y:                   String(_fmt(yScale(v))),
            'text-anchor':       'end',
            'dominant-baseline': 'middle',
            'font-size':         '10',
            fill:                'var(--text-muted, #888)',
          })([String(v)]),
        ])),
      ]),
      // Area fill
      ...(fill ? [
        _path({ d: areaD, fill: color, opacity: '0.12', stroke: 'none' })([]),
      ] : []),
      // Line (smooth or straight)
      ...(smooth
        ? [_path({
            d:                 _smoothPath(pts),
            fill:              'none',
            stroke:            color,
            'stroke-width':    '2',
            'stroke-linejoin': 'round',
            'stroke-linecap':  'round',
          })([])]
        : [_pline({
            points:            ptStr,
            fill:              'none',
            stroke:            color,
            'stroke-width':    '2',
            'stroke-linejoin': 'round',
            'stroke-linecap':  'round',
          })([])]
      ),
      // Data-point dots
      ...(dots ? pts.map(p =>
        _circle({
          cx:   String(_fmt(p.x)),
          cy:   String(_fmt(p.y)),
          r:    String(dotR),
          fill: color,
          ...(onPointHover ? {
            onmouseenter: () => onPointHover(p.d, p.i),
            onmouseleave: () => onPointHover(null, -1),
            style:        'cursor:pointer',
          } : {}),
        })([])
      ) : []),
      // X-axis labels
      _g({})([
        ...pts.map(p =>
          _txt({
            x:             String(_fmt(p.x)),
            y:             String(height - paddingY + 14),
            'text-anchor': 'middle',
            'font-size':   '10',
            fill:          'var(--text-muted, #888)',
          })([p.d.label])
        ),
      ]),
      // Baseline
      _line({
        x1:             String(paddingX),
        y1:             String(height - paddingY),
        x2:             String(width - paddingX),
        y2:             String(height - paddingY),
        stroke:         'var(--border, #ccc)',
        'stroke-width': '1',
      })([]),
    ]),
  ]);
};

// ── SparkLine ─────────────────────────────────────────────────────────────────
/**
 * Minimal inline trend line. No axes, no labels — just shape and colour.
 * Perfect for embedding in table cells or stat cards.
 *
 * @param {Object}  opts
 * @param {number}  [opts.width=80]
 * @param {number}  [opts.height=24]
 * @param {string}  [opts.color='#4e79a7']
 * @param {boolean} [opts.fill=false]        Shaded area under the line
 * @param {boolean} [opts.smooth=false]      Catmull-Rom smooth curve
 * @param {string}  [opts.style]
 *
 * @returns {(values: number[]) => vnode}
 *
 * @example
 *   SparkLine({ width: 100, height: 28, color: '#59a14f', fill: true })([3,6,4,8,5,9,7])
 */
const SparkLine = ({
  width  = 80,
  height = 24,
  color  = '#4e79a7',
  fill   = false,
  smooth = false,
  style  = '',
} = {}) => values => {
  const n    = values.length;
  if (n < 2) return _svg({ width: String(width), height: String(height) })([]);
  const hi   = _max(values);
  const lo   = _min(values);
  const pad  = (hi - lo) * 0.1 || 1;
  const xS   = _scale(0)(n - 1)(1)(width - 1);
  const yS   = _scale(lo - pad)(hi + pad)(height - 1)(1);
  const pts  = values.map((v, i) => ({ x: xS(i), y: yS(v) }));
  const pStr = pts.map(p => `${_fmt(p.x)},${_fmt(p.y)}`).join(' ');
  const aD   = [
    `M ${_fmt(pts[0].x)} ${height}`,
    ...pts.map(p => `L ${_fmt(p.x)} ${_fmt(p.y)}`),
    `L ${_fmt(pts[n - 1].x)} ${height}`,
    'Z',
  ].join(' ');

  return _svg({
    width:   String(width),
    height:  String(height),
    viewBox: `0 0 ${width} ${height}`,
    style:   `display:inline-block; vertical-align:middle;${style ? ' ' + style : ''}`,
  })([
    ...(fill ? [_path({ d: aD, fill: color, opacity: '0.2', stroke: 'none' })([])] : []),
    ...(smooth
      ? [_path({
          d:                 _smoothPath(pts),
          fill:              'none',
          stroke:            color,
          'stroke-width':    '1.5',
          'stroke-linejoin': 'round',
          'stroke-linecap':  'round',
        })([])]
      : [_pline({
          points:            pStr,
          fill:              'none',
          stroke:            color,
          'stroke-width':    '1.5',
          'stroke-linejoin': 'round',
          'stroke-linecap':  'round',
        })([])]
    ),
  ]);
};

// ── MultiLineChart ────────────────────────────────────────────────────────────
/**
 * Multi-series line chart. All series share the same X/Y scales.
 * Clicking a point (or the invisible vertical strip over it) selects that
 * position across all series.
 *
 * @param {Object}   opts
 * @param {number}   [opts.width=400]
 * @param {number}   [opts.height=200]
 * @param {number}   [opts.paddingX=48]
 * @param {number}   [opts.paddingY=24]
 * @param {boolean}  [opts.gridLines=true]
 * @param {boolean}  [opts.smooth=false]        Catmull-Rom smooth curves
 * @param {boolean}  [opts.dots=true]           Data-point dots
 * @param {number}   [opts.dotR=3]              Normal dot radius
 * @param {boolean}  [opts.baseline=true]       Force Y axis to start at 0
 * @param {string[]} [opts.xLabels]             Optional sparse X-axis labels
 * @param {boolean}  [opts.legend=true]         Show line-swatch legend below
 * @param {number}   [opts.highlightIdx=null]   Draw a vertical guide + enlarge dots at this index
 * @param {Function} [opts.onPointClick]        pointIndex => void
 * @param {string}   [opts.className]
 * @param {string}   [opts.style]
 *
 * @returns {(series: {label:string, color:string, data:number[]}[]) => vnode}
 *
 * @example
 *   MultiLineChart({
 *     width: 600, height: 160, legend: true,
 *     highlightIdx: 5,
 *     onPointClick: i => setState({ selected: i }),
 *   })([
 *     { label: 'total',   color: '#4e79a7', data: [12, 8, 14, 20] },
 *     { label: 'compute', color: '#76b7b2', data: [8,  5, 10, 14] },
 *     { label: 'patch',   color: '#f28e2b', data: [4,  3,  4,  6] },
 *   ])
 */
const MultiLineChart = ({
  width        = 400,
  height       = 200,
  paddingX     = 48,
  paddingY     = 24,
  gridLines    = true,
  smooth       = false,
  dots         = true,
  dotR         = 3,
  baseline     = true,
  xLabels      = null,
  legend       = true,
  highlightIdx = null,
  onPointClick,
  className    = '',
  style        = '',
} = {}) => series => {
  const n = series[0]?.data.length ?? 0;
  if (n === 0) return div({})([]);

  const allVals = series.flatMap(s => s.data);
  const maxVal  = _max(allVals);
  const rawMin  = _min(allVals);
  const yMin    = baseline ? 0 : rawMin - (maxVal - rawMin) * 0.05;
  const top     = _niceTop(maxVal);
  const grids   = gridLines ? _gridVals(maxVal) : [];
  const yScale  = _scale(yMin)(top)(height - paddingY)(paddingY);
  const xScale  = _scale(0)(Math.max(n - 1, 1))(paddingX)(width - paddingX);
  const xOf     = i => xScale(i);
  const yOf     = v => yScale(v);
  const stripW  = n > 1 ? (width - paddingX * 2) / (n - 1) : (width - paddingX * 2);
  const step    = Math.max(1, Math.ceil(n / 10));

  return div({
    className: cn('chart chart-multi-line', className) || undefined,
    style:     style || undefined,
  })([
    _svg({
      width:   String(width),
      height:  String(height),
      viewBox: `0 0 ${width} ${height}`,
      style:   'display:block; overflow:visible',
    })([
      // Y grid + labels
      _g({})([
        ...grids.map(v => _g({})([
          _line({
            x1: String(paddingX), y1: String(_fmt(yOf(v))),
            x2: String(width - paddingX), y2: String(_fmt(yOf(v))),
            stroke: 'var(--border, #ddd)',
            'stroke-width': '1',
            'stroke-dasharray': v === 0 ? '0' : '3 3',
          })([]),
          _txt({
            x: String(paddingX - 6), y: String(_fmt(yOf(v))),
            'text-anchor': 'end', 'dominant-baseline': 'middle',
            'font-size': '10', fill: 'var(--text-muted, #888)',
          })([String(v)]),
        ])),
      ]),
      // Vertical highlight guide at selected index
      ...(highlightIdx != null ? [
        _line({
          x1: String(_fmt(xOf(highlightIdx))), y1: String(paddingY - 4),
          x2: String(_fmt(xOf(highlightIdx))), y2: String(height - paddingY),
          stroke: 'var(--accent, #4e79a7)',
          'stroke-width': '1',
          'stroke-dasharray': '4 2',
          opacity: '0.5',
        })([]),
      ] : []),
      // Series lines
      ...series.map(s => {
        const pts = s.data.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
        return smooth
          ? _path({
              d: _smoothPath(pts), fill: 'none', stroke: s.color,
              'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
            })([])
          : _pline({
              points: pts.map(p => `${_fmt(p.x)},${_fmt(p.y)}`).join(' '),
              fill: 'none', stroke: s.color,
              'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
            })([]);
      }),
      // Dots
      ...(dots ? series.flatMap(s =>
        s.data.map((v, i) =>
          _circle({
            cx:   String(_fmt(xOf(i))),
            cy:   String(_fmt(yOf(v))),
            r:    String(i === highlightIdx ? dotR * 1.7 : dotR),
            fill: s.color,
          })([])
        )
      ) : []),
      // Invisible vertical click strips (full-height, easy hit target)
      ...(onPointClick
        ? Array.from({ length: n }, (_, i) =>
            _rect({
              x:      String(_fmt(xOf(i) - stripW / 2)),
              y:      String(paddingY),
              width:  String(_fmt(stripW)),
              height: String(height - paddingY * 2),
              fill:   'transparent',
              onclick: () => onPointClick(i),
              style:  'cursor:pointer',
            })([])
          )
        : []),
      // X-axis sparse labels
      ...(xLabels ? [
        _g({})([
          ...xLabels
            .map((lbl, i) => ({ lbl, i }))
            .filter(({ i }) => i % step === 0 || i === n - 1)
            .map(({ lbl, i }) =>
              _txt({
                x: String(_fmt(xOf(i))), y: String(height - paddingY + 13),
                'text-anchor': 'middle', 'font-size': '9',
                fill: 'var(--text-muted, #888)',
              })([lbl])
            ),
        ]),
      ] : []),
      // Baseline
      _line({
        x1: String(paddingX), y1: String(height - paddingY),
        x2: String(width - paddingX), y2: String(height - paddingY),
        stroke: 'var(--border, #ccc)', 'stroke-width': '1',
      })([]),
    ]),
    ...(legend ? [
      div({ style: 'display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:4px; font-size:12px; color:var(--text)' })(
        series.map(s =>
          span({ style: 'display:flex; align-items:center; gap:5px' })([
            span({ style: `width:16px; height:2px; border-radius:1px; flex-shrink:0; background:${s.color}; display:inline-block` })([]),
            s.label,
          ])
        )
      ),
    ] : []),
  ]);
};

export { PieChart, BarChart, LineChart, MultiLineChart, SparkLine, PALETTE };
