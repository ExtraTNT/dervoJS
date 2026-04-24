import { div, Card, Row, Col, Button, TextInput, Clock, List, span, p, li } from '../../src/index.js';
import {
  setState,
  startCountdown, pauseCountdown, resetCountdown, setCountdown,
  startCountup, pauseCountup, resetCountup,
  startFeed, stopFeed, clearFeed,
} from '../store.js';

export const clockPanel = state =>
  div({})([
    Card({ title: 'Countdown' })([
      div({ style: 'display:flex; flex-direction:column; align-items:center; gap:20px; padding:16px 0' })([
        Clock({ time: state.countdown, size: 'lg', label: 'remaining', running: state.countdownRunning }),
        div({ style: 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:center' })([
          TextInput({
            id: 'clockInput',
            placeholder: '5:00',
            value: state.clockInput,
            hint: 'Enter M:SS or total seconds.',
            style: 'max-width:110px',
            onInput: e => setState({ clockInput: e.target.value }),
          }),
          Button({ variant: 'secondary', size: 'sm', onClick: setCountdown })(['Set']),
        ]),
        div({ style: 'display:flex; gap:8px' })([
          ...(state.countdownRunning
            ? [Button({ variant: 'secondary', onClick: pauseCountdown })(['Pause'])]
            : [Button({ onClick: startCountdown, disabled: state.countdown === 0 })(['Start'])]),
          Button({ variant: 'ghost', onClick: resetCountdown })(['Reset']),
        ]),
      ]),
    ]),

    div({ style: 'margin-top:16px' })([
      Row({ gap: 16 })([
        Col({ span: 12, md: 6 })([
          Card({ title: 'Count-up (stopwatch)' })([
            div({ style: 'display:flex; flex-direction:column; align-items:center; gap:12px; padding:8px 0' })([
              Clock({ time: state.countup, running: state.countupRunning, label: 'elapsed' }),
              div({ style: 'display:flex; gap:8px' })([
                ...(state.countupRunning
                  ? [Button({ variant: 'secondary', size: 'sm', onClick: pauseCountup })(['Pause'])]
                  : [Button({ size: 'sm', onClick: startCountup })(['Start'])]),
                Button({ variant: 'ghost', size: 'sm', onClick: resetCountup })(['Reset']),
              ]),
            ]),
          ]),
        ]),

        Col({ span: 12, md: 6 })([
          Card({
            title: 'createInterval — event feed',
            footer: [
              span({ style: 'font-size:12px; color:var(--text-muted)' })(['ticks every 2 s · last 8 events']),
            ],
          })([
            div({ style: 'display:flex; gap:8px; margin-bottom:12px' })([
              ...(state.feedRunning
                ? [Button({ variant: 'secondary', size: 'sm', onClick: stopFeed  })(['Stop'])]
                : [Button({ size: 'sm',           onClick: startFeed })(['Start'])]),
              Button({ variant: 'ghost', size: 'sm', onClick: clearFeed })(['Clear']),
            ]),
            List({
              items: state.feedItems,
              renderItem: item =>
                li({
                  style: 'display:flex; gap:10px; align-items:baseline; padding:5px 0; border-bottom:1px solid var(--border-2); font-size:13px; list-style:none',
                })([
                  span({ style: 'color:var(--text-subtle); font-size:11px; font-variant-numeric:tabular-nums; flex-shrink:0; width:62px' })([item.time]),
                  span({})([item.msg]),
                ]),
              empty: p({ style: 'font-size:13px; color:var(--text-muted); margin:0' })([
                'Start the feed to see events appear every 2 seconds.',
              ]),
            }),
          ]),
        ]),
      ]),
    ]),
  ]);
