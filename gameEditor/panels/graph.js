/**
 * Graph panel — SVG overview of rooms, NPCs, and combats.
 *
 * Three node families with consistent visual language:
 *   - Rooms   : rectangles, room→room arrows for choice exits
 *   - NPCs    : ellipses anchored under their first location, dashed lines to
 *               other locations they roam
 *   - Combats : hexagons anchored under triggering rooms, with orange-dashed
 *               TRIGGER edges from each source room and SOLID coloured edges
 *               to winRoom (success) / loseRoom (danger)
 *
 * Every node carries small media badges (I/V/A) on its bottom-right corner.
 * Click any node to jump to its editor.
 *
 * Visual rules:
 *   - Every colour resolves to a CSS variable (--success, --warning, --danger,
 *     --accent, --text, --text-muted, --border) so light/dark themes "just work"
 *   - Edges attach to the node's BORDER, not its centre — arrow tips land on
 *     the rectangle edge, not buried inside the shape
 *   - Curves bow toward the inter-row axis so parallel edges don't overlap
 */

import { div, p, h2, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack } from '../../src/components/Layout.js';
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

// ─── Geometry constants ──────────────────────────────────────────────────

const NODE_W = 168;
const NODE_H = 60;
const COL_GAP = 110;
const ROW_GAP = 200;

const NPC_W = 124;
const NPC_H = 34;

const COMBAT_W = 132;
const COMBAT_H = 40;

// ─── Media detection — curried per source ─────────────────────────────────

const _hasMedia = ref => typeof ref === 'string' && ref.length > 0;

const _emptyMediaFlags = () => ({ img: false, video: false, audio: false });

const _roomMedia = r => {
  const flags = _emptyMediaFlags();
  if (_hasMedia(r.music)) flags.audio = true;
  for (const pg of (r.pages || [])) {
    if (_hasMedia(pg.image)) flags.img = true;
    if (_hasMedia(pg.video)) flags.video = true;
  }
  for (const ly of (r.wardrobe?.layers || [])) {
    if (_hasMedia(ly.defaultImage)) flags.img = true;
    for (const b of (ly.bindings || [])) if (_hasMedia(b.image)) flags.img = true;
  }
  return flags;
};

const _npcMedia = n => {
  const flags = _emptyMediaFlags();
  if (_hasMedia(n.portrait)) flags.img = true;
  for (const pg of (n.pages || [])) {
    if (_hasMedia(pg.image)) flags.img = true;
    if (_hasMedia(pg.video)) flags.video = true;
  }
  return flags;
};

const _combatMedia = c => {
  const flags = _emptyMediaFlags();
  if (_hasMedia(c.enemy?.image)) flags.img = true;
  if (_hasMedia(c.winImage))    flags.img = true;
  if (_hasMedia(c.loseImage))   flags.img = true;
  for (const a of (c.enemy?.actions || [])) if (_hasMedia(a.image)) flags.img = true;
  for (const m of (c.extraMoves || []))     if (_hasMedia(m.image)) flags.img = true;
  return flags;
};

// Media badges — coloured pill with letter, anchored bottom-right of a node.
// All three colours are theme tokens (info/purple/success) so dark mode works.
const _mediaBadges = flags => baseX => baseY => {
  const items = [];
  let i = 0;
  const draw = letter => varName => {
    const x = baseX - (i + 1) * 15;
    items.push(
      rect({ x, y: baseY - 8, width: 13, height: 13, rx: 3, fill: `var(${varName})`, stroke: 'var(--surface)' })([]),
      text({
        x: x + 6.5, y: baseY + 2, 'text-anchor': 'middle',
        style: 'font-size:9px; font-weight:700; fill:#fff; pointer-events:none',
      })([letter]),
    );
    i++;
  };
  if (flags.img)   draw('I')('--info');
  if (flags.video) draw('V')('--badge-purple-bg');
  if (flags.audio) draw('A')('--success');
  return items;
};

// ─── Layout: BFS from start room, row-major fill ─────────────────────────

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

// Walks rooms + npc dialogues + topic choices for `enterCombat` actions and
// `exitCombat` flows, producing (combatId, roomId, label) triggers.
const _findCombatTriggers = project => {
  const triggers = [];
  for (const r of project.rooms || []) {
    for (const c of r.choices || []) {
      if (c.action?.mode === 'enterCombat' && c.action.combatId) {
        triggers.push({ combatId: c.action.combatId, roomId: r.id, label: c.label });
      }
    }
  }
  for (const n of project.npcs || []) {
    const npcRoom = (n.locations || [])[0];
    if (!npcRoom) continue;
    const _addFromChoice = c => {
      if (c.action?.mode === 'enterCombat' && c.action.combatId) {
        triggers.push({ combatId: c.action.combatId, roomId: npcRoom, label: `via ${n.name || n.id}: ${c.label}` });
      }
      if (c.flow === 'exitCombat' && c.combatId) {
        triggers.push({ combatId: c.combatId, roomId: npcRoom, label: `via ${n.name || n.id}: ${c.label}` });
      }
    };
    for (const c of (n.choices || [])) _addFromChoice(c);
    for (const t of (n.topics  || [])) for (const c of (t.choices || [])) _addFromChoice(c);
  }
  return triggers;
};

