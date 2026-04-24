# dervoJS

A zero-build component library and UI framework on top of [odocosJS](lib/odocosjs/).

---

## Quick start

```html
<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body>
  <script type="module">
    import { div, Button, createStore, mount, initStyles } from './src/index.js';

    initStyles({ theme: 'light' });

    const store = createStore({ count: 0 });
    const { setState } = store;

    const view = state =>
      div({ className: 'stack' })([
        `Count: ${state.count}`,
        Button({ onClick: () => setState(s => ({ count: s.count + 1 })) })(['+1']),
      ]);

    mount(store)(document.body)(view);
  </script>
</body>
</html>
```

Serve the project root with any static HTTP server  and open `demo/index.html` for the full demo app.

---

## Architecture

```
dervoJS/
├── src/
│   ├── index.js          # public API  — all exports
│   ├── elements.js       # 90+ curried HTML tag factories (div, span, button, …)
│   ├── state.js           # createStore, mount, reconciler, profiler hooks
│   ├── styles.js          # initStyles, theme tokens, toggleTheme, setTokens
│   ├── validate.js        # composable form validation rules
│   ├── cache.js           # memoComponent / memoLeaf
│   ├── listeners.js       # event helpers (bus, keyboard, resize, breakpoint, …)
│   ├── utils.js           # cn(), fire()
│   ├── dervo.css          # full stylesheet (~1850 lines, light + dark tokens)
│   └── components/        # all UI components
├── demo/
│   ├── index.html         # entry point
│   ├── app.js             # demo app — mounts store, routes between panels
│   └── panels/            # one file per demo page
└── lib/
    └── odocosjs/          # functional micro-library (Observable, vnode, Church types)
```

Everything is plain ES modules. The build step is "open in browser".

### Curried vnode API

Every element and component is curried:

```js
// element:    tag(props)(children)
div({ className: 'card' })(['Hello'])

// component:  Component(opts)(children)
Card({ title: 'Stats' })([Badge({ variant: 'green' })(['OK'])])

// leaf component (no children):
Clock({ time: 42, size: 'lg', label: 'elapsed' })
```

The base comes from odocosJS: `vnode(tag)(props)(children)` produces a plain `{ tag, props, children }` object. dervoJS wraps every HTML tag as a named export (`div`, `span`, `button`, `input`, `table`, …) plus pre-styled shortcuts (`flexRow`, `flexCol`, `absDiv`, etc.).

---

## State management

```js
import { createStore, mount } from './src/index.js';

// 1. Create a store with initial state
const store = createStore({ count: 0, name: '' });
const { getState, setState } = store;

// 2. setState merges a patch (like React setState)
setState({ count: 1 });                        // merge object
setState(prev => ({ count: prev.count + 1 })); // updater function

// 3. Mount a view — re-renders automatically on every setState via rAF batching
mount(store)(document.body)(state =>
  div({})([`Count: ${state.count}`])
);
```

`mount` is curried for partial application — one store, multiple roots:

```js
const mountTo = mount(store);
mountTo(document.getElementById('header'))(HeaderView);
mountTo(document.getElementById('main'))(MainView);
```

### Reconciler

dervoJS does **not** use odocosJS's naive `replaceChildren`. It has its own structural DOM patcher that walks the live DOM and new vnode tree in parallel:

- **Same tag** — patches props (tracked via `WeakMap` for accurate cleanup), recurses into children.
- **Different tag** — full `replaceChild`.
- **Text nodes** — compares `nodeValue`, only writes if changed.
- **Key-based reconciliation** — children with `props.key` are matched via `Map` lookup, reordered with `insertBefore`, stale keys removed. Falls back to index-based patching when no keys are present.
- **Focus preservation** — captures the active element's id and text selection before patching; restores afterward so typing in an input isn't interrupted.

---

## Components

### UI primitives

| Component | API | Description |
|---|---|---|
| `Button` | `Button(opts)(children)` | primary / secondary / danger / success / ghost; sm / md / lg |
| `TextInput` | `TextInput(opts)` | Labeled input with hint, error, validation styling |
| `NumberInput` | `NumberInput(opts)` | Stepper: − / text field / + with min/max/step |
| `Select` | `Select(opts)` | Dropdown with label and optional placeholder |
| `Checkbox` | `Checkbox(opts)(label)` | Labeled checkbox |
| `Toggle` | `Toggle(opts)(label)` | Switch (role="switch", keyboard accessible) |
| `Slider` | `Slider(opts)` | Range input with optional label and live value |

### Data display

