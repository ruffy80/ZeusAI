// test/topology.test.js
// -----------------------------------------------------------------------------
// Verifies the two-server topology contract:
//   - SITE (src/index.js, port 3001 in prod) → X-Unicorn-Role: site
//   - BACKEND (backend/index.js, port 3000 in prod) → X-Unicorn-Role: backend
//   - Both expose /internal/topology with the expected JSON shape
//   - The site write-guard tags non-safe /api/* mutations on 3001 with a
//     warning header (so an operator can `curl -I` and instantly see if
//     nginx routing is broken).
//
// This is the contract used by `scripts/smoke-topology.sh` and the public
// nginx split (zeusai.pro/api/* → backend, zeusai.pro/snapshot → site).
// If you change role/header names here, update both consumers.
// -----------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const http = require('http');

async function run() {
  // ── SITE side (loaded via src/index.js) ────────────────────────────────────
  const siteModule = require('../src/index');
  const createSite = typeof siteModule.createServer === 'function' ? siteModule.createServer : null;
  assert.ok(createSite, 'src/index.js must export createServer');
  const siteServer = createSite();
  await new Promise((resolve) => siteServer.listen(0, '127.0.0.1', resolve));
  const sitePort = siteServer.address().port;
  const siteBase = 'http://127.0.0.1:' + sitePort;

  try {
    // 1. Role header on a normal HTML response (root)
    const rootRes = await fetch(siteBase + '/');
    assert.equal(rootRes.headers.get('x-unicorn-role'), 'site',
      'site / must announce X-Unicorn-Role: site');
    // X-Unicorn-Port reflects the configured PORT env (default 3001) not the
    // ephemeral test port. Just assert it's a number-shaped string.
    assert.match(String(rootRes.headers.get('x-unicorn-port') || ''), /^\d+$/,
      'site / must announce a numeric X-Unicorn-Port');

    // 2. Role header on health endpoint
    const healthRes = await fetch(siteBase + '/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-unicorn-role'), 'site',
      'site /health must announce X-Unicorn-Role: site');

    // 3. Topology endpoint shape
    const topoRes = await fetch(siteBase + '/internal/topology');
    assert.equal(topoRes.status, 200, '/internal/topology must return 200');
    const topoBody = await topoRes.json();
    assert.equal(topoBody.role, 'site', 'topology.role must be site');
    assert.equal(topoBody.sourceOfTruth, false, 'site is NOT the source of truth');
    assert.equal(typeof topoBody.port, 'number', 'topology.port must be a number');
    assert.equal(typeof topoBody.pid, 'number', 'topology.pid must be a number');
    assert.ok(typeof topoBody.uptimeSeconds === 'number', 'topology.uptimeSeconds must be a number');
    assert.ok(/backend/i.test(topoBody.note || ''),
      'topology.note must reference the backend role');

    // 4. Write-guard warning header on /api/* mutations hitting the site
    //    (in production these should never reach 3001 — nginx routes /api/ to
    //    backend — but if they do, the operator must see it instantly).
    const guardRes = await fetch(siteBase + '/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(guardRes.headers.get('x-site-write-warning'), 'routed-to-site',
      'site write-guard must tag non-safe /api/* mutations with X-Site-Write-Warning: routed-to-site');

    // 5. Safe methods (GET) must NOT be tagged with the warning
    const safeRes = await fetch(siteBase + '/api/control/stats');
    assert.equal(safeRes.headers.get('x-site-write-warning'), null,
      'site write-guard must NOT tag GET /api/* requests');

    console.log('topology test (site) passed: role=site port=' + sitePort + ' headers ✓ /internal/topology ✓ write-guard ✓');
  } finally {
    await new Promise((resolve) => siteServer.close(() => resolve()));
  }

  // ── BACKEND side (loaded via backend/index.js) ─────────────────────────────
  // The backend exports the Express app. We start it on an ephemeral port,
  // hit /internal/topology and verify role=backend, then close it.
  const backendApp = require('../backend/index');
  assert.ok(backendApp && typeof backendApp.listen === 'function',
    'backend/index.js must export an Express app with .listen()');
  const backendServer = http.createServer(backendApp);
  await new Promise((resolve) => backendServer.listen(0, '127.0.0.1', resolve));
  const backendPort = backendServer.address().port;
  const backendBase = 'http://127.0.0.1:' + backendPort;

  try {
    // 1. Role header on a typical backend endpoint
    const metricsRes = await fetch(backendBase + '/api/metrics');
    assert.equal(metricsRes.status, 200);
    assert.equal(metricsRes.headers.get('x-unicorn-role'), 'backend',
      'backend /api/metrics must announce X-Unicorn-Role: backend');
    assert.equal(metricsRes.headers.get('x-unicorn-source-of-truth'), '1',
      'backend must announce X-Unicorn-Source-Of-Truth: 1');

    // 2. Topology endpoint shape
    const topoRes = await fetch(backendBase + '/internal/topology');
    assert.equal(topoRes.status, 200, 'backend /internal/topology must return 200');
    const topoBody = await topoRes.json();
    assert.equal(topoBody.role, 'backend', 'topology.role must be backend');
    assert.equal(topoBody.sourceOfTruth, true, 'backend IS the source of truth');
    assert.equal(typeof topoBody.port, 'number');
    assert.equal(typeof topoBody.pid, 'number');

    console.log('topology test (backend) passed: role=backend port=' + backendPort + ' headers ✓ /internal/topology ✓');
  } finally {
    await new Promise((resolve) => backendServer.close(() => resolve()));
  }
}

run().then(() => {
  console.log('topology test passed');
  // Force-exit: src/index.js + backend/index.js load many production modules
  // (predictive-scaler, orchestrators, watchers...) that legitimately keep
  // long-lived handles. Without an explicit exit the test process hangs.
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
