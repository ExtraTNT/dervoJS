/**
 * Combats panel — define encounters that the game routes to via the
 * `enterCombat` choice effect.
 *
 * Player moves come from state.skills (the Skills tab catalogue + per-player
 * progression). The combat itself defines:
 *   - the enemy: HP, defense, image, AI actions, loot drops
 *   - optional extra moves available ONLY in this fight
 *   - the player stat that takes damage (default 'hp')
 *   - win/lose flavour, target rooms, onWin / onLose Effects
 *   - linkedNpcId (when set, defeating the enemy removes that NPC from the world)
 */

import { div, span, h2, p, button, textarea } from '../../src/elements.js';
import { TextInput } from '../../src/components/TextInput.js';
import { NumberInput } from '../../src/components/NumberInput.js';
import { Select } from '../../src/components/Select.js';
import { Button } from '../../src/components/Button.js';
import { Card } from '../../src/components/Card.js';
import { Stack, Grid } from '../../src/components/Layout.js';
import { Badge } from '../../src/components/Badge.js';
import { setProject, setState } from '../store.js';
import { emptyCombat, emptyCombatMove, emptyEnemyAction } from '../schema.js';
import { onText } from '../helpers.js';
import { EffectEditor } from '../components/EffectEditor.js';
import { AssetInput }   from '../components/AssetInput.js';

const _vars = project => ({
  stats:   project.stats.map(s => s.key).filter(Boolean),
  flags:   project.flags.map(f => f.key).filter(Boolean),
  items:   project.items,
  skills:  project.skills || [],
  npcs:    project.npcs,
  combats: project.combats || [],
});

const _updateCombat = (id, mut) => setProject(p => ({
  ...p,
  combats: p.combats.map(c => c.id === id ? (typeof mut === 'function' ? mut(c) : { ...c, ...mut }) : c),
}));

const _addCombat = () => setProject(p => ({ ...p, combats: [...p.combats, emptyCombat()] }));
const _deleteCombat = id => setProject(p => ({ ...p, combats: p.combats.filter(c => c.id !== id) }));

const USE_WHEN_OPTS = [
  { value: 'always',        label: 'always available' },
  { value: 'belowHp',       label: 'enemy HP ≤ threshold' },
  { value: 'aboveHp',       label: 'enemy HP > threshold' },
  { value: 'onPlayerMiss',  label: 'after player missed' },
  { value: 'js',            label: 'JS predicate' },
];

const ENEMY_KIND_OPTS = [
  { value: 'attack', label: 'Attack (damages player)' },
  { value: 'heal',   label: 'Heal (restores enemy HP)' },
];

