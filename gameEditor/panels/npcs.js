/**
 * NPCs panel — list on the left, NpcEditor on the right.
 *
 * Two conversation systems per NPC, switched by an Advanced toggle:
 *
 *   advanced: false  (default — simple, flat)
 *     Greeting pages + flat Choices, exactly like before. Choice.flow is ignored;
 *     `to` drives navigation. Topics are hidden but preserved.
 *
 *   advanced: true   (topic tree)
 *     Greeting pages → entry topic → sub-topics via `change` flow.
 *     A small SVG tree shows the topology; click a topic node to edit it.
 *     Each topic is itself like a tiny scene (pages + choices), but choices use
 *     the 4-mode flow: change / exitBack / exitRoom / exitCombat.
 *
 * `role: shop` is orthogonal — shops bypass both systems.
 */

import { div, span, h2, h3, p, button } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Select } from '../../src/components/Select.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState } from '../store.js';
import { emptyNpc, emptyPage, emptyChoice, emptyShopEntry, emptyTopic } from '../schema.js';
import { onText } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';
import { PageEditor }     from '../components/PageEditor.js';
import { ChoiceEditor }   from '../components/ChoiceEditor.js';
import { EffectEditor }   from '../components/EffectEditor.js';
import { ChoiceGenerator, openChoiceGenerator } from '../components/ChoiceGenerator.js';
import { vnode } from '../../lib/odocosjs/src/render.js';

const svg     = vnode('svg');
const g       = vnode('g');
const rect    = vnode('rect');
const text    = vnode('text');
const path    = vnode('path');
const circle  = vnode('circle');
const defs    = vnode('defs');
const marker  = vnode('marker');
const polygon = vnode('polygon');

const ROLE_OPTS = [
  { value: 'dialogue', label: 'Dialogue (pages + choices)' },
  { value: 'shop',     label: 'Shop (item stock)' },
];

const _vars = project => ({
  stats:   project.stats.map(s => s.key).filter(Boolean),
  flags:   project.flags.map(f => f.key).filter(Boolean),
  items:   project.items,
  skills:  project.skills || [],
  npcs:    project.npcs,
  combats: project.combats || [],
});

const _updateNpc = (id, mut) => setProject(p => ({
  ...p,
  npcs: p.npcs.map(n => n.id === id ? (typeof mut === 'function' ? mut(n) : { ...n, ...mut }) : n),
}));

const _addNpc = () => setProject(p => ({ ...p, npcs: [...p.npcs, emptyNpc()] }));
const _deleteNpc = id => setProject(p => ({ ...p, npcs: p.npcs.filter(n => n.id !== id) }));
const _toggleLocation = (npcId, roomId) => _updateNpc(npcId, n => {
  const has  = n.locations.includes(roomId);
  const next = has ? n.locations.filter(x => x !== roomId) : [...n.locations, roomId];
  return { ...n, locations: next };
});

const NpcList = (project, selectedId) =>
  Stack({ gap: 4 })([
    h2({ style: 'font-size:14px; margin:0 0 4px' })([`NPCs (${project.npcs.length})`]),
    ...(project.npcs.length === 0
      ? [div({ className: 'gef-empty' })(['No NPCs yet.'])]
      : project.npcs.map(n =>
          button({
            className: `gef-list-btn${n.id === selectedId ? ' active' : ''}`,
            onclick:   () => setState({ selectedNpcId: n.id, selectedTopicId: null }),
            type:      'button',
          })([
            span({})([n.name || '(unnamed)']),
            Badge({ variant: n.role === 'shop' ? 'yellow' : (n.advanced ? 'purple' : 'gray') })(
              [n.role === 'shop' ? 'shop' : (n.advanced ? 'adv' : 'simple')]
            ),
            span({ className: 'gef-id' })([n.id]),
          ])
        )),
    Button({ size: 'sm', variant: 'ghost', onClick: _addNpc, style: 'margin-top:8px' })(['+ Add NPC']),
  ]);

