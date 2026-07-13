/**
 * Choice graph view: every player interaction as a labeled edge or a node
 * annotation. Node families: rooms, NPCs, topics (under their NPC),
 * combats, items (bottom band).
 *
 * Edges: room choices, effect navigation (navigate / talkTo / enterCombat,
 * recursing multi / oneOf / randomLoot), onEnter / onEnd routing, talk
 * access (room -> npc per location), topic flow (enter / change / exits),
 * shop buy / sell, item gain (ops, loot tables, combat loot, rewards),
 * item use, item requirements (hasItem gates), combat win / lose.
 *
 * Non-navigating interactions (stay choices, local effects, use / read /
 * equip) render as "@" annotation lines under their node.
 *
 * Story and hideOnMap rooms are INCLUDED: this is the author's full flow
 * map, unlike the player-facing minimap.
 */

import { div, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Badge } from '../../src/components/Badge.js';
import { setState } from '../store.js';
import { vnode } from '../../lib/odocosjs/src/render.js';
import {
  NODE_W, NODE_H, NPC_W, NPC_H, COMBAT_W, COMBAT_H,
  edgeGeom, hexPath, arrowMarker,
} from '../components/_graphGeometry.js';

const svg     = vnode('svg');
const g       = vnode('g');
const rect    = vnode('rect');
const text    = vnode('text');
const path    = vnode('path');
const defs    = vnode('defs');
const ellipse = vnode('ellipse');

const TOPIC_W = 104;
const TOPIC_H = 26;
const ITEM_W  = 140;
const ITEM_H  = 34;
const CGAP    = 340;   // wide column pitch: this view carries many labeled edges
const NOTE_LH = 11;    // annotation line height

// Height consumed by a node's annotation block (notes render below it).
const _notesH = notes => notes.length ? notes.length * NOTE_LH + 8 : 0;

// Edge kinds -> stroke / marker / dash. cg- prefixed ids so the defs never
// collide with the overview's in the same document.
const KIND = {
  choice: { stroke: 'var(--text-muted)',      marker: 'cg-arrow-choice', dash: null },
  fx:     { stroke: 'var(--info)',            marker: 'cg-arrow-fx',     dash: '2 3' },
  auto:   { stroke: 'var(--badge-purple-bg)', marker: 'cg-arrow-auto',   dash: '6 3' },
  combat: { stroke: 'var(--warning)',         marker: 'cg-arrow-combat', dash: '6 3' },
  win:    { stroke: 'var(--success)',         marker: 'cg-arrow-win',    dash: null },
  lose:   { stroke: 'var(--danger)',          marker: 'cg-arrow-lose',   dash: null },
  talk:   { stroke: 'var(--accent)',          marker: 'cg-arrow-talk',   dash: null },
  item:   { stroke: 'var(--success)',         marker: 'cg-arrow-item',   dash: '3 3' },
  needs:  { stroke: 'var(--text-subtle)',     marker: 'cg-arrow-needs',  dash: '2 4' },
};

// ---- Pure extractors ----------------------------------------------------

const _isConditional = ch => ch.condition && ch.condition.mode && ch.condition.mode !== 'always';

/** Recursive navigation targets of an Effect: [{ type, id, tag }]. */
const _navTargets = eff => {
  if (!eff) return [];
  switch (eff.mode) {
    case 'navigate':    return eff.toRoom   ? [{ type: 'room',   id: eff.toRoom,   tag: 'goto'  }] : [];
    case 'talkTo':      return eff.npcId    ? [{ type: 'npc',    id: eff.npcId,    tag: 'talk'  }] : [];
    case 'enterCombat': return eff.combatId ? [{ type: 'combat', id: eff.combatId, tag: 'fight' }] : [];
    case 'multi':       return (eff.steps || []).flatMap(_navTargets);
    case 'oneOf':       return (eff.options || []).flatMap(o => _navTargets(o.effect));
    case 'randomLoot':  return (eff.table?.entries || []).flatMap(e =>
        e.kind === 'navigate' && e.roomId ? [{ type: 'room', id: e.roomId, tag: 'random' }]
      : e.kind === 'talkNpc'  && e.npcId  ? [{ type: 'npc',  id: e.npcId,  tag: 'random' }]
      : []);
    default: return [];
  }
};

