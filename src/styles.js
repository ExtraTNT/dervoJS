/**
 * dervoJS — theme & style system
 *
 * Usage:
 *   import { initStyles } from './styles.js';
 *   initStyles();                          // defaults, injects <link> to dervo.css
 *   initStyles({ theme: 'dark' });         // start in dark mode
 *   initStyles({ colors: { accent: '#e11d48', 'accent-hover': '#be123c' } });
 *   initStyles({ fonts: { sans: 'Inter, sans-serif' } });
 *
 * Token reference:
 *   import { tokens } from './styles.js'; // → { light: {...}, dark: {...} }
 *
 * At runtime, every token is a CSS custom property: var(--accent), var(--danger), …
 * Override any token by mutating :root CSS variables via setTokens():
 *   setTokens({ accent: '#e11d48', 'accent-hover': '#be123c' });
 */

// ── Default token values ──────────────────────────────────────────────────
// These match the :root and [data-theme='dark'] blocks in dervo.css.
// They are the source of truth for the JS side; the CSS file mirrors them.
export const tokens = {
  light: {
    bg:             '#f5f5f7',
    surface:        '#ffffff',
    'surface-2':    '#f9fafb',
    border:         '#d1d5db',
    'border-2':     '#f3f4f6',
    text:           '#1a1a1a',
    'text-muted':   '#6b7280',
    'text-subtle':  '#9ca3af',
    accent:         '#4f46e5',
    'accent-hover': '#4338ca',
    'accent-ring':  'rgba(79,70,229,.18)',
    'shadow-sm':    '0 1px 4px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)',
    radius:         '6px',
    'radius-lg':    '10px',
    danger:         '#dc2626',
    'danger-bg':    '#fef2f2',
    'danger-border':'#ef4444',
    'danger-text':  '#991b1b',
    success:        '#16a34a',
    'success-bg':   '#f0fdf4',
    'success-border':'#22c55e',
    'success-text': '#15803d',
    warning:        '#f59e0b',
    'warning-bg':   '#fffbeb',
    'warning-border':'#f59e0b',
    'warning-text': '#92400e',
    info:           '#3b82f6',
    'info-bg':      '#eff6ff',
    'info-border':  '#3b82f6',
    'info-text':    '#1e40af',
    'badge-blue-bg':   '#dbeafe', 'badge-blue-text':   '#1d4ed8',
    'badge-green-bg':  '#dcfce7', 'badge-green-text':  '#15803d',
    'badge-red-bg':    '#fee2e2', 'badge-red-text':    '#b91c1c',
    'badge-yellow-bg': '#fef9c3', 'badge-yellow-text': '#a16207',
    'badge-purple-bg': '#ede9fe', 'badge-purple-text': '#6d28d9',
    'hl-keyword':   '#cf222e',
    'hl-string':    '#0a7c4e',
    'hl-number':    '#0550ae',
    'hl-comment':   '#6e7781',
    'hl-type':      '#8250df',
    'font-sans':    "system-ui, -apple-system, sans-serif",
    'font-mono':    "ui-monospace, 'Cascadia Code', 'Fira Mono', monospace",
  },
  dark: {
    bg:             '#0d0d0f',
    surface:        '#18181b',
    'surface-2':    '#1f1f23',
    border:         '#2e2e35',
    'border-2':     '#27272a',
    text:           '#f4f4f5',
    'text-muted':   '#a1a1aa',
    'text-subtle':  '#71717a',
    accent:         '#818cf8',
    'accent-hover': '#a5b4fc',
    'accent-ring':  'rgba(129,140,248,.22)',
    'shadow-sm':    '0 1px 4px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.04)',
    'danger-bg':    '#4c1d24', 'danger-text':  '#fca5a5',
    'success-bg':   '#14532d', 'success-text': '#86efac',
    'warning-bg':   '#431407', 'warning-text': '#fde68a',
    'info-bg':      '#1e3a5f', 'info-text':    '#93c5fd',
    'badge-blue-bg':   '#1e3a5f', 'badge-blue-text':   '#93c5fd',
    'badge-green-bg':  '#14532d', 'badge-green-text':  '#86efac',
    'badge-red-bg':    '#4c1d24', 'badge-red-text':    '#fca5a5',
    'badge-yellow-bg': '#431407', 'badge-yellow-text': '#fde68a',
    'badge-purple-bg': '#2e1065', 'badge-purple-text': '#c4b5fd',
    'hl-keyword':   '#ff7b72',
    'hl-string':    '#7ee787',
    'hl-number':    '#79c0ff',
    'hl-comment':   '#8b949e',
    'hl-type':      '#d2a8ff',
  },
};

