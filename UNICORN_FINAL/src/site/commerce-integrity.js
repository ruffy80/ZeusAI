// =============================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =============================================================================
/**
 * commerce-integrity.js — Enterprise Standard OS (ESOS/1.0) money-path verifier.
 * ----------------------------------------------------------------------------
 * Reads the append-only sovereign-commerce ledgers (orders.jsonl +
 * entitlements.jsonl) and checks the money path for integrity WITHOUT touching
 * any money logic. Entitlement signatures are validated through the exact same
 * Ed25519 verify path used by sovereign-commerce (reused via its exported
 * verifyEntitlement helper), so this module cannot drift from the signer.
 *
 * Checks performed:
 *   • every PAID order has a matching entitlement
 *   • orphan entitlements (entitlement references a missing order)
 *   • duplicate amount_sats among still-pending orders (payment-matching relies
 *     on unique amounts; a collision would credit the wrong order)
 *   • entitlement signature failures (forged / unsigned / tampered)
 *
 * Privacy: issues NEVER carry buyer emails or PII. Public issue identifiers
 * (orderId / entitlement_id) are additionally redacted to short one-way
 * sha256 hashes (`ref` field) so raw order/entitlement ids are never exposed
 * in the public /api/commerce/integrity body. Counts stay exact.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// One-way short reference for a public identifier: sha256 hex, first 12 chars.
// Enough to correlate two issues about the same id without leaking the raw id.
function _ref(id) {
  if (id == null || id === '') return null;
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 12);
}

function _readJsonl(file) {
  const out = [];
  try {
    if (!fs.existsSync(file)) return out;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;
      try { out.push(JSON.parse(l)); } catch (_) { /* skip malformed line */ }
    }
  } catch (_) { /* unreadable ledger → treated as empty */ }
  return out;
}

function verify(opts = {}) {
  const dataDir = opts.dataDir
    || process.env.COMMERCE_DATA_DIR
    || path.join(process.cwd(), 'data', 'commerce');

  const ordersRaw = _readJsonl(path.join(dataDir, 'orders.jsonl'));
  const entRaw = _readJsonl(path.join(dataDir, 'entitlements.jsonl'));

  // Ledgers are append-only logs — collapse to the latest state per id.
  const orders = new Map();
  for (const o of ordersRaw) { if (o && o.orderId) orders.set(o.orderId, o); }
  const ents = new Map();
  for (const e of entRaw) { if (e && e.entitlement_id) ents.set(e.entitlement_id, e); }

  const entByOrder = new Map();
  for (const e of ents.values()) { if (e.orderId) entByOrder.set(e.orderId, e); }

  // Reuse the sovereign-commerce Ed25519 verify path (never reimplement it).
  let verifyEntitlement = null;
  try { verifyEntitlement = require('./sovereign-commerce').verifyEntitlement; } catch (_) { verifyEntitlement = null; }

  const issues = [];

  // Check 1: every paid order must have an entitlement.
  let paidOrders = 0;
  for (const o of orders.values()) {
    if (o.status !== 'paid') continue;
    paidOrders++;
    if (!entByOrder.has(o.orderId) && !o.entitlement_id) {
      issues.push({ type: 'paid_order_missing_entitlement', order_ref: _ref(o.orderId) });
    }
  }

  // Check 2: orphan entitlements (reference an order that does not exist).
  for (const e of ents.values()) {
    if (e.orderId && !orders.has(e.orderId)) {
      issues.push({ type: 'orphan_entitlement', order_ref: _ref(e.orderId), entitlement_ref: _ref(e.entitlement_id) });
    }
  }

  // Check 3: duplicate amount_sats among pending orders (payment-match hazard).
  const pendingByAmount = new Map();
  for (const o of orders.values()) {
    if (o.status !== 'pending') continue;
    const amt = Number(o.amount_sats || 0);
    if (!amt) continue;
    if (pendingByAmount.has(amt)) {
      issues.push({ type: 'duplicate_pending_amount', order_ref: _ref(o.orderId), amount_sats: amt });
    } else {
      pendingByAmount.set(amt, o.orderId);
    }
  }

  // Check 4: entitlement signature verification.
  let sigChecked = 0;
  let sigFailures = 0;
  if (typeof verifyEntitlement === 'function') {
    for (const e of ents.values()) {
      sigChecked++;
      let ok = false;
      try { ok = !!verifyEntitlement(e); } catch (_) { ok = false; }
      if (!ok) {
        sigFailures++;
        issues.push({ type: 'signature_verification_failed', order_ref: _ref(e.orderId), entitlement_ref: _ref(e.entitlement_id) });
      }
    }
  }

  const counts = {
    orders: orders.size,
    paid_orders: paidOrders,
    entitlements: ents.size,
    signatures_checked: sigChecked,
    signature_failures: sigFailures,
    issues: issues.length,
  };

  // Deterministic score: start at 100, deduct 10 per issue, floor at 0.
  const score = Math.max(0, 100 - issues.length * 10);

  return {
    ok: issues.length === 0,
    protocol: 'ESOS/1.0',
    counts,
    issues,
    score,
    ts: new Date().toISOString(),
  };
}

module.exports = { verify };