/** Recursive item gains of an Effect: [{ id, tag }]. */
const _gives = eff => {
  if (!eff) return [];
  switch (eff.mode) {
    case 'simple': return (eff.ops || []).flatMap(op => {
      const m = /^inv\.(.+)$/.exec(op.target || '');
      const gain = m && (op.op === 'give' || (op.op === 'set' && Number(op.value) > 0));
      return gain ? [{ id: m[1], tag: op.op === 'give' ? `get x${op.value}` : 'set' }] : [];
    });
    case 'multi':      return (eff.steps || []).flatMap(_gives);
    case 'oneOf':      return (eff.options || []).flatMap(o => _gives(o.effect));
    case 'randomLoot': return (eff.table?.entries || []).flatMap(e =>
      e.kind === 'item' && e.itemId ? [{ id: e.itemId, tag: 'get?' }] : []);
    default: return [];
  }
};

/** Item ids required by a Condition (hasItem gate or inv.<id> compare). */
const _needsOf = cond =>
    !cond ? []
  : cond.mode === 'hasItem' && cond.itemId && cond.op !== 'lacks' ? [cond.itemId]
  : cond.mode === 'simple' && (cond.key || '').startsWith('inv.') ? [cond.key.slice(4)]
  : [];

/** True when a choice has no outgoing edge of any sort. */
const _isLocal = ch =>
  !ch.to && _navTargets(ch.action).length === 0 && _gives(ch.action).length === 0;

// ---- Edge facts ----------------------------------------------------------

const _edge = (from, to, label, kind, dashed = false) => ({ from, to, label, kind, dashed });
const _ref  = type => id => ({ type, id });
const _room = _ref('room');
const _npc  = _ref('npc');
const _top  = _ref('topic');
const _cmb  = _ref('combat');
const _itm  = _ref('item');

/** All edges produced by one choice-like object from `origin`. */
const _choiceEdges = origin => label => ch => [
  ...(ch.to ? [_edge(origin, _room(ch.to), label, 'choice', _isConditional(ch))] : []),
  ..._navTargets(ch.action).map(t => _edge(
    origin, _ref(t.type)(t.id), `${label} [${t.tag}]`,
    t.type === 'combat' ? 'combat' : 'fx', _isConditional(ch))),
  ..._gives(ch.action).map(gv => _edge(origin, _itm(gv.id), `${label} [${gv.tag}]`, 'item', _isConditional(ch))),
  ..._needsOf(ch.condition).map(id => _edge(_itm(id), origin, 'needs', 'needs')),
];

const _effectEdges = origin => label => eff => [
  ..._navTargets(eff).map(t => _edge(origin, _ref(t.type)(t.id), `${label} [${t.tag}]`, 'auto')),
  ..._gives(eff).map(gv => _edge(origin, _itm(gv.id), `${label} [${gv.tag}]`, 'item')),
];

const _entryTopicId = n => n.entryTopicId || n.topics?.[0]?.id || '';

