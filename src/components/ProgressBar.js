import { div, span } from '../elements.js';

/**
 * ProgressBar — determinate or indeterminate progress indicator.
 *
 * @param {Object}   opts
 * @param {number}   [opts.value=0]              Current value (0–max).
 * @param {number}   [opts.max=100]
 * @param {'primary'|'success'|'warning'|'danger'} [opts.variant='primary']
 * @param {'sm'|'md'|'lg'} [opts.size='md']
 * @param {string}   [opts.label]                Label above the bar.
 * @param {boolean}  [opts.showValue=false]       Show percentage next to label.
 * @param {boolean}  [opts.indeterminate=false]   Animated indeterminate state.
 * @param {boolean}  [opts.striped=false]         Diagonal stripe pattern on the fill.
 * @param {boolean}  [opts.animated=false]        Animate the stripe pattern.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   ProgressBar({ value: 72, variant: 'success', label: 'Upload', showValue: true })
 *   ProgressBar({ indeterminate: true, variant: 'primary' })
 */
const ProgressBar = ({
  value = 0,
  max = 100,
  variant = 'primary',
  size = 'md',
  label: labelText,
  showValue = false,
  indeterminate = false,
  striped = false,
  animated = false,
  className = '',
  style = '',
} = {}) => {
  const pct = indeterminate ? 100 : Math.max(0, Math.min(100, (value / max) * 100));
  const barCls = [
    'progress-bar',
    `progress-bar-${variant}`,
    striped && 'progress-striped',
    animated && striped && 'progress-animated',
    indeterminate && 'progress-indeterminate',
  ].filter(Boolean).join(' ');
  const wrapCls = ['progress-outer', `progress-${size}`, className].filter(Boolean).join(' ');

  return div({ className: wrapCls, style })([
    ...(labelText || showValue ? [
      div({ className: 'progress-header' })([
        labelText ? span({ className: 'field-label' })([labelText]) : span({})([]),
        showValue && !indeterminate ? span({ className: 'progress-value' })([`${Math.round(pct)}%`]) : span({})([]),
      ]),
    ] : []),
    div({ className: 'progress-track' })([
      div({
        className: barCls,
        style: indeterminate ? '' : `width:${pct}%`,
        role: 'progressbar',
        'aria-valuenow': String(value),
        'aria-valuemin': '0',
        'aria-valuemax': String(max),
      })([]),
    ]),
  ]);
};

export { ProgressBar };
