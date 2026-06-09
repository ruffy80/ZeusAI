'use strict';

const assert = require('assert');
const http = require('http');

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

    console.log('public-surface-guard: passed');
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
