/**
 * dervoJS - game widgets.
 *
 * Higher-level building blocks for games on top of `createGame`.
 * Compose these in your sidebar / scenes so almost all the styling lives here.
 *
 *   Stats     - labelled rows with values + bonus + bar
 *   Resources - gold / energy / HP rows (bars when `max` provided)
 *   Inventory - slot-based equip widget; pre-built scene shape
 *   Shop      - buy-from-stock grid; pre-built scene shape
 *
 * Visual treatment uses the `dv-*` utility classes from dervo.css so the
 * reconciler isn't re-writing long inline-style strings every frame. Only
 * truly dynamic bits (bar width, bonus colour) stay inline - and bar width
 * goes through a CSS custom property so the style attr stays short.
 */

import { div, p, span, h2 } from '../elements.js';
import { Card }    from './Card.js';
import { Badge }   from './Badge.js';
import { Button }  from './Button.js';
import { Alert }   from './Alert.js';
import { Stack }   from './Layout.js';

//  shared formatters

const _formatBonuses = bonuses =>
  Object.entries(bonuses || {})
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
    .join(' · ') || '-';

const _capitalise = s => s ? s[0].toUpperCase() + s.slice(1) : '';

const _bar = (pct, color) =>
  div({ className: 'dv-bar-track' })([
    div({
      className: 'dv-bar-fill',
      style: color ? `--dv-pct:${pct}%; --dv-bar:${color}` : `--dv-pct:${pct}%`,
    })([]),
  ]);

//  Stats

/**
 * Stats - render a vertical list of stat rows. Each row shows label,
 * total (base + bonus), with a bar that fills relative to `max`.
 *
 * @param {Object} opts
 * @param {Object<string,number>} opts.values   { STR: 5, INT: 7, ... }
 * @param {Object<string,number>} [opts.bonuses] equipment bonuses, same keys
 * @param {number} [opts.max=25]                bar scales relative to this
 */
const Stats = ({ values = {}, bonuses = {}, max = 25 } = {}) =>
  div({ className: 'game-stats' })(
    Object.entries(values).map(([label, base]) => {
      const bonus = bonuses[label] || 0;
      const total = base + bonus;
      const pct   = Math.min(100, Math.max(0, (total / max) * 100));
      const bonusClr = bonus > 0 ? '#2ecc71' : '#e74c3c';
      return div({ className: 'dv-mb-8' })([
        div({ className: 'dv-flex-between dv-fs-12 dv-mb-4', style: 'align-items:baseline' })([
          span({ style: 'font-weight:600; letter-spacing:.04em' })([label]),
          span({ className: 'dv-mono dv-fs-13' })([
            String(total),
            ...(bonus ? [span({
              className: 'dv-fs-11',
              style: `margin-left:6px; color:${bonusClr}`,
            })([`(${base}${bonus > 0 ? '+' : ''}${bonus})`])] : []),
          ]),
        ]),
        _bar(pct),
      ]);
    }),
  );

//  Resources

/**
 * Resources - list of resource rows. Items with `max` get a bar (HP, energy);
 * items without get a simple `label · value[suffix]` line (gold, gems).
 *
 * @param {Array<Object>} items
 *   { label, value, max?, suffix?, color? }
 */
const Resources = (items = []) =>
  div({ className: 'game-resources dv-flex-col dv-gap-8' })(
    items.map(item => item.max != null ? _resBar(item) : _resLine(item))
  );

const _resLine = ({ label, value, suffix = '' }) =>
  div({ className: 'dv-flex-between dv-fs-12' })([
    span({ className: 'dv-muted' })([label]),
    span({ className: 'dv-mono' })([`${value}${suffix}`]),
  ]);

const _resBar = ({ label, value, max, color }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return div({})([
    div({ className: 'dv-flex-between dv-fs-12', style: 'margin-bottom:2px' })([
      span({ className: 'dv-muted' })([label]),
      span({ className: 'dv-mono' })([`${value}/${max}`]),
    ]),
    _bar(pct, color),
  ]);
};

//  Inventory (wardrobe)

/**
 * Inventory - slot-based equip scene. One Card per slot; lists currently
 * equipped item plus a button per owned-but-unequipped item in that slot.
 *
 * @param {Object} opts
 * @param {Object} opts.ctx                      engine ctx (scene receives this)
 * @param {Object} opts.items                    catalogue: id -> { name, slot, bonuses, damage? }
 * @param {string[]} [opts.slots]                slot ids to render in order. Defaults to slots present in catalogue.
 * @param {string} [opts.title='Inventory']
 * @param {string} [opts.returnTo]               id of "back" scene; renders ← Back button when set
 * @param {string} [opts.equippedKey='equipped'] state key holding the equipped map
 * @param {string} [opts.inventoryKey='inventory'] state key holding owned-item ids
 */
const Inventory = ({
  ctx, items, slots, title = 'Inventory', returnTo,
  equippedKey = 'equipped', inventoryKey = 'inventory',
} = {}) => {
  const { state, setState, goto } = ctx;
  const allSlots = slots || _uniqueSlots(items, state[inventoryKey]);

  const equip   = id   => setState(s => {
    const it = items[id];
    return it ? { [equippedKey]: { ...s[equippedKey], [it.slot]: id } } : {};
  });
  const unequip = slot => setState(s => ({ [equippedKey]: { ...s[equippedKey], [slot]: null } }));

  return div({})([
    h2({ className: 'dv-mb-12', style: 'margin-top:0' })([title]),
    Stack({ gap: 12 })(allSlots.map(slot => _slotCard(slot, state, items, equip, unequip, equippedKey, inventoryKey))),
    ...(returnTo ? [div({ className: 'dv-mt-12' })([
      Button({ variant: 'ghost', onClick: () => goto(returnTo) })(['← Back']),
    ])] : []),
  ]);
};

