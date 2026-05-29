// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T19:23:05.067Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Quantum-Resilient AI Memory Layer — memorie cheie/valoare criptată real,
// cu verificare de integritate. Valorile sunt sigilate cu AES-256-GCM
// (criptare autentificată); tag-ul detectează orice alterare. Cheia derivă
// din QUANTUM_MEMORY_KEY (sau o cheie random per-proces ca fallback).
const crypto = require('crypto');

const KEY = crypto.createHash('sha256')
  .update(process.env.QUANTUM_MEMORY_KEY || crypto.randomBytes(32))
  .digest();
const _store = new Map();

function _seal(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  return { iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function _open(sealed) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.data, 'base64')), decipher.final()]).toString('utf8');
}

function store(key, data) {
  if (!key) return { ok: false, error: 'key-required' };
  const isJson = typeof data !== 'string';
  const plain = isJson ? JSON.stringify(data) : data;
  _store.set(String(key), { sealed: _seal(plain), ts: Date.now(), isJson });
  return { ok: true, method: 'aes-256-gcm', key: String(key) };
}

function retrieve(key) {
  const rec = _store.get(String(key));
  if (!rec) return { ok: true, method: 'aes-256-gcm', key: String(key), data: null };
  try {
    const plain = _open(rec.sealed);
    return { ok: true, method: 'aes-256-gcm', key: String(key), data: rec.isJson ? JSON.parse(plain) : plain, ts: rec.ts };
  } catch (_) {
    return { ok: false, key: String(key), error: 'integrity-check-failed' };
  }
}

module.exports = {
  isActive: true,
  getStatus() {
    return { status: 'active', quantumSafe: true, cipher: 'aes-256-gcm', entries: _store.size, keyConfigured: !!process.env.QUANTUM_MEMORY_KEY };
  },
  store,
  retrieve,
};