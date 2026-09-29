'use strict';

/**
 * LHOS/1.0 — Live Honesty Operating System
 * Measured public truth. No 99.97%, no 169 theater modules, no demo-user.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.LIVE_HONESTY = '1';
process.env.SAFE_EVOLVE = '1';
process.env.SAFE_APPLY = '1';
process.env.INNOVATION_GENERATE = '0';
process.env.INNOVATION_AUTO_SHIP = '0';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lhos-'));
process.env.SAFE_APPLY_ROOT = tmp;
process.env.INNOVATION_SHIPPED_DIR = path.join(tmp, 'data', 'innovations', 'shipped');
process.env.SAFE_PATCH_DIR = path.join(tmp, 'data', 'patches');
process.env.SAFE_CHANGED_PATH = path.join(tmp, 'data', 'evolution', 'changed.jsonl');
process.env.SAFE_APPLY_SEEN = path.join(tmp, 'data', 'evolution', 'applied-hashes.json');

const ROOT = path.join(__dirname, '..');
const lhos = require('../backend/modules/live-honesty-os');
const apply = require('../backend/modules/safe-apply-os');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('✓', name);
    });
}

async function run() {
  await check('protocol + theater filter', () => {
    assert.equal(lhos.PROTOCOL, 'LHOS/1.0');
    assert.equal(lhos.isTheaterId('AdaptiveModule01'), true);
    assert.equal(lhos.isTheaterId('Engine12'), true);
    assert.equal(lhos.isTheaterId('demo-user'), true);
    assert.equal(lhos.isTheaterId('origin-gravity-os'), false);
    const pub = lhos.filterPublicMarketplace([
      { id: 'AdaptiveModule01', title: 'Adaptive Module 01' },
      { id: 'instant-seo-content-pack', title: 'SEO pack' },
      { id: 'Engine7', title: 'Engine 7' },
    ]);
    assert.equal(pub.length, 1);
    assert.equal(pub[0].id, 'instant-seo-content-pack');
  });

  await check('statusSnapshot never invents 99.97 or latency', () => {
    const snap = lhos.statusSnapshot();
    assert.equal(snap.protocol, 'LHOS/1.0');
    assert.equal(snap.uptime90d, null);
    assert.equal(snap.inventsUptime, false);
    assert.equal(snap.inventsHumans, false);
    assert.equal(snap.inventsLatency, false);
    assert.ok(typeof snap.uptimeSec === 'number');
    assert.ok(typeof snap.catalogCount === 'number');
    assert.ok(typeof snap.paidHumans === 'number');
    assert.ok(typeof snap.realModuleCount === 'number');
    assert.ok(snap.realModuleCount > 10, 'real modules should outnumber a handful of named cores');
    assert.ok(Array.isArray(snap.components) && snap.components.length >= 4);
    for (const c of snap.components) {
      assert.equal(c.latencyMs, null);
    }
    const raw = JSON.stringify(snap);
    assert.ok(!raw.includes('99.97'));
    assert.ok(!/demo-user/.test(raw));
  });

  await check('honest telemetry + trust + drill seed', () => {
    const tel = lhos.honestTelemetry();
    assert.equal(tel.moduleHealth, null);
    assert.equal(tel.aiGrowth, null);
    assert.ok(typeof tel.moduleCount === 'number');
    const trust = lhos.honestTrustLedger(3, 1);
    assert.equal(trust.inventsTrust, false);
    assert.equal(trust.integrityScore, null);
    assert.equal(trust.signedReceipts, 3);
    const drill = lhos.drillSeed();
    assert.equal(drill.status, 'never_run');
    assert.equal(drill.score, null);
    assert.equal(drill.avgRecoveryMs, null);
  });

  await check('rejected source specs remap to data/patches held files and apply', () => {
    const specs = apply.specsFromShip({
      decisions: [{
        id: 'src-mut-held',
        decision: 'rejected',
        safety: 'describes_source_mutation',
      }],
    });
    assert.equal(specs.length, 1);
    assert.ok(specs[0].targetPaths[0].startsWith('data/patches/held-'));
    assert.ok(!String(specs[0].targetPaths[0]).includes('backend/modules/_held.js'));
    const r = apply.applyFromShip({
      decisions: [{
        id: 'src-mut-held-2',
        decision: 'rejected',
        safety: 'targets_source_or_runtime_paths',
      }],
    }, { force: true });
    return Promise.resolve(r).then((out) => {
      assert.equal(out.ok, true);
      assert.ok(out.applied >= 1, 'held patch should apply on the data plane');
      const heldDir = path.join(tmp, 'data', 'patches');
      const files = fs.readdirSync(heldDir).filter((f) => f.startsWith('held-'));
      assert.ok(files.length >= 1);
      const body = fs.readFileSync(path.join(heldDir, files[0]), 'utf8');
      assert.ok(!body.includes('backend/modules/_held.js'));
    });
  });

  await check('innovator clamps unsafe paths', () => {
    const innovator = require('../backend/modules/unicornInnovator');
    const clamped = innovator.clampSafePaths(['backend/modules/unicornBrain.js', 'docs/seo/landing-brief.md'], 'idea-x');
    assert.ok(clamped.includes('docs/seo/landing-brief.md'));
    assert.ok(clamped.some((p) => p.startsWith('data/patches/held-')));
    assert.ok(!clamped.some((p) => p.startsWith('backend/')));
  });

  await check('backend /api/status is JSON LHOS, engine prefers unicornInnovator, future-innovation is 410', () => {
    const be = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
    assert.ok(be.includes("app.get('/api/status', _liveHonestyHandler)"));
    assert.ok(be.includes("require('./modules/live-honesty-os')"));
    assert.ok(be.includes('const primary = unicornInnovator'));
    assert.ok(!/function _selectInnovationEngine\(\) \{\s*const primary = autonomousInnovation/.test(be));
    assert.ok(be.includes("status: 'speculative'"));
    assert.ok(be.includes('speculative_not_executable'));
    assert.ok(be.includes('res.status(410)'));
  });

  await check('site snapshot/hero/client drop theater numbers', () => {
    const site = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
    const client = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'client.js'), 'utf8');
    const frontier = fs.readFileSync(path.join(ROOT, 'src', 'frontier-engine.js'), 'utf8');
    assert.ok(site.includes('const userProfile = null'));
    assert.ok(site.includes("state: 'IDLE_BACKEND_UNREACHABLE'"));
    assert.ok(!site.includes('AUTONOMOUS_VIRAL_GROWTH_ACTIVE'));
    assert.ok(!site.includes('moduleHealth: 97'));
    assert.ok(!site.includes('Math.sin(uptime / 37)'));
    assert.ok(!site.includes('avgRecoveryMs: 420'));
    assert.ok(!/id="statModules">169</.test(shell));
    assert.ok(shell.includes('id="statModules">—'));
    assert.ok(shell.includes('lhos-fallback-banner'));
    assert.ok(shell.includes('not sampled'));
    assert.ok(!shell.includes('169 living modules'));
    assert.ok(!client.includes('|| 169'));
    assert.ok(!client.includes('|| 18'));
    assert.ok(frontier.includes("require('../backend/modules/live-honesty-os')"));
    assert.ok(!frontier.includes('uptime90d: 99.97'));
  });

  await check('nginx + IAK/DPAK/NAOS/TAOS/SECOS wire LHOS', () => {
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /api/status'));
    const disco = require('../backend/modules/iak/module-discovery');
    const dpak = require('../backend/modules/world-standard/dual-plane-autonomy-kernel');
    const naos = require('../backend/modules/neural-autonomy-os');
    assert.ok(disco.STABLE_START_ALLOW.has('live-honesty-os'));
    assert.ok(dpak.SAFE_ORGANS.includes('live-honesty-os'));
    const organs = naos.composeOrgans().map((o) => o.id);
    assert.ok(organs.includes('lhos'));
    const taos = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'totalAutonomyOs.js'), 'utf8');
    const taac = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'total-autonomy-activation-continuum.js'), 'utf8');
    const secos = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'safe-evolution-os.js'), 'utf8');
    const healer = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'unicornSelfHealer.js'), 'utf8');
    assert.ok(taos.includes("tryStart('live-honesty-os'"));
    assert.ok(taac.includes("_try('lhos'"));
    assert.ok(secos.includes("require('./live-honesty-os')"));
    assert.ok(healer.includes('alwaysTrue: false'));
    assert.ok(!/function authGuardian\(\) \{\s*return \{ authOk: true/.test(healer));
  });

  console.log('live-honesty-os.test.js passed ·', passed);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('live-honesty-os.test.js failed:', err);
  process.exit(1);
});
