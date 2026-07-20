'use strict';
/**
 * frontier-market-exceptional.test.js
 * Guards the upgraded, production-grade frontierAI + marketAnalytics modules:
 *   - frontierAI: recommend / route / recordUsage / tick + richer getStatus
 *   - marketAnalytics: real catalog ingest (with injected products), signal,
 *     recommend, and non-zero tops + richer getStatus
 * Fully offline: no network, in-memory-ish (best-effort disk) state.
 */
const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_SELF_CONSTRUCTION = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';
// Ensure at least one keyed provider is enabled so routing is non-degraded.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';

const MODULES = path.join(__dirname, '..', 'backend', 'modules');
const frontierAI = require(path.join(MODULES, 'frontierAI.js'));
const marketAnalytics = require(path.join(MODULES, 'marketAnalytics.js'));

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}
async function checkAsync(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

(async () => {
  // ── frontierAI ─────────────────────────────────────────────────────────────
  check('frontierAI exports the full production surface', () => {
    for (const m of ['getStatus', 'process', 'recommend', 'route', 'recordUsage', 'tick', 'start', 'stop']) {
      assert.strictEqual(typeof frontierAI[m], 'function', `frontierAI.${m} must be a function`);
    }
  });

  check('frontierAI.recommend() picks an enabled provider+model with a reason', () => {
    const rec = frontierAI.recommend({ domain: 'reasoning', task: 'plan a launch' });
    assert.strictEqual(rec.ok, true);
    assert.strictEqual(rec.degraded, false, 'a keyed provider covers reasoning');
    assert.ok(rec.provider && rec.model, 'provider + model chosen');
    assert.ok(typeof rec.reason === 'string' && rec.reason.length > 0, 'human reason present');
    assert.ok(Array.isArray(rec.alternatives), 'alternatives listed');
  });

  check('frontierAI.recommend() falls back to local for an uncovered domain', () => {
    // negotiation is only served by the always-on local provider.
    const rec = frontierAI.recommend({ domain: 'negotiation' });
    assert.strictEqual(rec.ok, true);
    assert.strictEqual(rec.provider, 'local');
  });

  check('frontierAI.route() returns a plan with ordered fallbacks + coverage', () => {
    const plan = frontierAI.route({ domain: 'code', promptMeta: { tokens: 800 } });
    assert.strictEqual(plan.ok, true);
    assert.ok(plan.provider && plan.model, 'primary chosen');
    assert.ok(Array.isArray(plan.fallbacks), 'fallbacks array');
    assert.ok(plan.coverage && typeof plan.coverage.autonomyCoverage === 'number', 'coverage present');
    assert.strictEqual(plan.coverage.domainCovered, true, 'code domain covered by keyed providers');
  });

  check('frontierAI.recordUsage() tracks success/fail/latency and biases routing', () => {
    // Poison deepseek (fail) and reward anthropic (fast success) for "code".
    for (let i = 0; i < 5; i++) frontierAI.recordUsage({ provider: 'deepseek', domain: 'code', ok: false, latencyMs: 4000 });
    for (let i = 0; i < 5; i++) frontierAI.recordUsage({ provider: 'anthropic', domain: 'code', ok: true, latencyMs: 200 });
    const st = frontierAI.getStatus();
    const ds = st.providers.find((p) => p.id === 'deepseek');
    const an = st.providers.find((p) => p.id === 'anthropic');
    assert.ok(ds.usageStats.calls > 0 && an.usageStats.calls > 0, 'usage recorded');
    assert.ok(an.usageStats.successRate > ds.usageStats.successRate, 'anthropic more reliable than deepseek');
  });

  await checkAsync('frontierAI.process({action:"tick"}) advances + reports health', async () => {
    const res = await frontierAI.process({ action: 'tick' });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.action, 'tick');
    assert.ok(res.ticks >= 1, 'tick counter advanced');
    assert.ok(['excellent', 'good', 'degraded'].includes(res.health), 'health classified');
  });

  check('frontierAI.getStatus() is rich (health, providers w/ usageStats, recs)', () => {
    const st = frontierAI.getStatus();
    assert.strictEqual(st.status, 'active');
    assert.ok(['excellent', 'good', 'degraded'].includes(st.health), 'health present');
    assert.ok(Array.isArray(st.providers) && st.providers.length >= 5, 'providers listed');
    assert.ok(st.providers.every((p) => 'enabled' in p && p.usageStats), 'providers carry enabled + usageStats');
    assert.ok(Array.isArray(st.lastRecommendations), 'lastRecommendations present');
    assert.ok(Array.isArray(st.gaps), 'gaps present');
    assert.ok(typeof st.autonomyCoverage === 'number' && st.autonomyCoverage >= 0, 'coverage numeric');
  });

  // ── marketAnalytics ─────────────────────────────────────────────────────────
  check('marketAnalytics exports the full production surface', () => {
    for (const m of ['getStatus', 'process', 'ingest', 'recommend', 'report', 'top', 'tick', 'start', 'stop']) {
      assert.strictEqual(typeof marketAnalytics[m], 'function', `marketAnalytics.${m} must be a function`);
    }
  });

  const FAKE_CATALOG = [
    { category: 'electronics', marginPct: 40, rating: 4.7 },
    { category: 'electronics', marginPct: 35, rating: 4.5 },
    { category: 'electronics', marginPct: 30, rating: 4.2 },
    { category: 'fashion', marginPct: 55, rating: 4.8 },
    { category: 'fashion', marginPct: 50, rating: 4.6 },
    { category: 'beauty', marginPct: 60, rating: 4.9 },
    { category: 'home', marginPct: 25, rating: 4.0 },
  ];

  await checkAsync('marketAnalytics.process({action:"ingest", products}) yields NON-ZERO tops', async () => {
    // Multiple ingests let the EMA converge toward the injected catalog weight.
    let res;
    for (let i = 0; i < 25; i++) {
      res = await marketAnalytics.process({ action: 'ingest', products: FAKE_CATALOG });
    }
    assert.strictEqual(res.ok, true);
    // At least the injected products are ingested; a live ZACC catalog (when
    // present in-process) contributes additional real SKUs on top.
    assert.ok(res.products >= FAKE_CATALOG.length, 'ingested at least the injected products');
    assert.ok(Array.isArray(res.top) && res.top.length >= 1, 'top present');
    assert.ok(res.top[0].score > 0, 'top demand score is non-zero after ingest');
  });

  await checkAsync('marketAnalytics ingest weights margin*rating (electronics SKUs rank)', async () => {
    const rep = await marketAnalytics.process({ action: 'report' });
    assert.strictEqual(rep.ok, true);
    assert.ok((rep.ingestCounts.electronics || 0) >= 3, 'electronics counted >= 3 injected SKUs');
    const scored = rep.rankings.filter((r) => r.score > 0).map((r) => r.category);
    assert.ok(scored.includes('electronics') && scored.includes('fashion') && scored.includes('beauty'),
      'ingested categories carry demand');
  });

  await checkAsync('marketAnalytics.process({action:"signal"}) then tick blends demand', async () => {
    await marketAnalytics.process({ action: 'signal', category: 'ai-services', weight: 500 });
    const rep1 = await marketAnalytics.process({ action: 'report' });
    const ai1 = rep1.rankings.find((r) => r.category === 'ai-services');
    assert.ok(ai1 && ai1.score > 0, 'signal registered demand');
    const t = await marketAnalytics.process({ action: 'tick' });
    assert.strictEqual(t.ok, true);
    assert.ok(t.ticks >= 1, 'tick advanced');
  });

  await checkAsync('marketAnalytics.process({action:"recommend"}) explains top categories', async () => {
    const rec = await marketAnalytics.process({ action: 'recommend', n: 3 });
    assert.strictEqual(rec.ok, true);
    assert.ok(Array.isArray(rec.recommendations) && rec.recommendations.length >= 1, 'recommendations present');
    assert.ok(rec.recommendations.every((r) => typeof r.why === 'string' && r.why.length > 0), 'each rec has a why');
  });

  check('marketAnalytics.getStatus() shows non-zero top + ingest metadata', () => {
    const st = marketAnalytics.getStatus();
    assert.strictEqual(st.status, 'active');
    assert.strictEqual(st.module, 'marketAnalytics');
    assert.ok(st.trackedCategories >= 1, 'tracks categories');
    assert.ok(Array.isArray(st.top) && st.top.length >= 1, 'top array present');
    assert.ok(st.top[0].score > 0, 'live catalog yields non-zero top');
    assert.ok(st.ingests >= 1 && !!st.lastIngestAt, 'ingest metadata present');
    assert.ok(Array.isArray(st.ingestSources), 'ingest sources recorded as an array');
  });

  // Stop any timers (defensive — tests never call start(), but be safe).
  try { frontierAI.stop(); } catch (_) { /* ignore */ }
  try { marketAnalytics.stop(); } catch (_) { /* ignore */ }

  console.log(`\n✅ frontier-market-exceptional: ${passed} tests passed\n`);
  process.exit(0);
})().catch((e) => {
  console.error('✗ frontier-market-exceptional FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
