'use strict';

/**
 * Payment Innovation OS — multi-rail pay-pack, failover, telemetry, email honesty.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pios-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

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

const pios = require('../src/commerce/payment-innovation-os');
const mail = require('../src/commerce/transactional-email');

check('protocol + rail normalize', () => {
  assert.equal(pios.PROTOCOL, 'PIOS/1.0');
  assert.equal(pios.normalizeRail('Bitcoin'), 'btc');
  assert.equal(pios.normalizeRail('pp'), 'paypal');
  assert.equal(pios.normalizeRail('card'), 'nowpayments');
});

check('static pay-pack includes BTC rail', () => {
  const order = {
    orderId: 'ord_pios_test1',
    status: 'pending',
    amount_btc: 0.001,
    amount_sats: 100000,
    receive_address: 'bc1qtest',
    bip21: 'bitcoin:bc1qtest?amount=0.001',
    checkout_url: 'https://zeusai.pro/checkout/ord_pios_test1',
    subtotal_fiat: 50,
    currency: 'USD',
    meta: {},
  };
  const pack = pios.buildStaticPayPack(order);
  assert.equal(pack.ok, true);
  assert.ok(pack.rails.btc);
  assert.equal(pack.rails.btc.address, 'bc1qtest');
  assert.ok(pack.armed.btc.settleReady);
});

check('failover always recovers to BTC', () => {
  const fo = pios.failoverPlan('paypal', {
    paypal: { settleReady: true },
    nowpayments: { settleReady: true },
  });
  assert.equal(fo.nextRail, 'btc');
  assert.ok(fo.chain.includes('btc'));
  assert.ok(/Bitcoin/i.test(fo.message));
});

check('enrichOrderStatus surfaces partial NOW honesty', () => {
  const order = {
    orderId: 'ord_partial',
    status: 'pending',
    checkout_url: 'https://zeusai.pro/checkout/ord_partial',
    meta: { nowpaymentsStatus: 'partially_paid', selectedRail: 'nowpayments' },
  };
  const e = pios.enrichOrderStatus(order);
  assert.equal(e.rails.nowpayments.partialPaid, true);
  assert.ok(e.rails.nowpayments.honesty);
  assert.ok(e.doublePayWarning);
});

check('pending email includes multi-rail links when provided', () => {
  const out = mail.TEMPLATES.payment_pending({
    orderId: 'ord_mail1',
    serviceName: 'Starter',
    btcAmount: '0.001',
    btcAddress: 'bc1qabc',
    priceUSD: 22,
    checkout_url: 'https://zeusai.pro/checkout/ord_mail1',
    paypalApproveHref: 'https://www.paypal.com/checkoutnow?token=x',
    nowInvoiceUrl: 'https://nowpayments.io/payment/?iid=1',
    multiRail: true,
  });
  assert.ok(/PayPal/i.test(out.text));
  assert.ok(/Card\/crypto/i.test(out.text) || /nowpayments/i.test(out.text));
  assert.ok(out.html.includes('Pay with PayPal'));
  assert.ok(/one/i.test(out.html));
});

check('order_receipt shows paid_via for PayPal', () => {
  const out = mail.TEMPLATES.order_receipt({
    orderId: 'ord_mail2',
    serviceName: 'Starter',
    priceUSD: 22,
    paid_via: 'paypal',
    providerRef: 'CAP123',
    paid_at: '2026-08-01T00:00:00Z',
  });
  assert.ok(/PayPal/i.test(out.text));
  assert.ok(out.html.includes('Paid via'));
  assert.ok(out.html.includes('CAP123'));
});

check('sovereign routes expose pay-pack + failover', () => {
  const sov = read('src/site/sovereign-commerce.js');
  assert.ok(sov.includes('/pay-pack'));
  assert.ok(sov.includes('payment-innovation-os'));
  assert.ok(sov.includes('failover'));
  assert.ok(sov.includes('payPackBtn'));
  assert.ok(sov.includes('doublePayWarn'));
  assert.ok(sov.includes('partial_payment'));
});

check('client remembers preferred rail + failover cascade', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('u_preferred_rail'));
  assert.ok(client.includes('Rail failover cascade') || client.includes('failover'));
  assert.ok(client.includes("selectCheckoutRail('btc')"));
});

check('public innovation telemetry endpoint wired', () => {
  const index = read('src/index.js');
  assert.ok(index.includes('/api/payment/innovation'));
  assert.ok(index.includes('getTelemetrySnapshot'));
});

check('order passport is multi-rail aware', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('opAltPaypal'));
  assert.ok(shell.includes('opAltNow'));
  assert.ok(shell.includes('viaLabel'));
  assert.ok(shell.includes('partialPaid') || shell.includes('Partial payment'));
});

check('telemetry snapshot is honest', () => {
  const snap = pios.getTelemetrySnapshot();
  assert.equal(snap.ok, true);
  assert.equal(snap.protocol, 'PIOS/1.0');
  assert.ok(snap.counts);
  assert.ok(/never invents GMV/i.test(snap.honesty));
});

console.log('payment-innovation-os.test.js: ' + passed + ' passed');
process.exit(0);
