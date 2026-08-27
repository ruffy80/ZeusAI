'use strict';

/**
 * Post-Pay Closure OS (PPCOS/1.0)
 *
 * After a sovereign order settles, close the commercial loop honestly:
 *  1. Open CLOS cycle (paid)
 *  2. Ack digital fulfillment when delivery fires
 *  3. Notify owner of first/next sale (Telegram)
 *  4. Ensure buyer referral code exists for retain/refer
 *
 * Never invents GMV. Best-effort — never throws into settle path.
 */

const PROTOCOL = 'PPCOS/1.0';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro').replace(/\/+$/, '');

const _counts = {
  onPaid: 0,
  closOpened: 0,
  closAcked: 0,
  saleNotifies: 0,
  referralMints: 0,
  omegaBootstraps: 0,
  omegaDeliveries: 0,
  errors: 0,
};

// Omega Ecosystem OS (OMEGA/1.0): every paid order becomes a living instance
// with all 20 universal engines. Loaded lazily + fail-soft — never blocks settle.
function _omega() {
  try { return require('../../backend/modules/omega-ecosystem-os'); } catch (_) { return null; }
}
function _genome() {
  try { return require('../../backend/modules/ai-genome-engine'); } catch (_) { return null; }
}
function _dna() {
  try { return require('../../backend/modules/ai-dna-engine'); } catch (_) { return null; }
}

function _orderPayload(order) {
  const email = String((order && order.buyer && order.buyer.email) || order.email || '').trim().toLowerCase();
  return {
    orderId: order && (order.orderId || order.id),
    serviceId: order && order.serviceId,
    serviceName: order && order.serviceName,
    email,
    amountUsd: Number(order && (order.subtotal_fiat != null ? order.subtotal_fiat : order.amount_usd)) || 0,
    rail: order && (order.paid_via || 'btc'),
    paidAt: order && order.paid_at,
    txid: order && order.txids && order.txids[0] || null,
    entitlementId: order && order.entitlement_id || null,
  };
}

async function notifySale(order) {
  const p = _orderPayload(order);
  if (!p.orderId) return { ok: false, reason: 'missing_order' };
  const text = [
    '💰 ZeusAI sale settled',
    `Order: ${p.orderId}`,
    `Service: ${p.serviceName || p.serviceId || '—'}`,
    `Amount: $${p.amountUsd} via ${p.rail}`,
    p.email ? `Buyer: ${p.email}` : null,
    p.txid ? `Tx: ${p.txid}` : null,
    p.entitlementId ? `Entitlement: ${p.entitlementId}` : null,
    `Account: ${APP_URL}/account`,
    `Receipt: ${APP_URL}/checkout/${encodeURIComponent(p.orderId)}/receipt`,
  ].filter(Boolean).join('\n');
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      await Promise.resolve(zac.sendTelegram(text));
      _counts.saleNotifies += 1;
      return { ok: true, channel: 'telegram' };
    }
  } catch (_) { /* ignore */ }
  return { ok: false, reason: 'telegram_unavailable' };
}

