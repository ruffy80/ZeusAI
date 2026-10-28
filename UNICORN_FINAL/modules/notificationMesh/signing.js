'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.SNM_STATE_DIR || '/opt/zeusai/state';
const PRIVATE_PATH = path.join(STATE_DIR, 'snm_private.key');
const PUBLIC_PATH = path.join(STATE_DIR, 'snm_public.key');

let _private = null;
let _publicDer = null;

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try { fs.chmodSync(STATE_DIR, 0o700); } catch (_) { /* dir may already be 700 */ }
}

function loadOrCreate() {
  if (_private && _publicDer) return;
  ensureStateDir();
  if (fs.existsSync(PRIVATE_PATH) && fs.existsSync(PUBLIC_PATH)) {
    const pem = fs.readFileSync(PRIVATE_PATH, 'utf8');
    _private = crypto.createPrivateKey(pem);
    _publicDer = fs.readFileSync(PUBLIC_PATH);
    return;
  }
  const pair = crypto.generateKeyPairSync('ed25519');
  _private = pair.privateKey;
  _publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  fs.writeFileSync(PRIVATE_PATH, pem, { mode: 0o600 });
  try { fs.chmodSync(PRIVATE_PATH, 0o600); } catch (_) { /* best effort */ }
  fs.writeFileSync(PUBLIC_PATH, _publicDer, { mode: 0o644 });
}

function getPublicKey() {
  loadOrCreate();
  return Buffer.from(_publicDer).toString('base64');
}

function signNotification(payload) {
  loadOrCreate();
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const body = { payload, timestamp, nonce };
  const message = Buffer.from(JSON.stringify(body));
  const signature = crypto.sign(null, message, _private).toString('base64');
  return {
    payload,
    signature,
    pubkey: getPublicKey(),
    timestamp,
    nonce,
  };
}

function verifyNotification(signed) {
  if (!signed || !signed.signature || !signed.pubkey || !signed.timestamp || !signed.nonce) return false;
  try {
    const body = { payload: signed.payload, timestamp: signed.timestamp, nonce: signed.nonce };
    const message = Buffer.from(JSON.stringify(body));
    const key = crypto.createPublicKey({
      key: Buffer.from(signed.pubkey, 'base64'),
      type: 'spki',
      format: 'der',
    });
    return crypto.verify(null, message, key, Buffer.from(signed.signature, 'base64'));
  } catch (_) {
    return false;
  }
}

module.exports = {
  signNotification,
  verifyNotification,
  getPublicKey,
  STATE_DIR,
  PRIVATE_PATH,
  PUBLIC_PATH,
};
