import { div, input, label, span } from '../elements.js';

// 20 default swatches across the spectrum
const DEFAULT_SWATCHES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1e293b',
  '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#f0fdfa',
  '#eff6ff', '#f5f3ff', '#fdf2f8', '#f8fafc', '#ffffff',
];

/**
 * ColorPicker — hex input + native color wheel + swatch palette.
 *
 * @param {Object}    opts
 * @param {string}    [opts.id]
 * @param {string}    [opts.label]             Label text.
 * @param {string}    [opts.value='#000000']   Hex color string.
 * @param {string[]}  [opts.swatches]          Override default swatch row.
 * @param {boolean}   [opts.showHex=true]      Show the hex text input.
 * @param {boolean}   [opts.showWheel=true]    Show the native color wheel.
 * @param {function}  [opts.onChange]          Called with the hex string value.
 * @param {string}    [opts.className='']
 * @param {string}    [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   ColorPicker({
 *     label: 'Brand colour',
 *     value: state.color,
 *     onChange: v => setState({ color: v }),
 *   })
 */
const ColorPicker = ({
  id,
  label: labelText,
  value = '#000000',
  swatches = DEFAULT_SWATCHES,
  showHex = true,
  showWheel = true,
  onChange,
  className = '',
  style = '',
} = {}) => {
  const safe = value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  const emitChange = v => { if (onChange) onChange(v); };

  const onWheel = e => emitChange(e.target.value);
  const onHex = e => {
    const v = e.target.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) emitChange(v);
  };

  return div({ className: ['color-picker', className].filter(Boolean).join(' '), style })([
    ...(labelText ? [label({ htmlFor: id, className: 'field-label' })([labelText])] : []),

    // ── Swatch row ─────────────────────────────────────────────────────────
    div({ className: 'color-swatches' })(
      swatches.map(sw =>
        span({
          className: ['color-swatch', sw.toLowerCase() === safe.toLowerCase() && 'color-swatch-active'].filter(Boolean).join(' '),
          style: `background:${sw}`,
          title: sw,
          onclick: () => emitChange(sw),
          role: 'button',
          tabIndex: '0',
        })([])
      )
    ),

    // ── Wheel + hex row ────────────────────────────────────────────────────
    div({ className: 'color-picker-row' })([
      ...(showWheel ? [
        input({
          id,
          type: 'color',
          className: 'color-wheel',
          value: safe,
          oninput: onWheel,
          title: 'Open colour picker',
        })([]),
      ] : []),
      ...(showHex ? [
        input({
          type: 'text',
          className: 'color-hex-input',
          value: safe,
          maxLength: '7',
          placeholder: '#rrggbb',
          oninput: onHex,
          spellcheck: false,
        })([]),
      ] : []),
      span({
        className: 'color-preview',
        style: `background:${safe}`,
        title: safe,
      })([]),
    ]),
  ]);
};

export { ColorPicker, DEFAULT_SWATCHES };
