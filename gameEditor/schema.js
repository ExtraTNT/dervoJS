/**
 * Project schema for the gameEditor.
 *
 * Everything is plain JSON so the project round-trips through save/load and
 * the codegen pass can read it the same way the in-place preview interpreter
 * does. No JS in the structure itself - JS scriptlets, when the author opts
 * into them, live as strings on Condition.expr / Effect.body, and are
 * evaluated (in preview) or emitted verbatim (in codegen).
 *
 * Shape:
 *   Project { meta, stats[], flags[], items[], rooms[], npcs[] }
 *   Meta    { title, start, defaultMusic }
 *   Stat    { key, initial:number }
 *   Flag    { key, initial:boolean }
 *   Item    { id, name, description, image, price, kind, stats:{} }
 *   Room    { id, title, music, onEnter:Effect, pages:Page[], choices:Choice[] }
 *   Npc     { id, name, locations, greeting, portrait, role, pages, choices,
 *             shop:{ stock:[{itemId, price?, quantity?}] } }
 *   Page    { id, text, image, video, advanceLabel }
 *   Choice  { id, label, to, condition:Condition, action:Effect }
 *
 *   Condition.mode: 'always' | 'simple' | 'hasItem' | 'js'
 *     simple : { key, op, value }              stat or flag check
 *     hasItem: { itemId, op:'>=', count }      inventory check
 *     js     : { expr }                        freeform predicate over `c`
 *
 *   Effect.mode: 'none' | 'simple' | 'js'
 *     simple : { ops:[Op] }   each Op = { target, op, value }
 *       target = stat key, 'flags.<flag>', 'inv.<itemId>', 'gold' etc.
 *       op     = 'set' | 'add' | 'sub' | 'toggle' | 'give' | 'take'
 *     js     : { body }       freeform body, has access to `c`
 *
 * Reserved player-state keys when items are used:
 *   inventory : { [itemId]: count }
 */

const _rid = () => Math.random().toString(36).slice(2, 9);

// Stat declarations grew a `type` so authors can model gender (string),
// learned languages (array), or anything else past plain numbers. The
// engine has always accepted non-numeric state values - only the editor
// surface lagged. Curried factory: `emptyStat(type)(key)`.
const emptyStat = type => key => {
  const t = type === 'string' || type === 'array' ? type : 'number';
  const initial = t === 'number' ? 0 : t === 'string' ? '' : [];
  return { key, type: t, initial };
};

// Step normaliser - accepts a raw step from disk and fills in missing
// fields per its declared type. Unknown types fall back to 'choice'.
const _normaliseCcStep = s => {
  const type = s?.type === 'pointBuy' ? 'pointBuy' : 'choice';
  const base = { id: s?.id || `step_${_rid()}`, type, title: s?.title ?? '', prompt: s?.prompt ?? '' };
  if (type === 'pointBuy') {
    return {
      ...base,
      budget: Number(s?.budget) || 0,
      stats: Array.isArray(s?.stats)
        ? s.stats.map(r => ({
            statKey: r?.statKey || '',
            min:     Number(r?.min) || 0,
            max:     Number.isFinite(Number(r?.max)) ? Number(r.max) : 10,
            start:   Number(r?.start) || 0,
          }))
        : [],
    };
  }
  return {
    ...base,
    options: Array.isArray(s?.options)
      ? s.options.map(o => ({
          id:          o?.id || `opt_${_rid()}`,
          label:       o?.label ?? '',
          description: o?.description ?? '',
          image:       o?.image ?? '',
          effect:      o?.effect && typeof o.effect === 'object' ? o.effect : { mode: 'none' },
          startRoom:   o?.startRoom ?? '',
        }))
      : [],
  };
};

const _normaliseStat = s => {
  const type = s?.type === 'string' || s?.type === 'array' ? s.type : 'number';
  let initial;
  if (type === 'number')      initial = Number(s?.initial) || 0;
  else if (type === 'string') initial = typeof s?.initial === 'string' ? s.initial : '';
  else                        initial = Array.isArray(s?.initial) ? s.initial.map(String) : [];
  return { key: s?.key || '', type, initial };
};

// NPC-scoped state declarations - same idea as stats, but namespaced per NPC
// (state.npcVars[npcId][key]) and one type richer: number | string | array |
// object. Curried factory to match emptyStat's `type => key` shape.
const emptyNpcVar = type => key => {
  const t = ['string', 'array', 'object'].includes(type) ? type : 'number';
  const initial = t === 'number' ? 0 : t === 'string' ? '' : t === 'array' ? [] : {};
  return { key, type: t, initial };
};

const _normaliseNpcVar = v => {
  const type = ['string', 'array', 'object'].includes(v?.type) ? v.type : 'number';
  let initial;
  if (type === 'number')      initial = Number(v?.initial) || 0;
  else if (type === 'string') initial = typeof v?.initial === 'string' ? v.initial : '';
  else if (type === 'array')  initial = Array.isArray(v?.initial) ? v.initial.map(String) : [];
  else                        initial = (v?.initial && typeof v.initial === 'object' && !Array.isArray(v.initial)) ? v.initial : {};
  return { key: v?.key || '', type, initial };
};

const emptyCondition = () => ({
  mode: 'always',
  key: '', op: '>=', value: 0,    // simple
  itemId: '', count: 1,           // hasItem
  expr: '',                       // js
  p: 0.25,                        // random - Math.random() < p
});