const LocationsEditor = (npc, project) => {
  if (project.rooms.length === 0) {
    return div({ className: 'gef-empty' })(['Add some rooms first.']);
  }
  return div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:6px' })(
    project.rooms.map(r =>
      button({
        type: 'button',
        onclick: () => _toggleLocation(npc.id, r.id),
        className: `gef-list-btn${npc.locations.includes(r.id) ? ' active' : ''}`,
        style: 'border:1px solid var(--border)',
      })([
        span({})([r.title || r.id]),
        ...(npc.locations.includes(r.id) ? [span({ style: 'margin-left:auto' })(['✓'])] : []),
      ])
    )
  );
};

const ShopStockEditor = (npc, project) => {
  if (project.items.length === 0) {
    return div({ className: 'gef-empty' })(['Add some items first (Items tab).']);
  }
  const stock = npc.shop?.stock || [];
  const _setStock = next => _updateNpc(npc.id, n => ({ ...n, shop: { ...(n.shop || {}), stock: next } }));

  return Stack({ gap: 8 })([
    p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
      'Items the NPC sells. Leave price blank to use the item\'s default price; leave quantity blank for infinite.',
    ]),
    ...stock.map((entry, i) => {
      const item = project.items.find(it => it.id === entry.itemId);
      return div({ style: 'display:grid; grid-template-columns: 2fr 110px 110px 40px; gap:8px; align-items:end' })([
        Select({
          label:    i === 0 ? 'Item' : '',
          options:  [
            { value: '', label: '— pick —' },
            ...project.items.map(it => ({ value: it.id, label: `${it.name} (${it.id})` })),
          ],
          value:    entry.itemId,
          onChange: onText(v => _setStock(stock.map((s, k) => k === i ? { ...s, itemId: v } : s))),
        }),
        TextInput({
          label:    i === 0 ? 'Price' : '',
          value:    entry.price == null ? '' : String(entry.price),
          onChange: onText(v => _setStock(stock.map((s, k) => k === i ? { ...s, price: v === '' ? null : Math.max(0, Number(v) || 0) } : s))),
          placeholder: item ? String(item.price) : '—',
        }),
        TextInput({
          label:    i === 0 ? 'Qty' : '',
          value:    entry.quantity == null ? '' : String(entry.quantity),
          onChange: onText(v => _setStock(stock.map((s, k) => k === i ? { ...s, quantity: v === '' ? null : Math.max(0, Number(v) || 0) } : s))),
          placeholder: '∞',
        }),
        Button({ size: 'sm', variant: 'ghost', onClick: () => _setStock(stock.filter((_, k) => k !== i)) })(['×']),
      ]);
    }),
    Button({ size: 'sm', variant: 'ghost', onClick: () => _setStock([...stock, emptyShopEntry(project.items[0]?.id || '')]) })(['+ Add stock entry']),
  ]);
};

// — Topic-tree SVG view ————————————————————————————————————————————

const _TOPIC_W  = 150;
const _TOPIC_H  = 46;
const _TOPIC_GX = 30;
const _TOPIC_GY = 90;
const _PER_ROW  = 3;

// Compute { topic, x, y, outgoing } per topic for SVG rendering.
//   outgoing: { change: [targetTopicId], exitBack, exitRoom, exitCombat, stay }
const _topicLayout = npc => {
  const topics = npc.topics || [];
  return topics.map((t, i) => {
    const outgoing = { change: [], exitBack: 0, exitRoom: 0, exitCombat: 0, stay: 0 };
    for (const c of (t.choices || [])) {
      const f = c.flow;
      if (f === 'change' && c.topicId) outgoing.change.push(c.topicId);
      else if (f === 'exitBack')   outgoing.exitBack   += 1;
      else if (f === 'exitRoom')   outgoing.exitRoom   += 1;
      else if (f === 'exitCombat') outgoing.exitCombat += 1;
      else if (f === 'stay')       outgoing.stay       += 1;
    }
    return {
      topic: t,
      x: (i % _PER_ROW) * (_TOPIC_W + _TOPIC_GX) + 20,
      y: Math.floor(i / _PER_ROW) * (_TOPIC_H + _TOPIC_GY) + 20,
      outgoing,
    };
  });
};

