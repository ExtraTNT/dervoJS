/**
 * Crafting builder: scaffolds a workbench room (or attaches to an existing
 * one) and an advanced-mode NPC with a menu topic and one sub-topic per
 * recipe. Recipes reference existing items only; the form blocks the
 * Build until both sides are picked.
 */

import { p, div, span } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { NumberInput } from '../../../src/components/NumberInput.js';
import { Select } from '../../../src/components/Select.js';
import { Button } from '../../../src/components/Button.js';
import { Stack, Grid } from '../../../src/components/Layout.js';
import { Card } from '../../../src/components/Card.js';
import { onText } from '../../helpers.js';
import {
  emptyNpc, emptyChoice, emptyPage, emptyEffect, emptyCondition, emptyRoom, emptyTopic,
} from '../../schema.js';
import { slug, uniqueId, idsOf } from '../../helpers.js';
import { groupedOptions } from '../FolderedList.js';

const _emptyRecipe = () => ({
  name:         'New recipe',
  ingredients:  [{ itemId: '', qty: 1 }],
  outputItemId: '',
  outputQty:    1,
});

const defaults = project => ({
  // Prefer an existing scene room so authors can attach crafting to a
  // tavern / smithy without adding a stub. Empty string means create new.
  roomId:       project.rooms.find(r => r.kind === 'scene')?.id || '',
  newRoomName:  'Workbench',
  npcName:      'Workbench',
  folder:       'crafting',
  recipes:      [_emptyRecipe()],
});

const _ingredientRow = (values, setValue, project, ri, ii) => {
  const recipe = values.recipes[ri];
  const row    = recipe.ingredients[ii];
  const patchRow = patch => setValue('recipes', values.recipes.map((r, k) =>
    k === ri
      ? { ...r, ingredients: r.ingredients.map((g, j) => j === ii ? { ...g, ...patch } : g) }
      : r));
  const removeRow = () => setValue('recipes', values.recipes.map((r, k) =>
    k === ri
      ? { ...r, ingredients: r.ingredients.filter((_, j) => j !== ii) }
      : r));
  return Grid({ cols: 4, gap: 6 })([
    Select({
      label:    ii === 0 ? 'Ingredient' : '',
      options:  [{ value: '', label: '- pick item -' }, ...groupedOptions(project.items)(it => ({ value: it.id, label: it.name }))],
      value:    row.itemId || '',
      onChange: onText(v => patchRow({ itemId: v })),
    }),
    NumberInput({
      label:    ii === 0 ? 'Qty' : '',
      value:    Number(row.qty) || 1,
      min:      1,
      onChange: v => patchRow({ qty: Math.max(1, Number(v) || 1) }),
      style:    'justify-self:start',
    }),
    div({})([]),
    div({ style: 'display:flex; align-items:end' })([
      Button({ size: 'sm', variant: 'ghost', onClick: removeRow })(['x']),
    ]),
  ]);
};

const _recipeCard = (values, setValue, project, ri) => {
  const recipe = values.recipes[ri];
  const patchRecipe = patch => setValue('recipes', values.recipes.map((r, k) => k === ri ? { ...r, ...patch } : r));
  const removeRecipe = () => setValue('recipes', values.recipes.filter((_, k) => k !== ri));
  const addIngredient = () => setValue('recipes', values.recipes.map((r, k) =>
    k === ri ? { ...r, ingredients: [...r.ingredients, { itemId: '', qty: 1 }] } : r));
  return Card({})([
    Stack({ gap: 8 })([
      div({ style: 'display:flex; gap:8px; align-items:end' })([
        div({ style: 'flex:1' })([
          TextInput({
            label:   `Recipe ${ri + 1}`,
            value:   recipe.name || '',
            onInput: e => patchRecipe({ name: e.target.value }),
          }),
        ]),
        Button({ size: 'sm', variant: 'ghost', onClick: removeRecipe })(['Remove']),
      ]),
      ...recipe.ingredients.map((_, ii) => _ingredientRow(values, setValue, project, ri, ii)),
      Button({ size: 'sm', variant: 'ghost', onClick: addIngredient })(['+ Ingredient']),
      Grid({ cols: 2, gap: 8 })([
        Select({
          label:    'Produces',
          options:  [{ value: '', label: '- pick item -' }, ...groupedOptions(project.items)(it => ({ value: it.id, label: it.name }))],
          value:    recipe.outputItemId || '',
          onChange: onText(v => patchRecipe({ outputItemId: v })),
        }),
        NumberInput({
          label:    'Qty',
          value:    Number(recipe.outputQty) || 1,
          min:      1,
          onChange: v => patchRecipe({ outputQty: Math.max(1, Number(v) || 1) }),
          style:    'justify-self:start',
        }),
      ]),
    ]),
  ]);
};

// Validation.

