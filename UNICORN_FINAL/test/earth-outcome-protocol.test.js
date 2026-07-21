'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.EOP_DATA_DIR = require('path').join(require('os').tmpdir(), 'eop-test-' + process.pid);

const assert = require('assert');
const eop = require('../backend/modules/earth-outcome-protocol');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (err) {
    console.error('✗', name);
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

check('discovery advertises EOP/1.0 multi-domain principles', () => {
  const d = eop.discovery();
  assert.strictEqual(d.protocol, 'EOP/1.0');
  assert.ok(Array.isArray(d.domains) && d.domains.length >= 8);
  assert.strictEqual(d.takeRate, 0);
  assert.ok(d.principles.some((p) => /Multi-domain/i.test(p)));
  assert.ok(d.endpoints.mesh && d.endpoints.verify);
});

check('classifies software / commerce / logistics / education', () => {
  assert.strictEqual(eop.classify({ title: 'Pro SaaS Plan', skuId: 'pro' }).domain, 'software');
  assert.strictEqual(eop.classify({ title: 'Wireless earbuds dropship', category: 'store' }).domain, 'commerce');
  assert.strictEqual(eop.classify({ title: 'Carrier shipment desk', tags: ['freight'] }).domain, 'logistics');
  assert.strictEqual(eop.classify({ title: 'Growth playbook course' }).domain, 'education');
  assert.strictEqual(eop.classify({ domain: 'energy', title: 'anything' }).domain, 'energy');
});

check('mint → verify round-trip succeeds', () => {
  const passport = eop.mint({
    orderId: 'ord_test_1',
    skuId: 'starter',
    title: 'Starter Plan',
    retailUsd: 24.5,
    buyerEmail: 'agent@example.com',
    artifactHashes: ['abc', 'def'],
    deliveryId: 'del_1',
    source: 'unit-test',
    valueUsd: 24.5,
  });
  assert.ok(passport.id.startsWith('eop_'));
  assert.strictEqual(passport.claims.domain.id, 'software');
  assert.strictEqual(passport.claims.economics.platformTakeRatePct, 0);
  assert.ok(passport.claims.trustDelta > 0);
  const v = eop.verify({ passport });
  assert.strictEqual(v.valid, true);
  assert.ok(v.signature.ok);
});

check('tampered passport fails verify', () => {
  const passport = eop.mint({
    orderId: 'ord_tamper',
    skuId: 'dropship-widget',
    title: 'Dropship Widget',
    retailUsd: 40,
    artifactHashes: ['aa'],
  });
  const clone = JSON.parse(JSON.stringify(passport));
  clone.claims.economics.retailUsd = 9999;
  const v = eop.verify({ passport: clone });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.includes('claims_hash_mismatch') || v.hashOk === false);
});

check('mesh aggregates trust across domains', () => {
  eop.mint({ skuId: 'course-1', title: 'AI training course', retailUsd: 99, valueUsd: 99 });
  eop.mint({ skuId: 'ship-1', title: 'Freight shipment desk', retailUsd: 50, valueUsd: 50, artifactHashes: ['x'] });
  const m = eop.mesh(10);
  assert.ok(m.ok);
  assert.ok(m.totalPassports >= 2);
  assert.ok(m.domains.some((d) => d.id === 'education' || d.id === 'logistics' || d.id === 'software'));
  assert.ok(m.totalTrust > 0);
});

check('mintFromSettlement never throws and attaches domain', () => {
  const out = eop.mintFromSettlement(
    { orderId: 'o2', serviceId: 'api-call', serviceName: 'API Call', amountUsd: 1.5, email: 'a@b.c' },
    { delivery: { items: [{ filename: 'report.json' }] } },
    'test'
  );
  assert.ok(out.ok !== false);
  assert.ok(out.id);
  assert.strictEqual(out.claims.delivery.artifactCount, 1);
});

check('status exposes protocol + counters', () => {
  const s = eop.getStatus();
  assert.strictEqual(s.protocol, 'EOP/1.0');
  assert.ok(s.minted >= 1);
  assert.ok(Array.isArray(s.skuClasses) && s.skuClasses.includes('commerce'));
});

console.log('\n✅ earth-outcome-protocol: ' + passed + ' tests passed');
process.exit(0);
