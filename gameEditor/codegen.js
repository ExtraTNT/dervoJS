/**
 * codegen.js — emit JS source files for a project. The shape mirrors the
 * existing demoGame/ layout so the export drops in next to dervoJS and runs.
 *
 * Files:
 *   main.js     — entry, calls createGame and mounts it
 *   scenes.js   — id -> (ctx) => Scene(...)(ctx) map
 *   world.js    — NPCS map with greetings + dialogue functions
 *   items.js    — item catalogue + initial state
 *   index.html  — boots main.js as a module
 *
 * Semantics match preview.js exactly. All emitted JS imports from
 * `../src/index.js`, assuming the export folder sits at the dervoJS root.
 */

const _q = s => JSON.stringify(s ?? '');

// Project → extra import lines, scoped to one of the generated files
// ('main' / 'scenes' / 'world' / 'items' / 'sidebar'). Each entry yields one
// `import <binding> from '<target>';` line (or a bare `import '<target>';`
// when the binding is empty for side-effect imports). Author errors fall
// through quietly — empty target = skipped.
const _extraImports = (project, file) => {
  const list = (project.meta?.imports || []).filter(imp => imp && imp.file === file && imp.target);
  if (list.length === 0) return '';
  return list.map(imp => imp.binding
    ? `import ${imp.binding} from '${imp.target}';`
    : `import '${imp.target}';`
  ).join('\n') + '\n';
};

// Message-buffer helpers baked into scenes.js. Mirror the preview-time
// versions: _diff, _pushMsg, _startAction, _withMessageOverlay. Every choice
// action calls _startAction(c) at the top to snapshot state into _msgInit and
// reset _messageQueue; every Effect that carries a `message` field calls
// _pushMsg(c, tpl) after its core ran; every scene render is wrapped with
// _withMessageOverlay so a non-empty queue shows a Continue interstitial.
const _MESSAGE_HELPERS = `
const __isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
const _diff = (init, after) => {
  const out = {};
  const keys = new Set([...Object.keys(init || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k.startsWith('_')) continue;
    const a = (init  || {})[k];
    const b = (after || {})[k];
    if (__isObj(a) || __isObj(b)) {
      const sub = _diff(a || {}, b || {});
      if (Object.keys(sub).length) out[k] = sub;
    } else if (Array.isArray(a) || Array.isArray(b)) {
      const before = a || [], now = b || [];
      const added = now.filter(x => !before.includes(x));
      if (added.length) out[k] = added;
    } else if (typeof b === 'number') {
      const d = b - (Number(a) || 0);
      if (d > 0) out[k] = d;
    } else if (typeof b === 'boolean') {
      if (b === true && !a) out[k] = true;
    }
  }
  return out;
};
const _pushMsg = (c, tpl) => {
  if (!tpl) return;
  const state = c.getState();
  const init  = state._msgInit || {};
  const gain  = _diff(init, state);
  const loss  = _diff(state, init);
  const scope = { ...state, init, gain, loss };
  const text = _t(scope, tpl);
  if (!text) return;
  c.setState(s => ({ _messageQueue: [...(s._messageQueue || []), text] }));
};
const _startAction = c => {
  c.setState(s => {
    const init = { ...s };
    delete init._msgInit;
    delete init._messageQueue;
    return { _msgInit: init, _messageQueue: [] };
  });
};
const _withMessageOverlay = sceneFn => ctx => {
  const queue = ctx.state._messageQueue || [];
  if (queue.length === 0) return sceneFn(ctx);
  return Scene({
    title: '',
    body: queue.map(m => p({ style: 'margin:0 0 10px; line-height:1.55' })([m])),
    choices: [{ label: 'Continue', action: c => c.setState({ _messageQueue: [] }) }],
  })(ctx);
};`;

// Inline-template helper baked into the top of every emitted file that
// renders narrative text. Mirrors the preview-time _evalText: substitutes
// `${expr}` snippets using a `with (state)` scope, caching compiled segments
// per source string. Compile/runtime failures degrade to the verbatim source
// so authors see what broke instead of crashing the scene.
const _TEMPLATE_HELPER = `
const __tplCache = new Map();
const _t = (state, text) => {
  if (!text || typeof text !== 'string' || text.indexOf('\${') < 0) return text || '';
  let segs = __tplCache.get(text);
  if (!segs) {
    segs = [];
    let i = 0;
    while (i < text.length) {
      const s = text.indexOf('\${', i);
      if (s < 0) { segs.push(text.slice(i)); break; }
      if (s > i) segs.push(text.slice(i, s));
      const e = text.indexOf('}', s + 2);
      if (e < 0) { segs.push(text.slice(s)); break; }
      const verb = text.slice(s, e + 1);
      let fn;
      try { fn = new Function('state', 'with (state) { return (' + text.slice(s + 2, e) + '); }'); }
      catch (_) { segs.push(verb); i = e + 1; continue; }
      segs.push({ src: verb, fn });
      i = e + 1;
    }
    __tplCache.set(text, segs);
  }
  const st = state || {};
  return segs.map(seg => {
    if (typeof seg === 'string') return seg;
    try { const v = seg.fn(st); return v == null ? '' : String(v); }
    catch (_) { return seg.src; }
  }).join('');
};`;

// Compile a Condition to a JS expression string that returns boolean.
// `c` (ctx) is the default state source so every existing call site keeps
// reading `c.state.*`. Per-op condition gates pass `stateExpr: 's'` so the
// gate sees the in-progress reducer state and earlier ops can flip flags a
// later op gates on.
const _condExpr = (cond, stateExpr = 'c.state') => {
  if (!cond || cond.mode === 'always') return 'true';
  if (cond.mode === 'js') {
    // Default state source — emit the user's expression verbatim so the
    // existing call sites (choices, weight bonuses, …) stay byte-identical.
    if (stateExpr === 'c.state') return `(${cond.expr || 'true'})`;
    // Per-op condition with the IN-PROGRESS state. Rebind `c.state` to the
    // in-progress reducer state via a one-shot IIFE so the user's expression
    // can keep using `c.state.<key>` and see earlier ops' writes.
    return `((c => (${cond.expr || 'true'}))({ ...c, state: ${stateExpr} }))`;
  }
  if (cond.mode === 'simple') {
    const left =
      cond.key?.startsWith('flags.') ? `${stateExpr}.flags?.[${_q(cond.key.slice(6))}]`
      : cond.key?.startsWith('inv.')  ? `(${stateExpr}.inventory?.[${_q(cond.key.slice(4))}] ?? 0)`
      : `${stateExpr}[${_q(cond.key)}]`;
    const right = typeof cond.value === 'string' ? _q(cond.value) : (cond.value ?? 0);
    return `(${left} ${cond.op} ${right})`;
  }
  if (cond.mode === 'hasItem') {
    const have = `(${stateExpr}.inventory?.[${_q(cond.itemId)}] ?? 0)`;
    if (cond.op === 'has')     return `(${have} >= 1)`;
    if (cond.op === 'lacks')   return `(${have} <= 0)`;
    if (cond.op === 'atleast') return `(${have} >= ${Number(cond.count || 1)})`;
  }
  return 'true';
};

// Emit a clamp limit as a JS expression evaluated against the in-progress `s`.
// Returns null when the limit is off so the caller can omit the clamp branch.
const _limitExpr = limit => {
  if (!limit || !limit.enabled) return null;
  const mul = Number(limit.mul) || 0;
  const c   = Number(limit.const) || 0;
  const k   = limit.statKey || '';
  // statKey === '' → mul * 0 + const = pure constant. Keep the form general
  // so the emitted code reads the same shape across enabled limits.
  return `(${mul} * (Number(s[${_q(k)}]) || 0) + ${c})`;
};

// Wrap a numeric `nextExpr` in Math.max/min when min/max limits are enabled.
const _wrapClamp = (nextExpr, op, { invFloor = false } = {}) => {
  const lo = _limitExpr(op?.min);
  const hi = _limitExpr(op?.max);
  let out = nextExpr;
  // Inventory takes/gives implicitly floor at 0 even without a user min.
  const effectiveLo = invFloor && !lo ? '0' : lo;
  if (effectiveLo != null) out = `Math.max(${effectiveLo}, ${out})`;
  if (hi != null)          out = `Math.min(${hi}, ${out})`;
  return out;
};

// Compile a single Op (simple-mode) to a sequence of patch keys. Returns
// `{ key, value }` strings — caller wraps in `next = { ...next, [key]: value }`.
// Returns null for ops that don't write (no target, toggle on missing kind, …).
const _opPatchPair = op => {
  const { target, op: kind, value } = op || {};
  if (!target) return null;
  if (target.startsWith('flags.')) {
    const k = target.slice(6);
    const next = kind === 'toggle' ? `!(s.flags || {})[${_q(k)}]` : Boolean(value);
    return { key: 'flags', value: `{ ...(s.flags || {}), [${_q(k)}]: ${next} }` };
  }
  if (target.startsWith('inv.')) {
    const k = target.slice(4);
    const cur = `((s.inventory || {})[${_q(k)}] || 0)`;
    const n = Number(value) || 0;
    const raw =
      kind === 'give' ? `${cur} + ${n}`
      : kind === 'take' ? `${cur} - ${n}`
      : kind === 'set'  ? `${n}`
      : cur;
    // Implicit floor of 0 only on `take` — matches the engine's original
    // behaviour and what the preview does. User min/max apply on top.
    const clamped = _wrapClamp(raw, op, { invFloor: kind === 'take' });
    return { key: 'inventory', value: `{ ...(s.inventory || {}), [${_q(k)}]: ${clamped} }` };
  }
  if (target.startsWith('skills.')) {
    const k = target.slice(7);
    if (kind === 'learn')  return { key: 'skills', value: `(s.skills || []).includes(${_q(k)}) ? (s.skills || []) : [...(s.skills || []), ${_q(k)}]` };
    if (kind === 'forget') return { key: 'skills', value: `(s.skills || []).filter(x => x !== ${_q(k)})` };
    return null;
  }
  const cur = `(s[${_q(target)}] ?? 0)`;
  const isNumeric = Number.isFinite(Number(value));
  const v = isNumeric ? Number(value) : _q(value);
  const raw =
    kind === 'set' ? `${v}`
    : kind === 'add' ? `${cur} + ${isNumeric ? v : 0}`
    : kind === 'sub' ? `${cur} - ${isNumeric ? v : 0}`
    : cur;
  // Only clamp numeric writes — string `set` (e.g. label) passes through.
  const clamped = (isNumeric || kind !== 'set') ? _wrapClamp(raw, op) : raw;
  return { key: target, value: clamped };
};

