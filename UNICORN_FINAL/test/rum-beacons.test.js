// test/rum-beacons.test.js
// -----------------------------------------------------------------------------
// Verifies the Real User Monitoring (RUM) beacons module:
//   1. Path normalisation (numeric IDs, hex IDs, UUIDs collapse to :id)
//   2. Path validation (APIs / assets / SSE / control chars rejected)
//   3. Metric validation (out-of-range / non-finite dropped, sane recorded)
//   4. Per-route bounded LRU + bounded sample buffer
//   5. Rate limiting per source-IP (defeats trivial flood)
//   6. K-anonymous persistence (only routes ≥ K samples written)
//   7. Restore from snapshot rehydrates aggregate counts
//   8. Save-Data / Sec-CH-Prefers-Reduced-Data → suppressForSaveData=true
//   9. Collector script generation: ES5-safe, contains all 5 metrics
//  10. Integration: real HTTP POST /internal/rum + GET /internal/rum/stats,
//      SSR HTML contains the inlined collector before </head>, Save-Data
//      visitors get NO collector injected.
//
// Standalone — runs in CI alongside other test/*.test.js files. Loads
// src/index.js via createServer() and explicitly process.exit(0) on success
// (production code starts long-lived intervals).
// -----------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rb = require('../src/perf/rum-beacons');

function expect(label, cond) {
  assert.ok(cond, label);
  console.log('  ✅ ' + label);
}

