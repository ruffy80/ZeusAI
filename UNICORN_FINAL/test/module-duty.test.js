'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const duty = require('../src/commerce/module-duty');
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

check('customer files exist and organs stay off that list', () => {
  const listed = duty.sheet();
  assert.strictEqual(listed.protocol, 'MDT/1.0');
  assert.strictEqual(listed.inventsServices, false);
  assert.strictEqual(listed.customerDelivery, 'public-shelf');
  assert.ok(listed.customer.length >= 8);
  for (const row of listed.customer) assert.strictEqual(row.present, true, row.path);
  const paths = listed.customer.map((row) => row.path);
  assert.ok(paths.indexOf('src/commerce/public-shelf.js') !== -1);
  assert.ok(paths.indexOf('src/site/v2/fulfillment-engine.js') !== -1);
  assert.ok(paths.indexOf('backend/modules/fulfillment-ai-os.js') !== -1);
  assert.strictEqual(duty.judge('backend/modules/integrated-autonomy-kernel.js').duty, 'unicorn');
  assert.strictEqual(duty.judge('backend/modules/module-census-os.js').role, null);
  assert.strictEqual(duty.judge('backend/modules/serviceMarketplace.js').duty, 'unicorn');
  assert.strictEqual(duty.judge('backend/modules/dynamic-pricing.js').role, 'support');
  assert.strictEqual(duty.judge('backend/modules/aiProviders.js').role, 'support');
  assert.strictEqual(duty.judge('src/commerce/public-shelf.js').role, 'offer');
});

check('census marks only the named delivery module as customer duty', () => {
  census.clearCache();
  const sheet = census.discovery();
  const files = sheet.modules.filter((row) => row.kind === 'file' || row.kind === 'alias');
  const customer = files.filter((row) => row.duty === 'customer');
  assert.strictEqual(sheet.customerDutyFiles, 1);
  assert.strictEqual(customer.length, 1);
  assert.strictEqual(customer[0].id, 'fulfillment-ai-os');
  assert.strictEqual(customer[0].customerRole, 'file');
  assert.strictEqual(sheet.unicornFiles + sheet.customerDutyFiles, files.length);
  assert.ok(sheet.unicornFiles > 600);
  for (const row of sheet.modules) {
    assert.strictEqual(row.deliversCustomer, false, row.id);
    assert.strictEqual(row.effectIsCustomerDelivery, false, row.id);
    assert.ok(row.duty === 'unicorn' || row.duty === 'customer', row.id);
  }
  const pool = sheet.modules.find((row) => row.id === 'EnginePool#1');
  assert.strictEqual(pool.duty, 'unicorn');
  assert.strictEqual(pool.customerRole, null);
});

check('the duty sheet counts shelf offers separately from module files', () => {
  const report = duty.status();
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.modulesAdvertiseCustomerDelivery, false);
  assert.ok(report.unicornFiles > 600);
  assert.strictEqual(report.customerDutyFiles, 1);
  assert.ok(report.customerFiles > report.customerDutyFiles);
  assert.strictEqual(report.shelf.ok, true);
  assert.ok(report.shelf.offers >= 20);
  assert.strictEqual(report.shelf.delivering, report.shelf.offers);
  assert.strictEqual(report.shelf.kickoffOk, true);
});

check('both servers and the census page publish the split', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const site = read('src/index.js');
  assert.ok(site.includes("urlPath === '/api/module-duty'"));
  assert.ok(site.includes("require('./commerce/module-duty')"));
  const backend = read('backend/index.js');
  assert.ok(backend.includes("app.get('/api/module-duty'"));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('Creates or delivers a customer service'));
  assert.ok(shell.includes('Every other module file works for Unicorn'));
  assert.ok(shell.includes('A file name is not a customer delivery'));
  const pkg = JSON.parse(read('package.json'));
  const keys = Object.keys(pkg.scripts).filter((key) => key === 'test:chain');
  assert.strictEqual(keys.length, 1);
  assert.ok(String(pkg.scripts['test:chain']).includes('module-duty.test.js'));
});

console.log(`\n✅ module-duty: ${passed} tests passed`);
process.exit(0);