const _collectEdges = project => [
  // Rooms: choices + auto routing.
  ...(project.rooms || []).flatMap(r => [
    ...(r.choices || []).flatMap(ch => _choiceEdges(_room(r.id))(ch.label || '')(ch)),
    ..._effectEdges(_room(r.id))('onEnter')(r.onEnter),
    ..._effectEdges(_room(r.id))('onEnd')(r.onEnd),
  ]),

  // NPCs: talk access, dialogue flow, shop.
  ...(project.npcs || []).flatMap(n => [
    ...(n.locations || []).map(loc => _edge(_room(loc), _npc(n.id), 'talk', 'talk')),
    ...(n.role === 'shop'
      ? [
          ...(n.shop?.stock || []).filter(s => s.itemId).map(s => _edge(_npc(n.id), _itm(s.itemId), 'buy', 'item')),
          ...(n.shop?.buyback?.mode === 'list'
            ? (n.shop.buyback.items || []).filter(b => b.itemId).map(b => _edge(_itm(b.itemId), _npc(n.id), 'sell', 'item'))
            : []),
        ]
      : n.advanced
      ? [
          ...(_entryTopicId(n) ? [_edge(_npc(n.id), _top(_entryTopicId(n)), 'enter', 'talk')] : []),
          ...(n.topics || []).flatMap(t => [
            ..._effectEdges(_top(t.id))(`onEnter`)(t.onEnter),
            ...(t.choices || []).flatMap(ch => [
              ...(ch.flow === 'change' && ch.topicId
                ? [_edge(_top(t.id), _top(ch.topicId), ch.label || '', 'choice', _isConditional(ch))] : []),
              ...(ch.flow === 'exitRoom' && ch.to
                ? [_edge(_top(t.id), _room(ch.to), ch.label || '', 'choice', _isConditional(ch))] : []),
              ...(ch.flow === 'exitCombat' && ch.combatId
                ? [_edge(_top(t.id), _cmb(ch.combatId), ch.label || '', 'combat', _isConditional(ch))] : []),
              ..._navTargets(ch.action).map(x => _edge(
                _top(t.id), _ref(x.type)(x.id), `${ch.label || ''} [${x.tag}]`,
                x.type === 'combat' ? 'combat' : 'fx', _isConditional(ch))),
              ..._gives(ch.action).map(gv => _edge(_top(t.id), _itm(gv.id), `${ch.label || ''} [${gv.tag}]`, 'item', _isConditional(ch))),
              ..._needsOf(ch.condition).map(id => _edge(_itm(id), _top(t.id), 'needs', 'needs')),
            ]),
          ]),
        ]
      : (n.choices || []).flatMap(ch => _choiceEdges(_npc(n.id))(ch.label || '')(ch))),
  ]),

  // Combats: outcomes, loot, reward effects.
  ...(project.combats || []).flatMap(cb => [
    ...(cb.winRoom  ? [_edge(_cmb(cb.id), _room(cb.winRoom),  'win',  'win')]  : []),
    ...(cb.loseRoom ? [_edge(_cmb(cb.id), _room(cb.loseRoom), 'lose', 'lose')] : []),
    ...Object.entries(cb.enemy?.loot || {}).map(([id, nx]) => _edge(_cmb(cb.id), _itm(id), `loot x${nx}`, 'item')),
    ..._effectEdges(_cmb(cb.id))('onWin')(cb.onWin),
    ..._effectEdges(_cmb(cb.id))('onLose')(cb.onLose),
  ]),

  // Items: use effects.
  ...(project.items || []).flatMap(it => [
    ..._navTargets(it.useEffect).map(t => _edge(_itm(it.id), _ref(t.type)(t.id), `use [${t.tag}]`, 'fx')),
    ..._gives(it.useEffect).map(gv => _edge(_itm(it.id), _itm(gv.id), `use [${gv.tag}]`, 'item')),
  ]),
];

// ---- Annotations: local interactions with no edge ------------------------

const _capNotes = notes => notes.length <= 3 ? notes : [...notes.slice(0, 3), `+${notes.length - 3} more`];

const _roomNotes  = r => _capNotes((r.choices || []).filter(_isLocal).map(ch => `@ ${ch.label || '(choice)'}`));
const _npcNotes   = n => n.advanced || n.role === 'shop'
  ? _capNotes(n.role === 'shop' && n.shop?.buyback?.mode === 'open' ? ['@ buys anything'] : [])
  : _capNotes((n.choices || []).filter(_isLocal).map(ch => `@ ${ch.label || '(choice)'}`));
const _topicNotes = t => _capNotes((t.choices || []).flatMap(ch =>
    ch.flow === 'stay' && _isLocal(ch) ? [`@ ${ch.label || '(stay)'}`]
  : ch.flow === 'exitBack'             ? [`< ${ch.label || 'back'}`]
  : []));
const _combatNotes = cb => _capNotes((cb.extraMoves || []).length ? [`@ ${cb.extraMoves.length} extra move(s)`] : []);
const _itemNotes  = it => _capNotes([
  ...(it.kind === 'consumable' ? ['@ use'] : []),
  ...(it.kind === 'readable'   ? ['@ read'] : []),
  ...(it.kind === 'equipment'  ? [`@ equip: ${it.equipSlot || '?'}`] : []),
]);

// ---- Layout ---------------------------------------------------------------

