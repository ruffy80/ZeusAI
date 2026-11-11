'use strict';

const assert = require('assert');
const path = require('path');
const { validateAllManifests } = require('../backend/modules/validate_manifests');
const { discoverModules, buildDependencyGraph, topologicalSort } = require('../backend/modules/orchestrator/discovery');
const { CapabilityStateMachine, STATES } = require('../backend/modules/orchestrator/stateMachine');
const { requestConsensus } = require('../backend/modules/orchestrator/consensus');
const { BlueGreenManager } = require('../backend/modules/orchestrator/blueGreen');
const { UnifiedOrchestrator } = require('../backend/modules/orchestrator');

async function testManifestValidation() {
  const results = validateAllManifests([path.resolve(__dirname, '../backend/modules')]);
  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.filter((r) => !r.valid).length;
  assert.ok(results.length >= 20, `Expected at least 20 manifests, got ${results.length}`);
  assert.strictEqual(invalidCount, 0, `Expected 0 invalid manifests, got ${invalidCount}`);
  assert.strictEqual(validCount, results.length);
  console.log(`✓ Pasul 1: ${validCount}/${results.length} module manifests valid`);
}

async function testDiscoveryAndCycleDetection() {
  const modules = discoverModules([path.resolve(__dirname, '../backend/modules')]);
  assert.ok(modules.length >= 20, 'Should discover >= 20 modules');
  const graph = buildDependencyGraph(modules);
  assert.strictEqual(graph.cycles.length, 0, 'Real modules should have 0 dependency cycles');
  const ordered = topologicalSort(graph);
  assert.strictEqual(ordered.length, modules.length);

  const names = ordered.map((m) => m.name);
  // score depends on witness -> witness must appear before score
  assert.ok(names.indexOf('witness') < names.indexOf('score'), 'witness must precede score');

  // Test cycle detection
  const cyclicGraph = buildDependencyGraph([
    { name: 'modA', dependencies: ['modB'] },
    { name: 'modB', dependencies: ['modA'] },
  ]);
  assert.ok(cyclicGraph.cycles.length > 0, 'Should detect cycle between modA and modB');
  let threw = false;
  try {
    topologicalSort(cyclicGraph);
  } catch (err) {
    threw = /cycle/i.test(err.message);
  }
  assert.ok(threw, 'topologicalSort must throw on cyclic dependency graph');
  console.log('✓ Pasul 2: dynamic discovery, topological sort, and cycle detection verified');
}

async function testCapabilityStateMachine() {
  const sm = new CapabilityStateMachine({ quarantineMs: 250, persistPostgres: false });
  sm.ensureCapability('capA', 'modA');
  assert.strictEqual(sm.getState('capA'), STATES.IDLE);

  sm.markStart('capA', 'modA');
  assert.strictEqual(sm.getState('capA'), STATES.RUNNING);

  sm.markSuccess('capA', 'modA');
  assert.strictEqual(sm.getState('capA'), STATES.IDLE);

  // 1st failure -> DEGRADED
  sm.markFailure('capA', 'err1');
  assert.strictEqual(sm.getState('capA'), STATES.DEGRADED);

  // 2nd failure -> DEGRADED
  sm.markFailure('capA', 'err2');
  assert.strictEqual(sm.getState('capA'), STATES.DEGRADED);

  // 3rd consecutive failure -> QUARANTINED
  let quarantinedEvt = null;
  sm.once('capability_quarantined', (e) => { quarantinedEvt = e; });
  sm.markFailure('capA', 'err3');
  assert.strictEqual(sm.getState('capA'), STATES.QUARANTINED);
  assert.ok(quarantinedEvt && quarantinedEvt.capability_id === 'capA');

  // Blocked while in quarantine cooldown
  assert.strictEqual(sm.canExecute('capA').allowed, false);

  // Wait for 250ms cooldown to expire -> transitions to RECOVERING -> healthCheck passes -> RUNNING
  await new Promise((r) => setTimeout(r, 280));
  const recovered = await sm.attemptRecovery('capA', async () => ({ ok: true }));
  assert.strictEqual(recovered.recovered, true);
  assert.strictEqual(sm.getState('capA'), STATES.RUNNING);
  console.log('✓ Pasul 3: per-capability state machine (IDLE→RUNNING→DEGRADED→QUARANTINED→RECOVERING→RUNNING) verified');
}