// ─── Edge geometry ──────────────────────────────────────────────────────

// Attach an edge endpoint to the BORDER of a rectangle (centred at cx,cy with
// half-extents hx,hy) along the ray pointing at the target. Returns
// `{ x, y }` on the rectangle edge.
const _rectEdgePoint = ({ cx, cy, hx, hy, towardX, towardY }) => {
  const dx = towardX - cx, dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const tx = dx === 0 ? Infinity : hx / Math.abs(dx);
  const ty = dy === 0 ? Infinity : hy / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
};

const _nodeBox = node => ({
  cx: node.x + (node.w || NODE_W) / 2,
  cy: node.y + (node.h || NODE_H) / 2,
  hx: (node.w || NODE_W) / 2,
  hy: (node.h || NODE_H) / 2,
});

// Build a smooth path from one node's border to another's border with a gentle
// curve so parallel edges don't overlap. Returns an SVG path-data string.
const _edgePath = from => to => {
  const a = _nodeBox(from);
  const b = _nodeBox(to);
  const start = _rectEdgePoint({ ...a, towardX: b.cx, towardY: b.cy });
  const end   = _rectEdgePoint({ ...b, towardX: a.cx, towardY: a.cy });
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  // Perpendicular offset for the control point — small for short edges, larger
  // for long edges so the bow is always visible without crossing through nodes.
  const bow = Math.min(64, len * 0.18);
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const px = -dy / len, py = dx / len;
  const cx = mx + px * bow;
  const cy = my + py * bow;
  return `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
};

// Hexagon path sized COMBAT_W x COMBAT_H.
const _hexPath = () => {
  const w = COMBAT_W, h = COMBAT_H, o = 12;
  return `M ${o} 0 L ${w - o} 0 L ${w} ${h / 2} L ${w - o} ${h} L ${o} ${h} L 0 ${h / 2} Z`;
};

// ─── Component ──────────────────────────────────────────────────────────

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

  // NPC nodes anchored under their first location.
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
      x:      first.x + sibs * (NPC_W + 14),
      y:      first.y + NODE_H + 28,
      w:      NPC_W, h: NPC_H,
      locs:   n.locations,
    });
  }

  // Combat nodes — anchored under the first trigger room.
  const triggers           = _findCombatTriggers(project);
  const triggersByCombat   = {};
  for (const t of triggers) (triggersByCombat[t.combatId] ||= []).push(t);

  const combatNodes = [];
  for (const cb of project.combats || []) {
    const trigs       = triggersByCombat[cb.id] || [];
    const anchorRoom  = trigs[0]?.roomId
      ? byId[trigs[0].roomId]
      : (byId[project.meta.start || project.rooms[0]?.id]);
    if (!anchorRoom) continue;
    const sameAnchor = combatNodes.filter(c => c.anchor === anchorRoom.id).length;
    combatNodes.push({
      id:        cb.id,
      name:      cb.name || cb.id,
      enemyName: cb.enemy?.name || '',
      anchor:    anchorRoom.id,
      media:     _combatMedia(cb),
      x:         anchorRoom.x + 14 + sameAnchor * (COMBAT_W + 24),
      y:         anchorRoom.y + NODE_H + 28 + NPC_H + 22,
      w:         COMBAT_W, h: COMBAT_H,
      winRoom:   cb.winRoom  || null,
      loseRoom:  cb.loseRoom || null,
    });
  }

  // Edges.
  const roomEdges = [];
  for (const r of project.rooms) {
    const from = byId[r.id]; if (!from) continue;
    const seenTo = new Set();
    for (const c of r.choices || []) {
      if (!c.to || seenTo.has(c.to)) continue;
      seenTo.add(c.to);
      const to = byId[c.to]; if (!to) continue;
      roomEdges.push({ from, to });
    }
  }

  const npcEdges = [];
  for (const npc of npcNodes) {
    for (const locId of npc.locs) {
      const loc = byId[locId]; if (!loc) continue;
      if (locId === npc.anchor) continue;
      npcEdges.push({ from: npc, to: loc });
    }
  }

  const combatTriggerEdges = [];
  const combatOutcomeEdges = [];
  for (const cn of combatNodes) {
    for (const t of (triggersByCombat[cn.id] || [])) {
      const fromRoom = byId[t.roomId]; if (!fromRoom) continue;
      combatTriggerEdges.push({ from: fromRoom, to: cn });
    }
    if (cn.winRoom  && byId[cn.winRoom])  combatOutcomeEdges.push({ kind: 'win',  from: cn, to: byId[cn.winRoom]  });
    if (cn.loseRoom && byId[cn.loseRoom]) combatOutcomeEdges.push({ kind: 'lose', from: cn, to: byId[cn.loseRoom] });
  }

  // Canvas size.
  const cols   = Math.min(4, nodes.length);
  const rows   = Math.ceil(nodes.length / cols);
  const width  = cols * (NODE_W + COL_GAP) + 30;
  const height = rows * (NODE_H + ROW_GAP) + 140;

  // ─── Render ──────────────────────────────────────────────────────────

  // Arrow markers — each tied to a CSS variable so themes can recolour at will.
  const _arrowMarker = id => fill => marker({
    id, viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse',
  })([polygon({ points: '0,0 10,5 0,10', fill })([])]);

  const _edgeRoom = e => path({
    d: _edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--text-muted)',
    'stroke-width': 1.4,
    'marker-end': 'url(#arrow-room)',
  })([]);

  const _edgeNpc = e => path({
    d: _edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--text-subtle)',
    'stroke-width': 1.1,
    'stroke-dasharray': '4 4',
  })([]);

  const _edgeTrigger = e => path({
    d: _edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--warning)',
    'stroke-width': 1.4,
    'stroke-dasharray': '6 3',
    'marker-end': 'url(#arrow-trigger)',
  })([]);

  const _edgeOutcome = e => path({
    d: _edgePath(e.from)(e.to),
    fill: 'none',
    stroke: e.kind === 'win' ? 'var(--success)' : 'var(--danger)',
    'stroke-width': 1.8,
    'marker-end': e.kind === 'win' ? 'url(#arrow-win)' : 'url(#arrow-lose)',
  })([]);

  const _roomNode = n => g({
    className: `gef-node${n.isStart ? ' start' : ''}${n.id === selectedRoomId ? ' active' : ''}`,
    transform: `translate(${n.x},${n.y})`,
    onclick: () => setState({ selectedRoomId: n.id, activeTab: 'rooms' }),
    style: 'cursor:pointer',
  })([
    rect({
      width: NODE_W, height: NODE_H, rx: 10,
      fill: 'var(--surface)',
      stroke: n.isStart ? 'var(--clr-green-700)' : 'var(--border)',
      'stroke-width': n.isStart ? 2 : 1.2,
    })([]),
    text({
      x: NODE_W / 2, y: 24, 'text-anchor': 'middle',
      style: 'font-size:13px; font-weight:600; fill:var(--text); pointer-events:none',
    })([n.title]),
    text({
      x: NODE_W / 2, y: 42, 'text-anchor': 'middle',
      style: 'font-size:10px; font-family:ui-monospace,monospace; fill:var(--text-muted); pointer-events:none',
    })([n.id]),
    ...(n.isStart
      ? [text({
          x: 8, y: 13, 'text-anchor': 'start',
          style: 'font-size:9px; font-weight:700; fill:var(--clr-green-700); letter-spacing:.05em; pointer-events:none',
        })(['START'])]
      : []),
    ...(n.kind === 'wardrobe' || n.kind === 'inventory'
      ? [text({
          x: 8, y: NODE_H - 6, 'text-anchor': 'start',
          style: 'font-size:9px; font-style:italic; fill:var(--text-muted); pointer-events:none',
        })([n.kind])]
      : []),
    ..._mediaBadges(n.media)(NODE_W - 4)(NODE_H - 6),
  ]);

  const _npcNode = n => g({
    className: 'gef-node gef-npc',
    transform: `translate(${n.x},${n.y})`,
    onclick: () => setState({ selectedNpcId: n.id, activeTab: 'npcs' }),
    style: 'cursor:pointer',
  })([
    ellipse({
      cx: NPC_W / 2, cy: NPC_H / 2, rx: NPC_W / 2, ry: NPC_H / 2,
      fill: 'var(--surface)',
      stroke: n.role === 'shop' ? 'var(--warning)' : 'var(--text-muted)',
      'stroke-width': 1.3,
    })([]),
    text({
      x: NPC_W / 2, y: NPC_H / 2 + 4, 'text-anchor': 'middle',
      style: 'font-size:11.5px; fill:var(--text); pointer-events:none',
    })([n.name]),
    ..._mediaBadges(n.media)(NPC_W - 4)(NPC_H - 4),
  ]);

  const _combatNode = cn => g({
    className: 'gef-node gef-combat',
    transform: `translate(${cn.x},${cn.y})`,
    onclick: () => setState({ selectedCombatId: cn.id, activeTab: 'combats' }),
    style: 'cursor:pointer',
  })([
    path({
      d: _hexPath(),
      fill: 'var(--surface)',
      stroke: 'var(--danger)',
      'stroke-width': 1.4,
    })([]),
    text({
      x: COMBAT_W / 2, y: COMBAT_H / 2 - 2, 'text-anchor': 'middle',
      style: 'font-size:11.5px; font-weight:600; fill:var(--text); pointer-events:none',
    })([cn.name]),
    text({
      x: COMBAT_W / 2, y: COMBAT_H / 2 + 12, 'text-anchor': 'middle',
      style: 'font-size:9.5px; fill:var(--text-muted); pointer-events:none',
    })([cn.enemyName ? `vs ${cn.enemyName}` : 'encounter']),
    ..._mediaBadges(cn.media)(COMBAT_W - 4)(COMBAT_H - 6),
  ]);

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Graph']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Rooms (rectangles), NPCs (ellipses), and combats (hexagons). Media badges show what kinds of assets each entity uses. Click any node to jump to its editor.',
    ]),

    Card({})([
      div({ className: 'gef-graph', style: 'overflow:auto; max-width:100%' })([
        svg({
          width, height,
          viewBox: `0 0 ${width} ${height}`,
          xmlns:   'http://www.w3.org/2000/svg',
        })([
          defs({})([
            _arrowMarker('arrow-room')('var(--text-muted)'),
            _arrowMarker('arrow-trigger')('var(--warning)'),
            _arrowMarker('arrow-win')('var(--success)'),
            _arrowMarker('arrow-lose')('var(--danger)'),
          ]),

          // Order matters: edges first (behind nodes), then NPCs (so room nodes
          // overlay their NPC anchor cleanly), then combats, then room labels.
          ...roomEdges.map(_edgeRoom),
          ...npcEdges.map(_edgeNpc),
          ...combatTriggerEdges.map(_edgeTrigger),
          ...combatOutcomeEdges.map(_edgeOutcome),
          ...nodes.map(_roomNode),
          ...npcNodes.map(_npcNode),
          ...combatNodes.map(_combatNode),
        ]),
      ]),
    ]),

    Card({ title: 'Legend' })([
      div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px 16px; font-size:13px; color:var(--text-muted)' })([
        div({})([Badge({ variant: 'green' })(['start']), span({ style: 'margin-left:6px' })(['start room'])]),
        div({})([Badge({ variant: 'blue'  })(['room → room']), span({ style: 'margin-left:6px' })(['choice exit (curved)'])]),
        div({})([span({ style: 'color:var(--text-subtle); font-weight:600' })(['◯ NPC']), span({ style: 'margin-left:6px' })(['NPC (dashed = roams to other rooms)'])]),
        div({})([span({ style: 'color:var(--danger); font-weight:600' })(['⬢ Combat']), span({ style: 'margin-left:6px' })(['encounter'])]),
        div({})([span({ style: 'color:var(--warning); font-weight:600' })(['---→']), span({ style: 'margin-left:6px' })(['enterCombat / exitCombat trigger'])]),
        div({})([span({ style: 'color:var(--success); font-weight:600' })(['→ win']), span({ style: 'margin-left:6px' })(['combat → winRoom'])]),
        div({})([span({ style: 'color:var(--danger); font-weight:600' })(['→ lose']), span({ style: 'margin-left:6px' })(['combat → loseRoom'])]),
        div({ style: 'display:flex; align-items:center; gap:6px' })([
          span({ style: 'display:inline-block; width:13px; height:13px; background:var(--info); border-radius:3px; color:#fff; font-weight:700; text-align:center; line-height:13px; font-size:9px' })(['I']),
          span({ style: 'display:inline-block; width:13px; height:13px; background:var(--badge-purple-bg); border-radius:3px; color:#fff; font-weight:700; text-align:center; line-height:13px; font-size:9px' })(['V']),
          span({ style: 'display:inline-block; width:13px; height:13px; background:var(--success); border-radius:3px; color:#fff; font-weight:700; text-align:center; line-height:13px; font-size:9px' })(['A']),
          span({})(['media: image / video / audio']),
        ]),
      ]),
    ]),
  ]);
};

export { GraphPanel };
