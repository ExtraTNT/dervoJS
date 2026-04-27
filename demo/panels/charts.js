import {
  div, span, p, pre, code,
  Card, Badge,
  PieChart, BarChart, LineChart, SparkLine, MultiLineChart,
} from '../../src/index.js';
import { setState } from '../store.js';

import { doc } from '../components/doc.js';

// ── Sample datasets ──────────────────────────────────────────────────────────

const SALES = [
  { label: 'N. America', value: 42 },
  { label: 'Europe',     value: 28 },
  { label: 'Asia',       value: 18 },
  { label: 'S. America', value: 7  },
  { label: 'Other',      value: 5  },
];

const MONTHLY = [
  { label: 'Jan', value: 31 },
  { label: 'Feb', value: 27 },
  { label: 'Mar', value: 45 },
  { label: 'Apr', value: 52 },
  { label: 'May', value: 38 },
  { label: 'Jun', value: 61 },
  { label: 'Jul', value: 74 },
  { label: 'Aug', value: 69 },
  { label: 'Sep', value: 58 },
  { label: 'Oct', value: 83 },
  { label: 'Nov', value: 91 },
  { label: 'Dec', value: 102 },
];

const TRAFFIC = [
  { label: 'Mon', value: 1240 },
  { label: 'Tue', value: 1850 },
  { label: 'Wed', value: 2100 },
  { label: 'Thu', value: 1760 },
  { label: 'Fri', value: 2430 },
  { label: 'Sat', value: 890  },
  { label: 'Sun', value: 640  },
];

const SPARK_ROWS = [
  { name: 'Page views', values: [120, 135,  98, 160, 145, 188, 172], color: '#4e79a7' },
  { name: 'Sign-ups',   values: [ 12,   8,  15,  20,  18,  25,  22], color: '#59a14f' },
  { name: 'Churn',      values: [  5,   6,   4,   3,   5,   2,   3], color: '#e15759' },
  { name: 'Revenue $k', values: [ 42,  38,  55,  61,  58,  74,  82], color: '#f28e2b' },
];

// ── Hover helpers ──────────────────────────────────────────────────────────
const _setHovered = item =>
  setState(s => ({ chartsDemo: { ...s.chartsDemo, hovered: item } }));

const _hoverBadge = hovered =>
  hovered
    ? Badge({ variant: 'primary' })([`${hovered.label}: ${hovered.value}`])
    : span({ style: 'font-size:12px; color:var(--text-muted)' })(['hover a slice or bar']);

