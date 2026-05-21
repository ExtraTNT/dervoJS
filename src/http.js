/**
 * dervoJS — HTTP client
 *
 * A small curried HTTP client built on top of odocosJS's `httpUtils`. The
 * exported `defaultHttp` is the no-config client used by `CrudResource` when
 * the caller doesn't pass one. To add auth/headers/base URL, build your own
 * client with `createHttp(fetchImpl)` — anything that matches the same shape
 * works (the dervoJS code only knows the contract, not the implementation).
 *
 *   HttpClient = {
 *     get    : url => opts            => Promise<json>
 *     list   : url => opts            => Promise<[items, totalCount]>
 *     post   : url => payload => opts => Promise<json>
 *     put    : url => payload => opts => Promise<json>
 *     patch  : url => payload => opts => Promise<json>
 *     remove : url => payload => opts => Promise<json>
 *   }
 *
 * `list` is split from `get` because it also reads the `x-total-count`
 * response header so pagination Just Works against any backend that follows
 * the json-server convention.
 *
 * @example
 *   // Auth — wrap fetch and pass it to createHttp
 *   const authedFetch = (url, init = {}) => fetch(url, {
 *     ...init,
 *     headers: { ...init.headers, Authorization: `Bearer ${token}` },
 *   });
 *   const http = createHttp(authedFetch);
 *
 * @example
 *   // Fully custom client — implement the shape yourself
 *   const http = {
 *     get:    url => async opts => myApi.read(url, opts),
 *     list:   url => async opts => [await myApi.list(url, opts), 0],
 *     post:   url => body => async opts => myApi.create(url, body, opts),
 *     put:    url => body => async opts => myApi.replace(url, body, opts),
 *     patch:  url => body => async opts => myApi.update(url, body, opts),
 *     remove: url => body => async opts => myApi.remove(url, opts),
 *   };
 */

import { mapToQuery } from '../lib/odocosjs/src/httpUtils.js';

const _qs = opts => (opts && Object.keys(opts).length) ? mapToQuery(opts) : '';

const _parseBody = async response => {
  const text = await response.text();
  if (!text) return null;
  try        { return JSON.parse(text); }
  catch (_)  { return text; }
};

/**
 * Build an HttpClient from a fetch implementation.
 * `extraHeaders` is merged on every request — useful for static API keys.
 * For dynamic headers (e.g. rotating tokens), wrap `fetch` yourself.
 *
 * @param {typeof fetch} [fetchImpl=globalThis.fetch]
 * @param {Record<string,string>} [extraHeaders]
 * @returns {HttpClient}
 */
const createHttp = (fetchImpl = globalThis.fetch, extraHeaders = {}) => {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };

  const _send = method => url => async (body, opts) => {
    const init = { method, headers };
    if (body !== undefined && body !== null) init.body = JSON.stringify(body);
    const r = await fetchImpl(`${url}${_qs(opts)}`, init);
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${r.statusText}`);
    return _parseBody(r);
  };

  const get    = url => (opts = {}) => _send('GET')(url)(undefined, opts);
  const post   = url => body => (opts = {}) => _send('POST')(url)(body, opts);
  const put    = url => body => (opts = {}) => _send('PUT')(url)(body, opts);
  const patch  = url => body => (opts = {}) => _send('PATCH')(url)(body, opts);
  const remove = url => body => (opts = {}) => _send('DELETE')(url)(body, opts);

  const list = url => async (opts = {}) => {
    const r = await fetchImpl(`${url}${_qs(opts)}`, { method: 'GET', headers });
    if (!r.ok) throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`);
    const data  = await _parseBody(r);
    const hdr   = parseInt(r.headers.get('x-total-count') ?? '', 10);
    const total = Number.isFinite(hdr) ? hdr : (Array.isArray(data) ? data.length : 0);
    return [data, total];
  };

  return { get, list, post, put, patch, remove };
};

/** Bare-bones default — uses global fetch, JSON content type, no auth. */
const defaultHttp = createHttp();

export { createHttp, defaultHttp };
