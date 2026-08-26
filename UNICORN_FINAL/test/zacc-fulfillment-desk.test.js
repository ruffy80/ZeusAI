'use strict';
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.ZACC_CJ_API_KEY;
delete process.env.CJ_API_KEY;
delete process.env.PRINTFUL_API_TOKEN;
delete process.env.PRINTIFY_API_TOKEN;
delete process.env.PRINTIFY_SHOP_ID;
delete process.env.ZACC_FULFILL_WEBHOOK_URL;

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

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('✓', name);
}

(async () => {
  await check('desk queues without CJ key and persists', async () => {
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
    assert.equal(ready.protocol, 'USCF/1.0');
    assert.ok(ready.howToGetCjKey && ready.howToGetCjKey.steps.length >= 3);
  });

  await check('publisher uses zeus-fulfillment-desk without CJ', () => {
    assert.ok(pubSrc.includes('zeus-fulfillment-desk'));
    assert.ok(pubSrc.includes('cj-global-dropship') || pubSrc.includes('evaluateSku'));
  });

  await check('arm API + readiness routes exist', () => {
    assert.ok(idxSrc.includes('/api/dropship/fulfillment/readiness'));
    assert.ok(idxSrc.includes('/api/dropship/fulfillment/arm-cj'));
    assert.ok(idxSrc.includes('/api/dropship/suppliers'));
    assert.ok(idxSrc.includes('/api/dropship/suppliers/arm'));
    assert.ok(idxSrc.includes('reprocessPending'));
  });

  await check('arm script refuses placeholders and supports --remote', () => {
    assert.ok(armSrc.includes('placeholder'));
    assert.ok(armSrc.includes('--remote'));
    assert.ok(armSrc.includes('ZACC_CJ_API_KEY'));
  });

  await check('reprocess no-ops without supplier keys', async () => {
    const fr = new FulfillmentRouter({});
    const re = await fr.reprocessPending();
    assert.ok(
      re.reason === 'no_supplier_configured' || re.reason === 'cj_not_configured',
      'expected no-supplier reason, got ' + re.reason
    );
    assert.equal(re.retried, 0);
  });

  console.log('\n✅ zacc-fulfillment-desk: ' + passed + ' tests passed');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