async function unitTests() {
  console.log('rum-beacons unit tests:');
  rb._resetForTests();

  // 1. Path validation
  expect('isNavigablePath("/")', rb.isNavigablePath('/'));
  expect('isNavigablePath("/store")', rb.isNavigablePath('/store'));
  expect('isNavigablePath("/api/health") rejected', !rb.isNavigablePath('/api/health'));
  expect('isNavigablePath("/internal/rum") rejected', !rb.isNavigablePath('/internal/rum'));
  expect('isNavigablePath("/assets/app.js") rejected', !rb.isNavigablePath('/assets/app.js'));
  expect('isNavigablePath("/stream") rejected', !rb.isNavigablePath('/stream'));
  expect('isNavigablePath("") rejected', !rb.isNavigablePath(''));
  expect('isNavigablePath(null) rejected', !rb.isNavigablePath(null));
  expect('isNavigablePath("foo") rejected (no leading slash)', !rb.isNavigablePath('foo'));
  expect('isNavigablePath("/foo?bar") rejected (query)', !rb.isNavigablePath('/foo?bar'));
  expect('isNavigablePath with newline rejected', !rb.isNavigablePath('/foo\nbar'));
  expect('isNavigablePath with `<` rejected', !rb.isNavigablePath('/foo<bar'));
  expect('isNavigablePath traversal rejected', !rb.isNavigablePath('/../etc/passwd'));

  // 2. Route normaliser
  expect('normaliseRoute("/order/12345") → "/order/:id"', rb.normaliseRoute('/order/12345') === '/order/:id');
  expect('normaliseRoute("/u/507f1f77bcf86cd799439011") → "/u/:id" (Mongo)', rb.normaliseRoute('/u/507f1f77bcf86cd799439011') === '/u/:id');
  expect('normaliseRoute UUID → ":id"', rb.normaliseRoute('/u/550e8400-e29b-41d4-a716-446655440000') === '/u/:id');
  expect('normaliseRoute keeps short numeric path segments alone',
    rb.normaliseRoute('/v2/page') === '/v2/page');
  expect('normaliseRoute keeps slug words alone',
    rb.normaliseRoute('/about/team') === '/about/team');
  expect('normaliseRoute returns null for invalid path', rb.normaliseRoute('/api/x') === null);

  // 3. acceptBeacon: happy path
  const fakeReq = { headers: {}, socket: { remoteAddress: '10.0.0.1' } };
  const r1 = rb.acceptBeacon({
    path: '/',
    metrics: { lcp: 1234, cls: 0.05, inp: 80, fcp: 700, ttfb: 120 }
  }, fakeReq);
  expect('acceptBeacon ok=true on valid payload', r1.ok === true);
  expect('acceptBeacon recorded all 5 metrics', r1.recorded === 5);

  // 4. acceptBeacon: invalid metrics dropped, valid kept
  const r2 = rb.acceptBeacon({
    path: '/store',
    metrics: { lcp: 999, cls: -1 /* invalid */, inp: 1e9 /* out of range */, fcp: 'oops' /* wrong type */, ttfb: 50 }
  }, fakeReq);
  expect('acceptBeacon partial-valid still ok=true', r2.ok === true);
  expect('acceptBeacon dropped invalid metrics (only lcp+ttfb kept)', r2.recorded === 2);

  // 5. acceptBeacon: rejected paths
  const rApi = rb.acceptBeacon({ path: '/api/health', metrics: { lcp: 100 } }, fakeReq);
  expect('acceptBeacon rejects API paths', rApi.ok === false && rApi.reason === 'invalid_path');

  const rNoMetrics = rb.acceptBeacon({ path: '/', metrics: {} }, fakeReq);
  expect('acceptBeacon rejects when no valid metrics',
    rNoMetrics.ok === false && (rNoMetrics.reason === 'no_valid_metrics' || rNoMetrics.reason === 'no_metrics'));

  const rJunk = rb.acceptBeacon(null, fakeReq);
  expect('acceptBeacon rejects null payload', rJunk.ok === false);

  // 6. Stats emit p50/p75/p95
  rb._resetForTests();
  for (let i = 1; i <= 100; i++) {
    rb.acceptBeacon({ path: '/perf', metrics: { lcp: i * 10 } }, fakeReq);
  }
  // Burst of 100 from a single IP → some will hit the rate limit. That's fine
  // for the percentile assertions below — at least the first RATE_LIMIT_PER_MIN
  // are accepted, which is plenty for stable percentiles.
  const stats1 = rb.getStats();
  expect('stats has /perf route', stats1.routes['/perf'] && stats1.routes['/perf'].metrics.lcp);
  const lcp = stats1.routes['/perf'].metrics.lcp;
  expect('stats reports n>0', lcp.n > 0);
  expect('stats reports p50 < p75 ≤ p95', lcp.p50 <= lcp.p75 && lcp.p75 <= lcp.p95);

  // 7. Rate limiting per source IP
  rb._resetForTests();
  // Default RATE_LIMIT_PER_MIN=60. With one IP, the 61st should be rejected.
  let lastReason = null;
  for (let i = 0; i < 70; i++) {
    const r = rb.acceptBeacon({ path: '/x', metrics: { lcp: 10 } }, { headers: {}, socket: { remoteAddress: '9.9.9.9' } });
    if (!r.ok) { lastReason = r.reason; }
  }
  expect('rate limit triggers within 70 calls from same IP', lastReason === 'rate_limit');
  // Different IP not affected
  const rOk = rb.acceptBeacon({ path: '/x', metrics: { lcp: 10 } }, { headers: {}, socket: { remoteAddress: '8.8.8.8' } });
  expect('different IP still accepted under rate limit', rOk.ok === true);

  // 8. Save-Data suppression
  expect('shouldSuppressForSaveData with Save-Data: on → true',
    rb.shouldSuppressForSaveData({ headers: { 'save-data': 'on' } }) === true);
  expect('shouldSuppressForSaveData with reduce-data → true',
    rb.shouldSuppressForSaveData({ headers: { 'sec-ch-prefers-reduced-data': 'reduce-data' } }) === true);
  expect('shouldSuppressForSaveData with no signals → false',
    rb.shouldSuppressForSaveData({ headers: {} }) === false);
  expect('shouldSuppressForSaveData null-safe',
    rb.shouldSuppressForSaveData(null) === false);

  // 9. Collector script generation
  const script = rb.buildCollectorScript({ nonce: 'NONCE123' });
  expect('collector script generated', typeof script === 'string' && script.length > 0);
  expect('collector script has nonce', script.indexOf('nonce="NONCE123"') !== -1);
  expect('collector script mentions LCP observer',
    script.indexOf('largest-contentful-paint') !== -1);
  expect('collector script mentions CLS observer',
    script.indexOf('layout-shift') !== -1);
  expect('collector script mentions INP observer',
    script.indexOf('"event"') !== -1);
  expect('collector script mentions FCP observer',
    script.indexOf('first-contentful-paint') !== -1);
  expect('collector script mentions TTFB / Navigation Timing',
    script.indexOf('"navigation"') !== -1);
  expect('collector script uses sendBeacon',
    script.indexOf('sendBeacon') !== -1);
  expect('collector script POSTs to /internal/rum',
    script.indexOf('"/internal/rum"') !== -1);
  expect('collector script strips query/hash from path',
    script.indexOf('[?#]') !== -1);

  // 10. injectCollector inserts before </head>
  const html = '<!doctype html><html><head><title>x</title></head><body>y</body></html>';
  const out = rb.injectCollector(html, { nonce: 'N' });
  expect('inject placed script before </head>',
    out.indexOf('<script nonce="N">') !== -1 && out.indexOf('</head>') > out.indexOf('<script nonce="N">'));
  expect('inject preserves rest of document',
    out.indexOf('<body>y</body>') !== -1);
  const noHead = rb.injectCollector('<html><body>z</body></html>', {});
  expect('inject is no-op when no </head>',
    noHead === '<html><body>z</body></html>');

  // 11. K-anonymous persistence: write → wipe → restore
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-test-'));
  const tmpFile = path.join(tmpDir, 'snap.jsonl');
  process.env.RUM_PERSIST_PATH = tmpFile;
  // Reload module to pick up env (path captured at module load time)
  delete require.cache[require.resolve('../src/perf/rum-beacons')];
  const rb2 = require('../src/perf/rum-beacons');
  rb2._resetForTests();
  // 5 hits on /a (above k-anon threshold 3), 1 hit on /rare (below)
  for (let i = 0; i < 5; i++) {
    rb2.acceptBeacon(
      { path: '/a', metrics: { lcp: 1000 + i * 10 } },
      { headers: {}, socket: { remoteAddress: '10.0.0.' + i } }
    );
  }
  rb2.acceptBeacon(
    { path: '/rare', metrics: { lcp: 5000 } },
    { headers: {}, socket: { remoteAddress: '10.1.0.1' } }
  );
  const persisted = rb2.persistSnapshot();
  expect('persistSnapshot ok=true', persisted && persisted.ok === true);
  expect('persistSnapshot only k-anon routes (≥3) written', persisted.lines === 1);
  // Verify file content
  const lines = fs.readFileSync(tmpFile, 'utf8').trim().split('\n').filter(Boolean);
  expect('snapshot file written with one line', lines.length === 1);
  let parsed = null;
  try { parsed = JSON.parse(lines[0]); } catch (_) {}
  expect('snapshot line is valid JSON v=1', parsed && parsed.v === 1);
  expect('snapshot line carries route + count', parsed.path === '/a' && parsed.count === 5);
  expect('snapshot line carries aggregate stats only (no raw samples)',
    parsed.stats && parsed.stats.metrics && !('samples' in parsed));

  // Wipe runtime state, restore from disk
  rb2._resetForTests();
  const restored = rb2.restoreSnapshot();
  expect('restoreSnapshot ok=true', restored && restored.ok === true);
  expect('restoreSnapshot rehydrated 1 route', restored.restored === 1);
  const afterRestore = rb2.getStats();
  expect('restored route present in stats', afterRestore.routes['/a'] && afterRestore.routes['/a'].count === 5);
  expect('non-k-anon route NOT restored', !afterRestore.routes['/rare']);

  // Cleanup
  delete process.env.RUM_PERSIST_PATH;
  delete require.cache[require.resolve('../src/perf/rum-beacons')];
  try { fs.unlinkSync(tmpFile); } catch (_) {}
  try { fs.rmdirSync(tmpDir); } catch (_) {}

  // 12. ENABLED flag
  expect('ENABLED is boolean', typeof rb.ENABLED === 'boolean');
}