// One op → one JS block. Always introduces `s = next` so the per-op
// `condition` (gated on the IN-PROGRESS state) and the clamp expressions
// (also read `s[...]`) can see each other. Later ops in the same effect see
// earlier ops' writes via `s = next` at the next block's top.
const _opStmt = op => {
  const pair = _opPatchPair(op);
  if (!pair) return null;
  const patchKv = (pair.key === 'flags' || pair.key === 'inventory' || pair.key === 'skills')
    ? `${pair.key}: ${pair.value}`
    : `[${_q(pair.key)}]: ${pair.value}`;
  const write = `next = { ...next, ${patchKv} };`;
  const cond  = op && op.condition && op.condition.mode && op.condition.mode !== 'always';
  // Per-op condition reads the IN-PROGRESS reducer state (`s`) so earlier
  // ops can flip a flag a later op gates on.
  const guarded = cond ? `if (${_condExpr(op.condition, 's')}) { ${write} }` : write;
  return `{ const s = next; ${guarded} }`;
};

// One weight bonus: `{ guard: c=>bool, amountMode, amountFixed, amountStat }`.
// The guard is a compiled Condition expression — we wrap it inline so the
// emitted entry stays self-contained.
const _emitWeightBonus = bonus => `{ ` +
  `guard: c => ${_condExpr(bonus.condition)}, ` +
  `amountMode: ${_q(bonus.amountMode || 'fixed')}, ` +
  `amountFixed: ${Number(bonus.amountFixed) || 0}, ` +
  `amountStat: ${_q(bonus.amountStat || '')} ` +
`}`;

// Random loot — emit the table data + a small runner that does the same
// weighted-pick / unique / picks dance the preview interpreter does. The
// runner is a pure function literal, so this composes inside choice actions
// and combat onWin/onLose like any other Effect.
const _emitLootEntry = entry => `{ ` +
  `weight: ${Math.max(0, Number(entry.weight) || 0)}, ` +
  `kind: ${_q(entry.kind || 'item')}, ` +
  `itemId: ${_q(entry.itemId || '')}, ` +
  `countMin: ${Number(entry.countMin) || 0}, ` +
  `countMax: ${Number(entry.countMax) || 0}, ` +
  `statKey: ${_q(entry.statKey || '')}, ` +
  `statMin: ${Number(entry.statMin) || 0}, ` +
  `statMax: ${Number(entry.statMax) || 0}, ` +
  `flagKey: ${_q(entry.flagKey || '')}, ` +
  `flagValue: ${entry.flagValue !== false ? 'true' : 'false'}, ` +
  `roomId: ${_q(entry.roomId || '')}, ` +
  `skillId: ${_q(entry.skillId || '')}, ` +
  `npcId: ${_q(entry.npcId || '')}, ` +
  `jsBody: ${_q(entry.jsBody || '')}, ` +
  `bonuses: [${(entry.bonuses || []).map(_emitWeightBonus).join(', ')}], ` +
  `message: ${_q(entry.message || '')} ` +
`}`;

const _emitRandomLoot = rawTable => {
  const table = rawTable || { picks: 1, unique: false, showFlavour: true, entries: [] };
  const entriesLit = (table.entries || []).map(_emitLootEntry).join(', ');
  const picks = Math.max(1, Number(table.picks) || 1);
  return `c => {
      const _rand = (lo, hi) => { const a = Math.min(lo|0, hi|0), b = Math.max(lo|0, hi|0); return a + Math.floor(Math.random() * (b - a + 1)); };
      // Effective weight = base + sum of every applicable bonus.
      const _wt = e => {
        let t = Math.max(0, e.weight);
        for (const b of (e.bonuses || [])) {
          if (!b.guard(c)) continue;
          t += b.amountMode === 'stat' ? (Number(c.state[b.amountStat]) || 0) : (Number(b.amountFixed) || 0);
        }
        return Math.max(0, t);
      };
      const _pick = bag => { const ws = bag.map(_wt); const tot = ws.reduce((a, w) => a + w, 0); if (tot <= 0) return -1; let r = Math.random() * tot; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; };
      const _apply = (e, c) => {
        if (e.kind === 'item' && e.itemId) {
          const n = Math.max(0, _rand(e.countMin, e.countMax));
          if (n === 0) return null;
          c.setState(s => ({ inventory: { ...(s.inventory || {}), [e.itemId]: (Number(s.inventory?.[e.itemId]) || 0) + n } }));
          return e.itemId + ' x' + n;
        }
        if (e.kind === 'stat' && e.statKey) {
          const n = _rand(e.statMin, e.statMax);
          if (n === 0) return null;
          c.setState(s => ({ [e.statKey]: (Number(s[e.statKey]) || 0) + n }));
          return e.statKey + ' ' + (n > 0 ? '+' : '') + n;
        }
        if (e.kind === 'flag' && e.flagKey) {
          c.setState(s => ({ flags: { ...(s.flags || {}), [e.flagKey]: !!e.flagValue } }));
          return 'flag ' + e.flagKey + ' = ' + (e.flagValue ? 'true' : 'false');
        }
        if (e.kind === 'navigate' && e.roomId) {
          c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [e.roomId]: 0 } }));
          c.goto(e.roomId);
          return '→ ' + e.roomId;
        }
        if (e.kind === 'learnSkill' && e.skillId) {
          c.setState(s => { const cur = Array.isArray(s.skills) ? s.skills : []; return cur.includes(e.skillId) ? {} : { skills: [...cur, e.skillId] }; });
          return 'learned ' + e.skillId;
        }
        if (e.kind === 'talkNpc' && e.npcId) {
          c.setState(s => ({
            _npcPageIdx:      { ...(s._npcPageIdx      || {}), [e.npcId]: 0 },
            _npcGreetingDone: { ...(s._npcGreetingDone || {}), [e.npcId]: false },
            _npcTopic:        { ...(s._npcTopic        || {}), [e.npcId]: null },
            _npcTopicStack:   { ...(s._npcTopicStack   || {}), [e.npcId]: [] },
          }));
          c.talkTo(e.npcId, c.scene);
          return 'talkTo ' + e.npcId;
        }
        if (e.kind === 'js') {
          try { (new Function('c', e.jsBody || ''))(c); } catch (_) {}
          return 'js';
        }
        return null;
      };
      const bag  = [${entriesLit}];
      const wins = [];
      const picks = ${picks};
      const unique = ${table.unique ? 'true' : 'false'};
      const showFlavour = ${table.showFlavour !== false ? 'true' : 'false'};
      for (let i = 0; i < picks; i++) {
        if (bag.length === 0) break;
        const idx = _pick(bag); if (idx < 0) break;
        const e = bag[idx];
        const f = _apply(e, c); if (f) wins.push(f);
        if (e.message) _pushMsg(c, e.message);
        if (unique) bag.splice(idx, 1);
      }
      if (showFlavour && wins.length) {
        const line = 'Loot: ' + wins.join(', ');
        c.setState(s => ({ _lootLog: [...((s._lootLog || []).slice(-7)), line] }));
      }
    }`;
};

// Compile an Effect into a (c) => void body. Always returns a function literal string.
const _effectFnCore = effect => {
  if (!effect || effect.mode === 'none') return null;
  if (effect.mode === 'js') return `c => { ${effect.body || ''} }`;
  if (effect.mode === 'simple') {
    const stmts = (effect.ops || []).map(_opStmt).filter(Boolean);
    if (stmts.length === 0) return null;
    return `c => c.setState(start => { let next = start; ${stmts.join(' ')} return next; })`;
  }
  if (effect.mode === 'randomLoot') {
    return _emitRandomLoot(effect.table);
  }
  if (effect.mode === 'navigate' && effect.toRoom) {
    return `c => { c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [${_q(effect.toRoom)}]: 0 } })); c.goto(${_q(effect.toRoom)}); }`;
  }
  if (effect.mode === 'multi') {
    // Emit each step independently and chain the function literals. Filter
    // out null sub-effects so an empty-simple or none-mode step doesn't break
    // the chain.
    const stepFns = (effect.steps || []).map(_effectFn).filter(Boolean);
    if (stepFns.length === 0) return null;
    return `c => { ${stepFns.map(fn => `(${fn})(c);`).join(' ')} }`;
  }
  if (effect.mode === 'oneOf') {
    // Weighted "exactly one outcome" picker. Each option holds an arbitrary
    // nested Effect — recursion handles the nesting. Inline _wt mirrors the
    // randomLoot version so bonus semantics stay identical.
    const opts = (effect.options || []).map(o => {
      const subFn = _effectFn(o.effect) || '() => {}';
      return `{ ` +
        `weight: ${Math.max(0, Number(o.weight) || 0)}, ` +
        `bonuses: [${(o.bonuses || []).map(_emitWeightBonus).join(', ')}], ` +
        `effect: ${subFn} ` +
      `}`;
    }).join(', ');
    if (!effect.options || effect.options.length === 0) return null;
    return `c => {
      const opts = [${opts}];
      const _wt = e => { let t = Math.max(0, e.weight); for (const b of (e.bonuses || [])) { if (!b.guard(c)) continue; t += b.amountMode === 'stat' ? (Number(c.state[b.amountStat]) || 0) : (Number(b.amountFixed) || 0); } return Math.max(0, t); };
      const ws = opts.map(_wt); const tot = ws.reduce((a, w) => a + w, 0);
      if (tot <= 0) return;
      let r = Math.random() * tot;
      for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { opts[i].effect(c); return; } }
      opts[opts.length - 1].effect(c);
    }`;
  }
  if (effect.mode === 'talkTo' && effect.npcId) {
    return `c => { c.setState(s => ({ ` +
      `_npcPageIdx:      { ...(s._npcPageIdx      || {}), [${_q(effect.npcId)}]: 0 }, ` +
      `_npcGreetingDone: { ...(s._npcGreetingDone || {}), [${_q(effect.npcId)}]: false }, ` +
      `_npcTopic:        { ...(s._npcTopic        || {}), [${_q(effect.npcId)}]: null }, ` +
      `_npcTopicStack:   { ...(s._npcTopicStack   || {}), [${_q(effect.npcId)}]: [] } ` +
    `})); c.talkTo(${_q(effect.npcId)}, c.scene); }`;
  }
  if (effect.mode === 'enterCombat' && effect.combatId) {
    return `c => { const cb = __COMBATS[${_q(effect.combatId)}]; if (!cb) return; c.setState({ _combat: { id: ${_q(effect.combatId)}, enemyHp: cb.enemy.hp, log: cb.intro ? [cb.intro] : [], turn: 0, lastMoveImage: null, lastEnemyImage: null, returnTo: c.scene, outcome: null } }); c.goto("_combat:" + ${_q(effect.combatId)}); }`;
  }
  return null;
};

