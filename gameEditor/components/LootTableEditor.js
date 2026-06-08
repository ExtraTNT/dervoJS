/**
 * LootTableEditor — UI for a weighted-pick loot bag.
 *
 * Shape (mirrors gameEditor/schema.js):
 *   LootTable {
 *     picks:       number    how many independent rolls to make
 *     unique:      boolean   if true, each entry can only win once per roll
 *     showFlavour: boolean   append a "Loot: …" line to the scene body
 *     entries:     LootEntry[]
 *   }
 *
 * Per-entry kinds (one award each):
 *   item    give itemId x randInt(countMin..countMax)
 *   gold    state.gold += randInt(countMin..countMax)
 *   stat    state[statKey] += randInt(statMin..statMax)
 *   flag    state.flags[flagKey] = flagValue
 *   nothing no award — use to model "X% chance of nothing"
 *   js      free-form body with `c` in scope, for anything else
 *
 * Curried throughout.
 */

import { div, span, p, textarea } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Button } from '../../src/components/Button.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { onText } from '../helpers.js';
import { emptyLootEntry } from '../schema.js';
import { WeightBonusList } from './WeightBonusEditor.js';
import { groupedOptions } from './FolderedList.js';

// Kind options — `stat` covers any currency (gold / silver / gems / etc.) so
// there's no dedicated `gold` kind. `navigate` / `learnSkill` / `talkNpc` let
// the same random-table machinery drive non-loot decisions (random room, random
// skill, random NPC).
const KIND_OPTS = [
  { value: 'item',       label: 'item — give X count'              },
  { value: 'stat',       label: 'stat — add to stat (any currency)' },
  { value: 'flag',       label: 'flag — set flag'                  },
  { value: 'navigate',   label: 'navigate — go to a room'          },
  { value: 'learnSkill', label: 'learnSkill — add to state.skills' },
  { value: 'talkNpc',    label: 'talkNpc — open NPC dialogue'      },
  { value: 'nothing',    label: 'nothing — no outcome'             },
  { value: 'js',         label: 'js — free-form'                   },
];

