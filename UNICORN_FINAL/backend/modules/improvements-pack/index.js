// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.386Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/index.js — single-call dispatcher (raw http) +
// helper exports for Express integration.
//
// Wired in `src/index.js` (raw http server) with one line + try/catch,
// exactly like innovations-50y. Disabled via IMPROVEMENTS_PACK_DISABLED=1.
//
// Routes (all NEW, none collide with existing):
//   GET  /internal/health/aggregate
//   POST /api/csp-report     (also /csp-violations for legacy CSP)
//   GET  /api/owner/revenue          (JSON, requires AUDIT_50Y_TOKEN)
//   GET  /api/owner/revenue.csv      (CSV,  requires AUDIT_50Y_TOKEN)
//   GET  /api/funnel/summary
//   POST /api/funnel/track           (body: {stage, productId?, sessionId?})
// =====================================================================

'use strict';

const internalHealth = require('./internal-health');
const cspReport = require('./csp-report');
const funnel = require('./funnel-tracker');
const revenue = require('./revenue-dashboard');
const webhookIdem = require('./webhook-idempotency');
const snapshotCache = require('./snapshot-cache');
const ipLimit = require('./rate-limit-ip');
const tenantKeyRotation = require('./tenant-key-rotation');

const DISABLED = process.env.IMPROVEMENTS_PACK_DISABLED === '1';

function _send(res, status, payload, headers) {
  if (res.headersSent) return;
  const body = (typeof payload === 'string') ? payload : JSON.stringify(payload, null, 2);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Improvements-Pack': '1.0.0'
  }, headers || {}));
  res.end(body);
}

function _readBody(req, max) {
  return new Promise((resolve, reject) => {
    const limit = Number(max) || 32768;
    let len = 0;
    const chunks = [];
    req.on('data', (c) => {
      len += c.length;
      if (len > limit) { reject(new Error('payload_too_large')); try { req.destroy(); } catch (_) {} return; }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(Buffer.concat(chunks).toString('utf8')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function _ownerOk(req) {
  const required = process.env.AUDIT_50Y_TOKEN || process.env.OWNER_DASHBOARD_TOKEN || '';
  if (!required) return false; // require explicit token to expose financials
  const tok = (req.headers && (req.headers['x-owner-token'] || req.headers['authorization'] || ''));
  const provided = String(tok).replace(/^Bearer\s+/i, '');
  return provided === required;
}

async function handle(req, res, _ctx) {
  if (DISABLED) return false;
  if (!req || !req.url) return false;

  let urlPath, params;
  try {
    const u = new URL(req.url, 'http://local');
    urlPath = u.pathname;
    params = u.searchParams;
  } catch (_) { return false; }

  // CSP report (delegates to its own handler)
  if (await cspReport.handle(req, res)) return true;

  // Internal aggregated health
  if (urlPath === '/internal/health/aggregate' && (req.method === 'GET' || req.method === 'HEAD')) {
    _send(res, 200, internalHealth.buildHealth());
    return true;
  }

  // Funnel summary
  if (urlPath === '/api/funnel/summary' && req.method === 'GET') {
    const sinceMs = Number(params.get('sinceMs')) || 0;
    _send(res, 200, funnel.summary({ sinceMs }));
    return true;
  }
  if (urlPath === '/api/funnel/track' && req.method === 'POST') {
    try {
      const raw = await _readBody(req, 8192);
      let body = {}; if (raw) try { body = JSON.parse(raw); } catch (_) {}
      const r = funnel.track(body && body.stage, body || {});
      _send(res, r.ok ? 200 : 400, r);
    } catch (e) { _send(res, 500, { error: 'funnel_track_failed', message: e && e.message }); }
    return true;
  }

  // Owner revenue dashboard (token-gated)
  if (urlPath === '/api/owner/revenue' && req.method === 'GET') {
    if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
    const sinceMs = Number(params.get('sinceMs')) || 0;
    _send(res, 200, revenue.buildSummary({ sinceMs }));
    return true;
  }
  if (urlPath === '/api/owner/revenue.csv' && req.method === 'GET') {
    if (!_ownerOk(req)) { _send(res, 401, { error: 'unauthorized' }); return true; }
    const sinceMs = Number(params.get('sinceMs')) || 0;
    const csv = revenue.toCsv(revenue.buildSummary({ sinceMs }));
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="revenue.csv"',
      'X-Improvements-Pack': '1.0.0'
    });
    res.end(csv);
    return true;
  }

  return false;
}

module.exports = {
  handle,
  // Sub-modules (also useful for direct require in tests/Express wiring)
  internalHealth,
  cspReport,
  funnel,
  revenue,
  webhookIdem,
  snapshotCache,
  ipLimit,
  tenantKeyRotation,
  DISABLED
};