// A numeric clamp evaluated against state at runtime. Enabled limits resolve
// to `mul * state[statKey] + const`; statKey === '' makes it a pure constant
// (mul * 0 + const = const). Disabled = no clamp on that side.
//
//   { enabled: true,  statKey: 'maxHp', mul: 1, const: 0 } → state.maxHp
//   { enabled: true,  statKey: '',      mul: 0, const: 0 } → 0    (hard floor)
//   { enabled: true,  statKey: 'level', mul: 2, const: 5 } → 2*level + 5
const emptyOpLimit = () => ({ enabled: false, statKey: '', mul: 0, const: 0 });

// A single op inside an Effect's simple-mode `ops` array.
// Beyond the bare { target, op, value } shape, every op may carry an optional
//   - condition: regular Condition object - when not 'always', the op is
//                gated by the condition (false → skip this op, others still run)
//   - min / max: emptyOpLimit clamps applied to the post-arithmetic value
//                (stat add/sub/set, inv give/take/set). Skill / flag / toggle
//                ops ignore them.
const emptyOp = () => ({
  target:    '',
  op:        'add',
  value:     0,
  // Only meaningful when op === 'setField' on an object-typed npc var - the
  // key written INSIDE the object. Ignored by every other target/op combo.
  field:     '',
  condition: emptyCondition(),
  min:       emptyOpLimit(),
  max:       emptyOpLimit(),
});
const emptyEffect = () => ({
  mode: 'none',
  ops:     [],        // simple
  body:    '',        // js
  table:   null,      // randomLoot - populated lazily by EffectEditor on mode switch
  toRoom:  '',        // navigate   - target room id (any kind, including story)
  steps:   [],        // multi      - array of nested Effects, fired in order
  options: [],        // oneOf      - weighted picks; one option's effect fires
  // Optional message template. After this effect fires, the rendered message
  // is pushed onto state._messageQueue. The next scene render displays the
  // accumulated queue as a "Continue" interstitial. Empty → no message.
  // Template scope: `state`, `init` (state snapshot pre-action), `gain` /
  // `loss` (per-key positive / negative deltas). See StateExplorer.
  message: '',
});

// One row in a random table - weight + a single outcome. `kind` decides which
// of the kind-specific fields are read. Count / stat ranges use inclusive
// min/max; equal values give a deterministic amount.
//
//   item       → give itemId x randInt(countMin..countMax)
//   stat       → state[statKey] += randInt(statMin..statMax)
//                (use this for ANY currency - gold, silver, gems - just pick the key)
//   flag       → state.flags[flagKey] = flagValue
//   navigate   → c.goto(roomId)          random destination
//   learnSkill → adds skillId to state.skills (no-op if already known)
//   talkNpc    → c.talkTo(npcId, c.scene) random NPC dialogue from a pool
//   nothing    → no outcome (use to model "X% chance of nothing")
//   js         → free-form body, has access to `c` - for anything else
//
// Weight bonuses (per entry) can raise the effective weight at roll time based
// on stat/flag/inventory conditions; see emptyWeightBonus below.
const emptyLootEntry = () => ({
  id:       _rid(),
  weight:   1,
  kind:     'item',
  // item
  itemId:   '',
  countMin: 1,
  countMax: 1,
  // stat (also used for any currency: gold / silver / gems / etc.)
  statKey:  '',
  statMin:  0,
  statMax:  0,
  // flag
  flagKey:  '',
  flagValue: true,
  // navigate / talkNpc / learnSkill
  roomId:   '',
  npcId:    '',
  skillId:  '',
  // js
  jsBody:   '',
  // weight bonuses - see emptyWeightBonus
  bonuses:  [],
  // Optional message template - pushed onto state._messageQueue when this
  // entry is PICKED. Multi-pick tables accumulate one message per pick.
  message:  '',
});

// One conditional weight bonus on a random-table entry.
//   condition  : a regular Condition (always / simple / hasItem / js)
//                - when it evaluates truthy, the bonus applies
//   amountMode : 'fixed'  → add `amountFixed`
//                'stat'   → add Number(state[amountStat]) || 0
// So "+5 if gold >= 10" = condition: stat gold >= 10, amountMode: fixed, amountFixed: 5
//    "+hp"              = condition: always,         amountMode: stat, amountStat: 'hp'
const emptyWeightBonus = () => ({
  id:          _rid(),
  condition:   emptyCondition(),
  amountMode:  'fixed',
  amountFixed: 1,
  amountStat:  '',
});

// Loot table - a weighted bag of entries that the engine rolls against on the
// `randomLoot` Effect mode. `picks` independent rolls are made; `unique: true`
// removes the entry from the bag after it's picked (sampling without
// replacement), which is right for chest contents. `showFlavour` appends a
// "Loot: …" log line to the active scene's body (combat-log style).
const emptyLootTable = () => ({
  picks:       1,
  unique:      false,
  showFlavour: true,
  entries:     [emptyLootEntry()],
});

// One option in a `oneOf` Effect: a weighted bag where exactly ONE option's
// Effect fires per roll. Each option holds a full nested Effect (so it can be
// `multi` / `navigate` / `randomLoot` / anything) plus the same weight + bonus
// shape used by loot entries - so a single roll can do compound state changes,
// stat bumps, navigation, etc., with dynamic odds based on stats / flags /
// inventory. The label is purely for the editor / odds-preview line.
const emptyOneOfOption = () => ({
  id:      _rid(),
  label:   'Option',
  weight:  1,
  bonuses: [],         // [WeightBonus] - same shape as on a LootEntry
  effect:  emptyEffect(),
});

