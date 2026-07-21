// =====================================================================
// funnel-delivered.test.js — Buy→paid→delivered funnel truth chain
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.FUNNEL_INTEL_FILE = require('os').tmpdir() + '/funnel-delivered-' + process.pid + '.json';

const assert = require('assert');

delete require.cache[require.resolve('../backend/modules/funnel-intelligence')];
const funnel = require('../backend/modules/funnel-intelligence');
funnel._resetForTests();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('records paid and delivered stages', () => {
  assert.ok(funnel.record({ event: 'checkout_paid', serviceId: 'sku-a', value: 49, sessionId: 's1' }).ok);
  assert.ok(funnel.record({ event: 'delivered', serviceId: 'sku-a', sessionId: 's1' }).ok);
  const s = funnel.summary();
  assert.ok(s.ok);
  assert.equal(s.windows.today.paid, 1);
  assert.equal(s.windows.today.delivered, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(s.conversion30d, 'paidToDelivered'));
  assert.equal(s.conversion30d.paidToDelivered, 1);
});

check('product yield includes paidToDelivered', () => {
  const rows = funnel.productYield(5);
  const row = rows.find((r) => r.id === 'sku-a');
  assert.ok(row);
  assert.equal(row.delivered, 1);
  assert.equal(row.paidToDelivered, 1);
});

check('unknown stage rejected', () => {
  const r = funnel.record({ event: 'not_a_real_stage' });
  assert.equal(r.ok, false);
});

console.log('\n✅ funnel-delivered:', passed, 'tests passed');
process.exit(0);
