import {
  createStore,
  createInterval,
  memoComponent,
  Badge,
  validate,
  required,
  minLength,
  maxLength,
  validateForm,
  isFormValid,
} from '../src/index.js';

// ── Validation schemas ─────────────────────────────────────────────────────
export const formSchema = {
  name:  validate(required(), minLength(2), maxLength(50)),
  email: validate(
    [v => Boolean(v && v.trim()), 'Email is required'],
    [v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()), 'Enter a valid email address'],
  ),
  age: validate(
    [v => Boolean(v && v.trim()), 'Age is required'],
    v => !isNaN(Number(v)) && Number(v) > 0,
    [v => Number(v) <= 120, 'That\'s a bold claim'],
  ),
};

// ── Store ──────────────────────────────────────────────────────────────────
export const store = createStore({
  activeTab: 'buttons',
  sidebarOpen: true,
  debugOpen: false,
  rightBarOpen: false,
  count: 0,
  name: '', email: '', age: '',
  errors: { name: null, email: null, age: null },
  submitted: false,
  agreed: false,
  color: '',
  alert: null,
  showModal: false,
  innerTab: 'one',
  clockInput:       '5:00',
  countdown:        300,
  countdownRunning: false,
  countup:          0,
  countupRunning:   false,
  feedItems:        [],
  feedRunning:      false,
  tableFilter: '',
  paradigmFilter: '',
  tableSort: null,
  tableColFilters: {},
  builtinFilter: '',
  docsFilter: '',
  // drag-list demo — "keep / delete" review pattern
  dragKeep: [
    { id: 'dk1', label: 'Homepage redesign' },
    { id: 'dk2', label: 'Fix login bug' },
    { id: 'dk3', label: 'Update dependencies' },
    { id: 'dk4', label: 'Write release notes' },
    { id: 'dk5', label: 'Add dark mode' },
  ],
  dragDelete: [],
  // sliders / progress panel
  sliderA: 40,
  sliderB: 70,
  sliderC: 30,
  progress: 60,
  progressRunning: false,
  // media panel — seed changes on every visit so images refresh
  mediaSeed: Date.now(),
  // video stream state (getUserMedia)
  stream:      null,
  streamError: null,
  // dropzone panel
  dzActive: false,
  dzFiles: [],
  // toggles demo
  toggleA: false,
  toggleB: true,
  toggleC: false,
  toggleD: false,
  // theme editor
  themeOverrides: {},
  themeCopied: false,
  // markdown / highlight plugin lab
  hlLang: 'js',
  hlSource: 'const greet = name => `Hello, ${name}!`;\nconsole.log(greet(\'world\')); // works',
  hlPluginSrc: "// specs: [RegExp, 'className'][]\n// classes: keyword | string | number | comment | type\n[\n  [/\\/\\/.*/m,          'comment'],\n  [/'[^']*'|\"[^\"]*\"/,  'string'],\n  [/\\b\\d+\\b/,           'number'],\n  [/\\b(?:let|in|where|if|else)\\b/, 'keyword'],\n]",
  hlPluginActive: false,
  hlPluginError: null,
  // pickers panel
  pickerColor: '#4f46e5',
  pickerNumber: 42,
  pickerDate: new Date().toISOString().slice(0, 10),
  pickerDateTime: new Date().toISOString().slice(0, 16),
  pickerDpYear: new Date().getFullYear(),
  pickerDpMonth: new Date().getMonth(),
  pickerDtYear: new Date().getFullYear(),
  pickerDtMonth: new Date().getMonth(),
});

export const { getState, setState } = store;

// ── Clock / Interval controllers ───────────────────────────────────────────
export let countdownCtrl;
countdownCtrl = createInterval(
  () => setState(s => {
    const next = s.countdown - 1;
    if (next <= 0) { countdownCtrl.stop(); return { countdown: 0, countdownRunning: false }; }
    return { countdown: next };
  }),
  { ms: 1000 }
);

export const countupCtrl = createInterval(
  () => setState(s => ({ countup: s.countup + 1 })),
  { ms: 1000 }
);

export const FEED_MSGS = [
  'User signed in',      'File uploaded',       'Report generated',
  'Backup completed',    'Config updated',       'Session expired',
  'New comment posted',  'API limit reset',      'Cache cleared',
  'Deployment finished', 'DB migration ran',     'Cron job triggered',
];