// Item kinds drive how the inventory room interacts with the item:
//   consumable → "Use" button that fires useEffect, then decrements by 1
//   readable   → "Read" button that opens the text inline
//   equipment  → "Equip" / "Unequip" that toggles state.equipped[equipSlot]
//   key / misc → no action button (display-only)
// Price = a stat-key + amount. Gold is the default for newly-created items,
// but any stat works (silver, gems, faith, etc.) so the project can model
// multiple currencies. Equal values give a deterministic cost.
const emptyPrice = (stat = 'gold', amount = 0) => ({ stat, amount });

const emptyItem = (id = `item_${_rid()}`) => ({
  id,
  name:        'New Item',
  description: '',
  image:       '',
  price:       emptyPrice(),    // { stat, amount }
  kind:        'misc',          // 'consumable' | 'equipment' | 'readable' | 'key' | 'misc'
  folder:      '',              // free-form path - '' = ungrouped; e.g. 'weapons' or 'consumables/food'
  // Per-kind behaviour (each is ignored when the kind doesn't apply):
  useEffect:   emptyEffect(),   // consumable - fires on Use
  text:        '',              // readable   - rendered in the reading overlay
  equipSlot:   '',              // equipment  - slot key (e.g. 'weapon', 'armor', 'head')
});

const emptyShopEntry = (itemId = '') => ({
  itemId,
  price:    null,        // null → use item.price (also a { stat, amount })
  quantity: null,        // null → infinite
});

// One whitelist entry on shop.buyback when mode === 'list'.
//   multiplier: null → fall back to shop.buyback.multiplier (the shop default).
//   Any number → per-item override (e.g. potions worth 0.5x, gems worth 1.2x).
const emptyBuybackItem = (itemId = '') => ({
  itemId,
  multiplier: null,
});

// Shop buyback config - what the NPC will buy back from the player.
//   mode: 'none' - shop only sells, no Sell buttons rendered
//         'list' - only items in `items[]` are buyable; per-item multiplier optional
//         'open' - everything in the player's inventory is buyable at `multiplier`
//   multiplier: default fraction of item.price.amount the shop pays
//               (0.8 → sell to shop for 8 gold an item priced at 10 gold).
// Sell price stat = the item's own price.stat - so a sword priced in gold is
// bought back for gold; one priced in gems for gems.
const emptyBuyback = () => ({
  mode:       'none',
  multiplier: 0.8,
  items:      [],
});

// Normalise a possibly-undefined / partial buyback config. Missing fields
// fall back to emptyBuyback() defaults so old projects load cleanly.
const _normaliseBuyback = b => {
  if (!b || typeof b !== 'object') return emptyBuyback();
  const mode = b.mode === 'list' || b.mode === 'open' ? b.mode : 'none';
  const mul  = Number.isFinite(Number(b.multiplier)) ? Number(b.multiplier) : 0.8;
  const items = Array.isArray(b.items)
    ? b.items.map(it => ({
        itemId:     it?.itemId || '',
        multiplier: it?.multiplier == null ? null : (Number.isFinite(Number(it.multiplier)) ? Number(it.multiplier) : null),
      }))
    : [];
  return { mode, multiplier: mul, items };
};

// Normalise legacy / partial price values. Accepts:
//   number      → { stat: 'gold', amount: N }
//   { stat, amount } → as-is
//   null/undefined → null (= use the item default in shop context)
const _normalisePrice = p => {
  if (p == null) return null;
  if (typeof p === 'number') return { stat: 'gold', amount: Math.max(0, p) };
  if (typeof p === 'object') return { stat: p.stat || 'gold', amount: Math.max(0, Number(p.amount) || 0) };
  return { stat: 'gold', amount: 0 };
};

// Sidebar widgets shown in the in-game left column. Each widget has a `type`
// that the preview interpreter / codegen knows how to render.
const emptyPortraitLayer = (name = 'layer') => ({
  id:           _rid(),
  name,
  defaultImage: '',
  bindings:     [],   // [{ itemId, image }]  first matching binding wins
});

const emptyWidget = (type = 'stats') => {
  switch (type) {
    case 'title':     return { id: _rid(), type, label: '' };
    case 'portrait':  return { id: _rid(), type, width: 220, height: 280, layers: [emptyPortraitLayer('body')] };
    case 'stats':     return { id: _rid(), type, keys: [] };           // empty → show all stats
    case 'inventory': return { id: _rid(), type, layout: 'list' };     // 'list' | 'grid'
    case 'roomLink':  return { id: _rid(), type, label: 'Open', roomId: '', icon: '' };
    // Minimap - auto-discovers reachable rooms via BFS from meta.start,
    // tracks visited via state._mapVisited (updated as the player enters
    // rooms), highlights the current scene. No room list needed.
    case 'minimap':   return { id: _rid(), type, label: 'Map', cols: 3, showLabels: false, dimUnvisited: true, range: 0, width: 0, visitedOnly: false, reach: 0, zoom: 0, fastTravel: false };
    case 'js':        return { id: _rid(), type, label: 'JS widget', body: '// receives `ctx`; bound: state, ctx, div, span, p, h3, img, video, button\nreturn div({ style: \'padding:6px 8px; border:1px solid var(--border); border-radius:var(--radius); font-size:12px\' })(["HP: " + state.hp]);' };
    default:          return { id: _rid(), type };
  }
};

