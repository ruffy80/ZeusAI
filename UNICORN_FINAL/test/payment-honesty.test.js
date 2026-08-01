'use strict';

process.env.NODE_ENV = 'test';
delete process.env.ETH_WALLET_ADDRESS;
delete process.env.USDC_WALLET_ADDRESS;
delete process.env.ETH_RECEIVE_ADDRESS;
delete process.env.BANK_TRANSFER_ENABLED;
delete process.env.BANK_ACCOUNT_IBAN;
delete process.env.BANK_ACCOUNT_NUMBER;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.PAYPAL_CLIENT_SECRET;

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PaymentGateway = require('../backend/modules/paymentGateway');
const truth = require('../backend/modules/conversion-truth-layer');

let pass = 0;
function check(name, fn) { fn(); pass++; console.log('  \u2713 ' + name); }

const gw = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;

check('BTC is always active', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(methods.some((m) => m.id === 'crypto_btc' && m.active));
});

check('ETH and bank are hidden when unconfigured', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(!methods.some((m) => m.id === 'crypto_eth'));
  assert.ok(!methods.some((m) => m.id === 'bank'));
});

check('Stripe/PayPal hidden without secrets', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(!methods.some((m) => m.id === 'stripe' || m.id === 'card'));
  assert.ok(!methods.some((m) => m.id === 'paypal'));
});

check('conversion-truth strips eth/bank from public metrics', () => {
  const out = truth.sanitizePublicMetrics({
    methods: [
      { id: 'crypto_btc', active: true },
      { id: 'crypto_eth', active: true },
      { id: 'bank', active: true },
    ],
    simulatedRevenue: 999,
  });
  assert.ok(out.methods.every((m) => m.id === 'crypto_btc'));
  assert.strictEqual(out.simulatedRevenue, 0);
});

check('ETH becomes active when wallet configured', () => {
  process.env.ETH_WALLET_ADDRESS = '0xabc';
  const gw2 = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;
  assert.ok(gw2.getPaymentMethods().some((m) => m.id === 'crypto_eth' && m.active));
  delete process.env.ETH_WALLET_ADDRESS;
});

// ── UI payment-labels honesty helper (mirrors client.js paymentLabels logic) ──
function paymentLabels(methods) {
  const ids = (methods || []).filter((m) => m && m.active !== false).map((m) => m.id || m.provider || '');
  const labels = ['BTC direct'];
  if (ids.includes('card') || ids.includes('stripe')) labels.push('Card/Stripe');
  if (ids.includes('paypal')) labels.push('PayPal');
  if (ids.includes('nowpayments')) labels.push('global crypto');
  return labels;
}

check('paymentLabels: BTC-only when no optional methods configured', () => {
  const labels = paymentLabels([{ id: 'crypto_btc', active: true }]);
  assert.deepStrictEqual(labels, ['BTC direct']);
});

check('paymentLabels: adds Card/Stripe only when stripe is active', () => {
  const labels = paymentLabels([
    { id: 'crypto_btc', active: true },
    { id: 'stripe', active: true },
  ]);
  assert.ok(labels.includes('Card/Stripe'));
  assert.ok(!labels.includes('PayPal'));
});

check('paymentLabels: PayPal excluded when inactive', () => {
  const labels = paymentLabels([
    { id: 'crypto_btc', active: true },
    { id: 'paypal', active: false },
  ]);
  assert.ok(!labels.includes('PayPal'));
});

check('paymentLabels: all rails present when all active', () => {
  const labels = paymentLabels([
    { id: 'crypto_btc', active: true },
    { id: 'stripe', active: true },
    { id: 'paypal', active: true },
    { id: 'nowpayments', active: true },
  ]);
  assert.ok(labels.includes('BTC direct'));
  assert.ok(labels.includes('Card/Stripe'));
  assert.ok(labels.includes('PayPal'));
  assert.ok(labels.includes('global crypto'));
});

// ── Sovereign-commerce delivery hook wiring ───────────────────────────────
const os = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-test-'));
process.env.COMMERCE_DATA_DIR = path.join(tmpDir, 'commerce');
// Suppress watcher/price timers during test
process.env.COMMERCE_WATCH_MS = '9999999';

