/**
 * preview.js — turn a project JSON into a runnable createGame config.
 *
 * The interpreter is the runtime semantics of the editor's data model:
 *   - Pages render in sequence; "More" advances a per-scene index in state.
 *   - Conditions/Effects in simple mode read/write state, flags, inventory.
 *   - JS-mode conditions/effects run via Function() with `c` (ctx) in scope.
 *   - NPC role:'shop' auto-builds buy choices from the stock list.
 *
 * The same semantics drive codegen.js, which emits equivalent JS source.
 */

import { div, p, img, video, span, h3, button } from '../src/elements.js';
import { Scene, NpcChoices, NpcLine } from '../src/game.js';
import { resolveAssetsForPreview } from './extractAssets.js';
import { Just, Nothing, bind, guard, fromMaybe } from '../lib/odocosjs/src/core.js';

const _safeFn = (argNames, body) => {
  try { return new Function(...argNames, body); }
  catch (e) {
    console.warn('[preview] failed to compile JS:', e.message, body);
    return () => null;
  }
};

const _readPath = (state, path) => {
  if (path.startsWith('flags.')) return state.flags?.[path.slice(6)];
  if (path.startsWith('inv.'))   return state.inventory?.[path.slice(4)] || 0;
  return state[path];
};

// Per-op clamp evaluator. Returns null when the limit is off (no clamp).
// statKey === '' makes the limit a pure constant (mul * 0 + const = const).
const _evalOpLimit = (limit, state) =>
  !limit || !limit.enabled
    ? null
    : (Number(limit.mul) || 0) * (Number(state?.[limit.statKey]) || 0) + (Number(limit.const) || 0);

const _clamp = (n, lo, hi) => {
  let out = n;
  if (lo != null && out < lo) out = lo;
  if (hi != null && out > hi) out = hi;
  return out;
};

const _writeOpToPatch = (state, op, ctx) => {
  const { target, op: kind, value } = op;
  if (!target) return null;
  // Per-op condition gate. Missing / 'always' condition lets the op through.
  if (op.condition && op.condition.mode && op.condition.mode !== 'always') {
    const guard = _compileCondition(op.condition);
    // Use the live ctx so the guard sees the same shape conditions on choices do.
    const c = ctx || { state };
    if (!guard(c)) return null;
  }
  if (target.startsWith('flags.')) {
    const k = target.slice(6);
    const cur = state.flags?.[k];
    const next = kind === 'toggle' ? !cur : Boolean(value);
    return { flags: { ...(state.flags || {}), [k]: next } };
  }
  if (target.startsWith('inv.')) {
    const k = target.slice(4);
    const cur = Number(state.inventory?.[k] || 0);
    const n = Number(value) || 0;
    let next =
      kind === 'give' ? cur + n :
      kind === 'take' ? cur - n :
      kind === 'set'  ? n :
      cur;
    // Implicit floor of 0 only on `take` — matches the engine's original
    // behaviour. User min/max apply on top of it for take; for give/set,
    // user min/max are the only clamp source.
    const lo = _evalOpLimit(op.min, state);
    const hi = _evalOpLimit(op.max, state);
    const effLo = kind === 'take' ? (lo != null ? Math.max(0, lo) : 0) : lo;
    next = _clamp(next, effLo, hi);
    const inv = { ...(state.inventory || {}) };
    if (next <= 0) delete inv[k]; else inv[k] = next;
    return { inventory: inv };
  }
  if (target.startsWith('skills.')) {
    const k = target.slice(7);
    const cur = Array.isArray(state.skills) ? state.skills : [];
    if (kind === 'learn')  return { skills: cur.includes(k) ? cur : [...cur, k] };
    if (kind === 'forget') return { skills: cur.filter(x => x !== k) };
    return null;
  }
  // plain stat
  const cur = Number(state[target] || 0);
  const n = Number(value);
  const isNumeric = Number.isFinite(n);
  let next =
    kind === 'set' ? (isNumeric ? n : value) :
    kind === 'add' ? cur + (isNumeric ? n : 0) :
    kind === 'sub' ? cur - (isNumeric ? n : 0) :
    cur;
  // Clamp numeric results only — string `set` (e.g. setting a label) skips.
  if (typeof next === 'number') {
    const lo = _evalOpLimit(op.min, state);
    const hi = _evalOpLimit(op.max, state);
    next = _clamp(next, lo, hi);
  }
  return { [target]: next };
};

// Returns a function (ctx) => boolean
const _compileCondition = cond => {
  if (!cond || cond.mode === 'always') return () => true;
  if (cond.mode === 'simple') {
    return c => {
      const left = _readPath(c.state, cond.key);
      const right = cond.value;
      switch (cond.op) {
        case '>=': return Number(left) >= Number(right);
        case '>':  return Number(left) >  Number(right);
        case '<=': return Number(left) <= Number(right);
        case '<':  return Number(left) <  Number(right);
        case '==': return left == right;     // eslint-disable-line eqeqeq
        case '!=': return left != right;     // eslint-disable-line eqeqeq
        default:   return false;
      }
    };
  }
  if (cond.mode === 'hasItem') {
    return c => {
      const have = Number(c.state.inventory?.[cond.itemId] || 0);
      if (cond.op === 'has')     return have >= 1;
      if (cond.op === 'lacks')   return have <= 0;
      if (cond.op === 'atleast') return have >= Number(cond.count || 1);
      return false;
    };
  }
  if (cond.mode === 'js') {
    const fn = _safeFn(['c'], `return (${cond.expr || 'true'});`);
    return c => { try { return !!fn(c); } catch { return false; } };
  }
  return () => true;
};

// Inclusive integer range. Defensive against swapped min/max.
const _randIntRange = (lo, hi) => {
  const a = Math.min(Number(lo) || 0, Number(hi) || 0);
  const b = Math.max(Number(lo) || 0, Number(hi) || 0);
  return a + Math.floor(Math.random() * (b - a + 1));
};

// Effective weight = base + sum of every applicable bonus's resolved amount.
// A bonus applies when its `condition` evaluates truthy against ctx; the
// amount is either a literal (`amountFixed`) or the live value of a stat
// (`amountStat` → state[key]).
const _resolveWeight = c => entry => {
  let total = Math.max(0, Number(entry.weight) || 0);
  for (const b of (entry.bonuses || [])) {
    const guard = _compileCondition(b.condition);
    if (!guard(c)) continue;
    const add = b.amountMode === 'stat'
      ? (b.amountStat ? Number(c.state[b.amountStat]) || 0 : 0)
      : (Number(b.amountFixed) || 0);
    total += add;
  }
  return Math.max(0, total);
};

// Weighted-random pick over entries with ctx-aware effective weights. Returns
// the chosen index or -1 if every entry resolves to weight 0.
const _weightedPick = c => entries => {
  const weights = entries.map(_resolveWeight(c));
  const total   = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) return -1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};

// Apply one resolved loot entry to ctx. Returns a short label for the
// optional "Loot: …" flavour line (or null when the entry is `nothing`).
const _applyLootEntry = (entry, c) => {
  switch (entry.kind) {
    case 'item': {
      if (!entry.itemId) return null;
      const n = Math.max(0, _randIntRange(entry.countMin, entry.countMax));
      if (n === 0) return null;
      c.setState(s => ({ inventory: { ...(s.inventory || {}), [entry.itemId]: (Number(s.inventory?.[entry.itemId]) || 0) + n } }));
      return `${entry.itemId} x${n}`;
    }
    case 'stat': {
      if (!entry.statKey) return null;
      const n = _randIntRange(entry.statMin, entry.statMax);
      if (n === 0) return null;
      c.setState(s => ({ [entry.statKey]: (Number(s[entry.statKey]) || 0) + n }));
      return `${entry.statKey} ${n > 0 ? '+' : ''}${n}`;
    }
    case 'flag': {
      if (!entry.flagKey) return null;
      c.setState(s => ({ flags: { ...(s.flags || {}), [entry.flagKey]: !!entry.flagValue } }));
      return `flag ${entry.flagKey} = ${entry.flagValue ? 'true' : 'false'}`;
    }
    case 'navigate': {
      if (!entry.roomId) return null;
      c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [entry.roomId]: 0 } }));
      c.goto(entry.roomId);
      return `→ ${entry.roomId}`;
    }
    case 'learnSkill': {
      if (!entry.skillId) return null;
      c.setState(s => {
        const cur = Array.isArray(s.skills) ? s.skills : [];
        return cur.includes(entry.skillId) ? {} : { skills: [...cur, entry.skillId] };
      });
      return `learned ${entry.skillId}`;
    }
    case 'talkNpc': {
      if (!entry.npcId) return null;
      c.setState(s => ({
        _npcPageIdx:      { ...(s._npcPageIdx      || {}), [entry.npcId]: 0 },
        _npcGreetingDone: { ...(s._npcGreetingDone || {}), [entry.npcId]: false },
        _npcTopic:        { ...(s._npcTopic        || {}), [entry.npcId]: null },
        _npcTopicStack:   { ...(s._npcTopicStack   || {}), [entry.npcId]: [] },
      }));
      c.talkTo(entry.npcId, c.scene);
      return `talkTo ${entry.npcId}`;
    }
    case 'js': {
      const fn = _safeFn(['c'], entry.jsBody || '');
      try { fn(c); } catch (e) { console.warn('[preview] loot JS threw:', e.message); }
      return entry.label || 'js';
    }
    case 'nothing':
    default:
      return null;
  }
};

