import { div, span, input, button, strong } from '../elements.js';
import { cn } from '../utils.js';

// ── Private UI state ──────────────────────────────────────────────────────
// Lives at module level so it survives re-renders without touching the app store.
const _ui = {
  editKey:   null,   // key currently open for inline editing
  editDraft: '',     // JSON string being typed
  editError: null,   // parse error for editDraft
  newKey:    '',     // "Add entry" form — key field
  newVal:    '""',   // "Add entry" form — value field (JSON)
  addError:  null,   // parse error for newVal
  expand:    new Set(), // keys whose values are expanded to full JSON
  watched:   new Set(), // keys with active change listener
  log:       [],     // [{ ts, key, from, to }] — most recent 200 changes
  prevSnap:  null,   // state snapshot from previous render (for diffing)
  filter:    '',     // key filter string
  logFilter: '',     // log filter string
};

// ── Helpers ───────────────────────────────────────────────────────────────

const ts = () => new Date().toTimeString().slice(0, 8);

const typeOf = v => {
  if (v === undefined) return 'undefined';
  if (v === null)      return 'null';
  const t = typeof v;
  if (t !== 'object')  return t;
  return Array.isArray(v) ? 'array' : 'object';
};

const shortVal = (v, max = 60) => {
  if (typeof v === 'function') return 'ƒ ()';
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch { return String(v); }
};

