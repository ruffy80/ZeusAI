'use strict';

const fs = require('fs');
const path = require('path');
const { STATE_DIR } = require('../signing');

const KEY_FILE = path.join(STATE_DIR, 'nostr.key');

function relays() {
  const raw = process.env.SNM_NOSTR_RELAYS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function loadSecret() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (fs.existsSync(KEY_FILE)) {
    return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
  }
  const { generateSecretKey } = require('nostr-tools');
  const secret = Buffer.from(generateSecretKey());
  fs.writeFileSync(KEY_FILE, secret.toString('hex'), { mode: 0o600 });
  try { fs.chmodSync(KEY_FILE, 0o600); } catch (_) { /* best effort */ }
  return secret;
}

function publicContent(signed) {
  const payload = signed && signed.payload ? signed.payload : {};
  return JSON.stringify({
    protocol: 'SNM/1.0',
    type: payload.type || null,
    orderId: payload.orderId || null,
    signature: signed.signature,
    pubkey: signed.pubkey,
    timestamp: signed.timestamp,
    nonce: signed.nonce,
  });
}

function publishOne(url, event) {
  const WebSocket = require('ws');
  return new Promise((resolve) => {
    let done = false;
    let socket = null;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { if (socket) socket.terminate(); } catch (_) { /* ignore */ }
      resolve(ok === true);
    };
    const timer = setTimeout(() => finish(false), 8000);
    try {
      socket = new WebSocket(url, { handshakeTimeout: 8000 });
    } catch (_) {
      finish(false);
      return;
    }
    socket.on('error', () => finish(false));
    socket.on('open', () => {
      try { socket.send(JSON.stringify(['EVENT', event])); }
      catch (_) { finish(false); }
    });
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (Array.isArray(msg) && msg[0] === 'OK' && msg[1] === event.id) finish(msg[2] === true);
      } catch (_) { /* ignore a non-JSON frame */ }
    });
  });
}

async function send(signedNotification) {
  const { finalizeEvent } = require('nostr-tools');
  const secret = loadSecret();
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'zeusai-snm']],
    content: publicContent(signedNotification),
  }, secret);
  const jobs = relays().map((url) => publishOne(url, event).then(() => true, () => false));
  const results = await Promise.all(jobs);
  return results.some(Boolean);
}

module.exports = { send, relays, KEY_FILE, publicContent };
