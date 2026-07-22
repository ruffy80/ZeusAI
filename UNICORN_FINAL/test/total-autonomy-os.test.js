'use strict';
/**
 * total-autonomy-os.test.js — Total Autonomy OS (TAOS/1.0)
 * Guards the unified autonomy score plane + safe arm envelope.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';
process.env.TAOS_DISABLED = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'totalAutonomyOs.js');
const REAPER = path.join(ROOT, 'scripts', 'orphan-backend-reaper.sh');
const ACTIVATE = path.join(ROOT, 'scripts', 'unicorn-full-activate.sh');
const DEPLOY = path.join(ROOT, 'scripts', 'deploy-local.sh');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const ORPHAN_CRON = path.join(ROOT, 'scripts', 'cron', 'unicorn-orphan-reaper.cron');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('  ✓', name);
  passed += 1;
}

console.log('Total Autonomy OS');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD), 'totalAutonomyOs.js missing');
});

const taos = require(MOD);

check('exports protocol + getStatus/getScore/tick/armSafe', () => {
  assert.strictEqual(taos.PROTOCOL || require(MOD).PROTOCOL, 'TAOS/1.0');
  assert.strictEqual(typeof taos.getStatus, 'function');
  assert.strictEqual(typeof taos.getScore, 'function');
  assert.strictEqual(typeof taos.tick, 'function');
  assert.strictEqual(typeof taos.armSafe, 'function');
  assert.strictEqual(typeof taos.start, 'function');
});

check('tick() returns score 0..100 with pillars + doctrine', () => {
  const snap = taos.tick();
  assert.strictEqual(snap.ok, true);
  assert.strictEqual(snap.protocol, 'TAOS/1.0');
  assert.ok(typeof snap.score === 'number');
  assert.ok(snap.score >= 0 && snap.score <= 100);
  assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(snap.grade));
  assert.ok(Array.isArray(snap.pillars) && snap.pillars.length >= 6);
  assert.ok(String(snap.doctrine).length > 20);
  assert.ok(Array.isArray(snap.next));
  assert.ok(snap.smoke && typeof snap.smoke.ok === 'boolean');
});

check('getScore() is compact', () => {
  const s = taos.getScore();
  assert.strictEqual(s.ok, true);
  assert.ok(typeof s.score === 'number');
  assert.ok(s.grade);
  assert.ok(s.ts);
});

check('mutator_safety pillar passes under DISABLE_SELF_MUTATION=1', () => {
  const snap = taos.tick();
  const mut = snap.pillars.find((p) => p.id === 'mutator_safety');
  assert.ok(mut, 'mutator_safety pillar missing');
  assert.strictEqual(mut.ok, true);
});

check('armSafe refuses when file mutators enabled', () => {
  process.env.ENABLE_FILE_MUTATORS = '1';
  const r = taos.armSafe({ source: 'test' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.refused, true);
  process.env.ENABLE_FILE_MUTATORS = '0';
});

check('armSafe succeeds with mutators off (no throw)', () => {
  const r = taos.armSafe({ source: 'test' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.refused, false);
  assert.ok(r.arm && Array.isArray(r.arm.results));
});

check('gradeFor boundaries', () => {
  const { gradeFor } = require(MOD);
  assert.strictEqual(gradeFor(95), 'S');
  assert.strictEqual(gradeFor(82), 'A');
  assert.strictEqual(gradeFor(70), 'B');
  assert.strictEqual(gradeFor(55), 'C');
  assert.strictEqual(gradeFor(40), 'D');
  assert.strictEqual(gradeFor(10), 'F');
});

check('orphan-backend-reaper.sh exists and is dry-run by default', () => {
  assert.ok(fs.existsSync(REAPER));
  const src = fs.readFileSync(REAPER, 'utf8');
  assert.ok(src.includes('ORPHAN_REAPER_APPLY'));
  assert.ok(src.includes('backend/index.js'));
  assert.ok(src.includes('dry-run'));
});

check('unicorn-full-activate arms TAOS + orphan reaper', () => {
  const src = fs.readFileSync(ACTIVATE, 'utf8');
  assert.ok(src.includes('TOTAL_AUTONOMY_SAFE_ARM=1'));
  assert.ok(src.includes('orphan-backend-reaper.sh'));
  assert.ok(src.includes('totalAutonomyOs'));
});

check('deploy-local post-steps include orphan reaper + taos score', () => {
  const src = fs.readFileSync(DEPLOY, 'utf8');
  assert.ok(src.includes('orphan-backend-reaper.sh'));
  assert.ok(src.includes('/api/autonomy/score') || src.includes('autonomy/os/arm'));
});

check('status page renders Total Autonomy OS panel', () => {
  const src = fs.readFileSync(SHELL, 'utf8');
  assert.ok(src.includes('Total Autonomy OS'));
  assert.ok(src.includes('/api/autonomy/os'));
  assert.ok(src.includes('taosPanel') || src.includes('taosScore'));
  assert.ok(src.includes('pageStatus(params)'), 'pageStatus must accept params for CSP nonce');
  assert.ok(src.includes('<script${N}>') || src.includes('script${N}'), 'status inline script must carry CSP nonce');
});

check('backend wires TAOS routes', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  assert.ok(idx.includes("require('./modules/totalAutonomyOs')"));
  assert.ok(idx.includes('/api/autonomy/os'));
  assert.ok(idx.includes('/api/autonomy/score'));
  assert.ok(idx.includes('/api/autonomy/os/arm'));
  assert.ok(idx.includes('totalAutonomyOs.start'));
});

check('agents.json discovery advertises autonomy score + smoke', () => {
  const src = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(src.includes("/agents.json"), 'agents.json route missing');
  assert.ok(src.includes('autonomy_score'), 'autonomy_score key missing from discovery');
  assert.ok(src.includes('autonomy_smoke'), 'autonomy_smoke key missing from discovery');
  assert.ok(src.includes("'/api/autonomy/score'"), 'autonomy_score endpoint literal missing');
  assert.ok(src.includes("'/api/autonomy/smoke'"), 'autonomy_smoke endpoint literal missing');
  assert.ok(src.includes("'/.well-known/autonomy.json'"), 'autonomy discovery endpoint literal missing');
});

check('shell.js hero exposes statTaos + machine-speed headline', () => {
  const src = fs.readFileSync(SHELL, 'utf8');
  assert.ok(src.includes('id="statTaos"'), 'statTaos hero stat missing');
  assert.ok(src.includes('Ship AI products at machine speed'), 'softened headline missing');
  assert.ok(!/Launch AI products faster\./.test(src), 'legacy headline still present');
});

check('orphan-reaper cron installs from /var/www/unicorn', () => {
  const src = fs.readFileSync(ORPHAN_CRON, 'utf8');
  assert.ok(src.includes('/var/www/unicorn/UNICORN_FINAL/scripts/orphan-backend-reaper.sh'),
    'cron must point at /var/www/unicorn path');
  assert.ok(!src.includes('/opt/unicorn/UNICORN_FINAL/scripts/orphan-backend-reaper.sh'),
    'stale /opt path still present in cron');
  assert.ok(src.includes('ORPHAN_REAPER_APPLY=0'), 'cron must default to dry-run');
  assert.ok(src.includes('/var/log/unicorn/'), 'cron log dir note missing');
});

console.log(`\n✅ total-autonomy-os: ${passed} tests passed`);
process.exit(0);
