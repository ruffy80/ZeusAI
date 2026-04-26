/**
 * ZAC smoke test — validates the in-process ZeusAutonomousCore loads,
 * scans the ecosystem, completes the site (dryRun), and exposes status.
 * No network, no daemons started — pure synchronous unit checks.
 */
const path = require('path');
const assert = require('assert');

const zac = require('../backend/modules/zeusAutonomousCore');

function testScanFindsProfitModules() {
  const result = zac.scan({});
  assert.ok(result, 'scan returned no result');
  assert.ok(result.moduleCount >= 5, `expected scan.moduleCount >= 5, got ${result.moduleCount}`);
  assert.ok(result.profitCount >= 1, `expected at least 1 profit module, got ${result.profitCount}`);
  assert.ok(Array.isArray(result.profit), 'scan.profit must be array');
}

function testSiteCompleterDryRun() {
  const r = zac.completeSite({
    unicornRoot: path.resolve(__dirname, '..'),
    dryRun: true,
  });
  assert.ok(r.staticPath, 'completeSite must return staticPath');
  assert.ok(Array.isArray(r.written),  'written must be array');
  assert.ok(Array.isArray(r.skipped),  'skipped must be array');
}

function testSelfDeveloperGeneratesStub() {
  const dev = zac.createSelfDeveloper();
  const r = dev.generateModule({
    name: 'ZacTestStub' + Date.now(),
    description: 'unit test scratch module',
  });
  assert.ok(r.ok, 'generateModule should succeed');
  assert.ok(r.file && r.file.endsWith('.js'), 'should write .js file');
  // Cleanup
  try { require('fs').unlinkSync(r.file); } catch (_) {}
}

function testStatusShape() {
  const s = zac.getStatus();
  assert.ok(s.version, 'status must include version');
  assert.ok(s.startedAt, 'status must include startedAt');
  assert.strictEqual(typeof s.running, 'boolean');
}

function testSelfHealerStatusBeforeStart() {
  const healer = zac.createSelfHealer({ intervalMs: 999999 });
  const s = healer.getStatus();
  assert.strictEqual(s.running, false);
  assert.ok(Array.isArray(s.targets));
}

(function run() {
  testScanFindsProfitModules();
  testSiteCompleterDryRun();
  testSelfDeveloperGeneratesStub();
  testStatusShape();
  testSelfHealerStatusBeforeStart();
  console.log('zac smoke test passed');
})();
