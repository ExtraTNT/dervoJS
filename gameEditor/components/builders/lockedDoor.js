/**
 * lockedDoor builder - scaffolds a one-way locked passage:
 *   - A key item (pick existing or create new).
 *   - A new Choice on the "from" room: gated by hasItem(key, 1+), navigates to
 *     the "to" room. Optionally consumes the key on use.
 *
 * Add to the same from-room repeatedly to build a multi-door area, or pick a
 * different key item per door for hub puzzles.
 */

import { p, div, span } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { Select } from '../../../src/components/Select.js';
import { Toggle } from '../../../src/components/Toggle.js';
import { Stack, Grid } from '../../../src/components/Layout.js';
import { Card } from '../../../src/components/Card.js';
import { onText } from '../../helpers.js';
import {
  emptyChoice, emptyCondition, emptyEffect, emptyPrice,
} from '../../schema.js';
import { slug, uniqueId, idsOf } from '../../helpers.js';

const defaults = project => {
  const rooms = project.rooms.filter(r => r.kind !== 'story');
  return {
    fromRoom:    rooms[0]?.id || '',
    toRoom:      rooms[1]?.id || rooms[0]?.id || '',
    label:       'Open the locked door',
    flavour:     '',
    keyMode:     'existing',
    existingKey: project.items.find(it => it.kind === 'key')?.id || project.items[0]?.id || '',
    newKeyName:  'Iron Key',
    consume:     false,
  };
};

const _validateDoor = values => {
  if (!values.fromRoom) return 'Pick the "from" room.';
  if (!values.toRoom)   return 'Pick the "to" room.';
  if (values.fromRoom === values.toRoom) return 'From and to rooms must differ.';
  if (!values.label || !values.label.trim()) return 'Give the choice a label.';
  return null;
};

const _validateKey = values => {
  if (values.keyMode === 'existing') {
    if (!values.existingKey) return 'Pick the key item, or switch to "create new".';
  } else {
    if (!values.newKeyName || !values.newKeyName.trim()) return 'Name the new key item.';
  }
  return null;
};

const steps = [
  {
    title: 'Door',
    validate: _validateDoor,
    render: ({ values, setValue, project }) => {
      const rooms = project.rooms.filter(r => r.kind !== 'story');
      const roomOpts = [{ value: '', label: '- pick room -' }, ...rooms.map(r => ({ value: r.id, label: r.title || r.id }))];
      return Stack({ gap: 10 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
          'Adds a Choice on the "from" room that\'s only shown when the player carries the key.',
        ]),
        Grid({ cols: 2, gap: 8 })([
          Select({
            label: 'From room',
            options: roomOpts,
            value: values.fromRoom || '',
            onChange: onText(v => setValue('fromRoom', v)),
          }),
          Select({
            label: 'To room',
            options: roomOpts,
            value: values.toRoom || '',
            onChange: onText(v => setValue('toRoom', v)),
          }),
        ]),
        TextInput({
          label: 'Choice label',
          value: values.label || '',
          onInput: e => setValue('label', e.target.value),
          placeholder: 'Open the locked door',
        }),
      ]);
    },
  },
  {
    title: 'Key',
    validate: _validateKey,
    render: ({ values, setValue, project }) => {
      const itemOpts = project.items.map(it => ({ value: it.id, label: `${it.name || it.id} (${it.id})` }));
      return Stack({ gap: 10 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
          'Pick which item unlocks the door. Toggle "Consume key on use" for one-shot doors (key is taken away).',
        ]),
        Select({
          label: 'Item source',
          options: [
            { value: 'existing', label: 'use existing item' },
            { value: 'new',      label: 'create new key item' },
          ],
          value: values.keyMode || 'existing',
          onChange: onText(v => setValue('keyMode', v)),
        }),
        ...(values.keyMode === 'existing'
          ? [Select({
              label: 'Key item',
              options: itemOpts.length === 0
                ? [{ value: '', label: '(no items in project - switch to "create new")' }]
                : [{ value: '', label: '- pick item -' }, ...itemOpts],
              value: values.existingKey || '',
              onChange: onText(v => setValue('existingKey', v)),
            })]
          : [TextInput({
              label: 'New key name',
              value: values.newKeyName || '',
              onInput: e => setValue('newKeyName', e.target.value),
              placeholder: 'Iron Key',
            })]),
        div({})([
          Toggle({
            on: !!values.consume,
            onChange: v => setValue('consume', v),
          })(['Consume key on use (one-shot door)']),
        ]),
      ]);
    },
  },
  {
    title: 'Review',
    render: ({ values, project }) => {
      const fromRoom = project.rooms.find(r => r.id === values.fromRoom);
      const toRoom   = project.rooms.find(r => r.id === values.toRoom);
      const keyName  = values.keyMode === 'new' ? values.newKeyName : (project.items.find(it => it.id === values.existingKey)?.name || '(none)');
      return Card({ title: 'About to add' })([
        Stack({ gap: 4 })([
          div({})([`Choice on "${fromRoom?.title || values.fromRoom || '?'}" → "${toRoom?.title || values.toRoom || '?'}"`]),
          div({})([`Label: ${values.label || '(unset)'}`]),
          div({})([`Key: ${keyName} ${values.keyMode === 'new' ? '(will be created)' : ''}`]),
          div({})([values.consume ? 'Consumes the key on use (single-shot door).' : 'Key is kept - door can be reused.']),
        ]),
      ]);
    },
  },
];