async function testBlastRadiusAndInfiniteLoopIsolation() {
  const orch = new UnifiedOrchestrator();
  orch.registerCapabilities([path.resolve(__dirname, '../backend/modules')]);
  orch.capabilities.set('rogueInfiniteLoop', {
    id: 'rogueInfiniteLoop',
    rawId: 'rogueInfiniteLoop',
    moduleName: 'testRogue',
    type: 'read',
    timeout_ms: 250,
    resourceBudget: { maxCpuMs: 100, maxMemoryMb: 256 },
  });

  let quarantined = null;
  orch.once('capability_quarantined', (evt) => { quarantined = evt; });

  const t0 = Date.now();
  // Synchronous infinite loop: worker thread terminates it after 250ms!
  const res = await orch.safeRun('rogueInfiniteLoop', () => {
    while (true) {}
  }, 250);
  const elapsed = Date.now() - t0;

  assert.strictEqual(res, undefined);
  assert.ok(elapsed < 2500, `Infinite loop should be killed quickly, took ${elapsed}ms`);
  assert.strictEqual(orch.stateMachine.getState('rogueInfiniteLoop'), STATES.QUARANTINED);
  assert.ok(quarantined && quarantined.capability_id === 'rogueInfiniteLoop');

  // Verify other capabilities continue running unaffected
  let otherRan = false;
  const okRes = await orch.safeRun('healthyCap', async () => {
    otherRan = true;
    return 'healthy_ok';
  });
  assert.strictEqual(otherRan, true);
  assert.strictEqual(okRes, 'healthy_ok');
  console.log('✓ Pasul 4: resource budgets & blast radius isolation (while(true) killed & quarantined, others unaffected)');
}

async function testGracefulDegradationTiers() {
  const orch = new UnifiedOrchestrator();
  for (let i = 1; i <= 12; i++) {
    const id = `cap_${i}`;
    orch.capabilities.set(id, { id, moduleName: 'testMod', type: 'notification' });
    orch.stateMachine.ensureCapability(id, 'testMod');
  }
  orch.capabilities.set('processPaidOrders', { id: 'processPaidOrders', moduleName: 'orchestrator', type: 'write' });
  orch.stateMachine.ensureCapability('processPaidOrders', 'orchestrator');

  // Quarantine 5 capabilities -> system automatically enters DEGRADED tier
  for (let i = 1; i <= 5; i++) {
    orch.stateMachine.markFailure(`cap_${i}`, 'f1');
    orch.stateMachine.markFailure(`cap_${i}`, 'f2');
    orch.stateMachine.markFailure(`cap_${i}`, 'f3');
  }
  const tier = orch.evaluateDegradationTier();
  assert.strictEqual(tier, 'degraded', `Expected degraded tier when 5 capabilities quarantined, got ${tier}`);
  assert.strictEqual(orch.isCapabilityAllowedInTier('processPaidOrders'), true, 'processPaidOrders must continue in DEGRADED tier');
  assert.strictEqual(orch.isCapabilityAllowedInTier('cap_6'), false, 'notification capability must pause in DEGRADED tier');
  console.log('✓ Pasul 5: graceful degradation tiers (5 quarantined → DEGRADED, processPaidOrders continues)');
}