// Skills - a top-level catalogue. The player learns skills (stored in
// state.skills as an array of ids) and uses them during combat. Effects can
// give/take skills via the `simple` op family (target `skills.<id>` op
// `learn`/`forget`) or via JS bodies.
//
// Damage formula at runtime:
//   final = base + (state[damageStat] * damageStatMul) + randInt(0, damageRandom)
// Same shape applies to heal (selfHeal + selfHealStat + selfHealRandom).
//
// To-hit:
//   'always'   - always lands (default)
//   'percent'  - flat hitPercent% chance
//   'statRoll' - d20 + state[hitStat] + hitBonus vs enemy.defense + hitDc
const emptySkill = (id = `skill_${_rid()}`) => ({
  id,
  name:        'New Skill',
  kind:        'attack',           // 'attack' | 'spell' | 'heal' | 'item'
  // damage to enemy
  damage:          1,              // base
  damageStat:      '',             // optional stat that scales damage
  damageStatMul:   1,              // multiplier on that stat
  damageRandom:    0,              // adds randInt(0, N) - set to 6 for "+1d6"-ish feel
  // heal self
  selfHeal:        0,
  selfHealStat:    '',
  selfHealStatMul: 1,
  selfHealRandom:  0,
  // costs
  costStat:    '',                 // e.g. 'mana'
  costValue:   0,
  costItem:    '',                 // itemId consumed
  requireItem: '',                 // itemId required (not consumed)
  // to-hit
  hitMode:     'always',           // 'always' | 'percent' | 'statRoll'
  hitPercent:  100,                // for 'percent'
  hitStat:     '',                 // for 'statRoll' - stat added to d20
  hitBonus:    0,                  // for 'statRoll' - flat bonus
  hitDc:       10,                 // for 'statRoll' - vs (enemy.defense + this)
  // presentation - image + flavour shown briefly after use
  image:        '',
  flavourText:  '',
  description:  '',
});

// Per-combat "extra moves" remain available - useful for one-off boss-only
// attacks. Same shape as skills.
const emptyCombatMove = (label = 'Attack') => ({
  id:           _rid(),
  label,
  kind:         'attack',
  damage:       1,
  selfHeal:     0,
  costStat:     '',
  costValue:    0,
  costItem:     '',
  image:        '',
  flavourText:  '',
  requireItem:  '',
  condition:    emptyCondition(),
});

// Enemy AI action - every turn, the engine filters actions by their `useWhen`
// rule, then picks weighted-random among the survivors.
//
// useWhen options:
//   'always'       - always available
//   'belowHp'      - enemy HP <= hpThreshold% of max
//   'aboveHp'      - enemy HP >  hpThreshold% of max
//   'onPlayerMiss' - last player skill missed
//   'js'           - author writes their own predicate over `{ enemy, state }`
const emptyEnemyAction = (label = 'Strike') => ({
  id:     _rid(),
  label,
  kind:   'attack',                // 'attack' | 'heal'  (heal restores enemy HP)
  // damage / heal magnitude (with optional randomness)
  damage:       3,
  damageRandom: 0,
  healAmount:   0,
  healRandom:   0,
  // to-hit (always for heal)
  hitPercent:   100,
  // selection rule
  weight:       1,                 // base weight in the weighted-random pick
  useWhen:      'always',          // see header
  hpThreshold:  50,                // for belowHp / aboveHp - percent of enemy max HP
  jsCondition:  '',                // for useWhen='js'
  // presentation - image + flavour shown when this action fires
  image:        '',
  flavourText:  '',
});

const emptyCombat = (id = `combat_${_rid()}`) => ({
  id,
  name:    'New Encounter',
  enemy: {
    name:    'Goblin',
    hp:      8,
    defense: 0,                       // subtracted from each player skill's damage (min 0)
    image:   '',
    actions: [emptyEnemyAction()],    // AI picks weighted-random each turn
    loot:    {},                      // { itemId: count } - added to player.inventory on win
  },
  playerStat:  'hp',          // which player stat takes damage
  intro:       '',            // flavour shown above the move list at combat start
  // Per-combat extra moves available IN ADDITION to player's learned skills.
  // Leave empty to use only state.skills.
  extraMoves:  [],
  winRoom:     '',            // '' → fall through to caller via state._combatReturnTo
  loseRoom:    '',
  winText:     'You won!',
  loseText:    'You were defeated.',
  winImage:    '',            // shown on the win outcome screen instead of greyed enemy
  loseImage:   '',
  // Effect applied on outcome - same schema as Choice action. Use simple-mode
  // ops to grant gold/items/skills, or JS for richer logic.
  onWin:       emptyEffect(),
  onLose:      emptyEffect(),
  linkedNpcId: '',            // if set: NPC is removed from world on win
});

// Character creation - an optional pre-game wizard. When enabled and
// `steps` is non-empty, the engine renders the steps in order before the
// player ever sees `meta.start`. Two step types so far:
//
//   - pointBuy: distribute `budget` across selected numeric stats with
//     per-stat min/max. State is patched stat-by-stat when the player
//     advances. Strings/arrays don't show here (point-buy is arithmetic).
//
//   - choice:   pick ONE option. Each option runs an Effect on selection
//     (drop ops on stats, flags, inventory, …), can OPTIONALLY set the
//     starting room (so background A spawns in the woods and background
//     B spawns at home), the player portrait (a string stat `portrait`,
//     or any stat the author wires), or a free-form image displayed
//     during the wizard.
//
// At runtime the engine stashes progress in `state._cc = { step, picks }`.
// Once every step is done, `state._cc.done = true` and the engine swaps
// `_scene` to the resolved start room (last choice with a non-empty
// `startRoom` wins; otherwise meta.start).
const emptyCharCreationStep = (type = 'choice') => {
  const id = `step_${_rid()}`;
  if (type === 'pointBuy') {
    return {
      id, type,
      title:  'Allocate stat points',
      prompt: 'Distribute the points across your stats.',
      budget: 10,
      // [{ statKey, min, max, start }] - only numeric stats make sense.
      stats:  [],
    };
  }
  return {
    id, type: 'choice',
    title:  'Choose your background',
    prompt: 'Pick one:',
    options: [],
  };
};