// Curried set-helper: takes the existing table and produces a new table with
// one entry replaced / added / removed / moved. Keeps callers terse.
const _patchEntry = entries => i => patch => entries.map((e, k) => k === i ? { ...e, ...patch } : e);
const _removeEntry = entries => i => entries.filter((_, k) => k !== i);
const _moveEntry = entries => i => dir => {
  const j = i + dir;
  if (j < 0 || j >= entries.length) return entries;
  const out = [...entries];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

// One row of count fields — used by both `item` and `gold` entries.
const _countFields = entry => onPatch => Grid({ cols: 2, gap: 8 })([
  NumberInput({
    label: 'Count min',
    value: Number(entry.countMin) || 0,
    onChange: v => onPatch({ countMin: Math.max(0, Number(v) || 0) }),
    min: 0,
  }),
  NumberInput({
    label: 'Count max',
    value: Number(entry.countMax) || 0,
    onChange: v => onPatch({ countMax: Math.max(0, Number(v) || 0) }),
    min: 0,
  }),
]);

const _entryRow = vars => entries => index => onChange => {
  const entry = entries[index];
  const onPatch = patch => onChange(_patchEntry(entries)(index)(patch));
  const onDelete = () => onChange(_removeEntry(entries)(index));
  const onMove = dir => onChange(_moveEntry(entries)(index)(dir));

  const itemOpts  = [{ value: '', label: '— pick item —' }, ...groupedOptions(vars.items  || [])(it => ({ value: it.id, label: it.name || it.id }))];
  const statOpts  = [{ value: '', label: '— pick stat —' }, ...(vars.stats  || []).map(k => ({ value: k, label: k }))];
  const flagOpts  = [{ value: '', label: '— pick flag —' }, ...(vars.flags  || []).map(k => ({ value: k, label: k }))];
  const roomOpts  = [{ value: '', label: '— pick room —' }, ...groupedOptions(vars.rooms  || [])(r => ({ value: r.id, label: `${r.kind === 'story' ? '⭐ ' : ''}${r.title || r.id}` }))];
  const skillOpts = [{ value: '', label: '— pick skill —' }, ...(vars.skills || []).map(s => ({ value: s.id, label: s.name || s.id }))];
  const npcOpts   = [{ value: '', label: '— pick NPC —' }, ...groupedOptions(vars.npcs   || [])(n => ({ value: n.id, label: n.name || n.id }))];

  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface)' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      span({ style: 'font-weight:600; font-size:12px' })([`Entry ${index + 1}`]),
      span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([`#${entry.id.slice(-5)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: () => onMove(-1), disabled: index === 0                  })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: () => onMove( 1), disabled: index === entries.length - 1 })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['Delete']),
    ]),
    Stack({ gap: 8 })([
      Grid({ cols: 2, gap: 8 })([
        NumberInput({
          label: 'Weight',
          value: Number(entry.weight) || 0,
          onChange: v => onPatch({ weight: Math.max(0, Number(v) || 0) }),
          min: 0,
        }),
        Select({
          label: 'Kind',
          options: KIND_OPTS,
          value: entry.kind || 'item',
          onChange: onText(v => onPatch({ kind: v })),
        }),
      ]),

      // Kind-specific fields.
      ...(entry.kind === 'item'
        ? [Select({
            label: 'Item',
            options: itemOpts,
            value: entry.itemId || '',
            onChange: onText(v => onPatch({ itemId: v })),
          }),
          _countFields(entry)(onPatch),
        ]
        : []),

      ...(entry.kind === 'navigate'
        ? [Select({
            label:   'Room',
            options: roomOpts,
            value:   entry.roomId || '',
            onChange: onText(v => onPatch({ roomId: v })),
          })]
        : []),

      ...(entry.kind === 'learnSkill'
        ? [Select({
            label:   'Skill',
            options: skillOpts,
            value:   entry.skillId || '',
            onChange: onText(v => onPatch({ skillId: v })),
          })]
        : []),

      ...(entry.kind === 'talkNpc'
        ? [Select({
            label:   'NPC',
            options: npcOpts,
            value:   entry.npcId || '',
            onChange: onText(v => onPatch({ npcId: v })),
          })]
        : []),

      ...(entry.kind === 'stat'
        ? [Select({
            label: 'Stat',
            options: statOpts,
            value: entry.statKey || '',
            onChange: onText(v => onPatch({ statKey: v })),
          }),
          Grid({ cols: 2, gap: 8 })([
            NumberInput({
              label: 'Add min',
              value: Number(entry.statMin) || 0,
              onChange: v => onPatch({ statMin: Number(v) || 0 }),
            }),
            NumberInput({
              label: 'Add max',
              value: Number(entry.statMax) || 0,
              onChange: v => onPatch({ statMax: Number(v) || 0 }),
            }),
          ]),
        ]
        : []),

      ...(entry.kind === 'flag'
        ? [Grid({ cols: 2, gap: 8 })([
            Select({
              label: 'Flag',
              options: flagOpts,
              value: entry.flagKey || '',
              onChange: onText(v => onPatch({ flagKey: v })),
            }),
            Select({
              label: 'Set to',
              options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
              value: String(entry.flagValue !== false),
              onChange: onText(v => onPatch({ flagValue: v === 'true' })),
            }),
          ])]
        : []),

      ...(entry.kind === 'js'
        ? [div({})([
            span({ style: 'font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px' })([
              'Fires when this entry is picked. Receives ',
              span({ style: 'font-family:ui-monospace,monospace' })(['c']),
              ' (the game ctx). Use ',
              span({ style: 'font-family:ui-monospace,monospace' })(['c.setState(...)']), '.',
            ]),
            textarea({
              value: entry.jsBody || '',
              oninput: e => onPatch({ jsBody: e.target.value }),
              rows: 3,
              spellcheck: false,
              style: 'width:100%; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface-2); color:var(--text); resize:vertical; box-sizing:border-box',
              placeholder: 'c.setState(s => ({ xp: (s.xp || 0) + 50 }));',
            })([]),
          ])]
        : []),

      // Weight bonuses — extracted into a shared WeightBonusList component
      // so loot-entry bonuses and oneOf-option bonuses share one UI.
      WeightBonusList({
        bonuses:  entry.bonuses || [],
        vars,
        onChange: next => onPatch({ bonuses: next }),
        label:    'Weight bonuses — raise odds dynamically',
      }),

      // Optional per-pick message. Pushed to state._messageQueue when THIS
      // entry is picked; the next scene render shows the buffer + Continue.
      // Multi-pick tables accumulate one entry per roll.
      div({ style: 'border-top:1px dashed var(--border-2); padding-top:8px; margin-top:4px' })([
        span({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600; display:block; margin-bottom:4px' })([
          'Message (optional, ${…} template)',
        ]),
        textarea({
          value:   entry.message || '',
          oninput: e => onPatch({ message: e.target.value }),
          rows: 2,
          spellcheck: false,
          style: 'width:100%; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface-2); color:var(--text); resize:vertical; box-sizing:border-box',
          placeholder: 'You picked up ${gain.gold ?? 0} gold!',
        })([]),
      ]),
    ]),
  ]);
};

// Live probability preview — convert weights to percentages so the author can
// sanity-check the bag at a glance.
const _probabilityLine = table => {
  const entries = table.entries || [];
  const totalW  = entries.reduce((a, e) => a + Math.max(0, Number(e.weight) || 0), 0);
  if (totalW <= 0) return null;
  const _summary = e => {
    const pct = `${((Math.max(0, Number(e.weight) || 0) / totalW) * 100).toFixed(1)}%`;
    const what =
      e.kind === 'item'       ? `${e.itemId || '?'} x ${e.countMin}${e.countMax !== e.countMin ? `–${e.countMax}` : ''}`
      : e.kind === 'stat'     ? `${e.statKey || '?'} +${e.statMin}${e.statMax !== e.statMin ? `–${e.statMax}` : ''}`
      : e.kind === 'flag'     ? `flag ${e.flagKey || '?'} = ${e.flagValue}`
      : e.kind === 'navigate' ? `goto ${e.roomId  || '?'}`
      : e.kind === 'learnSkill' ? `learn ${e.skillId || '?'}`
      : e.kind === 'talkNpc'  ? `talkTo ${e.npcId  || '?'}`
      : e.kind === 'nothing'  ? '(nothing)'
      : 'js';
    return `${pct} → ${what}`;
  };
  return p({ style: 'margin:0; font-size:11.5px; color:var(--text-muted); font-family:ui-monospace,monospace; line-height:1.6' })([
    `Per-roll odds: ${entries.map(_summary).join('  ·  ')}`,
  ]);
};

const LootTableEditor = ({ table, vars = {}, onChange }) => {
  const entries = Array.isArray(table.entries) ? table.entries : [];
  const _setEntries = next => onChange({ ...table, entries: next });
  return Stack({ gap: 10 })([
    Grid({ cols: 3, gap: 8 })([
      NumberInput({
        label: 'Picks',
        value: Math.max(1, Number(table.picks) || 1),
        onChange: v => onChange({ ...table, picks: Math.max(1, Number(v) || 1) }),
        min: 1,
      }),
      div({ style: 'display:flex; align-items:end; padding-bottom:6px' })([
        Toggle({
          on:       !!table.unique,
          onChange: v => onChange({ ...table, unique: !!v }),
        })(['Unique picks (sample without replacement)']),
      ]),
      div({ style: 'display:flex; align-items:end; padding-bottom:6px' })([
        Toggle({
          on:       table.showFlavour !== false,
          onChange: v => onChange({ ...table, showFlavour: !!v }),
        })(['Append "Loot: …" line']),
      ]),
    ]),
    ...(_probabilityLine(table) ? [_probabilityLine(table)] : []),
    ...(entries.length === 0
      ? [div({ className: 'gef-empty' })(['Empty bag. Add at least one entry below.'])]
      : entries.map((_, i) => _entryRow(vars)(entries)(i)(_setEntries))),
    Button({
      size: 'sm', variant: 'ghost',
      onClick: () => _setEntries([...entries, emptyLootEntry()]),
    })(['+ Add entry']),
  ]);
};

export { LootTableEditor };
