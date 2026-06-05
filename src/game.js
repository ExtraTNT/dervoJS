/**
 * dervoJS — game module
 *
 * Twine-style scene engine with dervoJS's curried, pure-functional style.
 * The author supplies an initial state object and a map of scene render
 * functions; the engine wires up the store, layout shell, scene routing,
 * history, and the StateDebugger.
 *
 *   const game = createGame({
 *     title:  'Forest Adventure',
 *     start:  'intro',
 *     state:  { hp: 100, gold: 0, inventory: [] },
 *     scenes: {
 *       intro:  ctx => Scene({ title: 'Awakening',
 *         body:    [p({})(['You wake in a damp forest.'])],
 *         choices: [
 *           { label: 'Go north',     to: 'forest' },
 *           { label: 'Check pocket', action: ctx => ctx.setState(s => ({ gold: s.gold + 1 })) },
 *         ],
 *       })(ctx),
 *       forest: ctx => Scene({ ... })(ctx),
 *     },
 *     sidebar: ctx => [stats(ctx.state)],
 *     debug:   true,
 *   });
 *   game.mount(document.body);
 *
 * State keys reserved by the engine:
 *   _scene        — id of the currently rendered scene
 *   _history      — stack of prior scene ids (for back())
 *   _sidebarOpen  — whether the sidebar is expanded
 *   _debugOpen    — whether the floating debug panel is open (debug: true only)
 *   npcLocations  — { npcId: sceneId, ... }   (only when `npcs` is configured)
 *
 * The context passed to every scene / sidebar / topBar function:
 *   { state, setState, getState, goto, back, restart, scene, history }
 */

import { div, h2, p, span, button } from './elements.js';
import { Button }            from './components/Button.js';
import { AppShell }          from './components/Layout.js';
import { StateDebugger }     from './components/StateDebugger.js';
import { FloatingPanel }     from './components/FloatingPanel.js';
import { RenderProfiler }    from './components/RenderProfiler.js';
import { ListenersDebugger } from './components/ListenersDebugger.js';
import { toggleTheme }       from './styles.js';
import { createStore, mount, disableProfiler } from './state.js';
import { set as _lsSet, get as _lsGet, getKeys as _lsKeys, remove as _lsRemove } from '../lib/odocosjs/src/localObjectStorage.js';
import { fromMaybe }         from '../lib/odocosjs/src/core.js';

//  default chrome 

const _iconBtnStyle = 'flex-shrink:0; padding:6px 10px; font-size:14px; line-height:1; border:1px solid var(--border); background:none; cursor:pointer; color:var(--text); border-radius:var(--radius)';
const _hamburgerStyle = 'flex-shrink:0; padding:6px 10px; font-size:17px; line-height:1; border:none; background:none; cursor:pointer; color:var(--text); border-radius:var(--radius)';

const _defaultTopBar = title => ctx =>
  div({ style: 'display:flex; align-items:center; gap:10px; padding:0 16px; height:48px' })([
    button({
      type: 'button',
      title: 'Toggle sidebar',
      onclick: () => ctx.setState(s => ({ _sidebarOpen: !s._sidebarOpen })),
      style: _hamburgerStyle,
    })(['☰']),
    ...(ctx.history.length ? [Button({ variant: 'ghost', size: 'sm', onClick: ctx.back })(['← Back'])] : []),
    span({ style: 'font-size:15px; font-weight:600' })([title]),
    span({ style: 'font-size:11px; color:var(--text-muted); font-family:ui-monospace,monospace' })([
      `· ${ctx.scene}`,
    ]),
    div({ style: 'flex:1' })([]),
    button({
      type: 'button',
      title: 'Toggle theme',
      onclick: () => { toggleTheme(); ctx.setState({}); },
      style: _iconBtnStyle,
    })([document.documentElement.dataset.theme === 'dark' ? '🌞' : '🌗']),
    button({
      type: 'button',
      title: 'Save game',
      onclick: () => ctx.save(),
      style: _iconBtnStyle,
    })(['💾']),
    button({
      type: 'button',
      title: 'Load game',
      onclick: () => ctx.load(),
      disabled: !ctx.hasSave(),
      style: _iconBtnStyle + (ctx.hasSave() ? '' : '; opacity:.4; cursor:not-allowed'),
    })(['📂']),
    ...(ctx.debug ? [button({
      type: 'button',
      title: 'State Debugger',
      onclick: () => ctx.setState(s => ({ _debugOpen: !s._debugOpen })),
      style: `flex-shrink:0; padding:4px 10px; font-size:12px; font-weight:600; border:1px solid var(--border); border-radius:var(--radius); background:${ctx.state._debugOpen ? 'var(--accent)' : 'none'}; color:${ctx.state._debugOpen ? '#fff' : 'var(--text)'}; cursor:pointer`,
    })(['⚙ Debug'])] : []),
  ]);