| Component | API | Description |
|---|---|---|
| `Card` | `Card(opts)(children)` | Surface container, optional title/footer |
| `Badge` | `Badge(opts)(children)` | Colored pill (blue, green, red, yellow, gray, purple) |
| `Alert` | `Alert(opts)(children)` | Feedback banner (info, success, warning, error) |
| `List` | `List(opts)` | Maps an array through a render fn, shows empty state |
| `Table` | `Table(opts)` | Sortable, filterable data table with sticky headers, column filters, global search |
| `Clock` | `Clock(opts)` | Stateless HH:MM:SS display. Pair with `createInterval` |
| `ProgressBar` | `ProgressBar(opts)` | Determinate/indeterminate, striped, animated |

### Overlays

| Component | API | Description |
|---|---|---|
| `Modal` | `Modal(opts)(children)` | Overlay dialog with title, close, footer |
| `Tabs` | `Tabs(opts)(panels)` | Tab strip + panels; only the active panel renders |

### Media

| Component | API | Description |
|---|---|---|
| `Img` | `Img(opts)` | Aspect ratio, lazy loading, rounded/circle variants |
| `Video` | `Video(opts)` | HTML5 video with multi-source, tracks, poster |
| `Audio` | `Audio(opts)` | HTML5 audio with multi-source |
| `VideoStream` | `VideoStream(opts)` | Live `MediaStream` video (getUserMedia / WebRTC) |
| `Dropzone` | `Dropzone(opts)(children)` | Drag-and-drop + click-to-browse file zone |

### Pickers

| Component | API | Description |
|---|---|---|
| `ColorPicker` | `ColorPicker(opts)` | Swatch palette + native color wheel + hex input |
| `DateTimePicker` | `DateTimePicker(opts)` | Month calendar grid, optional time selector |

### Layout

| Component | Description |
|---|---|
| `PageLayout` | Full-viewport shell: sticky top/bottom bars, animated sidebars, scrollable main |
| `AppShell` | Preset for dashboard-style apps |
| `TwoPane` | Side-by-side split (editor / file tree) |
| `BlogLayout` | Centered column with header/footer |
| `Container` | Centered max-width wrapper (sm / md / lg / xl / full) |
| `Row` / `Col` | 12-column responsive CSS grid with sm/md/lg breakpoints |
| `Stack` | Vertical flex column with uniform gap |
| `Grid` | Equal-column CSS grid with responsive col counts |
| `DragList` | Drag-and-drop reorderable list; pair with `useDragListGroup` for cross-list transfer |
| `Divider` | Horizontal rule with optional centered label |
| `Spacer` | Flexible gap or fixed-size spacer |
| `AspectBox` | Enforces a CSS aspect ratio on children |
| `Float` / `Clearfix` | CSS float utilities |

### Typography & Markdown

```js
import { Typography, H2, P, markdownToVnode } from './src/index.js';

// Structured prose with auto-generated table of contents
Typography({ toc: true, tocPosition: 'right' })([
  H2({})(['Getting started']),
  P({})(['Install and run.']),
]);

// Or render from a Markdown string
markdownToVnode('# Hello\n\nThis is **bold** and `code`.');
```

Syntax highlighting is extensible via `tokenizer`, `highlight`, and `defaultRegistry` (ships with JS, TS, Python, Rust, C/C++, Java, Haskell, CSS, Bash, and more).

### Table utilities

```js
import { Table, filterAll, filterBy, filterExact, sortBy } from './src/index.js';

Table({
  columns: [
    { key: 'name', label: 'Name', sort: true, filter: true },
    { key: 'year', label: 'Year', sort: true, sortFn: sortBy('year') },
  ],
  rows: data,
  sort: state.sort,
  onSort: (key, dir) => setState({ sort: { key, dir } }),
  columnFilters: state.colFilters,
  onColumnFilter: (key, val) => setState(s => ({ colFilters: { ...s.colFilters, [key]: val } })),
  showColumnFilters: true,
});
```

---

## Theming

```js
import { initStyles, toggleTheme, setTokens, resetTokens, tokens } from './src/index.js';

// Bootstrap — call once before mount
initStyles({
  theme: 'dark',
  colors: { accent: '#e11d48', 'accent-hover': '#be123c' },
  fonts:  { sans: 'Inter, sans-serif' },
});

// Runtime
toggleTheme();                              // flips light ↔ dark
setTokens({ accent: '#7c3aed' });           // live CSS var override
resetTokens(['accent']);                     // restore stylesheet default
resetTokens();                              // reset everything
```

The stylesheet defines ~50 semantic CSS custom properties (`--bg`, `--surface`, `--text`, `--accent`, `--danger`, `--border`, etc.) with full light and dark palettes. All components use these tokens.

---

## Validation

