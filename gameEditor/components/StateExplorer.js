/**
 * StateExplorer - floating reference panel for the inline-expression feature.
 *
 * Lists every key that will exist on `state` once the game runs, based on the
 * current project plus the engine-reserved bookkeeping keys. Each row can be
 * expanded to show the resolved JSON value at game-start (derived from
 * project.stats[].initial, project.startingInventory, etc.), so authors can
 * see the actual shape behind a `${path}` template.
 *
 * Grouped: Stats / Flags / Inventory / Equipped / Skills / Engine internals.
 * Reads from the current project; doesn't run the game.
 */

import { div, span, p, code, pre, button } from '../../src/elements.js';
import { FloatingPanel } from '../../src/components/FloatingPanel.js';
import { Stack } from '../../src/components/Layout.js';
import { setState } from '../store.js';

// ─── Project → initial-state shape ──────────────────────────────────────
//
// Mirrors the state-init logic that buildGameConfig + codegen's emitItems
// already compute. Kept inline because we don't want to import preview.js
// from the editor render path (it pulls in DOM-only modules transitively).

// Type-aware initial - numbers stay numbers, strings stay strings, arrays
// stay arrays. Legacy stats (no `type`) default to numeric so old projects
// inspect the same value they always did.
const _statInitialValue = s => {
  const t = s.type || 'number';
  if (t === 'string') return typeof s.initial === 'string' ? s.initial : '';
  if (t === 'array')  return Array.isArray(s.initial) ? s.initial.map(String) : [];
  return Number(s.initial) || 0;
};

const _initialStateShape = project => {
  const stats = Object.fromEntries((project.stats || []).map(s => [s.key, _statInitialValue(s)]));
  const flags = Object.fromEntries((project.flags || []).map(f => [f.key, !!f.initial]));
  const knownItemIds = new Set((project.items || []).map(it => it.id));
  const startingInv  = Object.fromEntries(
    Object.entries(project.startingInventory || {})
      .filter(([id, n]) => Number(n) > 0 && knownItemIds.has(id))
      .map(([id, n]) => [id, Number(n) || 0])
  );
  const startingEquipped = Object.fromEntries(
    Object.entries(project.startingEquipped || {})
      .filter(([slot, id]) => slot && id && knownItemIds.has(id))
  );
  const startingSkills = Array.isArray(project.startingSkills)
    ? project.startingSkills.filter(id => (project.skills || []).find(s => s.id === id))
    : [];
  const npcLocations = Object.fromEntries(
    (project.npcs || []).filter(n => n.locations[0]).map(n => [n.id, n.locations[0]])
  );
  return {
    ...stats,
    flags,
    inventory:        startingInv,
    equipped:         startingEquipped,
    skills:           startingSkills,
    _scene:           project.meta?.start || '',
    _history:         [],
    _pageIdx:         {},
    _npcPageIdx:      {},
    _npcGreetingDone: {},
    _npcTopic:        {},
    _npcTopicStack:   {},
    _npcTopicPageIdx: {},
    _combat:          null,
    _reading:         null,
    _shopStock:       {},
    _lootLog:         [],
    npcLocations,
  };
};

