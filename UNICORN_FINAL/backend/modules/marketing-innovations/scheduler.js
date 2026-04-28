// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/scheduler.js
//
// Best-time-to-post heuristics + drip campaign queue. In-memory queue
// of pending publish intents with an `at` timestamp. A single timer
// drains due items by calling `outboundPublisher.publish()`.
//
// Heuristics are seeded from public-domain literature (e.g. Sprout
// Social) and adjusted at runtime by feedback from `attribution`.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const QUEUE_FILE = process.env.MARKETING_SCHEDULER_QUEUE
  || path.join(DATA_DIR, 'scheduler-queue.jsonl');

const DISABLED = process.env.MARKETING_SCHEDULER_DISABLED === '1';
const TICK_MS = Math.max(1000, Number(process.env.MARKETING_SCHEDULER_TICK_MS) || 5_000);

let outboundPublisher = null; // lazy to avoid require cycles
function _publisher() {
  if (!outboundPublisher) {
    try { outboundPublisher = require('./outbound-publisher'); } catch (_) { outboundPublisher = null; }
  }
  return outboundPublisher;
}

const _queue = [];
let _timer = null;

// Hour-of-day weights per channel (0..23, UTC by default).
// Higher = better. These are seed values; can be overridden later.
const PRIME_TIMES = {
  X: [3,2,1,1,1,1,2,4,7,9,8,7,7,8,9,9,8,7,6,5,4,3,3,3],
  LinkedIn: [1,1,1,1,1,1,2,5,9,9,9,8,7,7,8,7,5,3,2,2,1,1,1,1],
  Reddit: [3,3,2,2,2,2,3,5,7,8,8,7,6,6,7,8,8,7,6,5,5,4,4,3],
  TikTok: [2,2,2,2,2,3,4,5,6,6,6,7,8,8,8,7,7,6,7,8,9,9,7,4],
  YouTube: [2,2,2,2,2,2,3,4,5,6,6,7,7,7,8,8,8,9,9,9,7,6,4,3],
  Instagram: [2,2,1,1,1,2,3,5,7,8,7,7,7,7,7,7,7,8,8,7,6,5,4,3],
  Email: [1,1,1,1,1,2,4,7,9,9,8,7,6,5,4,3,2,2,2,2,1,1,1,1],
  Facebook: [2,2,2,2,2,2,3,5,7,8,8,7,7,7,7,7,7,7,7,6,5,4,3,2],
  PushNotification: [1,1,1,1,1,1,2,4,5,5,5,5,5,5,5,5,5,5,6,7,8,7,5,2],
  SMS: [1,1,1,1,1,1,1,3,5,6,6,5,5,5,5,5,5,5,5,4,3,2,1,1],
  telegram: [2,2,1,1,1,2,3,5,7,8,8,7,7,7,7,7,7,8,8,7,6,5,4,3],
  discord: [3,3,2,2,2,2,3,5,7,8,8,7,7,7,7,7,7,8,9,9,8,7,5,4],
  mastodon: [2,2,1,1,1,1,2,4,6,7,7,6,6,7,7,7,6,5,5,4,3,3,2,2],
  rss: new Array(24).fill(5),
  bluesky: [2,2,1,1,1,1,2,4,6,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2],
  generic: new Array(24).fill(5),
};

function bestNextSlot(channel, fromMs) {
  const weights = PRIME_TIMES[channel] || PRIME_TIMES.generic;
  const base = new Date(fromMs || Date.now());
  let bestHour = -1, bestScore = -1, bestOffset = 0;
  for (let off = 0; off < 24; off++) {
    const h = (base.getUTCHours() + off) % 24;
    const score = weights[h];
    if (score > bestScore) { bestScore = score; bestHour = h; bestOffset = off; }
  }
  const target = new Date(base.getTime() + bestOffset * 3600_000);
  target.setUTCMinutes(0, 0, 0);
  if (target.getTime() <= base.getTime()) target.setTime(target.getTime() + 3600_000);
  return { hourUtc: bestHour, atMs: target.getTime(), iso: target.toISOString(), score: bestScore };
}

function _persist(evt) {
  try { fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true }); fs.appendFileSync(QUEUE_FILE, JSON.stringify(evt) + '\n'); } catch (_) {}
}

/**
 * Schedule a single intent.
 *   intent = { platform, body, atMs?, atIso?, autoBest?: boolean }
 */
function schedule(intent) {
  const i = intent || {};
  let atMs = Number(i.atMs);
  if (!atMs && i.atIso) atMs = Date.parse(i.atIso);
  if (!atMs && i.autoBest !== false) atMs = bestNextSlot(i.platform, Date.now()).atMs;
  if (!atMs) atMs = Date.now() + 60_000;
  const item = {
    id: 'SCH-' + crypto.randomBytes(4).toString('hex'),
    intent: { platform: i.platform, body: i.body, title: i.title, url: i.url },
    atMs,
    atIso: new Date(atMs).toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  _queue.push(item);
  _persist({ type: 'schedule', item });
  return item;
}

/**
 * Schedule a drip campaign: same body across N steps spaced by `everyMs`.
 */
function scheduleDrip(opts) {
  const o = opts || {};
  const steps = Math.max(1, Math.min(100, Number(o.steps) || 5));
  const every = Math.max(60_000, Number(o.everyMs) || 24 * 3600_000);
  const platforms = Array.isArray(o.platforms) && o.platforms.length ? o.platforms : ['rss'];
  const items = [];
  let t = Number(o.startAtMs) || Date.now() + every;
  for (let i = 0; i < steps; i++) {
    for (const p of platforms) {
      items.push(schedule({ platform: p, body: o.body, title: o.title, atMs: t, autoBest: false }));
    }
    t += every;
  }
  return { ok: true, count: items.length, items };
}

function listPending() {
  return _queue.filter((q) => q.status === 'pending').map((q) => ({ ...q }));
}
function cancel(id) {
  const it = _queue.find((q) => q.id === id);
  if (!it) return { ok: false, error: 'not_found' };
  if (it.status !== 'pending') return { ok: false, error: 'not_pending' };
  it.status = 'cancelled';
  _persist({ type: 'cancel', id });
  return { ok: true, item: it };
}

async function _drainOnce() {
  const pub = _publisher();
  const now = Date.now();
  const due = _queue.filter((q) => q.status === 'pending' && q.atMs <= now);
  for (const item of due) {
    item.status = 'sent';
    item.sentAt = new Date().toISOString();
    if (pub && pub.publish) {
      try { item.result = await pub.publish(item.intent); }
      catch (e) { item.result = { ok: false, error: 'send_failed' }; }
    } else {
      item.result = { ok: false, reason: 'publisher_unavailable' };
    }
    _persist({ type: 'sent', item });
  }
  return due.length;
}

function start() {
  if (DISABLED || _timer) return;
  _timer = setInterval(() => { _drainOnce().catch(() => {}); }, TICK_MS);
  if (_timer && typeof _timer.unref === 'function') _timer.unref();
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }

function status() {
  return {
    disabled: DISABLED,
    tickMs: TICK_MS,
    pending: _queue.filter((q) => q.status === 'pending').length,
    sent: _queue.filter((q) => q.status === 'sent').length,
    cancelled: _queue.filter((q) => q.status === 'cancelled').length,
    timerActive: !!_timer,
  };
}

function _resetForTests() { _queue.length = 0; stop(); }

if (!DISABLED) start();

module.exports = { schedule, scheduleDrip, cancel, listPending, bestNextSlot, start, stop, status, _drainOnce, _resetForTests };
