/**
 * Meta panel — project title, start room, default music, stats list, flags list.
 *
 * Leaf components (TextInput, NumberInput, Select) are single-call: `TextInput({...})`.
 * Curried wrappers (Card, Stack, Grid, Toggle, Button, Badge) take children: `Card({...})([…])`.
 */

import { div, p, h2, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Toggle } from '../../src/components/Toggle.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject } from '../store.js';
import { onText } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';

const _setMeta = patch => setProject(pj => ({ ...pj, meta: { ...pj.meta, ...patch } }));

const _setStat  = (i, patch) => setProject(pj => ({ ...pj, stats: pj.stats.map((s, k) => k === i ? { ...s, ...patch } : s) }));
const _addStat  = () => setProject(pj => ({ ...pj, stats: [...pj.stats, { key: '', initial: 0 }] }));
const _delStat  = i => setProject(pj => ({ ...pj, stats: pj.stats.filter((_, k) => k !== i) }));

const _setFlag  = (i, patch) => setProject(pj => ({ ...pj, flags: pj.flags.map((f, k) => k === i ? { ...f, ...patch } : f) }));
const _addFlag  = () => setProject(pj => ({ ...pj, flags: [...pj.flags, { key: '', initial: false }] }));
const _delFlag  = i => setProject(pj => ({ ...pj, flags: pj.flags.filter((_, k) => k !== i) }));

const StatRow = (s, i) =>
  Grid({ cols: 3, gap: 8 })([
    TextInput({
      label: i === 0 ? 'Key' : '',
      value: s.key,
      onChange: onText(v => _setStat(i, { key: v })),
      placeholder: 'hp',
    }),
    NumberInput({
      label: i === 0 ? 'Initial' : '',
      value: Number(s.initial) || 0,
      onChange: v => _setStat(i, { initial: Number(v) || 0 }),
    }),
    div({ style: 'display:flex; align-items:flex-end' })([
      Button({ variant: 'ghost', size: 'sm', onClick: () => _delStat(i) })(['Remove']),
    ]),
  ]);

const FlagRow = (f, i) =>
  Grid({ cols: 3, gap: 8 })([
    TextInput({
      label: i === 0 ? 'Key' : '',
      value: f.key,
      onChange: onText(v => _setFlag(i, { key: v })),
      placeholder: 'metHermit',
    }),
    div({ style: 'display:flex; align-items:flex-end; gap:8px' })([
      Toggle({ on: !!f.initial, onChange: v => _setFlag(i, { initial: !!v }) })([]),
      span({ style: 'font-size:12px; color:var(--text-muted)' })([f.initial ? 'true' : 'false']),
    ]),
    div({ style: 'display:flex; align-items:flex-end' })([
      Button({ variant: 'ghost', size: 'sm', onClick: () => _delFlag(i) })(['Remove']),
    ]),
  ]);

