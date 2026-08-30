'use strict';

/**
 * buy-click-instant.test.js — guards Buy → checkout latency fix:
 *   1. Buy capture uses navigateSpa (via goCheckoutSpa), not hard location.href
 *   2. Prefetch allowed for data-buy-mode=checkout sovereign links
 *   3. SSR checkout does not await full quotePublicPricing without a short race
 *   4. getBtcPrice uses __btcSpotCache / fast timeout on createOrder
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

const client = read('src/site/v2/client.js');
const site = read('src/index.js');
const commerce = read('src/site/sovereign-commerce.js');

check('Buy capture uses goCheckoutSpa/navigateSpa not hard location.href for checkout mode', () => {
  assert.ok(client.includes('function goCheckoutSpa'), 'goCheckoutSpa helper');
  assert.ok(client.includes('function navigateSpa'), 'navigateSpa present');
  // Capture handler body: after instantBtc branch, must call goCheckoutSpa
  const captureIdx = client.indexOf("window.__sovereignBuyBound = true");
  assert.ok(captureIdx > 0, 'sovereign buy capture bound');
  const captureSlice = client.slice(captureIdx, captureIdx + 2200);
  assert.ok(captureSlice.includes('goCheckoutSpa(href'), 'capture → goCheckoutSpa');
  assert.ok(!/const href = '\/checkout\/\?plan='[\s\S]{0,120}window\.location\.href = href/.test(captureSlice),
    'must not hard-assign location.href for checkout chooser');
  assert.ok(client.includes("Opening checkout…") || client.includes("Opening checkout…"),
    'immediate button feedback label');
});

check('Prefetch allowed for data-buy-mode=checkout sovereign links', () => {
  assert.ok(client.includes('function skipSovereignBuyPrefetch'), 'selective skip helper');
  assert.ok(client.includes('data-buy-mode="checkout"') || client.includes("data-buy-mode=\"checkout\"")
    || client.includes("[data-buy-mode=\"checkout\"]")
    || /a\[data-sovereign-buy\]\[data-buy-mode="checkout"\]/.test(client),
    'idle/hover targets checkout-mode sovereign links');
  // Blanket skip of ALL data-sovereign-buy must be gone from prefetch paths
  const pointerenter = client.slice(client.indexOf("document.addEventListener('pointerenter'"));
  const pointerBody = pointerenter.slice(0, 900);
  assert.ok(!/if \(a\.hasAttribute\('data-sovereign-buy'\)\) return;/.test(pointerBody),
    'no blanket sovereign-buy skip on pointerenter');
  assert.ok(pointerBody.includes('skipSovereignBuyPrefetch') || pointerBody.includes('warmBtcRateOnce'),
    'uses selective skip / warm');
  assert.ok(client.includes("btc-direct") && client.includes('skipSovereignBuyPrefetch'),
    'btc-direct still skipped');
});

check('Buy CTAs warm /api/payment/btc-rate once on hover', () => {
  assert.ok(client.includes('function warmBtcRateOnce'), 'warmBtcRateOnce');
  assert.ok(client.includes("/api/payment/btc-rate"), 'btc-rate fetch');
  assert.ok(client.includes('__btcRateWarmed'), 'once guard');
});

check('sovereignBuy + store/hero paths prefer navigateSpa for /checkout', () => {
  assert.ok(/navigateSpa\(target,\s*\{\s*push:\s*true\s*\}\)/.test(client)
    || client.includes("navigateSpa(target, { push: true })"),
    'sovereignBuy uses navigateSpa for same-origin checkout');
  assert.ok(client.includes('goCheckoutSpa') && /hero_quick_buy|bindHeroQuickBuy/.test(client),
    'hero quick buy wired');
  const openStore = client.slice(client.indexOf('function openStoreCheckout'));
  assert.ok(openStore.includes('goCheckoutSpa'), 'openStoreCheckout → goCheckoutSpa');
});

check('SSR checkout prefers resolveCanonicalUsd + short Promise.race (≤150ms)', () => {
  // Locate checkout planQ block
  const idx = site.indexOf("if (route === '/checkout')");
  assert.ok(idx > 0, 'checkout SSR branch');
  const block = site.slice(idx, idx + 1800);
  assert.ok(block.includes('resolveCanonicalUsd(planQ)'), 'sync canonical first');
  assert.ok(block.includes('Promise.race'), 'races quote with timeout');
  assert.ok(/CHECKOUT_SSR_QUOTE_MS|150/.test(block), 'short timeout ≤150ms');
  // Must NOT be a bare await quotePublicPricing without race in this block
  const bareAwait = /await quotePublicPricing\(planQ/.test(block)
    && !/Promise\.race/.test(block);
  assert.ok(!bareAwait, 'must not bare-await quotePublicPricing on critical path');
});

check('getBtcPrice uses __btcSpotCache and fast timeout; createOrder uses fast path', () => {
  assert.ok(commerce.includes('global.__btcSpotCache') || commerce.includes('__btcSpotCache'),
    'reads shared spot cache');
  assert.ok(/getBtcPrice\(\{\s*fast:\s*true\s*\}\)/.test(commerce)
    || commerce.includes('getBtcPrice({ fast: true })'),
    'createOrder calls getBtcPrice({ fast: true })');
  assert.ok(/1500/.test(commerce) && /fast/.test(commerce), '≤1500ms oracle timeout on fast');
  assert.ok(commerce.includes('setImmediate') && commerce.includes('bridgeCreate'),
    'bridgeCreate deferred via setImmediate');
});

console.log('buy-click-instant.test.js passed');
process.exit(0);
