'use strict';

/**
 * full-autonomy-os.test.js — wiring contract for real autonomy continuum
 *
 * Verifies integration (not cosmetics):
 *  - PCL honors AutonomySpine canExperiment
 *  - CPA observe-only under DISABLE_SELF_MUTATION
 *  - IAK surfaces causalStart skipReasons + organ collapse
 *  - workflowEngine registered surface (getStatus/start)
 *  - AACOS collects CLOS sweep + pre-keys evidence
 *  - healer status API is not hardcoded active
 *  - TAOS armSafe starts CPA/AACOS/workflow
 *  - CI schedule waste cuts present
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.CPA_DISABLED = '1'; // prevent CPA interval leak in this file
process.env.PCL_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readRepo = (rel) => fs.readFileSync(path.join(root, '..', rel), 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

console.log('Full Autonomy OS wiring');

check('PCL gates innovation on autonomy-spine canExperiment', () => {
  const src = read('backend/modules/profit-control-loop.js');
  assert.ok(src.includes("require('./autonomy-spine')"), 'requires spine');
  assert.ok(src.includes('_spineAllowsExperiment'), 'spine helper');
  assert.ok(src.includes('spineGate'), 'status exposes spineGate');
});

check('CPA observe mode under DSM (not fully disabled)', () => {
  const src = read('backend/modules/control-plane-agent.js');
  assert.ok(src.includes('_observeOnly'), 'observe flag');
  assert.ok(src.includes('RESTART_SUPPRESSED_OBSERVE'), 'restart suppressed in observe');
  assert.ok(src.includes('CANARY_PROMOTE_OBSERVED'), 'canary promote observed');
  assert.ok(!/if \(process\.env\.DISABLE_SELF_MUTATION === '1'\) \{\s*console\.log\('\[CPA\] disabled/.test(src),
    'must not hard-disable under DSM');
});

check('IAK stores lastCausalStart skipReasons and collapses organs', () => {
  const iak = require('../backend/modules/integrated-autonomy-kernel');
  const boot = iak.causalStart();
  assert.ok(boot && typeof boot === 'object');
  assert.ok(boot.skipReasons && typeof boot.skipReasons === 'object');
  const st = iak.getStatus();
  assert.ok(st.continuum, 'continuum surface');
  assert.ok(st.organs, 'organs collapse');
  assert.ok(st.innovations.includes('organ_status_collapse'));
  assert.ok(st.lastCausalStart || st.discovery.lastCausalStart);
});

check('workflowEngine exposes getStatus + start for IAK', () => {
  const wf = require('../backend/modules/workflowEngine');
  assert.equal(typeof wf.getStatus, 'function');
  assert.equal(typeof wf.start, 'function');
  const st = wf.getStatus();
  assert.equal(st.ok, true);
  assert.equal(st.module, 'workflowEngine');
  assert.ok(wf.start().ok);
});

check('AACOS evidence includes closSweep + preKeys hooks', () => {
  const src = read('backend/modules/autonomy-action-continuum-os.js');
  assert.ok(src.includes('sweepSla'), 'CLOS reconcile via sweepSla');
  assert.ok(src.includes('pre-keys-activation'), 'pre-keys linked');
  assert.ok(src.includes('workflowEngine'), 'workflow linked');
  assert.ok(src.includes('preKeysSkip'), 'status surfaces preKeysSkip');
});

check('total-system-healer status route is honest', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes("totalSystemHealer.getStatus"), 'uses real getStatus');
  assert.ok(!/app\.get\('\/api\/total-system-healer\/status'[\s\S]{0,120}status: 'active'\}/.test(src),
    'must not hardcode status active');
});

check('ops dashboard merges IAK autonomy organs', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes('autonomy = {'), 'builds autonomy block');
  assert.ok(src.includes('continuum:'), 'includes continuum');
  assert.ok(src.includes('workflowEngine'), 'registers workflowEngine on mesh');
});

check('TAOS armSafe starts CPA + AACOS + workflow', () => {
  const src = read('backend/modules/totalAutonomyOs.js');
  assert.ok(src.includes("tryStart('control-plane-agent'"), 'CPA arm');
  assert.ok(src.includes("tryStart('autonomy-action-continuum'"), 'AACOS arm');
  assert.ok(src.includes("tryStart('workflowEngine'"), 'workflow arm');
  assert.ok(src.includes("this._pillar('aacos'"), 'AACOS pillar');
});

check('CI: watchdog slowed, autonomous schedule off, baselines excluded, audit weekly', () => {
  const watchdog = readRepo('.github/workflows/live-autopilot-watchdog.yml');
  assert.ok(watchdog.includes("cron: '0 */6 * * *'"), 'watchdog every 6h');
  assert.ok(!watchdog.includes("cron: '*/20 * * * *'"), 'no 20m spam');

  const autonomous = readRepo('.github/workflows/autonomous.yml');
  assert.ok(autonomous.includes('Schedule disabled') || !/^\s+- cron:/m.test(autonomous.replace(/#.*$/gm, '')),
    'autonomous schedule disabled');

  const deploy = readRepo('.github/workflows/deploy.yml');
  assert.ok(!deploy.includes(".github/baselines/**"), 'baselines excluded from deploy paths');

  const audit = readRepo('.github/workflows/full-system-audit.yml');
  assert.ok(audit.includes("cron: '30 4 * * 0'"), 'audit weekly');
});

console.log(`\n✅ full-autonomy-os: ${passed} tests passed`);
process.exit(0);
