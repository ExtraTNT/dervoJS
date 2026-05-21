/**
 * dervoJS — CrudResource
 *
 * Curried factory that turns an OpenAPI document into ready-to-render CRUD
 * views. Each curry step earns its keep: a value bound at that level is
 * reused by every later call.
 *
 *   createCrud :: HttpClient -> BasePath -> Spec -> Resource -> Opts -> Vnode
 *                 reused app-wide  per-backend   per-service  per-resource
 *
 * @example
 *   const withHttp = createCrud(http);
 *   const withApi  = withHttp('/api');
 *   const Crud     = withApi(openapiSpec);
 *
 *   const Users    = Crud('users');
 *   const Projects = Crud('projects');
 *
 *   // Per call:
 *   Users({ state: state.users, setState: patchUsers, view: 'list' });
 *   Users({ state: state.users, setState: patchUsers, view: 'edit', id: 42 });
 *
 * State is owned by the caller (parent store), as with every other dervoJS
 * component. The factory tells you exactly which keys to seed:
 *
 *   { view, id, data, total, loading, error, form, formErrors, confirmDelete }
 */

import { div, h2, h3, p, span, form as formEl, dl, dt, dd } from '../elements.js';
import { Button }         from './Button.js';
import { TextInput }      from './TextInput.js';
import { NumberInput }    from './NumberInput.js';
import { Select }         from './Select.js';
import { Toggle }         from './Toggle.js';
import { DateTimePicker } from './DateTimePicker.js';
import { Card }           from './Card.js';
import { Alert }          from './Alert.js';
import { Badge }          from './Badge.js';
import { Table }          from './Table.js';
import { Modal }          from './Modal.js';
import { defaultHttp }    from '../http.js';
import { compileResource } from '../openapi.js';
import {
  validate, required as requiredRule, minLength, maxLength,
  email, pattern, range, validateForm, isFormValid,
} from '../validate.js';

// pure path helpers (nested form state) 

const _setIn = (obj, path, value) => {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const isArray = typeof head === 'number';
  const base    = obj ?? (isArray ? [] : {});
  if (isArray) {
    const next = [...base];
    next[head] = _setIn(base[head], rest, value);
    return next;
  }
  return { ...base, [head]: _setIn(base[head], rest, value) };
};

// validator derivation from compiled fields 

const _rulesFor = field => {
  const rules = [];
  if (field.required) rules.push(requiredRule(`${field.title} is required`));
  if (field.type === 'string') {
    if (field.format === 'email') rules.push(email());
    if (field.minLength != null)  rules.push(minLength(field.minLength));
    if (field.maxLength != null)  rules.push(maxLength(field.maxLength));
    if (field.pattern)            rules.push(pattern(new RegExp(field.pattern)));
  }
  if ((field.type === 'integer' || field.type === 'number') &&
      (field.minimum != null || field.maximum != null)) {
    rules.push(range(field.minimum ?? -Infinity, field.maximum ?? Infinity));
  }
  return rules;
};

const _schemaFor = fields => {
  const out = {};
  for (const f of fields) {
    const rules = _rulesFor(f);
    if (rules.length) out[f.name] = validate(...rules);
  }
  return out;
};

const _defaultValue = field => {
  if (field.default !== undefined) return field.default;
  if (field.enum?.length)            return '';
  switch (field.type) {
    case 'string':  return '';
    case 'integer':
    case 'number':  return 0;
    case 'boolean': return false;
    case 'array':   return [];
    case 'object':  return Object.fromEntries(
      (field.properties || []).map(p => [p.name, _defaultValue(p)])
    );
    default:        return null;
  }
};

const _seedForm = fields => Object.fromEntries(
  fields.filter(f => !f.readOnly).map(f => [f.name, _defaultValue(f)])
);

// field rendering 

const _formatDisplay = (field, value) => {
  if (value == null || value === '') return span({ style: 'color:var(--text-muted)' })(['—']);
  if (field.type === 'boolean')      return Badge({ variant: value ? 'green' : 'gray' })([value ? 'Yes' : 'No']);
  if (field.format === 'date-time' || field.format === 'date') {
    try { return String(new Date(value).toLocaleString()); } catch (_) { return String(value); }
  }
  if (field.type === 'array')  return Badge({ variant: 'blue' })([`${value.length} item${value.length === 1 ? '' : 's'}`]);
  if (field.type === 'object') return span({ style: 'color:var(--text-muted)' })(['{…}']);
  return String(value);
};

