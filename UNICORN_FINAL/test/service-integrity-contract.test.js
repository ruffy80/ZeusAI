'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const integrity = require('../src/commerce/service-integrity');
const census = require('../backend/modules/module-census-os');

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

check('every shelf offer agrees with its file and its button', () => {
  const report = integrity.audit();
  assert.strictEqual(report.protocol, 'SIO/1.0');
  assert.strictEqual(report.inventsDelivery, false);
  assert.strictEqual(report.modulesAdvertiseCustomerDelivery, false);
  assert.strictEqual(report.orchestrator, 'integrated-autonomy-kernel');
  assert.ok(report.offers >= 20);
  assert.deepStrictEqual(report.failing, []);
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.delivering, report.offers);
  assert.strictEqual(report.kickoffOk, true);
});

check('contact mode cannot open a cart', () => {
  const bad = integrity.evaluate({
    id: 'not-a-shelf-offer',
    mode: 'contact',
    clock: 'contract',
    buyable: false,
    priceUsd: 1000,
    ctaHref: '/checkout/?plan=not-a-shelf-offer',
  }, { kind: 'proposal', fileTitle: 'No checkout file' });
  assert.strictEqual(bad.pass, false);
  assert.ok(bad.failures.indexOf('contact_mode_opened_a_cart') !== -1);
});

check('a buyable offer without a checkout href fails', () => {
  const bad = integrity.evaluate({
    id: 'instant-example',
    mode: 'btc',
    clock: 'minutes',
    buyable: true,
    priceUsd: 39,
    ctaHref: '/enterprise',
  }, { kind: 'activation', fileTitle: 'Service Activation Pack' });
  assert.strictEqual(bad.pass, false);
  assert.ok(bad.failures.indexOf('buyable_without_checkout') !== -1);
});

check('an id that is not on the shelf is not a delivery', () => {
  const missing = integrity.proofFor('not-a-real-shelf-id');
  assert.strictEqual(missing.onShelf, false);
  assert.strictEqual(missing.pass, false);
  assert.deepStrictEqual(missing.failures, ['no_shelf_offer']);
});

check('module files do not advertise a customer delivery', () => {
  census.clearCache();
  const sheet = census.discovery();
  assert.strictEqual(sheet.modulesAdvertiseCustomerDelivery, false);
  assert.ok(sheet.modules.length > 600);
  for (const row of sheet.modules) {
    assert.strictEqual(row.deliversCustomer, false, row.id);
    assert.strictEqual(row.effectIsCustomerDelivery, false, row.id);
  }
  const sum = census.summary();
  assert.strictEqual(sum.modulesAdvertiseCustomerDelivery, false);
  assert.strictEqual(sum.customerDelivery, 'public-shelf');
});

check('checkout and both servers publish the contract', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const commerce = read('src/site/sovereign-commerce.js');
  assert.ok(commerce.includes("require('../commerce/service-integrity')"));
  assert.ok(commerce.includes("error: 'service_not_deliverable'"));
  const site = read('src/index.js');
  assert.ok(site.includes("urlPath === '/api/service-integrity'"));
  const backend = read('backend/index.js');
  assert.ok(backend.includes("app.get('/api/service-integrity'"));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('/api/service-integrity'));
  assert.ok(shell.includes('A file name is not a customer delivery'));
});

console.log(`\n✅ service-integrity-contract: ${passed} tests passed`);
process.exit(0);
