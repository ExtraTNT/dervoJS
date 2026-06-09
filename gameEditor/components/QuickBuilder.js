/**
 * QuickBuilder — wizard that scaffolds a base project from a few inputs.
 *
 * Opens from the topbar (New from template). Four MultiStep stages:
 *   1. Meta          — title + intro line
 *   2. Stats         — player stats (key + initial), pre-seeded with hp / gold
 *   3. Items         — list of item NAMES (ids derived from names)
 *   4. Review        — slot name + summary, Finish creates the project
 *
 * The built project has:
 *   - intro    (start scene room — story introduction → "Begin" → home)
 *   - home     (scene room — choices to wardrobe and shop)
 *   - wardrobe (wardrobe room — "Back home")
 *   - shop     (scene room — "Back home", hosts the shopkeeper NPC)
 *   - shopkeeper NPC (role:'shop', locations:['shop'], stock = all items)
 *
 * Curried where possible; pure builder so it can be unit-tested independently.
 */

import { div, span, p, input, textarea, label as lblEl, button } from '../../src/elements.js';
import { FloatingPanel } from '../../src/components/FloatingPanel.js';
import { MultiStep } from '../../src/components/MultiStep.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { setState, newSlot, toast } from '../store.js';
import {
  emptyProject, emptyRoom, emptyWardrobeRoom, emptyInventoryRoom, emptyNpc, emptyItem,
  emptyPage, emptyChoice, emptyEffect, emptyShopEntry, emptyPrice, emptyWidget,
} from '../schema.js';

// ── identifiers ──────────────────────────────────────────────────────────────

