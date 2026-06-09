/**
 * Editor store. Wraps the dervo createStore with project persistence
 * (localStorage via odocosjs/localObjectStorage) and a setProject helper
 * that bumps a `dirty` flag the topbar listens to.
 */

import { createStore } from '../src/state.js';
import { fromMaybe } from '../lib/odocosjs/src/core.js';
import { set as lsSet, get as lsGet, remove as lsRemove, getKeys as lsKeys } from '../lib/odocosjs/src/localObjectStorage.js';
import { emptyProject, normaliseProject } from './schema.js';
import { IDB_MARKER, saveBlob, loadBlob, deleteBlob, clearSlot } from './assetBlobs.js';

const NS         = 'dervo-game-editor';
const SLOT_KEY   = slot => `${NS}:project:${slot}`;
const ACTIVE_KEY = `${NS}:active-slot`;
const THEME_KEY  = `${NS}:theme`;

const listSlots = () =>
  lsKeys()
    .filter(k => k.startsWith(`${NS}:project:`))
    .map(k => k.slice(`${NS}:project:`.length));

// Strip asset `data:` URLs out of the project before serialising to
// localStorage — the heavy bytes live in IndexedDB. Everything else (URLs,
// already-stripped markers, empty fields) passes through untouched so the
// shape stays JSON-clean.
//
// `slot` is needed for the side-effect: any data: URL we strip is also
// pushed into IDB so the next load can hydrate it. This is what makes the
// MIGRATION from old-format localStorage projects (which had full bytes
// inline) seamless — the first save after upgrade kicks the bytes into IDB,
// and on the next reload hydration finds them.
const _stripForStorage = slot => project => ({
  ...project,
  assets: (project.assets || []).map(a => {
    if (!a.data || !a.data.startsWith('data:')) return a;
    // Fire-and-forget; saveProject stays synchronous. A failure here gets
    // logged but isn't fatal — the in-memory project still has full data
    // until the next page reload.
    saveBlob(slot)(a.id)(a.data).catch(e => console.warn('[assetBlobs] save during strip failed', a.id, e));
    return { ...a, data: IDB_MARKER };
  }),
});

// Recombine a thin project (loaded from localStorage) with its blobs (loaded
// from IDB). Assets without a marker (URL refs, empty data) keep their
// in-place data. Returns a fresh project — caller decides whether to push it
// into the store.
const _hydrateAssets = slot => async project => {
  const assets = project.assets || [];
  const pending = assets
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.data === IDB_MARKER);
  if (pending.length === 0) return project;
  const blobs = await Promise.all(pending.map(({ a }) => loadBlob(slot)(a.id)));
  const next = assets.slice();
  pending.forEach(({ i }, k) => { next[i] = { ...next[i], data: blobs[k] || '' }; });
  return { ...project, assets: next };
};

const saveProject  = slot => project => lsSet(SLOT_KEY(slot))(_stripForStorage(slot)(project));
const loadProject  = slot => normaliseProject(fromMaybe(null)(lsGet(SLOT_KEY(slot))));
const deleteSlot   = slot => { lsRemove(SLOT_KEY(slot)); clearSlot(slot)(); };
const setActive    = slot => lsSet(ACTIVE_KEY)(slot);
const getActive    = () => fromMaybe('default')(lsGet(ACTIVE_KEY));

const _initialProject = () => {
  const active = getActive();
  if (listSlots().includes(active)) return loadProject(active);
  // First-time boot for this slot: write the empty project so the slot
  // appears in the sidebar's list and survives a refresh. Without this the
  // active slot wouldn't show up until the user clicked Save.
  const empty = emptyProject();
  saveProject(active)(empty);
  return empty;
};

const _initialTab = () => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
  const known = ['rooms', 'stories', 'npcs', 'items', 'skills', 'combats', 'assets', 'sidebar', 'meta', 'graph', 'preview', 'export', 'theme'];
  return known.includes(h) ? h : 'rooms';
};

// Light/dark mode is editor-only. Per-project custom CSS + token overrides
// live on project.meta and travel with the project on import/export.
const loadTheme = () => fromMaybe('light')(lsGet(THEME_KEY));
const saveTheme = theme => lsSet(THEME_KEY)(theme);