// Append an error message under an input that doesn't natively render one.
// Used for NumberInput and DateTimePicker (TextInput and the patched Select
// own their own error span).
const _withError = error => input =>
  !error ? input : div({})([
    input,
    span({ className: 'field-error', style: 'display:block; margin-top:-4px' })([error]),
  ]);

const _renderInput = (field, path, value, error, onPatch, disabled) => {
  const id = `crud-${path.join('-')}`;
  const set = v => onPatch(path, v);

  // Enums always become a Select regardless of underlying type.
  // Always show a placeholder option — without one, the browser displays the
  // first real option while state stays '', and the UI lies about what's saved.
  if (field.enum?.length) {
    return Select({
      id, label: field.title,
      options: field.enum.map(v => ({ value: String(v), label: String(v) })),
      value: value == null ? '' : String(value),
      placeholder: field.required ? 'Choose…' : '— none —',
      disabled,
      error,
      onChange: e => set(e.target.value),
    });
  }

  if (field.type === 'boolean') {
    return div({ className: 'field', style: 'display:flex; align-items:center; gap:12px; padding:6px 0' })([
      Toggle({ on: !!value, onChange: set, disabled })([field.title]),
      ...(error ? [span({ className: 'field-error' })([error])] : []),
    ]);
  }

  if (field.type === 'integer' || field.type === 'number') {
    return _withError(error)(NumberInput({
      id, label: field.title,
      value: Number(value ?? 0),
      min: field.minimum, max: field.maximum, step: field.step,
      disabled,
      onChange: set,
    }));
  }

  if (field.type === 'string' && (field.format === 'date' || field.format === 'date-time')) {
    return _withError(error)(DateTimePicker({
      id, label: field.title,
      value: value ?? '',
      showTime: field.format === 'date-time',
      onChange: set,
    }));
  }

  if (field.type === 'array' && field.items) {
    const items = Array.isArray(value) ? value : [];
    return div({ className: 'field', style: 'padding:6px 0' })([
      div({ className: 'field-label' })([field.title]),
      div({ style: 'display:flex; flex-direction:column; gap:8px; padding:8px 0 0 12px; border-left:2px solid var(--border)' })(
        items.length
          ? items.map((item, i) =>
              div({ key: `item-${i}`, style: 'display:flex; gap:8px; align-items:flex-start' })([
                div({ style: 'flex:1' })([
                  _renderInput(
                    { ...field.items, title: `#${i + 1}` },
                    [...path, i], item, null, onPatch, disabled,
                  ),
                ]),
                Button({
                  variant: 'ghost', size: 'sm',
                  onClick: () => set(items.filter((_, j) => j !== i)),
                })(['✕']),
              ])
            )
          : [span({ style: 'color:var(--text-muted); font-size:12px' })(['(empty)'])]
      ),
      div({ style: 'margin-top:8px' })([
        Button({
          variant: 'secondary', size: 'sm',
          onClick: () => set([...items, _defaultValue(field.items)]),
        })(['+ Add']),
      ]),
    ]);
  }

  if (field.type === 'object' && field.properties) {
    return Card({ title: field.title, className: 'crud-nested', style: 'margin:8px 0' })(
      field.properties.map(p =>
        _renderInput(p, [...path, p.name], value?.[p.name], null, onPatch, disabled || p.readOnly)
      )
    );
  }

  // Default: text input (covers string, unknown, and string formats not above)
  return TextInput({
    id, label: field.title,
    type: field.format === 'email' ? 'email' : (field.format === 'password' ? 'password' : 'text'),
    value: value ?? '',
    hint: field.description,
    error,
    disabled,
    onInput: e => set(e.target.value),
  });
};

//  flat-form validation (top-level fields only) 

const _validateForm = fields => values => {
  const schema = _schemaFor(fields);
  const errors = validateForm(schema)(values);
  return { errors, ok: isFormValid(errors) };
};

