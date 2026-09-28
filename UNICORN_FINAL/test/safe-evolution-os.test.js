'use strict';

/**
 * SECOS/1.0 — Safe Evolution Continuum
 * Innovate + ship data/docs artifacts + healer observe under stable.
 * Never mutates source. Never invents GMV.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.INNOVATION_GENERATE = '0';
process.env.INNOVATION_AUTO_SHIP = '0';
process.env.SAFE_EVOLVE = '1';
delete process.env.SAFE_EVOLVE_TEST;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'secos-'));
process.env.SAFE_EVOLVE_DATA_DIR = path.join(tmp, 'evolution');
process.env.INNOVATION_SHIPPED_DIR = path.join(tmp, 'shipped');
process.env.INNOVATOR_DATA_DIR = path.join(tmp, 'innovator');
process.env.SAFE_APPLY_SEEN = path.join(tmp, 'applied-hashes.json');

const secos = require('../backend/modules/safe-evolution-os');
const innovator = require('../backend/modules/unicornInnovator');
const shipGate = require('../backend/modules/innovation-ship-gate');
const healer = require('../backend/modules/unicornSelfHealer');

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
  await check('SAFE_EVOLVE default plane is on under stable even when GENERATE=0', () => {
    assert.equal(secos.PROTOCOL, 'SECOS/1.0');
    assert.equal(secos.enabled(), true);
    assert.equal(innovator.innovationGenerationEnabled(), true);
    assert.equal(shipGate.autoShipEnabled(), false);
    const allow = shipGate.runtimeAllowsShip();
    assert.equal(allow.ok, true);
    assert.equal(allow.reason, 'safe_artifact_plane');
  });

  await check('start() skips interval under NODE_ENV=test', () => {
    const r = secos.start();
    assert.equal(r.testSkip, true);
    assert.equal(secos.getStatus().armed, false);
  });

  await check('tick generates + evaluates + observes without mutating source', async () => {
    const beforeInn = innovator.getStatus();
    const beforeHeal = healer.getStatus();
    const out = await secos.tick();
    assert.equal(out.ok, true);
    assert.equal(out.protocol, 'SECOS/1.0');
    assert.ok(out.innovator);
    assert.ok(out.ship);
    assert.ok(out.healer);
    assert.ok(out.apply);
    const afterInn = innovator.getStatus();
    const afterHeal = healer.getStatus();
    assert.ok(afterInn.cycles > beforeInn.cycles, 'innovator cycle advanced');
    assert.ok(afterInn.generated > beforeInn.generated, 'commerce idea generated');
    assert.ok(afterHeal.cycles > beforeHeal.cycles, 'healer observe cycle advanced');
    assert.ok(afterHeal.modulesScanned > 0, 'modules scanned');
    assert.equal(afterHeal.active, false);
    assert.equal(afterHeal.idle, true);
    const st = secos.getStatus();
    assert.equal(st.mutatesSource, false);
    assert.equal(st.inventsGmv, false);
    assert.ok(st.ticks >= 1);
    assert.ok(Array.isArray(st.recent) && st.recent.length >= 1);
    const ledger = path.join(process.env.SAFE_EVOLVE_DATA_DIR, 'safe-ledger.jsonl');
    assert.ok(fs.existsSync(ledger), 'evolution ledger written');
  });

  await check('observeCycle source never calls processGuardian', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/modules/unicornSelfHealer.js'), 'utf8');
    const observe = src.split('function observeCycle()')[1].split('function _idlePulse')[0];
    assert.ok(observe.includes('moduleScanner()'));
    assert.ok(!observe.includes('processGuardian()'));
  });

  await check('SAFE_EVOLVE=0 stops tick unless forced', async () => {
    process.env.SAFE_EVOLVE = '0';
    assert.equal(secos.enabled(), false);
    const blocked = await secos.tick();
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'SAFE_EVOLVE=0');
    const forced = await secos.tick({ force: true });
    assert.equal(forced.ok, true);
    process.env.SAFE_EVOLVE = '1';
  });

  await check('ship-gate still rejects source paths', () => {
    const gate = require('../backend/modules/innovation-ship-gate');
    return gate.evaluateAndShip({
      getPending: () => [{
        id: 'src-mut',
        title: 'rewrite module backend/modules/unicornBrain.js',
        description: 'edit code and rewrite module source mutation',
        targetPaths: ['backend/modules/unicornBrain.js'],
        score: 0.99,
      }],
      approve: () => ({ ok: true }),
      reject: () => ({ ok: true }),
    }).then((r) => {
      assert.equal(r.ok, true);
      const dec = (r.decisions || [])[0];
      assert.ok(dec);
      assert.notEqual(dec.decision, 'approved');
    });
  });

  await check('LAR + site wire SECOS', () => {
    const lar = require('../backend/modules/live-action-receipts');
    const snap = lar.snapshot(6);
    assert.ok(snap.evolution);
    assert.equal(snap.evolution.protocol, 'SECOS/1.0');
    assert.equal(snap.evolution.mutatesSource, false);
    assert.ok(snap.supreme && snap.supreme.innovator);
    assert.ok('skippedDupes' in snap.supreme.innovator);
    const be = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
    const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
    assert.ok(be.includes("require('./modules/safe-evolution-os')"));
    assert.ok(be.includes('secos.start()'));
    assert.ok(site.includes('/api/safe-evolution-os/status'));
    assert.ok(shell.includes('SECOS ticks'));
    assert.ok(shell.includes('Safe Evolution Continuum'));
    assert.ok(shell.includes('skippedDupes'));
  });

  await check('pending persists and survives empty in-memory queue without generate-time seen stall', () => {
    const dir = process.env.INNOVATOR_DATA_DIR;
    const pendingFile = path.join(dir, 'pending.json');
    const inv = innovator.autonomousInnovator();
    assert.ok(inv, 'fresh idea after empty pending');
    assert.ok(fs.existsSync(pendingFile), 'pending.json written');
    const disk = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    assert.ok((disk.items || []).length >= 1);
    const again = innovator.autonomousInnovator();
    if (again) {
      assert.notEqual(again.contentHash, inv.contentHash, 'does not re-queue same hash');
    }
    const src = fs.readFileSync(path.join(__dirname, '../backend/modules/unicornInnovator.js'), 'utf8');
    assert.ok(src.includes('alreadyQueuedOrApplied'));
    assert.ok(src.includes('markApplied'));
    assert.ok(!/markSeen\(hash\);\s*\n\s*state\.lastDefectKind/.test(src), 'must not markSeen at generate time');
  });

  await check('TAAC/TAOS/IAK/DPAK/NAOS re-arm and surface SECOS', () => {
    const taac = fs.readFileSync(path.join(__dirname, '../backend/modules/total-autonomy-activation-continuum.js'), 'utf8');
    const taos = fs.readFileSync(path.join(__dirname, '../backend/modules/totalAutonomyOs.js'), 'utf8');
    const iak = fs.readFileSync(path.join(__dirname, '../backend/modules/integrated-autonomy-kernel.js'), 'utf8');
    const dpak = require('../backend/modules/world-standard/dual-plane-autonomy-kernel');
    const disco = require('../backend/modules/iak/module-discovery');
    const naos = require('../backend/modules/neural-autonomy-os');
    assert.ok(taac.includes("_try('secos'"));
    assert.ok(taac.includes('secos.start'));
    assert.ok(taos.includes("tryStart('safe-evolution-os'"));
    assert.ok(iak.includes("soft('secos'"));
    assert.ok(iak.includes("soft('saos'"));
    assert.ok(dpak.SAFE_ORGANS.includes('safe-evolution-os'));
    assert.ok(dpak.SAFE_ORGANS.includes('safe-apply-os'));
    assert.ok(disco.STABLE_START_ALLOW.has('safe-evolution-os'));
    assert.ok(disco.STABLE_START_ALLOW.has('unicornInnovator'));
    const organs = naos.composeOrgans().map((o) => o.id);
    assert.ok(organs.includes('secos'));
  });

  console.log('safe-evolution-os.test.js passed ·', passed);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('safe-evolution-os.test.js failed:', err);
  process.exit(1);
});