// Wrap the core emit to push an Effect.message after the core runs. Returns
// null if the effect is a no-op AND has no message; otherwise returns the
// wrapped function literal as a string.
const _effectFn = effect => {
  const core = _effectFnCore(effect);
  if (!effect || !effect.message) return core;
  if (!core) return `c => { _pushMsg(c, ${_q(effect.message)}) }`;
  return `c => { (${core})(c); _pushMsg(c, ${_q(effect.message)}); }`;
};

// ─── Reusable emit fragments. All single-arg / curried. ──────────────────

// Page literal expression for `pages: [...]` arrays in emitted dialogues.
const _emitPageLit = pg =>
  `{ text: ${_q(pg.text)}, image: ${_q(pg.image)}, video: ${_q(pg.video)}, advanceLabel: ${_q(pg.advanceLabel || 'More')} }`;

// onEnter / onEnterCondition for a target room. Returns a fragment that fires
// the room's onEnter Effect (if any) gated by its Condition. The fragment
// assumes `c` is in scope.
const _emitRoomEnter = project => roomId => {
  const target  = (project?.rooms || []).find(r => r.id === roomId);
  if (!target) return '';
  const condExpr = _condExpr(target.onEnterCondition || { mode: 'always' });
  const enterFn  = _effectFn(target.onEnter);
  if (!enterFn) return '';
  return `{ const live = { ...c, state: c.getState() }; if (${condExpr.replace(/c\.state/g, 'live.state')}) (${enterFn})(c); }`;
};

// _pageIdx reset + onEnter gate + goto(roomId). When roomId is '' the fallback
// is "return to the calling scene" (the surrounding emit binds `back`).
const _emitGotoRoom = project => roomId => {
  if (!roomId) return `c.setState({ _scene: back });`;
  return [
    `c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [${_q(roomId)}]: 0 } }));`,
    _emitRoomEnter(project)(roomId),
    `c.goto(${_q(roomId)});`,
  ].filter(Boolean).join(' ');
};

// Enter combat by id. Mirrors _emitGotoRoom in shape.
const _emitGotoCombat = combatId => combatId
  ? `{ const cb = __COMBATS[${_q(combatId)}]; if (cb) { ` +
      `c.setState({ _combat: { id: ${_q(combatId)}, enemyHp: cb.enemy.hp, log: cb.intro ? [cb.intro] : [], turn: 0, lastMoveImage: null, returnTo: back, outcome: null } }); ` +
      `c.goto("_combat:" + ${_q(combatId)}); } }`
  : '';

// exitBack fragment — pop the topic stack, or leave the NPC if empty.
const _emitExitBack = npcId => {
  const npcIdLit = _q(npcId);
  return `{ const stack = c.state._npcTopicStack?.[${npcIdLit}] || []; ` +
    `if (stack.length === 0) { c.setState(s => ({ _npcTopic: { ...(s._npcTopic || {}), [${npcIdLit}]: null }, _scene: back })); } ` +
    `else { const prev = stack[stack.length - 1]; c.setState(s => ({ _npcTopic: { ...(s._npcTopic || {}), [${npcIdLit}]: prev }, _npcTopicStack: { ...(s._npcTopicStack || {}), [${npcIdLit}]: stack.slice(0, -1) } })); } }`;
};

// ─── Top-level choice emit. ─────────────────────────────────────────────

// Emit a Choice descriptor literal: { label, if?, action? }. Navigation is
// handled inside the action (not via `to:`) so we can fire the target room's
// onEnter Effect through its onEnterCondition gate between action and goto.
// Curried `ch => project`.
const _emitChoice = ch => project => {
  const parts    = [`label: ${_q(ch.label)}`];
  const hasCond  = ch.condition && ch.condition.mode !== 'always';
  const effectFn = _effectFn(ch.action);

  if (hasCond) parts.push(`if: c => ${_condExpr(ch.condition)}`);

  // The action body is (effect) + (page-idx reset + onEnter gate + goto). When
  // ch.to is empty there's no navigation slice. _emitGotoRoom handles both.
  const navLine = ch.to ? _emitGotoRoom(project)(ch.to) : '';
  const lines   = [
    effectFn ? `(${effectFn})(c);` : '',
    navLine,
  ].filter(Boolean);
  if (lines.length) parts.push(`action: c => { _startAction(c); ${lines.join(' ')} }`);
  return `{ ${parts.join(', ')} }`;
};

const _emitPageBody = page => {
  const parts = [];
  if (page.image) parts.push(`img({ src: ${_q(page.image)}, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([])`);
  if (page.video) parts.push(`video({ src: ${_q(page.video)}, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([])`);
  if (page.text)  parts.push(`p({})([${_q(page.text)}])`);
  return parts.join(', ');
};

const _emitWardrobeRoomFn = room => project => {
  const wb = room.wardrobe || { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] };
  const choicesLit = room.choices.map(c => _emitChoice(c)(project)).join(', ');
  return `${room.id}: _withMessageOverlay(ctx => {
    const inv = ctx.state.inventory || {};
    const wb = ${JSON.stringify(wb)};
    const itemList = ${JSON.stringify(project.items)};
    const equippedSlots = ctx.state.equipped || {};
    const equippedIds = new Set(Object.values(equippedSlots));
    const carrying = itemList.filter(it => wb.kinds.includes(it.kind) && (Number(inv[it.id]) || 0) > 0);
    const portraitBox = div({ style: 'position:relative; margin:0 auto 12px; width:' + wb.portraitWidth + 'px; height:' + wb.portraitHeight + 'px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden' })(
      (wb.layers || []).map(layer => {
        const binding = (layer.bindings || []).find(b => b.itemId && (equippedIds.has(b.itemId) || (Number(inv[b.itemId] || 0) > 0)));
        const src = (binding && binding.image) || layer.defaultImage;
        if (!src) return div({})([]);
        return img({ src, style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none' })([]);
      })
    );
    const _toggle = it => ctx.setState(s => {
      const eq = { ...(s.equipped || {}) };
      if (equippedIds.has(it.id)) {
        for (const [k, v] of Object.entries(eq)) if (v === it.id) delete eq[k];
      } else {
        eq[it.equipSlot || it.kind || 'item'] = it.id;
      }
      return { equipped: eq };
    });
    const _card = it => div({ style: 'display:flex; align-items:center; gap:8px; padding:8px; border:1px solid ' + (equippedIds.has(it.id) ? 'var(--accent)' : 'var(--border)') + '; border-radius:var(--radius); background:var(--surface)' })([
      ...(it.image ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; flex:none' })([])] : []),
      div({ style: 'flex:1; min-width:0' })([
        div({ style: 'font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap' })([
          it.name || it.id,
          ...(equippedIds.has(it.id) ? [span({ style: 'display:inline-block; padding:1px 6px; border-radius:3px; background:var(--accent); color:#fff; font-size:10px; margin-left:6px' })(['equipped'])] : []),
        ]),
        div({ style: 'font-size:11px; color:var(--text-muted)' })([(it.equipSlot || it.kind) + ' · x' + (inv[it.id] || 0)]),
      ]),
      ...(it.kind === 'equipment' ? [button({
        type: 'button',
        onclick: () => _toggle(it),
        style: 'padding:4px 10px; border:1px solid var(--accent); border-radius:var(--radius); background:' + (equippedIds.has(it.id) ? 'none' : 'var(--accent)') + '; color:' + (equippedIds.has(it.id) ? 'var(--text)' : '#fff') + '; cursor:pointer; font-size:12px',
      })([equippedIds.has(it.id) ? 'Take off' : 'Wear'])] : []),
    ]);
    const grid = carrying.length === 0
      ? p({ style: 'color:var(--text-muted); text-align:center; margin:0 0 12px' })(['(nothing in this category)'])
      : div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:8px; margin:0 auto 12px; max-width:720px' })(carrying.map(_card));
    return Scene({ title: ${_q(room.title || 'Wardrobe')}, body: [portraitBox, grid], choices: [${choicesLit}] })(ctx);
  })`;
};

