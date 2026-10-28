'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ZEUS_STATE_DIR = require('path').join(require('os').tmpdir(), 'zeus-orch-' + process.pid);

const assert = require('assert');
const fs = require('fs');
const orch = require('../backend/modules/orchestrator');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log('✓', name); passed += 1; })
    .catch((e) => { console.error('✗', name); console.error(e && e.stack || e); process.exit(1); });
}

(async () => {
  await check('business failure alerts immediately and blocks for 60s', async () => {
    const alerts = [];
    orch.on('business_alert', (evt) => alerts.push(evt));
    const out = await orch.safeRun('processPaidOrders', async () => { throw new Error('paid_path_down'); });
    assert.strictEqual(out, undefined);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].capability, 'processPaidOrders');
    const blocked = await orch.safeRun('processPaidOrders', async () => 'should-not-run');
    assert.strictEqual(blocked, undefined);
    assert.strictEqual(alerts.length, 1);
  });

  await check('three ordinary failures write an autopsy', async () => {
    for (let i = 0; i < 3; i += 1) {
      await orch.safeRun('healthCheckProbe', async () => { throw new Error('probe_' + i); });
    }
    const dir = require('path').join(process.env.ZEUS_STATE_DIR, 'autopsies');
    const files = fs.readdirSync(dir).filter((name) => name.startsWith('healthCheckProbe_'));
    assert.ok(files.length >= 1);
    const text = fs.readFileSync(require('path').join(dir, files[0]), 'utf8');
    assert.ok(text.includes('probe_'));
  });

  await check('a rising duration emits a predictive warning', async () => {
    const warnings = [];
    orch.on('predictive_warning', (evt) => warnings.push(evt));
    for (let i = 0; i < 15; i += 1) orch.updatePrediction('syncPrices', 10);
    for (let i = 0; i < 5; i += 1) orch.updatePrediction('syncPrices', 200);
    assert.ok(warnings.some((evt) => evt.capability === 'syncPrices' && evt.trend > 2.5));
  });

  await check('a held lock does not run the second body', async () => {
    let ran = false;
    orch.locks.set('prices', true);
    const out = await orch.withLock('prices', async () => { ran = true; return 1; });
    orch.locks.delete('prices');
    assert.strictEqual(out, null);
    assert.strictEqual(ran, false);
  });

  await check('versions name the existing modules and do not delete them', () => {
    orch.registerCapabilities();
    const names = orch.versionSnapshot().map((row) => row.capability);
    assert.ok(names.includes('syncPrices'));
    assert.ok(names.includes('processPaidOrders'));
    const sales = require('path').join(__dirname, '..', 'backend', 'modules', 'salesOrchestrator.js');
    assert.ok(fs.existsSync(sales));
  });

  console.log(passed + ' passed');
})();
