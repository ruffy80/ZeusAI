/**
 * Alt rails — PayPal + NOWPayments on sovereign storefront (BTC remains primary).
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';
process.env.COMMERCE_WATCH_MS = '9999999';
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || 'test-admin-secret-alt-rails';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failed = 0;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed += 1; console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e)); }
}

check('alt-rails-os honesty gates', () => {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_SECRET;
  delete process.env.NOWPAYMENTS_API_KEY;
  const alt = require('../src/commerce/alt-rails-os');
  assert.equal(alt.isPaypalArmed(), false);
  assert.equal(alt.isNowPaymentsArmed(), false);
  const st = alt.getStatus();
  assert.ok(st.protocol === 'AROS/1.0');
  assert.ok(/BTC/.test(st.honesty));
});

check('paymentGateway surfaces nowpayments only when key armed', () => {
  delete process.env.NOWPAYMENTS_API_KEY;
  const PaymentGateway = require('../backend/modules/paymentGateway');
  const gw = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;
  assert.ok(!gw.getPaymentMethods().some((m) => m.id === 'nowpayments'));
  process.env.NOWPAYMENTS_API_KEY = 'np_live_test_key_abcdef123456';
  const gw2 = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;
  assert.ok(gw2.getPaymentMethods().some((m) => m.id === 'nowpayments' && m.active));
  assert.ok(gw2.getPaymentMethods().some((m) => m.id === 'crypto_btc' && m.active && m.primary));
  delete process.env.NOWPAYMENTS_API_KEY;
});

check('nowPayments createInvoice accepts sovereign orderId + any currency', () => {
  const src = read('backend/modules/nowPayments.js');
  assert.ok(src.includes('orderId: callerOrderId'));
  assert.ok(src.includes("cur !== 'any'"));
  assert.ok(src.includes('ord_'));
});

check('sovereign provider settle + paypal/now create routes', () => {
  const src = read('src/site/sovereign-commerce.js');
  assert.ok(src.includes('function markOrderPaidFromProvider'));
  assert.ok(src.includes('/paypal/create'));
  assert.ok(src.includes('/paypal/capture'));
  assert.ok(src.includes('/nowpayments/create'));
  assert.ok(src.includes('/provider-settle'));
  assert.ok(src.includes('payPaypalBtn'));
  assert.ok(src.includes('payNowBtn'));
  assert.ok(src.includes('markOrderPaidFromProvider'));
});

check('backend webhooks bridge sovereign ord_* settle', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes("provider-settle"));
  assert.ok(src.includes("x-internal-settle-secret"));
  assert.ok(src.includes("evt.provider !== 'nowpayments'") || src.includes("provider !== 'nowpayments'"));
});

check('checkout UI chips + client handlers', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('data-method="paypal"'));
  assert.ok(shell.includes('data-method="nowpayments"'));
  assert.ok(shell.includes('id="coPanelNow"'));
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('coPayNP'));
  assert.ok(client.includes('/nowpayments/create'));
  assert.ok(client.includes('/paypal/create'));
  const widget = read('src/site/unicorn-checkout.js');
  assert.ok(widget.includes('data-ck-paypal'));
  assert.ok(widget.includes('data-ck-now'));
});

check('markOrderPaidFromProvider settles pending order idempotently', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alt-rails-'));
  process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');
  // Fresh require path — use existing module; seed order manually.
  const commerce = require('../src/site/sovereign-commerce');
  assert.equal(typeof commerce.markOrderPaidFromProvider, 'function');
  const orderId = 'ord_altrailstest01';
  const access = 't_altrailstesttoken01';
  const order = {
    orderId,
    serviceId: 'starter',
    serviceName: 'Starter',
    status: 'pending',
    access_token: access,
    amount_sats: 123456,
    amount_btc: 0.00123456,
    subtotal_fiat: 49,
    currency: 'USD',
    buyer: { email: 'buyer-alt@example.com' },
    meta: {},
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    expires_at_ms: Date.now() + 3600000,
    txids: [],
  };
  commerce.ORDERS.set(orderId, order);
  const r1 = commerce.markOrderPaidFromProvider(orderId, { provider: 'paypal', providerRef: 'CAP123' });
  assert.ok(r1.ok);
  assert.equal(commerce.ORDERS.get(orderId).status, 'paid');
  assert.equal(commerce.ORDERS.get(orderId).paid_via, 'paypal');
  const r2 = commerce.markOrderPaidFromProvider(orderId, { provider: 'paypal', providerRef: 'CAP123' });
  assert.ok(r2.ok && r2.duplicate);
});

if (failed) {
  console.error('alt-rails-paypal-nowpayments.test.js: ' + failed + ' failed');
  process.exit(1);
}
console.log('alt-rails-paypal-nowpayments.test.js: all assertions passed');
