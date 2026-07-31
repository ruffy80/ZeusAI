/**
 * Godmode Completion OS — regression asserts for wired profit loops.
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const godmode = require('../backend/modules/godmode-completion-os');
const referral = require('../src/commerce/referral-engine-real');

let failed = 0;
function check(label, fn) {
  try {
    fn();
    console.log('  ok  ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e));
  }
}

check('godmode audit reports wired loops', () => {
  const a = godmode.audit();
  assert.equal(a.total, 8);
  assert.ok(a.passed >= 7, 'expected most loops wired, got ' + a.passed + '/' + a.total + ' :: ' + JSON.stringify(a.checks.filter((c) => !c.ok)));
  const st = godmode.getStatus();
  assert.ok(st.name === 'godmode-completion-os');
  assert.ok(st.honesty && /does not invent/i.test(st.honesty));
});

check('referral ensureTrackedCode + idempotent redeem', () => {
  if (typeof referral._resetForTests === 'function') referral._resetForTests();
  const code = 'GMTEST' + Date.now().toString(36).toUpperCase().slice(-6);
  const ensured = referral.ensureTrackedCode(code, { ownerEmail: 'partner@example.com' });
  assert.ok(ensured && ensured.code === code);
  const orderId = 'ord_gm_' + Date.now();
  const r1 = referral.recordRedemption({ code, referredEmail: 'buyer@example.com', orderId, amountUsd: 100 });
  assert.ok(r1.ok);
  assert.ok(Number(r1.payoutUsd) > 0);
  const r2 = referral.recordRedemption({ code, referredEmail: 'buyer@example.com', orderId, amountUsd: 100 });
  assert.ok(r2.ok && r2.duplicate, 'second redeem for same order must be duplicate');
});

check('sovereign createOrder stores affiliate + recoverStuckPending exported', () => {
  const src = read('src/site/sovereign-commerce.js');
  assert.ok(/affiliate:\s*affiliateRef\s*\?\s*\{\s*ref:\s*affiliateRef/.test(src));
  assert.ok(src.includes('recordRedemption'));
  assert.ok(src.includes('function recoverStuckPending'));
  assert.ok(src.includes('recoverStuckPending'));
});

check('client sovereignBuy sends ref; checkout hides static QR', () => {
  const client = read('src/site/v2/client.js');
  assert.ok(client.includes('payload.ref'));
  assert.ok(client.includes('never show static-wallet QR'));
  assert.ok(client.includes('coUpsell') || client.includes('hydrateCheckoutUpsell'));
});

check('checkout SSR: no static wallet pre-invoice; upsell host present', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes('Invoice address appears after you generate a secure BTC invoice'));
  assert.ok(shell.includes('id="coUpsell"'));
  assert.ok(!/id="btcAddr">\$\{OWNER\.btc\}/.test(shell));
});

check('unicorn-checkout Card honesty + BTC create path', () => {
  const src = read('src/site/unicorn-checkout.js');
  assert.ok(src.includes('payBtc'));
  assert.ok(src.includes('/api/checkout/create'));
  assert.ok(src.includes('Card appears only when Stripe'));
  assert.ok(!/pay\(node,\s*'create'\)/.test(src));
});

check('checkout-recovery always-on start + backend boots it', () => {
  const agent = read('backend/modules/checkout-recovery-agent.js');
  const idx = read('backend/index.js');
  assert.ok(/function start\(/.test(agent));
  assert.ok(idx.includes('checkoutRecoveryAgent.start'));
});

check('lead hunter attempts outreach delivery', () => {
  const src = read('backend/modules/autonomous-lead-hunter.js');
  assert.ok(src.includes('outreachDelivery'));
  assert.ok(src.includes('sendRaw'));
});

if (failed) {
  console.error('godmode-completion-os.test.js: ' + failed + ' assertion(s) failed.');
  process.exit(1);
}
console.log('godmode-completion-os.test.js: all assertions passed');
