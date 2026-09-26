'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.AACOS_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('LAR snapshot is honest and has AACOS ledger shape', () => {
  const lar = require('../backend/modules/live-action-receipts');
  const snap = lar.snapshot(10);
  assert.equal(lar.PROTOCOL, 'LAR/1.0');
  assert.equal(snap.ok, true);
  assert.equal(snap.inventsGmv, false);
  assert.equal(snap.inventsReach, false);
  assert.equal(snap.inventsPosts, false);
  assert.ok(!('revenueForecast' in snap), 'never surface invented oracle GMV');
  assert.ok(snap.aacos, 'aacos block');
  assert.ok(Array.isArray(snap.aacos.actions));
  assert.ok(Array.isArray(snap.whyYouSeeNothing));
});

check('AACOS discovery explains the skip', () => {
  const aacos = require('../backend/modules/autonomy-action-continuum-os');
  const d = aacos.discovery();
  assert.ok(typeof d.whyYouSeeNothing === 'string');
  assert.ok(d.whyYouSeeNothing.includes('/live-actions'));
});

check('healer idle under stable still reports a pulse clock', () => {
  const healer = require('../backend/modules/unicornSelfHealer');
  const st = healer.getStatus();
  assert.equal(st.active, false);
  assert.equal(st.idle, true);
  assert.ok(st.idleReason);
  assert.ok(st.lastCheck, 'idle pulse stamps lastCheck so the module is not a silent zero');
});

check('backend + site wire live-receipts', () => {
  const be = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
  const site = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  const shell = fs.readFileSync(path.join(ROOT, 'src/site/v2/shell.js'), 'utf8');
  assert.ok(be.includes('/api/autonomy/live-receipts'));
  assert.ok(site.includes('/api/autonomy/live-receipts'));
  assert.ok(site.includes("'/live-actions'"));
  assert.ok(shell.includes('function pageLiveActions'));
  assert.ok(shell.includes("case '/live-actions'"));
  assert.ok(shell.includes("L('/live-actions', 'Live actions')"));
  assert.ok(shell.includes('minmax(min(320px,100%),1fr)'));
});

console.log('live-action-receipts.test.js passed ·', passed);
process.exit(0);