const _emitInventoryRoomFn = room => project => {
  const cfg = room.inventory || { kinds: [], layout: 'grid', showDescription: true, emptyMessage: 'You are not carrying anything.' };
  // Pre-compile each consumable's useEffect to a JS literal so we can dispatch
  // at runtime without re-walking the project shape.
  const useEffectMap = Object.fromEntries(
    project.items
      .filter(it => it.kind === 'consumable' && it.useEffect && it.useEffect.mode !== 'none')
      .map(it => [it.id, _effectFn(it.useEffect)])
      .filter(([, fn]) => fn)
  );
  const useEffectLiteral = '{ ' + Object.entries(useEffectMap).map(([id, fn]) => `${_q(id)}: ${fn}`).join(', ') + ' }';
  const choicesLit = room.choices.map(c => _emitChoice(c)(project)).join(', ');
  return `${room.id}: _withMessageOverlay(ctx => {
    const cfg = ${JSON.stringify(cfg)};
    const itemList = ${JSON.stringify(project.items)};
    const useEffects = ${useEffectLiteral};
    const inv = ctx.state.inventory || {};
    const equippedIds = Object.values(ctx.state.equipped || {});

    // Reading overlay — re-renders inside the same scene fn when state._reading
    // names this room and a known itemId.
    const reading = ctx.state._reading;
    if (reading && reading.roomId === ${_q(room.id)}) {
      const book = itemList.find(it => it.id === reading.itemId);
      if (book) {
        return Scene({
          title: book.name || book.id,
          body: [
            ...(book.image ? [img({ src: book.image, style: 'max-width:200px; display:block; margin:0 auto 12px; border-radius:8px' })([])] : []),
            div({ style: 'max-width:640px; margin:0 auto; padding:16px 20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); white-space:pre-wrap; line-height:1.6; font-size:14px' })([_t(ctx.state, book.text) || '(the pages are blank.)']),
          ],
          choices: [{ label: '← Close', action: c => c.setState({ _reading: null }) }],
        })(ctx);
      }
    }

    const entries = itemList
      .filter(it => (Number(inv[it.id]) || 0) > 0)
      .filter(it => cfg.kinds.length === 0 || cfg.kinds.includes(it.kind));

    const _consume = id => {
      const next = { ...inv };
      const cur = Number(next[id]) || 0;
      if (cur <= 1) delete next[id]; else next[id] = cur - 1;
      return next;
    };
    const _toggleEquip = it => {
      ctx.setState(s => {
        const eq = { ...(s.equipped || {}) };
        const isEq = Object.values(eq).includes(it.id);
        if (isEq) {
          for (const [k, v] of Object.entries(eq)) if (v === it.id) delete eq[k];
        } else {
          eq[it.equipSlot || 'item'] = it.id;
        }
        return { equipped: eq };
      });
    };
    const _actions = it => {
      const btns = [];
      if (it.kind === 'consumable') {
        btns.push(button({
          type: 'button',
          onclick: () => {
            const fn = useEffects[it.id];
            if (fn) fn(ctx);
            ctx.setState(s => ({ inventory: _consume(it.id) }));
          },
          style: 'padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:var(--accent); color:#fff; cursor:pointer; font-size:12.5px',
        })(['Use']));
      } else if (it.kind === 'readable') {
        btns.push(button({
          type: 'button',
          onclick: () => ctx.setState({ _reading: { roomId: ${_q(room.id)}, itemId: it.id } }),
          style: 'padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:none; color:var(--text); cursor:pointer; font-size:12.5px',
        })(['Read']));
      } else if (it.kind === 'equipment') {
        const isEq = equippedIds.includes(it.id);
        btns.push(button({
          type: 'button',
          onclick: () => _toggleEquip(it),
          style: 'padding:6px 14px; border:1px solid var(--accent); border-radius:var(--radius); background:' + (isEq ? 'none' : 'var(--accent)') + '; color:' + (isEq ? 'var(--text)' : '#fff') + '; cursor:pointer; font-size:12.5px',
        })([isEq ? 'Unequip' : 'Equip']));
      }
      return btns;
    };
    const _badge = it => it.kind === 'equipment' && equippedIds.includes(it.id)
      ? span({ style: 'display:inline-block; padding:1px 6px; border-radius:3px; background:var(--accent); color:#fff; font-size:10px; margin-left:6px' })(['equipped'])
      : null;

    const body = entries.length === 0
      ? [p({ style: 'color:var(--text-muted); text-align:center; margin:24px 0' })([cfg.emptyMessage || 'You are not carrying anything.'])]
      : cfg.layout === 'list'
        ? [div({ style: 'display:flex; flex-direction:column; gap:6px; max-width:680px; margin:0 auto 12px' })(
            entries.map(it => div({ style: 'display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)' })([
              ...(it.image ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; flex:none' })([])] : []),
              div({ style: 'flex:1; min-width:0' })([
                div({ style: 'font-weight:600; font-size:14px' })([it.name || it.id, ...(_badge(it) ? [_badge(it)] : [])]),
                ...(cfg.showDescription && it.description
                  ? [div({ style: 'font-size:12px; color:var(--text-muted)' })([it.description])]
                  : []),
              ]),
              span({ style: 'font-family:ui-monospace,monospace; color:var(--text-muted); margin-right:8px' })(['x' + inv[it.id]]),
              ..._actions(it),
            ]))
          )]
        : [div({ style: 'display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:10px; max-width:880px; margin:0 auto 12px' })(
            entries.map(it => div({ style: 'border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); padding:10px; display:flex; flex-direction:column; align-items:center; text-align:center' })([
              ...(it.image ? [img({ src: it.image, style: 'width:48px; height:48px; object-fit:contain; display:block; margin:0 auto 6px' })([])] : []),
              div({ style: 'font-weight:600; font-size:13px' })([it.name || it.id, ...(_badge(it) ? [_badge(it)] : [])]),
              div({ style: 'font-size:11px; color:var(--text-muted); margin-top:2px' })([(it.kind || 'misc') + ' · x' + inv[it.id]]),
              ...(cfg.showDescription && it.description
                ? [div({ style: 'font-size:11.5px; color:var(--text-muted); margin-top:4px; flex:1' })([it.description])]
                : [div({ style: 'flex:1' })([])]),
              ...(_actions(it).length
                ? [div({ style: 'margin-top:8px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap' })(_actions(it))]
                : []),
            ]))
          )];
    return Scene({ title: ${_q(room.title || 'Inventory')}, body, choices: [${choicesLit}] })(ctx);
  })`;
};

const _emitRoomFn = room => project => {
  if (room.kind === 'wardrobe')  return _emitWardrobeRoomFn(room)(project);
  if (room.kind === 'inventory') return _emitInventoryRoomFn(room)(project);
  const pagesLit = room.pages.map(_emitPageLit).join(', ');
  const choicesLit = room.choices.map(c => _emitChoice(c)(project)).join(', ');
  // Optional end-of-dialog Effect — when the last page has no Choices AND the
  // room defines an onEnd Effect, render one button that fires it. Nothing is
  // auto-created. The button's label inherits the page's advanceLabel so the
  // dev can keep narrative voice ("Drink", "Continue", "Wake up", …).
  const onEndFn  = _effectFn(room.onEnd);
  const onEndLit = (room.choices.length === 0 && onEndFn)
    ? `, { label: page.advanceLabel || 'Continue', action: c => (${onEndFn})(c) }`
    : '';
  // _withMessageOverlay shows accumulated Effect.message lines as a Continue
  // interstitial whenever state._messageQueue is non-empty. Empty queue →
  // straight to the real scene render.
  return `${room.id}: _withMessageOverlay(ctx => {
    const pages = [${pagesLit}];
    const idx = Math.min((ctx.state._pageIdx?.[${_q(room.id)}] || 0), pages.length - 1);
    const page = pages[idx];
    const isLast = idx === pages.length - 1;
    const body = [];
    if (page.image) body.push(img({ src: page.image, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
    if (page.video) body.push(video({ src: page.video, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
    if (page.text)  body.push(p({})([_t(ctx.state, page.text)]));
    if (isLast) body.push(...NpcLine(ctx));
    const choices = isLast
      ? [${choicesLit}${room.choices.length ? ',' : ''} ...NpcChoices(ctx)${onEndLit}]
      : [{
          label: page.advanceLabel || 'More',
          action: c => c.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [${_q(room.id)}]: idx + 1 } })),
        }];
    return Scene({ title: ${_q(room.title)}, body, choices })(ctx);
  })`;
};

