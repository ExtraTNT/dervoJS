/**
 * PageEditor — one media-page block. Used both inside rooms and NPC dialogues.
 *
 * A "page" is a unit of content with text and optional image / video URLs;
 * the engine advances through pages with a "More" button (label customisable)
 * until the last page, which shows the real choices.
 */

import { div, span, p, textarea } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Button } from '../../src/components/Button.js';
import { onText } from '../helpers.js';
import { AssetInput } from './AssetInput.js';

const PageEditor = ({ page, index, isLast, onChange, onDelete, onMoveUp, onMoveDown, canDelete = true }) => {
  const set = patch => onChange({ ...page, ...patch });

  return div({ className: 'gef-page' })([
    div({ className: 'gef-page-head' })([
      span({})([`Page ${index + 1}${isLast ? ' (final — choices appear here)' : ''}`]),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveUp,   disabled: index === 0 })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveDown, disabled: isLast })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete,   disabled: !canDelete })(['Delete']),
    ]),

    textarea({
      value: page.text,
      oninput: e => set({ text: e.target.value }),
      rows: 4,
      placeholder: 'What does the player read here?',
      style: 'width:100%; padding:8px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); font-family:inherit; font-size:14px; line-height:1.5; resize:vertical',
    })([]),

    div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px' })([
      AssetInput({
        label:       'Image (URL or upload)',
        value:       page.image,
        onChange:    v => set({ image: v }),
        accept:      'image',
        placeholder: 'https://… or click Upload',
      }),
      AssetInput({
        label:       'Video (URL or upload)',
        value:       page.video,
        onChange:    v => set({ video: v }),
        accept:      'video',
        placeholder: 'https://… or click Upload',
      }),
    ]),

    ...(!isLast
      ? [div({ style: 'margin-top:8px' })([
          TextInput({
            label:       '"More" button label',
            value:       page.advanceLabel || 'More',
            onChange:    onText(v => set({ advanceLabel: v })),
            placeholder: 'More',
          }),
        ])]
      : [p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted)' })([
          'Last page — the choices below render here. Add a page above to extend the sequence.',
        ])]),
  ]);
};

export { PageEditor };
