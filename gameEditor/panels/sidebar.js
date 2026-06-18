/**
 * Sidebar panel - configure the in-game left column.
 *
 * The player's sidebar in createGame is `(ctx) => vnode[]`. We compose that
 * function in preview.js / codegen.js from a list of widgets:
 *   - title:     game title block
 *   - portrait:  layered paper-doll (see PortraitEditor)
 *   - stats:     selected stats as a labelled list
 *   - inventory: count of each item in the player's inventory
 *   - roomLink:  button that navigates to a target room (e.g. phone / map)
 *   - minimap:   compact map of reachable rooms with current/visited highlights
 *   - js:        arbitrary `(ctx) => vnode` body the author writes themselves
 *
 * Widgets are reordered via DragList. The order here is the render order in
 * the sidebar (top-to-bottom). Each widget keeps its own config inline.
 */

import { div, span, h2, p, button, textarea } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, DragList } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState } from '../store.js';
import { emptyWidget } from '../schema.js';
import { onText, onCheck } from '../helpers.js';
import { PortraitEditor } from '../components/PortraitEditor.js';
import { groupedOptions } from '../components/FolderedList.js';

const WIDGET_OPTS = [
  { value: 'title',     label: 'Title block'        },
  { value: 'portrait',  label: 'Portrait (layered)' },
  { value: 'stats',     label: 'Stats list'         },
  { value: 'inventory', label: 'Inventory'          },
  { value: 'roomLink',  label: 'Room link button'   },
  { value: 'minimap',   label: 'Minimap'            },
  { value: 'js',        label: 'JS widget'          },
];

const _setSidebar = patch => setProject(p => ({ ...p, sidebar: { ...p.sidebar, ...patch } }));
// Curried: `_setWidget(id)(patch)`. Patch may be a plain object (shallow
// merge) or a function `w => next`. Per-editor `set = _setWidget(widget.id)`
// shrinks the call sites considerably.
const _setWidget = id => patch => setProject(p => ({
  ...p,
  sidebar: {
    ...p.sidebar,
    widgets: p.sidebar.widgets.map(w => w.id === id ? (typeof patch === 'function' ? patch(w) : { ...w, ...patch }) : w),
  },
}));
const _addWidget = type => setProject(p => ({
  ...p,
  sidebar: { ...p.sidebar, widgets: [...p.sidebar.widgets, emptyWidget(type)] },
}));
const _deleteWidget = id => setProject(p => ({
  ...p,
  sidebar: { ...p.sidebar, widgets: p.sidebar.widgets.filter(w => w.id !== id) },
}));
const _reorderWidgets = newList => setProject(p => ({
  ...p,
  sidebar: { ...p.sidebar, widgets: newList },
}));

const TitleWidgetEditor = ({ widget }) =>
  TextInput({
    label:       'Title text (blank → use the project title)',
    value:       widget.label || '',
    onChange:    onText(v => _setWidget(widget.id)({ label: v })),
    placeholder: '(use project title)',
  });

const StatsWidgetEditor = ({ widget, project }) => {
  const all  = project.stats.map(s => s.key);
  const sel  = widget.keys?.length ? widget.keys : all;
  const _toggle = key => _setWidget(widget.id)(w => {
    const cur = w.keys?.length ? w.keys : all;
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    return { ...w, keys: next };
  });
  return Stack({ gap: 8 })([
    p({ className: 'gef-hint' })([
      'Pick which stats to show, in this order. None selected → show all.',
    ]),
    div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })(
      all.map(k =>
        button({
          type: 'button',
          onclick: () => _toggle(k),
          className: `gef-list-btn${sel.includes(k) ? ' active' : ''}`,
          style: 'border:1px solid var(--border); padding:6px 10px',
        })([k])
      )
    ),
  ]);
};

const InventoryWidgetEditor = ({ widget }) =>
  Stack({ gap: 8 })([
    Select({
      label:    'Layout',
      options:  [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }],
      value:    widget.layout || 'list',
      onChange: onText(v => _setWidget(widget.id)({ layout: v })),
    }),
  ]);

