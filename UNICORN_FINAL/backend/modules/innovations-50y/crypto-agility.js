// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.024Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * crypto-agility.js — Innovations 50Y · Pillar II
 *
 * Algorithm-agile sign/verify wrapper. Default Ed25519 today, HMAC-SHA-512 for
 * shared-secret signatures, post-quantum (ML-DSA / Dilithium3) ready slot for
 * when the runtime gains native or stable userland support.
 *
 * Standards anchored: NIST FIPS 186-5 (EdDSA), NIST FIPS 198-1 (HMAC),
 * NIST FIPS 204 (ML-DSA / Dilithium, 2024). Output format is JOSE-friendly
 * base64url so signatures remain decodable for decades regardless of the
 * runtime that produced them.
 *
 * Pure additive — does not modify any existing signing path. Modules opt-in
 * by calling `sign()` / `verify()` here. No I/O at require time.
 */

'use strict';

const crypto = require('crypto');

const ALG = Object.freeze({
  ED25519: 'ed25519',
  HMAC_SHA512: 'hmac-sha512',
  // Reserved slot — implemented when @noble/post-quantum or native Node lands.
  ML_DSA_65: 'ml-dsa-65'
});

const DEFAULT_ALG = process.env.UNICORN_SIG_ALG || ALG.ED25519;

function b64u(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64uDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Buffer.from(s + pad, 'base64');
}

function asBuffer(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  return Buffer.from(JSON.stringify(data), 'utf8');
}

/**
 * Generate a fresh keypair for the given algorithm.
 * Returns PEM-encoded keys for Ed25519 (long-term storage friendly).
 */
function generateKeyPair(alg) {
  const a = alg || DEFAULT_ALG;
  if (a === ALG.ED25519) {
    const kp = crypto.generateKeyPairSync('ed25519');
    return {
      alg: a,
      publicKey: kp.publicKey.export({ type: 'spki', format: 'pem' }),
      privateKey: kp.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      createdAt: new Date().toISOString()
    };
  }
  if (a === ALG.HMAC_SHA512) {
    return {
      alg: a,
      secret: b64u(crypto.randomBytes(64)),
      createdAt: new Date().toISOString()
    };
  }
  if (a === ALG.ML_DSA_65) {
    // Best-effort: try the @noble/post-quantum lib if installed.
    try {
      // Lazy require so absence does not break load.
      const pq = require('@noble/post-quantum/ml-dsa');
      const seed = crypto.randomBytes(32);
      const keys = pq.ml_dsa65.keygen(seed);
      return {
        alg: a,
        publicKey: b64u(keys.publicKey),
        privateKey: b64u(keys.secretKey),
        createdAt: new Date().toISOString()
      };
    } catch (e) {
      const err = new Error('ml-dsa-65 unavailable: ' + e.message);
      err.code = 'PQ_UNAVAILABLE';
      throw err;
    }
  }
  throw new Error('Unknown alg: ' + a);
}

function sign(data, opts) {
  const o = opts || {};
  const alg = o.alg || DEFAULT_ALG;
  const payload = asBuffer(data);
  if (alg === ALG.ED25519) {
    let key = o.privateKey;
    if (!key && global.__SITE_SIGN_KEY__) key = global.__SITE_SIGN_KEY__;
    if (!key) throw new Error('Ed25519: no privateKey provided and no global site-sign key');
    const keyObj = (typeof key === 'object' && key.asymmetricKeyType)
      ? key
      : crypto.createPrivateKey(key);
    const sig = crypto.sign(null, payload, keyObj);
    return { alg, sig: b64u(sig) };
  }
  if (alg === ALG.HMAC_SHA512) {
    if (!o.secret) throw new Error('HMAC: no secret provided');
    const secret = typeof o.secret === 'string' ? b64uDecode(o.secret) : o.secret;
    const mac = crypto.createHmac('sha512', secret).update(payload).digest();
    return { alg, sig: b64u(mac) };
  }
  if (alg === ALG.ML_DSA_65) {
    try {
      const pq = require('@noble/post-quantum/ml-dsa');
      if (!o.privateKey) throw new Error('ML-DSA: no privateKey provided');
      const sk = b64uDecode(o.privateKey);
      const sig = pq.ml_dsa65.sign(sk, payload);
      return { alg, sig: b64u(sig) };
    } catch (e) {
      const err = new Error('ml-dsa-65 sign failed: ' + e.message);
      err.code = 'PQ_UNAVAILABLE';
      throw err;
    }
  }
  throw new Error('Unknown alg: ' + alg);
}

