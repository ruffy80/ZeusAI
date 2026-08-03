// =====================================================================
// server-never-recur.test.js — permanent guards against production defects
// found live on 2026-08-03:
//   1) npm run heal MODULE_NOT_FOUND (health-guardian archived)
//   2) public POST /api/omega/bootstrap|evolve floodable
//   3) catalog enrich counter exploding on every request
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_OMEGA_DIR = require('os').tmpdir() + '/omega-nr-' + process.pid;
process.env.ZEUS_OMEGA_DISABLED = '0';
process.env.ADMIN_SECRET = 'test-admin-secret-never-recur';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('\u2713', name);
}

check('health-guardian.js exists at the path npm run heal invokes', () => {
  const fp = path.join(__dirname, '..', 'scripts', 'health-guardian.js');
  assert.ok(fs.existsSync(fp), 'scripts/health-guardian.js missing');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(String(pkg.scripts.heal).includes('health-guardian.js'));
  assert.ok(String(pkg.scripts.heal).includes('--once'));
});

check('heal --once exits 0 against live public probes (or soft-passes modules)', () => {
  const fp = path.join(__dirname, '..', 'scripts', 'health-guardian.js');
  const r = spawnSync(process.execPath, [fp, '--once'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CI: 'true',
      HEAL_ONCE: '1',
      PUBLIC_APP_URL: 'https://zeusai.pro',
      DISABLE_SELF_MUTATION: '1',
    },
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
  }
  assert.equal(r.status, 0, 'heal --once must exit 0');
  assert.ok(/HealthGuardian/.test(r.stdout + r.stderr));
});

check('omega enrichCatalogItem is idempotent (no counter explosion)', () => {
  delete require.cache[require.resolve('../backend/modules/omega-ecosystem-os')];
  const omega = require('../backend/modules/omega-ecosystem-os');
  omega._resetForTests();
  const a = omega.enrichCatalogItem({ id: 'starter', title: 'Starter' });
  const before = omega.getStatus().counts.enriched;
  const b = omega.enrichCatalogItem(a);
  const after = omega.getStatus().counts.enriched;
  assert.equal(before, 1);
  assert.equal(after, 1);
  assert.strictEqual(b, a);
});

check('site omega-http adminOk fails closed without secret match', () => {
  const http = require('../src/site/omega-http');
  const denied = http.adminOk({ headers: {} });
  // NODE_ENV=test with ADMIN_SECRET set → must require match
  assert.equal(denied.ok, false);
  assert.ok(denied.code === 401 || denied.code === 503);
  const allowed = http.adminOk({ headers: { 'x-admin-secret': 'test-admin-secret-never-recur' } });
  assert.equal(allowed.ok, true);
});

check('backend omega mutate routes are admin-gated in source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(src.includes("app.post('/api/omega/bootstrap'"));
  assert.ok(src.includes("app.post('/api/omega/evolve'"));
  // Both posts must sit next to requireAdminSecretOrJwt
  const boot = src.indexOf("app.post('/api/omega/bootstrap'");
  const evo = src.indexOf("app.post('/api/omega/evolve'");
  const bootSlice = src.slice(boot, boot + 180);
  const evoSlice = src.slice(evo, evo + 180);
  assert.ok(bootSlice.includes('requireAdminSecretOrJwt'), bootSlice);
  assert.ok(evoSlice.includes('requireAdminSecretOrJwt'), evoSlice);
});

console.log('\n✅ server-never-recur:', passed, 'tests passed');
process.exit(0);
