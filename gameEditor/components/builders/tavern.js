/**
 * tavern builder - scaffolds:
 *   - A scene room (the tavern).
 *   - A simple-mode dialogue NPC (barkeep) located in the tavern with one
 *     Choice per service:
 *       Rest    - pay N currency → refill chosen stats (clamped to a "max"
 *                 stat each, e.g. hp → maxHp; per-op clamp from the new
 *                 EffectEditor).
 *       Drinks  - pay N currency → +/- some stat. One choice per drink.
 *       Cure    - (optional healer mode) pay N currency → clear a flag.
 *       Goodbye - exit.
 *   - Optional Choice on a connecting room to reach the tavern.
 *
 * Stats that can be "filled to a max stat" are auto-detected (any pair where
 * the project has both `hp` and `maxHp`, `mp` and `maxMp`, etc.). Rest with
 * no explicit max just uses a plain set/add op without clamp.
 */

import { p, div, span, label as lblEl } from '../../../src/elements.js';
import { TextInput } from '../../../src/components/TextInput.js';
import { NumberInput } from '../../../src/components/NumberInput.js';
import { Select } from '../../../src/components/Select.js';
import { Toggle } from '../../../src/components/Toggle.js';
import { Button } from '../../../src/components/Button.js';
import { Stack, Grid } from '../../../src/components/Layout.js';
import { Card } from '../../../src/components/Card.js';
import { onText } from '../../helpers.js';
import {
  emptyNpc, emptyChoice, emptyPage, emptyEffect, emptyCondition, emptyRoom, emptyTopic,
  _rid,
} from '../../schema.js';
import { slug, uniqueId, ensureFlag, idsOf, flagKeys } from '../../helpers.js';

const defaults = project => {
  // Tavern spends/refills currency and stat amounts - numeric stats only.
  const statKeys = project.stats.filter(s => (s.type || 'number') === 'number').map(s => s.key);
  const currency = statKeys.includes('gold') ? 'gold' : (statKeys[0] || '');
  // Pre-seed a rest entry for every (hp, maxHp)-like pair we can spot.
  // Falls back to a single hp row if maxHp isn't there.
  const restRows = [];
  if (statKeys.includes('hp'))   restRows.push({ stat: 'hp', maxStat: statKeys.includes('maxHp') ? 'maxHp' : '' });
  if (statKeys.includes('mp'))   restRows.push({ stat: 'mp', maxStat: statKeys.includes('maxMp') ? 'maxMp' : '' });
  if (restRows.length === 0 && statKeys[0]) restRows.push({ stat: statKeys[0], maxStat: '' });
  return {
    tavernName:    'The Drunken Goose',
    barkeepName:   'Innkeep',
    connectFrom:   '',
    currencyStat:  currency,
    restCost:      5,
    restRows,
    drinks:        [
      { name: 'Ale',  cost: 2, stat: statKeys.find(k => k !== currency) || statKeys[0] || '', amount: 1 },
    ],
    addHealer:     false,
    cures:         [],
  };
};

const _restRow = (values, setValue, project, i) => {
  const statOpts = [{ value: '', label: '- pick stat -' }, ...project.stats.filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key }))];
  const row = values.restRows[i];
  const patchRow = patch => setValue('restRows', values.restRows.map((r, k) => k === i ? { ...r, ...patch } : r));
  const removeRow = () => setValue('restRows', values.restRows.filter((_, k) => k !== i));
  return Grid({ cols: 3, gap: 8 })([
    Select({
      label: i === 0 ? 'Refill stat' : '',
      options: statOpts,
      value: row.stat || '',
      onChange: onText(v => patchRow({ stat: v })),
    }),
    Select({
      label: i === 0 ? 'Capped to (optional)' : '',
      options: [{ value: '', label: '(no cap)' }, ...project.stats.filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key }))],
      value: row.maxStat || '',
      onChange: onText(v => patchRow({ maxStat: v })),
    }),
    div({ style: 'display:flex; align-items:end' })([
      Button({ size: 'sm', variant: 'ghost', onClick: removeRow })(['Remove']),
    ]),
  ]);
};

