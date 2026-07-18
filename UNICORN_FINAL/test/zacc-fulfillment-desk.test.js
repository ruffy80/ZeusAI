'use strict';
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.ZACC_CJ_API_KEY;

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const deskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zacc-desk-'));
process.env.ZACC_FULFILL_DIR = deskDir;

const { FulfillmentRouter } = require('../backend/modules/zacc/fulfillment');
const pubSrc = fs.readFileSync(path.join(__dirname, '../backend/modules/zacc/publisher.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
const armSrc = fs.readFileSync(path.join(__dirname, '../scripts/arm-zacc-cj-key.sh'), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

check('desk queues without CJ key and persists', async () => {
  const fr = new FulfillmentRouter({});
  const r = await fr.onOrder({
    productId: 'dropship-test',
    productTitle: 'Test Bed',
    amountUsd: 99,
    email: 'buyer@example.com',
    shipping: { name: 'A', address: '1 St', country: 'US' },
    qty: 1,
    supplierRef: 'dummyjson:1',
    demoOnly: false,
  });
  assert.ok(r.ok);
  assert.equal(r.order.result.provider, 'zeus-fulfillment-desk');
  assert.equal(fr.pendingOrders.length, 1);
  assert.ok(fs.existsSync(path.join(deskDir, 'fulfillment-desk.json')), 'desk file written');
  const ready = fr.readiness();
  assert.equal(ready.mode, 'zeus-fulfillment-desk');
  assert.equal(ready.cjConfigured, false);
  assert.ok(ready.howToGetCjKey && ready.howToGetCjKey.steps.length >= 3);
});

check('publisher uses zeus-fulfillment-desk without CJ', () => {
  assert.ok(pubSrc.includes('zeus-fulfillment-desk'));
  assert.ok(pubSrc.includes('cj-global-dropship'));
});

check('arm API + readiness routes exist', () => {
  assert.ok(idxSrc.includes("/api/dropship/fulfillment/readiness"));
  assert.ok(idxSrc.includes("/api/dropship/fulfillment/arm-cj"));
  assert.ok(idxSrc.includes('reprocessPending'));
});

check('arm script refuses placeholders and supports --remote', () => {
  assert.ok(armSrc.includes('placeholder'));
  assert.ok(armSrc.includes('--remote'));
  assert.ok(armSrc.includes('ZACC_CJ_API_KEY'));
});

check('reprocess no-ops without CJ', async () => {
  const fr = new FulfillmentRouter({});
  const re = await fr.reprocessPending();
  assert.equal(re.reason, 'cj_not_configured');
});

console.log('\n✅ zacc-fulfillment-desk: tests passed');
