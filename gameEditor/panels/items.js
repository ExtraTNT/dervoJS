/**
 * Items panel — catalogue of items. Two columns: list on the left, editor on
 * the right. Items are referenced from NPC shops and from Choice
 * conditions/effects (hasItem, give/take).
 */

import { div, span, h2, p, button, textarea } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState } from '../store.js';
import { emptyItem } from '../schema.js';
import { onText } from '../helpers.js';
import { EffectEditor } from '../components/EffectEditor.js';
import { AssetInput }   from '../components/AssetInput.js';

const KIND_OPTS = [
  { value: 'misc',       label: 'Miscellaneous' },
  { value: 'consumable', label: 'Consumable'    },
  { value: 'equipment',  label: 'Equipment'     },
  { value: 'readable',   label: 'Readable (book / note)' },
  { value: 'key',        label: 'Key item'      },
];

const _vars = project => ({
  stats:   project.stats.map(s => s.key).filter(Boolean),
  flags:   project.flags.map(f => f.key).filter(Boolean),
  items:   project.items,
  skills:  project.skills || [],
  npcs:    project.npcs   || [],
  rooms:   project.rooms,
  combats: project.combats || [],
});

const _updateItem = (id, patch) => setProject(p => ({
  ...p,
  items: p.items.map(it => it.id === id ? { ...it, ...patch } : it),
}));

const _addItem = () => setProject(p => {
  const it = emptyItem();
  return { ...p, items: [...p.items, it] };
});

const _deleteItem = id => setProject(p => {
  const items = p.items.filter(it => it.id !== id);
  // Sweep NPC shop stock referencing this item
  const npcs = p.npcs.map(n => ({
    ...n,
    shop: { ...(n.shop || { stock: [] }), stock: (n.shop?.stock || []).filter(s => s.itemId !== id) },
  }));
  return { ...p, items, npcs };
});

const ItemRow = (it, selectedId) =>
  button({
    className: `gef-list-btn${it.id === selectedId ? ' active' : ''}`,
    onclick:   () => setState({ selectedItemId: it.id }),
    type:      'button',
  })([
    span({})([it.name || '(unnamed)']),
    Badge({ variant: 'gray' })([it.kind]),
    span({ className: 'gef-id' })([it.id]),
  ]);

