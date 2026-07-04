/**
 * Build a releasable dervoJS. Walks src/, writes to <outDir>/dervoJS/,
 * rewrites `lib/odocosjs/` imports so odocosjs is expected as a sibling.
 *
 *   node build.js [outDir]   // writes to <outDir>/dervoJS (default ./dist)
 *   node build.js --in-place // destructive: writes dervoJS/ at repo root,
 *                            // then wipes src/ and DEMO_DIRS. Meant to be
 *                            // run right before pushing a release branch.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Just, Nothing, bind, fromMaybe } from './lib/odocosjs/src/core.js';

const ROOT      = fileURLToPath(new URL('.', import.meta.url));
const SRC       = join(ROOT, 'src');
const IN_PLACE  = process.argv.includes('--in-place');
const OUT_DIR   = IN_PLACE
  ? join(ROOT, 'dervoJS')
  : resolve(process.cwd(), process.argv.find(a => !a.startsWith('-') && !a.endsWith('build.js') && a !== process.execPath) || './dist', 'dervoJS');
console.log(ROOT, SRC, IN_PLACE, OUT_DIR);
const DEMO_DIRS = ['demo', 'demoGame', 'demoHbbtv', 'gameEditor'];
// Files copied from repo root into dervoJS/, then wiped from root in --in-place.
const EXTRAS    = ['optimise-imports.js', 'README.md', 'LICENSE'];
const NUKE      = [...DEMO_DIRS, ...EXTRAS, 'src', 'build.js', 'server.js'];

const _JS_EXT = new Set(['.js', '.mjs']);
const _IMPORT = /(from\s*['"]|import\s*\(\s*['"])((?:\.\.\/)+)lib\/odocosjs\//g;

const rewrite     = src => src.replace(_IMPORT, (_, p, dots) => `${p}${dots}odocosjs/`);
const maybeRewrite = path => src => _JS_EXT.has(extname(path)) ? Just(rewrite(src)) : Nothing;
const transform   = path => src => fromMaybe(src)(maybeRewrite(path)(src));

const targetOf    = srcAbs => join(OUT_DIR, relative(SRC, srcAbs));
const ensureDir   = file    => mkdir(dirname(file), { recursive: true });

const walk = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.isFile() ? [full] : [];
  }))).flat();
};

const copyTo = dst => srcAbs =>
  readFile(srcAbs, 'utf8').then(src => {
    const next = transform(srcAbs)(src);
    return ensureDir(dst).then(() => writeFile(dst, next)).then(() => next !== src);
  });

const copyOne   = srcAbs => copyTo(targetOf(srcAbs))(srcAbs);
const copyExtra = name   => copyTo(join(OUT_DIR, name))(join(ROOT, name));

const wipe = names => Promise.all(names.map(n => rm(join(ROOT, n), { recursive: true, force: true })));

const report = ({ files, rs, extras }) => IN_PLACE
  ? wipe(NUKE).then(() =>
      console.log(`in-place release: ${files.length + extras} files -> ${OUT_DIR} (${rs.filter(Boolean).length} rewrites); wiped ${NUKE.length} paths from root`))
  : console.log(`${files.length + extras} files -> ${OUT_DIR} (${rs.filter(Boolean).length} rewrites)`);

const build = () =>
  rm(OUT_DIR, { recursive: true, force: true })
    .then(() => mkdir(OUT_DIR, { recursive: true }))
    .then(() => walk(SRC))
    .then(files =>
      Promise.all([...files.map(copyOne), ...EXTRAS.map(copyExtra)])
        .then(rs => ({ files, rs, extras: EXTRAS.length })))
    .then(report);

build().catch(e => { console.error(e); process.exit(1); });
