'use strict';
/**
 * oob-deploy.test.js — Unit tests for backend/modules/oob-deploy.js
 *
 * Covers the signed Out-of-Band deploy channel's verification core:
 * HMAC + Ed25519 signature paths, freshness (ts) window, nonce/ref validation,
 * fail-closed behaviour, body limits, and Ed25519 public-key parsing
 * (OpenSSH one-liner + PEM).
 */

const assert = require('assert');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';

const oob = require('../backend/modules/oob-deploy');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

const SECRET = 'test-oob-secret-please-ignore';
function hmacSig(body) {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}
function makeBody(over = {}) {
  return JSON.stringify(Object.assign({
    ref: 'origin/main',
    ts: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex'),
  }, over));
}

// ── fail-closed ─────────────────────────────────────────────────────────────
console.log('OOB Deploy — fail-closed');
check('disabled when no secret and no keys → 503', () => {
  const body = makeBody();
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: '', ed25519Keys: [] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 503);
  assert.strictEqual(r.error, 'oob_deploy_disabled');
});

// ── HMAC path ───────────────────────────────────────────────────────────────
console.log('OOB Deploy — HMAC');
check('valid HMAC signature is accepted', () => {
  const body = makeBody();
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, true, r.error);
  assert.strictEqual(r.payload.ref, 'origin/main');
});

check('tampered body fails HMAC (bad_signature)', () => {
  const body = makeBody();
  const sig = hmacSig(body);
  const tampered = body.replace('origin/main', 'origin/evil');
  const r = oob.verifyRequest(tampered, sig, Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.error, 'bad_signature');
});

check('wrong secret fails HMAC', () => {
  const body = makeBody();
  const badSig = 'sha256=' + crypto.createHmac('sha256', 'wrong').update(body).digest('hex');
  const r = oob.verifyRequest(body, badSig, Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'bad_signature');
});

check('missing signature header → 401', () => {
  const body = makeBody();
  const r = oob.verifyRequest(body, '', Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.error, 'missing_signature');
});

check('unsupported signature scheme → 401', () => {
  const body = makeBody();
  const r = oob.verifyRequest(body, 'md5=abc', Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.error, 'unsupported_signature_scheme');
});

// ── freshness ───────────────────────────────────────────────────────────────
console.log('OOB Deploy — freshness');
check('stale ts (older than window) → stale_or_future_ts', () => {
  const now = Date.now();
  const body = makeBody({ ts: now - 10 * 60 * 1000 });
  const r = oob.verifyRequest(body, hmacSig(body), now, { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'stale_or_future_ts');
});
check('far-future ts → stale_or_future_ts', () => {
  const now = Date.now();
  const body = makeBody({ ts: now + 10 * 60 * 1000 });
  const r = oob.verifyRequest(body, hmacSig(body), now, { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'stale_or_future_ts');
});
check('ts within window is accepted', () => {
  const now = Date.now();
  const body = makeBody({ ts: now - 60 * 1000 });
  const r = oob.verifyRequest(body, hmacSig(body), now, { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, true, r.error);
});

// ── nonce + ref validation ──────────────────────────────────────────────────
console.log('OOB Deploy — nonce & ref');
check('missing nonce → missing_or_bad_nonce', () => {
  const body = makeBody({ nonce: undefined });
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'missing_or_bad_nonce');
});
check('too-short nonce → missing_or_bad_nonce', () => {
  const body = makeBody({ nonce: 'abc' });
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'missing_or_bad_nonce');
});
check('path-traversal ref → invalid_ref', () => {
  const body = makeBody({ ref: '../../etc/passwd' });
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'invalid_ref');
});
check('ref with shell metachars → invalid_ref', () => {
  const body = makeBody({ ref: 'main; rm -rf /' });
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'invalid_ref');
});
check('valid sha ref is accepted', () => {
  const body = makeBody({ ref: 'b02a284d1234567890abcdef' });
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.ok, true, r.error);
  assert.strictEqual(r.payload.ref, 'b02a284d1234567890abcdef');
});

