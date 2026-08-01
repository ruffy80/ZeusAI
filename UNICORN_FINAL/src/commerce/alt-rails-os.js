'use strict';

/**
 * Alt Rails OS — PayPal + NOWPayments helpers for sovereign checkout.
 * Honesty: never invent approve/invoice URLs when secrets are missing.
 * BTC remains the primary rail; these are optional armed add-ons.
 */

const PROTOCOL = 'AROS/1.0';

function _paypalClientId() {
  return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}
function _paypalSecret() {
  return String(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET || '').trim();
}
function isPaypalArmed() {
  const id = _paypalClientId();
  const secret = _paypalSecret();
  if (!id || !secret || id.length < 8 || secret.length < 8) return false;
  if (/^your_|^changeme$|^placeholder|^skip$/i.test(id) || /^your_|^changeme$|^placeholder|^skip$/i.test(secret)) return false;
  return true;
}
function isNowPaymentsArmed() {
  const key = String(process.env.NOWPAYMENTS_API_KEY || '').trim();
  if (!key || key.length < 8) return false;
  if (/^your_|^changeme$|^placeholder|^skip$/i.test(key)) return false;
  return true;
}
function isNowPaymentsIpnArmed() {
  const key = String(process.env.NOWPAYMENTS_IPN_SECRET || '').trim();
  if (!key || key.length < 8) return false;
  if (/^your_|^changeme$|^placeholder|^skip$/i.test(key)) return false;
  return true;
}

function paypalEnv() {
  // Prefer explicit env; in production default to live (matches secrets.js).
  // Sandbox only when explicitly requested — avoids accidental merchant/sandbox mismatch.
  const raw = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || '').trim().toLowerCase();
  if (raw === 'sandbox' || raw === 'test') return 'sandbox';
  if (raw === 'live' || raw === 'production') return 'live';
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return 'live';
  return 'sandbox';
}