// Resolve a dotted property path against the initial state. Returns the
// special `__nope` symbol when any segment is non-property (method call,
// expression, square-bracket index) - those can't be statically resolved.
const _NOPE = Symbol('not-a-property-path');
const _isCleanPath = path => /^[\w$.[\]"']+$/.test(path) && !path.includes('(') && !path.includes('?');
const _resolvePath = state => path => {
  const trimmed = path.replace(/^state\.?/, '');
  if (!trimmed) return state;
  if (!_isCleanPath(trimmed)) return _NOPE;
  // Use a tiny Function to walk safely - `with(state)` then `return path;`.
  try {
    // eslint-disable-next-line no-new-func
    return new Function('state', `with (state) { return (${trimmed}); }`)(state);
  } catch (_) {
    return _NOPE;
  }
};

// ─── Row rendering ──────────────────────────────────────────────────────

const _formatValue = v => {
  if (v === undefined) return 'undefined';
  if (v === null)      return 'null';
  try { return JSON.stringify(v, null, 2); }
  catch (_) { return String(v); }
};

const _row = expandedKeys => state => ({ path, exampleExpr, description }) => {
  const resolved = _resolvePath(state)(path);
  const canExpand = resolved !== _NOPE;
  const isOpen    = !!expandedKeys[path];
  const _toggle   = () => setState(s => ({
    stateExplorerExpanded: { ...(s.stateExplorerExpanded || {}), [path]: !isOpen },
  }));
  return div({ style: 'border-bottom:1px solid var(--border-2); padding:5px 0' })([
    div({ style: 'display:grid; grid-template-columns: 20px 1fr 1fr; gap:10px; align-items:start' })([
      canExpand
        ? button({
            type: 'button',
            onclick: _toggle,
            title: isOpen ? 'Collapse JSON' : 'Expand to see initial JSON',
            style: 'background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:12px; line-height:1; padding:2px 0; text-align:left',
          })([isOpen ? '▾' : '▸'])
        : span({ style: 'color:var(--border-2); font-size:12px; line-height:1; padding:2px 0' })(['·']),
      div({ style: 'font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text); word-break:break-word' })([path]),
      div({ style: 'font-size:11.5px; color:var(--text-muted); line-height:1.45' })([
        span({ style: 'font-family:ui-monospace,monospace; color:var(--accent)' })([`\${${exampleExpr}}`]),
        span({})([` - ${description}`]),
      ]),
    ]),
    ...(isOpen && canExpand
      ? [pre({ style: 'margin:6px 0 0 26px; padding:8px 10px; background:var(--surface-2); border:1px solid var(--border-2); border-radius:4px; font-family:ui-monospace,monospace; font-size:11px; line-height:1.55; color:var(--text); white-space:pre-wrap; word-break:break-word; max-height:200px; overflow:auto' })([
          _formatValue(resolved),
        ])]
      : []),
  ]);
};

const _section = title => hint => rows => div({ style: 'margin-bottom:16px' })([
  div({ style: 'display:flex; align-items:baseline; gap:8px; margin-bottom:4px' })([
    span({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--accent)' })([title]),
    span({ style: 'font-size:11px; color:var(--text-muted)' })([hint]),
  ]),
  ...rows,
]);

// ─── Section builders ───────────────────────────────────────────────────

const _statsSection = expandedKeys => state => project => {
  const stats = project.stats || [];
  if (stats.length === 0) return _section('Stats')('- none defined; add some in the Project tab')([]);
  const fmt = s => JSON.stringify(_statInitialValue(s));
  return _section('Stats')('seeded from Project tab → Stats')(
    stats.map(s => _row(expandedKeys)(state)({
      path:         `state.${s.key}`,
      exampleExpr:  s.key,
      description:  `${s.type || 'number'} · initial = ${fmt(s)}`,
    }))
  );
};

const _flagsSection = expandedKeys => state => project => {
  const flags = project.flags || [];
  if (flags.length === 0) return _section('Flags')('- none defined; add some in the Project tab')([]);
  return _section('Flags')('booleans, live at state.flags')([
    _row(expandedKeys)(state)({ path: 'state.flags', exampleExpr: 'flags', description: 'the whole map' }),
    ...flags.map(f => _row(expandedKeys)(state)({
      path:        `state.flags.${f.key}`,
      exampleExpr: `flags.${f.key}`,
      description: `initial = ${f.initial}`,
    })),
  ]);
};

const _inventorySection = expandedKeys => state => project => {
  const items = project.items || [];
  if (items.length === 0) return _section('Inventory')('- no items defined yet')([]);
  return _section('Inventory')('{ itemId: count }, 0 = absent (key removed)')([
    _row(expandedKeys)(state)({ path: 'state.inventory', exampleExpr: 'inventory', description: 'the whole pack' }),
    ...items.map(it => _row(expandedKeys)(state)({
      path:        `state.inventory.${it.id}`,
      exampleExpr: `inventory.${it.id} ?? 0`,
      description: `${it.name || it.id} · count`,
    })),
  ]);
};

const _equippedSection = expandedKeys => state => project => {
  const equipment = (project.items || []).filter(it => it.kind === 'equipment');
  if (equipment.length === 0) return _section('Equipped')('- no equipment items defined')([]);
  const slots = Array.from(new Set(equipment.map(it => it.equipSlot).filter(Boolean)));
  if (slots.length === 0) return _section('Equipped')('- equipment items have no equipSlot set yet')([]);
  return _section('Equipped')('{ slot: itemId } - current paper-doll')([
    _row(expandedKeys)(state)({ path: 'state.equipped', exampleExpr: 'equipped', description: 'the whole map' }),
    ...slots.map(slot => _row(expandedKeys)(state)({
      path:        `state.equipped.${slot}`,
      exampleExpr: `equipped.${slot}`,
      description: `itemId currently in the "${slot}" slot, or undefined`,
    })),
  ]);
};

const _skillsSection = expandedKeys => state => project => {
  const skills = project.skills || [];
  if (skills.length === 0) return _section('Skills')('- no skills defined')([]);
  return _section('Skills')('state.skills is the array of LEARNED ids')([
    _row(expandedKeys)(state)({ path: 'state.skills', exampleExpr: 'skills', description: 'the whole array' }),
    ...skills.map(s => _row(expandedKeys)(state)({
      path:        `state.skills`,                       // re-uses the same expansion as above
      exampleExpr: `skills.includes("${s.id}") ? "yes" : "no"`,
      description: `${s.name || s.id} - is it learned?`,
    })),
  ]);
};

const _engineSection = expandedKeys => state => () => _section('Engine internals')('managed by the engine - read-only in templates')([
  _row(expandedKeys)(state)({ path: 'state._scene',         exampleExpr: '_scene',                exampleDescription: '', description: 'current scene id' }),
  _row(expandedKeys)(state)({ path: 'state._history',       exampleExpr: '_history.length',       description: 'stack of prior scenes; ctx.back() pops it' }),
  _row(expandedKeys)(state)({ path: 'state._pageIdx',       exampleExpr: '_pageIdx[_scene] ?? 0', description: 'per-room page index' }),
  _row(expandedKeys)(state)({ path: 'state._npcPageIdx',    exampleExpr: '_npcPageIdx.mara ?? 0', description: 'per-NPC greeting page index' }),
  _row(expandedKeys)(state)({ path: 'state._npcGreetingDone', exampleExpr: '_npcGreetingDone.mara', description: 'greeting walked through this visit (advanced NPCs)' }),
  _row(expandedKeys)(state)({ path: 'state._npcTopic',      exampleExpr: '_npcTopic.mara',         description: 'current topic id (advanced NPCs)' }),
  _row(expandedKeys)(state)({ path: 'state._npcTopicStack', exampleExpr: '_npcTopicStack.mara.length', description: 'topic stack depth' }),
  _row(expandedKeys)(state)({ path: 'state._combat',        exampleExpr: '_combat?.enemyHp',       description: 'active combat snapshot or null' }),
  _row(expandedKeys)(state)({ path: 'state._reading',       exampleExpr: '_reading?.itemId',       description: 'reading-overlay target or null' }),
  _row(expandedKeys)(state)({ path: 'state._shopStock',     exampleExpr: '_shopStock.brom?.potion', description: 'per-NPC stock sold' }),
  _row(expandedKeys)(state)({ path: 'state._lootLog',       exampleExpr: '_lootLog.at(-1)',        description: 'last "Loot: …" line from randomLoot' }),
  _row(expandedKeys)(state)({ path: 'state._messageQueue',  exampleExpr: '_messageQueue.length',   description: 'Effect.message lines pending Continue dismissal' }),
  _row(expandedKeys)(state)({ path: 'state._msgInit',       exampleExpr: 'init.gold',              description: 'snapshot of state taken at the start of the current action - read it as bare `init` inside ${…} message templates (e.g. ${init.gold})' }),
  _row(expandedKeys)(state)({ path: 'state.npcLocations',   exampleExpr: 'npcLocations.mara',      description: '{ npcId: roomId } - updated by tickWorld()' }),
]);

// ─── Message-template scope (init / gain / loss) section ──────────────

const _messageScopeSection = expandedKeys => state => () => _section('Message templates - extra scope')(`inside Effect.message and LootEntry.message, ${'$'}{…} expressions also see:`)([
  _row(expandedKeys)(state)({ path: 'init',  exampleExpr: 'init.gold',           description: 'every top-level state key, snapshotted before the choice action ran. So `init.gold` = how much gold you HAD.' }),
  _row(expandedKeys)(state)({ path: 'gain',  exampleExpr: 'gain.gold ?? 0',      description: 'per-key POSITIVE deltas: stat-ups, item count-ups, newly-true flags, newly-learned skills. `gain.gold` = how much gold you GAINED.' }),
  _row(expandedKeys)(state)({ path: 'gain.inventory', exampleExpr: 'gain.inventory?.potion', description: 'nested for the inventory map. Use to detect which items were given.' }),
  _row(expandedKeys)(state)({ path: 'loss',  exampleExpr: 'loss.gold',           description: 'per-key NEGATIVE deltas (expressed as positive numbers). Use for "you lost X" messaging.' }),
]);

// ─── Intro ───────────────────────────────────────────────────────────────

const _intro = () => Stack({ gap: 8 })([
  p({ style: 'margin:0; font-size:12.5px; color:var(--text)' })([
    'Any narrative text field (page text, NPC greeting, combat win/lose, item description, readable item content, last-move flavour) accepts ',
    code({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11.5px' })([
      '${expr}',
    ]),
    ' snippets that evaluate against state. Click ',
    span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['▸']),
    ' on any row below to expand the initial JSON.',
  ]),
  pre({ style: 'margin:0; padding:8px 12px; background:var(--surface-2); border-left:3px solid var(--accent); border-radius:4px; font-family:ui-monospace,monospace; font-size:11.5px; line-height:1.7; white-space:pre-wrap' })([
    'You have ${gold} gold and ${hp}/100 hp.\n' +
    'The mage ${flags.metMage ? "nods" : "ignores you"}.\n' +
    'Bread in pack: ${inventory.bread ?? 0}',
  ]),
  p({ style: 'margin:0; font-size:11.5px; color:var(--text-muted)' })([
    'Expressions run via ', span({ className: 'dv-mono' })(['with (state)']),
    ' so bare ', span({ className: 'dv-mono' })(['gold']),
    ' resolves to ', span({ className: 'dv-mono' })(['state.gold']),
    '. Compile errors leave the source ', span({ className: 'dv-mono' })(['${expr}']),
    ' visible so you see what broke.',
  ]),
]);

// ─── Main ────────────────────────────────────────────────────────────────

const StateExplorer = uiState => {
  if (!uiState.stateExplorerOpen) return div({})([]);
  const project       = uiState.project;
  const expandedKeys  = uiState.stateExplorerExpanded || {};
  const initialState  = _initialStateShape(project);
  return FloatingPanel({
    id:       'state-explorer',
    title:    'State Explorer · ${…} reference',
    open:     true,
    onClose:  () => setState({ stateExplorerOpen: false }),
    initialW: 760,
    initialH: 600,
  })([
    div({ style: 'padding:12px 16px; overflow:auto; height:100%; box-sizing:border-box' })([
      Stack({ gap: 16 })([
        _intro(),
        _statsSection(expandedKeys)(initialState)(project),
        _flagsSection(expandedKeys)(initialState)(project),
        _inventorySection(expandedKeys)(initialState)(project),
        _equippedSection(expandedKeys)(initialState)(project),
        _skillsSection(expandedKeys)(initialState)(project),
        _engineSection(expandedKeys)(initialState)(),
        _messageScopeSection(expandedKeys)(initialState)(),
      ]),
    ]),
  ]);
};

export { StateExplorer };
