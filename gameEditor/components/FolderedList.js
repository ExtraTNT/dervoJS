/**
 * FolderedList - group a flat list of entities by their `folder` field and
 * render each group under a collapsible header.
 *
 * Curried so call sites read top-to-bottom:
 *
 *   FolderedList({ items, panelKey, collapsed, renderItem })
 *
 * Items keep their input order WITHIN a folder so the panels' insertion order
 * stays predictable. Folders are sorted alphabetically with the empty-folder
 * group ('') pinned at the top under "(no folder)".
 *
 * Collapsed state lives in `state.collapsedFolders[panelKey] = { [folder]: true }`
 * - call sites pass the slice in via `collapsed`. Toggling writes via setState
 * so it persists across re-renders.
 */

import { div, span, button, input, label, datalist, option } from '../../src/elements.js';
import { Stack } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setState } from '../store.js';

// Group a list by item.folder. Returns ordered [{ folder, items }] pairs with
// '' first, then alphabetically sorted folder names.
const _groupByFolder = items => {
  const groups = new Map();
  for (const it of items) {
    const key = (it.folder || '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const folders = [...groups.keys()].sort((a, b) => {
    if (a === '' && b !== '') return -1;
    if (a !== '' && b === '') return 1;
    return a.localeCompare(b);
  });
  return folders.map(folder => ({ folder, items: groups.get(folder) }));
};

const _toggle = panelKey => folder => isOpen => () => setState(s => ({
  collapsedFolders: {
    ...(s.collapsedFolders || {}),
    [panelKey]: {
      ...(s.collapsedFolders?.[panelKey] || {}),
      [folder]: isOpen,                    // store the CLOSED state (true = collapsed)
    },
  },
}));

const _folderHeader = panelKey => collapsed => ({ folder, count }) => {
  const isOpen = !collapsed[folder];
  return button({
    type:      'button',
    onclick:   _toggle(panelKey)(folder)(isOpen),
    className: 'gef-folder-header',
    style:     'display:flex; align-items:center; gap:6px; width:100%; padding:4px 6px; background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:.05em; font-weight:600; text-align:left',
  })([
    span({ style: 'font-size:9px; width:10px; display:inline-block' })([isOpen ? '▾' : '▸']),
    span({ style: 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap' })([
      folder === '' ? '(no folder)' : folder,
    ]),
    Badge({ variant: 'gray' })([String(count)]),
  ]);
};

const FolderedList = ({ items, panelKey, collapsed = {}, renderItem }) => {
  const groups = _groupByFolder(items);
  // Single-group + only the empty folder = no folder ceremony, just the items.
  // Keeps the panel quiet until the dev actually uses folders.
  if (groups.length === 1 && groups[0].folder === '') {
    return Stack({ gap: 4 })(groups[0].items.map(renderItem));
  }
  return Stack({ gap: 6 })(
    groups.map(({ folder, items: groupItems }) => {
      const isOpen = !collapsed[folder];
      return div({})([
        _folderHeader(panelKey)(collapsed)({ folder, count: groupItems.length }),
        ...(isOpen
          ? [div({ style: 'padding-left:6px; border-left:1px solid var(--border-2); margin-left:8px' })([
              Stack({ gap: 4 })(groupItems.map(renderItem)),
            ])]
          : []),
      ]);
    })
  );
};

// Curried helper for the per-editor "Folder" TextInput's datalist source.
// Returns an alpha-sorted list of unique non-empty folder names already in use.
const folderSuggestions = items => {
  const set = new Set();
  for (const it of items) {
    const f = (it.folder || '').trim();
    if (f) set.add(f);
  }
  return [...set].sort();
};

// Free-form folder text input with a native datalist of folder names already
// used elsewhere in the same entity list - gives the user one-tap autocomplete
// without forcing a "create folder" workflow.
//
//   FolderField({
//     id:          'item-folder',
//     value:       item.folder,
//     onChange:    v => set({ folder: v }),
//     suggestions: folderSuggestions(project.items),
//   })
const FolderField = ({ id, value = '', onChange, suggestions = [], placeholder = 'e.g. weapons/swords · leave blank for ungrouped' } = {}) => {
  const listId = `${id}-folders`;
  return div({ className: 'field' })([
    label({ htmlFor: id, className: 'field-label' })(['Folder (optional)']),
    input({
      id,
      type:        'text',
      className:   'input',
      value,
      list:        listId,
      placeholder,
      oninput:     e => onChange?.(e.target.value),
    })([]),
    datalist({ id: listId })(
      suggestions.map(s => option({ value: s })([]))
    ),
  ]);
};

// Build a folder-grouped option array for the shared Select component.
//
//   groupedOptions(project.rooms)(r => ({ value: r.id, label: r.title || r.id }))
//     → [ { value, label }, …               // entries with no folder, leading
//         { group: 'town',  options: [...] }, // <optgroup label="town">
//         { group: 'wilds', options: [...] }, // sorted alphabetically
//       ]
//
// Entries with `folder: ''` stay as flat leading leaves so a small project
// never sees the optgroup ceremony. Mix the result with a placeholder leaf
// at the top (e.g. `{ value: '', label: '- pick room -' }`) just like before
// - Select handles flat + grouped entries side-by-side.
const groupedOptions = items => toOption => {
  const groups = new Map();
  for (const it of items) {
    const key = (it.folder || '').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(toOption(it));
  }
  const flat = groups.get('') || [];
  const folders = [...groups.keys()].filter(k => k !== '').sort((a, b) => a.localeCompare(b));
  return [
    ...flat,
    ...folders.map(group => ({ group, options: groups.get(group) })),
  ];
};

export { FolderedList, FolderField, folderSuggestions, groupedOptions };
