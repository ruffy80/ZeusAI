'use strict';

/**
 * iak-status-surface-heal.test.js — heal production IAK spam:
 * growth-brain / live-pricing-broker degraded + quantumResistantBaaS throw
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
}

async function main() {
  const IAK = require('../backend/modules/integrated-autonomy-kernel');
  // Prefer fresh instance if constructible; else use singleton mesh
  let iak = IAK;
  if (typeof IAK === 'function') {
    try { iak = new IAK({ mode: 'monitor' }); } catch (_) { iak = IAK; }
  }
  if (iak && iak.default) iak = iak.default;

  await check('quantumResistantBaaS.getStatus() never throws without id', () => {
    const qr = require('../backend/modules/quantumResistantBaaS');
    const s = qr.getStatus();
    assert.equal(s.ok, true);
    assert.equal(s.module, 'quantumResistantBaaS');
    assert.ok(typeof s.chainCount === 'number');
  });

  await check('growth-brain.getStatus is healthy', () => {
    const gb = require('../backend/modules/growth-brain');
    assert.equal(typeof gb.getStatus, 'function');
    const s = gb.getStatus();
    assert.equal(s.ok, true);
    assert.equal(s.health, 'ok');
  });

  await check('live-pricing-broker.getStatus is healthy', () => {
    const lp = require('../backend/modules/live-pricing-broker');
    assert.equal(typeof lp.getStatus, 'function');
    const s = lp.getStatus();
    assert.equal(s.ok, true);
    assert.equal(s.health, 'ok');
  });

  await check('autonomousLegalEntity.getStatus() never throws without id', () => {
    const ale = require('../backend/modules/autonomousLegalEntity');
    const s = ale.getStatus();
    assert.equal(s.ok, true);
  });

  await check('IAK _isHealthy treats observe/unknown as healthy', () => {
    assert.equal(iak._isHealthy({ health: 'observe' }), true);
    assert.equal(iak._isHealthy({ health: 'unknown' }), true);
    assert.equal(iak._isHealthy({ health: 'ok' }), true);
    assert.equal(iak._isHealthy({ health: 'error' }), false);
    assert.equal(iak._isHealthy({ ok: false, error: 'x' }), false);
  });

  await check('IAK health phase does not degrade modules with honest getStatus', () => {
    const gb = require('../backend/modules/growth-brain');
    const lp = require('../backend/modules/live-pricing-broker');
    const qr = require('../backend/modules/quantumResistantBaaS');
    iak.register('growth-brain', gb, { statusFn: 'getStatus' });
    iak.register('live-pricing-broker', lp, { statusFn: 'getStatus' });
    iak.register('quantumResistantBaaS', qr, { statusFn: 'getStatus' });
    iak._phaseHealth();
    const e1 = iak.registry.get('growth-brain');
    const e2 = iak.registry.get('live-pricing-broker');
    const e3 = iak.registry.get('quantumResistantBaaS');
    assert.equal(e1.healthy, true, 'growth-brain');
    assert.equal(e2.healthy, true, 'live-pricing-broker');
    assert.equal(e3.healthy, true, 'quantumResistantBaaS');
    assert.equal(e3.errors, 0);
  });

  await check('shadowTester is a real module (not innovator shim) and getMetrics is healthy', () => {
    const st = require('../backend/modules/shadow-tester');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'backend/modules/shadow-tester.js'), 'utf8');
    assert.ok(!src.includes('supreme-innovator-adapter'), 'must not re-export innovator adapter');
    assert.equal(typeof st.getMetrics, 'function');
    assert.equal(typeof st.registerVariant, 'function');
    assert.equal(typeof st.runShadow, 'function');
    const m = st.getMetrics();
    assert.equal(m.ok, true);
    assert.equal(m.health, 'ok');
    assert.equal(iak._isHealthy(m), true);
  });

  await check('unicornInnovationSuite is real and getAffiliateStats is healthy', () => {
    const uis = require('../backend/modules/unicornInnovationSuite');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'backend/modules/unicornInnovationSuite.js'), 'utf8');
    assert.ok(!src.includes('supreme-innovator-adapter'), 'must not re-export innovator adapter');
    assert.equal(typeof uis.getAffiliateStats, 'function');
    assert.equal(typeof uis.createReferral, 'function');
    assert.equal(typeof uis.getTrustStatus, 'function');
    const s = uis.getAffiliateStats();
    assert.equal(s.ok, true);
    assert.equal(s.health, 'ok');
    assert.equal(iak._isHealthy(s), true);
  });

  await check('IAK does not degrade shadowTester / unicornInnovationSuite', () => {
    const st = require('../backend/modules/shadow-tester');
    const uis = require('../backend/modules/unicornInnovationSuite');
    iak.register('shadowTester', st, { statusFn: 'getMetrics' });
    iak.register('unicornInnovationSuite', uis, { statusFn: 'getAffiliateStats' });
    iak._phaseHealth();
    assert.equal(iak.registry.get('shadowTester').healthy, true);
    assert.equal(iak.registry.get('unicornInnovationSuite').healthy, true);
    assert.equal(iak.registry.get('shadowTester').errors, 0);
    assert.equal(iak.registry.get('unicornInnovationSuite').errors, 0);
  });

  await check('supreme-innovator unsupported_method is observe-healthy (no IAK spam)', () => {
    const adapter = require('../backend/modules/supreme-innovator-adapter');
    const s = adapter.getMetrics(); // intentional miss on adapter surface
    assert.equal(s.ok, true);
    assert.equal(s.health, 'observe');
    assert.equal(s.note, 'unsupported_method');
    assert.equal(iak._isHealthy(s), true);
  });

  console.log(`✅ iak-status-surface-heal: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
