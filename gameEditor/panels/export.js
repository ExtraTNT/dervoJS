/**
 * Export panel — preview generated source per file, download any single file
 * or all five as a project.zip, and import/export the raw project.json.
 *
 * The zip uses a minimal in-browser STORE-method ZIP writer (no DEFLATE) so
 * we don't need a dep. Files unpack normally with any zip tool.
 */

import { div, p, h2, span, button, textarea, pre } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack } from '../../src/components/Layout.js';
import { Button } from '../../src/components/Button.js';
import { Badge } from '../../src/components/Badge.js';
import { Alert } from '../../src/components/Alert.js';
import { setState, getState, setProject, toast, persist } from '../store.js';
import { normaliseProject } from '../schema.js';
import { emitAll } from '../codegen.js';
import { extractAssets } from '../extractAssets.js';
import { formatBytes } from '../assets.js';

// CRC32 (used by ZIP entries)
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const _crc32 = bytes => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// Minimal STORE-method ZIP. Good enough for source export; no compression.
// `content` is either a string (JS sources) — encoded as UTF-8 — or a
// Uint8Array (binary assets) — passed through verbatim. The previous
// `TextEncoder.encode(content)` blindly stringified Uint8Array inputs to
// `"137,80,78,…"` form, inflating binary assets ~4× and corrupting them.
const _zip = files => {
  const enc = new TextEncoder();
  const entries = Object.entries(files).map(([name, content]) => {
    const nameBytes = enc.encode(name);
    const data = content instanceof Uint8Array ? content : enc.encode(content);
    const crc = _crc32(data);
    return { name, nameBytes, data, crc, size: data.length };
  });

  const writeU32LE = (buf, off, v) => { buf[off] = v & 0xFF; buf[off+1] = (v >>> 8) & 0xFF; buf[off+2] = (v >>> 16) & 0xFF; buf[off+3] = (v >>> 24) & 0xFF; };
  const writeU16LE = (buf, off, v) => { buf[off] = v & 0xFF; buf[off+1] = (v >>> 8) & 0xFF; };

  // Compute sizes
  const localHeaders = [];
  let offset = 0;
  for (const e of entries) {
    e.localOffset = offset;
    const headerSize = 30 + e.nameBytes.length;
    offset += headerSize + e.size;
    localHeaders.push(headerSize);
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const e of entries) centralSize += 46 + e.nameBytes.length;
  const total = centralStart + centralSize + 22;

  const out = new Uint8Array(total);
  // Write local file headers + data
  let p = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    writeU32LE(out, p, 0x04034b50); p += 4;     // signature
    writeU16LE(out, p, 20);          p += 2;    // version
    writeU16LE(out, p, 0);           p += 2;    // flags
    writeU16LE(out, p, 0);           p += 2;    // method = store
    writeU16LE(out, p, 0);           p += 2;    // mod time
    writeU16LE(out, p, 0);           p += 2;    // mod date
    writeU32LE(out, p, e.crc);       p += 4;
    writeU32LE(out, p, e.size);      p += 4;    // compressed = uncompressed
    writeU32LE(out, p, e.size);      p += 4;
    writeU16LE(out, p, e.nameBytes.length); p += 2;
    writeU16LE(out, p, 0);           p += 2;    // extra
    out.set(e.nameBytes, p); p += e.nameBytes.length;
    out.set(e.data, p);      p += e.size;
  }
  // Central directory
  for (const e of entries) {
    writeU32LE(out, p, 0x02014b50); p += 4;
    writeU16LE(out, p, 20); p += 2;   // version made by
    writeU16LE(out, p, 20); p += 2;   // version needed
    writeU16LE(out, p, 0);  p += 2;
    writeU16LE(out, p, 0);  p += 2;   // method
    writeU16LE(out, p, 0);  p += 2;
    writeU16LE(out, p, 0);  p += 2;
    writeU32LE(out, p, e.crc); p += 4;
    writeU32LE(out, p, e.size); p += 4;
    writeU32LE(out, p, e.size); p += 4;
    writeU16LE(out, p, e.nameBytes.length); p += 2;
    writeU16LE(out, p, 0); p += 2;    // extra
    writeU16LE(out, p, 0); p += 2;    // comment
    writeU16LE(out, p, 0); p += 2;    // disk
    writeU16LE(out, p, 0); p += 2;    // internal
    writeU32LE(out, p, 0); p += 4;    // external
    writeU32LE(out, p, e.localOffset); p += 4;
    out.set(e.nameBytes, p); p += e.nameBytes.length;
  }
  // End of central directory
  writeU32LE(out, p, 0x06054b50); p += 4;
  writeU16LE(out, p, 0); p += 2;
  writeU16LE(out, p, 0); p += 2;
  writeU16LE(out, p, entries.length); p += 2;
  writeU16LE(out, p, entries.length); p += 2;
  writeU32LE(out, p, centralSize); p += 4;
  writeU32LE(out, p, centralStart); p += 4;
  writeU16LE(out, p, 0); p += 2;
  return out;
};