const _drinkRow = (values, setValue, project, i) => {
  const statOpts = [{ value: '', label: '- pick stat -' }, ...project.stats.filter(s => (s.type || 'number') === 'number').map(s => ({ value: s.key, label: s.key }))];
  const row = values.drinks[i];
  const patchRow = patch => setValue('drinks', values.drinks.map((r, k) => k === i ? { ...r, ...patch } : r));
  const removeRow = () => setValue('drinks', values.drinks.filter((_, k) => k !== i));
  return Grid({ cols: 5, gap: 8 })([
    TextInput({
      label: i === 0 ? 'Name' : '',
      value: row.name || '',
      onInput: e => patchRow({ name: e.target.value }),
    }),
    NumberInput({
      label: i === 0 ? 'Cost' : '',
      value: Number(row.cost) || 0,
      min: 0,
      onChange: v => patchRow({ cost: Math.max(0, Number(v) || 0) }),
      style: 'justify-self:start',
    }),
    Select({
      label: i === 0 ? 'Buffs stat' : '',
      options: statOpts,
      value: row.stat || '',
      onChange: onText(v => patchRow({ stat: v })),
    }),
    NumberInput({
      label: i === 0 ? 'By' : '',
      value: Number(row.amount) || 0,
      onChange: v => patchRow({ amount: Number(v) || 0 }),
      style: 'justify-self:start',
    }),
    div({ style: 'display:flex; align-items:end' })([
      Button({ size: 'sm', variant: 'ghost', onClick: removeRow })(['x']),
    ]),
  ]);
};

const _cureRow = (values, setValue, project, i) => {
  const flagOpts = [{ value: '', label: '- pick flag -' }, ...project.flags.map(f => ({ value: f.key, label: f.key }))];
  const row = values.cures[i];
  const patchRow = patch => setValue('cures', values.cures.map((r, k) => k === i ? { ...r, ...patch } : r));
  const removeRow = () => setValue('cures', values.cures.filter((_, k) => k !== i));
  return Grid({ cols: 4, gap: 8 })([
    TextInput({
      label: i === 0 ? 'Label' : '',
      value: row.label || '',
      onInput: e => patchRow({ label: e.target.value }),
      placeholder: 'Cure poisoning',
    }),
    NumberInput({
      label: i === 0 ? 'Cost' : '',
      value: Number(row.cost) || 0,
      min: 0,
      onChange: v => patchRow({ cost: Math.max(0, Number(v) || 0) }),
      style: 'justify-self:start',
    }),
    Select({
      label: i === 0 ? 'Clears flag' : '',
      options: flagOpts,
      value: row.flag || '',
      onChange: onText(v => patchRow({ flag: v })),
    }),
    div({ style: 'display:flex; align-items:end' })([
      Button({ size: 'sm', variant: 'ghost', onClick: removeRow })(['x']),
    ]),
  ]);
};

const _validatePlace = values => {
  if (!values.tavernName  || !values.tavernName.trim())  return 'Name the tavern.';
  if (!values.barkeepName || !values.barkeepName.trim()) return 'Name the barkeep.';
  return null;
};

const _validateRest = values => {
  if (!values.currencyStat) return 'Pick the currency stat used to pay for services.';
  const rows = (values.restRows || []).filter(r => r.stat);
  if (rows.length === 0) return 'Add at least one stat to refill on rest (or remove all rows to skip the Rest service).';
  return null;
};

const _validateDrinks = values => {
  for (let i = 0; i < (values.drinks || []).length; i++) {
    const d = values.drinks[i];
    // Empty rows are tolerated and dropped at build time. Partial rows aren't.
    const filled = d.name || d.stat;
    if (filled && (!d.name || !d.stat)) {
      return `Drink ${i + 1}: needs both a name and a buff stat (remove the row to skip).`;
    }
  }
  return null;
};

const _validateHealer = values => {
  if (!values.addHealer) return null;
  for (let i = 0; i < (values.cures || []).length; i++) {
    const c = values.cures[i];
    const filled = c.label || c.flag;
    if (filled && (!c.label || !c.flag)) {
      return `Cure ${i + 1}: needs both a label and a flag (remove the row to skip).`;
    }
  }
  return null;
};

