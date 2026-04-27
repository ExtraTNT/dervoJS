/**
 * dervoJS — WebSocket factory
 *
 * Pure-functional, curried WebSocket API. A single call to createWS returns
 * a controller; all handlers are plain callbacks, all state lives outside
 * (typically in your dervo store). Zero framework coupling.
 *
 * Design principles:
 *   - Curried factory:  createWS(opts)(handlers)
 *   - No implicit state — status/messages must be tracked by the caller
 *   - destroy() is always safe to call (idempotent, no-ops on closed socket)
 *   - Reconnect is opt-in, capped by maxRetries, with exponential back-off
 *   - send() is typed: plain strings AND objects (→ JSON.stringify)
 *   - onMessage delivers the parsed JSON value when the frame is valid JSON,
 *     or the raw string otherwise
 *
 * @example
 *   const ws = createWS({ url: 'wss://api.example.com/live' })({
 *     onOpen:    ()    => setState({ wsStatus: 'open' }),
 *     onClose:   code  => setState({ wsStatus: 'closed', wsCode: code }),
 *     onError:   err   => setState({ wsError: err.message }),
 *     onMessage: data  => setState(s => ({ messages: [data, ...s.messages] })),
 *   });
 *
 *   ws.send({ type: 'subscribe', channel: 'prices' });
 *   ws.close();   // clean close
 *   ws.destroy(); // hard close, cancel any pending reconnect
 *
 * @example
 *   // With auto-reconnect
 *   const ws = createWS({
 *     url:        'wss://api.example.com/events',
 *     reconnect:  true,
 *     maxRetries: 10,
 *     baseDelay:  500,   // ms — doubles each attempt, capped at 30 s
 *   })({
 *     onOpen:       ()   => setState({ wsStatus: 'open', wsRetries: 0 }),
 *     onClose:      code => setState({ wsStatus: code === 1000 ? 'closed' : 'reconnecting' }),
 *     onReconnect:  n    => setState({ wsRetries: n }),
 *     onGiveUp:     ()   => setState({ wsStatus: 'failed' }),
 *     onMessage:    data => setState(s => ({ feed: [data, ...s.feed] })),
 *   });
 */

/**
 * Curried WebSocket factory.
 *
 * @param {Object}  opts
 * @param {string}  opts.url              WebSocket endpoint (ws:// or wss://)
 * @param {string|string[]} [opts.protocols]  Sub-protocol(s) forwarded to the WS constructor
 * @param {boolean} [opts.reconnect=false]   Auto-reconnect on unexpected close
 * @param {number}  [opts.maxRetries=5]      Give up after this many consecutive failed attempts
 * @param {number}  [opts.baseDelay=1000]    Initial back-off delay in ms; doubles each retry
 * @param {number}  [opts.maxDelay=30000]    Back-off ceiling in ms
 *
 * @returns {(handlers: Handlers) => Controller}
 *
 * @typedef {Object} Handlers
 * @property {() => void}     [onOpen]       Socket opened and ready
 * @property {(code: number) => void} [onClose] Socket closed; code = WebSocket close code
 * @property {(err: Event) => void}   [onError] Transport error
 * @property {(data: any) => void}    [onMessage] Parsed message (JSON decoded when possible)
 * @property {(attempt: number) => void} [onReconnect] About to reconnect; attempt = 1-based count
 * @property {() => void}              [onGiveUp]   Gave up after maxRetries
 *
 * @typedef {Object} Controller
 * @property {(data: string|Object) => void} send   Send a message; objects are JSON.stringify'd
 * @property {(code?: number) => void} close  Clean close (default code 1000)
 * @property {() => void}  destroy  Hard close + cancel reconnect (idempotent)
 * @property {() => 'connecting'|'open'|'closing'|'closed'} status  Current WebSocket readyState label
 */
const createWS = ({
  url,
  protocols,
  reconnect   = false,
  maxRetries  = 5,
  baseDelay   = 1000,
  maxDelay    = 30000,
} = {}) => (handlers = {}) => {
  const {
    onOpen      = () => {},
    onClose     = () => {},
    onError     = () => {},
    onMessage   = () => {},
    onReconnect = () => {},
    onGiveUp    = () => {},
  } = handlers;

  let socket      = null;
  let destroyed   = false;
  let retries     = 0;
  let retryTimer  = null;

  const LABELS = ['connecting', 'open', 'closing', 'closed'];
  const status  = () => socket ? LABELS[socket.readyState] ?? 'closed' : 'closed';

  const _cancelRetry = () => { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } };

  const _connect = () => {
    if (destroyed) return;
    socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);

    socket.onopen = () => {
      if (destroyed) { socket.close(1000); return; }
      retries = 0;
      onOpen();
    };

    socket.onmessage = evt => {
      if (destroyed) return;
      let data = evt.data;
      try { data = JSON.parse(evt.data); } catch (_) {}
      onMessage(data);
    };

    socket.onerror = err => { if (!destroyed) onError(err); };

    socket.onclose = evt => {
      if (destroyed) { onClose(evt.code); return; }
      onClose(evt.code);
      // Clean close or explicit destroy → don't reconnect
      if (!reconnect || evt.code === 1000) return;
      if (retries >= maxRetries) { onGiveUp(); return; }
      retries++;
      const delay = Math.min(baseDelay * 2 ** (retries - 1), maxDelay);
      onReconnect(retries);
      retryTimer = setTimeout(_connect, delay);
    };
  };

  const send = data => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(typeof data === 'string' ? data : JSON.stringify(data));
  };

  const close = (code = 1000) => {
    _cancelRetry();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(code);
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    _cancelRetry();
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000);
  };

  _connect();
  return { send, close, destroy, status };
};

export { createWS };
