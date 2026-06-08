/**
 * AssetInput — picker for an `asset:<id>` reference (or a plain URL).
 *
 *   AssetInput({
 *     label:    'Image (pick or upload)',
 *     value:    item.image,           // 'asset:asset_xyz' | 'https://…' | ''
 *     onChange: v => set({ image: v }),
 *     accept:   'image',              // 'image' | 'audio' | 'video'
 *   })
 *
 * Reads the current store via getState so the asset catalogue is always live;
 * onChange writes a string (asset ref or URL) so consumers don't change.
 *
 * Three input modes — pick from existing, upload new (auto-added to the
 * Assets catalogue and the field then references it), or paste a URL.
 */

import { div, span, input, img, audio, video, label as lbl} from '../../src/elements.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';

import { onText } from '../helpers.js';
import { getState, setProject, toast } from '../store.js';
import { emptyAsset } from '../schema.js';
import { groupedOptions } from './FolderedList.js';
import {
  isAssetRef, refToId, idToRef, resolveAssetRef,
  isDataUrl, dataUrlMime, dataUrlByteSize, formatBytes,
  fileToDataUrl, compressImageDataUrl,
} from '../assets.js';

const ACCEPT_MIME = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
};

const _addAndReturnId = async (file, accept) => {
  const project = getState().project;
  const defaults = project.assetDefaults || { imageQuality: 0.8, imageMaxDim: 1080 };
  const raw     = await fileToDataUrl(file);
  const rawMime = dataUrlMime(raw);
  const skipCompress = rawMime === 'image/svg+xml' || rawMime === 'image/gif';
  const data = (accept === 'image' && !skipCompress)
    ? await compressImageDataUrl(raw, { quality: defaults.imageQuality, maxDimension: defaults.imageMaxDim })
    : raw;
  // Mime tracks the FINAL bytes (post-compression), not the raw upload, so
  // exports name the file by the actual content (e.g. .webp after WebP).
  const asset = {
    ...emptyAsset(accept),
    name:     (file.name || 'asset').replace(/\.[^.]+$/, ''),
    mime:     dataUrlMime(data),
    data,
    byteSize: dataUrlByteSize(data),
    quality:  (accept === 'image' && !skipCompress) ? defaults.imageQuality : null,
    maxDim:   (accept === 'image' && !skipCompress) ? defaults.imageMaxDim  : null,
  };
  setProject(p => ({ ...p, assets: [...(p.assets || []), asset] }));
  return asset.id;
};

const _pickFile = (accept, onPicked) => {
  const el = document.createElement('input');
  el.type = 'file';
  el.accept = ACCEPT_MIME[accept] || '';
  el.onchange = () => { if (el.files?.[0]) onPicked(el.files[0]); };
  el.click();
};

const _preview = (accept, src) => {
  if (!src) return null;
  if (accept === 'image') {
    return img({
      src,
      style: 'max-width:48px; max-height:48px; object-fit:contain; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface)',
    })([]);
  }
  if (accept === 'audio') {
    return audio({ src, controls: true, style: 'height:30px; max-width:200px' })([]);
  }
  if (accept === 'video') {
    return video({
      src, muted: true,
      style: 'max-width:96px; max-height:60px; border:1px solid var(--border); border-radius:var(--radius); background:#000',
    })([]);
  }
  return null;
};

const AssetInput = ({
  label:       labelText = '',
  value       = '',
  onChange,
  placeholder = '',
  accept       = 'image',
  id,
  style       = '',
} = {}) => {
  const project = getState().project;
  const assets  = (project.assets || []).filter(a => a.kind === accept);

  // What does `value` reference?
  const refId = isAssetRef(value) ? refToId(value) : '';
  const refAsset = refId ? assets.find(a => a.id === refId) : null;
  const isUrl  = !!value && !isAssetRef(value) && !isDataUrl(value);
  const isData = !!value && isDataUrl(value);   // legacy inline data URL

  const resolvedSrc = resolveAssetRef(project, value);

  const _onUpload = async file => {
    try {
      const newId = await _addAndReturnId(file, accept);
      onChange && onChange(idToRef(newId));
      toast(`Uploaded as new asset.`);
    } catch (e) {
      toast(`Upload failed: ${e.message}`, 'error');
    }
  };

  return div({ className: 'field', style })([
    ...(labelText
      ? [lbl({ htmlFor: id, className: 'field-label' })([labelText])]
      : []),
    div({ style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap' })([
      Select({
        options: [
          { value: '',    label: assets.length ? '— pick from catalogue —' : '(no assets yet)' },
          ...groupedOptions(assets)(a => ({ value: idToRef(a.id), label: `${a.name || a.id} · ${formatBytes(a.byteSize)}` })),
          ...(isUrl  ? [{ value: '__url__',  label: '(URL reference — keep as-is)' }] : []),
          ...(isData ? [{ value: '__data__', label: '(legacy inline upload — keep as-is)' }] : []),
        ],
        value: refId ? idToRef(refId) : (isUrl ? '__url__' : isData ? '__data__' : ''),
        onChange: onText(v => {
          if (v === '__url__' || v === '__data__') return;          // keep current
          onChange && onChange(v);
        }),
        style: 'flex:1; min-width:220px',
      }),
      Button({ size: 'sm', variant: 'ghost', onClick: () => _pickFile(accept, _onUpload) })(['↑ Upload new']),
      ...(value
        ? [Button({ size: 'sm', variant: 'ghost', onClick: () => onChange && onChange('') })(['Clear'])]
        : []),
    ]),
    // Plain URL field — visible when not using a catalogue ref
    ...(!refId
      ? [input({
          type:        'text',
          className:   'input',
          value:       isUrl ? value : '',
          placeholder: placeholder || 'https://… (URL reference, no upload)',
          oninput:     onText(v => onChange && onChange(v)),
          style:       'margin-top:6px; width:100%',
        })([])]
      : []),
    // Preview + meta line
    ...(value
      ? [div({ style: 'display:flex; gap:8px; align-items:center; margin-top:6px; min-height:32px' })([
          ...(_preview(accept, resolvedSrc) ? [_preview(accept, resolvedSrc)] : []),
          span({ style: 'font-size:11px; color:var(--text-muted); font-family:ui-monospace,monospace' })([
            refAsset ? `${refAsset.name || refAsset.id} · ${refAsset.mime || ''} · ${formatBytes(refAsset.byteSize)}`
            : isUrl  ? `URL: ${value.slice(0, 60)}${value.length > 60 ? '…' : ''}`
            : isData ? `inline upload · ${dataUrlMime(value)} · ${formatBytes(dataUrlByteSize(value))}`
            : '',
          ]),
        ])]
      : []),
  ]);
};

export { AssetInput };
