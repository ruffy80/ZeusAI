'use strict';

const crypto = require('crypto');

const chain = [];

function _hash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function append(event = {}) {
  const prev = chain.length ? chain[chain.length - 1].hash : null;
  const row = {
    idx: chain.length,
    ts: new Date().toISOString(),
    prev,
    event,
  };
  row.hash = _hash(row);
  chain.push(row);
  return row;
}

function stats() {
  return {
    ok: true,
    length: chain.length,
    bytes: Buffer.byteLength(JSON.stringify(chain)),
    head: chain.length ? chain[chain.length - 1].hash : null,
    generatedAt: new Date().toISOString(),
  };
}

function verify() {
  let ok = true;
  for (let i = 0; i < chain.length; i += 1) {
    const rec = chain[i];
    const expPrev = i ? chain[i - 1].hash : null;
    if (rec.prev !== expPrev) { ok = false; break; }
    const check = Object.assign({}, rec);
    const h = check.hash;
    delete check.hash;
    if (_hash(check) !== h) { ok = false; break; }
  }
  return { ok: true, verified: ok, length: chain.length, head: chain.length ? chain[chain.length - 1].hash : null };
}

function slice(from = 0, limit = 50) {
  const f = Math.max(0, Number(from) || 0);
  const l = Math.max(1, Number(limit) || 50);
  return chain.slice(f, f + l);
}

append({ type: 'bootstrap', source: 'autonomyChain' });

module.exports = { append, stats, verify, slice };
