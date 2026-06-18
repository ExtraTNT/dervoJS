/**
 * mapBuilder - graphical room layout. Drag room cards around a canvas, connect
 * them with wires (→ button on a card starts a wire, click on a target to
 * complete), delete with the x button. On Finish every node becomes a real
 * project room (folder = "<prefix>/map") and every wire turns into a Choice on
 * the source room with `to: <target-id>`.
 *
 * Rooms only need a name - that's the quick-build promise. Wires inherit a
 * "Go to <target name>." label; the user can rename / re-aim later in the
 * Rooms tab.
 */

import { p, div, span, button, input } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { Button } from '../../../src/components/Button.js';
import { Stack } from '../../../src/components/Layout.js';
import { Badge } from '../../../src/components/Badge.js';
import { emptyRoom, emptyChoice, emptyPage, _rid } from '../../schema.js';
import { vnode } from '../../../lib/odocosjs/src/render.js';
import { slug, uniqueId, idsOf } from '../../helpers.js';

// SVG factories - state.js auto-namespaces these via createElementNS.
const svg     = vnode('svg');
const line    = vnode('line');
const polygon = vnode('polygon');

// Visual constants for the room cards on the canvas. The wire endpoints
// anchor at the center of each room.
const ROOM_W = 160;
const ROOM_H = 72;
const _cx = node => node.x + ROOM_W / 2;
const _cy = node => node.y + ROOM_H / 2;

// Arrow geometry for uni-directional wires. The arrow tip sits a fixed
// distance from the target room's centre so it lands just outside the
// target's card. Returns a points string ready for an SVG polygon, or null
// when the two ends overlap.
const _arrowPoints = (from, to) => {
  const fx = _cx(from), fy = _cy(from);
  const tx = _cx(to),   ty = _cy(to);
  const dx = tx - fx, dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const ux = dx / len, uy = dy / len;
  // Tip is 56px before the target centre - about the diagonal half-width of
  // the room card (160 x 72) so the arrowhead clears the target on most
  // angles without floating in mid-canvas.
  const TIP_OFFSET = 56;
  const ARROW_LEN  = 12;
  const ARROW_W    = 7;
  const tipX  = tx - ux * TIP_OFFSET;
  const tipY  = ty - uy * TIP_OFFSET;
  const baseX = tipX - ux * ARROW_LEN;
  const baseY = tipY - uy * ARROW_LEN;
  // Perpendicular unit vector for the arrow base width.
  const px = -uy, py = ux;
  const s1x = baseX + px * ARROW_W;
  const s1y = baseY + py * ARROW_W;
  const s2x = baseX - px * ARROW_W;
  const s2y = baseY - py * ARROW_W;
  return `${tipX},${tipY} ${s1x},${s1y} ${s2x},${s2y}`;
};

const defaults = () => ({
  nodes:         [],     // { id, name, x, y }
  edges:         [],     // { id, from, to, bidir }
  pendingFrom:   null,   // id of the room the user clicked → from for a new wire
  drag:          null,   // { id, startX, startY, originX, originY } while dragging
  folderPrefix:  '',
  newWireBidir:  true,   // default direction for newly drawn wires; per-wire toggle overrides
});