export const feedCtrl = createInterval(
  () => setState(s => ({
    feedItems: [
      { id: Date.now(), time: new Date().toLocaleTimeString(), msg: FEED_MSGS[Math.floor(Math.random() * FEED_MSGS.length)] },
      ...s.feedItems.slice(0, 7),
    ],
  })),
  { ms: 2000 }
);

// ── Parse clock input ──────────────────────────────────────────────────────
export const parseClockInput = raw => {
  const s = String(raw).trim();
  if (/^\d+:\d{1,2}$/.test(s)) {
    const [m, sec] = s.split(':').map(Number);
    return m * 60 + Math.min(sec, 59);
  }
  return Math.max(0, Math.round(Number(s) || 0));
};

// ── Clock actions ──────────────────────────────────────────────────────────
export const startCountdown = () => { countdownCtrl.start(); setState({ countdownRunning: true });  };
export const pauseCountdown = () => { countdownCtrl.stop();  setState({ countdownRunning: false }); };
export const resetCountdown = () => {
  countdownCtrl.stop();
  setState(s => ({ countdown: parseClockInput(s.clockInput) || 300, countdownRunning: false }));
};
export const setCountdown = () => {
  countdownCtrl.stop();
  setState(s => ({ countdown: parseClockInput(s.clockInput) || 300, countdownRunning: false }));
};

export const startCountup = () => { countupCtrl.start(); setState({ countupRunning: true });  };
export const pauseCountup = () => { countupCtrl.stop();  setState({ countupRunning: false }); };
export const resetCountup = () => { countupCtrl.stop();  setState({ countup: 0, countupRunning: false }); };

export const startFeed = () => { feedCtrl.start(); setState({ feedRunning: true  }); };
export const stopFeed  = () => { feedCtrl.stop();  setState({ feedRunning: false }); };
export const clearFeed = () => { feedCtrl.stop();  setState({ feedItems: [], feedRunning: false }); };

// ── Progress controller ────────────────────────────────────────────────────
export let progressCtrl;
progressCtrl = createInterval(
  () => setState(s => {
    const next = s.progress + 2;
    if (next >= 100) { progressCtrl.stop(); return { progress: 100, progressRunning: false }; }
    return { progress: next };
  }),
  { ms: 80 }
);
export const startProgress = () => { progressCtrl.start(); setState({ progressRunning: true }); };
export const resetProgress = () => { progressCtrl.stop(); setState({ progress: 0, progressRunning: false }); };

// ── Helpers ────────────────────────────────────────────────────────────────
let _alertTimer = null;
export const showAlert = (variant, message) => {
  clearTimeout(_alertTimer);
  setState({ alert: { variant, message } });
  _alertTimer = setTimeout(() => setState({ alert: null }), 4000);
};

export const submitForm = () => {
  const { name, email, age } = getState();
  const errors = validateForm(formSchema)({ name, email, age });
  if (isFormValid(errors)) {
    setState({ errors: { name: null, email: null, age: null }, submitted: true });
    showAlert('success', `Submitted: ${name} <${email}>, age ${age}`);
  } else {
    setState({ errors, submitted: false });
  }
};

// ── Memoised Badge ─────────────────────────────────────────────────────────
export const MemoBadge = memoComponent(Badge);

// ── Table data ─────────────────────────────────────────────────────────────
export const TABLE_ROWS = [
  { lang: 'JavaScript', paradigm: 'Multi',      typed: 'Dynamic', year: 1995 },
  { lang: 'TypeScript', paradigm: 'Multi',      typed: 'Static',  year: 2012 },
  { lang: 'Haskell',    paradigm: 'Functional', typed: 'Static',  year: 1990 },
  { lang: 'Clojure',    paradigm: 'Functional', typed: 'Dynamic', year: 2007 },
  { lang: 'Elm',        paradigm: 'Functional', typed: 'Static',  year: 2012 },
  { lang: 'Rust',       paradigm: 'Multi',      typed: 'Static',  year: 2010 },
  { lang: 'Python',     paradigm: 'Multi',      typed: 'Dynamic', year: 1991 },
];

export const TABLE_COLS = [
  { key: 'lang',     label: 'Language' },
  { key: 'paradigm', label: 'Paradigm' },
  { key: 'typed',    label: 'Type system',
    render: v => MemoBadge({ variant: v === 'Static' ? 'blue' : 'yellow' })([v]) },
  { key: 'year',     label: 'Year' },
];
