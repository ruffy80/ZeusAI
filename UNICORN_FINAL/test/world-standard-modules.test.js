'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.INNOVATION_AUTO_SHIP = '1';
delete process.env.ETH_WALLET_ADDRESS;
delete process.env.USDC_WALLET_ADDRESS;
delete process.env.ETH_RECEIVE_ADDRESS;
delete process.env.BANK_TRANSFER_ENABLED;
delete process.env.BANK_ACCOUNT_IBAN;
delete process.env.BANK_ACCOUNT_NUMBER;
delete process.env.BANK_ROUTING_NUMBER;
delete process.env.BANK_BENEFICIARY;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'world-standard-modules-'));
process.env.WACP_DATA_DIR = path.join(tmpRoot, 'wacp');
process.env.POD_LEDGER_PATH = path.join(tmpRoot, 'ledgers', 'proof-of-delivery.jsonl');
process.env.INNOVATION_SHIPPED_DIR = path.join(tmpRoot, 'innovations', 'shipped');
process.env.MEMORY_SOFT_LIMIT_MB = '64';

const wacp = require('../backend/modules/world-ai-commerce-protocol');
const truthLayer = require('../backend/modules/conversion-truth-layer');
const deliveryLedger = require('../backend/modules/proof-of-delivery-ledger');
const innovationShipGate = require('../backend/modules/innovation-ship-gate');
const memoryPressureGuardian = require('../backend/modules/memory-pressure-guardian');

let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ✓', name);
}