const steps = [
  {
    title: 'Place',
    validate: _validatePlace,
    render: ({ values, setValue, project }) => {
      const rooms = project.rooms.filter(r => r.kind !== 'story');
      return Stack({ gap: 10 })([
        p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
          'A new scene room + a barkeep NPC. Optionally wire a "Visit the tavern" choice from another room you already have.',
        ]),
        Grid({ cols: 2, gap: 8 })([
          TextInput({
            label: 'Tavern name',
            value: values.tavernName || '',
            onInput: e => setValue('tavernName', e.target.value),
          }),
          TextInput({
            label: 'Barkeep name',
            value: values.barkeepName || '',
            onInput: e => setValue('barkeepName', e.target.value),
          }),
        ]),
        Select({
          label: 'Add an entry choice on…',
          options: [{ value: '', label: '- none (wire manually later) -' }, ...rooms.map(r => ({ value: r.id, label: r.title || r.id }))],
          value: values.connectFrom || '',
          onChange: onText(v => setValue('connectFrom', v)),
        }),
      ]);
    },
  },
  {
    title: 'Rest',
    validate: _validateRest,
    render: ({ values, setValue, project }) => Stack({ gap: 10 })([
      p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Resting pays ', span({ style: 'font-weight:600' })([`${values.restCost} ${values.currencyStat || '?'}`]),
        ' and tops up each stat below. The "capped to" stat applies a runtime ',
        span({ className: 'dv-mono' })(['max']),
        ' clamp (', span({ className: 'dv-mono' })(['mul=1, statKey=maxX']),
        ') so it never overshoots.',
      ]),
      Grid({ cols: 2, gap: 8 })([
        Select({
          label: 'Currency stat',
          options: (() => {
            const numStats = project.stats.filter(s => (s.type || 'number') === 'number');
            return numStats.length
              ? numStats.map(s => ({ value: s.key, label: s.key }))
              : [{ value: '', label: '(no numeric stats yet)' }];
          })(),
          value: values.currencyStat || '',
          onChange: onText(v => setValue('currencyStat', v)),
        }),
        NumberInput({
          label: 'Rest cost',
          value: Number(values.restCost) || 0,
          min: 0,
          onChange: v => setValue('restCost', Math.max(0, Number(v) || 0)),
          style: 'justify-self:start',
        }),
      ]),
      ...(values.restRows || []).map((_, i) => _restRow(values, setValue, project, i)),
      Button({
        size: 'sm', variant: 'ghost',
        onClick: () => setValue('restRows', [...values.restRows, { stat: '', maxStat: '' }]),
      })(['+ Add rest stat']),
    ]),
  },
  {
    title: 'Drinks',
    validate: _validateDrinks,
    render: ({ values, setValue, project }) => Stack({ gap: 10 })([
      p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
        'Each drink is one Choice on the barkeep - pays the cost in the same currency, bumps a stat by the listed amount. Use negative amounts for debuffs.',
      ]),
      ...(values.drinks || []).map((_, i) => _drinkRow(values, setValue, project, i)),
      Button({
        size: 'sm', variant: 'ghost',
        onClick: () => setValue('drinks', [...values.drinks, { name: '', cost: 1, stat: '', amount: 1 }]),
      })(['+ Add drink']),
    ]),
  },
  {
    title: 'Healer',
    validate: _validateHealer,
    render: ({ values, setValue, project }) => Stack({ gap: 10 })([
      div({})([
        Toggle({
          on: !!values.addHealer,
          onChange: v => setValue('addHealer', v),
        })(['Add cure services on the same barkeep']),
      ]),
      ...(values.addHealer
        ? [
            p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
              'Each cure pays the listed cost and flips a flag back to false. The flag must exist in the project (Project → Flags). Pick any flag you use to model conditions (poisoned, cursed, …).',
            ]),
            ...(values.cures || []).map((_, i) => _cureRow(values, setValue, project, i)),
            Button({
              size: 'sm', variant: 'ghost',
              onClick: () => setValue('cures', [...(values.cures || []), { label: '', cost: 5, flag: '' }]),
            })(['+ Add cure']),
          ]
        : []),
    ]),
  },
  {
    title: 'Review',
    render: ({ values }) => Card({ title: 'About to add' })([
      Stack({ gap: 4 })([
        div({})([`Tavern: "${values.tavernName}" (barkeep: ${values.barkeepName})`]),
        div({})([
          `Rest: ${values.restCost} ${values.currencyStat} → fills `,
          (values.restRows || []).map(r => r.maxStat ? `${r.stat}→${r.maxStat}` : r.stat).filter(Boolean).join(', ') || '(none)',
        ]),
        div({})([`Drinks: ${(values.drinks || []).filter(d => d.name).length}`]),
        ...(values.addHealer ? [div({})([`Cures: ${(values.cures || []).filter(c => c.label && c.flag).length}`])] : []),
        ...(values.connectFrom ? [div({})([`Entry choice will be added on room "${values.connectFrom}".`])] : []),
      ]),
    ]),
  },
];

