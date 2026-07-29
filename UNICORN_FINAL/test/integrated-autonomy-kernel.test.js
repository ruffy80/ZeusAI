'use strict';

/**
 * integrated-autonomy-kernel.test.js — IAK/1.0 consolidation tests
 *
 * Covers: singleton identity across legacy shims, register/heal, idempotent
 * start, causal dependsOn, conflict quarantine, facet wiring.
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.UNICORN_RUNTIME_PROFILE = 'stable'; // keep guardian idle in tests
process.env.IAK_HARMONIC_MS = '60000';

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

console.log('Integrated Autonomy Kernel (IAK/1.0)');

const iak = require('../backend/modules/integrated-autonomy-kernel');
const mesh = require('../backend/modules/unicornMeshOrchestrator');
const guardian = require('../backend/modules/unicornOrchestrator');
const external = require('../backend/modules/central-orchestrator');
const tenants = require('../backend/modules/saas-orchestrator-v4');
const deadStub = require('../backend/modules/meshOrchestrator');

check('legacy mesh shim is the IAK singleton', () => {
  assert.strictEqual(mesh, iak);
  assert.strictEqual(deadStub, iak);
  assert.strictEqual(iak.id, 'IAK/1.0');
});

check('guardian / external / tenants are IAK facets', () => {
  assert.strictEqual(guardian, iak.guardian);
  assert.strictEqual(external, iak.external);
  assert.strictEqual(tenants, iak.tenants);
  assert.ok(typeof guardian.getStatus === 'function');
  assert.ok(typeof external.getStatus === 'function');
  assert.ok(typeof tenants.getStatus === 'function');
});

check('register + getStatus tracks modules', () => {
  const mod = {
    getStatus() { return { health: 'ok', status: 'live' }; },
  };
  const r = iak.register('iak-test-mod-a', mod, { capability: 'iak-test-cap-a' });
  assert.strictEqual(r.ok, true);
  const st = iak.getStatus();
  assert.ok(st.totalModules >= 1);
  assert.ok(st.modules.some((m) => m.name === 'iak-test-mod-a'));
  assert.ok(Array.isArray(st.innovations));
  assert.ok(st.innovations.includes('harmonic_phased_tick'));
  assert.ok(st.innovations.includes('causal_boot_graph'));
  assert.ok(st.innovations.includes('conflict_quarantine'));
});

check('conflict quarantine blocks duplicate capability', () => {
  const mod = {
    getStatus() { return { health: 'ok' }; },
  };
  const r = iak.register('iak-test-mod-b', mod, { capability: 'iak-test-cap-a' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'capability_conflict');
  assert.ok(iak.getQuarantine().some((q) => q.name === 'iak-test-mod-b'));
});

check('causal boot marks depsReady false when dependency unhealthy', () => {
  const unhealthy = {
    getStatus() { return { health: 'error', status: 'failed' }; },
  };
  const child = {
    getStatus() { return { health: 'ok' }; },
  };
  iak.register('iak-dep-parent', unhealthy, { capability: 'iak-dep-parent-cap' });
  iak.register('iak-dep-child', child, { dependsOn: ['iak-dep-parent'], capability: 'iak-dep-child-cap' });

  // Drive one health phase
  iak._phaseHealth();
  const entry = iak.registry.get('iak-dep-child');
  assert.ok(entry);
  assert.strictEqual(entry.depsReady, false);
  assert.strictEqual(entry.healthy, false);
});

check('idempotent start does not stack timers', () => {
  const before = iak._timers.length;
  iak.start({ mode: 'monitor' });
  const mid = iak._timers.length;
  iak.start({ mode: 'monitor' });
  const after = iak._timers.length;
  assert.ok(mid >= 1);
  assert.strictEqual(after, mid);
  assert.ok(before === 0 || after >= before);
  assert.strictEqual(iak.running, true);
  iak.stop();
  assert.strictEqual(iak.running, false);
  assert.strictEqual(iak._timers.length, 0);
});

check('heal invokes instance.heal when unhealthy', () => {
  let healed = 0;
  const mod = {
    getStatus() { return { health: 'critical' }; },
    heal() { healed++; },
  };
  iak.register('iak-heal-target', mod, { capability: 'iak-heal-cap' });
  const entry = iak.registry.get('iak-heal-target');
  entry.healthy = false;
  entry.depsReady = true;
  entry.errors = 1;
  iak.mode = 'full';
  iak._phaseHeal();
  assert.strictEqual(healed, 1);
});

check('saas facet exposes SaaSOrchestratorV4 class', () => {
  assert.ok(tenants.SaaSOrchestratorV4 || require('../backend/modules/iak/tenant-queue').SaaSOrchestratorV4);
});

check('status includes facet snapshots', () => {
  const st = iak.getStatus();
  assert.ok(st.facets);
  assert.ok('external' in st.facets);
  assert.ok('tenants' in st.facets);
  assert.ok('guardian' in st.facets);
});

// Cleanup test modules so we don't leak into other tests in same process
for (const name of [
  'iak-test-mod-a', 'iak-test-mod-b', 'iak-dep-parent', 'iak-dep-child', 'iak-heal-target',
]) {
  try { iak.unregister(name); } catch (_) {}
}
iak.quarantine.clear();

console.log(`\n✅ integrated-autonomy-kernel: ${passed} tests passed`);
process.exit(0);
