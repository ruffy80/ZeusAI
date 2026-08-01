'use strict';

/**
 * Payment Innovation OS (PIOS/1.0)
 *
 * Present + future payment innovations for ZeusAI sovereign commerce:
 *  - Multi-rail pay-pack (BTC + armed PayPal + armed NOWPayments on one order)
 *  - Preferred-rail memory helpers
 *  - Rail failover messaging
 *  - Settlement / rail telemetry (append-only, fail-open)
 *  - NOWPayments partial-paid honesty enrichment
 *  - Multi-rail pending email payload builder
 *
 * Honesty: never invent PayPal/NOW URLs when rails are not armed / settleReady.
 * BTC remains the always-on primary settle path.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'PIOS/1.0';
const DATA_DIR = process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce');
const TELEMETRY_FILE = path.join(DATA_DIR, 'payment-telemetry.jsonl');
const MAX_TELEMETRY_LINES = 4000;

const _counts = {
  pay_pack_built: 0,
  pay_pack_mint_paypal: 0,
  pay_pack_mint_now: 0,
  pay_pack_mint_fail: 0,
  rail_failover: 0,
  preferred_rail_hit: 0,
  partial_paid_seen: 0,
};

function _alt() {
  try { return require('./alt-rails-os'); } catch (_) { return null; }
}

function normalizeRail(rail) {
  const r = String(rail || '').trim().toLowerCase();
  if (r === 'btc' || r === 'bitcoin') return 'btc';
  if (r === 'paypal' || r === 'pp') return 'paypal';
  if (r === 'nowpayments' || r === 'now' || r === 'card' || r === 'crypto') return 'nowpayments';
  return null;
}

function armedRailsHonesty() {
  const alt = _alt();
  const paypalArmed = !!(alt && alt.isPaypalArmed && alt.isPaypalArmed());
  const nowArmed = !!(alt && alt.isNowPaymentsArmed && alt.isNowPaymentsArmed());
  const nowIpn = !!(alt && alt.isNowPaymentsIpnArmed && alt.isNowPaymentsIpnArmed());
  return {
    protocol: PROTOCOL,
    btc: { armed: true, settleReady: true, primary: true, label: 'Bitcoin' },
    paypal: {
      armed: paypalArmed,
      // Align with getPaymentConfigStatus(): credentials + PAYPAL_WEBHOOK_ID.
      settleReady: paypalArmed && !!String(process.env.PAYPAL_WEBHOOK_ID || '').trim(),
      primary: false,
      label: 'PayPal',
    },
    nowpayments: {
      armed: nowArmed,
      settleReady: nowArmed && nowIpn,
      primary: false,
      label: 'Card / crypto (NOWPayments)',
    },
    honesty: 'PayPal/NOW appear only when credentials + settle webhooks/IPN are armed.',
  };
}

function buildBtcRail(order) {
  if (!order || !order.orderId) return null;
  return {
    id: 'btc',
    primary: true,
    amountBtc: order.amount_btc,
    amountSats: order.amount_sats,
    address: order.receive_address,
    bip21: order.bip21,
    qrUrl: order.qr_url || (order.checkout_url ? (String(order.checkout_url).replace(/\/?$/, '') + '/qr.svg') : null),
    checkoutUrl: order.checkout_url,
    discountPct: order.btc_discount_pct != null ? order.btc_discount_pct : 10,
  };
}

/**
 * Static pay-pack from order meta (no external mint). Safe to call anytime.
 */
function buildStaticPayPack(order) {
  const meta = (order && order.meta) || {};
  const armed = armedRailsHonesty();
  const rails = { btc: buildBtcRail(order) };
  if (meta.paypalApproveHref || meta.paypalOrderId) {
    rails.paypal = {
      id: 'paypal',
      armed: armed.paypal.armed,
      settleReady: armed.paypal.settleReady,
      approveHref: meta.paypalApproveHref || null,
      paypalOrderId: meta.paypalOrderId || null,
      status: meta.paypalStatus || 'CREATED',
    };
  }
  if (meta.nowpaymentsInvoiceUrl || meta.nowpaymentsInvoiceId) {
    rails.nowpayments = {
      id: 'nowpayments',
      armed: armed.nowpayments.armed,
      settleReady: armed.nowpayments.settleReady,
      invoiceUrl: meta.nowpaymentsInvoiceUrl || null,
      invoiceId: meta.nowpaymentsInvoiceId || null,
      paymentStatus: meta.nowpaymentsStatus || null,
    };
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    orderId: order && order.orderId,
    status: order && order.status,
    subtotalFiat: order && order.subtotal_fiat,
    currency: (order && order.currency) || 'USD',
    selectedRail: normalizeRail(meta.selectedRail) || null,
    paidVia: order && order.paid_via || null,
    shareUrl: order && order.checkout_url,
    accessTokenRequired: true,
    armed,
    rails,
    builtAt: new Date().toISOString(),
  };
}

