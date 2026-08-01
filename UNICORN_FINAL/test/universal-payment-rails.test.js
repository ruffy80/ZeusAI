'use strict';

/**
 * Universal Payment Rails — every sell surface lands on BTC · PayPal · NOW.
 * Covers catalog, store, dropship, social tips, and virtual SKU minting.
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

const upr = require('../src/commerce/universal-payment-rails');
const buyability = require('../src/commerce/commerce-buyability');

check('virtual SKU prefixes parse + assess as buyable', () => {
  assert.equal(upr.isVirtualSku('dropship:abc-1'), true);
  assert.equal(upr.isVirtualSku('ds:abc-1'), true);
  assert.equal(upr.isVirtualSku('social-tip:alice'), true);
  assert.equal(upr.isVirtualSku('tip:u_1'), true);
  assert.equal(upr.isVirtualSku('adaptive-ai'), false);
  const d = upr.parseVirtualSku('dropship:widget-9');
  assert.equal(d.prefix, 'dropship');
  assert.equal(d.id, 'widget-9');
  const a = upr.assessVirtualBuyability('social-tip:bob');
  assert.equal(a.buyable, true);
  assert.equal(a.mode, 'checkout');
  assert.ok(/choose payment/i.test(a.ctaLabel));
});

check('chooserHref carries amount for tips / quotes', () => {
  const href = upr.chooserHref('social-tip:bob', { amountUsd: 12 });
  assert.ok(href.includes('plan=social-tip%3Abob') || href.includes('plan=' + encodeURIComponent('social-tip:bob')));
  assert.ok(href.includes('amount=12'));
});

check('commerce-buyability refuses non-dispatchable / demo dropship virtual SKUs', () => {
  const blocked = buyability.assessBuyability({
    id: 'dropship:sku-1', demoOnly: true, synthetic: true, dispatchable: false, type: 'physical', niche: 'dropship',
  });
  assert.equal(blocked.buyable, false);
  assert.ok(/demo|dispatchable|not_for_sale|preview/i.test(String(blocked.reason || blocked.ctaLabel || '')));

  const ok = buyability.assessBuyability({
    id: 'dropship:real-vid-1', dispatchable: true, demoOnly: false, type: 'physical', niche: 'dropship',
  });
  assert.equal(ok.buyable, true);
  assert.ok(ok.ctaHref && ok.ctaHref.includes('dropship'));
});

check('catalog/store CTAs open chooser, not instant BTC', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes("mode === 'btc-direct'"));
  assert.ok(client.includes('Every other product surface'));
  assert.ok(client.includes("ctaLabel: 'Buy → choose payment'"));
  assert.ok(client.includes("openStoreCheckout"));
  assert.ok(client.includes("'/checkout/?plan=' + encodeURIComponent(sid)"));
  // Instant BTC only on checkout page
  assert.ok(client.includes('onCheckoutPage'));
});

check('checkout SSR preserves virtual SKU colons + amount query', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('[^a-zA-Z0-9_.:@-]'));
  const index = read('src/index.js');
  assert.ok(index.includes('isVirtualSku'));
  assert.ok(index.includes("searchParams.get('amount')"));
  assert.ok(index.includes('social-tip:'));
});

check('dropship modal exposes PayPal + NOWPayments alt rails', () => {
  const index = read('src/index.js');
  assert.ok(index.includes('id="ds-pay-paypal"'));
  assert.ok(index.includes('id="ds-pay-now"'));
  assert.ok(index.includes('function startAltRail'));
  assert.ok(index.includes('dropship:'));
  assert.ok(index.includes('/paypal/create'));
  assert.ok(index.includes('/nowpayments/create'));
  assert.ok(index.includes('Buy → choose payment'));
});

check('social tip panel deep-links to multi-rail chooser', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('zaSocialTipPanel'));
  assert.ok(shell.includes("plan='social-tip:'"));
  assert.ok(shell.includes('&amount='));
});

check('sovereign createOrder accepts amountUsd for virtual SKUs', () => {
  const sov = read('src/site/sovereign-commerce.js');
  assert.ok(sov.includes('amountUsdOverride'));
  assert.ok(sov.includes('isVirtualSku'));
  assert.ok(sov.includes('skipBtcDiscount'));
  assert.ok(sov.includes('dropshipProductId'));
  assert.ok(sov.includes('socialTipTarget'));
});

check('sell-surface ARC checkout uses chooser labels', () => {
  const sell = read('src/site/v2/sell-surface.js');
  assert.ok(sell.includes('Checkout → choose payment') || sell.includes('choose payment'));
  assert.ok(sell.includes('data-buy-mode="checkout"') || sell.includes("data-buy-mode='checkout'") || sell.includes('data-buy-mode="checkout"'));
});

check('primaryCtaHtml forever choke-point', () => {
  const html = upr.primaryCtaHtml('adaptive-ai', {});
  assert.ok(html.includes('/checkout/?plan='));
  assert.ok(html.includes('data-buy-mode="checkout"'));
  assert.ok(/choose payment/i.test(html));
});

console.log('universal-payment-rails.test.js: ' + passed + ' passed');
process.exit(0);
