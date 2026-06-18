/**
 * Preview panel - controls + a fullscreen overlay that hosts the live game.
 *
 * The game mounts into a DOM node we create at document.body level so dervo's
 * editor reconciler never touches it. We track the open game in a module
 * singleton; "Play" rebuilds from the current project, "Stop" destroys it.
 */

import { div, p, h2, span } from '../../src/elements.js';
import { Card } from '../../src/components/Card.js';
import { Stack } from '../../src/components/Layout.js';
import { Button } from '../../src/components/Button.js';
import { Alert } from '../../src/components/Alert.js';
import { Badge } from '../../src/components/Badge.js';
import { createGame } from '../../src/game.js';
import { buildGameConfig } from '../preview.js';
import { getState, toast } from '../store.js';

let _overlay = null;   // outer container (appended to body)
let _host    = null;   // inner div the game mounts into
let _handle  = null;   // { destroy } returned by game.mount

const _close = () => {
  if (_handle && typeof _handle.destroy === 'function') {
    try { _handle.destroy(); }
    catch (err) {
      console.warn('unable to destroy old handler: ', err);
    }
  }
  _handle = null;
  if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
  _overlay = null;
  _host = null;
};

const _play = project => {
  _close();  // tear down any previous instance
  const cfg = buildGameConfig(project);

  if (!cfg.start || !cfg.scenes[cfg.start]) {
    toast(`No start room set (or "${cfg.start}" doesn't exist).`, 'error');
    return;
  }

  _overlay = document.createElement('div');
  _overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9000;
    background: var(--bg);
    display: flex; flex-direction: column;
  `;
  // Project-level sidebar width - scoped to the overlay via the custom
  // property so the editor's own sidebar (covered but still rendered)
  // doesn't get rewritten. Empty string clears any prior value.
  if (project.sidebar && typeof project.sidebar.width === 'string' && project.sidebar.width.trim()) {
    _overlay.style.setProperty('--sidebar-width', project.sidebar.width.trim());
  }
  const bar = document.createElement('div');
  bar.style.cssText = `
    display:flex; align-items:center; gap:8px; padding:8px 16px;
    border-bottom: 1px solid var(--border); background: var(--surface);
    flex-shrink: 0;
  `;
  bar.innerHTML = `
    <span style="font-size:13px; color:var(--text-muted)">Previewing: <b style="color:var(--text)">${cfg.title}</b></span>
    <div style="flex:1"></div>
    <span style="font-size:13px; color:var(--text-muted)">Scroll is not a bug in your game, but a result of this top bar.</span>
    <button id="gef-restart" style="padding:6px 12px; border:1px solid var(--border); border-radius:var(--radius); background:none; cursor:pointer; color:var(--text); font-size:13px">↻ Restart</button>
    <button id="gef-close"   style="padding:6px 12px; border:1px solid var(--border); border-radius:var(--radius); background:var(--accent); color:#fff; cursor:pointer; font-size:13px">x Close preview</button>
  `;
  _host = document.createElement('div');
  _host.style.cssText = 'flex:1; overflow:auto;';
  _overlay.appendChild(bar);
  _overlay.appendChild(_host);
  document.body.appendChild(_overlay);

  bar.querySelector('#gef-close').onclick   = _close;
  bar.querySelector('#gef-restart').onclick = () => _play(project);

  const game = createGame(cfg);
  _handle = game.mount(_host);
  if (!_handle || typeof _handle.destroy !== 'function') {
    // mount() in this lib returns { destroy } from state.js - if not, fall back
    // to noop and just hide. Better than throwing.
    _handle = { destroy: () => {} };
  }
};

const PreviewPanel = state => {
  const { project } = state;
  const startRoom = project.rooms.find(r => r.id === project.meta.start);
  const issues = [];
  if (!project.meta.start) issues.push('No start room is set.');
  if (project.meta.start && !startRoom) issues.push(`Start room "${project.meta.start}" no longer exists.`);
  if (project.rooms.length === 0) issues.push('No rooms defined.');
  project.rooms.forEach(r => {
    r.choices.forEach(c => {
      if (c.to && !project.rooms.find(x => x.id === c.to)) {
        issues.push(`Room "${r.title || r.id}" → choice "${c.label}" points at missing room "${c.to}".`);
      }
    });
  });

  const live = Boolean(_overlay);

  return Stack({ gap: 14 })([
    h2({ style: 'margin:0' })(['Preview']),
    p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
      'Runs the current project as a live game in a fullscreen overlay. The preview is separate from your editor state - closing it discards play-state.',
    ]),

    Card({ title: 'Run' })([
      Stack({ gap: 8 })([
        div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
          Button({ variant: 'primary', onClick: () => _play(project) })([live ? '↻ Reload preview' : '▶ Play'  ]),
          ...(live ? [Button({ variant: 'ghost', onClick: _close })(['x Stop'])] : []),
        ]),
        ...(startRoom
          ? [p({ className: 'gef-hint gef-hint-13' })([
              'Will start at: ',
              span({ style: 'font-family:ui-monospace,monospace; color:var(--text)' })([startRoom.id]),
              span({})([` · ${startRoom.title}`]),
            ])]
          : []),
      ]),
    ]),

    ...(issues.length
      ? [Card({ title: `Issues (${issues.length})` })([
          Stack({ gap: 8 })(
            issues.map(msg => Alert({ variant: 'warn' })([msg]))
          ),
        ])]
      : [Card({ title: 'Status' })([
          div({ style: 'display:flex; gap:8px; flex-wrap:wrap' })([
            Badge({ variant: 'green' })(['No structural issues found']),
            Badge({ variant: 'gray'  })([`${project.rooms.length} rooms`]),
            Badge({ variant: 'gray'  })([`${project.npcs.length} NPCs`]),
            Badge({ variant: 'gray'  })([`${project.items.length} items`]),
          ]),
        ])]),

    Card({ title: 'How preview works' })([
      Stack({ gap: 6 })([
        p({ style: 'margin:0; font-size:13px' })([
          'The interpreter walks pages, resolves conditions, applies effects and auto-builds shop buy buttons from each shop NPC\'s stock list. ',
          'JS-mode conditions and effects evaluate inside ', span({ className: 'dv-mono' })(['Function(\'c\', body)']), '. ',
          'The exported source from the Export tab uses the same semantics but as static JS.',
        ]),
      ]),
    ]),
  ]);
};

export { PreviewPanel };
