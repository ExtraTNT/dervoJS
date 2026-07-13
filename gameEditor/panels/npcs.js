/**
 * NPCs panel - list on the left, NpcEditor on the right.
 *
 * Two conversation systems per NPC, switched by an Advanced toggle:
 *
 *   advanced: false  (default - simple, flat)
 *     Greeting pages + flat Choices, exactly like before. Choice.flow is ignored;
 *     `to` drives navigation. Topics are hidden but preserved.
 *
 *   advanced: true   (topic tree)
 *     Greeting pages → entry topic → sub-topics via `change` flow.
 *     A small SVG tree shows the topology; click a topic node to edit it.
 *     Each topic is itself like a tiny scene (pages + choices), but choices use
 *     the 4-mode flow: change / exitBack / exitRoom / exitCombat.
 *
 * `role: shop` is orthogonal - shops bypass both systems.
 */

import { div, span, h2, h3, p, button } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Select } from '../../src/components/Select.js';
import { Toggle } from '../../src/components/Toggle.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState, updateById } from '../store.js';
import { confirmAction } from '../components/ConfirmDialog.js';
import { emptyNpc, emptyPage, emptyChoice, emptyShopEntry, emptyBuyback, emptyBuybackItem, emptyTopic, emptyNpcVariant, emptyNpcVar } from '../schema.js';
import { onText, projectVars, updateAt, removeAt, swapAt, appendTo } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';
import { PageEditor }     from '../components/PageEditor.js';
import { ChoiceEditor }   from '../components/ChoiceEditor.js';
import { EffectEditor }   from '../components/EffectEditor.js';
import { ConditionEditor } from '../components/ConditionEditor.js';
import { ChoiceGenerator, openChoiceGenerator } from '../components/ChoiceGenerator.js';
import { FolderedList, FolderField, folderSuggestions, groupedOptions } from '../components/FolderedList.js';
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

const _vars = projectVars;

const _updateNpc = updateById('npcs');

const _addNpc = () => setProject(p => ({ ...p, npcs: [...p.npcs, emptyNpc()] }));
const _deleteNpc = id => setProject(p => ({ ...p, npcs: p.npcs.filter(n => n.id !== id) }));
const _toggleLocation = npcId => roomId => _updateNpc(npcId)(n => {
  const has  = n.locations.includes(roomId);
  const next = has ? n.locations.filter(x => x !== roomId) : [...n.locations, roomId];
  return { ...n, locations: next };
});

const _npcRow = selectedId => n =>
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
  ]);

const NpcList = (project, selectedId, collapsed = {}) =>
  Stack({ gap: 4 })([
    h2({ style: 'font-size:14px; margin:0 0 4px' })([`NPCs (${project.npcs.length})`]),
    ...(project.npcs.length === 0
      ? [div({ className: 'gef-empty' })(['No NPCs yet.'])]
      : [FolderedList({
          items:      project.npcs,
          panelKey:   'npcs',
          collapsed,
          renderItem: _npcRow(selectedId),
        })]),
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
        onclick: () => _toggleLocation(npc.id)(r.id),
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
  const _setStock = next => _updateNpc(npc.id)(n => ({ ...n, shop: { ...(n.shop || {}), stock: next } }));

  const statOpts = [{ value: '', label: '(item default)' }, ...project.stats.filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key }))];
  return Stack({ gap: 8 })([
    p({ className: 'gef-hint' })([
      'Items the NPC sells. Leave currency/amount blank to use the item\'s default price; leave quantity blank for infinite.',
    ]),
    ...stock.map((entry, i) => {
      const item       = project.items.find(it => it.id === entry.itemId);
      const itemPrice  = item?.price || { stat: 'gold', amount: 0 };
      const price      = entry.price;     // null = use item default
      // Patcher: setting either side flips the entry from null → { stat, amount }.
      const _patchPrice = patch => _setStock(stock.map((s, k) =>
        k === i ? { ...s, price: { stat: itemPrice.stat, amount: itemPrice.amount, ...(s.price || {}), ...patch } } : s
      ));
      const _clearPrice = () => _setStock(stock.map((s, k) => k === i ? { ...s, price: null } : s));
      return div({ style: 'display:grid; grid-template-columns: 2fr 130px 90px 90px 40px; gap:8px; align-items:end' })([
        Select({
          label:    i === 0 ? 'Item' : '',
          options:  [
            { value: '', label: '- pick -' },
            ...groupedOptions(project.items)(it => ({ value: it.id, label: `${it.name} (${it.id})` })),
          ],
          value:    entry.itemId,
          onChange: onText(v => _setStock(stock.map((s, k) => k === i ? { ...s, itemId: v } : s))),
        }),
        Select({
          label:    i === 0 ? 'Currency' : '',
          options:  statOpts,
          value:    price ? price.stat : '',
          onChange: onText(v => { if (v === '') _clearPrice(); else _patchPrice({ stat: v }); }),
        }),
        TextInput({
          label:    i === 0 ? 'Amount' : '',
          value:    price ? String(price.amount) : '',
          onChange: onText(v => { if (v === '') _clearPrice(); else _patchPrice({ amount: Math.max(0, Number(v) || 0) }); }),
          placeholder: `${itemPrice.amount} ${itemPrice.stat}`,
        }),
        TextInput({
          label:    i === 0 ? 'Qty' : '',
          value:    entry.quantity == null ? '' : String(entry.quantity),
          onChange: onText(v => _setStock(stock.map((s, k) => k === i ? { ...s, quantity: v === '' ? null : Math.max(0, Number(v) || 0) } : s))),
          placeholder: '∞',
        }),
        Button({ size: 'sm', variant: 'ghost', onClick: () => _setStock(stock.filter((_, k) => k !== i)) })(['x']),
      ]);
    }),
    Button({ size: 'sm', variant: 'ghost', onClick: () => _setStock([...stock, emptyShopEntry(project.items[0]?.id || '')]) })(['+ Add stock entry']),
  ]);
};

