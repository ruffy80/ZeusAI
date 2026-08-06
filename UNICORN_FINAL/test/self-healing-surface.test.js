'use strict';

/**
 * self-healing-surface.test.js
 * Validates that thin healing aliases expose a real event/action surface
 * wired through unicornSelfHealer (not silent stubs).
 */

const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const core = require('../backend/modules/unicornSelfHealer');
const adapter = require('../backend/modules/supreme-self-healer-adapter');
const selfHealing = require('../backend/modules/self-healing-engine');
const predictive = require('../backend/modules/predictive-healing');
const opsWatchdog = require('../backend/modules/ops-watchdog');
const bridge = require('../backend/modules/integrations/predictive-healing-bridge');

let passed = 0;
function check(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error('  ✗', name, err && err.message ? err.message : err);
    throw err;
  }
  passed += 1;
  console.log('  ✓', name);
}

console.log('Self-healing surface');

check('core exports event + heal API', () => {
  assert.equal(typeof core.getStatus, 'function');
  assert.equal(typeof core.forceHeal, 'function');
  assert.equal(typeof core.on, 'function');
  assert.equal(typeof core.handlePredictiveWarning, 'function');
  assert.equal(typeof core.watchdogDaemon, 'function');
});

check('thin aliases share adapter surface', () => {
  assert.equal(typeof selfHealing.forceHeal, 'function');
  assert.equal(typeof selfHealing.handlePredictiveWarning, 'function');
  assert.equal(typeof predictive.on, 'function');
  assert.equal(typeof opsWatchdog.getStatus, 'function');
  assert.equal(typeof adapter.emit, 'function');
});

check('forceHeal returns ok status payload', () => {
  const r = core.forceHeal();
  assert.equal(r.ok, true);
  assert.ok(r.status && typeof r.status.cycles === 'number');
});

check('handlePredictiveWarning acts on critical', () => {
  const r = core.handlePredictiveWarning({ severity: 'critical', reason: 'unit-test' });
  assert.equal(r.ok, true);
  assert.equal(r.acted, true);
});

check('prediction events emit on bus', () => {
  let saw = null;
  core.once('prediction', (p) => { saw = p; });
  // Force a synthetic emission through public emit
  core.emit('prediction', { severity: 'high', errRate: 0.9, source: 'unit-test' });
  assert.ok(saw && saw.severity === 'high');
});

check('predictive-healing-bridge init is idempotent', () => {
  bridge.init();
  bridge.init();
  const st = bridge.getStatus();
  assert.equal(st.name, 'predictive-healing-bridge');
  assert.ok(st.startedAt);
});

check('watchdogDaemon returns memory + lag fields', () => {
  const wd = core.watchdogDaemon();
  assert.ok(typeof wd.heapMB === 'number');
  assert.ok(typeof wd.uptime === 'number');
  assert.ok('lagMs' in wd);
});

console.log(`\n📊 self-healing-surface: ${passed} passed\n`);
process.exit(0);
