/**
 * Graph panel — SVG view of rooms, NPCs, and combats.
 *
 * Three node families:
 *   - Rooms      : rectangles, room→room arrows for choice exits
 *   - NPCs       : ellipses anchored under their first location
 *   - Combats    : hexagons anchored under triggering rooms,
 *                  with coloured edges to winRoom (green) and loseRoom (red)
 *                  plus dashed inbound edges from every trigger
 *
 * Each room and NPC node also carries small media badges (I / V / A) showing
 * which media kinds the entity references — image / video / audio — at a
 * glance.
 *
 * Click a node → jumps to the matching tab with the entity selected.
 */

import { div, p, h2, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack } from '../../src/components/Layout.js';
import { Button } from '../../src/components/Button.js';
import { Badge } from '../../src/components/Badge.js';
import { setState } from '../store.js';
import { vnode } from '../../lib/odocosjs/src/render.js';

const svg     = vnode('svg');
const g       = vnode('g');
const rect    = vnode('rect');
const text    = vnode('text');
const path    = vnode('path');
const defs    = vnode('defs');
const marker  = vnode('marker');
const polygon = vnode('polygon');
const ellipse = vnode('ellipse');

const NODE_W = 160;
const NODE_H = 56;
const COL_GAP = 80;
const ROW_GAP = 180;       // extra vertical room for NPC + combat satellites

const NPC_W = 120;
const NPC_H = 32;
const COMBAT_W = 130;
const COMBAT_H = 36;

// — Media detection ————————————————————————————————————————————

const _hasMedia = ref => typeof ref === 'string' && ref.length > 0;

const _roomMedia = r => {
  const flags = { img: false, video: false, audio: false };
  if (_hasMedia(r.music)) flags.audio = true;
  for (const pg of (r.pages || [])) {
    if (_hasMedia(pg.image)) flags.img = true;
    if (_hasMedia(pg.video)) flags.video = true;
  }
  // wardrobe portrait / inventory layer images
  for (const ly of (r.wardrobe?.layers || [])) {
    if (_hasMedia(ly.defaultImage)) flags.img = true;
    for (const b of (ly.bindings || [])) if (_hasMedia(b.image)) flags.img = true;
  }
  return flags;
};

const _npcMedia = n => {
  const flags = { img: false, video: false, audio: false };
  if (_hasMedia(n.portrait)) flags.img = true;
  for (const pg of (n.pages || [])) {
    if (_hasMedia(pg.image)) flags.img = true;
    if (_hasMedia(pg.video)) flags.video = true;
  }
  return flags;
};

const _combatMedia = c => {
  const flags = { img: false, video: false, audio: false };
  if (_hasMedia(c.enemy?.image)) flags.img = true;
  if (_hasMedia(c.winImage))    flags.img = true;
  if (_hasMedia(c.loseImage))   flags.img = true;
  for (const a of (c.enemy?.actions || [])) if (_hasMedia(a.image)) flags.img = true;
  for (const m of (c.extraMoves || []))     if (_hasMedia(m.image)) flags.img = true;
  return flags;
};

// SVG badge group rendering — small coloured square + letter per media kind.
const _mediaBadges = (flags, baseX, baseY) => {
  const items = [];
  let i = 0;
  const draw = (letter, color) => {
    const x = baseX - (i + 1) * 14;
    items.push(
      rect({ x, y: baseY - 8, width: 12, height: 12, rx: 2, fill: color, opacity: 0.85 })([]),
      text({ x: x + 6, y: baseY + 2, 'text-anchor': 'middle', style: 'font-size:9px; font-weight:700; fill:#fff; pointer-events:none' })([letter]),
    );
    i++;
  };
  if (flags.img)   draw('I', '#3b82f6');     // blue
  if (flags.video) draw('V', '#a855f7');     // purple
  if (flags.audio) draw('A', '#16a34a');     // green
  return items;
};

// — Layout ————————————————————————————————————————————

