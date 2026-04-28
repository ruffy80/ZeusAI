// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.363Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * innovations-50y/index.js — Single-call dispatcher for all 50Y modules.
 *
 * Exposes a `handle(req, res, ctx)` function that returns `true` when a
 * request was served, otherwise `false`. Designed to be wired into the
 * existing src/index.js + backend/index.js dispatch chains with ONE line
 * each, inside try/catch, exactly like the existing innov30 / sovereign
 * dispatchers.
 *
 * All routes live under NEW namespaces — none collide with existing
 * endpoints:
 *   GET  /.well-known/did.json
 *   GET  /api/v50/status
 *   GET  /api/v50/schemas
 *   GET  /api/v50/schemas/:id
 *   GET  /api/v50/sbom/cyclonedx
 *   GET  /api/v50/audit/recent[?limit=N]
 *   GET  /api/v50/audit/proof?id=N
 *   GET  /api/v50/audit/root
 *   POST /api/v50/audit/append   (body: JSON; gated by AUDIT_50Y_TOKEN if set)
 *   GET  /api/v50/otel/status
 *   GET  /api/v50/otel/recent[?limit=N]
 *   GET  /api/v50/crypto/status
 *   GET  /api/v50/manifest/root
 *   POST /api/v50/manifest/build
 *   GET  /api/v50/insight/ask?q=...
 *
 * Adds an `X-Schema-Version` header to every response it serves.
 *
 * If the env var `UNICORN_50Y_DISABLED=1` is set, the handler short-circuits
 * to `false` so existing behaviour is unchanged.
 */

'use strict';

const cryptoAgility = require('./crypto-agility');
const audit = require('./tamper-evident-audit');
const otel = require('./otel-tracer');
const sbom = require('./sbom-cyclonedx');
const did = require('./did-web');
const schemas = require('./schema-registry');
const insight = require('./insight-rag');
const manifest = require('./manifest-merkle');

const DISABLED = process.env.UNICORN_50Y_DISABLED === '1';

