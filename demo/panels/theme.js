import {
  div, span, strong, p, button, input as inp,
  Card, Stack, Badge, Alert, Button, ProgressBar, Divider, Slider,
  setTokens, resetTokens, tokens,
} from '../../src/index.js';
import { setState } from '../store.js';

const LIGHT = tokens.light;

// ── Token group definitions ───────────────────────────────────────────────
const HEX_GROUPS = [
  { label: 'Accent',   keys: ['accent', 'accent-hover'] },
  { label: 'Surfaces', keys: ['bg', 'surface', 'surface-2', 'border', 'border-2'] },
  { label: 'Text',     keys: ['text', 'text-muted', 'text-subtle'] },
  { label: 'Danger',   keys: ['danger', 'danger-bg', 'danger-text'] },
  { label: 'Success',  keys: ['success', 'success-bg', 'success-text'] },
  { label: 'Warning',  keys: ['warning', 'warning-bg', 'warning-text'] },
  { label: 'Info',     keys: ['info', 'info-bg', 'info-text'] },
  { label: 'Badges', keys: [
    'badge-blue-bg', 'badge-blue-text',
    'badge-green-bg', 'badge-green-text',
    'badge-red-bg', 'badge-red-text',
    'badge-yellow-bg', 'badge-yellow-text',
    'badge-purple-bg', 'badge-purple-text',
  ]},
  { label: 'Syntax Highlight', keys: ['hl-keyword', 'hl-string', 'hl-number', 'hl-comment', 'hl-type'] },
];

const TEXT_GROUPS = [
  { label: 'Shape', keys: ['radius', 'radius-lg'] },
  { label: 'Font stacks', keys: ['font-sans', 'font-mono'] },
];

// Is `val` a plain hex color usable by <input type=color>?
const isHex = val => /^#[0-9a-fA-F]{6}$/.test((val || '').trim());

// ── Token row ─────────────────────────────────────────────────────────────
const tokenRow = (key, effective, overrides) => {
  const val     = effective[key] ?? LIGHT[key] ?? '';
  const changed = key in overrides;
  const hex     = isHex(val);

  return div({ style: 'display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid var(--border-2)' })([
    // Swatch
    div({ style: `width:18px; height:18px; border-radius:3px; flex-shrink:0; background:${val}; border:1px solid var(--border)` })([]),
    // Name
    span({ style: `font-family:ui-monospace,monospace; font-size:11px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${changed ? 'var(--accent)' : 'var(--text-muted)'}` })([`--${key}`]),
    // Input
    inp({
      type:  hex ? 'color' : 'text',
      value: val,
      style: hex
        ? 'width:26px; height:22px; padding:1px 2px; border:1px solid var(--border); border-radius:3px; cursor:pointer; flex-shrink:0; background:none'
        : 'width:120px; font-family:ui-monospace,monospace; font-size:10px; padding:2px 6px; border:1px solid var(--border); border-radius:3px; background:var(--surface); color:var(--text); flex-shrink:0',
      oninput: e => {
        const v = e.target.value;
        if (!v) return;
        setTokens({ [key]: v });
        setState(s => ({ themeOverrides: { ...s.themeOverrides, [key]: v } }));
      },
    })([]),
  ]);
};

// ── Group card ────────────────────────────────────────────────────────────
const groupCard = (group, effective, overrides) =>
  div({ style: 'background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; display:flex; flex-direction:column; gap:0' })([
    strong({ style: 'font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-subtle); display:block; margin-bottom:6px' })([group.label]),
    ...group.keys.map(k => tokenRow(k, effective, overrides)),
  ]);

// ── Generate initStyles snippet ───────────────────────────────────────────
const makeSnippet = overrides => {
  if (!Object.keys(overrides).length) return '// No changes yet — edit a token above first.';
  const inner = Object.entries(overrides).map(([k, v]) => `    '${k}': '${v}',`).join('\n');
  return `initStyles({\n  colors: {\n${inner}\n  },\n});`;
};

