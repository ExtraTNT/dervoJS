import { div, Card, Button, p } from '../../src/index.js';
import { setState, showAlert } from '../store.js';

export const buttonsPanel = state =>
  div({})([
    Card({ title: 'Variants' })([
      div({ style: 'display:flex; gap:10px; flex-wrap:wrap; align-items:center' })([
        Button({ onClick: () => showAlert('success', 'Primary!') })(['Primary']),
        Button({ variant: 'secondary', onClick: () => showAlert('info', 'Secondary!') })(['Secondary']),
        Button({ variant: 'danger',    onClick: () => showAlert('error', 'Danger!') })(['Danger']),
        Button({ variant: 'success',   onClick: () => showAlert('success', 'Success!') })(['Success']),
        Button({ variant: 'ghost',     onClick: () => showAlert('info', 'Ghost!') })(['Ghost']),
        Button({ disabled: true })(['Disabled']),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Sizes' })([
        div({ style: 'display:flex; gap:10px; align-items:center' })([
          Button({ size: 'sm' })(['Small']),
          Button({ size: 'md' })(['Medium']),
          Button({ size: 'lg' })(['Large']),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Card({ title: 'Counter' })([
        p({ style: 'font-size:40px; font-weight:700; margin:0 0 16px; color:var(--accent)' })([
          String(state.count),
        ]),
        div({ style: 'display:flex; gap:8px' })([
          Button({ variant: 'secondary', size: 'sm', onClick: () => setState(s => ({ count: s.count - 1 })) })(['− 1']),
          Button({ size: 'sm',           onClick: () => setState(s => ({ count: s.count + 1 })) })(['+ 1']),
          Button({ variant: 'ghost',     size: 'sm', onClick: () => setState({ count: 0 }) })(['Reset']),
        ]),
      ]),
    ]),
  ]);