const BUYBACK_MODE_OPTS = [
  { value: 'none', label: 'none - shop only sells, no buying'   },
  { value: 'open', label: 'open - buy anything in inventory'    },
  { value: 'list', label: 'list - only the specified items'     },
];

// Shop buyback editor - wired to npc.shop.buyback. Mode picks behaviour;
// multiplier is the default fraction of the item's price the shop pays
// (0.8 → sell for 8 gold an item priced at 10). Per-item rows on `list` mode
// can override the multiplier; blank = use the shop default.
const ShopBuybackEditor = (npc, project) => {
  const buyback = npc.shop?.buyback || emptyBuyback();
  const _set = patch => _updateNpc(npc.id)(n => ({
    ...n,
    shop: { ...(n.shop || { stock: [] }), buyback: { ...buyback, ...patch } },
  }));
  const _setItems = items => _set({ items });
  const items = buyback.items || [];

  // Items already in the whitelist - used so the dropdown skips them.
  const taken = new Set(items.map(it => it.itemId).filter(Boolean));
  const remainingOpts = project.items.filter(it => !taken.has(it.id));

  return Stack({ gap: 10 })([
    p({ className: 'gef-hint' })([
      'What the shop will ', span({ style: 'font-weight:600' })(['buy back']), ' from the player. Sell price = ',
      span({ className: 'dv-mono' })(['floor(multiplier x item.price.amount)']),
      ' · paid in the item\'s own price stat.',
    ]),
    Grid({ cols: 2, gap: 10 })([
      Select({
        label:    'Mode',
        options:  BUYBACK_MODE_OPTS,
        value:    buyback.mode || 'none',
        onChange: onText(v => _set({ mode: v })),
      }),
      NumberInput({
        label:    'Default multiplier',
        value:    Number(buyback.multiplier) || 0.8,
        min:      0, max: 10, step: 0.05,
        onChange: v => _set({ multiplier: Math.max(0, Number(v) || 0) }),
      }),
    ]),
    ...(buyback.mode === 'list'
      ? [
          Stack({ gap: 6 })([
            ...(items.length === 0
              ? [div({ className: 'gef-empty' })(['No items whitelisted yet. Add one below.'])]
              : items.map((entry, i) => {
                  const item   = project.items.find(it => it.id === entry.itemId);
                  const price  = item?.price && typeof item.price === 'object'
                    ? { stat: item.price.stat || 'gold', amount: Number(item.price.amount) || 0 }
                    : { stat: 'gold', amount: 0 };
                  const effMul = entry.multiplier == null ? (Number(buyback.multiplier) || 0.8) : Number(entry.multiplier);
                  const pays   = Math.floor(effMul * price.amount);
                  const itemOptsList = [
                    ...(item ? [{ value: item.id, label: `${item.name || item.id} (${item.id})` }] : [{ value: '', label: '- pick item -' }]),
                    ...groupedOptions(project.items.filter(it => it.id !== entry.itemId && !taken.has(it.id)))(it => ({ value: it.id, label: `${it.name || it.id} (${it.id})` })),
                  ];
                  return div({ style: 'display:grid; grid-template-columns: 2fr 120px 1fr 40px; gap:8px; align-items:end' })([
                    Select({
                      label:    i === 0 ? 'Item' : '',
                      options:  itemOptsList,
                      value:    entry.itemId || '',
                      onChange: onText(v => _setItems(items.map((it, k) => k === i ? { ...it, itemId: v } : it))),
                    }),
                    TextInput({
                      label:       i === 0 ? 'Override x' : '',
                      value:       entry.multiplier == null ? '' : String(entry.multiplier),
                      onChange:    onText(v => _setItems(items.map((it, k) => k === i ? { ...it, multiplier: v.trim() === '' ? null : Math.max(0, Number(v) || 0) } : it))),
                      placeholder: String(Number(buyback.multiplier) || 0.8),
                    }),
                    div({ style: 'font-size:11px; color:var(--text-muted); padding-bottom:6px' })([
                      item ? `→ pays ${pays} ${price.stat}` : '(item missing)',
                    ]),
                    Button({ size: 'sm', variant: 'ghost', onClick: () => _setItems(items.filter((_, k) => k !== i)) })(['x']),
                  ]);
                })),
            ...(remainingOpts.length > 0
              ? [Button({
                  size: 'sm', variant: 'ghost',
                  onClick: () => _setItems([...items, emptyBuybackItem(remainingOpts[0].id)]),
                })(['+ Add item'])]
              : [span({ style: 'font-size:11px; color:var(--text-muted)' })(['All items already whitelisted.'])]),
          ]),
        ]
      : []),
    ...(buyback.mode === 'open'
      ? [div({ style: 'font-size:11px; color:var(--text-muted)' })([
          'Every item in the player\'s inventory is eligible at ',
          span({ className: 'dv-mono' })([`x ${Number(buyback.multiplier) || 0.8}`]),
          '. Restock-sensitive items (quests, keys, …) can be excluded by giving them ',
          span({ className: 'dv-mono' })(['kind: \'key\'']),
          ' upstream if you build that convention into your game.',
        ])]
      : []),
  ]);
};

