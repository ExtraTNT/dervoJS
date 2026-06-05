/**
 * Rooms panel — list of rooms on the left, RoomEditor on the right.
 *
 * Selecting a room sets store.selectedRoomId; deleting one clears the
 * selection. Each room edit goes through setProject so the dirty flag stays
 * in sync.
 */

import { div, span, h2, p, button } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { Checkbox } from '../../src/components/Checkbox.js';
import { Select } from '../../src/components/Select.js';
import { setProject, setState } from '../store.js';
import { emptyRoom, emptyWardrobeRoom, emptyInventoryRoom, emptyPage, emptyChoice } from '../schema.js';
import { onText, onCheck } from '../helpers.js';
import { PageEditor }     from '../components/PageEditor.js';
import { ChoiceEditor }   from '../components/ChoiceEditor.js';
import { EffectEditor }    from '../components/EffectEditor.js';
import { ConditionEditor } from '../components/ConditionEditor.js';
import { PortraitEditor }  from '../components/PortraitEditor.js';
import { AssetInput }      from '../components/AssetInput.js';

// helpers
const _vars = project => ({
  stats:   project.stats.map(s => s.key).filter(Boolean),
  flags:   project.flags.map(f => f.key).filter(Boolean),
  items:   project.items,
  skills:  project.skills || [],
  npcs:    project.npcs,
  rooms:   project.rooms,
  combats: project.combats || [],
});

const _updateRoom = (id, mut) => setProject(p => ({
  ...p,
  rooms: p.rooms.map(r => r.id === id ? (typeof mut === 'function' ? mut(r) : { ...r, ...mut }) : r),
}));

const _addRoom = () => setProject(p => {
  const room = emptyRoom();
  return { ...p, rooms: [...p.rooms, room] };
});

const _addWardrobeRoom = () => setProject(p => {
  const room = emptyWardrobeRoom();
  return { ...p, rooms: [...p.rooms, room] };
});

const _addInventoryRoom = () => setProject(p => {
  const room = emptyInventoryRoom();
  return { ...p, rooms: [...p.rooms, room] };
});

const _deleteRoom = id => setProject(p => {
  const next = p.rooms.filter(r => r.id !== id);
  // Sweep choices pointing at this room — null out their `to`.
  const sanitized = next.map(r => ({
    ...r,
    choices: r.choices.map(c => c.to === id ? { ...c, to: '' } : c),
  }));
  const meta = p.meta.start === id ? { ...p.meta, start: next[0]?.id || '' } : p.meta;
  return { ...p, rooms: sanitized, meta };
});

const _duplicateRoom = id => setProject(p => {
  const src = p.rooms.find(r => r.id === id);
  if (!src) return p;
  const copy = {
    ...src,
    id:    `${src.id}_copy`,
    title: `${src.title} (copy)`,
    pages: src.pages.map(pg => ({ ...pg, id: emptyPage().id })),
    choices: src.choices.map(c => ({ ...c, id: emptyChoice().id })),
  };
  return { ...p, rooms: [...p.rooms, copy] };
});

const RoomList = (project, selectedId) => {
  // Story rooms live in the Story Points tab — keep the world-map list clean.
  const worldRooms = project.rooms.filter(r => r.kind !== 'story');
  return Stack({ gap: 4 })([
    h2({ style: 'font-size:14px; margin:0 0 4px' })([`Rooms (${worldRooms.length})`]),
    ...worldRooms.map(r =>
      button({
        className: `gef-list-btn${r.id === selectedId ? ' active' : ''}`,
        onclick:   () => setState({ selectedRoomId: r.id }),
        type:      'button',
      })([
        span({})([r.title || '(untitled)']),
        ...(r.kind === 'wardrobe'  ? [Badge({ variant: 'purple' })(['wardrobe'])]   : []),
        ...(r.kind === 'inventory' ? [Badge({ variant: 'blue'   })(['inventory'])]  : []),
        ...(project.meta.start === r.id ? [Badge({ variant: 'green' })(['start'])] : []),
        span({ className: 'gef-id' })([r.id]),
      ])
    ),
    div({ style: 'display:flex; gap:6px; margin-top:8px; flex-wrap:wrap' })([
      Button({ size: 'sm', variant: 'ghost', onClick: _addRoom })(['+ Add room']),
      Button({ size: 'sm', variant: 'ghost', onClick: _addWardrobeRoom })(['+ Wardrobe']),
      Button({ size: 'sm', variant: 'ghost', onClick: _addInventoryRoom })(['+ Inventory']),
    ]),
  ]);
};

