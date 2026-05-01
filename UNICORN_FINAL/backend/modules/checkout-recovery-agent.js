// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.092Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * checkout-recovery-agent (REAL implementation)
 * --------------------------------------------
 * Scans the SQLite portal for orders stuck in `awaiting_payment` past a
 * configurable cool-down (default 30 minutes) and returns the actionable
 * recovery list. If a transactional-email module is present, fires one
 * recovery email per order per 24h window (rate-limited in-process).
 *
 * Pure read-mostly; never auto-cancels or writes order status. Owner stays
 * in control. RO+EN comments preserved.
 */

const path = require('path');
const crypto = require('crypto');

const NAME = 'checkout-recovery-agent';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}
let mailer = null;
try { mailer = require(path.join(__dirname, 'transactional-email.js')); } catch (_) {}

const _sentLog = new Map(); // orderId → lastTs
const RECOVERY_WINDOW_MS = 24 * 3600 * 1000;
const STUCK_AFTER_MS_DEFAULT = 30 * 60 * 1000;

function _allOrders() {
  // Use portal's internal list if available; fall back to nothing.
  if (!portal) return [];
  // Best-effort: iterate via _stats + listOrdersByCustomer is too slow.
  // Use a private query via portal._listOrders if present.
  if (typeof portal._listOrders === 'function') return portal._listOrders();
  return [];
}

function scan(opts) {
  const now = Date.now();
  const stuckAfterMs = Math.max(60 * 1000, Number((opts && opts.stuckAfterMs) || STUCK_AFTER_MS_DEFAULT));
  const orders = _allOrders();
  const stuck = [];
  for (const o of orders) {
    if (!o || o.status !== 'awaiting_payment') continue;
    const created = Date.parse(o.createdAt || '') || 0;
    const ageMs = now - created;
    if (ageMs < stuckAfterMs) continue;
    stuck.push({
      orderId: o.id,
      customerId: o.customerId,
      productId: o.productId,
      priceUSD: o.priceUSD,
      btcAmount: o.btcAmount,
      btcAddress: o.btcAddress,
      invoiceUri: o.invoiceUri,
      ageMinutes: Math.floor(ageMs / 60000),
      createdAt: o.createdAt,
      lastRecoveryAt: _sentLog.get(o.id) ? new Date(_sentLog.get(o.id)).toISOString() : null
    });
  }
  stuck.sort((a, b) => b.ageMinutes - a.ageMinutes);
  return stuck;
}

function recover(opts) {
  const stuck = scan(opts);
  const dryRun = !!(opts && opts.dryRun);
  const sent = [];
  const skipped = [];
  for (const item of stuck) {
    const last = _sentLog.get(item.orderId) || 0;
    if (Date.now() - last < RECOVERY_WINDOW_MS) { skipped.push({ orderId: item.orderId, reason: 'cooldown' }); continue; }
    if (dryRun || !mailer || !portal) { skipped.push({ orderId: item.orderId, reason: dryRun ? 'dry_run' : 'no_mailer' }); _sentLog.set(item.orderId, Date.now()); continue; }
    const customer = item.customerId && typeof portal.getById === 'function' ? portal.getById(item.customerId) : null;
    if (!customer || !customer.email) { skipped.push({ orderId: item.orderId, reason: 'no_email' }); continue; }
    try {
      const subject = `Your Unicorn order ${item.orderId} — payment still pending`;
      const body = `Hello ${customer.name || customer.email},\n\nYour order ${item.orderId} (${item.productId}) for $${item.priceUSD} (≈ ${item.btcAmount} BTC) is awaiting payment for ${item.ageMinutes} minutes.\n\nPay any time at:\n${item.invoiceUri || ('bitcoin:' + item.btcAddress)}\n\nQuestions? Reply to this email.\n\n— ZeusAI / Unicorn`;
      if (typeof mailer.send === 'function') mailer.send({ to: customer.email, subject, text: body });
      _sentLog.set(item.orderId, Date.now());
      sent.push({ orderId: item.orderId, email: customer.email });
    } catch (e) {
      skipped.push({ orderId: item.orderId, reason: 'send_failed:' + (e && e.message || 'unknown') });
    }
  }
  return { ok: true, scannedAt: new Date().toISOString(), stuck: stuck.length, sent: sent.length, skipped: skipped.length, sentList: sent, skippedList: skipped };
}

function getStatus(opts) {
  const stuck = scan(opts);
  return {
    ok: true,
    name: NAME,
    title: 'Checkout Recovery Agent',
    domain: 'checkout-recovery',
    summary: 'Detects stuck awaiting_payment orders and triggers recovery emails (24h cooldown).',
    portalAttached: !!portal,
    mailerAttached: !!mailer,
    stuckCount: stuck.length,
    recoveriesEverSent: _sentLog.size,
    sample: stuck.slice(0, 5),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return recover(input); }

module.exports = { name: NAME, scan, recover, getStatus, run };
