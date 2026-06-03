/**
 * Cheat Sheet — comprehensive in-app reference for the engine + editor.
 *
 * Eight tabs covering everything the editor can produce:
 *   1. Builder        — what each editor panel produces
 *   2. ctx & engine   — every property + method on the createGame ctx
 *   3. Items          — kinds, equip, use, read, inventory mechanics
 *   4. Combat         — skills, enemy AI, outcomes, flavour
 *   5. Assets         — catalogue, references, compression, export
 *   6. State keys     — every reserved key on state and what owns it
 *   7. JS scope       — what's bound when you choose 'JS' mode anywhere
 *   8. Recipes        — copy-pasteable patterns for common asks
 */

import { div, h2, h3, h4, p, span, ul, li, code, pre } from '../src/elements.js';
import { FloatingPanel } from '../src/components/FloatingPanel.js';
import { Stack } from '../src/components/Layout.js';
import { Tabs } from '../src/components/Tabs.js';
import { Badge } from '../src/components/Badge.js';
import { setState } from './store.js';

const _kbd = text => span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2, rgba(0,0,0,.06)); padding:1px 5px; border-radius:3px; font-size:11.5px; color:var(--text)' })([text]);

const _code = body => pre({ style: 'background:var(--surface-2, rgba(0,0,0,.05)); padding:8px 10px; border-radius:4px; font-size:11.5px; margin:6px 0; overflow:auto; line-height:1.5; white-space:pre' })([body]);

const _row = (label, hint) =>
  div({ style: 'display:grid; grid-template-columns: 180px 1fr; gap:8px; padding:4px 0; font-size:12.5px; align-items:start' })([
    span({ style: 'color:var(--text); font-family:ui-monospace,monospace' })([label]),
    span({ style: 'color:var(--text-muted); line-height:1.5' })(hint),
  ]);

const _section = (title, ...children) =>
  div({ style: 'margin-bottom:18px' })([
    h3({ style: 'margin:0 0 8px; font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); border-bottom:1px solid var(--border); padding-bottom:4px' })([title]),
    ...children,
  ]);

// Tab content blocks