const ITEM_KIND_OPTS = ['consumable', 'equipment', 'key', 'misc'];

const InventoryRoomEditor = ({ room, project, onChange }) => {
  const inv = room.inventory || { kinds: [], layout: 'grid', showDescription: true, emptyMessage: '' };
  const _toggleKind = k => onChange({
    ...inv,
    kinds: inv.kinds.includes(k) ? inv.kinds.filter(x => x !== k) : [...inv.kinds, k],
  });
  return Card({ title: 'Inventory room' })([
    Stack({ gap: 12 })([
      p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
        'Renders every item the player is carrying, optionally filtered by kind. ',
        'Pair with a roomLink in the sidebar (or a choice anywhere) so the player can pop in to manage things. ',
        'Add a Choice below for a "← Back" exit.',
      ]),
      div({})([
        div({ style: 'font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em' })(['Show items of kind:']),
        p({ style: 'margin:0 0 6px; font-size:11.5px; color:var(--text-muted)' })(['(none selected = show every kind)']),
        div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })(
          ITEM_KIND_OPTS.map(k =>
            button({
              type: 'button',
              onclick: () => _toggleKind(k),
              className: `gef-list-btn${inv.kinds.includes(k) ? ' active' : ''}`,
              style: 'border:1px solid var(--border); padding:6px 10px',
            })([k])
          )
        ),
      ]),
      Grid({ cols: 2, gap: 10 })([
        Select({
          label:    'Layout',
          options:  [{ value: 'grid', label: 'Grid (cards)' }, { value: 'list', label: 'List (rows)' }],
          value:    inv.layout || 'grid',
          onChange: onText(v => onChange({ ...inv, layout: v })),
        }),
        div({ style: 'display:flex; align-items:flex-end; gap:8px' })([
          Checkbox({
            id:       `invDesc-${room.id}`,
            checked:  !!inv.showDescription,
            onChange: onCheck(c => onChange({ ...inv, showDescription: c })),
          })(['Show item description']),
        ]),
      ]),
      TextInput({
        label:    'Empty message',
        value:    inv.emptyMessage || '',
        onChange: onText(v => onChange({ ...inv, emptyMessage: v })),
        placeholder: 'You are not carrying anything.',
      }),
    ]),
  ]);
};

const WardrobeRoomEditor = ({ room, project, onChange }) => {
  const wb = room.wardrobe || { portraitWidth: 240, portraitHeight: 320, layers: [], kinds: ['equipment'] };
  const _toggleKind = k => onChange({
    ...wb,
    kinds: wb.kinds.includes(k) ? wb.kinds.filter(x => x !== k) : [...wb.kinds, k],
  });

  return Card({ title: 'Wardrobe' })([
    Stack({ gap: 12 })([
      p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
        'A drop-in template: paper-doll portrait + a list of what the player is currently carrying that matches the selected item kinds. ',
        'Add a Choice below to let the player leave (e.g. "← Back" with no condition / action).',
      ]),
      div({})([
        div({ style: 'font-size:11px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.05em' })(['Show items of kind:']),
        div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })(
          ITEM_KIND_OPTS.map(k =>
            button({
              type: 'button',
              onclick: () => _toggleKind(k),
              className: `gef-list-btn${wb.kinds.includes(k) ? ' active' : ''}`,
              style: 'border:1px solid var(--border); padding:6px 10px',
            })([k])
          )
        ),
      ]),
      div({ style: 'border-top:1px solid var(--border); padding-top:12px' })([
        div({ style: 'font-size:11px; color:var(--text-muted); margin-bottom:6px; text-transform:uppercase; letter-spacing:.05em' })(['Portrait']),
        PortraitEditor({
          widget:   { layers: wb.layers || [], width: wb.portraitWidth, height: wb.portraitHeight },
          items:    project.items,
          onChange: next => onChange({
            ...wb,
            layers:         next.layers,
            portraitWidth:  next.width,
            portraitHeight: next.height,
          }),
        }),
      ]),
    ]),
  ]);
};

