/**
 * extractAssets / resolveAssetsForPreview — twin operations that walk a
 * project's media fields:
 *
 *   extractAssets(project)              → { project, files }
 *     · Walks project.assets[] → writes each to a real file path
 *     · Walks every media field → rewrites `asset:<id>` → `./img/foo.webp`
 *     · Legacy inline `data:…` URLs are pulled inline (back-compat)
 *
 *   resolveAssetsForPreview(project)    → project
 *     · Same walk, but media fields get the actual data URL substituted in
 *       so vnodes render in-editor without needing to resolve at every site.
 *
 * Both are pure (the input project is unchanged); the only owner of the
 * walker is this file so the field list lives in one place.
 */

import {
  isDataUrl, dataUrlMime, dataUrlToBytes, mimeToExt, kindFolder,
  isAssetRef, refToId,
} from './assets.js';

const _sanitise = s => String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

// — Walker scaffold ————————————————————————————————————————————

// A walker takes (value, idHint) and returns a (possibly rewritten) string.
const _walkProject = (project, walk) => {
  const mapArr = (arr, fn) => Array.isArray(arr) ? arr.map(fn) : arr;
  return {
    ...project,
    meta: project.meta ? {
      ...project.meta,
      defaultMusic: walk(project.meta.defaultMusic, 'default_music'),
    } : project.meta,
    items: mapArr(project.items, it => ({
      ...it,
      image: walk(it.image, `item_${it.id}`),
    })),
    skills: mapArr(project.skills, sk => ({
      ...sk,
      image: walk(sk.image, `skill_${sk.id}`),
    })),
    npcs: mapArr(project.npcs, n => ({
      ...n,
      portrait: walk(n.portrait, `npc_${n.id}`),
      pages: mapArr(n.pages, (pg, i) => ({
        ...pg,
        image: walk(pg.image, `npc_${n.id}_page${i}`),
        video: walk(pg.video, `npc_${n.id}_page${i}_video`),
      })),
    })),
    rooms: mapArr(project.rooms, r => ({
      ...r,
      music: walk(r.music, `room_${r.id}_music`),
      pages: mapArr(r.pages, (pg, i) => ({
        ...pg,
        image: walk(pg.image, `room_${r.id}_page${i}`),
        video: walk(pg.video, `room_${r.id}_page${i}_video`),
      })),
      wardrobe: r.wardrobe ? {
        ...r.wardrobe,
        layers: mapArr(r.wardrobe.layers, (ly, li) => ({
          ...ly,
          defaultImage: walk(ly.defaultImage, `room_${r.id}_layer${li}`),
          bindings: mapArr(ly.bindings, (b, bi) => ({
            ...b,
            image: walk(b.image, `room_${r.id}_layer${li}_bind${bi}`),
          })),
        })),
      } : r.wardrobe,
    })),
    combats: mapArr(project.combats, c => ({
      ...c,
      enemy: c.enemy ? {
        ...c.enemy,
        image: walk(c.enemy.image, `combat_${c.id}_enemy`),
        actions: mapArr(c.enemy.actions, (a, ai) => ({
          ...a,
          image: walk(a.image, `combat_${c.id}_action${ai}`),
        })),
      } : c.enemy,
      winImage:  walk(c.winImage,  `combat_${c.id}_win`),
      loseImage: walk(c.loseImage, `combat_${c.id}_lose`),
      extraMoves: mapArr(c.extraMoves, (m, mi) => ({
        ...m,
        image: walk(m.image, `combat_${c.id}_extra${mi}`),
      })),
    })),
    sidebar: project.sidebar ? {
      ...project.sidebar,
      widgets: mapArr(project.sidebar.widgets, w => {
        if (w.type === 'portrait') {
          return {
            ...w,
            layers: mapArr(w.layers, (ly, li) => ({
              ...ly,
              defaultImage: walk(ly.defaultImage, `sidebar_${w.id}_layer${li}`),
              bindings: mapArr(ly.bindings, (b, bi) => ({
                ...b,
                image: walk(b.image, `sidebar_${w.id}_layer${li}_bind${bi}`),
              })),
            })),
          };
        }
        return w;
      }),
    } : project.sidebar,
  };
};

// — Export side ————————————————————————————————————————————

const extractAssets = project => {
  if (!project) return { project, files: {} };
  const files  = {};
  const assets = project.assets || [];
  // 1. Catalogue → real files. Build refId → path map.
  const refToPath = new Map();
  const used = new Map();   // base+folder → next disambig idx
  for (const a of assets) {
    if (!a.data) continue;
    const bytes = dataUrlToBytes(a.data);
    if (!bytes) continue;
    const mime   = a.mime || dataUrlMime(a.data);
    const folder = kindFolder(mime);
    const ext    = mimeToExt(mime);
    const base   = _sanitise(a.name) || _sanitise(a.id) || 'asset';
    let n = used.get(`${folder}/${base}`) || 0;
    let path;
    do {
      path = `${folder}/${base}${n ? `_${n}` : ''}.${ext}`;
      n++;
    } while (files[path]);
    used.set(`${folder}/${base}`, n);
    files[path] = bytes;
    refToPath.set(a.id, `./${path}`);
  }

  // 2. Legacy inline data: URL handling — dedupe by data string.
  const dataDedupe = new Map();
  const pullInline = (dataUrl, idHint) => {
    if (dataDedupe.has(dataUrl)) return dataDedupe.get(dataUrl);
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) return dataUrl;
    const mime   = dataUrlMime(dataUrl);
    const folder = kindFolder(mime);
    const ext    = mimeToExt(mime);
    const base   = _sanitise(idHint) || 'asset';
    let n = used.get(`${folder}/${base}`) || 0;
    let path;
    do {
      path = `${folder}/${base}${n ? `_${n}` : ''}.${ext}`;
      n++;
    } while (files[path]);
    used.set(`${folder}/${base}`, n);
    files[path] = bytes;
    const rel = `./${path}`;
    dataDedupe.set(dataUrl, rel);
    return rel;
  };

  // 3. Walk every field, rewriting refs / inline data URLs to relative paths.
  const walk = (val, idHint) => {
    if (!val) return val;
    if (isAssetRef(val)) {
      const id = refToId(val);
      return refToPath.get(id) || '';   // dangling refs collapse to empty
    }
    if (isDataUrl(val)) return pullInline(val, idHint);
    return val;
  };

  const next = _walkProject(project, walk);
  // Strip the catalogue from the emitted project — codegen doesn't need it
  // and we don't want the data: URLs leaking into the JS source files.
  delete next.assets;
  delete next.assetDefaults;
  return { project: next, files };
};

// — Preview side ————————————————————————————————————————————

const resolveAssetsForPreview = project => {
  if (!project) return project;
  // Skip IDB-hydration markers (__idb__) — they're not real data URLs and
  // would render as broken <img>/<audio>/<video>. Empty string here means
  // "show placeholder / play nothing" until hydration completes and a
  // fresh resolveAssetsForPreview pass picks up the real bytes.
  const byId = Object.fromEntries((project.assets || []).map(a => {
    const d = a.data || '';
    return [a.id, d === '__idb__' ? '' : d];
  }));
  const walk = val => {
    if (!val) return val;
    if (isAssetRef(val)) return byId[refToId(val)] || '';
    return val;
  };
  return _walkProject(project, walk);
};

export { extractAssets, resolveAssetsForPreview };