// Combat scene factory — emitted into scenes.js. Uses player skills + combat
// extraMoves as available moves; enemy AI picks from weighted actions.
const _emitCombatSceneFn = combat => project => {
  const onWinFn  = _effectFn(combat.onWin);
  const onLoseFn = _effectFn(combat.onLose);
  return `"_combat:${combat.id}": _withMessageOverlay(ctx => {
    const cb = __COMBATS[${_q(combat.id)}];
    const cs = ctx.state._combat;
    if (!cs || cs.id !== ${_q(combat.id)}) {
      return Scene({ title: cb.name, body: [p({})(['(no active combat)'])], choices: [
        { label: 'Leave', action: c => c.goto(cs?.returnTo || ${_q(project.rooms[0]?.id || 'start')}) },
      ] })(ctx);
    }
    if (cs.outcome === 'win' || cs.outcome === 'lose') {
      const targetRoom = (cs.outcome === 'win' ? cb.winRoom : cb.loseRoom) || cs.returnTo;
      const flavour    =  _t(ctx.state, cs.outcome === 'win' ? cb.winText : cb.loseText);
      const lootEntries = cs.outcome === 'win' ? Object.entries(cb.enemy.loot || {}).filter(([, n]) => Number(n) > 0) : [];
      const outcomeImg = cs.outcome === 'win'
        ? (cb.winImage  || cb.enemy.image)
        : (cb.loseImage || cb.enemy.image);
      const isFallback = outcomeImg === cb.enemy.image && !(cs.outcome === 'win' ? cb.winImage : cb.loseImage);
      return Scene({
        title: cb.name,
        body: [
          ...(outcomeImg
            ? [img({ src: outcomeImg, style: 'max-width:280px; display:block; margin:0 auto 12px; border-radius:8px' + (isFallback ? '; opacity:.5; filter:grayscale(.8)' : '') })([])]
            : []),
          p({ style: 'font-size:16px; text-align:center; margin:0 0 8px' })([flavour]),
          ...(lootEntries.length
            ? [p({ style: 'text-align:center; color:var(--text-muted); margin:0 0 8px' })([
                'Loot: ' + lootEntries.map(([id, n]) => (__ITEMS[id]?.name || id) + ' x' + n).join(', '),
              ])]
            : []),
        ],
        choices: [{
          label: 'Continue',
          action: c => {
            if (cs.outcome === 'win' && lootEntries.length) {
              c.setState(s => {
                const inv = { ...(s.inventory || {}) };
                for (const [id, n] of lootEntries) inv[id] = (Number(inv[id]) || 0) + Number(n);
                return { inventory: inv };
              });
            }
            ${onWinFn  ? `if (cs.outcome === 'win')  (${onWinFn})(c);`  : ''}
            ${onLoseFn ? `if (cs.outcome === 'lose') (${onLoseFn})(c);` : ''}
            if (cs.outcome === 'win' && ${_q(combat.linkedNpcId || '')}) {
              c.setState(s => {
                const next = { ...(s.npcLocations || {}) };
                delete next[${_q(combat.linkedNpcId || '')}];
                return {
                  npcLocations: next,
                  flags: { ...(s.flags || {}), [${_q((combat.linkedNpcId || '') + '_defeated')}]: true },
                };
              });
            }
            c.setState({ _combat: null });
            c.goto(targetRoom);
          },
        }],
      })(ctx);
    }
    const learnedSkillIds = Array.isArray(ctx.state.skills) ? ctx.state.skills : [];
    const playerSkills = learnedSkillIds.map(id => __SKILLS[id]).filter(Boolean);
    const allMoves = [...playerSkills, ...(cb.extraMoves || [])];
    const _randInt = n => (n > 0 ? Math.floor(Math.random() * (n + 1)) : 0);
    const _resolveHit = (m, s, enemy) => {
      const mode = m.hitMode || 'always';
      let hit = true;
      if (mode === 'percent') {
        const pct = Math.max(0, Math.min(100, Number(m.hitPercent) || 100));
        hit = Math.floor(Math.random() * 100) + 1 <= pct;
      } else if (mode === 'statRoll') {
        const roll  = Math.floor(Math.random() * 20) + 1;
        const bonus = (m.hitStat ? (Number(s[m.hitStat]) || 0) : 0) + (Number(m.hitBonus) || 0);
        const dc    = (Number(enemy.defense) || 0) + (Number(m.hitDc) || 0);
        hit = (roll + bonus) >= dc;
      }
      if (!hit) return { hit: false, damage: 0 };
      const base  = Number(m.damage) || 0;
      const statD = m.damageStat ? (Number(s[m.damageStat]) || 0) * (Number(m.damageStatMul) || 0) : 0;
      const randD = _randInt(Number(m.damageRandom) || 0);
      const damage = Math.max(0, base + statD + randD - (Number(enemy.defense) || 0));
      return { hit: true, damage };
    };
    const _resolveHeal = (m, s) => {
      const base  = Number(m.selfHeal) || 0;
      const statH = m.selfHealStat ? (Number(s[m.selfHealStat]) || 0) * (Number(m.selfHealStatMul) || 0) : 0;
      const randH = _randInt(Number(m.selfHealRandom) || 0);
      return base + statH + randH;
    };
    const _pickAction = (as, info) => {
      if (!as.length) return null;
      const eligible = as.filter(a => {
        switch (a.useWhen || 'always') {
          case 'always':       return true;
          case 'belowHp':      return info.enemyHp <= (info.enemyMaxHp * ((Number(a.hpThreshold) || 50) / 100));
          case 'aboveHp':      return info.enemyHp  > (info.enemyMaxHp * ((Number(a.hpThreshold) || 50) / 100));
          case 'onPlayerMiss': return info.lastResult === 'miss';
          case 'js': {
            try {
              const fn = new Function('enemyHp', 'enemyMaxHp', 'state', 'lastResult', a.jsCondition || 'return true;');
              return !!fn(info.enemyHp, info.enemyMaxHp, info.state, info.lastResult);
            } catch (_) { return false; }
          }
          default: return true;
        }
      });
      const pool = eligible.length ? eligible : as;
      const total = pool.reduce((acc, b) => acc + Math.max(0, Number(b.weight) || 0), 0);
      if (total <= 0) return pool[Math.floor(Math.random() * pool.length)];
      let r = Math.random() * total;
      for (const a of pool) { r -= Math.max(0, Number(a.weight) || 0); if (r <= 0) return a; }
      return pool[pool.length - 1];
    };
    const _enemyTurn = (s, playerResult) => {
      const cstate = s._combat || {};
      const a = _pickAction(cb.enemy.actions || [], {
        enemyHp:    cstate.enemyHp,
        enemyMaxHp: Number(cb.enemy.hp) || 1,
        state:      s,
        lastResult: playerResult,
      });
      if (!a) return s;
      if (a.kind === 'heal') {
        const amount = (Number(a.healAmount) || 0) + _randInt(Number(a.healRandom) || 0);
        const newEHp = Math.min(Number(cb.enemy.hp) || 1, cstate.enemyHp + amount);
        const log = [...(cstate.log || []), cb.enemy.name + ' ' + (a.label || 'heals') + ' (+' + amount + ' HP).'];
        return { ...s, _combat: { ...cstate, enemyHp: newEHp, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: a.image || null, lastEnemyText: a.flavourText || '' } };
      }
      const pct = Math.max(0, Math.min(100, Number(a.hitPercent ?? 100)));
      const hit = Math.floor(Math.random() * 100) + 1 <= pct;
      if (!hit) {
        const log = [...(cstate.log || []), cb.enemy.name + ' ' + (a.label || 'attacks') + ' — miss.'];
        return { ...s, _combat: { ...cstate, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: a.image || null, lastEnemyText: a.flavourText || '' } };
      }
      const dmg = Math.max(0, (Number(a.damage) || 0) + _randInt(Number(a.damageRandom) || 0));
      const newHp = Math.max(0, (Number(s[cb.playerStat]) || 0) - dmg);
      const log = [...(cstate.log || []), cb.enemy.name + ' ' + (a.label || 'strikes') + ' for ' + dmg + '.'];
      const next = { ...s, [cb.playerStat]: newHp };
      if (newHp <= 0) return { ...next, _combat: { ...cstate, log, outcome: 'lose', lastEnemyImage: a.image || null, lastEnemyText: a.flavourText || '' } };
      return { ...next, _combat: { ...cstate, log, turn: (cstate.turn || 0) + 1, lastEnemyImage: a.image || null, lastEnemyText: a.flavourText || '' } };
    };
    const _useMove = (m) => c => {
      c.setState(s => {
        const inv = s.inventory || {};
        if (m.requireItem && (Number(inv[m.requireItem]) || 0) < 1) return {};
        if (m.costStat && (Number(s[m.costStat]) || 0) < (Number(m.costValue) || 0)) return {};
        if (m.costItem && (Number(inv[m.costItem]) || 0) < 1) return {};
        const newInv = { ...inv };
        if (m.costItem) {
          newInv[m.costItem] = (Number(newInv[m.costItem]) || 0) - 1;
          if (newInv[m.costItem] <= 0) delete newInv[m.costItem];
        }
        const stat = m.costStat ? { [m.costStat]: (Number(s[m.costStat]) || 0) - (Number(m.costValue) || 0) } : {};
        const result = _resolveHit(m, s, cb.enemy);
        const heal   = _resolveHeal(m, s);
        const newEHp = Math.max(0, (s._combat?.enemyHp || 0) - (result.hit ? result.damage : 0));
        const newPHp = Math.min((Number(s[cb.playerStat]) || 0) + heal, 9999);
        const logLine = result.hit
          ? 'You use ' + (m.name || m.label) + ' → ' + result.damage + ' dmg' + (heal ? ', +' + heal + ' HP' : '') + '.'
          : 'You use ' + (m.name || m.label) + ' → miss.';
        const log = [...(s._combat?.log || []), logLine];
        const partial = {
          ...stat,
          [cb.playerStat]: newPHp,
          inventory: newInv,
          _combat: { ...s._combat, enemyHp: newEHp, log, lastMoveImage: m.image || null, lastMoveText: m.flavourText || '', lastEnemyImage: null, lastEnemyText: '' },
        };
        if (newEHp <= 0) return { ...partial, _combat: { ...partial._combat, outcome: 'win' } };
        return _enemyTurn(partial, result.hit ? 'hit' : 'miss');
      });
    };
    const moveButtons = allMoves.length === 0
      ? [{ label: 'Flee (no skills known)', action: c => { c.setState({ _combat: null }); c.goto(cs.returnTo); } }]
      : allMoves.map(m => ({
          label: (m.name || m.label) + (m.damage ? ' (' + m.damage + ')' : ''),
          if: () => {
            const inv = ctx.state.inventory || {};
            return (!m.requireItem || (Number(inv[m.requireItem]) || 0) >= 1)
                && (!m.costStat    || (Number(ctx.state[m.costStat]) || 0) >= (Number(m.costValue) || 0))
                && (!m.costItem    || (Number(inv[m.costItem]) || 0) >= 1);
          },
          action: _useMove(m),
        }));
    const lastLog = (cs.log || []).slice(-4);
    const body = [
      div({ style: 'display:grid; grid-template-columns:1fr auto; gap:16px; align-items:start; margin-bottom:12px' })([
        div({})([
          ...(cb.enemy.image ? [img({ src: cb.enemy.image, style: 'max-width:200px; border-radius:8px; display:block; margin-bottom:8px' })([])] : []),
          div({ style: 'font-weight:600; font-size:16px' })([cb.enemy.name]),
          div({ style: 'font-size:13px; color:var(--text-muted)' })(['HP: ' + cs.enemyHp + ' / ' + cb.enemy.hp]),
        ]),
        div({ style: 'text-align:right' })([
          div({ style: 'font-size:13px; color:var(--text-muted)' })(['You']),
          div({ style: 'font-weight:600; font-size:18px' })([cb.playerStat + ': ' + (Number(ctx.state[cb.playerStat]) || 0)]),
        ]),
      ]),
      ...((cs.lastMoveImage || cs.lastMoveText || cs.lastEnemyImage || cs.lastEnemyText)
        ? [div({ style: 'display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:12px' })([
            ...((cs.lastMoveImage || cs.lastEnemyImage)
              ? [img({ src: cs.lastMoveImage || cs.lastEnemyImage, style: 'max-width:200px; max-height:180px; display:block; border-radius:8px' })([])]
              : []),
            ...((cs.lastMoveText || cs.lastEnemyText)
              ? [p({ style: 'margin:0; text-align:center; font-style:italic; color:var(--text-muted); font-size:13px; max-width:380px' })([_t(ctx.state, cs.lastMoveText || cs.lastEnemyText)])]
              : []),
          ])]
        : []),
      div({ style: 'background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; min-height:60px; font-size:13px; margin-bottom:12px' })(
        lastLog.length === 0
          ? [span({ style: 'color:var(--text-muted)' })(['Pick a move.'])]
          : lastLog.map(line => div({ style: 'margin:2px 0' })([line]))
      ),
    ];
    return Scene({ title: cb.name, body, choices: moveButtons })(ctx);
  })`;
};

