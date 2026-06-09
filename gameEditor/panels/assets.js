/**
 * Assets panel — top-level catalogue of every uploaded image / audio / video.
 *
 * Fields elsewhere (item.image, page.video, room.music, …) hold an
 * `asset:<id>` reference instead of an inline data URL, so the same upload
 * can be reused across rooms/items without duplication.
 *
 * Project-wide compression defaults live here too; they're applied to every
 * new upload. To change settings on a past asset, drop it and re-upload — we
 * don't keep the lossless original around to save localStorage space.
 */

import { div, span, h2, p, button, img, audio, video } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Slider } from '../../src/components/Slider.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState, toast } from '../store.js';
import { confirmAction } from '../components/ConfirmDialog.js';
import { emptyAsset } from '../schema.js';
import { onText } from '../helpers.js';
import {
  fileToDataUrl, compressImageDataUrl,
  isDataUrl, dataUrlMime, dataUrlByteSize, formatBytes,
} from '../assets.js';
import { FolderedList, FolderField, folderSuggestions } from '../components/FolderedList.js';

const KIND_OPTS = [
  { value: 'all',   label: 'All kinds' },
  { value: 'image', label: 'Images'    },
  { value: 'audio', label: 'Audio'     },
  { value: 'video', label: 'Video'     },
];

const ACCEPT_MIME = { image: 'image/*', audio: 'audio/*', video: 'video/*' };

const _kindOfMime = mime => {
  if (!mime) return 'image';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'image';
};

const _processUpload = async (file, project) => {
  const raw = await fileToDataUrl(file);
  const rawMime = dataUrlMime(raw);
  const kind = _kindOfMime(rawMime);
  const defaults = project.assetDefaults || { imageQuality: 0.8, imageMaxDim: 1080 };
  // Skip recompression for SVG (vector) and GIF (animation flattens otherwise).
  const skipCompress = rawMime === 'image/svg+xml' || rawMime === 'image/gif';
  const data = (kind === 'image' && !skipCompress)
    ? await compressImageDataUrl(raw, { quality: defaults.imageQuality, maxDimension: defaults.imageMaxDim })
    : raw;
  // Mime comes from the FINAL data URL, not the upload — base64ToWebP rewrites
  // the header to image/webp on success. If we stored rawMime here, the zip
  // export would write a .png filename around the WebP bytes (4x larger than
  // the equivalent .png and confusing for anyone inspecting the export).
  return {
    ...emptyAsset(kind),
    name:     file.name.replace(/\.[^.]+$/, '') || 'Untitled',
    mime:     dataUrlMime(data),
    data,
    byteSize: dataUrlByteSize(data),
    quality:  (kind === 'image' && !skipCompress) ? defaults.imageQuality : null,
    maxDim:   (kind === 'image' && !skipCompress) ? defaults.imageMaxDim  : null,
  };
};

const _addAssetsFromFiles = async (files, project) => {
  const processed = await Promise.all([...files].map(f => _processUpload(f, project)));
  setProject(p => ({ ...p, assets: [...(p.assets || []), ...processed] }));
  toast(`Uploaded ${processed.length} asset${processed.length === 1 ? '' : 's'}.`);
};

const _pickFiles = (accept, onPicked) => {
  const el = document.createElement('input');
  el.type = 'file'; el.accept = accept; el.multiple = true;
  el.onchange = () => { if (el.files?.length) onPicked(el.files); };
  el.click();
};

const _updateAsset = (id, patch) => setProject(p => ({
  ...p,
  assets: p.assets.map(a => a.id === id ? { ...a, ...patch } : a),
}));

const _deleteAsset = id => setProject(p => ({
  ...p,
  assets: p.assets.filter(a => a.id !== id),
}));

const _setDefaults = patch => setProject(p => ({
  ...p,
  assetDefaults: { ...(p.assetDefaults || {}), ...patch },
}));

const _preview = asset => {
  const src = asset.data;
  if (!src) return div({ style: 'width:96px; height:72px; border:1px dashed var(--border); border-radius:var(--radius); display:grid; place-items:center; color:var(--text-muted); font-size:11px' })(['(no data)']);
  if (asset.kind === 'image') {
    return img({ src, style: 'width:96px; height:72px; object-fit:contain; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)' })([]);
  }
  if (asset.kind === 'audio') {
    return audio({ src, controls: true, style: 'height:36px; max-width:200px' })([]);
  }
  if (asset.kind === 'video') {
    return video({ src, muted: true, style: 'width:120px; height:72px; object-fit:contain; border:1px solid var(--border); border-radius:var(--radius); background:#000' })([]);
  }
  return div({})([]);
};

