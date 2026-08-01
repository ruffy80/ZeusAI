// commerce/pay-fulfill.js — Unified pay → fulfill → notify glue.
//
// Purpose: BTC, PayPal, and Stripe payments each have their own confirmation
// path in the site/backend. Historically each path sent slightly different
// (or no) email notifications, and there was no single guard against re-running
// the full delivery pipeline if the same payment webhook fired twice. This
// module gives every payment rail a common, idempotent tail:
//
//   1. Guard against double-delivery per orderId (persistent JSONL ledger).
//   2. Run the shared delivery function (deliveryRegistry / fulfillment-engine).
//   3. Send `order_receipt` and (when artifacts land) `delivery_artifact` emails
//      via src/commerce/transactional-email.js. If email is unconfigured, log
//      that fact fail-honestly and continue — we NEVER pretend an email was sent.
//
// The module deliberately keeps the surface small so it can be safely called
// from fire-and-forget code paths without breaking existing flows.

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR
  || process.env.COMMERCE_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'commerce');
const LEDGER_FILE = path.join(DATA_DIR, 'fulfill-ledger.jsonl');

// In-memory dedup set backed by a persistent JSONL for restart-safety.
// Entries are added in two flavours:
//   `delivered:<orderId>` — full delivery ran end-to-end
//   `receipt:<orderId>`   — order_receipt email was sent
//   `artifact:<orderId>`  — delivery_artifact email was sent
const _seen = new Set();
let _loaded = false;

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function _loadLedger() {
  if (_loaded) return;
  _loaded = true;
  try {
    if (!fs.existsSync(LEDGER_FILE)) return;
    const raw = fs.readFileSync(LEDGER_FILE, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry && entry.key) _seen.add(entry.key);
      } catch (_) { /* skip corrupt line */ }
    }
  } catch (e) {
    console.warn('[pay-fulfill] ledger load failed:', e.message);
  }
}

function _record(key, extra) {
  _loadLedger();
  if (_seen.has(key)) return false;
  _seen.add(key);
  try {
    ensureDir();
    fs.appendFileSync(
      LEDGER_FILE,
      JSON.stringify({ key, at: new Date().toISOString(), ...(extra || {}) }) + '\n',
      'utf8'
    );
  } catch (e) {
    console.warn('[pay-fulfill] ledger persist failed:', e.message);
  }
  return true;
}

function hasRunDelivery(orderId) {
  if (!orderId) return false;
  _loadLedger();
  return _seen.has('delivered:' + orderId);
}

// Idempotent wrapper: invokes deliveryFn(receipt) at most once per orderId.
// Callers should still pass the receipt through their existing persistence
// (this module only guards against double-delivery, not order state).
function runDeliveryOnce(receipt, deliveryFn) {
  const orderId = receiptOrderId(receipt);
  if (!orderId || typeof deliveryFn !== 'function') {
    return { ok: false, reason: 'invalid_input' };
  }
  const key = 'delivered:' + orderId;
  _loadLedger();
  if (_seen.has(key)) return { ok: true, alreadyDelivered: true, orderId };
  let delivery = null;
  try {
    delivery = deliveryFn(receipt);
  } catch (e) {
    console.warn('[pay-fulfill] deliveryFn threw for order=' + orderId + ':', e.message);
    return { ok: false, orderId, error: e.message };
  }
  _record(key, { hasDelivery: !!delivery });
  return { ok: true, alreadyDelivered: false, orderId, delivery };
}

function receiptOrderId(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  return String(receipt.orderId || receipt.id || receipt.receiptId || '').trim() || null;
}

function receiptEmail(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const raw = receipt.customerEmail
    || receipt.email
    || (receipt.buyer && receipt.buyer.email)
    || '';
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null;
}

function receiptServiceName(receipt) {
  if (!receipt) return null;
  return receipt.serviceName
    || receipt.productName
    || receipt.plan
    || (Array.isArray(receipt.services) && receipt.services[0])
    || null;
}

function receiptServiceId(receipt) {
  if (!receipt) return null;
  return receipt.serviceId
    || receipt.productId
    || (Array.isArray(receipt.services) && receipt.services[0])
    || receipt.plan
    || null;
}

function _mailer() {
  try { return require('./transactional-email'); }
  catch (_) { return null; }
}