async function testEmergencyStopAndResume() {
  const orch = new UnifiedOrchestrator();
  orch.registerCapabilities([path.resolve(__dirname, '../backend/modules')]);

  const stopRes = await orch.emergencyStop('Test emergency stop');
  assert.strictEqual(stopRes.ok, true);
  assert.strictEqual(stopRes.status, 'DISABLED');
  assert.strictEqual(orch.state.emergencyStopped, true);

  const healthStopped = orch.getHealthReport();
  assert.strictEqual(healthStopped.running, false);
  assert.ok(healthStopped.capabilities.byState.DISABLED >= 20);

  // Resume without confirmation must fail
  let rejected = false;
  try {
    orch.emergencyResume('wrong');
  } catch (e) {
    rejected = true;
  }
  assert.strictEqual(rejected, true, 'Resume without "I understand" must throw');

  // Resume with exact confirmation
  const resumeRes = orch.emergencyResume('I understand');
  assert.strictEqual(resumeRes.ok, true);
  assert.strictEqual(orch.state.emergencyStopped, false);
  console.log('✓ Pasul 6: emergency stop & resume verified');
}

async function testDestructiveActionConsensus() {
  // 2/3 PROCEED -> approved
  const resProceed = await requestConsensus(
    { capability: 'autoRepair', type: 'destructive', description: 'Restart postgresql' },
    {
      voters: {
        deepseek: async () => ({ model: 'deepseek', vote: 'PROCEED', reason: 'safe service restart' }),
        claude: async () => ({ model: 'claude', vote: 'PROCEED', reason: 'safe recovery' }),
        gpt: async () => ({ model: 'gpt', vote: 'STOP', reason: 'caution' }),
      },
    }
  );
  assert.strictEqual(resProceed.approved, true);
  assert.strictEqual(resProceed.decision, 'PROCEED');

  // 2/3 STOP -> rejected + escalated
  const resStop = await requestConsensus(
    { capability: 'dropOldLogs', type: 'destructive', description: 'Delete production tables' },
    {
      voters: {
        deepseek: async () => ({ model: 'deepseek', vote: 'STOP', reason: 'data loss risk' }),
        claude: async () => ({ model: 'claude', vote: 'STOP', reason: 'destructive table drop' }),
        gpt: async () => ({ model: 'gpt', vote: 'PROCEED', reason: 'ok' }),
      },
    }
  );
  assert.strictEqual(resStop.approved, false);
  assert.strictEqual(resStop.escalated, true);
  console.log('✓ Pasul 7: 3-model consensus (2/3 PROCEED approves, 2/3 STOP rejects & escalates) verified');
}

async function testBlueGreenUpgradeAndRollback() {
  const bg = new BlueGreenManager({ shadowCycles: 10 });

  // Matching behavior -> promote to 1.1.0
  const promoted = await bg.stageUpgrade('priceNegotiator', '1.1.0', {
    oldVersion: '1.0.0',
    oldRunner: async (i) => ({ cycle: i, priceUsd: 99 }),
    newRunner: async (i) => ({ cycle: i, priceUsd: 99 }),
  });
  assert.strictEqual(promoted.promoted, true);
  assert.strictEqual(promoted.activeVersion, '1.1.0');
  assert.strictEqual(promoted.cyclesRun, 10);

  // Divergent behavior -> reject upgrade and keep 1.1.0
  const rejected = await bg.stageUpgrade('priceNegotiator', '1.2.0', {
    oldVersion: '1.1.0',
    oldRunner: async (i) => ({ cycle: i, priceUsd: 99 }),
    newRunner: async (i) => ({ cycle: i, priceUsd: i === 5 ? 9999 : 99 }),
  });
  assert.strictEqual(rejected.promoted, false);
  assert.strictEqual(rejected.rolledBack, true);
  assert.strictEqual(rejected.activeVersion, '1.1.0');
  console.log('✓ Pasul 8: Blue/Green 10-cycle parallel validation (promote on match, rollback on divergence) verified');
}

(async () => {
  await testManifestValidation();
  await testDiscoveryAndCycleDetection();
  await testCapabilityStateMachine();
  await testBlastRadiusAndInfiniteLoopIsolation();
  await testGracefulDegradationTiers();
  await testEmergencyStopAndResume();
  await testDestructiveActionConsensus();
  await testBlueGreenUpgradeAndRollback();
  console.log('ALL 8 AUTONOMY SUITES PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('AUTONOMY TEST FAILED:', err);
  process.exit(1);
});