const _BuilderTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Every editor panel reads/writes to the project JSON. Save persists to localStorage; Export writes the same data out as JS source plus binary assets.',
  ]),

  _section('Rooms tab',
    _row('Room kinds',    ['Three templates: ', _kbd('scene'), ' (pages + choices), ', _kbd('wardrobe'), ' (paper-doll + equipment list), ', _kbd('inventory'), ' (all items with Use/Read/Equip buttons). Switch with the Room kind dropdown.']),
    _row('Page sequence', ['Each scene room is a sequence of pages. Page index lives at ', _kbd('state._pageIdx[roomId]'), '; a "More" choice advances. Real choices render on the final page.']),
    _row('On enter',      ['Effect + ', span({ style: 'font-family:ui-monospace,monospace' })(['Condition']), ' gate. The Condition decides whether the Effect fires when entering. Pattern: gate behind ', _kbd('flags.fought === false'), ' so a combat doesn\'t repeat.']),
    _row('Choice',        ['{ label, to, condition, action }. ', _kbd('to: ""'), ' means "stay in place — action only".']),
    _row('Auto-NPCs',     ['Any NPC at this room gets an auto greeting line + "Talk to <name>" choice. No wiring needed.']),
  ),

  _section('NPCs tab',
    _row('role: dialogue', ['Two conversation systems toggled per-NPC via the ', _kbd('Advanced conversation'), ' switch.']),
    _row('role: shop',     ['Stock list → auto buy buttons. Each entry: ', _kbd('{ itemId, price?, quantity? }'), '. Null price → item default. Null quantity → infinite.']),
    _row('locations',      ['Array of room ids. ', _kbd('ctx.tickWorld()'), ' moves the NPC; ', _kbd('withTick(action)'), ' wraps an action to tick after it fires.']),
    _row('Simple mode',    ['Default. ', _kbd('pages'), ' (advanced via "More") → ', _kbd('choices'), ' (flat). Choices use the ', _kbd('Goes to'), ' picker; empty = return to the calling room. A ', _kbd('Goodbye'), ' button is auto-added if you have no choices.']),
    _row('Advanced mode',  ['Conversation tree: greeting pages → entry topic → other topics via ', _kbd('change'), ' flow. Click a topic node in the tree to edit it. Topic data is preserved if you toggle Advanced off — never deleted, just bypassed.']),
    _row('Topic',          [_kbd('name'), ' + ', _kbd('onEnter'), ' Effect + ', _kbd('pages'), ' + ', _kbd('choices'), '. A topic is essentially a tiny scene scoped to the NPC.']),
    _row('Entry topic',    ['Where the player lands after the greeting pages. Defaults to the first topic in the list.']),
    _row('Topic-choice flow', [
      _kbd('stay'), ' — fire the Effect and re-render the SAME topic. Use for "give me an item", "tell me more (npc line)", etc. — no navigation. ',
      _kbd('change'), ' — push current topic onto stack, switch to picked topic (chains sub-threads). ',
      _kbd('exitBack'), ' — pop the stack to the previous topic. If empty: leave the NPC. ',
      _kbd('exitRoom'), ' — leave the NPC, goto picked room (empty → return to caller). ',
      _kbd('exitCombat'), ' — leave the NPC, start picked combat.',
    ]),
    _row('Bulk generator', [
      'The ', _kbd('✨ Generate from list…'), ' button on each topic opens a modal that maps over a source list. Sources: ',
      _kbd('items'), ' / ', _kbd('npcs'), ' / ', _kbd('rooms'), ' / ', _kbd('flags'), ' / ', _kbd('skills'), ' / ', _kbd('combats'), ' / ',
      _kbd('custom (comma-separated list)'),
      '. Placeholders ', _kbd('{name}'), ', ', _kbd('{id}'), ', ', _kbd('{value}'),
      ' interpolate into every template field.',
    ]),
    _row('Generator · Mode', [
      _kbd('choices'), ' — N flat choices appended to the current topic. ',
      _kbd('dialogues'), ' — for each element, generates a small reply topic (one or more pages + auto Back button) plus a ',
      _kbd('change'), '-flow choice on the current topic that opens it. Reply pages take text (templated) and an image picked from the asset catalogue via AssetInput.',
    ]),
    _row('Generator · Advanced filters', [
      _kbd('Ignore self'), ' (NPCs source only) — a one-click toggle that auto-omits the speaking NPC, so Mara never gets a "Talk about Mara" choice. ',
      _kbd('Name/id contains'), ' — substring filter (case-insensitive). ',
      _kbd('Exclude ids'), ' — comma-separated blacklist. ',
      _kbd('Limit'), ' — cap N. ',
      _kbd('Per-choice condition'), ' — optional JS expression with placeholders; becomes the Choice\'s js-mode Condition (e.g. ',
      _kbd('(c.state.inventory?.["{id}"] ?? 0) === 0'), ' hides choices for items already collected).',
    ]),
  ),

  _section('Items tab',
    _row('kind',           [_kbd('consumable'), ' / ', _kbd('equipment'), ' / ', _kbd('readable'), ' / ', _kbd('key'), ' / ', _kbd('misc'), '. Drives what the inventory room shows as the action button.']),
    _row('consumable',     ['Has a ', _kbd('useEffect'), ' (Effect editor). Use button fires it; the count auto-decrements.']),
    _row('readable',       ['Has a ', _kbd('text'), ' field. Read button shows it in an overlay; ← Close returns.']),
    _row('equipment',      ['Has an ', _kbd('equipSlot'), ' (e.g. ', _kbd('weapon'), ', ', _kbd('head'), '). Equip puts it in ', _kbd('state.equipped[slot]'), ' (item stays in inventory).']),
  ),

  _section('Skills tab',
    _row('catalogue',      ['Top-level list of moves the player can learn. ', _kbd('state.skills'), ' is the array of learned ids.']),
    _row('Damage scaling', ['Final dmg = base + (state.stat × multiplier) + random(0..N). Configurable per skill.']),
    _row('To-hit',         [_kbd('always'), ' / ', _kbd('percent'), ' (1d100 ≤ hit%) / ', _kbd('statRoll'), ' (d20 + stat + bonus ≥ enemy.defense + DC).']),
    _row('Costs',          ['Optional stat cost (e.g. ', _kbd('mana'), ' -3), optional item consume.']),
  ),

  _section('Combats tab',
    _row('Player moves',   ['Comes from ', _kbd('state.skills'), ' + per-combat ', _kbd('extraMoves'), ' (boss-only). No separate move list per combat.']),
    _row('Enemy AI',       ['Each turn: filter actions by ', _kbd('useWhen'), ' rule, then weighted-random. Rules: ', _kbd('always'), ' / ', _kbd('belowHp'), ' / ', _kbd('aboveHp'), ' / ', _kbd('onPlayerMiss'), ' / ', _kbd('js'), '. Actions can be ', _kbd('attack'), ' or ', _kbd('heal'), '.']),
    _row('Outcomes',       [_kbd('onWin'), ' / ', _kbd('onLose'), ' Effects + win/lose rooms + win/lose images + ', _kbd('linkedNpcId'), ' (removes that NPC from the world on win).']),
    _row('Loot',           [_kbd('enemy.loot = { itemId: count }'), ' — added to inventory on win.']),
  ),

  _section('Assets tab',
    _row('Catalogue',      ['Top-level list of every uploaded image/audio/video. Fields elsewhere reference by id (', _kbd('asset:<id>'), '), not by inline data URL.']),
    _row('Defaults',       ['Image WebP quality + max height — applied to new uploads. Audio/video stored verbatim.']),
    _row('Re-use',         ['Same upload can be referenced from many fields without storing twice. Export still writes the file once.']),
  ),

  _section('Sidebar tab',
    _row('Visibility',     ['Toggle off → ', _kbd('sidebar.js'), ' isn\'t emitted; createGame uses default empty column.']),
    _row('Drag-reorder',   ['DragList — drag ⋮⋮ to change render order top→bottom.']),
    _row('Widget types',   ['title / portrait / stats / inventory / roomLink (button to a room) / js (custom render).']),
  ),

  _section('Project tab',
    _row('Stats',          ['Numeric values seeded into ', _kbd('state.<key>'), '.']),
    _row('Flags',          ['Booleans seeded into ', _kbd('state.flags[key]'), '.']),
    _row('Starting items', ['Seeded into ', _kbd('state.inventory'), ' at game start.']),
    _row('Starting equipped', ['Seeded into ', _kbd('state.equipped'), ' (', _kbd('{ slot: itemId }'), ').']),
  ),

  _section('Export tab',
    _row('Source layout',  [_kbd('main.js'), ' / ', _kbd('scenes.js'), ' / ', _kbd('world.js'), ' / ', _kbd('items.js'), ' / ', _kbd('sidebar.js?'), ' / ', _kbd('index.html'), '. Drop next to ', _kbd('src/'), '.']),
    _row('Asset folders',  ['Uploaded media unpacks into ', _kbd('img/'), ' / ', _kbd('audio/'), ' / ', _kbd('video/'), ' subdirs. JS references by relative path.']),
    _row('Per-file preview', ['Click a tab to preview generated source. project.json is the raw schema — round-trips through Import.']),
  ),

  _section('Theme tab — designs the EXPORTED game',
    _row('Where it lives',  ['Tokens are saved on ', _kbd('project.meta.themeOverrides'), '; custom CSS on ', _kbd('project.meta.gameCss'), '. Both travel with project.json and are baked into the exported game by codegen.']),
    _row('Token editor',    ['Every CSS variable is editable inline. Changing ', _kbd('--accent'), ' (etc.) on a project rewrites every Button, Badge, and Scene chrome that uses that token. Edits paint live; the ', _kbd('×'), ' next to a row clears that override back to the default.']),
    _row('Side-effect',     ['Token overrides also paint the editor itself (since editor + game share the same CSS-custom-property system). You\'re looking at your own game\'s palette while you work — that\'s the point.']),
    _row('Topbar 🌗 / 🌞',   ['Editor comfort only — toggles the light/dark base palette for the editor chrome. Does NOT travel with the project; does NOT affect the exported game.']),
    _row('Live mini-game',  ['A built-in tiny project (inn / road / Mara / goblin combat) runs in a small window on the Theme tab using ', _kbd('buildGameConfig → createGame → mount'), ' — the same pipeline the export uses. Token + CSS edits repaint it instantly via CSS-variable cascade. Use the ', _kbd('↻ Restart'), ' button to start over.']),
    _row('Codegen output',  [_kbd('main.js'), ' gets an ', _kbd('initStyles({ colors: { … } })'), ' call with your overrides; ', _kbd('index.html'), ' gets a ', _kbd('<style id="game-custom-css">'), ' block with your CSS. The exported game looks identical to what you saw in the preview.']),
    _row('CSS class targets', ['See the Class guide card on the Theme tab. Briefly: ', _kbd('.game-scene'), ' (wrapper), ', _kbd('.game-scene h2 / p / img'), ' (content), ', _kbd('.btn / .btn-primary / .btn-secondary / .btn-ghost / .btn-sm / .btn-lg'), ' (choice buttons).']),
  ),

  _section('Graph tab',
    _row('Shapes',         ['Rooms ▭, NPCs ◯, combats ⬡. Click any shape to jump to its editor tab with that entity selected.']),
    _row('Edges',          [_kbd('grey curve'), ' room exits, ', _kbd('dashed orange'), ' combat triggers (enterCombat / exitCombat), ', _kbd('solid green'), ' combat → winRoom, ', _kbd('solid red'), ' combat → loseRoom, ', _kbd('dashed thin'), ' NPC roaming radius.']),
    _row('Media badges',   ['Bottom-right of every node: ', _kbd('I'), ' image (blue), ', _kbd('V'), ' video (purple), ', _kbd('A'), ' audio (green). All coloured via theme tokens — dark mode safe.']),
  ),
]);

