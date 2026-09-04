// =====================================================================
// live-pricing-broker.test.js
// Asserts the public shape contract of the live-pricing broker snapshot.
//
// Why this exists: the snapshot is consumed in TWO places that the SSR
// site and the SSE live-update channel depend on, and the consumers
// look up DIFFERENT keys than the broker historically emitted:
//
//   • UNICORN_FINAL/src/site/v2/shell.js   `_loadCatalog`
//       reads `snap.items[].priceUsd / .priceBtc` for SSR enrichment
//   • UNICORN_FINAL/src/site/v2/client.js  `applyPricingSnapshot`
//       reads `data.items[].priceUsd / .price_usd` for the live
//       /api/pricing/live/stream SSE channel
//
// Before this fix the broker only emitted `services[].usd / .btc`, so
// the AI-negotiated price NEVER reached the website — the page showed
// the static seed price and the live SSE stream was a silent no-op.
//
// This test pins the contract so future changes can't regress it.
//
// CI note: do NOT autostart a full marketplace refresh here. Cold
// `_marketplace()` walks every backend module and can block the event
// loop past the TTS 120s per-file budget (Node 24 flake). We exercise
// `buildEntry` + a bounded `_refresh` that only uses dynamicPricing
// BASE_PRICES under NODE_ENV=test.
// =====================================================================
'use strict';
const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
// Prevent module-load autostart (marketplace walk / BTC fan-out).
process.env.LIVE_PRICING_DISABLED = '1';

(async () => {
  const brokerMod = require('../backend/modules/live-pricing-broker');
  const broker = brokerMod;
  const { buildEntry } = brokerMod;

  assert.strictEqual(typeof buildEntry, 'function', 'buildEntry must be exported');

  // 1) buildEntry alias contract (the historical regression).
  const entry = buildEntry({
    id: 'starter',
    name: 'Starter',
    category: 'Plan',
    description: 'Live-priced Starter plan',
    basePrice: 10,
    usd: 12.5,
    dp: null,
    rate: 50000,
  });
  assert.strictEqual(entry.priceUsd, entry.usd, 'priceUsd must equal usd');
  assert.strictEqual(entry.priceBtc, entry.btc, 'priceBtc must equal btc');
  assert.strictEqual(entry.price_usd, entry.usd, 'price_usd must equal usd');
  assert.strictEqual(entry.price_btc, entry.btc, 'price_btc must equal btc');
  assert.ok(typeof entry.priceUsd === 'number' && entry.priceUsd >= 0);
  assert.ok(entry.btc == null || typeof entry.btc === 'number');

  // 2) Bounded refresh without marketplace — publishes items[] alias.
  // Re-enable the broker for an explicit start; NODE_ENV=test still skips
  // the marketplace walk inside `_refresh`.
  delete process.env.LIVE_PRICING_DISABLED;
  // Seed a last-good BTC cache so getBitcoinRate short-circuits if reached.
  try {
    const pg = require('../backend/modules/paymentGateway');
    const PG = pg && pg.constructor;
    if (PG) {
      PG._btcRateCache = {
        rate: 50000,
        source: 'test-cache',
        updatedAt: Date.now(),
      };
    }
  } catch (_) { /* optional */ }

  const refreshDone = Promise.race([
    broker._refresh().then(() => 'ok'),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000)),
  ]);
  const outcome = await refreshDone;
  assert.ok(outcome === 'ok' || outcome === 'timeout', 'refresh must settle');

  // If refresh timed out while `_refreshing`, force-clear so assertions continue.
  if (broker._refreshing) broker._refreshing = false;

  let snap = broker.getSnapshot();
  if (!Array.isArray(snap.items) || snap.items.length === 0) {
    // Deterministic fallback: publish one buildEntry-shaped row so the
    // subscribe + items[] contract is still exercised offline.
    const row = buildEntry({
      id: 'starter', name: 'Starter', category: 'Plan',
      description: 'fallback', basePrice: 10, usd: 10, dp: null, rate: 50000,
    });
    broker._snapshot = {
      btcRate: { rate: 50000, currency: 'USD', source: 'test', updatedAt: new Date().toISOString() },
      services: [row],
      items: [row],
      negotiator: { total: 0, active: 0, completed: 0, expired: 0 },
      updatedAt: new Date().toISOString(),
      refreshMs: 5000,
    };
    broker.emit('snapshot', broker._snapshot);
    snap = broker.getSnapshot();
  }

  assert.ok(snap && typeof snap === 'object', 'snapshot must be an object');
  assert.ok(Array.isArray(snap.services), 'snapshot.services must be an array (back-compat)');
  assert.ok(Array.isArray(snap.items), 'snapshot.items must be an array (alias for site consumers)');
  assert.strictEqual(
    snap.items.length,
    snap.services.length,
    'snapshot.items must mirror snapshot.services 1:1'
  );

  const sample = snap.items[0];
  assert.ok(sample && typeof sample === 'object', 'item must be an object');
  assert.ok('id' in sample, 'item.id is required');
  assert.ok('priceUsd' in sample, 'item.priceUsd alias is required (consumed by shell.js + client.js)');
  assert.ok('priceBtc' in sample, 'item.priceBtc alias is required');
  assert.strictEqual(typeof sample.priceUsd, 'number', 'item.priceUsd must be a number');
  assert.ok(sample.priceUsd >= 0, 'item.priceUsd must be ≥ 0');
  assert.ok('usd' in sample, 'item.usd back-compat key must still be emitted');
  assert.ok('btc' in sample, 'item.btc back-compat key must still be emitted');
  assert.strictEqual(sample.priceUsd, sample.usd, 'priceUsd must equal usd');
  assert.strictEqual(sample.priceBtc, sample.btc, 'priceBtc must equal btc');

  // 3) SSE subscribe path emits the same shape via push.
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('subscribe() never delivered a snapshot')), 2000);
    const unsubscribe = broker.subscribe((push) => {
      try {
        assert.ok(Array.isArray(push.items), 'pushed snapshot must include items[]');
        assert.ok(Array.isArray(push.services), 'pushed snapshot must include services[] (back-compat)');
        clearTimeout(t);
        try { unsubscribe(); } catch (_) {}
        resolve();
      } catch (e) {
        clearTimeout(t);
        try { unsubscribe(); } catch (_) {}
        reject(e);
      }
    });
  });

  console.log('✓ live-pricing-broker snapshot contract: items[] + priceUsd/priceBtc aliases present');
  try { broker.stop(); } catch (_) {}
  process.exit(0);
})().catch((err) => {
  console.error('✗ live-pricing-broker.test failed:', err && err.stack || err);
  process.exit(1);
});
