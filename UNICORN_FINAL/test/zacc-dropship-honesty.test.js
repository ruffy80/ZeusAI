// =====================================================================
// zacc-dropship-honesty.test.js
// P0 doctrine: the public dropship storefront MUST NOT sell demo / world-feed
// SKUs as "ships automatically". Only items with a real CJ variant id may
// carry the AUTO-SHIP badge; everything else must clearly identify as
// DESK-FULFIL. This test locks the honesty invariants for:
//   • AutoPublisher._materialize (item shape)
//   • public-catalog-filter (physical items without a recipe are hidden)
//   • CJ API client (real HTTPS surface, fails honestly when unconfigured)
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.ZACC_CJ_API_KEY;

const assert = require('assert');
const { AutoPublisher } = require('../backend/modules/zacc/publisher');
const filter = require('../src/commerce/public-catalog-filter');
const cjApi = require('../backend/modules/zacc/cj-api');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('publisher marks world-feed SKU as DESK-FULFIL (never AUTO-SHIP)', () => {
  const pub = new AutoPublisher({});
  const added = pub.publish([{
    name: 'Wireless Charging Stand Pro Kit',
    category: 'electronics',
    costUsd: 8,
    shippingUsd: 3,
    retailUsd: 29,
    netProfitUsd: 12,
    marginPct: 41,
    profitPotential: 11,
    rating: 4.6,
    reviews: 500,
    image: 'https://cdn.dummyjson.com/x.webp',
    source: 'dummyjson-world',
    supplier: 'world-feed',
    supplierRef: 'dummyjson:123',
  }], 1);
  assert.equal(added.length, 1);
  const item = added[0];
  assert.equal(item.fulfillmentMode, 'desk', 'world-feed item must be desk-fulfilled');
  assert.equal(item.dispatchable, false, 'world-feed item is NOT dispatchable');
  assert.equal(item.delivery.mode, 'zeus-fulfillment-desk');
  assert.equal(item.delivery.automated, false, 'must NOT claim automated');
  assert.equal(item.fulfillmentRecipe.kind, 'zeus-fulfillment-desk');
  assert.equal(item.fulfillmentRecipe.badge, 'DESK-FULFIL');
  assert.equal(item.fulfillmentRecipe.automated, false);
});

check('publisher marks curated (manual) SKU as DESK-FULFIL', () => {
  const pub = new AutoPublisher({});
  const added = pub.publish([{
    name: 'Bluetooth ANC Earbuds Travel Case',
    category: 'electronics',
    costUsd: 10,
    shippingUsd: 3,
    retailUsd: 39,
    netProfitUsd: 15,
    marginPct: 38,
    profitPotential: 12,
    rating: 4.5,
    reviews: 300,
    image: '/api/dropship/cover/buds.svg',
    source: 'zeus-curated',
    supplier: 'manual',
    supplierRef: null,
    demoOnly: true,
  }], 1);
  assert.equal(added.length, 1);
  const item = added[0];
  assert.equal(item.fulfillmentMode, 'desk');
  assert.equal(item.dispatchable, false);
  assert.equal(item.delivery.automated, false);
  assert.equal(item.fulfillmentRecipe.badge, 'DESK-FULFIL');
});

check('publisher marks CJ SKU as AUTO-SHIP only when CJ key armed + real vid', () => {
  process.env.ZACC_CJ_API_KEY = 'zacc_cj_test_key_thisislongenough12345';
  try {
    const pub = new AutoPublisher({});
    const added = pub.publish([{
      name: 'Anti-Fog Bike Sunglasses UV400 Pro',
      category: 'sports',
      costUsd: 7,
      shippingUsd: 3,
      retailUsd: 24,
      netProfitUsd: 10,
      marginPct: 42,
      profitPotential: 12,
      rating: 4.7,
      reviews: 800,
      image: 'https://cdn.cjdropshipping.com/pro-real.webp',
      source: 'cj-dropship',
      supplier: 'cj-dropshipping',
      supplierRef: '9930-DL-CJ',
      demoOnly: false,
    }], 1);
    assert.equal(added.length, 1);
    const item = added[0];
    assert.equal(item.fulfillmentMode, 'cj-auto');
    assert.equal(item.dispatchable, true);
    assert.equal(item.delivery.mode, 'cj-global-dropship');
    assert.equal(item.delivery.automated, true);
    assert.equal(item.fulfillmentRecipe.badge, 'AUTO-SHIP');
    assert.equal(item.fulfillmentRecipe.automated, true);
    assert.equal(item.fulfillmentRecipe.supplierRef, '9930-DL-CJ');
  } finally {
    delete process.env.ZACC_CJ_API_KEY;
  }
});