const _slug = s => String(s || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Make `seed` unique against `existing` (set of ids) by suffixing _2, _3, …
const _uniqueId = (seed, existing) => {
  let id = seed || 'item';
  let i = 2;
  while (existing.has(id)) { id = `${seed}_${i++}`; }
  return id;
};

// ── default initial form ─────────────────────────────────────────────────────

const defaultValues = () => ({
  title:    'My Adventure',
  intro:    'A long road lies ahead. The first step is yours.',
  stats:    [
    { key: 'hp',   initial: 100 },
    { key: 'gold', initial: 20  },
  ],
  items:    [
    { name: 'Sword' },
    { name: 'Bread' },
    { name: 'Potion' },
  ],
  slotName: '',
});

// ── builder ──────────────────────────────────────────────────────────────────

// Pure: form values → full project. No store side-effects so the builder can
// be exercised in isolation (and the Review step can show the structure
// without committing).
const buildBaseProject = (raw) => {
  const v = { ...defaultValues(), ...(raw || {}) };

  // Items — id derived from name, deduped against itself.
  const itemIds = new Set();
  const items = (v.items || [])
    .map(it => (it && it.name ? it.name.trim() : ''))
    .filter(Boolean)
    .map(name => {
      const id = _uniqueId(`item_${_slug(name) || 'unnamed'}`, itemIds);
      itemIds.add(id);
      const it = emptyItem(id);
      it.name  = name;
      it.kind  = 'misc';
      it.price = emptyPrice('gold', 10);
      it.folder = 'shop';
      return it;
    });

  // Stats — sanitise keys, drop empties, ensure unique. Always keep at least hp.
  const statKeys = new Set();
  const stats = (v.stats || [])
    .map(s => ({
      key:     _slug(s && s.key),
      initial: Number(s && s.initial) || 0,
    }))
    .filter(s => s.key && !statKeys.has(s.key) && (statKeys.add(s.key), true));
  if (!stats.find(s => s.key === 'hp'))   stats.unshift({ key: 'hp',   initial: 100 });
  if (!stats.find(s => s.key === 'gold')) stats.push    ({ key: 'gold', initial: 20  });

  // ── rooms ──
  const intro = emptyRoom('intro');
  intro.title = 'Story Introduction';
  intro.folder = 'story';
  intro.pages[0].text = v.intro || 'Your adventure begins…';
  const introBegin = emptyChoice();
  introBegin.label = 'Begin';
  introBegin.to    = 'home';
  intro.choices = [introBegin];

  const home = emptyRoom('home');
  home.title = 'Home';
  home.folder = 'town';
  home.pages[0].text = 'You stand in your home. Where to?';
  const toWardrobe = emptyChoice();
  toWardrobe.label = 'Open the wardrobe';
  toWardrobe.to    = 'wardrobe';
  const toShop = emptyChoice();
  toShop.label = 'Visit the shop';
  toShop.to    = 'shop';
  home.choices = [toWardrobe, toShop];

  const wardrobe = emptyWardrobeRoom('wardrobe');
  wardrobe.title = 'Wardrobe';
  wardrobe.folder = 'town';
  wardrobe.pages[0].text = 'Try on what you own.';
  const wbBack = emptyChoice();
  wbBack.label = 'Back home';
  wbBack.to    = 'home';
  wardrobe.choices = [wbBack];

  const shop = emptyRoom('shop');
  shop.title = 'Shop';
  shop.folder = 'town';
  shop.pages[0].text = 'A modest counter. The shopkeeper looks up.';
  const shopBack = emptyChoice();
  shopBack.label = 'Back home';
  shopBack.to    = 'home';
  shop.choices = [shopBack];

  // Inventory room — paper-doll's plain counterpart. Reached via the sidebar
  // 🎒 Bag roomLink so the player can open it from anywhere; the "Back"
  // choice pops c.history so it returns to wherever they came from (shop,
  // wardrobe, home, …). Falls back to home if history is somehow empty.
  const inventoryRoom = emptyInventoryRoom('inventory');
  inventoryRoom.title = 'Inventory';
  inventoryRoom.folder = 'town';
  inventoryRoom.pages[0].text = 'You sort through what you carry.';
  const invBack = emptyChoice();
  invBack.label  = 'Back';
  invBack.to     = '';                         // action handles navigation
  invBack.action = {
    ...emptyEffect(),
    mode: 'js',
    body: 'if (c.history && c.history.length) c.back(); else c.goto("home");',
  };
  inventoryRoom.choices = [invBack];

  // ── NPC: shopkeeper ──
  const keeper = emptyNpc('shopkeeper');
  keeper.name      = 'Shopkeeper';
  keeper.role      = 'shop';
  keeper.locations = ['shop'];
  keeper.greeting  = 'Welcome. Have a look — best prices in town.';
  keeper.shop = {
    stock: items.map(it => ({ ...emptyShopEntry(it.id), price: null, quantity: null })),
  };

  // ── sidebar widgets ──
  // Order top→bottom: game title, stats summary, inventory list, then a
  // roomLink button labelled "Bag" that jumps to the inventory room from any
  // scene. Empty `keys` on the stats widget means "show every stat".
  const titleWidget   = { ...emptyWidget('title'),    label: (v.title || '').trim() || 'New Adventure' };
  const statsWidget   = { ...emptyWidget('stats'),    keys: [] };
  const invWidget     = { ...emptyWidget('inventory'), layout: 'list' };
  const bagLink       = { ...emptyWidget('roomLink'), label: 'Bag', roomId: 'inventory', icon: '🎒' };
  const sidebar = { enabled: true, widgets: [titleWidget, statsWidget, invWidget, bagLink] };

  // ── compose against the schema's empty baseline (assets, etc.) ──
  const base = emptyProject();
  return {
    ...base,
    meta: {
      ...base.meta,
      title: (v.title || '').trim() || 'New Adventure',
      start: 'intro',
    },
    stats,
    items,
    rooms: [intro, home, wardrobe, shop, inventoryRoom],
    npcs:  [keeper],
    sidebar,
  };
};

// ── small helpers for the dynamic-list steps ─────────────────────────────────

const _addRow = arr => row => [...(arr || []), row];
const _delRow = arr => i => (arr || []).filter((_, k) => k !== i);
const _patchRow = arr => i => patch => (arr || []).map((r, k) => k === i ? { ...r, ...patch } : r);

// ── step renderers ───────────────────────────────────────────────────────────

const _StepMeta = ({ values, setValue }) =>
  Stack({ gap: 12 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'A title for the project, and the line shown on the very first scene. The intro room will be the player\'s starting point.',
    ]),
    TextInput({
      label:    'Title',
      value:    values.title || '',
      onInput: e => setValue('title', e.target.value),
      placeholder: 'My Adventure',
    }),
    div({ className: 'field' })([
      lblEl({ className: 'field-label' })(['Story introduction']),
      textarea({
        className: 'input',
        rows:      5,
        value:     values.intro || '',
        oninput:   e => setValue('intro', e.target.value),
        placeholder: 'Set the scene in a few lines.',
        style:     'width:100%; min-height:96px; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-family:inherit; font-size:13px; line-height:1.5; resize:vertical',
      })([]),
    ]),
  ]);

const _StepStats = ({ values, setValue }) => {
  const stats = values.stats || [];
  return Stack({ gap: 10 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Player stats. Each becomes ', span({ style: 'font-family:ui-monospace,monospace' })(['state.<key>']),
      ' at runtime. Keys are auto-sanitised (lowercase, _).',
    ]),
    ...stats.map((s, i) =>
      Grid({ cols: 3, gap: 8 })([
        TextInput({
          label:    i === 0 ? 'Key' : '',
          value:    s.key || '',
          onInput: e => setValue('stats', _patchRow(stats)(i)({ key: e.target.value })),
          placeholder: 'hp',
        }),
        NumberInput({
          label:    i === 0 ? 'Initial' : '',
          value:    Number(s.initial) || 0,
          onChange: v => setValue('stats', _patchRow(stats)(i)({ initial: Number(v) || 0 })),
          style:    'justify-self:start',
        }),
        div({ style: 'display:flex; align-items:end' })([
          Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('stats', _delRow(stats)(i)) })(['Remove']),
        ]),
      ]),
    ),
    div({})([
      Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('stats', _addRow(stats)({ key: '', initial: 0 })) })(['+ Add stat']),
    ]),
  ]);
};