const RoomLinkWidgetEditor = ({ widget, project }) =>
  Stack({ gap: 8 })([
    TextInput({
      label:       'Button label',
      value:       widget.label,
      onChange:    onText(v => _setWidget(widget.id)({ label: v })),
      placeholder: 'Open phone',
    }),
    TextInput({
      label:       'Icon prefix (optional, e.g. 📞)',
      value:       widget.icon || '',
      onChange:    onText(v => _setWidget(widget.id)({ icon: v })),
      placeholder: '',
    }),
    Select({
      label:    'Target room',
      options:  [{ value: '', label: '- pick room -' }, ...groupedOptions(project.rooms)(r => ({ value: r.id, label: `${r.kind === 'story' ? '⭐ ' : ''}${r.title || r.id} (${r.id})` }))],
      value:    widget.roomId,
      onChange: onText(v => _setWidget(widget.id)({ roomId: v })),
    }),
    p({ className: 'gef-hint' })([
      'Clicking the button calls ctx.goto(roomId) - the engine pushes the current scene onto history so the player can ',
      span({ className: 'dv-mono' })(['← Back']),
      ' out of it.',
    ]),
  ]);

const MinimapWidgetEditor = ({ widget, project }) => {
  // Reachable room count. Filter matches the renderer (story + hideOnMap
  // dropped before BFS) so the hint shown to authors is accurate.
  const mapped  = project.rooms.filter(r => r && r.kind !== 'story' && !r.hideOnMap);
  const byId    = Object.fromEntries(mapped.map(r => [r.id, r]));
  const startId = byId[project.meta.start] ? project.meta.start : mapped[0]?.id;
  const seen    = new Set();
  if (startId) {
    const queue = [startId];
    seen.add(startId);
    while (queue.length) {
      const id = queue.shift();
      for (const ch of (byId[id]?.choices || [])) {
        if (ch.to && byId[ch.to] && !seen.has(ch.to)) { seen.add(ch.to); queue.push(ch.to); }
      }
    }
  }
  return Stack({ gap: 8 })([
    TextInput({
      label:       'Heading',
      value:       widget.label || '',
      onChange:    onText(v => _setWidget(widget.id)({ label: v })),
      placeholder: 'Map',
    }),
    NumberInput({
      label:    'Range (0 = all)',
      value:    Number(widget.range) || 0,
      min:      0,
      onChange: v => _setWidget(widget.id)({ range: Math.max(0, Number(v) || 0) }),
      style:    'justify-self:start',
    }),
    NumberInput({
      label:    'Width (px, 0 = auto)',
      value:    Number(widget.width) || 0,
      min:      0,
      onChange: v => _setWidget(widget.id)({ width: Math.max(0, Number(v) || 0) }),
      style:    'justify-self:start',
    }),
    NumberInput({
      label:    'Zoom (0 = off; scrolls)',
      value:    Number(widget.zoom) || 0,
      min:      0,
      onChange: v => _setWidget(widget.id)({ zoom: Math.max(0, Number(v) || 0) }),
      style:    'justify-self:start',
    }),
    Toggle({
      on:       !!widget.fastTravel,
      onChange: v => _setWidget(widget.id)({ fastTravel: !!v }),
    })([span({ style: 'font-size:13px' })(['Fast travel - click a visible cell to walk there if a discovered path exists'])]),
    Toggle({
      on:       !!widget.showLabels,
      onChange: v => _setWidget(widget.id)({ showLabels: !!v }),
    })([span({ style: 'font-size:13px' })(['Show room titles inside cells'])]),
    Toggle({
      on:       widget.dimUnvisited !== false,
      onChange: v => _setWidget(widget.id)({ dimUnvisited: !!v }),
    })([span({ style: 'font-size:13px' })(['Dim unvisited rooms (outline only)'])]),
    Toggle({
      on:       !!widget.visitedOnly,
      onChange: v => _setWidget(widget.id)({ visitedOnly: !!v }),
    })([span({ style: 'font-size:13px' })(['Fog of war - only show rooms the player has visited'])]),
    ...(widget.visitedOnly
      ? [NumberInput({
          label:    'Reveal (0 = strict)',
          value:    Number(widget.reach) || 0,
          min:      0,
          onChange: v => _setWidget(widget.id)({ reach: Math.max(0, Number(v) || 0) }),
          style:    'justify-self:start',
        })]
      : []),
    p({ className: 'gef-hint' })([
      `Auto-discovers ${seen.size} reachable room${seen.size === 1 ? '' : 's'} from `,
      span({ className: 'dv-mono' })([startId || '(start unset)']),
      ' via BFS over choice exits. Range > 0 re-roots the BFS at the player\'s current room each frame, so the map follows them. Visited rooms are tracked at runtime in ',
      span({ className: 'dv-mono' })(['state._mapVisited']),
      '.',
    ]),
  ]);
};

