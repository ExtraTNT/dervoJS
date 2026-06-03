/**
 * dervoJS Game Editor - entry point.
 *
 * Mounts an AppShell with a left sidebar (file/project tree + global actions)
 * and a tabbed main area. The right edge of each panel is the editor for
 * whatever is selected in the left list.
 */

import { div, span, h1, h2, p, button } from '../src/elements.js';
import { AppShell, Stack } from '../src/components/Layout.js';
import { Tabs } from '../src/components/Tabs.js';
import { Button } from '../src/components/Button.js';
import { Badge } from '../src/components/Badge.js';
import { initStyles, setTheme, setTokens, resetTokens } from '../src/styles.js';
import { mount } from '../src/state.js';
import { initEditorStyles } from './styles.js';
import { store, getState, setState, persist, listSlots, useSlot, newSlot, removeSlot, saveTheme } from './store.js';
import { MetaPanel }    from './panels/meta.js';
import { RoomsPanel }   from './panels/rooms.js';
import { NpcsPanel }    from './panels/npcs.js';
import { ItemsPanel }   from './panels/items.js';
import { PreviewPanel } from './panels/preview.js';
import { GraphPanel }   from './panels/graph.js';
import { ExportPanel }  from './panels/export.js';
import { SidebarPanel } from './panels/sidebar.js';
import { CombatsPanel } from './panels/combats.js';
import { SkillsPanel }  from './panels/skills.js';
import { AssetsPanel }  from './panels/assets.js';
import { CheatSheet }   from './cheatsheet.js';
import { ThemePanel }   from './panels/theme.js';

// Boot with persisted editor theme; per-project token overrides are applied
// via the subscribe hook below so they also re-apply on slot switch.
{
  const s0 = getState();
  initStyles({ theme: s0.theme });
}
initEditorStyles();
document.body.style.cssText = 'padding:0; margin:0; min-height:100vh; background:var(--bg)';

// Per-project token overrides — these define the *game*'s palette and are
// baked into the exported main.js by codegen. As a side-effect they also
// recolour the editor chrome (since both share dervo's CSS custom properties).
// On slot switch the diff against the previous overrides decides what to reset.
let _lastOverrides = {};
const _syncOverrides = overrides => {
  const next = overrides || {};
  const droppedKeys = Object.keys(_lastOverrides).filter(k => !(k in next));
  if (droppedKeys.length) resetTokens(droppedKeys);
  if (Object.keys(next).length) setTokens(next)();
  _lastOverrides = next;
};
_syncOverrides(getState().project.meta.themeOverrides);
store.subscribe(s => _syncOverrides(s.project.meta.themeOverrides));

// Toggle helper used by the topbar 🌗 button. Writes to both DOM (live) and
// localStorage (next boot).
const _toggleTheme = () => {
  const next = getState().theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  saveTheme(next);
  setState({ theme: next });
};

// Live custom-CSS injection. A single <style> tag holds whatever the user
// typed in Theme tab → Custom CSS; updates in response to setState. The same
// content gets baked into the exported game by codegen.
const _CSS_STYLE_ID = 'dervo-game-custom-css';
const _ensureCustomCssTag = () => {
  let tag = document.getElementById(_CSS_STYLE_ID);
  if (!tag) {
    tag = document.createElement('style');
    tag.id = _CSS_STYLE_ID;
    document.head.appendChild(tag);
  }
  return tag;
};
const _syncCustomCss = css => {
  const tag = _ensureCustomCssTag();
  if (tag.textContent !== (css || '')) tag.textContent = css || '';
};
_syncCustomCss(getState().project.meta.gameCss);
store.subscribe(s => _syncCustomCss(s.project.meta.gameCss));

const TABS = [
  { id: 'meta',    label: 'Project'  },
  { id: 'rooms',   label: 'Rooms'    },
  { id: 'npcs',    label: 'NPCs'     },
  { id: 'items',   label: 'Items'    },
  { id: 'skills',  label: 'Skills'   },
  { id: 'combats', label: 'Combats'  },
  { id: 'sidebar', label: 'Sidebar'  },
  { id: 'assets',  label: 'Assets'   },
  { id: 'graph',   label: 'Graph'    },
  { id: 'preview', label: 'Preview'  },
  { id: 'export',  label: 'Export'   },
  { id: 'theme',   label: 'Theme'    },
];