const _CtxTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'createGame passes a ', _kbd('ctx'), ' to every scene, sidebar widget, and choice action. Everything you can do at runtime goes through this object.',
  ]),

  _section('Data on ctx',
    _row('ctx.state',      ['Current state snapshot (read-only — never mutate; use setState).']),
    _row('ctx.scene',      ['Current scene id. Inside an NPC dialogue, patched to the return location so ', _kbd('back'), ' works.']),
    _row('ctx.history',    ['Array of prior scene ids (newest last). Empty → nowhere to go back to.']),
    _row('ctx.debug',      ['Boolean. Tells default top-bar whether to render the Debug button.']),
    _row('ctx.npcs',       ['Full NPC map ({ npcId: npc }). Read-only.']),
  ),

  _section('Mutating state',
    _row('ctx.setState(s => ({…}))', ['Returns a partial that the store merges. Always treat ', _kbd('s'), ' as immutable — spread when nesting.']),
    _row('ctx.getState()',  ['Read-once snapshot. Prefer ', _kbd('ctx.state'), ' inside render functions.']),
    _code(`ctx.setState(s => ({
  hp:    Math.max(0, s.hp - 5),
  flags: { ...(s.flags || {}), poisoned: true },
}));`),
  ),

  _section('Navigation',
    _row('ctx.goto(id)',    ['Push to scene ', _kbd('id'), '. Pushes current scene onto ', _kbd('_history'), '.']),
    _row('ctx.back()',      ['Pop ', _kbd('_history'), ' and navigate. No-op when empty.']),
    _row('ctx.restart()',   ['Reset to initial state.']),
    _row('ctx.talkTo(id, back?)', ['Open NPC dialogue. ', _kbd('back'), ' defaults to ', _kbd('ctx.scene'), '. Engine encodes as ', _kbd('_dialogue:npcId:back'), '.']),
  ),

  _section('NPC helpers',
    _row('ctx.npcsAt(sceneId?)', ['NPCs currently at the scene (default: ', _kbd('ctx.scene'), '). Returns ', _kbd('[{ id, name, locations, greeting, dialogue }]'), '.']),
    _row('ctx.tickWorld()', ['Re-randomises every NPC\'s location. Wrap an action with ', _kbd('withTick(...)'), ' to fire it after the player commits.']),
  ),

  _section('Save / load',
    _row('ctx.save(slot?)', ['Persist to localStorage. Slot defaults to ', _kbd('"default"'), '.']),
    _row('ctx.load(slot?)', ['Restore. Returns ', _kbd('true'), ' on success.']),
    _row('ctx.hasSave(slot?)', ['Check existence without loading.']),
    _row('ctx.clearSave(slot?) / listSlots()', ['Slot management.']),
  ),
]);

