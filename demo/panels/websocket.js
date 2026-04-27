import {
  div, span, p, pre, strong, code, input, button,
  Card, Badge, Alert, Stack, Row, Col,
} from '../../src/index.js';
import { createWS } from '../../src/index.js';
import { setState, getState } from '../store.js';
import { doc } from '../components/doc.js';

// ── Module-level WS instances ──────────────────────────────────────────────
// One demo per WS scenario — lazily created, stored outside the view.
let _echoWs  = null;
let _chatLog = null;  // alias — displayed messages live in state

const MAX_MSGS = 40;

const _appendMsg = (type, text) => setState(s => ({
  wsDemo: {
    ...s.wsDemo,
    messages: [{ type, text, ts: new Date().toTimeString().slice(0, 8) }, ...(s.wsDemo?.messages ?? [])].slice(0, MAX_MSGS),
  },
}));

const _setStatus = status => setState(s => ({ wsDemo: { ...s.wsDemo, status } }));
const _setRetries = n => setState(s => ({ wsDemo: { ...s.wsDemo, retries: n } }));

const _connect = () => {
  if (_echoWs) { _echoWs.destroy(); _echoWs = null; }
  _setStatus('connecting');
  _appendMsg('info', 'Connecting to wss://echo.websocket.org…');

  _echoWs = createWS({
    url: 'wss://echo.websocket.org',
    reconnect:  true,
    maxRetries: 4,
    baseDelay:  800,
  })({
    onOpen:      ()    => { _setStatus('open');         _appendMsg('info',  '✓ Connected'); },
    onClose:     code  => { _setStatus('closed');       _appendMsg('info',  `Closed (code ${code})`); },
    onError:     err   => {                             _appendMsg('error', `Error: ${err?.type ?? 'unknown'}`); },
    onMessage:   data  => _appendMsg('recv', typeof data === 'string' ? data : JSON.stringify(data)),
    onReconnect: n     => { _setStatus('reconnecting'); _setRetries(n); _appendMsg('info',  `Reconnecting… attempt ${n}`); },
    onGiveUp:    ()    => { _setStatus('failed');       _appendMsg('error', 'Gave up after max retries'); },
  });
};

const _disconnect = () => {
  if (!_echoWs) return;
  _echoWs.close(1000);
  _echoWs = null;
};

const _send = msg => {
  if (!_echoWs) return;
  _appendMsg('sent', typeof msg === 'string' ? msg : JSON.stringify(msg));
  _echoWs.send(msg);
};

const STATUS_VARIANT = { open: 'green', connecting: 'yellow', reconnecting: 'yellow', closed: 'gray', failed: 'red' };

