import { div, Card, Row, Col, Stack, Toggle } from '../../src/index.js';
import { setState } from '../store.js';

export const togglesPanel = state =>
  div({})([
    Card({ title: 'Toggle basics' })([
      Stack({ gap: 16 })([
        Toggle({
          on: state.toggleA,
          onChange: v => setState({ toggleA: v }),
        })(['Notifications']),

        Toggle({
          on: state.toggleB,
          onChange: v => setState({ toggleB: v }),
        })(['Dark mode']),

        Toggle({
          on: state.toggleC,
          onChange: v => setState({ toggleC: v }),
          disabled: true,
        })(['Disabled (off)']),

        Toggle({
          on: true,
          onChange: () => {},
          disabled: true,
        })(['Disabled (on)']),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Label-less' })([
        div({ style: 'display:flex; gap:16px; align-items:center' })([
          Toggle({ on: state.toggleD, onChange: v => setState({ toggleD: v }) })([]),
          Toggle({ on: !state.toggleD, onChange: v => setState({ toggleD: !v }) })([]),
          Toggle({ on: false, onChange: () => {}, disabled: true })([]),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Current state' })([
        Row({ gap: 12 })([
          Col({ span: 6, md: 3 })([
            div({ style: 'text-align:center; padding:12px; background:var(--surface-2); border-radius:var(--radius)' })([
              div({ style: 'font-size:22px' })([state.toggleA ? '🔔' : '🔕']),
              div({ style: 'font-size:12px; color:var(--text-muted); margin-top:4px' })(['Notifications']),
            ]),
          ]),
          Col({ span: 6, md: 3 })([
            div({ style: 'text-align:center; padding:12px; background:var(--surface-2); border-radius:var(--radius)' })([
              div({ style: 'font-size:22px' })([state.toggleB ? '🌙' : '☀️']),
              div({ style: 'font-size:12px; color:var(--text-muted); margin-top:4px' })(['Theme']),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
