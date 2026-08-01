'use strict';

/**
 * PayPal buyer-failover — seller-self-pay must never strand the buyer.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

const alt = require('../src/commerce/alt-rails-os');

check('classifyPaypalBuyerError detects seller-self-pay', () => {
  const c = alt.classifyPaypalBuyerError(
    'You are logging into the account of the seller for this purchase. Please change your login information and try again.'
  );
  assert.ok(c);
  assert.equal(c.code, 'paypal_seller_self_pay');
  assert.ok(/buyer/i.test(c.message));
  assert.ok(/Bitcoin|card/i.test(c.message));
});

check('classifyPaypalBuyerError returns null for unrelated errors', () => {
  assert.equal(alt.classifyPaypalBuyerError('network timeout'), null);
});

check('PayPal create uses guest/buyer-biased experience_context', () => {
  const src = read('src/commerce/alt-rails-os.js');
  assert.ok(src.includes("landing_page: 'GUEST_CHECKOUT'") || src.includes('GUEST_CHECKOUT'));
  assert.ok(src.includes("shipping_preference: 'NO_SHIPPING'"));
  assert.ok(src.includes('payment_source'));
  assert.ok(src.includes("landing_page: 'BILLING'"));
  assert.ok(src.includes('payer-action'));
  assert.ok(src.includes('buyerHint'));
});

check('invoice handles paypal=cancel with failover banner', () => {
  const sov = read('src/site/sovereign-commerce.js');
  assert.ok(sov.includes('paypalFailBanner'));
  assert.ok(sov.includes("paypalState==='cancel'") || sov.includes("paypal')==='cancel'") || sov.includes("paypalState==='cancel'"));
  assert.ok(sov.includes('seller account'));
  assert.ok(sov.includes('paypalFailRetry'));
  assert.ok(sov.includes('paypalFailNow'));
  assert.ok(sov.includes('btcPayCard'));
  assert.ok(sov.includes('window.open'));
});

check('capture failures return buyerMessage + failover', () => {
  const sov = read('src/site/sovereign-commerce.js');
  assert.ok(sov.includes('buyerMessage'));
  assert.ok(sov.includes('classifyPaypalBuyerError'));
  assert.ok(sov.includes("failoverPlan('paypal')"));
});

check('chooser opens PayPal with buyer hint', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('buyerHint'));
  assert.ok(client.includes("window.open(pp.approveHref"));
});

check('production PayPal env defaults to live when unset', () => {
  const prevNode = process.env.NODE_ENV;
  const prevEnv = process.env.PAYPAL_ENV;
  const prevMode = process.env.PAYPAL_MODE;
  try {
    delete process.env.PAYPAL_ENV;
    delete process.env.PAYPAL_MODE;
    process.env.NODE_ENV = 'production';
    // Re-require fresh module
    const resolved = require.resolve('../src/commerce/alt-rails-os');
    delete require.cache[resolved];
    const fresh = require('../src/commerce/alt-rails-os');
    assert.equal(fresh.paypalEnv(), 'live');
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevEnv == null) delete process.env.PAYPAL_ENV; else process.env.PAYPAL_ENV = prevEnv;
    if (prevMode == null) delete process.env.PAYPAL_MODE; else process.env.PAYPAL_MODE = prevMode;
    const resolved = require.resolve('../src/commerce/alt-rails-os');
    delete require.cache[resolved];
  }
});

console.log('paypal-buyer-failover.test.js: ' + passed + ' passed');
process.exit(0);
