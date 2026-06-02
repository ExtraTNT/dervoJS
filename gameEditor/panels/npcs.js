/**
 * NPCs panel — list on the left, NpcEditor on the right.
 *
 * NPCs have a `role`:
 *   - dialogue : Pages of dialogue + final-page Choices (same shape as Rooms).
 *   - shop     : Lists items the NPC sells. The Preview/Codegen layer turns
 *                the stock list into a Shop scene; you don't have to wire up
 *                buy buttons by hand.
 *
 * The dialogue Choices for shop NPCs still apply (e.g. a "Goodbye" choice that
 * goes back to where you were).
 */

import { div, span, h2, p, button } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState } from '../store.js';
import { emptyNpc, emptyPage, emptyChoice, emptyShopEntry } from '../schema.js';
import { onText } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';
import { PageEditor }   from '../components/PageEditor.js';
import { ChoiceEditor } from '../components/ChoiceEditor.js';

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
            onclick:   () => setState({ selectedNpcId: n.id }),
            type:      'button',
          })([
            span({})([n.name || '(unnamed)']),
            Badge({ variant: n.role === 'shop' ? 'yellow' : 'gray' })([n.role]),
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

const NpcEditor = (npc, project) => {
  const vars = _vars(project);
  const roomOpts = project.rooms.map(r => ({ value: r.id, label: r.title || r.id }));
  const set = patch => _updateNpc(npc.id, patch);

  const _setPage = (i, patch) => _updateNpc(npc.id, n => ({
    ...n,
    pages: n.pages.map((p, k) => k === i ? { ...p, ...patch } : p),
  }));
  const _addPage = () => _updateNpc(npc.id, n => ({ ...n, pages: [...n.pages, emptyPage()] }));
  const _deletePage = i => _updateNpc(npc.id, n => {
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

  const _setChoice = (i, patch) => _updateNpc(npc.id, n => ({
    ...n,
    choices: n.choices.map((c, k) => k === i ? (typeof patch === 'function' ? patch(c) : { ...c, ...patch }) : c),
  }));
  const _addChoice = () => _updateNpc(npc.id, n => ({ ...n, choices: [...n.choices, emptyChoice()] }));
  const _deleteChoice = i => _updateNpc(npc.id, n => ({ ...n, choices: n.choices.filter((_, k) => k !== i) }));
  const _moveChoice = (i, dir) => _updateNpc(npc.id, n => {
    const j = i + dir;
    if (j < 0 || j >= n.choices.length) return n;
    const choices = [...n.choices];
    [choices[i], choices[j]] = [choices[j], choices[i]];
    return { ...n, choices };
  });

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

    Card({ title: `Dialogue pages (${npc.pages.length})` })([
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

    Card({ title: `Dialogue choices (${npc.choices.length})` })([
      Stack({ gap: 4 })([
        ...(npc.choices.length === 0
          ? [div({ className: 'gef-empty' })([
              'No dialogue choices. Add at least a "Goodbye" choice (leave "Goes to" empty for default — preview will return to the previous room).',
            ])]
          : npc.choices.map((c, i) =>
              ChoiceEditor({
                choice:     c,
                vars,
                roomOpts,
                isFirst:    i === 0,
                isLast:     i === npc.choices.length - 1,
                onChange:   next => _setChoice(i, () => next),
                onDelete:   () => _deleteChoice(i),
                onMoveUp:   () => _moveChoice(i, -1),
                onMoveDown: () => _moveChoice(i,  1),
              })
            )),
        Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
      ]),
    ]),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete NPC "${npc.name || npc.id}"?`)) {
          _deleteNpc(npc.id);
          setState({ selectedNpcId: null });
        }
      } })(['Delete NPC']),
    ]),
  ]);
};

const NpcsPanel = state => {
  const { project, selectedNpcId } = state;
  const selected = project.npcs.find(n => n.id === selectedNpcId) || project.npcs[0];

  return div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
    div({})([NpcList(project, selected?.id)]),
    div({})([
      selected
        ? NpcEditor(selected, project)
        : div({ className: 'gef-empty' })(['Click "+ Add NPC" to create your first NPC.']),
    ]),
  ]);
};

export { NpcsPanel };
