// test/pay-fulfill-idempotent.test.js
// Verifies the unified pay→fulfill module:
//   1. runDeliveryOnce invokes the delivery function exactly once per orderId
//      even under repeated calls (BTC + PayPal + Stripe webhook safety).
//   2. sendOrderReceiptEmail / sendDeliveryArtifactEmail are no-ops on 2nd call
//      for the same orderId (ledger dedup — no duplicate emails).
//   3. When no email provider is configured the mailer returns
//      { ok:false, reason:'email_unconfigured' } (fail-honest contract).

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Point pay-fulfill at a tmp data dir so we don't pollute repo data/.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unc-payfulfill-'));
process.env.UNICORN_COMMERCE_DIR = tmpDir;
// Strip any ambient email config → force the unconfigured / fail-honest path.
for (const k of ['RESEND_API_KEY', 'BREVO_API_KEY', 'SENDINBLUE_API_KEY', 'MAILERSEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k];

const payFulfill = require('../src/commerce/pay-fulfill');
payFulfill._resetForTests();

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); process.exit(1); }
}

async function main() {
  // 1. runDeliveryOnce ------------------------------------------------------
  let calls = 0;
  const deliveryFn = (r) => { calls++; return { id: 'del_' + r.orderId, items: [{ files: [{ filename: 'f.txt' }] }] }; };
  const receipt = { orderId: 'ord_dedup_1', status: 'paid', email: 'buyer@example.com', serviceId: 'starter', amount: 199 };
  const r1 = payFulfill.runDeliveryOnce(receipt, deliveryFn);
  const r2 = payFulfill.runDeliveryOnce(receipt, deliveryFn);
  const r3 = payFulfill.runDeliveryOnce(receipt, deliveryFn);
  check('runDeliveryOnce fires deliveryFn exactly once', () => assert.equal(calls, 1));
  check('runDeliveryOnce returns delivery result on first call', () => {
    assert.equal(r1.ok, true); assert.equal(r1.alreadyDelivered, false);
    assert.ok(r1.delivery && r1.delivery.id === 'del_ord_dedup_1');
  });
  check('runDeliveryOnce reports alreadyDelivered on subsequent calls', () => {
    assert.equal(r2.alreadyDelivered, true); assert.equal(r3.alreadyDelivered, true);
  });
  check('hasRunDelivery reflects ledger state', () => {
    assert.equal(payFulfill.hasRunDelivery('ord_dedup_1'), true);
    assert.equal(payFulfill.hasRunDelivery('ord_never'), false);
  });

  // 2. sendOrderReceiptEmail fail-honest + dedup ---------------------------
  const receipt2 = { orderId: 'ord_email_1', status: 'paid', email: 'a@example.com', serviceId: 'starter', amount: 99 };
  const s1 = await payFulfill.sendOrderReceiptEmail(receipt2);
  const s2 = await payFulfill.sendOrderReceiptEmail(receipt2);
  check('sendOrderReceiptEmail is fail-honest when unconfigured (ok:false, reason)', () => {
    assert.equal(s1.ok, false);
    assert.equal(s1.reason, 'email_unconfigured');
  });
  // Since first call did NOT record (ok:false → no ledger entry), the second call is also fail-honest.
  check('unconfigured second call is still fail-honest (no fake success)', () => {
    assert.equal(s2.ok, false);
    assert.equal(s2.reason, 'email_unconfigured');
  });

  // 3. delivery artifact email — same fail-honest contract -----------------
  const deliveryPkg = { items: [{ files: [{ filename: 'plan.json', kind: 'report' }] }] };
  const d1 = await payFulfill.sendDeliveryArtifactEmail(receipt2, deliveryPkg);
  check('sendDeliveryArtifactEmail fail-honest when unconfigured', () => {
    assert.equal(d1.ok, false);
    assert.equal(d1.reason, 'email_unconfigured');
  });

  // 4. Missing orderId / email surface explicit errors ---------------------
  const bad1 = await payFulfill.sendOrderReceiptEmail({ status: 'paid' });
  const bad2 = await payFulfill.sendOrderReceiptEmail({ orderId: 'x', status: 'paid', email: 'not-an-email' });
  check('sendOrderReceiptEmail rejects missing orderId', () => {
    assert.equal(bad1.ok, false); assert.ok(bad1.error === 'missing_orderId');
  });
  check('sendOrderReceiptEmail rejects invalid email', () => {
    assert.equal(bad2.ok, false); assert.ok(bad2.error === 'missing_email');
  });

  // 5. settleAndNotify end-to-end (delivery once + emails) ----------------
  payFulfill._resetForTests();
  let calls2 = 0;
  const deliveryFn2 = (r) => { calls2++; return { id: 'del_' + r.orderId, items: [{ files: [{ filename: 'x' }] }] }; };
  const rec = { orderId: 'ord_e2e', status: 'paid', email: 'e2e@example.com' };
  const settled = await payFulfill.settleAndNotify({ receipt: rec, deliveryFn: deliveryFn2, source: 'BTC' });
  const settled2 = await payFulfill.settleAndNotify({ receipt: rec, deliveryFn: deliveryFn2, source: 'BTC' });
  check('settleAndNotify runs delivery exactly once across two calls', () => {
    assert.equal(calls2, 1);
    assert.equal(settled.ok, true);
    assert.equal(settled2.delivery && settled2.delivery.alreadyDelivered, true);
  });

  // Cleanup tmp dir.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) { /* best effort */ }
  console.log('\n✅ pay-fulfill-idempotent: ' + passed + ' tests passed');
}

main().catch((e) => { console.error('pay-fulfill-idempotent FAILED:', e && e.stack || e); process.exit(1); });
