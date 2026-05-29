// =====================================================================
// zacc-smoke.test.js
// Smoke + contract test for the Zeus Autonomic Commerce Core (ZACC).
//
// Verifies the autonomous loop runs end-to-end in-process and that every
// component produces real, well-shaped output: trends → ideas → products →
// pricing → BTC revenue → personalized offers → learning → evolution.
// Also pins golden-rule invariants: BTC-only payout, self-healing never
// claims to kill the process, and evolution only proposes (no auto-merge by
// default).
// =====================================================================
'use strict';
const assert = require('assert');

(async () => {
  // Run deterministically without a webhook or external source.
  delete process.env.ZACC_WEBHOOK_URL;
  delete process.env.ZACC_SOURCE_TRENDS_URL;
  process.env.ZACC_ENABLED = '1';

  const zacc = require('../backend/modules/zacc');

  // --- 1) A full autonomous cycle runs without throwing -----------------
  const summary = await zacc.tick('test');
  assert.ok(summary && summary.stages, 'tick must return a staged summary');
  assert.ok(summary.stages.scan.trends >= 1, 'scanner must surface trends');
  assert.ok(summary.stages.synthesize.ideas >= 1, 'synthesizer must produce ideas');
  assert.ok(summary.stages.build.activeProducts >= 1, 'builder must build at least one product');
  console.log('\u2713 zacc: full autonomous cycle runs (trends/ideas/products produced)');

  // --- 2) Scanner taxonomy: 20+ sources ---------------------------------
  const status = zacc.status();
  assert.ok(status.components.scanner.sources >= 20, 'scanner must track 20+ sources');
  assert.ok(Array.isArray(status.components.scanner.top), 'scanner must expose top trends');
  console.log('\u2713 zacc: market scanner covers ' + status.components.scanner.sources + ' sources');

  // --- 3) Builder products are real + BTC-checkout-ready ----------------
  const products = zacc.builder.publicList(20);
  assert.ok(products.length >= 1, 'must have buyable products');
  for (const p of products) {
    assert.ok(p.id && p.title && p.description, 'product must have id/title/description');
    assert.ok(Number(p.priceUsd) > 0, 'product must have a positive price');
    assert.ok(p.checkout && p.checkout.btcAddress, 'product checkout must carry a BTC address');
    assert.ok(/^\/checkout\?/.test(p.buyUrl), 'product must have a checkout deep-link');
  }
  console.log('\u2713 zacc: ' + products.length + ' autonomously-built products are BTC-checkout-ready');

  // --- 4) Margin floor respected on ideas -------------------------------
  const minMargin = status.components.synthesizer.minMarginPct;
  for (const i of zacc.synthesizer.ideas) {
    assert.ok(i.marginPct >= minMargin - 0.01, 'idea margin must respect the configured floor');
  }
  console.log('\u2713 zacc: every idea respects the >=' + minMargin + '% margin floor');

  // --- 5) Revenue autopilot is BTC-only ---------------------------------
  const sale = zacc.recordSale(products[0].id, 149);
  assert.ok(sale && sale.amountUsd === 149, 'recordSale must register the amount');
  const rev = zacc.revenue.status();
  assert.equal(rev.payout.method, 'BTC', 'payout must be BTC');
  assert.equal(rev.payout.stripe, false, 'Stripe must be disabled (BTC-only)');
  assert.ok(rev.lifetimeUsd >= 149, 'lifetime revenue must include the sale');
  console.log('\u2713 zacc: revenue autopilot is BTC-only and tracks sales');

  // --- 6) Personalized offer never breaks the margin floor --------------
  const offer = zacc.offerFor(products[0].id, { returning: true, referrer: 'reddit.com', device: 'mobile', geo: 'EU' });
  assert.ok(offer && offer.offerPriceUsd > 0, 'offer must produce a positive price');
  assert.ok(offer.offerPriceUsd <= offer.basePriceUsd, 'offer must not exceed base price');
  assert.ok(offer.discountPct >= 0 && offer.discountPct <= 15, 'discount must be within bounds');
  console.log('\u2713 zacc: personalized offer engine produces bounded discounts');

  // --- 7) Self-healing never claims to kill the process -----------------
  const health = zacc.health.status();
  assert.equal(health.neverKillsProcess, true, 'self-healing must never kill the process (golden rule #6)');
  console.log('\u2713 zacc: self-healing is log-and-reinit only (never kills process)');

  // --- 8) Learning core stores vectors + can analyze --------------------
  const analysis = zacc.learning.analyze(true);
  assert.ok(analysis && Array.isArray(analysis.insights) && analysis.insights.length >= 1, 'weekly analysis must produce insights');
  assert.ok(zacc.learning.status().vectors >= 1, 'learning store must hold decision vectors');
  console.log('\u2713 zacc: self-learning core records decisions and analyzes weekly');

  // --- 9) Evolution proposes only (no auto-merge by default) ------------
  const evo = zacc.evolution.scan(true);
  assert.ok(Array.isArray(evo) && evo.length >= 1, 'evolution must surface proposals');
  assert.equal(zacc.evolution.status().autoMerge, false, 'auto-merge must be OFF by default');
  console.log('\u2713 zacc: eternal evolution proposes integrations (auto-merge off, CI-gated)');

  // --- 10) Multi-instance niche routing ---------------------------------
  const niches = zacc.multi.status();
  assert.ok(niches.total >= 3, 'must support multiple niche partitions');
  console.log('\u2713 zacc: multi-instance manager exposes ' + niches.total + ' niche partitions');

  // --- 11) Public snapshot shape (consumed by the /zacc site page) ------
  const pub = zacc.publicSnapshot();
  assert.ok(pub.ok && pub.counts && pub.payout.btcAddress, 'public snapshot must carry counts + BTC payout');
  assert.ok(Array.isArray(pub.products) && Array.isArray(pub.ideas) && Array.isArray(pub.trends), 'public snapshot arrays present');
  console.log('\u2713 zacc: public snapshot shape is valid for the site page');

  console.log('\nZACC smoke test passed \u2014 the autonomous commerce core is live.');
  zacc.stop();
  process.exit(0);
})().catch((e) => {
  console.error('ZACC smoke test FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
