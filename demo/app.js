import {
  div, p, span, strong, button,
  initStyles, toggleTheme,
  mount, disableProfiler, Badge, PageLayout,
  FloatingPanel, StateDebugger, RenderProfiler, ListenersDebugger,
} from '../src/index.js';
import { store, setState, getState } from './store.js';
import { buttonsPanel              } from './panels/buttons.js';
import { inputsPanel     } from './panels/inputs.js';
import { feedbackPanel   } from './panels/feedback.js';
import { tablePanel      } from './panels/table.js';
import { clockPanel      } from './panels/clock.js';
import { layoutPanel     } from './panels/layout.js';
import { pageLayoutDemoPanel } from './panels/pageLayout.js';
import { modalPanel      } from './panels/modal.js';
import { docsPanel       } from './panels/docs.js';
import { togglesPanel    } from './panels/toggles.js';
import { controlsPanel   } from './panels/controls.js';
import { multistepPanel  } from './panels/multistep.js';
import { mediaPanel      } from './panels/media.js';
import { markdownPanel   } from './panels/markdown.js';
import { themePanel      } from './panels/theme.js';
import { typographyPanel } from './panels/typography.js';
import { pickersPanel    } from './panels/pickers.js';
import { philosophyPanel } from './panels/philosophy.js';
import { routerPanel     } from './panels/router.js';
import { websocketPanel  } from './panels/websocket.js';
import { chartsPanel     } from './panels/charts.js';
import { keymapPanel     } from './panels/keymap.js';
import { glitchPanel     } from './panels/glitch.js';
import { headerPanel     } from './panels/header.js';
import { a11yPanel       } from './panels/a11y.js';

// ── Styles ─────────────────────────────────────────────────────────────────
initStyles();
document.body.style.cssText = 'padding:0; margin:0;';

// ── Keyboard shortcut ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && getState().showModal) setState({ showModal: false });
});

// ── Nav ────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'philosophy', icon: '☯', label: 'Philosophy'},
  { id: 'buttons',    icon: '◈', label: 'Buttons' },
  { id: 'clock',      icon: '◷', label: 'Clock & Interval' },
  { id: 'controls',   icon: '⊶', label: 'Sliders & Progress' },
  { id: 'multistep',  icon: '➤', label: 'Multi-step' },
  { id: 'docs',       icon: '≡', label: 'Docs' },
  { id: 'feedback',   icon: '◎', label: 'Feedback' },
  { id: 'inputs',     icon: '✏', label: 'Inputs' },
  { id: 'layout',     icon: '⊟', label: 'Grid & Layout' },
  { id: 'markdown',   icon: '✦', label: 'Markdown' },
  { id: 'media',      icon: '⊕', label: 'Media & Layout', unload: true,
    onMount: () => setState({ mediaSeed: Date.now() }) },
  { id: 'modal',      icon: '⧉', label: 'Modal' },
  { id: 'pageLayout', icon: '⊡', label: 'Page Layout' },
  { id: 'pickers',    icon: '⊛', label: 'Pickers' },
  { id: 'table',      icon: '⊞', label: 'Table' },
  { id: 'theme',      icon: '◐', label: 'Theme & Tokens' },
  { id: 'toggles',    icon: '⏻', label: 'Toggles' },
  { id: 'typography', icon: '¶', label: 'Typography' },
  { id: 'websocket',  icon: '⇌', label: 'WebSocket' },
  { id: 'router',     icon: '⋱', label: 'Router & Nav' },
  { id: 'charts',     icon: '◉', label: 'Charts' },
  { id: 'keymap',     icon: '⌘', label: 'KeyMap' },
  { id: 'header',     icon: '≣', label: 'Header Demo' },
  { id: 'glitch',     icon: '◈', label: 'Glitch', unload: true },
  { id: 'a11y',       icon: '♿', label: 'Accessibility' },
];

// Panels marked `unload: true` in NAV_ITEMS have their DOM torn down and
// Panels marked `unload: true` get a unique key (= tab id) so the keyed
// reconciler tears down their DOM on every route change and creates fresh
// nodes when revisited — forcing image/media reloads.
// Normal panels share the stable key 'panel' so they always patch in-place.
//
// Both paths must be keyed: the reconciler only removes old keyed nodes when
// the *new* vnode list also carries keys. Without keying non-unload panels,
// navigating away from an unload panel falls back to index-based reconciliation
// which patches in-place, leaving the _dervoKey stamp on the old DOM node and
// preventing teardown on the next visit.
const UNLOAD_PANELS = new Set(NAV_ITEMS.filter(i => i.unload).map(i => i.id));

