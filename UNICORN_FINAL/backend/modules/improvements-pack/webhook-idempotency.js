// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.390Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/webhook-idempotency.js · #16
//
// Idempotency-key store for payment webhooks (Stripe/PayPal/BTCPay).
// Stores recently seen ids so duplicate deliveries are detected before any
// business logic runs. Persists to data/webhook-seen.jsonl so survival
// across restarts is guaranteed even without a database.
//
// Optional tamper-evident audit: when `auditAppender` is provided and the
// event is NEW, an audit entry is appended automatically (RFC-6962 chain
// from innovations-50y/tamper-evident-audit.js).
//
// Pure additive · zero deps.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const STORE_FILE = process.env.WEBHOOK_SEEN_FILE || path.join(DATA_DIR, 'webhook-seen.jsonl');
const TTL_MS = Math.max(60_000, Number(process.env.WEBHOOK_SEEN_TTL_MS) || 30 * 24 * 60 * 60 * 1000); // 30d

let _cache = null; // Map<id, { source, ts }>

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true }); } catch (_) {}
}

function _load() {
  if (_cache) return _cache;
  _cache = new Map();
  _ensureDir();
  let text = '';
  try { text = fs.readFileSync(STORE_FILE, 'utf8'); } catch (_) { text = ''; }
  if (text) {
    const now = Date.now();
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        const r = JSON.parse(line);
        if (!r || !r.id) continue;
        const ts = Number(r.ts) || 0;
        if (ts && (now - ts) > TTL_MS) continue;
        _cache.set(String(r.id), { source: r.source || '', ts });
      } catch (_) {}
    }
  }
  return _cache;
}

/**
 * Returns true if the webhook id was already seen.
 * Side-effect: marks NEW ids as seen and (optionally) appends to the audit.
 *
 * @param {string} id            unique webhook id (e.g. evt_xxx, txid)
 * @param {object} [opts]
 * @param {string} [opts.source] free-form provider tag (e.g. "stripe")
 * @param {object} [opts.auditAppender] object exposing append(event)
 * @returns {{seen:boolean, firstAt:string}}
 */
function seenWebhook(id, opts) {
  if (!id) throw new Error('webhook_id_required');
  const cache = _load();
  const key = String(id);
  if (cache.has(key)) {
    return { seen: true, firstAt: new Date(cache.get(key).ts).toISOString() };
  }
  const ts = Date.now();
  const source = (opts && opts.source) ? String(opts.source) : '';
  cache.set(key, { source, ts });
  try {
    _ensureDir();
    fs.appendFileSync(STORE_FILE, JSON.stringify({ id: key, source, ts }) + '\n', 'utf8');
  } catch (_) {}
  if (opts && opts.auditAppender && typeof opts.auditAppender.append === 'function') {
    try { opts.auditAppender.append({ kind: 'webhook.seen', source, id: key }); } catch (_) {}
  }
  return { seen: false, firstAt: new Date(ts).toISOString() };
}

function status() {
  const cache = _load();
  return { count: cache.size, file: STORE_FILE, ttlMs: TTL_MS };
}

function _resetForTests() { _cache = null; }

module.exports = { seenWebhook, status, _resetForTests, STORE_FILE };
