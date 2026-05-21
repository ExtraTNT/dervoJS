/**
 * Layered SVG character renderer + sidebar.
 *
 * The drawing primitives live here; the sidebar widget composes the
 * character with the engine's Stats / Resources helpers.
 *
 * Drawing order (back -> front):
 *   skin -> pants -> shirt + sleeves -> weapon -> head -> hair -> eyes/mouth -> hat
 *
 * HP-driven expression:
 *   HP > 70%  -> smile, normal skin
 *   HP 30-70% -> flat mouth
 *   HP < 30%  -> wince, paler skin, sweat drop
 */

import { vnode } from '../src/index.js';
import { Stats, Resources } from '../src/index.js';
import { ITEMS, equipmentBonuses } from './items.js';

//  SVG helpers 

const _svg    = props => children => vnode('svg')(props)(children);
const _g      = props => children => vnode('g')(props)(children);
const _rect   = props => vnode('rect')(props)([]);
const _circle = props => vnode('circle')(props)([]);
const _path   = props => vnode('path')(props)([]);

//  palette 

const SKIN     = '#f3c79c';
const SKIN_LO  = '#d8b39a';
const HAIR     = '#5a3a1f';
const SHOE     = '#1f1f1f';
const SHIRT    = '#7f8c8d';
const PANTS    = '#34495e';

//  hat shapes 

const _hatCap = c => _g({})([
  _rect({ x: 65, y: 55, width: 70, height: 10, fill: c, rx: 2 }),
  _rect({ x: 72, y: 38, width: 56, height: 20, fill: c, rx: 5 }),
]);
const _hatHood = c => _path({
  d: 'M 64 95 Q 64 35 100 35 Q 136 35 136 95 L 128 95 Q 128 50 100 50 Q 72 50 72 95 Z',
  fill: c,
});
const _hatCrown = c => _g({})([
  _path({ d: 'M 68 60 L 75 32 L 88 52 L 100 28 L 112 52 L 125 32 L 132 60 Z',
    fill: c, stroke: '#7a5a10', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }),
  _circle({ cx: 100, cy: 36, r: 3, fill: '#e74c3c' }),
]);

const _hat = h =>
    h.kind === 'crown' ? _hatCrown(h.color)
  : h.kind === 'hood'  ? _hatHood(h.color)
                       : _hatCap(h.color);

//  weapon shapes (held in right hand) 

const _weapon = w => {
  if (!w || w.kind === 'fist') return null;
  if (w.kind === 'club') return _g({})([
    _rect({ x: 168, y: 130, width: 5, height: 60, fill: w.color, rx: 1 }),
    _circle({ cx: 170, cy: 188, r: 8, fill: w.color }),
  ]);
  if (w.kind === 'sword') return _g({})([
    _rect({ x: 169, y: 95,  width: 4,  height: 70, fill: w.color }),
    _rect({ x: 161, y: 162, width: 20, height: 4,  fill: '#7d6336' }),
    _rect({ x: 167, y: 165, width: 8,  height: 14, fill: '#5a3a1f', rx: 2 }),
  ]);
  if (w.kind === 'staff') return _g({})([
    _rect({ x: 168, y: 95, width: 5, height: 100, fill: w.color, rx: 1 }),
    _circle({ cx: 170, cy: 92, r: 7, fill: '#3498db', stroke: '#2c3e50', 'stroke-width': 1.5 }),
  ]);
  return null;
};

//  expression by HP% 

const _mouth = pct =>
    pct > 0.70 ? 'M 92 92 Q 100 96 108 92'
  : pct > 0.30 ? 'M 92 94 L 108 94'
               : 'M 92 96 Q 100 90 108 96';

//  the character 

/**
 * @param {Object} equipped  { hat, shirt, pants, weapon } — item ids or null
 * @param {Object} [stats]   { HP, maxHP } — drives expression / colour
 */
export const Character = (equipped, stats = {}) => {
  const hat    = ITEMS[equipped.hat];
  const shirt  = ITEMS[equipped.shirt];
  const pants  = ITEMS[equipped.pants];
  const weapon = ITEMS[equipped.weapon];

  const shirtC = shirt ? shirt.color : SHIRT;
  const pantsC = pants ? pants.color : PANTS;
  const hpPct  = stats.maxHP ? stats.HP / stats.maxHP : 1;
  const skin   = hpPct < 0.30 ? SKIN_LO : SKIN;
  const wpn    = _weapon(weapon);

  return _svg({
    viewBox: '0 0 200 320',
    width: 160, height: 256,
    style: 'display:block; margin:0 auto; background:linear-gradient(180deg, transparent 0%, var(--surface-2) 100%); border-radius:10px; border:1px solid var(--border)',
  })([
    _rect({ x: 70,  y: 248, width: 25, height: 36, fill: skin, rx: 3 }),
    _rect({ x: 105, y: 248, width: 25, height: 36, fill: skin, rx: 3 }),
    _rect({ x: 67,  y: 280, width: 31, height: 12, fill: SHOE, rx: 3 }),
    _rect({ x: 102, y: 280, width: 31, height: 12, fill: SHOE, rx: 3 }),
    _rect({ x: 60,  y: 180, width: 80, height: 75, fill: pantsC, rx: 8 }),
    _rect({ x: 65,  y: 230, width: 30, height: 28, fill: pantsC, rx: 3 }),
    _rect({ x: 105, y: 230, width: 30, height: 28, fill: pantsC, rx: 3 }),
    _rect({ x: 28,  y: 120, width: 22, height: 70, fill: skin, rx: 8 }),
    _rect({ x: 150, y: 120, width: 22, height: 70, fill: skin, rx: 8 }),
    ...(wpn ? [wpn] : []),
    _rect({ x: 55,  y: 115, width: 90, height: 78, fill: shirtC, rx: 8 }),
    _rect({ x: 28,  y: 115, width: 22, height: 32, fill: shirtC, rx: 8 }),
    _rect({ x: 150, y: 115, width: 22, height: 32, fill: shirtC, rx: 8 }),
    _rect({ x: 90,  y: 104, width: 20, height: 14, fill: skin }),
    _circle({ cx: 100, cy: 75, r: 32, fill: skin }),
    _path({ d: 'M 70 65 Q 100 30 130 65 Q 130 52 100 48 Q 70 52 70 65 Z', fill: HAIR }),
    _circle({ cx: 90,  cy: 78, r: 2.6, fill: '#222' }),
    _circle({ cx: 110, cy: 78, r: 2.6, fill: '#222' }),
    _path({ d: _mouth(hpPct), stroke: '#222', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }),
    ...(hpPct < 0.30
      ? [_path({ d: 'M 128 70 Q 132 78 128 82 Q 124 78 128 70 Z', fill: '#3498db', opacity: 0.85 })]
      : []),
    ...(hat ? [_hat(hat)] : []),
  ]);
};

//  sidebar (composes engine widgets) 

export const Sidebar = ctx => [
  Character(ctx.state.equipped, { HP: ctx.state.HP, maxHP: ctx.state.maxHP }),
  Stats({
    values:  { STR: ctx.state.STR, AGI: ctx.state.AGI, INT: ctx.state.INT, CHA: ctx.state.CHA },
    bonuses: equipmentBonuses(ctx.state.equipped),
  }),
  Resources([
    { label: 'HP',     value: ctx.state.HP,     max: ctx.state.maxHP, color: '#e74c3c' },
    { label: 'Energy', value: ctx.state.energy, max: ctx.state.maxEnergy },
    { label: 'Gold',   value: ctx.state.gold,   suffix: 'g' },
  ]),
];