const store = createStore({
  project:      _initialProject(),
  activeSlot:   getActive(),
  activeTab:    _initialTab(),    // rooms | npcs | items | meta | graph | preview | export
  // selection state per panel
  selectedRoomId:   null,
  selectedStoryId:  null,
  selectedNpcId:    null,
  selectedPageId:   null,
  selectedChoiceId: null,
  // toasts
  toast:            null,    // { kind: 'success'|'error', text }
  // sidebar (file/project tree)
  sidebarOpen:      true,
  debugOpen:        false,
  cheatsheetOpen:   false,
  cheatsheetTab:    'builder',
  // ${…} reference panel (state explorer floating window).
  stateExplorerOpen:     false,
  stateExplorerExpanded: {},   // { [path]: true } — which rows are showing JSON
  // Per-topic Choice generator modal — `null` / `{ open: false }` while closed.
  // See gameEditor/components/ChoiceGenerator.js for the shape.
  generator:        { open: false },
  // Folder grouping — collapsed[panelKey][folder] = true means that folder's
  // entries are hidden in the panel's list. See components/FolderedList.js.
  collapsedFolders: {},
  // Quick Builder wizard state. `open` shows the floating modal; `idx` is the
  // current step in the MultiStep; `values` is the in-progress form snapshot.
  // See components/QuickBuilder.js.
  quickBuilder: { open: false, idx: 0, values: null },
  // Add component wizard state. `activeId` switches between the chooser
  // (null) and a specific builder; `idx` / `values` mirror QuickBuilder.
  // See components/ComponentBuilder.js.
  componentBuilder: { open: false, activeId: null, idx: 0, values: null },
  // Per-op Advanced drawer state in the EffectEditor. Keyed by a path-style
  // rowKey produced by the editor (effect → step → op index). Editor-only.
  expandedOpRows: {},
  // Centered confirmation modal — replaces window.confirm() throughout the
  // editor so deletes and other irreversible actions get a themable prompt.
  // See components/ConfirmDialog.js + confirmAction() helper.
  confirmDialog: { open: false, title: '', message: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, onConfirm: null },
  // Light/dark mode for the editor chrome — editor preference, persisted
  // separately from any project.
  theme:            loadTheme(),
});

const { getState, setState } = store;

// Auto-persist on every project edit. Without this the active slot only
// existed in memory between manual 💾 saves — creating a new slot would
// silently discard the in-progress work because newSlot writes the new
// slot's empty project but never flushes the OLD slot's edits first.
// localStorage writes are synchronous but small (a few KB of JSON per edit),
// so this is comfortable on the keystroke path.
const setProject = mut => setState(s => {
  const next = typeof mut === 'function' ? mut(s.project) : mut;
  saveProject(s.activeSlot)(next);
  return { project: next };
});

// Toast helper — auto-clears after a beat.
let _toastTimer = null;
const toast = (text, kind = 'success') => {
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  setState({ toast: { kind, text } });
  _toastTimer = setTimeout(() => setState({ toast: null }), 2400);
};

// Save the current project under the current slot.
const persist = () => {
  const { project, activeSlot } = getState();
  saveProject(activeSlot)(project);
  toast(`Saved to "${activeSlot}".`);
};

// Belt-and-braces: even though setProject auto-persists, also flush the
// current slot before switching so any state that didn't go through
// setProject (theoretical race) can't leak.
const _flushCurrentSlot = () => {
  const { activeSlot, project } = getState();
  if (activeSlot && project) saveProject(activeSlot)(project);
};

// Fire-and-forget hydration: load asset blobs for `slot` from IDB and
// merge them back into the in-memory project. Skipped when nothing's marked.
// On error we keep going — the editor still works, missing assets just show
// placeholders. Used after boot and after slot switches.
const _hydrateActiveSlotAssets = () => {
  const { project, activeSlot } = getState();
  _hydrateAssets(activeSlot)(project).then(next => {
    if (next === project) return;
    setState(s => s.activeSlot === activeSlot
      ? { project: next }                    // still on the same slot, safe to merge
      : {});                                  // slot already switched, drop the hydration
  }).catch(e => console.error('[assetBlobs] hydration failed', e));
};

const useSlot = slot => {
  if (getState().activeSlot === slot) return;   // no-op when re-selecting current
  _flushCurrentSlot();
  setActive(slot);
  setState({ activeSlot: slot, project: loadProject(slot) });
  _hydrateActiveSlotAssets();
};

const newSlot = (slot, project = null) => {
  _flushCurrentSlot();
  const p = project || emptyProject();
  saveProject(slot)(p);
  setActive(slot);
  setState({ activeSlot: slot, project: p });
  _hydrateActiveSlotAssets();
};

const removeSlot = slot => {
  deleteSlot(slot);
  if (getState().activeSlot === slot) {
    const fallback = listSlots()[0] || 'default';
    useSlot(fallback);
  }
};

// Initial hydration. The empty-project path of _initialProject() can't have
// IDB-marked assets so we skip in that case; for restored slots we kick off
// the async load right after the store comes up.
_hydrateActiveSlotAssets();

// Asset-blob plumbing surfaced for the assets panel: write the data into IDB
// the moment a file is uploaded so localStorage stays small, drop it on
// asset delete so IDB doesn't grow unbounded.
const putAssetBlob    = (assetId, data) => saveBlob(getState().activeSlot)(assetId)(data);
const dropAssetBlob   = assetId        => deleteBlob(getState().activeSlot)(assetId);

export {
  store, getState, setState, setProject,
  persist, listSlots, useSlot, newSlot, removeSlot,
  toast,
  saveTheme,
  putAssetBlob, dropAssetBlob, IDB_MARKER,
};