/**
 * Ensure pay-pack: reuse cached provider URLs; optionally mint armed rails.
 * Mutates order.meta and returns { pack, minted, errors }.
 */
async function ensurePayPack(order, opts) {
  const o = opts || {};
  const mint = o.mint !== false;
  const alt = _alt();
  const pack = buildStaticPayPack(order);
  const minted = [];
  const errors = [];
  _counts.pay_pack_built += 1;

  if (!order || order.status !== 'pending') {
    return { pack, minted, errors, skipped: 'order_not_pending' };
  }

  if (mint && alt && alt.isPaypalArmed && alt.isPaypalArmed() && !(order.meta && order.meta.paypalApproveHref)) {
    try {
      const created = await alt.createPaypalOrderForSovereign(order);
      order.meta = Object.assign({}, order.meta || {}, {
        paypalOrderId: created.paypalOrderId,
        paypalApproveHref: created.approveHref,
        paypalStatus: created.status || 'CREATED',
      });
      minted.push('paypal');
      _counts.pay_pack_mint_paypal += 1;
      recordTelemetry({ type: 'pay_pack_mint', rail: 'paypal', orderId: order.orderId, ok: true });
    } catch (e) {
      errors.push({ rail: 'paypal', error: String(e && e.message || e).slice(0, 160) });
      _counts.pay_pack_mint_fail += 1;
      recordTelemetry({ type: 'pay_pack_mint', rail: 'paypal', orderId: order.orderId, ok: false, error: String(e && e.message || e).slice(0, 120) });
    }
  }

  if (mint && alt && alt.isNowPaymentsArmed && alt.isNowPaymentsArmed() && !(order.meta && order.meta.nowpaymentsInvoiceUrl)) {
    try {
      const created = await alt.createNowPaymentsInvoiceForSovereign(order, {
        payCurrency: (o && o.payCurrency) || 'any',
      });
      order.meta = Object.assign({}, order.meta || {}, {
        nowpaymentsInvoiceId: created.invoiceId,
        nowpaymentsInvoiceUrl: created.invoiceUrl,
        nowpaymentsStatus: 'waiting',
      });
      minted.push('nowpayments');
      _counts.pay_pack_mint_now += 1;
      recordTelemetry({ type: 'pay_pack_mint', rail: 'nowpayments', orderId: order.orderId, ok: true });
    } catch (e) {
      errors.push({ rail: 'nowpayments', error: String(e && e.message || e).slice(0, 160) });
      _counts.pay_pack_mint_fail += 1;
      recordTelemetry({ type: 'pay_pack_mint', rail: 'nowpayments', orderId: order.orderId, ok: false, error: String(e && e.message || e).slice(0, 120) });
    }
  }

  if (o.selectedRail) {
    const sel = normalizeRail(o.selectedRail);
    if (sel) {
      order.meta = Object.assign({}, order.meta || {}, { selectedRail: sel });
      _counts.preferred_rail_hit += 1;
    }
  }

  return { pack: buildStaticPayPack(order), minted, errors };
}

function failoverPlan(failedRail, armed) {
  const failed = normalizeRail(failedRail) || String(failedRail || '');
  const a = armed || armedRailsHonesty();
  const chain = ['btc'];
  if (a.paypal && a.paypal.settleReady) chain.push('paypal');
  if (a.nowpayments && a.nowpayments.settleReady) chain.push('nowpayments');
  // Always include BTC first as recovery; then other armed rails except the failed one.
  const next = chain.filter((r) => r !== failed);
  if (!next.includes('btc')) next.unshift('btc');
  _counts.rail_failover += 1;
  recordTelemetry({ type: 'rail_failover', failedRail: failed, next: next[0] || 'btc' });
  return {
    protocol: PROTOCOL,
    failedRail: failed,
    nextRail: next[0] || 'btc',
    chain: next,
    message: failed === 'btc'
      ? 'Bitcoin unavailable right now — try PayPal or card/crypto if armed.'
      : ((failed === 'paypal' ? 'PayPal' : 'Card/crypto') + ' unavailable — Bitcoin invoice on this order still works.'),
  };
}

