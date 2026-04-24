/**
 * Serialize opts to a stable string key, replacing function values with a
 * sentinel so that inline arrow functions don't bust the cache every render.
 *
 * @param {*} v
 * @returns {string}
 */
const stableKey = v =>
  JSON.stringify(v, (_, val) => typeof val === 'function' ? '__fn__' : val);

/**
 * Curried memoization factory: `memoize(cap)(factory)`
 *
 * Wraps any `opts => result` factory so calls with identical opts (by
 * serialized value) return a cached result from a capped Map.
 *
 * @param {number}   [cap=500]  Max entries before the cache is cleared.
 * @returns {function}          factory => memoized-factory
 *
 * @example
 *   const memoize200 = memoize(200);
 *   const FastCard   = memoize200(Card);
 */
const memoize = (cap = 500) => factory => {
  const cache = new Map();
  return opts => {
    const key = stableKey(opts);
    if (!cache.has(key)) {
      if (cache.size >= cap) cache.clear();
      cache.set(key, factory(opts));
    }
    return cache.get(key);
  };
};

/**
 * Memoize a curried component factory (opts => children => vnode).
 * Pre-applies default cap of 500.
 *
 * @example
 *   const MemoButton = memoComponent(Button);
 *   MemoButton({ variant: 'primary' })(['Click me'])
 */
const memoComponent = memoize();

/**
 * Memoize a leaf component (opts => vnode).
 * Pre-applies default cap of 500.
 *
 * @example
 *   const MemoSelect = memoLeaf(Select);
 *   MemoSelect({ options: COLOR_OPTIONS, value: 'red' })
 */
const memoLeaf = memoize();

export { memoComponent, memoLeaf, memoize, stableKey };
