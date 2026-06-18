/**
 * Tiny turn-based combat module.
 *
 * Combat lives in `state.combat` while active:
 *   { enemyId, enemyHP, defending, log: string[], returnTo: sceneId,
 *     reward: { gold, xp, item?, onWin? } }
 *
 * Engine flow:
 *   startCombat(ctx, enemyId, returnTo, reward?) -> setState({ _scene: 'combat', combat })
 *   The combat scene reads state.combat and renders accordingly.
 *   On victory / defeat / flee -> cleanup + setState({ _scene: returnTo, combat: null }).
 */

import { div, p, span, h2 } from '../src/index.js';
import { Card, Badge, Button, Alert } from '../src/index.js';
import { ITEMS } from './items.js';
import { ENEMIES } from './world.js';

//  pure helpers 

const _rand = n => Math.floor(Math.random() * n);

/** Roll attack damage: STR + weapon damage + 1d4, minus enemy defense, min 1 (or 0 when defending). */
const _rollAttack = (player, weapon, enemy, defending) => {
  const raw = player.STR + (weapon?.damage || 1) + 1 + _rand(4) - enemy.defense;
  return Math.max(1, defending ? Math.floor(raw / 2) : raw);
};

const _rollEnemyAttack = (enemy, defending) => {
  const raw = enemy.attack + _rand(3);
  return Math.max(1, defending ? Math.floor(raw / 2) : raw);
};

const _logLines = (log, max = 5) => log.slice(-max);

//  public: start a fight 

/**
 * @param {object} ctx       - engine ctx
 * @param {string} enemyId   - key in ENEMIES
 * @param {string} returnTo  - scene id to return to on flee/victory/defeat
 * @param {object} [reward]  - { gold?, item?, onWin?(setState), onLose?(setState) }
 */
export const startCombat = (ctx, enemyId, returnTo, reward = {}) => {
  const enemy = ENEMIES[enemyId];
  if (!enemy) return;
  ctx.setState({
    _scene: 'combat',
    combat: {
      enemyId,
      enemyHP:  enemy.hp,
      defending: false,
      log:      [enemy.flavour],
      returnTo,
      reward,
    },
  });
};

//  action handlers 

const _attack = ctx => {
  const c = ctx.state.combat;
  if (!c) return;
  const enemy  = ENEMIES[c.enemyId];
  const weapon = ITEMS[ctx.state.equipped.weapon];
  const dmg    = _rollAttack(ctx.state, weapon, enemy, false);
  const newHP  = c.enemyHP - dmg;
  const log    = [...c.log, `You strike with ${weapon?.name || 'your fists'} for ${dmg}.`];

  if (newHP <= 0) {
    _victory(ctx, [...log, `${enemy.name} falls.`]);
    return;
  }

  // Enemy's turn
  const incoming = _rollEnemyAttack(enemy, c.defending);
  const playerHP = Math.max(0, ctx.state.HP - incoming);
  const log2     = [...log, `${enemy.name} hits you for ${incoming}.`];

  if (playerHP <= 0) {
    _defeat(ctx, log2);
    return;
  }

  ctx.setState({
    HP: playerHP,
    combat: { ...c, enemyHP: newHP, defending: false, log: log2 },
  });
};

const _defend = ctx => {
  const c = ctx.state.combat;
  if (!c) return;
  const enemy    = ENEMIES[c.enemyId];
  const incoming = _rollEnemyAttack(enemy, true);   // halved
  const playerHP = Math.max(0, ctx.state.HP - incoming);
  const log      = [...c.log, `You brace. ${enemy.name} hits for ${incoming} (reduced).`];

  if (playerHP <= 0) {
    _defeat(ctx, log);
    return;
  }
  ctx.setState({
    HP: playerHP,
    combat: { ...c, defending: true, log },
  });
};

const _flee = ctx => {
  const c = ctx.state.combat;
  if (!c) return;
  // 50% + AGI/20 chance to escape
  const chance = 0.5 + (ctx.state.AGI / 20);
  if (Math.random() < chance) {
    ctx.setState({ _scene: c.returnTo, combat: null });
    return;
  }
  // Failed flee - enemy gets a free hit
  const enemy    = ENEMIES[c.enemyId];
  const incoming = _rollEnemyAttack(enemy, false);
  const playerHP = Math.max(0, ctx.state.HP - incoming);
  const log      = [...c.log, `You scramble to flee - ${enemy.name} catches you for ${incoming}.`];
  if (playerHP <= 0) { _defeat(ctx, log); return; }
  ctx.setState({
    HP: playerHP,
    combat: { ...c, log },
  });
};

const _victory = (ctx, log) => {
  const c     = ctx.state.combat;
  const enemy = ENEMIES[c.enemyId];
  const reward = c.reward || {};
  const goldGained = (enemy.gold || 0) + (reward.gold || 0);

  ctx.setState(s => {
    const patch = {
      gold: s.gold + goldGained,
      _scene: c.returnTo,
      combat: null,
    };
    if (reward.item) patch.inventory = [...s.inventory, reward.item];
    if (typeof reward.onWin === 'function') Object.assign(patch, reward.onWin(s) || {});
    return patch;
  });
};

