/**
 * Shared SVG geometry for the graph views (overview + choices).
 * All pure; sizes are the single source for both panels.
 */

import { vnode } from '../../lib/odocosjs/src/render.js';

const marker  = vnode('marker');
const polygon = vnode('polygon');

const NODE_W = 168;
const NODE_H = 60;
const COL_GAP = 110;
const ROW_GAP = 200;
const NPC_W = 132;
const NPC_H = 34;
const COMBAT_W = 132;
const COMBAT_H = 40;

/** Point on a rect border (center cx,cy half-extents hx,hy) toward a target. */
const rectEdgePoint = ({ cx, cy, hx, hy, towardX, towardY }) => {
  const dx = towardX - cx, dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx === 0 ? Infinity : hx / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hy / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
};

const nodeBox = node => ({
  cx: node.x + (node.w || NODE_W) / 2,
  cy: node.y + (node.h || NODE_H) / 2,
  hx: (node.w || NODE_W) / 2,
  hy: (node.h || NODE_H) / 2,
});

/**
 * Curved edge between two node borders. `extraBow` adds to the automatic
 * perpendicular offset so parallel edges can fan out. Returns
 * { d, mid, at } where `at(t)` is the quad-bezier point for label placement.
 */
const edgeGeom = extraBow => from => to => {
  const a = nodeBox(from);
  const b = nodeBox(to);
  // Provisional control from the center line. Endpoints aim at the other
  // node's center for small bows and blend toward the control as the bow
  // grows, so strongly arced edges exit through the side facing the arc
  // while short structural hops keep their natural straight exits.
  const cdx = b.cx - a.cx, cdy = b.cy - a.cy;
  const clen = Math.max(1, Math.hypot(cdx, cdy));
  const bow0 = Math.min(64, clen * 0.18) + extraBow;
  const c0x  = (a.cx + b.cx) / 2 + (-cdy / clen) * bow0;
  const c0y  = (a.cy + b.cy) / 2 + (cdx / clen) * bow0;
  const k    = Math.min(1, Math.abs(extraBow) / 60);
  const lerp = (p, q) => p + (q - p) * k;
  const start = rectEdgePoint({ ...a, towardX: lerp(b.cx, c0x), towardY: lerp(b.cy, c0y) });
  const end   = rectEdgePoint({ ...b, towardX: lerp(a.cx, c0x), towardY: lerp(a.cy, c0y) });
  const dx  = end.x - start.x;
  const dy  = end.y - start.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bow = Math.min(64, len * 0.18) + extraBow;
  const px  = -dy / len, py = dx / len;
  const cx  = (start.x + end.x) / 2 + px * bow;
  const cy  = (start.y + end.y) / 2 + py * bow;
  const at  = t => ({
    x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cx + t * t * end.x,
    y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cy + t * t * end.y,
  });
  return { d: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`, mid: at(0.5), at };
};

const edgePath = from => to => edgeGeom(0)(from)(to).d;

/** Hexagon path sized COMBAT_W x COMBAT_H. */
const hexPath = () => {
  const w = COMBAT_W, h = COMBAT_H, o = 12;
  return `M ${o} 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L ${o} ${h} L 0 ${h / 2} Z`;
};

/** Arrowhead marker def. Colour via CSS var so themes recolour it. */
const arrowMarker = id => fill => marker({
  id, viewBox: '0 0 10 10', refX: 9, refY: 5,
  markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse',
})([polygon({ points: '0,0 10,5 0,10', fill })([])]);

export {
  NODE_W, NODE_H, COL_GAP, ROW_GAP, NPC_W, NPC_H, COMBAT_W, COMBAT_H,
  rectEdgePoint, nodeBox, edgeGeom, edgePath, hexPath, arrowMarker,
};