const _StepItems = ({ values, setValue }) => {
  const items = values.items || [];
  return Stack({ gap: 10 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Name each item — that\'s all you need. The wizard derives ids and stocks the shopkeeper with the full list at 10 gold each. Tune kinds, prices, and per-item details later in the Items tab.',
    ]),
    ...items.map((it, i) =>
      div({ style: 'display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:end' })([
        TextInput({
          label:    i === 0 ? 'Item name' : '',
          value:    it.name || '',
          onInput:  e => setValue('items', _patchRow(items)(i)({ name: e.target.value })),
          placeholder: 'Sword',
        }),
        Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('items', _delRow(items)(i)) })(['Remove']),
      ]),
    ),
    div({})([
      Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('items', _addRow(items)({ name: '' })) })(['+ Add item']),
    ]),
  ]);
};

const _StepReview = ({ values, setValue }) => {
  const itemCount = (values.items || []).filter(i => i && i.name && i.name.trim()).length;
  const statCount = (values.stats || []).filter(s => s && _slug(s.key)).length;
  const suggestedSlot = values.slotName || _slug(values.title) || `template_${Date.now().toString(36).slice(-4)}`;
  return Stack({ gap: 12 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Pick a slot name. The new project will be created as a fresh slot — your current project stays untouched.',
    ]),
    TextInput({
      label:       'Slot name',
      value:       values.slotName || '',
      onChange:    e => setValue('slotName', e.target.value),
      placeholder: suggestedSlot,
    }),
    Card({ title: 'What will be created' })([
      Stack({ gap: 4 })([
        div({})(['Title: ', span({ style: 'font-weight:600' })([values.title || '(unset)'])]),
        div({})([`Stats: ${statCount} (hp / gold guaranteed)`]),
        div({})([`Items: ${itemCount}`]),
        div({})(['Rooms: ', span({ style: 'font-family:ui-monospace,monospace' })(['intro · home · wardrobe · shop · inventory'])]),
        div({})(['NPCs: 1 shopkeeper (stocks every item)']),
        div({})(['Sidebar: title · stats · inventory · 🎒 Bag button → inventory room']),
      ]),
    ]),
  ]);
};

// ── modal ────────────────────────────────────────────────────────────────────

const _close = () => setState({ quickBuilder: { open: false, idx: 0, values: null } });

const _setIdx = i => setState(s => ({
  quickBuilder: { ...(s.quickBuilder || {}), idx: i },
}));

const _setValues = patch => setState(s => {
  const prev = (s.quickBuilder && s.quickBuilder.values) || defaultValues();
  const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
  return { quickBuilder: { ...(s.quickBuilder || {}), values: next } };
});

const _onDone = ({ values }) => {
  try {
    const project = buildBaseProject(values);
    const slot = (values.slotName || _slug(values.title) || `template_${Date.now().toString(36).slice(-4)}`).trim();
    newSlot(slot, project);
    toast(`Created "${slot}" from template.`);
    _close();
  } catch (e) {
    console.error('[QuickBuilder] build failed', e);
    toast(`Build failed: ${e.message}`, 'error');
  }
};

const openQuickBuilder = () => setState({
  quickBuilder: { open: true, idx: 0, values: defaultValues() },
});

const QuickBuilder = state => {
  const qb = state.quickBuilder || { open: false };
  if (!qb.open) return [];
  const values = qb.values || defaultValues();
  const idx    = qb.idx || 0;

  const _validateMeta  = v => (!v.title || !v.title.trim())
    ? 'Give the project a title.'
    : null;
  const _validateStats = v => {
    const rows = (v.stats || []).filter(s => s.key && s.key.trim());
    if (rows.length === 0) return 'Add at least one stat (use hp / gold as a starting point).';
    return null;
  };
  const _validateItems = v => {
    const rows = (v.items || []).filter(i => i.name && i.name.trim());
    if (rows.length === 0) return 'Add at least one item — the shop needs something to stock.';
    return null;
  };
  const steps = [
    { title: 'Meta',   render: _StepMeta,   validate: _validateMeta  },
    { title: 'Stats',  render: _StepStats,  validate: _validateStats },
    { title: 'Items',  render: _StepItems,  validate: _validateItems },
    { title: 'Review', render: _StepReview },
  ];

  return [FloatingPanel({
    id:       'gef-quickbuilder',
    title:    'Quick Builder — scaffold a base project',
    open:     true,
    onClose:  _close,
    initialX: 120,
    initialY: 80,
    initialW: 640,
    initialH: 620,
  })([
    div({ style: 'padding:14px 18px; overflow-y:auto; height:100%' })([
      MultiStep({
        steps,
        idx,
        setIdx:    _setIdx,
        values,
        setValues: _setValues,
        onDone:    _onDone,
        showValidation: true,
      })([]),
    ]),
  ])];
};

export { QuickBuilder, openQuickBuilder, buildBaseProject };