```js
import { validate, validateForm, isFormValid, required, minLength, email } from './src/index.js';

// Compose rules for a single field
const checkEmail = validate(required(), email());
checkEmail('');            // 'Required'
checkEmail('bad');         // 'Invalid email'
checkEmail('a@b.com');     // null (valid)

// Validate an entire form
const check = validateForm({
  name:  validate(required(), minLength(2)),
  email: validate(required(), email()),
});

const errors = check({ name: '', email: 'bad' });
// { name: 'Required', email: 'Invalid email' }

isFormValid(errors);  // false
```

Rules: `required`, `minLength(n)`, `maxLength(n)`, `email()`, `pattern(regex)`, `range(min, max)`. Custom rules: `value => errorString | null`, `value => boolean`, or `[predicate, msg]` tuple.

---

## Memoization

```js
import { memoComponent, memoLeaf, memoize } from './src/index.js';

const MemoCard = memoComponent(Card);     // opts => children => vnode, cached
const MemoBtn  = memoLeaf(Button);        // opts => vnode, cached
const FastCard = memoize(200)(Card);      // custom cache cap (default 500)
```

Cache keys are serialized with `stableKey(opts)`, which replaces function values with `"__fn__"` so inline arrow handlers don't bust the cache.

---

## Event helpers

```js
import {
  createBus, onWindowResize, onBreakpoint,
  onKeydown, createAlarm, onVisibilityChange
} from './src/index.js';

// Pub/sub event bus
const bus = createBus();
bus.on('save', data => console.log(data));
bus.emit('save', { id: 1 });

// Window resize (debounced)
const r = onWindowResize(({ width }) => setState({ w: width }), { debounce: 100 });
r.destroy();

// CSS media query
const bp = onBreakpoint('(max-width:768px)', mobile => setState({ mobile }));

// Keyboard shortcuts
onKeydown(e => save(), { key: 's', ctrl: true });
onKeydown(e => closeModal(), { key: 'Escape' });

// Timers
const alarm = createAlarm(() => notify('Done!'), { delay: 5000 });
alarm.reset();
alarm.destroy();

// Page visibility
onVisibilityChange(({ visible }) => {
  if (!visible) analytics.pause();
  else analytics.resume();
});
```

All factories return a `{ destroy }` handle for cleanup.

---

## Debug tooling

### StateDebugger

Live state inspector. Shows all keys with values and types. Inline JSON editing, add/remove keys, expand objects/arrays, filter keys, and watch individual keys with timestamped before/after diffs.

### RenderProfiler

Per-frame render timing with DOM operation counters. Shows:

- **Stat chips** — last, avg, max, p95 render times; red = over 16.67ms frame budget
- **Sparkline** — clickable bar chart of recent frames
- **Expanded detail** — timing breakdown (compute vs patch), changed state keys, DOM ops (visited, created, replaced, removed, moved, propSets, textEdits), mutation rate %

Profiling is **off by default** (zero overhead on the hot render path). Activates automatically when `RenderProfiler` renders; deactivates when the panel closes.

### FloatingPanel

Draggable, resizable floating window container. Position/size persists in module-level state keyed by `id`.

```js
import { FloatingPanel, StateDebugger, RenderProfiler, disableProfiler } from './src/index.js';

// In your view function, render alongside main content:
const view = state => [
  mainContent(state),
  FloatingPanel({
    id: 'debug', title: 'Debug Tools', open: state.debugOpen,
    onClose: () => { setState({ debugOpen: false }); disableProfiler(); },
  })([
    StateDebugger({ state, setState, getState }),
    RenderProfiler({ setState }),
  ]),
];
```

---

## Browser support

Targets modern evergreen browsers (Chrome, Firefox, Safari, Edge). Requirements:

- ES modules (`<script type="module">`)
- CSS custom properties
- `requestAnimationFrame`
- `Map`, `Set`, `WeakMap`
- Optional chaining (`?.`), nullish coalescing (`??`)
- `matchMedia` (breakpoint listeners)
- `getUserMedia` (only for `VideoStream`)

No polyfills. No transpilation. IE is not supported.

---

## Base library — odocosJS

dervoJS is built on [odocosJS](lib/odocosjs/), a functional JavaScript micro-library providing:

- **Church-encoded types** — `Maybe` (`Just` / `Nothing`), `Either` (`Left` / `Right`), `Pair`
- **Combinators** — `id`, `constant`, `Y`, `pipe`, `bind`, `guard`
- **Observable** — reactive `getValue` / `setValue` / `onChange`
- **vnode** — `vnode(tag)(props)(children)` produces plain `{ tag, props, children }` objects
- **createNode** — turns a vnode tree into real DOM

dervoJS uses `Observable` for its store, `createNode` for initial DOM construction, and the curried `vnode`/`vsnode` factories for its element system. The reconciler, component library, theming, and everything else is dervoJS's own code.

---

## License

See [lib/odocosjs/LICENSE](lib/odocosjs/LICENSE) for the odocosJS base library.