export const websocketPanel = state => {
  const wd      = state.wsDemo ?? {};
  const status  = wd.status   ?? 'closed';
  const msgs    = wd.messages ?? [];
  const retries = wd.retries  ?? 0;
  const draft   = wd.draft    ?? '';

  const sendDraft = () => {
    if (!draft.trim()) return;
    _send(draft.trim());
    setState(s => ({ wsDemo: { ...s.wsDemo, draft: '' } }));
  };

  return div({ style: 'display:flex; flex-direction:column; gap:16px' })([

    Card({ title: 'createWS — echo demo (wss://echo.websocket.org)' })([
      p({ style: 'margin:0 0 12px; font-size:13px; color:var(--text-muted)' })([
        'Everything you send is echoed back by the server. Demonstrates full handler wiring, ' +
        'reconnect back-off, and the typed ',
        code({ style: 'font-family:monospace; font-size:12px; background:var(--surface-2); padding:1px 4px; border-radius:3px' })(['send()']),
        ' API.',
      ]),

      // ── Status bar ────────────────────────────────────────────────────
      div({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap' })([
        span({ style: 'font-size:12px; color:var(--text-muted)' })(['Status:']),
        Badge({ variant: STATUS_VARIANT[status] ?? 'gray' })([status]),
        ...(status === 'reconnecting' ? [Badge({ variant: 'yellow' })([`retry ${retries}`])] : []),
        div({ style: 'flex:1' })([]),
        ...(status === 'closed' || status === 'failed'
          ? [button({ type: 'button', className: 'btn btn-primary btn-sm', onclick: _connect })(['Connect'])]
          : [button({ type: 'button', className: 'btn btn-secondary btn-sm', onclick: _disconnect })(['Disconnect'])]),
      ]),

      // ── Message log ───────────────────────────────────────────────────
      div({
        style: 'height:220px; overflow-y:auto; font-family:monospace; font-size:12px; ' +
               'background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); ' +
               'padding:8px 10px; display:flex; flex-direction:column-reverse; gap:2px',
      })(
        msgs.length
          ? msgs.map(m =>
              div({ style: 'white-space:pre-wrap; word-break:break-all' })([
                span({ style: 'color:var(--text-subtle); margin-right:6px; flex-shrink:0' })([m.ts]),
                span({ style: m.type === 'sent'  ? 'color:var(--accent)'
                             : m.type === 'recv'  ? 'color:var(--success, #28a745)'
                             : m.type === 'error' ? 'color:var(--danger)'
                             :                      'color:var(--text-muted)' })([
                  m.type === 'sent' ? '→ ' : m.type === 'recv' ? '← ' : '  ',
                  m.text,
                ]),
              ])
            )
          : [span({ style: 'color:var(--text-muted); font-style:italic; text-align:center; margin:auto' })(['Not connected. Click Connect.'])]
      ),

      // ── Send input ────────────────────────────────────────────────────
      div({ style: 'display:flex; gap:8px; margin-top:10px' })([
        input({
          id:          'ws-draft',
          type:        'text',
          value:       draft,
          placeholder: 'Type a message…',
          disabled:    status !== 'open',
          className:   'input',
          style:       'flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg); color:var(--text); font-size:13px',
          oninput:     e => setState(s => ({ wsDemo: { ...s.wsDemo, draft: e.target.value } })),
          onkeydown:   e => { if (e.key === 'Enter') sendDraft(); },
        })([]),
        button({
          type:      'button',
          className: 'btn btn-primary btn-sm',
          disabled:  status !== 'open' || !draft.trim(),
          onclick:   sendDraft,
        })(['Send']),
        button({
          type:      'button',
          className: 'btn btn-ghost btn-sm',
          onclick:   () => setState(s => ({ wsDemo: { ...s.wsDemo, messages: [] } })),
        })(['Clear']),
      ]),

      // ── JSON send example ─────────────────────────────────────────────
      div({ style: 'margin-top:10px; display:flex; gap:8px; flex-wrap:wrap' })([
        span({ style: 'font-size:12px; color:var(--text-muted); align-self:center' })(['Send JSON:']),
        ...[
          { type: 'ping', payload: 'hello' },
          { type: 'subscribe', channel: 'prices' },
        ].map(obj =>
          button({
            type:      'button',
            className: 'btn btn-secondary btn-sm',
            disabled:  status !== 'open',
            onclick:   () => _send(obj),
          })([JSON.stringify(obj)])
        ),
      ]),
    ]),

    Card({ title: 'Usage' })([
      doc([`// Create once — outside the view function
const ws = createWS({
  url:        'wss://api.example.com/live',
  reconnect:  true,
  maxRetries: 5,
  baseDelay:  1000,  // doubles each attempt: 1s, 2s, 4s, 8s, 16s → capped at 30s
})({
  onOpen:      ()    => setState({ wsStatus: 'open' }),
  onClose:     code  => setState({ wsStatus: 'closed' }),
  onError:     err   => setState({ wsError: err.message }),
  onMessage:   data  => setState(s => ({ feed: [data, ...s.feed] })),
  onReconnect: n     => setState({ wsRetries: n }),
  onGiveUp:    ()    => setState({ wsStatus: 'failed' }),
});

// Send a plain string or any object (auto JSON.stringify)
ws.send('ping');
ws.send({ type: 'subscribe', channel: 'prices' });

// Clean close
ws.close();      // code 1000
ws.close(4000, 'logout');

// Hard stop (also cancels any pending reconnect)
ws.destroy();

// Current readyState as a string
ws.status();     // 'connecting' | 'open' | 'closing' | 'closed'`
      ]),
    ]),
  ]);
};