const _stepMap = ({ values, setValue }) => {
  const nodes       = values.nodes || [];
  const edges       = values.edges || [];
  const pendingFrom = values.pendingFrom || null;

  const _patchNode = (id, patch) => setValue('nodes', nodes.map(n => n.id === id ? { ...n, ...patch } : n));

  const _addRoom = () => setValue('nodes', [...nodes, {
    id:   _rid(),
    name: `Room ${nodes.length + 1}`,
    // Stagger new rooms so they don't all stack at the same spot.
    x:    80  + (nodes.length % 6) * 180,
    y:    80  + Math.floor(nodes.length / 6) * 100,
  }]);

  const _deleteRoom = id => {
    setValue('nodes', nodes.filter(n => n.id !== id));
    setValue('edges', edges.filter(e => e.from !== id && e.to !== id));
    if (pendingFrom === id) setValue('pendingFrom', null);
  };

  // Wire creation is two clicks: → on the source room (sets pendingFrom), then
  // click on any other room to complete the wire. Re-clicking the same source
  // cancels. Self-wires and dupe edges are silently swallowed; new wires
  // inherit the global `newWireBidir` setting so the user can pre-pick the
  // direction before drawing.
  const _wireFrom = id => {
    if (pendingFrom === id) { setValue('pendingFrom', null); return; }
    if (pendingFrom) {
      const dupe = edges.find(e => e.from === pendingFrom && e.to === id);
      if (pendingFrom !== id && !dupe) {
        setValue('edges', [...edges, {
          id:    _rid(),
          from:  pendingFrom,
          to:    id,
          bidir: values.newWireBidir !== false,    // default bidir
        }]);
      }
      setValue('pendingFrom', null);
      return;
    }
    setValue('pendingFrom', id);
  };

  const _deleteEdge = id => setValue('edges', edges.filter(e => e.id !== id));

  // Flip a single wire between bi- and uni-directional. Doesn't touch the
  // global default - that's a separate toolbar toggle.
  const _toggleEdgeDir = id => setValue('edges',
    edges.map(e => e.id === id ? { ...e, bidir: !e.bidir } : e));

  // Drag handlers use Pointer Events with setPointerCapture so move + up
  // continue firing on the captured node even when the cursor leaves it.
  const _onNodePointerDown = (id, e) => {
    // Inputs / buttons inside the card stop propagation themselves; this only
    // runs for the card body, which IS the drag handle.
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setValue('drag', {
      id,
      startX:  e.clientX,
      startY:  e.clientY,
      originX: node.x,
      originY: node.y,
    });
  };

  const _onNodePointerMove = e => {
    const drag = values.drag;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    _patchNode(drag.id, {
      x: Math.max(0, drag.originX + dx),
      y: Math.max(0, drag.originY + dy),
    });
  };

  const _onNodePointerUp = () => {
    if (values.drag) setValue('drag', null);
  };

  return Stack({ gap: 10 })([
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Drop rooms on the canvas and connect them. ',
      span({ className: 'dv-mono' })(['→']),
      ' on a room starts a wire - click another room to complete it. Each room becomes a project ',
      span({ className: 'dv-mono' })(['scene']),
      ' room (only the name is required); each wire becomes a ',
      span({ className: 'dv-mono' })(['Choice']),
      ' on the source room with ', span({ className: 'dv-mono' })(['to: <target>']),
      '. Existing rooms in the project are left alone - this is additive.',
    ]),

    // Toolbar - Add + folder prefix + new-wire direction default + wiring
    // indicator + counts. The direction toggle controls the default for
    // newly drawn wires (per-wire toggles override it after the fact).
    div({ style: 'display:flex; gap:10px; align-items:center; flex-wrap:wrap' })([
      Button({ variant: 'primary', size: 'sm', onClick: _addRoom })(['+ Add room']),
      TextInput({
        value:       values.folderPrefix || '',
        onInput:     e => setValue('folderPrefix', e.target.value),
        placeholder: 'folder prefix',
        style:       'max-width:220px',
      }),
      Button({
        size:    'sm',
        variant: 'ghost',
        title:   'Default direction for newly drawn wires. Existing wires keep their own setting.',
        onClick: () => setValue('newWireBidir', !(values.newWireBidir !== false)),
      })([
        values.newWireBidir !== false
          ? '↔ new wires bidir'
          : '→ new wires one-way',
      ]),
      ...(pendingFrom
        ? [
            Badge({ variant: 'yellow' })([
              `Wiring ${values.newWireBidir !== false ? '↔' : '→'} from "${nodes.find(n => n.id === pendingFrom)?.name || ''}" - click target`,
            ]),
            Button({ size: 'sm', variant: 'ghost', onClick: () => setValue('pendingFrom', null) })(['Cancel wire']),
          ]
        : []),
      div({ style: 'flex:1' })([]),
      Badge({ variant: 'gray' })([`${nodes.length} room${nodes.length === 1 ? '' : 's'}`]),
      Badge({ variant: 'gray' })([`${edges.length} wire${edges.length === 1 ? '' : 's'}`]),
    ]),

    // Canvas: SVG layer for wires (pointer-events: none so they don't eat
    // drag), HTML divs for room cards on top.
    div({
      style: `position:relative; width:100%; height:520px; overflow:auto; background:var(--surface-2, rgba(0,0,0,0.04)); border:1px solid var(--border); border-radius:var(--radius); cursor:${pendingFrom ? 'crosshair' : 'default'}`,
    })([
      svg({
        width:  '2000',
        height: '2000',
        style:  'position:absolute; left:0; top:0; pointer-events:none',
      })(edges.flatMap(edge => {
        const from = nodes.find(n => n.id === edge.from);
        const to   = nodes.find(n => n.id === edge.to);
        if (!from || !to) return [];
        // Bidir wires are SOLID; uni-dir are DASHED + carry an arrowhead at
        // the target end so the direction reads at a glance.
        const bidir   = edge.bidir !== false;
        const dashes  = bidir ? '' : '6 4';
        const lineEl  = line({
          x1: _cx(from), y1: _cy(from),
          x2: _cx(to),   y2: _cy(to),
          stroke:           'var(--accent)',
          'stroke-width':   '2',
          ...(dashes ? { 'stroke-dasharray': dashes } : {}),
        })([]);
        if (bidir) return [lineEl];
        const arrowPts = _arrowPoints(from, to);
        if (!arrowPts) return [lineEl];
        return [
          lineEl,
          polygon({
            points: arrowPts,
            fill:   'var(--accent)',
            stroke: 'var(--accent)',
          })([]),
        ];
      })),

      // Per-wire controls at the midpoint: direction toggle + delete.
      ...edges.flatMap(edge => {
        const from = nodes.find(n => n.id === edge.from);
        const to   = nodes.find(n => n.id === edge.to);
        if (!from || !to) return [];
        const mx    = (_cx(from) + _cx(to)) / 2;
        const my    = (_cy(from) + _cy(to)) / 2;
        const bidir = edge.bidir !== false;
        const toggleBtn = button({
          type:    'button',
          title:   bidir ? 'Bidirectional - click to make one-way' : 'One-way - click to make bidirectional',
          style:   `position:absolute; left:${mx - 23}px; top:${my - 10}px; width:22px; height:20px; padding:0; border:1px solid var(--border); border-radius:10px; background:${bidir ? 'var(--surface)' : 'var(--accent)'}; color:${bidir ? 'var(--text)' : '#fff'}; cursor:pointer; font-size:12px; line-height:1; box-shadow:0 1px 3px rgba(0,0,0,0.15)`,
          onclick: () => _toggleEdgeDir(edge.id),
        })([bidir ? '↔' : '→']);
        const deleteBtn = button({
          type:    'button',
          title:   'Delete wire',
          style:   `position:absolute; left:${mx + 3}px; top:${my - 10}px; width:20px; height:20px; padding:0; border:1px solid var(--border); border-radius:50%; background:var(--surface); cursor:pointer; font-size:12px; line-height:1; box-shadow:0 1px 3px rgba(0,0,0,0.15)`,
          onclick: () => _deleteEdge(edge.id),
        })(['x']);
        return [toggleBtn, deleteBtn];
      }),

      // Room cards on the SVG layer (HTML-on-top).
      ...nodes.map(node => {
        const isPending = pendingFrom === node.id;
        return div({
          style: `position:absolute; left:${node.x}px; top:${node.y}px; width:${ROOM_W}px; padding:8px; border:2px solid ${isPending ? 'var(--accent)' : 'var(--border)'}; border-radius:var(--radius); background:var(--surface); cursor:move; user-select:none; box-shadow:0 2px 6px rgba(0,0,0,0.12); display:flex; flex-direction:column; gap:6px`,
          onpointerdown: e => _onNodePointerDown(node.id, e),
          onpointermove: _onNodePointerMove,
          onpointerup:   _onNodePointerUp,
        })([
          input({
            type:    'text',
            value:   node.name,
            oninput: e => _patchNode(node.id, { name: e.target.value }),
            style:   'width:100%; padding:3px 5px; border:1px solid transparent; border-radius:3px; background:transparent; color:var(--text); font-size:12.5px; font-weight:600; box-sizing:border-box',
            // Typing in the input must not start a drag - stop the pointer
            // event before it bubbles up to the card body's pointerdown.
            onpointerdown: e => e.stopPropagation(),
          })([]),
          div({ style: 'display:flex; gap:4px' })([
            button({
              type:          'button',
              title:         pendingFrom ? (isPending ? 'Cancel this wire' : 'Wire to this room') : 'Start a wire from here',
              onpointerdown: e => e.stopPropagation(),
              onclick:       e => { e.stopPropagation(); _wireFrom(node.id); },
              style:         `flex:1; padding:3px 6px; border:1px solid var(--border); border-radius:3px; background:${isPending ? 'var(--accent)' : (pendingFrom ? 'var(--surface-2)' : 'var(--surface-2)')}; color:${isPending ? '#fff' : 'var(--text)'}; cursor:pointer; font-size:11px`,
            })([pendingFrom ? (isPending ? 'cancel' : '→ to here') : '→ wire']),
            button({
              type:          'button',
              title:         'Delete room',
              onpointerdown: e => e.stopPropagation(),
              onclick:       e => { e.stopPropagation(); _deleteRoom(node.id); },
              style:         'padding:3px 8px; border:1px solid var(--border); border-radius:3px; background:var(--surface-2); cursor:pointer; font-size:11px; color:var(--text)',
            })(['x']),
          ]),
        ]);
      }),
    ]),
  ]);
};