// Compile a LootTable to a (c)=>void runner. `picks` rolls; `unique` removes
// the picked entry from the bag between rolls. Resolved flavour strings are
// pushed onto `state._lootLog` so combat outcome screens / JS sidebar widgets
// / room pages can display "Loot: …" if they want. The buffer is bounded
// (last 8) so it can't grow forever.
const _compileRandomLoot = rawTable => {
  const table = rawTable || { picks: 1, unique: false, showFlavour: true, entries: [] };
  return c => {
    const picks = Math.max(1, Number(table.picks) || 1);
    const bag   = [...(table.entries || [])];
    const wins  = [];
    for (let i = 0; i < picks; i++) {
      if (bag.length === 0) break;
      const idx = _weightedPick(c)(bag);
      if (idx < 0) break;
      const entry = bag[idx];
      const flavour = _applyLootEntry(entry, c);
      if (flavour) wins.push(flavour);
      // Per-entry author message accumulates alongside the engine's "Loot:"
      // log line, so authors can write a richer one-shot blurb per pick.
      if (entry.message) _pushMsg(c, entry.message);
      if (table.unique) bag.splice(idx, 1);
    }
    if (table.showFlavour !== false && wins.length) {
      const line = `Loot: ${wins.join(', ')}`;
      c.setState(s => ({ _lootLog: [...((s._lootLog || []).slice(-7)), line] }));
    }
  };
};

// ─── Message buffer + state-diff scope ────────────────────────────────
//
// Any Effect (or LootEntry) can carry an optional `message` template. After
// the action's core fires, the template is evaluated against:
//   state — post-action live state
//   init  — snapshot of state just before the OUTER choice action ran
//   gain  — per-key positive deltas (numeric stat-ups, item increases,
//           newly-true flags, newly-learned skills)
//   loss  — per-key negative deltas (mirror of gain)
//
// The rendered string is appended to state._messageQueue. The next scene
// render shows the buffer as a Continue interstitial, then clears it. Multi
// steps + randomLoot picks accumulate naturally — each pushes one entry.

const _isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);

// Walk init/after recursively and produce only POSITIVE deltas. Stats and
// inventory show numeric differences; arrays (skills) show new additions;
// flags show those that became true. Pass arguments swapped for `loss`.
const _diff = (init, after) => {
  const out  = {};
  const keys = new Set([...Object.keys(init || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k.startsWith('_')) continue;            // engine internals — skip
    const a = (init  || {})[k];
    const b = (after || {})[k];
    if (_isObj(a) || _isObj(b)) {
      const sub = _diff(a || {}, b || {});
      if (Object.keys(sub).length) out[k] = sub;
    } else if (Array.isArray(a) || Array.isArray(b)) {
      const before = a || [];
      const now    = b || [];
      const added  = now.filter(x => !before.includes(x));
      if (added.length) out[k] = added;
    } else if (typeof b === 'number') {
      const d = b - (Number(a) || 0);
      if (d > 0) out[k] = d;
    } else if (typeof b === 'boolean') {
      if (b === true && !a) out[k] = true;       // flag flipped to true
    }
  }
  return out;
};

// Render `tpl` (with `${expr}` snippets) against the gain/loss/init scope and
// append to state._messageQueue. No-op if tpl is empty or renders to empty.
const _pushMsg = (c, tpl) => {
  if (!tpl) return;
  const state = c.getState();
  const init  = state._msgInit || {};
  const gain  = _diff(init, state);
  const loss  = _diff(state, init);
  const scope = { ...state, init, gain, loss };
  const text = _evalText(scope)(tpl);
  if (!text) return;
  c.setState(s => ({ _messageQueue: [...(s._messageQueue || []), text] }));
};

// Snapshot state at the top of any choice action so messages can resolve init
// / gain / loss against a single reference point. Also resets _messageQueue
// so messages from the PREVIOUS action don't leak forward.
const _startAction = c => {
  c.setState(s => {
    // Don't carry the previous action's bookkeeping into the new init.
    const init = { ...s };
    delete init._msgInit;
    delete init._messageQueue;
    return { _msgInit: init, _messageQueue: [] };
  });
};

// Wrap a scene render fn so it shows the accumulated message buffer first.
// Continue clears the buffer; the next render falls through to the original
// scene. Curried `sceneFn => ctx => vnode`.
const _withMessageOverlay = sceneFn => ctx => {
  const queue = ctx.state._messageQueue || [];
  if (queue.length === 0) return sceneFn(ctx);
  return Scene({
    title: '',
    body: queue.map(m => p({ style: 'margin:0 0 10px; line-height:1.55' })([m])),
    choices: [{
      label: 'Continue',
      action: c => c.setState({ _messageQueue: [] }),
    }],
  })(ctx);
};

// Returns a function (ctx) => void. `project` (optional) is used by enterCombat
// to read the target combat's enemy.hp for the initial state.
// _compileEffectCore = the unwrapped per-mode runner. _compileEffect wraps it
// with the message-push tail so EVERY mode gets the same opt-in messaging.
const _compileEffectCore = (effect, project) => {
  if (!effect || effect.mode === 'none') return () => {};
  if (effect.mode === 'simple') {
    return c => {
      c.setState(s => {
        let next = s;
        for (const op of effect.ops || []) {
          // Per-op condition evaluates against the IN-PROGRESS state so earlier
          // ops in the same effect can flip a flag a later op gates on.
          const patch = _writeOpToPatch(next, op, { ...c, state: next });
          if (patch) next = { ...next, ...patch };
        }
        return next;
      });
    };
  }
  if (effect.mode === 'randomLoot') {
    return _compileRandomLoot(effect.table);
  }
  if (effect.mode === 'navigate') {
    return c => {
      if (!effect.toRoom) return;
      c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [effect.toRoom]: 0 } }));
      c.goto(effect.toRoom);
    };
  }
  if (effect.mode === 'multi') {
    // Compile each step once; runner fires them in order. Nested multi works
    // by recursion since _compileEffect is the same function.
    const steps = (effect.steps || []).map(s => _compileEffect(s, project));
    return c => { for (const fn of steps) fn(c); };
  }
  if (effect.mode === 'oneOf') {
    // Pick ONE option per call. Effective weight = base + Σ applicable bonuses
    // (same machinery as random loot entries via _resolveWeight). The picked
    // option's Effect fires — any mode, including another oneOf or multi.
    const opts = (effect.options || []).map(o => ({
      weight:  Number(o.weight) || 0,
      bonuses: o.bonuses || [],
      effect:  _compileEffect(o.effect, project),
    }));
    return c => {
      if (opts.length === 0) return;
      const idx = _weightedPick(c)(opts);
      if (idx < 0) return;
      opts[idx].effect(c);
    };
  }
  if (effect.mode === 'talkTo') {
    return c => {
      if (!effect.npcId) return;
      // Fresh visit — reset greeting, drop the topic stack, drop any in-progress topic.
      c.setState(s => ({
        _npcPageIdx:      { ...(s._npcPageIdx      || {}), [effect.npcId]: 0 },
        _npcGreetingDone: { ...(s._npcGreetingDone || {}), [effect.npcId]: false },
        _npcTopic:        { ...(s._npcTopic        || {}), [effect.npcId]: null },
        _npcTopicStack:   { ...(s._npcTopicStack   || {}), [effect.npcId]: [] },
      }));
      c.talkTo(effect.npcId, c.scene);
    };
  }
  if (effect.mode === 'enterCombat') {
    const combat = (project?.combats || []).find(cb => cb.id === effect.combatId);
    return c => {
      if (!combat) return;
      c.setState({
        _combat: {
          id:       combat.id,
          enemyHp:  Number(combat.enemy.hp) || 1,
          log:      combat.intro ? [combat.intro] : [],
          turn:     0,
          lastMoveImage: null,
          returnTo: c.scene,
          outcome:  null,
        },
      });
      c.goto(`_combat:${combat.id}`);
    };
  }
  if (effect.mode === 'js') {
    const fn = _safeFn(['c'], effect.body || '');
    return c => { try { fn(c); } catch (e) { console.warn('[preview] effect threw:', e.message); } };
  }
  return () => {};
};

// Public `_compileEffect` — wraps the core runner with an optional message
// push. Nested effects (multi/oneOf steps, randomLoot entries) flow through
// the same wrapper so their own .message fields fire after their core logic.
const _compileEffect = (effect, project) => {
  const core = _compileEffectCore(effect, project);
  if (!effect || !effect.message) return core;
  return c => { core(c); _pushMsg(c, effect.message); };
};

