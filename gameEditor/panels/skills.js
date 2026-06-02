/**
 * Skills panel — catalogue of skills the player can learn.
 *
 * state.skills is an array of skill ids the player currently knows. Effects
 * give/take skills via `skills.<id>` ops (learn / forget). Combat scenes
 * show every learned skill as a move, plus any combat.extraMoves the
 * encounter has defined.
 */

import { div, span, h2, p, button } from '../../src/index.js';
import { TextInput, NumberInput, Select, Button, Card, Stack, Grid, Badge } from '../../src/index.js';
import { setProject, setState } from '../store.js';
import { emptySkill } from '../schema.js';
import { onText } from '../helpers.js';
import { AssetInput } from '../components/AssetInput.js';

const KIND_OPTS = [
  { value: 'attack', label: 'Attack' },
  { value: 'spell',  label: 'Spell'  },
  { value: 'heal',   label: 'Heal'   },
  { value: 'item',   label: 'Item-tied' },
];

const _updateSkill = (id, patch) => setProject(p => ({
  ...p,
  skills: p.skills.map(s => s.id === id ? { ...s, ...patch } : s),
}));

const _addSkill = () => setProject(p => ({ ...p, skills: [...p.skills, emptySkill()] }));

const _deleteSkill = id => setProject(p => ({
  ...p,
  skills:         p.skills.filter(s => s.id !== id),
  startingSkills: (p.startingSkills || []).filter(s => s !== id),
}));

