'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const path = require('path');
const { clockwork } = require('../backend/modules/swissClockworkOrchestrator');
const pool = require('../backend/modules/adaptiveEnginePool');

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
  console.log('🇨🇭 Starting Swiss Clockwork & 144-Module Validation Suite...\n');

  // 1. Verificare inițializare pool și clockwork
  await test('Clockwork is synchronized and registered all 144 modules', () => {
    const status = clockwork.getStatus();
    assert.equal(status.ok, true);
    assert.equal(status.registeredWorkersCount, 144);
    assert.equal(status.clockworkState, 'SWISS_SYNCHRONIZED');
    assert.equal(status.pipelinesAvailable.length, 6);
  });

  // 2. Testare individuală a tuturor celor 82 de AdaptiveModules
  await test('All 82 AdaptiveModules execute real domain logic without error', () => {
    for (let i = 1; i <= 82; i++) {
      const name = 'AdaptiveModule' + String(i).padStart(2, '0');
      const mod = require(`../backend/modules/${name}`);
      assert.ok(mod, `Module ${name} could not be loaded`);
      const status = mod.getStatus();
      assert.equal(status.module, name);
      assert.ok(status.domain, `Module ${name} missing domain`);
      assert.ok(status.label, `Module ${name} missing label`);

      // Execuție logică reală
      const result = mod.process({ testInput: 'ZeusAI', amount: 150, basePrice: 100 });
      assert.equal(result.ok, true, `Module ${name} process failed`);
      assert.equal(result.module, name);
      assert.ok(typeof result.durationMicroseconds === 'number');
    }
  });

  // 3. Testare individuală a tuturor celor 62 de Engines
  await test('All 62 Engines execute real domain logic without error', () => {
    for (let i = 1; i <= 62; i++) {
      const name = 'Engine' + i;
      const mod = require(`../backend/modules/${name}`);
      assert.ok(mod, `Module ${name} could not be loaded`);
      const status = mod.getStatus();
      assert.equal(status.module, name);
      assert.ok(status.domain, `Engine ${name} missing domain`);
      assert.ok(status.label, `Engine ${name} missing label`);

      // Execuție logică reală
      const result = mod.process({ testData: 'Unicorn', grossUsd: 1200 });
      assert.equal(result.ok, true, `Engine ${name} process failed`);
      assert.equal(result.module, name);
      assert.ok(typeof result.durationMicroseconds === 'number');
    }
  });

  // 4. Testare Gear Train: COMMERCE_CHECKOUT
  await test('Pipeline COMMERCE_CHECKOUT runs like clockwork', async () => {
    const res = await clockwork.runChain('COMMERCE_CHECKOUT', {
      basePrice: 200,
      country: 'RO',
      isDisposableEmail: false,
      isBot: false,
      amount: 200,
    });

    assert.equal(res.ok, true);
    assert.equal(res.pipeline, 'COMMERCE_CHECKOUT');
    assert.equal(res.escapementSteps, 6);
    assert.ok(res.totalDurationMicroseconds > 0);
    assert.ok(res.finalOutput.merkleRoot, 'Missing merkleRoot in checkout');
    assert.ok(res.finalOutput.signature, 'Missing webhook signature');
    assert.equal(res.finalOutput.fraudRiskScore, 0);
  });

  // 5. Testare Gear Train: AI_INFERENCE
  await test('Pipeline AI_INFERENCE sanitizes, optimizes and routes', async () => {
    const res = await clockwork.runChain('AI_INFERENCE', {
      prompt: 'Hello,    please analyze   ZeusAI architecture.   Key: ghp_1234567890abcdef1234567890abcdef1234',
    });

    assert.equal(res.ok, true);
    assert.equal(res.pipeline, 'AI_INFERENCE');
    assert.equal(res.escapementSteps, 6);
    assert.ok(!res.finalOutput.redactedText.includes('ghp_1234567890abcdef'), 'Secret was not redacted');
    assert.ok(res.finalOutput.selectedProvider, 'Provider was not selected');
    assert.ok(res.finalOutput.coherenceScore >= 0);
  });

  // 6. Testare Gear Train: FRAUD_SHIELD
  await test('Pipeline FRAUD_SHIELD detects impossible travel & bots', async () => {
    const res = await clockwork.runChain('FRAUD_SHIELD', {
      lastLocation: { lat: 44.4268, lon: 26.1025, time: Date.now() - 60000 }, // București acum 1 min
      currentLocation: { lat: 40.7128, lon: -74.0060, time: Date.now() },      // New York acum
      userAgent: 'Mozilla/5.0 HeadlessChrome/120.0',
      email: 'hacker@mailinator.com'
    });

    assert.equal(res.ok, true);
    assert.equal(res.escapementSteps, 5);
    assert.equal(res.finalOutput.impossibleTravel, true);
    assert.equal(res.finalOutput.isBot, true);
    assert.equal(res.finalOutput.isDisposable, true);
    assert.equal(res.finalOutput.riskLevel, 'HIGH');
    assert.equal(res.finalOutput.actionRecommended, 'BLOCK');
  });

  // 7. Testare Gear Train: SYSTEM_HEAL
  await test('Pipeline SYSTEM_HEAL inspects loop lag, memory and immortality', async () => {
    const res = await clockwork.runChain('SYSTEM_HEAL');
    assert.equal(res.ok, true);
    assert.equal(res.escapementSteps, 6);
    assert.ok(res.finalOutput.lagMicroseconds >= 0);
    assert.ok(res.finalOutput.heapUsedMb > 0);
    assert.equal(res.finalOutput.swissWatchSynchronized, true);
    assert.equal(res.finalOutput.all144ModulesOperational, true);
  });

  // 8. Testare Gear Train: CRYPTOGRAPHIC_NOTARY
  await test('Pipeline CRYPTOGRAPHIC_NOTARY builds Merkle root and RFC 3161 timestamp', async () => {
    const res = await clockwork.runChain('CRYPTOGRAPHIC_NOTARY', {
      leaves: ['order-101', 'order-102', 'order-103'],
      message: 'Proof of Delivery for ZeusAI Customer',
    });
    assert.equal(res.ok, true);
    assert.equal(res.escapementSteps, 4);
    assert.ok(res.finalOutput.merkleRoot);
    assert.ok(res.finalOutput.tokenDigest);
    assert.ok(res.finalOutput.currentHash);
  });

  // 9. Testare Tourbillon Error-Canceler (Reziliență la erori)
  await test('Tourbillon mechanism absorbs shocks without halting the train', async () => {
    // Înregistrăm temporar un worker care aruncă eroare
    clockwork.registerWorker('FaultyGear', {
      process: () => { throw new Error('Simulated gear tooth rupture'); }
    });
    // Adăugăm pipeline temporar
    clockwork._pipelines.set('TEST_FAULT_TRAIN', ['AdaptiveModule01', 'FaultyGear', 'AdaptiveModule02']);

    const res = await clockwork.runChain('TEST_FAULT_TRAIN', { text: 'Resilience test' });
    assert.equal(res.ok, true);
    assert.equal(res.escapementSteps, 3);
    const faultyStep = res.trace.find((s) => s.module === 'FaultyGear');
    assert.ok(faultyStep);
    assert.equal(faultyStep.ok, false);
    assert.equal(faultyStep.absorbedByTourbillon, true);

    // Verificăm că pasul 3 (AdaptiveModule02) s-a executat totuși cu succes
    const step3 = res.trace.find((s) => s.module === 'AdaptiveModule02');
    assert.ok(step3);
    assert.equal(step3.ok, true);

    // Curățenie
    clockwork._pipelines.delete('TEST_FAULT_TRAIN');
    clockwork._workers.delete('FaultyGear');
  });

  // 10. Verificare integrare pool.runChain
  await test('pool.runChain exposes seamless clockwork execution', async () => {
    assert.ok(typeof pool.runChain === 'function');
    const res = await pool.runChain('COMMERCE_CHECKOUT', { basePrice: 50 });
    assert.equal(res.ok, true);
  });

  console.log(`\n🎉 ALL ${passed} SWISS CLOCKWORK TESTS PASSED WITH 100% SUCCESS!`);
  console.log('🇨🇭 Mechanism State: Calibrated, Synchronized, Zero Defects.\n');
  process.exit(0);
}

runAll().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