const _topBar = s =>
  div({ style: 'display:flex; align-items:center; gap:10px; padding:0 16px; height:48px' })([
    button({
      type: 'button',
      title: 'Toggle sidebar',
      onclick: () => setState({ sidebarOpen: !s.sidebarOpen }),
      style: 'flex-shrink:0; padding:6px 10px; font-size:17px; line-height:1; border:none; background:none; cursor:pointer; color:var(--text); border-radius:var(--radius)',
    })(['☰']),
    span({ style: 'font-size:15px; font-weight:600' })(['dervoJS Game Editor']),
    span({ style: 'font-size:11px; color:var(--text-muted); font-family:ui-monospace,monospace' })([
      `· ${s.project.meta.title || 'untitled'} · slot:${s.activeSlot}`,
    ]),
    div({ style: 'flex:1' })([]),
    Button({ variant: 'ghost', size: 'sm', onClick: _toggleTheme, title: 'Toggle light / dark' })([
      s.theme === 'dark' ? '🌞' : '🌗',
    ]),
    Button({ variant: 'ghost', size: 'sm', onClick: () => setState({ cheatsheetOpen: !s.cheatsheetOpen }) })(['? Cheat sheet']),
    Button({ variant: 'ghost', size: 'sm', onClick: persist })(['💾 Save']),
  ]);

const _sidebar = s => {
  const slots = listSlots();
  return div({ className: 'gef-side' })([
    h2({ style: 'margin:0 0 4px; font-size:14px' })(['Project']),
    p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
      'Edit rooms, NPCs and exits. Save persists to localStorage; Export downloads JS files.',
    ]),

    h2({ className: 'gef-side-h', style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin:16px 0 4px' })(['Slots']),
    Stack({ gap: 4 })(
      (slots.length === 0 ? [s.activeSlot] : slots).map(slot =>
        button({
          className: `gef-list-btn${slot === s.activeSlot ? ' active' : ''}`,
          onclick: () => useSlot(slot),
          type: 'button',
        })([
          span({})([slot]),
          ...(slots.length > 1
            ? [span({
                style: 'margin-left:auto; opacity:.7',
                onclick: e => { e.stopPropagation(); if (confirm(`Delete slot "${slot}"?`)) removeSlot(slot); },
                title: 'Delete slot',
              })(['×'])]
            : []),
        ])
      )
    ),
    div({ style: 'display:flex; gap:6px; margin-top:8px' })([
      Button({ size: 'sm', variant: 'ghost', onClick: () => {
        const name = prompt('New slot name?', `project-${Date.now().toString(36).slice(-4)}`);
        if (name) newSlot(name);
      }})(['+ New slot']),
    ]),

    h2({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); margin:16px 0 4px' })(['Quick stats']),
    div({ style: 'display:flex; gap:6px; flex-wrap:wrap' })([
      Badge({ variant: 'blue'  })([`${s.project.rooms.length} rooms`]),
      Badge({ variant: 'green' })([`${s.project.npcs.length} NPCs`]),
    ]),
  ]);
};

const _placeholder = (title, hint) =>
  div({ className: 'gef-empty', style: 'margin:24px' })([
    h2({ style: 'margin:0 0 4px; font-size:16px; color:var(--text)' })([title]),
    p({ style: 'margin:0; font-size:13px' })([hint]),
  ]);

const _activePanel = s => {
  switch (s.activeTab) {
    case 'meta':    return MetaPanel(s.project);
    case 'rooms':   return RoomsPanel(s);
    case 'npcs':    return NpcsPanel(s);
    case 'items':   return ItemsPanel(s);
    case 'skills':  return SkillsPanel(s);
    case 'combats': return CombatsPanel(s);
    case 'sidebar': return SidebarPanel(s);
    case 'assets':  return AssetsPanel(s);
    case 'graph':   return GraphPanel(s);
    case 'preview': return PreviewPanel(s);
    case 'export':  return ExportPanel(s);
    case 'theme':   return ThemePanel(s);
    default:        return _placeholder('Unknown panel', String(s.activeTab));
  }
};

const _toast = t => {
  if (!t) return [];
  return [div({ className: `gef-toast${t.kind === 'error' ? ' gef-toast-error' : ''}` })([t.text])];
};

const view = s => [
  AppShell({
    topBar:      _topBar(s),
    sidebar:     _sidebar(s),
    sidebarOpen: s.sidebarOpen,
    sidebarWidth: '260px',
  })([
    div({ className: 'gef-root', style: 'padding:16px 24px 32px' })([
      Tabs({
        tabs:        TABS,
        activeTab:   s.activeTab,
        onTabChange: id => { setState({ activeTab: id }); try { history.replaceState(null, '', `#${id}`); } catch (_) {} },
      })(TABS.map(t => _activePanel({ ...s, activeTab: t.id }))),
    ]),
  ]),
  ..._toast(s.toast),
  ...CheatSheet(s),
];

mount(store)(document.body)(view);