const _defaultNotFound = id => div({ style: 'padding:24px' })([
  h2({})(['Scene not found']),
  p({ style: 'color:var(--text-muted)' })([`No scene with id "${id}".`]),
]);

//  public factory 

/**
 * Build a self-contained Twine-like game.
 *
 * @param {Object}                       config
 * @param {string}                       [config.title='Untitled Game']  Shown in default top bar.
 * @param {string}                       [config.start='start']          Initial scene id.
 * @param {Object}                       [config.state={}]               Author's initial state. Merged with engine's reserved keys.
 * @param {Object<string, function>}     config.scenes                   id -> (ctx) => vnode.
 * @param {function|Array}               [config.sidebar]                ctx => vnode[] (or static array). Rendered above the debugger.
 * @param {function}                     [config.topBar]                 ctx => vnode. Override the default top bar.
 * @param {boolean}                      [config.debug=true]             Show "⚙ Debug" button in the top bar; clicking opens a floating panel with StateDebugger / RenderProfiler / ListenersDebugger.
 * @param {string}                       [config.saveKey]                Override the localStorage namespace. Defaults to `dervo-game:<title>`.
 * @param {function}                     [config.notFound]               id => vnode. Rendered when state._scene matches no scene.
 * @returns {{ mount, store, getState, setState, goto, back, restart }}
 */
