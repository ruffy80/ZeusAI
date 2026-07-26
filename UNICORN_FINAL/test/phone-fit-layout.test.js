'use strict';
/**
 * Phone-fit layout contract — prevents ~390px horizontal overflow from
 * fixed minmax(320|380px) grids and dual-column SSR shells.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'src/site/v2/styles.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
const autoheal = fs.readFileSync(path.join(root, 'scripts/autoheal-min.sh'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'scripts/deploy-atomic-forward.sh'), 'utf8');
const eco = fs.readFileSync(path.join(root, 'ecosystem.config.js'), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

check('styles declare PHONE FIT media block', () => {
  assert.ok(styles.includes('PHONE FIT'), 'phone-fit marker');
  assert.ok(styles.includes('.svc-grid-ssr'), 'svc-grid collapse');
  assert.ok(styles.includes('.op-grid-ssr'), 'op-grid collapse');
  assert.ok(styles.includes('.phone-stack'), 'phone-stack utility');
  assert.ok(styles.includes('overflow-x:clip'), 'clip horizontal overflow');
  assert.ok(styles.includes('#entProductsGrid'), 'enterprise products grid');
});

check('shell uses viewport-safe minmax for enterprise/store grids', () => {
  assert.ok(shell.includes('minmax(min(380px,100%),1fr)'), 'ent products safe minmax');
  assert.ok(shell.includes('minmax(min(320px,100%),1fr)'), 'ent modules / store safe minmax');
  assert.ok(!/minmax\(380px,1fr\)/.test(shell), 'no raw 380px minmax');
  assert.ok(shell.includes('class="grid op-grid-ssr phone-stack"'), 'order passport single class attr');
  assert.ok(!/class="grid"[^>]*class="op-grid-ssr"/.test(shell), 'no duplicate class= on op grid');
  assert.ok(shell.includes('phone-stack'), 'phone-stack markers present');
});

check('client account grid uses viewport-safe minmax', () => {
  assert.ok(client.includes('minmax(min(320px,100%),1fr)'), 'account login safe minmax');
});

check('healers respect cold-boot grace + safer defaults', () => {
  assert.ok(autoheal.includes('BOOT_GRACE'), 'autoheal boot grace');
  assert.ok(autoheal.includes('AUTOHEAL_MIN_FAIL_STREAK:-5'), 'fail streak default 5');
  assert.ok(deploy.includes('rescue-backend'), 'deploy rejects rescue script');
  assert.ok(deploy.includes('verify unicorn-backend script is backend/index.js'), 'deploy script check');
  assert.ok(deploy.includes('neutralize unicorn-safe-watchdog'), 'deploy neuters rescue watchdog');
  assert.ok(/QIS_AUTO_HEAL_ENABLED:\s*process\.env\.QIS_AUTO_HEAL_ENABLED\s*\|\|\s*'false'/.test(eco),
    'QIS auto-heal default false');
});

console.log('phone-fit-layout.test.js passed');
process.exit(0);
