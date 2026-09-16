'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_DATA_DIR = require('os').tmpdir() + '/mpc-' + process.pid + '-' + Date.now();
process.env.COMMERCE_DATA_DIR = process.env.UNICORN_DATA_DIR + '/commerce';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete require.cache[require.resolve('../src/commerce/money-pack-continuum')];
const mpc = require('../src/commerce/money-pack-continuum');
mpc._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('discovery advertises MPC/1.0 without fake GMV', () => {
  const d = mpc.discovery();
  assert.equal(d.protocol, 'MPC/1.0');
  assert.ok(d.honesty.includes('Never invents'));
  assert.ok(!/fake.?gmv|invented/i.test(JSON.stringify(d)));
});

check('enrichOrderStatus is n/a until paid', () => {
  const st = mpc.enrichOrderStatus({ orderId: 'ord_x', status: 'pending' });
  assert.equal(st.fulfillmentStatus, 'n/a');
  assert.equal(st.deliveryReady, false);
});

check('paid order without registry row is queued/generating', () => {
  const st = mpc.enrichOrderStatus({ orderId: 'ord_missing_' + Date.now(), status: 'paid' });
  assert.equal(st.fulfillmentStatus, 'queued');
  assert.equal(st.packGenerating, true);
  assert.equal(st.deliveryReady, false);
});

check('deliveryHref appends access_token', () => {
  const href = mpc.deliveryHref('ord_abc', 't_secret');
  assert.ok(href.includes('/api/delivery/ord_abc'));
  assert.ok(href.includes('access_token=t_secret'));
});

check('recoverPaidUndelivered fires once then skips', () => {
  const fired = [];
  const orders = [{
    orderId: 'ord_retry_1',
    status: 'paid',
    paid_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  }];
  const a = mpc.recoverPaidUndelivered(orders, (o) => fired.push(o.orderId), { minAgeMs: 1000 });
  assert.equal(a.retried, 1);
  const b = mpc.recoverPaidUndelivered(orders, (o) => fired.push(o.orderId), { minAgeMs: 1000 });
  assert.equal(b.retried, 0);
  assert.deepEqual(fired, ['ord_retry_1']);
});

check('custom order is a virtual SKU', () => {
  const upr = require('../src/commerce/universal-payment-rails');
  assert.equal(upr.isVirtualSku('custom'), true);
  assert.equal(upr.parseVirtualSku('custom').prefix, 'custom');
  const buy = upr.assessVirtualBuyability('custom');
  assert.equal(buy.buyable, true);
  assert.equal(buy.reason, 'custom_invoice');
});

check('invoice poll keeps asking until pack ready', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/site/sovereign-commerce.js'), 'utf8');
  assert.ok(src.includes('id="packStatus"'));
  assert.ok(src.includes('if(j.deliveryReady) return'));
  assert.ok(src.includes('money-pack-continuum'));
});

console.log('\n✅ money-pack-continuum:', passed, 'tests passed');
process.exit(0);