function _paypalBaseUrl() {
  return paypalEnv() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

/**
 * Classify PayPal buyer-facing failures for honest UX (never invent paid).
 * Seller-self-pay is a PayPal platform rule — we cannot bypass it in code.
 */
function classifyPaypalBuyerError(detail) {
  const s = String(detail || '').toLowerCase();
  if (
    /seller for this purchase|account of the seller|cannot.?pay.?self|same.?account|merchant.?account|logging into the account of the seller/.test(s)
  ) {
    return {
      code: 'paypal_seller_self_pay',
      message: 'PayPal blocked this login because it is the ZeusAI merchant account. Log out of PayPal (or use a private window), then pay with a buyer PayPal account / guest card — or use Bitcoin / card-crypto below.',
    };
  }
  if (/instrument.?declined|payer.?cannot.?pay|payment.?denied/.test(s)) {
    return {
      code: 'paypal_payer_declined',
      message: 'PayPal declined the payment. Try another PayPal buyer account, or pay with Bitcoin / card-crypto on this invoice.',
    };
  }
  return null;
}

async function _paypalAccessToken() {
  if (!isPaypalArmed()) throw new Error('paypal_not_configured');
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const r = await fetch(_paypalBaseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(_paypalClientId() + ':' + _paypalSecret()).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error('paypal_auth_failed:' + r.status);
  const d = await r.json();
  if (!d || !d.access_token) throw new Error('paypal_auth_empty');
  return d.access_token;
}

async function createPaypalOrderForSovereign(order) {
  if (!order || !order.orderId) throw new Error('order_required');
  if (!isPaypalArmed()) throw new Error('paypal_not_configured');
  const amount = Number(order.subtotal_fiat || 0);
  if (!(amount > 0)) throw new Error('invalid_amount');
  const base = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://zeusai.pro').replace(/\/$/, '');
  // cancel lands on invoice with durable failover UI (BTC / NOW) — never a dead end
  const returnUrl = base + '/checkout/' + encodeURIComponent(order.orderId) + '?paypal=return';
  const cancelUrl = base + '/checkout/' + encodeURIComponent(order.orderId) + '?paypal=cancel';
  const token = await _paypalAccessToken();
  // Bias toward buyer/guest checkout — never prefill merchant payer email.
  // experience_context.GUEST_CHECKOUT + BILLING application_context reduces
  // "logged into seller account" collisions when a merchant session is sticky.
  const experience = {
    payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
    brand_name: 'ZeusAI',
    locale: 'en-US',
    landing_page: 'GUEST_CHECKOUT',
    shipping_preference: 'NO_SHIPPING',
    user_action: 'PAY_NOW',
    return_url: returnUrl,
    cancel_url: cancelUrl,
  };
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: order.orderId,
      custom_id: order.orderId,
      description: String(order.serviceName || order.serviceId || 'ZeusAI').slice(0, 120),
      amount: { currency_code: 'USD', value: amount.toFixed(2) },
    }],
    payment_source: {
      paypal: {
        experience_context: experience,
      },
    },
    // Kept for older PayPal API compatibility when payment_source is ignored.
    application_context: {
      brand_name: 'ZeusAI',
      landing_page: 'BILLING',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };
  const r = await fetch(_paypalBaseUrl() + '/v2/checkout/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = '';
    try { detail = await r.text(); } catch (_) {}
    // Fallback without payment_source if API rejects GUEST_CHECKOUT combo.
    if (r.status === 400 && /landing_page|payment_source|experience_context/i.test(detail)) {
      const r2 = await fetch(_paypalBaseUrl() + '/v2/checkout/orders', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: body.purchase_units,
          application_context: body.application_context,
        }),
      });
      if (!r2.ok) {
        let detail2 = '';
        try { detail2 = await r2.text(); } catch (_) {}
        throw new Error('paypal_order_create_failed:' + r2.status + (detail2 ? (':' + detail2.slice(0, 160)) : ''));
      }
      const d2 = await r2.json();
      const approvalUrl2 = Array.isArray(d2.links) ? ((d2.links.find((l) => l.rel === 'approve') || {}).href || null) : null;
      if (!approvalUrl2) throw new Error('paypal_approve_link_missing');
      return {
        ok: true,
        protocol: PROTOCOL,
        provider: 'paypal',
        paypalOrderId: d2.id,
        approveHref: approvalUrl2,
        status: d2.status,
        returnUrl,
        cancelUrl,
        env: paypalEnv(),
        buyerHint: 'Use a buyer PayPal account or guest checkout — not the ZeusAI merchant login.',
      };
    }
    throw new Error('paypal_order_create_failed:' + r.status + (detail ? (':' + detail.slice(0, 160)) : ''));
  }
  const d = await r.json();
  // Prefer payer-action / approve link for hosted checkout redirect.
  const links = Array.isArray(d.links) ? d.links : [];
  const approvalUrl = ((links.find((l) => l.rel === 'payer-action') || links.find((l) => l.rel === 'approve') || {}).href || null);
  if (!approvalUrl) throw new Error('paypal_approve_link_missing');
  return {
    ok: true,
    protocol: PROTOCOL,
    provider: 'paypal',
    paypalOrderId: d.id,
    approveHref: approvalUrl,
    status: d.status,
    returnUrl,
    cancelUrl,
    env: paypalEnv(),
    buyerHint: 'Use a buyer PayPal account or guest checkout — not the ZeusAI merchant login.',
  };
}