const _arrow = (fromX, fromY, toX, toY) => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const cx = fromX + dx / 2;
  // gentle vertical bulge so edges between rows curve clearly
  const cy = (fromY + toY) / 2 + (Math.abs(dx) < 40 ? 30 : 0);
  return `M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`;
};

const TopicTree = (npc, selectedTopicId) => {
  const layout = _topicLayout(npc);
  if (layout.length === 0) {
    return div({ className: 'gef-empty' })([
      'No topics yet — add one to start mapping the conversation.',
    ]);
  }
  const byId   = Object.fromEntries(layout.map(n => [n.topic.id, n]));
  const cols   = Math.min(_PER_ROW, layout.length);
  const rows   = Math.ceil(layout.length / _PER_ROW);
  const width  = cols * (_TOPIC_W + _TOPIC_GX) + 20;
  const height = rows * (_TOPIC_H + _TOPIC_GY) + 40;
  const entryId = npc.entryTopicId || layout[0].topic.id;

  // Edges: every `change` choice draws an arrow from source to target.
  const edges = [];
  for (const node of layout) {
    for (const target of node.outgoing.change) {
      const tn = byId[target];
      if (!tn) continue;
      // From bottom-centre of source to top-centre of target.
      const fx = node.x + _TOPIC_W / 2;
      const fy = node.y + _TOPIC_H;
      const tx = tn.x   + _TOPIC_W / 2;
      const ty = tn.y;
      edges.push(path({
        d:    _arrow(fx, fy, tx, ty),
        fill: 'none',
        stroke: 'var(--accent)',
        'stroke-width': 1.5,
        'marker-end': 'url(#topic-arrow)',
      })([]));
    }
  }

  // Per-node group: rect + label + flow badges.
  const nodes = layout.map(node => {
    const isSelected = node.topic.id === selectedTopicId;
    const isEntry    = node.topic.id === entryId;
    const stroke     = isSelected ? 'var(--accent)' : (isEntry ? 'var(--accent)' : 'var(--border)');
    const strokeW    = isSelected ? 2.5 : (isEntry ? 2 : 1);
    const fill       = isSelected ? 'rgba(99,102,241,.08)' : 'var(--surface)';
    const badges = [];
    let bx = node.x + _TOPIC_W - 6;
    const pushBadge = (label, color) => {
      badges.push(circle({ cx: bx, cy: node.y - 6, r: 7, fill: color })([]));
      badges.push(text({ x: bx, y: node.y - 3, 'text-anchor': 'middle', style: 'font-size:8px; font-weight:700; fill:#fff; pointer-events:none' })([label]));
      bx -= 16;
    };
    if (node.outgoing.exitCombat) pushBadge('C', '#ef4444');
    if (node.outgoing.exitRoom)   pushBadge('R', '#f59e0b');
    if (node.outgoing.exitBack)   pushBadge('↩', '#6b7280');
    if (node.outgoing.stay)       pushBadge('S', '#10b981');

    return g({
      style:   'cursor:pointer',
      onclick: () => setState({ selectedTopicId: node.topic.id }),
    })([
      rect({
        x: node.x, y: node.y, width: _TOPIC_W, height: _TOPIC_H, rx: 8,
        fill, stroke, 'stroke-width': strokeW,
      })([]),
      text({
        x: node.x + _TOPIC_W / 2, y: node.y + _TOPIC_H / 2 + 5,
        'text-anchor': 'middle',
        style: 'font-size:13px; font-weight:600; fill:var(--text); pointer-events:none',
      })([(node.topic.name || node.topic.id).slice(0, 22)]),
      ...(isEntry
        ? [text({
            x: node.x + 6, y: node.y + 12, 'text-anchor': 'start',
            style: 'font-size:9px; font-weight:700; fill:var(--accent); pointer-events:none',
          })(['ENTRY'])]
        : []),
      ...badges,
    ]);
  });

  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); padding:8px; overflow:auto' })([
    svg({
      width, height,
      style: 'display:block',
    })([
      defs({})([
        marker({
          id: 'topic-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5,
          markerWidth: 6, markerHeight: 6, orient: 'auto',
        })([
          polygon({ points: '0,0 10,5 0,10', fill: 'var(--accent)' })([]),
        ]),
      ]),
      ...edges,
      ...nodes,
    ]),
    div({ style: 'display:flex; gap:14px; flex-wrap:wrap; padding:6px 4px 0; font-size:11px; color:var(--text-muted)' })([
      span({})(['Edges: ', span({ style: 'color:var(--accent); font-weight:600' })(['→']), ' change topic']),
      span({})([span({ style: 'background:#10b981; color:#fff; padding:0 5px; border-radius:8px; font-weight:700' })(['S']), ' stay (effect only, no nav)']),
      span({})([span({ style: 'background:#6b7280; color:#fff; padding:0 5px; border-radius:8px; font-weight:700' })(['↩']), ' exit back']),
      span({})([span({ style: 'background:#f59e0b; color:#fff; padding:0 5px; border-radius:8px; font-weight:700' })(['R']), ' exit to room']),
      span({})([span({ style: 'background:#ef4444; color:#fff; padding:0 5px; border-radius:8px; font-weight:700' })(['C']), ' exit to combat']),
    ]),
  ]);
};

