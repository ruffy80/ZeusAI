'use strict';

process.env.NODE_ENV = 'test';
delete process.env.ETH_WALLET_ADDRESS;
delete process.env.USDC_WALLET_ADDRESS;
delete process.env.ETH_RECEIVE_ADDRESS;
delete process.env.BANK_TRANSFER_ENABLED;
delete process.env.BANK_ACCOUNT_IBAN;
delete process.env.BANK_ACCOUNT_NUMBER;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.PAYPAL_CLIENT_ID;
delete process.env.PAYPAL_CLIENT_SECRET;

const assert = require('assert');
const PaymentGateway = require('../backend/modules/paymentGateway');
const truth = require('../backend/modules/conversion-truth-layer');

let pass = 0;
function check(name, fn) { fn(); pass++; console.log('  \u2713 ' + name); }

const gw = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;

check('BTC is always active', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(methods.some((m) => m.id === 'crypto_btc' && m.active));
});

check('ETH and bank are hidden when unconfigured', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(!methods.some((m) => m.id === 'crypto_eth'));
  assert.ok(!methods.some((m) => m.id === 'bank'));
});

check('Stripe/PayPal hidden without secrets', () => {
  const methods = gw.getPaymentMethods();
  assert.ok(!methods.some((m) => m.id === 'stripe' || m.id === 'card'));
  assert.ok(!methods.some((m) => m.id === 'paypal'));
});

check('conversion-truth strips eth/bank from public metrics', () => {
  const out = truth.sanitizePublicMetrics({
    methods: [
      { id: 'crypto_btc', active: true },
      { id: 'crypto_eth', active: true },
      { id: 'bank', active: true },
    ],
    simulatedRevenue: 999,
  });
  assert.ok(out.methods.every((m) => m.id === 'crypto_btc'));
  assert.strictEqual(out.simulatedRevenue, 0);
});

check('ETH becomes active when wallet configured', () => {
  process.env.ETH_WALLET_ADDRESS = '0xabc';
  const gw2 = typeof PaymentGateway === 'function' ? new PaymentGateway() : PaymentGateway;
  assert.ok(gw2.getPaymentMethods().some((m) => m.id === 'crypto_eth' && m.active));
  delete process.env.ETH_WALLET_ADDRESS;
});

console.log('✅ payment-honesty: ' + pass + ' tests passed');
