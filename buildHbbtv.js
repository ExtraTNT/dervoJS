/**
 * Build a standalone hbbtv demo bundle.
 *
 *   node buildHbbtv.js [outDir] [--bundle] [--es5 | --es3]
 *   // writes to <outDir> (default ./dist/hbbtvDemo)
 *
 * Output layout (default, no --bundle):
 *   <outDir>/src/            - demoHbbtv/ app code (main.js, router.js, store.js,
 *                               components/, pages/, index.html) - OPEN THIS
 *   <outDir>/lib/dervoJS/    - the dervoJS framework (repo's src/)
 *   <outDir>/lib/odocosjs/   - the odocosJS foundation library (repo's lib/odocosjs/)
 *
 * demoHbbtv normally reaches dervoJS via repo-root-relative `../src/` /
 * `../../src/` imports; once copied under <outDir>/src/, dervoJS lives at
 * <outDir>/lib/dervoJS/ instead - same `../` depth, different target folder.
 * dervoJS in turn reaches odocosjs via `../lib/odocosjs/`; once copied under
 * <outDir>/lib/dervoJS/, odocosjs is a direct sibling under the same lib/, so
 * that import collapses to `../odocosjs/` (same rewrite build.js already does
 * for the standalone framework release).
 *
 * --bundle: after the copy above, also runs webpack over <outDir>/src/main.js,
 * emitting a single, fully-optimized <outDir>/src/bundle.js (tree-shaken,
 * scope-hoisted, minified via terser - mangled names, multiple compress
 * passes, no source maps) and rewriting index.html to load it instead of the
 * raw ES module tree. The unbundled sources needed to PRODUCE that bundle
 * (lib/dervoJS/, lib/odocosjs/, and every demoHbbtv file besides index.html)
 * are then deleted - bundle.js is self-contained, so shipping them alongside
 * it would just be dead weight. Every CSS file that survives (custom.css,
 * dervoJS's own dervo.css) also gets unused selectors purged against the
 * final bundle text (dervo.css is a general-purpose library stylesheet -
 * ~350 selectors covering every component dervoJS ships, most of which any
 * one app never touches) and its comments stripped. The purge is
 * deliberately conservative: a class is kept if its exact name OR any
 * hyphen-truncated prefix of it (e.g. 'badge-blue' AND 'badge-') appears in
 * the bundle, because dervoJS's own components build variant classes via
 * template literals (`badge-${variant}` in Badge.js, `btn-${variant}` in
 * Button.js, …) - the bundle never contains those exact literal names, only
 * the static prefix. Selectors with no class component at all (:root,
 * [data-theme='dark'], bare element/attribute selectors) are always kept -
 * their "usage" can't be judged this way. Final bundled output is exactly:
 *   <outDir>/src/index.html, bundle.js, and whichever CSS files index.html
 *   actually references - nothing else.
 *
 * --es5 / --es3: implies --bundle. Runs Babel over every copied file BEFORE
 * webpack, down-compiling syntax (arrow fns, let/const, template literals,
 * destructuring, spread, classes, async/await, …) and polyfilling APIs
 * (Promise, Map, Set, WeakMap, Array.from, Object.assign, …) via core-js, so
 * the shipped bundle runs on the JS engine real HbbTV set-top boxes actually
 * have, not just modern evergreen browsers.
 *   --es5  ~ IE11-class engine: full ES5 (getters/setters, JSON,
 *            Object.defineProperty, Array.forEach/map/filter, Function.bind)
 *            natively; core-js fills in everything ES6+. This is what
 *            virtually every real HbbTV device from the last decade-plus
 *            actually runs - the safe, well-trodden default for "old TV".
 *   --es3  ~ IE6-class engine, i.e. true ES3 (1999): NO Object.defineProperty,
 *            no getters/setters, no JSON, no Array.forEach, no Function.bind
 *            at the engine level either - Babel/core-js fill in what they
 *            can. WeakMap in particular can only be approximated (no
 *            non-enumerable-property primitive exists in true ES3 to build a
 *            real one on), so it's a leakier, best-effort polyfill rather
 *            than a spec-correct one. Only reach for this if you genuinely
 *            have hardware that old; verify the result against real hardware
 *            if you can, this is thin, rarely-exercised territory.
 * None of Babel, core-js, webpack, terser, or postcss are dependencies of
 * this repo (no package.json, by design) - all are resolved at run time from
 * whatever install already exists on this machine (global npm install,
 * system package manager, …); each flag fails with a clear, actionable
 * error if its tools aren't found, rather than a raw MODULE_NOT_FOUND stack.
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, relative, extname, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Just, Nothing, fromMaybe } from './lib/odocosjs/src/core.js';

const ROOT     = fileURLToPath(new URL('.', import.meta.url));
const DEMO_DIR = join(ROOT, 'demoHbbtv');
const LIB_SRC  = join(ROOT, 'src');
const LIB_ODO  = join(ROOT, 'lib', 'odocosjs');

const OUT_DIR = resolve(
  process.cwd(),
  process.argv.find(
    a => !a.startsWith('-')
    && !a.endsWith('buildHbbtv.js')
    && a !== process.execPath
  )
  || './dist/hbbtvDemo'
);
const OUT_SRC      = join(OUT_DIR, 'src');
const OUT_DERVOJS  = join(OUT_DIR, 'lib', 'dervoJS');
const OUT_ODOCOSJS = join(OUT_DIR, 'lib', 'odocosjs');

const ES3 = process.argv.includes('--es3');
const ES5 = process.argv.includes('--es5');
if (ES3 && ES5) throw new Error('pick one of --es3 / --es5, not both.');
const TRANSPILE = ES3 || ES5;
const BUNDLE    = process.argv.includes('--bundle') || TRANSPILE;

const _JS_EXT     = new Set(['.js', '.mjs']);
const _REWRITE_EXT = new Set(['.js', '.mjs', '.html']);

// demoHbbtv .js/.mjs: 'from "../src/…"' / 'import("../../src/…")' (repo-root
// dervoJS) -> same dot-depth, 'lib/dervoJS/' instead.
const _DEMO_IMPORT = /(from\s*['"]|import\s*\(\s*['"])((?:\.\.\/)+)src\//g;
// demoHbbtv .html: the same repo-root reference, but as an href="…"/src="…"
// attribute (index.html's <link>/<script> tags) rather than an import.
const _DEMO_HTML_REF = /((?:href|src)=["'])((?:\.\.\/)+)src\//g;
const rewriteDemo = path => src =>
  extname(path) === '.html'
    ? src.replace(_DEMO_HTML_REF, (_, p, dots) => `${p}${dots}lib/dervoJS/`)
    : src.replace(_DEMO_IMPORT,   (_, p, dots) => `${p}${dots}lib/dervoJS/`);

// dervoJS files: '../lib/odocosjs/…' -> odocosjs is now a direct lib/ sibling.
const _LIB_IMPORT = /(from\s*['"]|import\s*\(\s*['"])((?:\.\.\/)+)lib\/odocosjs\//g;
const rewriteLib  = () => src => src.replace(_LIB_IMPORT, (_, p, dots) => `${p}${dots}odocosjs/`);

const maybeRewrite = rewrite => path => src => _REWRITE_EXT.has(extname(path)) ? Just(rewrite(path)(src)) : Nothing;
const transform    = rewrite => path => src => fromMaybe(src)(maybeRewrite(rewrite)(path)(src));

const walk = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => {
    const full = join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.isFile() ? [full] : [];
  }))).flat();
};

const ensureDir = file => mkdir(dirname(file), { recursive: true });

const removeEmptyDirs = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.filter(e => e.isDirectory()).map(e => removeEmptyDirs(join(dir, e.name))));
  const remaining = await readdir(dir);
  if (remaining.length === 0) await rm(dir, { recursive: true, force: true });
};

const copyTree = fromDir => toDir => rewrite =>
  walk(fromDir).then(files => Promise.all(files.map(srcAbs => {
    const dst = join(toDir, relative(fromDir, srcAbs));
    return readFile(srcAbs, 'utf8').then(src => {
      const next = transform(rewrite)(srcAbs)(src);
      return ensureDir(dst).then(() => writeFile(dst, next)).then(() => ({ changed: next !== src }));
    });
  })));

// --es5 / --es3: Babel + core-js transpile pass, in place
const _resolveBabel = () => {
  const require = createRequire(import.meta.url);
  try {
    return {
      transformSync: require('@babel/core').transformSync,
      presetEnv:     require('@babel/preset-env'),
      coreJsRoot:    dirname(dirname(require.resolve('core-js/package.json'))),
    };
  } catch (_) {
    throw new Error(
      '--es5/--es3 need @babel/core, @babel/preset-env, and core-js resolvable from this script ' +
      'but none are dependencies of this repo (no package.json, by design). ' +
      'Install them globally (or via your system package manager) and re-run.'
    );
  }
};

const _babelTargets = () => ({ ie: ES3 ? '6' : '11' });

const transpileTree = babel => dir =>
  walk(dir).then(files => Promise.all(
    files.filter(f => _JS_EXT.has(extname(f))).map(f =>
      readFile(f, 'utf8').then(src => {
        const out = babel.transformSync(src, {
          filename:   f,
          babelrc:    false,
          configFile: false,
          sourceType: 'module',
          compact:    false,   // webpack + terser do the real minification later
          presets: [[babel.presetEnv, {
            targets:     _babelTargets(),
            useBuiltIns: 'usage',
            corejs:      3,
            modules:     false,
          }]],
        });
        return writeFile(f, out.code);
      })
    )
  ));

const transpile = () => {
  const babel = _resolveBabel();
  return Promise.all([
    transpileTree(babel)(OUT_SRC),
    transpileTree(babel)(OUT_DERVOJS),
    transpileTree(babel)(OUT_ODOCOSJS),
  ]).then(() => ({ coreJsRoot: babel.coreJsRoot }));
};

// --bundle: webpack the transpiled/copied tree into one file
//
// Not a repo dependency - resolved at run time from whatever webpack (+
// terser-webpack-plugin) install is already on this machine. Throws a clear,
// actionable error if it can't be found, rather than a raw MODULE_NOT_FOUND
// stack.
const _resolveWebpackTools = () => {
  const require = createRequire(import.meta.url);
  try {
    return {
      webpackBin:  require.resolve('webpack/bin/webpack.js'),
      terserEntry: require.resolve('terser-webpack-plugin'),
    };
  } catch (_) {
    throw new Error(
      '--bundle shells out to webpack + terser-webpack-plugin, but neither is a dependency of ' +
      'this repo (no package.json, by design). Install them globally (or via your system package ' +
      'manager) and re-run with --bundle.'
    );
  }
};

const _runWebpack = configPath => webpackBin => new Promise((res, rej) => {
  const child = spawn(process.execPath, [webpackBin, '--config', configPath], { stdio: 'inherit' });
  child.on('error', rej);
  child.on('close', code => code === 0 ? res() : rej(new Error(`webpack exited with code ${code}`)));
});

// Fully-optimized production config
const _webpackConfig = ({ coreJsRoot, terserEntry }) => `module.exports = {
  entry: ${JSON.stringify(join(OUT_SRC, 'main.js'))},
  output: { path: ${JSON.stringify(OUT_SRC)}, filename: 'bundle.js' },
  mode: 'production',
  // 'web' + 'es5' together: 'es5' makes webpack's OWN generated glue code
  // (module wrapper, require runtime, …) avoid arrow functions / shorthand
  // methods / const-let too - Babel only transpiles OUR source, not
  // webpack's bundling machinery, so without this the bundle would still
  // contain ES6+ syntax no matter what --es5/--es3 did upstream.
  target: ${JSON.stringify(TRANSPILE ? ['web', 'es5'] : 'web')},
  devtool: false,
  ${coreJsRoot ? `resolve: { modules: ['node_modules', ${JSON.stringify(coreJsRoot)}] },` : ''}
  optimization: {
    minimize: true,
    usedExports: true,
    concatenateModules: true,
    minimizer: [
      new (require(${JSON.stringify(terserEntry)}))({
        terserOptions: {
          compress: { passes: 2 },
          mangle: true,
          format: { comments: false },
        },
        extractComments: false,
      }),
    ],
  },
  performance: { hints: false },
};
`;

// Swap the ES-module entry script tag for the bundled plain-script one.
const _pointIndexAtBundle = html => html.replace(
  /<script\s+type="module"\s+src="\.\/main\.js"\s*>\s*<\/script>/,
  '<script src="./bundle.js"></script>'
);

const bundle = ({ coreJsRoot } = {}) => {
  const { webpackBin, terserEntry } = _resolveWebpackTools();
  const configPath = join(tmpdir(), `hbbtv-webpack-${randomBytes(6).toString('hex')}.cjs`);
  const indexPath  = join(OUT_SRC, 'index.html');
  return writeFile(configPath, _webpackConfig({ coreJsRoot, terserEntry }))
    .then(() => _runWebpack(configPath)(webpackBin))
    .then(() => rm(configPath, { force: true }))
    .then(() => readFile(indexPath, 'utf8'))
    .then(html => {
      const next = _pointIndexAtBundle(html);
      if (next === html) {
        console.warn(`warning: could not find the expected <script type="module" src="./main.js"> tag in ${indexPath} - index.html left unchanged, wire up src/bundle.js manually.`);
        return;
      }
      return writeFile(indexPath, next);
    })
    .then(() => console.log(`bundled -> ${join(OUT_SRC, 'bundle.js')} (index.html now loads it directly)`));
};

// CSS has no nested comments and no string-embedded /* */ sequences to worry
// about, so a plain non-greedy block-comment strip is safe (unlike JS, where
// the same trick would break on strings/regex literals containing // or /*).
const stripCssComments = css => `${css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/[ \t]+$/gm, '')
  .replace(/\n{2,}/g, '\n')
  .trim()}\n`;

