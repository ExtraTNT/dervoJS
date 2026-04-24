import { div, Card, Stack, span, strong, pre, button, select, option, textarea, p } from '../../src/index.js';
import { markdownToVnode, setHighlightRegistry, defaultRegistry, tokenizer, highlight, registerPlugin, unregisterPlugin } from '../../src/index.js';
import { setState } from '../store.js';

const SAMPLE_MD = `# Markdown Renderer

This component converts **Markdown** text to vnodes.
It supports _italic_, **bold**, \`inline code\`, [links](https://example.com) and images.

---

## Headings & lists

### Unordered

- Item one
- Item two with **bold** text
- Item three with \`code\`

### Ordered

1. First step
2. Second step
3. Third step

---

## Blockquote

> This is a blockquote.
> It can span multiple lines.

---

## Code blocks

### JavaScript

\`\`\`js
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);
const add  = a => b => a + b;
const double = x => x * 2;

const result = pipe(add(1), double, add(3))(5);
console.log(result); // 15
\`\`\`

### Python

\`\`\`python
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print([fib(i) for i in range(10)])
\`\`\`

### Rust

\`\`\`rust
fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
\`\`\`

---

## Spoiler

(Reveal answer)[ The answer is **42**. ]

(Multi-line spoiler)[
This content is hidden by default.

It supports full **markdown** including \`code\`.
]
`;

// ── Activate default registry once ────────────────────────────────────────
setHighlightRegistry(defaultRegistry);

// ── Custom plugin alias used for the lab ──────────────────────────────────
const LAB_ALIAS = '__lab__';

// ── Available built-in languages for the picker ───────────────────────────
const LANGS = [
  { value: 'js',     label: 'JavaScript' },
  { value: 'ts',     label: 'TypeScript' },
  { value: 'py',     label: 'Python' },
  { value: 'rust',   label: 'Rust' },
  { value: 'hs',     label: 'Haskell' },
  { value: 'c',      label: 'C' },
  { value: 'cs',     label: 'C#' },
  { value: 'java',   label: 'Java' },
  { value: 'css',    label: 'CSS' },
  { value: 'sh',     label: 'Bash' },
  { value: LAB_ALIAS, label: '✦ Custom plugin' },
];

// Sample sources for each built-in language.
const SAMPLES = {
  js:   "const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);\nconst double = x => x * 2;\nconsole.log(pipe(double, double)(3)); // 12",
  ts:   "interface User { id: number; name: string; }\nconst greet = (u: User): string => `Hello, ${u.name}`;\nconsole.log(greet({ id: 1, name: 'Alice' }));",
  py:   "def fib(n: int) -> int:\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nprint([fib(i) for i in range(10)])",
  rust: "fn factorial(n: u64) -> u64 {\n    match n {\n        0 | 1 => 1,\n        _ => n * factorial(n - 1),\n    }\n}\nfn main() {\n    println!(\"{}\", factorial(10));\n}",
  hs:   "module Main where\n\nfib :: Int -> Int\nfib 0 = 0\nfib 1 = 1\nfib n = fib (n - 1) + fib (n - 2)\n\nmain :: IO ()\nmain = print (map fib [0..9])",
  c:    "#include <stdio.h>\n\nint fib(int n) {\n    if (n < 2) return n;\n    return fib(n - 1) + fib(n - 2);\n}\n\nint main(void) {\n    for (int i = 0; i < 10; i++)\n        printf(\"%d \", fib(i));\n    return 0;\n}",
  cs:   "using System;\n\nclass Program {\n    static int Fib(int n) =>\n        n < 2 ? n : Fib(n - 1) + Fib(n - 2);\n\n    static void Main() {\n        for (int i = 0; i < 10; i++)\n            Console.Write(Fib(i) + \" \");\n    }\n}",
  java: "public class Fib {\n    static int fib(int n) {\n        if (n < 2) return n;\n        return fib(n - 1) + fib(n - 2);\n    }\n    public static void main(String[] args) {\n        for (int i = 0; i < 10; i++)\n            System.out.print(fib(i) + \" \");\n    }\n}",
  css:  ":root {\n  --accent: #0070f3;\n  --radius: 6px;\n}\n\n.card {\n  border: 1px solid var(--border);\n  border-radius: var(--radius);\n  padding: 1rem;\n  background: hsl(0 0% 100% / .8);\n}",
  sh:   "#!/usr/bin/env bash\nset -euo pipefail\n\nDIR=\"${1:-.}\"\nfor f in \"$DIR\"/*.js; do\n  echo \"Processing $f\"\n  node --check \"$f\" && echo OK\ndone",
  [LAB_ALIAS]: "-- Write anything here; the\n-- custom plugin below\n-- will highlight it.\nlet x = 42 in x * 2",
};

// ── Helpers ────────────────────────────────────────────────────────────────
const labelStyle = 'font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-subtle); display:block; margin-bottom:6px';
const taStyle    = 'width:100%; box-sizing:border-box; font-family:ui-monospace,monospace; font-size:12px; line-height:1.5; padding:.6rem .8rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-2); color:var(--text); resize:vertical; outline:none';
const codeBlockStyle = 'font-family:ui-monospace,monospace; font-size:12.5px; line-height:1.6; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:.8rem 1rem; overflow-x:auto; white-space:pre-wrap; word-break:break-all; min-height:120px';

// Parse the user-typed specs textarea into a tokenizer plugin.
// Returns { plugin, error }.
const parsePluginSrc = src => {
  try {
    // The textarea contains a JS array literal of specs.
    // We eval it in a controlled way: only RegExp and strings.
    // eslint-disable-next-line no-new-func
    const specs = new Function(`"use strict"; return (${src});`)();
    if (!Array.isArray(specs)) throw new Error('Must be an array');
    return { plugin: tokenizer(specs), error: null };
  } catch (e) {
    return { plugin: null, error: e.message };
  }
};