async function run() {
  wacp._resetForTests();
  truthLayer._resetForTests();
  deliveryLedger._resetForTests();
  innovationShipGate._resetForTests();
  memoryPressureGuardian._resetForTests();

  console.log('World standard modules');

  await check('WACP builds catalog and order examples on disk', async () => {
    const catalog = wacp.toWacpCatalog([
      { id: 'seo-audit', title: 'SEO Audit', priceUsd: 199, category: 'seo', deliveryKind: 'report' },
      { id: 'checkout-fix', title: 'Checkout Recovery', priceUsd: 299, category: 'commerce', deliveryKind: 'service' },
    ]);
    const order = wacp.buildOrderEnvelope({
      orderId: 'ord-100',
      buyerEmail: 'buyer@example.com',
      items: [{ serviceId: 'seo-audit', title: 'SEO Audit', qty: 2, unitPriceUsd: 199 }],
      totalUsd: 398,
    });
    assert.strictEqual(catalog.protocol, 'WACP/1.0');
    assert.strictEqual(catalog.itemCount, 2);
    assert.strictEqual(order.type, 'order');
    assert.strictEqual(order.payload.totals.totalUsd, 398);
    assert.ok(fs.existsSync(path.join(process.env.WACP_DATA_DIR, 'catalog-example.json')));
    assert.ok(fs.existsSync(path.join(process.env.WACP_DATA_DIR, 'order-envelope-example.json')));
  });

  await check('WACP attests and verifies delivery envelopes', async () => {
    const artifactHashes = [
      crypto.createHash('sha256').update('artifact-a').digest('hex'),
      crypto.createHash('sha256').update('artifact-b').digest('hex'),
    ];
    const envelope = await wacp.attestDelivery({
      orderId: 'ord-100',
      deliveryId: 'del-100',
      buyerEmail: 'buyer@example.com',
      artifactHashes,
      proofUri: 'ipfs://delivery-proof-100',
    });
    const verification = wacp.verifyEnvelope(envelope);
    assert.strictEqual(envelope.type, 'delivery-attestation');
    assert.strictEqual(verification.ok, true);
    assert.strictEqual(verification.signature.ok, true);
    assert.ok(fs.existsSync(path.join(process.env.WACP_DATA_DIR, 'delivery-attestation-example.json')));
  });

  await check('conversion truth layer zeroes simulated claims and strips unavailable methods', async () => {
    const sanitized = truthLayer.sanitizePublicMetrics({
      simulated: false,
      projectedRevenue: 9000,
      metrics: { estimatedRevenueUsd: 4000 },
      paymentMethods: [{ id: 'crypto_btc' }, { id: 'crypto_eth' }, { id: 'bank' }],
      supportedPaymentMethods: ['crypto_btc', 'crypto_eth', 'bank'],
    });
    assert.strictEqual(sanitized.projectedRevenue, 0);
    assert.strictEqual(sanitized.metrics.estimatedRevenueUsd, 0);
    assert.deepStrictEqual(sanitized.paymentMethods.map((item) => item.id), ['crypto_btc']);
    assert.deepStrictEqual(sanitized.supportedPaymentMethods, ['crypto_btc']);
  });

  await check('conversion truth layer flags dishonest revenue overclaims', async () => {
    const audit = truthLayer.assertRevenueHonesty({
      simulated: false,
      realRevenueUsd: 120,
      revenueUsd: 180,
      realPaidOrders: 1,
      paidOrders: 3,
      forecastRevenue: 500,
      methods: ['crypto_btc', 'crypto_eth'],
    });
    assert.strictEqual(audit.ok, false);
    assert.ok(audit.violations.some((item) => item.code === 'revenue_overclaim'));
    assert.ok(audit.violations.some((item) => item.code === 'paid_orders_overclaim'));
    assert.ok(audit.violations.some((item) => item.code === 'unsupported_payment_method'));
  });

  await check('proof-of-delivery ledger records entries and verifies chain integrity', async () => {
    const one = deliveryLedger.recordDelivery({
      orderId: 'ord-200',
      deliveryId: 'del-200',
      artifactHashes: ['hash-a', 'hash-b'],
      buyerEmailHash: 'buyer@example.com',
    });
    const two = deliveryLedger.recordDelivery({
      orderId: 'ord-201',
      deliveryId: 'del-201',
      artifactHashes: ['hash-c'],
      buyerEmailHash: one.buyerEmailHash,
    });
    const listed = deliveryLedger.list(2);
    const verified = deliveryLedger.verifyChain();
    assert.strictEqual(listed.length, 2);
    assert.strictEqual(listed[0].deliveryId, 'del-201');
    assert.strictEqual(two.prevHash, one.entryHash);
    assert.strictEqual(verified.ok, true);
  });

  await check('innovation ship gate approves safe high-score ideas and writes actionable artifacts', async () => {
    const pending = [
      {
        id: 'safe-1',
        title: 'Catalog trust checkout delivery upgrade',
        description: 'Improve commerce checkout trust with catalog docs and delivery proof manifests',
        targetPaths: ['data/catalog/safe-1.json', 'docs/catalog/safe-1.md'],
      },
      {
        id: 'unsafe-1',
        title: 'Rewrite backend checkout module',
        description: 'Mutate backend/modules checkout source directly',
        targetPaths: ['backend/modules/checkout.js'],
      },
      {
        id: 'mid-1',
        title: 'Minor generic housekeeping',
        description: 'General cleanup with no commerce signal',
        targetPaths: ['docs/notes/mid-1.md'],
      },
    ];
    const approvedIds = [];
    const rejectedIds = [];
    const api = {
      getPending: () => pending.slice(),
      approve: (id) => { approvedIds.push(id); return { ok: true, id }; },
      reject: (id) => { rejectedIds.push(id); return { ok: true, id }; },
    };

    const cycle = await innovationShipGate.evaluateAndShip(api);
    const artifactPath = path.join(process.env.INNOVATION_SHIPPED_DIR, 'safe-1.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    assert.strictEqual(cycle.ok, true);
    assert.deepStrictEqual(approvedIds, ['safe-1']);
    assert.ok(rejectedIds.includes('unsafe-1'));
    assert.strictEqual(artifact.safeScope, 'catalog/docs/data only');
    assert.ok(Array.isArray(artifact.tasks) && artifact.tasks.length >= 3);
  });

  await check('memory pressure guardian clears caches and triggers gc under pressure', async () => {
    memoryPressureGuardian._resetForTests();
    let clearerCalls = 0;
    let gcCalls = 0;
    const previousGc = global.gc;
    global.gc = () => { gcCalls += 1; };
    memoryPressureGuardian.registerCacheClearer('test-cache', () => {
      clearerCalls += 1;
      return { cleared: true };
    });
    memoryPressureGuardian._setMemorySampler(() => ({
      heapUsed: 96 * 1024 * 1024,
      heapTotal: 128 * 1024 * 1024,
      rss: 160 * 1024 * 1024,
    }));
    const status = memoryPressureGuardian.check();
    const started = memoryPressureGuardian.start();
    memoryPressureGuardian.stop();
    global.gc = previousGc;

    assert.strictEqual(status.overLimit, true);
    assert.strictEqual(status.gcTriggered, true);
    assert.strictEqual(clearerCalls, 1);
    assert.strictEqual(gcCalls, 1);
    assert.strictEqual(started.ok, true);
  });

  await check('module process/getStatus contracts remain executable', async () => {
    const wacpOut = await wacp.process({ action: 'catalog', items: [{ id: 'trust-pack', title: 'Trust Pack', priceUsd: 49 }] });
    const truthOut = await truthLayer.process({ action: 'assert', report: { simulated: false, realRevenueUsd: 10, revenueUsd: 10 } });
    const ledgerOut = await deliveryLedger.process({
      action: 'record',
      payload: { orderId: 'ord-300', deliveryId: 'del-300', artifactHashes: ['x'], buyerEmailHash: 'buyer@example.com' },
    });
    const gateOut = await innovationShipGate.process({
      action: 'cycle',
      innovatorApi: { getPending: () => [], approve: () => ({ ok: true }), reject: () => ({ ok: true }) },
    });
    const memOut = await memoryPressureGuardian.process({ action: 'check' });

    assert.strictEqual(wacpOut.ok, true);
    assert.strictEqual(truthOut.ok, true);
    assert.strictEqual(ledgerOut.ok, true);
    assert.strictEqual(gateOut.ok, true);
    assert.strictEqual(memOut.ok, true);
    assert.strictEqual(wacp.getStatus().module, 'world-ai-commerce-protocol');
    assert.strictEqual(truthLayer.getStatus().module, 'conversion-truth-layer');
    assert.strictEqual(deliveryLedger.getStatus().module, 'proof-of-delivery-ledger');
    assert.strictEqual(innovationShipGate.getStatus().module, 'innovation-ship-gate');
    assert.strictEqual(memoryPressureGuardian.getStatus().module, 'memory-pressure-guardian');
  });

  console.log(`\n✅ world-standard-modules: ${passed} tests passed\n`);
}

run().then(() => process.exit(0)).catch((error) => {
  console.error('❌ world-standard-modules.test.js failed:', error);
  process.exit(1);
});
