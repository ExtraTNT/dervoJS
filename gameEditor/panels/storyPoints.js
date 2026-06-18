/**
 * Story Points panel - narrative-arc rooms organized in their own tab.
 *
 * A story point is a room with `kind: 'story'`. Engine-wise it renders exactly
 * like a scene room (pages + choices). Nothing is auto-created: the dev opts
 * into either an explicit Choice list OR an `onEnd` Effect that fires at the
 * end of the last page (single "Continue" button - label = the last page's
 * advanceLabel). Without either, the player sits on the last page with no
 * exit - author's responsibility.
 *
 * Chains form through:
 *   - Choice `to:` → next story point (or world room)
 *   - Choice action mode `random loot table` with `navigate` kind entries →
 *     random story-point pick (the beer pick in the canonical recipe)
 *   - room.onEnd as randomLoot navigate → no-click random routing
 */

import { div, span, h2, h3, p, button } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState, updateById } from '../store.js';
import { confirmAction } from '../components/ConfirmDialog.js';
import { emptyStoryRoom, emptyPage, emptyChoice } from '../schema.js';
import { onText, projectVars, updateAt, removeAt, swapAt } from '../helpers.js';
import { PageEditor }      from '../components/PageEditor.js';
import { ChoiceEditor }    from '../components/ChoiceEditor.js';
import { EffectEditor }    from '../components/EffectEditor.js';
import { ConditionEditor } from '../components/ConditionEditor.js';
import { FolderedList, FolderField, folderSuggestions, groupedOptions } from '../components/FolderedList.js';

// ─── Helpers ────────────────────────────────────────────────────────────

const _vars = projectVars;

// Story rooms live in the same `rooms` array as scene rooms; the alias
// just gives call sites a more local-reading name.
const _updateStory = updateById('rooms');

const _addStory = () => setProject(p => {
  const s = emptyStoryRoom();
  return { ...p, rooms: [...p.rooms, s] };
});

const _deleteStory = id => setProject(p => {
  const next = p.rooms.filter(r => r.id !== id);
  // Sweep choices pointing at this story point - null out their `to`.
  const sanitized = next.map(r => ({
    ...r,
    choices: r.choices.map(c => c.to === id ? { ...c, to: '' } : c),
  }));
  return { ...p, rooms: sanitized };
});

const _duplicateStory = id => setProject(p => {
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

// ─── List ───────────────────────────────────────────────────────────────

const _storyRow = selectedId => s => {
  const hasOnEnd  = s.onEnd && s.onEnd.mode && s.onEnd.mode !== 'none';
  const hasChoice = (s.choices || []).length > 0;
  return button({
    className: `gef-list-btn${s.id === selectedId ? ' active' : ''}`,
    onclick:   () => setState({ selectedStoryId: s.id }),
    type:      'button',
  })([
    span({})([s.title || '(untitled)']),
    ...(hasChoice ? [Badge({ variant: 'blue' })([`${s.choices.length} ch`])] : []),
    ...(hasOnEnd  ? [Badge({ variant: 'purple' })(['onEnd'])] : []),
    span({ className: 'gef-id' })([s.id]),
  ]);
};

const StoryList = (project, selectedId, collapsed = {}) => {
  const stories = project.rooms.filter(r => r.kind === 'story');
  return Stack({ gap: 4 })([
    h2({ style: 'font-size:14px; margin:0 0 4px' })([`Story Points (${stories.length})`]),
    p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
      'Narrative arcs. Exits are explicit - set up Choices or an On-end Effect; nothing is auto-created.',
    ]),
    ...(stories.length === 0
      ? [div({ className: 'gef-empty' })(['No story points yet.'])]
      : [FolderedList({
          items:      stories,
          panelKey:   'stories',
          collapsed,
          renderItem: _storyRow(selectedId),
        })]),
    Button({ size: 'sm', variant: 'ghost', onClick: _addStory, style: 'margin-top:8px' })(['+ Add story point']),
  ]);
};

// ─── Editor ─────────────────────────────────────────────────────────────