// - Topic-tree SVG view --------------------------------------------

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
      'No topics yet - add one to start mapping the conversation.',
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

// - Single-topic editor (advanced mode) --------------------------------

const SingleTopicEditor = ({ topic, npc, project, vars, roomOpts, topicOpts, combatOpts, onChange, onDelete }) => {
  const set       = patch => onChange({ ...topic, ...patch });
  const _withList = key   => fn => set({ [key]: fn(topic[key] || []) });
  // Deleting the last page would leave an empty list; backfill so the
  // editor always has at least one page to render.
  const _withPages = fn => set({ pages: (out => out.length ? out : [emptyPage()])(fn(topic.pages || [])) });

  const _setPage    = i => patch => _withPages(updateAt(i)(patch));
  const _addPage    = () => _withPages(pages => [...pages, emptyPage()]);
  const _deletePage = i => _withPages(removeAt(i));
  const _movePage   = i => dir => _withPages(swapAt(i)(dir));

  // Default new topic choice = exitBack (the most common case: a "Goodbye" or "Done").
  const _setChoice    = i => next => _withList('choices')(updateAt(i)(next));
  const _addChoice    = () => _withList('choices')(arr => [...arr, { ...emptyChoice(), flow: 'exitBack' }]);
  const _deleteChoice = i => _withList('choices')(removeAt(i));
  const _moveChoice   = i => dir => _withList('choices')(swapAt(i)(dir));

  return Stack({ gap: 12 })([
    div({ style: 'display:flex; align-items:center; gap:8px' })([
      h3({ style: 'margin:0; font-size:14px' })([`Editing topic: ${topic.name || topic.id}`]),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${topic.id.slice(-5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'danger', onClick: () => confirmAction({
        title:        'Delete topic',
        message:      `Delete topic "${topic.name || topic.id}"?`,
        confirmLabel: 'Delete',
        danger:       true,
        onConfirm:    onDelete,
      }) })(['Delete topic']),
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
      rowKey:   `npc:${npc.id}:topic:${topic.id}:onEnter`,
      onChange: v => set({ onEnter: v }),
    }),

    div({})([
      span({ style: 'font-size:12px; color:var(--text-muted); display:block; margin-bottom:6px' })([
        `Pages (${topic.pages.length}) - the dialogue shown when the player is in this topic`,
      ]),
      Stack({ gap: 4 })([
        ...topic.pages.map((pg, i) => PageEditor({
          page:       pg,
          index:      i,
          isLast:     i === topic.pages.length - 1,
          canDelete:  topic.pages.length > 1,
          onChange:   _setPage(i),
          onDelete:   () => _deletePage(i),
          onMoveUp:   () => _movePage(i)(-1),
          onMoveDown: () => _movePage(i)(+1),
        })),
        Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
      ]),
    ]),

    div({})([
      span({ style: 'font-size:12px; color:var(--text-muted); display:block; margin-bottom:6px' })([
        `Choices after last page (${topic.choices.length}) - what the player can do next`,
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
              onChange:   _setChoice(i),
              onDelete:   () => _deleteChoice(i),
              onMoveUp:   () => _moveChoice(i)(-1),
              onMoveDown: () => _moveChoice(i)(+1),
            }))),
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
          Button({ size: 'sm', variant: 'ghost', onClick: openChoiceGenerator(npc.id)(topic.id), title: 'Map over a list and generate N choices in bulk' })(['Generate from list…']),
        ]),
      ]),
    ]),
  ]);
};

