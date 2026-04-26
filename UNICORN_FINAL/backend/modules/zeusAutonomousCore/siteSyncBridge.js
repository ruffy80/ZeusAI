// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:59.248Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SiteSyncBridge — keeps the live site (zeusai.pro) in lock-step with the
 * unicorn backend. Provides a WebSocket broadcast channel + REST fallback.
 *
 * Design:
 * - ZAC polls the backend's catalog/snapshot endpoints (~5s interval).
 * - Pushes deltas to all connected WebSocket clients.
 * - If backend goes silent, serves last good snapshot as fallback.
 *
 * Runs as part of the ZAC process. The site's frontend can connect to:
 *   ws://<host>:<port>/zac-stream
 * and will receive JSON frames: { type: 'snapshot'|'delta'|'heartbeat', data, ts }.
 */
const http = require('http');

let WebSocketServer = null;
try { ({ Server: WebSocketServer } = require('ws')); }
catch { /* ws not installed — fallback HTTP-only mode */ }

function fetchJSON(url, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try { resolve({ ok: true, data: JSON.parse(buf) }); }
        catch (e) { resolve({ ok: false, error: 'parse:' + e.message }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

function createSiteSyncBridge({
  port = parseInt(process.env.ZAC_BRIDGE_PORT || '4444', 10),
  backendBase = process.env.ZAC_BACKEND_BASE || 'http://127.0.0.1:3000',
  pollMs = 5000,
  heartbeatMs = 15000,
} = {}) {
  let server = null;
  let wss = null;
  let pollTimer = null;
  let heartbeatTimer = null;
  let lastSnapshot = null;
  let lastUpdate = null;
  const clients = new Set();
  const stats = { polls: 0, broadcasts: 0, errors: 0, connections: 0 };

  function broadcast(frame) {
    const payload = JSON.stringify(frame);
    stats.broadcasts += 1;
    for (const ws of clients) {
      try { ws.send(payload); } catch (_) { /* ignore */ }
    }
  }

  async function pollBackend() {
    stats.polls += 1;
    const endpoints = ['/snapshot', '/api/catalog/master', '/api/billion-scale/activation/status'];
    const out = {};
    for (const ep of endpoints) {
      const r = await fetchJSON(backendBase + ep);
      if (r.ok) out[ep] = r.data;
      else stats.errors += 1;
    }
    if (Object.keys(out).length === 0) return;
    const snapshot = { ts: new Date().toISOString(), endpoints: out };
    const isDelta = lastSnapshot && JSON.stringify(snapshot.endpoints) !== JSON.stringify(lastSnapshot.endpoints);
    lastSnapshot = snapshot;
    lastUpdate = snapshot.ts;
    broadcast({ type: isDelta ? 'delta' : 'snapshot', data: snapshot, ts: snapshot.ts });
  }

  function start() {
    if (server) return;
    server = http.createServer((req, res) => {
      // REST fallback for clients that can't use WebSocket
      if (req.url === '/zac-snapshot' || req.url === '/snapshot') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, snapshot: lastSnapshot, lastUpdate }));
        return;
      }
      if (req.url === '/zac-health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...stats, hasSnapshot: !!lastSnapshot }));
        return;
      }
      res.writeHead(404); res.end('not found');
    });

    if (WebSocketServer) {
      wss = new WebSocketServer({ server, path: '/zac-stream' });
      wss.on('connection', (ws) => {
        clients.add(ws);
        stats.connections += 1;
        if (lastSnapshot) {
          try { ws.send(JSON.stringify({ type: 'snapshot', data: lastSnapshot, ts: lastSnapshot.ts })); } catch (_) {}
        }
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
      });
    }

    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[ZAC/Bridge] Listening on :${port} (ws=${!!WebSocketServer})`);
    });
    server.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.warn('[ZAC/Bridge] HTTP error:', e.message);
    });

    pollTimer = setInterval(() => { pollBackend().catch(() => {}); }, pollMs);
    if (typeof pollTimer.unref === 'function') pollTimer.unref();
    heartbeatTimer = setInterval(() => {
      broadcast({ type: 'heartbeat', ts: new Date().toISOString(), clients: clients.size });
    }, heartbeatMs);
    if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

    pollBackend().catch(() => {});
  }

  function stop() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (wss) { try { wss.close(); } catch (_) {} wss = null; }
    if (server) { try { server.close(); } catch (_) {} server = null; }
    clients.clear();
  }

  function getStatus() {
    return {
      running: !!server,
      port,
      backendBase,
      wsEnabled: !!WebSocketServer,
      clients: clients.size,
      lastUpdate,
      hasSnapshot: !!lastSnapshot,
      stats,
    };
  }

  return { start, stop, broadcast, pollBackend, getStatus };
}

module.exports = { createSiteSyncBridge };
