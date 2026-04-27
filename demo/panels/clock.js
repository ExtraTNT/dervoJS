import { div, Card, Row, Col, Button, TextInput, Clock, List, span, p, li } from '../../src/index.js';
import {
  setState,
  startCountdown, pauseCountdown, resetCountdown, setCountdown,
  startCountup, pauseCountup, resetCountup,
  startFeed, stopFeed, clearFeed,
  timerCtrl,
} from '../store.js';

import { doc } from '../components/doc.js';

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
      doc([
`Clock({
  time: state.countdown,
  size: 'lg',
  label: 'remaining',
  running: state.countdownRunning
})`]),
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
            doc([`Clock({ time: state.countup, running: state.countupRunning, label: 'elapsed' })

// Drive it with createInterval (outside the view):
const stopwatch = createInterval(
  () => setState(s => ({ countup: s.countup + 1 }))
)({ ms: 1000 });
stopwatch.start();
stopwatch.stop();
// reset: setState({ countup: 0 })`]),
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
            doc([`// createInterval — curried: createInterval(fn)(opts)
const feed = createInterval(
  () => setState(s => ({ feedItems: [newItem(), ...s.feedItems.slice(0, 7)] }))
)({ ms: 2000 });
feed.start();
feed.stop();
feed.toggle();
feed.restart();
feed.isRunning(); // boolean`]),
          ]),
        ]),
      ]),
    ]),
      Card({
        title: 'createTimer — Task-based store-slice timer',
        footer: [
          span({ style: 'font-size:12px; color:var(--text-muted)' })([
            'Driven by a lazy Task chain — no setInterval handle.',
          ]),
        ],
      })([
        div({ style: 'display:flex; flex-direction:column; align-items:center; gap:16px; padding:16px 0' })([
          Clock({
            time:     state.timer.elapsed,
            running:  state.timer.running,
            size:     'lg',
            label:    'elapsed',
            controls: timerCtrl,
          }),
        ]),
        doc([`// createTimer drives a store slice via lazy Task chain (no setInterval)
const timer = createTimer({ store, key: 'timer', step: 1 });
timer.start();   // begin ticking
timer.pause();   // freeze
timer.reset();   // pause + set elapsed = 0
timer.toggle();  // flip running

// Pass controls to Clock for built-in Start/Pause + Reset buttons:
Clock({
  time:     state.timer.elapsed,
  running:  state.timer.running,
  size:     'lg',
  controls: timer,
})`]),
      ]),
    ]);