const createGame = ({
  title    = 'Untitled Game',
  start    = 'start',
  state    = {},
  scenes   = {},
  npcs     = {},
  sidebar,
  topBar,
  debug    = true,
  notFound = _defaultNotFound,
  saveKey,
} = {}) => {
  // Auto-seed npcLocations from each NPC's first allowed location, unless
  // the author already provided their own.
  const _autoNpcLocations = state.npcLocations ?? Object.fromEntries(
    Object.entries(npcs)
      .map(([id, n]) => [id, n.locations?.[0]])
      .filter(([, loc]) => loc != null)
  );

  // Engine-reserved keys live alongside the author's state.
  const _initial = {
    _scene: start, _history: [], _sidebarOpen: true, _debugOpen: false,
    npcLocations: _autoNpcLocations,
    ...state,
  };
  const store    = createStore(_initial);
  const { getState, setState } = store;

  //  save / load via odocosJS's localObjectStorage 
  // One namespace per game (overridable). Each slot is a separate localStorage key.
  const _ns = saveKey || `dervo-game:${title}`;
  const _slotKey = (slot = 'default') => `${_ns}:${slot}`;

  const save     = (slot = 'default') => _lsSet(_slotKey(slot))(getState());
  const load     = (slot = 'default') => {
    const data = fromMaybe(null)(_lsGet(_slotKey(slot)));
    if (data) setState(data);
    return Boolean(data);
  };
  const hasSave  = (slot = 'default') => _lsKeys().includes(_slotKey(slot));
  const clearSave = (slot = 'default') => _lsRemove(_slotKey(slot));
  const listSlots = () =>
    _lsKeys()
      .filter(k => k.startsWith(_ns + ':'))
      .map(k => k.slice(_ns.length + 1));

  //  navigation 
  const goto = id => setState(s =>
    s._scene === id ? {} : { _scene: id, _history: [...s._history, s._scene] }
  );

  const back = () => setState(s => {
    if (!s._history.length) return {};
    const prev = s._history[s._history.length - 1];
    return { _scene: prev, _history: s._history.slice(0, -1) };
  });

  // Reset to the initial state. Keys added at runtime persist as-is —
  // author should clear them explicitly if a true fresh start is needed.
  const restart = () => setState(_initial);

  //  NPCs (no-op when `npcs` is empty) 
  const npcsAt = sceneId =>
    Object.entries(getState().npcLocations || {})
      .filter(([id, loc]) => loc === sceneId && npcs[id])
      .map(([id]) => ({ id, ...npcs[id] }));

  const tickWorld = () => setState(s => {
    if (!Object.keys(npcs).length) return {};
    const next = { ...(s.npcLocations || {}) };
    for (const [id, npc] of Object.entries(npcs)) {
      const locs = npc.locations || [];
      if (locs.length) next[id] = locs[Math.floor(Math.random() * locs.length)];
    }
    return { npcLocations: next };
  });

  // Open an NPC's dialogue scene. Engine returns to `returnTo` (default:
  // current scene) when the NPC's dialogue navigates away.
  const talkTo = (npcId, returnTo) =>
    setState(s => ({ _scene: `_dialogue:${npcId}:${returnTo ?? s._scene}` }));

  //  ctx passed to every author-supplied function 
  const _ctx = s => ({
    state:   s,
    setState, getState,
    goto, back, restart,
    save, load, hasSave, clearSave, listSlots,
    npcs, npcsAt, tickWorld, talkTo,
    scene:   s._scene,
    history: s._history,
    debug,                                // exposed so the default topbar can show the Debug button
  });

  //  slot rendering 
  // Pseudo-scene ids `_dialogue:<npcId>:<returnTo>` dispatch to the matching
  // NPC's dialogue() function, with ctx.scene patched to the return location
  // so dialogue navigation can return cleanly.
  const _resolveScene = id => {
    if (typeof id === 'string' && id.startsWith('_dialogue:')) {
      const [, npcId, returnTo] = id.split(':');
      const npc = npcs[npcId];
      if (npc && typeof npc.dialogue === 'function') {
        return ctx => npc.dialogue({ ...ctx, scene: returnTo });
      }
    }
    return scenes[id];
  };

  const _renderScene = s => {
    const fn = _resolveScene(s._scene);
    return typeof fn === 'function' ? fn(_ctx(s)) : notFound(s._scene);
  };

  const _renderSidebar = s => {
    const ctx     = _ctx(s);
    const content = typeof sidebar === 'function' ? sidebar(ctx) : (sidebar || []);
    const items   = Array.isArray(content) ? content : [content];
    return div({ style: 'padding:12px; overflow-y:auto; height:100%' })(items);
  };

  const _renderTopBar = s => {
    const ctx = _ctx(s);
    return (typeof topBar === 'function' ? topBar : _defaultTopBar(title))(ctx);
  };

  // Floating debug panel — mirrors demo/app.js.
  const _renderDebugPanel = s =>
    FloatingPanel({
      id:       'game-debugger',
      title:    'State Debugger',
      open:     s._debugOpen,
      onClose:  () => { setState({ _debugOpen: false }); disableProfiler(); },
      initialX: 24, initialY: 64,
      initialW: 920, initialH: 560,
    })([
      StateDebugger({ state: s, setState, getState }),
      RenderProfiler({ setState, active: s._debugOpen }),
      ListenersDebugger({ setState }),
    ]);

  const view = s => [
    AppShell({
      topBar:      _renderTopBar(s),
      sidebar:     _renderSidebar(s),
      sidebarOpen: s._sidebarOpen,
    })([
      _renderScene(s),
    ]),
    ...(debug ? [_renderDebugPanel(s)] : []),
  ];

  return {
    mount: root => mount(store)(root)(view),
    store, getState, setState,
    goto, back, restart,
    save, load, hasSave, clearSave, listSlots,
    npcsAt, tickWorld, talkTo,
  };
};