// Render highlighted tokens as a pre block.
const renderTokens = tokens =>
  div({ style: codeBlockStyle })(tokens.map(t =>
    typeof t === 'string' ? t : t
  ));

export const markdownPanel = state => {
  const lang       = state.hlLang     || 'js';
  const src        = state.hlSource   || SAMPLES[lang] || '';
  const pluginSrc  = state.hlPluginSrc || '';
  const pluginActive = !!state.hlPluginActive;
  const pluginError  = state.hlPluginError || null;
  const isCustom   = lang === LAB_ALIAS;

  // Produce tokens for current lang + source
  const tokens = highlight(defaultRegistry)(pluginActive && isCustom ? LAB_ALIAS : lang)(src);

  return div({})([
    // ── Static markdown renderer ──────────────────────────────────────────
    Card({ title: 'Markdown Renderer' })([
      Stack({ gap: 16 })([
        div({ style: 'font-size:13px; color:var(--text-subtle)' })([
          'Live rendering of Markdown text to vnodes with syntax highlighting for JS, Python, Rust, TypeScript, and more.',
        ]),
        div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:16px; min-width:0' })([
          div({})([
            strong({ style: labelStyle })(['Source']),
            pre({ style: 'margin-top:0; font-size:12px; white-space:pre-wrap; word-break:break-word; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:1rem; overflow-x:auto; line-height:1.5; max-height:580px; overflow-y:auto' })([SAMPLE_MD]),
          ]),
          div({})([
            strong({ style: labelStyle })(['Rendered']),
            div({ className: 'md-body', style: 'border:1px solid var(--border); border-radius:var(--radius); padding:1rem; max-height:580px; overflow-y:auto' })([
              markdownToVnode(SAMPLE_MD),
            ]),
          ]),
        ]),
      ]),
    ]),

    // ── Interactive highlight plugin lab ──────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: '✦ Syntax Highlight Plugin Lab' })([
        Stack({ gap: 16 })([
          p({ style: 'margin:0; font-size:13px; color:var(--text-subtle)' })([
            'Pick a built-in language or choose "Custom plugin", write your own tokenizer specs, activate it, then edit the source to see live highlighting.',
          ]),

          // Language picker + tokens preview
          div({ style: 'display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start' })([

            // Left: picker + source editor
            div({})([
              span({ style: labelStyle })(['Language']),
              select({
                style: `display:block; width:100%; margin-bottom:12px; padding:.4rem .6rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface-2); color:var(--text); font-size:13px`,
                onchange: e => {
                  const l = e.target.value;
                  setState({ hlLang: l, hlSource: SAMPLES[l] || '' });
                },
              })(LANGS.map(({ value, label: lbl }) =>
                option({ value, selected: value === lang ? true : undefined })([lbl])
              )),
              span({ style: labelStyle })(['Source code']),
              textarea({
                style: taStyle + '; min-height:200px',
                oninput: e => setState({ hlSource: e.target.value }),
              })([src]),
            ]),

            // Right: highlighted output
            div({})([
              span({ style: labelStyle })(['Highlighted output']),
              renderTokens(tokens),
            ]),
          ]),

          // Custom plugin editor (always visible, activatable)
          div({ style: `border:1px solid ${pluginActive ? 'var(--accent)' : 'var(--border)'}; border-radius:var(--radius); padding:1rem` })([
            div({ style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:10px' })([
              strong({ style: 'font-size:13px' })(['Custom plugin specs']),
              div({ style: 'display:flex; gap:8px; align-items:center' })([
                ...(pluginError ? [
                  span({ style: 'font-size:12px; color:var(--danger, #c0392b)' })(['\u26a0 ' + pluginError]),
                ] : []),
                button({
                  type: 'button',
                  style: `padding:4px 12px; font-size:12px; border-radius:var(--radius); border:1px solid var(--border); cursor:pointer; background:${pluginActive ? 'var(--accent)' : 'var(--surface-2)'}; color:${pluginActive ? '#fff' : 'var(--text)'}`,
                  onclick: () => {
                    if (pluginActive) {
                      // Deactivate
                      unregisterPlugin(LAB_ALIAS);
                      setState({ hlPluginActive: false, hlPluginError: null });
                    } else {
                      // Parse and activate
                      const { plugin, error } = parsePluginSrc(pluginSrc);
                      if (error) {
                        setState({ hlPluginError: error });
                      } else {
                        registerPlugin(LAB_ALIAS, plugin);
                        setState({ hlPluginActive: true, hlPluginError: null, hlLang: LAB_ALIAS, hlSource: SAMPLES[LAB_ALIAS] });
                      }
                    }
                  },
                })([pluginActive ? 'Deactivate' : 'Activate']),
              ]),
            ]),
            p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-subtle)' })([
              'Write a JS array of [RegExp, className] pairs. Classes: ',
              span({ style: 'font-family:monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11px' })(['keyword']),
              ' ',
              span({ style: 'font-family:monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11px' })(['string']),
              ' ',
              span({ style: 'font-family:monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11px' })(['number']),
              ' ',
              span({ style: 'font-family:monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11px' })(['comment']),
              ' ',
              span({ style: 'font-family:monospace; background:var(--surface-2); padding:1px 5px; border-radius:3px; font-size:11px' })(['type']),
            ]),
            textarea({
              style: taStyle + '; min-height:140px',
              oninput: e => setState({ hlPluginSrc: e.target.value, hlPluginError: null }),
            })([pluginSrc]),
          ]),
        ]),
      ]),
    ]),
  ]);
};

