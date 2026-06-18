/**
 * Theme panel - designs the GAME's theme.
 *
 * Token overrides + custom CSS are written into the active project and baked
 * into the exported game by codegen. They also paint the running editor (since
 * editor + game share the same CSS-variable system) - that's a side-effect,
 * not the goal.
 *
 * The live preview runs an actual mini-game inside a small windowed pane,
 * using the SAME pipeline the Preview tab and the export use (buildGameConfig
 * → createGame → mount). When tokens or custom CSS change, the mini-game
 * repaints via the browser's CSS-custom-property cascade - no rebuild needed.
 */

import {
  div, span, strong, p, button, input as inp, textarea,
  Card, Stack, Divider, Badge,
  tokens,
} from '../../src/index.js';
import { createGame } from '../../src/game.js';
import { setState, setProject, getState } from '../store.js';
import { confirmAction } from '../components/ConfirmDialog.js';
import { buildGameConfig } from '../preview.js';

const _defaults = theme => (theme === 'dark' ? tokens.dark : tokens.light);

const HEX_GROUPS = [
  { label: 'Accent',   keys: ['accent', 'accent-hover', 'accent-ring'] },
  { label: 'Surfaces', keys: ['bg', 'surface', 'surface-2', 'border', 'border-2'] },
  { label: 'Text',     keys: ['text', 'text-muted', 'text-subtle'] },
  { label: 'Danger',   keys: ['danger', 'danger-bg', 'danger-text', 'danger-border'] },
  { label: 'Success',  keys: ['success', 'success-bg', 'success-text', 'success-border'] },
  { label: 'Warning',  keys: ['warning', 'warning-bg', 'warning-text', 'warning-border'] },
  { label: 'Info',     keys: ['info', 'info-bg', 'info-text', 'info-border'] },
];

const TEXT_GROUPS = [
  { label: 'Shape',       keys: ['radius', 'radius-lg'] },
  { label: 'Font stacks', keys: ['font-sans', 'font-mono'] },
];

const _isHex  = v => /^#[0-9a-fA-F]{6}$/.test((v || '').trim());
const _isRGBA = v => /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test((v || '').trim());

// ─── Per-project mutation helpers ───────────────────────────────────────

const _setOverride = key => value => setProject(p => ({
  ...p,
  meta: { ...p.meta, themeOverrides: { ...(p.meta.themeOverrides || {}), [key]: value } },
}));
const _clearOverride = key => setProject(p => {
  const next = { ...(p.meta.themeOverrides || {}) };
  delete next[key];
  return { ...p, meta: { ...p.meta, themeOverrides: next } };
});
const _resetAllOverrides = () => setProject(p => ({
  ...p, meta: { ...p.meta, themeOverrides: {} },
}));

// ─── Token row + group card ─────────────────────────────────────────────

const _tokenRow = defaults => overrides => key => {
  const val     = overrides[key] ?? defaults[key] ?? '';
  const changed = key in overrides;
  const hex     = _isHex(val);
  const rgba    = _isRGBA(val);
  return div({ style: 'display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid var(--border-2)' })([
    div({ style: `width:18px; height:18px; border-radius:3px; flex-shrink:0; background:${val}; border:1px solid var(--border)` })([]),
    span({ style: `font-family:ui-monospace,monospace; font-size:11px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${changed ? 'var(--accent)' : 'var(--text-muted)'}` })([`--${key}`]),
    ...(changed
      ? [button({
          type: 'button',
          title: 'Clear override (use default)',
          onclick: () => _clearOverride(key),
          style: 'border:none; background:none; cursor:pointer; color:var(--text-muted); font-size:11px; line-height:1; padding:2px 4px',
        })(['x'])]
      : []),
    inp({
      type:  (hex || rgba) ? 'color' : 'text',
      value: val,
      style: (hex || rgba)
        ? 'width:26px; height:22px; padding:1px 2px; border:1px solid var(--border); border-radius:3px; cursor:pointer; flex-shrink:0; background:none'
        : 'width:120px; font-family:ui-monospace,monospace; font-size:10px; padding:2px 6px; border:1px solid var(--border); border-radius:3px; background:var(--surface); color:var(--text); flex-shrink:0',
      oninput: e => {
        const v = e.target.value;
        if (!v) return;
        _setOverride(key)(v);
      },
    })([]),
  ]);
};