// ── builder ──────────────────────────────────────────────────────────────────

// Build a single simple-op for a stat write. Clamps when `maxStat` is given.
const _statOp = (target, op, value, maxStat) => ({
  target,
  op,
  value,
  condition: emptyCondition(),
  min: { enabled: false, statKey: '', mul: 0, const: 0 },
  max: maxStat
    ? { enabled: true, statKey: maxStat, mul: 1, const: 0 }
    : { enabled: false, statKey: '', mul: 0, const: 0 },
});

const _flagOp = (key, value) => ({
  target: `flags.${key}`,
  op:     'set',
  value:  Boolean(value),
  condition: emptyCondition(),
  min: { enabled: false, statKey: '', mul: 0, const: 0 },
  max: { enabled: false, statKey: '', mul: 0, const: 0 },
});

// Helpers below produce `flow: 'stay'` topic choices - clicking fires the
// effect and re-renders the SAME topic, so the player can keep ordering /
// resting without leaving the NPC. Goodbye uses `flow: 'exitBack'` to return
// to the tavern room.
const _restChoice = (currency, cost, restRows) => ({
  ...emptyChoice(),
  label:     `Rest (${cost} ${currency})`,
  flow:      'stay',
  condition: {
    ...emptyCondition(),
    mode: 'simple',
    key:  currency,
    op:   '>=',
    value: cost,
  },
  action: {
    ...emptyEffect(),
    mode: 'simple',
    ops: [
      _statOp(currency, 'sub', cost),
      // For each rest row: add a generous chunk (9999) of the stat and let
      // the max clamp catch the result, OR add a sensible amount (10) when
      // no cap stat is configured.
      ...restRows
        .filter(r => r.stat)
        .map(r => r.maxStat
          ? _statOp(r.stat, 'add', 9999, r.maxStat)
          : _statOp(r.stat, 'add', 10)),
    ],
    message: 'You feel refreshed.',
  },
});

const _drinkChoice = (currency, drink) => ({
  ...emptyChoice(),
  label:     `Order ${drink.name} (${drink.cost} ${currency})`,
  flow:      'stay',
  condition: {
    ...emptyCondition(),
    mode: 'simple',
    key:  currency,
    op:   '>=',
    value: drink.cost,
  },
  action: {
    ...emptyEffect(),
    mode: 'simple',
    ops: [
      _statOp(currency, 'sub', drink.cost),
      ...(drink.stat ? [_statOp(drink.stat, drink.amount >= 0 ? 'add' : 'sub', Math.abs(drink.amount))] : []),
    ],
  },
});

const _cureChoice = (currency, cure) => ({
  ...emptyChoice(),
  label:     `${cure.label} (${cure.cost} ${currency})`,
  flow:      'stay',
  condition: {
    ...emptyCondition(),
    mode: 'js',
    // Only show when the player can afford it AND the flag is set.
    expr: `(c.state[${JSON.stringify(currency)}] || 0) >= ${Number(cure.cost) || 0} && !!c.state.flags?.${cure.flag}`,
  },
  action: {
    ...emptyEffect(),
    mode: 'simple',
    ops: [
      _statOp(currency, 'sub', cure.cost),
      _flagOp(cure.flag, false),
    ],
  },
});

const _goodbyeChoice = () => ({
  ...emptyChoice(),
  label: 'Goodbye.',
  flow:  'exitBack',
});