const emptyCharCreationOption = () => ({
  id:          `opt_${_rid()}`,
  label:       'New option',
  description: '',
  image:       '',                     // shown in the option card during the wizard
  // Effect runs against the live state on selection - any Effect mode is
  // valid, but `simple` mode is the natural fit (set gender, +1 to STR, …).
  effect:      { mode: 'none' },
  // Override `meta.start` when set. Empty = no override.
  startRoom:   '',
});

const emptyCharCreation = () => ({
  enabled: false,
  steps:   [],
});

const emptySidebar = () => ({
  enabled: false,
  // CSS string for `--sidebar-width` (e.g. `'320px'`, `'20rem'`, `'min(30vw, 380px)'`).
  // Empty = use the engine default (240px, defined in dervo.css). The token is
  // applied to :root at game-mount time so it overrides the stylesheet default.
  width:   '',
  widgets: [],
});

const emptyPage = () => ({
  id:            _rid(),
  text:          '',
  image:         '',
  video:         '',
  advanceLabel:  'More',
});

// Choice navigation `flow`. The Choice editor picks one of these and the
// renderer hands the player off accordingly AFTER the action's Effect fires.
//   'navigate'   - simple/legacy: goto `to` (or stay if to:''). Used everywhere
//                  outside the advanced topic system (rooms, simple NPCs).
//   'stay'       - advanced topics only: fire the Effect and re-render the
//                  CURRENT topic page. Use for "give me an item", "tell me
//                  more (NPC says something, no nav)", etc. No picker needed.
//   'change'     - advanced topics only: PUSH current topic on the stack and
//                  switch to `topicId`. Used to dive into a sub-conversation.
//   'exitBack'   - advanced topics only: POP the topic stack. If empty, leaves
//                  the NPC and returns to the calling room.
//   'exitRoom'   - advanced topics only: leave the NPC entirely and goto `to`.
//                  (`to: ''` falls back to the calling room.)
//   'exitCombat' - advanced topics only: leave the NPC and start `combatId`.
const emptyChoice = () => ({
  id:        _rid(),
  label:     'New choice',
  to:        '',
  condition: emptyCondition(),
  action:    emptyEffect(),
  flow:      'navigate',
  topicId:   '',
  combatId:  '',
});

// NPC topic - a self-contained "conversation thread" (like a tiny scene).
//   `name`     - short label shown on the tree node + the topic editor header
//   `onEnter`  - fires the first time the topic is entered each visit
//   `pages`    - its own page sequence (More advances), same shape as room pages
//   `choices`  - post-last-page choices; use flow:'change' to dive deeper,
//                'exitBack' to pop back, 'exitRoom'/'exitCombat' to leave entirely
const emptyTopic = () => ({
  id:      `topic_${_rid()}`,
  name:    'New topic',
  onEnter: emptyEffect(),
  pages:   [emptyPage()],
  choices: [],
});

const emptyRoom = (id = `room_${_rid()}`) => ({
  id,
  kind:             'scene',     // 'scene' | 'wardrobe' | 'inventory' | 'story'
  title:            'New Room',
  folder:           '',          // free-form path - '' = ungrouped
  music:            '',
  // Opt-out switch for visualisations (Graph tab + in-game minimap widget).
  // Story rooms (kind:'story') are filtered automatically regardless; this
  // flag lets authors hide scene/wardrobe/inventory rooms too - useful for
  // dream-sequence rooms, hub rooms with portals, intermediate "void"
  // rooms, etc. that shouldn't show on the player's map.
  hideOnMap:        false,
  onEnter:          emptyEffect(),
  onEnterCondition: emptyCondition(),    // 'always' by default - gate onEnter behind a flag/stat/js check
  pages:            [emptyPage()],
  choices:          [],
  // Optional end-of-dialog Effect. When the player reaches the last page AND
  // no Choice navigates, this Effect runs (single "Continue" button labelled
  // by the last page's advanceLabel). Nothing is auto-created - devs opt in.
  // Common uses: simple ops (set state), randomLoot navigate (random outcome),
  // js body (free-form). When empty, the player is on the last page with no
  // exit - that's the author's choice.
  onEnd:            emptyEffect(),
  // Wardrobe-only fields (ignored for kind:'scene'). Pre-seeded so flipping the
  // kind via the editor instantly has working defaults.
  wardrobe: {
    portraitWidth:  240,
    portraitHeight: 320,
    layers:         [],     // same shape as portrait widget layers
    kinds:          ['equipment'],
  },
});

const emptyWardrobeRoom = (id = `wardrobe_${_rid()}`) => ({
  ...emptyRoom(id),
  kind:    'wardrobe',
  title:   'Wardrobe',
  pages:   [emptyPage()],
  wardrobe: {
    portraitWidth:  240,
    portraitHeight: 320,
    layers:         [emptyPortraitLayer('body')],
    kinds:          ['equipment'],
  },
});

// Story room - a "narrative beat" room that lives in the Story Points tab
// instead of the world map. Engine treats it as a scene room with one extra:
// the `onEnd` Effect (inherited from emptyRoom) fires via an auto-Continue
// button on the last page IF no Choice exists AND onEnd is configured. Both
// Choices and onEnd are entirely opt-in - nothing is created by default.
const emptyStoryRoom = (id = `story_${_rid()}`) => ({
  ...emptyRoom(id),
  kind:  'story',
  title: 'New Story Point',
});

