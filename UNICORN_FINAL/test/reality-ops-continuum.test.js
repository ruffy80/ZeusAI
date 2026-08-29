'use strict';

/**
 * ROCS/1.0 — Reality Ops Continuum tests
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ROCS_DISABLED = '1';
process.env.ROCS_AUTO_REMEDIATE = '0';
process.env.FAKE_OBS_METRICS = '0';
process.env.ROCS_DATA_DIR = require('os').tmpdir() + '/rocs-test-' + Date.now();

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rocs = require('../backend/modules/reality-ops-continuum');

let passed = 0;
function check(name, fn) {
  const r = fn();
  if (r && typeof r.then === 'function') {
    return r.then(() => {
      console.log('✓', name);
      passed += 1;
    }).catch((e) => {
      console.error('✗', name);
      console.error(e && e.stack || e);
      process.exit(1);
    });
  }
  console.log('✓', name);
  passed += 1;
  return Promise.resolve();
}

async function main() {
  await check('discovery exposes protocol + beyond Prom/Grafana + no backup management', () => {
    const d = rocs.discovery();
    assert.equal(d.protocol, 'ROCS/1.0');
    assert.equal(d.invention, 'Reality Ops Continuum');
    assert.equal(d.beyondPrometheus, true);
    assert.equal(d.beyondGrafana, true);
    assert.equal(d.managesBackups, false);
    assert.equal(d.policy.backups, 'owner_periodic_external_never_managed_by_rocs');
    assert.equal(d.policy.inventGmv, 'never');
    assert.ok(/Never invents GMV/i.test(d.honesty));
    assert.ok(/never manages host backups/i.test(d.honesty));
  });

  await check('senseBackup ACKs owner periodic without running backups', () => {
    const b = rocs.senseBackup();
    assert.equal(b.managedByRocs, false);
    assert.equal(b.policy, 'owner_periodic_external');
    assert.equal(b.fresh, 'unobserved_owner_managed');
  });

  await check('senseBackup observes optional marker without executing backup', () => {
    const marker = path.join(os.tmpdir(), 'rocs-backup-marker-' + process.pid);
    fs.writeFileSync(marker, JSON.stringify({ at: new Date().toISOString(), ok: true }));
    const prev = process.env.UNICORN_BACKUP_LAST_OK_FILE;
    process.env.UNICORN_BACKUP_LAST_OK_FILE = marker;
    try {
      const b = rocs.senseBackup();
      assert.equal(b.managedByRocs, false);
      assert.equal(b.fresh, true);
      assert.ok(b.ageMs != null && b.ageMs < 60_000);
    } finally {
      if (prev == null) delete process.env.UNICORN_BACKUP_LAST_OK_FILE;
      else process.env.UNICORN_BACKUP_LAST_OK_FILE = prev;
      try { fs.unlinkSync(marker); } catch (_) { /* ignore */ }
    }
  });

  await check('tick dryRun returns causal verdict with planes + decision cards', async () => {
    const v = await rocs.tick({ dryRun: true, skipPersist: true, skipAlert: true });
    assert.equal(v.ok, true);
    assert.equal(v.protocol, 'ROCS/1.0');
    assert.ok(['green', 'amber', 'red'].includes(v.grade));
    assert.ok(typeof v.score === 'number');
    assert.ok(v.planes.process);
    assert.ok(v.planes.commerce);
    assert.ok(v.planes.autonomy);
    assert.ok(v.planes.deploy);
    assert.ok(v.planes.backup);
    assert.equal(v.planes.backup.managedByRocs, false);
    assert.ok(v.beyond.prometheus);
    assert.ok(v.beyond.grafana);
    assert.ok(/does not run backups/i.test(v.beyond.backups) || /owner periodic/i.test(v.beyond.backups));
    assert.ok(Array.isArray(v.findings));
    assert.ok(Array.isArray(v.decisionCards));
  });

  await check('FAKE_OBS_METRICS yields critical honesty finding', async () => {
    process.env.FAKE_OBS_METRICS = '1';
    try {
      const v = await rocs.tick({ dryRun: true, skipPersist: true, skipAlert: true });
      const fake = v.findings.find((f) => f.id === 'honesty.fake_obs_metrics_armed');
      assert.ok(fake);
      assert.equal(fake.severity, 'critical');
      assert.ok(v.score >= 40);
    } finally {
      process.env.FAKE_OBS_METRICS = '0';
    }
  });

  await check('backend wires ROCS boot + routes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(src.includes('reality-ops-continuum'));
    assert.ok(src.includes('/.well-known/rocs.json'));
    assert.ok(src.includes('/api/rocs/tick'));
    assert.ok(src.includes('managesBackups: false') || src.includes('backups=owner'));
  });

  await check('site + nginx expose rocs.json', () => {
    const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
    const nginx = fs.readFileSync(path.join(__dirname, '../scripts/nginx-unicorn.conf'), 'utf8');
    const snip = fs.readFileSync(path.join(__dirname, '../scripts/nginx-public-discovery.snippet.conf'), 'utf8');
    const patch = fs.readFileSync(path.join(__dirname, '../scripts/nginx-patch-public-discovery.py'), 'utf8');
    assert.ok(site.includes('/.well-known/rocs.json'));
    assert.ok(nginx.includes('location = /.well-known/rocs.json'));
    assert.ok(snip.includes('location = /.well-known/rocs.json'));
    assert.ok(patch.includes('location = /.well-known/rocs.json'));
  });

  await check('ecosystem defaults arm ROCS without claiming backup ownership', () => {
    const src = fs.readFileSync(path.join(__dirname, '../ecosystem.config.js'), 'utf8');
    assert.ok(src.includes("ROCS_DISABLED: process.env.ROCS_DISABLED || '0'"));
    assert.ok(src.includes('Never manages host backups'));
  });

  await check('IAK organ collapse includes rocs', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/modules/integrated-autonomy-kernel.js'), 'utf8');
    assert.ok(src.includes("soft('rocs', './reality-ops-continuum')"));
  });

  console.log('\n✅ reality-ops-continuum:', passed, 'tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
