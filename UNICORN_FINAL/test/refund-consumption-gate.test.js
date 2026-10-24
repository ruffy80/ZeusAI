'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const gate = require('../src/commerce/refund-consumption-gate');
const frontier = require('../src/frontier-engine');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Refund consumption gate');

check('an empty or unpaid record can still be refunded', () => {
  for (const record of [null, {}, { status: 'pending' }, { status: 'paid' }, { entitlement_id: 'ent_1' }]) {
    const decision = gate.assessRefund(record);
    assert.strictEqual(decision.allowed, true);
    assert.strictEqual(decision.reason, 'not_issued');
    assert.deepStrictEqual(decision.signals, []);
  }
});

check('an issued file, license, download, or activation closes the refund', () => {
  const cases = [
    [{ deliveredAt: '2026-10-24T00:00:00.000Z' }, 'deliveredAt'],
    [{ delivered_at: '2026-10-24T00:00:00.000Z' }, 'deliveredAt'],
    [{ license: { key: 'lic_1' } }, 'license'],
    [{ licenseIssuedAt: '2026-10-24T00:00:00.000Z' }, 'licenseIssuedAt'],
    [{ deliverables: [{ name: 'logo.svg' }] }, 'deliverables'],
    [{ files: ['logo.svg'] }, 'deliverables'],
    [{ delivery: { status: 'delivered', items: [] } }, 'delivery'],
    [{ delivery: { status: 'failed', items: [{ id: 'file' }] } }, 'delivery'],
    [{ deliveryStatus: 'completed' }, 'deliveryStatus'],
    [{ downloadCount: 1 }, 'download'],
    [{ downloads: 2 }, 'download'],
    [{ activatedAt: '2026-10-24T00:00:00.000Z' }, 'activated'],
    [{ activated: true }, 'activated'],
  ];
  for (const [record, signal] of cases) {
    const decision = gate.assessRefund(record);
    assert.strictEqual(decision.allowed, false, JSON.stringify(record));
    assert.strictEqual(decision.reason, 'deliverable_already_issued');
    assert.ok(decision.signals.includes(signal), decision.signals.join(','));
  }
});

check('a failed delivery with no file stays refundable', () => {
  const decision = gate.assessRefund({ status: 'paid', delivery: { status: 'failed', items: [] }, downloadCount: 0 });
  assert.strictEqual(decision.allowed, true);
});

check('a voluntary refund of an issued order is refused and a provider clawback revokes access', () => {
  const used = { license: { key: 'lic_1' }, status: 'paid' };
  const voluntary = gate.decideRevoke(used, {});
  assert.strictEqual(voluntary.action, 'refuse');
  const unnamed = gate.decideRevoke(used, null);
  assert.strictEqual(unnamed.action, 'refuse');
  const paypal = gate.decideRevoke(used, { provider: 'paypal', providerRef: 'cap_1', reason: 'PAYMENT.CAPTURE.REFUNDED' });
  assert.strictEqual(paypal.action, 'revoke_access');
  assert.deepStrictEqual(paypal.decision.signals, ['license']);
  const fresh = gate.decideRevoke({ status: 'paid' }, {});
  assert.strictEqual(fresh.action, 'refund');
});

check('the admin refund and the provider revoke both consult the gate', () => {
  const site = read('src/index.js');
  const refundAt = site.indexOf("urlPath === '/api/admin/commerce/refund'");
  const block = site.slice(refundAt, refundAt + 1600);
  assert.ok(block.includes("require('./commerce/refund-consumption-gate')"));
  assert.ok(block.includes('assessRefund'));
  assert.ok(block.indexOf('assessRefund') < block.indexOf("receipt.status = 'refunded'"));
  const commerce = read('src/site/sovereign-commerce.js');
  assert.ok(commerce.includes('decideRevoke'));
  assert.ok(commerce.indexOf("verdict.action === 'refuse'") < commerce.indexOf("order.status = 'refunded'"));
});

check('the public guarantee no longer offers a no-questions refund after use', () => {
  const guarantee = frontier.refundGuarantee();
  const text = JSON.stringify(guarantee);
  assert.ok(Array.isArray(guarantee.rules) && guarantee.rules.length >= 4);
  assert.ok(guarantee.signature);
  assert.ok(guarantee.hash);
  assert.ok(!/no questions asked/i.test(text));
  assert.ok(!/money-back/i.test(text));
  assert.ok(!/auto-issued/i.test(text));
  assert.ok(/closes when the file/i.test(text));
  assert.ok(/not reversed/i.test(guarantee.selfExecution));
});

console.log('✅ refund-consumption-gate: ' + passed + ' tests passed');