// Per-room stack: NPCs one per row (topics wrapped 2-wide to their right),
// then combats wrapped 2-wide. All offsets relative to the room origin.
// Every pitch accounts for the annotation block below its node so notes
// never run into the next shape.
const _roomStack = project => roomId => {
  const room     = (project.rooms || []).find(r => r.id === roomId);
  const startY   = NODE_H + 22 + _notesH(room ? _roomNotes(room) : []);
  const npcs     = (project.npcs || []).filter(n => (n.locations || [])[0] === roomId);
  // Topics in a SINGLE column right of their NPC: keeps the space right of
  // every topic open, so intra-topic change edges always have a clear arc.
  const npcPart  = npcs.reduce((acc, n) => {
    const topics     = n.advanced ? (n.topics || []) : [];
    const notes      = _npcNotes(n);
    const topicNotes = topics.map(_topicNotes);
    const topicPitch = TOPIC_H + 10 + Math.max(0, ...topicNotes.map(_notesH));
    const blockH     = Math.max(NPC_H + _notesH(notes), topics.length * topicPitch);
    return {
      y: acc.y + blockH + 14,
      npcs: [...acc.npcs, { id: n.id, name: n.name || n.id, role: n.role, notes, dx: 0, dy: acc.y }],
      topics: [...acc.topics, ...topics.map((t, i) => ({
        id: t.id, name: t.name || t.id, npcId: n.id, notes: topicNotes[i],
        dx: NPC_W + 16,
        dy: acc.y + i * topicPitch,
      }))],
    };
  }, { y: startY, npcs: [], topics: [] });

  const anchoredCombats = (project.combats || []).filter(cb => _combatAnchor(project)(cb) === roomId);
  const combatNotes  = anchoredCombats.map(_combatNotes);
  const combatPitch  = COMBAT_H + 16 + Math.max(0, ...combatNotes.map(_notesH));
  const combats = anchoredCombats.map((cb, i) => ({
    id: cb.id, name: cb.name || cb.id, notes: combatNotes[i],
    dx: 14 + (i % 2) * (COMBAT_W + 24),
    dy: npcPart.y + 8 + Math.floor(i / 2) * combatPitch,
  }));
  const height = npcPart.y + 8 + Math.ceil(anchoredCombats.length / 2) * combatPitch;
  return { ...npcPart, combats, height };
};

const _combatAnchor = project => cb => {
  const viaRoom = (project.rooms || []).find(r =>
    (r.choices || []).some(ch => _navTargets(ch.action).some(t => t.type === 'combat' && t.id === cb.id)));
  const viaNpc = (project.npcs || []).find(n =>
    [...(n.choices || []), ...(n.topics || []).flatMap(t => t.choices || [])]
      .some(ch => ch.combatId === cb.id || _navTargets(ch.action).some(t => t.type === 'combat' && t.id === cb.id)));
  return viaRoom?.id || viaNpc?.locations?.[0] || project.meta.start;
};

// BFS room order over nav targets, all rooms included, orphans appended.
const _roomOrder = project => {
  const byId    = Object.fromEntries(project.rooms.map(r => [r.id, r]));
  const startId = byId[project.meta.start] ? project.meta.start : project.rooms[0]?.id;
  const outs    = r => [
    ...(r.choices || []).flatMap(ch => ch.to ? [ch.to] : []),
    ..._navTargets(r.onEnd).filter(t => t.type === 'room').map(t => t.id),
  ];
  const bfs = (order, seen, queue) => {
    if (queue.length === 0) return order;
    const [head, ...rest] = queue;
    const fresh = outs(byId[head] || {}).filter(id => byId[id] && !seen.has(id));
    return bfs([...order, head], new Set([...seen, ...fresh]), [...rest, ...fresh]);
  };
  const reached = startId ? bfs([], new Set([startId]), [startId]) : [];
  return { order: [...reached, ...project.rooms.map(r => r.id).filter(id => !reached.includes(id))], byId, startId };
};

