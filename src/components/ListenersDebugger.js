import { div, span, textarea, select, option } from '../elements.js';
import { cn } from '../utils.js';
import { listBusIds, getBus } from '../listeners.js';
import { Row, Col, Stack } from './Layout.js';
import { Table } from './Table.js';
import { TextInput } from './TextInput.js';
import { Button } from './Button.js';

// module UI state
const _ui = {
  filter: '',
  newBusId: '',
  selectedBus: null,
  selectedEvent: null,
  emitEvent: '',
  emitPayload: '',
  logs: [],
  registered: [],
};

const ts = () => new Date().toTimeString().slice(0, 8);
const addLog = e => { _ui.logs = [{ ts: ts(), ...e }, ..._ui.logs].slice(0, 500); };

const ListenersDebugger = ({ setState } = {}) => {
  const force = () => setState ? setState({}) : null;
  const buses = listBusIds();

  const createBusIfNeeded = () => {
    const id = (_ui.newBusId || '').trim();
    if (!id) return;
    getBus(id); // ensure created
    _ui.newBusId = '';
    force();
  };

  const selectBus = id => {
    _ui.selectedBus = id || null;
    _ui.selectedEvent = null;
    force();
  };

  const events = _ui.selectedBus ? (getBus(_ui.selectedBus).events() || []) : [];
  const rows = events.map(ev => ({ event: ev.event, handlers: ev.handlers.length }));

  const selectEvent = evName => { _ui.selectedEvent = evName; _ui.emitEvent = evName; force(); };

  const isSubscribed = (busId, evName) => _ui.registered.some(r => r.bus === busId && r.event === evName);

  const subscribeToEvent = (busId, evName) => {
    if (!busId || !evName) return;
    const bus = getBus(busId);
    const id = Math.random().toString(36).slice(2, 9);
    const fn = payload => addLog({ bus: busId, event: evName, payload });
    bus.on(evName, fn);
    _ui.registered.push({ id, bus: busId, event: evName, fn });
    force();
  };

  const unsubscribeFromEvent = (busId, evName) => {
    const idx = _ui.registered.findIndex(r => r.bus === busId && r.event === evName);
    if (idx === -1) return;
    const r = _ui.registered[idx];
    try { getBus(r.bus).off(r.event, r.fn); } catch (e) { /* ignore */ }
    _ui.registered.splice(idx, 1);
    force();
  };

  const emitNow = () => {
    if (!_ui.selectedBus || !_ui.emitEvent) return;
    const bus = getBus(_ui.selectedBus);
    let payload;
    try { payload = _ui.emitPayload ? JSON.parse(_ui.emitPayload) : undefined; } catch (e) { payload = { __error: String(e) }; }
    try { bus.emit(_ui.emitEvent, payload); addLog({ bus: _ui.selectedBus, event: _ui.emitEvent, payload }); } catch (e) { addLog({ bus: _ui.selectedBus, event: _ui.emitEvent, payload: { __error: String(e) } }); }
    force();
  };

  const clearLogs = () => { _ui.logs = []; force(); };

  return div({ className: 'listeners-debugger' })([
    div({ className: 'dbg-toolbar' })([
      TextInput({ placeholder: 'Filter buses…', value: _ui.filter, onInput: e => { _ui.filter = e.target.value; force(); }, className: 'dbg-filter' }),
      span({ className: 'dbg-toolbar-stat' })([`${buses.length} buses`]),
      Button({ onClick: clearLogs, variant: 'secondary' })(['Clear logs']),
    ]),

    Row({ gap: 12 })([
      Col({ span: 5 })([
        Stack({ gap: 8 })([
          div({ className: 'dbg-row dbg-header' })([
            div({ className: 'dbg-cell dbg-key' })(['Buses']),
            span({ className: 'dbg-toolbar-stat' })([`${buses.length}`]),
          ]),

          div({ className: 'dbg-add-row' })([
            TextInput({ placeholder: 'new bus id', value: _ui.newBusId, onInput: e => { _ui.newBusId = e.target.value; }, className: 'dbg-add-key' }),
            Button({ onClick: createBusIfNeeded, className: 'dbg-btn-add' })(['+ Create']),
          ]),

          // bus selector
          div({ style: 'padding:6px 0' })([
            select({ className: 'select', value: _ui.selectedBus || '', onchange: e => selectBus(e.target.value) })([
              option({ value: '' })(['-- select bus --']),
              ...buses.filter(id => !_ui.filter || id.includes(_ui.filter)).map(id => option({ value: id, key: id })([id])),
            ]),
          ]),

          // events table
          Table({
            columns: [
              { key: 'event', label: 'Event', render: (v, row) => div({ style: 'cursor:pointer', onclick: () => selectEvent(row.event) })([row.event]) },
              { key: 'handlers', label: 'Handlers' },
              { key: 'actions', label: '', render: (v, row) => {
                  const subscribed = isSubscribed(_ui.selectedBus, row.event);
                  return Button({ onClick: () => subscribed ? unsubscribeFromEvent(_ui.selectedBus, row.event) : subscribeToEvent(_ui.selectedBus, row.event), variant: subscribed ? 'secondary' : 'primary' })([subscribed ? 'Unsubscribe' : 'Subscribe']);
                }
              },
            ],
            rows,
            showFilter: false,
            caption: div({})(['Events for selected bus']),
            maxHeight: '360px',
          }),
        ]),
      ]),

      Col({ span: 7 })([
        Stack({ gap: 8 })([
          div({ className: 'dbg-row dbg-header' })([
            div({ className: 'dbg-cell dbg-key' })([`Event: ${_ui.selectedEvent || '—'}`]),
            span({ className: 'dbg-toolbar-stat' })([`${_ui.logs.length} logs`]),
          ]),

          // event handlers / details
          div({ style: 'flex:1; overflow:auto; padding-right:6px;' })([
            !_ui.selectedBus
              ? div({ className: 'dbg-log-empty', style: 'color:var(--text-muted)' })(['Select a bus and an event on the left to inspect handlers'])
              : (!_ui.selectedEvent
                  ? div({ className: 'dbg-log-empty', style: 'padding:6px; color:var(--text-muted)' })(['Select an event on the left to see handlers and emit payloads'])
                  : div({ style: 'font-size: 12px; padding:6px; color:var(--text-muted)' })([
                      div({ style: 'margin-bottom:6px' })(['Handlers']),
                      ...(getBus(_ui.selectedBus).events().find(e => e.event === _ui.selectedEvent)?.handlers || []).map((h, i) =>
                        div({ key: String(i), className: 'dbg-sub' })([
                          div({ className: 'dbg-cell dbg-key' })([span({ className: 'dbg-val-text' })([String(h.name || h.toString()).slice(0, 200)])]),
                        ])
                      ),
                    ])
                )
          ]),

          // emit controls + logs
          div({ style: 'display:flex; flex-direction:column; gap:8px;' })([
            div({ style: 'display:flex; gap:8px; align-items:center;' })([
              TextInput({ placeholder: 'event', value: _ui.emitEvent, onInput: e => { _ui.emitEvent = e.target.value; } }),
              Button({ onClick: emitNow })(['Emit']),
              Button({ onClick: clearLogs, variant: 'secondary' })(['Clear logs']),
            ]),
            textarea({ className: 'input', placeholder: 'payload (JSON)', value: _ui.emitPayload, oninput: e => { _ui.emitPayload = e.target.value; }, style: 'width:100%; height:90px; font-family:monospace;' })([]),
            div({ className: 'dbg-log-entries', style: 'max-height:220px; overflow:auto;' })([
              ...(_ui.logs.length ? _ui.logs.map((l, i) => div({ className: 'dbg-log-row', key: String(i) })([
                span({ className: 'dbg-log-ts' })([l.ts]),
                span({ className: 'dbg-log-key' })([l.bus]),
                span({ className: 'dbg-log-from' })([`:${l.event}`]),
                span({ className: 'dbg-log-arrow' })(['→']),
                span({ className: 'dbg-log-to' })([ JSON.stringify(l.payload) ]),
              ])) : [div({ className: 'dbg-log-empty' })(['No logs yet'])])
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);
};

export { ListenersDebugger };