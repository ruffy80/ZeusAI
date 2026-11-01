'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pay = require('../src/commerce/pay-options');
const shell = require('../src/site/v2/shell');
const four = require('../src/site/v2/four-products');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('four rails exist for any product id', () => {
  const rows = pay.payOptions('instant-website-audit');
  assert.deepStrictEqual(rows.map((row) => row.id), ['btc', 'paypal', 'card', 'nowpayments']);
  rows.forEach((row) => {
    assert.ok(row.href.indexOf('/checkout/?plan=instant-website-audit&rail=' + row.id) === 0, row.href);
  });
});

check('shelf cards and the product page offer every rail', () => {
  const services = shell.getHtml('/services');
  const card = services.match(/<article[^>]*data-product-id="instant-website-audit"[\s\S]*?<\/article>/);
  assert.ok(card, 'audit card');
  ['btc', 'paypal', 'card', 'nowpayments'].forEach((rail) => {
    assert.ok(card[0].includes('data-pay-rail="' + rail + '"'), rail);
    assert.ok(card[0].includes('rail=' + rail), rail);
  });
  assert.ok(!card[0].includes('bitcoin:?'), 'the card does not skip checkout');
  const detail = shell.getHtml('/services/instant-website-audit');
  assert.ok(detail.includes('data-pay-rail="paypal"'));
  assert.match(detail, /data-pay-rail="paypal"[^>]*>PayPal · \$[0-9,]+\.[0-9]{2}/);
  assert.match(detail, /data-pay-rail="btc"[^>]*>Bitcoin</);
  assert.ok(detail.includes('data-pay-rail="card"'));
  assert.ok(detail.includes('data-pay-rail="nowpayments"'));
});

check('checkout keeps Bitcoin, PayPal, card, and NOWPayments visible', () => {
  const html = shell.getHtml('/checkout', { plan: 'instant-website-audit' });
  assert.ok(html.includes('id="coSovereignPrimary"'));
  assert.ok(html.includes('id="coBuyPaypalTop"'));
  assert.ok(html.includes('id="coBuyCardTop"'));
  assert.ok(html.includes('id="coBuyNowTop"'));
  assert.ok(html.includes('data-method="card"'));
  assert.ok(html.includes('Every product can be paid with Bitcoin, PayPal, card, or NOWPayments.'));
  const client = fs.readFileSync(path.join(__dirname, '../src/site/v2/client.js'), 'utf8');
  assert.ok(!client.includes('paypalChip.style.display'));
  assert.ok(!client.includes("topPp.style.display"));
  assert.ok(client.includes("startCatalogRail('card'"));
  const invoice = fs.readFileSync(path.join(__dirname, '../src/site/sovereign-commerce.js'), 'utf8');
  assert.ok(invoice.includes('id="payCardBtn"'));
  assert.ok(invoice.includes('id="payPaypalBtn"'));
  assert.ok(invoice.includes('id="payNowBtn"'));
  assert.ok(!invoice.includes("btnPp.style.display"));
});

check('a product detail still says Buy with BTC and also lists the other rails', () => {
  const html = four.render('/products/instant-website-audit');
  assert.ok(html.includes('Buy with BTC'));
  assert.ok(html.includes('data-pay-rail="paypal"'));
  assert.ok(html.includes('data-pay-rail="card"'));
  assert.ok(html.includes('data-pay-rail="nowpayments"'));
  assert.ok(html.includes('/checkout/?plan=instant-website-audit&amp;rail=btc') || html.includes('/checkout/?plan=instant-website-audit&rail=btc'));
});

console.log('✅ all-rails-every-product: ' + passed + ' tests passed');