const ItemEditor = (item, project) => {
  const set = patch => _updateItem(item.id, patch);
  return Stack({ gap: 14 })([
    Card({ title: 'Item' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label:    'ID (used in code)',
            value:    item.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === item.id) return;
              setProject(p => {
                const items = p.items.map(it => it.id === item.id ? { ...it, id: safe } : it);
                const npcs  = p.npcs.map(n => ({
                  ...n,
                  shop: { ...(n.shop || { stock: [] }),
                    stock: (n.shop?.stock || []).map(s => s.itemId === item.id ? { ...s, itemId: safe } : s) },
                }));
                return { ...p, items, npcs };
              });
              setState({ selectedItemId: safe });
            }),
          }),
          TextInput({
            label:    'Name (shown in-game)',
            value:    item.name,
            onChange: onText(v => set({ name: v })),
          }),
        ]),
        Select({
          label:    'Kind',
          options:  KIND_OPTS,
          value:    item.kind,
          onChange: onText(v => set({ kind: v })),
        }),
        // Default price = a stat key (any currency: gold / silver / gems / …)
        // + an amount. Shop entries can override per stock row.
        Grid({ cols: 2, gap: 10 })([
          Select({
            label:    'Default price · currency stat',
            options:  [{ value: '', label: '— pick stat —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
            value:    item.price?.stat || 'gold',
            onChange: onText(v => set({ price: { ...(item.price || {}), stat: v || 'gold', amount: Number(item.price?.amount) || 0 } })),
          }),
          NumberInput({
            label:    `Default price · amount (${item.price?.stat || 'gold'})`,
            value:    Number(item.price?.amount) || 0,
            min:      0,
            onChange: v => set({ price: { ...(item.price || {}), stat: item.price?.stat || 'gold', amount: Math.max(0, Number(v) || 0) } }),
          }),
        ]),
        AssetInput({
          label:       'Image (URL or upload)',
          value:       item.image,
          onChange:    v => set({ image: v }),
          accept:      'image',
          placeholder: 'https://… or click Upload',
        }),
        TextInput({
          label:       'Description',
          value:       item.description,
          onChange:    onText(v => set({ description: v })),
          placeholder: 'A short flavour line.',
        }),
      ]),
    ]),

    ...(item.kind === 'consumable'
      ? [Card({ title: 'On use (consumable)' })([
          Stack({ gap: 8 })([
            p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
              'Fires when the player clicks Use in an inventory room. The item is decremented by 1 automatically; you don\'t need to add an inv.take op.',
            ]),
            EffectEditor({
              effect:   item.useEffect,
              vars:     _vars(project),
              label:    'Effect when used',
              onChange: v => set({ useEffect: v }),
            }),
          ]),
        ])]
      : []),

    ...(item.kind === 'readable'
      ? [Card({ title: 'Reading content' })([
          Stack({ gap: 8 })([
            p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
              'Shown when the player clicks Read in an inventory room. Plain text — line breaks preserved. ',
              'For multi-page books just split into paragraphs; the reader is one scrollable view.',
            ]),
            textarea({
              value: item.text,
              oninput: e => set({ text: e.target.value }),
              rows: 8,
              spellcheck: true,
              style: 'width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-family:inherit; font-size:14px; line-height:1.5; resize:vertical',
              placeholder: 'The first pages are stained with age, but you can still read…',
            })([]),
          ]),
        ])]
      : []),

    ...(item.kind === 'equipment'
      ? [Card({ title: 'Equipment slot' })([
          Stack({ gap: 8 })([
            TextInput({
              label:       'Slot key',
              value:       item.equipSlot,
              onChange:    onText(v => set({ equipSlot: v.replace(/[^a-zA-Z0-9_]/g, '_') })),
              placeholder: 'weapon · armor · head · ring',
            }),
            p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
              'Equipping replaces whatever was in this slot. Lives at ',
              span({ style: 'font-family:ui-monospace,monospace' })(['state.equipped[slot] = itemId']),
              '. Portrait layer bindings see equipped items first, then anything else in inventory.',
            ]),
          ]),
        ])]
      : []),

    Card({ title: 'Usage' })([
      p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
        'Reference this item from any Choice Action — pick "Item" as the target, then "give" or "take". ',
        'NPCs with role "shop" can sell it from their stock. Inventory rooms surface Use / Read / Equip buttons based on kind.',
      ]),
    ]),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete item "${item.name || item.id}"? It will be removed from any NPC shop stock.`)) {
          _deleteItem(item.id);
          setState({ selectedItemId: null });
        }
      } })(['Delete item']),
    ]),
  ]);
};

const ItemsPanel = state => {
  const { project, selectedItemId } = state;
  const selected = project.items.find(it => it.id === selectedItemId) || project.items[0];

  return div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
    div({})([
      Stack({ gap: 4 })([
        h2({ style: 'font-size:14px; margin:0 0 4px' })([`Items (${project.items.length})`]),
        ...(project.items.length === 0
          ? [div({ className: 'gef-empty' })(['No items yet.'])]
          : project.items.map(it => ItemRow(it, selected?.id))),
        Button({ size: 'sm', variant: 'ghost', onClick: _addItem, style: 'margin-top:8px' })(['+ Add item']),
      ]),
    ]),
    div({})([
      selected
        ? ItemEditor(selected, project)
        : div({ className: 'gef-empty' })(['Create your first item with "+ Add item".']),
    ]),
  ]);
};

export { ItemsPanel };