function mintBuyerReferral(order) {
  const p = _orderPayload(order);
  if (!p.email) return { ok: false, reason: 'no_email' };
  try {
    const ref = require('./referral-engine-real');
    if (!ref || typeof ref.ensureTrackedCode !== 'function') {
      return { ok: false, reason: 'referral_engine_unavailable' };
    }
    // Deterministic-ish code from email hash prefix for stickiness
    const crypto = require('crypto');
    const code = ('Z' + crypto.createHash('sha256').update(p.email).digest('hex').slice(0, 8)).toUpperCase();
    const out = ref.ensureTrackedCode(code, { ownerEmail: p.email, source: 'post-pay-closure' });
    _counts.referralMints += 1;
    return { ok: true, code: (out && out.code) || code, shareUrl: APP_URL + '/buy?ref=' + encodeURIComponent((out && out.code) || code) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}

function openClos(order) {
  try {
    const clos = require('../../backend/modules/closed-loop-commerce-os');
    if (!clos || typeof clos.openCycle !== 'function') return { ok: false, reason: 'clos_unavailable' };
    const p = _orderPayload(order);
    const opened = clos.openCycle({
      orderId: p.orderId,
      serviceId: p.serviceId,
      email: p.email,
      amountUsd: p.amountUsd,
      rail: p.rail,
      paidAt: p.paidAt,
      txid: p.txid,
      provider: p.rail,
    });
    if (opened && opened.ok) _counts.closOpened += 1;
    return opened;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}

function ackClosFulfillment(order, mode) {
  try {
    const clos = require('../../backend/modules/closed-loop-commerce-os');
    if (!clos || typeof clos.ackFulfillment !== 'function') return { ok: false, reason: 'clos_unavailable' };
    const p = _orderPayload(order);
    const ack = clos.ackFulfillment({
      orderId: p.orderId,
      mode: mode || 'digital_delivery',
      serviceId: p.serviceId,
      email: p.email,
      amountUsd: p.amountUsd,
      rail: p.rail,
    });
    if (ack && ack.ok) _counts.closAcked += 1;
    return ack;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e).slice(0, 120) };
  }
}

/**
 * Call from settle path after order is marked paid (sync, fail-open).
 */
function onOrderPaid(order) {
  _counts.onPaid += 1;
  const result = {
    protocol: PROTOCOL,
    orderId: order && (order.orderId || order.id) || null,
    clos: null,
    referral: null,
    notify: null,
    omega: null,
    genome: null,
    dna: null,
  };
  // Omega Ecosystem OS — spin up the living instance for this order (fail-soft).
  try {
    const omega = _omega();
    if (omega && typeof omega.onOrderPaid === 'function') {
      result.omega = omega.onOrderPaid(order);
      if (result.omega && result.omega.ok) _counts.omegaBootstraps += 1;
    }
  } catch (e) {
    _counts.errors += 1;
    result.omega = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  // AI Genome Engine — living DNA for the sold SKU (fail-soft).
  try {
    const genome = _genome();
    if (genome && typeof genome.onOrderPaid === 'function') {
      result.genome = genome.onOrderPaid(order);
    }
  } catch (e) {
    result.genome = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  // AI DNA Engine — adaptive intelligence strand for the buyer (fail-soft).
  // Omega/genome results are passed through so the strand bonds to the ids
  // already computed above instead of re-resolving them.
  try {
    const dna = _dna();
    if (dna && typeof dna.onOrderPaid === 'function') {
      result.dna = dna.onOrderPaid(Object.assign({}, order, {
        omega: result.omega,
        genome: result.genome,
      }));
    }
  } catch (e) {
    result.dna = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  try {
    result.clos = openClos(order);
  } catch (e) {
    _counts.errors += 1;
    result.clos = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  try {
    result.referral = mintBuyerReferral(order);
  } catch (e) {
    _counts.errors += 1;
    result.referral = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  // Notify async — don't block settle
  try {
    Promise.resolve(notifySale(order)).then((n) => { result.notify = n; }).catch(() => {});
  } catch (_) { /* ignore */ }
  // RIVOS/1.0 — Paid-Evidence Catalog Gravity + Causal Yield Mirror (fail-soft)
  try {
    const rivos = require('./revenue-invention-continuum-os');
    if (rivos && typeof rivos.onPaid === 'function') {
      result.rivos = rivos.onPaid(order);
    }
  } catch (e) {
    result.rivos = { ok: false, error: String(e && e.message || e).slice(0, 80) };
  }
  return result;
}

/**
 * Call when delivery pack is generated (digital ack).
 */
function onDeliveryFired(order) {
  // Omega Ecosystem OS — confirm the living instance is live (fail-soft).
  try {
    const omega = _omega();
    if (omega && typeof omega.onDeliveryFired === 'function') {
      const r = omega.onDeliveryFired(order);
      if (r && r.ok) _counts.omegaDeliveries += 1;
    }
  } catch (_) { /* never block delivery ack */ }
  return ackClosFulfillment(order, 'digital_delivery');
}

function status() {
  return {
    ok: true,
    protocol: PROTOCOL,
    counts: Object.assign({}, _counts),
    honesty: 'Post-pay closure records real paid→fulfillment cycles only.',
  };
}

module.exports = {
  PROTOCOL,
  onOrderPaid,
  onDeliveryFired,
  notifySale,
  mintBuyerReferral,
  openClos,
  ackClosFulfillment,
  status,
  _counts,
};
