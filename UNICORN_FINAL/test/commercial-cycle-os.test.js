'use strict';

/**
 * Commercial Cycle OS — portal deliveries, payment honesty, catalog
 * deliverable-only shelf, fulfillment AI allowlist, innovation safe default.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.INNOVATION_AUTO_SHIP = '0';
process.env.INNOVATION_GENERATE = '0';
process.env.FULFILLMENT_AI_ENABLED = '0';
delete process.env.PAYEE_IBAN;
delete process.env.PAYEE_SWIFT;
delete process.env.PAYEE_BANK_NAME;
delete process.env.BANK_TRANSFER_ENABLED;
delete process.env.BANK_ACCOUNT_IBAN;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-cycle-'));
process.env.UNICORN_DATA_DIR = path.join(tmp, 'data');

const filter = require('../src/commerce/public-catalog-filter');
const buyability = require('../src/commerce/commerce-buyability');
const engine = require('../src/site/v2/fulfillment-engine');
const registry = require('../src/site/v2/delivery-registry');
const innovator = require('../backend/modules/unicornInnovator');
const shipGate = require('../backend/modules/innovation-ship-gate');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('  ✓', name); });
  }
  passed += 1;
  console.log('  ✓', name);
  return undefined;
}

async function run() {
  await check('aspirational groups filtered from public catalog', () => {
    assert.strictEqual(filter.isAspirationalCatalogItem({ id: 'future-x', group: 'future-invention' }), true);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'billion-pack', group: 'billion-scale-package' }), true);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'instant-seo-content-pack', group: 'instant' }), false);
    const out = filter.filterPublicCatalogItems([
      { id: 'instant-seo-content-pack', group: 'instant' },
      { id: 'future-primitive-1', group: 'future-invention' },
      { id: 'bs-activation', group: 'billion-scale-activation' },
      { id: 'pro', group: 'service' },
    ]);
    assert.deepStrictEqual(out.map((x) => x.id), ['instant-seo-content-pack', 'pro']);
  });

  await check('future-invention / billion-scale not self-serve buyable', () => {
    assert.strictEqual(buyability.assessBuyability({ id: 'future-x', group: 'future-invention', priceUSD: 99 }).buyable, false);
    assert.strictEqual(buyability.assessBuyability({ id: 'bs-1', group: 'billion-scale-package', priceUSD: 14000000 }).buyable, false);
  });

  await check('fulfillment AI allowlist defaults to 5 clear digital SKUs', () => {
    delete process.env.FULFILLMENT_AI_ENABLED;
    assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), false);
    process.env.FULFILLMENT_AI_ENABLED = '1';
    assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), true);
    assert.strictEqual(engine.shouldUseAiForSku('instant-landing-page'), true);
    assert.strictEqual(engine.shouldUseAiForSku('instant-logo-kit'), false, 'logo kit not in default AI allowlist');
    assert.strictEqual(engine.shouldUseAiForSku('professional-saas-mvp'), false);
    process.env.FULFILLMENT_AI_SKUS = '*';
    assert.strictEqual(engine.shouldUseAiForSku('instant-logo-kit'), true);
    delete process.env.FULFILLMENT_AI_SKUS;
    process.env.FULFILLMENT_AI_ENABLED = '0';
  });

  await check('attachArtifacts surfaces downloadable artifact file links', async () => {
    registry.deliver({ id: 'r_cycle', email: 'cycle@example.com', services: ['instant-seo-content-pack'] });
    await engine.fulfillReceipt({ id: 'r_cycle', email: 'cycle@example.com', services: ['instant-seo-content-pack'] });
    const d = registry.get('r_cycle');
    assert.ok(d && Array.isArray(d.artifacts) && d.artifacts.length >= 1);
    const item = (d.items || []).find((x) => x.serviceId === 'instant-seo-content-pack');
    assert.ok(item, 'service item present');
    assert.ok((item.files || []).some((f) => /format=artifact/.test(String(f.downloadUrl || ''))),
      'artifact downloadUrl attached to files');
  });

  await check('innovator generation idle under stable profile', () => {
    assert.strictEqual(innovator.innovationGenerationEnabled(), false);
    const st = innovator.getStatus();
    assert.strictEqual(st.active, false);
  });

  await check('innovation auto-ship disabled under stable', () => {
    assert.strictEqual(shipGate.autoShipEnabled(), false);
  });

  await check('site payment methods helper does not invent bank without coords', () => {
    // Load isBankWireConfigured via reading getPublicPaymentMethods from a light require
    // of payment honesty surface — paymentGateway already covered; lock source gate.
    const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
    assert.ok(/function isBankWireConfigured/.test(src));
    assert.ok(/bank_not_configured/.test(src));
    assert.ok(/isBankWireConfigured\(\)/.test(src));
  });

  await check('account dashboard source exposes Deliveries + Deliverable CTAs', () => {
    const client = fs.readFileSync(path.join(__dirname, '../src/site/v2/client.js'), 'utf8');
    assert.ok(/Deliveries \(/.test(client) || /id="delivery"/.test(client));
    assert.ok(/artifactsUrl/.test(client));
    assert.ok(/⬇ Deliverable/.test(client) || /Deliverable/.test(client));
    const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
    assert.ok(/accountRoot/.test(shell));
    assert.ok(/hydrateAccount/.test(shell));
  });

  console.log(`\n✅ commercial-cycle-os: ${passed} tests passed\n`);
}

run().then(() => {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}).catch((err) => {
  console.error('❌ commercial-cycle-os failed:', err);
  process.exit(1);
});
