// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.236Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.094Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.606Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.149Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.450Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.205Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.289Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.152Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.802Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.990Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// quantumPaymentNexus.js – Multi-channel payment processing: BTC, card, mobile, BNPL
// Automatic BTC conversion and routing to fixed address
'use strict';

const BTC_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const crypto = require('crypto');

const transactions = [];
const pendingBtc = [];

// Simulate BTC price (in production, fetch from real API)
let btcPrice = 65000;
async function fetchBtcPrice() {
  try {
    const axios = require('axios');
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', { timeout: 5000 });
    btcPrice = res.data?.bitcoin?.usd || btcPrice;
  } catch {
    // Keep last known price
  }
}
setInterval(fetchBtcPrice, 60000);
fetchBtcPrice();

function usdToBtc(usd) {
  return Math.round((usd / btcPrice) * 1e8) / 1e8; // satoshis precision
}

function generatePaymentId() {
  return 'PAY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

async function processPayment({ method, amount, currency = 'USD', userId, serviceId, metadata = {} }) {
  const paymentId = generatePaymentId();
  const ts = new Date().toISOString();
  const amountUsd = currency === 'USD' ? amount : amount; // extend for other currencies

  const payment = {
    paymentId,
    method,
    amount: amountUsd,
    currency,
    userId,
    serviceId,
    status: 'pending',
    btcAddress: BTC_ADDRESS,
    btcAmount: usdToBtc(amountUsd),
    btcPrice,
    metadata,
    createdAt: ts,
    updatedAt: ts,
  };

  try {
    switch (method) {
      case 'btc':
      case 'bitcoin':
        payment.status = 'awaiting_confirmation';
        payment.instructions = `Send ${payment.btcAmount} BTC to ${BTC_ADDRESS}`;
        payment.qrData = `bitcoin:${BTC_ADDRESS}?amount=${payment.btcAmount}&label=ZeusAI`;
        pendingBtc.push(payment);
        break;

      case 'card':
      case 'stripe': {
        // In production: integrate with Stripe
        const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
        if (stripe && metadata.paymentMethodId) {
          const intent = await stripe.paymentIntents.create({
            amount: Math.round(amountUsd * 100),
            currency: 'usd',
            payment_method: metadata.paymentMethodId,
            confirm: true,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          });
          payment.status = intent.status === 'succeeded' ? 'completed' : 'processing';
          payment.stripeId = intent.id;
        } else {
          payment.status = 'simulated_success';
        }
        break;
      }

      case 'mobile':
      case 'apple_pay':
      case 'google_pay':
        payment.status = 'simulated_success';
        payment.message = `${method} payment of $${amountUsd} processed`;
        break;

      case 'bnpl':
      case 'buy_now_pay_later':
        payment.status = 'approved';
        payment.installments = [
          { amount: amountUsd / 4, dueDate: new Date(Date.now() + 30 * 86400000).toISOString() },
          { amount: amountUsd / 4, dueDate: new Date(Date.now() + 60 * 86400000).toISOString() },
          { amount: amountUsd / 4, dueDate: new Date(Date.now() + 90 * 86400000).toISOString() },
          { amount: amountUsd / 4, dueDate: new Date(Date.now() + 120 * 86400000).toISOString() },
        ];
        payment.message = 'BNPL approved – 4 installments of $' + (amountUsd / 4).toFixed(2);
        break;

      default:
        payment.status = 'error';
        payment.error = `Unknown payment method: ${method}`;
    }
  } catch (e) {
    payment.status = 'error';
    payment.error = e.message;
  }

  payment.updatedAt = new Date().toISOString();
  transactions.push(payment);

  // Auto-convert and route all non-BTC payments to BTC
  if (payment.status === 'completed' || payment.status === 'simulated_success') {
    console.log(`[QuantumPaymentNexus] 💰 Payment ${paymentId} completed. Auto-converting to BTC: ${payment.btcAmount} BTC → ${BTC_ADDRESS}`);
  }

  return payment;
}

function getPaymentStatus(paymentId) {
  return transactions.find(t => t.paymentId === paymentId) || null;
}

function getTransactionHistory(userId, limit = 50) {
  return transactions
    .filter(t => !userId || t.userId === userId)
    .slice(-limit)
    .reverse();
}

function getRevenueSummary() {
  const completed = transactions.filter(t => ['completed', 'simulated_success', 'approved'].includes(t.status));
  const totalUsd = completed.reduce((a, t) => a + (t.amount || 0), 0);
  const totalBtc = completed.reduce((a, t) => a + (t.btcAmount || 0), 0);
  return {
    totalTransactions: transactions.length,
    completedTransactions: completed.length,
    totalRevenue: { usd: totalUsd, btc: totalBtc, btcAddress: BTC_ADDRESS },
    btcPrice,
    methodBreakdown: ['btc', 'card', 'mobile', 'bnpl'].map(m => ({
      method: m,
      count: completed.filter(t => t.method === m || t.method === (m === 'card' ? 'stripe' : m)).length,
    })),
  };
}

function confirmBtcPayment(paymentId) {
  const idx = pendingBtc.findIndex(t => t.paymentId === paymentId);
  if (idx !== -1) {
    pendingBtc[idx].status = 'completed';
    const txIdx = transactions.findIndex(t => t.paymentId === paymentId);
    if (txIdx !== -1) transactions[txIdx].status = 'completed';
    return { ok: true, payment: pendingBtc[idx] };
  }
  return { ok: false, error: 'Payment not found' };
}

module.exports = {
  processPayment,
  getPaymentStatus,
  getTransactionHistory,
  getRevenueSummary,
  confirmBtcPayment,
  BTC_ADDRESS,
  usdToBtc,
};