// ── Internal helpers ───────────────────────────────────────────────────────
const _toVars = obj =>
  Object.entries(obj).map(([k, v]) => `  --${k}: ${v};`).join('\n');

const _injectOverrides = (id, selector, map) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = `${selector} {\n${_toVars(map)}\n}`;
};

// ── initStyles ─────────────────────────────────────────────────────────────
let _cssHref = new URL('./dervo.css', import.meta.url).href;

/**
 * Bootstrap the dervoJS style system. Call once before mounting.
 *
 * @param {object}  [opts]
 * @param {'light'|'dark'} [opts.theme='light']   Initial color scheme.
 * @param {object}  [opts.colors]  Partial token overrides applied to :root,
 *   e.g. { accent: '#e11d48', 'accent-hover': '#be123c' }
 * @param {object}  [opts.darkColors]  Overrides applied to [data-theme='dark'].
 * @param {object}  [opts.fonts]   Font overrides: { sans, mono }
 *   e.g. { sans: 'Inter, sans-serif' }
 * @param {string}  [opts.cssHref]  Custom URL to the CSS file if served from
 *   a different path (e.g. a CDN). Defaults to ./dervo.css relative to this
 *   module.
 * @param {boolean} [opts.noLink=false]  Skip injecting the <link> tag
 *   (e.g. when you import the CSS yourself via a bundler).
 */
const initStyles = (opts = {}) => {
  const {
    theme      = 'light',
    colors     = {},
    darkColors = {},
    fonts      = {},
    cssHref,
    noLink     = false,
  } = opts;

  // 1. Inject <link> stylesheet (idempotent)
  if (!noLink && !document.getElementById('dervo-css')) {
    const link = document.createElement('link');
    link.id   = 'dervo-css';
    link.rel  = 'stylesheet';
    link.href = cssHref || _cssHref;
    document.head.insertBefore(link, document.head.firstChild);
  }

  // 2. Apply initial theme
  document.documentElement.dataset.theme = theme;

  // 3. Font overrides → merge into :root block
  const fontMap = {};
  if (fonts.sans) fontMap['font-sans'] = fonts.sans;
  if (fonts.mono) fontMap['font-mono'] = fonts.mono;

  // 4. :root overrides (colors + fonts)
  const rootOverrides = { ...fontMap, ...colors };
  if (Object.keys(rootOverrides).length > 0)
    _injectOverrides('dervo-theme-light', ':root', rootOverrides);

  // 5. [data-theme='dark'] overrides
  if (Object.keys(darkColors).length > 0)
    _injectOverrides('dervo-theme-dark', "[data-theme='dark']", darkColors);
};

// ── Runtime token mutation ─────────────────────────────────────────────────
/**
 * Apply CSS variable overrides to :root at runtime.
 * Useful for live theme pickers.
 *
 * @param {object} colorMap  e.g. { accent: '#e11d48' }
 * @param {'light'|'dark'|'both'} [target='both']  Which theme selector to update.
 */
const setTokens = (colorMap, target = 'both') => {
  const root = document.documentElement;
  Object.entries(colorMap).forEach(([k, v]) => {
    root.style.setProperty(`--${k}`, v);
  });
};

/**
 * Remove inline CSS variable overrides from :root, restoring the values
 * defined in the stylesheet.
 *
 * @param {string[]} [keys]  Specific token keys to reset (without '--').
 *   Omit to reset every key in tokens.light.
 */
const resetTokens = (keys) => {
  const root = document.documentElement;
  (keys || Object.keys(tokens.light)).forEach(k =>
    root.style.removeProperty(`--${k}`)
  );
};

// ── Theme helpers ──────────────────────────────────────────────────────────
/**
 * Toggle between light and dark theme on <html data-theme>.
 * Returns the new theme string ('light' | 'dark').
 */
const toggleTheme = () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  return next;
};

/**
 * Set the theme explicitly.
 * @param {'light'|'dark'} theme
 */
const setTheme = theme => {
  document.documentElement.dataset.theme = theme;
};

// ── Legacy in-JS inject (kept for backwards compat) ───────────────────────
/**
 * @deprecated  Use initStyles() instead. This function still works but
 *              embeds the CSS as a <style> tag rather than a <link>.
 */
const injectStyles = () => initStyles({ noLink: false });

export { initStyles, injectStyles, toggleTheme, setTheme, setTokens, resetTokens };