const fullJson = v => {
  if (typeof v === 'function') return v.toString().slice(0, 400);
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

const applyEdit = setState => force => key => {
  try {
    setState({ [key]: JSON.parse(_ui.editDraft) });
    _ui.editKey = null;
    force();
  } catch (err) {
    _ui.editError = err.message;
    force();
  }
};

// ── Sub-renders ───────────────────────────────────────────────────────────

const typeTag = type =>
  span({ className: `dbg-type-tag dbg-type-${type}` })([type]);

const actionBtn = (extra = {}) => label => title => onClick =>
  button({ className: cn('dbg-btn', extra.cls), title, type: 'button', onclick: onClick, ...(extra.disabled && { disabled: true }) })([label]);

// ── Main component ────────────────────────────────────────────────────────

/**
 * StateDebugger — live inspector for any dervoJS store.
 *
 * Shows all state keys with their current value and type, lets you edit any
 * value as JSON, add new keys, delete keys, and watch individual keys for
 * changes. Watched keys append diffs to a scrollable change log panel.
 *
 * @param {Object}   opts
 * @param {Object}   opts.state      - Current app state (pass directly from your view).
 * @param {function} opts.setState   - Store's setState (plain patch object or updater fn).
 * @param {function} opts.getState   - Store's getState() — must read live state (no snapshot).
 * @returns {vnode}
 *
 * @example
 *   // In your debug panel (receives state from mount):
 *   StateDebugger({ state, setState, getState })
 */
const StateDebugger = ({ state, setState, getState }) => {
  const force = () => setState({});
  const apply = applyEdit(setState)(force);
  const add   = addEntry(setState)(force);
  const btn   = actionBtn({});

  // ── diff watched keys ────────────────────────────────────────────────
  if (_ui.prevSnap !== null) {
    const newEntries = [..._ui.watched]
      .filter(k => _ui.prevSnap[k] !== state[k])
      .map(k => ({
        ts:   ts(),
        key:  k,
        from: shortVal(_ui.prevSnap[k], 36),
        to:   shortVal(state[k], 36),
      }));
    if (newEntries.length)
      _ui.log = [...newEntries, ..._ui.log].slice(0, 200);
  }
  _ui.prevSnap = { ...state };

  // ── filter + sort keys ───────────────────────────────────────────────
  const allKeys      = Object.keys(state).sort();
  const filteredKeys = _ui.filter
    ? allKeys.filter(k => k.toLowerCase().includes(_ui.filter.toLowerCase()))
    : allKeys;

  // ── state tree rows ──────────────────────────────────────────────────
  const rows = filteredKeys.map(k => {
    const v         = state[k];
    const type      = typeOf(v);
    const isEditing = _ui.editKey === k;
    const isWatched = _ui.watched.has(k);
    const isExpand  = _ui.expand.has(k);
    const canEdit   = type !== 'function';

    return div({ className: cn('dbg-row', isWatched && 'dbg-row-watched'), key: k })([
      // key
      div({ className: 'dbg-cell dbg-key' })([strong({})([k])]),
      // type
      div({ className: 'dbg-cell dbg-type-cell' })([typeTag(type)]),
      // value / editor
      div({ className: 'dbg-cell dbg-val-cell' })([
        isEditing
          ? div({})([
              input({
                className: cn('dbg-input', _ui.editError && 'dbg-input-err'),
                value:     _ui.editDraft,
                oninput:   e => { _ui.editDraft = e.target.value; _ui.editError = null; force(); },
                onkeydown: e => {
                  if (e.key === 'Enter')  apply(k);
                  if (e.key === 'Escape') { _ui.editKey = null; force(); }
                },
              })([]),
              _ui.editError
                ? div({ className: 'dbg-err' })([_ui.editError])
                : div({ style: 'display:none' })([]),
            ])
          : div({})([
              span({
                className: 'dbg-val-text',
                title:     fullJson(v),
                onclick:   canEdit ? () => {
                  _ui.editKey   = k;
                  _ui.editDraft = shortVal(v, 9999);
                  _ui.editError = null;
                  force();
                } : null,
              })([isExpand ? fullJson(v) : shortVal(v)]),
            ]),
      ]),
      // actions
      div({ className: 'dbg-cell dbg-actions' })([
        isEditing
          ? div({ className: 'dbg-action-group' })([
              actionBtn({ cls: 'dbg-btn-ok'     })('✓')('Save (Enter)')(() => apply(k)),
              actionBtn({ cls: 'dbg-btn-cancel' })('✕')('Cancel (Esc)')(() => { _ui.editKey = null; force(); }),
            ])
          : div({ className: 'dbg-action-group' })([
              actionBtn({ disabled: !canEdit })('✎')('Edit value')(() => {
                _ui.editKey   = k;
                _ui.editDraft = shortVal(v, 9999);
                _ui.editError = null;
                force();
              }),
              actionBtn({ cls: isExpand  ? 'dbg-btn-active' : '' })('⤢')(isExpand  ? 'Collapse'     : 'Expand JSON')  (() => { isExpand  ? _ui.expand.delete(k)  : _ui.expand.add(k);  force(); }),
              actionBtn({ cls: isWatched ? 'dbg-btn-active' : '' })('👁')(isWatched ? 'Unwatch'      : 'Watch changes')(() => { isWatched ? _ui.watched.delete(k) : _ui.watched.add(k); force(); }),
              actionBtn({ cls: 'dbg-btn-del' })('✕')('Delete key')(() => {
                const next = {};
                Object.keys(getState()).filter(x => x !== k).forEach(x => { next[x] = getState()[x]; });
                console.log(next)
                setState(next);
              }),
            ]),
      ]),
    ]);
  });

  // ── add entry form ───────────────────────────────────────────────────
  const addRow = div({ className: 'dbg-add-row' })([
    input({
      className:   'dbg-input dbg-add-key',
      placeholder: 'key',
      value:       _ui.newKey,
      oninput:     e => { _ui.newKey = e.target.value; _ui.addError = null; force(); },
    })([]),
    input({
      className:   'dbg-input dbg-add-val',
      placeholder: 'value (JSON)',
      value:       _ui.newVal,
      oninput:     e => { _ui.newVal = e.target.value; _ui.addError = null; force(); },
      onkeydown:   e => { if (e.key === 'Enter') add(); },
    })([]),
    button({
      className: 'dbg-btn dbg-btn-add',
      type:      'button',
      onclick:   add,
    })(['+ Add']),
    _ui.addError
      ? span({ className: 'dbg-err' })([_ui.addError])
      : div({ style: 'display:none' })([]),
  ]);

  // ── change log ───────────────────────────────────────────────────────
  const visibleLog = _ui.logFilter
    ? _ui.log.filter(e => e.key.toLowerCase().includes(_ui.logFilter.toLowerCase()))
    : _ui.log;

  const logNodes = visibleLog.length
    ? visibleLog.map((e, i) =>
        div({ className: 'dbg-log-row', key: String(i) })([
          span({ className: 'dbg-log-ts' })([e.ts]),
          span({ className: 'dbg-log-key' })([e.key]),
          span({ className: 'dbg-log-from' })([e.from]),
          span({ className: 'dbg-log-arrow' })(['→']),
          span({ className: 'dbg-log-to' })([e.to]),
        ])
      )
    : [div({ className: 'dbg-log-empty' })([
        _ui.watched.size
          ? 'No changes yet for watched keys.'
          : 'Click 👁 next to a key to watch it.',
      ])];

  // ── render ───────────────────────────────────────────────────────────
  return div({ className: 'state-debugger' })([

    // toolbar
    div({ className: 'dbg-toolbar' })([
      input({
        className:   'dbg-input dbg-filter',
        placeholder: 'Filter keys…',
        value:       _ui.filter,
        oninput:     e => { _ui.filter = e.target.value; force(); },
      })([]),
      span({ className: 'dbg-toolbar-stat' })([
        `${filteredKeys.length} / ${allKeys.length} keys`,
        _ui.watched.size ? ` · ${_ui.watched.size} watched` : '',
      ]),
      btn('Clear log')('Clear change log')(() => { _ui.log = []; force(); }),
      btn('Reset UI')('Reset all debugger state')(() => {
        _ui.editKey = null; _ui.expand.clear(); _ui.watched.clear();
        _ui.log = []; _ui.filter = ''; _ui.logFilter = '';
        force();
      }),
    ]),

    // body: tree (left) + log (right)
    div({ className: 'dbg-body' })([

      // ── left: state tree ─────────────────────────────────────────────
      div({ className: 'dbg-tree' })([
        // header
        div({ className: 'dbg-row dbg-header' })([
          div({ className: 'dbg-cell dbg-key' })([span({})(['Key'])]),
          div({ className: 'dbg-cell dbg-type-cell' })([span({})(['Type'])]),
          div({ className: 'dbg-cell dbg-val-cell' })([span({})(['Value (click to edit)'])]),
          div({ className: 'dbg-cell dbg-actions' })([span({})(['Actions'])]),
        ]),
        ...rows,
        addRow,
      ]),

      // ── right: change log ─────────────────────────────────────────────
      div({ className: 'dbg-log-panel' })([
        div({ className: 'dbg-log-header' })([
          strong({})(['Change log']),
          span({ style: 'font-size:11px; color:var(--text-muted); margin-left:6px' })([
            `${_ui.log.length} entries`,
          ]),
        ]),
        input({
          className:   'dbg-input dbg-log-filter',
          placeholder: 'Filter log by key…',
          value:       _ui.logFilter,
          oninput:     e => { _ui.logFilter = e.target.value; force(); },
          style:       'margin-bottom:6px',
        })([]),
        div({ className: 'dbg-log-entries' })([...logNodes]),
      ]),
    ]),
  ]);
};

const addEntry = setState => force => () => {
  const k = _ui.newKey.trim();
  if (!k) { _ui.addError = 'Key is required'; force(); return; }
  try {
    setState({ [k]: JSON.parse(_ui.newVal) });
    _ui.newKey = '';
    _ui.newVal = '""';
    _ui.addError = null;
    force();
  } catch (err) {
    _ui.addError = 'Invalid JSON — ' + err.message;
    force();
  }
};

export { StateDebugger };
