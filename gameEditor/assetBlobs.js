/**
 * assetBlobs — IndexedDB-backed store for the bytes of uploaded assets.
 *
 * Why a separate store: localStorage caps at ~5 MB per origin, which one
 * audio or video file can blow through. We keep the project SHAPE in
 * localStorage (small, fast, sync), and stash the heavy `asset.data` data
 * URLs in IndexedDB keyed by `<slot>:<assetId>`. Per-slot keys mean dropping
 * a slot can reliably purge its blobs without scanning other slots.
 *
 * Marker convention: when a project is stripped for localStorage, every
 * `asset.data` that was a `data:` URL is replaced with the constant
 * `IDB_MARKER` (see store.js). Hydration on load swaps the marker back for
 * the real data URL by reading from IndexedDB.
 */

import { openDb } from '../lib/odocosjs/src/indexedDbStorage.js';
import { fromMaybe } from '../lib/odocosjs/src/core.js';

// One DB, one object store. The factory caches the connection, so this is
// effectively a module-level singleton.
const _store = openDb('dervo-game-editor')('asset-blobs');

const IDB_MARKER = '__idb__';

const _blobKey = slot => assetId => `${slot}:${assetId}`;

// Write a blob for an asset in a slot. Idempotent — same key just overwrites.
const saveBlob = slot => assetId => data =>
  _store.set(_blobKey(slot)(assetId))(data);

// Read a blob; returns '' when nothing's stored under that key so callers can
// gracefully fall back to a placeholder.
const loadBlob = slot => assetId =>
  _store.get(_blobKey(slot)(assetId)).then(fromMaybe(''));

const deleteBlob = slot => assetId =>
  _store.remove(_blobKey(slot)(assetId));

// Used on slot delete: purge every blob whose key starts with `<slot>:`.
const clearSlot = slot => async () => {
  const prefix = `${slot}:`;
  const keys = await _store.getKeys();
  await Promise.all(keys.filter(k => k.startsWith(prefix)).map(k => _store.remove(k)));
};

const clearAll = () => _store.clear();

export { IDB_MARKER, saveBlob, loadBlob, deleteBlob, clearSlot, clearAll };