const AssetCard = suggestions => asset => {
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); display:flex; gap:12px; align-items:center' })([
    _preview(asset),
    div({ style: 'flex:1; min-width:0' })([
      Grid({ cols: 2, gap: 8 })([
        TextInput({
          label:    'Name',
          value:    asset.name,
          onChange: onText(v => _updateAsset(asset.id, { name: v })),
        }),
        div({ style: 'display:flex; flex-direction:column; gap:2px; font-size:11.5px; color:var(--text-muted); justify-content:flex-end' })([
          div({})([
            'ID: ',
            span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })([asset.id]),
          ]),
          div({})([
            Badge({ variant: asset.kind === 'image' ? 'blue' : asset.kind === 'audio' ? 'purple' : 'yellow' })([asset.kind]),
            span({ style: 'margin-left:8px' })([asset.mime || '?']),
            span({ style: 'margin-left:8px' })([formatBytes(asset.byteSize)]),
            ...(asset.quality != null ? [span({ style: 'margin-left:8px' })([`q=${asset.quality} · max=${asset.maxDim}px`])] : []),
          ]),
        ]),
      ]),
      FolderField({
        id:          `asset-folder-${asset.id}`,
        value:       asset.folder,
        onChange:    v => _updateAsset(asset.id, { folder: v }),
        suggestions,
      }),
    ]),
    div({ style: 'display:flex; flex-direction:column; gap:6px' })([
      Button({ size: 'sm', variant: 'ghost', onClick: () => _pickFiles(ACCEPT_MIME[asset.kind] || '', files => {
        _processUpload(files[0], { assetDefaults: { imageQuality: asset.quality ?? 0.8, imageMaxDim: asset.maxDim ?? 1080 } }).then(updated => {
          _updateAsset(asset.id, { data: updated.data, mime: updated.mime, byteSize: updated.byteSize, quality: updated.quality, maxDim: updated.maxDim });
          toast(`Replaced ${asset.name || asset.id}.`);
        });
      }) })(['↻ Re-upload']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => confirmAction({
        title:        'Delete asset',
        message:      `Delete asset "${asset.name || asset.id}"? References elsewhere will break.`,
        confirmLabel: 'Delete',
        danger:       true,
        onConfirm:    () => _deleteAsset(asset.id),
      }) })(['Delete']),
    ]),
  ]);
};

const AssetsPanel = state => {
  const { project } = state;
  const assets = project.assets || [];
  const filter = state.assetsKindFilter || 'all';
  const shown = filter === 'all' ? assets : assets.filter(a => a.kind === filter);
  const defaults = project.assetDefaults || { imageQuality: 0.8, imageMaxDim: 1080 };

  // Totals by kind
  const totalsByKind = assets.reduce((acc, a) => {
    acc[a.kind] = (acc[a.kind] || 0) + 1;
    acc.bytes = (acc.bytes || 0) + (a.byteSize || 0);
    return acc;
  }, {});

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Assets']),
    p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
      'One catalogue for every uploaded image, audio clip and video. Every field elsewhere (item image, page video, room music, …) ',
      'picks from this list, so the same ',
      span({ style: 'font-family:ui-monospace,monospace' })(['player_eating.webp']),
      ' shows up in the kitchen and the restaurant without being stored twice.',
    ]),

    Card({ title: 'Defaults for new image uploads' })([
      Stack({ gap: 8 })([
        Grid({ cols: 2, gap: 12 })([
          NumberInput({
            label:    'WebP quality (0..1)',
            value:    Number(defaults.imageQuality) || 0.8,
            min:      0.1, max: 1, step: 0.05,
            onChange: v => _setDefaults({ imageQuality: Math.max(0.1, Math.min(1, Number(v) || 0.8)) }),
          }),
          NumberInput({
            label:    'Max height (px)',
            value:    Number(defaults.imageMaxDim) || 1080,
            min:      64, max: 4096,
            onChange: v => _setDefaults({ imageMaxDim: Math.max(64, Math.min(4096, Number(v) || 1080)) }),
          }),
        ]),
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'Higher quality / larger size → bigger files but better fidelity. Audio and video are stored verbatim; only images pass through ',
          span({ style: 'font-family:ui-monospace,monospace' })(['base64ToWebP']),
          '. SVG and GIF skip recompression to preserve vectors and animation.',
        ]),
      ]),
    ]),

    Card({ title: 'Upload' })([
      Stack({ gap: 8 })([
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({ variant: 'primary', onClick: () => _pickFiles('image/*', files => _addAssetsFromFiles(files, project)) })(['↑ Upload images']),
          Button({ onClick: () => _pickFiles('audio/*', files => _addAssetsFromFiles(files, project)) })(['↑ Upload audio']),
          Button({ onClick: () => _pickFiles('video/*', files => _addAssetsFromFiles(files, project)) })(['↑ Upload video']),
        ]),
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'Multi-select is supported. Filenames become the asset name (extension stripped); rename below if needed.',
        ]),
      ]),
    ]),

    Card({ title: `Catalogue (${assets.length})` })([
      Stack({ gap: 8 })([
        div({ style: 'display:flex; align-items:center; gap:12px; flex-wrap:wrap' })([
          Select({
            label:    '',
            options:  KIND_OPTS,
            value:    filter,
            onChange: onText(v => setState({ assetsKindFilter: v })),
          }),
          div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })([
            Badge({ variant: 'blue'   })([`${totalsByKind.image || 0} images`]),
            Badge({ variant: 'purple' })([`${totalsByKind.audio || 0} audio`]),
            Badge({ variant: 'yellow' })([`${totalsByKind.video || 0} video`]),
            Badge({ variant: 'gray'   })([`${formatBytes(totalsByKind.bytes || 0)} total`]),
          ]),
        ]),
        ...(shown.length === 0
          ? [div({ className: 'gef-empty' })([assets.length === 0 ? 'No assets yet. Upload something above.' : 'Nothing matches this filter.'])]
          : [FolderedList({
              items:      shown,
              panelKey:   'assets',
              collapsed:  state.collapsedFolders?.assets || {},
              renderItem: AssetCard(folderSuggestions(assets)),
            })]),
      ]),
    ]),
  ]);
};

export { AssetsPanel };