const _layout = project => {
  const startId = project.meta.start || project.rooms[0]?.id;
  const byId    = Object.fromEntries(project.rooms.map(r => [r.id, r]));
  const queue   = startId && byId[startId] ? [startId] : [];
  const seen    = new Set(queue);
  const order   = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const ch of (byId[id]?.choices || [])) {
      if (ch.to && byId[ch.to] && !seen.has(ch.to)) {
        seen.add(ch.to);
        queue.push(ch.to);
      }
    }
  }
  for (const r of project.rooms) if (!seen.has(r.id)) order.push(r.id);

  const cols = Math.min(4, Math.max(1, order.length));
  return order.map((id, i) => ({
    id,
    title:   byId[id].title || id,
    kind:    byId[id].kind  || 'scene',
    isStart: id === startId,
    media:   _roomMedia(byId[id]),
    x: (i % cols) * (NODE_W + COL_GAP) + 30,
    y: Math.floor(i / cols) * (NODE_H + ROW_GAP) + 30,
  }));
};

// Detect every (sourceRoomId, combatId) trigger pair by walking room
// choices + npc dialogue choices for an `enterCombat` action.
const _findCombatTriggers = project => {
  const triggers = [];   // [{ combatId, roomId, label }]
  for (const r of project.rooms || []) {
    for (const c of r.choices || []) {
      if (c.action?.mode === 'enterCombat' && c.action.combatId) {
        triggers.push({ combatId: c.action.combatId, roomId: r.id, label: c.label });
      }
    }
  }
  for (const n of project.npcs || []) {
    for (const c of n.choices || []) {
      if (c.action?.mode === 'enterCombat' && c.action.combatId) {
        // Use the NPC's first location as the trigger room — combat will land
        // back there via _combat.returnTo on outcome.
        const room = (n.locations || [])[0];
        if (room) triggers.push({ combatId: c.action.combatId, roomId: room, label: `via ${n.name || n.id}: ${c.label}` });
      }
    }
  }
  return triggers;
};

// — Component ————————————————————————————————————————————