// ─── --bundle: purge unused CSS selectors against the final bundle ───────
//
// Not a repo dependency - resolved at run time the same way as webpack/babel.
const _resolvePostcss = () => {
  const require = createRequire(import.meta.url);
  try {
    return { postcss: require('postcss'), selectorParser: require('postcss-selector-parser') };
  } catch (_) {
    throw new Error(
      '--bundle CSS purging needs postcss + postcss-selector-parser resolvable from this script ' +
      'but neither is a dependency of this repo (no package.json, by design). ' +
      'Install them globally (or via your system package manager) and re-run.'
    );
  }
};

// Every hyphen-truncated prefix of a class token, each kept WITH its trailing
// hyphen, e.g. 'badge-blue' -> ['badge-blue', 'badge-']. dervoJS's own
// components build variant classes via template literals (`badge-${variant}`
// in Badge.js, `btn-${variant}` in Button.js, `clock-${size}` in Clock.js, …)
// - the compiled bundle never contains the literal FULL class name in that
// case, only the static prefix fragment plus a runtime value. Checking just
// the exact class name would wrongly purge every dynamically-built variant;
// checking each prefix too means "is ANY selector in this component family
// referenced" - safe (keeps a whole family together) at the cost of some
// purge precision (an unused single variant of an otherwise-used component
// survives). See buildHbbtv's own CSS-purge discussion for the trade-off.
const _classCandidates = cls => {
  const out = [cls];
  for (let i = cls.lastIndexOf('-'); i > 0; i = cls.lastIndexOf('-', i - 1)) out.push(cls.slice(0, i + 1));
  return out;
};

