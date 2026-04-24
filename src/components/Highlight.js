import { vnode } from '../../lib/odocosjs/src/render.js';
import { toMaybe } from '../../lib/odocosjs/src/core.js';

// ── Highlight engine ───────────────────────────────────────────────────────
// A plugin is: String -> [VNode | String]
// A registry is: { [lang]: plugin }

const hlSpan = cls => text =>
  vnode('span')({ className: 'hl-' + cls })([text]);

/**
 * Build a syntax highlighter from a list of [RegExp, className] pairs.
 * @param {Array} specs
 * @returns {function} source => [VNode | String]
 */
const tokenizer = specs => source => {
  const combined = new RegExp(specs.map(([re]) => `(${re.source})`).join('|'), 'gm');
  const classes  = specs.map(([, cls]) => cls);
  const tokens   = [];
  let last = 0;
  for (const m of source.matchAll(combined)) {
    if (m.index > last) tokens.push(source.slice(last, m.index));
    const idx = m.slice(1).findIndex(g => g !== undefined);
    tokens.push(hlSpan(classes[idx])(m[0]));
    last = m.index + m[0].length;
  }
  if (last < source.length) tokens.push(source.slice(last));
  return tokens;
};

/**
 * Highlight source code in `lang` using the given registry.
 * Falls back to plain text if the language is not registered.
 * @param {Object} registry
 * @returns {function} lang => source => [VNode | String]
 */
const highlight = registry => lang => source =>
  toMaybe(registry[lang])(_ => [source])(fn => fn(source));

// ── Language plugins ───────────────────────────────────────────────────────
const jsPlugin = tokenizer([
  [/\/\/.*$/m,                                               'comment'],
  [/\/\*[\s\S]*?\*\//,                                       'comment'],
  [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/, 'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,                    'number'],
  [/\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|import|export|from|of|in|new|this|typeof|instanceof|true|false|null|undefined|async|await|throw|try|catch|finally|yield|default|void|delete)\b/, 'keyword'],
  [/=>|\.{3}/,                                               'keyword'],
]);

const hsPlugin = tokenizer([
  [/--.*$/m,                                  'comment'],
  [/\{-[\s\S]*?-\}/,                          'comment'],
  [/"(?:[^"\\]|\\.)*"/,                       'string'],
  [/'(?:\\.|[^\\'])'/,                        'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:module|where|import|qualified|as|hiding|data|type|newtype|class|instance|deriving|do|let|in|case|of|if|then|else|infixl|infixr|infix|forall|foreign|default)\b/, 'keyword'],
  [/::|->|<-|=>|\.\.|@|\\|\|/,               'keyword'],
  [/\b[A-Z][A-Za-z0-9_']*/,                  'type'],
]);

const cPlugin = tokenizer([
  [/\/\/.*$/m,                                'comment'],
  [/\/\*[\s\S]*?\*\//,                        'comment'],
  [/"(?:[^"\\]|\\.)*"/,                       'string'],
  [/'(?:\\.|[^\\'])'/,                        'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:int|float|double|char|void|short|long|signed|unsigned|if|else|switch|case|default|for|while|do|break|continue|return|struct|union|typedef|enum|static|extern|const|volatile|sizeof)\b/, 'keyword'],
  [/#\s*(?:include|define|undef|if|ifdef|ifndef|else|elif|endif|pragma).*/,  'keyword'],
  [/\b[A-Z_][A-Z0-9_]*\b/,                   'type'],
]);

const csPlugin = tokenizer([
  [/\/\/.*$/m,                                'comment'],
  [/\/\*[\s\S]*?\*\//,                        'comment'],
  [/"(?:[^"\\]|\\.)*"/,                       'string'],
  [/'(?:\\.|[^\\'])'/,                        'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:using|namespace|class|struct|interface|enum|public|private|protected|internal|static|void|int|float|double|string|bool|new|return|if|else|switch|case|default|for|foreach|while|do|break|continue|try|catch|finally|throw|async|await|var|null|true|false|this|base|get|set)\b/, 'keyword'],
  [/\b[A-Z][A-Za-z0-9_]*\b/,                 'type'],
]);