//  side-effect dispatcher 
// Effects must run *after* the current render — never inside it. queueMicrotask
// runs before paint but after the synchronous render returns, which means
// setState calls won't trigger render re-entry.

const _runEffect = fn => queueMicrotask(fn);

const _loadKey = ({ view, id }) => `${view}:${id ?? ''}`;

// URL builders — deduplicate the same template-fill done in 4 places.
const _listUrl = ctx => `${ctx.basePath}${ctx.ops.basePath || `/${ctx.resource}`}`;
const _itemUrl = ctx => `${ctx.basePath}${ctx.ops.itemPath?.replace(`{${ctx.idParam}}`, ctx.id) || `/${ctx.resource}/${ctx.id}`}`;

// Trigger a fetch when the view's data isn't loaded. The expected key is
// closed over so a stale response can't clobber a newer view's state.
const _load = (ctx, fetcher, onData) => {
  if (ctx.state._loadedKey === _loadKey(ctx) || ctx.state.loading) return;
  const expect = _loadKey(ctx);
  _runEffect(() => {
    ctx.setState({ loading: true, error: null, _loadedKey: expect });
    fetcher()
      .then(data => ctx.setState(s => s._loadedKey === expect ? { ...onData(data), loading: false } : {}))
      .catch(err => ctx.setState(s => s._loadedKey === expect ? { error: err.message, loading: false } : {}));
  });
};

//  view: list 

const _viewList = ctx => {
  const { state, setState, listItemFields, ops, http, hideFields, listColumns, mountId, idParam } = ctx;

  _load(ctx,
    () => http.list(_listUrl(ctx))({}),
    ([data, total]) => ({ data, total }),
  );

  const visible = (listColumns
    ? listColumns.map(k => listItemFields.find(f => f.name === k)).filter(Boolean)
    : listItemFields.filter(f => f.type !== 'object' && f.type !== 'array')
  ).filter(f => !(hideFields || []).includes(f.name));

  // Table calls render(raw, row) — `raw` is row[col.key], `row` is the full row.
  // Data columns just need `raw`; the actions column needs the whole `row`.
  const cols = [
    ...visible.map(f => ({
      key:    f.name,
      label:  f.title,
      sort:   true,
      filter: true,
      render: raw => _formatDisplay(f, raw),
    })),
    {
      key: '__actions',
      label: '',
      render: (_raw, row) => div({ style: 'display:flex; gap:6px; justify-content:flex-end' })([
        ...(ops.showOp ? [Button({ variant: 'ghost', size: 'sm',
          onClick: () => setState({ view: 'show', id: row[idParam], _loadedKey: null, data: undefined }),
        })(['View'])] : []),
        ...(ops.updateOp ? [Button({ variant: 'secondary', size: 'sm',
          onClick: () => setState({ view: 'edit', id: row[idParam], _loadedKey: null, data: undefined, form: null, formErrors: {} }),
        })(['Edit'])] : []),
        ...(ops.deleteOp ? [Button({ variant: 'danger', size: 'sm',
          onClick: () => setState({ confirmDelete: row[idParam] }),
        })(['Delete'])] : []),
      ]),
    },
  ];

  const rows = Array.isArray(state.data) ? state.data : [];

  return div({})([
    div({ style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px' })([
      h2({ style: 'margin:0; font-size:20px' })([_titleFromResource(ctx.resource)]),
      div({ style: 'display:flex; gap:8px; align-items:center' })([
        ...(state.total != null ? [Badge({ variant: 'gray' })([`${state.total} total`])] : []),
        ...(ops.createOp ? [Button({
          onClick: () => setState({
            view: 'new', id: null,
            form: _seedForm(ctx.fields),
            formErrors: {}, error: null,
          }),
        })(['+ New'])] : []),
      ]),
    ]),
    ...(state.error   ? [Alert({ variant: 'error' })([state.error])]                 : []),
    ...(state.loading ? [p({ style: 'color:var(--text-muted)' })(['Loading…'])]      : []),
    !state.loading && rows.length === 0 && !state.error
      ? p({ style: 'color:var(--text-muted)' })(['No records.'])
      : Table({
          columns: cols,
          rows,
          showFilter: true,
          filter: state.filter ?? '',
          onFilterChange: v => setState({ filter: v }),
          filterId: `${mountId}-filter`,
          sort: state.sort,
          onSort: (key, dir) => setState({ sort: { key, dir } }),
        }),
    _deleteModal(ctx),
  ])
};