// ── Syntax token preview ──────────────────────────────────────────────────
const syntaxPreview = () =>
  div({ style: 'font-family:ui-monospace,monospace; font-size:13px; line-height:1.9; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:14px 16px; white-space:pre-wrap' })([
    span({ style: 'color:var(--hl-comment)' })(['// syntax token preview\n']),
    span({ style: 'color:var(--hl-keyword)' })(['const ']),
    span({ style: 'color:var(--hl-type)' })(['Message']),
    span({})([' = ']),
    span({ style: 'color:var(--hl-keyword)' })(['new ']),
    span({ style: 'color:var(--hl-type)' })(['Map'],),
    span({})(['();\n']),
    span({ style: 'color:var(--hl-type)' })(['Map']),
    span({ style: 'color:var(--hl-keyword)' })([]  ),
    span({ style: 'color:var(--hl-keyword)' })(['const ']),
    span({})(['greet = name => ']),
    span({ style: 'color:var(--hl-string)' })(['"Hello, " ']),
    span({})(['+ name + ']),
    span({ style: 'color:var(--hl-string)' })(['"!"']),
    span({})([';\n']),
    span({ style: 'color:var(--hl-keyword)' })(['const ']),
    span({})(['count = ']),
    span({ style: 'color:var(--hl-number)' })(['42']),
    span({})(['; ']),
    span({ style: 'color:var(--hl-comment)' })(['// answer']),
  ]);

