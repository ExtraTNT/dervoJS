/**
 * ComponentBuilder — additive wizards that scaffold common scene-NPC-item
 * combinations into the CURRENT project (no slot switch).
 *
 * Topbar "Add component" opens a floating panel. The panel has two states:
 *   - chooser (componentBuilder.activeId === null) — grid of available builders
 *   - wizard  (componentBuilder.activeId === '<id>') — that builder's MultiStep
 *
 * Each builder lives in components/builders/<id>.js and exports
 *   { id, icon, name, description, defaults(project), steps[], build(project, values) }
 * where `build` returns `{ project, summary }`. The framework merges `project`
 * into the editor store via setProject and toasts the summary.
 */

import { div, span, p, button, h2 } from '../../src/elements.js';
import { FloatingPanel } from '../../src/components/FloatingPanel.js';
import { MultiStep } from '../../src/components/MultiStep.js';
import { Stack } from '../../src/components/Layout.js';
import { Button } from '../../src/components/Button.js';
import { setState, setProject, toast, getState } from '../store.js';

// Registered builders. Order = display order in the chooser.
import { questGiver } from './builders/questGiver.js';
import { lockedDoor } from './builders/lockedDoor.js';
import { tavern }     from './builders/tavern.js';

const BUILDERS = [questGiver, lockedDoor, tavern];
const _byId    = id => BUILDERS.find(b => b.id === id);

// ── store wiring ─────────────────────────────────────────────────────────────

const _close = () => setState({
  componentBuilder: { open: false, activeId: null, idx: 0, values: null },
});

const _backToChooser = () => setState(s => ({
  componentBuilder: { ...(s.componentBuilder || {}), activeId: null, idx: 0, values: null },
}));

const _setIdx = i => setState(s => ({
  componentBuilder: { ...(s.componentBuilder || {}), idx: i },
}));

const _setValues = patch => setState(s => {
  const prev = (s.componentBuilder && s.componentBuilder.values) || {};
  const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
  return { componentBuilder: { ...(s.componentBuilder || {}), values: next } };
});

const _pickBuilder = id => {
  const b = _byId(id);
  if (!b) return;
  const project = getState().project;
  const values  = b.defaults(project);
  setState({ componentBuilder: { open: true, activeId: id, idx: 0, values } });
};

const openComponentBuilder = () => setState({
  componentBuilder: { open: true, activeId: null, idx: 0, values: null },
});

// ── chooser view ─────────────────────────────────────────────────────────────

const _ChooserCard = b => button({
  type:      'button',
  className: 'gef-component-card',
  onclick:   () => _pickBuilder(b.id),
  style:     'display:flex; gap:12px; align-items:flex-start; text-align:left; width:100%; padding:14px; border:1px solid var(--border); border-radius:var(--radius); background:var(--surface); cursor:pointer; color:var(--text); font:inherit',
})([
  span({ style: 'font-size:24px; line-height:1' })([b.icon || '🧩']),
  div({ style: 'flex:1; min-width:0' })([
    div({ style: 'font-weight:600; font-size:14px; margin-bottom:2px' })([b.name]),
    div({ style: 'font-size:12px; color:var(--text-muted); line-height:1.4' })([b.description]),
  ]),
]);

const _Chooser = () => Stack({ gap: 12 })([
  p({ style: 'margin:0; color:var(--text-muted); font-size:13px' })([
    'Pick a component to scaffold into the current project. Each one is a small MultiStep wizard and lands additively — your existing rooms / NPCs / items stay put.',
  ]),
  div({ style: 'display:flex; flex-direction:column; gap:10px' })(BUILDERS.map(_ChooserCard)),
]);

// ── wizard view ──────────────────────────────────────────────────────────────

const _onDone = builder => ({ values }) => {
  try {
    const project = getState().project;
    const result  = builder.build(project, values);
    if (!result || !result.project) {
      toast('Builder produced nothing.', 'error');
      return;
    }
    setProject(() => result.project);
    toast(result.summary || `${builder.name} added.`);
    _close();
  } catch (e) {
    console.error('[ComponentBuilder] build failed', e);
    toast(`Build failed: ${e.message}`, 'error');
  }
};

const _Wizard = (builder, idx, values) => {
  const project = getState().project;
  const wrappedSteps = builder.steps.map(s => ({
    title: s.title,
    render: args => s.render({ ...args, project }),
    validate: s.validate,
  }));
  return div({})([
    div({ style: 'display:flex; align-items:center; gap:8px; margin-bottom:10px' })([
      Button({ size: 'sm', variant: 'ghost', onClick: _backToChooser, title: 'Back to component list' })(['← All components']),
      span({ style: 'flex:1' })([]),
      span({ style: 'font-size:18px' })([builder.icon || '🧩']),
      span({ style: 'font-weight:600; font-size:13px' })([builder.name]),
    ]),
    MultiStep({
      steps:    wrappedSteps,
      idx,
      setIdx:   _setIdx,
      values:   values || {},
      setValues: _setValues,
      onDone:   _onDone(builder),
      // Render the validator's error message inline so the user sees WHY the
      // Prev/Next click was blocked. Validation already runs every render via
      // checkValidation() inside MultiStep — this just unhides the message.
      showValidation: true,
    })([]),
  ]);
};

// ── top-level view ───────────────────────────────────────────────────────────

const ComponentBuilder = state => {
  const cb = state.componentBuilder || { open: false };
  if (!cb.open) return [];
  const builder = cb.activeId ? _byId(cb.activeId) : null;
  return [FloatingPanel({
    id:       'gef-componentbuilder',
    title:    builder
      ? `${builder.icon || '🧩'} ${builder.name}`
      : 'Add component — pick a scaffold to drop in',
    open:     true,
    onClose:  _close,
    initialX: 140,
    initialY: 100,
    initialW: 640,
    initialH: 620,
  })([
    div({ style: 'padding:14px 18px; overflow-y:auto; height:100%' })([
      builder
        ? _Wizard(builder, cb.idx || 0, cb.values || {})
        : _Chooser(),
    ]),
  ])];
};

export { ComponentBuilder, openComponentBuilder };
