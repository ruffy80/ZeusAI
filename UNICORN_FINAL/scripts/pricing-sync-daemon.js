#!/usr/bin/env node
// ============================================================================
// Pricing Sync Daemon · ZeusAI / Unicorn
// ----------------------------------------------------------------------------
// Continuously watches the Unicorn dynamic-pricing engine to guarantee:
//   1. /api/pricing/live (and its SSE stream) is always reachable.
//   2. Price changes are detected within 1 second (SSE subscriber) and
//      mirrored to a local JSON snapshot that any process can read.
//   3. Any API error / timeout / data-shape regression is logged and the
//      subscription is auto-retried with exponential backoff (max 30s).
//
// Exposes a tiny HTTP control surface on :9099:
//   GET /sync/health   → {ok, lastUpdateTs, ageMs, services, errors, btcRate}
//   GET /sync/snapshot → last cached snapshot (same shape as /api/pricing/live)
//   GET /sync/errors   → ring-buffer of the last 50 errors (with timestamps)
//
// Designed to run as a systemd unit on Hetzner (see deploy/zeus-pricing-sync.service).
// Plain Node, zero deps, Node 20+ (uses global fetch + EventSource via undici? no:
// we hand-roll a minimal SSE parser over http to avoid any dep at all).
// ============================================================================

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL } = require('url');

const UPSTREAM     = process.env.UNICORN_UPSTREAM   || 'http://127.0.0.1:8080';
const PORT         = Number(process.env.SYNC_PORT)  || 9099;
const SNAPSHOT_TTL = Number(process.env.SNAPSHOT_TTL_MS) || 10_000;   // alert if no update for this long
const POLL_MS      = Number(process.env.POLL_MS)    || 5_000;         // fallback poll cadence
const LOG_FILE     = process.env.SYNC_LOG          || path.join(__dirname, '..', 'logs', 'pricing-sync.log');
const SNAP_FILE    = process.env.SYNC_SNAP         || path.join(__dirname, '..', 'logs', 'pricing-sync.snapshot.json');

const STATE = {
  snapshot:      null,
  lastUpdateTs:  0,
  sseConnected:  false,
  pollFallback:  false,
  errors:        [],     // ring buffer
  totalUpdates:  0,
  totalErrors:   0,
  startedAt:     Date.now(),
};

// ---------- logging ----------------------------------------------------------
try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch (_) {}
function log(level, msg, meta) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta || {}) });
  // stdout for journalctl
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
  if (level === 'error' || level === 'warn') {
    STATE.errors.unshift({ ts: Date.now(), level, msg, ...(meta || {}) });
    if (STATE.errors.length > 50) STATE.errors.length = 50;
    STATE.totalErrors++;
  }
}

// ---------- snapshot helpers ------------------------------------------------
function applySnapshot(snap) {
  if (!snap || typeof snap !== 'object') {
    log('warn', 'snapshot rejected: wrong shape', { type: typeof snap });
    return;
  }
  STATE.snapshot     = snap;
  STATE.lastUpdateTs = Date.now();
  STATE.totalUpdates++;
  // Persist for any other process that needs a recent snapshot without
  // touching the API (e.g. PM2 child, deployment health check).
  try { fs.writeFileSync(SNAP_FILE, JSON.stringify({ ts: STATE.lastUpdateTs, snapshot: snap })); } catch (e) {
    log('warn', 'snapshot persist failed', { err: e.message });
  }
}

// ---------- SSE subscriber --------------------------------------------------
let sseAbort = null;
let sseBackoffMs = 1_000;

