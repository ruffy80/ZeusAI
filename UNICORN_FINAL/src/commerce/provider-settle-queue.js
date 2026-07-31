'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce');
const QUEUE_FILE = path.join(DATA_DIR, 'settle-queue.jsonl');
const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;

const pending = new Map();
let started = false;
let timer = null;
let processing = false;
let lastError = null;

function nowIso() {
  return new Date().toISOString();
}

function append(record) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(QUEUE_FILE, JSON.stringify(record) + '\n');
}

function normalize(input) {
  const orderId = String(input && input.orderId || '').trim();
  const provider = String(input && input.provider || '').trim().toLowerCase();
  if (!/^ord_[a-zA-Z0-9_-]{6,64}$/.test(orderId)) throw new Error('settle_queue_invalid_order_id');
  if (!provider) throw new Error('settle_queue_provider_required');
  const providerRef = String(input.providerRef || input.paymentId || input.paypalOrderId || input.invoiceId || '').trim();
  return {
    id: 'psq_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10),
    orderId,
    provider,
    providerRef: providerRef || null,
    amountUsd: input.amountUsd != null && String(input.amountUsd).trim() !== '' ? Number(input.amountUsd) : undefined,
    invoiceId: input.invoiceId ? String(input.invoiceId).slice(0, 128) : undefined,
    meta: input.meta && typeof input.meta === 'object' ? input.meta : {},
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function load() {
  if (!fs.existsSync(QUEUE_FILE)) return;
  const lines = fs.readFileSync(QUEUE_FILE, 'utf8').split(/\n+/).filter(Boolean);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      if (!rec || !rec.id) continue;
      if (rec.event === 'settled' || rec.event === 'discarded') pending.delete(rec.id);
      else pending.set(rec.id, rec);
    } catch (_) {}
  }
}

function settleSecret() {
  return process.env.INTERNAL_SETTLE_SECRET
    || process.env.COMMERCE_ADMIN_SECRET
    || process.env.ADMIN_SECRET
    || process.env.ADMIN_TOKEN
    || '';
}

async function settle(record) {
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const base = String(process.env.UNICORN_SITE_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const body = {
    provider: record.provider,
    providerRef: record.providerRef || null,
    amountUsd: record.amountUsd,
    invoiceId: record.invoiceId,
    meta: record.meta || {},
  };
  const res = await fetch(base + '/api/order/' + encodeURIComponent(record.orderId) + '/provider-settle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-settle-secret': settleSecret(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((payload && (payload.error || payload.detail)) || ('settle_failed:' + res.status));
    err.status = res.status;
    throw err;
  }
  return payload;
}

function schedule(delayMs) {
  if (!started || timer) return;
  timer = setTimeout(() => {
    timer = null;
    processQueue().catch(() => {});
  }, Math.max(0, delayMs || 0));
  if (typeof timer.unref === 'function') timer.unref();
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    const due = Array.from(pending.values())
      .filter((r) => !r.settledAt && r.nextAttemptAt <= Date.now())
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
    for (const record of due) {
      try {
        record.attempts += 1;
        record.updatedAt = nowIso();
        append(Object.assign({}, record, { event: 'attempt' }));
        const result = await settle(record);
        pending.delete(record.id);
        append(Object.assign({}, record, { event: 'settled', settledAt: nowIso(), result }));
      } catch (e) {
        lastError = e && e.message ? e.message : String(e);
        if (record.attempts >= MAX_ATTEMPTS) {
          pending.delete(record.id);
          append(Object.assign({}, record, { event: 'discarded', discardedAt: nowIso(), error: lastError }));
          try {
            const zac = require('../../backend/modules/zacAlertChannel');
            if (zac && typeof zac.sendTelegram === 'function') {
              Promise.resolve(zac.sendTelegram([
                '🚨 *Provider settle queue discarded*',
                `Order: \`${record.orderId}\``,
                `Provider: \`${record.provider}\``,
                record.providerRef ? `Ref: \`${record.providerRef}\`` : null,
                `Attempts: ${record.attempts}/${MAX_ATTEMPTS}`,
                `Error: \`${String(lastError).slice(0, 180)}\``,
              ].filter(Boolean).join('\n'))).catch(() => {});
            }
          } catch (_) { /* Telegram alerts are best-effort */ }
        } else {
          const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, Math.max(0, record.attempts - 1)));
          record.nextAttemptAt = Date.now() + delay;
          record.updatedAt = nowIso();
          record.lastError = lastError;
          pending.set(record.id, record);
          append(Object.assign({}, record, { event: 'retry_scheduled' }));
        }
      }
    }
  } finally {
    processing = false;
    const next = Array.from(pending.values()).reduce((min, r) => Math.min(min, r.nextAttemptAt || Date.now()), Infinity);
    if (Number.isFinite(next)) schedule(Math.max(0, next - Date.now()));
  }
}

function enqueue(input) {
  const record = normalize(input || {});
  pending.set(record.id, record);
  append(Object.assign({}, record, { event: 'enqueued' }));
  schedule(0);
  return { ok: true, id: record.id, orderId: record.orderId, provider: record.provider };
}

function start() {
  if (started) return getStatus();
  started = true;
  load();
  schedule(0);
  return getStatus();
}

function getStatus() {
  return {
    ok: true,
    started,
    pending: pending.size,
    maxAttempts: MAX_ATTEMPTS,
    queueFile: QUEUE_FILE,
    lastError,
  };
}

module.exports = { enqueue, start, getStatus };
