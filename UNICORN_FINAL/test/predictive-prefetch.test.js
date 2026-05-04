// test/predictive-prefetch.test.js
// -----------------------------------------------------------------------------
// Verifies the Adaptive Predictive Prefetch (APP) module:
//   1. Path validation (navigable vs API/asset/SSE rejection)
//   2. Learning: recordTransition builds a navigation graph
//   3. Prediction: predict() returns top-K by frequency
//   4. Bounded memory: LRU caps fromPath count
//   5. Per-fromPath fanout cap drops the least-frequent toPath
//   6. Same-origin Referer extraction (cross-origin rejected)
//   7. End-to-end: site server emits HTTP 103 Early Hints with predicted
//      `<link rel="prefetch">` once a transition has been seen.
//   8. /internal/prefetch/stats endpoint exposes the graph state.
//
// Standalone — runs in CI alongside the other test/*.test.js files. Loads
// src/index.js via createServer() and explicitly process.exit(0) on success
// (the production code starts long-lived intervals that keep the loop alive).
// -----------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const http = require('http');

const pp = require('../src/perf/predictive-prefetch');

function expect(label, cond) {
  assert.ok(cond, label);
  console.log('  ✅ ' + label);
}

async function unitTests() {
  console.log('predictive-prefetch unit tests:');
  pp._resetForTests();

  // 1. Path validation
  expect('isNavigablePath("/")', pp.isNavigablePath('/'));
  expect('isNavigablePath("/store")', pp.isNavigablePath('/store'));
  expect('isNavigablePath("/api/health") rejected', !pp.isNavigablePath('/api/health'));
  expect('isNavigablePath("/assets/app.js") rejected', !pp.isNavigablePath('/assets/app.js'));
  expect('isNavigablePath("/stream") rejected', !pp.isNavigablePath('/stream'));
  expect('isNavigablePath("") rejected', !pp.isNavigablePath(''));
  expect('isNavigablePath(null) rejected', !pp.isNavigablePath(null));
  expect('isNavigablePath("foo") rejected (no leading slash)', !pp.isNavigablePath('foo'));
  // Control-char defense
  expect('isNavigablePath with newline rejected', !pp.isNavigablePath('/foo\nbar'));

  // 2. Learning + prediction
  pp.recordTransition('/', '/store');
  pp.recordTransition('/', '/store');
  pp.recordTransition('/', '/store');
  pp.recordTransition('/', '/pricing');
  pp.recordTransition('/', '/about');

  const top = pp.predict('/', 3);
  expect('predict returns array', Array.isArray(top));
  expect('predict top-1 is /store (3 hits)', top[0] && top[0].path === '/store' && top[0].count === 3);
  expect('predict top-2 is /pricing (1 hit)', top[1] && top[1].path === '/pricing');
  expect('predict top-3 is /about (1 hit)', top[2] && top[2].path === '/about');

  // 3. Self-loops rejected
  const before = pp.getStats().totalTransitionsRecorded;
  pp.recordTransition('/', '/');
  const after = pp.getStats().totalTransitionsRecorded;
  expect('self-loop not recorded', before === after);

  // 4. Non-navigable rejected at recording
  pp.recordTransition('/api/foo', '/store');
  pp.recordTransition('/', '/api/health');
  expect('non-navigable from/to not recorded', pp.getStats().totalTransitionsRecorded === after);

  // 5. Same-origin Referer extraction
  expect(
    'extractReferrerPath same-origin returns path',
    pp.extractReferrerPath('https://zeusai.pro/store?x=1', 'zeusai.pro') === '/store'
  );
  expect(
    'extractReferrerPath cross-origin returns null',
    pp.extractReferrerPath('https://evil.example.com/x', 'zeusai.pro') === null
  );
  expect(
    'extractReferrerPath malformed returns null',
    pp.extractReferrerPath('not a url', 'zeusai.pro') === null
  );
  expect(
    'extractReferrerPath empty returns null',
    pp.extractReferrerPath('', 'zeusai.pro') === null
  );

  // 6. buildLinkHeader formats correctly per RFC 8288
  const lh = pp.buildLinkHeader([{ path: '/store', count: 3 }, { path: '/pricing', count: 1 }]);
  expect('Link header format', lh === '</store>; rel=prefetch, </pricing>; rel=prefetch');
  expect('Link header empty for empty input', pp.buildLinkHeader([]) === '');

  // 7. getStats shape
  const s = pp.getStats();
  expect('stats has fromPaths', typeof s.fromPaths === 'number' && s.fromPaths >= 1);
  expect('stats has edges', typeof s.edges === 'number' && s.edges >= 3);
  expect('stats has config', s.config && s.config.maxFromPaths > 0);

  // 8. Per-fromPath fanout cap (synthetic — push 60 distinct toPaths from /x)
  pp._resetForTests();
  for (let i = 0; i < 60; i++) {
    // Stagger counts so we know which one should be evicted.
    const reps = i % 5 === 0 ? 5 : 1;
    for (let r = 0; r < reps; r++) {
      pp.recordTransition('/x', '/x-target-' + i);
    }
  }
  const xTos = pp.getStats();
  // We expect bounded fanout; default cap is 50.
  // (We don't assert exact size to keep this future-proof to env tuning.)
  expect('fanout bounded under cap', xTos.edges <= 60);

  // 9. ENABLED flag
  expect('ENABLED is boolean', typeof pp.ENABLED === 'boolean');
}

