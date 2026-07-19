'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZACC_ENABLE_ESCUELA = '0';

const assert = require('assert');
const { isQualityTitle, isQualityImage } = require('../backend/modules/zacc/world-feeds');
const { AutoPublisher } = require('../backend/modules/zacc/publisher');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('✓', name);
  passed += 1;
}

check('rejects hex / numeric / lone-name titles', () => {
  assert.equal(isQualityTitle('4929b143'), false);
  assert.equal(isQualityTitle('91167538'), false);
  assert.equal(isQualityTitle('12345'), false);
  assert.equal(isQualityTitle('Rajesh'), false);
  assert.equal(isQualityTitle('test'), false);
  assert.equal(isQualityTitle('hoodie'), false); // single short word
});

check('accepts real product titles', () => {
  assert.equal(isQualityTitle('Wireless Charging Stand 15W Dual Coil'), true);
  assert.equal(isQualityTitle('Oppo K1'), true);
  assert.equal(isQualityTitle('Samsung Galaxy S8'), true);
  assert.equal(isQualityTitle('Annibale Colombo Bed'), true);
  assert.equal(isQualityTitle('black hoodie'), true);
});

check('rejects placeholder images; allows CDN + self-cover', () => {
  assert.equal(isQualityImage('https://placeimg.com/640/480/any'), false);
  assert.equal(isQualityImage('https://placehold.co/600x400'), false);
  assert.equal(isQualityImage('/api/dropship/cover/wireless-stand.svg'), true);
  assert.equal(isQualityImage('https://cdn.dummyjson.com/product-images/phones/1.webp'), true);
});

check('publish refuses junk titles', () => {
  const pub = new AutoPublisher({});
  const added = pub.publish([
    { name: '4929b143', category: 'general', costUsd: 5, shippingUsd: 2, retailUsd: 20, netProfitUsd: 8, marginPct: 40, profitPotential: 9, rating: 4.5, reviews: 200, image: 'https://cdn.dummyjson.com/x.webp', source: 'escuela-world' },
    { name: 'Wireless Charging Stand Pro Kit', category: 'electronics', costUsd: 8, shippingUsd: 3, retailUsd: 29, netProfitUsd: 12, marginPct: 41, profitPotential: 11, rating: 4.6, reviews: 500, image: '/api/dropship/cover/wireless.svg', source: 'zeus-curated', demoOnly: true },
  ], 10);
  assert.equal(added.length, 1);
  assert.equal(added[0].title, 'Wireless Charging Stand Pro Kit');
});

check('purgeJunk removes hex titles already listed', () => {
  const pub = new AutoPublisher({});
  pub.publish([{
    name: 'Bluetooth ANC Earbuds Travel Case',
    category: 'electronics', costUsd: 10, shippingUsd: 3, retailUsd: 39, netProfitUsd: 15, marginPct: 38, profitPotential: 12, rating: 4.5, reviews: 300,
    image: '/api/dropship/cover/buds.svg', source: 'zeus-curated', demoOnly: true,
  }], 5);
  // Inject junk as if persisted from an older feed.
  pub.published.unshift({
    id: 'dropship-junk-1', title: 'a64d3643', slug: 'a64d3643', category: 'general',
    image: 'https://placeimg.com/640/480/any', source: 'escuela-world', priceUsd: 100,
  });
  pub.byId.set('dropship-junk-1', pub.published[0]);
  const r = pub.purgeJunk();
  assert.ok(r.removed >= 1);
  assert.ok(pub.published.every((p) => isQualityTitle(p.title)));
  const r2 = pub.purgeJunk();
  assert.equal(r2.removed, 0);
});

console.log(`\n✅ dropship-catalog-quality: ${passed} tests passed\n`);

// publish() lazily registers a dynamic-pricing setInterval that keeps the
// event loop alive; exit explicitly so `npm test`'s && chain proceeds.
process.exit(0);