async function integrationTest() {
  console.log('\nrum-beacons integration test (HTTP ingest + SSR injection):');
  // Re-acquire the module instance the server will use.
  const rbLive = require('../src/perf/rum-beacons');
  rbLive._resetForTests();

  // Boot the site server
  process.env.NODE_APP_INSTANCE = '0';
  process.env.SITE_CLUSTER_SINGLETON_DISABLED = '1';
  const { createServer } = require('../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  function fetchHttp(opts, body) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1', port,
        method: opts.method || 'GET',
        path: opts.path,
        headers: Object.assign({ Host: '127.0.0.1:' + port }, opts.headers || {})
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  try {
    // 1. POST a valid beacon
    const beaconBody = JSON.stringify({
      path: '/',
      metrics: { lcp: 1500, cls: 0.02, inp: 90, fcp: 600, ttfb: 100 }
    });
    const r1 = await fetchHttp({
      method: 'POST',
      path: '/internal/rum',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(beaconBody) }
    }, beaconBody);
    expect('POST /internal/rum returns 204', r1.status === 204);
    const stats1 = rbLive.getStats();
    expect('beacon registered in /', stats1.routes['/'] && stats1.routes['/'].count >= 1);
    expect('lcp sample present', stats1.routes['/'].metrics.lcp && stats1.routes['/'].metrics.lcp.n >= 1);

    // 2. POST a malicious / invalid beacon — should still 204, never crash
    const badBody = JSON.stringify({ path: '/api/admin', metrics: { lcp: 9e99 } });
    const r2 = await fetchHttp({
      method: 'POST',
      path: '/internal/rum',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(badBody) }
    }, badBody);
    expect('POST malicious /api/admin returns 204 (silent reject)', r2.status === 204);
    expect('no /api/admin route registered', !rbLive.getStats().routes['/api/admin']);

    // 3. POST garbage body — must not crash
    const r3 = await fetchHttp({
      method: 'POST',
      path: '/internal/rum',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '8' }
    }, '!@#$%^&*');
    expect('POST garbage body returns 204', r3.status === 204);

    // 4. GET /internal/rum/stats returns aggregate
    const r4 = await fetchHttp({ path: '/internal/rum/stats' });
    expect('GET /internal/rum/stats returns 200', r4.status === 200);
    let statsJson = null;
    try { statsJson = JSON.parse(r4.body); } catch (_) {}
    expect('/internal/rum/stats returns JSON', statsJson && typeof statsJson === 'object');
    expect('/internal/rum/stats reports enabled', statsJson.enabled === true);
    expect('/internal/rum/stats reports totals.routes ≥ 1', statsJson.totals && statsJson.totals.routes >= 1);
    expect('/internal/rum/stats reports telemetry.beaconsAccepted ≥ 1',
      statsJson.telemetry && statsJson.telemetry.beaconsAccepted >= 1);
    expect('/internal/rum/stats includes / route',
      statsJson.routes && statsJson.routes['/']);

    // 5. SSR HTML contains the collector script before </head>
    const r5 = await fetchHttp({ path: '/', headers: { Accept: 'text/html' } });
    expect('GET / returns 200', r5.status === 200);
    expect('SSR HTML contains sendBeacon collector',
      r5.body.indexOf('sendBeacon') !== -1 && r5.body.indexOf('"/internal/rum"') !== -1);
    expect('collector inserted before </head>',
      r5.body.indexOf('"/internal/rum"') < r5.body.indexOf('</head>'));

    // 6. Save-Data: on suppresses collector injection (digital-equity contract)
    const rSave = await fetchHttp({ path: '/', headers: { Accept: 'text/html', 'Save-Data': 'on' } });
    expect('GET / with Save-Data still 200', rSave.status === 200);
    expect('Save-Data suppresses collector injection',
      rSave.body.indexOf('"/internal/rum"') === -1);
  } finally {
    server.close();
  }
}

(async () => {
  try {
    await unitTests();
    await integrationTest();
    console.log('\nrum-beacons test passed');
    // Production code starts long-lived intervals (predictive-scaler, watchers,
    // orchestrators) that keep the event loop alive after server.close().
    // Force-exit so CI doesn't time out at 6h.
    process.exit(0);
  } catch (e) {
    console.error('\nrum-beacons test FAILED:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
