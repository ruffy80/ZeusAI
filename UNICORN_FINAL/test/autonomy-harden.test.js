'use strict';
/**
 * Guards the autonomy harden pass (2026-07):
 *  - ZAC process healer independent of DISABLE_SELF_MUTATION
 *  - auto-restart watches live PM2 apps
 *  - local DR autopilot defaults on
 *  - healer-pm2 topology matches unicorn-backend/site
 *  - catalog TTL ≤5s default
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

check('ZAC healer not gated by DISABLE_SELF_MUTATION', () => {
  const src = read('backend/modules/zeusAutonomousCore/index.js');
  assert.ok(src.includes('independent of'), 'comment documents decoupling');
  assert.ok(src.includes('DISABLE_SELF_MUTATION'), 'mentions mutation flag');
  assert.ok(!/SELF_HEALER_ENABLED\s*=\s*process\.env\.ZAC_ENABLE_HEALER[\s\S]{0,120}DISABLE_SELF_MUTATION\s*!==\s*'1'/.test(src),
    'must not require DISABLE_SELF_MUTATION!==1 for healer enable');
  assert.ok(src.includes("ZAC_DISABLE_HEALER !== '1'"), 'opt-out via ZAC_DISABLE_HEALER');
});

check('ZAC selfHealer pings site on :3001', () => {
  const src = read('backend/modules/zeusAutonomousCore/selfHealer.js');
  assert.ok(src.includes('127.0.0.1:3001/health'), 'site health URL');
  assert.ok(src.includes('3000/api/health') || src.includes('3000/health'), 'backend health URL');
});

check('auto-restart watches unicorn-backend + unicorn-site', () => {
  const src = read('backend/modules/auto-restart.js');
  assert.ok(src.includes('unicorn-backend,unicorn-site'), 'live PM2 names');
  assert.ok(!src.includes('unicorn-health-guardian'), 'no phantom guardian default');
});

check('DR defaults to local and arms autopilot outside tests', () => {
  const src = read('backend/modules/disaster-recovery.js');
  assert.ok(src.includes("hasS3 ? 's3' : 'local'"), 'local when no S3');
  assert.ok(src.includes('armLocal'), 'local arm path');
  assert.ok(src.includes("flag !== '0'"), 'opt-out with =0');
});

check('healer-pm2 defaults drop autoscaler and check site', () => {
  const src = read('scripts/healer-pm2.sh');
  assert.ok(src.includes('SITE_HEALTH_URL'), 'site check');
  assert.ok(src.includes('unicorn-backend unicorn-site'), 'live apps');
  assert.ok(!/PM2_APPS=.*autoscaler/.test(src), 'no autoscaler default');
});

check('unicornSelfHealer delegates process restarts', () => {
  const src = read('backend/modules/unicornSelfHealer.js');
  assert.ok(src.includes('processGuardian'), 'guardian fn');
  assert.ok(src.includes("require('./auto-restart')"), 'delegates to auto-restart');
  assert.ok(src.includes('processGuardian()'), 'called in cycle');
});

check('master catalog TTL default is 5s', () => {
  const src = read('src/index.js');
  assert.ok(/MASTER_CATALOG_TTL_MS \|\| 5_000/.test(src) || /MASTER_CATALOG_TTL_MS \|\| 5000/.test(src),
    '5s default');
});

console.log('\n✅ autonomy-harden: tests passed');