const _ItemsTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Items live in a top-level catalogue. The item\'s ', _kbd('kind'), ' decides what the inventory room offers as an action button, and what ', _kbd('state'), ' bucket it lives in.',
  ]),

  _section('state shape',
    _code(`state.inventory = { potion: 3, sword: 1 };    // missing key === count of 0
state.equipped  = { weapon: 'sword' };        // current paper-doll
state._reading  = { roomId, itemId } | null;  // overlay open?`),
  ),

  _section('Consumable',
    _row('Editor field',   ['"On use" Effect editor. Same modes as any Choice action.']),
    _row('Runtime',        ['Use button → useEffect fires → count auto-decrements by 1 (you don\'t need an ', _kbd('inv.take'), ' op).']),
    _code(`// Editor: kind='consumable', useEffect simple:
{ target: 'hp', op: 'add', value: 20 }`),
  ),

  _section('Readable',
    _row('Editor field',   ['"Reading content" textarea (multi-line, preserves line breaks).']),
    _row('Runtime',        ['Read button → ', _kbd('state._reading = { roomId, itemId }'), ' → scene swaps to a reader view. ← Close clears the flag.']),
  ),

  _section('Equipment',
    _row('Editor field',   ['"Equipment slot" — string key like ', _kbd('weapon'), ', ', _kbd('head'), '.']),
    _row('Runtime',        ['Equip button → ', _kbd('state.equipped[slot] = itemId'), '. Unequip clears the slot. Item stays in inventory either way.']),
    _row('Portrait',       ['Layer bindings check equipped first, then plain inventory. So a sword layer paints when the sword is equipped (or as a fallback when it\'s merely carried).']),
  ),

  _section('Writing (Effect ops)',
    _row('inv.<id> give N', ['Add N (default 1).']),
    _row('inv.<id> take N', [_kbd('Math.max(0, current - N)'), ' — never negative.']),
    _row('inv.<id> set N',  ['Hard set. ', _kbd('0'), ' removes.']),
    _code(`// Editor structured form → generates:
c.setState(s => ({
  inventory: {
    ...(s.inventory || {}),
    potion: (s.inventory?.potion ?? 0) + 1,
  },
}));`),
  ),

  _section('Reading (Condition + JS)',
    _row('hasItem condition', ['Catalogue picker. ', _kbd('has'), ' / ', _kbd('lacks'), ' / ', _kbd('≥ N'), '.']),
    _row('JS expr',         ['Optional chain because empty inventories may be undefined.']),
    _code(`return (c.state.inventory?.sword ?? 0) >= 1
    && (c.state.flags?.metMage === true);`),
  ),

  _section('Shops',
    _row('Shop NPC',        ['Each stock entry auto-builds a buy choice: ', _kbd('gold >= price && remaining > 0'), '; subtracts gold, gives item.']),
    _row('Depletion',       [_kbd('state._shopStock[npcId][itemId]'), ' tracks sold counts.']),
  ),
]);

