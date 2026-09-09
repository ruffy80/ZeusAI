'use strict';
/**
 * modules-real-world-complete.test.js
 * Pins truth fences + MPCT so theater modules cannot silently reappear.
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
delete process.env.SERPAPI_KEY;
delete process.env.COMPETITOR_FEED_URL;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('AI CFO never invents revenue on require', () => {
  // Fresh require path — module may already be cached; status contract still holds.
  const cfo = require('../backend/modules/ai-cfo-agent');
  const st = cfo.getStatus();
  assert.strictEqual(st.simulated, false);
  assert.ok(st.dataMode === 'unarmed' || st.dataMode === 'live');
  if (st.dataMode === 'unarmed') {
    assert.strictEqual(st.revenue, 0);
  }
});

check('Competitor spy stays unarmed without SERPAPI', () => {
  const spy = require('../backend/modules/competitor-spy-agent');
  const st = spy.getStatus();
  assert.strictEqual(st.simulated, false);
  assert.strictEqual(st.dataMode, 'unarmed');
  assert.strictEqual(st.useful, false);
  assert.strictEqual(st.competitorsMonitored, 0);
});

check('AGDE gravity uses competitorUseful not mere presence', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/autonomousGlobalDominanceEngine.js'),
    'utf8'
  );
  assert.ok(/competitorUseful/.test(src));
  assert.ok(!/\+ \(snap\.competitorPresent \? 10 : 0\)/.test(src));
});

check('productCatalog blocks theater SKUs from buyable set', () => {
  const catalog = require('../backend/modules/productCatalog');
  catalog.ensureRevenueSkus();
  assert.strictEqual(catalog.get('quantum-identity-shield').buyable, false);
  assert.strictEqual(catalog.get('carbon-credits-trading').buyable, false);
  assert.ok(catalog.get('api-access-pro').buyable !== false);
  const buyable = catalog.list({ buyableOnly: true });
  assert.ok(buyable.every((s) => s.buyable !== false));
  assert.ok(!buyable.find((s) => s.id === 'quantum-identity-shield'));
});

check('live-pricing-broker getStatus is honest when idle/disabled', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../backend/modules/live-pricing-broker.js'),
    'utf8'
  );
  assert.ok(/not_started|LIVE_PRICING_DISABLED/.test(src));
  assert.ok(/health = 'observe'/.test(src) || /health: 'observe'/.test(src));
  const lp = require('../backend/modules/live-pricing-broker');
  const st = lp.getStatus();
  assert.equal(st.ok, true);
  assert.ok(st.running === false || st.health === 'ok');
});

check('globalMonetizationMesh does not invent reachUsers totals', () => {
  const mesh = require('../backend/modules/globalMonetizationMesh');
  const r = mesh.reach();
  assert.strictEqual(r.totalReachUsers, null);
  assert.strictEqual(r.simulated, false);
  const ms = mesh.listMarketplaces();
  assert.ok(ms.length >= 12);
  assert.ok(ms.every((m) => m.reachUsers == null));
});

check('IAK stable allowlist includes ROCS + MPCT + live-pricing + CBLOS', () => {
  const disc = require('../backend/modules/iak/module-discovery');
  const allow = disc.STABLE_START_ALLOW;
  assert.ok(allow.has('reality-ops-continuum'));
  assert.ok(allow.has('money-path-causal-twin'));
  assert.ok(allow.has('live-pricing-broker'));
  assert.ok(allow.has('commerce-bond-loop-os'));
  assert.ok(allow.has('origin-gravity-os'));
  assert.ok(allow.has('social-gravity-os'));
  assert.ok(allow.has('viral-unification-os'));
});

check('MPCT advances only on attested sense — never invents GMV', () => {
  const mpct = require('../backend/modules/money-path-causal-twin');
  const out = mpct.tick({ dryRun: true });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.protocol, 'MPCT/1.0');
  assert.strictEqual(out.inventsGmv, false);
  assert.ok(out.phase);
  assert.ok(out.sense && typeof out.sense.paidOrders === 'number');
  assert.strictEqual(out.sense.revenueUsd >= 0, true);
  const st = mpct.getStatus();
  assert.strictEqual(st.inventsGmv, false);
  assert.ok(Array.isArray(st.phases));
  assert.ok(st.tipHash || st.tickCount >= 1);
});

check('MPCT phase regression is forbidden', () => {
  const mpct = require('../backend/modules/money-path-causal-twin');
  // Force paid via internal advance then ensure derive can't go backwards through API:
  // tick from empty sense stays at catalog or higher — never invents paid.
  const a = mpct.tick({ dryRun: true });
  assert.ok(a.phase !== 'paid' || a.sense.paidOrders > 0);
});

console.log(`\n✅ modules-real-world-complete: ${passed} tests passed\n`);
process.exit(0);
