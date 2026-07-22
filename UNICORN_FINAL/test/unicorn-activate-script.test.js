'use strict';
/**
 * unicorn-activate-script.test.js
 * Guards the SAFE full-autonomy activation scripts against re-introducing the
 * dangerous "pm2 start per module file" / "stub module source" patterns, and
 * asserts the intended safe behaviour + SSH key rollout.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const SCRIPTS = path.join(__dirname, '..', 'scripts');
const ACTIVATE = path.join(SCRIPTS, 'unicorn-full-activate.sh');
const HEALTH_WATCH = path.join(SCRIPTS, 'unicorn-health-watch.sh');
const SSH_SCRIPT = path.join(SCRIPTS, 'ensure-cursor-cloud-ssh.sh');

const NEW_PUBKEY =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHA7c/ZKX3ZBpNC9vmgiUcKMhogxZFw6Hfg5LhH6QTm0 cursor-cloud-zeus-deploy-c3b6';

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

check('unicorn-full-activate.sh exists', () => {
  assert.ok(fs.existsSync(ACTIVATE), 'activation script missing');
});

const activate = fs.readFileSync(ACTIVATE, 'utf8');

check('activate deploy target is /var/www/unicorn/UNICORN_FINAL; /root/ZeusAI only for owner symlink', () => {
  assert.ok(activate.includes('/var/www/unicorn/UNICORN_FINAL'), 'deploy link default missing');
  // DEPLOY_LINK must default to the /var/www path, NOT /root/ZeusAI.
  assert.match(activate, /DEPLOY_LINK="\$\{DEPLOY_LINK:-\/var\/www\/unicorn\/UNICORN_FINAL\}"/,
    'DEPLOY_LINK default must be the /var/www path');
  // /root/ZeusAI is allowed ONLY as the owner-path symlink (ln -sfn ...).
  assert.match(activate, /ln -sfn "\$DEPLOY_LINK" "\$OWNER_ROOT\/UNICORN_FINAL"/,
    'must create /root/ZeusAI/UNICORN_FINAL owner symlink to the deploy link');
  assert.ok(activate.includes('/root/ZeusAI'), 'owner path /root/ZeusAI should be referenced');
});

check('activate does NOT pm2-start module files per-file', () => {
  // Dangerous pattern: `pm2 start "modules/...` or `pm2 start modules/...`
  assert.doesNotMatch(activate, /pm2 start\s+["']?modules\//, 'must not pm2 start module files');
});

check('activate does NOT create stub module source', () => {
  assert.doesNotMatch(activate, /echo\s+["']module\.exports = \{ run/, 'must not echo stub modules');
  assert.doesNotMatch(activate, /module\.exports = \{ run/, 'must not write stub module.exports');
});

check('activate keeps source-file mutators OFF', () => {
  assert.ok(activate.includes('ENABLE_FILE_MUTATORS=0'));
  assert.ok(activate.includes('ENABLE_SELF_CONSTRUCTION=0'));
  assert.ok(activate.includes('DISABLE_SELF_MUTATION=1'));
});

check('activate keeps production stable profile (no in-process ZDT suicide)', () => {
  assert.ok(activate.includes('UNICORN_RUNTIME_PROFILE=stable'));
  assert.ok(activate.includes('ENABLE_AUTO_REPAIR=1'));
  assert.ok(activate.includes('ENABLE_AUTO_RESTART=0'));
  assert.ok(activate.includes('WATCHDOG_AUTOSTART=0'));
  assert.ok(activate.includes('ZDT_ENABLED=0'));
});

check('activate reloads canonical PM2 apps, not per-module processes', () => {
  assert.ok(activate.includes('startOrReload'), 'should use pm2 startOrReload');
  assert.ok(activate.includes('ecosystem.config.js'), 'should reload ecosystem.config.js');
});

check('activate audits frontierAI + marketAnalytics, still never stubs absent modules', () => {
  assert.match(activate, /frontierAI/);
  assert.match(activate, /marketAnalytics/);
  // Even though these modules now exist, the audit must retain its never-stub guard.
  assert.match(activate, /not creating a stub|NOT stubbed|do not invent/i);
});

check('activate installs the safe health-watch cron + read-only self-heal audit cron (no selfConstruction --cron / apply)', () => {
  assert.ok(activate.includes('unicorn-health-watch.sh'), 'should install health-watch cron');
  assert.ok(activate.includes('zeus-selfheal-audit.js'), 'should install read-only self-heal audit cron');
  assert.doesNotMatch(activate, /selfConstruction\s+--cron/, 'must not schedule selfConstruction --cron');
  // The audit cron must be read-only: never apply skeletons.
  assert.match(activate, /SELF_CONSTRUCTION_APPLY=0/, 'audit cron must force apply-off');
});

check('unicorn-health-watch.sh exists and only restarts on repeated failure', () => {
  assert.ok(fs.existsSync(HEALTH_WATCH), 'health-watch script missing');
  const watch = fs.readFileSync(HEALTH_WATCH, 'utf8');
  assert.ok(watch.includes('/var/log/zeus-health-watch.log'), 'should log to /var/log/zeus-health-watch.log');
  assert.match(watch, /pm2 restart unicorn-backend/);
  assert.match(watch, /pm2 restart unicorn-site/);
  assert.doesNotMatch(watch, /module\.exports = \{ run/, 'health-watch must not write stub modules');
});

check('ensure-cursor-cloud-ssh.sh contains the new c3b6 pubkey', () => {
  const ssh = fs.readFileSync(SSH_SCRIPT, 'utf8');
  assert.ok(ssh.includes(NEW_PUBKEY), 'new pubkey not present in ssh script');
});

console.log(`\n✅ unicorn-activate-script: ${passed} tests passed\n`);