check('publisher does not mark world-feed items dispatchable even with CJ key', () => {
  process.env.ZACC_CJ_API_KEY = 'zacc_cj_test_key_thisislongenough12345';
  try {
    const pub = new AutoPublisher({});
    const added = pub.publish([{
      name: 'Universal Laptop USB-C Hub 7-in-1',
      category: 'electronics',
      costUsd: 12,
      shippingUsd: 4,
      retailUsd: 39,
      netProfitUsd: 15,
      marginPct: 38,
      profitPotential: 13,
      rating: 4.5,
      reviews: 600,
      image: 'https://cdn.dummyjson.com/hub.webp',
      source: 'dummyjson-world',
      supplier: 'world-feed',
      supplierRef: 'dummyjson:9931',
      demoOnly: false,
    }], 1);
    assert.equal(added.length, 1);
    assert.equal(added[0].fulfillmentMode, 'desk', 'world-feed prefix ref is NOT dispatchable');
    assert.equal(added[0].dispatchable, false);
  } finally {
    delete process.env.ZACC_CJ_API_KEY;
  }
});

check('public-catalog-filter treats physical items without recipe as synthetic', () => {
  const noRecipe = { id: 'random-toy', type: 'physical', group: 'strategic' };
  assert.equal(filter.isSyntheticCatalogItem(noRecipe), true);
  const withRecipe = {
    id: 'real-toy',
    type: 'physical',
    group: 'strategic',
    fulfillmentRecipe: { kind: 'cj-dropship', supplierRef: '1234-abc' },
  };
  assert.equal(filter.isSyntheticCatalogItem(withRecipe), false);
});

check('public-catalog-filter honours canonical core plans and curated groups', () => {
  assert.equal(filter.hasFulfillmentRecipe({ id: 'pro', group: 'service' }), true);
  assert.equal(filter.hasFulfillmentRecipe({ id: 'adaptive-ai', group: 'professional' }), true);
  assert.equal(filter.hasFulfillmentRecipe({ id: 'fintech-os', group: 'vertical' }), true);
  assert.equal(filter.hasFulfillmentRecipe({ id: 'someone-invented', group: 'random' }), false);
});

check('cj-api reports unconfigured honestly (no invented responses)', async () => {
  assert.equal(cjApi.isConfigured(), false, 'unconfigured until a real key is set');
  const searchOut = await cjApi.searchProducts({ keywords: 'anything' });
  assert.deepEqual(searchOut, [], 'searchProducts returns [] when unconfigured');
  const track = await cjApi.queryTracking('CJTRK123');
  assert.equal(track.ok, false);
  assert.ok(['cj_not_configured', 'fetch_unavailable'].includes(track.reason), 'honest failure reason');
  const detail = await cjApi.queryOrderDetail('CJORD123');
  assert.equal(detail.ok, false);
  assert.ok(['cj_not_configured', 'fetch_unavailable'].includes(detail.reason));
});

check('cj-api rejects obvious placeholder keys as unconfigured', () => {
  process.env.ZACC_CJ_API_KEY = 'your_cj_key_placeholder_here_12345';
  try {
    assert.equal(cjApi.isConfigured(), false, 'placeholder must be rejected');
  } finally {
    delete process.env.ZACC_CJ_API_KEY;
  }
});

console.log('\n\u2705 zacc-dropship-honesty: ' + passed + ' tests passed');
process.exit(0);