const _CombatTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Combats are routable scenes. Trigger one with an ', _kbd('enterCombat'), ' Effect (Choice action or Room onEnter). Engine remembers the caller; blank outcome rooms fall back to it.',
  ]),

  _section('Player skills',
    _row('Where they live', [_kbd('state.skills'), ' (array of ids). Combat shows every learned skill as a move.']),
    _row('Learning',        ['Effect ops: ', _kbd('skills.<id>'), ' op ', _kbd('learn'), ' / ', _kbd('forget'), '. Set up starting skills in the Skills tab.']),
    _row('Damage formula',  [_kbd('base + (state[damageStat] × damageStatMul) + randInt(0..damageRandom)'), ' − enemy.defense.']),
    _row('To-hit (always)',   ['Default — never miss.']),
    _row('To-hit (percent)',  ['1d100 ≤ hitPercent.']),
    _row('To-hit (statRoll)', ['1d20 + state[hitStat] + hitBonus ≥ enemy.defense + hitDc.']),
  ),

  _section('Enemy AI',
    _code(`actions = [
  { kind: 'attack', damage: 3, damageRandom: 2, hitPercent: 85, weight: 3, useWhen: 'always' },
  { kind: 'heal',   healAmount: 5, healRandom: 3, weight: 1, useWhen: 'belowHp', hpThreshold: 30 },
  { kind: 'attack', damage: 6, hitPercent: 60, weight: 2, useWhen: 'onPlayerMiss' },
];`),
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Each turn: filter by ', _kbd('useWhen'), ' → weighted-random pick.']),
    _row('always',          ['Always available.']),
    _row('belowHp / aboveHp', ['Enemy HP relative to ', _kbd('hpThreshold'), '% of max HP.']),
    _row('onPlayerMiss',    ['Only after the player\'s last skill missed.']),
    _row('js',              ['Author writes a predicate. Receives ', _kbd('{ enemyHp, enemyMaxHp, state, lastResult }'), '.']),
  ),

  _section('Combat state',
    _code(`state._combat = {
  id,                    // current encounter id
  enemyHp,               // working HP (max comes from combat.enemy.hp)
  log,                   // last few turn lines
  turn,                  // 0-indexed
  lastMoveImage,         // shown to the player after their turn
  lastMoveText,          // skill flavour
  lastEnemyImage,        // shown after enemy's turn
  lastEnemyText,         // action flavour
  returnTo,              // room id to fall back to
  outcome: 'win' | 'lose' | null,
};`),
  ),

  _section('Outcomes',
    _row('winRoom / loseRoom', ['Where the engine goes after Continue. Blank → ', _kbd('returnTo'), '.']),
    _row('winText / loseText', ['Flavour shown on the outcome screen.']),
    _row('winImage / loseImage', ['Replace the (greyed) enemy portrait with explicit victory or game-over art.']),
    _row('onWin / onLose',    ['Effect (any mode — simple ops or JS). Use to grant gold, learn skills, set flags, …']),
    _row('linkedNpcId',       ['On win: deletes that NPC\'s location and sets ', _kbd('flags.<npcId>_defeated = true'), '. Useful for "kill the goblin, the goblin disappears from the world".']),
    _row('enemy.loot',        [_kbd('{ itemId: count }'), '. Added to player inventory on win.']),
  ),

  _section('Flavour during a turn',
    _row('Skill.flavourText', ['Shown beside the move-art image when the player uses it.']),
    _row('EnemyAction.flavourText', ['Shown when that action fires.']),
    p({ style: 'margin:6px 0 0; font-size:11.5px; color:var(--text-muted)' })([
      'The combat scene\'s last-action banner is image + italic flavour text. Player moves take precedence over the enemy\'s when both are set (player just acted last).',
    ]),
  ),
]);

const _AssetsTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Every uploaded media file lives in a single top-level catalogue (', _kbd('project.assets'), '). Fields elsewhere hold an ', _kbd('asset:<id>'), ' reference — so the same image used in five rooms is stored once and exports as one file.',
  ]),

  _section('Reference scheme',
    _row('asset:<id>',       ['Resolved at preview render time and at export. Plain URLs (', _kbd('https://…'), ') pass through untouched. Empty string = no media.']),
    _row('Legacy data: URL', ['Old projects with inline base64 data URLs still work — the extractor pulls them out during export with content-based dedupe.']),
  ),

  _section('Compression',
    _row('Image',            ['Passed through ', _kbd('base64ToWebP'), ' from odocosJS extras. Defaults: quality 0.8, max height 1080px. Tunable in the Assets tab.']),
    _row('SVG / GIF',        ['Skipped — vectors and animation survive a canvas round-trip badly. Stored verbatim.']),
    _row('Audio / Video',    ['Stored verbatim. Browser-side re-encoding is too heavy; the typical asset is already a compressed container.']),
  ),

  _section('Export folders',
    _code(`<your-game>/
├── main.js, scenes.js, world.js, items.js, sidebar.js?
├── index.html
├── img/
│   └── player_eating.webp   ← post-compression
├── audio/
│   └── main_theme.mp3
└── video/
    └── intro.mp4`),
    p({ style: 'margin:0 0 6px; font-size:12.5px; color:var(--text-muted)' })([
      'Asset filename comes from the asset\'s ', _kbd('name'), ' field (sanitised). Collisions get ', _kbd('_1'), ', ', _kbd('_2'), ' suffixes.',
    ]),
  ),

  _section('In code',
    _row('Editor field',     ['AssetInput shows: "Pick from catalogue" dropdown + ↑ Upload new + plain URL input.']),
    _row('Preview',          [_kbd('resolveAssetsForPreview(project)'), ' resolves refs to data URLs at the top of ', _kbd('buildGameConfig'), '. Downstream code stays asset-agnostic.']),
    _row('Codegen',          [_kbd('extractAssets(project)'), ' writes the catalogue to disk, rewrites refs to relative paths, then ', _kbd('emitAll'), ' runs against the rewritten project.']),
  ),
]);