// Generate the scenes.js source file
const emitScenes = project => `// AUTO-GENERATED by dervoJS gameEditor. Edit the project in the editor.
${_extraImports(project, 'scenes')}import { div, span, p, img, video, button } from '../src/elements.js';
import { Scene, NpcChoices, NpcLine } from '../src/game.js';
${_TEMPLATE_HELPER}
${_MESSAGE_HELPERS}

const __COMBATS = ${JSON.stringify((project.combats || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {}))};
const __SKILLS  = ${JSON.stringify((project.skills  || []).reduce((acc, s) => ({ ...acc, [s.id]: s }), {}))};
const __ITEMS   = ${JSON.stringify((project.items   || []).reduce((acc, it) => ({ ...acc, [it.id]: it }), {}))};

const scenes = {
  ${project.rooms.map(r => _emitRoomFn(r)(project)).join(',\n  ')}${
    (project.combats || []).length
      ? ',\n  ' + project.combats.map(c => _emitCombatSceneFn(c)(project)).join(',\n  ')
      : ''
  },
};

export { scenes };
`;

// One topic-context choice. Each flow translates to a concrete fragment:
//   stay        → effect only, no navigation (re-render same topic)
//   change      → push current topic, switch to ch.topicId, fire its onEnter
//   exitBack    → pop the stack (or leave NPC if empty)
//   exitRoom    → goto ch.to with onEnter gate (empty = return to caller)
//   exitCombat  → setup _combat + goto _combat:<id>
//
// Curried `ch => npc => project` so call sites read top-to-bottom.
const _emitTopicChoice = ch => npc => project => {
  const npcIdLit   = _q(npc.id);
  const topicIdLit = _q(ch.topicId || '');
  const flow       = ch.flow || 'exitBack';
  const hasCond    = ch.condition && ch.condition.mode !== 'always';
  const effectFn   = _effectFn(ch.action);

  const parts = [`label: ${_q(ch.label)}`];
  if (hasCond) parts.push(`if: c => ${_condExpr(ch.condition)}`);

  const navLine =
    flow === 'stay'       ? '' :
    flow === 'exitBack'   ? _emitExitBack(npc.id) :
    flow === 'change' && ch.topicId
      ? (() => {
          // currentTopicId is bound by _emitNpcDialogue's surrounding scope.
          const push = `c.setState(s => ({ ` +
            `_npcTopicStack:   { ...(s._npcTopicStack   || {}), [${npcIdLit}]: [...(s._npcTopicStack?.[${npcIdLit}] || []), currentTopicId] }, ` +
            `_npcTopic:        { ...(s._npcTopic        || {}), [${npcIdLit}]: ${topicIdLit} }, ` +
            `_npcTopicPageIdx: { ...(s._npcTopicPageIdx || {}), [${npcIdLit}]: { ...(s._npcTopicPageIdx?.[${npcIdLit}] || {}), [${topicIdLit}]: 0 } } ` +
          `}));`;
          const target  = (npc.topics || []).find(t => t.id === ch.topicId);
          const onEnter = target ? _effectFn(target.onEnter) : null;
          return onEnter ? `${push} (${onEnter})(c);` : push;
        })() :
    flow === 'exitRoom'   ? _emitGotoRoom(project)(ch.to) :
    flow === 'exitCombat' ? _emitGotoCombat(ch.combatId) :
    '';

  const lines = [
    effectFn ? `(${effectFn})(c);` : '',
    navLine,
  ].filter(Boolean);

  parts.push(`action: c => { _startAction(c); ${lines.join(' ')} }`);
  return `{ ${parts.join(', ')} }`;
};

// SIMPLE-mode (non-topic) NPC choice. Same shape as room navigation.
const _emitSimpleNpcChoice = ch => project => {
  const hasCond  = ch.condition && ch.condition.mode !== 'always';
  const effectFn = _effectFn(ch.action);
  const parts = [`label: ${_q(ch.label)}`];
  if (hasCond) parts.push(`if: c => ${_condExpr(ch.condition)}`);
  const lines = [
    effectFn ? `(${effectFn})(c);` : '',
    _emitGotoRoom(project)(ch.to),
  ].filter(Boolean);
  parts.push(`action: c => { _startAction(c); ${lines.join(' ')} }`);
  return `{ ${parts.join(', ')} }`;
};

// Emit the NPC dialogue scene function. Branches at the top on npc.advanced
// to either the legacy flat path or the topic-tree path. Curried `npc => project`.
const _emitNpcDialogue = npc => project => {
  const npcIdLit = _q(npc.id);

  // Greeting + simple-mode page literals (shared shape).
  const pagesLit = npc.pages.map(_emitPageLit).join(', ');

  // --- Simple flat dialogue path ---
  if (!npc.advanced) {
    const choicesLit = npc.choices.map(c => _emitSimpleNpcChoice(c)(project)).join(', ');
    const hasChoices = npc.choices.length > 0;
    return `ctx => {
      const back = ctx.scene;
      const pages = [${pagesLit}];
      const idx = Math.min((ctx.state._npcPageIdx?.[${npcIdLit}] || 0), pages.length - 1);
      const page = pages[idx];
      const isLast = idx === pages.length - 1;
      const body = [];
      if (page.image) body.push(img({ src: page.image, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
      if (page.video) body.push(video({ src: page.video, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
      if (page.text)  body.push(p({})([_t(ctx.state, page.text)]));
      const choices = isLast
        ? [${choicesLit}${hasChoices ? '' : `{ label: 'Goodbye', action: c => c.setState({ _scene: back }) }`}]
        : [{ label: page.advanceLabel || 'More', action: c => c.setState(s => ({ _npcPageIdx: { ...(s._npcPageIdx || {}), [${npcIdLit}]: idx + 1 } })) }];
      return Scene({ title: ${_q(npc.name)}, body, choices })(ctx);
    }`;
  }

  // --- Advanced (topic-tree) path ---
  const topics  = Array.isArray(npc.topics) ? npc.topics : [];
  // Fall through to simple emit when toggle is on but no topics defined yet.
  if (topics.length === 0) return _emitNpcDialogue({ ...npc, advanced: false })(project);
  const entryId = npc.entryTopicId || topics[0].id;

  // Per-topic render block. Keyed by topic id. Each block holds pages + choices.
  const _autoBack = `{ label: 'Back', action: c => ${_emitExitBack(npc.id)} }`;
  const topicRenderLit = topics.map(t => {
    const tPagesLit   = (t.pages || []).map(_emitPageLit).join(', ');
    const tChoicesLit = (t.choices || []).map(c => _emitTopicChoice(c)(npc)(project)).join(', ');
    const hasChoices  = (t.choices || []).length > 0;
    return `${_q(t.id)}: { ` +
      `pages: [${tPagesLit}], ` +
      `choices: [${tChoicesLit}${hasChoices ? '' : _autoBack}] ` +
    `}`;
  }).join(', ');

  return `ctx => {
      const back   = ctx.scene;
      const TOPICS = { ${topicRenderLit} };
      const ENTRY  = ${_q(entryId)};

      // 1) Greeting pages (only on first visit each talkTo). _npcGreetingDone flips
      //    true after the player clicks through the last greeting page.
      const greetingPages = [${pagesLit}];
      const greetIdx  = Math.min((ctx.state._npcPageIdx?.[${npcIdLit}] || 0), greetingPages.length - 1);
      const greetPage = greetingPages[greetIdx];
      const hasGreeting = greetingPages.length > 0 && (greetPage.text || greetPage.image || greetPage.video);
      const inGreeting  = hasGreeting && !ctx.state._npcGreetingDone?.[${npcIdLit}];
      if (inGreeting) {
        const last = greetIdx === greetingPages.length - 1;
        const body = [];
        if (greetPage.image) body.push(img({ src: greetPage.image, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
        if (greetPage.video) body.push(video({ src: greetPage.video, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
        if (greetPage.text)  body.push(p({})([_t(ctx.state, greetPage.text)]));
        const choices = last
          ? [{ label: greetPage.advanceLabel || 'Continue', action: c => c.setState(s => ({ _npcGreetingDone: { ...(s._npcGreetingDone || {}), [${npcIdLit}]: true } })) }]
          : [{ label: greetPage.advanceLabel || 'More',     action: c => c.setState(s => ({ _npcPageIdx:      { ...(s._npcPageIdx      || {}), [${npcIdLit}]: greetIdx + 1 } })) }];
        return Scene({ title: ${_q(npc.name)}, body, choices })(ctx);
      }

      // 2) Topic mode. Default to entry if no current topic.
      const currentTopicId = ctx.state._npcTopic?.[${npcIdLit}] || ENTRY;
      const tdata = TOPICS[currentTopicId] || TOPICS[ENTRY];
      const tIdx  = Math.min((ctx.state._npcTopicPageIdx?.[${npcIdLit}]?.[currentTopicId] || 0), tdata.pages.length - 1);
      const tPage = tdata.pages[tIdx];
      const tLast = tIdx === tdata.pages.length - 1;
      const tBody = [];
      if (tPage.image) tBody.push(img({ src: tPage.image, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
      if (tPage.video) tBody.push(video({ src: tPage.video, controls: true, style: 'max-width:100%; border-radius:8px; display:block; margin-bottom:8px' })([]));
      if (tPage.text)  tBody.push(p({})([_t(ctx.state, tPage.text)]));
      const tChoices = tLast
        ? tdata.choices
        : [{ label: tPage.advanceLabel || 'More', action: c => c.setState(s => ({ _npcTopicPageIdx: { ...(s._npcTopicPageIdx || {}), [${npcIdLit}]: { ...(s._npcTopicPageIdx?.[${npcIdLit}] || {}), [currentTopicId]: tIdx + 1 } } })) }];
      return Scene({ title: ${_q(npc.name)}, body: tBody, choices: tChoices })(ctx);
    }`;
};

// NPC shop dialogue function — auto-builds buy choices from stock
// Resolve effective price from a (possibly-null) entry.price + the item's
// default price. Both shapes are { stat, amount }. Returns the literal that
// becomes the entry's `priceStat` / `priceAmount` fields in the emitted JS.
const _resolvePriceCodegen = (entry, item) => {
  const p = (entry.price && typeof entry.price === 'object') ? entry.price
          : (item?.price && typeof item.price === 'object') ? item.price
          : { stat: 'gold', amount: 0 };
  return { stat: p.stat || 'gold', amount: Number(p.amount) || 0 };
};

