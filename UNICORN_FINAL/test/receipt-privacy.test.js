'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const privacy = require('../src/commerce/receipt-privacy');

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

const rows = [
  { id: 'a', email: 'Buyer@Example.com', amount: 49, plan: 'audit' },
  { id: 'b', email: 'other@example.com', amount: 2500, plan: 'kickoff' },
];

check('a missing email does not dump the ledger', () => {
  const out = privacy.lookupByEmail('', rows);
  assert.strictEqual(out.status, 400);
  assert.strictEqual(out.body.error, 'email_required');
  assert.ok(!out.body.receipts);
  assert.strictEqual(JSON.stringify(out.body).includes('Buyer@Example.com'), false);
});

check('an email alone does not reveal how many receipts exist', () => {
  const out = privacy.lookupByEmail('buyer@example.com', rows);
  assert.strictEqual(out.status, 400);
  assert.strictEqual(out.body.error, 'order_required');
  assert.strictEqual(out.body.count, undefined);
  assert.strictEqual(JSON.stringify(out.body).includes('Buyer@Example.com'), false);
});

check('a matching email and order id confirms the pair and hides the ledger', () => {
  const hit = privacy.lookupByEmail('buyer@example.com', rows, 'a');
  assert.strictEqual(hit.status, 200);
  assert.strictEqual(hit.body.matched, true);
  assert.strictEqual(hit.body.count, undefined);
  const miss = privacy.lookupByEmail('buyer@example.com', rows, 'missing');
  assert.strictEqual(miss.body.matched, false);
  const other = privacy.lookupByEmail('nobody@example.com', rows, 'a');
  assert.strictEqual(other.body.matched, false);
  assert.strictEqual(JSON.stringify(other.body).includes('Buyer@Example.com'), false);
});

check('a public receipt keeps the payment fields and drops the buyer', () => {
  const view = privacy.publicReceipt({
    id: 'abc',
    status: 'pending',
    amount: 49,
    plan: 'audit',
    btcAddress: 'bc1qexample',
    email: 'buyer@example.com',
    customerId: 'cust-1',
    did: 'did:example',
  });
  assert.strictEqual(view.status, 'pending');
  assert.strictEqual(view.btcAddress, 'bc1qexample');
  assert.strictEqual(view.email, undefined);
  assert.strictEqual(view.customerId, undefined);
  assert.strictEqual(view.did, undefined);
});

check('a public invoice keeps the payment fields and drops the buyer record', () => {
  const view = privacy.publicInvoice({
    id: 7,
    status: 'pending',
    amountBtc: '0.00100000',
    payoutAddress: 'bc1qexample',
    priceUsd: 49,
    service: 'instant-website-audit',
    customerEmail: 'buyer@example.com',
    metadata: { note: 'private' },
  });
  assert.strictEqual(view.amountBtc, '0.00100000');
  assert.strictEqual(view.payoutAddress, 'bc1qexample');
  assert.strictEqual(view.service, 'instant-website-audit');
  assert.strictEqual(view.customerEmail, undefined);
  assert.strictEqual(view.metadata, undefined);
});

check('the site and the backend use the private views', () => {
  const site = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.strictEqual(site.split('lookupByEmail').length, 3);
  assert.strictEqual(site.split('publicReceipt(').length, 3);
  assert.ok(site.includes('getAllReceipts(), orderId') || site.includes("params.get('order')"));
  assert.ok(!site.includes("JSON.stringify({ ok:true, receipts })"));
  assert.ok(!site.includes("req.headers['x-user-email'] || (customer && customer.email)"));
  assert.ok(!site.includes("req.headers['x-user-email'] || resolveEmailFromCryptoauth()"));
  assert.ok(!backend.includes("req.headers['x-user-email']"));
  const services = backend.slice(backend.indexOf("app.get('/api/user/services'"), backend.indexOf("app.get('/api/user/services'") + 700);
  assert.ok(!services.includes('req.query.email'));
  assert.ok(services.includes('jwt.verify'));
  assert.ok(backend.includes("app.get('/api/invoice/list', salesAdminGate"));
  assert.ok(backend.includes("app.get('/api/invoice/status', salesAdminGate"));
  assert.ok(backend.includes("app.post('/api/invoice/verify-now', salesAdminGate"));
  assert.ok(backend.includes("app.post('/api/alerts/test', salesAdminGate"));
  assert.strictEqual(backend.split('publicInvoice').length, 3);
});

console.log('receipt-privacy: ' + passed + ' checks passed');
process.exit(0);
