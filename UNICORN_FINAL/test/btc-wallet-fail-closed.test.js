'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');

function loadFresh() {
  delete require.cache[require.resolve('../backend/modules/btc-wallet-truth')];
  return require('../backend/modules/btc-wallet-truth');
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  COMMERCE_FAIL_CLOSED_BTC: process.env.COMMERCE_FAIL_CLOSED_BTC,
  COMMERCE_ALLOW_REPO_BTC: process.env.COMMERCE_ALLOW_REPO_BTC,
  BTC_WALLET_ADDRESS: process.env.BTC_WALLET_ADDRESS,
  OWNER_BTC_ADDRESS: process.env.OWNER_BTC_ADDRESS,
  LEGAL_OWNER_BTC: process.env.LEGAL_OWNER_BTC,
  BTC_OWNER_WALLET: process.env.BTC_OWNER_WALLET,
  ZACC_BTC_ADDRESS: process.env.ZACC_BTC_ADDRESS,
};

function unsetWallets() {
  delete process.env.BTC_WALLET_ADDRESS;
  delete process.env.OWNER_BTC_ADDRESS;
  delete process.env.LEGAL_OWNER_BTC;
  delete process.env.BTC_OWNER_WALLET;
  delete process.env.ZACC_BTC_ADDRESS;
}

check('NODE_ENV=test allows documented repo default', () => {
  unsetWallets();
  delete process.env.COMMERCE_FAIL_CLOSED_BTC;
  delete process.env.COMMERCE_ALLOW_REPO_BTC;
  process.env.NODE_ENV = 'test';
  const t = loadFresh();
  assert.equal(t.isInvoiceAllowed(), true);
  assert.equal(t.walletSource(), 'repo_default');
  assert.equal(t.invoiceOwnerBtc(), t.REPO_DEFAULT_BTC);
});

check('COMMERCE_FAIL_CLOSED_BTC=1 refuses invoices without env wallet', () => {
  unsetWallets();
  process.env.COMMERCE_FAIL_CLOSED_BTC = '1';
  delete process.env.COMMERCE_ALLOW_REPO_BTC;
  process.env.NODE_ENV = 'production';
  const t = loadFresh();
  assert.equal(t.isInvoiceAllowed(), false);
  assert.equal(t.walletSource(), 'unconfigured');
  assert.equal(t.refusePayload().error, 'btc_wallet_unconfigured');
  assert.equal(t.refusePayload().status, 503);
});

check('env wallet wins over repo default', () => {
  process.env.BTC_WALLET_ADDRESS = 'bc1qtestwallettruth0000000000000000000000';
  process.env.COMMERCE_FAIL_CLOSED_BTC = '1';
  process.env.NODE_ENV = 'production';
  const t = loadFresh();
  assert.equal(t.isInvoiceAllowed(), true);
  assert.equal(t.walletSource(), 'env');
  assert.equal(t.invoiceOwnerBtc(), 'bc1qtestwallettruth0000000000000000000000');
});

Object.assign(process.env, saved);
if (saved.BTC_WALLET_ADDRESS === undefined) delete process.env.BTC_WALLET_ADDRESS;

console.log('\n✅ btc-wallet-fail-closed:', passed, 'tests passed');
process.exit(0);
