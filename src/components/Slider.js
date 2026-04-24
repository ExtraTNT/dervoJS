import { div, input, label, span } from '../elements.js';

/**
 * Slider — range input with label, value display, and CSS custom-property fill.
 *
 * @param {Object}   opts
 * @param {string}   [opts.id]
 * @param {number}   [opts.min=0]
 * @param {number}   [opts.max=100]
 * @param {number}   [opts.step=1]
 * @param {number}   [opts.value=50]
 * @param {string}   [opts.label]          Label text above the track.
 * @param {boolean}  [opts.showValue=true] Show current value next to label.
 * @param {boolean}  [opts.disabled=false]
 * @param {function} [opts.onInput]        Receives the Event (e.target.value as string).
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   Slider({ id: 'vol', label: 'Volume', value: state.vol, onInput: e => setState({ vol: +e.target.value }) })
 */
const Slider = ({
  id,
  min = 0,
  max = 100,
  step = 1,
  value = 50,
  label: labelText,
  showValue = true,
  disabled = false,
  onInput,
  className = '',
  style = '',
} = {}) => {
  // Snap value to the nearest valid step (relative to min) so the CSS fill
  // always matches the thumb position, even when the initial state value is
  // not on the step grid.
  const snapped = Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
  const pct = `${((snapped - min) / (max - min)) * 100}%`;
  return div({ className: ['field', className].filter(Boolean).join(' '), style })([
    ...(labelText || showValue ? [
      div({ className: 'field-label-row' })([
        labelText ? label({ htmlFor: id, className: 'field-label' })([labelText]) : span({})([]),
        showValue ? span({ className: 'slider-value' })([String(snapped)]) : span({})([]),
      ]),
    ] : []),
    input({
      id,
      type: 'range',
      className: 'slider',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(snapped),
      disabled,
      style: `--slider-pct:${pct}`,
      oninput: onInput,
    })([]),
  ]);
};

export { Slider };
