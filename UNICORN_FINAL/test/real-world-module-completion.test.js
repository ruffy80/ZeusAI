// =====================================================================
// real-world-module-completion.test.js
// Locks the P0 commerce / honesty / settle-path completions:
//   • PayPal secret alias (PAYPAL_CLIENT_SECRET || PAYPAL_SECRET)
//   • checkout-recovery mailer path → src/commerce/transactional-email
//   • IndexNow key shared across traffic-engine + programmatic-seo
//   • NOWPayments emits payment:confirmed even without a pre-wired bus
//   • Dropship sourceMode never marks world-feed as LIVE
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

const ROOT = path.join(__dirname, '..');

check('uaic accepts PAYPAL_CLIENT_SECRET alias (not only PAYPAL_SECRET)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/commerce/uaic.js'), 'utf8');
  assert.ok(src.includes('PAYPAL_CLIENT_SECRET'), 'must reference canonical secret');
  assert.ok(src.includes('PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET')
    || src.includes("PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET"),
    'must alias PAYPAL_SECRET');
  assert.ok(src.includes('_capturePaypalOrder') || src.includes('capturePaypalOrder')
    || src.includes('/v2/checkout/orders/'),
    'capture must call real PayPal Orders API');
});

check('multi-payment-rails + paymentGateway use PayPal secret alias', () => {
  const rails = fs.readFileSync(path.join(ROOT, 'backend/modules/multi-payment-rails.js'), 'utf8');
  const gw = fs.readFileSync(path.join(ROOT, 'backend/modules/paymentGateway.js'), 'utf8');
  assert.ok(rails.includes('PAYPAL_CLIENT_SECRET'), 'rails must use CLIENT_SECRET');
  assert.ok(gw.includes('PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET')
    || gw.includes("PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET"));
});

check('checkout-recovery-agent loads src/commerce/transactional-email', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/modules/checkout-recovery-agent.js'), 'utf8');
  assert.ok(src.includes("src', 'commerce', 'transactional-email.js'")
    || src.includes('transactional-email.js'),
    'must require commerce transactional-email');
  assert.ok(!src.includes("require(path.join(__dirname, 'transactional-email.js'))"),
    'must NOT require sibling stub under backend/modules');
  assert.ok(src.includes('sendRaw'), 'must use sendRaw HTTPS path');
});

check('IndexNow keys unify MARKETING_INDEXNOW_KEY + INDEXNOW_KEY', () => {
  const pseo = fs.readFileSync(path.join(ROOT, 'backend/modules/marketing-innovations/programmatic-seo.js'), 'utf8');
  const traffic = fs.readFileSync(path.join(ROOT, 'backend/modules/traffic-engine.js'), 'utf8');
  assert.ok(pseo.includes('MARKETING_INDEXNOW_KEY || process.env.INDEXNOW_KEY')
    || pseo.includes("MARKETING_INDEXNOW_KEY || process.env.INDEXNOW_KEY"));
  assert.ok(traffic.includes('MARKETING_INDEXNOW_KEY'), 'traffic-engine accepts marketing key');
});

check('NOWPayments processWebhook creates EventBus and emits payment:confirmed', () => {
  delete global._unicornEventBus;
  const np = require('../backend/modules/nowPayments');
  let saw = null;
  // Fresh bus will be created inside processWebhook
  const result = np.processWebhook({
    payment_id: 'np_test_' + Date.now(),
    payment_status: 'finished',
    order_id: 'ord_test_1',
    price_amount: 42,
    pay_currency: 'btc',
    actually_paid: 0.001,
  });
  assert.ok(result && result.status === 'finished');
  assert.ok(global._unicornEventBus instanceof EventEmitter, 'bus must exist after emit path');
  // Listen and re-emit via second confirmation status to avoid duplicate guard
  global._unicornEventBus.on('payment:confirmed', (evt) => { saw = evt; });
  np.processWebhook({
    payment_id: 'np_test_b_' + Date.now(),
    payment_status: 'confirmed',
    order_id: 'ord_test_2',
    price_amount: 10,
    pay_currency: 'usdt',
  });
  assert.ok(saw && saw.provider === 'nowpayments', 'must emit payment:confirmed');
  assert.equal(saw.orderId, 'ord_test_2');
});

check('dropship-ssr: world-feed is ZEUS-CURATED, CJ auto uses cj-global-dropship', () => {
  const ssr = require('../src/site/dropship-ssr');
  const world = ssr.sourceMode({
    source: 'dummyjson-world',
    supplier: 'world-feed',
    demoOnly: false,
  });
  assert.equal(world.live, false);
  assert.equal(world.label, 'ZEUS-CURATED');
  const cj = ssr.sourceMode({ source: 'cj', supplier: 'cj-dropshipping', live: true });
  assert.equal(cj.live, true);
  const badge = ssr.fulfillBadge({
    delivery: { mode: 'cj-global-dropship', automated: true },
  });
  assert.equal(badge.label, 'AUTO-FULFIL');
  const desk = ssr.fulfillBadge({
    delivery: { mode: 'zeus-fulfillment-desk', automated: false },
  });
  assert.equal(desk.label, 'DESK-FULFIL');
});

check('src/index.js storefront JS no longer marks world-feed as LIVE', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  assert.ok(src.includes('isWorldFeed'), 'client sourceMode must gate world-feed');
  assert.ok(!src.includes('"dummyjson-world","fakestore-world","escuela-world"]'),
    'must not list world-feed sources as LIVE');
  assert.ok(src.includes('cj-global-dropship'), 'AUTO-FULFIL must recognize cj-global-dropship');
});

check('backend wires Stripe/PayPal settle via pay-fulfill + NOWPayments listener', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
  assert.ok(src.includes('_settleProviderPayment'), 'settle helper must exist');
  assert.ok(src.includes("source: 'stripe'") || src.includes("source: \"stripe\"")
    || src.includes(", 'stripe')"), 'stripe webhook must settle');
  assert.ok(src.includes("source: 'paypal'") || src.includes(", 'paypal')"), 'paypal webhook must settle');
  assert.ok(src.includes("payment:confirmed"), 'NOWPayments listener must be wired');
  assert.ok(src.includes('retention:') && src.includes('offer:'), 'growth-brain gets retention+offer');
});

check('activation readiness includes PayPal, IPN, CJ, Stripe prices', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
  assert.ok(src.includes("id: 'paypal_rail'"));
  assert.ok(src.includes("id: 'nowpayments_ipn'"));
  assert.ok(src.includes("id: 'cj_dropship'"));
  assert.ok(src.includes("id: 'stripe_subscriptions'"));
});

console.log('\n\u2705 real-world-module-completion: ' + passed + ' tests passed');
