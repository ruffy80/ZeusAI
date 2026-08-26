// =====================================================================
// uscf-supplier-framework.test.js
// Locks Universal Supplier Connector Framework (USCF/1.0) invariants:
//   • capability pipeline declared for every connector
//   • no AUTO-SHIP without armed credentials + valid supplierRef
//   • owner-auth gate surfaces when keys missing
//   • armEnvMap scaffolds secrets without inventing keys
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.ZACC_CJ_API_KEY;
delete process.env.CJ_API_KEY;
delete process.env.PRINTFUL_API_TOKEN;
delete process.env.PRINTFUL_API_KEY;
delete process.env.PRINTIFY_API_TOKEN;
delete process.env.PRINTIFY_API_KEY;
delete process.env.PRINTIFY_SHOP_ID;
delete process.env.ZACC_FULFILL_WEBHOOK_URL;

const assert = require('assert');
const uscf = require('../backend/modules/zacc/suppliers');
const { AutoPublisher } = require('../backend/modules/zacc/publisher');
const { FulfillmentRouter } = require('../backend/modules/zacc/fulfillment');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('USCF discovery exposes protocol + full pipeline stages', () => {
  const d = uscf.discovery();
  assert.equal(d.protocol, 'USCF/1.0');
  assert.equal(d.ok, true);
  assert.deepEqual(d.pipelineStages, [
    'products', 'inventory', 'pricing', 'orders', 'fulfillment', 'tracking', 'returns',
  ]);
  assert.ok(Array.isArray(d.suppliers) && d.suppliers.length >= 4);
  assert.equal(d.autoShipReady, false);
  assert.ok(d.awaitingOwnerAuth.length >= 3);
});

check('CJ / Printful / Printify report awaiting_owner_auth without keys', () => {
  const d = uscf.discovery();
  const byId = Object.fromEntries(d.suppliers.map((s) => [s.id, s]));
  assert.equal(byId['cj-dropshipping'].status, 'awaiting_owner_auth');
  assert.equal(byId.printful.status, 'awaiting_owner_auth');
  assert.equal(byId.printify.status, 'awaiting_owner_auth');
  assert.ok(byId['cj-dropshipping'].ownerAuth);
  assert.ok(byId['cj-dropshipping'].ownerAuth.envVars.includes('ZACC_CJ_API_KEY'));
  assert.ok(byId.printful.docsUrl.includes('printful.com'));
  assert.ok(byId.printify.docsUrl.includes('printify.com'));
});

check('evaluateSku never marks world-feed as dispatchable', () => {
  const e = uscf.evaluateSku({
    supplier: 'world-feed',
    supplierRef: 'dummyjson:123',
    source: 'dummyjson-world',
  });
  assert.equal(e.dispatchable, false);
  assert.equal(e.badge, 'DESK-FULFIL');
});

check('evaluateSku marks CJ SKU AUTO-SHIP only when CJ key armed', () => {
  const sku = {
    supplier: 'cj-dropshipping',
    supplierRef: 'CJVID123456789',
    source: 'cj-dropship',
  };
  assert.equal(uscf.evaluateSku(sku).dispatchable, false);
  process.env.ZACC_CJ_API_KEY = 'zacc_cj_test_key_thisislongenough12345';
  try {
    const e = uscf.evaluateSku(sku);
    assert.equal(e.dispatchable, true);
    assert.equal(e.provider, 'cj-dropshipping');
    assert.equal(e.badge, 'AUTO-SHIP');
  } finally {
    delete process.env.ZACC_CJ_API_KEY;
  }
});

check('evaluateSku marks Printful SKU when Printful token armed', () => {
  const sku = {
    supplier: 'printful',
    supplierRef: 'printful:998877',
    source: 'printful',
  };
  assert.equal(uscf.evaluateSku(sku).dispatchable, false);
  process.env.PRINTFUL_API_TOKEN = 'printful_test_token_longenough_123456';
  try {
    const e = uscf.evaluateSku(sku);
    assert.equal(e.dispatchable, true);
    assert.equal(e.provider, 'printful');
    assert.equal(e.deliveryMode, 'printful-pod');
  } finally {
    delete process.env.PRINTFUL_API_TOKEN;
  }
});

