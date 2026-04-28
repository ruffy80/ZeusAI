// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T09:00:12.358Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * did-web.js — Innovations 50Y · Pillar III
 *
 * Generates a W3C DID Core 1.0 compliant `did.json` document for `did:web:<host>`
 * using the existing site-sign Ed25519 key (global.__SITE_SIGN_KEY__) when
 * available, or a fresh ephemeral key as a fallback.
 *
 * Public key is encoded in `publicKeyMultibase` form using the standard
 * `did:key` Ed25519 multicodec prefix (0xed01) so the document is portable
 * and verifiable by any compliant client without runtime negotiation.
 *
 * Pure additive: no I/O on require, no global state mutation. Returns a JSON
 * object — caller decides how to serve it (typically /.well-known/did.json).
 */

'use strict';

const crypto = require('crypto');

const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);

// Minimal base58btc encoder (no deps).
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function _base58btc(buf) {
  if (!buf.length) return '';
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  // Convert bytes to base58
  const digits = [];
  for (let i = zeros; i < buf.length; i++) {
    let carry = buf[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (let k = 0; k < zeros; k++) out += '1';
  for (let k = digits.length - 1; k >= 0; k--) out += B58_ALPHABET[digits[k]];
  return out;
}

function _publicRawFromPem(pem) {
  // SPKI Ed25519 public keys end with the 32-byte raw key as the last 32 bytes
  // of the DER-encoded body.
  try {
    const keyObj = crypto.createPublicKey(pem);
    const der = keyObj.export({ type: 'spki', format: 'der' });
    return der.slice(der.length - 32);
  } catch (_) { return null; }
}

function _publicMultibase(rawPub32) {
  // multicodec(ed25519-pub=0xed01) || raw32 → base58btc with 'z' prefix
  const buf = Buffer.concat([ED25519_MULTICODEC, rawPub32]);
  return 'z' + _base58btc(buf);
}

function _ensureKey() {
  if (global.__SITE_SIGN_KEY__) {
    try {
      const pubPem = crypto.createPublicKey(global.__SITE_SIGN_KEY__)
        .export({ type: 'spki', format: 'pem' });
      const raw = _publicRawFromPem(pubPem);
      if (raw && raw.length === 32) return { source: 'site-sign-key', pubPem, raw };
    } catch (_) { /* fall through */ }
  }
  // Fallback: ephemeral
  const kp = crypto.generateKeyPairSync('ed25519');
  const pubPem = kp.publicKey.export({ type: 'spki', format: 'pem' });
  const raw = _publicRawFromPem(pubPem);
  return { source: 'ephemeral', pubPem, raw };
}

/**
 * Build a DID document for did:web:<host> (host may include URL-encoded `:port`).
 */
function buildDidDocument(host) {
  // Sanitize host without regex (ReDoS-safe). Strip optional scheme + path.
  let h = String(host || process.env.UNICORN_DID_HOST || 'zeusai.pro');
  if (h.startsWith('https://')) h = h.slice(8);
  else if (h.startsWith('http://')) h = h.slice(7);
  const slash = h.indexOf('/');
  if (slash >= 0) h = h.slice(0, slash);
  h = h.trim();
  if (!h) h = 'zeusai.pro';
  const did = 'did:web:' + h;
  const key = _ensureKey();
  const verificationMethod = {
    id: did + '#key-1',
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyMultibase: _publicMultibase(key.raw)
  };
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethod.id],
    assertionMethod: [verificationMethod.id],
    service: [
      {
        id: did + '#unicorn-api',
        type: 'UnicornApi',
        serviceEndpoint: 'https://' + h + '/api/'
      }
    ],
    // Non-normative metadata
    'unicorn:keySource': key.source,
    'unicorn:standardsRef': ['W3C-DID-Core-1.0', 'Ed25519-2020', 'multicodec', 'multibase']
  };
}

function status() {
  const key = _ensureKey();
  return {
    didMethod: 'web',
    keyAlg: 'Ed25519',
    keySource: key.source,
    standardsRef: ['W3C-DID-Core-1.0', 'W3C-VC-Data-Model-2.0']
  };
}

module.exports = { buildDidDocument, status };
