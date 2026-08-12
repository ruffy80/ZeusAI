'use strict';

/**
 * Public surface guard — private operator routes stay private; sensitive
 * probes never fall through to the HTML shell.
 *
 * CI note: requiring backend/index boots a heavy module graph. Under Actions
 * load the first few connections can ECONNRESET while listen-callback work
 * still runs (same flake class as api-aliases / predictive-prefetch). Always
 * settle via /health/live + fetchRetry before asserting.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DB_PATH = process.env.DB_PATH || ':memory:';
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = process.env.UNICORN_RUNTIME_PROFILE || 'stable';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = process.env.ADMIN_2FA_CODE || '999999';
process.env.ZACC_ENABLE_ESCUELA = process.env.ZACC_ENABLE_ESCUELA || '0';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-psg-'));
process.env.UI_BUILD_CACHE_FILE = path.join(tmpRoot, 'ui-build-cache.json');
process.env.MARKETING_INNOVATION_LEDGER = path.join(tmpRoot, 'innovation-ledger.jsonl');
process.env.MARKETING_INNOVATION_LOOP_DISABLED = '1';

const sensitiveProbePaths = [
  '/.env', '/.git/config', '/wp-config.php', '/package-lock.json',
  '/%2eenv', '/%252eenv', '/%2egit/config', '/%77p-config.php', '/package%2dlock.json',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRetry(url, opts = {}, attempts = 8) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      lastErr = err;
      const msg = String((err && err.message) || err);
      const cause = err && err.cause ? String(err.cause.code || err.cause.message || err.cause) : '';
      const transient = /fetch failed|ECONNRESET|ECONNREFUSED|socket hang up|EPIPE|ETIMEDOUT/i.test(`${msg} ${cause}`);
      if (!transient || i === attempts) break;
      await sleep(40 * i * i);
    }
  }
  throw lastErr;
}

async function waitLive(base, attempts = 20) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchRetry(`${base}/health/live`, {}, 3);
      if (res.ok) return;
    } catch (_) { /* retry */ }
    await sleep(50 * i);
  }
  // Non-fatal: some older site builds lack /health/live — continue with retries.
}

async function assertSensitiveProbesBlocked(base, layer) {
  for (const probePath of sensitiveProbePaths) {
    const probe = await fetchRetry(base + probePath);
    assert.equal(probe.status, 404, `${layer}: ${probePath} must return 404`);
    assert.ok(!(probe.headers.get('content-type') || '').includes('text/html'),
      `${layer}: ${probePath} must not return the site shell`);
  }
}

async function run() {
  const app = require('../backend/index');
  assert.ok(app && typeof app.listen === 'function', 'backend app must be express-compatible');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  try {
    await sleep(150);
    await waitLive(base);

    // 1) Operator console must be private.
    const op = await fetchRetry(base + '/api/operator/console');
    assert.equal(op.status, 401, '/api/operator/console must require admin auth');

    // 2) Public autonomy payload must be sanitized (no deep internals).
    const pub = await fetchRetry(base + '/api/autonomy/status');
    assert.equal(pub.status, 200, 'public /api/autonomy/status should remain available');
    const pubJson = await pub.json();
    assert.equal(typeof pubJson.activeModules, 'number');
    assert.equal(typeof pubJson.autonomyReady, 'boolean');
    const raw = JSON.stringify(pubJson);
    assert.ok(!/fileHashes|requiredPm2Processes|\/var\/www\//i.test(raw),
      'public autonomy payload must not leak filesystem/infrastructure internals');

    // 3) Full autonomy view must require admin auth.
    const full = await fetchRetry(base + '/api/autonomy/status?view=full');
    assert.equal(full.status, 401, 'full autonomy diagnostics must require admin auth');

    // 4) Public docs index must not advertise private/admin routes.
    const docs = await fetchRetry(base + '/api/docs');
    assert.equal(docs.status, 200, '/api/docs must be reachable');
    const docsJson = await docs.json();
    const docsRaw = JSON.stringify(docsJson);
    assert.ok(!/\/api\/admin\//.test(docsRaw), 'public docs must not include /api/admin/* routes');

    // 5) Sensitive config/repository probes must never fall through to HTML.
    await assertSensitiveProbesBlocked(base, 'backend');
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }

  const siteServer = require('../src/index');
  await new Promise((resolve) => siteServer.listen(0, '127.0.0.1', resolve));
  const siteBase = 'http://127.0.0.1:' + siteServer.address().port;
  try {
    await sleep(100);
    await waitLive(siteBase);
    await assertSensitiveProbesBlocked(siteBase, 'site');
  } finally {
    await new Promise((resolve) => siteServer.close(() => resolve()));
  }

  console.log('public-surface-guard: passed');
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
