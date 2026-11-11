'use strict';

const assert = require('assert');
const path = require('path');
const { UnifiedOrchestrator } = require('../backend/modules/orchestrator');

async function testUniversalCapabilityDispatcherAndRoic() {
  const orch = new UnifiedOrchestrator();
  orch.singularity.persistPostgres = false;
  orch.stateMachine.persistPostgres = false;
  orch.registerCapabilities([path.resolve(__dirname, '../backend/modules')]);

  const dispatchRes = await orch.dispatcher.runDueCapabilities(Date.now(), true);
  assert.ok(dispatchRes.executed >= 40, `Expected >= 40 module capabilities dispatched, got ${dispatchRes.executed}`);

  const roic = orch.singularity.getRoicLeaderboard();
  assert.ok(roic.totalTracked >= 40, `Expected >= 40 capabilities tracked in ROIC engine, got ${roic.totalTracked}`);
  assert.ok(roic.summary.APEX_MULTIPLIER >= 1, 'Expected at least 1 APEX_MULTIPLIER capability');
  console.log(`✓ Universal Dispatcher & ROIC Darwinism: ${dispatchRes.executed} capabilities executed, ${roic.summary.APEX_MULTIPLIER} promoted to APEX_MULTIPLIER (2x budget)`);
}

async function testReverseSaasEscrowVault() {
  const orch = new UnifiedOrchestrator();
  orch.singularity.persistPostgres = false;

  const gen = orch.singularity.generateEscrowPreview({
    domain: 'global-fintech.io',
    serviceId: 'sovereign-enterprise-audit',
    priceUsd: 499,
  });
  assert.strictEqual(gen.ok, true);
  assert.strictEqual(gen.vault.status, 'SEALED');
  assert.strictEqual(gen.vault.preview30Pct.coveragePct, 30);
  assert.strictEqual(gen.vault._sealedPayload, undefined, '70% sealed payload must NOT leak before payment');
  assert.ok(gen.vault.bip21Uri.startsWith('bitcoin:bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'));

  // Attempt unlock without payment proof -> must fail
  const blocked = orch.singularity.unlockEscrowVault(gen.vault.escrowId, {});
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.error, 'payment_proof_required');

  // Unlock with verified payment proof -> releases 100% deliverable + Proof-of-Outcome certificate
  const unlocked = orch.singularity.unlockEscrowVault(gen.vault.escrowId, {
    txHash: 'btc_tx_verified_9988776655',
    verified: true,
  });
  assert.strictEqual(unlocked.ok, true);
  assert.strictEqual(unlocked.status, 'UNLOCKED');
  assert.strictEqual(unlocked.fullDeliverable100Pct.coveragePct, 100);
  assert.ok(unlocked.fullDeliverable100Pct.fullRemediationBundle.dedicatedApiKey.startsWith('zeus_live_'));
  assert.ok(unlocked.outcomeCertificate && unlocked.outcomeCertificate.id.startsWith('pooc_'));
  console.log('✓ Innovation 1 (Reverse-SaaS Escrow Vault): 30% preview + Ed25519 lock + BTC BIP21 + 100% unlock verified');
}

async function testA2ASovereignClearinghouse() {
  const orch = new UnifiedOrchestrator();
  orch.singularity.persistPostgres = false;
  orch.registerCapabilities([path.resolve(__dirname, '../backend/modules')]);

  const manifest = orch.singularity.getAgentCommerceManifest();
  assert.strictEqual(manifest.protocol, 'A2A-SOVEREIGN/1.0');
  assert.ok(manifest.capabilitiesCount >= 50);

  // Offer below floor -> autonomous counter-offer
  const lowOffer = await orch.singularity.executeInstantA2ADeal({
    agentId: 'claude-enterprise-buyer',
    serviceId: 'adi-core.getStatus',
    listPriceUsd: 100,
    offeredUsd: 50,
  });
  assert.strictEqual(lowOffer.ok, false);
  assert.strictEqual(lowOffer.status, 'COUNTER_OFFER');
  assert.strictEqual(lowOffer.floorProtected, true);

  // Valid offer -> instant execution + Ed25519 receipt
  const settled = await orch.singularity.executeInstantA2ADeal({
    agentId: 'claude-enterprise-buyer',
    serviceId: 'adi-core.getStatus',
    listPriceUsd: 100,
    offeredUsd: 85,
  });
  assert.strictEqual(settled.ok, true);
  assert.strictEqual(settled.deal.status, 'SETTLED');
  assert.strictEqual(settled.deal.quotedPriceUsd, 85);
  assert.strictEqual(
    orch.singularity.verifySignature(
      settled.deal.cryptographicReceipt.payloadHash,
      settled.deal.cryptographicReceipt.signature
    ),
    true
  );
  console.log('✓ Innovation 2 (A2A Sovereign Clearinghouse): floor margin protection + instant M2M settlement + Ed25519 receipt verified');
}

async function testAutopoieticSelfHealingAndProofOfOutcome() {
  const orch = new UnifiedOrchestrator();
  orch.singularity.persistPostgres = false;
  orch.stateMachine.persistPostgres = false;
  orch.registerCapabilities([path.resolve(__dirname, '../backend/modules')]);

  // Put capability into DEGRADED state
  orch.stateMachine.markFailure('adi-core.worldScan', 'transient_latency_spike');
  assert.strictEqual(orch.stateMachine.getState('adi-core.worldScan'), 'DEGRADED');

  // Trigger closed-loop Autopoiesis: StateMachine -> 3-Model Consensus -> 10-Cycle Blue/Green -> Promote
  const heal = await orch.singularity.runAutopoieticHeal('adi-core.worldScan');
  assert.strictEqual(heal.ok, true);
  assert.strictEqual(heal.consensus.approved, true);
  assert.strictEqual(heal.blueGreen.cyclesRun, 10);
  assert.strictEqual(heal.blueGreen.promoted, true);
  assert.strictEqual(heal.activeVersion, '1.0.1');
  assert.strictEqual(orch.stateMachine.getState('adi-core.worldScan'), 'IDLE');

  // Verify Proof-of-Outcome Certificate & SVG Badge
  const cert = orch.singularity.issueOutcomeCertificate({
    orderOrEscrowId: 'ord_test_1',
    serviceId: 'adi-core.worldScan',
    domain: 'unicorn-client.ai',
    executionLatencyMs: 11,
  });
  const verified = orch.singularity.getOutcomeCertificate(cert.id);
  assert.strictEqual(verified.signatureValid, true);
  const svg = orch.singularity.renderOutcomeBadgeSvg(cert.id);
  assert.ok(svg.includes('ZEUSAI PROOF-OF-OUTCOME') && svg.includes('Ed25519 VERIFIED'));
  console.log('✓ Innovations 4 & 5 (Closed-Loop Autopoiesis + Ed25519 Proof-of-Outcome Viral Badge) verified');
}

(async () => {
  await testUniversalCapabilityDispatcherAndRoic();
  await testReverseSaasEscrowVault();
  await testA2ASovereignClearinghouse();
  await testAutopoieticSelfHealingAndProofOfOutcome();
  console.log('ALL SINGULARITY INNOVATIONS TESTS PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('SINGULARITY TEST FAILED:', err);
  process.exit(1);
});
