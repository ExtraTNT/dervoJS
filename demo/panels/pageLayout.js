import { div, Card, p, strong, span, Grid, Row, Col, Table, Button, Badge } from '../../src/index.js';
import { setState } from '../store.js';
import { doc } from '../components/doc.js';

export const pageLayoutDemoPanel = state =>
  div({})([
    Card({ title: 'PageLayout — you\'re looking at it' })([
      p({ style: 'margin-top:0; font-size:13px; color:var(--text-muted)' })([
        'The entire demo is rendered inside a ',
        strong({})(['PageLayout']),
        ' — top bar, toggleable sidebar, scrollable main area, and footer. ',
        'Toggle the sidebar with ☰ up top.',
      ]),
      div({ style: 'margin-top:16px; border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; font-size:12px; color:var(--text-muted)' })([
        div({ style: 'padding:8px; text-align:center; background:var(--surface); border-bottom:1px solid var(--border)' })(['topBar (sticky)']),
        div({ style: 'display:flex; min-height:72px' })([
          div({ style: 'width:100px; padding:8px 4px; text-align:center; border-right:1px solid var(--border); background:var(--surface-2); display:flex; align-items:center; justify-content:center' })(['sidebar\n(toggleable)']),
          div({ style: 'flex:1; padding:8px; text-align:center; background:var(--bg); display:flex; align-items:center; justify-content:center' })(['main — flex:1, overflow-y:auto']),
          div({ style: 'width:100px; padding:8px 4px; text-align:center; border-left:1px solid var(--border); background:var(--surface-2); display:flex; align-items:center; justify-content:center' })(['rightBar\n(optional)']),
        ]),
        div({ style: 'padding:8px; text-align:center; background:var(--surface-2); border-top:1px solid var(--border)' })(['footer']),
        div({ style: 'padding:8px; text-align:center; background:var(--surface); border-top:1px solid var(--border)' })(['bottomBar (sticky)']),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Toggle panels' })([
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({
            variant: state.sidebarOpen ? 'secondary' : 'primary',
            onClick: () => setState({ sidebarOpen: !state.sidebarOpen }),
          })([state.sidebarOpen ? 'Hide sidebar' : 'Show sidebar']),
          Button({
            variant: state.rightBarOpen ? 'secondary' : 'primary',
            onClick: () => setState({ rightBarOpen: !state.rightBarOpen }),
          })([state.rightBarOpen ? 'Hide right panel' : 'Show right panel']),
        ]),
        p({ style: 'margin:10px 0 0; font-size:13px; color:var(--text-muted)' })([
          'Both panels animate with a CSS width transition. The right panel content is only mounted when this tab is active.',
        ]),
        doc([`PageLayout({
  topBar:        TopBar(state),
  sidebar:       Nav(state),
  sidebarOpen:   state.sidebarOpen,
  sidebarWidth:  '240px',
  rightBar:      Details(state),
  rightBarOpen:  state.rightBarOpen,
  footer:        Footer(),
  bottomBar:     StatusBar(),
})([
  MainContent(state),
])`]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'API' })([
        Table({
          columns: [
            { key: 'prop',    label: 'Prop' },
            { key: 'type',    label: 'Type' },
            { key: 'default', label: 'Default' },
            { key: 'desc',    label: 'Description' },
          ],
          rows: [
            { prop: 'topBar',        type: 'vnode',   default: 'null',      desc: 'Sticky top bar content' },
            { prop: 'sidebar',       type: 'vnode',   default: 'null',      desc: 'Left sidebar content' },
            { prop: 'sidebarOpen',   type: 'boolean', default: 'true',      desc: 'Toggle sidebar (CSS width transition)' },
            { prop: 'sidebarWidth',  type: 'string',  default: "'240px'",   desc: 'Sidebar CSS width' },
            { prop: 'rightBar',      type: 'vnode',   default: 'null',      desc: 'Optional right panel content' },
            { prop: 'rightBarOpen',  type: 'boolean', default: 'true',      desc: 'Toggle right panel' },
            { prop: 'rightBarWidth', type: 'string',  default: "'260px'",   desc: 'Right panel CSS width' },
            { prop: 'footer',        type: 'vnode',   default: 'null',      desc: 'Non-sticky footer inside scroll area' },
            { prop: 'bottomBar',     type: 'vnode',   default: 'null',      desc: 'Sticky bottom bar' },
            { prop: 'mainPadding',   type: 'string',  default: "'24px'",    desc: 'Main content area padding' },
          ],
          scroll: true,
        }),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Layout Templates' })([
        p({ style: 'margin:0 0 16px; font-size:13px; color:var(--text-muted)' })([
          'Preset wrappers around PageLayout for common website and app patterns.',
        ]),
        Grid({ cols: 1, md: 3, gap: 12 })([

          div({ style: 'border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden' })([
            div({ style: 'padding:10px 14px; font-weight:600; font-size:13px; background:var(--surface-2); border-bottom:1px solid var(--border)' })(['AppShell']),
            div({ style: 'padding:12px' })([
              div({ style: 'border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; font-size:11px; color:var(--text-muted)' })([
                div({ style: 'padding:4px; text-align:center; background:var(--surface); border-bottom:1px solid var(--border)' })(['top']),
                div({ style: 'display:flex; height:44px' })([
                  div({ style: 'width:38%; border-right:1px solid var(--border); background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:10px' })(['side']),
                  div({ style: 'flex:1; background:var(--bg); display:flex; align-items:center; justify-content:center; font-size:10px' })(['main']),
                ]),
                div({ style: 'padding:3px; text-align:center; background:var(--surface-2); border-top:1px solid var(--border)' })(['footer']),
              ]),
              p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted)' })([
                'SPA / dashboard. Sidebar collapses with ', span({ style: 'font-family:monospace; font-size:11px' })(['sidebarOpen']), '.',
              ]),
            ]),
          ]),

          div({ style: 'border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden' })([
            div({ style: 'padding:10px 14px; font-weight:600; font-size:13px; background:var(--surface-2); border-bottom:1px solid var(--border)' })(['TwoPane']),
            div({ style: 'padding:12px' })([
              div({ style: 'border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; font-size:11px; color:var(--text-muted)' })([
                div({ style: 'display:flex; height:60px' })([
                  div({ style: 'width:40%; border-right:1px solid var(--border); background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:10px' })(['left']),
                  div({ style: 'flex:1; background:var(--bg); display:flex; align-items:center; justify-content:center; font-size:10px' })(['right (main)']),
                ]),
              ]),
              p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted)' })([
                'Editors, diffs. ', span({ style: 'font-family:monospace; font-size:11px' })(['leftOpen']), ' collapses left pane.',
              ]),
            ]),
          ]),

          div({ style: 'border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden' })([
            div({ style: 'padding:10px 14px; font-weight:600; font-size:13px; background:var(--surface-2); border-bottom:1px solid var(--border)' })(['BlogLayout']),
            div({ style: 'padding:12px' })([
              div({ style: 'border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; font-size:11px; color:var(--text-muted)' })([
                div({ style: 'padding:3px; text-align:center; background:var(--surface); border-bottom:1px solid var(--border)' })(['header']),
                div({ style: 'padding:8px; background:var(--bg); display:flex; justify-content:center' })([
                  div({ style: 'width:60%; background:var(--surface-2); border:1px dashed var(--border); padding:5px; text-align:center; border-radius:var(--radius); font-size:10px' })(['content col']),
                ]),
                div({ style: 'padding:3px; text-align:center; background:var(--surface-2); border-top:1px solid var(--border)' })(['footer']),
              ]),
              p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted)' })([
                'Articles, docs. ', span({ style: 'font-family:monospace; font-size:11px' })(['maxWidth']), ' controls the column.',
              ]),
            ]),
          ]),

        ]),
      ]),
    ]),
  ]);
