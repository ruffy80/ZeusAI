'use strict';

/**
 * IAK safe-autonomy plane — master orchestrator owns TAAC activation.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TAAC_DISABLED = '1';
process.env.DISABLE_BILLION_AUTONOMY_LOOP = '0';
process.env.IAK_HARMONIC_MS = '60000';
process.env.TAAC_DATA_DIR = require('os').tmpdir() + '/iak-taac-' + Date.now();

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const iak = require('../backend/modules/integrated-autonomy-kernel');
const dpak = require('../backend/modules/world-standard/dual-plane-autonomy-kernel');

let passed = 0;
function check(name, fn) {
  const r = fn();
  if (r && typeof r.then === 'function') {
    return r.then(() => { console.log('✓', name); passed += 1; })
      .catch((e) => { console.error('✗', name); console.error(e); process.exit(1); });
  }
  console.log('✓', name);
  passed += 1;
  return Promise.resolve();
}

async function main() {
  await check('DPAK recommends safe-autonomy under stable', () => {
    const rec = dpak.recommendIakMode();
    assert.equal(rec.mode, 'safe-autonomy');
    assert.equal(rec.guardianMode, 'idle');
    assert.equal(rec.ensureFacets, false);
  });

  await check('IAK starts in safe-autonomy as master', () => {
    iak.stop();
    const st = iak.start({ mode: 'safe-autonomy', ensureFacets: false, guardianMode: 'idle' });
    assert.equal(st.mode, 'safe-autonomy');
    assert.equal(st.master, true);
    assert.equal(st.safeAutonomy, true);
    assert.equal(st.policy.inventGmv, 'never');
  });

  await check('IAK organ collapse includes taac/agde/balos/rivos/traffic', () => {
    const st = iak.getStatus();
    assert.ok(st.organs);
    assert.ok('taac' in st.organs || st.organs.taac);
    assert.ok('agde' in st.organs);
    assert.ok('balos' in st.organs);
    assert.ok('rivos' in st.organs);
    assert.ok('traffic' in st.organs);
    assert.ok(st.innovations.includes('safe_autonomy_plane'));
    assert.ok(st.innovations.includes('taac_master_activation'));
  });

  await check('ensureSafeAutonomyActivation queues TAAC armAll', async () => {
    const r = await Promise.resolve(iak.ensureSafeAutonomyActivation({ source: 'test', dryRun: true }));
    assert.ok(r.ok === true || r.queued === true || r.dryRun === true || r.plan);
  });

  await check('heal skips mutators under safe-autonomy (mode gate)', () => {
    // Register a fake unhealthy mutator — heal phase must not crash
    iak.register('fake-mutator-test', {
      getStatus: () => ({ ok: false, health: 'error' }),
      heal: () => { throw new Error('should_not_heal_mutator'); },
    }, { tier: 'mutator', dependsOn: [] });
    const entry = iak.registry.get('fake-mutator-test');
    entry.healthy = false;
    entry.depsReady = true;
    iak._phaseHeal();
    assert.equal(iak.mode, 'safe-autonomy');
  });

  await check('boot + routes wire safe-autonomy + autonomy/master', () => {
    const be = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(be.includes("safe-autonomy"));
    assert.ok(be.includes('/api/autonomy/master'));
    assert.ok(be.includes('ensureSafeAutonomyActivation'));
    const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
    assert.ok(site.includes('/.well-known/autonomy-master.json'));
  });

  iak.stop();
  console.log('\n✅ iak-safe-autonomy:', passed, 'tests passed');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
