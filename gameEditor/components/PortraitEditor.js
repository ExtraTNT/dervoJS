/**
 * PortraitEditor - multi-layer paper-doll style portrait builder.
 *
 * A portrait widget has:
 *   width, height : box the portrait paints into
 *   layers[]      : ordered bottom-to-top; for each, the renderer picks the
 *                   first binding whose item the player has, else defaultImage
 *
 * Each layer:
 *   { id, name, defaultImage, bindings: [{ itemId, image }] }
 *
 * Drag-and-drop layer reorder uses the dervo DragList. Inventory bindings let
 * a layer change image based on what the player has (e.g. helmet layer shows
 * cap.png when player has cap, helm.png when player has helm).
 */

import { div, p, span, img } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid, DragList } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { emptyPortraitLayer } from '../schema.js';
import { onText } from '../helpers.js';
import { AssetInput } from './AssetInput.js';
import { groupedOptions } from './FolderedList.js';
import { resolveAssetRef } from '../assets.js';

// Layer.defaultImage can be either a plain URL, an inline `data:` URL, or an
// `asset:<id>` ref. Browsers can't render `asset:...` as an <img src> - we
// need to resolve it against the project's asset catalogue first. Asset
// data bytes might be hydrating from IDB (the marker → '' branch in
// resolveAssetRef), in which case we get back '' and show the empty-layer
// placeholder until the next render picks up the real URL.
const _PreviewBox = (widget, layers, project) => {
  const w = Number(widget.width)  || 220;
  const h = Number(widget.height) || 280;
  return div({
    style: `position:relative; width:${w}px; height:${h}px; border:1px dashed var(--border); border-radius:var(--radius); background:var(--surface); overflow:hidden`,
  })(
    layers.length === 0
      ? [div({ style: 'display:grid; place-items:center; height:100%; color:var(--text-muted); font-size:13px' })(['(no layers)'])]
      : layers.map(l => {
          const src = resolveAssetRef(project, l.defaultImage);
          return src
            ? img({ src, style: 'position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none' })([])
            : div({ style: 'position:absolute; inset:0; display:grid; place-items:center; color:var(--text-muted); font-size:11px' })([`(empty: ${l.name})`]);
        })
  );
};

const LayerCard = ({ layer, items, onChange, onDelete }) => {
  const set = patch => onChange({ ...layer, ...patch });
  const setBindings = bindings => onChange({ ...layer, bindings });

  return div({ className: 'gef-surface-card' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      span({ style: 'cursor:grab; color:var(--text-muted)', title: 'Drag to reorder' })(['⋮⋮']),
      span({ style: 'font-weight:600; font-size:13px' })([layer.name || '(unnamed)']),
      Badge({ variant: 'gray' })([`#${layer.id.slice(0, 4)}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['Delete']),
    ]),

    Grid({ cols: 2, gap: 8 })([
      TextInput({
        label:       'Name',
        value:       layer.name,
        onChange:    onText(v => set({ name: v })),
        placeholder: 'body / hat / weapon',
      }),
      AssetInput({
        label:       'Default image (URL or upload)',
        value:       layer.defaultImage,
        onChange:    v => set({ defaultImage: v }),
        accept:      'image',
        placeholder: 'https://… (or empty)',
      }),
    ]),

    div({ style: 'margin-top:10px' })([
      div({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px' })([
        `Inventory bindings (${layer.bindings.length})`,
      ]),
      p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
        'When the player has an item, show its image instead of the default. First match wins.',
      ]),
      ...(layer.bindings.length === 0
        ? []
        : layer.bindings.map((b, i) =>
            div({ style: 'display:grid; grid-template-columns: 1fr 2fr auto; gap:8px; margin-bottom:6px; align-items:end' })([
              Select({
                label:    i === 0 ? 'When player has' : '',
                options:  [
                  { value: '', label: '- pick item -' },
                  ...groupedOptions(items)(it => ({ value: it.id, label: `${it.name} (${it.id})` })),
                ],
                value:    b.itemId,
                onChange: onText(v => setBindings(layer.bindings.map((x, k) => k === i ? { ...x, itemId: v } : x))),
              }),
              AssetInput({
                label:       i === 0 ? 'Show image (URL or upload)' : '',
                value:       b.image,
                onChange:    v => setBindings(layer.bindings.map((x, k) => k === i ? { ...x, image: v } : x)),
                accept:      'image',
                placeholder: 'https://…',
              }),
              Button({ size: 'sm', variant: 'ghost', onClick: () => setBindings(layer.bindings.filter((_, k) => k !== i)) })(['x']),
            ])
          )),
      Button({ size: 'sm', variant: 'ghost', onClick: () => setBindings([...layer.bindings, { itemId: items[0]?.id || '', image: '' }]) })(['+ Add binding']),
    ]),
  ]);
};

const PortraitEditor = ({ widget, items, project, onChange }) => {
  const set = patch => onChange({ ...widget, ...patch });
  const setLayers = layers => onChange({ ...widget, layers });

  const dragItems = (widget.layers || []).map(l => ({ ...l, id: l.id }));

  return Stack({ gap: 12 })([
    Card({ title: 'Portrait size' })([
      Grid({ cols: 2, gap: 10 })([
        NumberInput({ label: 'Width (px)',  value: Number(widget.width)  || 220, min: 60, max: 600, onChange: v => set({ width:  Number(v) || 220 }) }),
        NumberInput({ label: 'Height (px)', value: Number(widget.height) || 280, min: 60, max: 800, onChange: v => set({ height: Number(v) || 280 }) }),
      ]),
    ]),

    Card({ title: 'Preview (default images only)' })([
      div({ style: 'display:flex; justify-content:center' })([
        _PreviewBox(widget, widget.layers || [], project),
      ]),
      p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted); text-align:center' })([
        'In-game, inventory bindings override the default per layer.',
      ]),
    ]),

    Card({ title: `Layers (${(widget.layers || []).length}) · drag to reorder` })([
      Stack({ gap: 8 })([
        ...(dragItems.length === 0
          ? [div({ className: 'gef-empty' })(['No layers yet. Add one below.'])]
          : [DragList({
              items: dragItems,
              onChange: newOrder => setLayers(newOrder),
              renderItem: layer => LayerCard({
                layer,
                items,
                onChange: next => setLayers(widget.layers.map(l => l.id === layer.id ? next : l)),
                onDelete: () => setLayers(widget.layers.filter(l => l.id !== layer.id)),
              }),
            })]),
        Button({ size: 'sm', onClick: () => setLayers([...(widget.layers || []), emptyPortraitLayer(`layer ${(widget.layers || []).length + 1}`)]) })(['+ Add layer']),
      ]),
    ]),
  ]);
};

export { PortraitEditor };
