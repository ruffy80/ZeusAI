// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T15:50:27.938Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/**
 * unicornSovereignty.js — FAZA 3 / VAL 9
 * ──────────────────────────────────────
 * Cryptographic Sovereignty Layer.
 *
 * Periodic atestat semnat (ed25519 dacă disponibil, altfel SHA-256
 * hash-chain) al stării celor 6+2 module supreme. Fiecare atestat
 * include hash-ul precedentului → lanț tamper-evident peste 30 ani.
 *
 *   { v, ts, seq, prevHash, payloadHash, signature?, modules:{...} }
 *
 * Ledger append-only: data/sovereignty/attestations.jsonl
 * Tick: 5 min, unref'd. Cheia ed25519 generată la primul boot și
 * stocată în data/sovereignty/sovereignty-keypair.json (mode 0600).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'sovereignty');
const LEDGER = path.join(DIR, 'attestations.jsonl');
const KEYS = path.join(DIR, 'sovereignty-keypair.json');
const STATE_FILE = path.join(DIR, 'sovereignty-state.json');
const TICK_MS = 5 * 60_000;
const ROTATE_BYTES = 100 * 1024 * 1024;

const bus = new EventEmitter();
let state = { seq: 0, prevHash: 'GENESIS', lastTs: 0, lastAttestation: null };
let keypair = null;
let timer = null;

function safeRequire(rel) { try { return require(rel); } catch (_) { return null; } }
function ensureDir() { try { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); } catch (_) {} }
function loadState() {
  try { if (fs.existsSync(STATE_FILE)) state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch (_) {}
}
function persistState() { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (_) {} }

function loadOrCreateKeypair() {
  try {
    if (fs.existsSync(KEYS)) {
      keypair = JSON.parse(fs.readFileSync(KEYS, 'utf8'));
      return;
    }
  } catch (_) {}
  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    keypair = {
      alg: 'ed25519',
      createdAt: new Date().toISOString(),
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
    fs.writeFileSync(KEYS, JSON.stringify(keypair), { mode: 0o600 });
    try { console.log('🔐 unicornSovereignty: ed25519 keypair generated'); } catch (_) {}
  } catch (e) {
    keypair = null;
    try { console.warn('[sovereignty] keypair gen failed, falling back to hash-chain only:', e && e.message); } catch (_) {}
  }
}

function rotateIfNeeded() {
  try { const st = fs.statSync(LEDGER); if (st.size > ROTATE_BYTES) fs.renameSync(LEDGER, LEDGER + '.' + Date.now() + '.bak'); } catch (_) {}
}

function snapshot() {
  const names = ['unicornBrain','unicornSelfHealer','unicornInnovator','unicornTreasury','unicornGrowth','unicornGuardian','unicornOracle','unicornEconomy'];
  const out = {};
  for (const n of names) {
    const mod = safeRequire('./' + n);
    if (!mod || typeof mod.getStatus !== 'function') { out[n] = { ok: false, reason: 'missing' }; continue; }
    try {
      const s = mod.getStatus();
      // We hash a compact projection — cycles+lastTs — instead of full payload (huge).
      const compact = { cycles: s.cycles || s.mainCycleCount || 0, lastTs: s.lastTs || s.ts || 0 };
      out[n] = { ok: true, hash: crypto.createHash('sha256').update(JSON.stringify(compact)).digest('hex'), compact };
    } catch (e) { out[n] = { ok: false, reason: 'error', error: String(e && e.message || e) }; }
  }
  return out;
}

function attest() {
  state.seq++;
  const ts = Date.now();
  const modules = snapshot();
  const payload = { v: 1, ts, seq: state.seq, prevHash: state.prevHash, modules };
  const payloadJson = JSON.stringify(payload);
  const payloadHash = crypto.createHash('sha256').update(payloadJson).digest('hex');
  let signature = null, alg = 'sha256-chain';
  if (keypair && keypair.privateKey) {
    try {
      signature = crypto.sign(null, Buffer.from(payloadJson), keypair.privateKey).toString('base64');
      alg = 'ed25519';
    } catch (_) { signature = null; }
  }
  const attestation = { ...payload, payloadHash, alg, signature };
  try {
    rotateIfNeeded();
    fs.appendFileSync(LEDGER, JSON.stringify(attestation) + '\n');
  } catch (_) {}
  state.prevHash = payloadHash;
  state.lastTs = ts;
  state.lastAttestation = { seq: state.seq, ts, payloadHash, alg };
  persistState();
  try { bus.emit('attestation', attestation); } catch (_) {}
  return attestation;
}

/** Verify the entire ledger chain. Returns { ok, length, brokenAt? }. */
function verifyChain() {
  try {
    if (!fs.existsSync(LEDGER)) return { ok: true, length: 0, reason: 'empty' };
    const lines = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean);
    let prev = 'GENESIS';
    for (let i = 0; i < lines.length; i++) {
      const a = JSON.parse(lines[i]);
      if (a.prevHash !== prev) return { ok: false, length: lines.length, brokenAt: i, expectedPrev: prev, gotPrev: a.prevHash };
      const recomputed = crypto.createHash('sha256').update(JSON.stringify({ v: a.v, ts: a.ts, seq: a.seq, prevHash: a.prevHash, modules: a.modules })).digest('hex');
      if (recomputed !== a.payloadHash) return { ok: false, length: lines.length, brokenAt: i, reason: 'payload-hash-mismatch' };
      prev = a.payloadHash;
    }
    return { ok: true, length: lines.length, head: prev };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

function start() {
  if (timer) return;
  ensureDir();
  loadState();
  loadOrCreateKeypair();
  timer = setInterval(attest, TICK_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
  setTimeout(attest, 10_000).unref?.();
  try { console.log('🏛️  unicornSovereignty activat (ed25519 + hash-chain attestation every 5min)'); } catch (_) {}
}

function getStatus() { return { module: 'unicornSovereignty', seq: state.seq, prevHash: state.prevHash, lastTs: state.lastTs, alg: keypair ? 'ed25519' : 'sha256-chain' }; }
function getLast() { return state.lastAttestation || attest(); }
function getPublicKey() { return keypair && keypair.publicKey || null; }
function getBus() { return bus; }
function forceTick() { return attest(); }

start();

module.exports = { start, getStatus, getLast, getPublicKey, verifyChain, getBus, forceTick };