function _send(res, status, payload, extraHeaders) {
  if (res.headersSent) return;
  const body = (typeof payload === 'string') ? payload : JSON.stringify(payload, null, 2);
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Schema-Version': schemas.bundleHeader(),
    'X-50Y-Pillar': 'permanence'
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

function _readBody(req, max) {
  return new Promise((resolve, reject) => {
    const limit = Number(max) || 65536;
    let len = 0;
    const chunks = [];
    req.on('data', (c) => {
      len += c.length;
      if (len > limit) { reject(new Error('payload_too_large')); try { req.destroy(); } catch (_) {} return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(Buffer.concat(chunks).toString('utf8')); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
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

  // DID:web identity
  if (urlPath === '/.well-known/did.json' && (req.method === 'GET' || req.method === 'HEAD')) {
    const host = (req.headers && req.headers.host) || process.env.UNICORN_DID_HOST || '';
    const doc = did.buildDidDocument(host);
    _send(res, 200, doc, { 'Content-Type': 'application/did+json; charset=utf-8' });
    return true;
  }

  // All v50 routes
  if (!urlPath.startsWith('/api/v50/') && urlPath !== '/api/v50') return false;

  // Top-level status (aggregated)
  if (urlPath === '/api/v50/status' || urlPath === '/api/v50') {
    _send(res, 200, {
      version: '50Y-Standard · v1.0.0',
      generatedAt: new Date().toISOString(),
      pillars: {
        permanence: { sbom: true, schemas: schemas.status(), manifest: manifest.status() },
        security:   { crypto: cryptoAgility.status(), audit: audit.root() },
        sovereignty:{ did: did.status() },
        intelligence:{ otel: otel.status(), insight: insight.status() }
      }
    });
    return true;
  }

  // Schemas
  if (urlPath === '/api/v50/schemas') {
    _send(res, 200, schemas.status());
    return true;
  }
  if (urlPath.startsWith('/api/v50/schemas/')) {
    const id = decodeURIComponent(urlPath.slice('/api/v50/schemas/'.length));
    const doc = schemas.get(id);
    if (!doc) { _send(res, 404, { error: 'schema_not_found', id }); return true; }
    _send(res, 200, doc, { 'Content-Type': 'application/schema+json; charset=utf-8' });
    return true;
  }

  // SBOM
  if (urlPath === '/api/v50/sbom/cyclonedx') {
    try {
      const doc = sbom.buildSbom();
      const dig = sbom.digest(doc);
      _send(res, 200, doc, { 'X-Sbom-Sha256': dig.sha256, 'X-Sbom-Bytes': String(dig.bytes) });
    } catch (e) { _send(res, 500, { error: 'sbom_failed', message: e.message }); }
    return true;
  }

  // Audit
  if (urlPath === '/api/v50/audit/recent') {
    _send(res, 200, { items: audit.listRecent(params.get('limit')), root: audit.root() });
    return true;
  }
  if (urlPath === '/api/v50/audit/proof') {
    const id = params.get('id');
    if (!id) { _send(res, 400, { error: 'missing_id' }); return true; }
    const p = audit.proof(id);
    if (!p) { _send(res, 404, { error: 'not_found', id }); return true; }
    _send(res, 200, p);
    return true;
  }
  if (urlPath === '/api/v50/audit/root') {
    _send(res, 200, audit.root());
    return true;
  }
  if (urlPath === '/api/v50/audit/append' && req.method === 'POST') {
    try {
      const requiredToken = process.env.AUDIT_50Y_TOKEN || '';
      if (requiredToken) {
        const tok = (req.headers && (req.headers['x-audit-token'] || req.headers['authorization'] || ''));
        const provided = String(tok).replace(/^Bearer\s+/i, '');
        if (provided !== requiredToken) { _send(res, 401, { error: 'unauthorized' }); return true; }
      }
      const raw = await _readBody(req, 65536);
      let body = {};
      if (raw) { try { body = JSON.parse(raw); } catch (_) { _send(res, 400, { error: 'invalid_json' }); return true; } }
      const result = audit.append(body || {});
      _send(res, 200, { ok: true, entry: result });
    } catch (e) { _send(res, 500, { error: 'append_failed', message: e.message }); }
    return true;
  }

  // OTel
  if (urlPath === '/api/v50/otel/status') {
    _send(res, 200, otel.status());
    return true;
  }
  if (urlPath === '/api/v50/otel/recent') {
    _send(res, 200, { spans: otel.recent(params.get('limit')) });
    return true;
  }

  // Crypto agility
  if (urlPath === '/api/v50/crypto/status') {
    _send(res, 200, cryptoAgility.status());
    return true;
  }

  // Manifest merkle
  if (urlPath === '/api/v50/manifest/root') {
    _send(res, 200, manifest.status());
    return true;
  }
  if (urlPath === '/api/v50/manifest/build' && req.method === 'POST') {
    try {
      const m = manifest.build();
      manifest.persist(m);
      _send(res, 200, { ok: true, root: m.root, leafCount: m.leafCount, file: manifest.ROOT_FILE });
    } catch (e) { _send(res, 500, { error: 'manifest_failed', message: e.message }); }
    return true;
  }

  // Insight RAG
  if (urlPath === '/api/v50/insight/ask') {
    const q = params.get('q') || '';
    if (!q) { _send(res, 400, { error: 'missing_q' }); return true; }
    try {
      const limit = params.get('limit');
      _send(res, 200, insight.ask(q, { limit }));
    } catch (e) { _send(res, 500, { error: 'insight_failed', message: e.message }); }
    return true;
  }

  return false;
}

module.exports = {
  handle,
  cryptoAgility,
  audit,
  otel,
  sbom,
  did,
  schemas,
  insight,
  manifest,
  DISABLED
};
