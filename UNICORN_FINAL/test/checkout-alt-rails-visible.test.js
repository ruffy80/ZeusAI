'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'src/site/v2/client.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'src/site/v2/shell.js'), 'utf8');
const sov = fs.readFileSync(path.join(ROOT, 'src/site/sovereign-commerce.js'), 'utf8');

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('✓', name); passed += 1; }
  catch (e) { console.error('✗', name); console.error(e && e.stack || e); process.exit(1); }
}

check('hydrateCheckout calls hydratePaymentRails', () => {
  assert.ok(/function hydrateCheckout\(\)\{[\s\S]*hydratePaymentRails\(\)/.test(client));
});

check('boot hydrates payment rails outside commerce-proof pages', () => {
  assert.ok(client.includes('__paymentRailsBooted'));
});

check('product buy opens method chooser, not instant BTC', () => {
  assert.ok(client.includes("mode === 'btc-direct'"));
  assert.ok(client.includes("'/checkout/?plan=' + encodeURIComponent(id)"));
  assert.ok(client.includes("ctaLabel: 'Buy now →'"));
});

check('checkout shell exposes PayPal + NOW top CTAs and visible chips', () => {
  assert.ok(shell.includes('id="coBuyPaypalTop"'));
  assert.ok(shell.includes('id="coBuyNowTop"'));
  assert.ok(shell.includes('data-method="paypal"'));
  assert.ok(shell.includes('data-method="nowpayments"'));
  assert.ok(!/data-method="paypal" style="display:none"/.test(shell));
});

check('sovereign invoice page shows alt-rail buttons by default', () => {
  assert.ok(sov.includes('id="payPaypalBtn"'));
  assert.ok(sov.includes('id="payNowBtn"'));
  assert.ok(!/id="payPaypalBtn" style="display:none/.test(sov));
  assert.ok(sov.includes('id="altRailsCard"'));
  assert.ok(!/id="altRailsCard" style="display:none"/.test(sov));
});

console.log('checkout-alt-rails-visible.test.js: ' + passed + ' passed');
process.exit(0);
