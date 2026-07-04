/**
 * Tiny dev server. One Node process binds four ports; each redirects `/`
 * to its target subdir and serves the whole repo root for everything else
 * so the existing relative imports resolve naturally.
 *
 *   node server.js
 *
 *   4000 -> /demo/
 *   4001 -> /demoGame/
 *   4002 -> /demoHbbtv/
 *   4003 -> /gameEditor/
 *
 * Style: pure description-builders compose into a `{ status, headers,
 * body }` Response; one edge function (`apply`) performs the single side
 * effect of writing it to the HTTP response. Maybe / Either model the
 * places where things can fail.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Just, Nothing, bind, fromMaybe, Left, Right, either } from './lib/odocosjs/src/core.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const TARGETS = {
  4001: '/demo/',
  4002: '/demoGame/',
  4003: '/demoHbbtv/',
  4004: '/gameEditor/',
};

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript',
  '.mjs':   'application/javascript',
  '.css':   'text/css',
  '.json':  'application/json',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.ico':   'image/x-icon',
  '.mp3':   'audio/mpeg',
  '.wav':   'audio/wav',
  '.ogg':   'audio/ogg',
  '.mp4':   'video/mp4',
  '.webm':  'video/webm',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.txt':   'text/plain; charset=utf-8',
  '.md':    'text/plain; charset=utf-8',
};

const mimeFor = path => MIME[extname(path).toLowerCase()] || 'application/octet-stream';

// --- Response descriptions (pure) ---------------------------------------

const Response = status => headers => body => ({ status, headers, body });

const plain    = code => msg => Response(code)({ 'Content-Type': 'text/plain; charset=utf-8' })(msg);
const ok       = mime => body => Response(200)({ 'Content-Type': mime, 'Cache-Control': 'no-store' })(body);
const redirect = to => Response(302)({ Location: to })('');

const NotFound  = plain(404)('Not found');
const Forbidden = plain(403)('Forbidden');
const BadUrl    = plain(400)('Bad URL');
const Internal  = msg => plain(500)(`Server error: ${msg}`);

// --- URL -> filesystem path resolution (pure) ---------------------------

/**
 * Map a URL string to an absolute path under root.
 * Either<errorResponse, fsPath>.
 */
const resolveUrl = root => url => {
  const decoded = (() => { try { return Just(decodeURIComponent(url.split('?')[0])); } catch { return Nothing; } })();
  return fromMaybe(Left(BadUrl))(bind(decoded)(s => {
    const cleaned = normalize(s).replace(/^([./\\]+)+/, '/');
    const full    = join(root, cleaned);
    return Just(full.startsWith(root) ? Right(full) : Left(Forbidden));
  }));
};

// --- IO adapters: Promise<Maybe<...>> -----------------------------------

const statM = path => stat(path).then(Just).catch(() => Nothing);
const readM = path => readFile(path).then(Just).catch(() => Nothing);

// --- Routing (returns Promise<Response>) --------------------------------

const serveFile = path =>
  readM(path).then(maybeBody =>
    fromMaybe(NotFound)(bind(maybeBody)(body => Just(ok(mimeFor(path))(body)))));

// Recursive: directory entries delegate to the index.html under them.
// `.then` auto-flattens nested Promises so the helper still resolves to
// Promise<Response> even when the inner branch is async.
const route = url => path =>
  statM(path).then(maybeStat =>
    fromMaybe(Promise.resolve(NotFound))(bind(maybeStat)(s => Just(
        s.isFile()
      ? serveFile(path)
      : s.isDirectory()
      ? (url.endsWith('/')
          ? route(url + 'index.html')(join(path, 'index.html'))
          : Promise.resolve(redirect(url + '/')))
      : Promise.resolve(NotFound)
    ))));

const isBareRoot = url => url === '' || url === '/';

const handle = port => req =>
    isBareRoot(req.url)
  ? Promise.resolve(redirect(TARGETS[port]))
  : either(resolveUrl(ROOT)(req.url))
      (err  => Promise.resolve(err))
      (path => route(req.url)(path));

// --- Edge: apply a Response to the live res. The only side effect. ------

const apply = res => ({ status, headers, body }) => {
  res.writeHead(status, headers);
  res.end(body);
};

// --- Boot ---------------------------------------------------------------

const bindPort = ([port, target]) => {
  const p = Number(port);
  return createServer((req, res) =>
    handle(p)(req)
      .then(apply(res))
      .catch(e => apply(res)(Internal(e.message)))
  )
    .on('error', e => console.error(`[port ${p}]`, e.message))
    .listen(p, () => console.log(`http://localhost:${p}${target}`));
};

Object.entries(TARGETS).forEach(bindPort);
