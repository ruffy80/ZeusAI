'use strict';

const fs = require('fs');
const path = require('path');
const { STATE_DIR } = require('../signing');

const VAPID_FILE = path.join(STATE_DIR, 'vapid.json');

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('webpush_timeout')), ms);
    Promise.resolve(promise).then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function loadVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try {
    if (fs.existsSync(VAPID_FILE)) return JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  } catch (_) { /* regenerate */ }
  const webpush = require('web-push');
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys), { mode: 0o600 });
  try { fs.chmodSync(VAPID_FILE, 0o600); } catch (_) { /* best effort */ }
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  return keys;
}

function lookupSubscription(userId) {
  let Database;
  try { Database = require('better-sqlite3'); } catch (_) { return null; }
  const dbPath = process.env.SNM_PUSH_DB || path.join(STATE_DIR, 'push_subscriptions.sqlite');
  let db;
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      subscription TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    const row = db.prepare('SELECT subscription FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(String(userId || ''));
    db.close();
    if (!row || !row.subscription) return null;
    return JSON.parse(row.subscription);
  } catch (_) {
    try { if (db) db.close(); } catch (__) { /* ignore */ }
    return null;
  }
}

async function send(signedNotification, userId) {
  const subscription = lookupSubscription(userId);
  if (!subscription) return false;
  const webpush = require('web-push');
  const keys = loadVapid();
  const mailto = process.env.SNM_FROM_EMAIL || 'notifications@zeusai.pro';
  webpush.setVapidDetails('mailto:' + mailto, keys.publicKey, keys.privateKey);
  const body = JSON.stringify({
    type: signedNotification.payload && signedNotification.payload.type,
    orderId: signedNotification.payload && signedNotification.payload.orderId,
    signature: signedNotification.signature,
    pubkey: signedNotification.pubkey,
    timestamp: signedNotification.timestamp,
    nonce: signedNotification.nonce,
  });
  await withTimeout(webpush.sendNotification(subscription, body), 5000);
  return true;
}

module.exports = { send, lookupSubscription, loadVapid, VAPID_FILE };
