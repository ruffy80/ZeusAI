// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// multi-payment-rails.js — Multi-Crypto & Fiat Payment Rails for Unicorn
// Rute de plată multi-crypto și fiat pentru platforma Unicorn
// =============================================================================
// Supports / Suportă:
//   BTC  — native Bitcoin address (existing)
//   USDT — Tether on TRON (TRC-20) via NowPayments / TronScan
//   ETH  — Ethereum via NowPayments
//   SOL  — Solana via NowPayments
//   USDC — USD Coin on Ethereum via NowPayments
//   FIAT — Stripe (card/Apple Pay/Google Pay), PayPal fallback
//   SUB  — Recurring subscriptions via Stripe Billing
//   BNPL — Buy-Now-Pay-Later (4 installments)
//   SPLIT— Split payment (escrow half → release on delivery)
// =============================================================================

'use strict';

const crypto  = require('crypto');
const express = require('express');

// ── Config ────────────────────────────────────────────────────────────────
const BTC_ADDRESS   = process.env.BTC_OWNER_WALLET   || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const USDT_ADDRESS  = process.env.USDT_TRC20_ADDRESS || '';  // TRC-20 wallet; set in env
const ETH_ADDRESS   = process.env.ETH_ADDRESS        || '';
const SOL_ADDRESS   = process.env.SOL_ADDRESS        || '';
const NOWPAY_KEY    = process.env.NOWPAYMENTS_API_KEY || '';
const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY  || '';
const PAYPAL_ID     = process.env.PAYPAL_CLIENT_ID   || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET      || '';

// Crypto price cache (USD) / Cache preț crypto
let _prices = { BTC: 80000, ETH: 3500, SOL: 180, USDT: 1.0, USDC: 1.0 };
let _lastPriceFetch = 0;

/** @type {Map<string, object>} paymentId → payment record */
const _payments   = new Map();
const _subs       = new Map(); // subscriptionId → sub record
const _escrows    = new Map(); // escrowId       → escrow record

// ── §1  PRICE ORACLE ──────────────────────────────────────────────────────

async function _refreshPrices() {
  if (Date.now() - _lastPriceFetch < 60_000) return;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,usd-coin&vs_currencies=usd', { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const d = await r.json();
      if (d.bitcoin?.usd)   _prices.BTC  = d.bitcoin.usd;
      if (d.ethereum?.usd)  _prices.ETH  = d.ethereum.usd;
      if (d.solana?.usd)    _prices.SOL  = d.solana.usd;
      if (d.tether?.usd)    _prices.USDT = d.tether.usd;
      if (d['usd-coin']?.usd) _prices.USDC = d['usd-coin'].usd;
      _lastPriceFetch = Date.now();
    }
  } catch (_) {}
}

function usdToToken(usd, symbol) {
  const rate = _prices[symbol.toUpperCase()] || 1;
  return Math.round((usd / rate) * 1e8) / 1e8;
}

// ── §2  NOWPAYMENTS INTEGRATION ───────────────────────────────────────────

