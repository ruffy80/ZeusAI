// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T12:56:06.111Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// NOW PAYMENTS — Universal Global Payment Processor
// Acceptă 300+ crypto + carduri bancare din 150+ țări
// Auto-convertește TOTUL la BTC → trimite direct la adresa proprietarului
// Owner BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

const https = require('https');
const crypto = require('crypto');

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';
const OWNER_BTC_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const BASE_URL = process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
const SANDBOX = process.env.NOWPAYMENTS_SANDBOX === '1';
const PRODUCTION_MODE = process.env.NODE_ENV === 'production';

const pendingPayments = new Map();
const processedConfirmations = new Set();

function deepSortObject(value) {
  if (Array.isArray(value)) return value.map(deepSortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = deepSortObject(value[key]);
    return acc;
  }, {});
}

function safeHexEqual(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (!aa.length || !bb.length || aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function nowRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const host = SANDBOX ? 'api-sandbox.nowpayments.io' : 'api.nowpayments.io';
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: host,
      path: '/v1' + path,
      method,
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (_) { resolve({ error: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createInvoice({ amountUsd, itemName, itemId, clientId, successUrl, cancelUrl }) {
  if (!NOWPAYMENTS_API_KEY) {
    const fakeId = 'np_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    pendingPayments.set(fakeId, {
      itemId,
      itemName,
      amountUsd,
      clientId,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      method: 'btc_direct'
    });
    return {
      id: fakeId,
      invoice_url: null,
      pay_address: OWNER_BTC_ADDRESS,
      pay_currency: 'btc',
      price_amount: amountUsd,
      price_currency: 'usd',
      fallback: true,
      message: 'NOWPayments API key not configured — using direct BTC'
    };
  }

  const orderId = 'uf_' + Date.now() + '_' + (itemId || 'svc').toString().slice(0, 8);
  const payload = {
    price_amount: amountUsd,
    price_currency: 'usd',
    pay_currency: 'btc',
    order_id: orderId,
    order_description: itemName || 'Unicorn AI Service',
    ipn_callback_url: BASE_URL + '/api/payment/nowpayments/webhook',
    success_url: successUrl || BASE_URL + '/?payment=success&order=' + orderId,
    cancel_url: cancelUrl || BASE_URL + '/?payment=cancel',
    is_fixed_rate: false,
    is_fee_paid_by_user: false
  };

  const result = await nowRequest('POST', '/invoice', payload);
  if (result.id) {
    pendingPayments.set(result.id.toString(), {
      orderId,
      itemId,
      itemName,
      amountUsd,
      clientId,
      status: 'waiting',
      createdAt: new Date().toISOString()
    });
  }
  return result;
}

async function getPaymentStatus(nowPaymentId) {
  const cached = pendingPayments.get(nowPaymentId.toString());
  if (!NOWPAYMENTS_API_KEY) return cached || { status: 'unknown' };

  try {
    const result = await nowRequest('GET', '/payment/' + nowPaymentId);
    if (cached && result.payment_status) {
      cached.status = result.payment_status;
      pendingPayments.set(nowPaymentId.toString(), cached);
    }
    return { ...cached, ...result };
  } catch (e) {
    return cached || { status: 'unknown', error: e.message };
  }
}

function verifyWebhookSignature(rawBody, receivedSig) {
  if (!NOWPAYMENTS_IPN_SECRET) return false;
  let parsed;
  try { parsed = JSON.parse(rawBody); }
  catch (_) { return false; }
  const sorted = JSON.stringify(deepSortObject(parsed));
  const sig = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET).update(sorted).digest('hex');
  return safeHexEqual(sig, String(receivedSig || '').toLowerCase());
}

function processWebhook(payload) {
  const { payment_id, payment_status, order_id, price_amount, pay_currency, actually_paid } = payload;
  const id = (payment_id || '').toString();
  if (!id) return { status: 'rejected', reason: 'missing_payment_id' };

  const entry = pendingPayments.get(id) || {};
  const isConfirmed = ['finished', 'confirmed', 'partially_paid'].includes(payment_status);
  const confirmationKey = `${id}:${payment_status}`;

  if (isConfirmed && processedConfirmations.has(confirmationKey)) {
    return { ...entry, status: payment_status, duplicate: true };
  }

  const updated = {
    ...entry,
    status: payment_status,
    orderId: order_id,
    payCurrency: pay_currency,
    actuallyPaid: actually_paid,
    confirmedAt: new Date().toISOString()
  };
  pendingPayments.set(id, updated);

  if (isConfirmed) {
    processedConfirmations.add(confirmationKey);
    try {
      const { EventEmitter } = require('events');
      if (global._unicornEventBus instanceof EventEmitter) {
        global._unicornEventBus.emit('payment:confirmed', {
          provider: 'nowpayments',
          paymentId: id,
          orderId: order_id,
          serviceId: entry.itemId,
          clientId: entry.clientId,
          amountUsd: price_amount,
          payCurrency: pay_currency
        });
      }
    } catch (_) {}
  }

  return updated;
}

async function getSupportedCurrencies() {
  if (!NOWPAYMENTS_API_KEY) return { currencies: ['btc', 'eth', 'usdt', 'bnb', 'sol', 'xrp', 'ada', 'dot', 'ltc', 'doge'] };
  try { return await nowRequest('GET', '/currencies'); }
  catch (_) { return { currencies: [] }; }
}

async function getMinimumPayment(currency) {
  if (!NOWPAYMENTS_API_KEY) return { min_amount: 0.001 };
  try { return await nowRequest('GET', '/min-amount?currency_from=' + encodeURIComponent(currency) + '&currency_to=btc'); }
  catch (_) { return { min_amount: 0 }; }
}

async function ping() {
  if (!NOWPAYMENTS_API_KEY) return { status: 'no_api_key', active: false };
  try {
    const result = await nowRequest('GET', '/status');
    return { status: result.message || 'ok', active: true };
  } catch (e) {
    return { status: 'error', active: false, error: e.message };
  }
}

function getSecurityStatus() {
  const ipnSecretConfigured = !!NOWPAYMENTS_IPN_SECRET;
  const apiKeyConfigured = !!NOWPAYMENTS_API_KEY;
  return {
    provider: 'nowpayments',
    apiKeyConfigured,
    ipnSecretConfigured,
    sandbox: SANDBOX,
    productionMode: PRODUCTION_MODE,
    webhookSecurityReady: ipnSecretConfigured,
    secureByDefault: ipnSecretConfigured
  };
}

function isWebhookSecurityReady() {
  return !!NOWPAYMENTS_IPN_SECRET;
}

module.exports = {
  createInvoice,
  getPaymentStatus,
  verifyWebhookSignature,
  processWebhook,
  getSupportedCurrencies,
  getMinimumPayment,
  ping,
  getSecurityStatus,
  isWebhookSecurityReady,
  pendingPayments,
  OWNER_BTC_ADDRESS
};