const _layout = project => {
  const { order, byId, startId } = _roomOrder(project);
  const cols   = Math.min(3, Math.max(1, order.length));
  const stacks = Object.fromEntries(order.map(id => [id, _roomStack(project)(id)]));

  // Dynamic row heights: each grid row is as tall as its tallest stack.
  const logicalRows = order.reduce((rows, id, i) => {
    const rIdx = Math.floor(i / cols);
    return rows.length === rIdx ? [...rows, [id]] : rows.map((r, k) => k === rIdx ? [...r, id] : r);
  }, []);
  const rowYs = logicalRows.reduce(
    (acc, row) => [...acc, acc[acc.length - 1] + Math.max(...row.map(id => stacks[id].height)) + 170],
    [30]);

  const placed = order.flatMap((id, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = col * (NODE_W + CGAP) + 30;
    const y = rowYs[row];
    const s = stacks[id];
    const r = byId[id];
    return [
      { type: 'room', id, x, y, w: NODE_W, h: NODE_H, title: r.title || id, kind: r.kind || 'scene',
        hidden: !!r.hideOnMap, isStart: id === startId, notes: _roomNotes(r) },
      ...s.npcs.map(n    => ({ type: 'npc',    ...n, x: x + n.dx, y: y + n.dy, w: NPC_W, h: NPC_H })),
      ...s.topics.map(t  => ({ type: 'topic',  ...t, x: x + t.dx, y: y + t.dy, w: TOPIC_W, h: TOPIC_H })),
      ...s.combats.map(c => ({ type: 'combat', ...c, x: x + c.dx, y: y + c.dy, w: COMBAT_W, h: COMBAT_H })),
    ];
  });

  // Items: bottom band, 5 per row, below everything else. Row pitch leaves
  // room for the kind annotation line under each card.
  const bandY = placed.reduce((m, n) => Math.max(m, n.y + n.h), 0) + 130;
  const items = (project.items || []).map((it, i) => ({
    type: 'item', id: it.id, name: it.name || it.id, kind: it.kind, notes: _itemNotes(it),
    x: 30 + (i % 5) * (ITEM_W + 60),
    y: bandY + Math.floor(i / 5) * (ITEM_H + 70),
    w: ITEM_W, h: ITEM_H,
  }));

  return [...placed, ...items];
};

// ---- Render ---------------------------------------------------------------

const _clip = s => s.length > 28 ? `${s.slice(0, 27)}~` : s;

const _notesEls = n => n.notes.map((note, i) => text({
  x: 4, y: n.h + 12 + i * 11,
  style: 'font-size:9px; fill:var(--text-muted); pointer-events:none',
})([_clip(note)]));

const _clicks = {
  room:   n => ({ selectedRoomId: n.id, activeTab: n.kind === 'story' ? 'stories' : 'rooms' }),
  npc:    n => ({ selectedNpcId: n.id, activeTab: 'npcs' }),
  topic:  n => ({ selectedNpcId: n.npcId, selectedTopicId: n.id, activeTab: 'npcs' }),
  combat: n => ({ selectedCombatId: n.id, activeTab: 'combats' }),
  item:   n => ({ selectedItemId: n.id, activeTab: 'items' }),
};

const _shapes = {
  room: n => [
    rect({
      width: NODE_W, height: NODE_H, rx: 10, fill: 'var(--surface)',
      stroke: n.isStart ? 'var(--clr-green-700)' : 'var(--border)',
      'stroke-width': n.isStart ? 2 : 1.2,
      ...(n.kind === 'story' ? { 'stroke-dasharray': '6 4' } : {}),
    })([]),
    text({ x: NODE_W / 2, y: 24, 'text-anchor': 'middle', style: 'font-size:13px; font-weight:600; fill:var(--text); pointer-events:none' })(
      [`${n.kind === 'story' ? '* ' : ''}${n.title}`]),
    text({ x: NODE_W / 2, y: 42, 'text-anchor': 'middle', style: 'font-size:10px; font-family:ui-monospace,monospace; fill:var(--text-muted); pointer-events:none' })(
      [n.hidden ? `${n.id} (hidden)` : n.id]),
  ],
  npc: n => [
    ellipse({
      cx: NPC_W / 2, cy: NPC_H / 2, rx: NPC_W / 2, ry: NPC_H / 2, fill: 'var(--surface)',
      stroke: n.role === 'shop' ? 'var(--warning)' : 'var(--text-muted)', 'stroke-width': 1.3,
    })([]),
    text({ x: NPC_W / 2, y: NPC_H / 2 + 4, 'text-anchor': 'middle', style: 'font-size:11.5px; fill:var(--text); pointer-events:none' })([n.name]),
  ],
  topic: n => [
    rect({ width: TOPIC_W, height: TOPIC_H, rx: 6, fill: 'var(--surface)', stroke: 'var(--text-subtle)', 'stroke-width': 1 })([]),
    text({ x: TOPIC_W / 2, y: TOPIC_H / 2 + 3.5, 'text-anchor': 'middle', style: 'font-size:9.5px; fill:var(--text); pointer-events:none' })([_clip(n.name)]),
  ],
  combat: n => [
    path({ d: hexPath(), fill: 'var(--surface)', stroke: 'var(--danger)', 'stroke-width': 1.4 })([]),
    text({ x: COMBAT_W / 2, y: COMBAT_H / 2 + 4, 'text-anchor': 'middle', style: 'font-size:11.5px; font-weight:600; fill:var(--text); pointer-events:none' })([n.name]),
  ],
  item: n => [
    rect({ width: ITEM_W, height: ITEM_H, rx: 8, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 1.2 })([]),
    text({ x: ITEM_W / 2, y: 14, 'text-anchor': 'middle', style: 'font-size:11px; font-weight:600; fill:var(--text); pointer-events:none' })([_clip(n.name)]),
    text({ x: ITEM_W / 2, y: 27, 'text-anchor': 'middle', style: 'font-size:8.5px; fill:var(--text-muted); pointer-events:none' })([n.kind || 'misc']),
  ],
};