const JsWidgetEditor = ({ widget }) =>
  Stack({ gap: 8 })([
    TextInput({
      label:       'Display label (used in editor only)',
      value:       widget.label,
      onChange:    onText(v => _setWidget(widget.id)({ label: v })),
      placeholder: 'HP bar',
    }),
    div({})([
      div({ style: 'font-size:11px; color:var(--text-muted); margin-bottom:4px' })([
        'Function body. In scope: ',
        span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })(['ctx, state, div, span, p, h3, img, video, button']),
        '. Must ', span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })(['return']), ' a vnode.',
      ]),
      textarea({
        value: widget.body,
        oninput: e => _setWidget(widget.id)({ body: e.target.value }),
        rows: 8,
        spellcheck: false,
        style: 'width:100%; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface); color:var(--text); resize:vertical',
        placeholder: 'return div({})(["HP: " + state.hp]);',
      })([]),
    ]),
  ]);

const WidgetCard = (widget, project) =>
  Card({
    title: `${widget.type.toUpperCase()}${widget.label ? ' - ' + widget.label : ''}`,
  })([
    Stack({ gap: 10 })([
      div({ style: 'display:flex; gap:6px; align-items:center' })([
        span({ style: 'cursor:grab; color:var(--text-muted)', title: 'Drag to reorder' })(['⋮⋮']),
        Badge({ variant: 'blue' })([widget.type]),
        Badge({ variant: 'gray' })([`#${widget.id.slice(0, 5)}`]),
        div({ style: 'flex:1' })([]),
        Button({ size: 'sm', variant: 'ghost', onClick: () => _deleteWidget(widget.id) })(['Delete']),
      ]),

      ...(widget.type === 'title'     ? [TitleWidgetEditor({ widget })] : []),
      ...(widget.type === 'stats'     ? [StatsWidgetEditor({ widget, project })] : []),
      ...(widget.type === 'inventory' ? [InventoryWidgetEditor({ widget })] : []),
      ...(widget.type === 'roomLink'  ? [RoomLinkWidgetEditor({ widget, project })] : []),
      ...(widget.type === 'minimap'   ? [MinimapWidgetEditor({ widget, project })] : []),
      ...(widget.type === 'js'        ? [JsWidgetEditor({ widget })] : []),
      ...(widget.type === 'portrait'  ? [PortraitEditor({
            widget,
            items:    project.items,
            project,
            onChange: next => _setWidget(widget.id)(() => next),
          })] : []),
    ]),
  ]);

const SidebarPanel = state => {
  const { project } = state;
  const sb = project.sidebar || { enabled: false, widgets: [] };

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Sidebar']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Configure the in-game left column. Drag the ⋮⋮ handle on each widget to reorder. ',
      'Toggle off if you want a clean view; turn on and add widgets to give the player a character sheet, paper-doll portrait, quick-access room buttons (phone, map), or a fully custom JS panel.',
    ]),

    Card({ title: 'Visibility' })([
      Stack({ gap: 10 })([
        div({ style: 'display:flex; align-items:center; gap:10px' })([
          Toggle({
            on:       sb.enabled,
            onChange: v => _setSidebar({ enabled: !!v }),
          })([span({ style: 'font-size:13px' })(['Show sidebar in game'])]),
        ]),
        TextInput({
          label:       'Sidebar width (CSS value for --sidebar-width - empty = engine default of 240px)',
          value:       sb.width || '',
          onChange:    onText(v => _setSidebar({ width: v })),
          placeholder: '320px',
        }),
      ]),
    ]),

    Card({ title: 'Add widget' })([
      div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })(
        WIDGET_OPTS.map(opt =>
          Button({ size: 'sm', variant: 'ghost', onClick: () => _addWidget(opt.value) })([`+ ${opt.label}`])
        )
      ),
    ]),

    ...(sb.widgets.length === 0
      ? [div({ className: 'gef-empty' })([
          'No widgets yet. Add one above.',
        ])]
      : [DragList({
          items: sb.widgets,
          onChange: _reorderWidgets,
          renderItem: w => WidgetCard(w, project),
        })]),
  ]);
};

export { SidebarPanel };
