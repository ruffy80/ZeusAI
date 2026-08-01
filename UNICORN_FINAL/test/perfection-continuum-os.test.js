'use strict';

/**
 * Perfection Continuum OS — account resume, receipt/delivery honesty, HTML fields.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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

const pcos = require('../src/commerce/perfection-continuum-os');

check('protocol + via normalize/labels', () => {
  assert.equal(pcos.PROTOCOL, 'PCOS/1.0');
  assert.equal(pcos.normalizeVia('PayPal'), 'paypal');
  assert.equal(pcos.normalizeVia('card'), 'nowpayments');
  assert.equal(pcos.viaLabel('btc'), 'Bitcoin');
  assert.equal(pcos.methodCode('nowpayments'), 'NOWPAYMENTS');
});

check('accountPendingFromOrder surfaces multi-rail resume links', () => {
  const order = {
    orderId: 'ord_pcos_1',
    status: 'pending',
    serviceId: 'adaptive-ai',
    serviceName: 'Adaptive AI',
    subtotal_fiat: 49,
    amount_btc: 0.0005,
    receive_address: 'bc1qtest',
    bip21: 'bitcoin:bc1qtest?amount=0.0005',
    checkout_url: 'https://zeusai.pro/checkout/ord_pcos_1',
    created_at: '2026-08-01T00:00:00.000Z',
    meta: {
      selectedRail: 'paypal',
      paypalApproveHref: 'https://www.paypal.com/checkoutnow?token=TEST',
      nowpaymentsInvoiceUrl: 'https://nowpayments.io/payment/?iid=TEST',
    },
  };
  const row = pcos.accountPendingFromOrder(order);
  assert.ok(row);
  assert.equal(row.receiptId, 'ord_pcos_1');
  assert.equal(row.method, 'PAYPAL');
  assert.equal(row.approveHref, 'https://www.paypal.com/checkoutnow?token=TEST');
  assert.equal(row.nowpaymentsInvoiceUrl, 'https://nowpayments.io/payment/?iid=TEST');
  assert.equal(row.btcUri, 'bitcoin:bc1qtest?amount=0.0005');
  assert.equal(row.multiRail, true);
  assert.ok(row.invoiceUrl.includes('ord_pcos_1'));
});

check('deliveryReceiptPatch does not force BTC after PayPal pay', () => {
  const order = {
    orderId: 'ord_paid_pp',
    paid_via: 'paypal',
    txids: [],
    meta: { paypalCaptureId: 'CAP123', paypalOrderId: 'PPORDER1' },
  };
  const patch = pcos.deliveryReceiptPatch(order);
  assert.equal(patch.method, 'PAYPAL');
  assert.equal(patch.paid_via, 'paypal');
  assert.equal(patch.providerRef, 'CAP123');
});

check('receiptEmailPatch preserves paid_via for mailer', () => {
  const patch = pcos.receiptEmailPatch({
    paid_via: 'nowpayments',
    providerRef: 'NOW-INV-9',
    txid: null,
  });
  assert.equal(patch.paid_via, 'nowpayments');
  assert.equal(patch.providerRef, 'NOW-INV-9');
});

check('htmlReceiptFields shows settlement ref for alt rails', () => {
  const fields = pcos.htmlReceiptFields({
    paid_via: 'paypal',
    amount_btc: 0.001,
    subtotal_fiat: 99,
    currency: 'USD',
    meta: { paypalCaptureId: 'CAP-XYZ' },
    txids: [],
  });
  assert.equal(fields.via, 'paypal');
  assert.equal(fields.viaLabel, 'PayPal');
  assert.ok(/99/.test(fields.amountDd));
  assert.ok(/CAP-XYZ/.test(fields.proofDd));
  assert.ok(/Paid via/.test(fields.paidViaDt));
});

check('walletSubjectPatch hides BTC address for PayPal pays', () => {
  const patch = pcos.walletSubjectPatch({
    paid_via: 'paypal',
    receive_address: 'bc1qshouldhide',
    txids: ['abc'],
    meta: { paypalOrderId: 'PPO' },
  });
  assert.equal(patch.paidVia, 'paypal');
  assert.equal(patch.bitcoinTxId, null);
  assert.equal(patch.receiveAddress, null);
  assert.equal(patch.providerRef, 'PPO');
});

check('source wiring: customer/me uses PCOS pending helper', () => {
  const idx = read('src/index.js');
  assert.ok(idx.includes('perfection-continuum-os'));
  assert.ok(idx.includes('accountPendingFromOrder'));
});

check('source wiring: delivery hook + HTML receipt + pay-fulfill', () => {
  const sc = read('src/site/sovereign-commerce.js');
  assert.ok(sc.includes('deliveryReceiptPatch'));
  assert.ok(sc.includes('htmlReceiptFields'));
  assert.ok(sc.includes('walletSubjectPatch'));
  const pf = read('src/commerce/pay-fulfill.js');
  assert.ok(pf.includes('receiptEmailPatch'));
  assert.ok(pf.includes('paid_via'));
});

check('source wiring: account UI + operator PIOS panel', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('nowpaymentsInvoiceUrl') || client.includes('nowInvoiceUrl'));
  assert.ok(/Card \/ crypto/.test(client));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('/api/payment/innovation'));
  assert.ok(shell.includes('opPiosGrid'));
  assert.ok(shell.includes('loadPios'));
});

console.log('\n' + passed + ' checks passed (perfection-continuum-os)');