const _usedInContent = content => cls => _classCandidates(cls).some(c => content.includes(c));

// Every class token (no leading '.') in a single (non-comma) selector.
const _classesOf = selectorParser => selector => {
  const classes = [];
  selectorParser(sel => sel.walkClasses(c => classes.push(c.value))).processSync(selector);
  return classes;
};

const purgeCss = ({ postcss, selectorParser }) => content => css => {
  const root      = postcss.parse(css);
  const classesOf = _classesOf(selectorParser);
  const isUsed    = _usedInContent(content);

  root.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return;   // keyframe offsets ("from"/"50%"), not class selectors
    const alternatives = rule.selector.split(',').map(s => s.trim());
    const kept = alternatives.filter(alt => {
      const classes = classesOf(alt);
      return classes.length === 0 || classes.every(isUsed);
    });
    if (kept.length === 0) rule.remove();
    else if (kept.length !== alternatives.length) rule.selector = kept.join(', ');
  });

  root.walkAtRules(at => { if (at.name !== 'keyframes' && at.nodes && at.nodes.length === 0) at.remove(); });

  const usedAnimationNames = new Set();
  root.walkDecls(/^animation(-name)?$/, decl => {
    for (const word of decl.value.split(/[\s,]+/)) if (word) usedAnimationNames.add(word);
  });
  root.walkAtRules('keyframes', at => { if (!usedAnimationNames.has(at.params)) at.remove(); });

  return root.toString();
};

