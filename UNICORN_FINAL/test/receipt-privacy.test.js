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

check('an email lookup returns a count and no receipt bodies', () => {
  const out = privacy.lookupByEmail('buyer@example.com', rows);
  assert.strictEqual(out.status, 200);
  assert.strictEqual(out.body.ok, true);
  assert.strictEqual(out.body.count, 1);
  assert.ok(!out.body.receipts);
  assert.strictEqual(JSON.stringify(out.body).includes('audit'), false);
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
  assert.ok(!site.includes("JSON.stringify({ ok:true, receipts })"));
  assert.ok(backend.includes("app.get('/api/invoice/list', salesAdminGate"));
  assert.ok(backend.includes("app.get('/api/invoice/status', salesAdminGate"));
  assert.ok(backend.includes("app.post('/api/invoice/verify-now', salesAdminGate"));
  assert.ok(backend.includes("app.post('/api/alerts/test', salesAdminGate"));
  assert.strictEqual(backend.split('publicInvoice').length, 3);
});

console.log('receipt-privacy: ' + passed + ' checks passed');
process.exit(0);
