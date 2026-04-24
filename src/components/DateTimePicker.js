import { div, input, button, label, span } from '../elements.js';
import { toMaybe } from '../../lib/odocosjs/src/core.js';
import { cn, fire } from '../utils.js';

// ── Date constants ─────────────────────────────────────────────────────────

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Pure date helpers ──────────────────────────────────────────────────────

/** Pad a number to 2 decimal digits */
const pad2 = n => String(n).padStart(2, '0');

/** Parse an ISO date string → { year, month(0-based), day } or null */
const parseDate = iso => {
  const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? { year: +m[1], month: +m[2] - 1, day: +m[3] } : null;
};

/** Extract { hour, minute } from an ISO datetime string, defaulting to 00:00 */
const parseTime = iso => {
  const m = iso ? String(iso).match(/T(\d{2}):(\d{2})/) : null;
  return m ? { hour: +m[1], minute: +m[2] } : { hour: 0, minute: 0 };
};

/** Format a date (+ optional time) object → ISO string */
const formatISO = ({ year, month, day, hour = 0, minute = 0 }, showTime) =>
  showTime
    ? `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`
    : `${year}-${pad2(month + 1)}-${pad2(day)}`;

/** Number of days in a given month/year */
const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/** Day-of-week (0=Sun) for the 1st of a month */
const firstDayOfWeek = (year, month) => new Date(year, month, 1).getDay();

/**
 * Curried: adjacentMonth(delta)(year)(month) → { year, month }
 * adjacentMonth(-1) = prevMonthOf,  adjacentMonth(+1) = nextMonthOf
 */
const adjacentMonth = delta => year => month => ({
  month: (month + delta + 12) % 12,
  year:  year + (month + delta < 0 ? -1 : month + delta > 11 ? 1 : 0),
});
const prevMonthOf = adjacentMonth(-1);
const nextMonthOf = adjacentMonth(+1);

/**
 * Compare two plain { year, month, day } objects.
 * Returns negative / 0 / positive (like Array.sort comparator).
 */
const cmpDate = a => b =>
  a.year !== b.year   ? a.year  - b.year
  : a.month !== b.month ? a.month - b.month
  : a.day   - b.day;

// ── Component ─────────────────────────────────────────────────────────────

/**
 * DateTimePicker — calendar grid with optional time selector.
 *
 * @param {Object}   opts
 * @param {string}   [opts.id]
 * @param {string}   [opts.label]           Label text above the picker.
 * @param {string}   [opts.value='']        ISO date string 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'.
 * @param {string}   [opts.viewYear]        Override display year  (YYYY).
 * @param {string}   [opts.viewMonth]       Override display month (0-11).
 * @param {boolean}  [opts.showTime=false]  Show hour/minute inputs below the grid.
 * @param {string}   [opts.min]             Minimum selectable ISO date.
 * @param {string}   [opts.max]             Maximum selectable ISO date.
 * @param {function} [opts.onChange]        Called with ISO string when a date is selected.
 * @param {function} [opts.onViewChange]    Called with { year, month } when nav arrows clicked.
 *                                          If omitted the picker manages its own internal view state
 *                                          via imperatively-mutated opts — works for standalone use.
 * @param {string}   [opts.className='']
 * @param {string}   [opts.style='']
 * @returns {vnode}
 *
 * @example
 *   DateTimePicker({
 *     value: state.date,
 *     viewYear: state.dpYear, viewMonth: state.dpMonth,
 *     showTime: true,
 *     onChange: v => setState({ date: v }),
 *     onViewChange: ({ year, month }) => setState({ dpYear: year, dpMonth: month }),
 *   })
 */