// ── Main panel ────────────────────────────────────────────────────────────
export const themePanel = state => {
  const overrides  = state.themeOverrides  || {};
  const copied     = state.themeCopied     || false;
  const effective  = { ...LIGHT, ...overrides };
  const hasChanges = Object.keys(overrides).length > 0;

  return div({})([

    // ── Token editor card ─────────────────────────────────────────────────
    Card({ title: 'Token Editor' })([
      Stack({ gap: 16 })([

        // Description + actions
        div({ style: 'display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap' })([
          p({ style: 'margin:0; font-size:13px; color:var(--text-subtle); flex:1; min-width:200px' })([
            'Every CSS variable is a live token. Edits apply instantly across all components. Changed tokens are highlighted in ',
            span({ style: 'color:var(--accent); font-weight:600' })(['accent']),
            ' colour. Copy the resulting ',
            span({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 5px; border-radius:3px' })(['initStyles()']),
            ' call to persist your theme.',
          ]),
          div({ style: 'display:flex; gap:8px; flex-shrink:0' })([
            button({
              type: 'button',
              style: `padding:6px 14px; font-size:13px; border-radius:var(--radius); border:1px solid var(--border); cursor:pointer; background:var(--surface-2); color:${hasChanges ? 'var(--danger)' : 'var(--text-muted)'}`,
              onclick: () => {
                resetTokens(Object.keys(overrides));
                setState({ themeOverrides: {}, themeCopied: false });
              },
            })(['\u21ba Reset']),
            button({
              type: 'button',
              style: `padding:6px 14px; font-size:13px; border-radius:var(--radius); border:1px solid transparent; cursor:pointer; background:${copied ? 'var(--success)' : hasChanges ? 'var(--accent)' : 'var(--border)'}; color:${hasChanges ? '#fff' : 'var(--text-muted)'}`,
              onclick: () => {
                const snippet = makeSnippet(overrides);
                navigator.clipboard?.writeText(snippet);
                setState({ themeCopied: true });
                setTimeout(() => setState({ themeCopied: false }), 2200);
              },
            })([copied ? '\u2713 Copied!' : '\u29d6 Copy initStyles()']),
          ]),
        ]),

        // Hex token groups grid
        div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:10px' })(
          HEX_GROUPS.map(g => groupCard(g, effective, overrides))
        ),

        Divider({ label: 'Shape & Typography' }),

        // Text token groups
        div({ style: 'display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px' })(
          TEXT_GROUPS.map(g => groupCard(g, effective, overrides))
        ),

        // Generated snippet
        ...(hasChanges ? [
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:6px' })(['Generated initStyles() call']),
            div({ style: 'font-family:ui-monospace,monospace; font-size:12px; line-height:1.6; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; white-space:pre; overflow-x:auto; color:var(--text-muted)' })([
              makeSnippet(overrides),
            ]),
          ]),
        ] : []),

      ]),
    ]),

    // ── Live preview card ─────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Live Preview — all components react instantly' })([
        Stack({ gap: 20 })([

          // Buttons
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Buttons']),
            div({ style: 'display:flex; gap:8px; flex-wrap:wrap; align-items:center' })([
              Button({ variant: 'primary'   })(['Primary']),
              Button({ variant: 'secondary' })(['Secondary']),
              Button({ variant: 'danger'    })(['Danger']),
              Button({ variant: 'success'   })(['Success']),
              Button({ variant: 'ghost'     })(['Ghost']),
              Button({ variant: 'primary', size: 'sm' })(['Small']),
              Button({ variant: 'primary', size: 'lg' })(['Large']),
              Button({ variant: 'primary', disabled: true })(['Disabled']),
            ]),
          ]),

          Divider(),

          // Badges
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Badges']),
            div({ style: 'display:flex; gap:6px; flex-wrap:wrap; align-items:center' })([
              Badge({ variant: 'blue'   })(['Blue']),
              Badge({ variant: 'green'  })(['Green']),
              Badge({ variant: 'red'    })(['Red']),
              Badge({ variant: 'yellow' })(['Yellow']),
              Badge({ variant: 'purple' })(['Purple']),
              Badge({ variant: 'gray'   })(['Gray']),
            ]),
          ]),

          Divider(),

          // Alerts
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Alerts']),
            Stack({ gap: 8 })([
              Alert({ variant: 'info'    })(['This is an informational alert.']),
              Alert({ variant: 'success' })(['Operation completed successfully.']),
              Alert({ variant: 'warning' })(['This action cannot be undone.']),
              Alert({ variant: 'error'   })(['Something went wrong. Please try again.']),
            ]),
          ]),

          Divider(),

          // Progress bars
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Progress bars']),
            Stack({ gap: 10 })([
              ProgressBar({ value: 75, variant: 'primary', label: 'primary',  showValue: true }),
              ProgressBar({ value: 60, variant: 'success', label: 'success',  showValue: true }),
              ProgressBar({ value: 45, variant: 'warning', label: 'warning',  showValue: true }),
              ProgressBar({ value: 30, variant: 'danger',  label: 'danger',   showValue: true }),
              ProgressBar({ value: 55, variant: 'primary', label: 'striped',  showValue: true, striped: true, animated: true }),
            ]),
          ]),

          Divider(),

          // Text colour spectrum
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Text & surface tokens']),
            div({ style: 'display:flex; flex-direction:column; gap:6px' })([
              div({ style: 'padding:10px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); font-size:13px; color:var(--text)' })(['--bg + --text']),
              div({ style: 'padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); font-size:13px; color:var(--text)' })(['--surface + --text']),
              div({ style: 'padding:10px 14px; background:var(--surface-2); border:1px solid var(--border-2); border-radius:var(--radius); font-size:13px; color:var(--text-muted)' })(['--surface-2 + --text-muted']),
              div({ style: 'padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); font-size:13px; color:var(--text-subtle)' })(['--text-subtle']),
              div({ style: 'padding:10px 14px; background:var(--accent-ring); border:1px solid var(--accent); border-radius:var(--radius); font-size:13px; color:var(--accent); font-weight:600' })(['--accent + --accent-ring']),
            ]),
          ]),

          Divider(),

          // Syntax tokens
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Syntax highlight tokens']),
            syntaxPreview(),
          ]),

          Divider(),

          // Slider (shows accent on thumb + track)
          div({})([
            strong({ style: 'font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:8px' })(['Slider (uses --accent)']),
            Slider({ label: 'Demo slider', value: state.sliderA || 40, min: 0, max: 100,
              onInput: e => setState({ sliderA: +e.target.value }) }),
          ]),

        ]),
      ]),
    ]),
  ]);
};
