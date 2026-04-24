/**
 * Functional validation rules for forms and inputs.
 *
 * Each rule is a function: value => errorString | null
 *
 * Combine with `validate` to compose multiple rules into one:
 *   validate(required(), minLength(3), email())
 *   // returns the first error string, or null when all pass
 */

/**
 * Requires a non-empty, non-whitespace value.
 * @param {string} [msg]
 * @returns {function} rule
 */
const required = (msg = 'Required') =>
  v => (v !== null && v !== undefined && String(v).trim().length > 0) ? null : msg;

/**
 * Minimum string length.
 * @param {number} n
 * @param {string} [msg]
 * @returns {function} rule
 */
const minLength = (n, msg) =>
  v => (!v || String(v).length >= n) ? null : (msg ?? `Must be at least ${n} characters`);

/**
 * Maximum string length.
 * @param {number} n
 * @param {string} [msg]
 * @returns {function} rule
 */
const maxLength = (n, msg) =>
  v => (!v || String(v).length <= n) ? null : (msg ?? `Must be no more than ${n} characters`);

/**
 * Email format check.
 * @param {string} [msg]
 * @returns {function} rule
 */
const email = (msg = 'Must be a valid email address') =>
  v => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())) ? null : msg;

/**
 * IP address format check.
 * @param {string} [msg]
 * @returns {function} rule
 */
const ip = (msg = 'Must be a valid IP address') =>
  v => (!v || /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(String(v).trim())) ? null : msg;

/**
 * Regex pattern check.
 * @param {RegExp} re
 * @param {string} [msg]
 * @returns {function} rule
 */
const pattern = (re, msg = 'Invalid format') =>
  v => (!v || re.test(String(v))) ? null : msg;

/**
 * Numeric range check (inclusive).
 * @param {number} min
 * @param {number} max
 * @param {string} [msg]
 * @returns {function} rule
 */
const range = (min, max, msg) =>
  v => {
    const n = Number(v);
    return (v === '' || v === null || v === undefined || (n >= min && n <= max))
      ? null
      : (msg ?? `Must be between ${min} and ${max}`);
  };

/**
 * Compose multiple rules into one, returning the first error or null.
 *
 * Each rule can be:
 *   - A classic rule function: value => string | null
 *       validate(required(), minLength(2))
 *   - A plain predicate:       value => boolean
 *       validate(v => v.trim().length > 0)      // uses 'Invalid' as message
 *   - A predicate + message tuple: [value => boolean, errorMessage]
 *       validate([v => v.trim().length > 0, 'Cannot be blank'], [v => v.includes('@'), 'Bad email'])
 *
 * @param {...(function|Array)} rules
 * @returns {function} combined rule: value => string | null
 * @example
 *   const nameRule = validate(required(), minLength(2));
 *   nameRule('') // 'Required'
 *
 *   const emailRule = validate(
 *     [v => v.trim().length > 0, 'Required'],
 *     [v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'],
 *   );
 *   emailRule('bad') // 'Enter a valid email'
 */
const validate = (...rules) => value =>
  rules.reduce((err, rule) => {
    if (err !== null) return err;
    // Tuple style: [predicateFn, errorMessage?]
    if (Array.isArray(rule)) {
      const [pred, msg = 'Invalid'] = rule;
      return pred(value) ? null : msg;
    }
    const result = rule(value);
    // Plain boolean predicate
    if (typeof result === 'boolean') return result ? null : 'Invalid';
    // Classic rule returning string | null
    return result;
  }, null);

/**
 * Validate an entire form's values against a schema of composed rules.
 * Returns an object of the same keys, each mapped to an error string or null.
 *
 * @param {Object} schema - { fieldName: composedRuleFn, ... }
 * @returns {function} values => errors
 * @example
 *   const schema = {
 *     name:  validate(required(), minLength(2)),
 *     email: validate(required(), email()),
 *   };
 *   const errors = validateForm(schema)({ name: '', email: 'bad' });
 *   // { name: 'Required', email: 'Must be a valid email address' }
 */
const validateForm = schema => values =>
  Object.fromEntries(
    Object.entries(schema).map(([k, rule]) => [k, rule(values[k])])
  );

/**
 * Returns true when all values in an errors object are null.
 * @param {Object} errors
 * @returns {boolean}
 */
const isFormValid = errors =>
  Object.values(errors).every(e => e === null);

export { required, minLength, maxLength, email, pattern, range, validate, validateForm, isFormValid };