async function _createNowPaymentsInvoice({ amountUsd, currency, orderId, description }) {
  if (!NOWPAY_KEY) return null;
  try {
    const resp = await fetch('https://api.nowpayments.io/v1/invoice', {
      method:  'POST',
      headers: { 'x-api-key': NOWPAY_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount:    amountUsd,
        price_currency:  'usd',
        pay_currency:    currency.toLowerCase(),
        order_id:        orderId,
        order_description: description || `ZeusAI Order ${orderId}`,
        ipn_callback_url: process.env.SITE_URL ? `${process.env.SITE_URL}/api/payments/nowpayments-ipn` : undefined,
        success_url:     process.env.SITE_URL ? `${process.env.SITE_URL}/dashboard?payment=success` : undefined,
        cancel_url:      process.env.SITE_URL ? `${process.env.SITE_URL}/pricing?payment=cancelled` : undefined,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (_) { return null; }
}

// ── §3  STRIPE INTEGRATION ────────────────────────────────────────────────

async function _createStripePayment({ amountUsd, description, paymentMethodId, customerId }) {
  if (!STRIPE_KEY) return { status: 'no_stripe_key', error: 'STRIPE_SECRET_KEY not configured' };
  try {
    const stripe = require('stripe')(STRIPE_KEY);
    const intent = await stripe.paymentIntents.create({
      amount:   Math.round(amountUsd * 100),
      currency: 'usd',
      description,
      customer: customerId || undefined,
      payment_method:               paymentMethodId || undefined,
      confirm:                      !!paymentMethodId,
      automatic_payment_methods:    paymentMethodId ? undefined : { enabled: true },
    });
    return { status: intent.status, clientSecret: intent.client_secret, stripeId: intent.id };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function _createStripeSubscription({ customerId, priceId, trialDays }) {
  if (!STRIPE_KEY) return { status: 'no_stripe_key' };
  try {
    const stripe = require('stripe')(STRIPE_KEY);
    const sub = await stripe.subscriptions.create({
      customer:          customerId,
      items:             [{ price: priceId }],
      trial_period_days: trialDays || undefined,
    });
    return { status: sub.status, subscriptionId: sub.id, currentPeriodEnd: sub.current_period_end };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// ── §4  PAYPAL INTEGRATION ────────────────────────────────────────────────

async function _getPaypalToken() {
  if (!PAYPAL_ID || !PAYPAL_SECRET) return null;
  try {
    const base = process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    const r = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${PAYPAL_ID}:${PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.access_token || null;
  } catch (_) { return null; }
}

async function _createPaypalOrder({ amountUsd, description }) {
  const token = await _getPaypalToken();
  if (!token) return { status: 'no_paypal_config' };
  try {
    const base = process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    const r = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount:      { currency_code: 'USD', value: amountUsd.toFixed(2) },
          description: description || 'ZeusAI Service',
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { status: 'paypal_error' };
    const d = await r.json();
    const approvalUrl = d.links?.find(l => l.rel === 'approve')?.href;
    return { status: 'created', orderId: d.id, approvalUrl };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// ── §5  MAIN processPayment ────────────────────────────────────────────────

/**
 * processPayment — universal payment router
 * Router universal de plată
 */
async function processPayment({
  method,
  amountUsd,
  userId        = null,
  serviceId     = null,
  description   = '',
  paymentMethodId = null,  // Stripe
  customerId    = null,    // Stripe customer ID
  priceId       = null,    // Stripe subscription price ID
  trialDays     = null,
  splitPct      = 50,      // for split payments: upfront pct
  metadata      = {},
}) {
  await _refreshPrices();
  const paymentId = `PAY_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const ts = new Date().toISOString();

  const record = {
    paymentId, method, amountUsd, userId, serviceId, description,
    status: 'pending', createdAt: ts, updatedAt: ts, metadata,
  };

  try {
    switch ((method || '').toLowerCase()) {

      // ── BTC ──────────────────────────────────────────────────────────
      case 'btc':
      case 'bitcoin': {
        const btcAmount = usdToToken(amountUsd, 'BTC');
        record.status       = 'awaiting_confirmation';
        record.cryptoAmount = btcAmount;
        record.cryptoSymbol = 'BTC';
        record.address      = BTC_ADDRESS;
        record.qrData       = `bitcoin:${BTC_ADDRESS}?amount=${btcAmount}&label=ZeusAI`;
        record.instructions = `Send ${btcAmount} BTC to ${BTC_ADDRESS}`;
        break;
      }

      // ── USDT (TRC-20) ─────────────────────────────────────────────────
      case 'usdt':
      case 'tether': {
        // Try NowPayments first, fall back to direct address
        const inv = await _createNowPaymentsInvoice({ amountUsd, currency: 'USDTTRC20', orderId: paymentId, description });
        if (inv && inv.invoice_url) {
          record.status       = 'awaiting_redirect';
          record.invoiceUrl   = inv.invoice_url;
          record.invoiceId    = inv.id;
          record.nowpayments  = inv;
        } else if (USDT_ADDRESS) {
          record.status       = 'awaiting_confirmation';
          record.cryptoAmount = amountUsd; // USDT is 1:1 with USD
          record.cryptoSymbol = 'USDT';
          record.address      = USDT_ADDRESS;
          record.instructions = `Send ${amountUsd} USDT (TRC-20) to ${USDT_ADDRESS}`;
        } else {
          record.status = 'no_usdt_config';
          record.error  = 'USDT_TRC20_ADDRESS and NOWPAYMENTS_API_KEY not configured';
        }
        break;
      }

      // ── ETH ────────────────────────────────────────────────────────────
      case 'eth':
      case 'ethereum': {
        const inv = await _createNowPaymentsInvoice({ amountUsd, currency: 'ETH', orderId: paymentId, description });
        if (inv && inv.invoice_url) {
          record.status = 'awaiting_redirect'; record.invoiceUrl = inv.invoice_url; record.nowpayments = inv;
        } else if (ETH_ADDRESS) {
          record.status = 'awaiting_confirmation';
          record.cryptoAmount = usdToToken(amountUsd, 'ETH');
          record.cryptoSymbol = 'ETH';
          record.address      = ETH_ADDRESS;
          record.instructions = `Send ${record.cryptoAmount} ETH to ${ETH_ADDRESS}`;
        } else {
          record.status = 'no_eth_config'; record.error = 'ETH_ADDRESS and NOWPAYMENTS_API_KEY not configured';
        }
        break;
      }

      // ── SOL ────────────────────────────────────────────────────────────
      case 'sol':
      case 'solana': {
        const inv = await _createNowPaymentsInvoice({ amountUsd, currency: 'SOL', orderId: paymentId, description });
        if (inv && inv.invoice_url) {
          record.status = 'awaiting_redirect'; record.invoiceUrl = inv.invoice_url; record.nowpayments = inv;
        } else if (SOL_ADDRESS) {
          record.status = 'awaiting_confirmation';
          record.cryptoAmount = usdToToken(amountUsd, 'SOL');
          record.cryptoSymbol = 'SOL';
          record.address      = SOL_ADDRESS;
          record.instructions = `Send ${record.cryptoAmount} SOL to ${SOL_ADDRESS}`;
        } else {
          record.status = 'no_sol_config'; record.error = 'SOL_ADDRESS and NOWPAYMENTS_API_KEY not configured';
        }
        break;
      }

      // ── USDC ─────────────────────────────────────────────────────────
      case 'usdc': {
        const inv = await _createNowPaymentsInvoice({ amountUsd, currency: 'USDC', orderId: paymentId, description });
        if (inv && inv.invoice_url) {
          record.status = 'awaiting_redirect'; record.invoiceUrl = inv.invoice_url; record.nowpayments = inv;
        } else {
          record.status = 'no_usdc_config'; record.error = 'NOWPAYMENTS_API_KEY not configured';
        }
        break;
      }

      // ── STRIPE (card / fiat) ──────────────────────────────────────────
      case 'card':
      case 'stripe':
      case 'fiat': {
        const stripeResult = await _createStripePayment({ amountUsd, description, paymentMethodId, customerId });
        record.status       = stripeResult.status || 'error';
        record.clientSecret = stripeResult.clientSecret;
        record.stripeId     = stripeResult.stripeId;
        if (stripeResult.error) record.error = stripeResult.error;
        break;
      }

      // ── SUBSCRIPTION (Stripe Billing) ─────────────────────────────────
      case 'subscription':
      case 'recurring': {
        if (!priceId) { record.status = 'error'; record.error = 'priceId required for subscription'; break; }
        const subResult = await _createStripeSubscription({ customerId, priceId, trialDays });
        record.status         = subResult.status || 'error';
        record.subscriptionId = subResult.subscriptionId;
        if (subResult.error) record.error = subResult.error;
        if (subResult.subscriptionId) _subs.set(subResult.subscriptionId, { ...record, ...subResult });
        break;
      }

      // ── PAYPAL ────────────────────────────────────────────────────────
      case 'paypal': {
        const ppResult = await _createPaypalOrder({ amountUsd, description });
        record.status      = ppResult.status || 'error';
        record.approvalUrl = ppResult.approvalUrl;
        record.orderId     = ppResult.orderId;
        if (ppResult.error) record.error = ppResult.error;
        break;
      }

      // ── SPLIT PAYMENT ─────────────────────────────────────────────────
      case 'split': {
        const upfrontUsd = amountUsd * (splitPct / 100);
        const escrowUsd  = amountUsd - upfrontUsd;
        const escrowId   = `ESC_${Date.now()}`;
        _escrows.set(escrowId, { escrowId, amountUsd: escrowUsd, status: 'held', paymentId, createdAt: ts });
        record.status   = 'split_pending_upfront';
        record.escrowId = escrowId;
        record.upfrontUsd = upfrontUsd;
        record.escrowUsd  = escrowUsd;
        record.instructions = `Pay $${upfrontUsd.toFixed(2)} upfront, $${escrowUsd.toFixed(2)} held in escrow (released on delivery)`;
        break;
      }

      // ── BNPL ──────────────────────────────────────────────────────────
      case 'bnpl':
      case 'buy_now_pay_later': {
        const installment = amountUsd / 4;
        record.status = 'bnpl_approved';
        record.installments = [0, 30, 60, 90].map(days => ({
          amount:  +installment.toFixed(2),
          dueDate: new Date(Date.now() + days * 86400_000).toISOString(),
          status:  days === 0 ? 'due_now' : 'scheduled',
        }));
        record.message = `BNPL approved — 4 x $${installment.toFixed(2)}`;
        break;
      }

      default:
        record.status = 'error';
        record.error  = `Unsupported payment method: ${method}. Supported: btc, usdt, eth, sol, usdc, card, subscription, paypal, split, bnpl`;
    }
  } catch (e) {
    record.status = 'error';
    record.error  = e.message;
  }

  record.updatedAt = new Date().toISOString();
  _payments.set(paymentId, record);
  return record;
}

// ── §6  IPN / WEBHOOK HANDLER ──────────────────────────────────────────────

/**
 * handleNowPaymentsIPN — process NowPayments instant payment notification
 */
function handleNowPaymentsIPN(payload) {
  const { payment_id, payment_status, order_id, pay_amount, pay_currency } = payload || {};
  if (!order_id) return { ok: false, error: 'Missing order_id' };

  const record = _payments.get(order_id);
  if (!record) return { ok: false, error: 'Payment not found' };

  const statusMap = {
    waiting:    'awaiting_confirmation',
    confirming: 'confirming',
    confirmed:  'completed',
    sending:    'confirming',
    finished:   'completed',
    failed:     'failed',
    refunded:   'refunded',
    expired:    'expired',
  };

  record.status      = statusMap[payment_status] || payment_status;
  record.ipnPaymentId = payment_id;
  record.paidAmount  = pay_amount;
  record.paidSymbol  = pay_currency;
  record.updatedAt   = new Date().toISOString();
  _payments.set(order_id, record);

  return { ok: true, paymentId: order_id, status: record.status };
}

/**
 * releaseEscrow — release escrowed funds on delivery confirmation
 */
function releaseEscrow(escrowId) {
  const escrow = _escrows.get(escrowId);
  if (!escrow) return { ok: false, error: 'Escrow not found' };
  escrow.status     = 'released';
  escrow.releasedAt = new Date().toISOString();
  _escrows.set(escrowId, escrow);
  return { ok: true, escrow };
}

// ── §7  QUERY ──────────────────────────────────────────────────────────────

function getPayment(paymentId) { return _payments.get(paymentId) || null; }
function getPayments({ userId, limit = 50 } = {}) {
  let list = [..._payments.values()];
  if (userId) list = list.filter(p => p.userId === userId);
  return list.slice(-limit).reverse();
}
function getRevenueSummary() {
  const completed = [..._payments.values()].filter(p => ['completed', 'bnpl_approved', 'split_pending_upfront'].includes(p.status));
  const total = completed.reduce((s, p) => s + (p.amountUsd || 0), 0);
  const byMethod = {};
  for (const p of completed) {
    byMethod[p.method] = (byMethod[p.method] || 0) + (p.amountUsd || 0);
  }
  return { totalRevenue: +total.toFixed(2), byMethod, transactionCount: completed.length, currentPrices: _prices };
}

// ── §8  REST ROUTER ────────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/supported', (_req, res) => {
    res.json({
      ok: true,
      methods: ['btc', 'usdt', 'eth', 'sol', 'usdc', 'card', 'subscription', 'paypal', 'split', 'bnpl'],
      configured: {
        btc:          !!BTC_ADDRESS,
        usdt:         !!(USDT_ADDRESS || NOWPAY_KEY),
        eth:          !!(ETH_ADDRESS  || NOWPAY_KEY),
        sol:          !!(SOL_ADDRESS  || NOWPAY_KEY),
        usdc:         !!NOWPAY_KEY,
        stripe:       !!STRIPE_KEY,
        paypal:       !!(PAYPAL_ID && PAYPAL_SECRET),
        nowpayments:  !!NOWPAY_KEY,
      },
      prices: _prices,
    });
  });

  r.post('/pay', express.json(), async (req, res) => {
    try {
      const result = await processPayment(req.body || {});
      res.json({ ok: true, payment: result });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  r.get('/status/:paymentId', (req, res) => {
    const p = getPayment(req.params.paymentId);
    if (!p) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, payment: p });
  });

  r.post('/nowpayments-ipn', express.json(), (req, res) => {
    const result = handleNowPaymentsIPN(req.body);
    res.json(result);
  });

  r.post('/escrow/:escrowId/release', (req, res) => {
    res.json(releaseEscrow(req.params.escrowId));
  });

  r.get('/revenue', (_req, res) => {
    res.json({ ok: true, ...getRevenueSummary() });
  });

  return r;
}

function getStatus() {
  const rev = getRevenueSummary();
  return {
    name:            'multi-payment-rails',
    label:           'Multi-Payment Rails',
    health:          'good',
    supportedRails:  ['BTC', 'USDT', 'ETH', 'SOL', 'USDC', 'Stripe', 'PayPal', 'BNPL', 'Split', 'Subscription'],
    configuredRails: { btc: !!BTC_ADDRESS, usdt: !!(USDT_ADDRESS || NOWPAY_KEY), eth: !!(ETH_ADDRESS || NOWPAY_KEY), sol: !!(SOL_ADDRESS || NOWPAY_KEY), stripe: !!STRIPE_KEY, paypal: !!(PAYPAL_ID && PAYPAL_SECRET), nowpayments: !!NOWPAY_KEY },
    totalRevenue:    rev.totalRevenue,
    transactions:    _payments.size,
  };
}

module.exports = {
  processPayment,
  handleNowPaymentsIPN,
  releaseEscrow,
  getPayment,
  getPayments,
  getRevenueSummary,
  getStatus,
  router,
  usdToToken,
};