const MetaPanel = project => {
  const roomOpts = project.rooms.map(r => ({ value: r.id, label: `${r.title} (${r.id})` }));
  return Stack({ gap: 16 })([
    h2({ style: 'margin:0' })(['Project']),

    Card({ title: 'Game' })([
      Stack({ gap: 12 })([
        TextInput({
          label: 'Title',
          value: project.meta.title,
          onChange: onText(v => _setMeta({ title: v })),
        }),
        Select({
          label: 'Start room',
          options: [{ value: '', label: '— pick one —' }, ...roomOpts],
          value: project.meta.start,
          onChange: onText(v => _setMeta({ start: v })),
        }),
        AssetInput({
          label:       'Default background music (URL or upload)',
          value:       project.meta.defaultMusic,
          onChange:    v => _setMeta({ defaultMusic: v }),
          accept:      'audio',
          placeholder: 'https://example.com/loop.mp3',
        }),
      ]),
    ]),

    Card({ title: 'Stats' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
          'Numeric values on the game state (hp, gold, STR, …). Read with state.<key>.',
        ]),
        ...(project.stats.length === 0
          ? [div({ className: 'gef-empty' })(['No stats yet.'])]
          : project.stats.map(StatRow)),
        div({})([
          Button({ size: 'sm', onClick: _addStat })(['+ Add stat']),
        ]),
      ]),
    ]),

    Card({ title: 'Flags' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
          'Boolean toggles (metHermit, hasKey, …). Live under state.flags.<key>.',
        ]),
        ...(project.flags.length === 0
          ? [div({ className: 'gef-empty' })(['No flags yet.'])]
          : project.flags.map(FlagRow)),
        div({})([
          Button({ size: 'sm', onClick: _addFlag })(['+ Add flag']),
        ]),
      ]),
    ]),

    Card({ title: 'Starting inventory' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
          'Items the player begins the game with. Lives at state.inventory[itemId] and is consumed/added by give/take effects exactly the same way as in-game pickups.',
        ]),
        ...(project.items.length === 0
          ? [div({ className: 'gef-empty' })(['Add some items in the Items tab first.'])]
          : project.items.map(it => {
              const count = Number(project.startingInventory?.[it.id] || 0);
              return Grid({ cols: 3, gap: 8 })([
                div({ style: 'display:flex; align-items:center; gap:8px' })([
                  span({ style: 'font-weight:500' })([it.name || it.id]),
                  span({ style: 'font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([it.id]),
                ]),
                NumberInput({
                  value: count,
                  min:   0,
                  onChange: v => setProject(p => {
                    const n = Math.max(0, Number(v) || 0);
                    const inv = { ...(p.startingInventory || {}) };
                    if (n === 0) delete inv[it.id]; else inv[it.id] = n;
                    return { ...p, startingInventory: inv };
                  }),
                }),
                div({ style: 'display:flex; align-items:center; color:var(--text-muted); font-size:12px' })([
                  count > 0 ? `→ state.inventory["${it.id}"] = ${count}` : '',
                ]),
              ]);
            })),
      ]),
    ]),

    Card({ title: 'Additional imports' })([
      Stack({ gap: 10 })([
        p({ style: 'margin:0; font-size:13px; color:var(--text-muted)' })([
          'Extra JS modules to inject into the generated game bundle. Each row produces one ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['import <binding> from "<specifier>";']),
          ' line at the top of the chosen generated file, BEFORE the auto-imports. Leave the binding blank for a side-effect-only ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['import "<specifier>";']),
          '. Use this to bring in the dervoJS Markdown renderer, your own UI bits, or anything else your JS-mode bodies need.',
        ]),
        ...(project.meta.imports || []).map((imp, i) => {
          const _patch = patch => {
            const imports = [...(project.meta.imports || [])];
            imports[i] = { ...imports[i], ...patch };
            _setMeta({ imports });
          };
          const _remove = () => {
            const imports = [...(project.meta.imports || [])];
            imports.splice(i, 1);
            _setMeta({ imports });
          };
          return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; background:var(--surface)' })([
            Grid({ cols: 3, gap: 8 })([
              Select({
                label:    i === 0 ? 'Generated file' : '',
                options:  [
                  { value: '',        label: '— pick file —' },
                  { value: 'main',    label: 'main.js'    },
                  { value: 'scenes',  label: 'scenes.js'  },
                  { value: 'world',   label: 'world.js'   },
                  { value: 'items',   label: 'items.js'   },
                  { value: 'sidebar', label: 'sidebar.js (if enabled)' },
                ],
                value:    imp.file || '',
                onChange: onText(v => _patch({ file: v })),
              }),
              TextInput({
                label:       i === 0 ? 'Binding (named / default / *)' : '',
                value:       imp.binding || '',
                onChange:    onText(v => _patch({ binding: v })),
                placeholder: '{ markdownToVnode } · M · * as N · (blank)',
              }),
              TextInput({
                label:       i === 0 ? 'Module specifier' : '',
                value:       imp.target || '',
                onChange:    onText(v => _patch({ target: v })),
                placeholder: '../src/components/Markdown.js',
              }),
            ]),
            div({ style: 'display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:8px' })([
              span({ style: 'font-size:11px; font-family:ui-monospace,monospace; color:var(--text-muted); flex:1; word-break:break-all' })([
                imp.target
                  ? (imp.binding
                      ? `import ${imp.binding} from '${imp.target}';`
                      : `import '${imp.target}';`)
                  : '(specifier required)',
              ]),
              Button({ variant: 'ghost', size: 'sm', onClick: _remove })(['Remove']),
            ]),
          ]);
        }),
        Button({ size: 'sm', variant: 'ghost', onClick: () => {
          const imports = [...(project.meta.imports || []), { file: 'main', target: '', binding: '' }];
          _setMeta({ imports });
        } })(['+ Add module']),
      ]),
    ]),
    Card({ title: 'Summary' })([
      div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
        Badge({ variant: 'blue'   })([`${project.rooms.length} room${project.rooms.length === 1 ? '' : 's'}`]),
        Badge({ variant: 'green'  })([`${project.npcs.length} NPC${project.npcs.length === 1 ? '' : 's'}`]),
        Badge({ variant: 'yellow' })([`${project.stats.length} stat${project.stats.length === 1 ? '' : 's'}`]),
        Badge({ variant: 'gray'   })([`${project.flags.length} flag${project.flags.length === 1 ? '' : 's'}`]),
      ]),
    ]),
  ]);
};

export { MetaPanel };