check('publisher honesty uses USCF for Printify dispatchable', () => {
  process.env.PRINTIFY_API_TOKEN = 'printify_test_token_longenough_123456';
  process.env.PRINTIFY_SHOP_ID = '1234567';
  try {
    const pub = new AutoPublisher({});
    const added = pub.publish([{
      name: 'Zeus Emblem Unisex Tee Classic Fit',
      category: 'apparel',
      costUsd: 12,
      shippingUsd: 4,
      retailUsd: 34,
      netProfitUsd: 14,
      marginPct: 41,
      profitPotential: 13,
      rating: 4.8,
      reviews: 120,
      image: 'https://images-api.printify.com/mock.png',
      source: 'printify',
      supplier: 'printify',
      supplierRef: 'printify:55:99',
    }], 1);
    assert.equal(added.length, 1);
    assert.equal(added[0].dispatchable, true);
    assert.equal(added[0].fulfillmentRecipe.badge, 'AUTO-SHIP');
    assert.equal(added[0].delivery.automated, true);
  } finally {
    delete process.env.PRINTIFY_API_TOKEN;
    delete process.env.PRINTIFY_SHOP_ID;
  }
});

check('armEnvMap scaffolds Printful/Printify/CJ env pairs', () => {
  const cj = uscf.armEnvMap('cj', { apiKey: 'real_cj_key_abcdefghijklmnop' });
  assert.equal(cj.env.ZACC_CJ_API_KEY, 'real_cj_key_abcdefghijklmnop');
  const pf = uscf.armEnvMap('printful', { apiKey: 'pf_token_abcdefghijklmnop', shopId: '42' });
  assert.equal(pf.env.PRINTFUL_API_TOKEN, 'pf_token_abcdefghijklmnop');
  assert.equal(pf.env.PRINTFUL_STORE_ID, '42');
  const py = uscf.armEnvMap('printify', { apiKey: 'py_token_abcdefghijklmnop', shopId: '99' });
  assert.equal(py.env.PRINTIFY_API_TOKEN, 'py_token_abcdefghijklmnop');
  assert.equal(py.env.PRINTIFY_SHOP_ID, '99');
});

check('fulfillment readiness embeds USCF discovery', () => {
  const fr = new FulfillmentRouter({});
  const r = fr.readiness();
  assert.equal(r.protocol, 'USCF/1.0');
  assert.equal(r.autoShipReady, false);
  assert.ok(r.uscf && r.uscf.pipeline);
  assert.equal(r.mode, 'zeus-fulfillment-desk');
});

check('list sort autoship prefers dispatchable SKUs', () => {
  process.env.ZACC_CJ_API_KEY = 'zacc_cj_test_key_thisislongenough12345';
  try {
    const pub = new AutoPublisher({});
    pub.publish([{
      name: 'World Feed Ceramic Mug Demo Only',
      category: 'home',
      costUsd: 5, shippingUsd: 3, retailUsd: 19, netProfitUsd: 8, marginPct: 40,
      profitPotential: 99, rating: 4.5, reviews: 10,
      image: 'https://cdn.dummyjson.com/mug.webp',
      source: 'dummyjson-world', supplier: 'world-feed', supplierRef: 'dummyjson:1',
    }], 1);
    pub.publish([{
      name: 'CJ Real Dispatchable Phone Grip',
      category: 'electronics',
      costUsd: 4, shippingUsd: 2, retailUsd: 18, netProfitUsd: 9, marginPct: 50,
      profitPotential: 10, rating: 4.7, reviews: 40,
      image: 'https://cdn.cjdropshipping.com/grip.webp',
      source: 'cj-dropship', supplier: 'cj-dropshipping', supplierRef: 'VID999888777',
    }], 1);
    const items = pub.list({ sort: 'autoship', limit: 10 });
    assert.ok(items.length >= 2);
    assert.equal(items[0].dispatchable, true);
  } finally {
    delete process.env.ZACC_CJ_API_KEY;
  }
});

console.log('\u2705 uscf-supplier-framework: ' + passed + ' tests passed');
process.exit(0);
