'use strict';
/**
 * unicorn-absolute-autonomy.test.js
 * Guards the FULL Unicorn autonomous activation:
 *   - frontierAI + marketAnalytics are REAL modules exposing getStatus/process
 *   - the standalone autonomous PM2 runner exists and requires --autonomous
 *   - unicorn-full-activate.sh starts the zeus-* runners, creates the
 *     /root/ZeusAI owner symlink, and installs a read-only self-heal audit cron
 *   - nothing in the activation path writes stub module source
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_SELF_CONSTRUCTION = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const MODULES = path.join(ROOT, 'backend', 'modules');

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}
async function checkAsync(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

// ── Module: frontierAI ───────────────────────────────────────────────────────
const frontierAI = require(path.join(MODULES, 'frontierAI.js'));

check('frontierAI exports getStatus + process', () => {
  assert.strictEqual(typeof frontierAI.getStatus, 'function');
  assert.strictEqual(typeof frontierAI.process, 'function');
});

check('frontierAI.getStatus() reports active + autonomy coverage', () => {
  const st = frontierAI.getStatus();
  assert.strictEqual(st.status, 'active');
  assert.strictEqual(st.module, 'frontierAI');
  assert.ok(typeof st.autonomyCoverage === 'number', 'autonomyCoverage is numeric');
  assert.ok(st.autonomyCoverage >= 0 && st.autonomyCoverage <= 100, 'coverage in 0..100');
  assert.ok(Array.isArray(st.enabledProviders), 'enabledProviders is an array');
});

// ── Module: marketAnalytics ─────────────────────────────────────────────────
const marketAnalytics = require(path.join(MODULES, 'marketAnalytics.js'));

check('marketAnalytics exports getStatus + process', () => {
  assert.strictEqual(typeof marketAnalytics.getStatus, 'function');
  assert.strictEqual(typeof marketAnalytics.process, 'function');
});

check('marketAnalytics.getStatus() reports active + tracked categories', () => {
  const st = marketAnalytics.getStatus();
  assert.strictEqual(st.status, 'active');
  assert.strictEqual(st.module, 'marketAnalytics');
  assert.ok(st.trackedCategories >= 1, 'tracks at least one category');
  assert.ok(Array.isArray(st.top), 'top is an array');
});

// ── Existing essential modules gain getStatus/process without destruction ────
check('essential modules all expose getStatus + process', () => {
  const names = [
    'quantumPaymentNexus',
    'aiNegotiator',
    'selfConstruction',
    'autoDeploy',
    'domainAutomationManager',
  ];
  for (const n of names) {
    const mod = require(path.join(MODULES, `${n}.js`));
    assert.strictEqual(typeof mod.getStatus, 'function', `${n} must export getStatus`);
    assert.strictEqual(typeof mod.process, 'function', `${n} must export process`);
  }
});

check('selfConstruction still exposes audit + start (existing logic preserved)', () => {
  const sc = require(path.join(MODULES, 'selfConstruction.js'));
  assert.strictEqual(typeof sc.audit, 'function', 'audit() preserved');
  assert.strictEqual(typeof sc.start, 'function', 'start() preserved');
});

// ── Autonomous PM2 runner ────────────────────────────────────────────────────
const RUNNER = path.join(SCRIPTS, 'zeus-module-autonomous.js');

check('zeus-module-autonomous.js exists and requires --autonomous', () => {
  assert.ok(fs.existsSync(RUNNER), 'runner script missing');
  const src = fs.readFileSync(RUNNER, 'utf8');
  assert.ok(src.includes('--autonomous'), 'runner must mention --autonomous');
  assert.match(src, /refusing to run without --autonomous/i, 'runner must guard the flag');
  // Must never apply skeletons via selfConstruction.
  assert.match(src, /start\(\{\s*apply:\s*false/, 'runner must call start with apply:false');
  assert.doesNotMatch(src, /start\(\s*\{\s*apply:\s*true/, 'runner must never call start({apply:true})');
});

// ── Self-heal audit script (read-only) ───────────────────────────────────────
const AUDIT = path.join(SCRIPTS, 'zeus-selfheal-audit.js');
check('zeus-selfheal-audit.js exists and is read-only (audit, never apply)', () => {
  assert.ok(fs.existsSync(AUDIT), 'audit script missing');
  const src = fs.readFileSync(AUDIT, 'utf8');
  assert.match(src, /\.audit\(\)/, 'must call selfConstruction.audit()');
  assert.doesNotMatch(src, /\.start\(\s*\{\s*apply\s*:\s*true/, 'must never apply');
});

// ── Activation script ─────────────────────────────────────────────────────────
const ACTIVATE = path.join(SCRIPTS, 'unicorn-full-activate.sh');
const activate = fs.readFileSync(ACTIVATE, 'utf8');

check('activate starts all seven zeus-* runners', () => {
  for (const name of [
    'zeus-payments',
    'zeus-negotiator',
    'zeus-selfheal',
    'zeus-deploy',
    'zeus-dns',
    'zeus-analytics',
    'zeus-frontier',
  ]) {
    assert.ok(activate.includes(name), `activate must start ${name}`);
  }
  assert.ok(activate.includes('zeus-module-autonomous.js'), 'activate must invoke the runner');
  assert.match(activate, /--autonomous/, 'runners must be started with --autonomous');
});

check('activate creates the /root/ZeusAI owner symlink', () => {
  assert.ok(activate.includes('/root/ZeusAI'), 'must reference /root/ZeusAI');
  assert.match(activate, /ln -sfn "\$DEPLOY_LINK" "\$OWNER_ROOT\/UNICORN_FINAL"/,
    'must symlink /root/ZeusAI/UNICORN_FINAL to the deploy link');
});

check('activate does NOT write stub module source (module.exports = { run)', () => {
  assert.doesNotMatch(activate, /module\.exports = \{ run/, 'must not write stub module.exports run');
  assert.doesNotMatch(activate, /echo\s+["']module\.exports/, 'must not echo stub modules');
});

// ── process({action:'tick'}) works for the new modules (async) ────────────────
(async () => {
  await checkAsync('frontierAI.process({action:"tick"}) succeeds', async () => {
    const res = await frontierAI.process({ action: 'tick' });
    assert.strictEqual(res.ok, true, 'tick ok');
    assert.strictEqual(res.action, 'tick');
    assert.ok(res.ticks >= 1, 'tick counter advanced');
  });

  await checkAsync('marketAnalytics.process({action:"tick"}) succeeds', async () => {
    const res = await marketAnalytics.process({ action: 'tick' });
    assert.strictEqual(res.ok, true, 'tick ok');
    assert.strictEqual(res.action, 'tick');
    assert.ok(res.ticks >= 1, 'tick counter advanced');
  });

  await checkAsync('marketAnalytics.process({action:"signal"}) ranks demand', async () => {
    await marketAnalytics.process({ action: 'signal', category: 'ai-services', weight: 10 });
    const rep = await marketAnalytics.process({ action: 'report' });
    assert.strictEqual(rep.ok, true);
    assert.ok(Array.isArray(rep.rankings) && rep.rankings.length >= 1, 'rankings present');
  });

  // Modules that register timers (frontierAI/marketAnalytics) may keep the
  // event loop alive; stop them so the test process exits cleanly.
  try { frontierAI.stop(); } catch (_) { /* ignore */ }
  try { marketAnalytics.stop(); } catch (_) { /* ignore */ }

  console.log(`\n✅ unicorn-absolute-autonomy: ${passed} tests passed\n`);
  process.exit(0);
})().catch((e) => {
  console.error('✗ unicorn-absolute-autonomy FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
