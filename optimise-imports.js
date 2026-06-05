#!/usr/bin/env node
// scripts/optimise-imports.js
//
// Rewrites `import { … } from '…dervoJS/index.js'` across src/ to direct module
// imports so the browser only fetches the files it actually needs.
//
// Usage:
//   node scripts/optimise-imports.js            # dry-run (preview only)
//   node scripts/optimise-imports.js --write    # apply changes
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname);
const LIB_DIR   = resolve(ROOT, 'src');
const SRC_DIR   = resolve(ROOT, 'gameEditor');
const WRITE     = process.argv.includes('--write');


const read = f => readFileSync(f, 'utf8');

// "export { a, b as c } from './x'"  ->  [[resolvedName, from], …]
const parseNamedReexports = text =>
  [...text.matchAll(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/gm)]
    .flatMap(([, names, from]) =>
      names
        .split(',')
        .map(n => n.trim())
        .filter(Boolean)
        .map(n => [n.split(/\s+as\s+/).at(-1).trim(), from])
    );

// "export * from './x'"  ->  [from, …]
const parseStarReexports = text =>
  [...text.matchAll(/^export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)]
    .map(([, from]) => from);

// "export const/function foo …"  ->  [name, …]
const parseTopLevelExports = text =>
  [...text.matchAll(/^export\s+(?:const|let|var|function\s*\*?|class)\s+(\w+)/gm)]
    .map(([, name]) => name);

//  export map: exportName -> absPath of the real source file 

const buildExportMap = () => {
  const indexText = read(join(LIB_DIR, 'index.js'));
  const map = new Map();

  // Named re-exports (covers everything including the giant element line)
  parseNamedReexports(indexText).forEach(([name, from]) =>
    map.set(name, resolve(LIB_DIR, from))
  );

  // Star re-exports: expand by reading the target file for its own exports
  parseStarReexports(indexText).forEach(starFrom => {
    const targetAbs  = resolve(LIB_DIR, starFrom);
    const targetText = read(targetAbs);
    parseTopLevelExports(targetText).forEach(name =>
      map.set(name, targetAbs)
    );
    // also handle any named re-exports inside the target (e.g. elements.js)
    parseNamedReexports(targetText).forEach(([name, from]) =>
      map.set(name, resolve(dirname(targetAbs), from))
    );
  });

  return map;
};

//  path helpers 

// Relative import path from importerDir to an absolute target path, always ./…
const relImport = importerDir => absTarget => {
  const r = relative(importerDir, absTarget).replaceAll('\\', '/');
  return r.startsWith('.') ? r : `./${r}`;
};

//  import rewriting 

const isBarrelImport = from => from.includes('../src/index.js');

// Multi-line import block regex: captures { … } and the 'from' path
const IMPORT_RE = /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm;

// Group [[name, absPath], …] by absPath → Map<absPath, name[]>
const groupByPath = pairs =>
  pairs.reduce((acc, [name, abs]) => {
    const prev = acc.get(abs) ?? [];
    return new Map([...acc, [abs, [...prev, name]]]);
  }, new Map());

// Build the replacement import lines for a set of name→absPath pairs
const buildLines = importerDir => pairs =>
  [...groupByPath(pairs).entries()]
    .map(([abs, names]) =>
      `import { ${names.join(', ')} } from '${relImport(importerDir)(abs)}';`
    )
    .join('\n');

// Rewrite one file; returns { path, original, rewritten } or null if unchanged
const processFile = exportMap => filePath => {
  const text     = read(filePath);
  const dir      = dirname(filePath);
  let   changed  = false;
  const warnings = [];

  const rewritten = text.replace(IMPORT_RE, (match, rawNames, from) => {
    if (!isBarrelImport(from)) return match;

    const names = rawNames.split(',').map(n => n.trim()).filter(Boolean);

    const unknown = names.filter(n => !exportMap.has(n));
    if (unknown.length)
      warnings.push(`!  unknown export(s): ${unknown.join(', ')}`);

    const pairs = names.flatMap(n =>
      exportMap.has(n) ? [[n, exportMap.get(n)]] : []
    );

    if (!pairs.length) return match;
    changed = true;
    return buildLines(dir)(pairs);
  });

  warnings.forEach(w => console.warn(w));
  return changed ? { path: filePath, original: text, rewritten } : null;
};

//  file walking 

const walkJs = dir =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory()
      ? walkJs(join(dir, e.name))
      : e.name.endsWith('.js') ? [join(dir, e.name)] : []
  );

//  main 

const exportMap = buildExportMap();
const results   = walkJs(SRC_DIR).flatMap(f => {
  const r = processFile(exportMap)(f);
  return r ? [r] : [];
});

if (!results.length) {
  console.log('No barrel imports found - nothing to do.');
  process.exit(0);
}

results.forEach(({ path: f, rewritten }) => {
  const label = relative(ROOT, f);
  if (WRITE) {
    writeFileSync(f, rewritten, 'utf8');
    console.log(`ok  ${label}`);
  } else {
    console.log(`\n--------${label}-------- `);
    rewritten
      .split('\n')
      .filter(l => l.startsWith('import'))
      .forEach(l => console.log(`   ${l}`));
  }
});

if (!WRITE) {
  console.log('\n(dry-run) pass --write to apply changes.');
}
