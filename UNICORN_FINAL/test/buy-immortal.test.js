'use strict';

/**
 * Buy Immortal OS — CI lock so Buy → BTC can never regress to email-prompt hell.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.COMMERCE_RATE_LIMIT = '0';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'buy-immortal-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

const immortal = require('../src/commerce/buy-immortal');
const commerce = require('../src/site/sovereign-commerce');
const buyability = require('../src/commerce/commerce-buyability');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('  ✓', name); });
  }
  passed += 1;
  console.log('  ✓', name);
  return undefined;
}

async function run() {
  await check('scanAll reports immortal doctrine green', () => {
    const report = immortal.scanAll();
    assert.strictEqual(report.ok, true, JSON.stringify(report.checks, null, 2));
    assert.strictEqual(report.protocol, 'BUY-IMMORTAL/1.0');
  });

  await check('sovereignBuy source forbids window.prompt', () => {
    const r = immortal.assertNoPromptInSovereignBuy();
    assert.strictEqual(r.ok, true, r.violations.join(','));
  });

  await check('createOrder source keeps email optional', () => {
    const r = immortal.assertCreateOrderEmailOptional();
    assert.strictEqual(r.ok, true, r.violations.join(','));
  });

  await check('createOrder buyability is fail-closed', () => {
    const r = immortal.assertBuyabilityFailClosed();
    assert.strictEqual(r.ok, true, r.violations.join(','));
  });

  await check('client CTAs go through buyability', () => {
    const r = immortal.assertClientHasBuyabilityCta();
    assert.strictEqual(r.ok, true, r.violations.join(','));
  });

  await check('hydrateMasterCatalog preserves buyability fields', () => {
    const r = immortal.assertHydratePreservesBuyability();
    assert.strictEqual(r.ok, true, r.violations.join(','));
  });

  await check('HTTP: one-click mint without email → checkout_url', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'SEO Pack', priceUsd: 79, group: 'instant', tier: 'instant',
      }),
    };
    const out = await commerce.createOrder(ctx, { serviceId: 'instant-seo-content-pack', qty: 1 });
    assert.ok(out.order, JSON.stringify(out));
    assert.ok(out.order.checkout_url, 'checkout_url required');
    assert.ok(out.order.qr_url, 'qr_url required');
    assert.ok(Number(out.order.amount_btc) > 0, 'amount_btc required');
    assert.strictEqual(String(out.order.buyer && out.order.buyer.email || ''), '');
  });

  await check('contact SKUs never mint self-serve invoices', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'Enterprise', priceUsd: 250000, group: 'enterprise', tier: 'enterprise',
      }),
    };
    const out = await commerce.createOrder(ctx, {
      serviceId: 'ent-platform-license', qty: 1, email: 'ceo@corp.com',
    });
    assert.ok(out.error === 'contact_required' || out.error === 'service_not_buyable', out.error);
  });

  await check('high-ticket vertical is contact, not Buy CTA', () => {
    const a = buyability.assessBuyability({
      id: 'govtech-os', group: 'vertical', priceUsd: 5999,
    });
    assert.strictEqual(a.buyable, false);
    assert.strictEqual(a.mode, 'contact');
  });

  await check('checkoutHtml exposes shareable invoice + optional email capture', () => {
    const html = commerce.checkoutHtml({
      orderId: 'ord_immortal_test',
      serviceId: 'instant-seo-content-pack',
      serviceName: 'SEO Pack',
      qty: 1,
      currency: 'USD',
      subtotal_fiat: 79,
      amount_btc: 0.001,
      amount_sats: 100000,
      btc_price_at_quote: 79000,
      price_source: 'test',
      receive_address: 'bc1qtest',
      bip21: 'bitcoin:bc1qtest?amount=0.001',
      access_token: 't_test',
      expires_at_ms: Date.now() + 3600000,
      buyer: { email: '' },
    }, {});
    assert.ok(html.includes('Share invoice') || html.includes('shareInvoiceUrl'), 'share invoice');
    assert.ok(html.includes('Exact sats') || html.includes('100,000') || html.includes('100000'), 'sats');
    assert.ok(html.includes('deliveryEmail') || html.includes('emailCaptureCard'), 'optional email capture');
    assert.ok(html.includes('Pay exactly'), 'payment UI');
  });

  await check('pricing page enterprise CTA is contact, not checkout form', () => {
    const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
    assert.ok(/data-plan-cta="enterprise"[^>]*href="\/enterprise#enterprise-contact"/.test(shell)
      || /data-plan-cta="enterprise"[\s\S]{0,80}enterprise#enterprise-contact/.test(shell),
      'enterprise plan must request proposal');
    assert.ok(!/data-plan-cta="enterprise"[^>]*\/checkout\/\?plan=enterprise/.test(shell),
      'enterprise must not deep-link to self-serve checkout');
  });

  await check('getStatus exposes immortal flag', () => {
    const st = immortal.getStatus();
    assert.strictEqual(st.active, true);
    assert.strictEqual(st.immortal, true);
  });

  console.log(`\n✅ buy-immortal: ${passed} tests passed\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