const RoomEditor = (room, project) => {
  const vars = _vars(project);
  const roomOpts = project.rooms.map(r => ({ value: r.id, label: r.title || r.id }));
  const set = patch => _updateRoom(room.id, patch);

  const _setPage = (i, patch) => _updateRoom(room.id, r => ({
    ...r,
    pages: r.pages.map((p, k) => k === i ? { ...p, ...patch } : p),
  }));
  const _addPage = () => _updateRoom(room.id, r => ({ ...r, pages: [...r.pages, emptyPage()] }));
  const _deletePage = i => _updateRoom(room.id, r => {
    const next = r.pages.filter((_, k) => k !== i);
    return { ...r, pages: next.length ? next : [emptyPage()] };
  });
  const _movePage = (i, dir) => _updateRoom(room.id, r => {
    const j = i + dir;
    if (j < 0 || j >= r.pages.length) return r;
    const pages = [...r.pages];
    [pages[i], pages[j]] = [pages[j], pages[i]];
    return { ...r, pages };
  });

  const _setChoice = (i, patch) => _updateRoom(room.id, r => ({
    ...r,
    choices: r.choices.map((c, k) => k === i ? (typeof patch === 'function' ? patch(c) : { ...c, ...patch }) : c),
  }));
  const _addChoice = () => _updateRoom(room.id, r => ({ ...r, choices: [...r.choices, emptyChoice()] }));
  const _deleteChoice = i => _updateRoom(room.id, r => ({ ...r, choices: r.choices.filter((_, k) => k !== i) }));
  const _moveChoice = (i, dir) => _updateRoom(room.id, r => {
    const j = i + dir;
    if (j < 0 || j >= r.choices.length) return r;
    const choices = [...r.choices];
    [choices[i], choices[j]] = [choices[j], choices[i]];
    return { ...r, choices };
  });

  return Stack({ gap: 14 })([
    Card({ title: 'Room basics' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label:    'ID (used in code)',
            value:    room.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === room.id) return;
              setProject(p => {
                const renamed = p.rooms.map(r => r.id === room.id ? { ...r, id: safe } : r);
                const sweepedChoices = renamed.map(r => ({
                  ...r,
                  choices: r.choices.map(c => c.to === room.id ? { ...c, to: safe } : c),
                }));
                const npcs = p.npcs.map(n => ({
                  ...n,
                  locations: n.locations.map(loc => loc === room.id ? safe : loc),
                }));
                const meta = p.meta.start === room.id ? { ...p.meta, start: safe } : p.meta;
                return { ...p, rooms: sweepedChoices, npcs, meta };
              });
              setState({ selectedRoomId: safe });
            }),
          }),
          TextInput({
            label:    'Title (shown in-game)',
            value:    room.title,
            onChange: onText(v => set({ title: v })),
          }),
        ]),
        Grid({ cols: 3, gap: 10 })([
          AssetInput({
            label:       'Background music (URL or upload — optional override)',
            value:       room.music,
            onChange:    v => set({ music: v }),
            accept:      'audio',
            placeholder: 'leave empty to use default',
          }),
          Select({
            label:    'Room kind',
            options:  [
              { value: 'scene',     label: 'Scene (pages + choices)' },
              { value: 'wardrobe',  label: 'Wardrobe (portrait + equipment)' },
              { value: 'inventory', label: 'Inventory (all items)' },
            ],
            value:    room.kind || 'scene',
            onChange: onText(v => set({ kind: v })),
          }),
          div({ style: 'display:flex; align-items:flex-end' })([
            Checkbox({
              id:       `start-${room.id}`,
              checked:  project.meta.start === room.id,
              onChange: onCheck(c => setProject(p => ({ ...p, meta: { ...p.meta, start: c ? room.id : p.meta.start } }))),
            })(['Start room']),
          ]),
        ]),
      ]),
    ]),

    Card({ title: 'On enter' })([
      Stack({ gap: 10 })([
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'Effect fires each time the player navigates into this room — but only if the gate below allows it. ',
          'Useful for one-shot encounters: gate behind ', span({ style: 'font-family:ui-monospace,monospace' })(['flags.fought === false']),
          ', then set the flag inside the combat\'s onWin.',
        ]),
        ConditionEditor({
          condition: room.onEnterCondition,
          vars,
          onChange:  v => set({ onEnterCondition: v }),
        }),
        div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
          EffectEditor({
            effect:   room.onEnter,
            vars,
            label:    'Effect when condition passes',
            onChange: v => set({ onEnter: v }),
          }),
        ]),
      ]),
    ]),

    ...(room.kind === 'wardrobe'
      ? [WardrobeRoomEditor({ room, project, onChange: next => set({ wardrobe: next }) })]
      : room.kind === 'inventory'
        ? [InventoryRoomEditor({ room, project, onChange: next => set({ inventory: next }) })]
        : [Card({ title: `Pages (${room.pages.length})` })([
          Stack({ gap: 4 })([
            p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
              'Each page is shown in sequence with a "More" button to advance. Choices appear on the final page.',
            ]),
            ...room.pages.map((pg, i) =>
              PageEditor({
                page:        pg,
                index:       i,
                isLast:      i === room.pages.length - 1,
                canDelete:   room.pages.length > 1,
                onChange:    next => _setPage(i, next),
                onDelete:    () => _deletePage(i),
                onMoveUp:    () => _movePage(i, -1),
                onMoveDown:  () => _movePage(i,  1),
              })
            ),
            Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
          ]),
        ])]),

    Card({ title: `Choices (${room.choices.length})` })([
      Stack({ gap: 4 })([
        ...(room.choices.length === 0
          ? [div({ className: 'gef-empty' })(['No choices yet — the player will be stuck here. Add one below.'])]
          : room.choices.map((c, i) =>
              ChoiceEditor({
                choice:     c,
                vars,
                roomOpts,
                isFirst:    i === 0,
                isLast:     i === room.choices.length - 1,
                onChange:   next => _setChoice(i, () => next),
                onDelete:   () => _deleteChoice(i),
                onMoveUp:   () => _moveChoice(i, -1),
                onMoveDown: () => _moveChoice(i,  1),
              })
            )),
        Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
      ]),
    ]),

    Card({ title: 'Danger zone' })([
      div({ style: 'display:flex; gap:8px' })([
        Button({ size: 'sm', variant: 'ghost', onClick: () => _duplicateRoom(room.id) })(['Duplicate']),
        Button({ size: 'sm', variant: 'danger', onClick: () => {
          if (confirm(`Delete room "${room.title || room.id}"? Choices linking here will be cleared.`)) {
            _deleteRoom(room.id);
            setState({ selectedRoomId: null });
          }
        } })(['Delete room']),
      ]),
    ]),
  ]);
};

const RoomsPanel = state => {
  const { project, selectedRoomId } = state;
  // Resolve to a non-story room — story-kind rooms live in their own tab.
  const worldRooms = project.rooms.filter(r => r.kind !== 'story');
  const pickedById = worldRooms.find(r => r.id === selectedRoomId);
  const selected   = pickedById
                  || worldRooms.find(r => r.id === project.meta.start)
                  || worldRooms[0];

  return div({ style: 'display:grid; grid-template-columns: 260px 1fr; gap:16px; align-items:start' })([
    div({})([RoomList(project, selected?.id)]),
    div({})([
      selected
        ? RoomEditor(selected, project)
        : div({ className: 'gef-empty' })(['No rooms yet. Click "+ Add room".']),
    ]),
  ]);
};

export { RoomsPanel };