// Send the itemized order_receipt email (idempotent per orderId).
// Fail-honest: returns { ok:false, reason:'email_unconfigured' } when no
// transport is configured; the caller can log/surface without pretending.
async function sendOrderReceiptEmail(receipt) {
  const orderId = receiptOrderId(receipt);
  const to = receiptEmail(receipt);
  if (!orderId) return { ok: false, error: 'missing_orderId' };
  if (!to) return { ok: false, error: 'missing_email' };
  const key = 'receipt:' + orderId;
  _loadLedger();
  if (_seen.has(key)) return { ok: true, alreadyEmailed: true, orderId };
  const mailer = _mailer();
  if (!mailer) return { ok: false, error: 'mailer_unavailable' };
  let railPatch = {};
  try {
    const pcos = require('./perfection-continuum-os');
    railPatch = pcos.receiptEmailPatch(receipt) || {};
  } catch (_) { railPatch = {}; }
  const data = {
    orderId,
    serviceId: receiptServiceId(receipt),
    serviceName: receiptServiceName(receipt),
    priceUSD: Number(receipt.amount || receipt.subtotal_fiat || receipt.priceUSD || 0),
    amount_btc: receipt.amount_btc || receipt.btcAmount || null,
    btcAmount: receipt.amount_btc || receipt.btcAmount || null,
    txid: receipt.txid || (receipt.confirmation && receipt.confirmation.txid) || null,
    paid_at: receipt.paidAt || receipt.paid_at || null,
    paid_via: railPatch.paid_via || receipt.paid_via || receipt.paidVia || null,
    providerRef: railPatch.providerRef || receipt.providerRef || null,
  };
  try {
    const r = await mailer.sendTransactional({ to, template: 'order_receipt', data });
    if (r && r.ok) {
      _record(key, { provider: r.provider || null, messageId: r.messageId || null });
      return { ok: true, alreadyEmailed: false, orderId, provider: r.provider };
    }
    if (r && r.reason === 'email_unconfigured') {
      console.warn('[pay-fulfill] order_receipt NOT sent (email_unconfigured) order=' + orderId + ' to=' + to);
      return { ok: false, orderId, reason: 'email_unconfigured' };
    }
    console.warn('[pay-fulfill] order_receipt send failed order=' + orderId + ':', (r && r.error) || 'unknown');
    return { ok: false, orderId, error: (r && r.error) || 'unknown' };
  } catch (e) {
    console.warn('[pay-fulfill] order_receipt threw order=' + orderId + ':', e.message);
    return { ok: false, orderId, error: e.message };
  }
}

// Send the delivery_artifact link email once artifacts are available. Idempotent
// per orderId. Best-effort — never throws.
async function sendDeliveryArtifactEmail(receipt, deliveryPackage) {
  const orderId = receiptOrderId(receipt);
  const to = receiptEmail(receipt);
  if (!orderId) return { ok: false, error: 'missing_orderId' };
  if (!to) return { ok: false, error: 'missing_email' };
  const key = 'artifact:' + orderId;
  _loadLedger();
  if (_seen.has(key)) return { ok: true, alreadyEmailed: true, orderId };
  const mailer = _mailer();
  if (!mailer) return { ok: false, error: 'mailer_unavailable' };
  const artifacts = _summarizeArtifacts(deliveryPackage);
  const publicBase = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://zeusai.pro').replace(/\/$/, '');
  // Prefer a signed order-access token when the portal supports it — the link
  // then works for anonymous buyers (no account/login required) but is bound
  // to this one order. Falls back to a plain /account?order=… URL otherwise.
  let deliveryUrl = publicBase + '/account?order=' + encodeURIComponent(orderId);
  try {
    const portal = require('./customer-portal');
    if (portal && typeof portal.signOrderAccessToken === 'function') {
      const tok = portal.signOrderAccessToken(orderId, { ttlMs: 90 * 24 * 3600 * 1000 });
      if (tok) deliveryUrl = publicBase + '/account?order=' + encodeURIComponent(orderId) + '&token=' + encodeURIComponent(tok);
    }
  } catch (_) { /* keep plain URL */ }
  const data = {
    orderId,
    serviceId: receiptServiceId(receipt),
    serviceName: receiptServiceName(receipt),
    artifactCount: artifacts.length,
    artifacts,
    deliveryUrl
  };
  try {
    const r = await mailer.sendTransactional({ to, template: 'delivery_artifact', data });
    if (r && r.ok) {
      _record(key, { provider: r.provider || null, messageId: r.messageId || null, count: artifacts.length });
      return { ok: true, alreadyEmailed: false, orderId, provider: r.provider };
    }
    if (r && r.reason === 'email_unconfigured') {
      console.warn('[pay-fulfill] delivery_artifact NOT sent (email_unconfigured) order=' + orderId + ' to=' + to);
      return { ok: false, orderId, reason: 'email_unconfigured' };
    }
    console.warn('[pay-fulfill] delivery_artifact send failed order=' + orderId + ':', (r && r.error) || 'unknown');
    return { ok: false, orderId, error: (r && r.error) || 'unknown' };
  } catch (e) {
    console.warn('[pay-fulfill] delivery_artifact threw order=' + orderId + ':', e.message);
    return { ok: false, orderId, error: e.message };
  }
}