// Buyback catalogue. Even in 'open' mode every project item shows up here so
// the emitted runtime can iterate without re-reading project.items. For 'list'
// mode only the whitelist passes through. Per-item multiplier overrides win
// over the shop default; null falls back to the shop default at runtime.
const _emitBuybackCatalogue = npc => project => {
  const buyback = npc.shop?.buyback || { mode: 'none', multiplier: 0.8, items: [] };
  if (buyback.mode === 'none') return { lit: '[]', mode: 'none', multiplier: Number(buyback.multiplier) || 0.8 };
  const mul = Number(buyback.multiplier) || 0.8;
  const itemFor = id => project.items.find(it => it.id === id);
  const pricePair = item => {
    const p = (item?.price && typeof item.price === 'object') ? item.price : { stat: 'gold', amount: 0 };
    return { stat: p.stat || 'gold', amount: Number(p.amount) || 0 };
  };
  const rows = buyback.mode === 'open'
    ? project.items.map(it => ({ item: it, multiplier: null }))
    : (buyback.items || [])
        .map(e => {
          const it = itemFor(e.itemId);
          return it ? { item: it, multiplier: e.multiplier == null ? null : Number(e.multiplier) } : null;
        })
        .filter(Boolean);
  const lit = rows.map(({ item, multiplier }) => {
    const { stat, amount } = pricePair(item);
    const mulField = multiplier == null ? 'null' : multiplier;
    return `{ itemId: ${_q(item.id)}, name: ${_q(item.name || item.id)}, image: ${_q(item.image || '')}, priceStat: ${_q(stat)}, priceAmount: ${amount}, multiplier: ${mulField} }`;
  }).join(', ');
  return { lit: `[${lit}]`, mode: buyback.mode, multiplier: mul };
};

const _emitNpcShop = npc => project => {
  const stockLit = (npc.shop?.stock || []).map(entry => {
    const item    = project.items.find(it => it.id === entry.itemId);
    const { stat, amount } = _resolvePriceCodegen(entry, item);
    const qty     = entry.quantity == null ? 'null' : entry.quantity;
    return `{ itemId: ${_q(entry.itemId)}, name: ${_q(item?.name || entry.itemId)}, image: ${_q(item?.image || '')}, description: ${_q(item?.description || '')}, priceStat: ${_q(stat)}, priceAmount: ${amount}, quantity: ${qty} }`;
  }).join(', ');
  const tailChoicesLit = npc.choices.map(c => _emitChoice(c)(project)).join(', ');
  const buy = _emitBuybackCatalogue(npc)(project);
  return `ctx => {
      const back = ctx.scene;
      const stock = [${stockLit}];
      const buyback = ${buy.lit};
      const buybackMode = ${_q(buy.mode)};
      const buybackDefaultMul = ${buy.multiplier};
      const inv = ctx.state.inventory || {};
      const sold = ctx.state._shopStock?.[${_q(npc.id)}] || {};
      const remain = e => e.quantity == null ? Infinity : Math.max(0, e.quantity - (sold[e.itemId] || 0));
      const buy = e => c => {
        if ((Number(c.state[e.priceStat]) || 0) < e.priceAmount) return;
        if (remain(e) <= 0) return;
        c.setState(s => ({
          [e.priceStat]: (Number(s[e.priceStat]) || 0) - e.priceAmount,
          inventory:     { ...(s.inventory || {}), [e.itemId]: Number(s.inventory?.[e.itemId] || 0) + 1 },
          _shopStock:    { ...(s._shopStock || {}), [${_q(npc.id)}]: { ...(s._shopStock?.[${_q(npc.id)}] || {}), [e.itemId]: (s._shopStock?.[${_q(npc.id)}]?.[e.itemId] || 0) + 1 } },
        }));
      };
      // Sell side. Filter to items the player actually has. Per-item null
      // multiplier falls back to the shop default. Sell stat = item's own
      // price stat.
      const sellable = buybackMode === 'none'
        ? []
        : buyback
            .filter(b => (Number(inv[b.itemId]) || 0) > 0)
            .map(b => ({ ...b, sellAmount: Math.floor((b.multiplier == null ? buybackDefaultMul : b.multiplier) * b.priceAmount) }));
      const sell = b => c => {
        const have = Number(c.state.inventory?.[b.itemId] || 0);
        if (have <= 0) return;
        c.setState(s => {
          const nextCount = (Number(s.inventory?.[b.itemId]) || 0) - 1;
          const nextInv = { ...(s.inventory || {}) };
          if (nextCount <= 0) delete nextInv[b.itemId]; else nextInv[b.itemId] = nextCount;
          return {
            [b.priceStat]: (Number(s[b.priceStat]) || 0) + b.sellAmount,
            inventory:     nextInv,
          };
        });
      };
      // Item-card grid. Image fills the top square when present; description
      // sits under the name; price line is always last so cards align. Buy /
      // Sell live inline on the card and disable themselves when the player
      // can't afford / the stock is sold out / they have nothing to sell.
      const _card = ({ image, name, description, infoLine, btnLabel, btnDisabled, onClick }) =>
        div({ style: 'display:flex; flex-direction:column; gap:6px; padding:10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)' })([
          ...(image
            ? [div({ style: 'aspect-ratio:1/1; background:var(--surface-2, rgba(0,0,0,.04)); border-radius:var(--radius); overflow:hidden; display:grid; place-items:center' })([
                img({ src: image, alt: name, style: 'max-width:100%; max-height:100%; object-fit:contain' })([]),
              ])]
            : []),
          div({ style: 'font-weight:600; font-size:13px; line-height:1.3' })([name]),
          ...(description ? [div({ style: 'font-size:12px; color:var(--text-muted); line-height:1.4' })([description])] : []),
          div({ style: 'font-size:12px; color:var(--text-muted); margin-top:auto' })([infoLine]),
          button({
            className: 'btn btn-primary btn-sm' + (btnDisabled ? ' btn-disabled' : ''),
            type:      'button',
            disabled:  !!btnDisabled,
            onclick:   btnDisabled ? undefined : onClick,
            style:     'margin-top:4px',
          })([btnLabel]),
        ]);
      const _grid = cards => div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:12px' })(cards);
      const body = [
        ${npc.greeting ? `p({ style: 'font-style:italic; color:var(--text-muted)' })([_t(ctx.state, ${_q(npc.greeting)})]),` : ''}
        ...(stock.length === 0
          ? [p({})(['(Nothing for sale right now.)'])]
          : [_grid(stock.map(e => {
              const have = Number(inv[e.itemId] || 0);
              const rem  = remain(e);
              const broke = (Number(ctx.state[e.priceStat]) || 0) < e.priceAmount;
              const soldOut = rem <= 0;
              return _card({
                image:       e.image,
                name:        e.name,
                description: e.description,
                infoLine:    \`\${e.priceAmount} \${e.priceStat} · You have: \${have}\${rem === Infinity ? '' : \` · Left: \${rem}\`}\`,
                btnLabel:    soldOut ? 'Sold out' : (broke ? \`Need \${e.priceAmount} \${e.priceStat}\` : \`Buy (\${e.priceAmount} \${e.priceStat})\`),
                btnDisabled: broke || soldOut,
                onClick:     () => buy(e)(ctx),
              });
            }))]
        ),
        ...(sellable.length === 0 ? [] : [
          p({ style: 'margin-top:12px; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); font-weight:600' })(['Sell to shop']),
          _grid(sellable.map(b => {
            const have = Number(inv[b.itemId] || 0);
            return _card({
              image:       b.image,
              name:        b.name,
              description: '',
              infoLine:    \`+\${b.sellAmount} \${b.priceStat} each · You have: \${have}\`,
              btnLabel:    have <= 0 ? 'None to sell' : \`Sell (+\${b.sellAmount} \${b.priceStat})\`,
              btnDisabled: have <= 0,
              onClick:     () => sell(b)(ctx),
            });
          })),
        ]),
      ];
      // Buy / Sell are on the cards; the choices list keeps only the NPC's
      // own tail choices + Goodbye.
      const choices = [
        ${tailChoicesLit}${npc.choices.length ? ',' : ''}
        { label: 'Goodbye', action: c => c.setState({ _scene: back }) },
      ];
      return Scene({ title: ${_q(npc.name)}, body, choices })(ctx);
    }`;
};

const emitWorld = project => `// AUTO-GENERATED by dervoJS gameEditor.
${_extraImports(project, 'world')}import { p, div, img, video, button } from '../src/elements.js';
import { Scene } from '../src/game.js';
${_TEMPLATE_HELPER}
${_MESSAGE_HELPERS}

// Mirrors scenes.js — NPC dialogue functions reference __COMBATS for exit-to-combat
// flow / enterCombat actions from inside a topic.
const __COMBATS = ${JSON.stringify((project.combats || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {}))};

const NPCS = {
  ${project.npcs.map(n => `${n.id}: {
    name:      ${_q(n.name)},
    locations: ${JSON.stringify(n.locations)},
    greeting:  ${_q(n.greeting)},
    dialogue:  ${n.role === 'shop' ? _emitNpcShop(n)(project) : _emitNpcDialogue(n)(project)},
  }`).join(',\n  ')}
};

export { NPCS };
`;

const emitItems = project => {
  const knownIds = new Set(project.items.map(it => it.id));
  const startingInv = Object.fromEntries(
    Object.entries(project.startingInventory || {})
      .filter(([id, n]) => Number(n) > 0 && knownIds.has(id))
      .map(([id, n]) => [id, Number(n) || 0])
  );
  const startingEquipped = Object.fromEntries(
    Object.entries(project.startingEquipped || {})
      .filter(([slot, id]) => slot && id && knownIds.has(id))
  );
  const startingSkills = Array.isArray(project.startingSkills)
    ? project.startingSkills.filter(id => (project.skills || []).find(s => s.id === id))
    : [];
  return `// AUTO-GENERATED by dervoJS gameEditor.
${_extraImports(project, 'items')}const ITEMS = ${JSON.stringify(project.items.reduce((acc, it) => ({ ...acc, [it.id]: it }), {}), null, 2)};

const initialState = ${JSON.stringify({
  ...Object.fromEntries(project.stats.map(s => [s.key, Number(s.initial) || 0])),
  flags:      Object.fromEntries(project.flags.map(f => [f.key, !!f.initial])),
  inventory:  startingInv,
  equipped:   startingEquipped,
  skills:     startingSkills,
  _pageIdx:    {},
  _npcPageIdx: {},
  _npcGreetingDone: {},
  _npcTopic:        {},
  _npcTopicStack:   {},
  _npcTopicPageIdx: {},
  _shopStock:     {},
  _combat:        null,
  _reading:       null,
  _lootLog:       [],
  _messageQueue:  [],
  _msgInit:       {},
}, null, 2)};

export { ITEMS, initialState };
`;
};