// - NPC vars (per-NPC declared state) --------------------------------------
//
// Lives at state.npcVars[npc.id][key] at runtime. Addressable from ANY
// Condition/Effect editor in the project as `npcVars.<npcId>.<key>`, or from
// this NPC's own choices/topics as the portable `npcSelf.<key>` shorthand
// (see ConditionEditor / EffectEditor - resolved to the concrete npcId only
// at preview/export time, so copying a topic to another NPC still points at
// THAT NPC's own vars). One type richer than project Stats: object, for
// freeform relationship/reputation tracking ({ trust: 5, metCount: 2 }).

const _NPC_VAR_TYPE_OPTS = [
  { value: 'number', label: 'number' },
  { value: 'string', label: 'string' },
  { value: 'array',  label: 'array'  },
  { value: 'object', label: 'object' },
];

const _defaultNpcVarInitialFor = type =>
  type === 'string' ? '' : type === 'array' ? [] : type === 'object' ? {} : 0;

// Coerce an editor input to the var's declared type. Comma-split for arrays;
// JSON-parse for objects, falling back to `prev` (not `{}`) on invalid JSON
// so a blur mid-edit can't silently blank out an author's data.
const _coerceNpcVarInitial = (type, prev) => v => {
  if (type === 'number') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  if (type === 'string') return v == null ? '' : String(v);
  if (type === 'object') {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    try {
      const p = JSON.parse(v);
      return (p && typeof p === 'object' && !Array.isArray(p)) ? p : prev;
    } catch (_) { return prev; }
  }
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

/** Type-aware initial input. Objects edit as JSON text; storage stays a plain object. */
const _npcVarInitialInput = (i, setVar) => v => {
  const onCommit = val => setVar(i)({ initial: _coerceNpcVarInitial(v.type, v.initial)(val) });
  if (v.type === 'number') {
    return NumberInput({ label: i === 0 ? 'Initial' : '', value: Number(v.initial) || 0, onChange: onCommit });
  }
  if (v.type === 'string') {
    return TextInput({
      label:       i === 0 ? 'Initial' : '',
      value:       typeof v.initial === 'string' ? v.initial : '',
      onChange:    onText(onCommit),
      placeholder: 'stranger',
    });
  }
  if (v.type === 'object') {
    return TextInput({
      label:       i === 0 ? 'Initial (JSON)' : '',
      value:       JSON.stringify(v.initial ?? {}),
      onChange:    onText(onCommit),
      placeholder: '{"trust": 0}',
    });
  }
  const csv = Array.isArray(v.initial) ? v.initial.join(', ') : '';
  return TextInput({
    label:       i === 0 ? 'Initial (comma-separated)' : '',
    value:       csv,
    onChange:    onText(onCommit),
    placeholder: 'seen, warned',
  });
};

const NpcVarRow = (setVar, delVar) => (v, i) =>
  Grid({ cols: 4, gap: 8 })([
    TextInput({
      label:    i === 0 ? 'Key' : '',
      value:    v.key,
      onChange: onText(key => setVar(i)({ key })),
      placeholder: 'trust',
    }),
    Select({
      label:    i === 0 ? 'Type' : '',
      options:  _NPC_VAR_TYPE_OPTS,
      value:    v.type || 'number',
      // Reset initial on type change - coercion across types (e.g. 5 -> {5:
      // true}) would surprise more often than it would help.
      onChange: onText(type => setVar(i)({ type, initial: _defaultNpcVarInitialFor(type) })),
    }),
    _npcVarInitialInput(i, setVar)(v),
    div({ className: 'gef-row-end' })([
      Button({ variant: 'ghost', size: 'sm', onClick: delVar(i) })(['Remove']),
    ]),
  ]);

const NpcVarsCard = (npc, setNpcVars) => {
  const vars = npc.vars || [];
  const setVar = i => patch => setNpcVars(updateAt(i)(patch));
  const delVar = i => () => setNpcVars(removeAt(i));
  const addVar = () => setNpcVars(appendTo(emptyNpcVar('number')('')));
  return Card({ title: `Vars (${vars.length}) - this NPC's own state` })([
    Stack({ gap: 8 })([
      p({ className: 'gef-hint gef-hint-13' })([
        'Values scoped to THIS npc (', span({ className: 'dv-mono' })(['state.npcVars.' + npc.id]),
        '). Pick "npc (self): <key>" in any Condition/Effect on this NPC\'s own choices/topics, or "npc: ',
        npc.name || npc.id, ' → <key>" from anywhere else in the project (rooms, items, combats, other NPCs). ',
        'Same number/string/array ops as Stats, plus object (', span({ className: 'dv-mono' })(['set / setField / clear']),
        ') for freeform relationship tracking.',
      ]),
      ...(vars.length === 0
        ? [div({ className: 'gef-empty' })(['No vars yet.'])]
        : vars.map(NpcVarRow(setVar, delVar))),
      div({})([
        Button({ size: 'sm', onClick: addVar })(['+ Add var']),
      ]),
    ]),
  ]);
};

// - NPC editor --------------------------------------------

const NpcEditor = (npc, project, selectedTopicId) => {
  // selfNpcId lets ConditionEditor/EffectEditor offer the "this NPC" self
  // shortcut on every nested editor below (simple choices, topic onEnter,
  // topic choices, variant condition) without each one naming npc.id itself.
  const vars      = { ..._vars(project), selfNpcId: npc.id };
  const roomOpts  = groupedOptions(project.rooms)(r => ({ value: r.id, label: `${r.kind === 'story' ? '⭐ ' : ''}${r.title || r.id}` }));
  const topicOpts = (npc.topics || []).map(t => ({ value: t.id, label: t.name || t.id }));
  const combatOpts = (project.combats || []).map(c => ({ value: c.id, label: c.name || c.id }));
  const set = patch => _updateNpc(npc.id)(patch);

  // Curried per-list patcher: `_overList(key)(fn)` runs `fn(currentList)`
  // and stores the result back at npc[key]. Pages get a backfill so the
  // editor never deals with an empty list.
  const _overList  = key => fn => _updateNpc(npc.id)(n => ({ ...n, [key]: fn(n[key] || []) }));
  const _overPages = fn  => _updateNpc(npc.id)(n => {
    const next = fn(n.pages || []);
    return { ...n, pages: next.length ? next : [emptyPage()] };
  });

  // Simple-mode page + choice mutators (legacy flat dialogue).
  const _setPage    = i => patch => _overPages(updateAt(i)(patch));
  const _addPage    = ()         => _overPages(pages => [...pages, emptyPage()]);
  const _deletePage = i          => _overPages(removeAt(i));
  const _movePage   = i => dir   => _overPages(swapAt(i)(dir));

  const _setChoice    = i => next => _overList('choices')(updateAt(i)(next));
  const _addChoice    = ()         => _overList('choices')(arr => [...arr, emptyChoice()]);
  const _deleteChoice = i          => _overList('choices')(removeAt(i));
  const _moveChoice   = i => dir   => _overList('choices')(swapAt(i)(dir));

  // Advanced-mode topic mutators.
  const _topics    = npc.topics || [];
  const _setTopic  = id => next => _overList('topics')(arr => arr.map(t => t.id === id ? next : t));
  const _addTopic  = () => {
    const fresh = emptyTopic();
    _updateNpc(npc.id)(n => ({
      ...n,
      topics:       [...(n.topics || []), fresh],
      // Auto-pick the first topic as entry if none set yet.
      entryTopicId: n.entryTopicId || fresh.id,
    }));
    setState({ selectedTopicId: fresh.id });
  };
  const _deleteTopic = id => _updateNpc(npc.id)(n => {
    const next = (n.topics || []).filter(t => t.id !== id);
    return {
      ...n,
      topics:       next,
      entryTopicId: n.entryTopicId === id ? (next[0]?.id || '') : n.entryTopicId,
    };
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
            label:    'Role (see add components for quest giver / inkeeper)',
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
        TextInput({
          label:       'Interaction button label (blank = "Talk to <name>")',
          value:       npc.interactLabel || '',
          onChange:    onText(v => set({ interactLabel: v })),
          placeholder: 'Use workbench / Read tome / Pray at altar',
        }),
        FolderField({
          id:          `npc-folder-${npc.id}`,
          value:       npc.folder,
          onChange:    v => set({ folder: v }),
          suggestions: folderSuggestions(project.npcs),
        }),
      ]),
    ]),

    NpcVarsCard(npc, _overList('vars')),

    Card({ title: `Locations (${npc.locations.length})` })([
      p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
        'Rooms this NPC can appear in. The engine picks one at each world tick.',
      ]),
      LocationsEditor(npc, project),
    ]),

    ...(npc.role === 'shop'
      ? [
          Card({ title: `Stock (${(npc.shop?.stock || []).length})` })([ShopStockEditor(npc, project)]),
          Card({ title: `Buyback - what the shop buys from the player` })([ShopBuybackEditor(npc, project)]),
        ]
      : []),

    // The toggle - chooses between flat (legacy) and topic tree (advanced).
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

    // GREETING PAGES - always shown for dialogue role (becomes "greeting" in advanced
    // mode, "dialogue" in simple mode).
    ...(npc.role === 'shop' ? [] : [
      Card({ title: npc.advanced
        ? `Greeting pages (${npc.pages.length}) - shown before the entry topic`
        : `Dialogue pages (${npc.pages.length})`
      })([
        Stack({ gap: 4 })([
          ...npc.pages.map((pg, i) =>
            PageEditor({
              page:        pg,
              index:       i,
              isLast:      i === npc.pages.length - 1,
              canDelete:   npc.pages.length > 1,
              onChange:    _setPage(i),
              onDelete:    () => _deletePage(i),
              onMoveUp:    () => _movePage(i)(-1),
              onMoveDown:  () => _movePage(i)(+1),
            })
          ),
          Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
        ]),
      ]),
    ]),

    // SIMPLE MODE - flat choice list (no flow selector).
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
                  onChange:   _setChoice(i),
                  onDelete:   () => _deleteChoice(i),
                  onMoveUp:   () => _moveChoice(i)(-1),
                  onMoveDown: () => _moveChoice(i)(+1),
                })
              )),
          Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
        ]),
      ]),
    ] : []),

    // ADVANCED MODE - topic tree + entry select + per-topic editor.
    ...((npc.advanced && npc.role !== 'shop') ? [
      Card({ title: `Topic tree (${_topics.length})` })([
        Stack({ gap: 10 })([
          p({ className: 'gef-hint' })([
            'Each box is a topic. Solid arrows are ', span({ className: 'dv-mono' })(['change']),
            ' edges (push current topic on the stack, switch to target). Click a topic to edit it below.',
          ]),
          TopicTree(npc, selectedTopic?.id || null),
          div({ style: 'display:flex; gap:10px; align-items:end; flex-wrap:wrap' })([
            div({ style: 'flex:1; min-width:240px' })([
              Select({
                label:    'Entry topic (where the player lands after the greeting pages)',
                options:  [{ value: '', label: '- pick a topic -' }, ...topicOpts],
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
              onChange:   _setTopic(selectedTopic.id),
              onDelete:   () => { _deleteTopic(selectedTopic.id); setState({ selectedTopicId: null }); },
            }),
          ])]
        : []),
    ] : []),

    ...(npc.role === 'shop' ? [] : [VariantsCard({ npc, project, vars })]),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => confirmAction({
        title:        'Delete NPC',
        message:      `Delete NPC "${npc.name || npc.id}"?`,
        confirmLabel: 'Delete',
        danger:       true,
        onConfirm:    () => { _deleteNpc(npc.id); setState({ selectedNpcId: null, selectedTopicId: null }); },
      }) })(['Delete NPC']),
    ]),
  ]);
};