// ── Panel ────────────────────────────────────────────────────────────────────
export const chartsPanel = state => {
  const cd      = state.chartsDemo ?? {};
  const hovered = cd.hovered ?? null;

  return div({ style: 'display:flex; flex-direction:column; gap:20px' })([

    // ── Pie / Donut ──────────────────────────────────────────────────────
    Card({ title: 'PieChart' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Set ', code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })(['innerRadius']),
        ' 0.1–0.9 for a donut. Hover a slice:',
      ]),
      div({ style: 'display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; flex-wrap:wrap' })([
        _hoverBadge(hovered),
      ]),
      div({ style: 'display:flex; flex-wrap:wrap; gap:32px; align-items:flex-start' })([
        div({})([
          span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px' })(['Pie']),
          PieChart({
            size:        220,
            innerRadius: 0,
            onSliceHover: item => _setHovered(item),
          })(SALES),
        ]),
        div({})([
          span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px' })(['Donut']),
          PieChart({
            size:        220,
            innerRadius: 0.55,
            onSliceHover: item => _setHovered(item),
          })(SALES),
        ]),
      ]),
      doc([
`// Pie
PieChart({ size: 220 })(salesData)

// Donut (innerRadius 0.1–0.9 = fraction of outer radius)
PieChart({ size: 220, innerRadius: 0.55 })(salesData)

// With hover callback
PieChart({
  onSliceHover: (item, i) => setState({ hovered: item }),
})(salesData)`]),
    ]),
    Card({ title: 'BarChart' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Auto-computed nice grid lines. Hover a bar:',
      ]),
      div({ style: 'display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; flex-wrap:wrap' })([
        _hoverBadge(hovered),
      ]),
      div({ style: 'overflow-x:auto' })([
        BarChart({
          width:      520,
          height:     220,
          gap:        8,
          onBarHover: item => _setHovered(item),
        })(MONTHLY),
      ]),
      doc([
`BarChart({
  width: 520,
  height: 220,
  gap: 8,
  onBarHover: (item, i) => setState({ hovered: item }),
})(monthlyData)`]),
    ]),
    Card({ title: 'LineChart' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Optional area fill, smooth Catmull-Rom curves, and hover callbacks.',
      ]),
      div({ style: 'display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start' })([
        div({})([
          span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px' })(['Default']),
          div({ style: 'overflow-x:auto' })([
            LineChart({ width: 340, height: 180, color: '#4e79a7' })(TRAFFIC),
          ]),
        ]),
        div({})([
          span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px' })(['fill + smooth']),
          div({ style: 'overflow-x:auto' })([
            LineChart({ width: 340, height: 180, color: '#e15759', fill: true, smooth: true })(TRAFFIC),
          ]),
        ]),
      ]),
      doc([
`// Default: straight line with dots
LineChart({ width: 400, color: '#4e79a7' })(trafficData)

// Area + smooth curve
LineChart({ width: 400, color: '#e15759', fill: true, smooth: true })(trafficData)

// No dots, no baseline forced
LineChart({ dots: false, baseline: false })(data)`]),
    ]),

    // ── SparkLine ─────────────────────────────────────────────────────────
    Card({ title: 'SparkLine' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Inline mini chart. Accepts a plain ', code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })(['number[]']), '. No axes.',
      ]),
      div({ style: 'overflow-x:auto' })([
        div({ style: 'display:table; border-collapse:collapse; width:100%; min-width:320px' })([
          div({ style: 'display:table-header-group; font-size:12px; font-weight:600; color:var(--text-muted); border-bottom:1px solid var(--border)' })([
            div({ style: 'display:table-row' })([
              div({ style: 'display:table-cell; padding:4px 12px 4px 0' })(['Metric']),
              div({ style: 'display:table-cell; padding:4px 12px' })(['7-day trend']),
              div({ style: 'display:table-cell; padding:4px 0 4px 12px; text-align:right' })(['Latest']),
            ]),
          ]),
          div({ style: 'display:table-row-group' })([
            ...SPARK_ROWS.map(row =>
              div({ style: 'display:table-row; border-bottom:1px solid var(--border)' })([
                div({ style: 'display:table-cell; padding:6px 12px 6px 0; font-size:13px; white-space:nowrap; vertical-align:middle' })([row.name]),
                div({ style: 'display:table-cell; padding:6px 12px; vertical-align:middle' })([
                  SparkLine({ width: 110, height: 28, color: row.color, fill: true })(row.values),
                ]),
                div({ style: 'display:table-cell; padding:6px 0 6px 12px; text-align:right; font-size:13px; font-weight:600; vertical-align:middle' })([
                  String(row.values[row.values.length - 1]),
                ]),
              ])
            ),
          ]),
        ]),
      ]),
      doc([
`// Accepts number[] directly
SparkLine({ width: 110, height: 28, color: '#59a14f', fill: true })([3, 6, 4, 8, 5, 9, 7])

// Smooth variant
SparkLine({ smooth: true, color: '#e15759' })([...values])`]),
    ]),

    // ── MultiLineChart ───────────────────────────────────────────────────
    Card({ title: 'MultiLineChart' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Multi-series line chart sharing one Y scale. Click a point to highlight it.',
      ]),
      div({ style: 'overflow-x:auto' })([
        MultiLineChart({
          width:        520,
          height:       180,
          legend:       true,
          dots:         true,
          gridLines:    true,
          highlightIdx: cd.chartHighlight ?? null,
          onPointClick: i => setState(s => ({
            chartsDemo: {
              ...s.chartsDemo,
              chartHighlight: i === s.chartsDemo.chartHighlight ? null : i,
            },
          })),
        })([
          { label: 'revenue $k', color: '#4e79a7', data: MONTHLY.map(d => d.value) },
          { label: 'target',     color: '#59a14f', data: MONTHLY.map(d => Math.round(d.value * 0.85)) },
        ]),
      ]),
      doc([
`MultiLineChart({
  width: 520, height: 180, legend: true,
  highlightIdx: state.sel,
  onPointClick: i => setState({ sel: i === state.sel ? null : i }),
})([
  { label: 'revenue', color: '#4e79a7', data: monthly.map(d => d.value) },
  { label: 'target',  color: '#59a14f', data: targets },
])`]),
    ]),

  ]);
};