const DateTimePicker = ({
  id,
  label: labelText,
  value = '',
  viewYear,
  viewMonth,
  showTime = false,
  min,
  max,
  onChange,
  onViewChange,
  className = '',
  style = '',
} = {}) => {
  const today = new Date();
  const sel   = parseDate(value);
  const minD  = parseDate(min);
  const maxD  = parseDate(max);

  // Controlled viewYear/viewMonth take priority; fall back to selection, then today
  const vy = viewYear  != null ? +viewYear  : (sel?.year  ?? today.getFullYear());
  const vm = viewMonth != null ? +viewMonth : (sel?.month ?? today.getMonth());

  const { hour: selHour, minute: selMinute } = showTime ? parseTime(value) : { hour: 0, minute: 0 };

  // ── Navigation ────────────────────────────────────────────────────────────
  const prevMonth = () => fire(onViewChange)(prevMonthOf(vy)(vm));
  const nextMonth = () => fire(onViewChange)(nextMonthOf(vy)(vm));

  // ── Day predicates ────────────────────────────────────────────────────────
  const isDisabled = (year, month, day) => {
    const d = { year, month, day };
    return toMaybe(minD)(() => false)(m => cmpDate(d)(m) < 0)
        || toMaybe(maxD)(() => false)(m => cmpDate(d)(m) > 0);
  };

  const isToday = (year, month, day) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  const isSelected = (year, month, day) =>
    sel != null && year === sel.year && month === sel.month && day === sel.day;

  // ── Day selection ─────────────────────────────────────────────────────────
  const selectDay = (year, month, day) => {
    if (isDisabled(year, month, day)) return;
    fire(onChange)(formatISO({ year, month, day, hour: selHour, minute: selMinute }, showTime));
  };

  const onHourChange   = e => sel && fire(onChange)(formatISO({ ...sel, hour:   +e.target.value, minute: selMinute }, true));
  const onMinuteChange = e => sel && fire(onChange)(formatISO({ ...sel, minute: +e.target.value, hour:   selHour   }, true));

  // ── Calendar cells ────────────────────────────────────────────────────────
  const blanks = Array.from({ length: firstDayOfWeek(vy, vm) }, () =>
    div({ className: 'date-cell date-cell-blank' })([])
  );

  const dayCells = Array.from({ length: daysInMonth(vy, vm) }, (_, i) => {
    const d        = i + 1;
    const disabled = isDisabled(vy, vm, d);
    return div({
      className: cn(
        'date-cell',
        isToday(vy, vm, d)    && 'date-cell-today',
        isSelected(vy, vm, d) && 'date-cell-selected',
        disabled              && 'date-cell-disabled',
      ),
      onclick:         disabled ? null : () => selectDay(vy, vm, d),
      role:            'button',
      tabIndex:        disabled ? '-1' : '0',
      'aria-pressed':  String(!!isSelected(vy, vm, d)),
      'aria-disabled': String(disabled),
    })([String(d)]);
  });

  return div({ className: cn('date-picker', className), style })([
    ...(labelText ? [label({ htmlFor: id, className: 'field-label' })([labelText])] : []),

    // ── Month navigation ──────────────────────────────────────────────────
    div({ className: 'date-picker-header' })([
      button({ type: 'button', className: 'date-nav-btn', onclick: prevMonth, 'aria-label': 'Previous month' })(['‹']),
      span({ className: 'date-picker-title' })([`${MONTHS[vm]} ${vy}`]),
      button({ type: 'button', className: 'date-nav-btn', onclick: nextMonth, 'aria-label': 'Next month'     })(['›']),
    ]),

    // ── Day-of-week headers + day cells ──────────────────────────────────
    div({ className: 'date-grid' })(
      DAYS.map(d => div({ className: 'date-cell date-cell-dow' })([d])).concat(blanks, dayCells)
    ),

    // ── Time row ─────────────────────────────────────────────────────────
    ...(showTime ? [
      div({ className: 'date-picker-time' })([
        span({ className: 'date-picker-time-label' })(['Time']),
        input({ type: 'number', className: 'date-time-field', value: pad2(selHour),   min: '0', max: '23', oninput: onHourChange,   'aria-label': 'Hour'   })([]),
        span({ className: 'date-picker-time-sep' })([':']),
        input({ type: 'number', className: 'date-time-field', value: pad2(selMinute), min: '0', max: '59', oninput: onMinuteChange, 'aria-label': 'Minute' })([]),
      ]),
    ] : []),
  ]);
};

export { DateTimePicker };