const EnemyActionCard = ({ action, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const set = patch => onChange({ ...action, ...patch });
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); margin-bottom:8px' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      Badge({ variant: action.kind === 'heal' ? 'green' : 'red' })([action.kind || 'attack']),
      span({ style: 'font-weight:600; font-size:13px' })([action.label || '(unnamed)']),
      Badge({ variant: 'gray' })([action.useWhen || 'always']),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveUp,   disabled: isFirst })(['↑']),
      Button({ size: 'sm', variant: 'ghost', onClick: onMoveDown, disabled: isLast  })(['↓']),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['Delete']),
    ]),

    Grid({ cols: 3, gap: 8 })([
      TextInput({ label: 'Label', value: action.label, onChange: onText(v => set({ label: v })) }),
      Select({ label: 'Kind', options: ENEMY_KIND_OPTS, value: action.kind || 'attack', onChange: onText(v => set({ kind: v })) }),
      AssetInput({ label: 'Image (URL or upload)', value: action.image, onChange: v => set({ image: v }), accept: 'image', placeholder: 'shown on enemy turn' }),
    ]),

    TextInput({
      label:       'Flavour text (shown beside the image)',
      value:       action.flavourText || '',
      onChange:    onText(v => set({ flavourText: v })),
      placeholder: 'It bares its teeth.',
    }),

    ...(action.kind === 'heal'
      ? [Grid({ cols: 2, gap: 8 })([
          NumberInput({ label: 'Heal amount', value: Number(action.healAmount) || 0, min: 0, onChange: v => set({ healAmount: Math.max(0, Number(v) || 0) }) }),
          NumberInput({ label: 'Heal random 0..N', value: Number(action.healRandom) || 0, min: 0, onChange: v => set({ healRandom: Math.max(0, Number(v) || 0) }) }),
        ])]
      : [Grid({ cols: 3, gap: 8 })([
          NumberInput({ label: 'Damage', value: Number(action.damage) || 0, onChange: v => set({ damage: Number(v) || 0 }) }),
          NumberInput({ label: 'Damage random 0..N', value: Number(action.damageRandom) || 0, min: 0, onChange: v => set({ damageRandom: Math.max(0, Number(v) || 0) }) }),
          NumberInput({ label: 'Hit %', value: Number(action.hitPercent ?? 100), min: 0, max: 100, onChange: v => set({ hitPercent: Math.min(100, Math.max(0, Number(v) || 0)) }) }),
        ])]),

    div({ style: 'border-top:1px solid var(--border); padding-top:8px; margin-top:8px' })([
      div({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px' })(['Selection rule']),
      Grid({ cols: 3, gap: 8 })([
        Select({ label: 'Use when', options: USE_WHEN_OPTS, value: action.useWhen || 'always', onChange: onText(v => set({ useWhen: v })) }),
        NumberInput({ label: 'Weight', value: Number(action.weight) || 1, min: 0, onChange: v => set({ weight: Math.max(0, Number(v) || 0) }) }),
        ...(action.useWhen === 'belowHp' || action.useWhen === 'aboveHp'
          ? [NumberInput({ label: 'HP threshold (% of max)', value: Number(action.hpThreshold) || 50, min: 0, max: 100, onChange: v => set({ hpThreshold: Math.min(100, Math.max(0, Number(v) || 0)) }) })]
          : [div({})([])]),
      ]),
      ...(action.useWhen === 'js'
        ? [div({ style: 'margin-top:8px' })([
            span({ style: 'font-size:11px; color:var(--text-muted)' })([
              'Body receives ', span({ style: 'font-family:ui-monospace,monospace' })(['{ enemyHp, enemyMaxHp, state, lastResult }']),
              '. Return truthy to allow.',
            ]),
            textarea({
              value: action.jsCondition,
              oninput: e => set({ jsCondition: e.target.value }),
              rows: 3,
              spellcheck: false,
              style: 'width:100%; margin-top:4px; padding:8px; border:1px solid var(--border); border-radius:var(--radius); font-family:ui-monospace,monospace; font-size:12.5px; background:var(--surface); color:var(--text); resize:vertical',
              placeholder: 'return enemyHp / enemyMaxHp < 0.5 && state.gold > 0;',
            })([]),
          ])]
        : []),
    ]),
  ]);
};

const ExtraMoveCard = ({ move, items, stats, onChange, onDelete }) => {
  const set = patch => onChange({ ...move, ...patch });
  return div({ style: 'border:1px solid var(--border); border-radius:var(--radius); padding:10px; background:var(--surface); margin-bottom:8px' })([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' })([
      Badge({ variant: 'yellow' })(['extra']),
      span({ style: 'font-weight:600; font-size:13px' })([move.label || '(unnamed)']),
      div({ style: 'flex:1' })([]),
      Button({ size: 'sm', variant: 'ghost', onClick: onDelete })(['Delete']),
    ]),
    Grid({ cols: 3, gap: 8 })([
      TextInput({ label: 'Label', value: move.label, onChange: onText(v => set({ label: v })) }),
      NumberInput({ label: 'Damage', value: Number(move.damage) || 0, onChange: v => set({ damage: Number(v) || 0 }) }),
      NumberInput({ label: 'Heal self', value: Number(move.selfHeal) || 0, onChange: v => set({ selfHeal: Number(v) || 0 }) }),
    ]),
    Grid({ cols: 3, gap: 8 })([
      Select({
        label: 'Cost stat',
        options: [{ value: '', label: '— none —' }, ...stats.map(k => ({ value: k, label: k }))],
        value: move.costStat || '',
        onChange: onText(v => set({ costStat: v })),
      }),
      NumberInput({ label: 'Stat cost', value: Number(move.costValue) || 0, onChange: v => set({ costValue: Number(v) || 0 }) }),
      Select({
        label: 'Consumes item',
        options: [{ value: '', label: '— none —' }, ...items.map(it => ({ value: it.id, label: it.name || it.id }))],
        value: move.costItem || '',
        onChange: onText(v => set({ costItem: v })),
      }),
    ]),
  ]);
};

const LootEditor = ({ loot, items, onChange }) => {
  const _entries = Object.entries(loot || {});
  return Stack({ gap: 6 })([
    ...(items.length === 0
      ? [div({ className: 'gef-empty' })(['Add items first to define loot.'])]
      : items.map(it => {
          const count = Number(loot?.[it.id] || 0);
          return div({ style: 'display:grid; grid-template-columns: 1fr 160px 1fr; gap:8px; align-items:center; padding:4px 0' })([
            div({})([
              span({ style: 'font-weight:500' })([it.name || it.id]),
              span({ style: 'margin-left:6px; font-family:ui-monospace,monospace; font-size:11px; color:var(--text-muted)' })([it.id]),
            ]),
            NumberInput({
              value: count,
              min:   0,
              onChange: v => {
                const n = Math.max(0, Number(v) || 0);
                const next = { ...(loot || {}) };
                if (n === 0) delete next[it.id]; else next[it.id] = n;
                onChange(next);
              },
            }),
            div({ style: 'color:var(--text-muted); font-size:12px' })([
              count > 0 ? `→ inventory["${it.id}"] += ${count}` : '',
            ]),
          ]);
        })),
  ]);
};

