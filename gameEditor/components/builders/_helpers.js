/**
 * Shared utilities for component builders. Pure functions over a Project — no
 * store side-effects so each builder stays testable.
 */

const slug = s => String(s || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Suffix `seed` with _2, _3, … until it's not in `existing`.
const uniqueId = (seed, existing) => {
  const used = existing instanceof Set ? existing : new Set(existing);
  let id = seed || 'id';
  let i = 2;
  while (used.has(id)) { id = `${seed}_${i++}`; }
  return id;
};

// Merge an entity (room / npc / item / …) into a project's array, returning a
// new project. `key` is the array field; `arr` is the new entities to append.
const appendToArray = key => arr => project => ({
  ...project,
  [key]: [...(project[key] || []), ...arr],
});

// Ensure a flag declaration exists; idempotent. Used so seeded flags show up
// in state.flags from game start.
const ensureFlag = key => initial => project => {
  const flags = project.flags || [];
  if (flags.some(f => f.key === key)) return project;
  return { ...project, flags: [...flags, { key, initial: Boolean(initial) }] };
};

// Same shape for a stat.
const ensureStat = key => initial => project => {
  const stats = project.stats || [];
  if (stats.some(s => s.key === key)) return project;
  return { ...project, stats: [...stats, { key, initial: Number(initial) || 0 }] };
};

// Add a sidebar widget if one with the same `kind`/`roomId` doesn't already
// exist. Also enables the sidebar if it was off — most adders want this.
const ensureSidebarWidget = predicate => widget => project => {
  const sidebar = project.sidebar || { enabled: false, widgets: [] };
  if ((sidebar.widgets || []).some(predicate)) return project;
  return {
    ...project,
    sidebar: {
      enabled: true,
      widgets: [...(sidebar.widgets || []), widget],
    },
  };
};

// Replace one entity in an array by id.
const patchById = key => id => patch => project => ({
  ...project,
  [key]: (project[key] || []).map(e => e.id === id ? { ...e, ...patch } : e),
});

// All taken ids on an entity array — used by uniqueId.
const idsOf = key => project => new Set((project[key] || []).map(e => e.id));
const flagKeys = project => new Set((project.flags || []).map(f => f.key));

export {
  slug, uniqueId,
  appendToArray, ensureFlag, ensureStat, ensureSidebarWidget, patchById,
  idsOf, flagKeys,
};