//  Twine-style helpers 

/**
 * Scene — render a Twine-style descriptor as a vnode.
 * Curried: Scene(opts)(ctx).
 *
 * @param {Object}  opts
 * @param {string}  [opts.title]
 * @param {*}       [opts.body=[]]     vnode or array of vnodes
 * @param {Array}   [opts.choices=[]]  passed through to ChoiceList
 * @returns {function} ctx => vnode
 */
const Scene = ({ title, body = [], choices = [] } = {}) => ctx =>
  div({ className: 'game-scene', style: 'max-width:720px; margin:0 auto' })([
    ...(title ? [h2({ style: 'margin:0 0 12px' })([title])] : []),
    ...(Array.isArray(body) ? body : [body]),
    ChoiceList(choices)(ctx),
  ]);

/**
 * Choice — single Twine-style choice. Curried: Choice(opts)(ctx).
 *
 * @param {Object}    opts
 * @param {string}    opts.label
 * @param {string}    [opts.to]        Scene id to navigate to.
 * @param {function}  [opts.action]    (ctx) => void — runs before navigation.
 * @param {boolean}   [opts.disabled]
 * @param {boolean|function} [opts.if=true]  Boolean or (ctx) => boolean predicate.
 * @returns {function} ctx => vnode | null
 */
const Choice = ({ label, to, action, disabled, if: cond = true } = {}) => ctx => {
  const ok = typeof cond === 'function' ? cond(ctx) : !!cond;
  if (!ok) return null;
  return Button({
    disabled,
    onClick: () => {
      if (typeof action === 'function') action(ctx);
      if (to) ctx.goto(to);
    },
  })([label]);
};

/**
 * ChoiceList — render a stack of Choice buttons. Each entry can be a
 * Choice descriptor object or an already-curried function (e.g. Choice(...)).
 *
 * @param {Array} choices
 * @returns {function} ctx => vnode
 */
const ChoiceList = (choices = []) => ctx =>
  div({ style: 'display:flex; flex-direction:column; gap:8px; margin-top:16px' })(
    choices
      .map(c => (typeof c === 'function' ? c(ctx) : Choice(c)(ctx)))
      .filter(Boolean)
  );

/**
 * withTick — wrap an action so the world ticks (NPCs move) after it runs.
 * Pure helper; uses ctx.tickWorld() at call time.
 *
 * @example
 *   { label: 'Train STR', action: withTick(c => c.setState({...})) }
 */
const withTick = action => ctx => {
  if (typeof action === 'function') action(ctx);
  ctx.tickWorld();
};

/**
 * NpcChoices — generate "Talk to <name>" choice descriptors for every NPC
 * currently at the given scene. Spread into a Scene's choices array.
 *
 * @example
 *   choices: [
 *     { label: 'Visit the gym', to: 'gym' },
 *     ...NpcChoices(ctx, ctx.scene),
 *   ]
 */
const NpcChoices = (ctx, sceneId = ctx.scene) =>
  ctx.npcsAt(sceneId).map(npc => ({
    label:  `Talk to ${npc.name}`,
    action: c => c.talkTo(npc.id, sceneId),
  }));

/**
 * NpcLine — render the greeting line(s) for NPCs currently at the scene.
 * Returns an array (possibly empty) of vnodes, ready to spread into a body.
 *
 * @example
 *   Scene({ body: [p({})(['You enter the tavern.']), ...NpcLine(ctx)] })(ctx)
 */
const NpcLine = (ctx, sceneId = ctx.scene) => {
  const here = ctx.npcsAt(sceneId);
  if (here.length === 0) return [];
  return [p({ style: 'color:var(--text-muted); font-style:italic; font-size:13px' })([
    here.map(n => n.greeting).filter(Boolean).join(' '),
  ])];
};

export { createGame, Scene, Choice, ChoiceList, withTick, NpcChoices, NpcLine };
