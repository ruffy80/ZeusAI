'use strict';

const assert = require('assert');
const { renderCoverSvg, coverPath } = require('../backend/modules/zacc/product-cover');
const worldFeeds = require('../backend/modules/zacc/world-feeds');
const { CURATED_PRODUCTS } = require('../backend/modules/zacc/catalog-curated');

function run() {
  const svg = renderCoverSvg({ title: 'Test Projector', category: 'electronics', slug: 'test-projector' });
  assert.ok(svg.includes('<svg'), 'cover is svg');
  assert.ok(svg.includes('Test Projector'), 'cover includes title');
  assert.ok(coverPath('Hello World').startsWith('/api/dropship/cover/'), 'cover path');

  assert.ok(CURATED_PRODUCTS.length >= 20, 'curated size');
  for (const p of CURATED_PRODUCTS.slice(0, 3)) {
    assert.ok(String(p.image).startsWith('/api/dropship/cover/'), 'curated uses self-hosted cover: ' + p.image);
  }

  return worldFeeds.pullWorldFeeds().then((items) => {
    assert.ok(Array.isArray(items), 'world feeds array');
    // Network may be blocked in some CI — allow empty but prefer >= 1
    if (items.length) {
      assert.ok(items.every((p) => p.image && /^https?:\/\//i.test(p.image)), 'world items have https images');
      assert.ok(items.every((p) => p.costUsd > 0), 'world items have cost');
      assert.ok(items.every((p) => Number(p.rating) >= 4), 'world items meet rating floor');
      assert.ok(items.every((p) => Number(p.reviews) >= 100), 'world items clear review gate');
      const sources = new Set(items.map((p) => p.source));
      assert.ok(sources.size >= 1, 'at least one world source');
      console.log('  ✓ world feeds returned', items.length, 'products with images from', [...sources].join(', '));
    } else {
      console.log('  ✓ world feeds returned 0 (network unavailable — fail-soft ok)');
    }
    console.log('  ✓ product covers + curated image paths');
    console.log('\n✅ zacc-world-feeds: tests passed');
  });
}

run().catch((e) => { console.error(e); process.exit(1); });
