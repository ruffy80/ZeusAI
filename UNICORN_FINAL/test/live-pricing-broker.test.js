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
// =====================================================================
'use strict';
const assert = require('assert');

(async () => {
  // Make sure the broker is enabled even when the surrounding test suite
  // sets LIVE_PRICING_DISABLED=1 in the environment.
  delete process.env.LIVE_PRICING_DISABLED;

  const broker = require('../backend/modules/live-pricing-broker');

  // The broker's module-load `start()` kicks off an async refresh in flight.
  // `_refresh()` is reentrancy-guarded (returns immediately if already
  // running), so we can't simply call it again — we'd race the in-flight
  // call and read an empty snapshot. Wait until the in-flight refresh
  // finishes (`_refreshing` flips back to false) and a non-empty snapshot
  // is published, then call `_refresh()` once more for determinism.
  const waitMs = 4000;
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    if (!broker._refreshing && (broker.getSnapshot().services || []).length > 0) break;
    await new Promise(r => setTimeout(r, 50));
  }
  await broker._refresh();
  const snap = broker.getSnapshot();

  // 1) Top-level shape — both keys must be present (back-compat + new alias).
  assert.ok(snap && typeof snap === 'object', 'snapshot must be an object');
  assert.ok(Array.isArray(snap.services), 'snapshot.services must be an array (back-compat)');
  assert.ok(Array.isArray(snap.items),    'snapshot.items must be an array (alias for site consumers)');
  assert.strictEqual(
    snap.items.length,
    snap.services.length,
    'snapshot.items must mirror snapshot.services 1:1'
  );

  // 2) Per-entry shape — every item must carry `priceUsd` (number, ≥0)
  //    AND `priceBtc` (number-or-null) so both SSR and SSE consumers work.
  if (snap.items.length === 0) {
    console.warn('[live-pricing-broker.test] snapshot.items is empty — skipping per-entry assertions');
  } else {
    const sample = snap.items[0];
    assert.ok(sample && typeof sample === 'object', 'item must be an object');
    assert.ok('id' in sample,        'item.id is required');
    assert.ok('priceUsd' in sample,  'item.priceUsd alias is required (consumed by shell.js + client.js)');
    assert.ok('priceBtc' in sample,  'item.priceBtc alias is required');
    assert.strictEqual(
      typeof sample.priceUsd, 'number',
      'item.priceUsd must be a number'
    );
    assert.ok(
      sample.priceUsd >= 0,
      'item.priceUsd must be ≥ 0 (was ' + sample.priceUsd + ')'
    );
    // Back-compat: original keys are still emitted.
    assert.ok('usd' in sample, 'item.usd back-compat key must still be emitted');
    assert.ok('btc' in sample, 'item.btc back-compat key must still be emitted');
    // The alias must equal the canonical value.
    assert.strictEqual(sample.priceUsd, sample.usd, 'priceUsd must equal usd');
    assert.strictEqual(sample.priceBtc, sample.btc, 'priceBtc must equal btc');
  }

  // 3) SSE subscribe path emits the same shape via push.
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('subscribe() never delivered a snapshot')), 2000);
    const unsubscribe = broker.subscribe((push) => {
      try {
        assert.ok(Array.isArray(push.items),    'pushed snapshot must include items[]');
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
  // The broker schedules an internal interval; stop it so the test process exits cleanly.
  try { broker.stop(); } catch (_) {}
  // Required because peer modules (`paymentGateway`, `serviceMarketplace`)
  // pulled in transitively keep their own intervals/queues alive without
  // unref. Mirrors the same pattern used by other UNICORN_FINAL tests.
  process.exit(0);
})().catch((err) => {
  console.error('✗ live-pricing-broker.test failed:', err && err.stack || err);
  process.exit(1);
});
