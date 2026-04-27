import { div, Card, TextInput, Select, Table, filterAll, filterExact, sortBy } from '../../src/index.js';
import { setState, TABLE_ROWS, TABLE_COLS } from '../store.js';
import { doc } from '../components/doc.js';

export const tablePanel = state =>
  div({})([
    Card({ title: 'Filterable data table' })([
      TextInput({
        id: 'tableSearchInput',
        placeholder: 'Search all columns…',
        value: state.tableFilter,
        hint: 'Uses filterAll — searches every column value.',
        onInput: e => setState({ tableFilter: e.target.value }),
      }),

      div({ style: 'margin-top:12px' })([
        Table({
          columns: TABLE_COLS,
          rows: TABLE_ROWS,
          striped: true,
          scroll: true,
          filter: state.tableFilter,
          filterFn: filterAll,
          caption: 'Programming languages',
        }),
      ]),
      doc([`Table({
  columns: TABLE_COLS,  // [{ key, label, render? }]
  rows: TABLE_ROWS,     // plain objects, keys match column keys
  striped: true,
  scroll: true,
  filter: state.tableFilter,
  filterFn: filterAll,  // searches all column values (case-insensitive substring)
  caption: 'Programming languages',
})`]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Paradigm filter (filterBy key)' })([
        Select({
          id: 'paradigmSelect',
          label: 'Filter by paradigm',
          options: [
            { value: '', label: 'Show all' },
            { value: 'Multi',      label: 'Multi' },
            { value: 'Functional', label: 'Functional' },
          ],
          value: state.paradigmFilter || '',
          onChange: e => setState({ paradigmFilter: e.target.value }),
        }),

        div({ style: 'margin-top:12px' })([
          Table({
            columns: TABLE_COLS,
            rows: TABLE_ROWS,
            striped: true,
            scroll: true,
            filter: state.paradigmFilter || '',
            filterFn: filterExact('paradigm'),
          }),
        ]),
        doc([`// filterExact(key) — strict equality on one column
Table({
  filter: state.paradigmFilter,
  filterFn: filterExact('paradigm'),
  rows: TABLE_ROWS,
  columns: TABLE_COLS,
})

// filterBy(key) — substring match on one column
Table({ filter: q, filterFn: filterBy('lang'), ... })`]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Built-in search input + vertical scroll (maxHeight)' })([
        Table({
          columns: TABLE_COLS,
          rows: [...TABLE_ROWS, ...TABLE_ROWS],
          maxHeight: '220px',
          showFilter: true,
          filterId: 'builtinFilter',
          filter: state.builtinFilter || '',
          onFilterChange: v => setState({ builtinFilter: v }),
          filterFn: filterAll,
          caption: 'Scrollable — 14 rows, 220px height',
        }),
        doc([`// showFilter=true renders the search input inside the table header
Table({
  showFilter: true,
  filterId: 'builtinFilter',
  filter: state.builtinFilter,
  onFilterChange: v => setState({ builtinFilter: v }),
  filterFn: filterAll,
  maxHeight: '220px',  // enables vertical scroll with sticky header
  rows, columns,
})`]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Sortable + per-column filters' })([
        Table({
          columns: [
            { key: 'lang',     label: 'Language', sort: true, filter: true },
            { key: 'paradigm', label: 'Paradigm', sort: true, filter: true },
            { key: 'typed',    label: 'Type system', sort: true,
              render: TABLE_COLS.find(c => c.key === 'typed')?.render },
            { key: 'year',     label: 'Year', sort: true, sortFn: sortBy('year') },
          ],
          rows: TABLE_ROWS,
          striped: true,
          scroll: true,
          sort: state.tableSort,
          onSort: (key, dir) => setState({ tableSort: { key, dir } }),
          columnFilters: state.tableColFilters,
          onColumnFilter: (key, val) => setState(s => ({ tableColFilters: { ...s.tableColFilters, [key]: val } })),
          showColumnFilters: true,
          caption: 'Click a column header to sort · type in a column input to filter',
        }),
        doc([`Table({
  columns: [
    { key: 'lang',  label: 'Language', sort: true, filter: true },
    { key: 'year',  label: 'Year',     sort: true, sortFn: sortBy('year') },
  ],
  rows: TABLE_ROWS,
  sort: state.tableSort,
  onSort: (key, dir) => setState({ tableSort: { key, dir } }),
  columnFilters: state.tableColFilters,
  onColumnFilter: (key, val) => setState(s => ({ tableColFilters: { ...s.tableColFilters, [key]: val } })),
  showColumnFilters: true,
})`]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Empty state' })([
        Table({ columns: TABLE_COLS, rows: [] }),
      ]),
    ]),
  ]);