// — Single-topic editor (advanced mode) ————————————————————————————————

const SingleTopicEditor = ({ topic, npc, project, vars, roomOpts, topicOpts, combatOpts, onChange, onDelete }) => {
  const set = patch => onChange({ ...topic, ...patch });

  const _setPage = (i, patch) => set({
    pages: topic.pages.map((pg, k) => k === i ? { ...pg, ...patch } : pg),
  });
  const _addPage    = () => set({ pages: [...topic.pages, emptyPage()] });
  const _deletePage = i  => {
    const next = topic.pages.filter((_, k) => k !== i);
    set({ pages: next.length ? next : [emptyPage()] });
  };
  const _movePage = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= topic.pages.length) return;
    const pages = [...topic.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    set({ pages });
  };

  const _setChoice = (i, next) => set({
    choices: topic.choices.map((c, k) => k === i ? next : c),
  });
  // Default new topic choice = exitBack (the most common case: a "Goodbye" or "Done").
  const _addChoice = () => set({
    choices: [...topic.choices, { ...emptyChoice(), flow: 'exitBack' }],
  });
  const _deleteChoice = i => set({ choices: topic.choices.filter((_, k) => k !== i) });
  const _moveChoice = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= topic.choices.length) return;
    const choices = [...topic.choices];
    [choices[i], choices[j]] = [choices[j], choices[i]];
    set({ choices });
  };

  return Stack({ gap: 12 })([
    div({ style: 'display:flex; align-items:center; gap:8px' })([
      h3({ style: 'margin:0; font-size:14px' })([`Editing topic: ${topic.name || topic.id}`]),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${topic.id.slice(-5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete topic "${topic.name || topic.id}"?`)) onDelete();
      } })(['Delete topic']),
    ]),

    TextInput({
      label:       'Topic name',
      value:       topic.name,
      onChange:    onText(v => set({ name: v })),
      placeholder: 'Weather, The King, …',
    }),

    EffectEditor({
      effect:   topic.onEnter,
      vars,
      label:    'On enter (fires when the player enters this topic)',
      onChange: v => set({ onEnter: v }),
    }),

    div({})([
      span({ style: 'font-size:12px; color:var(--text-muted); display:block; margin-bottom:6px' })([
        `Pages (${topic.pages.length}) — the dialogue shown when the player is in this topic`,
      ]),
      Stack({ gap: 4 })([
        ...topic.pages.map((pg, i) => PageEditor({
          page:       pg,
          index:      i,
          isLast:     i === topic.pages.length - 1,
          canDelete:  topic.pages.length > 1,
          onChange:   next => _setPage(i, next),
          onDelete:   () => _deletePage(i),
          onMoveUp:   () => _movePage(i, -1),
          onMoveDown: () => _movePage(i,  1),
        })),
        Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
      ]),
    ]),

    div({})([
      span({ style: 'font-size:12px; color:var(--text-muted); display:block; margin-bottom:6px' })([
        `Choices after last page (${topic.choices.length}) — what the player can do next`,
      ]),
      Stack({ gap: 4 })([
        ...(topic.choices.length === 0
          ? [div({ className: 'gef-empty' })([
              'No choices yet. Preview auto-adds a "Back" button (= exitBack) so the player can leave.',
            ])]
          : topic.choices.map((c, i) => ChoiceEditor({
              choice:     c,
              vars,
              roomOpts,
              topicCtx:   true,
              topicOpts:  topicOpts.filter(o => o.value !== topic.id),
              combatOpts,
              isFirst:    i === 0,
              isLast:     i === topic.choices.length - 1,
              onChange:   next => _setChoice(i, next),
              onDelete:   () => _deleteChoice(i),
              onMoveUp:   () => _moveChoice(i, -1),
              onMoveDown: () => _moveChoice(i,  1),
            }))),
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
          Button({ size: 'sm', variant: 'ghost', onClick: openChoiceGenerator(npc.id)(topic.id), title: 'Map over a list and generate N choices in bulk' })(['✨ Generate from list…']),
        ]),
      ]),
    ]),
  ]);
};

// — NPC editor ————————————————————————————————————————————

const NpcEditor = (npc, project, selectedTopicId) => {
  const vars      = _vars(project);
  const roomOpts  = project.rooms.map(r => ({ value: r.id, label: r.title || r.id }));
  const topicOpts = (npc.topics || []).map(t => ({ value: t.id, label: t.name || t.id }));
  const combatOpts = (project.combats || []).map(c => ({ value: c.id, label: c.name || c.id }));
  const set = patch => _updateNpc(npc.id, patch);

  // Simple-mode page + choice mutators (legacy flat dialogue).
  const _setPage = (i, patch) => _updateNpc(npc.id, n => ({
    ...n,
    pages: n.pages.map((pg, k) => k === i ? { ...pg, ...patch } : pg),
  }));
  const _addPage    = () => _updateNpc(npc.id, n => ({ ...n, pages: [...n.pages, emptyPage()] }));
  const _deletePage = i  => _updateNpc(npc.id, n => {
    const next = n.pages.filter((_, k) => k !== i);
    return { ...n, pages: next.length ? next : [emptyPage()] };
  });
  const _movePage = (i, dir) => _updateNpc(npc.id, n => {
    const j = i + dir;
    if (j < 0 || j >= n.pages.length) return n;
    const pages = [...n.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    return { ...n, pages };
  });

  const _setChoice = (i, next) => _updateNpc(npc.id, n => ({
    ...n,
    choices: n.choices.map((c, k) => k === i ? next : c),
  }));
  const _addChoice    = () => _updateNpc(npc.id, n => ({ ...n, choices: [...n.choices, emptyChoice()] }));
  const _deleteChoice = i  => _updateNpc(npc.id, n => ({ ...n, choices: n.choices.filter((_, k) => k !== i) }));
  const _moveChoice = (i, dir) => _updateNpc(npc.id, n => {
    const j = i + dir;
    if (j < 0 || j >= n.choices.length) return n;
    const choices = [...n.choices];
    [choices[i], choices[j]] = [choices[j], choices[i]];
    return { ...n, choices };
  });

  // Advanced-mode topic mutators.
  const _topics = npc.topics || [];
  const _setTopic = (id, next) => _updateNpc(npc.id, n => ({
    ...n,
    topics: (n.topics || []).map(t => t.id === id ? next : t),
  }));
  const _addTopic = () => {
    const fresh = emptyTopic();
    _updateNpc(npc.id, n => {
      const nextTopics = [...(n.topics || []), fresh];
      // Auto-pick the first topic as entry if none set yet.
      const entryTopicId = n.entryTopicId || fresh.id;
      return { ...n, topics: nextTopics, entryTopicId };
    });
    setState({ selectedTopicId: fresh.id });
  };
  const _deleteTopic = id => _updateNpc(npc.id, n => {
    const next = (n.topics || []).filter(t => t.id !== id);
    const entryTopicId = n.entryTopicId === id ? (next[0]?.id || '') : n.entryTopicId;
    return { ...n, topics: next, entryTopicId };
  });

  const selectedTopic = _topics.find(t => t.id === selectedTopicId) || _topics[0];

  return Stack({ gap: 14 })([
    Card({ title: 'NPC basics' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label:    'ID',
            value:    npc.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === npc.id) return;
              setProject(p => ({
                ...p,
                npcs: p.npcs.map(n => n.id === npc.id ? { ...n, id: safe } : n),
              }));
              setState({ selectedNpcId: safe });
            }),
          }),
          TextInput({
            label:    'Name',
            value:    npc.name,
            onChange: onText(v => set({ name: v })),
          }),
        ]),
        Grid({ cols: 2, gap: 10 })([
          Select({
            label:    'Role',
            options:  ROLE_OPTS,
            value:    npc.role,
            onChange: onText(v => set({ role: v })),
          }),
          AssetInput({
            label:    'Portrait (URL or upload)',
            value:    npc.portrait,
            onChange: v => set({ portrait: v }),
            accept:   'image',
          }),
        ]),
        TextInput({
          label:       'Greeting (shown when NPC is in the player\'s room)',
          value:       npc.greeting,
          onChange:    onText(v => set({ greeting: v })),
          placeholder: 'Eldra the merchant adjusts her wares as you pass.',
        }),
      ]),
    ]),

    Card({ title: `Locations (${npc.locations.length})` })([
      p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
        'Rooms this NPC can appear in. The engine picks one at each world tick.',
      ]),
      LocationsEditor(npc, project),
    ]),

    ...(npc.role === 'shop'
      ? [Card({ title: `Stock (${(npc.shop?.stock || []).length})` })([ShopStockEditor(npc, project)])]
      : []),

    // The toggle — chooses between flat (legacy) and topic tree (advanced).
    ...(npc.role === 'shop' ? [] : [
      Card({ title: 'Conversation system' })([
        div({ style: 'display:flex; align-items:center; gap:14px; flex-wrap:wrap' })([
          Toggle({
            on:       !!npc.advanced,
            onChange: v => set({ advanced: !!v }),
          })(['Advanced conversation (topic tree)']),
          span({ style: 'font-size:12px; color:var(--text-muted); flex:1; min-width:280px' })([
            npc.advanced
              ? 'Greeting pages flow into the entry topic. Topics chain via "change topic"; choices can exit back, to a room, or to combat. Topic data is hidden if you turn this off but never deleted.'
              : 'Simple flat dialogue: pages then choices. The Topics list is hidden and ignored at runtime, but kept in the project file.',
          ]),
        ]),
      ]),
    ]),

    // GREETING PAGES — always shown for dialogue role (becomes "greeting" in advanced
    // mode, "dialogue" in simple mode).
    ...(npc.role === 'shop' ? [] : [
      Card({ title: npc.advanced
        ? `Greeting pages (${npc.pages.length}) — shown before the entry topic`
        : `Dialogue pages (${npc.pages.length})`
      })([
        Stack({ gap: 4 })([
          ...npc.pages.map((pg, i) =>
            PageEditor({
              page:        pg,
              index:       i,
              isLast:      i === npc.pages.length - 1,
              canDelete:   npc.pages.length > 1,
              onChange:    next => _setPage(i, next),
              onDelete:    () => _deletePage(i),
              onMoveUp:    () => _movePage(i, -1),
              onMoveDown:  () => _movePage(i,  1),
            })
          ),
          Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
        ]),
      ]),
    ]),

    // SIMPLE MODE — flat choice list (no flow selector).
    ...((!npc.advanced && npc.role !== 'shop') ? [
      Card({ title: `Choices (${npc.choices.length})` })([
        Stack({ gap: 4 })([
          ...(npc.choices.length === 0
            ? [div({ className: 'gef-empty' })([
                'No choices. A built-in "Goodbye" is auto-added in preview when this list is empty.',
              ])]
            : npc.choices.map((c, i) =>
                ChoiceEditor({
                  choice:     c,
                  vars,
                  roomOpts,
                  topicCtx:   false,
                  isFirst:    i === 0,
                  isLast:     i === npc.choices.length - 1,
                  onChange:   next => _setChoice(i, next),
                  onDelete:   () => _deleteChoice(i),
                  onMoveUp:   () => _moveChoice(i, -1),
                  onMoveDown: () => _moveChoice(i,  1),
                })
              )),
          Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
        ]),
      ]),
    ] : []),

    // ADVANCED MODE — topic tree + entry select + per-topic editor.
    ...((npc.advanced && npc.role !== 'shop') ? [
      Card({ title: `Topic tree (${_topics.length})` })([
        Stack({ gap: 10 })([
          p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
            'Each box is a topic. Solid arrows are ', span({ style: 'font-family:ui-monospace,monospace' })(['change']),
            ' edges (push current topic on the stack, switch to target). Click a topic to edit it below.',
          ]),
          TopicTree(npc, selectedTopic?.id || null),
          div({ style: 'display:flex; gap:10px; align-items:end; flex-wrap:wrap' })([
            div({ style: 'flex:1; min-width:240px' })([
              Select({
                label:    'Entry topic (where the player lands after the greeting pages)',
                options:  [{ value: '', label: '— pick a topic —' }, ...topicOpts],
                value:    npc.entryTopicId || _topics[0]?.id || '',
                onChange: onText(v => set({ entryTopicId: v })),
              }),
            ]),
            Button({ size: 'sm', variant: 'ghost', onClick: _addTopic })(['+ Add topic']),
          ]),
        ]),
      ]),

      ...(selectedTopic
        ? [Card({ title: 'Topic editor' })([
            SingleTopicEditor({
              topic:      selectedTopic,
              npc,
              project,
              vars,
              roomOpts,
              topicOpts,
              combatOpts,
              onChange:   next => _setTopic(selectedTopic.id, next),
              onDelete:   () => { _deleteTopic(selectedTopic.id); setState({ selectedTopicId: null }); },
            }),
          ])]
        : []),
    ] : []),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete NPC "${npc.name || npc.id}"?`)) {
          _deleteNpc(npc.id);
          setState({ selectedNpcId: null, selectedTopicId: null });
        }
      } })(['Delete NPC']),
    ]),
  ]);
};

const NpcsPanel = state => {
  const { project, selectedNpcId, selectedTopicId } = state;
  const selected = project.npcs.find(n => n.id === selectedNpcId) || project.npcs[0];

  return div({})([
    div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
      div({})([NpcList(project, selected?.id)]),
      div({})([
        selected
          ? NpcEditor(selected, project, selectedTopicId || null)
          : div({ className: 'gef-empty' })(['Click "+ Add NPC" to create your first NPC.']),
      ]),
    ]),
    ChoiceGenerator(state),
  ]);
};

export { NpcsPanel };
