'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-delivery-'));
process.env.ZEUS_DELIVERY_DIR = dir;

const delivery = require('../backend/modules/paid-delivery');

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

check('mock payment writes a marked delivery file and no second copy', () => {
  const first = delivery.writePaidDelivery({
    id: 'mock-chain-check',
    service: 'website-audit',
    customerEmail: 'test@example.com',
    amountBtc: '0.00000000',
    txid: 'simulated-drill',
    mock: true,
  }, { licenseId: 'lic_test', apiKey: 'zk_secret' });
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.mock, true);
  const raw = fs.readFileSync(first.file, 'utf8');
  const body = JSON.parse(raw);
  assert.strictEqual(body.mock, true);
  assert.strictEqual(body.status, 'delivered');
  assert.ok(raw.indexOf('zk_secret') < 0);
  assert.ok(body.note.indexOf('MOCK') === 0);
  const second = delivery.writePaidDelivery({ id: 'mock-chain-check', txid: 'simulated-drill', mock: true });
  assert.strictEqual(second.already, true);
});

check('order route accepts productId and the module list stays off public health', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(src.includes('body.productId'));
  assert.ok(src.includes('body.userEmail'));
  assert.ok(src.includes('app.get(\'/api/user/status/:email\''));
  assert.ok(src.includes('paid-delivery'));
  const fullStart = src.indexOf('function buildHealthResponse');
  const pubStart = src.indexOf('function _composePublicHealthBody');
  const full = src.slice(fullStart, pubStart);
  const pub = src.slice(pubStart, src.indexOf('function _refreshPublicHealthCache'));
  assert.ok(full.includes('modulesLoaded'), 'admin health still knows which modules loaded');
  assert.ok(!pub.includes('registryModules'), 'public health must not publish the registry');
  assert.ok(!pub.includes('modules:'), 'public health must not publish the module list');
});

console.log(passed + ' passed');