// Inventory room - paper-doll's plain counterpart. Shows EVERY item the
// player is carrying (optionally filtered by kind), with image + name +
// description + count. Choices below for navigation.
const emptyInventoryRoom = (id = `inventory_${_rid()}`) => ({
  ...emptyRoom(id),
  kind:    'inventory',
  title:   'Inventory',
  pages:   [emptyPage()],
  inventory: {
    kinds:           [],          // [] = show all kinds; or filter ['consumable', …]
    layout:          'grid',      // 'grid' | 'list'
    showDescription: true,
    emptyMessage:    'You are not carrying anything.',
  },
});

// NPC variant - an alternate set of fields applied on top of the base NPC
// when its condition passes. First-match wins; nothing matches = base NPC
// stays unchanged. Lets one NPC react to player stats (e.g. greet a male
// player as "sir", swap their portrait when wearing a uniform).
//
// `overrides` is a partial NPC: any field present overrides the base one.
// Empty strings / empty arrays are treated as "no override" so authors
// don't have to copy unchanged fields.
const emptyNpcVariant = () => ({
  id:        `var_${_rid()}`,
  name:      'New variant',
  condition: emptyCondition(),
  overrides: {
    greeting:    '',
    portrait:    '',
    pages:       [],
    topics:      [],
    choices:     [],
    entryTopicId:'',
  },
});

const emptyNpc = (id = `npc_${_rid()}`) => ({
  id,
  name:      'New NPC',
  locations: [],
  folder:    '',                  // free-form path - '' = ungrouped
  greeting:  '',
  portrait:  '',
  // Override for the "Talk to <name>" choice button. Blank = use the default
  // verb. Set to "Use workbench" / "Read tome" / "Pray at altar" for
  // non-conversational NPCs.
  interactLabel: '',
  role:          'dialogue',     // 'dialogue' | 'shop'
  // Two conversation systems toggled per-NPC. Default: simple flat dialogue.
  //   false: render `pages` then `choices` (legacy). `topics` is ignored.
  //   true:  render `pages` (greeting) then the entry topic. `choices` is ignored.
  advanced:      false,
  pages:         [emptyPage()],  // greeting pages - shown before the entry topic in advanced mode
  choices:       [],             // ONLY used when advanced === false (simple flat dialogue)
  topics:        [],             // ONLY used when advanced === true
  entryTopicId:  '',             // ADV: which topic to drop the player into after greeting. '' = topics[0]
  shop:          { stock: [], buyback: emptyBuyback() },  // only used when role === 'shop'
  variants:      [],             // [{ id, name, condition, overrides }] - first-match override; see emptyNpcVariant
  // Per-NPC state declarations - lives at state.npcVars[npc.id][key] at
  // runtime. Addressable from anywhere as `npcVars.<npcId>.<key>`, or from
  // this NPC's own choices/topics as the portable `npcSelf.<key>` shorthand
  // (resolved to the concrete npcVars.<npcId>.<key> at compile/export time).
  vars:          [],             // [{ key, type: 'number'|'string'|'array'|'object', initial }]
});

const emptyProject = () => {
  const room = emptyRoom('start');
  room.title = 'Starting Room';
  room.pages[0].text = 'Welcome. Edit this room to begin.';
  return {
    meta:    { title: 'Untitled RPG', start: 'start', defaultMusic: '', gameCss: '', themeOverrides: {}, imports: [] },
    stats:   [
      { key: 'hp',   type: 'number', initial: 100 },
      { key: 'gold', type: 'number', initial: 0   },
    ],
    flags:             [],
    items:             [],
    startingInventory: {},  // { itemId: count } - seeds state.inventory at game start
    startingEquipped:  {},  // { slot: itemId } - seeds state.equipped at game start
    skills:            [],
    startingSkills:    [],  // [skillId]       - seeds state.skills at game start
    rooms:             [room],
    npcs:              [],
    combats:           [],
    sidebar:           emptySidebar(),
    charCreation:      emptyCharCreation(),
    // Uploaded media live in a top-level catalogue; fields hold `asset:<id>`
    // refs. Multiple fields referencing the same asset get a single zip entry.
    assets:            [],
    assetDefaults:     { imageQuality: 0.8, imageMaxDim: 1080 },
  };
};

// One asset entry. `data` is a data:URL stored as-is (post-compression for
// images, raw for audio/video). `quality`/`maxDim` are remembered so the
// Assets tab can show what settings were used.
const emptyAsset = (kind = 'image') => ({
  id:       `asset_${_rid()}`,
  name:     '',
  kind,                       // 'image' | 'audio' | 'video'
  folder:   '',               // free-form path - '' = ungrouped
  data:     '',
  mime:     '',
  byteSize: 0,
  quality:  null,             // image: 0..1; null = wasn't (re-)compressed
  maxDim:   null,
});

// Map the v1 flow vocabulary to v2.
//   'exit'         → 'navigate' (most common case; "exit + to:''" meant stay/return)
//   'backToTopics' → 'exitBack'
//   'goToTopic'    → 'change'
const _migrateFlow = f =>
  f === 'backToTopics' ? 'exitBack' :
  f === 'goToTopic'    ? 'change'   :
  f === 'exit'         ? 'navigate' :
  (f ?? 'navigate');

const _normaliseChoice = c => ({
  id:        c.id ?? _rid(),
  label:     c.label ?? '',
  to:        c.to ?? '',
  condition: c.condition ?? emptyCondition(),
  action:    c.action ?? emptyEffect(),
  flow:      _migrateFlow(c.flow),
  topicId:   c.topicId  ?? '',
  combatId:  c.combatId ?? '',
});