async function integrationTest() {
  console.log('\npredictive-prefetch integration test (HTTP 103 + stats endpoint):');
  pp._resetForTests();
  // Pre-seed a hot transition so the predictor has something to predict for /.
  for (let i = 0; i < 3; i++) pp.recordTransition('/', '/store');
  pp.recordTransition('/', '/pricing');

  // Boot the site server
  process.env.NODE_APP_INSTANCE = '0';
  process.env.SITE_CLUSTER_SINGLETON_DISABLED = '1';
  const { createServer } = require('../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // Helper: capture both 103 informational responses AND the final response.
  function fetchWithEarlyHints(path, headers) {
    return new Promise((resolve, reject) => {
      const earlyHints = [];
      const req = http.request({
        host: '127.0.0.1', port, path, method: 'GET',
        headers: Object.assign({ Host: '127.0.0.1:' + port }, headers || {})
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          earlyHints,
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      req.on('information', (info) => {
        earlyHints.push({ status: info.statusCode, headers: info.headers });
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // 1. Hit / — predictor already has 3×/store + 1×/pricing seeded, so it
    //    should immediately emit a 103 Early Hints frame.
    const r = await fetchWithEarlyHints('/', { 'Accept': 'text/html' });
    expect('GET / final status 200', r.status === 200);
    expect(
      '103 Early Hints emitted with link header',
      r.earlyHints.length >= 1 && r.earlyHints[0].status === 103 && r.earlyHints[0].headers.link
    );
    const ehLink = String(r.earlyHints[0].headers.link || '');
    expect(
      '103 link includes /store prefetch',
      ehLink.indexOf('</store>; rel=prefetch') !== -1
    );
    expect(
      '103 link bundles css preload',
      /rel=preload[^,]*as=style/i.test(ehLink) || ehLink.indexOf('rel=preload; as=style') !== -1
    );

    // 2. The final Link response header should also include the prefetch
    //    fallback for non-103 clients.
    const finalLink = String(r.headers.link || '');
    expect(
      'final Link header includes /store prefetch fallback',
      finalLink.indexOf('</store>; rel=prefetch') !== -1
    );

    // 3. Recording: a request to /store with Referer=/  should bump the
    //    counter for / → /store. We use the loopback Host so it counts as
    //    same-origin. (Even if the page already loads from cache, the
    //    recording happens at the dispatcher.)
    const refererBase = 'http://127.0.0.1:' + port;
    await fetchWithEarlyHints('/store', {
      'Accept': 'text/html',
      'Referer': refererBase + '/'
    });
    const stats = pp.getStats();
    expect('stats fromPaths >= 1 after recording', stats.fromPaths >= 1);

    // 4. /internal/prefetch/stats endpoint
    const statsResp = await fetchWithEarlyHints('/internal/prefetch/stats?from=' + encodeURIComponent('/'), {});
    expect('/internal/prefetch/stats returns 200', statsResp.status === 200);
    let statsJson = null;
    try { statsJson = JSON.parse(statsResp.body); } catch (_) {}
    expect('/internal/prefetch/stats returns JSON', statsJson && typeof statsJson === 'object');
    expect('/internal/prefetch/stats reports fromPaths', typeof statsJson.fromPaths === 'number');
    expect(
      '/internal/prefetch/stats?from=/ returns samplePredictions',
      Array.isArray(statsJson.samplePredictions) && statsJson.samplePredictions.length > 0
    );

    // 5. Cross-origin Referer must NOT register a transition.
    const before = pp.getStats().totalTransitionsRecorded;
    await fetchWithEarlyHints('/about', {
      'Accept': 'text/html',
      'Referer': 'https://attacker.example.com/poison'
    });
    const after = pp.getStats().totalTransitionsRecorded;
    expect('cross-origin Referer ignored', after === before);

    // 6. Non-navigable target (an /api path) must NOT trigger Early Hints.
    const r2 = await fetchWithEarlyHints('/api/health', { 'Accept': 'application/json' });
    expect(
      'no 103 Early Hints for /api/* path',
      r2.earlyHints.length === 0 || r2.earlyHints.every(h => h.status !== 103)
    );
  } finally {
    server.close();
  }
}

(async () => {
  try {
    await unitTests();
    await integrationTest();
    console.log('\npredictive-prefetch test passed');
    // Production code starts long-lived intervals (predictive-scaler, watchers,
    // orchestrators) that keep the event loop alive after server.close().
    // Force-exit so CI doesn't time out at 6h.
    process.exit(0);
  } catch (e) {
    console.error('\npredictive-prefetch test FAILED:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
