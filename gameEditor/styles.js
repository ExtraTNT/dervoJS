/**
 * Editor-specific CSS, layered on top of initStyles(). Uses dervo CSS
 * variables (--accent, --border, --surface, --text, --text-muted,
 * --radius) so theme switching works.
 */

const CSS = `
  .gef-root { font-family: var(--font, system-ui, sans-serif); color: var(--text); }

  .gef-side    { padding: 12px; display:flex; flex-direction:column; gap:8px; height:100%; overflow-y:auto; }
  .gef-side h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
                  color: var(--text-muted); margin: 12px 0 4px; font-weight: 700; }
  .gef-side hr { border:0; border-top:1px solid var(--border); margin:6px 0; }

  .gef-list-btn {
    display:flex; align-items:center; gap:8px;
    padding:6px 8px; border-radius:var(--radius);
    border:1px solid transparent; background:none; cursor:pointer;
    color:var(--text); font-size:13px; text-align:left; width:100%;
  }
  .gef-list-btn:hover  { background: var(--surface-2); }
  .gef-list-btn.active { background: var(--accent); color:#fff; }
  .gef-list-btn .gef-id { color: var(--text-muted); font-family: ui-monospace,monospace; font-size:11px; margin-left:auto; }
  .gef-list-btn.active .gef-id { color: rgba(255,255,255,.75); }

  /* Folder-grouped lists. Header doubles as a collapse toggle. */
  .gef-folder-header        { transition: color .12s ease, background .12s ease; border-radius: var(--radius); }
  .gef-folder-header:hover  { background: var(--surface-2); color: var(--text); }
  .gef-folder-header:focus  { outline: none; }
  .gef-folder-header:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .gef-page {
    border:1px solid var(--border); border-radius:var(--radius);
    padding:12px; margin-bottom:12px; background: var(--surface);
  }
  .gef-page-head {
    display:flex; align-items:center; gap:8px; margin-bottom:8px;
    font-size:12px; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: .05em;
  }

  .gef-choice {
    border:1px solid var(--border); border-radius:var(--radius);
    padding:10px; margin-bottom:8px; background: var(--surface);
  }
  .gef-choice-head {
    display:flex; align-items:center; gap:8px; margin-bottom:8px;
    font-size:12px; color: var(--text-muted);
  }

  .gef-section-title {
    font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
    color: var(--text-muted); font-weight: 700; margin: 16px 0 6px;
  }

  .gef-empty {
    padding:32px 16px; text-align:center;
    color: var(--text-muted); font-size:14px;
    border:1px dashed var(--border); border-radius:var(--radius);
  }

  .gef-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    padding: 10px 16px; border-radius: var(--radius);
    background: var(--text); color: var(--bg);
    box-shadow: 0 4px 16px rgba(0,0,0,.25);
    z-index: 9999; font-size: 13px;
  }
  .gef-toast-error { background: var(--danger); color: #fff; }

  /* Graph - styling now lives in panels/graph.js per-element so light/dark and
     theme overrides apply directly via CSS custom properties. The CSS here is
     just the SVG canvas chrome + hover state on the selected room. */
  .gef-graph svg { display:block; background: var(--bg); border-radius:var(--radius); border:1px solid var(--border); }
  .gef-graph .gef-node:hover rect,
  .gef-graph .gef-node:hover path,
  .gef-graph .gef-node:hover ellipse { filter: brightness(1.08); }
  .gef-graph .gef-node.active rect { fill: var(--accent); stroke: var(--accent); }
  .gef-graph .gef-node.active text { fill: #fff; }

  .gef-preview-host {
    border:1px solid var(--border); border-radius:var(--radius);
    background: var(--surface); min-height: 520px;
  }

  .gef-code {
    background: var(--surface-2); border:1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius); padding: 12px; overflow:auto;
    font-family: ui-monospace, monospace; font-size: 12.5px;
    white-space: pre; line-height: 1.5; max-height: 520px;
  }
  .gef-file-tab {
    display:inline-flex; gap:6px; padding:6px 10px; border-radius:var(--radius);
    border:1px solid var(--border); margin-right:6px; cursor:pointer; font-size:12px;
    background: var(--surface);
  }
  .gef-file-tab.active { background: var(--accent); color:#fff; border-color: var(--accent); }

  /* Pin NumberInput to its natural width inside Grid cells. width:max-content
     beats Grid's justify-self:stretch; align-self:end aligns with siblings. */
  .gef-root .number-input-wrap { width:max-content; max-width:100%; align-self:end; }

  /* Editor utility classes. dv-mono and dv-muted live in dervo.css. */
  .gef-kbd-label { font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
  .gef-hint      { margin:0; font-size:12px; color:var(--text-muted); }
  .gef-hint-13   { font-size:13px; }
  .gef-surface-card { border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); }
  .gef-row-end   { display:flex; align-items:flex-end; }
`;

const initEditorStyles = () => {
  if (document.getElementById('gef-styles')) return;
  const style = document.createElement('style');
  style.id = 'gef-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
};

export { initEditorStyles };
