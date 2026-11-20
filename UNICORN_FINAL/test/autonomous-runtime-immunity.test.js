'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const asri = require('../backend/modules/autonomous-runtime-immunity');
const btcVerifier = require('../backend/modules/btcPaymentVerifier');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

check('ASRI/1.0 auditSupplyChain returns deterministic SBOM Merkle root with zero drift', () => {
  const a1 = asri.auditSupplyChain();
  const a2 = asri.auditSupplyChain();
  assert.strictEqual(a1.ok, true);
  assert.strictEqual(a1.protocol, 'ASRI/1.0');
  assert.strictEqual(a1.tamperDetected, false);
  assert.strictEqual(a1.posture, 'HARDENED_ZERO_DRIFT');
  assert.strictEqual(a1.enginesContract.compliant, true);
  assert.ok(/^[0-9a-f]{64}$/.test(a1.sbom.sbomMerkleRoot), 'SBOM Merkle root must be 64-hex SHA-256');
  assert.strictEqual(a1.sbom.sbomMerkleRoot, a2.sbom.sbomMerkleRoot, 'Merkle root must be deterministic');
  assert.ok(a1.sbom.directDependencies > 20, 'must count direct dependencies');
  assert.ok(a1.sbom.lockfileResolvedPackages > 100, 'must count lockfile resolved packages');
});

check('ASRI/1.0 sampleRuntimeTelemetry reports V8 heap limit & event-loop percentiles', () => {
  const t = asri.sampleRuntimeTelemetry();
  assert.ok(t.v8Heap.limitMB > t.v8Heap.usedMB, 'V8 heap_size_limit must exceed used heap');
  assert.ok(t.v8Heap.utilizationOfLimitPct > 0 && t.v8Heap.utilizationOfLimitPct < 90, 'real V8 heap utilization should be healthy');
  assert.strictEqual(typeof t.eventLoop.p99Ms, 'number');
  assert.ok(t.host.cpuCores >= 1);
  assert.ok(t.host.ramTotalMB > 0);
});

check('ASRI/1.0 stabilizeRuntime honors Golden Rule #6 (cooperative only, never kills)', () => {
  const normal = asri.stabilizeRuntime({ force: false });
  assert.strictEqual(normal.ok, true);
  const forced = asri.stabilizeRuntime({ force: true });
  assert.strictEqual(forced.ok, true);
  assert.strictEqual(forced.stabilized, true);
  assert.ok(forced.receipt && forced.receipt.id.startsWith('asri_heal_'));
  assert.ok(forced.receipt.triggers.includes('operator_requested_heal'));
});

check('ASRI/1.0 Ed25519 immunity certificate signs & verifies cleanly, and rejects tampering', () => {
  const cert = asri.getImmunityCertificate();
  assert.strictEqual(cert.ok, true);
  assert.strictEqual(cert.attestation.algorithm, 'Ed25519');
  assert.ok(cert.attestation.signatureBase64 && cert.attestation.publicKeyPem);
  const verified = asri.verifyCertificate(cert);
  assert.strictEqual(verified.valid, true, 'fresh Ed25519 certificate must verify');

  // Tamper test
  const tampered = JSON.parse(JSON.stringify(cert));
  tampered.payload.immunityScore.total = 999;
  const tamperedCheck = asri.verifyCertificate(tampered);
  assert.strictEqual(tamperedCheck.valid, false, 'tampered certificate must be rejected');
});

check('ASRI/1.0 rail probe & revenue friction tracking updates immunity telemetry honestly', () => {
  const r = asri.recordRailProbe('btc-mempool-primary', { ok: true, latencyMs: 42 });
  assert.strictEqual(r.reliabilityPct, 100);
  const f = asri.recordFriction({ route: '/api/checkout/create', statusCode: 502, latencyMs: 1200, category: 'checkout', detail: 'simulated-drill' });
  assert.strictEqual(f.remediation, 'failover-alt-payment-rail-ready');
  const h = asri.health();
  assert.strictEqual(h.ok, true);
  assert.ok(h.score >= 70 && h.score <= 100);
});

check('btcPaymentVerifier exposes multi-provider failover status cleanly', () => {
  const v = btcVerifier.createPaymentVerifier();
  const st = v.getStatus();
  assert.ok(st.stats && typeof st.stats.providerFailovers === 'number');
  assert.ok(typeof st.stats.activeProvider === 'string' && st.stats.activeProvider.startsWith('https://'));
});

console.log(`autonomous-runtime-immunity.test.js: ${passed} passed ✓`);
process.exit(0);
