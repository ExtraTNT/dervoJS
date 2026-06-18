/**
 * Asset helpers - read files, compress images, decode data URLs.
 *
 * Uploaded files are stored as data: URLs on the project JSON so they survive
 * a save/load cycle through localStorage. On export, the data URLs are
 * extracted to real files inside img/ audio/ video/ folders in the zip, and
 * the project paths get rewritten to point at those relative URLs.
 *
 * Images are passed through odocosJS's base64ToWebP for a meaningful size
 * reduction (lossy WebP at ~0.8 quality, max-height 1080). Audio and video
 * are stored verbatim - browser-side re-encoding for those is too heavy and
 * the typical asset is already in a compressed container.
 */

import { base64ToWebP } from '../lib/odocosjs/src/extra.js';

const isDataUrl = s => typeof s === 'string' && s.startsWith('data:');

// Pull the mime type out of a data URL header.  "data:image/png;base64,…" → "image/png"
const dataUrlMime = s => {
  if (!isDataUrl(s)) return '';
  const semi = s.indexOf(';');
  return semi > 0 ? s.slice(5, semi) : s.slice(5, s.indexOf(','));
};

// Approximate the decoded byte length of a base64 data URL.
const dataUrlByteSize = s => {
  if (!isDataUrl(s)) return 0;
  const comma = s.indexOf(',');
  if (comma < 0) return 0;
  const b64 = s.slice(comma + 1);
  // Each 4 base64 chars decode to 3 bytes; padding deducts 1 or 2.
  const pad = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
};

// Read a File / Blob as a data URL.
const fileToDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Read failed: ' + (reader.error?.message || 'unknown')));
  reader.readAsDataURL(file);
});

// Compress a base64/data URL image through odocosJS's base64ToWebP. Falls back
// to the original on failure (some formats - SVG, GIF - don't survive canvas
// re-encode well; we keep them untouched).
const compressImageDataUrl = async (dataUrl, opts = {}) => {
  const { quality = 0.8, maxDimension = 1080 } = opts;
  try {
    return await base64ToWebP(dataUrl, quality, maxDimension);
  } catch (_e) {
    return dataUrl;
  }
};

// Decode a base64 data URL into a Uint8Array (used during export to write
// files into the zip). Returns null for non-data URLs.
const dataUrlToBytes = dataUrl => {
  if (!isDataUrl(dataUrl)) return null;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Map a mime type to a file extension. Falls back to 'bin' for unknowns.
const mimeToExt = mime => {
  if (!mime) return 'bin';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png')  return 'png';
  if (mime === 'image/gif')  return 'gif';
  if (mime === 'image/svg+xml') return 'svg';
  if (mime === 'audio/mpeg') return 'mp3';
  if (mime === 'audio/wav')  return 'wav';
  if (mime === 'audio/ogg')  return 'ogg';
  if (mime === 'audio/webm') return 'webm';
  if (mime === 'video/mp4')  return 'mp4';
  if (mime === 'video/webm') return 'webm';
  if (mime === 'video/ogg')  return 'ogv';
  // last-resort: take the part after '/'
  const slash = mime.indexOf('/');
  return slash > 0 ? mime.slice(slash + 1).replace(/\+.*$/, '') : 'bin';
};

const kindFolder = mime => {
  if (mime.startsWith('image/')) return 'img';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'asset';
};

// Format a byte count for human display.
const formatBytes = n => {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

// - Asset catalogue API --------------------------------------------

// String ref scheme: `asset:<id>`. We pass everything else through unchanged
// (plain URLs, empty string, even legacy inline data: URLs).
const ASSET_PREFIX = 'asset:';
const isAssetRef = s => typeof s === 'string' && s.startsWith(ASSET_PREFIX);
const refToId    = s => isAssetRef(s) ? s.slice(ASSET_PREFIX.length) : '';
const idToRef    = id => id ? `${ASSET_PREFIX}${id}` : '';

// Resolve a field value (asset:id / plain URL / inline data URL / '') to
// something a vnode src can use. Returns '' for empty/missing.
const resolveAssetRef = (project, ref) => {
  if (!ref) return '';
  if (!isAssetRef(ref)) return ref;
  const id = refToId(ref);
  const a = (project?.assets || []).find(x => x.id === id);
  // Treat the IDB hydration marker (see assetBlobs.js) as "no data yet" so
  // <img>/<audio> tags don't try to load the literal string `__idb__`.
  if (!a?.data || a.data === '__idb__') return '';
  return a.data;
};

// Same shape, but returns an empty array of *all* refs in a project for the
// extractor + sweeper at delete time. Hand-rolled to avoid mass field-walking
// elsewhere - see extractAssets.js for the structural walk.

export {
  isDataUrl, dataUrlMime, dataUrlByteSize, dataUrlToBytes,
  fileToDataUrl, compressImageDataUrl,
  mimeToExt, kindFolder, formatBytes,
  ASSET_PREFIX, isAssetRef, refToId, idToRef, resolveAssetRef,
};