const build = (project, values) => {
  let next = project;

  // ── 1. Tavern room with a Leave choice that pops history (c.back()) ──
  const tavernId = uniqueId(`room_${slug(values.tavernName) || 'tavern'}`, idsOf('rooms')(next));
  const leaveChoice = {
    ...emptyChoice(),
    label:  values.connectFrom ? 'Step outside' : 'Leave the tavern',
    to:     '',                                     // action handles navigation
    action: {
      ...emptyEffect(),
      mode: 'js',
      // Pop history when there is any (the common case - player walked in
      // from somewhere). Fall back to the connecting room if specified, else
      // just stay put rather than crash.
      body: values.connectFrom
        ? `if (c.history && c.history.length) c.back(); else c.goto(${JSON.stringify(values.connectFrom)});`
        : 'if (c.history && c.history.length) c.back();',
    },
  };
  const tavern = {
    ...emptyRoom(tavernId),
    title:   values.tavernName || 'The Drunken Goose',
    folder:  'town',
    pages:   [{ ...emptyPage(), text: `You step inside ${values.tavernName || 'the tavern'}. The smell of stew and woodsmoke hits you.`, advanceLabel: 'More' }],
    choices: [leaveChoice],
  };
  next = { ...next, rooms: [...next.rooms, tavern] };

  // ── 2. Barkeep NPC - advanced-mode dialogue with a single "menu" topic
  // whose choices use flow:'stay' so the player can keep ordering after each
  // action. Goodbye uses flow:'exitBack' to return to the tavern room. ──
  const currency = values.currencyStat || 'gold';
  const restRows = (values.restRows || []).filter(r => r.stat);
  const drinks   = (values.drinks   || []).filter(d => d.name && d.stat);
  const cures    = values.addHealer ? (values.cures || []).filter(c => c.label && c.flag) : [];

  const menuChoices = [];
  if (restRows.length) menuChoices.push(_restChoice(currency, Number(values.restCost) || 0, restRows));
  for (const d of drinks) menuChoices.push(_drinkChoice(currency, d));
  for (const c of cures)  menuChoices.push(_cureChoice(currency, c));
  menuChoices.push(_goodbyeChoice());

  const menuTopicId = `topic_${_rid()}`;
  const menuTopic = {
    ...emptyTopic(),
    id:      menuTopicId,
    name:    'Menu',
    pages:   [{ ...emptyPage(), text: 'What can I get you?', advanceLabel: 'More' }],
    choices: menuChoices,
  };

  const barkeepId = uniqueId(`npc_${slug(values.barkeepName) || 'innkeep'}`, idsOf('npcs')(next));
  const barkeep = {
    ...emptyNpc(barkeepId),
    name:         values.barkeepName || 'Innkeep',
    locations:    [tavernId],
    folder:       'town',
    greeting:     'What can I get you, friend?',
    role:         'dialogue',
    advanced:     true,
    pages:        [{ ...emptyPage(), text: '', advanceLabel: 'More' }],
    topics:       [menuTopic],
    entryTopicId: menuTopicId,
  };
  next = { ...next, npcs: [...next.npcs, barkeep] };

  // ── 3. Ensure referenced flags exist (cures rely on them) ──
  for (const c of cures) next = ensureFlag(c.flag)(false)(next);

  // ── 4. Optional entry choice on a connecting room ──
  if (values.connectFrom) {
    const entry = {
      ...emptyChoice(),
      label: `Visit ${values.tavernName || 'the tavern'}`,
      to:    tavernId,
    };
    next = {
      ...next,
      rooms: next.rooms.map(r => r.id === values.connectFrom
        ? { ...r, choices: [...(r.choices || []), entry] }
        : r),
    };
  }

  const serviceCount = restRows.length + drinks.length + cures.length;
  return {
    project: next,
    summary: `Added "${tavern.title}" + ${barkeep.name} with ${serviceCount} service${serviceCount === 1 ? '' : 's'} (advanced-mode menu, stays after each action). Leave choice ${values.connectFrom ? 'returns to caller' : 'pops history'}.`,
  };
};

export const tavern = {
  id:          'tavern',
  icon:        '🍺',
  name:        'Tavern + Healer',
  description: 'New room + barkeep NPC with Rest (clamped refill), Drinks (one per buff/debuff), and optional Cures.',
  defaults,
  steps,
  build,
};