// ── body limits / malformed ─────────────────────────────────────────────────
console.log('OOB Deploy — body handling');
check('empty body → empty_body', () => {
  const r = oob.verifyRequest('', hmacSig(''), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'empty_body');
});
check('invalid JSON with valid signature → invalid_json', () => {
  const body = 'not-json{';
  const r = oob.verifyRequest(body, hmacSig(body), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.error, 'invalid_json');
});
check('oversized body → body_too_large', () => {
  const big = 'x'.repeat(9000);
  const r = oob.verifyRequest(big, hmacSig(big), Date.now(), { hmacSecret: SECRET, ed25519Keys: [] });
  assert.strictEqual(r.status, 413);
  assert.strictEqual(r.error, 'body_too_large');
});

// ── Ed25519 path ────────────────────────────────────────────────────────────
console.log('OOB Deploy — Ed25519');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
function edSig(body) {
  return 'ed25519=' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64');
}
check('valid Ed25519 signature (PEM trusted key) is accepted', () => {
  const body = makeBody();
  const r = oob.verifyRequest(body, edSig(body), Date.now(), { hmacSecret: '', ed25519Keys: [pubPem] });
  assert.strictEqual(r.ok, true, r.error);
});
check('Ed25519 signature from an untrusted key is rejected', () => {
  const other = crypto.generateKeyPairSync('ed25519');
  const body = makeBody();
  const r = oob.verifyRequest(body, edSig(body), Date.now(), {
    hmacSecret: '',
    ed25519Keys: [other.publicKey.export({ type: 'spki', format: 'pem' })],
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'bad_signature');
});
check('tampered body fails Ed25519', () => {
  const body = makeBody();
  const sig = edSig(body);
  const r = oob.verifyRequest(body.replace('origin/main', 'origin/x'), sig, Date.now(), { hmacSecret: '', ed25519Keys: [pubPem] });
  assert.strictEqual(r.ok, false);
});

// ── Ed25519 public-key parsing ──────────────────────────────────────────────
console.log('OOB Deploy — parseEd25519PublicKey');
check('parses a PEM SPKI Ed25519 key', () => {
  const k = oob.parseEd25519PublicKey(pubPem);
  assert.ok(k, 'expected a KeyObject');
  assert.strictEqual(k.asymmetricKeyType, 'ed25519');
});
check('parses an OpenSSH one-line ed25519 key round-trips for verification', () => {
  // Build an OpenSSH one-liner from the generated raw public key and confirm a
  // signature verifies through the full verifyRequest ed25519 path.
  const rawDer = publicKey.export({ type: 'spki', format: 'der' });
  const raw = rawDer.slice(rawDer.length - 32); // last 32 bytes = Ed25519 point
  const parts = [Buffer.alloc(4), Buffer.from('ssh-ed25519'), Buffer.alloc(4), raw];
  parts[0].writeUInt32BE(11, 0);
  parts[2].writeUInt32BE(32, 0);
  const openssh = 'ssh-ed25519 ' + Buffer.concat(parts).toString('base64') + ' test-key';
  const k = oob.parseEd25519PublicKey(openssh);
  assert.ok(k, 'expected a KeyObject from OpenSSH form');
  const body = makeBody();
  const r = oob.verifyRequest(body, edSig(body), Date.now(), { hmacSecret: '', ed25519Keys: [openssh] });
  assert.strictEqual(r.ok, true, r.error);
});
check('rejects garbage key material', () => {
  assert.strictEqual(oob.parseEd25519PublicKey('not-a-key'), null);
  assert.strictEqual(oob.parseEd25519PublicKey(''), null);
});

// ── nonce store roundtrip ───────────────────────────────────────────────────
console.log('OOB Deploy — nonce store');
check('recordNonce then nonceSeen returns true; unknown nonce false', () => {
  const n = 'nonce-' + crypto.randomBytes(12).toString('hex');
  assert.strictEqual(oob.nonceSeen(n), false);
  oob.recordNonce(n);
  assert.strictEqual(oob.nonceSeen(n), true);
  assert.strictEqual(oob.nonceSeen('nonce-' + crypto.randomBytes(12).toString('hex')), false);
});

console.log(`\nOOB Deploy — all ${passed} checks passed ✅`);
