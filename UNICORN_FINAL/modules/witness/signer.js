'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.SNM_STATE_DIR || '/opt/zeusai/state';
const PRIVATE_PATH = path.join(STATE_DIR, 'snm_private.key');
const PUBLIC_PATH = path.join(STATE_DIR, 'snm_public.key');

function ensureKeys() {
  if (fs.existsSync(PRIVATE_PATH) && fs.existsSync(PUBLIC_PATH)) return;
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try { fs.chmodSync(STATE_DIR, 0o700); } catch (_) { /* best effort */ }
  const pair = crypto.generateKeyPairSync('ed25519');
  const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const der = pair.publicKey.export({ type: 'spki', format: 'der' });
  fs.writeFileSync(PRIVATE_PATH, pem, { mode: 0o600 });
  try { fs.chmodSync(PRIVATE_PATH, 0o600); } catch (_) { /* best effort */ }
  fs.writeFileSync(PUBLIC_PATH, der);
}

function privateKey() {
  ensureKeys();
  return crypto.createPrivateKey(fs.readFileSync(PRIVATE_PATH, 'utf8'));
}

function publicKeyBase64() {
  ensureKeys();
  return fs.readFileSync(PUBLIC_PATH).toString('base64');
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function signContract(payload) {
  const body = Buffer.from(canonical(payload));
  const signature = crypto.sign(null, body, privateKey()).toString('base64');
  return {
    payload,
    signature,
    pubkey: publicKeyBase64(),
    signed_at: new Date().toISOString(),
  };
}

function verifyContract(signed) {
  if (!signed || !signed.payload || !signed.signature || !signed.pubkey) return false;
  try {
    const key = crypto.createPublicKey({
      key: Buffer.from(signed.pubkey, 'base64'),
      type: 'spki',
      format: 'der',
    });
    return crypto.verify(null, Buffer.from(canonical(signed.payload)), key, Buffer.from(signed.signature, 'base64'));
  } catch (_) {
    return false;
  }
}

module.exports = {
  canonical,
  signContract,
  verifyContract,
  publicKeyBase64,
  PRIVATE_PATH,
  PUBLIC_PATH,
};