async function capturePaypalOrder(paypalOrderId) {
  if (!paypalOrderId || !/^[A-Za-z0-9_-]{1,100}$/.test(paypalOrderId)) {
    throw new Error('invalid_paypal_order_id');
  }
  if (!isPaypalArmed()) throw new Error('paypal_not_configured');
  const token = await _paypalAccessToken();
  const r = await fetch(_paypalBaseUrl() + '/v2/checkout/orders/' + encodeURIComponent(paypalOrderId) + '/capture', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  if (!r.ok) {
    let detail = '';
    try { detail = await r.text(); } catch (_) {}
    throw new Error('paypal_capture_failed:' + r.status + (detail ? (':' + detail.slice(0, 200)) : ''));
  }
  const capture = await r.json();
  const captureStatus = String(capture && capture.status || '').toUpperCase();
  const unitOk = Array.isArray(capture && capture.purchase_units)
    && capture.purchase_units.some((u) => {
      const caps = u && u.payments && u.payments.captures;
      return Array.isArray(caps) && caps.some((c) => String(c.status || '').toUpperCase() === 'COMPLETED');
    });
  if (captureStatus !== 'COMPLETED' && !unitOk) {
    const err = new Error('paypal_capture_incomplete');
    err.status = captureStatus;
    throw err;
  }
  const completed = (() => {
    try {
      const units = Array.isArray(capture.purchase_units) ? capture.purchase_units : [];
      for (const u of units) {
        const caps = u && u.payments && u.payments.captures;
        if (!Array.isArray(caps)) continue;
        for (const c of caps) {
          if (String(c && c.status || '').toUpperCase() === 'COMPLETED') {
            return { unit: u, capture: c };
          }
        }
      }
    } catch (_) {}
    return null;
  })();
  const unit = completed && completed.unit;
  const completedCapture = completed && completed.capture;
  const captureId = (completedCapture && completedCapture.id) || (capture && capture.id) || null;
  const amountValue = completedCapture && completedCapture.amount && completedCapture.amount.value;
  const currency = String((completedCapture && completedCapture.amount && completedCapture.amount.currency_code) || '').toUpperCase();
  const amount = Number(amountValue);
  const customId = String((unit && unit.custom_id) || '').trim();
  const referenceId = String((unit && unit.reference_id) || '').trim();
  if (!captureId) throw new Error('paypal_capture_id_missing');
  if (!Number.isFinite(amount) || !(amount > 0)) throw new Error('paypal_capture_amount_missing');
  if (!currency) throw new Error('paypal_capture_currency_missing');
  if (!customId && !referenceId) throw new Error('paypal_capture_order_reference_missing');
  return {
    ok: true,
    status: captureStatus,
    paypalOrderId,
    captureId,
    amount,
    currency,
    custom_id: customId || null,
    customId: customId || null,
    reference_id: referenceId || null,
    referenceId: referenceId || null,
    capture,
  };
}

async function createNowPaymentsInvoiceForSovereign(order, opts) {
  if (!order || !order.orderId) throw new Error('order_required');
  if (!isNowPaymentsArmed()) throw new Error('nowpayments_not_configured');
  const amount = Number(order.subtotal_fiat || 0);
  if (!(amount > 0)) throw new Error('invalid_amount');
  const base = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://zeusai.pro').replace(/\/$/, '');
  const np = require('../../backend/modules/nowPayments');
  const payCurrency = opts && opts.payCurrency ? String(opts.payCurrency).toLowerCase() : null;
  const invoice = await np.createInvoice({
    amountUsd: amount,
    itemName: order.serviceName || order.serviceId || 'ZeusAI',
    itemId: order.serviceId,
    clientId: (order.buyer && order.buyer.email) || null,
    orderId: order.orderId,
    payCurrency: payCurrency || undefined,
    successUrl: base + '/checkout/' + encodeURIComponent(order.orderId) + '?np=success',
    cancelUrl: base + '/checkout/' + encodeURIComponent(order.orderId) + '?np=cancel',
  });
  if (!invoice || invoice.ok === false || !invoice.id) {
    throw new Error((invoice && (invoice.reason || invoice.error || invoice.message)) || 'nowpayments_create_failed');
  }
  const invoiceUrl = invoice.invoice_url || invoice.invoiceUrl || null;
  if (!invoiceUrl) throw new Error('nowpayments_invoice_url_missing');
  return {
    ok: true,
    protocol: PROTOCOL,
    provider: 'nowpayments',
    invoiceId: invoice.id,
    invoiceUrl,
    orderId: order.orderId,
    ipnArmed: isNowPaymentsIpnArmed(),
  };
}

function getStatus() {
  return {
    ok: true,
    name: 'alt-rails-os',
    protocol: PROTOCOL,
    paypalArmed: isPaypalArmed(),
    paypalEnv: paypalEnv(),
    nowpaymentsArmed: isNowPaymentsArmed(),
    nowpaymentsIpnArmed: isNowPaymentsIpnArmed(),
    honesty: 'Optional rails; BTC direct remains primary settle path.',
  };
}

module.exports = {
  PROTOCOL,
  isPaypalArmed,
  isNowPaymentsArmed,
  isNowPaymentsIpnArmed,
  paypalEnv,
  classifyPaypalBuyerError,
  createPaypalOrderForSovereign,
  capturePaypalOrder,
  createNowPaymentsInvoiceForSovereign,
  getStatus,
};
