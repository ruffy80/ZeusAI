// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

let express = null;
try { express = require('express'); } catch (_) {}
const router = express && typeof express.Router === 'function' ? express.Router() : { get: () => {}, post: () => {}, use: () => {} };
const jsonParser = express && typeof express.json === 'function' ? express.json() : (req, res, next) => { if (next) next(); };
const crypto = require('crypto');
const db = require('../db');
const { clockwork } = require('../modules/swissClockworkOrchestrator');

const OWNER_BTC = process.env.BTC_OWNER_WALLET || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

/**
 * Modular Commerce Router
 * Handles dynamic catalogs, quotes, Bitcoin/Stripe checkouts and verifiable receipts.
 */

// GET /api/commerce/quote?serviceId=starter&basePrice=29
router.get('/quote', (req, res) => {
  const serviceId = String(req.query.serviceId || 'starter');
  const basePrice = Number(req.query.basePrice || 29);
  const country = String(req.query.country || 'RO');

  // Evaluare prin mecanismul de Surge Pricing (AdaptiveModule22) și VAT (AdaptiveModule62)
  const surge = clockwork.getWorker('AdaptiveModule22').process({ basePrice, loadFactor: 0.6 });
  const vat = clockwork.getWorker('AdaptiveModule62').process({ netAmount: surge.finalPrice, country });

  const btcRate = 80000;
  const btcSlippage = clockwork.getWorker('AdaptiveModule23').process({ amountUsd: vat.grossTotal, btcRate });

  res.json({
    ok: true,
    serviceId,
    basePrice,
    surgeAdjustedPrice: surge.finalPrice,
    grossTotalUsd: vat.grossTotal,
    vat: { rate: vat.vatRate, amount: vat.vatAmount, country: vat.country },
    btc: {
      rate: btcRate,
      exactBtc: btcSlippage.exactBtc,
      lockedBtc: btcSlippage.lockedBtc,
      wallet: OWNER_BTC,
      uri: `bitcoin:${OWNER_BTC}?amount=${btcSlippage.lockedBtc}&label=ZeusAI-${serviceId}`
    },
    quotedAt: new Date().toISOString()
  });
});

// POST /api/commerce/checkout
router.post('/checkout', jsonParser, async (req, res) => {
  const { serviceId, amount, method, clientEmail } = req.body || {};
  const basePrice = Number(amount || 29);

  // Execuție prin trenul de roți dințate COMMERCE_CHECKOUT
  const checkoutResult = await clockwork.runChain('COMMERCE_CHECKOUT', {
    basePrice,
    country: req.body.country || 'RO',
    isDisposableEmail: false,
    isBot: false,
  });

  const txId = 'TX-' + crypto.randomBytes(6).toString('hex');
  const grossTotal = checkoutResult.finalOutput.grossTotal || basePrice;

  // Persistență în baza de date
  const paymentRecord = {
    txId,
    clientId: clientEmail || 'guest',
    description: `Order ${serviceId || 'standard'} via ${method || 'BTC'}`,
    method: method || 'BTC',
    currency: 'USD',
    amount: basePrice,
    total: grossTotal,
    status: method === 'BTC' ? 'pending_crypto_confirmation' : 'completed',
    walletAddress: OWNER_BTC,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.payments.create(paymentRecord);

  res.json({
    ok: true,
    txId,
    payment: paymentRecord,
    merkleRoot: checkoutResult.finalOutput.merkleRoot,
    signature: checkoutResult.finalOutput.signature,
    escapementSteps: checkoutResult.escapementSteps,
    latencyMs: checkoutResult.totalDurationMs,
    payInstructions: method === 'BTC'
      ? { address: OWNER_BTC, amountBtc: (grossTotal / 80000).toFixed(8) }
      : { provider: 'stripe', status: 'payment_intent_ready' }
  });
});

// GET /api/commerce/receipt/:txId
router.get('/receipt/:txId', (req, res) => {
  const { txId } = req.params;
  const payment = db.payments.findById(txId);
  if (!payment) {
    return res.status(404).json({ ok: false, error: 'Transaction receipt not found' });
  }

  // Generare chitanță notarială prin Engine34 (RFC 3161)
  const notary = clockwork.getWorker('Engine34').process({ data: `${txId}:${payment.total}` });
  const hashChain = clockwork.getWorker('Engine35').process({ payload: payment });

  res.json({
    ok: true,
    receiptId: 'RCP-' + txId,
    payment,
    notaryToken: notary.tokenDigest,
    immutableHash: hashChain.currentHash,
    issuedBy: 'ZeusAI Sovereign Commerce Notary',
    settlementAddress: OWNER_BTC,
    certifiedAt: new Date().toISOString()
  });
});

module.exports = router;
