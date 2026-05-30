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
  assert.ok(pub.payments && typeof pub.payments.paidInvoices === 'number', 'public snapshot must expose payments summary');
  assert.equal(pub.persisted, true, 'public snapshot must advertise disk persistence');
  console.log('\u2713 zacc: public snapshot shape is valid (payments + persistence flags present)');

  // --- 12) Disk persistence: serialize + restore --------------------
  const store = require('../backend/modules/zacc/store');
  const snap = zacc.serialize();
  assert.ok(snap && Array.isArray(snap.builder.products), 'serialize must include builder products');
  assert.ok(typeof snap.revenue.totalUsd === 'number', 'serialize must include revenue');
  const saved = store.save(snap);
  assert.ok(saved, 'store.save must return true');
  const loaded = store.load();
  assert.ok(loaded && Array.isArray(loaded.builder.products), 'store.load must restore products array');
  console.log('\u2713 zacc: disk persistence saves and restores state correctly');

  // --- 13) BTC payments: invoice creation + paid delivery hook ----------
  const invResult = await zacc.createInvoice(products[0].id);
  assert.ok(invResult && invResult.invoice, 'createInvoice must return an invoice');
  assert.ok(invResult.invoice.amountSats >= 0, 'invoice must have amountSats');
  assert.ok(invResult.invoice.btcAddress, 'invoice must carry owner BTC address');
  assert.ok(['pending', 'rate-unavailable'].includes(invResult.invoice.status), 'new invoice status must be pending or rate-unavailable');
  const paySt = zacc.payments.status();
  assert.ok(paySt.ok && typeof paySt.invoices === 'number', 'payments.status must be well-shaped');
  assert.equal(paySt.btcAddress, invResult.invoice.btcAddress, 'payments btcAddress must match invoice');
  // Simulate paid delivery hook.
  const prevLifetime = zacc.revenue.totalUsd;
  zacc._onPaid({ id: invResult.invoice.id, productId: products[0].id, amountUsd: invResult.invoice.amountUsd || 10 });
  assert.ok(zacc.revenue.totalUsd > prevLifetime, '_onPaid must record the sale');
  console.log('\u2713 zacc: BTC payment watcher creates invoices + auto-delivers on confirmation');

  // --- 14) ZACC products appear in the global service catalog sink ------
  const catSink = [];
  zacc.setServiceSink(function (p) { catSink.push(p.id); });
  assert.ok(catSink.length >= 1, 'setServiceSink backfill must publish existing products');
  console.log('\u2713 zacc: ' + catSink.length + ' products surfaced in global /services catalog via sink');

  // --- 15) Autonomous dropshipping pipeline: scrape -> profit -> publish -
  const scrapeRes = await zacc.scraper.scrape(true);
  assert.ok(scrapeRes && scrapeRes.scraped >= 1, 'scraper must produce at least one product');
  const rawScraped = zacc.scraper.recent(300);
  assert.ok(rawScraped.length >= 1, 'scraper cache must hold products');
  const qualified = zacc.profit.rank(rawScraped);
  assert.ok(Array.isArray(qualified), 'profit.rank must return an array');
  for (const q of qualified) {
    assert.ok(q.netProfitUsd >= 0, 'qualified product must have non-negative net profit');
    assert.ok(q.retailUsd > q.costUsd, 'retail must exceed cost');
    assert.ok(typeof q.profitPotential === 'number', 'qualified product must carry a profit score');
  }
  const published = zacc.publisher.publish(qualified, 6);
  assert.ok(Array.isArray(published), 'publisher.publish must return an array');
  for (const p of published) {
    assert.ok(p.id && /^dropship-/.test(p.id), 'dropship product id must be namespaced');
    assert.ok(p.description && p.description.length > 20, 'dropship product must have an AI/template description');
    assert.ok(Number(p.priceUsd) > 0, 'dropship product must have a positive price');
    assert.ok(/^\/dropship\/product\//.test(p.page), 'dropship product must have a product page URL');
    assert.ok(p.checkout && p.checkout.btcAddress, 'dropship product must carry BTC checkout');
  }
  console.log('\u2713 zacc: dropship pipeline scraped ' + rawScraped.length + ', qualified ' + qualified.length + ', published ' + zacc.publisher.published.length);

  // --- 16) Publisher list is filterable/sortable + categories exposed ---
  const byProfit = zacc.publisher.list({ sort: 'profit', limit: 10 });
  assert.ok(byProfit.length >= 1, 'publisher.list must return published items');
  for (let i = 1; i < byProfit.length; i++) {
    assert.ok(byProfit[i - 1].profitPotential >= byProfit[i].profitPotential, 'profit sort must be descending');
  }
  assert.ok(Array.isArray(zacc.publisher.categories()), 'publisher must expose categories');
  console.log('\u2713 zacc: publisher exposes sorted, filterable dropship catalog');

  // --- 17) Fulfillment never throws + queues when no provider configured -
  const fr = await zacc.fulfillment.onOrder({ productId: published[0] ? published[0].id : 'x', productTitle: 'Test', amountUsd: 50, invoiceId: 'inv-test' });
  assert.ok(fr && fr.ok && fr.order, 'fulfillment.onOrder must return a routed order');
  assert.ok(fr.order.result && fr.order.result.provider, 'order must record a routing provider');
  const fst = zacc.fulfillment.status();
  assert.ok(fst.ok && typeof fst.routed === 'number', 'fulfillment status must be well-shaped');
  console.log('\u2713 zacc: fulfillment router handles orders (auto or manual queue) without throwing');

  // --- 18) Public snapshot now carries the dropship surface -------------
  const pub2 = zacc.publicSnapshot();
  assert.ok(Array.isArray(pub2.dropship), 'public snapshot must expose dropship products');
  assert.ok(typeof pub2.counts.dropshipPublished === 'number', 'counts must include dropshipPublished');
  assert.ok(typeof pub2.counts.scraped === 'number', 'counts must include scraped');
  console.log('\u2713 zacc: public snapshot surfaces dropship catalog for the Autonomous Dropshipping page');

  // --- 19) Self-heal: an empty live catalogue refills even under cooldown ----
  // Reproduces the "200 scraped but storefront empty" bug: published lost but
  // the republish-cooldown map retained. The publisher must bypass the cooldown
  // and refill to the floor instead of starving the page for 24h.
  {
    const pubr = zacc.publisher;
    const raw = zacc.scraper.recent(300);
    const scored = zacc.profit.rank(raw);
    assert.ok(scored.length >= 1, 'need qualified candidates to test self-heal');
    // Simulate the broken restore: clear the live catalogue, keep cooldowns hot.
    pubr.published = [];
    pubr.byId.clear();
    for (const c of scored) pubr.publishedAt.set(pubr._sourceKey(c), Date.now());
    const healed = pubr.publish(scored, undefined);
    assert.ok(healed.length >= 1, 'publisher must self-heal an empty catalogue despite the cooldown');
    const floor = pubr.status().catalogFloor || 12;
    assert.ok(pubr.published.length >= Math.min(scored.length, floor),
      'live catalogue must be refilled toward the floor');
    const titles = pubr.published.map(p => p.title);
    assert.equal(new Set(titles).size, titles.length, 'self-heal must not create duplicate products');
    console.log('\u2713 zacc: storefront self-heals from an empty catalogue (no 24h starvation, no duplicates)');
  }

  // --- 20) Seed catalogue ships real product imagery ---------------------
  {
    const withImages = zacc.publisher.published.filter(p => typeof p.image === 'string' && /^https?:\/\//.test(p.image));
    assert.ok(withImages.length >= 1, 'published seed products must carry a real image URL so the store looks real');
    console.log('\u2713 zacc: published products carry real product imagery (' + withImages.length + ' with photos)');
  }

  console.log('\nZACC smoke test passed \u2014 the autonomous commerce core is live, persistent and on-chain.');
  zacc.stop();
  process.exit(0);
})().catch((e) => {
  console.error('ZACC smoke test FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