const _groupCard = defaults => overrides => group =>
  div({ style: 'background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; display:flex; flex-direction:column; gap:0' })([
    strong({ style: 'font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-subtle); display:block; margin-bottom:6px' })([group.label]),
    ...group.keys.map(_tokenRow(defaults)(overrides)),
  ]);

// ─── Live mini-game window ──────────────────────────────────────────────
//
// A representative tiny project - exercises Scene, NPC dialogue (with topics),
// and combat - so every game surface paints with the current theme + custom
// CSS. Built once at module load; the engine handles its own state.

// ─── Mini-game project ──────────────────────────────────────────────────
//
// Touches every game surface the editor can produce, so every theme token
// and custom CSS rule has somewhere to land:
//
//   Scenes (inn / road)        Pages, scene title, choice list
//   NPC dialogue (Mara)        NPC scene + Goodbye choice
//   Shop (Brom)                Stock list → auto buy buttons
//   Inventory room (bag)       Use / Equip / Unequip / Read action buttons
//   Combat (goblin)            Enemy art, HP bars, move list, log lines
//   Sidebar widgets            Title, Stats, Inventory, RoomLink
//   Items                      consumable (potion) + equipment (sword)
//   Assets                     three inline SVGs (potion / sword / goblin face)
//                              referenced via the asset:<id> catalogue model
//
// SVGs are inline data URLs (URL-encoded) so the project is fully self-
// contained - no upload, no network fetch.

const _svg = body => `data:image/svg+xml;utf8,${encodeURIComponent(body)}`;

const POTION_SVG = _svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="13" y="3" width="6" height="3" fill="#888" rx="1"/><path d="M12 6 L14 14 Q5 18 6 26 Q8 30 16 30 Q24 30 26 26 Q27 18 18 14 L20 6 Z" fill="#d33" stroke="#400" stroke-width="1"/><ellipse cx="13" cy="20" rx="2" ry="3" fill="#f88" opacity=".6"/></svg>`);

const SWORD_SVG = _svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2 L18.5 22 L13.5 22 Z" fill="#ccc" stroke="#333"/><rect x="10" y="22" width="12" height="3" fill="#543" stroke="#000"/><rect x="13" y="25" width="6" height="5" fill="#a52" stroke="#000" rx="1"/></svg>`);