const _uniqueSlots = (items, ownedIds = []) =>
  [...new Set(ownedIds.map(id => items[id]?.slot).filter(Boolean))];

const _itemMeta = item =>
  [_formatBonuses(item.bonuses), item.damage ? `dmg ${item.damage}` : null]
    .filter(Boolean).join(' · ');

const _slotCard = (slot, state, items, equip, unequip, equippedKey, inventoryKey) => {
  const equippedId = state[equippedKey]?.[slot];
  const owned      = (state[inventoryKey] || []).map(id => items[id]).filter(it => it && it.slot === slot);
  return Card({ title: _capitalise(slot) })([
    div({ className: 'dv-fs-13 dv-muted dv-mb-8' })([
      'Equipped: ',
      span({ style: 'color:var(--text)' })([equippedId ? items[equippedId].name : '(nothing)']),
      ...(equippedId ? [span({ className: 'dv-fs-11', style: 'margin-left:8px' })([`(${_itemMeta(items[equippedId])})`])] : []),
    ]),
    div({ className: 'dv-flex-row dv-gap-6', style: 'flex-wrap:wrap' })([
      ...(equippedId
        ? [Button({ variant: 'ghost', size: 'sm', onClick: () => unequip(slot) })(['Unequip'])]
        : []),
      ...owned.filter(it => it.id !== equippedId).map(it =>
        Button({ variant: 'secondary', size: 'sm', onClick: () => equip(it.id) })([
          it.name,
          span({ className: 'dv-fs-11', style: 'margin-left:6px; opacity:.65' })([`(${_itemMeta(it)})`]),
        ])
      ),
      ...(owned.length === 0
        ? [span({ className: 'dv-fs-12 dv-muted' })(['No items in this slot.'])]
        : []),
    ]),
  ]);
};

//  Shop

/**
 * Shop - buy-from-stock scene. Items grouped by slot; each card shows
 * the name + bonuses + price + Buy button (auto-disabled when broke).
 *
 * @param {Object} opts
 * @param {Object} opts.ctx
 * @param {Object} opts.items                    catalogue
 * @param {string} [opts.title='Shop']
 * @param {string} [opts.returnTo]
 * @param {string} [opts.stockKey='shopStock']   state key holding stock ids
 * @param {string} [opts.goldKey='gold']         state key holding currency
 * @param {string} [opts.inventoryKey='inventory']
 * @param {string} [opts.currencySuffix='g']
 */
const Shop = ({
  ctx, items, title = 'Shop', returnTo,
  stockKey = 'shopStock', goldKey = 'gold', inventoryKey = 'inventory',
  currencySuffix = 'g',
} = {}) => {
  const { state, setState, goto } = ctx;

  const buy = id => setState(s => {
    const item = items[id];
    if (!item || s[goldKey] < item.price) return {};
    return {
      [goldKey]:      s[goldKey] - item.price,
      [inventoryKey]: [...(s[inventoryKey] || []), id],
      [stockKey]:     s[stockKey].filter(x => x !== id),
    };
  });

  const slots = [..._uniqueSlots(items, state[stockKey])];
  const grouped = slots.map(slot => ({
    slot,
    rows: state[stockKey].map(id => items[id]).filter(it => it && it.slot === slot),
  })).filter(g => g.rows.length);

  return div({})([
    h2({ style: 'margin:0 0 4px' })([title]),
    p({ className: 'dv-muted dv-mono dv-fs-13', style: 'margin:0 0 14px' })([
      `Gold: ${state[goldKey]}${currencySuffix}`,
    ]),
    ...(grouped.length === 0
      ? [Alert({ variant: 'info' })(["Nothing left in stock."])]
      : grouped.map(group => div({ style: 'margin-bottom:18px' })([
          div({ className: 'dv-fs-11', style: 'font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-subtle); margin:0 0 8px' })([group.slot]),
          div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px' })(
            group.rows.map(item => _shopCard(item, state[goldKey], buy, currencySuffix))
          ),
        ]))),
    ...(returnTo ? [div({ className: 'dv-mt-8' })([
      Button({ variant: 'ghost', onClick: () => goto(returnTo) })(['← Back']),
    ])] : []),
  ]);
};

const _shopCard = (item, gold, buy, suffix) => Card({})([
  div({ className: 'dv-flex-row dv-gap-8', style: 'justify-content:space-between; align-items:flex-start' })([
    div({ style: 'min-width:0' })([
      div({ style: 'font-weight:600' })([item.name]),
      div({ className: 'dv-fs-11 dv-muted dv-mt-4' })([_itemMeta(item)]),
    ]),
    Badge({ variant: 'yellow' })([`${item.price}${suffix}`]),
  ]),
  div({ className: 'dv-mt-8' })([
    Button({
      size: 'sm',
      disabled: gold < item.price,
      onClick:  () => buy(item.id),
    })([gold < item.price ? 'Not enough gold' : 'Buy']),
  ]),
]);

export { Stats, Resources, Inventory, Shop };