// Reduce a delivery/fulfillment record to the small { filename, title, kind }
// list the delivery_artifact template can list bilingually.
function _summarizeArtifacts(pkg) {
  if (!pkg || typeof pkg !== 'object') return [];
  const out = [];
  const files = [];
  if (Array.isArray(pkg.items)) {
    for (const it of pkg.items) {
      for (const f of (Array.isArray(it.files) ? it.files : [])) files.push(f);
    }
  }
  if (Array.isArray(pkg.artifacts)) {
    for (const a of pkg.artifacts) files.push(a);
  }
  if (Array.isArray(pkg.deliverables)) {
    for (const d of pkg.deliverables) files.push(d);
  }
  for (const f of files) {
    if (!f) continue;
    out.push({
      filename: f.filename || f.name || null,
      title: f.title || f.recipe || null,
      kind: f.kind || null
    });
  }
  return out;
}

// One-shot high-level entrypoint: run delivery (once) + fire both emails
// (each once). Safe to call from any payment-confirmation path.
function _recordFunnel(stage, receipt, extra) {
  try {
    const funnel = require('../../backend/modules/funnel-intelligence');
    if (!funnel || typeof funnel.record !== 'function') return;
    funnel.record({
      event: stage,
      stage,
      serviceId: receipt && (receipt.serviceId || receipt.productId || receipt.plan || null),
      productId: receipt && (receipt.productId || receipt.serviceId || null),
      value: receipt && (receipt.amount || receipt.priceUSD || receipt.amountUsd || 0),
      amountUsd: receipt && (receipt.amount || receipt.priceUSD || receipt.amountUsd || 0),
      orderId: receipt && (receipt.orderId || receipt.id || null),
      sessionId: receipt && (receipt.sessionId || receipt.orderId || receipt.id || null),
      ...(extra || {}),
    });
  } catch (_) { /* never break settle */ }
}

async function settleAndNotify({ receipt, deliveryFn, source }) {
  const orderId = receiptOrderId(receipt);
  const result = { orderId, source: source || 'unknown', delivery: null, emails: {}, eop: null, funnel: {} };
  if (!orderId) return { ok: false, error: 'missing_orderId' };
  // Buy→paid truth: every confirmed settle records paid (idempotent at funnel day grain).
  _recordFunnel('checkout_paid', receipt, { source: source || 'pay-fulfill' });
  result.funnel.paid = true;
  if (typeof deliveryFn === 'function') {
    const delivered = runDeliveryOnce(receipt, deliveryFn);
    result.delivery = delivered;
    if (delivered && (delivered.ok || delivered.delivery || delivered.alreadyDelivered)) {
      _recordFunnel('delivered', receipt, { source: source || 'pay-fulfill' });
      result.funnel.delivered = true;
    }
  }
  // order_receipt first (works even without a delivery package)
  result.emails.receipt = await sendOrderReceiptEmail(receipt);
  // delivery_artifact only when we actually have artifacts to point at
  const pkg = result.delivery && result.delivery.delivery;
  if (pkg && (Array.isArray(pkg.items) || Array.isArray(pkg.artifacts) || Array.isArray(pkg.deliverables))) {
    result.emails.artifact = await sendDeliveryArtifactEmail(receipt, pkg);
    if (!result.funnel.delivered) {
      _recordFunnel('delivered', receipt, { source: source || 'pay-fulfill', via: 'artifact_email' });
      result.funnel.delivered = true;
    }
  }
  // Earth Outcome Protocol — mint interdomain passport (never fail settlement)
  try {
    const eop = require('../../backend/modules/earth-outcome-protocol');
    if (eop && typeof eop.mintFromSettlement === 'function') {
      result.eop = eop.mintFromSettlement(receipt, result.delivery, source || 'pay-fulfill');
    }
  } catch (_) { /* additive */ }
  return { ok: true, ...result };
}

// Test helper: forget all persisted state so tests can re-run without stray
// idempotency hits from previous runs. Not exported by default — access via
// `require('./pay-fulfill')._resetForTests()`.
function _resetForTests() {
  _seen.clear();
  _loaded = false;
  try { if (fs.existsSync(LEDGER_FILE)) fs.unlinkSync(LEDGER_FILE); } catch (_) { /* ignore */ }
}

module.exports = {
  runDeliveryOnce,
  hasRunDelivery,
  sendOrderReceiptEmail,
  sendDeliveryArtifactEmail,
  settleAndNotify,
  _resetForTests
};
