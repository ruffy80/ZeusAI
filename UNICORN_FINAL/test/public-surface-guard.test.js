'use strict';

const assert = require('assert');
const http = require('http');

const sensitiveProbePaths = [
  '/.env', '/.git/config', '/wp-config.php', '/package-lock.json',
  '/%2eenv', '/%252eenv', '/%2egit/config', '/%77p-config.php', '/package%2dlock.json',
];

async function assertSensitiveProbesBlocked(base, layer) {
  for (const probePath of sensitiveProbePaths) {
    const probe = await fetch(base + probePath);
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
    // 1) Operator console must be private.
    const op = await fetch(base + '/api/operator/console');
    assert.equal(op.status, 401, '/api/operator/console must require admin auth');

    // 2) Public autonomy payload must be sanitized (no deep internals).
    const pub = await fetch(base + '/api/autonomy/status');
    assert.equal(pub.status, 200, 'public /api/autonomy/status should remain available');
    const pubJson = await pub.json();
    assert.equal(typeof pubJson.activeModules, 'number');
    assert.equal(typeof pubJson.autonomyReady, 'boolean');
    const raw = JSON.stringify(pubJson);
    assert.ok(!/fileHashes|requiredPm2Processes|\/var\/www\//i.test(raw),
      'public autonomy payload must not leak filesystem/infrastructure internals');

    // 3) Full autonomy view must require admin auth.
    const full = await fetch(base + '/api/autonomy/status?view=full');
    assert.equal(full.status, 401, 'full autonomy diagnostics must require admin auth');

    // 4) Public docs index must not advertise private/admin routes.
    const docs = await fetch(base + '/api/docs');
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