function subscribeSSE() {
  const url = new URL('/api/pricing/live/stream', UPSTREAM);
  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request({
    method:  'GET',
    hostname: url.hostname,
    port:     url.port || (url.protocol === 'https:' ? 443 : 80),
    path:     url.pathname + url.search,
    headers:  { 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' },
    timeout:  60_000,
  }, (res) => {
    if (res.statusCode !== 200) {
      log('warn', 'SSE non-200', { status: res.statusCode });
      res.resume();
      scheduleReconnect();
      return;
    }
    log('info', 'SSE connected', { url: url.href });
    STATE.sseConnected = true;
    STATE.pollFallback = false;
    sseBackoffMs = 1_000;

    let buf = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        // Parse event/data lines per SSE spec
        let event = 'message';
        const data = [];
        block.split('\n').forEach((ln) => {
          if (ln.startsWith('event:')) event = ln.slice(6).trim();
          else if (ln.startsWith('data:')) data.push(ln.slice(5).trim());
        });
        if (event === 'pricing' && data.length) {
          try {
            const json = JSON.parse(data.join('\n'));
            applySnapshot(json);
          } catch (e) {
            log('warn', 'SSE parse failed', { err: e.message });
          }
        }
      }
    });
    res.on('end',   () => { STATE.sseConnected = false; log('warn', 'SSE ended'); scheduleReconnect(); });
    res.on('error', (e) => { STATE.sseConnected = false; log('error', 'SSE stream error', { err: e.message }); scheduleReconnect(); });
  });
  req.on('error',   (e) => { log('error', 'SSE connect error', { err: e.message }); scheduleReconnect(); });
  req.on('timeout', () => { log('warn', 'SSE timeout'); try { req.destroy(); } catch (_) {} });
  req.end();
  sseAbort = () => { try { req.destroy(); } catch (_) {} };
}

function scheduleReconnect() {
  STATE.sseConnected = false;
  const delay = sseBackoffMs;
  sseBackoffMs = Math.min(sseBackoffMs * 2, 30_000);
  log('info', 'SSE reconnect scheduled', { delayMs: delay });
  setTimeout(subscribeSSE, delay);
}

// ---------- Fallback poller --------------------------------------------------
async function pollOnce() {
  const url = new URL('/api/pricing/live', UPSTREAM);
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 4_000);
    const r = await fetch(url.href, { signal: ctl.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(to);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    applySnapshot(j);
    if (!STATE.sseConnected) STATE.pollFallback = true;
  } catch (e) {
    log('warn', 'poll failed', { err: e.message });
  }
}

setInterval(() => {
  // If SSE is healthy and recent, skip poll. Otherwise poll as a safety net.
  const age = Date.now() - STATE.lastUpdateTs;
  if (!STATE.sseConnected || age > SNAPSHOT_TTL) pollOnce();
}, POLL_MS);

// ---------- HTTP control surface --------------------------------------------
const server = http.createServer((req, res) => {
  const u = req.url || '/';
  if (u === '/sync/health') {
    const age = STATE.lastUpdateTs ? Date.now() - STATE.lastUpdateTs : null;
    const ok  = STATE.lastUpdateTs > 0 && age != null && age < SNAPSHOT_TTL * 3;
    res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      ok,
      upstream:      UPSTREAM,
      sseConnected:  STATE.sseConnected,
      pollFallback:  STATE.pollFallback,
      lastUpdateTs:  STATE.lastUpdateTs || null,
      ageMs:         age,
      services:      STATE.snapshot ? Object.keys(STATE.snapshot.prices || STATE.snapshot.items || {}).length : 0,
      btcRate:       STATE.snapshot && STATE.snapshot.btcRate ? (STATE.snapshot.btcRate.rate || STATE.snapshot.btcRate) : null,
      totalUpdates:  STATE.totalUpdates,
      totalErrors:   STATE.totalErrors,
      uptimeSec:     Math.floor((Date.now() - STATE.startedAt) / 1000),
    }));
  }
  if (u === '/sync/snapshot') {
    res.writeHead(STATE.snapshot ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(STATE.snapshot || { error: 'no snapshot yet' }));
  }
  if (u === '/sync/errors') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ count: STATE.errors.length, errors: STATE.errors }));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => {
  log('info', 'pricing-sync-daemon listening', { port: PORT, upstream: UPSTREAM });
  subscribeSSE();
  pollOnce(); // immediate first snapshot
});

// ---------- Graceful shutdown -----------------------------------------------
function shutdown(sig) {
  log('info', 'shutdown', { sig });
  try { sseAbort && sseAbort(); } catch (_) {}
  try { server.close(() => process.exit(0)); } catch (_) { process.exit(0); }
  setTimeout(() => process.exit(0), 3_000).unref();
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException',  (e) => log('error', 'uncaughtException',  { err: e.message, stack: e.stack }));
process.on('unhandledRejection', (e) => log('error', 'unhandledRejection', { err: (e && e.message) || String(e) }));