const _StateTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Reserved keys the engine and editor manage. Don\'t reuse these names for your own stats / flags.',
  ]),
  _code([
    '// Player data',
    'state.<statKey>      // every Project-tab stat — top-level',
    'state.flags          // { flagKey: boolean }',
    'state.inventory      // { itemId: count }   (count 0 deleted)',
    'state.equipped       // { slot: itemId }    (paper-doll)',
    'state.skills         // [skillId]           (learned moves)',
    '',
    '// Engine bookkeeping',
    'state._scene         // current scene id  (ctx.goto / ctx.back)',
    'state._history       // [sceneId]         (ctx.back pops the last)',
    'state._sidebarOpen   // boolean for the AppShell sidebar toggle',
    'state._debugOpen     // boolean for the floating debug panel',
    '',
    '// Editor-emitted state machines',
    'state._pageIdx          // { roomId: pageIndex }  — room page sequence',
    'state._npcPageIdx       // { npcId:  pageIndex }  — NPC greeting page sequence',
    'state._npcGreetingDone  // { npcId: bool } — advanced mode: greeting clicked through this visit',
    'state._npcTopic         // { npcId: topicId|null } — current topic (advanced mode)',
    'state._npcTopicStack    // { npcId: [topicId...] } — pushed by `change`, popped by `exitBack`',
    'state._npcTopicPageIdx  // { npcId: { topicId: pageIndex } } — per-topic page idx',
    'state._shopStock        // { npcId: { itemId: soldCount } }',
    'state._combat           // active combat state (see Combat tab)',
    'state._reading          // { roomId, itemId } | null — reading overlay',
    '',
    '// NPC world',
    'state.npcLocations   // { npcId: roomId }   updated by tickWorld()',
  ].join('\n')),
  p({ style: 'margin:6px 0 0; font-size:12px; color:var(--text-muted)' })([
    'Effect-op targets: ',
    _kbd('flags.<key>'), ' → ', _kbd('state.flags[key]'), '; ',
    _kbd('inv.<id>'), ' → ', _kbd('state.inventory[id]'), '; ',
    _kbd('skills.<id>'), ' → ', _kbd('state.skills'), '. Plain target writes top-level.',
  ]),
]);

const _ScopeTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Every "JS" mode in the editor has a specific binding contract. Use these names; they\'re always in scope.',
  ]),

  _section('JS conditions',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Bound: ', _kbd('c'), ' (game ctx). Single expression returning truthy/falsy.']),
    _code('return c.state.gold >= 5 && (c.state.inventory?.key ?? 0) >= 1;'),
  ),

  _section('JS effects',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Bound: ', _kbd('c'), '. Function body. Use ', _kbd('c.setState(...)'), '. No return needed.']),
    _code(`c.setState(s => ({
  gold: s.gold - 5,
  inventory: { ...(s.inventory || {}), elixir: 1 },
  flags: { ...(s.flags || {}), drank: true },
}));
if (c.state.hp <= 0) c.goto('gameover');`),
  ),

  _section('JS sidebar widgets',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Bound: ', _kbd('ctx, state, div, span, p, h3, img, video, button'), '. Return a vnode (or ', _kbd('null'), ').']),
    _code(`const pct = Math.min(100, (state.hp / 100) * 100);
return div({ style: 'border:1px solid var(--border); height:14px' })([
  div({ style: 'background:var(--accent); height:100%; width:' + pct + '%' })([]),
]);`),
  ),

  _section('Enemy AI useWhen: js',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Bound: ', _kbd('enemyHp, enemyMaxHp, state, lastResult'), '. Return truthy to make the action eligible this turn.']),
    _code(`return enemyHp / enemyMaxHp < 0.4
    && state.skills.includes('berserk');`),
  ),

  _section('Errors',
    _row('Compile error',  ['Body fails ', _kbd('new Function(...)'), ' — the widget renders an inline red box.']),
    _row('Runtime error',  ['Throws inside the fn — same red-box behaviour. State is unaffected.']),
  ),
]);

