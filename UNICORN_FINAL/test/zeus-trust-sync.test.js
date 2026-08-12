'use strict';
/**
 * zeus-trust-sync.test.js — Phoenix Trust Sync contract.
 * Ensures kill-switched poller ticks still sync Cloud Agent pubkeys.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const SCRIPTS = path.join(__dirname, '..', 'scripts');
const TRUST = path.join(SCRIPTS, 'zeus-trust-sync.sh');
const POLLER = path.join(SCRIPTS, 'auto-pull-deploy.sh');
const PHONE = path.join(__dirname, '..', '..', '.deploy', 'PHONE_CONSOLE_RECOVERY.sh');

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

check('zeus-trust-sync.sh exists and is executable-intent', () => {
  assert.ok(fs.existsSync(TRUST), 'missing zeus-trust-sync.sh');
  const src = fs.readFileSync(TRUST, 'utf8');
  assert.ok(src.includes('cursor-cloud-deploy_key.pub'), 'must fetch .deploy pubkeys');
  assert.ok(src.includes('authorized_keys'), 'must write authorized_keys');
  assert.ok(!/rm\s+-f\s+.*zeus-autodeploy\.disabled/.test(src), 'must NOT clear kill-switch');
});

check('auto-pull-deploy calls trust-sync BEFORE kill-switch exit', () => {
  const src = fs.readFileSync(POLLER, 'utf8');
  const trustIdx = src.indexOf('trust-sync');
  const killIdx = src.indexOf('disabled via $DISABLE_FLAG');
  assert.ok(trustIdx > 0, 'poller mentions trust-sync');
  assert.ok(killIdx > trustIdx, 'trust-sync must run before kill-switch exit');
  assert.ok(src.includes('trust-sync already ran'), 'kill-switch message acknowledges trust-sync');
});

check('phone recovery is curl-free with hardcoded recover pubkey', () => {
  assert.ok(fs.existsSync(PHONE), 'missing PHONE_CONSOLE_RECOVERY.sh');
  const src = fs.readFileSync(PHONE, 'utf8');
  assert.ok(src.includes('AAAAIBQdeHHTLRraxxanahITSWXxtbQ5CnR6ya3G40TXkR7Q'),
    'must hardcode recover pubkey');
  assert.ok(src.includes('rm -f /etc/zeus-autodeploy.disabled'), 'must clear kill-switch');
  // Prefer no network dependency for the critical path
  assert.ok(!/^curl /m.test(src) && !src.includes('curl -fsSL'),
    'phone recovery must not depend on curl (offline console paste)');
  // Offline probe must require HTTP 2xx (not any HTTP/* including 502/404).
  assert.ok(/HTTP\/\[0-9\.\*\]\*\\ 2\[0-9\]\[0-9\]\*/.test(src) || src.includes('2[0-9][0-9]*'),
    'http_probe must accept only HTTP 2xx');
  assert.ok(!/HTTP\/\*\)\s*return 0/.test(src),
    'http_probe must not treat every HTTP/* response as live');
});

console.log(`\n✅ zeus-trust-sync: ${passed} tests passed\n`);
