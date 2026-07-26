'use strict';
/**
 * Guards BTC confirmation tier policy in sovereign-commerce:
 *  - fiat amount must come from subtotal_fiat
 *  - confirmations must use tipHeight - blockHeight + 1
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'site', 'sovereign-commerce.js'),
  'utf8'
);

function check(name, fn) {
  fn();
  console.log('✓', name);
}

check('requiredConfsForUsd helper present with tiers', () => {
  assert.ok(src.includes('function requiredConfsForUsd'));
  assert.ok(src.includes('TIER1_USD'));
  assert.ok(src.includes('TIER2_USD'));
});

check('scanIncoming uses subtotal_fiat for tier USD', () => {
  assert.ok(src.includes('orderForTier.subtotal_fiat'));
  assert.ok(src.includes('blocks/tip/height'));
  assert.ok(src.includes('tipHeight - blockHeight + 1'));
  // Must not settle solely with the old always-1 confirmation expression.
  assert.ok(!/confirmed \? Math\.max\(1, Number\(\(tx\.status && tx\.status\.block_height\) \? 1 : 1\)\) : 0/.test(src));
});

check('rescue checkout is fail-closed', () => {
  const rescue = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'rescue-backend.js'),
    'utf8'
  );
  assert.ok(rescue.includes('commerce_unavailable_in_rescue'));
  assert.ok(rescue.includes("ok: false") || rescue.includes('ok: false'));
  assert.ok(rescue.includes('commerceAvailable: false'));
  assert.ok(!/receipt:\s*'rescue-only'/.test(rescue));
});

check('diagnose workflow never starts rescue-backend', () => {
  const yml = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'diagnose-and-repair.yml'),
    'utf8'
  );
  assert.ok(!yml.includes('start_rescue_backend'));
  assert.ok(!yml.includes('pm2 start scripts/rescue-backend.js'));
  assert.ok(yml.includes('restart_canonical_backend'));
  assert.ok(yml.includes('rescue path disabled'));
});

check('stable deploy skips server-doctor destructive restart', () => {
  const yml = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
    'utf8'
  );
  assert.ok(yml.includes('no server-doctor restart'));
  assert.ok(!/bash "\$DEPLOY_PATH\/server-doctor\.sh"/.test(yml));
});

console.log('commerce-conf-tiers.test.js passed');
process.exit(0);
