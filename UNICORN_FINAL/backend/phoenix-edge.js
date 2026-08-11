#!/usr/bin/env node
'use strict';

/**
 * Phoenix Continuity OS — Immortality Edge (PCOS/1.0)
 * ---------------------------------------------------
 * Tiny ALWAYS-ON HTTP witness that does NOT share the backend/site event
 * loop. When the heavy brain freezes (accept-but-hang), this process still:
 *   1. Answers /phoenix/live + /health/live with { frozen:true|false }
 *   2. Proxies /api/health + /api/catalog with a short timeout
 *   3. On brain timeout, serves Last-Known-Good (LKG) JSON so the public
 *      never sees nginx "0 bytes" for the money-critical surfaces
 *
 * This is the innovation the domain was missing: healers restart the brain,
 * but commerce continuity is owned by a process that cannot load UEE/IAK/PCL.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const hb = require('./lib/phoenix-heartbeat');

const PROTOCOL = 'PCOS/1.0';
const PORT = Number(process.env.PHOENIX_PORT || 3002);
const BIND = process.env.PHOENIX_BIND || '127.0.0.1';
const BRAIN = process.env.PHOENIX_BRAIN_ORIGIN || 'http://127.0.0.1:3000';
const PROXY_TIMEOUT_MS = Math.max(500, Number(process.env.PHOENIX_PROXY_TIMEOUT_MS || 2500));
const LKG_DIR = process.env.PHOENIX_LKG_DIR
  || path.join(process.cwd(), 'data', 'phoenix', 'lkg');
const BACKEND_ROLE = process.env.PHOENIX_BACKEND_ROLE || 'backend';
const SITE_ROLE = process.env.PHOENIX_SITE_ROLE || 'site';

try { fs.mkdirSync(LKG_DIR, { recursive: true }); } catch (_) { /* best-effort */ }

const LKG_KEYS = {
  health: 'api-health.json',
  catalog: 'api-catalog.json',
};

function lkgPath(key) {
  return path.join(LKG_DIR, LKG_KEYS[key] || `${key}.json`);
}

function saveLkg(key, body, code) {
  try {
    fs.writeFileSync(lkgPath(key), JSON.stringify({
      savedAt: new Date().toISOString(),
      code: code || 200,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
  } catch (_) { /* best-effort */ }
}

function loadLkg(key) {
  try {
    const j = JSON.parse(fs.readFileSync(lkgPath(key), 'utf8'));
    return j && j.body ? j : null;
  } catch (_) {
    return null;
  }
}

function json(res, code, obj, headers) {
  const body = JSON.stringify(obj);
  const h = Object.assign({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-phoenix': PROTOCOL,
    'content-length': Buffer.byteLength(body),
  }, headers || {});
  res.writeHead(code, h);
  res.end(body);
}

function proxyGet(urlPath, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    let u;
    try { u = new URL(urlPath, BRAIN); } catch (e) {
      return finish({ ok: false, error: String(e && e.message || e), code: 0, body: '' });
    }
    const req = http.get({
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ''),
      timeout: timeoutMs,
      headers: { accept: 'application/json', 'user-agent': `phoenix-edge/${PROTOCOL}` },
    }, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        finish({
          ok: r.statusCode >= 200 && r.statusCode < 400,
          code: r.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('timeout', () => { req.destroy(); finish({ ok: false, error: 'timeout', code: 0, body: '' }); });
    req.on('error', (e) => finish({ ok: false, error: String(e && e.message || e), code: 0, body: '' }));
  });
}

function statusEnvelope() {
  const backend = hb.readBeat(hb.resolveHbPath(BACKEND_ROLE));
  const site = hb.readBeat(hb.resolveHbPath(SITE_ROLE));
  const anyFrozen = !!(backend.frozen || site.frozen);
  return {
    ok: true,
    protocol: PROTOCOL,
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    frozen: anyFrozen,
    brain: {
      backend: {
        frozen: !!backend.frozen,
        ageMs: Number.isFinite(backend.ageMs) ? backend.ageMs : null,
        pid: backend.pid || null,
        missing: !!backend.missing,
      },
      site: {
        frozen: !!site.frozen,
        ageMs: Number.isFinite(site.ageMs) ? site.ageMs : null,
        pid: site.pid || null,
        missing: !!site.missing,
      },
    },
    lkg: {
      health: !!loadLkg('health'),
      catalog: !!loadLkg('catalog'),
    },
    timestamp: new Date().toISOString(),
  };
}

async function handleCommerce(key, brainPath, res) {
  const probe = await proxyGet(brainPath, PROXY_TIMEOUT_MS);
  if (probe.ok && probe.body) {
    saveLkg(key, probe.body, probe.code);
    res.writeHead(probe.code || 200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-phoenix': 'live',
      'content-length': Buffer.byteLength(probe.body),
    });
    res.end(probe.body);
    return;
  }
  const lkg = loadLkg(key);
  if (lkg && lkg.body) {
    json(res, 200, (() => {
      try { return JSON.parse(lkg.body); } catch (_) { return { ok: true, lkg: true, raw: lkg.body }; }
    })(), {
      'x-phoenix': 'lkg',
      'x-phoenix-reason': probe.error || 'brain_unreachable',
      'x-phoenix-saved-at': lkg.savedAt || '',
    });
    return;
  }
  // No LKG yet — still answer (never 0-byte hang) with an honest degraded envelope.
  const st = statusEnvelope();
  json(res, 503, {
    ok: false,
    degraded: true,
    protocol: PROTOCOL,
    error: 'brain_unreachable_no_lkg',
    reason: probe.error || 'timeout',
    frozen: st.frozen,
    brain: st.brain,
  }, { 'x-phoenix': 'degraded' });
}

const server = http.createServer(async (req, res) => {
  const url = String((req.url || '/').split('?')[0]);

  if (url === '/phoenix/live' || url === '/health/live' || url === '/phoenix/status') {
    const st = statusEnvelope();
    // ALWAYS 200 — immortality contract. `frozen` tells the truth.
    return json(res, 200, st);
  }

  if (url === '/api/health' || url === '/phoenix/api/health') {
    return handleCommerce('health', '/api/health', res);
  }

  if (url === '/api/catalog' || url === '/phoenix/api/catalog') {
    return handleCommerce('catalog', '/api/catalog', res);
  }

  if (url === '/' || url === '/phoenix') {
    return json(res, 200, {
      ok: true,
      service: 'unicorn-phoenix',
      protocol: PROTOCOL,
      endpoints: ['/phoenix/live', '/phoenix/status', '/api/health', '/api/catalog'],
    });
  }

  return json(res, 404, { ok: false, error: 'not_found', protocol: PROTOCOL });
});

server.keepAliveTimeout = 5000;
server.headersTimeout = 8000;

server.listen(PORT, BIND, () => {
  // eslint-disable-next-line no-console
  console.log(`[phoenix-edge] ${PROTOCOL} listening on ${BIND}:${PORT} brain=${BRAIN}`);
});

function shutdown(sig) {
  // eslint-disable-next-line no-console
  console.log(`[phoenix-edge] ${sig} — closing`);
  try { server.close(() => process.exit(0)); } catch (_) { process.exit(0); }
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { PROTOCOL, statusEnvelope, proxyGet, saveLkg, loadLkg };