//  view: show 

const _viewShow = ctx => {
  const { state, setState, showFields, ops, http, id, hideFields } = ctx;

  _load(ctx,
    () => http.get(_itemUrl(ctx))({}),
    data => ({ data }),
  );

  const data = state.data || {};
  const visible = showFields.filter(f => !(hideFields || []).includes(f.name));

  return div({})([
    div({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:12px' })([
      Button({ variant: 'ghost', size: 'sm',
        onClick: () => setState({ view: 'list', id: null, data: undefined, _loadedKey: null }),
      })(['← Back']),
      h2({ style: 'margin:0; font-size:20px' })([`${_titleFromResource(ctx.resource)} #${id}`]),
      div({ style: 'flex:1' })([]),
      ...(ops.updateOp ? [Button({ variant: 'secondary',
        onClick: () => setState({ view: 'edit', form: { ...data }, formErrors: {}, error: null }),
      })(['Edit'])] : []),
      ...(ops.deleteOp ? [Button({ variant: 'danger',
        onClick: () => setState({ confirmDelete: id }),
      })(['Delete'])] : []),
    ]),
    ...(state.error   ? [Alert({ variant: 'error' })([state.error])]              : []),
    ...(state.loading ? [p({ style: 'color:var(--text-muted)' })(['Loading…'])]   : []),
    ...(!state.loading ? [Card({})([
      dl({ style: 'display:grid; grid-template-columns:max-content 1fr; gap:8px 16px; margin:0' })(
        visible.flatMap(f => [
          dt({ style: 'font-weight:600; color:var(--text-muted)' })([f.title]),
          dd({ style: 'margin:0' })([_formatDisplay(f, data[f.name])]),
        ])
      ),
    ])] : []),
    _deleteModal(ctx),
  ])
};

// view: edit / new 

const _viewForm = mode => ctx => {
  const isNew = mode === 'new';
  const { state, setState, fields, ops, http, id, resource, hideFields, onSuccess, onError } = ctx;

  // For edit: load the item and seed the form from it.
  if (!isNew) {
    _load(ctx,
      () => http.get(_itemUrl(ctx))({}),
      data => ({ data, form: { ...data }, formErrors: {} }),
    );
  }

  const visible = fields.filter(f => !f.readOnly && !(hideFields || []).includes(f.name));
  const values  = state.form ?? (isNew ? _seedForm(visible) : {});

  const patchPath = (path, value) =>
    setState(s => ({ form: _setIn(s.form ?? {}, path, value), formErrors: { ...s.formErrors, [path[0]]: null } }));

  const submit = () => {
    const { errors, ok } = _validateForm(visible)(values);
    console.log(errors);
    if (!ok) { setState({ formErrors: errors }); return; }
    setState({ submitting: true, error: null });
    const finish = data => {
      onSuccess?.(data);
      // Always return to list and force a refetch
      setState({
        view: 'list', id: null, data: undefined, form: null, formErrors: {},
        submitting: false, _loadedKey: null,
      });
    };
    const fail = err => {
      onError?.(err);
      setState({ error: err.message, submitting: false });
    };
    if (isNew) {
      http.post(_listUrl(ctx))(values)({}).then(finish).catch(fail);
    } else {
      const send = ops.updateOp.method === 'patch' ? http.patch : http.put;
      send(_itemUrl(ctx))(values)({}).then(finish).catch(fail);
    }
  };

  return div({})([
    div({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:12px' })([
      Button({ variant: 'ghost', size: 'sm',
        onClick: () => setState({ view: 'list', id: null, data: undefined, form: null, formErrors: {}, _loadedKey: null }),
      })(['← Cancel']),
      h2({ style: 'margin:0; font-size:20px' })([
        isNew ? `New ${_titleFromResource(resource).replace(/s$/, '')}` : `Edit ${_titleFromResource(resource)} #${id}`,
      ]),
    ]),
    ...(state.error ? [Alert({ variant: 'error' })([state.error])] : []),
    state.loading
      ? p({ style: 'color:var(--text-muted)' })(['Loading…'])
      : Card({})([
          formEl({ onsubmit: e => { e.preventDefault(); submit(); } })([
            ...visible.map(f =>
              _renderInput(f, [f.name], values[f.name], state.formErrors?.[f.name], patchPath, false)
            ),
            div({ style: 'display:flex; gap:10px; margin-top:16px' })([
              // type='submit' alone — the form's onsubmit handler runs submit().
              // Adding onClick would double-fire (click event + submit event).
              Button({ type: 'submit', disabled: state.submitting })([
                state.submitting ? 'Saving…' : (isNew ? 'Create' : 'Save'),
              ]),
              Button({ variant: 'secondary', disabled: state.submitting,
                onClick: () => setState({ view: 'list', id: null, data: undefined, form: null, formErrors: {}, _loadedKey: null }),
              })(['Cancel']),
            ]),
          ]),
        ]),
  ])
};