const GraphPanel = state => {
  const { project, selectedRoomId } = state;

  if (project.rooms.length === 0) {
    return Stack({ gap: 14 })([
      h2({ style: 'margin:0' })(['Graph']),
      div({ className: 'gef-empty' })(['No rooms to draw yet. Add some in the Rooms tab.']),
    ]);
  }

  const nodes = _layout(project);
  const byId  = Object.fromEntries(nodes.map(n => [n.id, n]));

  // NPC nodes — anchored under their first location, fanned out by sibling
  // count to avoid overlap.
  const npcNodes = [];
  for (const n of project.npcs || []) {
    if (n.locations.length === 0) continue;
    const first = byId[n.locations[0]];
    if (!first) continue;
    const sibs = npcNodes.filter(x => x.anchor === first.id).length;
    npcNodes.push({
      id:     n.id,
      name:   n.name || n.id,
      role:   n.role,
      media:  _npcMedia(n),
      anchor: first.id,
      x:      first.x + sibs * (NPC_W + 16),
      y:      first.y + NODE_H + 24,
      locs:   n.locations,
    });
  }

  // Combat nodes — anchored under the first trigger room, second satellite row.
  // The same combat triggered from multiple rooms gets one node + multiple
  // dashed inbound edges.
  const triggers = _findCombatTriggers(project);
  const combatNodes = [];
  const triggersByCombat = {};
  for (const t of triggers) {
    (triggersByCombat[t.combatId] ||= []).push(t);
  }
  for (const cb of project.combats || []) {
    const trigs = triggersByCombat[cb.id] || [];
    const anchorRoom = trigs[0]?.roomId
      ? byId[trigs[0].roomId]
      : (byId[project.meta.start || project.rooms[0]?.id]);
    if (!anchorRoom) continue;
    const sameAnchor = combatNodes.filter(c => c.anchor === anchorRoom.id).length;
    combatNodes.push({
      id:    cb.id,
      name:  cb.name || cb.id,
      anchor: anchorRoom.id,
      media: _combatMedia(cb),
      x:     anchorRoom.x + 10 + sameAnchor * (COMBAT_W + 20),
      y:     anchorRoom.y + NODE_H + 24 + NPC_H + 18,   // below the NPC row
      winRoom:  cb.winRoom  || null,
      loseRoom: cb.loseRoom || null,
      enemyName: cb.enemy?.name || '',
    });
  }
  const combatById = Object.fromEntries(combatNodes.map(c => [c.id, c]));

  // Room-to-room edges
  const edges = [];
  for (const r of project.rooms) {
    const from = byId[r.id]; if (!from) continue;
    const seenTo = new Set();
    for (const c of r.choices || []) {
      if (!c.to || seenTo.has(c.to)) continue;
      seenTo.add(c.to);
      const to = byId[c.to]; if (!to) continue;
      edges.push({ from, to });
    }
  }

  // NPC-to-other-location dashed edges
  const npcEdges = [];
  for (const npc of npcNodes) {
    for (const locId of npc.locs) {
      const loc = byId[locId]; if (!loc) continue;
      if (locId === npc.anchor) continue;
      npcEdges.push({
        from: { x: npc.x, y: npc.y, w: NPC_W, h: NPC_H },
        to:   { x: loc.x, y: loc.y, w: NODE_W, h: NODE_H },
      });
    }
  }

  // Combat trigger + outcome edges
  const combatTriggerEdges = [];   // dashed orange: room → combat
  const combatOutcomeEdges = [];   // solid green/red: combat → win/loseRoom
  for (const cn of combatNodes) {
    for (const t of (triggersByCombat[cn.id] || [])) {
      const fromRoom = byId[t.roomId]; if (!fromRoom) continue;
      combatTriggerEdges.push({
        from: { x: fromRoom.x, y: fromRoom.y, w: NODE_W, h: NODE_H },
        to:   { x: cn.x, y: cn.y, w: COMBAT_W, h: COMBAT_H },
      });
    }
    if (cn.winRoom && byId[cn.winRoom]) {
      combatOutcomeEdges.push({
        kind: 'win',
        from: { x: cn.x, y: cn.y, w: COMBAT_W, h: COMBAT_H },
        to:   byId[cn.winRoom],
      });
    }
    if (cn.loseRoom && byId[cn.loseRoom]) {
      combatOutcomeEdges.push({
        kind: 'lose',
        from: { x: cn.x, y: cn.y, w: COMBAT_W, h: COMBAT_H },
        to:   byId[cn.loseRoom],
      });
    }
  }

  // SVG canvas size — account for combat row.
  const cols = Math.min(4, nodes.length);
  const rows = Math.ceil(nodes.length / cols);
  const width  = cols * (NODE_W + COL_GAP) + 30;
  const height = rows * (NODE_H + ROW_GAP) + 120;

  // Build a single-line straight edge between two rectangles' centres.
  const _line = (from, to) => {
    const fx = from.x + (from.w || NODE_W) / 2;
    const fy = from.y + (from.h || NODE_H) / 2;
    const tx = to.x   + (to.w   || NODE_W) / 2;
    const ty = to.y   + (to.h   || NODE_H) / 2;
    return `M ${fx} ${fy} L ${tx} ${ty}`;
  };

  const _curve = ({ from, to }) => {
    const fx = from.x + (from.w || NODE_W) / 2;
    const fy = from.y + (from.h || NODE_H) / 2;
    const tx = to.x   + (to.w   || NODE_W) / 2;
    const ty = to.y   + (to.h   || NODE_H) / 2;
    const dx = tx - fx, dy = ty - fy;
    const ang = Math.atan2(dy, dx);
    const padX = (from.w || NODE_W) / 2 + 4;
    const padY = (from.h || NODE_H) / 2 + 4;
    const cx = Math.abs(Math.cos(ang)) > 1e-6 ? padX / Math.abs(Math.cos(ang)) : padY / Math.abs(Math.sin(ang) || 1);
    const cy = Math.abs(Math.sin(ang)) > 1e-6 ? padY / Math.abs(Math.sin(ang)) : padX / Math.abs(Math.cos(ang) || 1);
    const clip = Math.min(cx, cy);
    const padX2 = (to.w || NODE_W) / 2 + 4;
    const padY2 = (to.h || NODE_H) / 2 + 4;
    const cx2 = Math.abs(Math.cos(ang)) > 1e-6 ? padX2 / Math.abs(Math.cos(ang)) : padY2 / Math.abs(Math.sin(ang) || 1);
    const cy2 = Math.abs(Math.sin(ang)) > 1e-6 ? padY2 / Math.abs(Math.sin(ang)) : padX2 / Math.abs(Math.cos(ang) || 1);
    const clip2 = Math.min(cx2, cy2);
    const x1 = fx + Math.cos(ang) * clip;
    const y1 = fy + Math.sin(ang) * clip;
    const x2 = tx - Math.cos(ang) * clip2;
    const y2 = ty - Math.sin(ang) * clip2;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const offX = -Math.sin(ang) * 24;
    const offY =  Math.cos(ang) * 24;
    return `M ${x1} ${y1} Q ${mx + offX} ${my + offY} ${x2} ${y2}`;
  };

  // Hexagon path for a combat node, sized COMBAT_W × COMBAT_H.
  const _hexPath = () => {
    const w = COMBAT_W, h = COMBAT_H;
    const o = 10;
    return `M ${o} 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L ${o} ${h} L 0 ${h / 2} Z`;
  };

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Graph']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Rooms (rectangles), NPCs (ellipses), and combats (hexagons). Media badges on each node show what kinds of assets the entity references. Click any node to jump to its editor.',
    ]),

    Card({})([
      div({ className: 'gef-graph', style: 'overflow:auto; max-width:100%' })([
        svg({
          width,
          height,
          viewBox: `0 0 ${width} ${height}`,
          xmlns:   'http://www.w3.org/2000/svg',
        })([
          defs({})([
            marker({
              id: 'arrow', viewBox: '0 0 10 10',
              refX: 9, refY: 5,
              markerWidth: 8, markerHeight: 8,
              orient: 'auto-start-reverse',
            })([
              polygon({ points: '0,0 10,5 0,10', fill: 'var(--text-muted)' })([]),
            ]),
            marker({
              id: 'arrow-win', viewBox: '0 0 10 10',
              refX: 9, refY: 5,
              markerWidth: 8, markerHeight: 8,
              orient: 'auto-start-reverse',
            })([
              polygon({ points: '0,0 10,5 0,10', fill: '#16a34a' })([]),
            ]),
            marker({
              id: 'arrow-lose', viewBox: '0 0 10 10',
              refX: 9, refY: 5,
              markerWidth: 8, markerHeight: 8,
              orient: 'auto-start-reverse',
            })([
              polygon({ points: '0,0 10,5 0,10', fill: '#dc2626' })([]),
            ]),
            marker({
              id: 'arrow-trigger', viewBox: '0 0 10 10',
              refX: 9, refY: 5,
              markerWidth: 8, markerHeight: 8,
              orient: 'auto-start-reverse',
            })([
              polygon({ points: '0,0 10,5 0,10', fill: '#f97316' })([]),
            ]),
          ]),

          // Room-to-room exits (default style)
          ...edges.map(e => path({ d: _curve(e) })([])),

          // NPC dashed location ties
          ...npcEdges.map(e => path({
            d: _line(e.from, e.to),
            'stroke-dasharray': '4 4',
            style: 'marker-end: none',
          })([])),

          // Combat trigger edges (room → combat). Orange, dashed.
          ...combatTriggerEdges.map(e => path({
            d: _curve(e),
            stroke: '#f97316',
            'stroke-width': 1.4,
            'stroke-dasharray': '6 3',
            'marker-end': 'url(#arrow-trigger)',
            fill: 'none',
          })([])),

          // Combat outcome edges (combat → win/lose room). Solid green/red.
          ...combatOutcomeEdges.map(e => path({
            d: _curve(e),
            stroke: e.kind === 'win' ? '#16a34a' : '#dc2626',
            'stroke-width': 1.8,
            'marker-end': e.kind === 'win' ? 'url(#arrow-win)' : 'url(#arrow-lose)',
            fill: 'none',
          })([])),

          // Room nodes
          ...nodes.map(n =>
            g({
              className: `gef-node${n.isStart ? ' start' : ''}${n.id === selectedRoomId ? ' active' : ''}`,
              transform: `translate(${n.x},${n.y})`,
              onclick: () => setState({ selectedRoomId: n.id, activeTab: 'rooms' }),
            })([
              rect({ width: NODE_W, height: NODE_H, rx: 8 })([]),
              text({ x: NODE_W / 2, y: 22, 'text-anchor': 'middle' })([n.title]),
              text({ x: NODE_W / 2, y: 38, 'text-anchor': 'middle', style: 'font-size:10px; fill:var(--text-muted)' })([n.id]),
              ..._mediaBadges(n.media, NODE_W - 4, NODE_H - 6),
              ...(n.kind === 'wardrobe' || n.kind === 'inventory'
                ? [text({ x: 6, y: 12, style: 'font-size:9px; fill:var(--text-muted); font-style:italic' })([n.kind])]
                : []),
            ])
          ),

          // NPC nodes
          ...npcNodes.map(n =>
            g({
              className: `gef-node gef-npc${n.role === 'shop' ? ' gef-npc-shop' : ''}`,
              transform: `translate(${n.x},${n.y})`,
              onclick: () => setState({ selectedNpcId: n.id, activeTab: 'npcs' }),
            })([
              ellipse({ cx: NPC_W / 2, cy: NPC_H / 2, rx: NPC_W / 2, ry: NPC_H / 2, fill: 'var(--surface)', stroke: 'var(--text-muted)' })([]),
              text({ x: NPC_W / 2, y: NPC_H / 2 + 4, 'text-anchor': 'middle', style: 'font-size:11px' })([n.name]),
              ..._mediaBadges(n.media, NPC_W - 4, NPC_H - 4),
            ])
          ),

          // Combat nodes (hexagon)
          ...combatNodes.map(cn =>
            g({
              className: 'gef-node gef-combat',
              transform: `translate(${cn.x},${cn.y})`,
              onclick: () => setState({ selectedCombatId: cn.id, activeTab: 'combats' }),
              style: 'cursor:pointer',
            })([
              path({ d: _hexPath(), fill: 'var(--surface)', stroke: '#dc2626', 'stroke-width': 1.5 })([]),
              text({ x: COMBAT_W / 2, y: COMBAT_H / 2 - 2, 'text-anchor': 'middle', style: 'font-size:11px; font-weight:600' })([cn.name]),
              text({ x: COMBAT_W / 2, y: COMBAT_H / 2 + 10, 'text-anchor': 'middle', style: 'font-size:9px; fill:var(--text-muted)' })([cn.enemyName ? `vs ${cn.enemyName}` : 'encounter']),
              ..._mediaBadges(cn.media, COMBAT_W - 4, COMBAT_H - 6),
            ])
          ),
        ]),
      ]),
    ]),

    Card({ title: 'Legend' })([
      div({ style: 'display:flex; gap:16px; flex-wrap:wrap; font-size:13px; color:var(--text-muted)' })([
        div({})([Badge({ variant: 'green'  })(['start']),    span({ style: 'margin-left:6px' })(['start room (highlighted border)'])]),
        div({})([Badge({ variant: 'blue'   })(['→ room']),   span({ style: 'margin-left:6px' })(['choice exit (curved)'])]),
        div({})([Badge({ variant: 'yellow' })(['◯ NPC']),    span({ style: 'margin-left:6px' })(['NPC (dashed = other locations they roam)'])]),
        div({})([span({ style: 'color:#dc2626; font-weight:600' })(['⬢ Combat']), span({ style: 'margin-left:6px' })(['encounter — hexagon'])]),
        div({})([span({ style: 'color:#f97316; font-weight:600' })(['---→']),     span({ style: 'margin-left:6px' })(['enterCombat trigger (orange dashed)'])]),
        div({})([span({ style: 'color:#16a34a; font-weight:600' })(['→ win']),    span({ style: 'margin-left:6px' })(['combat → winRoom'])]),
        div({})([span({ style: 'color:#dc2626; font-weight:600' })(['→ lose']),   span({ style: 'margin-left:6px' })(['combat → loseRoom'])]),
        div({ style: 'display:flex; align-items:center; gap:6px' })([
          span({ style: 'display:inline-block; width:12px; height:12px; background:#3b82f6; border-radius:2px; color:#fff; font-weight:700; text-align:center; line-height:12px; font-size:9px' })(['I']),
          span({ style: 'display:inline-block; width:12px; height:12px; background:#a855f7; border-radius:2px; color:#fff; font-weight:700; text-align:center; line-height:12px; font-size:9px' })(['V']),
          span({ style: 'display:inline-block; width:12px; height:12px; background:#16a34a; border-radius:2px; color:#fff; font-weight:700; text-align:center; line-height:12px; font-size:9px' })(['A']),
          span({})(['media: image / video / audio']),
        ]),
      ]),
    ]),
  ]);
};

export { GraphPanel };
