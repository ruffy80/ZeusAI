// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T14:40:03.778Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const crypto = require('crypto');

const modules = new Map();

/** HMAC key for DID attestation — stable per process, overridable via env. */
const ATTEST_SECRET = String(
  process.env.MODULE_IDENTITY_SECRET
  || process.env.JWT_SECRET
  || 'zeusai-module-identity-v1'
);

function _hash(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function _sign(did, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHmac('sha256', ATTEST_SECRET).update(did + '\n' + body).digest('hex');
}

function ensure(name) {
  const n = String(name || '').trim();
  if (!n) throw new Error('name required');
  if (modules.has(n)) return modules.get(n);
  const did = 'did:zeus:' + _hash(n).slice(0, 24);
  const rec = {
    name: n,
    did,
    doc: {
      id: did,
      controller: 'https://zeusai.pro',
      service: [{
        id: did + '#status',
        type: 'StatusEndpoint',
        serviceEndpoint: 'https://zeusai.pro/api/' + encodeURIComponent(n) + '/status',
      }],
      createdAt: new Date().toISOString(),
    },
  };
  modules.set(n, rec);
  return rec;
}

/** Seed DIDs for a batch of engine/module names (idempotent). */
function ensureMany(names) {
  const out = [];
  for (const n of (names || [])) {
    try { out.push(ensure(n)); } catch (_) { /* skip invalid */ }
  }
  return { ok: true, seeded: out.length, count: modules.size };
}

function list() {
  const out = {};
  for (const [k, v] of modules.entries()) out[k] = v;
  return { modules: out, count: modules.size, ok: true };
}

function resolveDoc(idOrName) {
  const key = String(idOrName || '');
  for (const rec of modules.values()) {
    if (rec.name === key || rec.did === key) return rec.doc;
  }
  return null;
}

function attest(didOrName, payload) {
  const rec = (() => {
    const key = String(didOrName || '');
    for (const r of modules.values()) {
      if (r.name === key || r.did === key) return r;
    }
    return null;
  })();
  if (!rec) return { ok: false, error: 'unknown_did' };
  const signature = _sign(rec.did, payload);
  return { ok: true, did: rec.did, name: rec.name, signature, algorithm: 'hmac-sha256' };
}

function verify(did, payload, signature) {
  const doc = resolveDoc(did);
  if (!doc) return { ok: true, did, valid: false, algorithm: 'hmac-sha256', reason: 'unknown_did' };
  const expected = _sign(doc.id, payload);
  const a = Buffer.from(String(signature || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const valid = a.length === b.length && a.length >= 16 && crypto.timingSafeEqual(a, b);
  return { ok: true, did: doc.id, valid, algorithm: 'hmac-sha256' };
}

ensure('social-orchestrator');
ensure('zeusai-social');
ensure('unicornBrain');
ensure('forwardOnlySafety');
ensure('meshOrchestrator');

module.exports = { ensure, ensureMany, list, resolveDoc, verify, attest };
