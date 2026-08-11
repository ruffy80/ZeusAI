// =====================================================================
// ops-aggregator.test.js — guards the outage fix for the site/backend
// /api/ops/dashboard collector. The old collector called a SYNCHRONOUS
// execSync('pm2 jlist') on the request path, which blocked the event loop
// on both the site and backend processes and made /api/health time out —
// the root cause behind the "backend still stale" deploy failure and the
// nginx maintenance page. These tests lock in the async, non-blocking,
// kill-switch/boot-grace-aware behaviour.
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
// Point the backend probe at a port nothing listens on so collect() fails fast
// (connection refused) instead of waiting on the 1.5s timeout.
process.env.BACKEND_API_URL = 'http://127.0.0.1:59999';

const assert = require('assert');

const ops = require('../src/modules/ops-aggregator');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('\u2713', name);
}

// Keep original env so each test is isolated.
const ORIG = {
  disabled: process.env.OPS_PM2_CHECK_DISABLED,
  bootGrace: process.env.OPS_PM2_BOOT_GRACE_MS,
  path: process.env.PATH,
};
function resetEnv() {
  delete process.env.OPS_PM2_CHECK_DISABLED;
  delete process.env.OPS_PM2_BOOT_GRACE_MS;
  process.env.PATH = ORIG.path;
}

async function run() {
  await check('_pm2Snapshot is async (returns a Promise)', () => {
    resetEnv();
    process.env.OPS_PM2_CHECK_DISABLED = '1';
    const r = ops._pm2Snapshot();
    assert.ok(r && typeof r.then === 'function', '_pm2Snapshot must return a Promise');
    return r; // resolve so it settles
  });

  await check('OPS_PM2_CHECK_DISABLED=1 short-circuits with reason pm2_check_disabled', async () => {
    resetEnv();
    process.env.OPS_PM2_CHECK_DISABLED = '1';
    const snap = await ops._pm2Snapshot();
    assert.strictEqual(snap.available, false);
    assert.strictEqual(snap.ok, null);
    assert.strictEqual(snap.reason, 'pm2_check_disabled');
  });

  await check('boot grace window returns reason pm2_boot_grace', async () => {
    resetEnv();
    // Large boot grace guarantees we are still inside the window at test time.
    process.env.OPS_PM2_BOOT_GRACE_MS = '3600000';
    const snap = await ops._pm2Snapshot();
    assert.strictEqual(snap.available, false);
    assert.strictEqual(snap.ok, null);
    assert.strictEqual(snap.reason, 'pm2_boot_grace');
  });

  await check('async snapshot resolves (does not throw) when pm2 binary is missing', async () => {
    resetEnv();
    process.env.OPS_PM2_BOOT_GRACE_MS = '0'; // bypass boot grace
    process.env.PATH = ''; // pm2 not resolvable → execFile ENOENT
    let snap;
    await assert.doesNotReject(async () => { snap = await ops._pm2Snapshot(); });
    assert.strictEqual(snap.available, false);
    assert.strictEqual(snap.ok, null);
    assert.strictEqual(snap.reason, 'pm2_jlist_unavailable_from_worker');
  });

  await check('collect() returns a well-formed shape with ok/status/heap', async () => {
    resetEnv();
    process.env.OPS_PM2_BOOT_GRACE_MS = '0';
    process.env.PATH = ''; // keep pm2 unavailable so collect never blocks
    const data = await ops.collect({ buildSha: 'test-sha' });
    resetEnv();

    assert.strictEqual(typeof data.ok, 'boolean');
    assert.ok(['green', 'amber', 'red'].includes(data.status), `unexpected status: ${data.status}`);
    assert.ok(Array.isArray(data.verdicts));
    assert.ok(data.heap && typeof data.heap.heapUsedMb === 'number', 'heap.heapUsedMb must be a number');
    assert.ok(typeof data.heap.heapPct === 'number');
    assert.ok(data.pm2 && typeof data.pm2 === 'object', 'pm2 sub-object must exist');
    assert.strictEqual(data.pm2.available, false);
    assert.ok(data.deploy && typeof data.deploy === 'object');
    assert.ok(typeof data.generatedAt === 'string');
  });

  resetEnv();
  console.log(`\u2705 ops-aggregator: ${passed} tests passed`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
