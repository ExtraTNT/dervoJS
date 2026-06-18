/**
 * Form adapters and pure helpers for editor panels and builders.
 */

/** Adapt onChange(e) -> setter(e.target.value). */
const onText  = setter => e => setter(e?.target?.value ?? '');
/** Adapt onChange(e) -> setter(e.target.checked). */
const onCheck = setter => e => setter(!!e?.target?.checked);

// Immutable array ops. Curried, return new arrays, never mutate input.

/** Replace arr[i] with mapFn(row), or with merge if mapFn is an object. */
const updateAt = i => mapFn => arr => arr.map((row, k) => {
  if (k !== i) return row;
  return typeof mapFn === 'function' ? mapFn(row) : { ...row, ...mapFn };
});

/** Drop arr[i]. */
const removeAt = i => arr => arr.filter((_, k) => k !== i);

/** Swap arr[i] with arr[i+dir]. Out-of-range returns arr unchanged. */
const swapAt = i => dir => arr => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  return arr.map((row, k) => k === i ? arr[j] : k === j ? arr[i] : row);
};

/** Append row to the end of arr. */
const appendTo = row => arr => [...arr, row];

// Project-level helpers. Pure over Project, no store side-effects.

/** Lowercase the string, replace runs of non-alphanumerics with '_', trim '_' ends. */
const slug = s => String(s || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

/** First id of the form seed, seed_2, seed_3, ... not in `existing`. */
const uniqueId = (seed, existing) => {
  const used = existing instanceof Set ? existing : new Set(existing);
  const base = seed || 'id';
  // One `let` for the iterative search; allocating a candidate array up front
  // would be wasteful for the common case of zero or one collision.
  let id = base, i = 2;
  while (used.has(id)) id = `${base}_${i++}`;
  return id;
};

/** Set of taken ids on a named project array. */
const idsOf    = key => project => new Set((project[key] || []).map(e => e.id));
/** Set of declared flag keys. */
const flagKeys = project => new Set((project.flags || []).map(f => f.key));

/** Append entities to project[key]. Curried: appendToArray('rooms')(rooms)(p). */
const appendToArray = key => arr => project => ({
  ...project,
  [key]: [...(project[key] || []), ...arr],
});

/** Shallow-merge patch into project[key].find(e => e.id === id). No-op if missing. */
const patchById = key => id => patch => project => ({
  ...project,
  [key]: (project[key] || []).map(e => e.id === id ? { ...e, ...patch } : e),
});

/** Add { key, initial } to project.flags if not present. Idempotent. */
const ensureFlag = key => initial => project =>
  (project.flags || []).some(f => f.key === key)
    ? project
    : { ...project, flags: [...(project.flags || []), { key, initial: Boolean(initial) }] };

/** Add { key, type:'number', initial } to project.stats if not present. Idempotent. */
const ensureStat = key => initial => project =>
  (project.stats || []).some(s => s.key === key)
    ? project
    : { ...project, stats: [...(project.stats || []), { key, type: 'number', initial: Number(initial) || 0 }] };

/** Add widget to project.sidebar.widgets if no current widget matches predicate. Enables the sidebar. */
const ensureSidebarWidget = predicate => widget => project => {
  const sidebar = project.sidebar || { enabled: false, widgets: [] };
  if ((sidebar.widgets || []).some(predicate)) return project;
  return {
    ...project,
    sidebar: { ...sidebar, enabled: true, widgets: [...(sidebar.widgets || []), widget] },
  };
};

/** vars(project) bundle for Effect / Condition editors. statTypes drives type-aware ops; numStats filters arithmetic-only pickers. */
const projectVars = project => ({
  stats:     project.stats.map(s => s.key).filter(Boolean),
  statTypes: Object.fromEntries(project.stats.filter(s => s.key).map(s => [s.key, s.type || 'number'])),
  numStats:  project.stats.filter(s => s.key && (s.type || 'number') === 'number').map(s => s.key),
  flags:     project.flags.map(f => f.key).filter(Boolean),
  items:     project.items || [],
  skills:    project.skills || [],
  npcs:      project.npcs || [],
  rooms:     project.rooms || [],
  combats:   project.combats || [],
});

export {
  onText, onCheck,
  updateAt, removeAt, swapAt, appendTo,
  projectVars,
  slug, uniqueId, idsOf, flagKeys,
  appendToArray, patchById, ensureFlag, ensureStat, ensureSidebarWidget,
};
