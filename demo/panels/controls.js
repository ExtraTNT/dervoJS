import { div, Card, Row, Col, Stack, span, p, strong } from '../../src/index.js';
import { Slider, ProgressBar, Button } from '../../src/index.js';
import { setState, startProgress, resetProgress } from '../store.js';

export const controlsPanel = state =>
  div({})([
    // ── Sliders ────────────────────────────────────────────────────────────
    Card({ title: 'Slider' })([
      Stack({ gap: 20 })([
        Slider({
          id: 'sliderA',
          label: 'Volume',
          value: state.sliderA,
          onInput: e => setState({ sliderA: +e.target.value }),
        }),
        Slider({
          id: 'sliderB',
          label: 'Brightness',
          value: state.sliderB,
          min: 0,
          max: 100,
          onInput: e => setState({ sliderB: +e.target.value }),
        }),
        Slider({
          id: 'sliderC',
          label: 'Zoom',
          value: state.sliderC,
          min: 10,
          max: 200,
          step: 10,
          onInput: e => setState({ sliderC: +e.target.value }),
        }),
        Slider({
          id: 'sliderDis',
          label: 'Disabled',
          value: 60,
          disabled: true,
        }),
      ]),
    ]),

    // ── Progress bars ──────────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'ProgressBar' })([
        Stack({ gap: 20 })([
          ProgressBar({ value: state.progress, label: 'Upload', showValue: true }),
          ProgressBar({ value: state.progress, variant: 'success', label: 'Storage', showValue: true, size: 'lg' }),
          ProgressBar({ value: state.progress, variant: 'warning', label: 'Memory', showValue: true, striped: true }),
          ProgressBar({ value: state.progress, variant: 'danger', striped: true, animated: state.progressRunning, size: 'sm' }),
          ProgressBar({ indeterminate: state.progressRunning, label: 'Indeterminate' }),
        ]),
        div({ style: 'display:flex; gap:8px; margin-top:16px' })([
          Button({
            size: 'sm',
            onClick: () => {
              resetProgress();
              setTimeout(startProgress, 50);
            },
          })(['▶ Animate']),
          Button({ variant: 'ghost', size: 'sm', onClick: resetProgress })(['Reset']),
        ]),
      ]),
    ]),

    // ── Stat display row ───────────────────────────────────────────────────
    div({ style: 'margin-top:16px' })([
      Card({ title: 'Live slider values' })([
        Row({ gap: 12 })([
          Col({ span: 4 })([
            div({ style: 'text-align:center; padding:16px; background:var(--surface-2); border-radius:var(--radius)' })([
              div({ style: 'font-size:32px; font-weight:700; color:var(--accent); font-variant-numeric:tabular-nums' })([String(state.sliderA)]),
              span({ style: 'font-size:12px; color:var(--text-muted)' })(['Volume']),
            ]),
          ]),
          Col({ span: 4 })([
            div({ style: 'text-align:center; padding:16px; background:var(--surface-2); border-radius:var(--radius)' })([
              div({ style: 'font-size:32px; font-weight:700; color:var(--accent); font-variant-numeric:tabular-nums' })([String(state.sliderB)]),
              span({ style: 'font-size:12px; color:var(--text-muted)' })(['Brightness']),
            ]),
          ]),
          Col({ span: 4 })([
            div({ style: 'text-align:center; padding:16px; background:var(--surface-2); border-radius:var(--radius)' })([
              div({ style: 'font-size:32px; font-weight:700; color:var(--accent); font-variant-numeric:tabular-nums' })([String(state.sliderC)]),
              span({ style: 'font-size:12px; color:var(--text-muted)' })(['Zoom']),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