const _RecipesTab = () => div({})([
  p({ style: 'margin:0 0 12px; color:var(--text-muted); font-size:13px' })([
    'Copy-paste starting points. Drop the snippets into the appropriate "JS" textarea and edit to taste.',
  ]),

  _section('"Open phone" anywhere',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Sidebar tab → ', _kbd('+ Room link button'), '. Pick the phone room. Icon ', _kbd('📞'), '. Pushes onto history so ', _kbd('← Back'), ' returns.']),
  ),

  _section('Topic that gives an item without leaving the conversation',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'NPC tab → toggle ', _kbd('Advanced'), ' → make a topic. Add a choice with Flow = ',
      _kbd('stay'), ', and an Effect that gives the item. The player stays in the topic; the choice can fire repeatedly (or guard with a Condition like ',
      _kbd('inv.bread < 3'), ' to cap it).',
    ]),
  ),

  _section('NPC line on demand ("Tell me more")',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Topic choice with Flow = ', _kbd('stay'), ' and Effect = JS body that updates a flag (e.g. ',
      _kbd('c.setState({ flags: { ...c.state.flags, told: true } })'), '). The current topic page already shows the line you wrote; the choice just unlocks more state for a follow-up topic.',
    ]),
  ),

  _section('Bulk-generate "Take X" buttons for every consumable',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Topic editor → ', _kbd('✨ Generate from list…'),
      '. Source: ', _kbd('Items'), '. Filter: ', _kbd('consumable'),
      '. Label: ', _kbd('Take {name}'), '. Flow: ', _kbd('stay'),
      '. Effect: simple, ', _kbd('inv.{id}'), ' / ', _kbd('give'), ' / ', _kbd('1'),
      '. The preview shows how many will be generated; ', _kbd('Generate'),
      ' appends them all to the topic\'s choice list.',
    ]),
  ),

  _section('Bulk-generate "Travel to X" for every room',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Source: ', _kbd('Rooms'), '. Label: ', _kbd('Go to {name}'),
      '. Flow: ', _kbd('exit · to room'), '. Target room-id template: ', _kbd('{id}'),
      '. Use the filter to limit to one room kind (e.g. ', _kbd('scene'), ').',
    ]),
  ),

  _section('Numeric loop with a custom list (bid 10/25/50/100 gold)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Source: ', _kbd('Custom list'), '. Custom list: ', _kbd('10, 25, 50, 100'),
      '. Label: ', _kbd('Bid {value}g'), '. Flow: ', _kbd('stay'),
      '. Effect: simple, ', _kbd('gold'), ' / ', _kbd('sub'), ' / ', _kbd('{value}'),
      '. Numeric value templates are auto-coerced to numbers when they parse cleanly.',
    ]),
  ),

  _section('"Talk about John / Bob / Alice" (auto-generated mini-dialogues)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Source: ', _kbd('NPCs'), '. Toggle ', _kbd('Ignore self'),
      ' so the speaking NPC is auto-excluded. Mode: ', _kbd('dialogues'),
      '. Link label: ', _kbd('Talk about {name}'),
      '. Reply topic name: ', _kbd('About {name}'),
      '. Add as many reply pages as you want (each takes text + an optional image from the asset catalogue) — the player advances via "More" and the last page leads to an auto Back. ',
      _kbd('+ Add page'), ' inside the modal grows the reply.',
    ]),
  ),

  _section('"Take X" — but hide items already collected',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Same as the "Take X for every consumable" recipe, but in ',
      span({ style: 'text-transform:uppercase; font-size:11px; font-weight:600; color:var(--text-muted)' })(['Advanced']),
      ' set Per-choice condition to ', _kbd('(c.state.inventory?.["{id}"] ?? 0) === 0'),
      '. The generated Choices each get a js-mode Condition that hides them at runtime once the player has the item.',
    ]),
  ),

  _section('Game-themed scene title with custom font + pill-shaped choice buttons',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Theme tab → Custom CSS textarea:',
    ]),
    _code(`.game-scene h2 {
  font-family: 'Cinzel', serif;
  letter-spacing: .02em;
  text-shadow: 0 1px 0 var(--surface-2);
}
.game-scene .btn {
  border-radius: 999px;
  transition: transform .12s;
}
.game-scene .btn:hover {
  transform: translateX(2px);
}`),
    p({ style: 'margin:6px 0 0; font-size:12px; color:var(--text-muted)' })([
      'Saves to ', _kbd('project.meta.gameCss'), ' and re-renders the Game preview cards above instantly. Export bakes the exact same string into the player\'s ', _kbd('index.html'), '.',
    ]),
  ),

  _section('Stat bar in the sidebar',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Sidebar tab → ', _kbd('+ JS widget'), ':']),
    _code(`const max = 100;
const pct = Math.min(100, Math.max(0, (state.hp / max) * 100));
return div({ style: 'margin-bottom:8px' })([
  div({ style: 'font-size:11px; color:var(--text-muted)' })(['HP ' + state.hp + ' / ' + max]),
  div({ style: 'border:1px solid var(--border); height:10px; overflow:hidden; background:var(--surface)' })([
    div({ style: 'background:var(--accent); height:100%; width:' + pct + '%' })([]),
  ]),
]);`),
  ),

  _section('Use a healing potion',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Items tab → ', _kbd('Potion'), ' kind ', _kbd('consumable'), '. ',
      'On-use Effect (simple): ', _kbd('hp add 20'), '. Drop an Inventory-kind room in the Rooms tab; the Use button surfaces automatically.',
    ]),
  ),

  _section('Read a book',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Items tab → ', _kbd('Old Codex'), ' kind ', _kbd('readable'), '. Paste the text into "Reading content". ',
      'Inventory room shows a Read button → overlay opens with the text → ← Close.',
    ]),
  ),

  _section('Equip a sword',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Items tab → ', _kbd('Iron Sword'), ' kind ', _kbd('equipment'), ', ', _kbd('equipSlot: weapon'), '. ',
      'For a portrait change: add a "weapon" layer in the Wardrobe or Portrait widget; in its bindings, ', _kbd('sword → /weapons/iron.webp'), '. The bindings check ', _kbd('state.equipped'), ' first.',
    ]),
  ),

  _section('Skill that scales with STR + d6',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Skills tab. In the Damage scaling card:']),
    ul({ style: 'margin:0; padding-left:18px; font-size:12.5px; color:var(--text-muted)' })([
      li({})(['Scales with stat: ', _kbd('STR')]),
      li({})(['Stat multiplier: ', _kbd('2'), ' (i.e. +2×STR)']),
      li({})(['Random 0..N: ', _kbd('6')]),
    ]),
    p({ style: 'margin:6px 0 0; font-size:12px; color:var(--text-muted)' })([
      'Result: a base 2 + 2×STR + 0..6 swing.',
    ]),
  ),

  _section('Smart enemy that heals on low HP',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Combats tab → Enemy → + Add AI action. Add three actions:']),
    _code(`{ label: 'Claw',  kind: 'attack', damage: 3, hitPercent: 85, weight: 3, useWhen: 'always'   }
{ label: 'Mend',  kind: 'heal',   healAmount: 5, healRandom: 3,           weight: 5, useWhen: 'belowHp', hpThreshold: 30 }
{ label: 'Howl',  kind: 'attack', damage: 6, hitPercent: 60, weight: 2, useWhen: 'onPlayerMiss' }`),
    p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
      'Below 30% HP the heal dominates (weight 5); after the player misses the heavy swing comes out.',
    ]),
  ),

  _section('Game-over screen',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })(['Add a room ', _kbd('gameover'), '. Then in any JS effect that triggers death:']),
    _code(`if (c.state.hp <= 0) c.goto('gameover');`),
    p({ style: 'margin:4px 0 0; font-size:12px; color:var(--text-muted)' })([
      'On gameover, add a "Restart" choice with JS action: ', _kbd('c.restart()'), '.',
    ]),
  ),

  _section('Talk to a specific NPC from a choice',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Use the ', _kbd('talkTo'), ' Effect mode (not a Choice ', _kbd('to'), '). Pick the NPC. Engine returns to the calling room when Goodbye fires. Useful for "rumour board" rooms.',
    ]),
  ),

  _section('Combat triggered on room entry — once only',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Room → On enter Condition: ', _kbd('flags.fought_goblin === false'), '. ',
      'Room On-enter Effect (JS): ',
    ]),
    _code(`c.setState(s => ({ flags: { ...(s.flags || {}), fought_goblin: true } }));
// Then trigger via a separate "Fight!" choice with action: enterCombat (the
// onEnter Effect handles the flag flip, the choice handles the fight).`),
    p({ style: 'margin:6px 0 0; font-size:12px; color:var(--text-muted)' })([
      'Or set ', _kbd('linkedNpcId'), ' on the combat — winning sets the ', _kbd('<npcId>_defeated'), ' flag for free, gate the onEnter on that.',
    ]),
  ),
]);