const _mediaNode = page => {
  const nodes = [];
  if (page.image) nodes.push(img({ src: page.image, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
  if (page.video) nodes.push(video({ src: page.video, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
  return nodes;
};

// ─── Inline expression evaluator ────────────────────────────────────────
//
// Any narrative text field can embed `${expr}` snippets that get evaluated
// against the live state. Authoring example:
//
//   "You have ${gold} gold pieces. Your hp is ${hp} / 100."
//   "${flags.metMage ? 'The mage nods at you.' : 'Strangers pass you by.'}"
//   "Bread in pack: ${inventory.bread ?? 0}"
//
// The expression runs as `(state) => (<expr>)` with `state` AND each top-level
// key destructured into scope (so bare `gold` works without `state.`). Compile
// failures and runtime throws degrade to the literal `${expr}` so authors see
// what broke without a crash.

// Compiled template cache. Keyed on the source string (Map, not WeakMap).
// Project text strings are bounded by the project size, so it can't run away.
const _templateCache = new Map();

// Maybe helpers — matches the parser-combinator style used by src/components/Markdown.js.
const _liftIndex = i => i < 0 ? Nothing : Just(i);
const _findClose = marker => from => text => _liftIndex(text.indexOf(marker, from));

// Try to consume a `${expr}` at the start of `text`. Returns Just({ seg, rest })
// on match; Nothing otherwise. `seg` is `{ src, fn }` when the expression
// compiles, or the verbatim string when it doesn't (so the author sees the
// broken source instead of a silent crash).
const _matchExpr = text =>
  bind(guard(text.startsWith('${'))(2))                (s =>
  bind(_findClose('}')(s)(text))                       (e => {
    const verbatim = text.slice(0, e + 1);
    const rest     = text.slice(e + 1);
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('state', `with (state) { return (${text.slice(s, e)}); }`);
      return Just({ seg: { src: verbatim, fn }, rest });
    } catch (_) {
      return Just({ seg: verbatim, rest });
    }
  }));

// Walk `text` once, emitting a list of segments. Consume an expression when
// _matchExpr succeeds; otherwise glue a single literal character onto the tail
// segment (or start a new one).
const _compileTemplate = text => {
  const out = [];
  let rest = text;
  let buf  = '';
  const _flush = () => { if (buf) { out.push(buf); buf = ''; } };
  while (rest.length) {
    const matched = fromMaybe(null)(_matchExpr(rest));
    if (matched) {
      _flush();
      out.push(matched.seg);
      rest = matched.rest;
    } else {
      buf += rest[0];
      rest = rest.slice(1);
    }
  }
  _flush();
  return out;
};

// Public: substitute every `${expr}` in `text` using `state`. Curried so call
// sites read `_evalText(ctx.state)(page.text)`.
const _evalText = state => text => {
  if (!text || typeof text !== 'string' || !text.includes('${')) return text || '';
  let segs = _templateCache.get(text);
  if (!segs) { segs = _compileTemplate(text); _templateCache.set(text, segs); }
  const s = state || {};
  return segs.map(seg => {
    if (typeof seg === 'string') return seg;
    try {
      const v = seg.fn(s);
      return v == null ? '' : String(v);
    } catch (_) {
      return seg.src;          // runtime throw → visible verbatim
    }
  }).join('');
};

// Curried `ctx => page => vnode[]`. Text fields run through _evalText so
// authors can drop `${gold}` etc. into any page body.
const _pageBody = ctx => page => [
  ..._mediaNode(page),
  ...(page.text ? [p({})([_evalText(ctx.state)(page.text)])] : []),
];

// Build the scene fn for a room. Wardrobe rooms render a paper-doll + the
// items the player is carrying that match the configured kinds. Scene rooms
// page through their pages with a "More" advance, then show real choices on
// the final page (plus auto NpcLine / NpcChoices).
const _buildSceneFn = (room, project) => ctx => {
  if (room.kind === 'wardrobe')  return _buildWardrobeFn(room, project)(ctx);
  if (room.kind === 'inventory') return _buildInventoryRoomFn(room, project)(ctx);

  const idx     = ctx.state._pageIdx?.[room.id] || 0;
  const safeIdx = Math.min(idx, room.pages.length - 1);
  const page    = room.pages[safeIdx];
  const isLast  = safeIdx === room.pages.length - 1;

  const body = _pageBody(ctx)(page);
  if (isLast) body.push(...NpcLine(ctx));

  // Opt-in end-of-dialog Effect. On the last page, when no Choice is defined
  // AND room.onEnd is non-none, render a single button (labelled by the page's
  // advanceLabel) that fires the Effect. Useful for "drink beer → randomLoot
  // navigate" or any auto-routing at the end of a story chain. NOTHING is
  // created automatically — devs opt in by configuring onEnd.
  const onEndFn       = _compileEffect(room.onEnd, project);
  const hasOnEnd      = room.onEnd && room.onEnd.mode && room.onEnd.mode !== 'none';
  const onEndFallback = isLast && room.choices.length === 0 && hasOnEnd
    ? [{
        label:  page.advanceLabel || 'Continue',
        action: c => onEndFn(c),
      }]
    : [];

  const choices = isLast
    ? [
        ...room.choices.map(ch => _buildChoice(ch, project, room.id)),
        ...onEndFallback,
        ...NpcChoices(ctx),
      ]
    : [{
        label: page.advanceLabel || 'More',
        action: c => c.setState(s => ({
          _pageIdx: { ...(s._pageIdx || {}), [room.id]: safeIdx + 1 },
        })),
      }];

  return Scene({ title: room.title, body, choices })(ctx);
};

// Drop the consumed item by one, or remove it entirely if that brings count to 0.
const _consumeOne = (s, itemId) => {
  const inv = { ...(s.inventory || {}) };
  const cur = Number(inv[itemId]) || 0;
  if (cur <= 1) delete inv[itemId]; else inv[itemId] = cur - 1;
  return inv;
};

const _equippedSlots = state => state.equipped || {};

// True if any equipment slot currently holds this item.
const _isEquipped = (state, itemId) => Object.values(_equippedSlots(state)).includes(itemId);

// Inventory room scene. Each item card surfaces a Use / Read / Equip /
// Unequip button based on the item's kind. Reading mode uses a per-scene
// `state._reading` flag so the engine doesn't need a separate book scene.
const _buildInventoryRoomFn = (room, project) => ctx => {
  const cfg = room.inventory || { kinds: [], layout: 'grid', showDescription: true, emptyMessage: 'You are not carrying anything.' };
  const inv = ctx.state.inventory || {};

  // Reading overlay — shown when _reading is set to this room's id + item id.
  const reading = ctx.state._reading;
  if (reading && reading.roomId === room.id) {
    const book = project.items.find(it => it.id === reading.itemId);
    if (book) {
      return Scene({
        title: book.name || book.id,
        body: [
          ...(book.image ? [img({ src: book.image, style: 'max-width:200px; display:block; margin:0 auto 12px; border-radius:8px' })([])] : []),
          div({ style: 'max-width:640px; margin:0 auto; padding:16px 20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); white-space:pre-wrap; line-height:1.6; font-size:14px' })([
            _evalText(ctx.state)(book.text) || '(the pages are blank.)',
          ]),
        ],
        choices: [{ label: '← Close', action: c => c.setState({ _reading: null }) }],
      })(ctx);
    }
  }

  const entries = project.items
    .filter(it => (Number(inv[it.id]) || 0) > 0)
    .filter(it => cfg.kinds.length === 0 || cfg.kinds.includes(it.kind));

  // Per-item action button
  const _itemActions = it => {
    const buttons = [];
    if (it.kind === 'consumable') {
      const useFn = _compileEffect(it.useEffect, project);
      buttons.push(button({
        type: 'button',
        onclick: () => {
          _startAction(ctx);
          useFn(ctx);
          ctx.setState(s => ({ inventory: _consumeOne(s, it.id) }));
        },
        style: 'padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:var(--accent); color:#fff; cursor:pointer; font-size:12.5px',
      })(['Use']));
    } else if (it.kind === 'readable') {
      buttons.push(button({
        type: 'button',
        onclick: () => ctx.setState({ _reading: { roomId: room.id, itemId: it.id } }),
        style: 'padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:none; color:var(--text); cursor:pointer; font-size:12.5px',
      })(['Read']));
    } else if (it.kind === 'equipment') {
      const equipped = _isEquipped(ctx.state, it.id);
      const slot = it.equipSlot || 'item';
      buttons.push(button({
        type: 'button',
        onclick: () => ctx.setState(s => {
          const eq = { ...(s.equipped || {}) };
          if (equipped) delete eq[slot]; else eq[slot] = it.id;
          return { equipped: eq };
        }),
        style: `padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:${equipped ? 'none' : 'var(--accent)'}; color:${equipped ? 'var(--text)' : '#fff'}; cursor:pointer; font-size:12.5px`,
      })([equipped ? 'Unequip' : 'Equip']));
    }
    return buttons;
  };

  const _kindBadge = it => it.kind === 'equipment' && _isEquipped(ctx.state, it.id)
    ? span({ style: 'display:inline-block; padding:1px 6px; border-radius:3px; background:var(--accent); color:#fff; font-size:10px; margin-left:6px' })(['equipped'])
    : null;

  const body = entries.length === 0
    ? [p({ style: 'color:var(--text-muted); text-align:center; margin:24px 0' })([cfg.emptyMessage || 'You are not carrying anything.'])]
    : cfg.layout === 'list'
      ? [div({ style: 'display:flex; flex-direction:column; gap:6px; max-width:680px; margin:0 auto 12px' })(
          entries.map(it => div({
            style: 'display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)',
          })([
            ...(it.image ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; flex:none' })([])] : []),
            div({ style: 'flex:1; min-width:0' })([
              div({ style: 'font-weight:600; font-size:14px' })([it.name || it.id, ...(_kindBadge(it) ? [_kindBadge(it)] : [])]),
              ...(cfg.showDescription && it.description
                ? [div({ style: 'font-size:12px; color:var(--text-muted)' })([it.description])]
                : []),
            ]),
            span({ style: 'font-family:ui-monospace,monospace; color:var(--text-muted); margin-right:8px' })([`x${inv[it.id]}`]),
            ..._itemActions(it),
          ]))
        )]
      : [div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px; max-width:880px; margin:0 auto 12px' })(
          entries.map(it => div({
            style: 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); padding:10px; display:flex; flex-direction:column; align-items:center; text-align:center',
          })([
            ...(it.image ? [img({ src: it.image, style: 'width:48px; height:48px; object-fit:contain; display:block; margin:0 auto 6px' })([])] : []),
            div({ style: 'font-weight:600; font-size:13px' })([it.name || it.id, ...(_kindBadge(it) ? [_kindBadge(it)] : [])]),
            div({ style: 'font-size:11px; color:var(--text-muted); margin-top:2px' })([`${it.kind || 'misc'} · x${inv[it.id]}`]),
            ...(cfg.showDescription && it.description
              ? [div({ style: 'font-size:11.5px; color:var(--text-muted); margin-top:4px; flex:1' })([it.description])]
              : [div({ style: 'flex:1' })([])]),
            ...(_itemActions(it).length
              ? [div({ style: 'margin-top:8px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap' })(_itemActions(it))]
              : []),
          ]))
        )];

  return Scene({
    title: room.title || 'Inventory',
    body,
    choices: room.choices.map(ch => _buildChoice(ch, project, room.id)),
  })(ctx);
};

const _buildWardrobeFn = (room, project) => ctx => {
  const wb = room.wardrobe || { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] };
  const inv = ctx.state.inventory || {};
  const equippedSlots = ctx.state.equipped || {};
  const equippedIds = new Set(Object.values(equippedSlots));
  // The kinds filter is informational — equipped items always appear, carried
  // items only if they match.
  const carrying = project.items.filter(it => wb.kinds.includes(it.kind) && (Number(inv[it.id]) || 0) > 0);

  const _toggle = it => ctx.setState(s => {
    const slot = it.equipSlot || it.kind || 'item';
    const eq = { ...(s.equipped || {}) };
    if (equippedIds.has(it.id)) {
      // unequip from whichever slot held it
      for (const [k, v] of Object.entries(eq)) if (v === it.id) delete eq[k];
    } else {
      eq[slot] = it.id;
    }
    return { equipped: eq };
  });

  const _card = it => div({
    style: `display:flex; align-items:center; gap:8px; padding:8px; border:1px solid ${equippedIds.has(it.id) ? 'var(--accent)' : 'var(--border)'}; border-radius:var(--radius); background:var(--surface)`,
  })([
    ...(it.image ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; flex:none' })([])] : []),
    div({ style: 'flex:1; min-width:0' })([
      div({ style: 'font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap' })([
        it.name || it.id,
        ...(equippedIds.has(it.id) ? [span({ style: 'display:inline-block; padding:1px 6px; border-radius:3px; background:var(--accent); color:#fff; font-size:10px; margin-left:6px' })(['equipped'])] : []),
      ]),
      div({ style: 'font-size:11px; color:var(--text-muted)' })([`${it.equipSlot || it.kind} · x${inv[it.id] || 0}`]),
    ]),
    ...(it.kind === 'equipment' ? [button({
      type: 'button',
      onclick: () => _toggle(it),
      style: `padding:4px 10px; border:1px solid var(--accent); border-radius:var(--radius); background:${equippedIds.has(it.id) ? 'none' : 'var(--accent)'}; color:${equippedIds.has(it.id) ? 'var(--text)' : '#fff'}; cursor:pointer; font-size:12px`,
    })([equippedIds.has(it.id) ? 'Take off' : 'Wear'])] : []),
  ]);

  const body = [
    _renderPortrait({ layers: wb.layers || [], width: wb.portraitWidth, height: wb.portraitHeight }, ctx),
    carrying.length === 0
      ? p({ style: 'color:var(--text-muted); text-align:center; margin:0 0 12px' })(['(nothing in this category)'])
      : div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:8px; margin:0 auto 12px; max-width:720px' })(
          carrying.map(_card)
        ),
  ];

  return Scene({
    title: room.title || 'Wardrobe',
    body,
    choices: room.choices.map(ch => _buildChoice(ch, project, room.id)),
  })(ctx);
};

// Build one Choice descriptor in the engine's shape. Wraps `action` to also
// reset the target room's page index to 0 on navigation.
const _buildChoice = (ch, project, fromRoomId) => {
  const guard  = _compileCondition(ch.condition);
  const effect = _compileEffect(ch.action, project);
  // Pre-compile the target room's onEnter gate + effect so navigation fires it.
  // The engine has no built-in onEnter hook, so we drive the goto ourselves
  // and inject the room's onEnter between the action and the navigation.
  const target = ch.to ? project.rooms.find(r => r.id === ch.to) : null;
  const enterGuard  = target ? _compileCondition(target.onEnterCondition) : () => true;
  const enterEffect = target ? _compileEffect(target.onEnter, project)    : () => {};
  return {
    label: ch.label,
    if:    c => guard(c),
    action: c => {
      // Snapshot the scene id before firing the action. If the action navigates
      // (e.g. randomLoot picked a `navigate` entry, or an enterCombat/talkTo
      // effect), we YIELD and skip the choice's default `to:`. This lets the
      // action's effect dynamically override the destination.
      _startAction(c);
      const before = c.scene;
      effect(c);
      if (c.getState()._scene !== before) return;
      if (!ch.to) return;
      c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [ch.to]: 0 } }));
      const live = { ...c, state: c.getState() };
      if (enterGuard(live)) enterEffect(c);
      c.goto(ch.to);
    },
    // No `to` returned — we already handle navigation in action so the engine
    // doesn't goto twice.
  };
};

