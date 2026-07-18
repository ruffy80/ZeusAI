'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const marginOs = require('../backend/modules/zacc/margin-os');
const { AutoPublisher } = require('../backend/modules/zacc/publisher');
const ssr = require('../src/site/dropship-ssr');

function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
  } catch (e) {
    console.error('✗', name);
    throw e;
  }
}

let passed = 0;
function run(name, fn) {
  check(name, fn);
  passed += 1;
}

run('margin-os compares Shopify take-rate honestly', () => {
  const cmp = marginOs.compareToShopify({ priceUsd: 100, netProfitUsd: 40 });
  assert.strictEqual(cmp.ok, true);
  assert.ok(cmp.shopify.transactionFeeUsd > 0);
  assert.ok(cmp.platformTaxAvoidedUsd >= 0);
  assert.ok(cmp.zeusNetMarginUsd === 40);
});

run('margin-os yield snapshot aggregates publisher', () => {
  const publisher = {
    published: [
      { id: 'a', title: 'A', priceUsd: 50, marginPct: 30, netProfitUsd: 10, profitPotential: 9, metrics: { views: 2, sales: 1 } },
      { id: 'b', title: 'B', priceUsd: 80, marginPct: 40, netProfitUsd: 20, profitPotential: 12, metrics: { views: 1, sales: 0 } },
    ],
  };
  const y = marginOs.yieldSnapshot(publisher, { qualified: 5 }, { cached: 20 });
  assert.strictEqual(y.listed, 2);
  assert.strictEqual(y.avgMarginPct, 35);
  assert.ok(y.differentiators.length >= 3);
  assert.strictEqual(y.topYield[0].id, 'b');
});

run('publisher.related ranks same category + profit', () => {
  const pub = new AutoPublisher();
  const mk = (id, category, profitPotential) => ({
    id, title: id, slug: id, category, profitPotential,
    priceUsd: 10, marginPct: 25, netProfitUsd: 3, source: 'seed',
    metrics: { views: 0, carts: 0, sales: 0, revenueUsd: 0, delivered: 0 },
  });
  pub.published = [
    mk('self', 'gadgets', 1),
    mk('same-hi', 'gadgets', 50),
    mk('same-lo', 'gadgets', 5),
    mk('other', 'home', 99),
  ];
  pub.byId = new Map(pub.published.map((p) => [p.id, p]));
  const rel = pub.related('self', 3);
  assert.strictEqual(rel.length, 3);
  assert.strictEqual(rel[0].id, 'same-hi');
  assert.ok(rel.some((p) => p.id === 'other'));
  assert.ok(!rel.some((p) => p.id === 'self'));
});

run('publisher.revision changes with publishes', () => {
  const pub = new AutoPublisher();
  const a = pub.revision();
  pub.publishes = 2;
  pub.lastPublishAt = Date.now();
  pub.published = [{ id: 'x' }];
  assert.notStrictEqual(pub.revision(), a);
});

run('SSR grid emits product cards with fulfill badge', () => {
  const html = ssr.productGridHtml([{
    id: 'dropship-demo-1',
    title: 'Demo Widget',
    priceUsd: 29.99,
    marginPct: 33,
    category: 'gadgets',
    image: '/api/dropship/cover/demo.svg',
    delivery: { mode: 'manual-queue', automated: false },
  }]);
  assert.ok(html.includes('ds-product'));
  assert.ok(html.includes('data-ssr="1"'));
  assert.ok(html.includes('DESK-FULFIL'));
  assert.ok(html.includes('data-buy'));
  assert.ok(html.includes('Proof-of-Margin'));
});

run('SSR PDP includes Proof-of-Margin + JSON-LD', () => {
  const p = {
    id: 'dropship-demo-2',
    title: 'Margin Lamp',
    description: 'Bright autonomous light.',
    priceUsd: 49,
    costUsd: 18,
    shippingUsd: 4,
    netProfitUsd: 20,
    marginPct: 40,
    category: 'home',
    image: 'https://example.com/lamp.jpg',
    delivery: { mode: 'manual-queue', automated: false, etaDays: '7-21' },
  };
  const cmp = marginOs.compareToShopify(p);
  const html = ssr.productPdpHtml(p, cmp, []);
  assert.ok(html.includes('data-ssr-pdp="1"'));
  assert.ok(html.includes('Proof-of-Margin'));
  assert.ok(html.includes('Margin OS'));
  assert.ok(html.includes('id="dp-buy"'));
  const ld = ssr.jsonLdProduct(p);
  assert.ok(ld.includes('application/ld+json'));
  assert.ok(ld.includes('Margin Lamp'));
  assert.ok(ld.includes('"@type":"Product"') || ld.includes('"@type": "Product"'));
});

run('site source wires SSR + single-product API + Margin OS', () => {
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.ok(SRC.includes("require('./site/dropship-ssr')"));
  assert.ok(
    SRC.includes('await fetchBackendJson(base, \'/api/dropship/products?sort=shelf&limit=12\')') ||
    SRC.includes('await fetchBackendJson(base, \'/api/dropship/products?sort=profit&limit=12\')')
  );
  assert.ok(SRC.includes('/api/dropship/product/'));
  assert.ok(SRC.includes('id="ds-upsell"'));
  assert.ok(SRC.includes('addons:addons'));
  assert.ok(!SRC.includes('products?limit=200'));
  assert.ok(SRC.includes('Margin OS'));
});

run('backend exposes margin-os + related + cache headers', () => {
  const BE = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(BE.includes("/api/dropship/margin-os"));
  assert.ok(BE.includes('zacc.publisher.related'));
  assert.ok(BE.includes('stale-while-revalidate=120'));
  assert.ok(BE.includes('addons: b.addons'));
});

console.log('\n✅ dropship-world-standard:', passed, 'tests passed');
process.exit(0);
