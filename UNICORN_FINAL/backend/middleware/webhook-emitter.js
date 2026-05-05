// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T15:49:19.558Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * C1 — Outbound webhook emitter (HMAC-signed, retry, DLQ).
 *
 * Forward-only, additive: subscriptions persisted append-only in JSONL,
 * delivery queue in-RAM (lossy on crash; that's OK — webhooks are eventually
 * consistent and clients can re-poll order status as a safety net).
 *
 * Signature scheme (Stripe-compatible):
 *   X-Unicorn-Signature: t=<unix>,v1=<hex hmac-sha256(t.body)>
 *
 * Retry policy: 1s, 5s, 25s. After 3 failed attempts → dead-letter.
 *
 * NO schema changes — both files are append-only JSONL, same pattern as
 * existing data/marketing/innovation-ledger.jsonl etc.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.WEBHOOK_DATA_DIR || path.join(process.cwd(), 'data', 'webhooks');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.jsonl');
const DLQ_FILE  = path.join(DATA_DIR, 'dlq.jsonl');
const DELIVERED_FILE = path.join(DATA_DIR, 'delivered.jsonl');

let _subs = []; // [{id, url, events:[], secret, createdAt, active}]
let _queue = []; // [{eventId, subId, url, secret, body, attempt, nextAt}]
let _started = false;

function _ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o755 }); } catch (_) {}
}

function _loadSubs() {
  _ensureDir();
  _subs = [];
  if (!fs.existsSync(SUBS_FILE)) return;
  const lines = fs.readFileSync(SUBS_FILE, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      if (rec && rec.id && rec.url) {
        // Last-write-wins on same id.
        const idx = _subs.findIndex(s => s.id === rec.id);
        if (idx >= 0) _subs[idx] = rec; else _subs.push(rec);
      }
    } catch (_) {}
  }
  _subs = _subs.filter(s => s.active !== false);
}

function _appendSub(rec) {
  _ensureDir();
  fs.appendFileSync(SUBS_FILE, JSON.stringify(rec) + '\n', 'utf8');
}

function _appendDlq(rec) {
  try { fs.appendFileSync(DLQ_FILE, JSON.stringify(rec) + '\n', 'utf8'); } catch (_) {}
}

function _appendDelivered(rec) {
  try { fs.appendFileSync(DELIVERED_FILE, JSON.stringify(rec) + '\n', 'utf8'); } catch (_) {}
}

function subscribe({ url, events, secret }) {
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('invalid url');
  const evList = Array.isArray(events) && events.length ? events.slice(0, 32) : ['order.paid'];
  const sec = String(secret || crypto.randomBytes(24).toString('hex'));
  const rec = {
    id: 'whk_' + crypto.randomBytes(9).toString('hex'),
    url: String(url).slice(0, 512),
    events: evList,
    secret: sec,
    createdAt: new Date().toISOString(),
    active: true,
  };
  _appendSub(rec);
  _subs.push(rec);
  return { id: rec.id, url: rec.url, events: rec.events, secret: rec.secret, createdAt: rec.createdAt };
}

function unsubscribe(id) {
  const sub = _subs.find(s => s.id === id);
  if (!sub) return false;
  const tomb = { ...sub, active: false, deactivatedAt: new Date().toISOString() };
  _appendSub(tomb);
  _subs = _subs.filter(s => s.id !== id);
  return true;
}

function listSubs() {
  return _subs.map(s => ({ id: s.id, url: s.url, events: s.events, createdAt: s.createdAt }));
}

function _signBody(secret, body, ts) {
  const payload = ts + '.' + body;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${ts},v1=${sig}`;
}

function emit(event, payload) {
  if (!_started) start();
  const eventId = 'evt_' + crypto.randomBytes(9).toString('hex');
  const body = JSON.stringify({ id: eventId, event, payload, ts: new Date().toISOString() });
  let count = 0;
  for (const sub of _subs) {
    if (!sub.events.includes(event) && !sub.events.includes('*')) continue;
    _queue.push({
      eventId,
      subId: sub.id,
      url: sub.url,
      secret: sub.secret,
      body,
      event,
      attempt: 0,
      nextAt: Date.now(),
    });
    count++;
  }
  return { eventId, dispatched: count };
}

const RETRY_DELAYS = [1000, 5000, 25000]; // ms
const MAX_ATTEMPTS = 3;

async function _deliver(item) {
  const ts = Math.floor(Date.now() / 1000);
  const sigHeader = _signBody(item.secret, item.body, ts);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const r = await fetch(item.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'unicorn-webhooks/1.0',
        'X-Unicorn-Signature': sigHeader,
        'X-Unicorn-Event': item.event,
        'X-Unicorn-Event-Id': item.eventId,
        'X-Unicorn-Attempt': String(item.attempt + 1),
      },
      body: item.body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.status >= 200 && r.status < 300) {
      _appendDelivered({ eventId: item.eventId, subId: item.subId, status: r.status, attempt: item.attempt + 1, at: new Date().toISOString() });
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function _tick() {
  const now = Date.now();
  const ready = _queue.filter(q => q.nextAt <= now);
  if (!ready.length) return;
  // Process at most 16 concurrent — keep memory bounded.
  const batch = ready.slice(0, 16);
  await Promise.all(batch.map(async (item) => {
    const ok = await _deliver(item);
    const idx = _queue.indexOf(item);
    if (ok) {
      if (idx >= 0) _queue.splice(idx, 1);
      return;
    }
    item.attempt += 1;
    if (item.attempt >= MAX_ATTEMPTS) {
      _appendDlq({
        eventId: item.eventId, subId: item.subId, url: item.url,
        attempts: item.attempt, body: item.body, at: new Date().toISOString(),
      });
      if (idx >= 0) _queue.splice(idx, 1);
      return;
    }
    item.nextAt = Date.now() + RETRY_DELAYS[Math.min(item.attempt - 1, RETRY_DELAYS.length - 1)];
  }));
}

function start() {
  if (_started) return;
  _started = true;
  _loadSubs();
  setInterval(() => { _tick().catch(() => {}); }, 500).unref?.();
}

function getStats() {
  return {
    subscriptions: _subs.length,
    queueDepth: _queue.length,
    dlqExists: fs.existsSync(DLQ_FILE),
  };
}

module.exports = { subscribe, unsubscribe, listSubs, emit, start, getStats };
