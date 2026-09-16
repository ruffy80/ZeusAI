'use strict';

/**
 * MONEY PACK CONTINUUM — MPC/1.0
 *
 * Invention: paid money cannot silently die between on-chain settle and the
 * buyer's downloadable pack. Catalog, invoice poll, account, and retry share
 * one honest status. Never invents artifacts, visitors, or GMV.
 *
 * Kill-switch: ZEUS_MPC_DISABLED=1
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MPC/1.0';
const NAME = 'money-pack-continuum';

const DATA_DIR = process.env.COMMERCE_DATA_DIR
  || path.join(process.env.UNICORN_DATA_DIR || path.join(__dirname, '..', '..', 'data'), 'commerce');
const RETRY_FILE = path.join(DATA_DIR, 'mpc-retries.json');

const DISABLED = String(process.env.ZEUS_MPC_DISABLED || '') === '1';

let _retried = new Set();
let _loaded = false;

function _loadRetries() {
  if (_loaded) return;
  _loaded = true;
  try {
    if (!fs.existsSync(RETRY_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(RETRY_FILE, 'utf8'));
    const ids = Array.isArray(parsed && parsed.orderIds) ? parsed.orderIds : [];
    _retried = new Set(ids.map(String).slice(-500));
  } catch (_) { _retried = new Set(); }
}

function _saveRetries() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RETRY_FILE, JSON.stringify({
      protocol: PROTOCOL,
      savedAt: new Date().toISOString(),
      orderIds: [..._retried].slice(-500),
    }));
  } catch (_) { /* never break settle */ }
}

function _registry() {
  try { return require('../site/v2/delivery-registry'); } catch (_) { return null; }
}

function enrichOrderStatus(order) {
  const out = {
    protocol: PROTOCOL,
    fulfillmentStatus: order && order.status === 'paid' ? 'queued' : 'n/a',
    artifactsReady: false,
    deliveryReady: false,
    packGenerating: false,
  };
  if (DISABLED || !order || order.status !== 'paid') return out;
  try {
    const registry = _registry();
    const d = registry && typeof registry.get === 'function' ? registry.get(order.orderId) : null;
    if (!d) {
      out.packGenerating = true;
      out.fulfillmentStatus = 'queued';
      return out;
    }
    const artifacts = Array.isArray(d.artifacts) ? d.artifacts : [];
    out.fulfillmentStatus = d.fulfillmentStatus || d.status || 'unknown';
    out.artifactsReady = artifacts.length > 0;
    out.deliveryReady = out.artifactsReady || String(d.status || '') === 'delivered';
    out.packGenerating = !out.deliveryReady;
  } catch (_) { /* honest unknown stays queued */ }
  return out;
}

function deliveryHref(orderId, accessToken) {
  const id = encodeURIComponent(String(orderId || '').trim());
  if (!id) return null;
  const base = `/api/delivery/${id}`;
  const tok = String(accessToken || '').trim();
  return tok ? `${base}?access_token=${encodeURIComponent(tok)}` : base;
}

function recoverPaidUndelivered(orderIterable, fireDelivery, opts) {
  if (DISABLED) return { ok: false, reason: 'disabled', retried: 0 };
  if (typeof fireDelivery !== 'function') return { ok: false, reason: 'no_fire', retried: 0 };
  _loadRetries();
  const minAgeMs = Math.max(15_000, Number((opts && opts.minAgeMs) || 2 * 60 * 1000));
  const now = Date.now();
  const orders = orderIterable && typeof orderIterable.values === 'function'
    ? [...orderIterable.values()]
    : (Array.isArray(orderIterable) ? orderIterable : []);
  const fired = [];
  for (const o of orders) {
    if (!o || o.status !== 'paid' || !o.orderId) continue;
    const paidAt = Date.parse(o.paid_at || '') || 0;
    if (paidAt && (now - paidAt) < minAgeMs) continue;
    const st = enrichOrderStatus(o);
    if (st.deliveryReady) continue;
    const key = String(o.orderId);
    if (_retried.has(key)) continue;
    _retried.add(key);
    try { fireDelivery(o); fired.push(key); } catch (_) { /* next order */ }
  }
  if (fired.length) _saveRetries();
  return { ok: true, protocol: PROTOCOL, retried: fired.length, orderIds: fired };
}

function discovery() {
  return {
    ok: true,
    module: NAME,
    protocol: PROTOCOL,
    invention: 'Paid money surfaces pack status and auto-retries missing artifacts.',
    honesty: 'Never invents artifacts, visitors, or GMV.',
    disabled: DISABLED,
  };
}

function _resetForTests() {
  _retried = new Set();
  _loaded = false;
  try { if (fs.existsSync(RETRY_FILE)) fs.unlinkSync(RETRY_FILE); } catch (_) { /* ignore */ }
}

module.exports = {
  NAME,
  PROTOCOL,
  enrichOrderStatus,
  deliveryHref,
  recoverPaidUndelivered,
  discovery,
  _resetForTests,
};
