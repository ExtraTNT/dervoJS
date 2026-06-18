/**
 * dervoJS - OpenAPI 3.0 / 3.1 compiler
 *
 * Pure functions for turning an OpenAPI document into the descriptors
 * `CrudResource` needs:
 *
 *   compileResource(spec)(resource) =>
 *     {
 *       basePath, itemPath, idParam,
 *       listOp, createOp, showOp, updateOp, deleteOp,
 *       fields,                  // for new/edit form
 *       listItemFields,          // for the list table columns
 *       showFields,              // for the show view
 *     }
 *
 * Each field is a recursive descriptor:
 *
 *   {
 *     name, title, description,
 *     type     : 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object',
 *     format?, enum?, default?,
 *     required, nullable, readOnly,
 *     minLength?, maxLength?, pattern?,
 *     minimum?,   maximum?,   step?,
 *     items?,      // for arrays - single nested field descriptor
 *     properties?, // for objects - array of nested field descriptors
 *   }
 *
 * 3.0 vs 3.1 differences handled:
 *   - `nullable: true`  (3.0)        ->  3.1 `type: ['x', 'null']`
 *   - `example` vs `examples`        ->  both accepted
 *   - `const`            (3.1)       ->  treated as a single-value enum
 *   - `$ref` resolution              ->  local refs only (`#/components/...`)
 */

//  ref resolution 

/** Resolve a local `$ref` like `#/components/schemas/User` against the spec root. */
const resolveRef = spec => ref => {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  return ref.slice(2).split('/').reduce((acc, k) => acc?.[k], spec);
};

/** Dereference a schema once (idempotent on plain schemas). */
const _deref = spec => schema => {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref) return _deref(spec)(resolveRef(spec)(schema.$ref)) ?? schema;
  return schema;
};

//  type-system normalisation 

const _isNullable = schema =>
  schema.nullable === true ||
  (Array.isArray(schema.type) && schema.type.includes('null'));

const _primaryType = schema => {
  if (Array.isArray(schema.type)) return schema.type.find(t => t !== 'null') || 'string';
  if (schema.const !== undefined && schema.type === undefined) return typeof schema.const;
  return schema.type || (schema.properties ? 'object' : schema.items ? 'array' : 'string');
};

const _titleCase = s =>
  String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^./, c => c.toUpperCase());

//  field compilation 

const _compileField = spec => (name, raw, isRequired) => {
  const s        = _deref(spec)(raw) || {};
  const t        = _primaryType(s);
  const nullable = _isNullable(s);
  const enumVals = s.enum ?? (s.const !== undefined ? [s.const] : undefined);

  const base = {
    name,
    title:       s.title || _titleCase(name),
    description: s.description,
    type:        t,
    format:      s.format,
    enum:        enumVals,
    default:     s.default,
    nullable,
    required:    isRequired && !nullable,
    readOnly:    s.readOnly === true,
  };

  if (t === 'string') {
    if (s.minLength != null) base.minLength = s.minLength;
    if (s.maxLength != null) base.maxLength = s.maxLength;
    if (s.pattern)            base.pattern  = s.pattern;
  }
  if (t === 'integer' || t === 'number') {
    if (s.minimum != null) base.minimum = s.minimum;
    if (s.maximum != null) base.maximum = s.maximum;
    base.step = t === 'integer' ? (s.multipleOf || 1) : (s.multipleOf || 'any');
  }
  if (t === 'array') {
    base.items = _compileField(spec)('item', s.items || {}, false);
  }
  if (t === 'object') {
    base.properties = _compileObject(spec)(s);
  }
  return base;
};

const _compileObject = spec => schema => {
  const s   = _deref(spec)(schema) || {};
  const req = new Set(s.required || []);
  return Object.entries(s.properties || {})
    .map(([k, v]) => _compileField(spec)(k, v, req.has(k)));
};

//  path/operation discovery 

const _segments = path => path.split('/').filter(Boolean);
const _isParam  = seg  => /^\{.+\}$/.test(seg);