const _validatePlace = values => {
  if (!values.roomId && !(values.newRoomName || '').trim()) return 'Pick an existing room or name a new one.';
  if (!(values.npcName || '').trim()) return 'Name the workbench NPC.';
  return null;
};

const _validateRecipes = values => {
  const recipes = values.recipes || [];
  if (recipes.length === 0) return 'Add at least one recipe.';
  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i];
    if (!(r.name || '').trim()) return `Recipe ${i + 1}: name is required.`;
    const ing = (r.ingredients || []).filter(g => g.itemId);
    if (ing.length === 0)    return `Recipe ${i + 1}: needs at least one ingredient.`;
    if (!r.outputItemId)     return `Recipe ${i + 1}: pick an output item.`;
  }
  return null;
};

const steps = [
  {
    title: 'Place',
    validate: _validatePlace,
    render: ({ values, setValue, project }) => {
      const sceneRooms = project.rooms.filter(r => r.kind === 'scene');
      return Stack({ gap: 10 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
          'Drop an NPC at a workbench. Pick an existing scene room (smithy, kitchen, …) or create a fresh one. Each recipe becomes a sub-topic the player can dive into from the workbench menu.',
        ]),
        Select({
          label:   'Workbench room',
          options: [
            { value: '', label: '- create new room -' },
            ...groupedOptions(sceneRooms)(r => ({ value: r.id, label: r.title || r.id })),
          ],
          value:    values.roomId || '',
          onChange: onText(v => setValue('roomId', v)),
        }),
        ...(!values.roomId
          ? [TextInput({
              label:   'New room name',
              value:   values.newRoomName || '',
              onInput: e => setValue('newRoomName', e.target.value),
            })]
          : []),
        Grid({ cols: 2, gap: 8 })([
          TextInput({
            label:   'Workbench NPC name',
            value:   values.npcName || '',
            onInput: e => setValue('npcName', e.target.value),
          }),
          TextInput({
            label:       'Folder',
            value:       values.folder || '',
            onInput:     e => setValue('folder', e.target.value),
            placeholder: 'crafting',
          }),
        ]),
      ]);
    },
  },
  {
    title: 'Recipes',
    validate: _validateRecipes,
    render: ({ values, setValue, project }) => Stack({ gap: 10 })([
      p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Each recipe consumes its ingredients (subtracted from ',
        span({ className: 'dv-mono' })(['inventory']),
        ') and adds the output. Items must already exist in the project - add them in the Items tab first.',
      ]),
      ...(project.items.length === 0
        ? [div({ style: 'padding:10px; border:1px dashed var(--border); border-radius:var(--radius); color:var(--text-muted); font-size:12.5px' })([
            'No items in the project yet. Add some on the Items tab - they\'ll show up in the pickers below.',
          ])]
        : []),
      ...(values.recipes || []).map((_, ri) => _recipeCard(values, setValue, project, ri)),
      Button({
        size: 'sm', variant: 'ghost',
        onClick: () => setValue('recipes', [...(values.recipes || []), _emptyRecipe()]),
      })(['+ Add recipe']),
    ]),
  },
  {
    title: 'Review',
    render: ({ values, project }) => {
      const itemName = id => (project.items.find(it => it.id === id) || {}).name || id;
      return Card({ title: 'About to add' })([
        Stack({ gap: 4 })([
          div({})([
            values.roomId
              ? `Workbench attached to room: ${project.rooms.find(r => r.id === values.roomId)?.title || values.roomId}`
              : `New room: "${values.newRoomName}"`,
          ]),
          div({})([`NPC: ${values.npcName}`]),
          div({})([`Recipes: ${(values.recipes || []).length}`]),
          ...(values.recipes || []).map(r => div({ style: 'color:var(--text-muted); font-size:12px' })([
            `• ${r.name} - ${
              r.ingredients.filter(g => g.itemId).map(g => `${g.qty}x ${itemName(g.itemId)}`).join(' + ')
            } → ${r.outputQty}x ${itemName(r.outputItemId)}`,
          ])),
        ]),
      ]);
    },
  },
];

// Build.

// Subtract / add an inventory entry by id. Uses the `inv.<itemId>` target path
// the EffectEditor already understands.
const _invOp = (target, op, value) => ({
  target,
  op,
  value,
  condition: emptyCondition(),
  min: { enabled: false, statKey: '', mul: 0, const: 0 },
  max: { enabled: false, statKey: '', mul: 0, const: 0 },
});

// Build the "have all ingredients" JS condition. Each ingredient becomes
// `(inv?.id ?? 0) >= qty`, AND-joined. Trivially `true` when there are no
// ingredients. Defensive: _validateRecipes already requires at least 1.
const _hasAllExpr = ingredients => {
  const parts = ingredients
    .filter(g => g.itemId)
    .map(g => `(c.state.inventory?.[${JSON.stringify(g.itemId)}] ?? 0) >= ${Number(g.qty) || 1}`);
  return parts.length ? parts.join(' && ') : 'true';
};