const build = (project, values) => {
  let next = project;

  // ── 1. Resolve / create the key item ──
  let keyId = values.keyMode === 'new'
    ? uniqueId(`item_${slug(values.newKeyName) || 'key'}`, idsOf('items')(next))
    : (values.existingKey || '');
  if (values.keyMode === 'new') {
    const newKey = {
      id:          keyId,
      name:        values.newKeyName || 'Key',
      description: 'A key.',
      image:       '',
      price:       emptyPrice('gold', 0),
      kind:        'key',
      folder:      'keys',
      useEffect:   emptyEffect(),
      text:        '',
      equipSlot:   '',
    };
    next = { ...next, items: [...next.items, newKey] };
  }
  if (!keyId) {
    return { project, summary: 'Locked door not created - no key picked.' };
  }
  if (!values.fromRoom || !values.toRoom) {
    return { project, summary: 'Locked door not created - pick both rooms.' };
  }

  // ── 2. Build the door choice ──
  // hasItem condition lets the engine compile to its existing helper -
  // simpler than a js expression and renders nicely in the editor.
  const doorChoice = {
    ...emptyChoice(),
    label:     values.label || 'Open the locked door',
    to:        values.toRoom,
    condition: { ...emptyCondition(), mode: 'hasItem', itemId: keyId, op: 'atleast', count: 1 },
    action:    values.consume
      ? {
          ...emptyEffect(),
          mode: 'simple',
          ops: [{
            target: `inv.${keyId}`,
            op:     'take',
            value:  1,
            condition: emptyCondition(),
            min: { enabled: false, statKey: '', mul: 0, const: 0 },
            max: { enabled: false, statKey: '', mul: 0, const: 0 },
          }],
        }
      : emptyEffect(),
  };

  // ── 3. Append the choice to the from-room ──
  next = {
    ...next,
    rooms: next.rooms.map(r => r.id === values.fromRoom
      ? { ...r, choices: [...(r.choices || []), doorChoice] }
      : r),
  };

  const fromRoom = next.rooms.find(r => r.id === values.fromRoom);
  const toRoom   = next.rooms.find(r => r.id === values.toRoom);
  return {
    project: next,
    summary: `Locked door added: "${fromRoom?.title}" → "${toRoom?.title}" (key: ${keyId}${values.consume ? ', consumed on use' : ''}).`,
  };
};

export const lockedDoor = {
  id:          'lockedDoor',
  icon:        '🔒',
  name:        'Locked Door',
  description: 'Adds a key-gated Choice between two rooms. Pick an existing key item or create a new one; optionally consume on use.',
  defaults,
  steps,
  build,
};