/**
 * Locate the CRUD operations for a given resource. The resource string is
 * matched as a path segment, so `'users'` finds `/users`, `/api/users`,
 * `/v1/users/{id}` - but not `/usergroups`.
 */
const _findOps = spec => resource => {
  const paths = spec.paths || {};
  const out   = {
    basePath: null, itemPath: null, idParam: 'id',
    listOp: null, createOp: null, showOp: null, updateOp: null, deleteOp: null,
  };

  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;
    const segs = _segments(path);
    const idx  = segs.lastIndexOf(resource);
    if (idx === -1) continue;
    const after = segs.slice(idx + 1);

    if (after.length === 0) {
      if (methods.get)  out.listOp   = { path, op: methods.get,  method: 'get'  };
      if (methods.post) out.createOp = { path, op: methods.post, method: 'post' };
      out.basePath = path;
    } else if (after.length === 1 && _isParam(after[0])) {
      if (methods.get)    out.showOp   = { path, op: methods.get,    method: 'get'    };
      if (methods.patch)  out.updateOp = { path, op: methods.patch,  method: 'patch'  };
      if (methods.put)    out.updateOp = out.updateOp || { path, op: methods.put, method: 'put' };
      if (methods.delete) out.deleteOp = { path, op: methods.delete, method: 'delete' };
      out.itemPath = path;
      out.idParam  = after[0].slice(1, -1);
    }
  }
  return out;
};

//  schema extraction from operations 

const _requestSchema = spec => opEntry => {
  const c = opEntry?.op?.requestBody?.content?.['application/json'];
  return c ? _deref(spec)(c.schema) : null;
};

const _responseSchema = spec => opEntry => {
  const responses = opEntry?.op?.responses || {};
  for (const code of ['200', '201', '202', 'default']) {
    const s = responses[code]?.content?.['application/json']?.schema;
    if (s) return _deref(spec)(s);
  }
  return null;
};

/** Pull the per-item schema out of a list response (handles array + paginated wrappers). */
const _itemSchema = spec => listSchema => {
  if (!listSchema) return null;
  const s = _deref(spec)(listSchema);
  if (s.type === 'array' || s.items) return _deref(spec)(s.items);
  for (const key of ['items', 'data', 'results', 'rows']) {
    const sub = s.properties?.[key];
    if (sub) {
      const r = _deref(spec)(sub);
      if (r?.type === 'array' || r?.items) return _deref(spec)(r.items);
    }
  }
  return s;
};

//  public API 

/**
 * Compile a single resource out of an OpenAPI document.
 *
 * @param {object} spec       - Parsed OpenAPI 3.0 or 3.1 document.
 * @returns {function} resource => compiled
 */
const compileResource = spec => resource => {
  const ops = _findOps(spec)(resource);

  // Prefer the create request body for the form schema (it's usually the
  // editable shape: no id, no readOnly server-generated fields). Fall back
  // to the update body, then the show response, then a list item.
  const formSrc =
       _requestSchema(spec)(ops.createOp)
    || _requestSchema(spec)(ops.updateOp)
    || _responseSchema(spec)(ops.showOp)
    || _itemSchema(spec)(_responseSchema(spec)(ops.listOp));

  const showSrc =
       _responseSchema(spec)(ops.showOp)
    || _itemSchema(spec)(_responseSchema(spec)(ops.listOp))
    || formSrc;

  const listSrc = _itemSchema(spec)(_responseSchema(spec)(ops.listOp)) || showSrc;

  return {
    ops,                       // { basePath, itemPath, idParam, listOp, createOp, showOp, updateOp, deleteOp }
    idParam:        ops.idParam,
    fields:         formSrc ? _compileObject(spec)(formSrc) : [],
    showFields:     showSrc ? _compileObject(spec)(showSrc) : [],
    listItemFields: listSrc ? _compileObject(spec)(listSrc) : [],
  };
};

export {
  compileResource,
  resolveRef,
  // exposed for testing / advanced overrides:
  _compileField  as compileField,
  _compileObject as compileObject,
};
