import { div, input, p, span, button, table, tbody, td, th, thead, tr } from '../elements.js';
import { cn } from '../utils.js';

// ── Built-in filter HOFs ───────────────────────────────────────────────────

/**
 * filterAll — searches every column value for the query string (case-insensitive).
 * Use as the default `filterFn` for a free-text search across all columns.
 */
const filterAll = (row, q) => {
  if (!q) return true;
  const lq = String(q).toLowerCase();
  return Object.values(row).some(v => String(v ?? '').toLowerCase().includes(lq));
};

/**
 * filterBy(key) — HOF: returns a (row, q) => boolean that does case-insensitive
 * substring search on one column.
 *
 * @param {string} key
 * @returns {(row: object, q: string) => boolean}
 *
 * @example
 *   Table({ ..., filterFn: filterBy('lang'), filter: state.search })
 */
const filterBy = key => (row, q) => {
  if (!q) return true;
  return String(row[key] ?? '').toLowerCase().includes(String(q).toLowerCase());
};

/**
 * filterExact(key) — HOF: returns a (row, q) => boolean that tests strict equality.
 *
 * @param {string} key
 * @returns {(row: object, q: *) => boolean}
 */
const filterExact = key => (row, q) =>
  (q === null || q === undefined || q === '') ? true : row[key] === q;

// ── Built-in sort HOF ─────────────────────────────────────────────────────

/**
 * sortBy(key) — HOF: returns a (rowA, rowB) => number comparator for a column.
 * Numbers are compared numerically; everything else uses localeCompare.
 *
 * @param {string} key
 * @returns {(a: object, b: object) => number}
 *
 * @example
 *   // Explicit comparator on the column def:
 *   { key: 'year', label: 'Year', sortFn: sortBy('year') }
 *
 *   // Or just set sort: true — the table derives sortBy(key) internally:
 *   { key: 'year', label: 'Year', sort: true }
 */
const sortBy = key => (a, b) => {
  const av = a[key], bv = b[key];
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av ?? '').localeCompare(String(bv ?? ''));
};

// ── Data pipeline helpers (pure) ──────────────────────────────────────────

/**
 * Apply per-column filters to a row list.
 * Each column's filterFn defaults to filterBy(key) when not provided.
 */
const applyColumnFilters = (rows, columns, columnFilters) =>
  Object.entries(columnFilters || {}).reduce((acc, [key, val]) => {
    if (val === '' || val == null) return acc;
    const col = columns.find(c => c.key === key);
    const fn  = col?.filterFn || filterBy(key);
    return acc.filter(row => fn(row, val));
  }, rows);

/**
 * Apply a sort directive { key, dir } to a row list (non-mutating).
 * Flips the comparator for 'desc'.
 */
const applySort = (rows, columns, sort) => {
  if (!sort?.key) return rows;
  const col = columns.find(c => c.key === sort.key);
  if (!col) return rows;
  const cmp = col.sortFn || sortBy(sort.key);
  return [...rows].sort(sort.dir === 'desc' ? (a, b) => cmp(b, a) : cmp);
};

// ── Table component ───────────────────────────────────────────────────────

/**
 * Table — filterable, sortable data table.
 *
 * Column definition:
 *   { key, label, render?, sort?, sortFn?, filter?, filterFn? }
 *   - sort: true          enable sort with default sortBy(key) comparator
 *   - sortFn: (a,b)=>n    custom sort comparator (overrides sort: true)
 *   - filter: true        enable per-column filter input with filterBy(key)
 *   - filterFn:(row,q)=>bool  custom column filter (overrides filter: true)
 *
 * @example
 *   Table({
 *     columns: [
 *       { key: 'name', label: 'Name', sort: true, filter: true },
 *       { key: 'year', label: 'Year', sort: true },
 *     ],
 *     rows: data,
 *     sort: state.sort,
 *     onSort: (key, dir) => setState({ sort: { key, dir } }),
 *     columnFilters: state.colFilters,
 *     onColumnFilter: (key, val) =>
 *       setState(s => ({ colFilters: { ...s.colFilters, [key]: val } })),
 *     showColumnFilters: true,
 *   })
 */