function enrichOrderStatus(order, extras) {
  const meta = (order && order.meta) || {};
  const armed = armedRailsHonesty();
  const npStatus = String(meta.nowpaymentsStatus || (extras && extras.nowpaymentsStatus) || '').toLowerCase();
  const partial = /partial|underpaid|partially_paid/.test(npStatus);
  if (partial) _counts.partial_paid_seen += 1;
  return {
    selectedRail: normalizeRail(meta.selectedRail) || null,
    rails: {
      btc: { ready: true, primary: true },
      paypal: {
        settleReady: armed.paypal.settleReady,
        approveHref: meta.paypalApproveHref || null,
        paypalOrderId: meta.paypalOrderId || null,
      },
      nowpayments: {
        settleReady: armed.nowpayments.settleReady,
        invoiceUrl: meta.nowpaymentsInvoiceUrl || null,
        invoiceId: meta.nowpaymentsInvoiceId || null,
        paymentStatus: meta.nowpaymentsStatus || null,
        partialPaid: partial,
        honesty: partial
          ? 'NOWPayments reports partial payment — fulfillment waits until fully confirmed.'
          : null,
      },
    },
    payPack: {
      protocol: PROTOCOL,
      shareUrl: order && order.checkout_url,
      hasPaypalLink: !!meta.paypalApproveHref,
      hasNowLink: !!meta.nowpaymentsInvoiceUrl,
    },
    doublePayWarning: meta.selectedRail && meta.selectedRail !== 'btc'
      ? 'You started an alternate rail — do not also send BTC unless that rail fails.'
      : null,
  };
}

function pendingEmailData(order, pack) {
  const p = pack || buildStaticPayPack(order);
  const rails = p.rails || {};
  return {
    orderId: order.orderId,
    checkout_url: order.checkout_url,
    amount_btc: order.amount_btc,
    btcAmount: order.amount_btc,
    btcAddress: order.receive_address,
    serviceName: order.serviceName,
    priceUSD: order.subtotal_fiat,
    paypalApproveHref: (rails.paypal && rails.paypal.approveHref) || (order.meta && order.meta.paypalApproveHref) || null,
    nowInvoiceUrl: (rails.nowpayments && rails.nowpayments.invoiceUrl) || (order.meta && order.meta.nowpaymentsInvoiceUrl) || null,
    multiRail: true,
  };
}

function receiptEmailData(order) {
  const via = String(order.paid_via || 'btc').toLowerCase();
  const refs = order.provider_refs || (order.meta && {
    paypalOrderId: order.meta.paypalOrderId,
    nowpaymentsInvoiceId: order.meta.nowpaymentsInvoiceId,
  }) || {};
  return {
    orderId: order.orderId,
    serviceId: order.serviceId,
    serviceName: order.serviceName,
    priceUSD: order.subtotal_fiat,
    amount_btc: order.amount_btc,
    btcAmount: order.amount_btc,
    txid: Array.isArray(order.txids) && order.txids[0] ? order.txids[0] : null,
    paid_at: order.paid_at,
    paid_via: via,
    providerRef: refs.paypalCaptureId || refs.paypalOrderId || refs.nowpaymentsInvoiceId || refs.providerRef || null,
  };
}

function recordTelemetry(event) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const row = Object.assign({ ts: new Date().toISOString(), protocol: PROTOCOL }, event || {});
    fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(row) + '\n');
  } catch (_) { /* fail-open */ }
}

function getTelemetrySnapshot() {
  let queue = { pending: 0 };
  try {
    const psq = require('./provider-settle-queue');
    if (psq && typeof psq.getStatus === 'function') queue = psq.getStatus();
  } catch (_) {}
  let recent = 0;
  try {
    if (fs.existsSync(TELEMETRY_FILE)) {
      const raw = fs.readFileSync(TELEMETRY_FILE, 'utf8');
      recent = raw.split(/\n+/).filter(Boolean).length;
      if (recent > MAX_TELEMETRY_LINES) {
        // Best-effort trim: keep last half.
        const lines = raw.split(/\n+/).filter(Boolean);
        fs.writeFileSync(TELEMETRY_FILE, lines.slice(-Math.floor(MAX_TELEMETRY_LINES / 2)).join('\n') + '\n');
      }
    }
  } catch (_) {}
  return {
    ok: true,
    protocol: PROTOCOL,
    counts: Object.assign({}, _counts),
    settleQueue: {
      pending: Number(queue.pending || 0),
      started: !!queue.started,
      lastError: queue.lastError || null,
    },
    telemetryEvents: recent,
    armed: armedRailsHonesty(),
    honesty: 'Telemetry is operational counts only — never invents GMV.',
  };
}

function applyNowPaymentsStatus(order, status) {
  if (!order) return null;
  const s = String(status || '').toLowerCase();
  if (!s) return order;
  order.meta = Object.assign({}, order.meta || {}, { nowpaymentsStatus: s });
  if (/partial|underpaid|partially_paid/.test(s)) {
    _counts.partial_paid_seen += 1;
    recordTelemetry({ type: 'now_partial_paid', orderId: order.orderId, status: s });
  }
  return order;
}

module.exports = {
  PROTOCOL,
  normalizeRail,
  armedRailsHonesty,
  buildStaticPayPack,
  ensurePayPack,
  failoverPlan,
  enrichOrderStatus,
  pendingEmailData,
  receiptEmailData,
  recordTelemetry,
  getTelemetrySnapshot,
  applyNowPaymentsStatus,
};