// Resolve a shop entry's effective price = entry.price ?? item.price. Both are
// { stat, amount } shapes after normalisation; falls back to `gold 0` if the
// item disappeared. Returns the resolved `{ stat, amount }`.
const _resolvePrice = (entry, item) => {
  if (entry.price && typeof entry.price === 'object') return { stat: entry.price.stat || 'gold', amount: Number(entry.price.amount) || 0 };
  if (item?.price && typeof item.price === 'object')  return { stat: item.price.stat  || 'gold', amount: Number(item.price.amount)  || 0 };
  return { stat: 'gold', amount: 0 };
};

const _buildShopScene = (npc, project) => {
  const stock = npc.shop?.stock || [];
  const buyback = npc.shop?.buyback || { mode: 'none', multiplier: 0.8, items: [] };
  // What the shop is willing to buy back, paired with the per-item multiplier.
  // Returns `[{ item, multiplier }]` filtered to non-zero player inventory.
  const _sellable = state => {
    if (buyback.mode === 'none') return [];
    const inv = state.inventory || {};
    if (buyback.mode === 'open') {
      return project.items
        .filter(it => (Number(inv[it.id]) || 0) > 0)
        .map(it => ({ item: it, multiplier: Number(buyback.multiplier) || 0.8 }));
    }
    // list mode — only the whitelisted items, with per-item override fallback.
    return (buyback.items || [])
      .map(e => {
        const it = project.items.find(x => x.id === e.itemId);
        if (!it) return null;
        if ((Number(inv[it.id]) || 0) <= 0) return null;
        const mul = e.multiplier == null ? (Number(buyback.multiplier) || 0.8) : Number(e.multiplier);
        return { item: it, multiplier: mul };
      })
      .filter(Boolean);
  };
  const _sellPrice = (item, mul) => {
    const itemPrice = item?.price && typeof item.price === 'object'
      ? { stat: item.price.stat || 'gold', amount: Number(item.price.amount) || 0 }
      : { stat: 'gold', amount: 0 };
    return { stat: itemPrice.stat, amount: Math.floor(mul * itemPrice.amount) };
  };
  return ctx => {
    const back = ctx.scene;
    const inv  = ctx.state.inventory || {};
    const npcStock = ctx.state._shopStock?.[npc.id] || {};
    const remaining = entry => entry.quantity == null ? Infinity : Math.max(0, entry.quantity - (npcStock[entry.itemId] || 0));

    const buy = entry => c => {
      const item  = project.items.find(it => it.id === entry.itemId);
      const { stat, amount } = _resolvePrice(entry, item);
      if ((Number(c.state[stat]) || 0) < amount) return;
      if (remaining(entry) <= 0) return;
      c.setState(s => ({
        [stat]:    (Number(s[stat]) || 0) - amount,
        inventory: { ...(s.inventory || {}), [entry.itemId]: Number(s.inventory?.[entry.itemId] || 0) + 1 },
        _shopStock: {
          ...(s._shopStock || {}),
          [npc.id]: { ...(s._shopStock?.[npc.id] || {}), [entry.itemId]: (s._shopStock?.[npc.id]?.[entry.itemId] || 0) + 1 },
        },
      }));
    };

    // Sell: player → shop. Player loses 1 of the item and gains
    // floor(multiplier × item.price.amount) of the item's price stat.
    const sell = ({ item, multiplier }) => c => {
      const have = Number(c.state.inventory?.[item.id] || 0);
      if (have <= 0) return;
      const { stat, amount } = _sellPrice(item, multiplier);
      c.setState(s => {
        const newCount = (Number(s.inventory?.[item.id]) || 0) - 1;
        const nextInv = { ...(s.inventory || {}) };
        if (newCount <= 0) delete nextInv[item.id]; else nextInv[item.id] = newCount;
        return {
          [stat]:    (Number(s[stat]) || 0) + amount,
          inventory: nextInv,
        };
      });
    };

    const sellable = _sellable(ctx.state);

    // One item card: optional image, name, optional description, price + an
    // inline action button. `gef-shop-card` is just for grid styling; the
    // button uses dervo's `.btn` classes so theme tokens carry through.
    const _card = ({ image, name, description, infoLine, btnLabel, btnDisabled, onClick }) =>
      div({
        style: 'display:flex; flex-direction:column; gap:6px; padding:10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)',
      })([
        ...(image
          ? [div({ style: 'aspect-ratio:1/1; background:var(--surface-2, rgba(0,0,0,.04)); border-radius:var(--radius); overflow:hidden; display:grid; place-items:center' })([
              img({ src: image, alt: name, style: 'max-width:100%; max-height:100%; object-fit:contain' })([]),
            ])]
          : []),
        div({ style: 'font-weight:600; font-size:13px; line-height:1.3' })([name]),
        ...(description ? [div({ style: 'font-size:12px; color:var(--text-muted); line-height:1.4' })([description])] : []),
        div({ style: 'font-size:12px; color:var(--text-muted); margin-top:auto' })([infoLine]),
        button({
          className: `btn btn-primary btn-sm${btnDisabled ? ' btn-disabled' : ''}`,
          type:      'button',
          disabled:  !!btnDisabled,
          onclick:   btnDisabled ? undefined : onClick,
          style:     'margin-top:4px',
        })([btnLabel]),
      ]);

    const _grid = cards => div({
      style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px',
    })(cards);

    const stockBody = stock.length === 0
      ? [p({})(['(Nothing for sale right now.)'])]
      : [_grid(stock.map(entry => {
          const item   = project.items.find(it => it.id === entry.itemId);
          const name   = item?.name || entry.itemId;
          const { stat, amount } = _resolvePrice(entry, item);
          const rem    = remaining(entry);
          const have   = Number(inv[entry.itemId] || 0);
          const broke  = (Number(ctx.state[stat]) || 0) < amount;
          const soldOut = rem <= 0;
          return _card({
            image:       item?.image || '',
            name,
            description: item?.description ? _evalText(ctx.state)(item.description) : '',
            infoLine:    `${amount} ${stat} · You have: ${have}${rem === Infinity ? '' : ` · Left: ${rem}`}`,
            btnLabel:    soldOut ? 'Sold out' : broke ? `Need ${amount} ${stat}` : `Buy (${amount} ${stat})`,
            btnDisabled: broke || soldOut,
            onClick:     () => buy(entry)(ctx),
          });
        }))];

    const sellBody = sellable.length === 0
      ? []
      : [
          p({ style: 'margin-top:12px; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); font-weight:600' })(['Sell to shop']),
          _grid(sellable.map(({ item, multiplier }) => {
            const { stat, amount } = _sellPrice(item, multiplier);
            const have = Number(inv[item.id] || 0);
            return _card({
              image:       item.image || '',
              name:        item.name || item.id,
              description: '',
              infoLine:    `+${amount} ${stat} each · You have: ${have}`,
              btnLabel:    have <= 0 ? 'None to sell' : `Sell (+${amount} ${stat})`,
              btnDisabled: have <= 0,
              onClick:     () => sell({ item, multiplier })(ctx),
            });
          })),
        ];

    return Scene({
      title: npc.name,
      body:  [
        ...(npc.greeting ? [p({ style: 'font-style:italic; color:var(--text-muted)' })([_evalText(ctx.state)(npc.greeting)])] : []),
        ...stockBody,
        ...sellBody,
      ],
      // Buy / Sell live inline on the cards above. The choices list keeps the
      // NPC's own tail choices + Goodbye so it stays uncluttered.
      choices: [
        ...npc.choices.map(ch => _buildChoice(ch, project, back)),
        { label: 'Goodbye', action: c => c.setState({ _scene: back }) },
      ],
    })(ctx);
  };
};

