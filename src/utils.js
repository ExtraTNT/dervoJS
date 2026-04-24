/**
 * dervoJS — shared functional utilities
 *
 * These are thin helpers built on top of the odocosJS core that appear
 * repeatedly across the component library.
 */
import { toMaybe, fromMaybe } from '../lib/odocosjs/src/core.js';

/**
 * Build a CSS className string from a variadic list of values, ignoring
 * all falsy entries. Replaces the verbose `[...].filter(Boolean).join(' ')`
 * pattern used throughout every component.
 *
 * @param {...*} classes
 * @returns {string}
 *
 * @example
 *   cn('btn', variant && `btn-${variant}`, disabled && 'btn-disabled')
 *   // 'btn btn-primary'  (when variant='primary', disabled=false)
 */
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Fire an optional callback safely.
 *
 * `fire(fn)(value)` calls `fn(value)` when `fn` is a function, and does
 * nothing when `fn` is null / undefined. Eliminates the `fn && fn(value)`
 * guard scattered across every event handler.
 *
 * Built on `toMaybe` / `fromMaybe` from odocosJS so `null`, `undefined`,
 * and `NaN` all collapse to a no-op.
 *
 * @param {function|null|undefined} fn
 * @returns {function}  fn, or a no-op when fn is absent
 *
 * @example
 *   fire(onChange)(newValue);  // calls onChange(newValue) if defined
 *   fire(null)('x');           // no-op
 */
const fire = fn => fromMaybe(() => {})(toMaybe(fn));

export { cn, fire };