const javaPlugin = tokenizer([
  [/\/\/.*$/m,                                'comment'],
  [/\/\*[\s\S]*?\*\//,                        'comment'],
  [/"(?:[^"\\]|\\.)*"/,                       'string'],
  [/'(?:\\.|[^\\'])'/,                        'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:package|import|class|interface|enum|extends|implements|public|private|protected|static|final|void|int|float|double|boolean|char|new|return|if|else|switch|case|default|for|while|do|break|continue|try|catch|finally|throw|throws|null|true|false|this|super)\b/, 'keyword'],
  [/\b[A-Z][A-Za-z0-9_]*\b/,                 'type'],
]);

const pyPlugin = tokenizer([
  [/#.*$/,                                    'comment'],
  [/"""[\s\S]*?"""|'''[\s\S]*?'''/,           'comment'],
  [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,    'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|lambda|try|except|finally|with|yield|async|await|global|nonlocal|assert|del|in|is|not|and|or|True|False|None)\b/, 'keyword'],
  [/\b[A-Z][A-Za-z0-9_]*\b/,                 'type'],
]);

const rustPlugin = tokenizer([
  [/\/\/.*$/m,                                'comment'],
  [/\/\*[\s\S]*?\*\//,                        'comment'],
  [/"(?:[^"\\]|\\.)*"/,                       'string'],
  [/'(?:\\.|[^\\'])'/,                        'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:fn|let|mut|const|static|struct|enum|trait|impl|for|in|if|else|match|while|loop|break|continue|return|use|mod|pub|crate|super|self|Self|as|where|move|async|await|dyn|ref|type|unsafe|extern|true|false)\b/, 'keyword'],
  [/\b[A-Z][A-Za-z0-9_]*\b/,                 'type'],
]);

const tsPlugin = tokenizer([
  [/\/\/.*$/m,                                'comment'],
  [/\/\*[\s\S]*?\*\//,                        'comment'],
  [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/, 'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,     'number'],
  [/\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|import|export|from|of|in|new|this|typeof|instanceof|true|false|null|undefined|async|await|throw|try|catch|finally|yield|default|void|delete|interface|type|enum|namespace|declare|abstract|override|readonly|keyof|infer|never|unknown|any)\b/, 'keyword'],
  [/=>|\.{3}/,                                'keyword'],
  [/\b[A-Z][A-Za-z0-9_]*\b/,                 'type'],
]);

const cssPlugin = tokenizer([
  [/\/\*[\s\S]*?\*\//,                            'comment'],
  [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,         'string'],
  [/#[0-9a-fA-F]{3,8}\b/,                         'number'],
  [/\b\d+(?:\.\d+)?(?:%|px|em|rem|vh|vw|vmin|vmax|pt|cm|mm|fr|deg|rad|s|ms)?\b/, 'number'],
  [/\b(?:var|calc|rgb|rgba|hsl|hsla|url|linear-gradient|radial-gradient|min|max|clamp|env)\b/, 'keyword'],
  [/@[\w-]+/,                                     'keyword'],
  [/:[:\w-]+/,                                    'type'],
  [/\.[a-zA-Z][\w-]*/,                            'type'],
  [/#[a-zA-Z][\w-]*/,                             'type'],
]);

const bashPlugin = tokenizer([
  [/#.*$/m,                                       'comment'],
  [/"(?:[^"\\$]|\\.|\$(?:\{[^}]*\}|[a-zA-Z_][a-zA-Z0-9_]*))*"|'[^']*'/, 'string'],
  [/\$(?:\{[^}]*\}|[a-zA-Z_@#?*0-9][a-zA-Z0-9_]*)/,  'type'],
  [/\b\d+\b/,                                     'number'],
  [/\b(?:if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|return|exit|local|export|declare|readonly|source|alias|unset|shift|set|echo|printf|read|test|true|false)\b/, 'keyword'],
  [/&&|\|\||>|>>|<|\||;/,                         'keyword'],
]);

const defaultRegistry = {
  js: jsPlugin, javascript: jsPlugin, mjs: jsPlugin,
  ts: tsPlugin, typescript: tsPlugin,
  hs: hsPlugin, haskell: hsPlugin,
  c: cPlugin, clang: cPlugin, cpp: cPlugin, 'c++': cPlugin,
  cs: csPlugin, csharp: csPlugin, 'c#': csPlugin,
  java: javaPlugin,
  py: pyPlugin, python: pyPlugin, python3: pyPlugin,
  rust: rustPlugin, rs: rustPlugin,
  css: cssPlugin,
  sh: bashPlugin, bash: bashPlugin, shell: bashPlugin,
};

export { tokenizer, highlight, defaultRegistry };