const GOBLIN_SVG = _svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="36" r="22" fill="#7a3" stroke="#240" stroke-width="1.5"/><ellipse cx="32" cy="20" rx="16" ry="6" fill="#7a3" stroke="#240" stroke-width="1.5"/><circle cx="25" cy="34" r="3.5" fill="#ff0"/><circle cx="39" cy="34" r="3.5" fill="#ff0"/><circle cx="25" cy="34" r="1.5" fill="#000"/><circle cx="39" cy="34" r="1.5" fill="#000"/><path d="M24 46 Q32 52 40 46" fill="#400" stroke="#000" stroke-width="1.2"/><path d="M16 22 L12 16 M48 22 L52 16" stroke="#240" stroke-width="2" fill="none"/></svg>`);

// Schema shorthands so the literal stays readable.
const _alwaysCond = () => ({ mode: 'always', key: '', op: '>=', value: 0, itemId: '', count: 1, expr: '' });
const _noneEffect = () => ({ mode: 'none', ops: [], body: '' });
const _wardrobeDefaults = () => ({ portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] });
const _invDefaults = () => ({ kinds: [], layout: 'grid', showDescription: true, emptyMessage: 'Empty.' });

const _miniProject = () => ({
  meta:    { title: 'Theme Preview', start: 'inn', defaultMusic: '', gameCss: '', themeOverrides: {} },
  stats:   [
    { key: 'hp',   initial: 78 },
    { key: 'gold', initial: 142 },
  ],
  flags:   [],
  items:   [
    { id: 'potion', name: 'Healing Potion', description: 'Restores 10 HP.', image: 'asset:asset_potion', price: 5,  kind: 'consumable', useEffect: { mode: 'simple', ops: [{ target: 'hp', op: 'add', value: 10 }], body: '' }, text: '', equipSlot: '' },
    { id: 'sword',  name: 'Iron Sword',     description: 'Plain but sharp.',   image: 'asset:asset_sword',  price: 25, kind: 'equipment',  useEffect: _noneEffect(), text: '', equipSlot: 'weapon' },
  ],
  startingInventory: { potion: 2 },
  startingEquipped:  {},
  startingSkills:    ['strike'],
  skills: [{
    id: 'strike', name: 'Strike', kind: 'attack',
    damage: 3, damageStat: '', damageStatMul: 1, damageRandom: 1,
    selfHeal: 0, selfHealStat: '', selfHealStatMul: 1, selfHealRandom: 0,
    costStat: '', costValue: 0, costItem: '', requireItem: '',
    hitMode: 'always', hitPercent: 100, hitStat: '', hitBonus: 0, hitDc: 10,
    image: '', flavourText: 'You strike with steel.', description: '',
  }],
  rooms: [
    {
      id: 'inn', kind: 'scene', title: 'The Old Inn',
      music: '', onEnter: _noneEffect(), onEnterCondition: _alwaysCond(),
      pages: [{
        id: 'p1',
        text: 'You push open the heavy oak door. A fire crackles in the hearth, and the smell of stew curls toward you. The barkeeper glances up.',
        image: '', video: '', advanceLabel: 'More',
      }],
      choices: [
        { id: 'c1', label: 'Step outside (combat!)', to: '',     condition: _alwaysCond(), action: { mode: 'enterCombat', combatId: 'goblin', ops: [], body: '' }, flow: 'navigate', topicId: '', combatId: '' },
        { id: 'c2', label: 'Walk to the road',       to: 'road', condition: _alwaysCond(), action: _noneEffect(), flow: 'navigate', topicId: '', combatId: '' },
      ],
      wardrobe:  _wardrobeDefaults(),
      inventory: _invDefaults(),
    },
    {
      id: 'road', kind: 'scene', title: 'The Road',
      music: '', onEnter: _noneEffect(), onEnterCondition: _alwaysCond(),
      pages: [{ id: 'p2', text: 'A muddy track winds north. Wind whistles in the grass.', image: '', video: '', advanceLabel: 'More' }],
      choices: [{ id: 'c3', label: 'Back to the inn', to: 'inn', condition: _alwaysCond(), action: _noneEffect(), flow: 'navigate', topicId: '', combatId: '' }],
      wardrobe:  _wardrobeDefaults(),
      inventory: _invDefaults(),
    },
    {
      id: 'bag', kind: 'inventory', title: 'Bag',
      music: '', onEnter: _noneEffect(), onEnterCondition: _alwaysCond(),
      pages: [{ id: 'p3', text: 'You unfasten the straps and look inside.', image: '', video: '', advanceLabel: 'More' }],
      choices: [{ id: 'c4', label: 'Close bag', to: 'inn', condition: _alwaysCond(), action: _noneEffect(), flow: 'navigate', topicId: '', combatId: '' }],
      wardrobe:  _wardrobeDefaults(),
      inventory: { kinds: [], layout: 'grid', showDescription: true, emptyMessage: 'Empty.' },
    },
  ],
  npcs: [
    {
      id: 'mara', name: 'Mara', locations: ['inn'],
      greeting: 'Mara wipes a pewter mug with her apron.',
      portrait: '', role: 'dialogue', advanced: false,
      pages:   [{ id: 'np1', text: '"Welcome, traveller. The roads have been strange lately."', image: '', video: '', advanceLabel: 'More' }],
      choices: [{ id: 'nc1', label: 'Goodbye', to: '', condition: _alwaysCond(), action: _noneEffect(), flow: 'navigate', topicId: '', combatId: '' }],
      topics:  [], entryTopicId: '',
      shop:    { stock: [] },
    },
    {
      id: 'brom', name: 'Brom', locations: ['inn'],
      greeting: 'Brom polishes a row of trinkets behind a small counter.',
      portrait: '', role: 'shop', advanced: false,
      pages:   [{ id: 'np2', text: '"Anything catch your eye? Fair prices, friend."', image: '', video: '', advanceLabel: 'More' }],
      choices: [],
      topics:  [], entryTopicId: '',
      shop:    { stock: [
        { itemId: 'potion', price: null, quantity: null },
        { itemId: 'sword',  price: null, quantity: 1 },
      ]},
    },
  ],
  combats: [{
    id: 'goblin', name: 'Goblin Ambush',
    enemy: {
      name: 'Goblin', hp: 8, defense: 0, image: 'asset:asset_goblin',
      actions: [{ id: 'a1', label: 'Stab', kind: 'attack', damage: 2, damageRandom: 1, healAmount: 0, healRandom: 0, hitPercent: 80, weight: 1, useWhen: 'always', hpThreshold: 50, jsCondition: '', image: '', flavourText: 'The goblin lunges!' }],
      loot: { potion: 1 },
    },
    playerStat: 'hp', intro: 'A goblin springs from the bushes!',
    extraMoves: [],
    winRoom: 'inn', loseRoom: 'inn',
    winText: 'You defeat the goblin.', loseText: 'You collapse, defeated.',
    winImage: '', loseImage: '',
    onWin:  { mode: 'simple', ops: [{ target: 'gold', op: 'add', value: 5 }], body: '' },
    onLose: _noneEffect(),
    linkedNpcId: '',
  }],
  sidebar: {
    enabled: true,
    widgets: [
      { id: 'w1', type: 'title',    label: 'Theme Preview' },
      { id: 'w2', type: 'stats',    keys: [] },                       // empty = show all stats
      { id: 'w3', type: 'inventory', layout: 'grid' },
      { id: 'w4', type: 'roomLink', label: 'Open bag', roomId: 'bag', icon: '🎒' },
    ],
  },
  assets: [
    { id: 'asset_potion', name: 'Potion', kind: 'image', data: POTION_SVG, mime: 'image/svg+xml', byteSize: POTION_SVG.length, quality: null, maxDim: null },
    { id: 'asset_sword',  name: 'Sword',  kind: 'image', data: SWORD_SVG,  mime: 'image/svg+xml', byteSize: SWORD_SVG.length,  quality: null, maxDim: null },
    { id: 'asset_goblin', name: 'Goblin', kind: 'image', data: GOBLIN_SVG, mime: 'image/svg+xml', byteSize: GOBLIN_SVG.length, quality: null, maxDim: null },
  ],
  assetDefaults: { imageQuality: 0.8, imageMaxDim: 1080 },
});

// Module singleton - the mini-game stays mounted across Theme-tab re-renders
// so its state (current scene, hp, etc.) doesn't reset every keystroke.
let _miniHandle = null;
let _miniHost   = null;

const _ensureMiniGame = () => {
  // The host div is rendered by the panel; we look it up after commit.
  if (_miniHandle) return;
  const host = document.getElementById('theme-mini-game-host');
  if (!host) return;
  _miniHost = host;
  const cfg = buildGameConfig(_miniProject());
  // Strip the floating debug panels - they'd cover the small window.
  cfg.debug = false;
  const game = createGame(cfg);
  _miniHandle = game.mount(host);
};

const _restartMiniGame = () => {
  if (_miniHandle?.destroy) {
    try { _miniHandle.destroy(); } catch (_) {}
  }
  _miniHandle = null;
  if (_miniHost) _miniHost.innerHTML = '';
  _miniHost = null;
  // Mount on next animation frame so the cleared host is in the DOM.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(_ensureMiniGame);
  else _ensureMiniGame();
};

const _miniGameCard = () => Card({ title: 'Live mini-game preview' })([
  Stack({ gap: 10 })([
    p({ style: 'margin:0; font-size:12.5px; color:var(--text-muted)' })([
      'A tiny game runs in this window using the SAME pipeline the export uses (',
      span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['buildGameConfig → createGame → mount']),
      '). Edit a token or paste custom CSS - the player\'s game on the right repaints instantly.',
    ]),
    div({ style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap' })([
      button({
        type: 'button',
        onclick: _restartMiniGame,
        style: 'padding:5px 12px; font-size:12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); cursor:pointer',
      })(['↻ Restart mini game']),
      span({ style: 'font-size:11.5px; color:var(--text-muted); flex:1; min-width:200px' })([
        'Try: talk to Mara, buy from Brom\'s shop, use the bag (sidebar), step outside for combat.',
      ]),
    ]),
    div({
      id: 'theme-mini-game-host',
      style: 'width:100%; height:640px; border:1px solid var(--border); border-radius:var(--radius); overflow:auto; background:var(--bg); position:relative',
    })([]),
  ]),
]);

// ─── Class guide ────────────────────────────────────────────────────────

const _classRow = (cls, what) => div({ style: 'display:grid; grid-template-columns:200px 1fr; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-2); font-size:12.5px' })([
  span({ style: 'font-family:ui-monospace,monospace; color:var(--accent)' })([cls]),
  span({ style: 'color:var(--text-muted); line-height:1.5' })([what]),
]);

const _classGuide = () => Card({ title: 'CSS class guide - what to target in custom CSS' })([
  Stack({ gap: 4 })([
    p({ style: 'margin:0 0 4px; font-size:12.5px; color:var(--text-muted)' })([
      'Every running game emits these classes. Use them in the Custom CSS box below or in any external stylesheet you ship alongside the exported game.',
    ]),
    _classRow('.game-scene',     'Wrapper around every scene (rooms, NPC dialogues, combat, reading overlay).'),
    _classRow('.game-scene h2',  'The scene title.'),
    _classRow('.game-scene p',   'Narrative paragraphs and dialogue lines.'),
    _classRow('.game-scene img', 'Page images, NPC portraits, enemy art, combat flavour images.'),
    _classRow('.btn',            'Every choice button uses this base class. Hover, focus, disabled states inherit.'),
    _classRow('.btn-primary',    'The default choice variant - picks up --accent.'),
    _classRow('.btn-secondary',  '"Quiet" choices.'),
    _classRow('.btn-ghost',      'Transparent-background actions (used in the topbar).'),
    _classRow('.btn-sm / .btn-lg', 'Size modifiers on Button.'),
    _classRow('.toggle-track / .toggle-thumb', 'The Toggle component (for shop NPCs or sidebar widgets that use it).'),
    _classRow('.badge',          'Stat / inventory pills used by GameWidgets.'),
  ]),
]);

// ─── Custom CSS card (per-project) ─────────────────────────────────────

const _CSS_PLACEHOLDER = `/* Style game elements. Examples:

.game-scene h2          { font-family: 'Cinzel', serif; letter-spacing: .02em; }
.game-scene p           { line-height: 1.7; }
.game-scene .btn        { border-radius: 999px; }
.game-scene .btn:hover  { transform: translateX(2px); }

This CSS is saved per-project, applies live in the mini-game window
above, and is baked into the exported game's index.html. */`;

const _customCssCard = state => {
  const gameCss = state.project.meta.gameCss || '';
  const _setCss = v => setProject(p => ({ ...p, meta: { ...p.meta, gameCss: v } }));
  return Card({ title: 'Custom CSS (per-project, exported with the game)' })([
    Stack({ gap: 10 })([
      p({ style: 'margin:0; font-size:13px; color:var(--text-subtle)' })([
        'Belongs to the current project slot and travels with project.json. Codegen bakes it into ',
        span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['index.html']),
        ' as ',
        span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['<style id="game-custom-css">']),
        '. Targets are the classes listed above.',
      ]),
      textarea({
        value:       gameCss,
        placeholder: _CSS_PLACEHOLDER,
        spellcheck:  'false',
        oninput:     e => _setCss(e.target.value),
        style: 'width:100%; min-height:200px; padding:12px 14px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; line-height:1.6; color:var(--text); resize:vertical; box-sizing:border-box; outline:none',
      })([]),
      div({ style: 'display:flex; gap:8px; justify-content:flex-end' })([
        button({
          type: 'button',
          onclick: () => confirmAction({
            title:        'Clear custom CSS',
            message:      'Clear this project\'s custom CSS?',
            confirmLabel: 'Clear',
            danger:       true,
            onConfirm:    () => _setCss(''),
          }),
          style: 'padding:5px 12px; font-size:12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text-muted); cursor:pointer',
        })(['Clear']),
      ]),
    ]),
  ]);
};

// ─── Main panel ────────────────────────────────────────────────────────

const ThemePanel = state => {
  const overrides  = state.project.meta.themeOverrides || {};
  const defaults   = _defaults(state.theme);
  const hasChanges = Object.keys(overrides).length > 0;

  // Side-effect: ensure the mini-game is mounted after this render commits.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(_ensureMiniGame);

  return div({})([
    Card({ title: 'Game theme tokens (per-project)' })([
      Stack({ gap: 16 })([
        div({ style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap' })([
          div({ style: 'flex:1; min-width:200px' })([
            p({ style: 'margin:0 0 6px; font-size:13px; color:var(--text-subtle)' })([
              'Every CSS variable here defines the look of the ',
              strong({})(['exported game']),
              '. Tokens are saved on ',
              span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['project.meta.themeOverrides']),
              ' and codegen emits a matching ',
              span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['initStyles({ colors: { … } })']),
              ' call in ',
              span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['main.js']),
              ' so the player sees them. As a side-effect the editor chrome also picks them up - that\'s expected; you\'re looking at your own game palette.',
            ]),
            p({ className: 'gef-hint' })([
              'The topbar ',
              span({ className: 'dv-mono' })(['🌗']),
              ' light/dark switch is a separate editor comfort setting - it doesn\'t affect the exported game.',
            ]),
          ]),
          div({ style: 'display:flex; gap:8px; flex-shrink:0; align-items:flex-start' })([
            ...(hasChanges
              ? [Badge({ variant: 'blue' })([`${Object.keys(overrides).length} override${Object.keys(overrides).length === 1 ? '' : 's'}`])]
              : [Badge({ variant: 'gray' })(['defaults'])]),
            button({
              type: 'button',
              disabled: !hasChanges,
              style: `padding:6px 14px; font-size:13px; border-radius:var(--radius); border:1px solid var(--border); cursor:${hasChanges ? 'pointer' : 'not-allowed'}; background:var(--surface-2); color:${hasChanges ? 'var(--danger)' : 'var(--text-muted)'}; opacity:${hasChanges ? 1 : 0.5}`,
              onclick: () => { if (!hasChanges) return; confirmAction({
                title:        'Reset all token overrides',
                message:      'Reset every token override on this project? The palette returns to the dervo defaults.',
                confirmLabel: 'Reset all',
                danger:       true,
                onConfirm:    _resetAllOverrides,
              }); },
            })(['↺ Reset all']),
          ]),
        ]),

        div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px' })(
          HEX_GROUPS.map(_groupCard(defaults)(overrides))
        ),

        Divider({ label: 'Shape & typography' }),

        div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px' })(
          TEXT_GROUPS.map(_groupCard(defaults)(overrides))
        ),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([_miniGameCard()]),
    div({ style: 'margin-top:16px' })([_classGuide()]),
    div({ style: 'margin-top:16px' })([_customCssCard(state)]),
  ]);
};

export { ThemePanel };
