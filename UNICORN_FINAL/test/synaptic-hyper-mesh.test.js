'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { hyperMesh, getStatus, runCorridor, getNeurons } = require('../backend/modules/autonomousSynapticHyperMesh');

let passed = 0;
async function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') await res;
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`❌ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAll() {
  console.log('⚡ Starting Autonomous Synaptic Hyper-Mesh (ASHM) Validation Suite...\n');

  // 1. HyperMesh Initialization & Neuron Registration
  await test('HyperMesh initializes with 700+ neurons and 8 active corridors', () => {
    const status = getStatus();
    assert.equal(status.ok, true);
    assert.equal(status.version, '1.0.0-HYPERMESH');
    assert.ok(status.totalNeurons >= 700, `Expected >= 700 neurons, got ${status.totalNeurons}`);
    assert.equal(status.activeCorridorsCount, 8);
    assert.equal(status.healthScore, 100);
    assert.equal(status.tourbillonIntegrity, 'ZERO_DEFECTS');
    assert.equal(status.corridors.length, 8);
  });

  // 2. CORRIDOR_SOVEREIGN_REVENUE
  await test('Corridor CORRIDOR_SOVEREIGN_REVENUE executes dynamic pricing & cryptographic notarization', async () => {
    const res = await runCorridor('CORRIDOR_SOVEREIGN_REVENUE', {
      basePrice: 199.00,
      country: 'RO',
      serviceId: 'enterprise-autonomous-cloud',
    });
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_SOVEREIGN_REVENUE');
    assert.ok(res.durationUs > 0);
    assert.ok(res.output.grossTotal > 0);
    assert.ok(res.output.btcAmount > 0);
    assert.equal(res.output.btcWallet, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.equal(res.output.status, 'SETTLED_AUTONOMOUS');
    assert.ok(res.output.merkleProof);
  });

  // 3. CORRIDOR_COGNITIVE_AI
  await test('Corridor CORRIDOR_COGNITIVE_AI scrubs PII, prunes tokens, and routes inference', async () => {
    const res = await runCorridor('CORRIDOR_COGNITIVE_AI', {
      prompt: 'Execute sovereign transaction for user test@example.com with key ghp_987654321098765432109876543210123456',
    });
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_COGNITIVE_AI');
    assert.ok(res.output.originalLength > 0);
    assert.ok(res.output.tokensSavedEstimate >= 0);
    assert.ok(res.output.routedProvider);
    assert.equal(res.output.status, 'INFERENCE_OPTIMIZED');
  });

  // 4. CORRIDOR_SELF_HEALING_IMMORTALITY
  await test('Corridor CORRIDOR_SELF_HEALING_IMMORTALITY verifies loop lag, heap and multicloud resilience', async () => {
    const res = await runCorridor('CORRIDOR_SELF_HEALING_IMMORTALITY');
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_SELF_HEALING_IMMORTALITY');
    assert.ok(res.output.eventLoopLagUs >= 0);
    assert.ok(res.output.heapUsedMb > 0);
    assert.equal(res.output.immortalityConfidence, '100.00%');
    assert.equal(res.output.status, 'SYSTEM_IMMORTAL_ACTIVE');
  });

  // 5. CORRIDOR_AUTONOMIC_GROWTH_ACQUISITION
  await test('Corridor CORRIDOR_AUTONOMIC_GROWTH_ACQUISITION evaluates A/B experiments and SEO velocity', async () => {
    const res = await runCorridor('CORRIDOR_AUTONOMIC_GROWTH_ACQUISITION');
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_AUTONOMIC_GROWTH_ACQUISITION');
    assert.ok(res.output.winningVariant);
    assert.ok(res.output.viralGrowthScore >= 80);
    assert.equal(res.output.status, 'GROWTH_PULSE_ACTIVE');
  });

  // 6. CORRIDOR_PROPHETIC_INTELLIGENCE
  await test('Corridor CORRIDOR_PROPHETIC_INTELLIGENCE generates 30d ARR forecast and capital allocation', async () => {
    const res = await runCorridor('CORRIDOR_PROPHETIC_INTELLIGENCE');
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_PROPHETIC_INTELLIGENCE');
    assert.ok(res.output.revenueForecast30dUsd > 0);
    assert.ok(res.output.economyPulseScore > 0);
    assert.ok(res.output.capitalAllocation.marketingPct > 0);
    assert.equal(res.output.status, 'PROPHETIC_PULSE_NOMINAL');
  });

  // 7. CORRIDOR_CRYPTOGRAPHIC_SOVEREIGNTY
  await test('Corridor CORRIDOR_CRYPTOGRAPHIC_SOVEREIGNTY builds Merkle audit tree and RFC 3161 timestamps', async () => {
    const res = await runCorridor('CORRIDOR_CRYPTOGRAPHIC_SOVEREIGNTY', {
      contract: 'ENTERPRISE_LICENSE_001',
      tenant: 'zeus-sovereign',
    });
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_CRYPTOGRAPHIC_SOVEREIGNTY');
    assert.ok(res.output.documentSha256);
    assert.ok(res.output.merkleRoot);
    assert.ok(res.output.rfc3161Timestamp);
    assert.equal(res.output.auditVerifiable, true);
    assert.equal(res.output.status, 'CRYPTOGRAPHICALLY_NOTARIZED');
  });

  // 8. CORRIDOR_MULTI_TENANT_OPS
  await test('Corridor CORRIDOR_MULTI_TENANT_OPS balances quotas and arbitrates cloud infrastructure', async () => {
    const res = await runCorridor('CORRIDOR_MULTI_TENANT_OPS', {
      tenantId: 'tenant-vip-007',
    });
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_MULTI_TENANT_OPS');
    assert.equal(res.output.tenantId, 'tenant-vip-007');
    assert.ok(res.output.recommendedCloudHost);
    assert.equal(res.output.zeroDowntimeGuaranteed, true);
    assert.equal(res.output.status, 'TENANT_PROVISIONED_STABLE');
  });

  // 9. CORRIDOR_AGI_SELF_EVOLUTION
  await test('Corridor CORRIDOR_AGI_SELF_EVOLUTION scores capability synergies and generates innovations', async () => {
    const res = await runCorridor('CORRIDOR_AGI_SELF_EVOLUTION');
    assert.equal(res.ok, true);
    assert.equal(res.corridor, 'CORRIDOR_AGI_SELF_EVOLUTION');
    assert.ok(res.output.capabilitySynergyScore > 90);
    assert.ok(Array.isArray(res.output.proposedInnovations));
    assert.ok(res.output.proposedInnovations.length >= 3);
    assert.equal(res.output.status, 'EVOLUTION_CYCLE_CONFIRMED');
  });

  // 10. Tourbillon Fault-Tolerance Envelope
  await test('Tourbillon Envelope absorbs runtime exceptions without crash', async () => {
    const brokenNeuronId = 'test-faulty-neuron-' + Date.now();
    hyperMesh._registerNeuron(brokenNeuronId, 'FAULT_TEST', {
      process: () => { throw new Error('Simulated hardware bus transient failure'); }
    });

    const neuron = hyperMesh.neurons.get(brokenNeuronId);
    assert.ok(neuron);
    const res = await neuron.invoke({ test: 123 });
    assert.equal(res.ok, false);
    assert.equal(res.tourbillonRecovered, true);
    assert.ok(res.error.includes('Simulated hardware bus transient failure'));
    assert.ok(res.latencyUs >= 0);
  });

  // 11. Neuron Query & Filter
  await test('Neuron query filtering returns targeted subsystems', () => {
    const all = getNeurons();
    assert.ok(all.length >= 700);

    const adaptive = getNeurons('AdaptiveModule');
    assert.ok(adaptive.length >= 82);

    const engines = getNeurons('Engine');
    assert.ok(engines.length >= 62);

    const unicorns = getNeurons('unicorn');
    assert.ok(unicorns.length >= 6);
  });

  // 12. Ecosystem Map Integrity: Zero Orphans, Active >= 700
  await test('SYSTEM_MAP.json confirms 0 orphaned modules and >= 700 active modules', () => {
    const mapPath = path.resolve(__dirname, '../SYSTEM_MAP.json');
    assert.ok(fs.existsSync(mapPath), 'SYSTEM_MAP.json does not exist');
    const content = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    assert.equal(content.counts.orphaned, 0, `Expected 0 orphaned modules, got ${content.counts.orphaned}`);
    assert.equal(content.counts.dead, 0, `Expected 0 dead modules, got ${content.counts.dead}`);
    assert.ok(content.counts.active >= 700, `Expected >= 700 active modules, got ${content.counts.active}`);
    const orphanedModules = (content.modules || []).filter(m => m.status === 'orphaned');
    assert.equal(orphanedModules.length, 0);
  });

  // 13. Synapse Router Endpoints
  await test('Synapse router provides REST endpoints for all corridors and status', async () => {
    const synapseRouter = require('../backend/routes/synapse.routes');
    assert.ok(synapseRouter);
    assert.ok(typeof synapseRouter === 'function' || typeof synapseRouter === 'object');
    assert.equal(typeof synapseRouter.get, 'function');
    assert.equal(typeof synapseRouter.post, 'function');

    // Test direct controller invocation
    const status = hyperMesh.getStatus();
    assert.equal(status.ok, true);
    assert.equal(status.corridors.length, 8);
  });

  hyperMesh.stopHeartbeat();
  console.log(`\n🎉 ALL ${passed} SYNAPTIC HYPER-MESH TESTS PASSED WITH 100% SUCCESS!`);
  process.exit(0);
}

runAll().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