/**
 * Variants: alternate NPC configs gated on state. First-match wins.
 * Empty override fields fall through to the base npc. Reuses
 * ConditionEditor so authors get type-aware ops.
 */
const VariantsCard = ({ npc, project, vars }) => {
  const variants    = npc.variants || [];
  const _overList   = fn => _updateNpc(npc.id)(n => ({ ...n, variants: fn(n.variants || []) }));
  const _setVariant = i => patch => _overList(updateAt(i)(patch));
  const _addVariant = ()         => _overList(arr => [...arr, emptyNpcVariant()]);
  const _delVariant = i          => _overList(removeAt(i));
  const _moveVariant = i => dir  => _overList(swapAt(i)(dir));

  return Card({ title: `Variants (${variants.length}) - react to player state` })([
    Stack({ gap: 10 })([
      p({ className: 'gef-hint' })([
        'Variants override fields on the base NPC when their condition passes (first-match wins). Use this to greet a male player as "sir", swap the portrait when wearing a uniform, or hand the player a different conversation tree if they\'ve completed a quest. Leave an override field blank to inherit from base. For light reactions in greetings/topic text, ',
        span({ className: 'dv-mono' })(['${gender === "male" ? "sir" : "ma\'am"}']),
        ' inside any text also works (the engine interpolates ', span({ className: 'dv-mono' })(['${…}']), ' with state in scope).',
      ]),
      ...variants.map((v, i) => Card({})([
        Stack({ gap: 8 })([
          div({ style: 'display:flex; align-items:center; gap:8px' })([
            Badge({ variant: 'blue' })([`Variant ${i + 1}`]),
            TextInput({
              value:    v.name || '',
              onChange: onText(s => _setVariant(i)({ name: s })),
              placeholder: 'editor label (e.g. "to male player")',
            }),
            div({ style: 'flex:1' })([]),
            Button({ size: 'sm', variant: 'ghost', onClick: () => _moveVariant(i)(-1), disabled: i === 0                  })(['↑']),
            Button({ size: 'sm', variant: 'ghost', onClick: () => _moveVariant(i)(+1), disabled: i === variants.length - 1 })(['↓']),
            Button({ size: 'sm', variant: 'ghost', onClick: () => _delVariant(i) })(['Remove']),
          ]),
          div({})([
            span({ className: 'gef-kbd-label', style: 'display:block; margin-bottom:4px' })(['Apply when']),
            ConditionEditor({
              condition: v.condition,
              vars,
              onChange:  c => _setVariant(i)({ condition: c }),
            }),
          ]),
          Grid({ cols: 2, gap: 8 })([
            TextInput({
              label:    'Override · greeting (blank = base)',
              value:    v.overrides?.greeting || '',
              onChange: onText(s => _setVariant(i)(vv => ({ ...vv, overrides: { ...vv.overrides, greeting: s } }))),
            }),
            AssetInput({
              label:    'Override · portrait (blank = base)',
              value:    v.overrides?.portrait || '',
              onChange: s => _setVariant(i)(vv => ({ ...vv, overrides: { ...vv.overrides, portrait: s } })),
              accept:   'image',
            }),
          ]),
          p({ style: 'margin:4px 0 0; font-size:11px; color:var(--text-muted)' })([
            'Override of pages / topics / choices isn\'t exposed in this minimal UI yet - for whole-conversation swaps, duplicate the NPC and pick at runtime via stat. Greeting + portrait cover most "react to player" cases.',
          ]),
        ]),
      ])),
      Button({ size: 'sm', variant: 'ghost', onClick: _addVariant })(['+ Add variant']),
    ]),
  ]);
};

const NpcsPanel = state => {
  const { project, selectedNpcId, selectedTopicId } = state;
  const selected = project.npcs.find(n => n.id === selectedNpcId) || project.npcs[0];

  return div({})([
    div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
      div({})([NpcList(project, selected?.id, state.collapsedFolders?.npcs || {})]),
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