const StoryEditor = (story, project) => {
  const vars     = _vars(project);
  // Every room is a valid choice target - including other story points - so the
  // dev can chain "drink beer" → "dark-beer-storypoint" via a regular choice.
  const roomOpts = groupedOptions(project.rooms)(r => ({
    value: r.id,
    label: `${r.kind === 'story' ? '⭐ ' : ''}${r.title || r.id}`,
  }));

  const set = patch => _updateStory(story.id)(patch);

  const _overList  = key => fn => _updateStory(story.id)(r => ({ ...r, [key]: fn(r[key] || []) }));
  const _overPages = fn  => _updateStory(story.id)(r => {
    const next = fn(r.pages || []);
    return { ...r, pages: next.length ? next : [emptyPage()] };
  });

  const _setPage    = i => patch => _overPages(updateAt(i)(patch));
  const _addPage    = ()         => _overPages(pages => [...pages, emptyPage()]);
  const _deletePage = i          => _overPages(removeAt(i));
  const _movePage   = i => dir   => _overPages(swapAt(i)(dir));

  const _setChoice    = i => next => _overList('choices')(updateAt(i)(next));
  const _addChoice    = ()         => _overList('choices')(arr => [...arr, emptyChoice()]);
  const _deleteChoice = i          => _overList('choices')(removeAt(i));
  const _moveChoice   = i => dir   => _overList('choices')(swapAt(i)(dir));

  return Stack({ gap: 14 })([
    Card({ title: 'Story point' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label:    'ID',
            value:    story.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === story.id) return;
              setProject(p => ({
                ...p,
                rooms: p.rooms.map(r => {
                  if (r.id === story.id) return { ...r, id: safe };
                  // Sweep choice `to` references.
                  const choices = r.choices.map(c => c.to === story.id ? { ...c, to: safe } : c);
                  return { ...r, choices };
                }),
                meta: p.meta.start === story.id ? { ...p.meta, start: safe } : p.meta,
              }));
              setState({ selectedStoryId: safe });
            }),
          }),
          TextInput({
            label:    'Title',
            value:    story.title,
            onChange: onText(v => set({ title: v })),
          }),
        ]),
        FolderField({
          id:          `story-folder-${story.id}`,
          value:       story.folder,
          onChange:    v => set({ folder: v }),
          suggestions: folderSuggestions(project.rooms.filter(r => r.kind === 'story')),
        }),
        p({ className: 'gef-hint' })([
          'Pages advance via the per-page ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['advanceLabel']),
          ' button. The final page shows your Choices, if any. If you leave Choices empty AND configure an On-end Effect below, the final-page button fires that Effect instead. Without either, the player sits on the last page with no exit - your call.',
        ]),
      ]),
    ]),

    Card({ title: 'On enter (fires the first time the story point is opened each visit)' })([
      Stack({ gap: 8 })([
        ConditionEditor({
          condition: story.onEnterCondition,
          vars,
          onChange:  v => set({ onEnterCondition: v }),
        }),
        EffectEditor({
          effect:   story.onEnter,
          vars,
          label:    'Effect',
          onChange: v => set({ onEnter: v }),
        }),
      ]),
    ]),

    Card({ title: `Pages (${story.pages.length})` })([
      Stack({ gap: 4 })([
        ...story.pages.map((pg, i) =>
          PageEditor({
            page:        pg,
            index:       i,
            isLast:      i === story.pages.length - 1,
            canDelete:   story.pages.length > 1,
            onChange:    _setPage(i),
            onDelete:    () => _deletePage(i),
            onMoveUp:    () => _movePage(i)(-1),
            onMoveDown:  () => _movePage(i)(+1),
          })
        ),
        Button({ size: 'sm', variant: 'ghost', onClick: _addPage })(['+ Add page']),
      ]),
    ]),

    Card({ title: 'On end (fires once if you have no Choices and reach the last page)' })([
      Stack({ gap: 8 })([
        p({ className: 'gef-hint' })([
          'Hook for "no decision, just an outcome". Useful for ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['random loot table']),
          ' with ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['navigate']),
          ' kind entries (random outcome routing), or a ',
          span({ style: 'font-family:ui-monospace,monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['js']),
          ' body (', span({ className: 'dv-mono' })(['c.goto("bar")']), '). Ignored if you defined any Choices.',
        ]),
        EffectEditor({
          effect:   story.onEnd,
          vars,
          label:    'Effect',
          onChange: v => set({ onEnd: v }),
        }),
      ]),
    ]),

    Card({ title: `Choices (${story.choices.length})` })([
      Stack({ gap: 4 })([
        ...(story.choices.length === 0
          ? [div({ className: 'gef-empty' })([
              'No choices. If you defined an On-end Effect above, a single Continue button fires it at the end of the last page. Otherwise the player is stuck on the last page - your call.',
            ])]
          : story.choices.map((c, i) => ChoiceEditor({
              choice:     c,
              vars,
              roomOpts,
              isFirst:    i === 0,
              isLast:     i === story.choices.length - 1,
              onChange:   _setChoice(i),
              onDelete:   () => _deleteChoice(i),
              onMoveUp:   () => _moveChoice(i)(-1),
              onMoveDown: () => _moveChoice(i)(+1),
            }))),
        Button({ size: 'sm', variant: 'ghost', onClick: _addChoice })(['+ Add choice']),
      ]),
    ]),

    Card({ title: 'Actions' })([
      div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
        Button({ size: 'sm', variant: 'ghost', onClick: () => _duplicateStory(story.id) })(['Duplicate']),
        Button({ size: 'sm', variant: 'danger', onClick: () => confirmAction({
          title:        'Delete story point',
          message:      `Delete story point "${story.title || story.id}"?`,
          confirmLabel: 'Delete',
          danger:       true,
          onConfirm:    () => { _deleteStory(story.id); setState({ selectedStoryId: null }); },
        }) })(['Delete']),
      ]),
    ]),
  ]);
};

const StoryPointsPanel = state => {
  const { project, selectedStoryId } = state;
  const stories = project.rooms.filter(r => r.kind === 'story');
  const selected = stories.find(s => s.id === selectedStoryId) || stories[0];

  return div({ style: 'display:grid; grid-template-columns: 300px 1fr; gap:16px; align-items:start' })([
    div({})([StoryList(project, selected?.id, state.collapsedFolders?.stories || {})]),
    div({})([
      selected
        ? StoryEditor(selected, project)
        : div({ className: 'gef-empty' })([
            'Click "+ Add story point" to create your first narrative arc. ',
            'Pages chain via "More"; choices can navigate to other rooms / story points, fire effects, or pick a random destination via the loot-table action.',
          ]),
    ]),
  ]);
};

export { StoryPointsPanel };
