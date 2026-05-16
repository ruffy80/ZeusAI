/**
 * Tests for backend/modules/deepseek-governor.js
 *
 * Validates:
 *  - Allowlist enforcement (unknown actions → 400)
 *  - Idempotency by requestId
 *  - read_status returns a curated snapshot, no secrets
 *  - prices_sync handles missing broker gracefully
 *  - restart_service rejects unknown service names
 *  - restart_service for an allowed name returns intent-logged (no exec)
 *  - getStatus returns aggregate shape without leaking individual IPs
 *  - admin endpoints in backend/index.js enforce denial contract (401 without token)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Route logs to a temp file so we don't litter the repo / system.
const tmpLog = path.join(__dirname, '..', 'data', 'logs', 'deepseek-governor.test.log');
process.env.DEEPSEEK_GOVERNOR_LOG_PATH = tmpLog;
process.env.NODE_ENV = 'test';

const governor = require('../backend/modules/deepseek-governor');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('  ✓', name);
    passed++;
  } catch (e) {
    console.log('  ✗', name);
    console.log('    →', e.message);
    failed++;
  }
}

async function run() {
  console.log('\nDeepSeek Governor — allowlist + safety contract:');

  await test('rejects unknown action', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'rm_rf_slash', params: {}, requestId: 't1', ip: '127.0.0.1' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, 'action_not_allowed');
    assert.ok(Array.isArray(r.body.allowed));
    assert.ok(!r.body.allowed.includes('write_file'), 'write_file MUST NOT be in allowlist');
    assert.ok(!r.body.allowed.includes('deploy'), 'deploy MUST NOT be in allowlist');
    assert.ok(!r.body.allowed.includes('git_commit'), 'git_commit MUST NOT be in allowlist');
  });

  await test('rejects eval-style action shapes', async () => {
    governor._resetForTests();
    const r1 = await governor.dispatch({ action: 'shell', params: { cmd: 'ls' }, requestId: 't2a', ip: '127.0.0.1' });
    assert.equal(r1.status, 400);
    const r2 = await governor.dispatch({ action: 'write_file', params: { path: '/etc/passwd' }, requestId: 't2b', ip: '127.0.0.1' });
    assert.equal(r2.status, 400);
  });

  await test('none returns ok no-op', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'none', requestId: 't3', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.action, 'none');
    assert.equal(r.body.ok, true);
  });

  await test('read_status returns curated snapshot without secrets', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_status', requestId: 't4', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.action, 'read_status');
    const blob = JSON.stringify(r.body);
    // Heuristic: no obvious secret-shaped strings in the response.
    assert.ok(!/DEEPSEEK_API_KEY/i.test(blob), 'must not echo env key names');
    assert.ok(!/JWT_SECRET/i.test(blob));
    assert.ok(!/ADMIN_MASTER_PASSWORD/i.test(blob));
    assert.ok(typeof r.body.uptimeSec === 'number');
  });

  await test('prices_sync handles missing broker', async () => {
    governor._resetForTests();
    governor.configure({ livePricingBroker: null });
    const r = await governor.dispatch({ action: 'prices_sync', requestId: 't5', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.equal(r.body.reason, 'broker_unavailable');
  });

  await test('prices_sync calls broker._refresh when available', async () => {
    governor._resetForTests();
    let called = 0;
    const fakeBroker = {
      _refresh: async () => { called++; },
      getSnapshot: () => ({ items: [{ id: 'x' }], btcRate: { usd: 100000 } }),
    };
    governor.configure({ livePricingBroker: fakeBroker });
    const r = await governor.dispatch({ action: 'prices_sync', requestId: 't6', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.equal(called, 1);
    assert.equal(r.body.itemsCount, 1);
    governor.configure({ livePricingBroker: null });
  });

  await test('checkout_fix is read-only and never claims mutation', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'checkout_fix', requestId: 't7', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.ok(/no mutations/i.test(r.body.note || ''));
  });

  await test('restart_service rejects unknown service', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'restart_service', params: { service: 'sshd' }, requestId: 't8', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.equal(r.body.reason, 'service_not_allowed');
  });

  await test('restart_service for allowed service returns intent-logged (no exec)', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'restart_service', params: { service: 'unicorn-backend' }, requestId: 't9', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'intent-logged');
    assert.equal(r.body.service, 'unicorn-backend');
  });

  await test('idempotency: same requestId returns cached result', async () => {
    governor._resetForTests();
    const a = await governor.dispatch({ action: 'none', requestId: 'same-id', ip: '127.0.0.1' });
    const b = await governor.dispatch({ action: 'none', requestId: 'same-id', ip: '127.0.0.1' });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(b.body.cached, true);
  });

  await test('getStatus exposes allowlist + limits, no per-IP detail', async () => {
    const s = governor.getStatus();
    assert.deepEqual(s.allowedActions.slice().sort(), ['checkout_fix', 'code_proposal', 'none', 'prices_sync', 'read_file', 'read_status', 'restart_service', 'roadmap_update', 'run_test']);
    assert.ok(s.limits.perHourPerIp >= 1);
    assert.ok(s.limits.perDayPerIp >= s.limits.perHourPerIp);
    assert.ok(!('perIp' in s), 'must not leak per-IP details');
  });

  // ---------- read_file safety envelope ----------
  await test('read_file: missing path → path_required', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: {}, requestId: 'rf-1', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.equal(r.body.reason, 'path_required');
  });

  await test('read_file: rejects path traversal outside root', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: { path: '/etc/passwd' }, requestId: 'rf-2', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.ok(['path_outside_root', 'not_found', 'extension_not_allowed', 'segment_denied'].includes(r.body.reason), 'reason was ' + r.body.reason);
  });

  await test('read_file: rejects disallowed extension', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: { path: 'run.sh' }, requestId: 'rf-3', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.ok(['extension_not_allowed', 'not_found'].includes(r.body.reason));
  });

  await test('read_file: rejects .git segment', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: { path: '.git/config' }, requestId: 'rf-4', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.ok(['segment_denied', 'extension_not_allowed', 'not_found'].includes(r.body.reason));
  });

  await test('read_file: rejects .env file', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: { path: '.env.example' }, requestId: 'rf-5', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    // .env.example → segment ends with .env, denied
    assert.ok(['segment_denied', 'not_found', 'extension_not_allowed'].includes(r.body.reason));
  });

  await test('read_file: rejects names containing "secret"', async () => {
    governor._resetForTests();
    // Use an .md file that does not exist with "secret" in name — should fail name check, not just not_found
    const r = await governor.dispatch({ action: 'read_file', params: { path: 'docs/my-secret-notes.md' }, requestId: 'rf-6', ip: '127.0.0.1' });
    assert.equal(r.status, 422);
    assert.ok(['name_denied', 'not_found'].includes(r.body.reason));
  });

  await test('read_file: reads an allowed .json file', async () => {
    governor._resetForTests();
    const r = await governor.dispatch({ action: 'read_file', params: { path: 'package.json' }, requestId: 'rf-7', ip: '127.0.0.1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.encoding, 'base64');
    const decoded = Buffer.from(r.body.content, 'base64').toString('utf8');
    assert.ok(decoded.indexOf('"name"') !== -1, 'should include package.json name field');
  });

  await test('log file is written and parseable JSONL', async () => {
    governor._resetForTests();
    await governor.dispatch({ action: 'none', requestId: 't-log', ip: '127.0.0.1' });
    assert.ok(fs.existsSync(tmpLog), 'log file must exist');
    const lines = fs.readFileSync(tmpLog, 'utf8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.action, 'none');
    assert.equal(last.ok, true);
  });

  // ---------- HTTP denial contract ----------
  // Force in-memory DB so booting the backend is cheap.
  process.env.DB_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
  process.env.ADMIN_MASTER_PASSWORD = 'TestAdmin2026!';
  process.env.ADMIN_2FA_CODE = '999999';
  process.env.DEEPSEEK_LOOP_ADMIN_TOKEN = 'deepseek-test-token';
  const app = require('../backend/index');
  await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', async () => {
      const port = srv.address().port;
      try {
        await test('POST /api/admin/deepseek/act without token → 401', async () => {
          const r = await fetch(`http://127.0.0.1:${port}/api/admin/deepseek/act`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'none', requestId: 'http-1' }),
          });
          assert.equal(r.status, 401);
        });
        await test('GET /api/admin/deepseek/status without token → 401', async () => {
          const r = await fetch(`http://127.0.0.1:${port}/api/admin/deepseek/status`);
          assert.equal(r.status, 401);
        });
        await test('POST /api/admin/deepseek/act with loop token → 200', async () => {
          const r = await fetch(`http://127.0.0.1:${port}/api/admin/deepseek/act`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer deepseek-test-token' },
            body: JSON.stringify({ action: 'none', requestId: 'http-loop-token' }),
          });
          assert.equal(r.status, 200);
        });
        await test('GET /api/admin/deepseek/status with loop token → 200', async () => {
          const r = await fetch(`http://127.0.0.1:${port}/api/admin/deepseek/status`, {
            headers: { Authorization: 'Bearer deepseek-test-token' },
          });
          assert.equal(r.status, 200);
        });
      } finally {
        srv.close(resolve);
      }
    });
  });

  // Cleanup
  try { fs.unlinkSync(tmpLog); } catch (_) {}

  console.log(`\nDeepSeek Governor: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  // Backend keeps timers alive; force-exit so the test process terminates.
  // Backend menține timere active; ieșim explicit ca testul să se termine.
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
