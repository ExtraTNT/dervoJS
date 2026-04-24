import { div, Card, TextInput, Stack, Table, p, span } from '../../src/index.js';
import { setState } from '../store.js';

const PROP_COLS = [
  { key: 'name',    label: 'Prop' },
  { key: 'type',    label: 'Type' },
  { key: 'default', label: 'Default' },
  { key: 'desc',    label: 'Description' },
];

const DOCS = [
  {
    name: 'Button',
    description: 'Clickable button. Curried: Button(opts)(children).',
    example: "Button({ variant: 'danger', size: 'sm', onClick: fn })(['Delete'])",
    props: [
      { name: 'variant',   type: 'string',   default: "'primary'",  desc: "primary | secondary | danger | success | ghost" },
      { name: 'size',      type: 'string',   default: "'md'",       desc: 'sm | md | lg' },
      { name: 'onClick',   type: 'function', default: '—',          desc: 'Click handler' },
      { name: 'disabled',  type: 'boolean',  default: 'false',      desc: 'Disables interaction' },
      { name: 'type',      type: 'string',   default: "'button'",   desc: 'HTML type (button / submit / reset)' },
      { name: 'className', type: 'string',   default: "''",         desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',   default: "''",         desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'TextInput',
    description: 'Labeled text input with hint and validation error.',
    example: "TextInput({ id: 'n', label: 'Name', value: s.name, error: s.errors.name, onInput: e => setState({ name: e.target.value }) })",
    props: [
      { name: 'id',          type: 'string',   default: '—',       desc: 'Links <label> to <input>' },
      { name: 'label',       type: 'string',   default: '—',       desc: 'Label text above input' },
      { name: 'value',       type: 'string',   default: "''",      desc: 'Controlled value' },
      { name: 'placeholder', type: 'string',   default: "''",      desc: '' },
      { name: 'type',        type: 'string',   default: "'text'",  desc: 'HTML input type' },
      { name: 'disabled',    type: 'boolean',  default: 'false',   desc: '' },
      { name: 'hint',        type: 'string',   default: '—',       desc: 'Helper text (hidden when error is set)' },
      { name: 'error',       type: 'string',   default: '—',       desc: 'Error message; also applies error styling' },
      { name: 'onInput',     type: 'function', default: '—',       desc: 'oninput handler (receives Event)' },
      { name: 'onChange',    type: 'function', default: '—',       desc: 'onchange handler (receives Event)' },
      { name: 'className',   type: 'string',   default: "''",      desc: 'Extra CSS class(es) on root element' },
      { name: 'style',       type: 'string',   default: "''",      desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Select',
    description: 'Styled dropdown with label and optional placeholder option.',
    example: "Select({ id: 'c', label: 'Color', options: [{value:'r',label:'Red'}], value: s.color, onChange: e => setState({color: e.target.value}) })",
    props: [
      { name: 'id',          type: 'string',   default: '—',     desc: '' },
      { name: 'label',       type: 'string',   default: '—',     desc: 'Label above the select' },
      { name: 'options',     type: 'Array',    default: '[]',    desc: 'Array of { value, label }' },
      { name: 'value',       type: 'string',   default: '—',     desc: 'Currently selected value' },
      { name: 'placeholder', type: 'string',   default: '—',     desc: 'Unselectable first option' },
      { name: 'disabled',    type: 'boolean',  default: 'false', desc: '' },
      { name: 'onChange',    type: 'function', default: '—',     desc: 'onchange handler' },
      { name: 'className',   type: 'string',   default: "''",    desc: 'Extra CSS class(es) on root element' },
      { name: 'style',       type: 'string',   default: "''",    desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Checkbox',
    description: 'Labeled checkbox. Curried: Checkbox(opts)(labelText).',
    example: "Checkbox({ id: 'ok', checked: s.ok, onChange: e => setState({ ok: e.target.checked }) })(['I agree'])",
    props: [
      { name: 'id',        type: 'string',   default: '—',     desc: 'Links label to input' },
      { name: 'checked',   type: 'boolean',  default: 'false', desc: 'Controlled checked state' },
      { name: 'disabled',  type: 'boolean',  default: 'false', desc: '' },
      { name: 'onChange',  type: 'function', default: '—',     desc: 'onchange handler' },
      { name: 'className', type: 'string',   default: "''",    desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',   default: "''",    desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Toggle',
    description: 'On/off switch. Accessible (role="switch", keyboard: Space/Enter). Curried.',
    example: "Toggle({ on: s.dark, onChange: e => setState({ dark: e.target.checked }) })(['Dark mode'])",
    props: [
      { name: 'on',        type: 'boolean',  default: 'false', desc: 'Controlled checked state' },
      { name: 'onChange',  type: 'function', default: '—',     desc: 'onchange handler (receives synthetic Event-like { target: { checked } })' },
      { name: 'disabled',  type: 'boolean',  default: 'false', desc: '' },
      { name: 'className', type: 'string',   default: "''",    desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',   default: "''",    desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Card',
    description: 'Bordered surface container with optional header title and footer. Curried.',
    example: "Card({ title: 'Stats', footer: [Badge({variant:'green'})(['OK'])] })([p({})(['Body'])])",
    props: [
      { name: 'title',     type: 'string',  default: '—', desc: 'Header title text' },
      { name: 'footer',    type: 'vnode[]', default: '—', desc: 'Footer content (array of vnodes)' },
      { name: 'className', type: 'string',  default: "''", desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',  default: "''", desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Badge',
    description: 'Small pill label for statuses, counts, and tags. Curried.',
    example: "Badge({ variant: 'green' })(['Active'])  Badge({ variant: 'red' })(['Error'])",
    props: [
      { name: 'variant',   type: 'string', default: "'gray'", desc: "blue | green | red | yellow | gray | purple" },
      { name: 'className', type: 'string', default: "''",     desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string', default: "''",     desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Alert',
    description: 'Coloured feedback banner with an optional icon prefix. Curried.',
    example: "Alert({ variant: 'warning' })(['Proceed with caution.'])",
    props: [
      { name: 'variant',   type: 'string',  default: "'info'", desc: "info | success | warning | error" },
      { name: 'showIcon',  type: 'boolean', default: 'true',   desc: 'Prefix with an emoji icon' },
      { name: 'className', type: 'string',  default: "''",     desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',  default: "''",     desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Tabs',
    description: 'Tab strip + panels. Only the active panel is rendered. Curried.',
    example: "Tabs({ tabs:[{id:'a',label:'A'}], activeTab: s.tab, onTabChange: id => setState({tab:id}) })([PanelA])",
    props: [
      { name: 'tabs',        type: 'Array',    default: '[]', desc: 'Array of { id, label }' },
      { name: 'activeTab',   type: 'string',   default: '—',  desc: 'id of the currently active tab' },
      { name: 'onTabChange', type: 'function', default: '—',  desc: 'Called with tab id on click' },
      { name: '(children)',  type: 'vnode[]',  default: '—',  desc: 'Panel vnodes; index i matches tabs[i]' },
      { name: 'className',   type: 'string',   default: "''", desc: 'Extra CSS class(es) on root element' },
      { name: 'style',       type: 'string',   default: "''", desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Table',
    description: 'Filterable, sortable data table with sticky headers and horizontal/vertical scroll. ' +
      'Column defs accept sort/filter flags or custom HOF comparators; data flows through a pure pipeline: ' +
      'column filters → global filter → sort.',
    example:
      "// Sortable + per-column filterable columns:\n" +
      "Table({\n" +
      "  columns: [\n" +
      "    { key: 'name', label: 'Name', sort: true, filter: true },\n" +
      "    { key: 'year', label: 'Year', sort: true, sortFn: sortBy('year') },\n" +
      "    { key: 'stars', label: 'Stars', sort: true,\n" +
      "      sortFn: (a, b) => b.stars - a.stars }, // custom desc-first\n" +
      "  ],\n" +
      "  rows: data,\n" +
      "  sort: state.sort,\n" +
      "  onSort: (key, dir) => setState({ sort: { key, dir } }),\n" +
      "  columnFilters: state.colFilters,\n" +
      "  onColumnFilter: (key, val) =>\n" +
      "    setState(s => ({ colFilters: { ...s.colFilters, [key]: val } })),\n" +
      "  showColumnFilters: true,\n" +
      "  filter: state.search, filterFn: filterAll, // global filter still works\n" +
      "})",
    props: [
      { name: 'columns',           type: 'Array',    default: '[]',         desc: '{ key, label, render?, sort?, sortFn?, filter?, filterFn? }' },
      { name: '  ↳ sort',          type: 'boolean',  default: 'false',      desc: 'Enable click-to-sort using sortBy(key) as comparator' },
      { name: '  ↳ sortFn',        type: '(a,b)=>n', default: '—',          desc: 'Custom comparator — overrides sort: true. HOF: sortBy(key) or bespoke fn' },
      { name: '  ↳ filter',        type: 'boolean',  default: 'false',      desc: 'Enable per-column filter input using filterBy(key)' },
      { name: '  ↳ filterFn',      type: '(r,q)=>b', default: '—',          desc: 'Custom column filter — overrides filter: true. HOF: filterBy / filterExact' },
      { name: '  ↳ render',        type: 'function', default: '—',          desc: '(value, row) => vnode|string — custom cell renderer' },
      { name: 'rows',              type: 'Array',    default: '[]',         desc: 'Data row objects' },
      { name: 'sort',              type: '{key,dir}',default: 'null',       desc: "Controlled sort state. dir: 'asc' | 'desc'" },
      { name: 'onSort',            type: 'function', default: '—',          desc: '(key, dir) => void — called on header click; dir toggles asc↔desc' },
      { name: 'columnFilters',     type: 'object',   default: '{}',         desc: '{ [colKey]: value } — controlled per-column filter values' },
      { name: 'onColumnFilter',    type: 'function', default: '—',          desc: '(key, value) => void — called when a column input changes' },
      { name: 'showColumnFilters', type: 'boolean',  default: 'false',      desc: 'Render per-column filter <input> sub-row in thead' },
      { name: 'filter',            type: 'any',      default: "''",         desc: 'Global filter value — applied after column filters' },
      { name: 'filterFn',          type: 'function', default: 'filterAll',  desc: '(row, filterValue) => boolean — global filter predicate' },
      { name: 'showFilter',        type: 'boolean',  default: 'false',      desc: 'Render built-in global search input above table' },
      { name: 'onFilterChange',    type: 'function', default: '—',          desc: 'Built-in input oninput value callback' },
      { name: 'filterId',          type: 'string',   default: "'table-filter-input'", desc: 'id for the built-in input' },
      { name: 'caption',           type: 'string',   default: '—',          desc: 'Caption rendered below the table' },
      { name: 'striped',           type: 'boolean',  default: 'false',      desc: 'Alternate row background' },
      { name: 'scroll',            type: 'boolean',  default: 'true',       desc: 'Horizontal overflow scroll wrapper' },
      { name: 'maxHeight',         type: 'string',   default: '—',          desc: 'CSS value for vertical scroll (e.g. "220px")' },
      { name: 'empty',             type: 'vnode',    default: '"No data."', desc: 'Shown when rows is empty' },
      { name: 'noResults',         type: 'vnode',    default: '"No results."', desc: 'Shown when all filters match nothing' },
    ],
  },
  {
    name: 'filterAll / filterBy / filterExact / sortBy',
    description:
      'Higher-order filter and sort functions exported from Table.js. ' +
      'Each returns a (row, q) => boolean or (a, b) => number comparator. ' +
      'Pass the result as filterFn / sortFn, or use them standalone.',
    example:
      "import { filterAll, filterBy, filterExact, sortBy } from 'dervojs';\n\n" +
      "// filterAll — searches every column\n" +
      "filterAll(row, 'rust')           // true if any value contains 'rust'\n\n" +
      "// filterBy(key) — column substring match\n" +
      "const byLang = filterBy('lang'); // (row, q) => boolean\n" +
      "byLang(row, 'has')               // true for 'Haskell'\n\n" +
      "// filterExact(key) — strict equality\n" +
      "filterExact('paradigm')(row, 'Functional')\n\n" +
      "// sortBy(key) — numeric or locale comparator\n" +
      "const byYear = sortBy('year');   // (a, b) => number\n" +
      "[...rows].sort(byYear)           // ascending\n" +
      "[...rows].sort((a,b) => byYear(b,a)) // descending",
    props: [
      { name: 'filterAll',   type: '(row,q)=>bool',  default: '—', desc: 'Searches all column values (case-insensitive substring)' },
      { name: 'filterBy',    type: 'key=>(row,q)=>bool', default: '—', desc: 'HOF — substring match on one column' },
      { name: 'filterExact', type: 'key=>(row,q)=>bool', default: '—', desc: 'HOF — strict equality on one column' },
      { name: 'sortBy',      type: 'key=>(a,b)=>n',  default: '—', desc: 'HOF — numeric for numbers, localeCompare for strings' },
    ],
  },
  {
    name: 'List',
    description: 'Maps an array through a render function; shows an empty state when empty.',
    example: "List({ items: users, renderItem: (u, i) => li({})([`${i+1}. ${u.name}`]) })",
    props: [
      { name: 'items',      type: 'Array',    default: '[]',         desc: 'Data array' },
      { name: 'renderItem', type: 'function', default: '—',          desc: '(item, index) => vnode' },
      { name: 'empty',      type: 'vnode',    default: '"No items."', desc: 'Shown when items is empty' },
      { name: 'className',  type: 'string',   default: "''",         desc: 'Extra CSS class(es) on root element' },
      { name: 'style',      type: 'string',   default: "''",         desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Modal',
    description: 'Full-screen overlay dialog. Renders nothing when open is false. Curried.',
    example: "Modal({ open: s.show, title: 'Confirm', onClose: () => setState({show:false}), footer: [CancelBtn, ConfirmBtn] })([body])",
    props: [
      { name: 'open',      type: 'boolean',  default: 'false', desc: 'Controls visibility' },
      { name: 'title',     type: 'string',   default: '—',     desc: 'Modal heading' },
      { name: 'onClose',   type: 'function', default: '—',     desc: 'Called on × click or backdrop click' },
      { name: 'footer',    type: 'vnode[]',  default: '—',     desc: 'Footer (usually action buttons)' },
      { name: 'className', type: 'string',   default: "''",    desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',   default: "''",    desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'Clock',
    description: 'Stateless time display. Pair with createInterval to drive re-renders.',
    example: "Clock({ time: s.elapsed, size: 'lg', label: 'elapsed', running: s.running })",
    props: [
      { name: 'time',      type: 'number',  default: '0',     desc: 'Seconds to display (may be negative)' },
      { name: 'label',     type: 'string',  default: '—',     desc: 'Caption below the digits' },
      { name: 'size',      type: 'string',  default: "'md'",  desc: 'sm (28px) | md (48px) | lg (72px)' },
      { name: 'running',   type: 'boolean', default: 'false', desc: 'Highlights digits in accent colour' },
      { name: 'className', type: 'string',  default: "''",    desc: 'Extra CSS class(es) on root element' },
      { name: 'style',     type: 'string',  default: "''",    desc: 'Extra inline CSS on root element' },
    ],
  },
  {
    name: 'createInterval',
    description: 'Background ticker decoupled from state. Returns a start/stop controller.',
    example: "const t = createInterval(() => setState(s => ({n: s.n+1})), { ms: 1000 }); t.start();",
    props: [
      { name: 'fn',             type: 'function', default: '—',      desc: 'Callback on each tick' },
      { name: 'opts.ms',        type: 'number',   default: '1000',   desc: 'Milliseconds between ticks' },
      { name: 'opts.autoStart', type: 'boolean',  default: 'false',  desc: 'Start immediately on creation' },
      { name: '→ .start()',     type: 'function', default: '—',      desc: 'Begin ticking (no-op if already running)' },
      { name: '→ .stop()',      type: 'function', default: '—',      desc: 'Pause ticking (no-op if already stopped)' },
      { name: '→ .restart()',   type: 'function', default: '—',      desc: 'stop() then start()' },
      { name: '→ .toggle()',    type: 'function', default: '—',      desc: 'Flip the running state' },
      { name: '→ .isRunning()', type: 'function', default: '—',      desc: 'Returns boolean' },
    ],
  },
  {
    name: 'PageLayout',
    description: 'Full-viewport shell. Sticky top/bottom bars, CSS-animated side panels, scrollable main.',
    example: "PageLayout({ topBar: TopBar(s), sidebar: Nav(s), sidebarOpen: s.open, footer: Footer() })([Content(s)])",
    props: [
      { name: 'topBar',        type: 'vnode',   default: 'null',    desc: 'Sticky top bar' },
      { name: 'sidebar',       type: 'vnode',   default: 'null',    desc: 'Left sidebar content' },
      { name: 'sidebarOpen',   type: 'boolean', default: 'true',    desc: 'Toggle left sidebar (width transition)' },
      { name: 'sidebarWidth',  type: 'string',  default: "'240px'", desc: 'Left sidebar width' },
      { name: 'rightBar',      type: 'vnode',   default: 'null',    desc: 'Right panel content' },
      { name: 'rightBarOpen',  type: 'boolean', default: 'true',    desc: 'Toggle right panel' },
      { name: 'rightBarWidth', type: 'string',  default: "'260px'", desc: 'Right panel width' },
      { name: 'footer',        type: 'vnode',   default: 'null',    desc: 'Non-sticky footer inside scroll area' },
      { name: 'bottomBar',     type: 'vnode',   default: 'null',    desc: 'Sticky bottom bar' },
      { name: 'mainPadding',   type: 'string',  default: "'24px'",  desc: 'Main content area padding' },
    ],
  },
  {
    name: 'AppShell / TwoPane / BlogLayout',
    description: 'Preset wrappers around PageLayout for common patterns.',
    example: "AppShell({ topBar, sidebar, sidebarOpen })(main)\nTwoPane({ left: FileTree, leftOpen: s.open })(Editor)\nBlogLayout({ header, footer, maxWidth:'720px' })(article)",
    props: [
      { name: 'AppShell.topBar',       type: 'vnode',   default: '—',       desc: 'Sticky top bar' },
      { name: 'AppShell.sidebar',      type: 'vnode',   default: '—',       desc: 'Left sidebar' },
      { name: 'AppShell.sidebarOpen',  type: 'boolean', default: 'true',    desc: 'Toggle sidebar' },
      { name: 'AppShell.sidebarWidth', type: 'string',  default: "'220px'", desc: '' },
      { name: 'AppShell.footer',       type: 'vnode',   default: '—',       desc: 'Non-sticky footer' },
      { name: 'TwoPane.left',          type: 'vnode',   default: '—',       desc: 'Left pane content' },
      { name: 'TwoPane.leftOpen',      type: 'boolean', default: 'true',    desc: '' },
      { name: 'TwoPane.leftWidth',     type: 'string',  default: "'360px'", desc: '' },
      { name: 'BlogLayout.header',     type: 'vnode',   default: '—',       desc: 'Full-width header' },
      { name: 'BlogLayout.footer',     type: 'vnode',   default: '—',       desc: 'Non-sticky footer' },
      { name: 'BlogLayout.maxWidth',   type: 'string',  default: "'680px'", desc: 'Content column width' },
    ],
  },
  {
    name: 'Container',
    description: 'Centered max-width wrapper with optional styled surface card.',
    example: "Container({ maxWidth: 'md', styled: true })([content])",
    props: [
      { name: 'maxWidth', type: 'string|number', default: "'lg'",  desc: "sm(640) | md(768) | lg(1024) | xl(1280) | full | number px" },
      { name: 'styled',   type: 'boolean',       default: 'false', desc: 'Adds surface background, border, shadow' },
      { name: 'style',    type: 'string',        default: "''",    desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Row / Col',
    description: 'Responsive 12-column CSS grid. Col must be a direct child of Row.',
    example: "Row({ gap: 16 })([Col({ span: 12, md: 8 })([main]), Col({ span: 12, md: 4 })([aside])])",
    props: [
      { name: 'Row.gap',   type: 'number', default: '16',      desc: 'Column and row gap in px' },
      { name: 'Row.align', type: 'string', default: "'start'", desc: 'CSS align-items value' },
      { name: 'Col.span',  type: 'number', default: '12',      desc: 'Default span (1–12, 12 = full)' },
      { name: 'Col.sm',    type: 'number', default: '—',       desc: 'Span at ≥576px' },
      { name: 'Col.md',    type: 'number', default: '—',       desc: 'Span at ≥768px' },
      { name: 'Col.lg',    type: 'number', default: '—',       desc: 'Span at ≥1024px' },
    ],
  },
  {
    name: 'Stack',
    description: 'Vertical flex column. Children are uniformly spaced.',
    example: "Stack({ gap: 8 })([item1, item2, item3])",
    props: [
      { name: 'gap',   type: 'number', default: '16',        desc: 'Gap in px' },
      { name: 'align', type: 'string', default: "'stretch'", desc: 'CSS align-items' },
      { name: 'style', type: 'string', default: "''",        desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Grid',
    description: 'Equal-column CSS grid. Children don\'t need Col wrappers.',
    example: "Grid({ cols: 1, md: 3, gap: 12 })([card1, card2, card3])",
    props: [
      { name: 'cols',   type: 'number',  default: '3',     desc: 'Default column count' },
      { name: 'sm',     type: 'number',  default: '—',     desc: 'Columns at ≥576px' },
      { name: 'md',     type: 'number',  default: '—',     desc: 'Columns at ≥768px' },
      { name: 'lg',     type: 'number',  default: '—',     desc: 'Columns at ≥1024px' },
      { name: 'gap',    type: 'number',  default: '16',    desc: 'Gap in px' },
      { name: 'styled', type: 'boolean', default: 'false', desc: 'Adds surface background and padding' },
    ],
  },
  {
    name: 'validate / validateForm',
    description: 'Composable validation rules. validate() returns a single-field validator. validateForm() validates a record.',
    example: "const v = validate(required(), minLength(2), email());\nconst errs = validateForm({ email: v })({ email: '' });",
    props: [
      { name: 'required(msg?)',    type: 'rule', default: '—', desc: 'Value must be non-empty' },
      { name: 'minLength(n)',      type: 'rule', default: '—', desc: 'String length ≥ n' },
      { name: 'maxLength(n)',      type: 'rule', default: '—', desc: 'String length ≤ n' },
      { name: 'email()',           type: 'rule', default: '—', desc: 'Must match email pattern' },
      { name: 'pattern(re)',       type: 'rule', default: '—', desc: 'Must match RegExp' },
      { name: 'range(min,max)',    type: 'rule', default: '—', desc: 'Numeric value in [min, max]' },
      { name: '[pred, msg]',       type: 'tuple', default: '—', desc: 'predicate fn + error message string' },
      { name: 'v => bool',         type: 'fn',   default: '—', desc: 'Plain bool predicate (uses "Invalid" as message)' },
      { name: 'isFormValid(errs)', type: 'fn',   default: '—', desc: 'Returns true when all error values are null' },
    ],
  },
  {
    name: 'createStore / mount',
    description: 'Observable store and reactive mount. All UI state lives here.',
    example: "const store = createStore({ count: 0 });\nconst { getState, setState } = store;\nmount(store)(document.body)(state => div({})([String(state.count)]));\n// Partial:\nconst mountTo = mount(store);\nmountTo(document.getElementById('header'))(HeaderView);",
    props: [
      { name: 'createStore(initial)',      type: 'fn', default: '—', desc: 'Returns { getState, setState }. setState(patch | fn) merges.' },
      { name: 'mount(store)(root)(view)', type: 'fn', default: '—', desc: 'Curried. Subscribes view to store; re-renders via rAF on every setState. Returns void.' },
      { name: 'setState(patch)',           type: 'fn', default: '—', desc: 'Merges patch object into current state' },
      { name: 'setState(fn)',              type: 'fn', default: '—', desc: 'setState(s => ({ ...partialUpdate })) — receives prev state' },
    ],
  },
  {
    name: 'memoComponent / memoLeaf',
    description: 'Cache component output keyed on serialized opts. Functions in opts are replaced with "__fn__" so inline handlers don\'t bust the cache.',
    example: "const MemoCard = memoComponent(Card);\nconst MemoBtn  = memoLeaf(Button);\n// Custom cap:\nconst FastCard = memoize(200)(Card);",
    props: [
      { name: 'memoComponent(factory)',         type: 'fn', default: '—',   desc: 'Cache curried components (opts => children => vnode). Default cap 500.' },
      { name: 'memoLeaf(factory)',              type: 'fn', default: '—',   desc: 'Cache leaf components (opts => vnode). Default cap 500.' },
      { name: 'memoize(cap)(factory)',          type: 'fn', default: '500', desc: 'Underlying curried cache factory. Use when you need a custom cap.' },
      { name: 'stableKey(opts)',                   type: 'fn', default: '—',   desc: 'Serializes opts, replacing fns with "__fn__"' },
    ],
  },
  {
    name: 'Slider',
    description: 'Range input with optional label and live value display.',
    example: "Slider({ label: 'Volume', min: 0, max: 100, value: state.vol, onInput: e => setState({ vol: +e.target.value }) })",
    props: [
      { name: 'id',        type: 'string',   default: '—',     desc: 'Links label to input' },
      { name: 'min',       type: 'number',   default: '0',     desc: 'Minimum value' },
      { name: 'max',       type: 'number',   default: '100',   desc: 'Maximum value' },
      { name: 'step',      type: 'number',   default: '1',     desc: 'Step increment' },
      { name: 'value',     type: 'number',   default: '50',    desc: 'Controlled value' },
      { name: 'label',     type: 'string',   default: '—',     desc: 'Label text above the track' },
      { name: 'showValue', type: 'boolean',  default: 'true',  desc: 'Show numeric value next to label' },
      { name: 'disabled',  type: 'boolean',  default: 'false', desc: '' },
      { name: 'onInput',   type: 'function', default: '—',     desc: 'oninput handler (receives Event)' },
      { name: 'className', type: 'string',   default: "''",    desc: 'Extra CSS class(es)' },
      { name: 'style',     type: 'string',   default: "''",    desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'ProgressBar',
    description: 'Horizontal progress indicator. Supports indeterminate, striped, and animated modes.',
    example: "ProgressBar({ value: 60, variant: 'success', label: 'Uploading', showValue: true })",
    props: [
      { name: 'value',         type: 'number',  default: '0',        desc: 'Current value' },
      { name: 'max',           type: 'number',  default: '100',      desc: 'Maximum value' },
      { name: 'variant',       type: 'string',  default: "'primary'", desc: 'primary | success | warning | danger' },
      { name: 'size',          type: 'string',  default: "'md'",     desc: 'sm | md | lg' },
      { name: 'label',         type: 'string',  default: '—',        desc: 'Label above the bar' },
      { name: 'showValue',     type: 'boolean', default: 'false',    desc: 'Show percentage next to label' },
      { name: 'indeterminate', type: 'boolean', default: 'false',    desc: 'Animated scan bar (value ignored)' },
      { name: 'striped',       type: 'boolean', default: 'false',    desc: 'Diagonal stripe pattern on fill' },
      { name: 'animated',      type: 'boolean', default: 'false',    desc: 'Animates stripes (requires striped)' },
      { name: 'className',     type: 'string',  default: "''",       desc: 'Extra CSS class(es)' },
      { name: 'style',         type: 'string',  default: "''",       desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Img',
    description: 'Image wrapper with aspect ratio, fit, lazy loading, rounded, and circle variants.',
    example: "Img({ src: '/photo.jpg', alt: 'Profile', aspect: '1/1', circle: true, width: 80 })",
    props: [
      { name: 'src',       type: 'string',  default: "''",      desc: 'Image URL' },
      { name: 'alt',       type: 'string',  default: "''",      desc: 'Alt text' },
      { name: 'aspect',    type: 'string',  default: '—',       desc: 'CSS aspect-ratio (e.g. "16/9"). Enables object-fit.' },
      { name: 'fit',       type: 'string',  default: "'cover'", desc: 'object-fit: cover | contain | fill | none (used with aspect)' },
      { name: 'lazy',      type: 'boolean', default: 'true',    desc: 'Native lazy loading' },
      { name: 'rounded',   type: 'boolean', default: 'false',   desc: 'Rounded corners' },
      { name: 'circle',    type: 'boolean', default: 'false',   desc: 'Circular crop' },
      { name: 'width',     type: 'number|string', default: '—', desc: 'Container width (number = px)' },
      { name: 'height',    type: 'number|string', default: '—', desc: 'Container height when no aspect set' },
      { name: 'className', type: 'string',  default: "''",      desc: 'Extra CSS class(es)' },
      { name: 'style',     type: 'string',  default: "''",      desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Video',
    description: 'Pure-functional HTML5 video player with aspect ratio, multi-source fallbacks, poster image, WebVTT tracks, and optional caption.',
    example: `Video({
  sources: [
    { src: '/intro.webm', type: 'video/webm' },
    { src: '/intro.mp4',  type: 'video/mp4'  },
  ],
  tracks:  [{ src: '/subs.vtt', kind: 'subtitles', srclang: 'en', label: 'English', default: true }],
  poster:   '/thumb.jpg',
  aspect:   '16/9',
  controls: true,
  caption:  'Introduction',
})`,
    props: [
      { name: 'src',         type: 'string',  default: '—',            desc: 'Shorthand single source URL' },
      { name: 'type',        type: 'string',  default: '—',            desc: 'MIME type for src (e.g. "video/mp4")' },
      { name: 'sources',     type: 'Array',   default: '[]',           desc: 'Array of { src, type } for multi-format fallbacks' },
      { name: 'tracks',      type: 'Array',   default: '[]',           desc: 'Array of { src, kind?, srclang?, label?, default? } for WebVTT captions/subtitles' },
      { name: 'poster',      type: 'string',  default: '—',            desc: 'Poster image shown before play' },
      { name: 'aspect',      type: 'string',  default: "'16/9'",       desc: 'CSS aspect-ratio value' },
      { name: 'controls',    type: 'boolean', default: 'true',         desc: 'Show native browser controls' },
      { name: 'autoplay',    type: 'boolean', default: 'false',        desc: 'Autoplay — pair with muted for browser policies' },
      { name: 'muted',       type: 'boolean', default: 'false',        desc: 'Mute audio track' },
      { name: 'loop',        type: 'boolean', default: 'false',        desc: 'Loop playback' },
      { name: 'playsinline', type: 'boolean', default: 'false',        desc: 'Prevent iOS fullscreen takeover' },
      { name: 'preload',     type: 'string',  default: "'metadata'",   desc: 'none | metadata | auto' },
      { name: 'caption',     type: 'string',  default: '—',            desc: 'Text caption rendered below the player' },
      { name: 'width',       type: 'number|string', default: '—',      desc: 'Wrapper width (number = px)' },
      { name: 'className',   type: 'string',  default: "''",           desc: 'Extra CSS class(es)' },
      { name: 'style',       type: 'string',  default: "''",           desc: 'Extra inline CSS on the wrapper' },
    ],
  },
  {
    name: 'Audio',
    description: 'Pure-functional HTML5 audio player with multi-format source fallbacks, WebVTT track support, and optional caption label.',
    example: `Audio({
  sources: [
    { src: '/track.ogg', type: 'audio/ogg' },
    { src: '/track.mp3', type: 'audio/mpeg' },
  ],
  controls: true,
  caption:  'Episode 1',
})`,
    props: [
      { name: 'src',       type: 'string',  default: '—',          desc: 'Shorthand single source URL' },
      { name: 'type',      type: 'string',  default: '—',          desc: 'MIME type for src' },
      { name: 'sources',   type: 'Array',   default: '[]',         desc: 'Array of { src, type } for multi-format fallbacks' },
      { name: 'tracks',    type: 'Array',   default: '[]',         desc: 'WebVTT track entries: { src, kind?, srclang?, label?, default? }' },
      { name: 'controls',  type: 'boolean', default: 'true',       desc: 'Show native controls' },
      { name: 'autoplay',  type: 'boolean', default: 'false',      desc: 'Autoplay' },
      { name: 'muted',     type: 'boolean', default: 'false',      desc: 'Mute' },
      { name: 'loop',      type: 'boolean', default: 'false',      desc: 'Loop playback' },
      { name: 'preload',   type: 'string',  default: "'metadata'", desc: 'none | metadata | auto' },
      { name: 'caption',   type: 'string',  default: '—',          desc: 'Label text shown below the player' },
      { name: 'className', type: 'string',  default: "''",         desc: 'Extra CSS class(es)' },
      { name: 'style',     type: 'string',  default: "''",         desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'VideoStream',
    description: `Renders a <video> element wired to a live MediaStream (getUserMedia / getDisplayMedia / WebRTC). Accepts a ref callback that receives the real DOM element — use it to assign srcObject, which is a live DOM property not settable via vnode attributes. Mirrored by default for natural selfie-camera appearance.`,
    example: `// Acquire stream then render:
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then(stream => setState({ stream }));

// In your view:
VideoStream({
  ref:    el => { if (el) el.srcObject = state.stream; },
  aspect: '16/9',
  muted:  true,   // required to avoid echo
})`,
    props: [
      { name: 'ref',         type: 'function', default: '—',      desc: '(videoElement) => void — called after the element is created or updated. Assign srcObject here.' },
      { name: 'stream',      type: 'MediaStream', default: 'null', desc: 'Passed as data-stream attribute (for change-detection); actual assignment happens in ref callback.' },
      { name: 'aspect',      type: 'string',  default: "'16/9'",  desc: 'CSS aspect-ratio value' },
      { name: 'muted',       type: 'boolean', default: 'true',    desc: 'Mute — default true to prevent audio feedback' },
      { name: 'autoplay',    type: 'boolean', default: 'true',    desc: 'Autoplay the stream once srcObject is set' },
      { name: 'controls',    type: 'boolean', default: 'false',   desc: 'Show native controls' },
      { name: 'playsinline', type: 'boolean', default: 'true',    desc: 'Prevent iOS fullscreen takeover' },
      { name: 'caption',     type: 'string',  default: '—',       desc: 'Caption text below the player' },
      { name: 'width',       type: 'number|string', default: '—', desc: 'Wrapper width (number = px)' },
      { name: 'className',   type: 'string',  default: "''",      desc: 'Extra CSS class(es)' },
      { name: 'style',       type: 'string',  default: "''",      desc: 'Extra inline CSS' },
    ],
  },
  {
    description: 'File drag-and-drop area with fallback click-to-browse. Curried: Dropzone(opts)(children).',
    example: "Dropzone({ accept: 'image/*', multiple: true, active: state.over, onDragEnter: () => setState({ over: true }), onDrop: files => setState({ files, over: false }) })(['Drop files here'])",
    props: [
      { name: 'onDrop',       type: 'function', default: '—',     desc: 'Called with FileList on drop' },
      { name: 'onFileSelect', type: 'function', default: '—',     desc: 'Called with FileList on file input change' },
      { name: 'onDragEnter',  type: 'function', default: '—',     desc: 'Called on dragover enter' },
      { name: 'onDragLeave',  type: 'function', default: '—',     desc: 'Called on dragleave' },
      { name: 'accept',       type: 'string',   default: "'*'",   desc: 'MIME type filter (passed to <input accept>)' },
      { name: 'multiple',     type: 'boolean',  default: 'false', desc: 'Allow multiple files' },
      { name: 'disabled',     type: 'boolean',  default: 'false', desc: '' },
      { name: 'active',       type: 'boolean',  default: 'false', desc: 'Apply active drag-over styling' },
      { name: 'inputId',      type: 'string',   default: "'dropzone-input'", desc: 'id on the hidden <input>' },
      { name: 'className',    type: 'string',   default: "''",    desc: 'Extra CSS class(es)' },
      { name: 'style',        type: 'string',   default: "''",    desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Divider',
    description: 'Horizontal rule, optionally with a centered text label.',
    example: "Divider({ label: 'or continue with' })",
    props: [
      { name: 'label', type: 'string', default: '—',   desc: 'Text rendered in the centre of the line' },
      { name: 'style', type: 'string', default: "''",  desc: 'Extra inline CSS on the wrapper' },
    ],
  },
  {
    name: 'Spacer',
    description: 'Invisible flexible gap. Without size it grows to fill available space (flex: 1 1 auto). With size it is a fixed px gap.',
    example: "Row({})([Title, Spacer(), Badge({ variant: 'green' })(['Live'])])",
    props: [
      { name: 'size',  type: 'number', default: '—',  desc: 'Fixed pixel size. Omit for flex fill.' },
      { name: 'style', type: 'string', default: "''", desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'AspectBox',
    description: 'Container that enforces an aspect ratio on its children. Curried: AspectBox(opts)(children).',
    example: "AspectBox({ ratio: '4/3' })([videoEl])",
    props: [
      { name: 'ratio', type: 'string', default: "'16/9'", desc: 'CSS aspect-ratio value' },
      { name: 'style', type: 'string', default: "''",     desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Float',
    description: 'Wraps children in a CSS float container. Curried: Float(opts)(children).',
    example: "Float({ side: 'left' })([img])",
    props: [
      { name: 'side',  type: 'string', default: "'left'", desc: "left | right" },
      { name: 'style', type: 'string', default: "''",     desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'Clearfix',
    description: 'Contains floated children via clearfix. Curried: Clearfix(opts)(children).',
    example: "Clearfix()([Float({ side: 'left' })([img]), p({})(['Text flows alongside.'])])",
    props: [
      { name: 'style', type: 'string', default: "''", desc: 'Extra inline CSS' },
    ],
  },
  {
    name: 'DragList',
    description: `Stateless drag-and-drop reorderable list. Renders items from your store and calls onChange(newItems) after a drop. Supports cross-list item transfer via a shared groupId — pair two DragLists with the same groupId and wire a useDragListGroup listener to their common ancestor to move items between them.`,
    example: `// Single-list reorder
DragList({
  items:      state.tasks,
  onChange:   tasks => setState({ tasks }),
  renderItem: item => span({})([item.label]),
})

// Two-list keep/delete pattern (oncreate on the wrapper div):
//   el.addEventListener('draglist:transfer', useDragListGroup({
//     keep: { getItems: () => getState().keep, setItems: keep => setState({ keep }) },
//     del:  { getItems: () => getState().del,  setItems: del  => setState({ del  }) },
//   }))
DragList({ groupId:'keep', items: state.keep, onChange: keep => setState({keep}), renderItem: i => span({})([i.label]) })
DragList({ groupId:'del',  items: state.del,  onChange: del  => setState({del}),  renderItem: i => span({})([i.label]) })`,
    props: [
      { name: 'items',       type: 'Array',    default: '[]',                 desc: 'Array of objects — each must have a unique id field' },
      { name: 'onChange',    type: 'function', default: '—',                  desc: '(newItems: Array) => void — called after a reorder drop within the same list' },
      { name: 'renderItem',  type: 'function', default: '—',                  desc: '(item) => vnode — render function for each item' },
      { name: 'groupId',     type: 'string',   default: "''",                 desc: 'Shared token that links DragLists for cross-list transfer' },
      { name: 'listId',      type: 'string',   default: "''",                 desc: 'Unique id for this list within the group — used by onTransfer' },
      { name: 'onTransfer',  type: 'function', default: '—',                  desc: '(srcId, srcListId, targetListId) => void — called on the target list when an item is dropped from another list. Pass the value returned by useDragListGroup.' },
      { name: 'direction',   type: 'string',   default: "'vertical'",         desc: 'vertical | horizontal' },
      { name: 'emptyLabel',  type: 'string',   default: "'Drop items here'",  desc: 'Placeholder shown when items is empty' },
      { name: 'className',   type: 'string',   default: "''",                 desc: 'Extra CSS class(es) on the list container' },
      { name: 'style',       type: 'string',   default: "''",                 desc: 'Extra inline CSS on the list container' },
    ],
  },
  {
    name: 'useDragListGroup',
    description: 'Returns an onTransfer callback that atomically moves items between named store slices. Pass the returned function as the onTransfer prop to every DragList in the group — no DOM event wiring needed.',
    example: `const onTransfer = useDragListGroup({
  keep: { getItems: () => getState().keep, setItems: keep => setState({ keep }) },
  del:  { getItems: () => getState().del,  setItems: del  => setState({ del  }) },
});
DragList({ groupId:'review', listId:'keep', onTransfer, items: state.keep, onChange: keep => setState({keep}), renderItem: i => span({})([i.label]) })
DragList({ groupId:'review', listId:'del',  onTransfer, items: state.del,  onChange: del  => setState({del}),  renderItem: i => span({})([i.label]) })`,
    props: [
      { name: 'slices', type: 'Object', default: '—', desc: 'Keys = listId strings. Values = { getItems: () => Array, setItems: (Array) => void }. getItems must read live state (call getState() inside), not close over a snapshot.' },
    ],
  },
  {
    description: 'Render Markdown to a vnode (div) or a flat array of block vnodes. Supports headings, bold, italic, inline code, links, images, fenced code blocks (with syntax highlighting), blockquotes, lists, hr, and (label)[content] spoilers.',
    example: "markdownToVnode('# Hello\\n\\nThis is **bold** and `code`.')",
    props: [
      { name: 'markdownToVnode(md)',      type: 'fn', default: '—', desc: 'Returns a div VNode containing all parsed blocks' },
      { name: 'parseMarkdown(md)',        type: 'fn', default: '—', desc: 'Returns [VNode] block array' },
      { name: 'parseInline(text)',        type: 'fn', default: '—', desc: 'Returns [VNode|string] inline tokens' },
      { name: 'setHighlightRegistry(r)', type: 'fn', default: '—', desc: 'Replace the entire highlight registry' },
      { name: 'registerPlugin(lang, fn)', type: 'fn', default: '—', desc: 'Add/overwrite alias(es). lang can be string or string[]' },
      { name: 'unregisterPlugin(lang)',   type: 'fn', default: '—', desc: 'Remove alias(es) from the active registry' },
    ],
  },
  {
    name: 'Highlight — tokenizer / highlight / defaultRegistry',
    description: 'Syntax highlighting engine. Build language plugins from RegExp specs, then apply them via a registry.',
    example: "import { tokenizer, highlight, defaultRegistry } from 'dervoJS';\nconst myLang = tokenizer([[/\\/\\/.*/m, 'comment'], [/\\bfn\\b/, 'keyword']]);\nhighlight(defaultRegistry)('rust')(source);",
    props: [
      { name: 'tokenizer(specs)',           type: 'fn',    default: '—', desc: 'specs: [RegExp, className][]. Returns plugin fn: source => [VNode|string]' },
      { name: 'highlight(registry)(lang)(source)', type: 'fn', default: '—', desc: 'Apply registry plugin for lang; falls back to plain text' },
      { name: 'defaultRegistry',            type: 'object', default: '—', desc: 'Built-in plugins: js ts hs c cpp cs java py rust css bash (+ aliases)' },
    ],
  },
  {
    name: 'initStyles / tokens / setTokens / resetTokens',
    description: 'Theme bootstrap and runtime token system. Injects the dervo.css stylesheet and applies CSS custom-property overrides so every component reflects your design tokens instantly.',
    example: "// One-time setup\ninitStyles({\n  theme: 'dark',\n  colors: { accent: '#e11d48', 'accent-hover': '#be123c' },\n  fonts:  { sans: 'Inter, sans-serif' },\n});\n\n// Runtime mutation (e.g. live theme picker)\nsetTokens({ accent: '#7c3aed', 'accent-hover': '#6d28d9' });\n\n// Remove overrides, restore CSS-file defaults\nresetTokens(['accent', 'accent-hover']);\nresetTokens(); // reset every token\n\n// Read default values\nconsole.log(tokens.light.accent); // '#4f46e5'",
    props: [
      { name: 'initStyles(opts)',        type: 'fn',    default: '—',       desc: 'Bootstrap styles. Call once before mount.' },
      { name: 'opts.theme',              type: 'string', default: "'light'", desc: "Initial color scheme: 'light' | 'dark'" },
      { name: 'opts.colors',             type: 'object', default: '{}',      desc: 'Partial :root token overrides, e.g. { accent: \'#e11d48\' }' },
      { name: 'opts.darkColors',         type: 'object', default: '{}',      desc: 'Partial [data-theme=\'dark\'] token overrides' },
      { name: 'opts.fonts',              type: 'object', default: '{}',      desc: '{ sans?, mono? } — font-family overrides' },
      { name: 'opts.cssHref',            type: 'string', default: './dervo.css', desc: 'Custom URL for the stylesheet (e.g. CDN)' },
      { name: 'opts.noLink',             type: 'boolean', default: 'false',  desc: 'Skip <link> injection when you import CSS via a bundler' },
      { name: 'tokens',                  type: 'object', default: '—',       desc: '{ light: {...}, dark: {...} } — default token values as JS object' },
      { name: 'setTokens(map)',          type: 'fn',    default: '—',       desc: 'Apply one or more CSS var overrides to :root inline style' },
      { name: 'resetTokens(keys?)',      type: 'fn',    default: '—',       desc: 'Remove inline overrides => restores CSS-file defaults. Pass key[] to reset specific tokens, or omit to reset all.' },
      { name: 'toggleTheme()',           type: 'fn',    default: '—',       desc: "Flip data-theme between 'light' and 'dark', returns new value" },
      { name: 'setTheme(theme)',         type: 'fn',    default: '—',       desc: "Set data-theme explicitly to 'light' or 'dark'" },
    ],
  },
  {
    name: 'NumberInput',
    description: 'Numeric stepper: decrement / text-field / increment. Controlled component — call onChange to update value.',
    example: "NumberInput({ label: 'Qty', value: state.qty, min: 0, max: 99, step: 1, onChange: v => setState({ qty: v }) })",
    props: [
      { name: 'label',     type: 'string',   default: '—',          desc: 'Label above the control' },
      { name: 'value',     type: 'number',   default: '0',          desc: 'Controlled numeric value' },
      { name: 'min',       type: 'number',   default: '-Infinity',  desc: 'Minimum value' },
      { name: 'max',       type: 'number',   default: 'Infinity',   desc: 'Maximum value' },
      { name: 'step',      type: 'number',   default: '1',          desc: 'Step size for ± buttons' },
      { name: 'disabled',  type: 'boolean',  default: 'false',      desc: '' },
      { name: 'onChange',  type: 'function', default: '—',          desc: 'Called with clamped number value' },
      { name: 'className', type: 'string',   default: "''",         desc: '' },
      { name: 'style',     type: 'string',   default: "''",         desc: '' },
    ],
  },
  {
    name: 'ColorPicker',
    description: 'Hex colour selector: swatch palette + native colour wheel + hex text input. Controlled.',
    example: "ColorPicker({ label: 'Brand', value: state.color, onChange: v => setState({ color: v }) })",
    props: [
      { name: 'label',      type: 'string',   default: '—',          desc: 'Label above the picker' },
      { name: 'value',      type: 'string',   default: "'#000000'",  desc: 'Hex colour string (#rrggbb)' },
      { name: 'swatches',   type: 'string[]', default: 'DEFAULT_SWATCHES', desc: '20-colour palette; import DEFAULT_SWATCHES to extend it' },
      { name: 'showHex',    type: 'boolean',  default: 'true',       desc: 'Show hex text input' },
      { name: 'showWheel',  type: 'boolean',  default: 'true',       desc: 'Show native colour wheel input' },
      { name: 'onChange',   type: 'function', default: '—',          desc: 'Called with hex string when value changes' },
      { name: 'className',  type: 'string',   default: "''",         desc: '' },
      { name: 'style',      type: 'string',   default: "''",         desc: '' },
    ],
  },
  {
    name: 'DateTimePicker',
    description: 'Month calendar grid with optional time selector. Fully controlled — store viewYear / viewMonth in state and handle onViewChange.',
    example: "DateTimePicker({ value: s.date, viewYear: s.dpYear, viewMonth: s.dpMonth, showTime: true, onChange: v => setState({ date: v }), onViewChange: ({year, month}) => setState({dpYear: year, dpMonth: month}) })",
    props: [
      { name: 'label',          type: 'string',   default: '—',     desc: 'Label above the picker' },
      { name: 'value',          type: 'string',   default: "''",    desc: "ISO date/datetime: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'" },
      { name: 'viewYear',       type: 'number',   default: '—',     desc: 'Year currently displayed in the calendar' },
      { name: 'viewMonth',      type: 'number',   default: '—',     desc: 'Month (0–11) currently displayed' },
      { name: 'showTime',       type: 'boolean',  default: 'false', desc: 'Show hour / minute inputs below calendar' },
      { name: 'min',            type: 'string',   default: '—',     desc: 'ISO date lower bound (inclusive)' },
      { name: 'max',            type: 'string',   default: '—',     desc: 'ISO date upper bound (inclusive)' },
      { name: 'onChange',       type: 'function', default: '—',     desc: 'Called with ISO string when date/time is selected' },
      { name: 'onViewChange',   type: 'function', default: '—',     desc: 'Called with { year, month } when nav arrows clicked' },
      { name: 'className',      type: 'string',   default: "''",    desc: '' },
      { name: 'style',          type: 'string',   default: "''",    desc: '' },
    ],
  },
  {
    name: 'Typography',
    description: 'Prose wrapper that auto-scans children for h1–h6 vnodes, injects anchor ids, and renders a sticky Table of Contents. Curried.',
    example: "Typography({ toc: true, tocPosition: 'right' })([\n  H2({})(['Section']),\n  P({})(['Body text…']),\n])",
    props: [
      { name: 'toc',          type: 'boolean', default: 'true',     desc: 'Build and render the TOC' },
      { name: 'tocPosition',  type: 'string',  default: "'right'",  desc: "'left' | 'right'" },
      { name: 'tocTitle',     type: 'string',  default: "'Contents'", desc: 'TOC heading text; falsy = hidden' },
      { name: 'tocSticky',    type: 'boolean', default: 'true',     desc: 'position:sticky on the TOC panel' },
      { name: 'className',    type: 'string',  default: "''",       desc: '' },
      { name: 'style',        type: 'string',  default: "''",       desc: '' },
      { name: 'H1–H6',        type: 'fn',      default: '—',        desc: 'Heading helpers: H1(opts)(children) → vnode' },
      { name: 'P',            type: 'fn',      default: '—',        desc: 'Paragraph: P({lead?})(children)' },
      { name: 'Code',         type: 'fn',      default: '—',        desc: 'Inline code span' },
      { name: 'Pre',          type: 'fn',      default: '—',        desc: 'Pre block: Pre({lang})(children)' },
      { name: 'Quote',        type: 'fn',      default: '—',        desc: 'Blockquote: Quote({cite})(children)' },
      { name: 'collectHeadings(vnodes)', type: 'fn', default: '—',  desc: 'Low-level: returns [{ level, text, id }]' },
      { name: 'slugify(text)',           type: 'fn', default: '—',  desc: 'URL-safe id from heading text' },
    ],
  },
  {
    name: 'createBus',
    description: 'Lightweight pub/sub event bus for cross-component communication decoupled from the store.',
    example: "const bus = createBus();\nconst off = bus.on('upload:done', ({url}) => show(url));\nbus.emit('upload:done', {url: '/img.png'});\noff(); // unsubscribe",
    props: [
      { name: 'on(event, handler)',  type: 'fn', default: '—', desc: 'Subscribe; returns an unsubscribe function' },
      { name: 'off(event, handler)', type: 'fn', default: '—', desc: 'Unsubscribe directly' },
      { name: 'emit(event, data)',   type: 'fn', default: '—', desc: 'Fire all handlers for event' },
      { name: 'once(event, handler)',type: 'fn', default: '—', desc: 'Subscribe once; auto-unsubscribes after first call' },
      { name: 'destroy()',           type: 'fn', default: '—', desc: 'Remove all subscriptions' },
    ],
  },
  {
    name: 'onWindowResize',
    description: 'Debounced window resize listener. Calls cb with { width, height }. Returns { destroy, getSize }.',
    example: "const r = onWindowResize(({width}) => setState({w: width}), { debounce: 100 });\nr.getSize(); // { width, height }\nr.destroy(); // remove listener",
    props: [
      { name: 'cb',              type: 'function', default: '—',    desc: 'Called with { width, height }' },
      { name: 'opts.debounce',   type: 'number',   default: '50',   desc: 'Debounce delay ms' },
      { name: '→ .destroy()',    type: 'fn',       default: '—',    desc: 'Remove the resize listener' },
      { name: '→ .getSize()',    type: 'fn',       default: '—',    desc: 'Returns current { width, height } synchronously' },
    ],
  },
  {
    name: 'onBreakpoint',
    description: 'Reactive CSS media query observer. Fires immediately on mount and again whenever the query changes.',
    example: "const bp = onBreakpoint('(max-width:768px)', matches => setState({ mobile: matches }));\nbp.matches(); // current boolean",
    props: [
      { name: 'query',         type: 'string',   default: '—',   desc: 'CSS media query string' },
      { name: 'cb',            type: 'function', default: '—',   desc: 'Called with boolean (matches)' },
      { name: '→ .destroy()',  type: 'fn',       default: '—',   desc: 'Remove the listener' },
      { name: '→ .matches()',  type: 'fn',       default: '—',   desc: 'Return current match state' },
    ],
  },
  {
    name: 'onKeydown / onKeyup',
    description: 'Global keyboard listener with optional key / modifier filter.',
    example: "onKeydown(e => closeModal(), { key: 'Escape' });\nonKeydown(e => save(), { key: 's', ctrl: true });",
    props: [
      { name: 'cb',           type: 'function',        default: '—',   desc: 'Receives the KeyboardEvent' },
      { name: 'opts.key',     type: 'string|string[]', default: '—',   desc: 'Key name(s) to match; omit = all keys' },
      { name: 'opts.ctrl',    type: 'boolean',         default: '—',   desc: 'Require Ctrl' },
      { name: 'opts.shift',   type: 'boolean',         default: '—',   desc: 'Require Shift' },
      { name: 'opts.alt',     type: 'boolean',         default: '—',   desc: 'Require Alt' },
      { name: '→ .destroy()', type: 'fn',             default: '—',   desc: 'Remove the listener' },
    ],
  },
  {
    name: 'createAlarm',
    description: 'Schedule a one-shot or repeating callback after a delay. Returns { destroy, reset }.',
    example: "const t = createAlarm(() => notify('Time!'), { delay: 5000, repeat: false });\nt.reset(); // restart the timer\nt.destroy(); // cancel",
    props: [
      { name: 'cb',              type: 'function', default: '—',     desc: 'Callback to invoke' },
      { name: 'opts.delay',      type: 'number',   default: '1000',  desc: 'Milliseconds before first (and each repeated) call' },
      { name: 'opts.repeat',     type: 'boolean',  default: 'false', desc: 'Keep firing until destroy()' },
      { name: 'opts.immediate',  type: 'boolean',  default: 'false', desc: 'Also call cb immediately before starting the timer' },
      { name: '→ .destroy()',    type: 'fn',       default: '—',     desc: 'Cancel' },
      { name: '→ .reset()',      type: 'fn',       default: '—',     desc: 'Cancel and restart with same delay' },
    ],
  },
  {
    name: 'onVisibilityChange',
    description: 'document.visibilitychange wrapper. Fires with { visible: bool } whenever the tab is hidden or restored.',
    example: "onVisibilityChange(({ visible }) => {\n  if (!visible) analytics.pause();\n  else analytics.resume();\n});",
    props: [
      { name: 'cb',            type: 'function', default: '—', desc: 'Called with { visible: boolean }' },
      { name: '→ .destroy()',  type: 'fn',       default: '—', desc: 'Remove the listener' },
    ],
  },  {
    name: 'NAV_ITEMS \u2014 onMount / unload',
    description: 'Per-route lifecycle hooks declared on NAV_ITEMS entries in app.js. ' +
      '`onMount` is called (after setState) every time the user navigates to that route. ' +
      '`unload: true` forces the panel DOM to be fully torn down and recreated on each visit ' +
      '(achieved by keying the panel vnode with the tab id, so the reconciler discards the old subtree).',
    example:
      "// In NAV_ITEMS:\n" +
      "{ id: 'media', label: 'Media', unload: true,\n" +
      "  onMount: () => setState({ mediaSeed: Date.now() }) }\n\n" +
      "// How unload works — renderPanel injects a unique key:\n" +
      "const key = UNLOAD_PANELS.has(id) ? id : 'panel';\n" +
      "return { ...vnode, props: { ...vnode.props, key } };\n\n" +
      "// Normal panels share key='panel' — always patch in-place (efficient).\n" +
      "// Unload panels get key=tabId — on each visit the reconciler removes\n" +
      "// the old DOM node and creates a fresh one.",
    props: [
      { name: 'unload',   type: 'boolean',  default: 'false', desc: 'Tear down panel DOM on every route change; recreate on next visit' },
      { name: 'onMount',  type: '() => void', default: '\u2014', desc: 'Called after setState({ activeTab }) every time this route is activated' },
    ],  },
  {
    name: 'StateDebugger',
    description: 'Live inspector panel for any dervoJS store. Shows all state keys with their current value and type, lets you edit any value as inline JSON, add new keys, remove keys, expand complex values (objects/arrays), filter the key list, and watch individual keys for changes. Watched keys append timestamped before→after diffs to a scrollable change log. Maintains its own internal UI state in a module-level variable so it never pollutes the app store.',
    example: `// In a debug panel (receives state from mount):
import { StateDebugger } from 'dervoJS';
import { setState, getState } from '../store.js';

export const debugPanel = state =>
  StateDebugger({ state, setState, getState });`,
    props: [
      { name: 'state',    type: 'Object',   default: '—', desc: 'Current app state — pass directly from your view function' },
      { name: 'setState', type: 'function', default: '—', desc: 'Store setState — accepts a plain patch object or updater fn' },
      { name: 'getState', type: 'function', default: '—', desc: 'Store getState() — must read live state (called during transfer/delete, not closed over)' },
    ],
  },
  {
    name: 'RenderProfiler',
    description:
      'Live render-timing monitor. Auto-enables profiling on first render and auto-detaches when the component stops being rendered (e.g. the debug panel is closed). ' +
      'Profiling is OFF by default so the hot render path has zero overhead — the component activates it internally, and your FloatingPanel onClose handler calls disableProfiler() to restore zero-overhead runners.',
    example:
      "import { RenderProfiler, disableProfiler } from 'dervoJS';\n\n" +
      "// Wire into your debug FloatingPanel:\n" +
      "FloatingPanel({\n" +
      "  id: 'debug', title: 'Debug', open: s.debugOpen,\n" +
      "  onClose: () => { setState({ debugOpen: false }); disableProfiler(); },\n" +
      "})([RenderProfiler({ setState })])\n\n" +
      "// Read the ring buffer from JS (also auto-enables profiling):\n" +
      "import { getRenderLog } from 'dervoJS';\n" +
      "const log = getRenderLog(); // newest frame first, max 100 entries\n" +
      "log[0]; // { frame, computeMs, patchMs, totalMs, ts, ops, changedKeys }",
    props: [
      { name: 'setState',          type: 'function', default: '() => {}', desc: 'Store setState — used to force-refresh the profiler UI on each render tick' },
      { name: 'enableProfiler()',  type: 'fn',       default: '—',        desc: 'Start profiling. Swaps all mounted roots to the instrumented runner. Called automatically by RenderProfiler on first render.' },
      { name: 'disableProfiler()', type: 'fn',       default: '—',        desc: 'Stop profiling; restores zero-overhead runners. Call this from your debug panel onClose.' },
      { name: 'getRenderLog()',    type: 'fn',       default: '—',        desc: 'Auto-enables profiling; returns the ring buffer (newest frame first). Entry shape: { frame, computeMs, patchMs, totalMs, ts, ops, changedKeys }' },
      { name: 'getProfilerFrame()', type: 'fn',      default: '—',        desc: 'Returns the current monotonically-increasing frame counter.' },
    ],
  },
  {
    name: 'RenderProfiler — metric reference',
    description: 'Every value shown by RenderProfiler. Click any sparkline bar or table row to expand its detail section.',
    example: '// Stat chips update on every render. Click a bar to see the breakdown for that frame.',
    props: [
      { name: 'last',          type: 'ms',       default: '—', desc: 'Total render time for the most recent frame.' },
      { name: 'avg',           type: 'ms',       default: '—', desc: 'Mean total time over the visible window (up to 50 frames).' },
      { name: 'max',           type: 'ms',       default: '—', desc: 'Worst recorded frame.' },
      { name: 'p95',           type: 'ms',       default: '—', desc: '95th-percentile: 95 % of frames were at or below this. More diagnostic than max for systemic slowness vs one-off spikes.' },
      { name: 'frames',        type: 'n',        default: '—', desc: 'Entries in the ring buffer (max 100). Anything shown in red exceeds the 16.67 ms frame budget.' },
      { name: 'compute',       type: 'ms',       default: '—', desc: 'Time spent calling view(state) to build the new vnode tree. High compute = expensive render logic (heavy map/filter/string-building in the view function).' },
      { name: 'patch',         type: 'ms',       default: '—', desc: 'Time spent walking the old DOM and new vnode tree, diffing and applying changes. High patch = large tree or many DOM mutations — check the ops counts.' },
      { name: 'changed keys',  type: 'string[]', default: '—', desc: 'State keys whose values were !== compared to the previous frame. "—" = no key changed (initial render or a force-refresh setState({})). A key appearing every frame may indicate accidental object-identity churn.' },
      { name: 'visited',       type: 'n',        default: '—', desc: 'Times _patch() was entered. Counts every node the reconciler looked at, not just mutated ones. Grows with tree depth and child count — a large steady number is normal and expected.' },
      { name: 'created',       type: 'n',        default: '—', desc: 'New DOM nodes appended (appendChild). Happens when the vnode list grows or a keyed node appears for the first time.' },
      { name: 'replaced',      type: 'n',        default: '—', desc: 'Existing nodes swapped (replaceChild). Happens on tag mismatch or text↔element swap. Expensive — the entire old subtree is discarded. High replaced with missing keys on lists is the most common performance problem.' },
      { name: 'removed',       type: 'n',        default: '—', desc: 'Nodes deleted (removeChild). Normal when a list filters shorter or a keyed node disappears.' },
      { name: 'moved',         type: 'n',        default: '—', desc: 'Existing nodes repositioned (insertBefore on an already-in-tree node). High moved + low created/replaced = keys are working correctly — DOM is being reused, just reordered.' },
      { name: 'propSets',      type: 'n',        default: '—', desc: 'Elements that entered prop-diffing. O(elements in tree) per frame — normal reconciler overhead, not a mutation count.' },
      { name: 'textEdits',     type: 'n',        default: '—', desc: 'Text node nodeValue writes. Each is one direct DOM mutation. High textEdits = many interpolated strings changing every frame.' },
      { name: 'mutation rate', type: '%',        default: '—', desc: '(created + replaced + removed + moved) / visited × 100 %. 0–5 % = healthy large stable tree. >30 % on a minor state change = nodes are being rebuilt — add stable keys to your lists.' },
    ],
  },
];

const codeStyle = 'font-family:ui-monospace,monospace; font-size:11.5px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; white-space:pre-wrap; color:var(--text-muted); margin:0 0 8px; display:block; overflow-x:auto';

export const docsPanel = state => {
  const q = (state.docsFilter || '').toLowerCase();
  const filtered = q ? DOCS.filter(d => (d.name || '').toLowerCase().includes(q)) : DOCS;
  return div({})([
    TextInput({
      id: 'docsSearch',
      placeholder: 'Filter components…',
      value: state.docsFilter || '',
      hint: `${filtered.length} of ${DOCS.length} components shown`,
      onInput: e => setState({ docsFilter: e.target.value }),
    }),
    div({ style: 'margin-top:16px' })([
      Stack({ gap: 12 })([
        ...filtered.map(doc =>
          Card({ title: doc.name })([
            p({ style: 'margin:0 0 8px; font-size:13px; color:var(--text-muted)' })([doc.description]),
            span({ style: codeStyle })([doc.example]),
            Table({ columns: PROP_COLS, rows: doc.props, scroll: true }),
          ])
        ),
      ]),
    ]),
  ]);
};
