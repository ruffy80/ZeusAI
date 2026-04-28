// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/viral-feed-sse.js
//
// Server-Sent Events stream that broadcasts marketing-pack events
// (winners, publishes, conversions) to subscribed clients. Other sub-
// engines call `emit(eventType, payload)` to fan out to all clients.
// =====================================================================

'use strict';

const DISABLED = process.env.MARKETING_VIRAL_FEED_DISABLED === '1';

const _clients = new Set();

function _now() { return new Date().toISOString(); }

function attach(req, res) {
  if (DISABLED) {
    if (res && !res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('viral-feed disabled');
    }
    return null;
  }
  if (!res || res.headersSent) return null;
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ ts: _now(), clients: _clients.size + 1 })}\n\n`);
  } catch (_) { return null; }

  const client = { res, openedAt: Date.now() };
  _clients.add(client);
  const ka = setInterval(() => {
    try { res.write(`event: ping\ndata: ${JSON.stringify({ ts: _now() })}\n\n`); } catch (_) {}
  }, 25_000);
  if (ka && typeof ka.unref === 'function') ka.unref();

  const onClose = () => { clearInterval(ka); _clients.delete(client); try { res.end(); } catch (_) {} };
  req.on('close', onClose);
  req.on('error', onClose);
  return client;
}

function emit(eventType, payload) {
  if (DISABLED) return 0;
  let n = 0;
  const data = JSON.stringify({ ts: _now(), type: String(eventType || 'event'), payload: payload || {} });
  for (const c of _clients) {
    try { c.res.write(`event: ${String(eventType || 'event').replace(/\W/g, '_')}\ndata: ${data}\n\n`); n += 1; }
    catch (_) { _clients.delete(c); }
  }
  return n;
}

function status() {
  return { disabled: DISABLED, subscribers: _clients.size };
}
function _resetForTests() { _clients.clear(); }

module.exports = { attach, emit, status, _resetForTests };