function verify(data, signature, opts) {
  const o = opts || {};
  const alg = (signature && signature.alg) || o.alg || DEFAULT_ALG;
  const sig = (signature && signature.sig) ? b64uDecode(signature.sig) : null;
  if (!sig) return false;
  const payload = asBuffer(data);
  if (alg === ALG.ED25519) {
    if (!o.publicKey) return false;
    const keyObj = (typeof o.publicKey === 'object' && o.publicKey.asymmetricKeyType)
      ? o.publicKey
      : crypto.createPublicKey(o.publicKey);
    try { return crypto.verify(null, payload, keyObj, sig); } catch (_) { return false; }
  }
  if (alg === ALG.HMAC_SHA512) {
    if (!o.secret) return false;
    const secret = typeof o.secret === 'string' ? b64uDecode(o.secret) : o.secret;
    const mac = crypto.createHmac('sha512', secret).update(payload).digest();
    if (mac.length !== sig.length) return false;
    try { return crypto.timingSafeEqual(mac, sig); } catch (_) { return false; }
  }
  if (alg === ALG.ML_DSA_65) {
    try {
      const pq = require('@noble/post-quantum/ml-dsa');
      if (!o.publicKey) return false;
      const pk = b64uDecode(o.publicKey);
      return !!pq.ml_dsa65.verify(pk, payload, sig);
    } catch (_) { return false; }
  }
  return false;
}

function isAvailable(alg) {
  if (alg === ALG.ED25519 || alg === ALG.HMAC_SHA512) return true;
  if (alg === ALG.ML_DSA_65) {
    try { require('@noble/post-quantum/ml-dsa'); return true; } catch (_) { return false; }
  }
  return false;
}

function status() {
  return {
    defaultAlg: DEFAULT_ALG,
    supported: {
      [ALG.ED25519]: isAvailable(ALG.ED25519),
      [ALG.HMAC_SHA512]: isAvailable(ALG.HMAC_SHA512),
      [ALG.ML_DSA_65]: isAvailable(ALG.ML_DSA_65)
    },
    standardsRef: ['NIST-FIPS-186-5', 'NIST-FIPS-198-1', 'NIST-FIPS-204']
  };
}

// ── Anchor key (Ed25519) for signed audit roots / receipts ──────────────────
// Persisted in UNICORN_FINAL/data/keys/audit-anchor.{public,private}.pem so
// it survives PM2 reloads. Generated on first call; afterwards loaded as-is.
// Pure additive — independent from any existing signing key flow.
const fs = require('fs');
const path = require('path');
const ANCHOR_DIR = path.join(__dirname, '..', '..', '..', 'data', 'keys');
const ANCHOR_PUB = path.join(ANCHOR_DIR, 'audit-anchor.public.pem');
const ANCHOR_PRIV = path.join(ANCHOR_DIR, 'audit-anchor.private.pem');

function _kidFromPubPem(pem) {
  // Stable KID = first 16 hex chars of SHA-256 over the PEM body bytes.
  const body = String(pem || '').replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 16);
}

function getOrCreateAnchorKey() {
  try { fs.mkdirSync(ANCHOR_DIR, { recursive: true }); } catch (_) {}
  try {
    const pub = fs.readFileSync(ANCHOR_PUB, 'utf8');
    const priv = fs.readFileSync(ANCHOR_PRIV, 'utf8');
    if (pub && priv) {
      return { alg: ALG.ED25519, publicKey: pub, privateKey: priv, kid: _kidFromPubPem(pub) };
    }
  } catch (_) { /* generate below */ }
  const kp = generateKeyPair(ALG.ED25519);
  try {
    fs.writeFileSync(ANCHOR_PUB, kp.publicKey, { mode: 0o644 });
    fs.writeFileSync(ANCHOR_PRIV, kp.privateKey, { mode: 0o600 });
  } catch (_) { /* read-only fs → still return key for in-memory use */ }
  return { alg: ALG.ED25519, publicKey: kp.publicKey, privateKey: kp.privateKey, kid: _kidFromPubPem(kp.publicKey) };
}

module.exports = {
  ALG,
  DEFAULT_ALG,
  generateKeyPair,
  sign,
  verify,
  isAvailable,
  status,
  getOrCreateAnchorKey,
  // exposed only for tests / debugging
  _b64u: b64u,
  _b64uDecode: b64uDecode
};