const _isUnderDir = dir => path => {
  const rel = relative(dir, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

// Local (same-origin, relative) href="…"/src="…" references in an HTML file -
// skips absolute URLs (http(s):, protocol-relative //, data:) since those
// aren't local files to preserve or relocate.
const _HTML_REF = /(?:href|src)=["']([^"']+)["']/g;
const _localHtmlRefs = html => [...html.matchAll(_HTML_REF)]
  .map(m => m[1])
  .filter(ref => !/^(?:[a-z][\w+.-]*:)?\/\//i.test(ref) && !ref.startsWith('data:'));


const cleanupUnbundled = () => {
  const indexPath = join(OUT_SRC, 'index.html');
  const libDir    = join(OUT_DIR, 'lib');
  return readFile(indexPath, 'utf8')
    .then(html => Promise.all(_localHtmlRefs(html).map(ref => {
      const abs = resolve(OUT_SRC, ref);
      if (!_isUnderDir(libDir)(abs)) return { absToKeep: abs, rewrite: null };
      const flatName = ref.split('/').pop();
      const dest      = join(OUT_SRC, flatName);
      return readFile(abs, 'utf8')
        .then(content => writeFile(dest, content))
        .then(() => ({ absToKeep: dest, rewrite: { from: ref, to: flatName } }));
    })).then(results => {
      const rewrites = results.filter(r => r.rewrite);
      const nextHtml = rewrites.reduce((h, { rewrite }) => h.split(rewrite.from).join(rewrite.to), html);
      const keep = new Set([indexPath, ...results.map(r => r.absToKeep)]);
      return writeFile(indexPath, nextHtml).then(() => keep);
    }))
    .then(keep => rm(libDir, { recursive: true, force: true }).then(() => keep))
    .then(keep => walk(OUT_SRC).then(files => Promise.all(
      files.filter(f => !keep.has(f)).map(f => rm(f, { force: true }))
    )))
    .then(() => removeEmptyDirs(OUT_SRC))
    .then(() => console.log('removed unbundled sources (lib/, demoHbbtv\'s individual src/ files, unreferenced webpack assets) - bundle.js is self-contained'))
    .then(() => {
      const postcssTools = _resolvePostcss();
      return readFile(join(OUT_SRC, 'bundle.js'), 'utf8').then(bundleJs =>
        walk(OUT_SRC).then(files => Promise.all(
          files.filter(f => extname(f) === '.css').map(f =>
            readFile(f, 'utf8')
              .then(css => purgeCss(postcssTools)(bundleJs)(css))
              .then(css => writeFile(f, stripCssComments(css)))
          )
        ))
      );
    })
    .then(() => console.log('purged unused CSS selectors against the final bundle'));
};

const build = () =>
  rm(OUT_DIR, { recursive: true, force: true })
    .then(() => Promise.all([
      copyTree(DEMO_DIR)(OUT_SRC)(rewriteDemo),
      copyTree(LIB_SRC)(OUT_DERVOJS)(rewriteLib),
      // odocosjs is self-contained (no imports escape its own tree) - copy verbatim.
      copyTree(LIB_ODO)(OUT_ODOCOSJS)(() => src => src),
    ]))
    .then(([demoRs, dervoRs, odoRs]) => {
      const total     = demoRs.length + dervoRs.length + odoRs.length;
      const rewrites  = [...demoRs, ...dervoRs].filter(r => r.changed).length;
      console.log(`${total} files -> ${OUT_DIR} (${rewrites} rewrites)`);
      console.log('  src/            <- demoHbbtv/');
      console.log('  lib/dervoJS/    <- src/');
      console.log('  lib/odocosjs/   <- lib/odocosjs/');
    })
    .then(() => TRANSPILE ? transpile() : {})
    .then(transpileResult => {
      if (TRANSPILE) console.log(`transpiled -> ${ES3 ? 'ES3 (ie 6 target)' : 'ES5 (ie 11 target)'} + core-js polyfills`);
      return BUNDLE ? bundle(transpileResult).then(cleanupUnbundled) : undefined;
    })
    .then(() => console.log(`Serve ${OUT_DIR} and open src/index.html`));

build().catch(e => { console.error(e); process.exit(1); });