const _download = (name, contentOrBytes, mime = 'application/octet-stream') => {
  const blob = contentOrBytes instanceof Uint8Array
    ? new Blob([contentOrBytes], { type: mime })
    : new Blob([contentOrBytes], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const _safeFolderName = title =>
  String(title || 'untitled-rpg')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled-rpg';

const ExportPanel = state => {
  const { project } = state;
  // Pull uploaded data: URLs out into real binary entries (under img/ audio/
  // video/), and codegen against a project whose fields now hold relative
  // paths instead of giant base64 blobs. For the preview pane we only show
  // the JS sources — the binary file list goes into the zip download.
  const { project: emitProject, files: assetFiles } = extractAssets(project);
  const files = emitAll(emitProject);
  const fileKey = state.exportFile || 'main.js';
  const fileNames = Object.keys(files);
  const assetSummary = Object.entries(assetFiles).map(([path, bytes]) => ({ path, bytes: bytes.byteLength }));

  const _downloadAllZip = () => {
    try {
      const folder = _safeFolderName(project.meta.title);
      const prefixed = Object.fromEntries([
        ...Object.entries(files).map(([n, c]) => [`${folder}/${n}`, c]),
        ...Object.entries(assetFiles).map(([n, c]) => [`${folder}/${n}`, c]),
      ]);
      const bytes = _zip(prefixed);
      _download(`${folder}.zip`, bytes, 'application/zip');
      const totalFiles = Object.keys(files).length + Object.keys(assetFiles).length;
      toast(`Downloaded ${folder}.zip (${totalFiles} files).`);
    } catch (e) {
      toast(`Zip failed: ${e.message}`, 'error');
    }
  };

  const _downloadProjectJson = () => {
    _download('project.json', JSON.stringify(project, null, 2), 'application/json');
    toast('Downloaded project.json');
  };

  const _importProjectJson = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const file = inp.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result);
          setProject(() => normaliseProject(raw));
          persist();
          toast('Project imported and saved.');
        } catch (e) {
          toast(`Import failed: ${e.message}`, 'error');
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Export']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'The editor emits real JS source against dervoJS — drop the exported folder next to ', span({ style: 'font-family:ui-monospace,monospace' })(['src/']), ' (parallel to ', span({ style: 'font-family:ui-monospace,monospace' })(['demoGame/']), ') and serve it.',
    ]),

    Card({ title: 'Download' })([
      Stack({ gap: 8 })([
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({ variant: 'primary', onClick: _downloadAllZip })(['↓ Download all as .zip']),
          Button({ onClick: () => _download(fileKey, files[fileKey]) })([`↓ Download ${fileKey}`]),
          Button({ variant: 'ghost', onClick: _downloadProjectJson })(['↓ project.json']),
          Button({ variant: 'ghost', onClick: _importProjectJson })(['↑ Import project.json']),
        ]),
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'project.json is the raw schema — useful for backup, version control, or sharing.',
        ]),
      ]),
    ]),

    ...(assetSummary.length
      ? [Card({ title: `Bundled assets (${assetSummary.length})` })([
          Stack({ gap: 6 })([
            p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
              'Uploaded files extracted from the project. They\'re written into the zip under their respective folders; the generated JS references them by relative path (e.g. ',
              span({ style: 'font-family:ui-monospace,monospace' })(['./img/item_potion.webp']), ').',
            ]),
            div({ style: 'display:flex; flex-direction:column; gap:3px; font-family:ui-monospace,monospace; font-size:12px; max-height:200px; overflow:auto; border:1px solid var(--border); border-radius:var(--radius); padding:8px; background:var(--surface)' })(
              assetSummary.map(a => div({ style: 'display:flex; gap:12px; justify-content:space-between' })([
                span({})([a.path]),
                span({ style: 'color:var(--text-muted)' })([formatBytes(a.bytes)]),
              ]))
            ),
          ]),
        ])]
      : []),

    Card({ title: 'Generated source' })([
      Stack({ gap: 8 })([
        div({})(
          fileNames.map(name =>
            button({
              type: 'button',
              className: `gef-file-tab${name === fileKey ? ' active' : ''}`,
              onclick: () => setState({ exportFile: name }),
            })([name])
          )
        ),
        pre({ className: 'gef-code' })([files[fileKey]]),
      ]),
    ]),
  ]);
};

export { ExportPanel };
