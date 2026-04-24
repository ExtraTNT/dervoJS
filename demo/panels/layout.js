import { div, Card, Row, Col, Stack, Grid, Container, Tabs, List, Badge, p, span, li, strong } from '../../src/index.js';
import { DragList, useDragListGroup } from '../../src/index.js';
import { setState, getState, MemoBadge } from '../store.js';

const demoBox = (label, accent = false) =>
  div({
    style: [
      'padding:12px 16px; border-radius:var(--radius); font-size:13px; text-align:center;',
      accent
        ? 'background:var(--accent); color:#fff;'
        : 'background:var(--surface-2); border:1px dashed var(--border); color:var(--text-muted);',
    ].join(' '),
  })([label]);

export const layoutPanel = state =>
  div({})([

    Card({ title: 'Row + Col (responsive 12-col grid)' })([
      p({ style: 'margin-top:0; font-size:13px; color:var(--text-muted)' })([
        'Columns stack on mobile (<768px). Resize the window to see breakpoints.',
      ]),

      Row({ gap: 12 })([
        Col({ span: 12, md: 8 })([ demoBox('col-12  →  col-md-8  (main content)') ]),
        Col({ span: 12, md: 4 })([ demoBox('col-12  →  col-md-4  (sidebar)') ]),
      ]),

      div({ style: 'margin-top:12px' })([
        Row({ gap: 12 })([
          Col({ span: 12, sm: 6, md: 3 })([ demoBox('12 / sm:6 / md:3') ]),
          Col({ span: 12, sm: 6, md: 3 })([ demoBox('12 / sm:6 / md:3') ]),
          Col({ span: 12, sm: 6, md: 3 })([ demoBox('12 / sm:6 / md:3') ]),
          Col({ span: 12, sm: 6, md: 3 })([ demoBox('12 / sm:6 / md:3') ]),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Grid (auto equal-column)' })([
        p({ style: 'margin-top:0; font-size:13px; color:var(--text-muted)' })([
          'cols: 1 (default) → sm:2 → md:3',
        ]),
        Grid({ cols: 1, sm: 2, md: 3, gap: 10 })([
          demoBox('Item 1', true),
          demoBox('Item 2', true),
          demoBox('Item 3', true),
          demoBox('Item 4', true),
          demoBox('Item 5', true),
          demoBox('Item 6', true),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Grid styled=true + styled=false comparison' })([
        Row({ gap: 16 })([
          Col({ span: 12, md: 6 })([
            p({ style: 'font-size:12px; color:var(--text-muted); margin:0 0 8px' })(['styled=true']),
            Grid({ cols: 2, gap: 8, styled: true })([
              demoBox('A'), demoBox('B'), demoBox('C'), demoBox('D'),
            ]),
          ]),
          Col({ span: 12, md: 6 })([
            p({ style: 'font-size:12px; color:var(--text-muted); margin:0 0 8px' })(['styled=false (unstyled)']),
            Grid({ cols: 2, gap: 8 })([
              demoBox('A'), demoBox('B'), demoBox('C'), demoBox('D'),
            ]),
          ]),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Stack (vertical flex)' })([
        Row({ gap: 16 })([
          Col({ span: 12, md: 6 })([
            p({ style: 'font-size:12px; color:var(--text-muted); margin:0 0 8px' })(['gap: 8px']),
            Stack({ gap: 8 })([
              demoBox('Stack item 1', true),
              demoBox('Stack item 2', true),
              demoBox('Stack item 3', true),
            ]),
          ]),
          Col({ span: 12, md: 6 })([
            p({ style: 'font-size:12px; color:var(--text-muted); margin:0 0 8px' })(['gap: 24px']),
            Stack({ gap: 24 })([
              demoBox('Stack item 1'),
              demoBox('Stack item 2'),
              demoBox('Stack item 3'),
            ]),
          ]),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Container (max-width wrappers)' })([
        Stack({ gap: 8 })([
          Container({ maxWidth: 'sm', styled: true })([ demoBox('maxWidth: sm (640px) + styled') ]),
          Container({ maxWidth: 'md', styled: true })([ demoBox('maxWidth: md (768px) + styled') ]),
          Container({ maxWidth: 'lg', styled: false })([ demoBox('maxWidth: lg — unstyled') ]),
          Container({ maxWidth: 320, styled: true })([ demoBox('maxWidth: 320 (number) + styled') ]),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({
        title: 'Card with footer',
        footer: [
          Badge({ variant: state.agreed ? 'green' : 'gray' })([
            state.agreed ? 'Terms accepted' : 'Terms not accepted',
          ]),
        ],
      })([
        p({ style: 'margin:0' })([`Name: ${state.name || '(none)'}`]),
        p({ style: 'margin:4px 0 0' })([`Email: ${state.email || '(none)'}`]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'List' })([
        List({
          items: ['JavaScript', 'TypeScript', 'Elm', 'Haskell', 'PureScript'],
          renderItem: (lang, i) =>
            li({ className: 'list-item' })([
              div({ style: 'display:flex; align-items:center; justify-content:space-between' })([
                span({})([lang]),
                MemoBadge({ variant: i % 2 === 0 ? 'blue' : 'purple' })([`#${i + 1}`]),
              ]),
            ]),
        }),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Nested Tabs' })([
        Tabs({
          tabs: [
            { id: 'one',   label: 'Tab 1' },
            { id: 'two',   label: 'Tab 2' },
            { id: 'three', label: 'Tab 3' },
          ],
          activeTab: state.innerTab,
          onTabChange: id => setState({ innerTab: id }),
        })([
          p({})(['Content for tab 1 — nested tabs work the same way.']),
          p({})(['Content for tab 2.']),
          p({})(['Content for tab 3.']),
        ]),
      ]),
    ]),

    // ── DragList ────────────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'DragList — single list reorder' })([
        p({ style: 'margin-top:0; font-size:13px; color:var(--text-muted)' })([
          'Drag the handles to reorder. Order is kept in state.dragKeep.',
        ]),
        DragList({
          items:      state.dragKeep,
          onChange:   dragKeep => setState({ dragKeep }),
          renderItem: item => span({ style: 'font-size:14px' })([item.label]),
        }),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'DragList — two-list transfer (keep / delete)' })([
        p({ style: 'margin-top:0; font-size:13px; color:var(--text-muted)' })([
          'Drag items between the two columns. Items dropped into "To delete" will be removed when you confirm.',
        ]),
        div({ style: 'display:flex; gap:16px' })([
          div({ style: 'flex:1; min-width:0' })([
            p({ style: 'margin:0 0 6px; font-size:12px; font-weight:600; color:var(--text)' })(['✅ Keep']),
            DragList({
              groupId:    'review',
              listId:     'keep',
              items:      state.dragKeep,
              onChange:   dragKeep => setState({ dragKeep }),
              onTransfer: useDragListGroup({
                keep: { getItems: () => getState().dragKeep,   setItems: dragKeep   => setState({ dragKeep }) },
                del:  { getItems: () => getState().dragDelete, setItems: dragDelete => setState({ dragDelete }) },
              }),
              emptyLabel: 'All items moved to delete',
              renderItem: item => span({ style: 'font-size:13px' })([item.label]),
            }),
          ]),
          div({ style: 'flex:1; min-width:0' })([
            p({ style: 'margin:0 0 6px; font-size:12px; font-weight:600; color:var(--danger,#e53)' })(['🗑 Delete']),
            DragList({
              groupId:    'review',
              listId:     'del',
              items:      state.dragDelete,
              onChange:   dragDelete => setState({ dragDelete }),
              onTransfer: useDragListGroup({
                keep: { getItems: () => getState().dragKeep,   setItems: dragKeep   => setState({ dragKeep }) },
                del:  { getItems: () => getState().dragDelete, setItems: dragDelete => setState({ dragDelete }) },
              }),
              emptyLabel: 'Drag items here to delete',
              renderItem: item => span({ style: 'font-size:13px' })([item.label]),
            }),
          ]),
        ]),

        div({ style: 'margin-top:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap' })([
          state.dragDelete.length > 0
            ? div({
                style: 'flex:1; font-size:13px; color:var(--danger,#e53)',
              })([`${state.dragDelete.length} item${state.dragDelete.length > 1 ? 's' : ''} marked for deletion: ${state.dragDelete.map(x => x.label).join(', ')}`])
            : div({ style: 'flex:1; font-size:13px; color:var(--text-muted)' })(['Move items to "Delete" to confirm removal.']),
          state.dragDelete.length > 0
            ? div({
                style: 'display:flex; gap:8px',
              })([
                div({
                  className: 'btn btn-danger btn-sm',
                  onclick: () => setState({ dragDelete: [] }),
                  style: 'cursor:pointer',
                })(['Confirm delete']),
                div({
                  className: 'btn btn-secondary btn-sm',
                  onclick: () => setState({
                    dragKeep: [...state.dragKeep, ...state.dragDelete],
                    dragDelete: [],
                  }),
                  style: 'cursor:pointer',
                })(['Restore all']),
              ])
            : div({ style: 'display:none' })([]),
        ]),
      ]),
    ]),
  ]);