// NPC dialogue with two systems toggled by `npc.advanced`.
//
//   simple (advanced: false):
//     greeting pages → flat choices (legacy). Same as v0 behaviour.
//
//   advanced (advanced: true):
//     greeting pages → entry topic → other topics via `change` flow
//     Choices on topics decide what happens next:
//       change      — push current topic on stack, switch to ch.topicId
//       exitBack    — pop the stack (or leave the NPC if stack is empty)
//       exitRoom    — leave the NPC entirely, goto ch.to (or back if ch.to:'')
//       exitCombat  — leave the NPC, start ch.combatId
//
//   State keys this owns:
//     _npcPageIdx[npcId]                 — greeting page idx
//     _npcTopic[npcId]                   — current topic id (or null = pre-topic / entry)
//     _npcTopicStack[npcId]              — [topicId,…] previously-visited topics
//     _npcTopicPageIdx[npcId][topicId]   — page idx within a topic
const _buildNpcDialogue = (npc, project) => ctx => {
  const back = ctx.scene;
  // Simple flat dialogue — preserves v0 behaviour exactly when advanced is off.
  if (!npc.advanced) return _renderNpcSimple(npc, project, back, ctx);
  return _renderNpcAdvanced(npc, project, back, ctx);
};

const _renderNpcSimple = (npc, project, back, ctx) => {
  const idx     = ctx.state._npcPageIdx?.[npc.id] || 0;
  const safeIdx = Math.min(idx, npc.pages.length - 1);
  const page    = npc.pages[safeIdx];
  const isLast  = safeIdx === npc.pages.length - 1;
  const body    = _pageBody(ctx)(page);

  if (!isLast) {
    return Scene({
      title: npc.name, body,
      choices: [{
        label: page.advanceLabel || 'More',
        action: c => c.setState(s => ({
          _npcPageIdx: { ...(s._npcPageIdx || {}), [npc.id]: safeIdx + 1 },
        })),
      }],
    })(ctx);
  }

  // Final page — render NPC's flat choices + an auto "Goodbye" when none lead out.
  const choices = npc.choices.map(ch => _buildSimpleNpcChoice(ch, project, back));
  const hasLeavingChoice = npc.choices.length > 0;   // any choice is good enough as an out
  if (!hasLeavingChoice) choices.push({ label: 'Goodbye', action: c => c.setState({ _scene: back }) });
  return Scene({ title: npc.name, body, choices })(ctx);
};

// Simple-mode choice: navigate to `ch.to` (or stay/return if empty). The action
// fires regardless. Same logic as a room choice, with the "no target → return
// to caller" convention.
const _buildSimpleNpcChoice = (ch, project, back) => {
  const guard  = _compileCondition(ch.condition);
  const effect = _compileEffect(ch.action, project);
  return {
    label: ch.label,
    if:    c => guard(c),
    action: c => {
      _startAction(c);
      const before = c.scene;
      effect(c);
      if (c.getState()._scene !== before) return;   // effect navigated; yield
      if (!ch.to) { c.setState({ _scene: back }); return; }
      const target      = (project.rooms || []).find(r => r.id === ch.to);
      const enterGuard  = target ? _compileCondition(target.onEnterCondition) : () => true;
      const enterEffect = target ? _compileEffect(target.onEnter, project)    : () => {};
      c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [ch.to]: 0 } }));
      const live = { ...c, state: c.getState() };
      if (enterGuard(live)) enterEffect(c);
      c.goto(ch.to);
    },
  };
};

// — Advanced (topic-tree) mode ————————————————————————————————

const _renderNpcAdvanced = (npc, project, back, ctx) => {
  const topics = Array.isArray(npc.topics) ? npc.topics : [];
  // If no topics defined, fall through to simple mode so the player doesn't get stuck.
  if (topics.length === 0) return _renderNpcSimple(npc, project, back, ctx);

  // 1) Greeting pages first.
  const idx     = ctx.state._npcPageIdx?.[npc.id] || 0;
  const safeIdx = Math.min(idx, npc.pages.length - 1);
  const greetingPage = npc.pages[safeIdx];
  const greetingLast = safeIdx === npc.pages.length - 1;
  const hasGreeting  = npc.pages.length > 0 && (greetingPage.text || greetingPage.image || greetingPage.video);
  const inGreeting   = hasGreeting && !ctx.state._npcGreetingDone?.[npc.id];

  if (inGreeting && !greetingLast) {
    return Scene({
      title: npc.name,
      body:  _pageBody(ctx)(greetingPage),
      choices: [{
        label: greetingPage.advanceLabel || 'More',
        action: c => c.setState(s => ({
          _npcPageIdx: { ...(s._npcPageIdx || {}), [npc.id]: safeIdx + 1 },
        })),
      }],
    })(ctx);
  }
  if (inGreeting && greetingLast) {
    return Scene({
      title: npc.name,
      body:  _pageBody(ctx)(greetingPage),
      choices: [{
        label: greetingPage.advanceLabel || 'Continue',
        action: c => c.setState(s => ({
          _npcGreetingDone: { ...(s._npcGreetingDone || {}), [npc.id]: true },
        })),
      }],
    })(ctx);
  }

  // 2) Topic mode. The "current" topic is _npcTopic[npc.id] or the entry topic.
  const entryId = npc.entryTopicId || topics[0].id;
  const cur = ctx.state._npcTopic?.[npc.id] || entryId;
  const topic = topics.find(t => t.id === cur) || topics[0];
  return _renderNpcTopic(npc, topic, topics, project, back, ctx);
};

