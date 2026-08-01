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
const nginx = fs.readFileSync(path.join(ROOT, 'scripts/nginx-unicorn.conf'), 'utf8');

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('✓', name); passed += 1; }
  catch (e) { console.error('✗', name); console.error(e && e.stack || e); process.exit(1); }
}

check('hydrateCheckout preserves SSR amount and syncs PP/NP inputs', () => {
  assert.ok(client.includes('readBuyingAmount'));
  assert.ok(client.includes('syncAmounts'));
  assert.ok(client.includes("set('coAmountNP'"));
  assert.ok(client.includes('Never wipe a good value') || client.includes('never wipe') || client.includes('Preserve SSR amount'));
});

check('PayPal/NOW top CTAs call startCatalogRail without amount gate', () => {
  assert.ok(client.includes('async function startCatalogRail'));
  assert.ok(client.includes("startCatalogRail('paypal'"));
  assert.ok(client.includes("startCatalogRail('nowpayments'"));
  // Must not require amt>=1 before create for catalog SKUs in startCatalogRail
  const fn = client.slice(client.indexOf('async function startCatalogRail'), client.indexOf('async function startCatalogRail') + 1800);
  assert.ok(!/if\s*\(\s*!amt\s*\|\|\s*amt\s*<\s*1\s*\)/.test(fn), 'startCatalogRail must not hard-require client amount');
  assert.ok(fn.includes('/api/checkout/create'));
});

check('shell SSR fills PayPal/NOW amount+plan from product', () => {
  assert.ok(shell.includes('id="coAmountPP"') && shell.includes('value="${ssrAmountAttr}"'));
  assert.ok(shell.includes('id="coPlanPP"') && shell.includes('value="${ssrPlan}"'));
  assert.ok(shell.includes('id="coAmountNP"') && shell.includes('value="${ssrAmountAttr}"'));
  assert.ok(shell.includes('id="coPlanNP"') && shell.includes('value="${ssrPlan}"'));
});

check('nginx pins checkout QR + /api/qr to site (beats ^~ /api/)', () => {
  assert.ok(/location\s+\^~\s+\/api\/checkout\/ord_/.test(nginx),
    'expected ^~ /api/checkout/ord_ pin (wins over ^~ /api/)');
  assert.ok(/location\s+\^~\s+\/checkout\//.test(nginx),
    'expected ^~ /checkout/ for preferred /checkout/:id/qr.svg');
  assert.ok(/location\s+=\s+\/api\/qr/.test(nginx));
  assert.ok(nginx.includes('proxy_pass http://unicorn_site'));
});

check('nginx /checkout/ clears inherited CSP and passes X-CSP-Nonce', () => {
  const idx = nginx.search(/location\s+\^~\s+\/checkout\//);
  assert.ok(idx >= 0, 'checkout location missing');
  const block = nginx.slice(idx, idx + 900);
  assert.ok(/add_header\s+Cache-Control/.test(block),
    'checkout location must set add_header (clears server CSP inheritance)');
  assert.ok(/X-CSP-Nonce/.test(block),
    'checkout location must pass X-CSP-Nonce so script nonces match CSP');
});

check('sovereign invoice page has QR img fallback', () => {
  assert.ok(sov.includes('btcQrImg'));
  assert.ok(sov.includes('/checkout/${orderId}/qr.svg') || sov.includes('/checkout/'));
  assert.ok(sov.includes("/api/qr?d="));
  assert.ok(sov.includes('onerror='));
});

check('BTC top CTA wired via startCatalogRail + sovereignBuy', () => {
  assert.ok(client.includes("startCatalogRail('btc'"));
  assert.ok(client.includes('coSovereignPrimary'));
});

console.log('checkout-payments-never-dead.test.js: ' + passed + ' passed');
process.exit(0);
