// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T19:23:04.868Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Global Trust Ledger — append-only, hash-chained, tamper-evident provenance.
// Fiecare intrare este înlănțuită SHA-256 de precedenta, deci orice editare
// retroactivă strică verify(). Inel mărginit în memorie, fără servicii externe.
const crypto = require('crypto');

const MAX_ENTRIES = Number(process.env.TRUST_LEDGER_MAX || 5000);
const GENESIS = crypto.createHash('sha256').update('zeusai-global-trust-genesis').digest('hex');

let chain = [];

function _entryHash(prevHash, seq, ts, type, payload) {
  return crypto.createHash('sha256')
    .update(prevHash + '|' + seq + '|' + ts + '|' + type + '|' + JSON.stringify(payload || {}))
    .digest('hex');
}

function record(event) {
  const payload = (event && typeof event === 'object') ? event : { value: event };
  const type = payload.type || 'event';
  const prev = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const seq = chain.length;
  const ts = new Date().toISOString();
  const hash = _entryHash(prev, seq, ts, type, payload);
  chain.push({ seq, ts, type, payload, prevHash: prev, hash });
  if (chain.length > MAX_ENTRIES) chain = chain.slice(-MAX_ENTRIES);
  return { ok: true, method: 'hash-chain', seq, hash, ts };
}

function verify() {
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (_entryHash(e.prevHash, e.seq, e.ts, e.type, e.payload) !== e.hash) {
      return { ok: false, brokenAt: e.seq, reason: 'hash-mismatch' };
    }
    if (i > 0 && e.prevHash !== chain[i - 1].hash) {
      return { ok: false, brokenAt: e.seq, reason: 'broken-link' };
    }
  }
  return { ok: true, length: chain.length, head: chain.length ? chain[chain.length - 1].hash : GENESIS };
}

function recent(n = 20) {
  return chain.slice(-Math.max(1, Math.min(Number(n) || 20, MAX_ENTRIES)));
}

module.exports = {
  isActive: true,
  getStatus() {
    const v = verify();
    return {
      status: 'active',
      trustLedger: true,
      mode: 'sha256-hash-chain',
      entries: chain.length,
      head: v.head || GENESIS,
      integrity: v.ok ? 'verified' : 'compromised',
      maxEntries: MAX_ENTRIES,
    };
  },
  record,
  verify,
  recent,
};