// Emit a sidebar.js if the project enables one. Returns null if disabled or
// empty so the main file can skip the import.
const _emitSidebarFile = project => {
  const sb = project.sidebar || { enabled: false, widgets: [] };
  if (!sb.enabled || sb.widgets.length === 0) return null;

  // Per-widget literal — keeps the runtime branchless (only emit branches
  // for widget types actually used).
  const used = new Set(sb.widgets.map(w => w.type));

  const widgetLiterals = sb.widgets.map(w => JSON.stringify(w)).join(', ');

  return `// AUTO-GENERATED by dervoJS gameEditor.
${_extraImports(project, 'sidebar')}import { div, span, p, img, video, h3, button } from '../src/elements.js';

const WIDGETS = [${widgetLiterals}];
const PROJECT_TITLE = ${_q(project.meta.title)};
const ITEMS = ${JSON.stringify(project.items.reduce((acc, it) => ({ ...acc, [it.id]: it }), {}))};
const STATS_KEYS_ALL = ${JSON.stringify(project.stats.map(s => s.key))};

${used.has('portrait') ? `
const _renderPortrait = (w, ctx) => {
  const inv = ctx.state.inventory || {};
  const equippedIds = new Set(Object.values(ctx.state.equipped || {}));
  const width  = Number(w.width)  || 220;
  const height = Number(w.height) || 280;
  return div({ style: 'margin-bottom:12px; display:flex; justify-content:center' })([
    div({ style: 'position:relative; width:' + width + 'px; height:' + height + 'px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden' })(
      (w.layers || []).map(layer => {
        const binding = (layer.bindings || []).find(b => b.itemId && (equippedIds.has(b.itemId) || (Number(inv[b.itemId] || 0) > 0)));
        const src = (binding && binding.image) || layer.defaultImage;
        if (!src) return div({})([]);
        return img({ src, style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none' })([]);
      })
    ),
  ]);
};` : ''}

${used.has('stats') ? `
const _renderStats = (w, ctx) => {
  const keys = (w.keys && w.keys.length) ? w.keys : STATS_KEYS_ALL;
  return div({ style: 'margin-bottom:12px' })([
    h3({ style: 'margin:0 0 6px; font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em' })(['Stats']),
    div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:13px' })(
      keys.map(k => div({ style: 'display:flex; justify-content:space-between' })([
        span({})([k]),
        span({ style: 'font-family:ui-monospace,monospace' })([String(ctx.state[k] ?? 0)]),
      ]))
    ),
  ]);
};` : ''}

${used.has('inventory') ? `
const _renderInventory = (w, ctx) => {
  const inv = ctx.state.inventory || {};
  const entries = Object.entries(inv).filter(([, n]) => n > 0);
  return div({ style: 'margin-bottom:12px' })([
    h3({ style: 'margin:0 0 6px; font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em' })(['Inventory']),
    ...(entries.length === 0
      ? [p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })(['(empty)'])]
      : (w.layout === 'grid'
          ? [div({ style: 'display:grid; grid-template-columns:repeat(auto-fill,minmax(56px,1fr)); gap:6px' })(
              entries.map(([id, n]) => {
                const it = ITEMS[id];
                return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:6px; background:var(--surface); text-align:center; font-size:11px' })([
                  ...((it && it.image) ? [img({ src: it.image, style: 'width:32px; height:32px; object-fit:contain; display:block; margin:0 auto 4px' })([])] : []),
                  div({})([(it && it.name) || id]),
                  div({ style: 'color:var(--text-muted)' })(['x' + n]),
                ]);
              }))]
          : [div({ style: 'display:flex; flex-direction:column; gap:4px; font-size:13px' })(
              entries.map(([id, n]) => {
                const it = ITEMS[id];
                return div({ style: 'display:flex; justify-content:space-between; gap:8px' })([
                  span({})([(it && it.name) || id]),
                  span({ style: 'font-family:ui-monospace,monospace; color:var(--text-muted)' })(['x' + n]),
                ]);
              }))])),
  ]);
};` : ''}

${used.has('title') ? `
const _renderTitle = (w) => div({ style: 'margin-bottom:12px' })([
  h3({ style: 'margin:0; font-size:15px' })([w.label || PROJECT_TITLE]),
]);` : ''}

${used.has('roomLink') ? `
const _renderRoomLink = (w, ctx) => {
  if (!w.roomId) return null;
  return button({
    type: 'button',
    onclick: () => { ctx.setState(s => ({ _pageIdx: { ...(s._pageIdx || {}), [w.roomId]: 0 } })); ctx.goto(w.roomId); },
    style: 'display:flex; align-items:center; gap:8px; width:100%; margin-bottom:8px; padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-size:13px; text-align:left; cursor:pointer',
  })([
    ...(w.icon ? [span({ style: 'font-size:16px' })([w.icon])] : []),
    span({ style: 'flex:1' })([w.label || w.roomId]),
    span({ style: 'color:var(--text-muted); font-size:11px' })(['→']),
  ]);
};` : ''}

${used.has('js') ? `
// JS widgets compile to inline functions. Helpers + state are bound at the
// call site so author bodies stay terse.
const _jsCache = new WeakMap();
const _renderJs = (w, ctx) => {
  let fn = _jsCache.get(w);
  if (!fn) {
    try {
      fn = new Function('ctx', 'state', 'div', 'span', 'p', 'h3', 'img', 'video', 'button', w.body || 'return null;');
    } catch (e) {
      fn = () => div({ style: 'padding:8px; border:1px solid #c00; border-radius:4px; color:#c00; font-size:12px' })(['JS widget compile error: ' + e.message]);
    }
    _jsCache.set(w, fn);
  }
  try {
    return fn(ctx, ctx.state, div, span, p, h3, img, video, button) || div({})([]);
  } catch (e) {
    return div({ style: 'padding:8px; border:1px solid #c00; border-radius:4px; color:#c00; font-size:12px' })(['JS widget runtime error: ' + e.message]);
  }
};` : ''}

const sidebar = ctx => WIDGETS.map(w => {
  switch (w.type) {
    ${used.has('title')     ? `case 'title':     return _renderTitle(w);` : ''}
    ${used.has('portrait')  ? `case 'portrait':  return _renderPortrait(w, ctx);` : ''}
    ${used.has('stats')     ? `case 'stats':     return _renderStats(w, ctx);` : ''}
    ${used.has('inventory') ? `case 'inventory': return _renderInventory(w, ctx);` : ''}
    ${used.has('roomLink')  ? `case 'roomLink':  return _renderRoomLink(w, ctx);` : ''}
    ${used.has('js')        ? `case 'js':        return _renderJs(w, ctx);` : ''}
    default: return null;
  }
}).filter(Boolean);

export { sidebar };
`;
};

const emitMain = project => {
  const hasSidebar = (project.sidebar?.enabled && project.sidebar.widgets.length > 0);
  const overrides  = project.meta?.themeOverrides || {};
  const colorsLit  = Object.keys(overrides).length
    ? `{\n${Object.entries(overrides).map(([k, v]) => `    ${_q(k)}: ${_q(v)},`).join('\n')}\n  }`
    : null;
  // initStyles colors arg: only emit it when there are overrides, so the
  // generated source stays tidy for projects that use defaults.
  const initLine = colorsLit
    ? `initStyles({ colors: ${colorsLit} });`
    : `initStyles();`;
  return `// AUTO-GENERATED by dervoJS gameEditor.
${_extraImports(project, 'main')}import { initStyles } from '../src/styles.js';
import { createGame } from '../src/game.js';
import { scenes }       from './scenes.js';
import { NPCS }         from './world.js';
import { initialState } from './items.js';
${hasSidebar ? "import { sidebar }     from './sidebar.js';\n" : ''}
${initLine}
document.body.style.cssText = 'padding:0; margin:0';

const game = createGame({
  title:  ${_q(project.meta.title)},
  start:  ${_q(project.meta.start)},
  state:  initialState,
  scenes,
  npcs:   NPCS,
${hasSidebar ? '  sidebar,\n' : ''}  debug:  true,
});

game.mount(document.body);
`;
};

// Escape `</style>` defensively so author-provided CSS can never break out of
// the style block. The token is rare in CSS but possible inside content: "…".
const _escapeStyleClose = css => String(css || '').replace(/<\/style/gi, '<\\/style');

const emitIndexHtml = project => {
  const gameCss = _escapeStyleClose(project.meta.gameCss || '');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${(project.meta.title || 'Untitled RPG').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]))}</title>${gameCss ? `
  <style id="game-custom-css">
${gameCss}
  </style>` : ''}
</head>
<body>
  <script type="module" src="./main.js"></script>
</body>
</html>
`;
};

const emitAll = project => {
  const out = {
    'main.js':    emitMain(project),
    'scenes.js':  emitScenes(project),
    'world.js':   emitWorld(project),
    'items.js':   emitItems(project),
    'index.html': emitIndexHtml(project),
  };
  const sb = _emitSidebarFile(project);
  if (sb) out['sidebar.js'] = sb;
  return out;
};

// Public versions of the small helpers — the editor uses these to show the
// author what JS their structured choices will generate. By going through the
// SAME functions the export goes through, the inline preview can never drift
// from the actual emitted source.
const condToExpr = _condExpr;
const effectToFn = _effectFn;

export {
  emitAll, emitScenes, emitWorld, emitItems, emitMain, emitIndexHtml,
  condToExpr, effectToFn,
};