const _renderNpcTopic = (npc, topic, allTopics, project, back, ctx) => {
  const pages  = topic.pages || [];
  const idx    = ctx.state._npcTopicPageIdx?.[npc.id]?.[topic.id] || 0;
  const safeIdx = Math.min(idx, pages.length - 1);
  const page   = pages[safeIdx];
  const isLast = safeIdx === pages.length - 1;
  const body   = _pageBody(ctx)(page);

  if (!isLast) {
    return Scene({
      title: npc.name, body,
      choices: [{
        label: page.advanceLabel || 'More',
        action: c => c.setState(s => ({
          _npcTopicPageIdx: {
            ...(s._npcTopicPageIdx || {}),
            [npc.id]: { ...(s._npcTopicPageIdx?.[npc.id] || {}), [topic.id]: safeIdx + 1 },
          },
        })),
      }],
    })(ctx);
  }

  // Final page — render the topic's choices. If empty, give the player an
  // exitBack so they're never stuck.
  const choices = (topic.choices || []).map(ch => _buildTopicChoice(ch, npc, topic, allTopics, project, back));
  if (choices.length === 0) {
    choices.push({
      label: 'Back',
      action: c => _doExitBack(c, npc, back),
    });
  }
  return Scene({ title: npc.name, body, choices })(ctx);
};

// Pop the topic stack and switch to the popped topic. Empty stack → leave NPC.
const _doExitBack = (c, npc, back) => {
  const stack = c.state._npcTopicStack?.[npc.id] || [];
  if (stack.length === 0) {
    c.setState(s => ({
      _npcTopic: { ...(s._npcTopic || {}), [npc.id]: null },
      _scene:    back,
    }));
    return;
  }
  const previousId = stack[stack.length - 1];
  c.setState(s => ({
    _npcTopic:      { ...(s._npcTopic      || {}), [npc.id]: previousId },
    _npcTopicStack: { ...(s._npcTopicStack || {}), [npc.id]: stack.slice(0, -1) },
  }));
};

// Topic choice → engine descriptor. Each flow translates to a concrete action.
const _buildTopicChoice = (ch, npc, topic, allTopics, project, back) => {
  const guard  = _compileCondition(ch.condition);
  const effect = _compileEffect(ch.action, project);
  const flow   = ch.flow || 'exitBack';

  return {
    label: ch.label,
    if:    c => guard(c),
    action: c => {
      _startAction(c);
      const before = c.scene;
      effect(c);
      // If the effect already navigated (randomLoot navigate, enterCombat,
      // talkTo, etc.) we yield to it and skip the choice's flow-based nav.
      if (c.getState()._scene !== before) return;

      // `stay` — effect ran, no navigation. The scene re-renders on next tick;
      // current topic + page index are untouched.
      if (flow === 'stay') return;

      if (flow === 'exitBack') return _doExitBack(c, npc, back);

      if (flow === 'change' && ch.topicId) {
        const target = allTopics.find(t => t.id === ch.topicId);
        c.setState(s => ({
          _npcTopicStack:   { ...(s._npcTopicStack   || {}), [npc.id]: [...(s._npcTopicStack?.[npc.id] || []), topic.id] },
          _npcTopic:        { ...(s._npcTopic        || {}), [npc.id]: ch.topicId },
          _npcTopicPageIdx: { ...(s._npcTopicPageIdx || {}), [npc.id]: { ...(s._npcTopicPageIdx?.[npc.id] || {}), [ch.topicId]: 0 } },
        }));
        if (target) _compileEffect(target.onEnter, project)(c);
        return;
      }

      if (flow === 'exitRoom') {
        if (!ch.to) { c.setState({ _scene: back }); return; }
        const target      = (project.rooms || []).find(r => r.id === ch.to);
        const enterGuard  = target ? _compileCondition(target.onEnterCondition) : () => true;
        const enterEffect = target ? _compileEffect(target.onEnter, project)    : () => {};
        c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [ch.to]: 0 } }));
        const live = { ...c, state: c.getState() };
        if (enterGuard(live)) enterEffect(c);
        c.goto(ch.to);
        return;
      }

      if (flow === 'exitCombat' && ch.combatId) {
        const combat = (project.combats || []).find(cb => cb.id === ch.combatId);
        if (!combat) return;
        c.setState({
          _combat: {
            id:       combat.id,
            enemyHp:  Number(combat.enemy.hp) || 1,
            log:      combat.intro ? [combat.intro] : [],
            turn:     0,
            lastMoveImage: null,
            returnTo: back,
            outcome:  null,
          },
        });
        c.goto(`_combat:${combat.id}`);
        return;
      }
    },
  };
};

// Sidebar widget renderers — return [vnode] per widget. The createGame engine
// wraps them in a scrollable column; we just emit content.
const _renderSidebar = project => ctx => {
  const sb = project.sidebar || { enabled: false, widgets: [] };
  if (!sb.enabled) return [];
  return sb.widgets.map(w => _renderWidget(w, project, ctx)).filter(Boolean);
};

const _renderWidget = (w, project, ctx) => {
  switch (w.type) {
    case 'title':
      return div({ style: 'margin-bottom:12px' })([
        h3({ style: 'margin:0; font-size:15px' })([w.label || project.meta.title || 'Game']),
      ]);
    case 'portrait':
      return _renderPortrait(w, ctx);
    case 'stats': {
      const all  = project.stats.map(s => s.key);
      const keys = (w.keys && w.keys.length) ? w.keys : all;
      return div({ style: 'margin-bottom:12px' })([
        h3({ style: 'margin:0 0 6px; font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em' })(['Stats']),
        div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:13px' })(
          keys.map(k => div({ style: 'display:flex; justify-content:space-between' })([
            span({})([k]),
            span({ style: 'font-family:ui-monospace,monospace' })([String(ctx.state[k] ?? 0)]),
          ]))
        ),
      ]);
    }
    case 'roomLink': {
      if (!w.roomId) return null;
      const target = project.rooms.find(r => r.id === w.roomId);
      return button({
        type: 'button',
        onclick: () => { ctx.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [w.roomId]: 0 } })); ctx.goto(w.roomId); },
        style: 'display:flex; align-items:center; gap:8px; width:100%; margin-bottom:8px; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-size:13px; text-align:left; cursor:pointer',
        title: target ? `Go to ${target.title || target.id}` : `Missing room: ${w.roomId}`,
      })([
        ...(w.icon ? [span({ style: 'font-size:16px' })([w.icon])] : []),
        span({ style: 'flex:1' })([w.label || target?.title || w.roomId]),
        span({ style: 'color:var(--text-muted); font-size:11px' })(['→']),
      ]);
    }
    case 'js': {
      return _renderJsWidget(w, ctx);
    }
    case 'inventory': {
      const inv = ctx.state.inventory || {};
      const entries = Object.entries(inv).filter(([, n]) => n > 0);
      const items = project.items;
      const itemById = Object.fromEntries(items.map(it => [it.id, it]));
      return div({ style: 'margin-bottom:12px' })([
        h3({ style: 'margin:0 0 6px; font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em' })(['Inventory']),
        ...(entries.length === 0
          ? [p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })(['(empty)'])]
          : (w.layout === 'grid'
              ? [div({ style: 'display:grid; grid-template-columns:repeat(auto-fill,minmax(56px,1fr)); gap:6px' })(
                  entries.map(([id, n]) => {
                    const it = itemById[id];
                    return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:6px; background:var(--surface); text-align:center; font-size:11px' })([
                      ...(it?.image ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; display:block; margin:0 auto 4px' })([])] : []),
                      div({})([it?.name || id]),
                      div({ style: 'color:var(--text-muted)' })([`x${n}`]),
                    ]);
                  }))]
              : [div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:13px' })(
                  entries.map(([id, n]) => {
                    const it = itemById[id];
                    return div({ style: 'display:flex; justify-content:space-between; gap:8px' })([
                      span({})([it?.name || id]),
                      span({ style: 'font-family:ui-monospace,monospace; color:var(--text-muted)' })([`x${n}`]),
                    ]);
                  }))]
            )),
      ]);
    }
    default:
      return null;
  }
};

// Compile a JS widget body once per body string. The body must `return` a
// vnode (or null). The compiled function gets common helpers in scope so the
// author doesn't have to import them at the call site.
const _jsCache = new WeakMap();   // keyed by widget object (mutates on edit, so re-compile)
const _renderJsWidget = (w, ctx) => {
  let fn = _jsCache.get(w);
  if (!fn) {
    try {
      // eslint-disable-next-line no-new-func
      fn = new Function('ctx', 'state', 'div', 'span', 'p', 'h3', 'img', 'video', 'button', w.body || 'return null;');
    } catch (e) {
      fn = () => div({ style: 'padding:8px; border:1px solid #c00; border-radius:4px; color:#c00; font-size:12px' })([
        'JS widget compile error: ' + e.message,
      ]);
    }
    _jsCache.set(w, fn);
  }
  try {
    const out = fn(ctx, ctx.state, div, span, p, h3, img, video, button);
    return out ?? div({})([]);
  } catch (e) {
    return div({ style: 'padding:8px; border:1px solid #c00; border-radius:4px; color:#c00; font-size:12px' })([
      'JS widget runtime error: ' + e.message,
    ]);
  }
};