const SkillEditor = (skill, project) => {
  const set = patch => _updateSkill(skill.id, patch);
  return Stack({ gap: 14 })([
    Card({ title: 'Skill' })([
      Stack({ gap: 10 })([
        Grid({ cols: 2, gap: 10 })([
          TextInput({
            label:    'ID (used in code)',
            value:    skill.id,
            onChange: onText(v => {
              const safe = v.replace(/[^a-zA-Z0-9_]/g, '_');
              if (safe === skill.id) return;
              setProject(p => ({
                ...p,
                skills:         p.skills.map(s => s.id === skill.id ? { ...s, id: safe } : s),
                startingSkills: (p.startingSkills || []).map(s => s === skill.id ? safe : s),
              }));
              setState({ selectedSkillId: safe });
            }),
          }),
          TextInput({
            label:    'Name (shown in-game)',
            value:    skill.name,
            onChange: onText(v => set({ name: v })),
          }),
        ]),
        Grid({ cols: 3, gap: 10 })([
          Select({
            label:    'Kind',
            options:  KIND_OPTS,
            value:    skill.kind,
            onChange: onText(v => set({ kind: v })),
          }),
          NumberInput({
            label:    'Damage to enemy',
            value:    Number(skill.damage) || 0,
            onChange: v => set({ damage: Number(v) || 0 }),
          }),
          NumberInput({
            label:    'Self-heal (HP)',
            value:    Number(skill.selfHeal) || 0,
            onChange: v => set({ selfHeal: Number(v) || 0 }),
          }),
        ]),
        Grid({ cols: 3, gap: 10 })([
          Select({
            label:    'Costs stat (optional)',
            options:  [{ value: '', label: '— none —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
            value:    skill.costStat || '',
            onChange: onText(v => set({ costStat: v })),
          }),
          NumberInput({
            label:    'Stat cost',
            value:    Number(skill.costValue) || 0,
            onChange: v => set({ costValue: Number(v) || 0 }),
          }),
          Select({
            label:    'Consumes item (optional)',
            options:  [{ value: '', label: '— none —' }, ...project.items.map(it => ({ value: it.id, label: it.name || it.id }))],
            value:    skill.costItem || '',
            onChange: onText(v => set({ costItem: v })),
          }),
        ]),
        Grid({ cols: 2, gap: 10 })([
          Select({
            label:    'Requires item (optional)',
            options:  [{ value: '', label: '— none —' }, ...project.items.map(it => ({ value: it.id, label: it.name || it.id }))],
            value:    skill.requireItem || '',
            onChange: onText(v => set({ requireItem: v })),
          }),
          AssetInput({
            label:    'Move art (URL or upload)',
            value:    skill.image,
            onChange: v => set({ image: v }),
            accept:   'image',
          }),
        ]),
        TextInput({
          label:       'Move flavour text (shown next to the art on use)',
          value:       skill.flavourText || '',
          onChange:    onText(v => set({ flavourText: v })),
          placeholder: 'The blade catches the firelight.',
        }),
        TextInput({
          label:       'Description (flavour text)',
          value:       skill.description,
          onChange:    onText(v => set({ description: v })),
          placeholder: 'A quick jab with the off-hand.',
        }),
      ]),
    ]),

    Card({ title: 'Damage scaling' })([
      Stack({ gap: 8 })([
        p({ style: 'margin:0; font-size:12px; color:var(--text-muted)' })([
          'Final damage = base + (state.', span({ style: 'font-family:ui-monospace,monospace' })(['stat']), ' × multiplier) + random(0..N). ',
          'Leave the stat blank for a flat damage. Random 0 disables variance.',
        ]),
        Grid({ cols: 3, gap: 10 })([
          Select({
            label:    'Scales with stat',
            options:  [{ value: '', label: '— none —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
            value:    skill.damageStat || '',
            onChange: onText(v => set({ damageStat: v })),
          }),
          NumberInput({
            label:    'Stat multiplier',
            value:    Number(skill.damageStatMul) || 1,
            onChange: v => set({ damageStatMul: Number(v) || 0 }),
          }),
          NumberInput({
            label:    'Random 0..N',
            value:    Number(skill.damageRandom) || 0,
            min:      0,
            onChange: v => set({ damageRandom: Math.max(0, Number(v) || 0) }),
          }),
        ]),
        ...((skill.selfHeal || skill.selfHealStat || skill.selfHealRandom) ? [
          p({ style: 'margin:8px 0 0; font-size:12px; color:var(--text-muted)' })([
            'Heal: same formula over selfHeal base + stat + random.',
          ]),
          Grid({ cols: 3, gap: 10 })([
            Select({
              label:    'Heal scales with stat',
              options:  [{ value: '', label: '— none —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
              value:    skill.selfHealStat || '',
              onChange: onText(v => set({ selfHealStat: v })),
            }),
            NumberInput({
              label:    'Heal stat multiplier',
              value:    Number(skill.selfHealStatMul) || 1,
              onChange: v => set({ selfHealStatMul: Number(v) || 0 }),
            }),
            NumberInput({
              label:    'Heal random 0..N',
              value:    Number(skill.selfHealRandom) || 0,
              min:      0,
              onChange: v => set({ selfHealRandom: Math.max(0, Number(v) || 0) }),
            }),
          ]),
        ] : []),
      ]),
    ]),

    Card({ title: 'To-hit' })([
      Stack({ gap: 8 })([
        Select({
          label:    'Hit mode',
          options:  [
            { value: 'always',   label: 'Always lands' },
            { value: 'percent',  label: 'Flat % chance' },
            { value: 'statRoll', label: 'd20 + stat + bonus  vs  enemy.defense + DC' },
          ],
          value:    skill.hitMode || 'always',
          onChange: onText(v => set({ hitMode: v })),
        }),
        ...(skill.hitMode === 'percent'
          ? [Grid({ cols: 1, gap: 10 })([
              NumberInput({
                label:    'Hit chance (%)',
                value:    Number(skill.hitPercent) || 100,
                min:      0,
                max:      100,
                onChange: v => set({ hitPercent: Math.min(100, Math.max(0, Number(v) || 0)) }),
              }),
            ])]
          : []),
        ...(skill.hitMode === 'statRoll'
          ? [Grid({ cols: 3, gap: 10 })([
              Select({
                label:    'Roll adds stat',
                options:  [{ value: '', label: '— d20 only —' }, ...project.stats.map(s => ({ value: s.key, label: s.key }))],
                value:    skill.hitStat || '',
                onChange: onText(v => set({ hitStat: v })),
              }),
              NumberInput({
                label:    'Flat bonus',
                value:    Number(skill.hitBonus) || 0,
                onChange: v => set({ hitBonus: Number(v) || 0 }),
              }),
              NumberInput({
                label:    'Target DC',
                value:    Number(skill.hitDc) || 10,
                onChange: v => set({ hitDc: Number(v) || 0 }),
              }),
            ])]
          : []),
        p({ style: 'margin:0; font-size:11.5px; color:var(--text-muted)' })([
          skill.hitMode === 'percent'
            ? `Roll 1d100 — hits if ≤ ${skill.hitPercent || 100}.`
            : skill.hitMode === 'statRoll'
              ? `Roll 1d20${skill.hitStat ? ` + state.${skill.hitStat}` : ''}${skill.hitBonus ? ` + ${skill.hitBonus}` : ''} — hits if ≥ (enemy.defense + ${skill.hitDc || 10}).`
              : 'No roll — the skill always lands.',
        ]),
      ]),
    ]),

    Card({ title: 'Starting skill?' })([
      div({ style: 'display:flex; align-items:center; gap:10px' })([
        button({
          type: 'button',
          onclick: () => setProject(p => {
            const has = (p.startingSkills || []).includes(skill.id);
            return {
              ...p,
              startingSkills: has
                ? p.startingSkills.filter(s => s !== skill.id)
                : [...(p.startingSkills || []), skill.id],
            };
          }),
          className: `gef-list-btn${(project.startingSkills || []).includes(skill.id) ? ' active' : ''}`,
          style: 'border:1px solid var(--border); padding:6px 10px',
        })([
          (project.startingSkills || []).includes(skill.id) ? '✓ Player starts with this' : 'Add to starting skills',
        ]),
      ]),
    ]),

    Card({ title: 'Danger zone' })([
      Button({ size: 'sm', variant: 'danger', onClick: () => {
        if (confirm(`Delete skill "${skill.name || skill.id}"? It will be removed from starting skills too.`)) {
          _deleteSkill(skill.id);
          setState({ selectedSkillId: null });
        }
      } })(['Delete skill']),
    ]),
  ]);
};

const SkillsPanel = state => {
  const { project, selectedSkillId } = state;
  const selected = project.skills.find(s => s.id === selectedSkillId) || project.skills[0];
  return div({ style: 'display:grid; grid-template-columns: 280px 1fr; gap:16px; align-items:start' })([
    div({})([
      Stack({ gap: 4 })([
        h2({ style: 'font-size:14px; margin:0 0 4px' })([`Skills (${project.skills.length})`]),
        ...(project.skills.length === 0
          ? [div({ className: 'gef-empty' })(['No skills yet.'])]
          : project.skills.map(s =>
              button({
                className: `gef-list-btn${s.id === selected?.id ? ' active' : ''}`,
                onclick: () => setState({ selectedSkillId: s.id }),
                type: 'button',
              })([
                span({})([s.name || '(unnamed)']),
                Badge({ variant: s.kind === 'spell' ? 'purple' : s.kind === 'heal' ? 'green' : 'blue' })([s.kind]),
                ...((project.startingSkills || []).includes(s.id) ? [Badge({ variant: 'yellow' })(['start'])] : []),
                span({ className: 'gef-id' })([s.id]),
              ])
            )),
        Button({ size: 'sm', variant: 'ghost', onClick: _addSkill, style: 'margin-top:8px' })(['+ Add skill']),
      ]),
    ]),
    div({})([
      selected
        ? SkillEditor(selected, project)
        : div({ className: 'gef-empty' })(['Click "+ Add skill" to create your first skill.']),
    ]),
  ]);
};

export { SkillsPanel };