const sovereignCommerce = require('../src/site/sovereign-commerce');

check('setDeliveryHook is exported as a function', () => {
  assert.strictEqual(typeof sovereignCommerce.setDeliveryHook, 'function');
});

check('_fireDelivery invokes registered hook with a correct receipt-like object', () => {
  // Build a synthetic paid sovereign order (same shape scanIncoming produces)
  const orderId = 'ord_hooktest_' + Date.now();
  const fakeTxid = 'txid_test_' + Date.now();
  const order = {
    orderId,
    serviceId: 'test-svc',
    serviceName: 'Test Service',
    buyer: { email: 'test@example.com' },
    access_token: 't_abc123',
    entitlement_id: 'ent_test',
    amount_sats: 103579,
    amount_btc: 0.00103579,
    currency: 'USD',
    subtotal_fiat: 99,
    paid_at: new Date().toISOString(),
    txids: [fakeTxid],
  };

  const received = [];
  sovereignCommerce.setDeliveryHook((r) => { received.push(r); });
  // _fireDelivery maps a sovereign order to a receipt-like object and calls the hook
  sovereignCommerce._fireDelivery(order);

  assert.strictEqual(received.length, 1);
  const r = received[0];
  assert.strictEqual(r.id, orderId, 'receipt id must be orderId');
  assert.strictEqual(r.orderId, orderId);
  assert.strictEqual(r.serviceId, 'test-svc');
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(r.method, 'BTC');
  assert.strictEqual(r.email, 'test@example.com');
  assert.strictEqual(r.customerEmail, 'test@example.com');
  assert.strictEqual(r.txid, fakeTxid);
  assert.strictEqual(r.access_token, 't_abc123');
  assert.strictEqual(r.entitlement_id, 'ent_test');

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

check('_fireDelivery is a no-op when no hook is registered', () => {
  sovereignCommerce.setDeliveryHook(null);
  // Should not throw
  sovereignCommerce._fireDelivery({ orderId: 'ord_nohook', serviceId: 's', serviceName: 's', buyer: {}, txids: [] });
});

check('BTC perfection guards are present in sovereign commerce and site routes', () => {
  const sovSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'sovereign-commerce.js'), 'utf8');
  const siteSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const monitorSrc = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'unicorn-payment-monitor.js'), 'utf8');
  assert.ok(sovSrc.includes('payment-exceptions.jsonl'), 'mismatch exceptions must append JSONL');
  assert.ok(sovSrc.includes('late_payment_expired'), 'late expired BTC payments must be recorded');
  assert.ok(sovSrc.includes("kind: 'payment_amount_mismatch'"), 'underpay/overpay mismatches must be classified');
  assert.ok(sovSrc.includes('priceUnavailableForNewInvoices'), 'new invoices must fail closed on static fallback price');
  // Preferred durable QR: /checkout/:id/qr.svg (nginx ^~ /checkout/ → site).
  // Legacy /api/checkout/:id/qr.svg remains as a fallback pin (^~ /api/checkout/ord_).
  assert.ok(
    sovSrc.includes('/checkout/${orderId}/qr.svg')
      || sovSrc.includes("'/checkout/' +")
      || sovSrc.includes('/api/checkout/${orderId}/qr.svg')
      || sovSrc.includes("'/api/checkout/' +"),
    'checkout must use first-party site QR route (/checkout/:id/qr.svg)'
  );
  assert.ok(siteSrc.includes('ALLOW_OPEN_PAYMENT_CONFIRM'), 'loopback payment confirm must be gated');
  assert.ok(siteSrc.includes('txid_required_for_btc_confirm'), 'trusted BTC confirm must require txid');
  assert.ok(siteSrc.includes('verifyDeliveryAccess'), 'delivery route must require access token');
  assert.ok(monitorSrc.includes('missing_chain_txid'), 'payment monitor must not fake-pay without chain proof');
});

console.log('✅ payment-honesty: ' + pass + ' tests passed');