const _craftAction = (recipe) => ({
  ...emptyEffect(),
  mode: 'simple',
  // Inventory ops use give/take/set, not add/sub. The engine routes the
  // give/take/set kinds through state.inventory.
  ops: [
    ...recipe.ingredients
      .filter(g => g.itemId)
      .map(g => _invOp(`inv.${g.itemId}`, 'take', Number(g.qty) || 1)),
    _invOp(`inv.${recipe.outputItemId}`, 'give', Number(recipe.outputQty) || 1),
  ],
  message: `Crafted ${recipe.outputQty || 1}x ${recipe.outputItemId}.`,
});

const _recipeTopic = (recipe, topicId, itemName) => {
  const ingLines = recipe.ingredients
    .filter(g => g.itemId)
    .map(g => `${g.qty}x ${itemName(g.itemId)}`)
    .join(' + ');
  const outLine = `${recipe.outputQty || 1}x ${itemName(recipe.outputItemId)}`;
  return {
    ...emptyTopic(),
    id:    topicId,
    name:  recipe.name,
    pages: [{
      ...emptyPage(),
      text: `Craft ${recipe.name}.\nIngredients: ${ingLines}\nProduces: ${outLine}`,
      advanceLabel: 'Continue',
    }],
    choices: [
      {
        ...emptyChoice(),
        label:     `Craft (${ingLines})`,
        flow:      'exitBack',
        condition: { ...emptyCondition(), mode: 'js', expr: _hasAllExpr(recipe.ingredients) },
        action:    _craftAction(recipe),
      },
      { ...emptyChoice(), label: 'Back', flow: 'exitBack' },
    ],
  };
};

const _menuTopic = (menuId, recipeTopics) => ({
  ...emptyTopic(),
  id:    menuId,
  name:  'Menu',
  pages: [{
    ...emptyPage(),
    text:         'What do you want to craft?',
    advanceLabel: 'More',
  }],
  choices: [
    ...recipeTopics.map(rt => ({
      ...emptyChoice(),
      label:   rt.name,
      flow:    'change',
      topicId: rt.id,
    })),
    { ...emptyChoice(), label: 'Return.', flow: 'exitBack' },
  ],
});

const build = (project, values) => {
  let next = project;

  // 1. Workbench room (existing or new).
  let roomId = values.roomId;
  if (!roomId) {
    roomId = uniqueId(`room_${slug(values.newRoomName) || 'workbench'}`, idsOf('rooms')(next));
    const room = {
      ...emptyRoom(roomId),
      title:  values.newRoomName || 'Workbench',
      folder: values.folder || 'crafting',
      pages:  [{ ...emptyPage(), text: `You arrive at the workbench.`, advanceLabel: 'More' }],
    };
    next = { ...next, rooms: [...next.rooms, room] };
  }

  // 2. Topics: one per recipe + a Menu topic that fans out.
  const itemName = id => (next.items.find(it => it.id === id) || {}).name || id;
  const recipeTopics = (values.recipes || []).map(r =>
    _recipeTopic(r, `topic_${slug(r.name) || 'recipe'}_${Math.random().toString(36).slice(2, 6)}`, itemName));
  const menuId  = `topic_menu_${Math.random().toString(36).slice(2, 6)}`;
  const menuTop = _menuTopic(menuId, recipeTopics);

  const npcId = uniqueId(`npc_${slug(values.npcName) || 'workbench'}`, idsOf('npcs')(next));
  const npcName = values.npcName || 'Workbench';
  const npc = {
    ...emptyNpc(npcId),
    name:          npcName,
    locations:     [roomId],
    folder:        values.folder || 'crafting',
    greeting:      '',
    // The workbench isn't a person; "Talk to Workbench" reads wrong. Pick a
    // verb-y label by default so the choice button reads naturally.
    interactLabel: `Use ${npcName.toLowerCase()}`,
    role:          'dialogue',
    advanced:      true,
    pages:         [{ ...emptyPage(), text: '', advanceLabel: 'More' }],
    topics:        [menuTop, ...recipeTopics],
    entryTopicId:  menuId,
  };
  next = { ...next, npcs: [...next.npcs, npc] };

  return {
    project: next,
    summary: `Added ${npc.name} at "${(next.rooms.find(r => r.id === roomId) || {}).title || roomId}" with ${recipeTopics.length} recipe${recipeTopics.length === 1 ? '' : 's'}.`,
  };
};

export const crafting = {
  id:          'crafting',
  icon:        '⚒️',
  name:        'Crafting workbench',
  description: 'Workbench NPC with sub-topics per recipe. Pick an existing room or create one; each recipe consumes its ingredients and adds the output.',
  defaults,
  steps,
  build,
};