// `label`→`name`, `condition`/`once`/`onAsk` collapsed away: a topic is now a
// pure thread (its visibility and one-shot logic, if needed, live on the
// choices that point INTO it). `onEnter` replaces the v1 `onAsk`.
const _normaliseTopic = t => ({
  id:      t.id ?? `topic_${_rid()}`,
  name:    t.name ?? t.label ?? 'Topic',           // v1 used `label`
  onEnter: t.onEnter ?? t.onAsk ?? emptyEffect(),  // v1 used `onAsk`
  pages:   Array.isArray(t.pages)   && t.pages.length ? t.pages : [emptyPage()],
  choices: Array.isArray(t.choices) ? t.choices.map(_normaliseChoice) : [],
});

// Normalise an arbitrary parsed JSON to the current shape - fills missing fields
// so the editor never has to render against undefined values. Returns the input
// as-is for fields it already knows; this is forward-compatible with future
// optional keys.
const normaliseProject = raw => {
  const base = emptyProject();
  if (!raw || typeof raw !== 'object') return base;
  return {
    meta: {
      title:          raw.meta?.title        ?? base.meta.title,
      start:          raw.meta?.start        ?? base.meta.start,
      defaultMusic:   raw.meta?.defaultMusic ?? base.meta.defaultMusic,
      gameCss:        raw.meta?.gameCss      ?? base.meta.gameCss,
      themeOverrides: (raw.meta?.themeOverrides && typeof raw.meta.themeOverrides === 'object')
        ? raw.meta.themeOverrides
        : base.meta.themeOverrides,
      imports: Array.isArray(raw.meta?.imports)
        ? raw.meta.imports.map(imp => ({
            file:    imp.file    ?? '',
            target:  imp.target  ?? '',
            binding: imp.binding ?? '',     // optional named/default/namespace clause
          }))
        : base.meta.imports,
    },
    // Stats grew a `type` (number | string | array). Legacy rows without a
    // type get `'number'` so existing projects keep working byte-for-byte.
    // `initial` is coerced to match the stated type.
    stats: Array.isArray(raw.stats)
      ? raw.stats.map(_normaliseStat)
      : base.stats,
    flags: Array.isArray(raw.flags) ? raw.flags : base.flags,
    items: Array.isArray(raw.items)
      ? raw.items.map(it => ({
          id:          it.id,
          name:        it.name        ?? '',
          description: it.description ?? '',
          image:       it.image       ?? '',
          price:       _normalisePrice(it.price) || emptyPrice(),
          kind:        it.kind        ?? 'misc',
          folder:      it.folder      ?? '',
          useEffect:   it.useEffect   || emptyEffect(),
          text:        it.text        ?? '',
          equipSlot:   it.equipSlot   ?? '',
        }))
      : base.items,
    startingInventory: (raw.startingInventory && typeof raw.startingInventory === 'object')
      ? Object.fromEntries(Object.entries(raw.startingInventory).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]))
      : base.startingInventory,
    startingEquipped: (raw.startingEquipped && typeof raw.startingEquipped === 'object')
      ? Object.fromEntries(Object.entries(raw.startingEquipped).filter(([k, v]) => k && v).map(([k, v]) => [String(k), String(v)]))
      : base.startingEquipped,
    rooms: Array.isArray(raw.rooms)
      ? raw.rooms.map(r => ({
          id:               r.id,
          kind:             r.kind             ?? 'scene',
          title:            r.title            ?? '',
          folder:           r.folder           ?? '',
          music:            r.music            ?? '',
          hideOnMap:        !!r.hideOnMap,
          onEnter:          r.onEnter          ?? emptyEffect(),
          onEnterCondition: r.onEnterCondition ?? emptyCondition(),
          pages:            Array.isArray(r.pages)   && r.pages.length ? r.pages   : [emptyPage()],
          choices:          Array.isArray(r.choices) ? r.choices.map(_normaliseChoice) : [],
          onEnd:            r.onEnd ?? emptyEffect(),
          wardrobe: r.wardrobe && typeof r.wardrobe === 'object'
            ? {
                portraitWidth:  Number(r.wardrobe.portraitWidth)  || 240,
                portraitHeight: Number(r.wardrobe.portraitHeight) || 320,
                layers:         Array.isArray(r.wardrobe.layers) ? r.wardrobe.layers : [],
                kinds:          Array.isArray(r.wardrobe.kinds)  ? r.wardrobe.kinds  : ['equipment'],
              }
            : { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] },
          inventory: r.inventory && typeof r.inventory === 'object'
            ? {
                kinds:           Array.isArray(r.inventory.kinds) ? r.inventory.kinds : [],
                layout:          r.inventory.layout === 'list' ? 'list' : 'grid',
                showDescription: r.inventory.showDescription !== false,
                emptyMessage:    r.inventory.emptyMessage ?? 'You are not carrying anything.',
              }
            : { kinds: [], layout: 'grid', showDescription: true, emptyMessage: 'You are not carrying anything.' },
        }))
      : base.rooms,
    npcs: Array.isArray(raw.npcs)
      ? raw.npcs.map(n => ({
          id:           n.id,
          name:         n.name      ?? '',
          locations:    Array.isArray(n.locations) ? n.locations : [],
          folder:       n.folder    ?? '',
          greeting:      n.greeting  ?? '',
          portrait:      n.portrait  ?? '',
          interactLabel: n.interactLabel ?? '',
          role:          n.role      ?? 'dialogue',
          advanced:     !!n.advanced,
          pages:        Array.isArray(n.pages)   && n.pages.length   ? n.pages   : [emptyPage()],
          choices:      Array.isArray(n.choices) ? n.choices.map(_normaliseChoice) : [],
          topics:       Array.isArray(n.topics)  ? n.topics.map(_normaliseTopic)   : [],
          entryTopicId: n.entryTopicId ?? '',
          shop:         n.shop && Array.isArray(n.shop.stock)
            ? {
                ...n.shop,
                stock: n.shop.stock.map(e => ({
                  itemId:   e.itemId,
                  price:    _normalisePrice(e.price),    // null → use item default
                  quantity: e.quantity == null ? null : Math.max(0, Number(e.quantity) || 0),
                })),
                buyback: _normaliseBuyback(n.shop.buyback),
              }
            : { stock: [], buyback: emptyBuyback() },
          variants: Array.isArray(n.variants)
            ? n.variants.map(v => ({
                id:        v?.id || `var_${_rid()}`,
                name:      v?.name || '',
                condition: v?.condition && typeof v.condition === 'object' ? v.condition : emptyCondition(),
                overrides: v?.overrides && typeof v.overrides === 'object'
                  ? {
                      greeting:     typeof v.overrides.greeting === 'string' ? v.overrides.greeting : '',
                      portrait:     typeof v.overrides.portrait === 'string' ? v.overrides.portrait : '',
                      pages:        Array.isArray(v.overrides.pages)   ? v.overrides.pages   : [],
                      choices:      Array.isArray(v.overrides.choices) ? v.overrides.choices.map(_normaliseChoice) : [],
                      topics:       Array.isArray(v.overrides.topics)  ? v.overrides.topics.map(_normaliseTopic)   : [],
                      entryTopicId: typeof v.overrides.entryTopicId === 'string' ? v.overrides.entryTopicId : '',
                    }
                  : { greeting: '', portrait: '', pages: [], choices: [], topics: [], entryTopicId: '' },
              }))
            : [],
          vars: Array.isArray(n.vars) ? n.vars.map(_normaliseNpcVar) : [],
        }))
      : base.npcs,
    sidebar: raw.sidebar && typeof raw.sidebar === 'object'
      ? {
          enabled: !!raw.sidebar.enabled,
          width:   typeof raw.sidebar.width === 'string' ? raw.sidebar.width : '',
          widgets: Array.isArray(raw.sidebar.widgets) ? raw.sidebar.widgets : [],
        }
      : base.sidebar,
    charCreation: raw.charCreation && typeof raw.charCreation === 'object'
      ? {
          enabled: !!raw.charCreation.enabled,
          steps:   Array.isArray(raw.charCreation.steps) ? raw.charCreation.steps.map(_normaliseCcStep) : [],
        }
      : base.charCreation,
    assets: Array.isArray(raw.assets)
      ? raw.assets.map(a => ({
          id:       a.id || `asset_${_rid()}`,
          name:     a.name ?? '',
          kind:     a.kind ?? 'image',
          folder:   a.folder ?? '',
          data:     a.data ?? '',
          mime:     a.mime ?? '',
          byteSize: Number(a.byteSize || 0),
          quality:  a.quality ?? null,
          maxDim:   a.maxDim  ?? null,
        }))
      : base.assets,
    assetDefaults: raw.assetDefaults && typeof raw.assetDefaults === 'object'
      ? {
          imageQuality: Number(raw.assetDefaults.imageQuality) || 0.8,
          imageMaxDim:  Number(raw.assetDefaults.imageMaxDim)  || 1080,
        }
      : base.assetDefaults,
    skills: Array.isArray(raw.skills) ? raw.skills : base.skills,
    startingSkills: Array.isArray(raw.startingSkills) ? raw.startingSkills : base.startingSkills,
    combats: Array.isArray(raw.combats)
      ? raw.combats.map(c => ({
          id:          c.id,
          name:        c.name ?? 'Encounter',
          enemy: {
            name:    c.enemy?.name    ?? 'Enemy',
            hp:      Number(c.enemy?.hp || 0),
            defense: Number(c.enemy?.defense || 0),
            image:   c.enemy?.image   ?? '',
            actions: Array.isArray(c.enemy?.actions) && c.enemy.actions.length
              ? c.enemy.actions
              : [emptyEnemyAction()],
            loot:    (c.enemy?.loot && typeof c.enemy.loot === 'object') ? c.enemy.loot : {},
          },
          playerStat:  c.playerStat ?? 'hp',
          intro:       c.intro      ?? '',
          extraMoves:  Array.isArray(c.extraMoves) ? c.extraMoves : [],
          winRoom:     c.winRoom    ?? '',
          loseRoom:    c.loseRoom   ?? '',
          winText:     c.winText    ?? 'You won!',
          loseText:    c.loseText   ?? 'You were defeated.',
          winImage:    c.winImage   ?? '',
          loseImage:   c.loseImage  ?? '',
          onWin:       c.onWin   || emptyEffect(),
          onLose:      c.onLose  || emptyEffect(),
          linkedNpcId: c.linkedNpcId ?? '',
        }))
      : base.combats,
  };
};

export {
  _rid,
  emptyProject, normaliseProject,
  emptyRoom, emptyWardrobeRoom, emptyInventoryRoom, emptyStoryRoom, emptyNpc, emptyItem, emptyShopEntry, emptyBuyback, emptyBuybackItem, emptyPrice,
  emptyStat, emptyNpcVar,
  emptyPage, emptyChoice, emptyTopic,
  emptyCondition, emptyEffect, emptyOp, emptyOpLimit,
  emptyLootTable, emptyLootEntry, emptyWeightBonus, emptyOneOfOption,
  emptySidebar, emptyWidget, emptyPortraitLayer,
  emptyCharCreation, emptyCharCreationStep, emptyCharCreationOption,
  emptyNpcVariant,
  emptyCombat, emptyCombatMove, emptyEnemyAction,
  emptySkill,
  emptyAsset,
};