const _nodeEl = selectedRoomId => n => g({
  className: `gef-node${n.type === 'room' && n.id === selectedRoomId ? ' active' : ''}`,
  transform: `translate(${n.x},${n.y})`,
  onclick:   () => setState(_clicks[n.type](n)),
  style:     'cursor:pointer',
})([..._shapes[n.type](n), ..._notesEls(n)]);

const ChoiceGraphView = state => {
  const { project, selectedRoomId } = state;

  const nodes  = _layout(project);
  const nodeBy = Object.fromEntries(nodes.map(n => [`${n.type}:${n.id}`, n]));
  const nodeOf = ref => nodeBy[`${ref.type}:${ref.id}`];

  const resolved = _collectEdges(project)
    .map(e => ({ ...e, fromNode: nodeOf(e.from), toNode: nodeOf(e.to) }))
    .filter(e => e.fromNode && e.toNode && e.fromNode !== e.toNode);

  // Fan parallel edges per (from,to) pair with growing bow, and stagger
  // each edge's label position along the curve so labels never stack on
  // the shared midpoint.
  const LABEL_TS = [0.5, 0.36, 0.64, 0.26, 0.74];
  const fanned = Object.values(
    resolved.reduce((m, e) => {
      const key = `${e.from.type}:${e.from.id}>${e.to.type}:${e.to.id}`;
      return { ...m, [key]: [...(m[key] || []), e] };
    }, {}),
  ).flatMap(group => group.map((e, i) => ({ ...e, bow: i * 34, labelT: LABEL_TS[i % LABEL_TS.length] })));

  // Obstacle avoidance: when a curve passes through a node rect, widen or
  // flip its bow until a sampled run of the curve is clear. Keeps stacked
  // structural edges (talk / enter / change) from cutting through shapes.
  const SAMPLES  = Array.from({ length: 11 }, (_, i) => 0.1 + i * 0.08);
  const _inflate = n => ({ x1: n.x - 4, y1: n.y - 4, x2: n.x + n.w + 4, y2: n.y + n.h + 4 });
  const _inside  = r => pt => pt.x > r.x1 && pt.x < r.x2 && pt.y > r.y1 && pt.y < r.y2;
  const _hits    = rects => at =>
    rects.reduce((n, r) => n + SAMPLES.filter(t => _inside(r)(at(t))).length, 0);
  // Ladder of alternating wider bows; first fully clear candidate wins,
  // otherwise the least-blocked one (dense stacks may have no clear path).
  const _LADDER = Array.from({ length: 12 }, (_, i) => (i + 1) * 44).flatMap(d => [d, -d]);
  const _clearBow = e => {
    // Near-neighbour structural hops (npc -> its topic, adjacent topics)
    // cannot meaningfully cross anything; skip the search.
    const df = Math.hypot(
      (e.toNode.x + e.toNode.w / 2) - (e.fromNode.x + e.fromNode.w / 2),
      (e.toNode.y + e.toNode.h / 2) - (e.fromNode.y + e.fromNode.h / 2));
    if (df < 90) return e.bow;
    const rects  = nodes.filter(n => n !== e.fromNode && n !== e.toNode).map(_inflate);
    const scored = [e.bow, ..._LADDER.map(d => e.bow + d)]
      .map(b => ({ b, hits: _hits(rects)(edgeGeom(b)(e.fromNode)(e.toNode).at) }));
    const clear = scored.find(s => s.hits === 0);
    return (clear || scored.reduce((best, s) => s.hits < best.hits ? s : best)).b;
  };
  const routed = fanned.map(e => ({ ...e, bow: _clearBow(e) }));

  // Canvas pads by the largest fan bow so wide edge fans and their labels
  // cannot clip outside the viewBox on any side.
  const pad    = routed.reduce((m, e) => Math.max(m, Math.abs(e.bow)), 0) + 84;
  const width  = nodes.reduce((m, n) => Math.max(m, n.x + n.w), 0) + 40;
  const height = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0) + 70;

  const _edgeEl = e => {
    const k = KIND[e.kind] || KIND.choice;
    const { d, at } = edgeGeom(e.bow)(e.fromNode)(e.toNode);
    const lp = at(e.labelT);
    return g({})([
      path({
        d, fill: 'none', stroke: k.stroke, 'stroke-width': 1.3,
        'marker-end': `url(#${k.marker})`,
        ...(e.dashed ? { 'stroke-dasharray': '5 3' } : (k.dash ? { 'stroke-dasharray': k.dash } : {})),
      })([]),
      ...(e.label ? [text({
        x: lp.x, y: lp.y - 4, 'text-anchor': 'middle',
        style: `font-size:9.5px; fill:${k.stroke}; paint-order:stroke; stroke:var(--bg); stroke-width:3px; pointer-events:none`,
      })([_clip(e.label)])] : []),
    ]);
  };

  return [
    Card({})([
      div({ className: 'gef-graph', style: 'overflow:auto; max-width:100%' })([
        svg({
          width:   width + 2 * pad,
          height:  height + 2 * pad,
          viewBox: `${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`,
          xmlns:   'http://www.w3.org/2000/svg',
        })([
          defs({})(Object.values(KIND).map(k => arrowMarker(k.marker)(k.stroke))),
          ...routed.map(_edgeEl),
          ...nodes.map(_nodeEl(selectedRoomId)),
        ]),
      ]),
    ]),
    Card({ title: 'Legend' })([
      div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:10px 16px; font-size:13px; color:var(--text-muted)' })([
        div({})([span({ style: 'color:var(--text-muted); font-weight:600' })(['-> label']), span({ style: 'margin-left:6px' })(['choice (dashed = conditional)'])]),
        div({})([span({ style: 'color:var(--accent); font-weight:600' })(['-> talk / enter']), span({ style: 'margin-left:6px' })(['NPC access + topic entry'])]),
        div({})([span({ style: 'color:var(--info); font-weight:600' })(['-> [goto/talk/random/use]']), span({ style: 'margin-left:6px' })(['effect navigation'])]),
        div({})([span({ style: 'color:var(--badge-purple-bg); font-weight:600' })(['-> onEnter/onEnd/onWin']), span({ style: 'margin-left:6px' })(['automatic routing'])]),
        div({})([span({ style: 'color:var(--warning); font-weight:600' })(['-> [fight]']), span({ style: 'margin-left:6px' })(['enters a combat'])]),
        div({})([span({ style: 'color:var(--success); font-weight:600' })(['-> get/loot/buy']), span({ style: 'margin-left:6px' })(['item gain / shop'])]),
        div({})([span({ style: 'color:var(--text-subtle); font-weight:600' })(['-> needs']), span({ style: 'margin-left:6px' })(['item gates a choice'])]),
        div({})([Badge({ variant: 'gray' })(['@ note']), span({ style: 'margin-left:6px' })(['local interaction (stay / use / read / equip)'])]),
        div({})([Badge({ variant: 'gray' })(['* dashed rect']), span({ style: 'margin-left:6px' })(['story room (hidden on the minimap)'])]),
      ]),
    ]),
  ];
};

export { ChoiceGraphView };
