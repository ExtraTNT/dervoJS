/**
 * Editor store: wraps dervo createStore with slot-based localStorage
 * persistence (assets spill to IndexedDB) and a setProject helper.
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

/**
 * Strip asset data: URLs out of the project before localStorage write.
 * The data: payloads are pushed to IDB as a side-effect so the next load
 * can hydrate. Migrates old inline-bytes projects on first save.
 */
const _stripForStorage = slot => project => ({
  ...project,
  assets: (project.assets || []).map(a => {
    if (!a.data || !a.data.startsWith('data:')) return a;
    // Fire-and-forget so saveProject stays sync. Failure just leaves
    // bytes in memory until reload.
    saveBlob(slot)(a.id)(a.data).catch(e => console.warn('[assetBlobs] save during strip failed', a.id, e));
    return { ...a, data: IDB_MARKER };
  }),
});

/** Merge IDB blobs back into the project for marker-tagged assets. Returns a fresh project. */
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
  // Write the empty project so the slot shows up in the sidebar list
  // and survives a refresh, even before the first edit.
  const empty = emptyProject();
  saveProject(active)(empty);
  return empty;
};

const _initialTab = () => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
  const known = ['rooms', 'stories', 'npcs', 'items', 'skills', 'combats', 'assets', 'sidebar', 'meta', 'graph', 'preview', 'export', 'theme', 'charCreation'];
  return known.includes(h) ? h : 'rooms';
};

// Editor-only light/dark mode. Per-project CSS + token overrides live on project.meta.
const loadTheme = () => fromMaybe('light')(lsGet(THEME_KEY));
const saveTheme = theme => lsSet(THEME_KEY)(theme);

const store = createStore({
  project:      _initialProject(),
  activeSlot:   getActive(),
  activeTab:    _initialTab(),
  selectedRoomId:   null,
  selectedStoryId:  null,
  selectedNpcId:    null,
  selectedPageId:   null,
  selectedChoiceId: null,
  toast:            null,
  sidebarOpen:      true,
  debugOpen:        false,
  cheatsheetOpen:   false,
  cheatsheetTab:    'builder',
  stateExplorerOpen:     false,
  stateExplorerExpanded: {},
  generator:        { open: false },
  collapsedFolders: {},
  quickBuilder:     { open: false, idx: 0, values: null },
  componentBuilder: { open: false, activeId: null, idx: 0, values: null },
  expandedOpRows:   {},
  confirmDialog:    { open: false, title: '', message: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, onConfirm: null },
  theme:            loadTheme(),
});

const { getState, setState } = store;

/**
 * Set or update the project and persist to the active slot. Without
 * auto-persist a new-slot switch could silently drop unsaved edits.
 */
const setProject = mut => setState(s => {
  const next = typeof mut === 'function' ? mut(s.project) : mut;
  saveProject(s.activeSlot)(next);
  return { project: next };
});

/**
 * Curried by-id-in-array patcher. `mut` is a function or a merge object.
 * No-op if id is missing.
 */
const updateById = key => id => mut => setProject(p => ({
  ...p,
  [key]: (p[key] || []).map(e =>
    e.id === id ? (typeof mut === 'function' ? mut(e) : { ...e, ...mut }) : e),
}));

/** Show a toast for ~2.4s. kind = 'success' | 'error'. */
let _toastTimer = null;
const toast = (text, kind = 'success') => {
  if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
  setState({ toast: { kind, text } });
  _toastTimer = setTimeout(() => setState({ toast: null }), 2400);
};

/** Save the current project under the current slot. */
const persist = () => {
  const { project, activeSlot } = getState();
  saveProject(activeSlot)(project);
  toast(`Saved to "${activeSlot}".`);
};

/** Flush before slot switch in case any state bypassed setProject. */
const _flushCurrentSlot = () => {
  const { activeSlot, project } = getState();
  if (activeSlot && project) saveProject(activeSlot)(project);
};

/**
 * Fire-and-forget asset hydration. Skipped if the slot already switched
 * between read and merge so we don't poison the new slot's state.
 */
const _hydrateActiveSlotAssets = () => {
  const { project, activeSlot } = getState();
  _hydrateAssets(activeSlot)(project).then(next => {
    if (next === project) return;
    setState(s => s.activeSlot === activeSlot ? { project: next } : {});
  }).catch(e => console.error('[assetBlobs] hydration failed', e));
};

const useSlot = slot => {
  if (getState().activeSlot === slot) return;
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

// Initial hydration for the booted slot.
_hydrateActiveSlotAssets();

/** Asset-blob plumbing for the assets panel. Keeps localStorage small. */
const putAssetBlob    = (assetId, data) => saveBlob(getState().activeSlot)(assetId)(data);
const dropAssetBlob   = assetId        => deleteBlob(getState().activeSlot)(assetId);

export {
  store, getState, setState, setProject, updateById,
  persist, listSlots, useSlot, newSlot, removeSlot,
  toast,
  saveTheme,
  putAssetBlob, dropAssetBlob, IDB_MARKER,
};
