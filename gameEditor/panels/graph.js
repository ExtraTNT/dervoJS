/**
 * Graph panel - SVG overview of rooms, NPCs, and combats.
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
 *   - Edges attach to the node's BORDER, not its centre - arrow tips land on
 *     the rectangle edge, not buried inside the shape
 *   - Curves bow toward the inter-row axis so parallel edges don't overlap
 */

import { div, p, h2, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { Button } from '../../src/components/Button.js';
import { setState } from '../store.js';
import { vnode } from '../../lib/odocosjs/src/render.js';
import {
  NODE_W, NODE_H, COL_GAP, ROW_GAP, NPC_W, NPC_H, COMBAT_W, COMBAT_H,
  edgePath, hexPath, arrowMarker,
} from '../components/_graphGeometry.js';
import { ChoiceGraphView } from './graphChoices.js';

const svg     = vnode('svg');
const g       = vnode('g');
const rect    = vnode('rect');
const text    = vnode('text');
const path    = vnode('path');
const defs    = vnode('defs');
const ellipse = vnode('ellipse');

// Media detection

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

// Media badges - coloured pill with letter, anchored bottom-right of a node.
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

// Layout: BFS from start room, row-major fill

// Rooms with `kind:'story'` or the opt-out `hideOnMap` flag never render on
// the graph - story rooms are narrative-only scenes that the player can't
// walk to, and the flag lets authors hide hub / dream / void rooms too.
const _isMapped = r => r && r.kind !== 'story' && !r.hideOnMap;

const _layout = project => {
  const mapped  = project.rooms.filter(_isMapped);
  const byId    = Object.fromEntries(mapped.map(r => [r.id, r]));
  const startId = byId[project.meta.start] ? project.meta.start : mapped[0]?.id;
  const queue   = startId ? [startId] : [];
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
  // Mapped orphans still appear (just unconnected), so the author can spot
  // rooms that became unreachable. Story / hideOnMap rooms stay out entirely.
  for (const r of mapped) if (!seen.has(r.id)) order.push(r.id);

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

// Overview body (rooms + npcs + combats, deduped room edges)

const _overviewBody = state => {
  const { project, selectedRoomId } = state;

  const nodes = _layout(project);
  const byId  = Object.fromEntries(nodes.map(n => [n.id, n]));

  // NPC nodes anchored under their first location. NPCs sharing an anchor
  // wrap into a small grid (NPCS_PER_ROW columns) instead of stretching
  // horizontally forever - without this, 4+ NPCs on one room would bleed
  // across the next column's rooms and overlap their NPCs.
  const NPCS_PER_ROW   = 2;
  const NPC_COL_STEP   = NPC_W + 14;
  const NPC_ROW_STEP   = NPC_H + 10;
  const npcNodes       = [];
  const npcCountByAnchor = {};
  for (const n of project.npcs || []) {
    if (n.locations.length === 0) continue;
    const first = byId[n.locations[0]];
    if (!first) continue;
    const idx = npcCountByAnchor[first.id] || 0;
    npcCountByAnchor[first.id] = idx + 1;
    const col = idx % NPCS_PER_ROW;
    const row = Math.floor(idx / NPCS_PER_ROW);
    npcNodes.push({
      id:     n.id,
      name:   n.name || n.id,
      role:   n.role,
      media:  _npcMedia(n),
      anchor: first.id,
      x:      first.x + col * NPC_COL_STEP,
      y:      first.y + NODE_H + 28 + row * NPC_ROW_STEP,
      w:      NPC_W, h: NPC_H,
      locs:   n.locations,
    });
  }
  // Per-anchor NPC row count so combats land below the WHOLE NPC stack,
  // not just one row's worth.
  const npcRowsByAnchor = {};
  for (const aid of Object.keys(npcCountByAnchor)) {
    npcRowsByAnchor[aid] = Math.ceil(npcCountByAnchor[aid] / NPCS_PER_ROW);
  }

  // Combat nodes - anchored under the first trigger room, BELOW any NPCs
  // already piled under that room (so multi-NPC rooms don't paint combats
  // on top of their cast).
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
    const npcRowsHere = npcRowsByAnchor[anchorRoom.id] || 0;
    // Same horizontal-then-wrap policy as NPCs, so combats don't bleed into
    // neighbour columns either.
    const combatCol = sameAnchor % 2;
    const combatRow = Math.floor(sameAnchor / 2);
    combatNodes.push({
      id:        cb.id,
      name:      cb.name || cb.id,
      enemyName: cb.enemy?.name || '',
      anchor:    anchorRoom.id,
      media:     _combatMedia(cb),
      x:         anchorRoom.x + 14 + combatCol * (COMBAT_W + 24),
      y:         anchorRoom.y + NODE_H + 28 + (npcRowsHere * NPC_ROW_STEP) + 12
                 + combatRow * (COMBAT_H + 14),
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

  // Canvas size - derived from the actual extents of every drawn node so
  // NPCs / combats that overflow past their anchor room still get viewport
  // space. Without this, rooms in the rightmost column with many NPCs would
  // get clipped off the right edge of the SVG.
  const _maxRight  = (m, n) => Math.max(m, n.x + (n.w || NODE_W));
  const _maxBottom = (m, n) => Math.max(m, n.y + (n.h || NODE_H));
  const allDrawn   = [...nodes, ...npcNodes, ...combatNodes];
  const width      = allDrawn.reduce(_maxRight,  0) + 30;
  const height     = allDrawn.reduce(_maxBottom, 0) + 60;

  // Rendering

  const _edgeRoom = e => path({
    d: edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--text-muted)',
    'stroke-width': 1.4,
    'marker-end': 'url(#arrow-room)',
  })([]);

  const _edgeNpc = e => path({
    d: edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--text-subtle)',
    'stroke-width': 1.1,
    'stroke-dasharray': '4 4',
  })([]);

  const _edgeTrigger = e => path({
    d: edgePath(e.from)(e.to),
    fill: 'none',
    stroke: 'var(--warning)',
    'stroke-width': 1.4,
    'stroke-dasharray': '6 3',
    'marker-end': 'url(#arrow-trigger)',
  })([]);

  const _edgeOutcome = e => path({
    d: edgePath(e.from)(e.to),
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
      d: hexPath(),
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

  return [
    Card({})([
      div({ className: 'gef-graph', style: 'overflow:auto; max-width:100%' })([
        svg({
          width, height,
          viewBox: `0 0 ${width} ${height}`,
          xmlns:   'http://www.w3.org/2000/svg',
        })([
          defs({})([
            arrowMarker('arrow-room')('var(--text-muted)'),
            arrowMarker('arrow-trigger')('var(--warning)'),
            arrowMarker('arrow-win')('var(--success)'),
            arrowMarker('arrow-lose')('var(--danger)'),
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
  ];
};

// Header

const _VIEWS = [
  { id: 'overview', label: 'Overview', hint: 'Rooms (rectangles), NPCs (ellipses), and combats (hexagons). Room edges are deduped. Click any node to jump to its editor.' },
  { id: 'choices',  label: 'Choices',  hint: 'Every player interaction: room choices, talk access, NPC topic flow, shop buy/sell, item gain/use/requirements, combat entry/loot/outcomes, onEnter/onEnd routing. Local interactions show as @ notes under their node. Includes story and hidden rooms.' },
];

const GraphPanel = state => {
  const { project } = state;
  if (project.rooms.length === 0) {
    return Stack({ gap: 14 })([
      h2({ style: 'margin:0' })(['Graph']),
      div({ className: 'gef-empty' })(['No rooms to draw yet. Add some in the Rooms tab.']),
    ]);
  }
  const view = _VIEWS.find(v => v.id === state.graphView) || _VIEWS[0];
  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Graph']),
    div({ style: 'display:flex; gap:8px; align-items:center' })([
      ..._VIEWS.map(v => Button({
        size:    'sm',
        variant: v.id === view.id ? 'primary' : 'ghost',
        onClick: () => setState({ graphView: v.id }),
      })([v.label])),
    ]),
    p({ className: 'gef-hint gef-hint-13' })([view.hint]),
    ...(view.id === 'choices' ? ChoiceGraphView(state) : _overviewBody(state)),
  ]);
};

export { GraphPanel };