// delete confirmation modal (shared) 

const _deleteModal = ctx => {
  const { state, setState, http, resource, onSuccess, onError } = ctx;
  const id = state.confirmDelete;
  if (id == null) return Modal({ open: false })([]);

  const doDelete = () => {
    setState({ submitting: true, error: null });
    // Use the row's id for URL building, not whatever ctx.id happens to be.
    const url = _itemUrl({ ...ctx, id });
    http.remove(url)(null)({})
      .then(() => {
        onSuccess?.({ deleted: id });
        setState({
          confirmDelete: null, submitting: false,
          view: 'list', id: null, data: undefined, _loadedKey: null,
        });
      })
      .catch(err => {
        onError?.(err);
        setState({ error: err.message, submitting: false, confirmDelete: null });
      });
  };

  return Modal({
    open: true,
    title: 'Confirm delete',
    onClose: () => setState({ confirmDelete: null }),
    footer: [
      Button({ variant: 'secondary',
        onClick: () => setState({ confirmDelete: null }),
      })(['Cancel']),
      Button({ variant: 'danger', disabled: state.submitting,
        onClick: doDelete,
      })([state.submitting ? 'Deleting…' : 'Delete']),
    ],
  })([p({})([`Delete ${_titleFromResource(resource).replace(/s$/, '')} #${id}? This cannot be undone.`])]);
};

const _titleFromResource = r =>
  String(r || '').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());

// public factory 

/**
 * Build a CRUD factory for an HTTP client, base path, and OpenAPI spec.
 *
 * @param {HttpClient}  [http=defaultHttp]
 * @returns {function} basePath => spec => resource => opts => vnode
 */
const createCrud = (http = defaultHttp) => basePath => spec => {
  const _cache = new Map();          // resource -> compiled descriptors

  return resource => {
    if (!_cache.has(resource))
      _cache.set(resource, compileResource(spec)(resource));
    const compiled = _cache.get(resource);

    /**
     * @param {object}   opts
     * @param {object}   opts.state          Current state slice for this resource.
     * @param {function} opts.setState       Setter that writes to that slice.
     * @param {'list'|'show'|'edit'|'new'} [opts.view]  Override state.view.
     * @param {*}        [opts.id]           Override state.id (for show/edit).
     * @param {string[]} [opts.hideFields]   Field names to hide from every view.
     * @param {string[]} [opts.listColumns]  Pin list columns (else auto from scalars).
     * @param {function} [opts.onSuccess]
     * @param {function} [opts.onError]
     * @param {string}   [opts.mountId]      Unique id for inputs when rendering multiple.
     * @returns {vnode}
     */
    return (opts = {}) => {
      const state    = opts.state ?? {};
      const setState = opts.setState ?? (() => {});
      const view     = opts.view ?? state.view ?? 'list';
      const id       = opts.id   ?? state.id;

      const ctx = {
        ...compiled, ...opts,
        http, basePath, resource, view, id,
        state, setState,
        mountId: opts.mountId || `crud-${resource}`,
      };

      switch (view) {
        case 'show': return _viewShow(ctx);
        case 'edit': return _viewForm('edit')(ctx);
        case 'new':  return _viewForm('new')(ctx);
        default:     return _viewList(ctx);
      }
    };
  };
};

export { createCrud };
