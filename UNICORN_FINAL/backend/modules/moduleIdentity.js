'use strict';

const crypto = require('crypto');

const modules = new Map();

function _hash(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
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
      service: [{ id: did + '#status', type: 'StatusEndpoint', serviceEndpoint: 'https://zeusai.pro/api/status' }],
      createdAt: new Date().toISOString(),
    },
  };
  modules.set(n, rec);
  return rec;
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

function verify(did, payload, signature) {
  const valid = String(signature || '').length >= 16 && !!resolveDoc(did) && !!payload;
  return { ok: true, did, valid, algorithm: 'sha256-placeholder' };
}

ensure('social-orchestrator');

module.exports = { ensure, list, resolveDoc, verify };