const steps = [{
  title:    'Map',
  validate: v => (!v.nodes || v.nodes.length === 0)
    ? 'Add at least one room.'
    : (v.nodes.some(n => !n.name || !n.name.trim()) ? 'Every room needs a name.' : null),
  render:   _stepMap,
}];

// ── build ───────────────────────────────────────────────────────────────────

const build = (project, values) => {
  let next = project;
  const folderPrefix = (values.folderPrefix || '').trim();
  const folder = folderPrefix ? `${folderPrefix}/map` : 'map';

  // Allocate stable real project room ids before emitting rooms - wires need
  // to resolve `to: <target>` against these. A local Set tracks the IDs we've
  // claimed so far so dedupe is correct even before we mutate `next`.
  const usedIds = new Set(idsOf('rooms')(next));
  const idMap = new Map();
  for (const node of values.nodes || []) {
    const id = uniqueId(`room_${slug(node.name) || 'room'}`, usedIds);
    usedIds.add(id);
    idMap.set(node.id, id);
  }

  // Construct each real room with its wire-derived choices. Bidirectional
  // wires produce a Choice on BOTH endpoints; uni-directional wires only
  // produce one on the source room (so they read as one-way gates).
  const edgesIn = values.edges || [];
  const newRooms = (values.nodes || []).map(node => {
    const id = idMap.get(node.id);
    const fromMe   = edgesIn.filter(e => e.from === node.id);
    const intoMeBi = edgesIn.filter(e => e.to === node.id && e.bidir !== false);
    const lookup = nid => (values.nodes || []).find(n => n.id === nid);
    const choices = [
      ...fromMe.map(edge => {
        const target = lookup(edge.to);
        return {
          ...emptyChoice(),
          label: `Go to ${target?.name || 'next'}`,
          to:    idMap.get(edge.to) || '',
        };
      }),
      // Reverse leg for bidirectional wires that point INTO this room.
      ...intoMeBi.map(edge => {
        const target = lookup(edge.from);
        return {
          ...emptyChoice(),
          label: `Go to ${target?.name || 'back'}`,
          to:    idMap.get(edge.from) || '',
        };
      }),
    ];
    const base = emptyRoom(id);
    return {
      ...base,
      title:   node.name || 'Untitled Room',
      folder,
      // emptyRoom() already seeds an empty first page - leave it; the user
      // will add scene text in the Rooms tab. Choices are populated from
      // the wires we drew.
      choices,
    };
  });

  next = { ...next, rooms: [...next.rooms, ...newRooms] };

  return {
    project: next,
    summary: `Added ${newRooms.length} room${newRooms.length === 1 ? '' : 's'} with ${(values.edges || []).length} wire${(values.edges || []).length === 1 ? '' : 's'}.`,
  };
};

export const mapBuilder = {
  id:          'mapBuilder',
  icon:        '🗺️',
  name:        'Map Builder',
  description: 'Drag rooms onto a canvas, connect them with wires. Each room turns into a project room; each wire becomes a Choice navigating to the target.',
  defaults,
  steps,
  build,
};