const _defeat = (ctx, log) => {
  const c = ctx.state.combat;
  // Send the player back to the safest place with 1 HP - losing money rather than a hard game-over keeps the demo moving.
  const lostGold = Math.min(ctx.state.gold, 20);
  ctx.setState(s => ({
    HP: 1,
    gold: s.gold - lostGold,
    _scene: 'tavern',     // wake up at the tavern
    combat: null,
  }));
};

//  HP bar 

const _hpBar = (current, max, color = 'var(--accent)', width = 220) => {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return div({ style: `width:${width}px; max-width:100%` })([
    div({ style: 'display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px' })([
      span({})([`${current} / ${max}`]),
    ]),
    div({ style: 'height:8px; background:var(--surface-2); border-radius:4px; overflow:hidden' })([
      div({ style: `width:${pct}%; height:100%; background:${color}; transition:width 200ms ease` })([]),
    ]),
  ]);
};

//  enemy avatar (simple SVG silhouette tinted by enemy.color) 

import { vnode } from '../src/index.js';
const _svg    = props => children => vnode('svg')(props)(children);
const _circle = props => vnode('circle')(props)([]);
const _path   = props => vnode('path')(props)([]);
const _rect   = props => vnode('rect')(props)([]);

const _enemyArt = enemy =>
  _svg({ viewBox: '0 0 120 120', width: 120, height: 120,
    style: 'background:var(--surface-2); border:1px solid var(--border); border-radius:10px' })([
    _circle({ cx: 60, cy: 50, r: 30, fill: enemy.color }),
    _rect({ x: 38, y: 70, width: 44, height: 38, fill: enemy.color, rx: 6 }),
    _circle({ cx: 50, cy: 48, r: 4, fill: '#fff' }),
    _circle({ cx: 70, cy: 48, r: 4, fill: '#fff' }),
    _circle({ cx: 50, cy: 49, r: 1.8, fill: '#000' }),
    _circle({ cx: 70, cy: 49, r: 1.8, fill: '#000' }),
    _path({ d: 'M 48 64 L 52 60 L 56 64 L 60 60 L 64 64 L 68 60 L 72 64',
      stroke: '#222', 'stroke-width': 1.5, fill: 'none' }),
  ]);

//  the combat scene 

export const combatScene = ctx => {
  const c = ctx.state.combat;
  if (!c) {
    // Defensive - render nothing useful, send back to town
    return div({})([
      p({})(['(no fight in progress)']),
      Button({ onClick: () => ctx.goto('town') })(['Return to town']),
    ]);
  }
  const enemy = ENEMIES[c.enemyId];
  const wpn   = ITEMS[ctx.state.equipped.weapon];

  return div({ style: 'max-width:680px; margin:0 auto' })([
    h2({ style: 'margin:0 0 12px' })(['Combat']),

    Card({})([
      div({ style: 'display:flex; gap:16px; align-items:center' })([
        _enemyArt(enemy),
        div({ style: 'flex:1; min-width:0' })([
          div({ style: 'display:flex; align-items:baseline; gap:8px; margin-bottom:6px' })([
            span({ style: 'font-size:16px; font-weight:600' })([enemy.name]),
            Badge({ variant: 'red' })([`ATK ${enemy.attack}`]),
            ...(enemy.defense ? [Badge({ variant: 'gray' })([`DEF ${enemy.defense}`])] : []),
          ]),
          _hpBar(c.enemyHP, enemy.hp, '#e74c3c'),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:12px' })([
      Card({ title: 'You' })([
        div({ style: 'display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap' })([
          _hpBar(ctx.state.HP, ctx.state.maxHP, '#2ecc71'),
          div({ style: 'font-size:12px; color:var(--text-muted)' })([
            `Wielding ${wpn?.name || '???'} (dmg ${wpn?.damage || 1})`,
            ...(c.defending ? [span({ style: 'margin-left:6px; color:var(--accent)' })(['· defending'])] : []),
          ]),
        ]),
      ]),
    ]),

    Card({ title: 'Log', style: 'margin-top:12px' })([
      div({ style: 'font-family:ui-monospace,monospace; font-size:12px; line-height:1.6; max-height:140px; overflow-y:auto' })(
        _logLines(c.log).map(line => div({})([line]))
      ),
    ]),

    div({ style: 'display:flex; gap:8px; margin-top:14px; flex-wrap:wrap' })([
      Button({ variant: 'danger',    onClick: () => _attack(ctx) })(['Attack']),
      Button({ variant: 'secondary', onClick: () => _defend(ctx) })(['Defend']),
      Button({ variant: 'ghost',     onClick: () => _flee(ctx) })(['Flee']),
    ]),
  ]);
};