const _renderPortrait = (w, ctx) => {
  const width  = Number(w.width)  || 220;
  const height = Number(w.height) || 280;
  const inv = ctx.state.inventory || {};
  return div({ style: 'margin-bottom:12px; display:flex; justify-content:center' })([
    div({ style: `position:relative; width:${width}px; height:${height}px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden` })(
      (w.layers || []).map(layer => {
        // first matching binding wins. An item counts as "worn" if it's either
        // currently equipped in any slot, or sitting in inventory (the old
        // semantic, retained for projects that don't use the equip system).
        const equippedIds = Object.values(ctx.state.equipped || {});
        const binding = (layer.bindings || []).find(b => b.itemId && (
          equippedIds.includes(b.itemId) || (Number(inv[b.itemId] || 0) > 0)
        ));
        const src = binding?.image || layer.defaultImage;
        if (!src) return div({})([]);
        return img({ src, style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none' })([]);
      })
    ),
  ]);
};

const _randInt = n => (n > 0 ? Math.floor(Math.random() * (n + 1)) : 0);   // 0..N inclusive

// Compute final damage for a player move/skill against the enemy.
// returns { hit, damage, log }
const _resolveSkillHit = (move, state, enemy) => {
  // Roll to-hit
  const hitMode = move.hitMode || 'always';
  let hit = true;
  if (hitMode === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(move.hitPercent) || 100));
    hit = Math.floor(Math.random() * 100) + 1 <= pct;
  } else if (hitMode === 'statRoll') {
    const roll  = Math.floor(Math.random() * 20) + 1;
    const bonus = (move.hitStat ? (Number(state[move.hitStat]) || 0) : 0) + (Number(move.hitBonus) || 0);
    const dc    = (Number(enemy.defense) || 0) + (Number(move.hitDc) || 0);
    hit = (roll + bonus) >= dc;
  }
  if (!hit) return { hit: false, damage: 0 };

  // Damage formula: base + stat*mul + random
  const base   = Number(move.damage) || 0;
  const statD  = move.damageStat ? (Number(state[move.damageStat]) || 0) * (Number(move.damageStatMul) || 0) : 0;
  const randD  = _randInt(Number(move.damageRandom) || 0);
  const raw    = base + statD + randD;
  const damage = Math.max(0, raw - (Number(enemy.defense) || 0));
  return { hit: true, damage };
};

const _resolveSkillHeal = (move, state) => {
  const base  = Number(move.selfHeal) || 0;
  const statH = move.selfHealStat ? (Number(state[move.selfHealStat]) || 0) * (Number(move.selfHealStatMul) || 0) : 0;
  const randH = _randInt(Number(move.selfHealRandom) || 0);
  return base + statH + randH;
};

// Smart AI selection: filter by useWhen, then weighted-random among survivors.
const _pickEnemyAction = (actions, ctxInfo) => {
  if (!actions.length) return null;
  const { enemyHp, enemyMaxHp, state, lastResult } = ctxInfo;
  const eligible = actions.filter(a => {
    switch (a.useWhen || 'always') {
      case 'always':       return true;
      case 'belowHp':      return enemyHp <= (enemyMaxHp * ((Number(a.hpThreshold) || 50) / 100));
      case 'aboveHp':      return enemyHp  > (enemyMaxHp * ((Number(a.hpThreshold) || 50) / 100));
      case 'onPlayerMiss': return lastResult === 'miss';
      case 'js': {
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('enemyHp', 'enemyMaxHp', 'state', 'lastResult', a.jsCondition || 'return true;');
          return !!fn(enemyHp, enemyMaxHp, state, lastResult);
        } catch (_) { return false; }
      }
      default: return true;
    }
  });
  const pool = eligible.length ? eligible : actions;   // fallback: ignore rules if nothing eligible
  const totalW = pool.reduce((a, b) => a + Math.max(0, Number(b.weight) || 0), 0);
  if (totalW <= 0) return pool[Math.floor(Math.random() * pool.length)];
  let r = Math.random() * totalW;
  for (const a of pool) {
    r -= Math.max(0, Number(a.weight) || 0);
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
};

// Combat scene factory — renders the encounter, applies moves, runs enemy
// turns, branches to winRoom / loseRoom / returnTo as configured.
const _buildCombatSceneFn = (combat, project) => ctx => {
  const cs = ctx.state._combat;
  if (!cs || cs.id !== combat.id) {
    return Scene({ title: combat.name, body: [p({})(['(no active combat)'])], choices: [
      { label: 'Leave', action: c => c.goto(cs?.returnTo || project.rooms[0]?.id || 'start') },
    ] })(ctx);
  }

  // Outcome screen — onWin / onLose run before navigation. linkedNpcId on win
  // also removes the NPC from world by clearing its location.
  if (cs.outcome === 'win' || cs.outcome === 'lose') {
    const targetRoom = (cs.outcome === 'win' ? combat.winRoom : combat.loseRoom) || cs.returnTo;
    const flavour    =  _evalText(ctx.state)(cs.outcome === 'win' ? (combat.winText  || 'You won!') : (combat.loseText || 'You were defeated.'));
    const lootEntries = cs.outcome === 'win' ? Object.entries(combat.enemy.loot || {}).filter(([, n]) => Number(n) > 0) : [];
    const onWinFn  = _compileEffect(combat.onWin,  project);
    const onLoseFn = _compileEffect(combat.onLose, project);
    // Pick the outcome image: explicit winImage / loseImage wins; otherwise
    // fall back to the greyed-out enemy portrait so the layout never empties.
    const outcomeImg = cs.outcome === 'win'
      ? (combat.winImage  || combat.enemy.image)
      : (combat.loseImage || combat.enemy.image);
    const isFallback = outcomeImg === combat.enemy.image && !(cs.outcome === 'win' ? combat.winImage : combat.loseImage);
    return Scene({
      title: combat.name,
      body: [
        ...(outcomeImg
          ? [img({ src: outcomeImg, style: `max-width:280px; display:block; margin:0 auto 12px; border-radius:8px${isFallback ? '; opacity:.5; filter:grayscale(.8)' : ''}` })([])]
          : []),
        p({ style: 'font-size:16px; text-align:center; margin:0 0 8px' })([flavour]),
        ...(lootEntries.length
          ? [p({ style: 'text-align:center; color:var(--text-muted); margin:0 0 8px' })([
              'Loot: ' + lootEntries.map(([id, n]) => `${project.items.find(it => it.id === id)?.name || id} x${n}`).join(', '),
            ])]
          : []),
      ],
      choices: [{
        label: 'Continue',
        action: c => {
          _startAction(c);
          // 1. Apply loot (only on win)
          if (cs.outcome === 'win' && lootEntries.length) {
            c.setState(s => {
              const inv = { ...(s.inventory || {}) };
              for (const [id, n] of lootEntries) inv[id] = (Number(inv[id]) || 0) + Number(n);
              return { inventory: inv };
            });
          }
          // 2. Run the configured outcome effect (gold add, learn skill, JS, …)
          (cs.outcome === 'win' ? onWinFn : onLoseFn)(c);
          // 3. linkedNpc → remove from world on win
          if (cs.outcome === 'win' && combat.linkedNpcId) {
            c.setState(s => {
              const next = { ...(s.npcLocations || {}) };
              delete next[combat.linkedNpcId];
              return {
                npcLocations: next,
                flags: { ...(s.flags || {}), [`${combat.linkedNpcId}_defeated`]: true },
              };
            });
          }
          // 4. Clear combat + navigate
          c.setState({ _combat: null });
          c.goto(targetRoom);
        },
      }],
    })(ctx);
  }

  const playerHp = Number(ctx.state[combat.playerStat] || 0);

  // Player's available moves = learned skills (catalogue lookup) + extraMoves
  const learnedSkillIds = Array.isArray(ctx.state.skills) ? ctx.state.skills : [];
  const playerSkills    = learnedSkillIds.map(id => (project.skills || []).find(s => s.id === id)).filter(Boolean);
  const allMoves        = [...playerSkills, ...(combat.extraMoves || [])];

  const _enemyTurn = (sBeforeEnemy, playerResult) => {
    const cstate = sBeforeEnemy._combat || {};
    const action = _pickEnemyAction(combat.enemy.actions || [], {
      enemyHp:    cstate.enemyHp,
      enemyMaxHp: Number(combat.enemy.hp) || 1,
      state:      sBeforeEnemy,
      lastResult: playerResult,                     // 'hit' | 'miss'
    });
    if (!action) return sBeforeEnemy;
    // Heal action: restore enemy HP (capped at max)
    if (action.kind === 'heal') {
      const amount = (Number(action.healAmount) || 0) + _randInt(Number(action.healRandom) || 0);
      const newEnemyHp = Math.min(Number(combat.enemy.hp) || 1, cstate.enemyHp + amount);
      const log = [...(cstate.log || []), `${combat.enemy.name} ${action.label || 'heals'} (+${amount} HP).`];
      return { ...sBeforeEnemy, _combat: { ...cstate, enemyHp: newEnemyHp, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: action.image || null, lastEnemyText: action.flavourText || '' } };
    }
    // Attack: roll to-hit, then apply damage with random
    const pct = Math.max(0, Math.min(100, Number(action.hitPercent ?? 100)));
    const hit = Math.floor(Math.random() * 100) + 1 <= pct;
    if (!hit) {
      const log = [...(cstate.log || []), `${combat.enemy.name} ${action.label || 'attacks'} — miss.`];
      return { ...sBeforeEnemy, _combat: { ...cstate, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: action.image || null, lastEnemyText: action.flavourText || '' } };
    }
    const damage = Math.max(0, (Number(action.damage) || 0) + _randInt(Number(action.damageRandom) || 0));
    const newPlayerHp = Math.max(0, (Number(sBeforeEnemy[combat.playerStat]) || 0) - damage);
    const next = { ...sBeforeEnemy, [combat.playerStat]: newPlayerHp };
    const log  = [...(cstate.log || []), `${combat.enemy.name} ${action.label || 'strikes'} for ${damage}.`];
    if (newPlayerHp <= 0) {
      return { ...next, _combat: { ...cstate, log, outcome: 'lose', lastEnemyImage: action.image || null, lastEnemyText: action.flavourText || '' } };
    }
    return { ...next, _combat: { ...cstate, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: action.image || null, lastEnemyText: action.flavourText || '' } };
  };

  const _useMove = move => c => {
    c.setState(s => {
      const inv = s.inventory || {};
      if (move.requireItem && (Number(inv[move.requireItem]) || 0) < 1) return {};
      if (move.costStat && (Number(s[move.costStat]) || 0) < (Number(move.costValue) || 0)) return {};
      if (move.costItem  && (Number(inv[move.costItem])  || 0) < 1) return {};

      // Pay costs first (always paid, even on miss)
      const newInv = { ...inv };
      if (move.costItem) {
        newInv[move.costItem] = (Number(newInv[move.costItem]) || 0) - 1;
        if (newInv[move.costItem] <= 0) delete newInv[move.costItem];
      }
      const newStat = move.costStat ? { [move.costStat]: (Number(s[move.costStat]) || 0) - (Number(move.costValue) || 0) } : {};

      // Roll to-hit + damage via the helper (random + stat scaling + defense)
      const result = _resolveSkillHit(move, s, combat.enemy);
      const heal   = _resolveSkillHeal(move, s);
      const newEnemyHp = Math.max(0, (s._combat?.enemyHp || 0) - (result.hit ? result.damage : 0));
      const newPHp     = Math.min((Number(s[combat.playerStat]) || 0) + heal, 9999);
      const logLine = result.hit
        ? `You use ${move.name || move.label} → ${result.damage} dmg${heal ? `, +${heal} HP` : ''}.`
        : `You use ${move.name || move.label} → miss.`;
      const log = [...(s._combat?.log || []), logLine];

      const partial = {
        ...newStat,
        [combat.playerStat]: newPHp,
        inventory: newInv,
        _combat: { ...s._combat, enemyHp: newEnemyHp, log, lastMoveImage: move.image || null, lastMoveText: move.flavourText || '', lastEnemyImage: null, lastEnemyText: '' },
      };

      if (newEnemyHp <= 0) {
        return { ...partial, _combat: { ...partial._combat, outcome: 'win' } };
      }
      return _enemyTurn(partial, result.hit ? 'hit' : 'miss');
    });
  };

  const moveButtons = allMoves.length === 0
    ? [{ label: 'Flee (no skills known)', action: c => { c.setState({ _combat: null }); c.goto(cs.returnTo); } }]
    : allMoves.map(m => {
        const inv = ctx.state.inventory || {};
        const guardItem = !m.requireItem || (Number(inv[m.requireItem]) || 0) >= 1;
        const guardCost = !m.costStat    || (Number(ctx.state[m.costStat]) || 0) >= (Number(m.costValue) || 0);
        const guardCons = !m.costItem    || (Number(inv[m.costItem]) || 0) >= 1;
        return {
          label: `${m.name || m.label}${m.damage ? ` (${m.damage})` : ''}`,
          if:    () => guardItem && guardCost && guardCons,
          action: _useMove(m),
        };
      });

  const lastLog = (cs.log || []).slice(-4);

  const body = [
    div({ style: 'display:grid; grid-template-columns:1fr auto; gap:16px; align-items:start; margin-bottom:12px' })([
      div({})([
        ...(combat.enemy.image ? [img({ src: combat.enemy.image, style: 'max-width:200px; border-radius:8px; display:block; margin-bottom:8px' })([])] : []),
        div({ style: 'font-weight:600; font-size:16px' })([combat.enemy.name]),
        div({ style: 'font-size:13px; color:var(--text-muted)' })([`HP: ${cs.enemyHp} / ${combat.enemy.hp}`]),
      ]),
      div({ style: 'text-align:right' })([
        div({ style: 'font-size:13px; color:var(--text-muted)' })(['You']),
        div({ style: 'font-weight:600; font-size:18px' })([`${combat.playerStat}: ${playerHp}`]),
      ]),
    ]),
    // Last-action banner: prefers the player's move (set when the player just
    // acted) and falls back to the enemy's action (set after the enemy's
    // turn). Image + flavour sit together.
    ...((cs.lastMoveImage || cs.lastMoveText || cs.lastEnemyImage || cs.lastEnemyText)
      ? [div({ style: 'display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:12px' })([
          ...((cs.lastMoveImage || cs.lastEnemyImage)
            ? [img({
                src: cs.lastMoveImage || cs.lastEnemyImage,
                style: 'max-width:200px; max-height:180px; display:block; border-radius:8px',
              })([])]
            : []),
          ...((cs.lastMoveText || cs.lastEnemyText)
            ? [p({ style: 'margin:0; text-align:center; font-style:italic; color:var(--text-muted); font-size:13px; max-width:380px' })([
                _evalText(ctx.state)(cs.lastMoveText || cs.lastEnemyText),
              ])]
            : []),
        ])]
      : []),
    div({ style: 'background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; min-height:60px; font-size:13px; margin-bottom:12px' })(
      lastLog.length === 0
        ? [span({ style: 'color:var(--text-muted)' })(['Pick a move.'])]
        : lastLog.map(line => div({ style: 'margin:2px 0' })([line]))
    ),
  ];

  return Scene({ title: combat.name, body, choices: moveButtons })(ctx);
};

