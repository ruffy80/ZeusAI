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

function _paypalBaseUrl() {
  const env = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return env === 'live' || env === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
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
  const returnUrl = base + '/checkout/' + encodeURIComponent(order.orderId) + '?paypal=return';
  const cancelUrl = base + '/checkout/' + encodeURIComponent(order.orderId) + '?paypal=cancel';
  const token = await _paypalAccessToken();
  const r = await fetch(_paypalBaseUrl() + '/v2/checkout/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.orderId,
        custom_id: order.orderId,
        description: String(order.serviceName || order.serviceId || 'ZeusAI').slice(0, 120),
        amount: { currency_code: 'USD', value: amount.toFixed(2) },
      }],
      application_context: {
        brand_name: 'ZeusAI',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  if (!r.ok) {
    let detail = '';
    try { detail = await r.text(); } catch (_) {}
    throw new Error('paypal_order_create_failed:' + r.status + (detail ? (':' + detail.slice(0, 160)) : ''));
  }
  const d = await r.json();
  const approvalUrl = Array.isArray(d.links) ? ((d.links.find((l) => l.rel === 'approve') || {}).href || null) : null;
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
  const captureId = (() => {
    try {
      const units = capture.purchase_units || [];
      for (const u of units) {
        const caps = u && u.payments && u.payments.captures;
        if (Array.isArray(caps) && caps[0] && caps[0].id) return caps[0].id;
      }
    } catch (_) {}
    return capture && capture.id || null;
  })();
  return { ok: true, status: captureStatus, paypalOrderId, captureId, capture };
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
  createPaypalOrderForSovereign,
  capturePaypalOrder,
  createNowPaymentsInvoiceForSovereign,
  getStatus,
};
