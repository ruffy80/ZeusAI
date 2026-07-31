/**
 * Phase-1 security harden — payment confirm, gift mint, referral redeem, control plane.
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failed = 0;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed += 1; console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e)); }
}

check('payment confirm denies open-dev outside test/allow', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes('confirm_secret_required'));
  assert.ok(src.includes('ALLOW_OPEN_PAYMENT_CONFIRM'));
  assert.ok(src.includes("process.env.NODE_ENV === 'test'"));
});

check('ZAC mutate + quarantine promote require admin gate', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes('function requireAdminSecretOrJwt'));
  assert.ok(/app\.post\('\/api\/zac\/site-complete',\s*requireAdminSecretOrJwt/.test(src));
  assert.ok(/app\.post\('\/api\/zac\/dev\/generate-module',\s*requireAdminSecretOrJwt/.test(src));
  assert.ok(/app\.post\('\/api\/zac\/start',\s*requireAdminSecretOrJwt/.test(src));
  assert.ok(/app\.post\('\/api\/autonomy\/quarantine\/promote',\s*express\.json\(\),\s*requireAdminSecretOrJwt/.test(src));
});

check('gift mint rejects free public mint; redeem stays ledger-only', () => {
  const frontier = require('../src/frontier-engine');
  const denied = frontier.giftMint({ sku: 'adaptive-ai', valueUsd: 999 });
  assert.equal(denied.ok, false);
  assert.ok(/gift_mint_requires_paid_order_or_admin|paid_order/.test(denied.error));
  const admin = frontier.giftMint({ sku: 'adaptive-ai', valueUsd: 10, adminAuth: true, fromEmail: 'a@b.co' });
  assert.ok(admin && admin.ok !== false && admin.code && String(admin.code).startsWith('GIFT-'));
});

check('site gift mint route checks admin header / paid proof', () => {
  const src = read('src/index.js');
  assert.ok(src.includes('gift_mint_requires_paid_order_or_admin') || src.includes('adminAuth'));
  assert.ok(src.includes("payload.adminAuth = true"));
});

check('referral HTTP redeem requires secret; settle remains in-process', () => {
  const site = read('src/index.js');
  const sov = read('src/site/sovereign-commerce.js');
  assert.ok(site.includes('redeem_via_settle_or_admin'));
  assert.ok(site.includes('REFERRAL_REDEEM_SECRET'));
  assert.ok(sov.includes('recordRedemption'));
});

check('architecture roadmap doc present', () => {
  const doc = read('docs/architecture-audit-roadmap.md');
  assert.ok(doc.includes('Phase 1'));
  assert.ok(doc.includes('sovereignBuy'));
});

if (failed) {
  console.error('phase1-security-harden.test.js: ' + failed + ' failed');
  process.exit(1);
}
console.log('phase1-security-harden.test.js: all assertions passed');