const CombatList = (project, selectedId) =>
  Stack({ gap: 4 })([
    h2({ style: 'font-size:14px; margin:0 0 4px' })([`Combats (${project.combats.length})`]),
    ...(project.combats.length === 0
      ? [div({ className: 'gef-empty' })(['No combats yet.'])]
      : project.combats.map(c =>
          button({
            className: `gef-list-btn${c.id === selectedId ? ' active' : ''}`,
            onclick:   () => setState({ selectedCombatId: c.id }),
            type:      'button',
          })([
            span({})([c.name || '(unnamed)']),
            Badge({ variant: 'red' })([`HP ${c.enemy.hp}`]),
            ...(c.linkedNpcId ? [Badge({ variant: 'gray' })([`@${c.linkedNpcId}`])] : []),
            span({ className: 'gef-id' })([c.id]),
          ])
        )),
    Button({ size: 'sm', variant: 'ghost', onClick: _addCombat, style: 'margin-top:8px' })(['+ Add combat']),
  ]);

const CombatEditor = (combat, project) => {
  const vars = _vars(project);
  const roomOpts = [{ value: '', label: '— return to caller —' }, ...project.rooms.map(r => ({ value: r.id, label: r.title || r.id }))];
  const set = patch => _updateCombat(combat.id, patch);
  const setEnemy = patch => _updateCombat(combat.id, c => ({ ...c, enemy: { ...c.enemy, ...patch } }));

  const _setAction = (i, next) => setEnemy({ actions: combat.enemy.actions.map((a, k) => k === i ? next : a) });
  const _addAction = () => setEnemy({ actions: [...combat.enemy.actions, emptyEnemyAction()] });
  const _deleteAction = i => setEnemy({ actions: combat.enemy.actions.filter((_, k) => k !== i) });
  const _moveAction = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= combat.enemy.actions.length) return;
    const arr = [...combat.enemy.actions];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setEnemy({ actions: arr });
  };

  const _setExtra = (i, next) => set({ extraMoves: (combat.extraMoves || []).map((m, k) => k === i ? next : m) });
  const _addExtra = () => set({ extraMoves: [...(combat.extraMoves || []), emptyCombatMove()] });
  const _deleteExtra = i => set({ extraMoves: (combat.extraMoves || []).filter((_, k) => k !== i) });

  return Stack({ gap: 14 })([
    Card({ title: 'Combat basics' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label: 'ID',
            value: combat.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === combat.id) return;
              setProject(p => ({
                ...p,
                combats: p.combats.map(c => c.id === combat.id ? { ...c, id: safe } : c),
              }));
              setState({ selectedCombatId: safe });
            }),
          }),
          TextInput({ label: 'Display name', value: combat.name, onChange: onText(v => set({ name: v })) }),
        ]),
        TextInput({
          label: 'Intro line (shown above the move list on turn 0)',
          value: combat.intro,
          onChange: onText(v => set({ intro: v })),
          placeholder: 'A goblin steps from the shadows.',
        }),
        Grid({ cols: 2, gap: 10 })([
          Select({
            label: 'Player damage taken from which stat?',
            options: vars.stats.map(k => ({ value: k, label: k })),
            value: combat.playerStat || 'hp',
            onChange: onText(v => set({ playerStat: v })),
          }),
          Select({
            label: 'Linked NPC (removed from world on win)',
            options: [{ value: '', label: '— none —' }, ...project.npcs.map(n => ({ value: n.id, label: n.name || n.id }))],
            value: combat.linkedNpcId || '',
            onChange: onText(v => set({ linkedNpcId: v })),
          }),
        ]),
      ]),
    ]),

    Card({ title: 'Enemy' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({ label: 'Name', value: combat.enemy.name, onChange: onText(v => setEnemy({ name: v })) }),
          AssetInput({ label: 'Image (URL or upload)', value: combat.enemy.image, onChange: v => setEnemy({ image: v }), accept: 'image' }),
        ]),
        Grid({ cols: 2, gap: 10 })([
          NumberInput({ label: 'HP', value: Number(combat.enemy.hp) || 0, min: 1, onChange: v => setEnemy({ hp: Number(v) || 1 }) }),
          NumberInput({ label: 'Defense', value: Number(combat.enemy.defense) || 0, onChange: v => setEnemy({ defense: Number(v) || 0 }) }),
        ]),
        div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
          div({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px' })(['AI actions']),
          p({ style: 'margin:0 0 8px; font-size:12px; color:var(--text-muted)' })([
            'Each enemy turn the engine filters actions by their selection rule (always, low HP, after player missed, JS predicate), then weighted-random picks one of the survivors. ',
            'Higher weight → picked more often. Pattern: a heal that\'s only available below 30% HP plus a default attack — the enemy heals when hurt and swings otherwise.',
          ]),
          ...combat.enemy.actions.map((a, i) =>
            EnemyActionCard({
              action:     a,
              isFirst:    i === 0,
              isLast:     i === combat.enemy.actions.length - 1,
              onChange:   next => _setAction(i, next),
              onDelete:   () => _deleteAction(i),
              onMoveUp:   () => _moveAction(i, -1),
              onMoveDown: () => _moveAction(i,  1),
            })
          ),
          Button({ size: 'sm', variant: 'ghost', onClick: _addAction })(['+ Add AI action']),
        ]),
        div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
          div({ style: 'font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px' })(['Loot drops (added to player inventory on win)']),
          LootEditor({
            loot:     combat.enemy.loot,
            items:    project.items,
            onChange: next => setEnemy({ loot: next }),
          }),
        ]),
      ]),
    ]),

    Card({ title: `Extra moves (${(combat.extraMoves || []).length})` })([
      Stack({ gap: 6 })([
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'Available ONLY in this fight. The player\'s learned skills (Skills tab → starting skills or learned via effects) appear automatically as moves.',
        ]),
        ...(combat.extraMoves || []).map((m, i) =>
          ExtraMoveCard({
            move:     m,
            items:    project.items,
            stats:    vars.stats,
            onChange: next => _setExtra(i, next),
            onDelete: () => _deleteExtra(i),
          })
        ),
        Button({ size: 'sm', variant: 'ghost', onClick: _addExtra })(['+ Add extra move']),
      ]),
    ]),

    Card({ title: 'On win' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          Select({
            label: 'Goto room',
            options: roomOpts,
            value: combat.winRoom,
            onChange: onText(v => set({ winRoom: v })),
          }),
          TextInput({ label: 'Flavour text', value: combat.winText, onChange: onText(v => set({ winText: v })) }),
        ]),
        AssetInput({
          label:       'Win image (optional — shown on the outcome screen)',
          value:       combat.winImage || '',
          onChange:    v => set({ winImage: v }),
          accept:      'image',
          placeholder: 'leave empty to show the greyed enemy portrait',
        }),
        div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
          EffectEditor({
            effect:   combat.onWin,
            vars,
            label:    'Effect on win (add gold, learn a skill, set a flag, …)',
            onChange: v => set({ onWin: v }),
          }),
        ]),
      ]),
    ]),

    Card({ title: 'On lose' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          Select({
            label: 'Goto room',
            options: roomOpts,
            value: combat.loseRoom,
            onChange: onText(v => set({ loseRoom: v })),
          }),
          TextInput({ label: 'Flavour text', value: combat.loseText, onChange: onText(v => set({ loseText: v })) }),
        ]),
        AssetInput({
          label:       'Lose image (optional — game-over art)',
          value:       combat.loseImage || '',
          onChange:    v => set({ loseImage: v }),
          accept:      'image',
          placeholder: 'leave empty to show the greyed enemy portrait',
        }),
        div({ style: 'border-top:1px solid var(--border); padding-top:10px' })([
          EffectEditor({
            effect:   combat.onLose,
            vars,
            label:    'Effect on lose (penalty stat change, lose a flag, …)',
            onChange: v => set({ onLose: v }),
          }),
        ]),
      ]),
    ]),

    Card({ title: 'Use this combat' })([
      p({ style: 'margin:0; font-size:13px' })([
        'Add a Choice with the ', span({ style: 'font-family:ui-monospace,monospace' })(['open combat']), ' effect, ',
        'or set it as a room\'s On enter (gated behind a flag so it doesn\'t repeat). The engine remembers the caller; blank win/lose rooms fall back to it.',
      ]),
    ]),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete combat "${combat.name || combat.id}"?`)) {
          _deleteCombat(combat.id);
          setState({ selectedCombatId: null });
        }
      } })(['Delete combat']),
    ]),
  ]);
};

const CombatsPanel = state => {
  const { project, selectedCombatId } = state;
  const selected = project.combats.find(c => c.id === selectedCombatId) || project.combats[0];
  return div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
    div({})([CombatList(project, selected?.id)]),
    div({})([
      selected
        ? CombatEditor(selected, project)
        : div({ className: 'gef-empty' })(['Click "+ Add combat" to design your first encounter.']),
    ]),
  ]);
};

export { CombatsPanel };
