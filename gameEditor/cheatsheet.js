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

  _section('Inline expressions in narrative text',
    _row('Syntax',         [
      'Any text field — page text, NPC greeting, combat win/lose, item description, readable item content, last-move flavour — accepts ',
      _kbd('${expr}'), ' snippets. They evaluate against live ', _kbd('state'),
      ' at render time. Example: ', _kbd('You have ${gold} gold and ${hp}/100 hp.'), '.',
    ]),
    _row('Scope',          [
      'Expressions run inside ', _kbd('with (state) { return (expr); }'),
      '. So bare ', _kbd('gold'), ' resolves to ', _kbd('state.gold'), '; ',
      _kbd('flags.metMage'), ' resolves to ', _kbd('state.flags.metMage'),
      '; ', _kbd('inventory.bread ?? 0'), ' counts the bread in your pack.',
    ]),
    _row('Conditional',    [
      _kbd('The mage ${flags.metMage ? "nods" : "ignores you"}.'),
      ' — ternary works because the body is real JS.',
    ]),
    _row('Failure modes',  [
      'A compile error or runtime throw leaves the original ', _kbd('${expr}'),
      ' visible in the rendered text, so the author sees the typo immediately instead of a silent crash.',
    ]),
    _row('Explorer',       [
      'The 📊 ', _kbd('State'), ' button in the topbar opens a floating reference panel that lists every key on ',
      _kbd('state'), ' your project will produce — grouped Stats / Flags / Inventory / Equipped / Skills / Engine internals, each with an example ',
      _kbd('${…}'), ' you can paste. Click ', _kbd('▸'),
      ' on any property-path row to expand and see the INITIAL JSON value (computed from project.stats[].initial, project.startingInventory, etc.) so you know exactly what shape sits behind a path.',
    ]),
  ),

  _section('Message buffer — opt-in Continue overlay between actions',
    _row('What it is', [
      'Every Effect (and every randomLoot entry) has an optional ', _kbd('Message'),
      ' template. When the effect fires, the rendered message is appended to ',
      _kbd('state._messageQueue'),
      '. On the next scene render, if the queue is non-empty, the player sees the accumulated messages above a single ',
      _kbd('Continue'),
      ' button; clicking it clears the queue and falls through to the actual scene. Empty queue → continues normally with zero UI overhead.',
    ]),
    _row('Accumulation', [
      _kbd('multi'), ' steps each push their own message in order. ',
      _kbd('randomLoot'), ' picks push the picked entry\'s message (multi-pick tables accumulate one per roll). ',
      _kbd('oneOf'), ' fires the picked option\'s nested Effect, whose message pushes normally. So one click can stack several lines.',
    ]),
    _row('Extra scope', [
      'Inside ', _kbd('Message'), ' templates the ', _kbd('${…}'),
      ' scope also exposes ', _kbd('init'), ' (state snapshot pre-action), ',
      _kbd('gain'), ' (per-key positive deltas — stats up, items gained, flags flipped true, skills learned), and ',
      _kbd('loss'), ' (per-key negative deltas, as positive numbers). Example: ',
      _kbd('The gold reserves of ${init.gold} got increased by ${gain.gold} to ${gold}.'),
    ]),
    _row('Conditional copy', [
      'Use ', _kbd('gain'), ' to decide what to say. Example for a loot pick that might give an item or just stats: ',
      _kbd('${gain.potion ? "Plus a potion!" : ""}'),
      '. Empty results render nothing.',
    ]),
    _row('Reserved keys', [
      _kbd('state._messageQueue'), ' (pending lines) and ', _kbd('state._msgInit'),
      ' (init snapshot) are managed automatically — every choice action seeds them via ', _kbd('_startAction(c)'),
      '. Don\'t mutate them by hand in JS effects.',
    ]),
  ),

  _section('Rooms tab',
    _row('Room kinds',    ['Four templates: ', _kbd('scene'), ' (pages + choices), ', _kbd('wardrobe'), ' (paper-doll + equipment list), ', _kbd('inventory'), ' (all items with Use/Read/Equip buttons), ', _kbd('story'), ' (narrative-arc, lives in Story Points tab). Switch with the Room kind dropdown.']),
    _row('Page sequence', ['Each scene room is a sequence of pages. Page index lives at ', _kbd('state._pageIdx[roomId]'), '; a "More" choice advances. Real choices render on the final page.']),
    _row('On enter',      ['Effect + ', span({ style: 'font-family:ui-monospace,monospace' })(['Condition']), ' gate. The Condition decides whether the Effect fires when entering. Pattern: gate behind ', _kbd('flags.fought === false'), ' so a combat doesn\'t repeat.']),
    _row('Choice',        ['{ label, to, condition, action }. ', _kbd('to: ""'), ' means "stay in place — action only".']),
    _row('Choice goto yields to action', [
      'If your choice\'s ', _kbd('action'),
      ' navigates (via ', _kbd('randomLoot'), ' navigate, ', _kbd('enterCombat'),
      ', ', _kbd('talkTo'), ', or a JS ', _kbd('c.goto'),
      '), the choice\'s ', _kbd('to:'), ' is SKIPPED. So ',
      _kbd('to: street'),
      ' becomes the "default destination" and the action can override it probabilistically (e.g. ', _kbd('tired >= 99 → 10% fall down the stairs'),
      ').',
    ]),
    _row('Auto-NPCs',     ['Any NPC at this room gets an auto greeting line + "Talk to <name>" choice. No wiring needed.']),
  ),

  _section('Story Points tab',
    _row('What it is',  ['A separate tab listing rooms with ', _kbd('kind: story'), ' — narrative arcs (drink-the-beer, fall-down-stairs) that you keep out of the world-map Rooms list for organization. At runtime they\'re identical to scene rooms.']),
    _row('Exits',       ['NOTHING is created by default. You opt in to either: (a) explicit ', _kbd('Choices'),
      ' — same editor as scene rooms; targets include every room incl. other story points (those get a ', span({ style: 'font-family:ui-monospace,monospace' })(['⭐']),
      ' marker in the picker); OR (b) an ', _kbd('On end'), ' Effect — fires on the last page when no Choices exist (single button, label = the page\'s advanceLabel). Set up neither and the player sits on the last page with no exit — your call.']),
    _row('Multi-step end', ['Set ', _kbd('On end'), ' = mode ', _kbd('multi'),
      ' to chain several Effects in order. The classic case is "apply state change AND navigate" — e.g. ',
      _kbd('simple: gold -= 5'), ' then ', _kbd('navigate: drunk'),
      '. Steps can be any Effect mode, including another ', _kbd('multi'),
      ' (recursion), so you can nest as deep as you like.',
    ]),
    _row('Random outcome', ['Set ', _kbd('On end'), ' = mode ', _kbd('random loot table'),
      ' with ', _kbd('navigate'), '-kind entries pointing at other story points. The player walks through your pages, clicks the last button, and the engine rolls for the destination. Same machinery handles weighted alternatives and bonus conditions.']),
    _row('Same-list goto', ['Other story points show up in the regular ', _kbd('Goes to'),
      ' picker of any choice in any room. So a bar room\'s "Drink" choice can ', _kbd('to: drink_beer'),
      ' directly, with no special wiring.']),
  ),

  _section('Effect modes (any Effect field — Choice action, room onEnter / onEnd, item useEffect, combat onWin / onLose, NPC topic onEnter)',
    _row('none',         ['No-op.']),
    _row('simple',       ['List of ops, each ', _kbd('{ target, op, value }'), '. Targets: stat keys, ', _kbd('flags.<key>'), ', ', _kbd('inv.<itemId>'), ', ', _kbd('skills.<id>'), '. Use for state mutations.']),
    _row('simple · per-op ⚙ Advanced', [
      'Each op carries an optional ', _kbd('condition'), ' (same shape as Choice conditions) and ', _kbd('min'), ' / ', _kbd('max'),
      ' clamps. The condition gates that one op only — the rest of the effect still runs — and reads the IN-PROGRESS state, so an earlier op can flip a flag a later op gates on (matches the preview). ',
      'Clamps apply to numeric writes only (stat ', _kbd('add'), ' / ', _kbd('sub'), ' / ', _kbd('set'), ' and inv ', _kbd('give'), ' / ', _kbd('take'), ' / ', _kbd('set'),
      '). Each side is either off or ', _kbd('mul x state[statKey] + const'), ' — leave the stat blank and it collapses to a pure constant. Inv writes also keep an implicit floor of 0 so quantities can\'t go negative.',
    ]),
    _row('simple · use cases', [
      'Conditional item consume (', _kbd('inv.potion'), ' take 1 only when ', _kbd('hp < 10'), '), HP capped to ', _kbd('maxHp'), ' (', _kbd('add hp 20'),
      ' with ', _kbd('max = 1*maxHp + 0'), '), mana floor at 0, gold cap that scales with level (', _kbd('max = 100*level + 0'),
      '). The chevron ⚙ on each op opens the drawer; rows with non-default Advanced get a marker so a glance is enough.',
    ]),
    _row('random loot table', ['Weighted-pick bag with multiple outcomes. See Combats tab → Random outcome.']),
    _row('navigate',     ['Pick a target room (any kind, including story points marked ', span({ style: 'font-family:ui-monospace,monospace' })(['⭐']),
      '). Emits ', _kbd('c.goto(toRoom)'), ' plus a page-idx reset on the target. Use inside ', _kbd('multi'),
      ' to add static navigation to any chain.']),
    _row('multi',        ['List of nested Effects fired in order. Step ↑↓ to reorder, x to delete, + Add step to extend. Composes everything — ',
      _kbd('simple'), ' + ', _kbd('navigate'), ', ', _kbd('randomLoot'), ' + ', _kbd('simple'),
      ', etc. Recursive (', _kbd('multi'), ' can contain ', _kbd('multi'), ').',
    ]),
    _row('oneOf',        ['The universal "pick ONE option" primitive. Each option has a ', _kbd('weight'),
      ', a list of ', _kbd('bonuses'), ' (same shape as on random-loot entries — condition-gated fixed/stat amounts), and ', _kbd('effect'),
      ' which is a fully nested Effect of any mode. Exactly one option fires per call. Lighter than ',
      _kbd('randomLoot'), ' (single pick, no kind dispatch) and more composable — each option is just another Effect, so it can do ',
      _kbd('multi'), '-step compound outcomes, ', _kbd('navigate'), ', or anything else without writing JS.',
    ]),
    _row('talkTo',       ['Open NPC dialogue. Routes through ', _kbd('ctx.talkTo'), ' and remembers the calling scene.']),
    _row('enterCombat',  ['Open combat. Sets up ', _kbd('state._combat'), ' and navigates to ', _kbd('_combat:<id>'), '.']),
    _row('JS body',      ['Free-form ', _kbd('c => { … }'), '. Has access to the game ctx; use ', _kbd('c.setState'), ' / ', _kbd('c.goto'), ' / etc.']),
  ),

  _section('NPCs tab',
    _row('role: dialogue', ['Two conversation systems toggled per-NPC via the ', _kbd('Advanced conversation'), ' switch.']),
    _row('role: shop',     ['Stock list → auto buy buttons. Each entry: ', _kbd('{ itemId, price?, quantity? }'), '. Null price → item default. Null quantity → infinite. Items render as a responsive ', _kbd('repeat(auto-fill, minmax(160px, 1fr))'), ' grid; ', _kbd('item.image'), ' fills the card top when present. The Buy button lives inline on each card and disables itself when the player can\'t afford or the entry is sold out.']),
    _row('role: shop · buyback', [
      'Shops can also ', span({ style: 'font-weight:600' })(['buy back']), ' from the player. ',
      _kbd('shop.buyback'), ' has three modes: ',
      _kbd('none'), ' (sell-only — no Sell buttons), ',
      _kbd('open'), ' (every item in the player\'s inventory), ',
      _kbd('list'), ' (whitelist of items). Sell price is ',
      _kbd('floor(multiplier × item.price.amount)'),
      ' (default ', _kbd('0.8'), ' = 8 gold for an item priced at 10), paid in the item\'s own ',
      _kbd('price.stat'), '. Whitelist rows accept a per-item override multiplier — blank falls back to the shop default. The runtime renders a "Sell to shop" grid under the stock — same card layout (image, name, price, button) — so buy and sell look identical except for the action.',
    ]),
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
    _row('Price (currency)', [
      _kbd('item.price = { stat, amount }'), ' — pick ANY stat as the currency (gold / silver / gems / faith / favour …). Shop entries can override per stock row with their own currency + amount, or leave blank to use the item default. Buy deducts from ',
      _kbd('state[price.stat]'), '.',
    ]),
    _row('consumable',     ['Has a ', _kbd('useEffect'), ' (Effect editor). Use button fires it; the count auto-decrements.']),
    _row('readable',       ['Has a ', _kbd('text'), ' field. Read button shows it in an overlay; ← Close returns.']),
    _row('equipment',      ['Has an ', _kbd('equipSlot'), ' (e.g. ', _kbd('weapon'), ', ', _kbd('head'), '). Equip puts it in ', _kbd('state.equipped[slot]'), ' (item stays in inventory).']),
  ),

  _section('Skills tab',
    _row('catalogue',      ['Top-level list of moves the player can learn. ', _kbd('state.skills'), ' is the array of learned ids.']),
    _row('Damage scaling', ['Final dmg = base + (state.stat x multiplier) + random(0..N). Configurable per skill.']),
    _row('To-hit',         [_kbd('always'), ' / ', _kbd('percent'), ' (1d100 ≤ hit%) / ', _kbd('statRoll'), ' (d20 + stat + bonus ≥ enemy.defense + DC).']),
    _row('Costs',          ['Optional stat cost (e.g. ', _kbd('mana'), ' -3), optional item consume.']),
  ),

  _section('Combats tab',
    _row('Player moves',   ['Comes from ', _kbd('state.skills'), ' + per-combat ', _kbd('extraMoves'), ' (boss-only). No separate move list per combat.']),
    _row('Enemy AI',       ['Each turn: filter actions by ', _kbd('useWhen'), ' rule, then weighted-random. Rules: ', _kbd('always'), ' / ', _kbd('belowHp'), ' / ', _kbd('aboveHp'), ' / ', _kbd('onPlayerMiss'), ' / ', _kbd('js'), '. Actions can be ', _kbd('attack'), ' or ', _kbd('heal'), '.']),
    _row('Outcomes',       [_kbd('onWin'), ' / ', _kbd('onLose'), ' Effects + win/lose rooms + win/lose images + ', _kbd('linkedNpcId'), ' (removes that NPC from the world on win).']),
    _row('Deterministic loot', [_kbd('enemy.loot = { itemId: count }'), ' — fixed bundle added to inventory on win.']),
    _row('Random outcome (mode ', [_kbd('random loot table'), ')',
      '. Each entry has a ', _kbd('weight'), ' + ', _kbd('kind'),
      '. Kinds: ', _kbd('item'), ', ', _kbd('stat'), ' (use this for ANY currency — gold / silver / gems — just pick the key), ',
      _kbd('flag'), ', ', _kbd('navigate'), ' (random room), ', _kbd('learnSkill'), ', ', _kbd('talkNpc'), ' (random NPC dialogue), ',
      _kbd('nothing'), ', ', _kbd('js'), '. So a single Effect mode drives ', span({ style: 'font-weight:600' })(['any decision']),
      ': random loot, random room exit, random skill grant, random NPC encounter. ',
      _kbd('picks'), ' = how many independent rolls; ', _kbd('unique'), ' samples without replacement.',
    ]),
    _row('Weight bonuses',  [
      'Each entry can list ', _kbd('bonuses: [{ condition, amountMode, amount }]'), ' that add to its base weight at roll time. Amount is either ',
      _kbd('fixed'), ' (a literal number) or ', _kbd('stat'), ' (the live value of ', _kbd('state[key]'),
      '). Conditions use the regular Condition editor (always / simple / hasItem / js). So "+5 if gold ≥ 10" is ',
      _kbd('condition: gold >= 10, fixed +5'), '; "+hp" is ', _kbd('condition: always, stat: hp'),
      '. The "Per-roll odds" line under the bag is base-only — actual rolls factor bonuses in.',
    ]),
  ),

  _section('Assets tab',
    _row('Catalogue',      ['Top-level list of every uploaded image/audio/video. Fields elsewhere reference by id (', _kbd('asset:<id>'), '), not by inline data URL.']),
    _row('Defaults',       ['Image WebP quality + max height — applied to new uploads. Audio/video stored verbatim.']),
    _row('Re-use',         ['Same upload can be referenced from many fields without storing twice. Export still writes the file once.']),
  ),

  _section('Folder organization (Rooms / Story Points / NPCs / Items / Assets)',
    _row('Where',        ['Each entry has an optional free-form ', _kbd('folder'), ' field at the bottom of its editor card. Empty = ungrouped (default).']),
    _row('How it groups',['The panel sidebar / asset grid groups entries by ', _kbd('folder'), ' under a collapsible header. Folders are sorted A→Z; ungrouped entries pin to the top under ', _kbd('(no folder)'), '. Until you type a folder anywhere the panel stays flat — zero ceremony.']),
    _row('Autocomplete', ['The Folder field has a native ', _kbd('<datalist>'), ' of folder names already used in the same entity type, so re-using ', _kbd('weapons/swords'), ' is one tap. Nested paths via ', _kbd('/'), ' are pure convention — the engine never parses them.']),
    _row('Runtime',      ['Editor-only. ', _kbd('folder'), ' is not emitted by codegen or used by preview; it ships with project.json so it survives import/export and slot switches.']),
    _row('Collapsed state', [_kbd('state.collapsedFolders[panelKey][folder] = true'), ' tracks closed folders per panel. Lives on the editor store, not on the project — flipping ▾/▸ doesn\'t dirty the project.']),
    _row('Dropdowns',    [
      'Every Select that picks a room / NPC / item / asset is fed through ', _kbd('groupedOptions(list)(toOption)'), ' — entries without a folder stay flat at the top, folders render as native ',
      _kbd('<optgroup label="…">'), ' blocks the browser indents and bolds. Same dropdown across panels (Sidebar / Meta / Combats / Skills / Conditions / Effects / Portrait / AssetInput / LootTable / ChoiceEditor) so the grouping is consistent everywhere.',
    ]),
    _row('Bulk-item lists', ['Flat editors that iterate ALL items (Starting Inventory in Project, deterministic Loot in Combats) also pass through ', _kbd('FolderedList'), '. They use their own ', _kbd('panelKey'), ' (', _kbd('startingInventory'), ' / ', _kbd('loot'), ') so collapse state doesn\'t bleed into the main Items tab.']),
  ),

  _section('🚀 Quick Builder (topbar)',
    _row('What',         ['Four-step MultiStep wizard that scaffolds a base project from a few inputs: title + intro line, player stats, and item names. Click ', _kbd('🚀 New from template'), ' in the topbar.']),
    _row('What it makes',['Five rooms (', _kbd('intro · home · wardrobe · shop · inventory'), '), one shopkeeper NPC (role ', _kbd('shop'), ', located in ', _kbd('shop'), ') stocking every item, ', _kbd('hp'), ' / ', _kbd('gold'), ' guaranteed in stats, items priced at 10 gold each in the ', _kbd('shop'), ' folder, story-intro room as ', _kbd('meta.start'), ', and a sidebar (', _kbd('title · stats · inventory · 🎒 Bag'), ' roomLink) so the inventory room is reachable from anywhere. The inventory room\'s "Back" choice fires ', _kbd('c.back()'), ' so the player returns to whichever room they came from (shop, wardrobe, …) instead of being teleported home.']),
    _row('Non-destructive', ['Builds into a NEW slot (slot name on the Review step, falls back to a slug of the title). Your current slot stays put — switch back via the sidebar slots list any time.']),
    _row('Tweak later',  ['Everything the wizard produces is editable — items default to ', _kbd('kind: misc'), ', rooms are plain scenes, the wardrobe is empty (no layers / bindings). Use the relevant tabs to flesh out details.']),
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
    _row('Additional imports', [
      'Each row produces one ', _kbd('import <binding> from "<specifier>";'),
      ' line at the TOP of the picked generated file (before auto-imports). Binding accepts named ', _kbd('{ markdownToVnode }'),
      ', default ', _kbd('m'), ', namespace ', _kbd('* as Utils'),
      ', or blank for side-effect ', _kbd('import "<specifier>";'),
      '. Use to bring in the dervoJS Markdown renderer, polyfills, or anything your ',
      _kbd('js'), '-mode bodies need.',
    ]),
  ),

  _section('Export tab',
    _row('Source layout',  [_kbd('main.js'), ' / ', _kbd('scenes.js'), ' / ', _kbd('world.js'), ' / ', _kbd('items.js'), ' / ', _kbd('sidebar.js?'), ' / ', _kbd('index.html'), '. Drop next to ', _kbd('src/'), '.']),
    _row('Asset folders',  ['Uploaded media unpacks into ', _kbd('img/'), ' / ', _kbd('audio/'), ' / ', _kbd('video/'), ' subdirs. JS references by relative path.']),
    _row('Per-file preview', ['Click a tab to preview generated source. project.json is the raw schema — round-trips through Import.']),
  ),

  _section('Theme tab — designs the EXPORTED game',
    _row('Where it lives',  ['Tokens are saved on ', _kbd('project.meta.themeOverrides'), '; custom CSS on ', _kbd('project.meta.gameCss'), '. Both travel with project.json and are baked into the exported game by codegen.']),
    _row('Token editor',    ['Every CSS variable is editable inline. Changing ', _kbd('--accent'), ' (etc.) on a project rewrites every Button, Badge, and Scene chrome that uses that token. Edits paint live; the ', _kbd('x'), ' next to a row clears that override back to the default.']),
    _row('Side-effect',     ['Token overrides also paint the editor itself (since editor + game share the same CSS-custom-property system). You\'re looking at your own game\'s palette while you work — that\'s the point.']),
    _row('Topbar 🌗 / 🌞',   ['Editor comfort only — toggles the light/dark base palette for the editor chrome. Does NOT travel with the project; does NOT affect the exported game.']),
    _row('Live mini-game',  ['A built-in project runs in a small window using ', _kbd('buildGameConfig → createGame → mount'), ' — the same pipeline the export uses. Exercises every surface: scene pages (inn / road), NPC dialogue (Mara), shop (Brom), inventory room (bag) reached via a sidebar roomLink, combat (goblin) with enemy art, and a sidebar with title + stats + inventory widgets. Items use inline SVG assets via the ', _kbd('asset:<id>'), ' catalogue, so the image / asset path also gets exercised. Token + CSS edits repaint instantly via the CSS-variable cascade; ', _kbd('↻ Restart'), ' resets play state.']),
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
    _row('Shop NPC',        ['Each stock entry auto-builds a buy choice: ', _kbd('state[price.stat] >= price.amount && remaining > 0'), '; subtracts from that currency stat, gives item. Price can be a different currency per stock row.']),
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
    _row('Damage formula',  [_kbd('base + (state[damageStat] x damageStatMul) + randInt(0..damageRandom)'), ' - enemy.defense.']),
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
    'state._lootLog          // [string] last 8 "Loot: …" lines from randomLoot picks',
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

  _section('"+5 if gold > 7 and flagX set, else +luck" weighted pick (universal oneOf)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Use ', _kbd('oneOf'), ' anywhere you want one outcome from a weighted bag. ',
      'Two options, ', _kbd('common'), ' (weight 1) and ', _kbd('special'),
      ' (weight 10). On ', _kbd('special'),
      ' add bonuses: (1) condition ', _kbd('always'), ', amount ', _kbd('stat: luck'),
      ' (adds the live value of state.luck); (2) condition ',
      _kbd('js: c.state.gold > 7 && c.state.flags.flagX'),
      ', amount ', _kbd('stat: charm'),
      '. Each option\'s ', _kbd('effect'),
      ' is whatever you want — ', _kbd('multi'), ' for compound outcomes, ', _kbd('navigate'),
      ' to jump to a room, ', _kbd('simple'),
      ' for state ops, or another ', _kbd('oneOf'),
      ' for sub-pickers. The effective weight at roll time is ',
      _kbd('base + luck + (gold > 7 && flagX ? charm : 0)'),
      ' — exactly the user\'s mental model.',
    ]),
  ),

  _section('Beer-bar story chain: random dark/light, branch on choice, multi-step end',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Five story points: ', _kbd('drink_beer'), ' (the trigger), ', _kbd('dark_beer'),
      ', ', _kbd('light_beer'), ', ', _kbd('drunk'), ', and world rooms ', _kbd('alley'),
      ' + ', _kbd('home'), '. In ', _kbd('drink_beer'), ' set ', _kbd('On end'),
      ' = mode ', _kbd('random loot table'), ' with two ', _kbd('navigate'),
      ' entries (weight 1 each → dark_beer / light_beer). No Choices needed — the Continue button rolls and routes. ',
      _kbd('dark_beer'), ' gets two Choices: "Reject" → ', _kbd('to: bar'),
      '; "Accept" → ', _kbd('to: drunk'), '. ', _kbd('light_beer'),
      ' has no Choices and ', _kbd('On end'), ' = mode ', _kbd('navigate'),
      ' targeting ', _kbd('drunk'), '. Then ', _kbd('drunk'),
      ' has ', _kbd('On end'), ' = mode ', _kbd('multi'),
      ' with two steps: step 1 ', _kbd('simple: drunkenness +1'),
      ', step 2 a nested ', _kbd('randomLoot'), ' with weighted ', _kbd('navigate'),
      ' entries (alley + bonus condition ', _kbd('gold >= 200'), ' fixed ', _kbd('+9'),
      ' → 90% alley when rich, 100% home when broke). Stat change AND navigation in one shot, no JS.',
    ]),
  ),

  _section('Weighted detour goto: "normally to the street, but tired ≥ 99 → 10% fall down stairs"',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'On the choice "Walk to the street", set ', _kbd('to: street'),
      ' (the default). Then set the choice\'s ', _kbd('action'), ' = mode ',
      _kbd('random loot table'),
      ' with TWO ', _kbd('navigate'), ' entries: (a) ', _kbd('street'),
      ' weight 9, (b) ', _kbd('fall_down_stairs'),
      ' weight 0 + a single weight bonus (condition: ', _kbd('tired >= 99'),
      ', amount fixed ', _kbd('+1'),
      '). When tired < 99, both rolls land on street (9 vs 0). When tired ≥ 99, the bag is 9 vs 1 → 10% to fall_down_stairs. The choice\'s ',
      _kbd('to: street'), ' still acts as the safety net if the loot table picks ',
      _kbd('nothing'), '.',
    ]),
  ),

  _section('Goblin drops random loot on death (50/30/20 split)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Combats tab → pick the combat → ', _kbd('On win'), ' effect → mode ', _kbd('random loot table'),
      '. ', _kbd('Picks'), ' = 1, ', _kbd('Unique'), ' off. Three entries: weight ',
      _kbd('5'), ' = ', _kbd('item potion x 1–2'), '; weight ', _kbd('3'), ' = ',
      _kbd('stat gold +10..25'), ' (any stat works — use ', _kbd('silver'), ' or ', _kbd('gems'),
      ' instead for multi-currency games); weight ', _kbd('2'), ' = ', _kbd('nothing'),
      '. The "Per-roll odds" line under the bag shows the percentages live (50% / 30% / 20%).',
    ]),
  ),

  _section('Random next room (3 destinations, one with luck-based bonus)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Choice action → mode ', _kbd('random loot table'), '. Three entries, all ', _kbd('kind: navigate'),
      ' pointing at different rooms. Give the "best" room a weight bonus: condition ',
      _kbd('stat: luck >= 3'), ', amount fixed ', _kbd('+10'), '. Now lucky players overwhelmingly land in the good room while unlucky players see all three roughly equally.',
    ]),
  ),

  _section('Random skill grant (weighted toward your highest stat)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Item useEffect → mode ', _kbd('random loot table'), '. Each entry ',
      _kbd('kind: learnSkill'), ' for a different skill. On each entry add ONE bonus: condition ',
      _kbd('always'), ', amount ', _kbd('stat: <relevant stat>'),
      '. So the strength-based skill is weighted by ', _kbd('state.str'),
      ', the intelligence skill by ', _kbd('state.int'), ', etc.',
    ]),
  ),

  _section('"+5% if you have ≥10 gold" via weight bonuses',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Set the rare-outcome entry\'s base weight low (say ', _kbd('5'),
      '). Add a bonus: condition simple ', _kbd('gold >= 10'),
      ', amount fixed ', _kbd('+5'),
      '. Players with enough gold see this outcome twice as often — same table, no separate path.',
    ]),
  ),

  _section('Open-a-chest chooses ONE of three rewards (unique picks)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Add a room choice "Open chest" with action mode ', _kbd('random loot table'),
      '. ', _kbd('Picks'), ' = 1, ', _kbd('Unique'), ' = on. Three equal-weight entries: ',
      _kbd('sword x 1'), ', ', _kbd('shield x 1'), ', ', _kbd('potion x 3'),
      '. The player gets exactly one. Add a one-shot guard on the choice (', _kbd('!flags.chestOpened'),
      ') + a sibling simple-mode effect that sets ', _kbd('flags.chestOpened'), ' = true so the chest can only be opened once.',
    ]),
  ),

  _section('Treasure room with multi-pick drop (3 rolls, repeats OK)',
    p({ style: 'margin:0 0 6px; font-size:12.5px' })([
      'Room onEnter → mode ', _kbd('random loot table'), ', ', _kbd('picks'), ' = 3, ',
      _kbd('unique'), ' off. Six entries with varied weights and a heavy ', _kbd('nothing'),
      ' entry so most rolls miss. Result: the player walks in and gets a flavourful 0–3 item drop. ',
      _kbd('state._lootLog'), ' captures the resulting "Loot: …" lines — show them via a JS sidebar widget if you want them visible.',
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
      li({})(['Stat multiplier: ', _kbd('2'), ' (i.e. +2xSTR)']),
      li({})(['Random 0..N: ', _kbd('6')]),
    ]),
    p({ style: 'margin:6px 0 0; font-size:12px; color:var(--text-muted)' })([
      'Result: a base 2 + 2xSTR + 0..6 swing.',
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