const TABS = [
  { id: 'builder',   label: 'Builder'    },
  { id: 'ctx',       label: 'ctx & engine' },
  { id: 'items',     label: 'Items'      },
  { id: 'combat',    label: 'Combat'     },
  { id: 'assets',    label: 'Assets'     },
  { id: 'state',     label: 'State keys' },
  { id: 'scope',     label: 'JS scope'   },
  { id: 'recipes',   label: 'Recipes'    },
];

const _renderTabBody = id => {
  switch (id) {
    case 'builder':   return _BuilderTab();
    case 'ctx':       return _CtxTab();
    case 'items':     return _ItemsTab();
    case 'combat':    return _CombatTab();
    case 'assets':    return _AssetsTab();
    case 'state':     return _StateTab();
    case 'scope':     return _ScopeTab();
    case 'recipes':   return _RecipesTab();
    default:          return _BuilderTab();
  }
};

const CheatSheet = state => {
  if (!state.cheatsheetOpen) return [];
  const active = state.cheatsheetTab || 'builder';
  return [FloatingPanel({
    id:        'gef-cheat',
    title:     'Cheat sheet — engine + builder',
    open:      true,
    onClose:   () => setState({ cheatsheetOpen: false }),
    initialX:  60,
    initialY:  72,
    initialW:  820,
    initialH:  680,
  })([
    div({ style: 'padding:14px 18px; overflow-y:auto; height:100%' })([
      Tabs({
        tabs:        TABS,
        activeTab:   active,
        onTabChange: id => setState({ cheatsheetTab: id }),
      })(TABS.map(t => _renderTabBody(t.id))),
    ]),
  ])];
};

export { CheatSheet };
