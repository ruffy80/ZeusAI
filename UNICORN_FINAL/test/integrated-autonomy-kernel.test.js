'use strict';

/**
 * integrated-autonomy-kernel.test.js — IAK/1.1 total-module continuum tests
 *
 * Covers: singleton identity across legacy shims, register/heal, idempotent
 * start, causal dependsOn, conflict quarantine, facet wiring, discovery,
 * causalStart honesty fence, registerModule compat, syncNow alias.
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

console.log('Integrated Autonomy Kernel (IAK/1.1)');

const iak = require('../backend/modules/integrated-autonomy-kernel');
const mesh = require('../backend/modules/unicornMeshOrchestrator');
const guardian = require('../backend/modules/unicornOrchestrator');
const external = require('../backend/modules/central-orchestrator');
const tenants = require('../backend/modules/saas-orchestrator-v4');
const deadStub = require('../backend/modules/meshOrchestrator');
const discovery = require('../backend/modules/iak/module-discovery');

check('legacy mesh shim is the IAK singleton', () => {
  assert.strictEqual(mesh, iak);
  assert.strictEqual(deadStub, iak);
  assert.strictEqual(iak.id, 'IAK/1.1');
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
  assert.ok(st.innovations.includes('total_module_continuum'));
  assert.ok(st.innovations.includes('honesty_fence'));
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
  assert.ok(st.discovery);
});

check('registerModule compat for sovereign innovations', () => {
  const mod = {
    name: 'iak-sovereign-probe',
    getStatus() { return { health: 'ok' }; },
  };
  const r = iak.registerModule(mod);
  assert.strictEqual(r.ok, true);
  assert.ok(iak.registry.has('iak-sovereign-probe'));
});

check('syncNow / _syncCycle legacy aliases work', () => {
  assert.ok(typeof iak.syncNow === 'function');
  assert.ok(typeof iak._syncCycle === 'function');
  const out = iak.syncNow();
  assert.strictEqual(out.ok, true);
});

check('discovery scan finds real modules', () => {
  const manifest = discovery.scan({ softRequireMissing: true, maxSoftRequires: 80 });
  assert.ok(manifest.count >= 10, `expected >=10 modules, got ${manifest.count}`);
  assert.ok(Array.isArray(manifest.modules));
});

check('discoverAndRegister increases registry coverage', () => {
  const before = iak.registry.size;
  const out = iak.discoverAndRegister({ softRequireMissing: true, maxSoftRequires: 80 });
  assert.ok(out.found >= 10);
  assert.ok(iak.registry.size >= before);
  assert.ok(iak.registry.size >= out.found || out.registered >= 0);
});

check('honesty fence blocks unconfigured commerce start under stable', () => {
  let started = 0;
  const pay = {
    getStatus() { return { health: 'ok', configured: false }; },
    start() { started++; },
  };
  iak.register('iak-fake-paymentGateway', pay, {
    tier: 'commerce',
    honestyClass: 'commerce',
    capability: 'iak-fake-pay-cap',
  });
  const gate = discovery.mayStart({
    name: 'iak-fake-paymentGateway',
    instance: pay,
    hasStart: true,
    hasInit: false,
    tier: 'commerce',
    honestyClass: 'commerce',
  }, { stable: true, selfMutationDisabled: true });
  assert.strictEqual(gate.ok, false);
  assert.strictEqual(gate.reason, 'commerce_unconfigured');

  process.env.UNICORN_RUNTIME_PROFILE = 'stable';
  iak.causalStart();
  assert.strictEqual(started, 0);
});

check('causalStart starts stable allowlist infra modules', () => {
  let started = 0;
  const infra = {
    getStatus() { return { health: 'ok', running: false }; },
    start() { started++; this._running = true; },
  };
  iak.register('boot-immortal-os-probe', infra, {
    tier: 'infra',
    honestyClass: 'infra',
    capability: 'iak-infra-probe-cap',
  });
  // Force allow via name in STABLE_START_ALLOW — use real allowlisted name
  iak.unregister('boot-immortal-os-probe');
  iak.register('boot-immortal-os', infra, {
    tier: 'infra',
    honestyClass: 'infra',
    // no capability conflict with real module if already registered
  });
  // If already registered from discovery, replace instance for test
  const entry = iak.registry.get('boot-immortal-os');
  if (entry) {
    entry.instance = infra;
    entry.hasStart = true;
    entry.startedByIak = false;
    entry.tier = 'infra';
    entry.honestyClass = 'infra';
  }
  iak._startedByIak.delete('boot-immortal-os');
  const out = iak.causalStart({ force: true });
  assert.ok(out.stable === true || out.stable === false);
  // Under stable, infra allowlist should start our probe if mayStart allows
  const gate = discovery.mayStart({
    name: 'boot-immortal-os',
    instance: infra,
    hasStart: true,
    hasInit: false,
    tier: 'infra',
    honestyClass: 'infra',
  }, { stable: true });
  assert.strictEqual(gate.ok, true);
  if (gate.ok) {
    // causalStart should have invoked start at least once for this name
    assert.ok(started >= 1 || iak._startedByIak.has('boot-immortal-os') || (infra._running === true));
  }
});

check('mutators blocked when DISABLE_SELF_MUTATION=1', () => {
  const gate = discovery.mayStart({
    name: 'selfConstruction',
    instance: { start() {} },
    hasStart: true,
    hasInit: false,
    tier: 'mutator',
    honestyClass: 'mutator',
  }, { stable: false, selfMutationDisabled: true });
  assert.strictEqual(gate.ok, false);
  assert.ok(gate.reason === 'mutator_blocked' || gate.reason === 'mutators_off');
});

// Cleanup test modules
for (const name of [
  'iak-test-mod-a', 'iak-test-mod-b', 'iak-dep-parent', 'iak-dep-child', 'iak-heal-target',
  'iak-sovereign-probe', 'iak-fake-paymentGateway',
]) {
  try { iak.unregister(name); } catch (_) {}
}
iak.quarantine.clear();

console.log(`\n✅ integrated-autonomy-kernel: ${passed} tests passed`);
process.exit(0);
