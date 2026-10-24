'use strict';

/**
 * Commerce Reality OS — honesty gates for buyability, fulfillment labeling,
 * delivery endpoints, and demo dropship checkout.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.FULFILLMENT_AI_ENABLED = '0';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-honesty-'));
process.env.UNICORN_DATA_DIR = path.join(tmpRoot, 'data');

const buyability = require('../src/commerce/commerce-buyability');
const engine = require('../src/site/v2/fulfillment-engine');
const registry = require('../src/site/v2/delivery-registry');
const commerce = require('../src/site/sovereign-commerce');
const shell = require('../src/site/v2/shell');

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
  await check('named enterprise rows sell the engagement pack', () => {
    const a = buyability.assessBuyability({ id: 'ent-platform-license', tier: 'enterprise', priceUSD: 250000 });
    assert.strictEqual(a.buyable, true);
    assert.strictEqual(a.mode, 'reserve');
    assert.strictEqual(a.reason, 'enterprise_pack');
    assert.ok(a.ctaHref.includes('/checkout/?plan=ent-platform-license'));
    const kick = buyability.assessBuyability({ id: 'ent-engagement-kickoff', tier: 'enterprise', group: 'enterprise-kickoff', priceUSD: 2500 });
    assert.strictEqual(kick.buyable, true);
    assert.strictEqual(kick.mode, 'reserve');
    assert.strictEqual(kick.reason, 'enterprise_kickoff');
    const bare = buyability.assessBuyability({ id: 'enterprise', tier: 'enterprise', priceUSD: 0 });
    assert.strictEqual(bare.buyable, false);
    assert.strictEqual(bare.mode, 'contact');
  });

  await check('instant SKUs are self-serve BTC', () => {
    const a = buyability.assessBuyability({ id: 'instant-seo-content-pack', tier: 'instant', priceUSD: 79 });
    assert.strictEqual(a.buyable, true);
    assert.strictEqual(a.mode, 'btc');
  });

  await check('professional SKUs are reserve (BTC kickoff), not fake instant product', () => {
    const a = buyability.assessBuyability({ id: 'professional-saas-mvp', tier: 'professional', priceUSD: 1999 });
    assert.strictEqual(a.buyable, true);
    assert.strictEqual(a.mode, 'reserve');
    assert.ok(/Reserve/i.test(a.ctaLabel));
  });

  await check('synthetic / zacc / demoOnly are unavailable', () => {
    assert.strictEqual(buyability.assessBuyability({ id: 'zacc-demo-1', group: 'zacc', priceUSD: 99 }).buyable, false);
    assert.strictEqual(buyability.assessBuyability({ id: 'unicorn-module-x', group: 'unicorn-auto-module', priceUSD: 99 }).buyable, false);
    assert.strictEqual(buyability.assessBuyability({ id: 'toy', demoOnly: true, priceUSD: 29 }).buyable, false);
  });

  await check('pickRecipe uses exact SKU map (website-audit ≠ landing-page)', () => {
    assert.strictEqual(engine.pickRecipe('instant-website-audit').id, 'website-audit');
    assert.strictEqual(engine.pickRecipe('instant-landing-page').id, 'landing-page');
    assert.strictEqual(engine.pickRecipe('professional-saas-mvp').id, 'code-scaffold');
  });

  await check('professional fulfillment flags requiresHumanFulfillment', async () => {
    registry.deliver({ id: 'r_pro', email: 'pro@example.com', services: ['professional-saas-mvp'], amount: 1999 });
    const out = await engine.fulfillReceipt({
      id: 'r_pro', email: 'pro@example.com', services: ['professional-saas-mvp'], amount: 1999,
    });
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.requiresHumanFulfillment, true);
    assert.ok(out.artifacts[0].requiresHumanFulfillment);
    assert.ok(['project-kickoff', 'enterprise-proposal'].includes(out.artifacts[0].deliverableType));
  });

  await check('needsHumanFulfillment true for professional-*', () => {
    assert.strictEqual(engine.needsHumanFulfillment({ amount: 10 }, 'professional-ai-agent'), true);
    assert.strictEqual(engine.needsHumanFulfillment({ amount: 10 }, 'instant-logo-kit'), false);
  });

  await check('delivery registry does not invent /api/unicorn/tasks URLs', () => {
    const set = registry.deliverableSet(
      { id: 'r_del', email: 'd@example.com' },
      'instant-seo-content-pack'
    );
    const blob = JSON.stringify(set);
    assert.ok(!blob.includes('/api/unicorn/tasks/'), 'no fake task API');
    assert.ok(!blob.includes('/api/webhooks/service-delivery/'), 'no fake webhook API');
    assert.ok(set.endpoints && set.endpoints.delivery, 'real delivery endpoint present');
    assert.ok(set.status === 'ready' || set.status === 'provisioned');
  });

  await check('createOrder allows instant SKUs without email (one-click BTC)', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'Logo Kit', priceUsd: 99, group: 'instant', tier: 'instant',
      }),
    };
    const noEmail = await commerce.createOrder(ctx, { serviceId: 'instant-logo-kit', qty: 1 });
    assert.ok(noEmail.order, JSON.stringify(noEmail));
    assert.ok(noEmail.order.orderId);
    assert.ok(noEmail.order.checkout_url || noEmail.order.amount_btc > 0);
    assert.strictEqual(String(noEmail.order.buyer && noEmail.order.buyer.email || ''), '');
  });

  await check('createOrder sells the enterprise engagement pack', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'Enterprise License', priceUsd: 250000, group: 'enterprise', tier: 'enterprise',
      }),
    };
    const ent = await commerce.createOrder(ctx, {
      serviceId: 'ent-platform-license', qty: 1, email: 'ceo@corp.com',
    });
    assert.ok(ent.order, JSON.stringify(ent));
    assert.strictEqual(ent.order.buy_mode, 'reserve');
    assert.ok(ent.order.orderId);
  });

  await check('createOrder accepts instant SKU with email', async () => {
    const ctx = {
      resolveCatalogItem: async (id) => ({
        id, title: 'SEO Pack', priceUsd: 79, group: 'instant', tier: 'instant',
      }),
    };
    const out = await commerce.createOrder(ctx, {
      serviceId: 'instant-seo-content-pack', qty: 1, email: 'buyer@example.com',
      inputs: { niche: 'fintech', keywords: 'btc payments' },
    });
    assert.ok(out.order, JSON.stringify(out));
    assert.strictEqual(out.order.buyer.email, 'buyer@example.com');
    assert.strictEqual(out.order.buy_mode, 'btc');
  });

  await check('store SSR: enterprise cards sell the engagement pack', () => {
    const html = shell.getHtml('/store');
    assert.ok(html, 'store page renders');
    assert.ok(/Start autonomous deal|Buy the engagement pack/i.test(html),
      'enterprise CTA should sell the kickoff or the engagement pack');
    assert.ok(/They are not in the download/i.test(html), 'store names the pack, not the source');
    assert.ok(/Real products\. Real BTC settlement/i.test(html), 'honest store hero');
    assert.ok(/not for sale/i.test(html) || /Module mirror/i.test(html), 'library marked not for sale');
    const sovereignEnt = [...html.matchAll(/data-sovereign-buy="(ent-[^"]+)"/gi)].map((m) => m[1]);
    const packs = [
      'ent-platform-license', 'ent-acquisition-pack', 'ent-revenue-share', 'ent-private-cloud',
      'ent-ai-transformation', 'ent-white-label', 'ent-sovereign-deployment',
    ];
    for (const id of packs) assert.ok(sovereignEnt.includes(id), id);
    assert.ok(sovereignEnt.every((id) => packs.includes(id)),
      'store sovereign enterprise rows are the engagement packs, got: ' + sovereignEnt.join(','));
  });

  await check('zacc singleton createDropshipOrder rejects demoOnly', async () => {
    const zacc = require('../backend/modules/zacc/index');
    const prevGet = zacc.publisher && zacc.publisher.get;
    assert.ok(zacc && typeof zacc.createDropshipOrder === 'function');
    zacc.publisher.get = (id) => ({
      id, title: 'Demo Toy', priceUsd: 29, shippingUsd: 3, netProfitUsd: 8,
      weightKg: 0.3, demoOnly: true, dispatchable: false,
    });
    try {
      const out = await zacc.createDropshipOrder({ productId: 'demo-toy', email: 'a@b.com' });
      assert.strictEqual(out.ok, false);
      assert.strictEqual(out.error, 'demo_not_for_sale');
    } finally {
      if (prevGet) zacc.publisher.get = prevGet;
    }
  });

  console.log(`\n✅ commerce-honesty-gate: ${passed} tests passed\n`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('❌ commerce-honesty-gate failed:', err);
  process.exit(1);
});