const renderPanel = state => {
  const id    = state.activeTab;
  const vnode = (PANELS[id] || PANELS.philosophy)(state);
  const key   = UNLOAD_PANELS.has(id) ? id : 'panel';
  return { ...vnode, props: { ...vnode.props, key } };
};

const PANELS = {
  philosophy: philosophyPanel,
  buttons:    buttonsPanel,
  inputs:     inputsPanel,
  toggles:    togglesPanel,
  controls:   controlsPanel,
  feedback:   feedbackPanel,
  table:      tablePanel,
  clock:      clockPanel,
  media:      mediaPanel,
  layout:     layoutPanel,
  pageLayout: pageLayoutDemoPanel,
  modal:      modalPanel,
  theme:      themePanel,
  typography: typographyPanel,
  pickers:    pickersPanel,
  markdown:   markdownPanel,
  docs:       docsPanel,
  websocket:  websocketPanel,
  router:     routerPanel,
  charts:     chartsPanel,
  keymap:     keymapPanel,
  header:     headerPanel,
  glitch:     glitchPanel,
  multistep:  multistepPanel,
  a11y:       a11yPanel
};

// ── Root view ──────────────────────────────────────────────────────────────
const pageView = state =>
  PageLayout({
    topBar: div({ style: 'display:flex; align-items:center; gap:10px; padding:0 16px; height:52px' })([
      button({
        style: 'padding:6px 10px; font-size:17px; line-height:1; border:none; background:none; cursor:pointer; color:var(--text); border-radius:var(--radius)',
        onclick: () => setState({ sidebarOpen: !state.sidebarOpen }),
        type: 'button',
      })(['☰']),
      span({ style: 'font-size:16px; font-weight:700' })(['dervoJS']),
      span({ style: 'font-size:12px; color:var(--text-muted)' })(['component library']),
      div({ style: 'flex:1' })(['']),
      button({
        className: 'theme-toggle',
        onclick: () => { toggleTheme(); setState({}); },
        type: 'button',
        style: 'flex-shrink:0',
      })(['🌗']),
      button({
        type: 'button',
        title: 'State Debugger',
        onclick: () => setState({ debugOpen: !state.debugOpen }),
        style: `flex-shrink:0; padding:4px 10px; font-size:12px; font-weight:600; border:1px solid var(--border); border-radius:var(--radius); background:${state.debugOpen ? 'var(--accent)' : 'none'}; color:${state.debugOpen ? '#fff' : 'var(--text)'}; cursor:pointer`,
      })(['⚙ Debug']),
    ]),

    sidebar: div({ className: 'sidenav' })([
      div({ className: 'sidenav-label' })(['Components']),
      ...NAV_ITEMS.map(item =>
        button({
          className: `sidenav-item${state.activeTab === item.id ? ' active' : ''}`,
          onclick: () => { setState({ activeTab: item.id }); item.onMount?.(); },
          type: 'button',
        })([
          span({ style: 'font-size:14px; width:18px; text-align:center; flex-shrink:0' })([item.icon]),
          span({})([item.label]),
        ])
      ),
    ]),
    sidebarOpen: state.sidebarOpen,

    rightBar: state.activeTab === 'pageLayout'
      ? div({ style: 'padding:16px' })([
          div({ style: 'font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--text-subtle); margin-bottom:12px' })(['Right Panel']),
          p({ style: 'font-size:13px; color:var(--text-muted); margin:0 0 12px' })([
            'Optional right panel. Toggle it from the Page Layout tab.',
          ]),
          Badge({ variant: 'green' })(['rightBar is open']),
        ])
      : null,
    rightBarOpen: state.activeTab === 'pageLayout' && state.rightBarOpen,

    footer: div({ style: 'display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-muted)' })([
      strong({})(['dervoJS']),
      span({ style: 'color:var(--border)' })(['·']),
      span({})(['built on odocosJS']),
    ]),
  })([
    renderPanel(state),
  ]);

const view = state => [
  pageView(state),
  FloatingPanel({
    id:       'state-debugger',
    title:    'State Debugger',
    open:     state.debugOpen,
    onClose:  () => { setState({ debugOpen: false }); disableProfiler(); },
    initialX: 24,
    initialY: 64,
    initialW: 920,
    initialH: 560,
  })([
    StateDebugger({ state, setState, getState }),
    RenderProfiler({ setState, active: state.debugOpen }),
    ListenersDebugger({ setState }),
  ]),
];

// ── Mount ──────────────────────────────────────────────────────────────────
mount(store)(document.body)(view);