const Table = ({
  columns           = [],
  rows              = [],
  caption,
  striped           = false,
  scroll            = true,
  maxHeight,
  // global filter
  filter            = '',
  filterFn          = filterAll,
  showFilter        = false,
  filterId          = 'table-filter-input',
  onFilterChange,
  // per-column filter
  columnFilters     = {},
  onColumnFilter    = null,
  showColumnFilters = false,
  // sort
  sort              = null,
  onSort            = null,
  // empty states
  empty     = p({ className: 'table-empty' })(['No data.']),
  noResults = p({ className: 'table-no-results' })(['No results match your filter.']),
} = {}) => {
  // ── Data pipeline: column filters → global filter → sort ──────────────
  const afterColFilter    = applyColumnFilters(rows, columns, columnFilters);
  const hasGlobal         = filter !== '' && filter != null;
  const afterGlobalFilter = hasGlobal
    ? afterColFilter.filter(row => filterFn(row, filter))
    : afterColFilter;
  const processed = applySort(afterGlobalFilter, columns, sort);

  // ── Sort helpers ───────────────────────────────────────────────────────
  const handleSort = key => {
    if (!onSort) return;
    onSort(key, sort?.key === key && sort.dir === 'asc' ? 'desc' : 'asc');
  };

  const sortIndicator = col => {
    if (!(col.sort || col.sortFn)) return null;
    if (sort?.key === col.key)
      return span({ className: 'table-sort-icon' })([sort.dir === 'asc' ? '↑' : '↓']);
    return span({ className: 'table-sort-icon table-sort-icon-idle' })(['⇅']);
  };

  // ── Header cell ────────────────────────────────────────────────────────
  const headerCell = col => {
    const sortable  = col.sort || col.sortFn;
    const indicator = sortIndicator(col);
    const inner = sortable
      ? button({
          className: cn('table-sort-btn', sort?.key === col.key && 'table-sort-btn-active'),
          onclick: () => handleSort(col.key),
          type: 'button',
        })([col.label, ...(indicator ? [indicator] : [])])
      : col.label;
    return th({ className: cn('table-th', sortable && 'table-th-sortable'), scope: 'col' })([inner]);
  };

  // ── Per-column filter inputs row ───────────────────────────────────────
  const hasColFilterInputs = showColumnFilters && columns.some(c => c.filter || c.filterFn);
  const colFilterRow = hasColFilterInputs
    ? tr({ className: 'table-col-filter-row' })(
        columns.map(col =>
          td({ className: 'table-col-filter-cell' })([
            (col.filter || col.filterFn)
              ? input({
                  className: 'input table-col-filter-input',
                  type: 'text',
                  placeholder: `${col.label}…`,
                  value: columnFilters[col.key] ?? '',
                  oninput: onColumnFilter
                    ? e => onColumnFilter(col.key, e.target.value)
                    : undefined,
                })([])
              : span({})([]),
          ])
        )
      )
    : null;

  // ── Layout ─────────────────────────────────────────────────────────────
  const wrapperStyle = [
    scroll    ? 'overflow-x:auto;' : '',
    maxHeight ? `max-height:${maxHeight}; overflow-y:auto;` : '',
  ].join(' ');

  const filterInput = showFilter
    ? div({ className: 'table-filter' })([
        input({
          id: filterId,
          className: 'input',
          type: 'text',
          value: filter,
          placeholder: 'Search…',
          style: 'max-width:320px',
          oninput: onFilterChange ? e => onFilterChange(e.target.value) : undefined,
        })([]),
      ])
    : null;

  const captionEl = caption
    ? div({ className: 'table-caption' })([caption])
    : null;

  const tableEl =
    rows.length === 0
      ? empty
      : processed.length === 0
        ? noResults
        : table({ className: 'table' })([
            thead({})([
              tr({})(columns.map(headerCell)),
              ...(colFilterRow ? [colFilterRow] : []),
            ]),
            tbody({})(
              processed.map((row, i) =>
                tr({ className: striped && i % 2 === 0 ? 'table-row-even' : '' })(
                  columns.map(col => {
                    const raw  = row[col.key];
                    const cell = col.render ? col.render(raw, row) : String(raw ?? '');
                    return td({ className: 'table-td' })([cell]);
                  })
                )
              )
            ),
          ]);

  return div({ className: 'table-wrapper', style: wrapperStyle })([
    ...(filterInput ? [filterInput] : []),
    tableEl,
    ...(captionEl   ? [captionEl]   : []),
  ]);
};

export { Table, filterAll, filterBy, filterExact, sortBy };