const buildGameConfig = rawProject => {
  // Resolve every `asset:<id>` ref to the actual data URL once, so the rest
  // of this file can stay agnostic of the catalogue model.
  const project = resolveAssetsForPreview(rawProject);
  // Every scene render goes through _withMessageOverlay so a non-empty
  // _messageQueue shows a Continue interstitial BEFORE the underlying scene
  // paints. Empty queue → straight to the scene.
  const scenes = Object.fromEntries(
    project.rooms.map(r => [r.id, _withMessageOverlay(_buildSceneFn(r, project))])
  );

  // Combat scenes — addressed as `_combat:<id>`; enterCombat goto's these.
  for (const cb of (project.combats || [])) {
    scenes[`_combat:${cb.id}`] = _withMessageOverlay(_buildCombatSceneFn(cb, project));
  }

  const npcs = Object.fromEntries(
    project.npcs.map(n => [n.id, {
      name:      n.name,
      locations: n.locations,
      greeting:  n.greeting,
      dialogue:  n.role === 'shop'
        ? _buildShopScene(n, project)
        : _buildNpcDialogue(n, project),
    }])
  );

  // Initial state — stats, flags, starting inventory, internal indices
  const startingInv = Object.fromEntries(
    Object.entries(project.startingInventory || {})
      .filter(([id, n]) => n > 0 && project.items.find(it => it.id === id))
      .map(([id, n]) => [id, Number(n) || 0])
  );
  const startingSkills = Array.isArray(project.startingSkills)
    ? project.startingSkills.filter(id => project.skills?.find(s => s.id === id))
    : [];
  // Starting equipment — keys are slot names; values must be itemIds the
  // catalogue still contains. Slots referencing missing items are dropped.
  const knownIds = new Set(project.items.map(it => it.id));
  const startingEquipped = Object.fromEntries(
    Object.entries(project.startingEquipped || {})
      .filter(([slot, id]) => slot && id && knownIds.has(id))
  );
  const initial = {
    ...Object.fromEntries(project.stats.map(s => [s.key, Number(s.initial) || 0])),
    flags:      Object.fromEntries(project.flags.map(f => [f.key, !!f.initial])),
    inventory:  startingInv,
    equipped:   startingEquipped,
    skills:     startingSkills,
    _pageIdx:    {},
    _npcPageIdx: {},
    _npcGreetingDone: {},  // { [npcId]: bool }    advanced mode: skip greeting on re-enter via change/back
    _npcTopic:        {},  // { [npcId]: topicId|null }
    _npcTopicStack:   {},  // { [npcId]: [topicId...] }  stack pushed by `change`, popped by `exitBack`
    _npcTopicPageIdx: {},  // { [npcId]: { [topicId]: idx } }
    _shopStock:  {},
    _combat:        null,
    _reading:       null,
    _lootLog:       [],   // last 8 "Loot: X x2" lines from randomLoot picks
    _messageQueue:  [],   // pending Effect.message lines — shown as Continue overlay
    _msgInit:       {},   // pre-action state snapshot for init / gain / loss scope
  };

  // Auto-reset NPC page index on talkTo (the engine doesn't expose a hook, so
  // we wrap the dialogue function above to read state.[_npcPageIdx][npc.id]).
  // The first time you talk, idx defaults to 0; further talks resume where
  // they left off. To force a reset every talk, set idx to 0 below via an
  // npcResetOnTalk effect — left as a v2 polish.

  const sb = project.sidebar || { enabled: false, widgets: [] };
  return {
    title:   project.meta.title || 'Untitled RPG',
    start:   project.meta.start || project.rooms[0]?.id || 'start',
    state:   initial,
    scenes,
    npcs,
    sidebar: sb.enabled && sb.widgets.length ? _renderSidebar(project) : undefined,
    debug:   true,   // floating State Debugger / RenderProfiler / ListenersDebugger panel in the preview
  };
};

export { buildGameConfig };
