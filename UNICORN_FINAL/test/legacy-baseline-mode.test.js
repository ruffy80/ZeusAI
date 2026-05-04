// test/legacy-baseline-mode.test.js
// -----------------------------------------------------------------------------
// Verifies the SITE_LEGACY_BASELINE_MODE master switch contract.
//
// When set to '1', the legacyBaselineModeGuard IIFE at the top of
// src/index.js MUST propagate disable flags for every post-2026-05-04
// 17:21 UTC (commit 89a8b7f3) site feature so that a baseline-pinning
// audit gets bit-identical pre-PR-#515/#516 behavior — without any code
// revert.
//
// Coverage:
//   1. The 6 disable env vars are set after the guard runs.
//   2. SSR HTML for `/` does NOT contain <script type="speculationrules">
//      (post-PR-#515 injection) or the RUM Web Vitals collector
//      (post-PR-#516 injection).
//   3. Response headers do NOT advertise Save-Data via Accept-CH (a
//      post-PR-#515 client-hint), the Vary header does NOT include
//      Save-Data, and Content-Encoding is absent (no gzip — post-PR-#515
//      compression middleware bypassed).
//   4. Critical baseline functionality is still 100% intact:
//      • `/health` responds 200
//      • `/snapshot` responds 200
//      • `/internal/topology` reports role:'site'
//      • SSR `/` includes the live-pricing hooks (`data-pricing-value`)
//        and BTC markers — proving the user-visible 4.5h-ago page
//        survives the rollback.
//
// Operator-set values are respected: the guard never overwrites a flag
// that's already explicitly set (covered indirectly — we set the master
// switch BEFORE require so all defaults apply).
// -----------------------------------------------------------------------------
'use strict';

// Set the master switch BEFORE requiring src/index.js so the IIFE picks it
// up at module-load time (matches production PM2 --update-env semantics).
process.env.SITE_LEGACY_BASELINE_MODE = '1';
// Make sure no leftover env from a prior test in the same `npm test` run
// can mask the master switch's effect.
delete process.env.SITE_COMPRESSION_DISABLED;
delete process.env.SITE_ASSET_MEMCACHE_DISABLED;
delete process.env.SITE_PREDICTIVE_PREFETCH_DISABLED;
delete process.env.SITE_SPECULATION_RULES_DISABLED;
delete process.env.SITE_RUM_BEACONS_DISABLED;
delete process.env.PREFETCH_PERSIST_DISABLED;

const assert = require('assert');

async function run() {
  // 1. Guard propagated all six disable flags.
  const siteModule = require('../src/index');
  for (const k of [
    'SITE_COMPRESSION_DISABLED',
    'SITE_ASSET_MEMCACHE_DISABLED',
    'SITE_PREDICTIVE_PREFETCH_DISABLED',
    'SITE_SPECULATION_RULES_DISABLED',
    'SITE_RUM_BEACONS_DISABLED',
    'PREFETCH_PERSIST_DISABLED',
  ]) {
    assert.equal(process.env[k], '1',
      'legacyBaselineModeGuard must propagate ' + k + '=1 when SITE_LEGACY_BASELINE_MODE=1');
  }
  console.log('  ✅ all 6 disable flags propagated by master switch');

  const createSite = typeof siteModule.createServer === 'function' ? siteModule.createServer : null;
  assert.ok(createSite, 'src/index.js must export createServer');
  const server = createSite();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  try {
    // 2. SSR HTML must not contain post-baseline injections.
    // Explicitly opt out of Accept-Encoding so Node's fetch doesn't
    // transparently decompress, letting us see the raw transport choice.
    const rootRes = await fetch(base + '/', {
      headers: { 'Accept-Encoding': 'gzip, br, deflate' }
    });
    assert.equal(rootRes.status, 200, 'baseline / must respond 200');

    // 3a. No gzip/brotli/deflate Content-Encoding (compression bypassed).
    const enc = rootRes.headers.get('content-encoding');
    assert.ok(!enc || enc === 'identity',
      'baseline / must not advertise Content-Encoding (got: ' + enc + ')');
    console.log('  ✅ no Content-Encoding (compression bypassed)');

    // 3b. No Save-Data in Accept-CH or Vary (predictive-prefetch silent).
    const acceptCh = String(rootRes.headers.get('accept-ch') || '');
    assert.ok(!/Save-Data/i.test(acceptCh),
      'baseline / must not advertise Save-Data via Accept-CH (got: ' + acceptCh + ')');
    const vary = String(rootRes.headers.get('vary') || '');
    assert.ok(!/Save-Data/i.test(vary),
      'baseline / Vary must not include Save-Data (got: ' + vary + ')');
    console.log('  ✅ no Save-Data in Accept-CH or Vary');

    // 3c. Link header has only baseline preloads, no rel=prefetch hints.
    const link = String(rootRes.headers.get('link') || '');
    assert.ok(!/rel=prefetch/i.test(link),
      'baseline / Link header must not include rel=prefetch hints (got: ' + link + ')');
    console.log('  ✅ no rel=prefetch in Link header');

    const html = await rootRes.text();

    // 2a. No Speculation Rules script.
    assert.equal(html.indexOf('<script type="speculationrules"'), -1,
      'baseline SSR HTML must NOT contain <script type="speculationrules">');
    console.log('  ✅ no <script type="speculationrules"> in SSR');

    // 2b. No RUM Web Vitals collector. We look for the
    // navigator.sendBeacon('/internal/rum' ...) pattern emitted by the
    // collector — accept either single or double quotes.
    assert.ok(html.indexOf('/internal/rum') === -1,
      'baseline SSR HTML must NOT contain RUM beacon endpoint reference');
    console.log('  ✅ no /internal/rum collector in SSR');

    // 4. Baseline functionality (4.5h-ago contract) still intact.
    // 4a. /health
    const healthRes = await fetch(base + '/health');
    assert.equal(healthRes.status, 200, '/health must respond 200 in baseline mode');
    console.log('  ✅ /health → 200');

    // 4b. /snapshot
    const snapRes = await fetch(base + '/snapshot');
    assert.equal(snapRes.status, 200, '/snapshot must respond 200 in baseline mode');
    console.log('  ✅ /snapshot → 200');

    // 4c. /internal/topology still reports role:'site'
    const topoRes = await fetch(base + '/internal/topology');
    assert.equal(topoRes.status, 200, '/internal/topology must respond 200');
    const topo = await topoRes.json();
    assert.equal(topo.role, 'site', 'topology.role must remain "site" in baseline mode');
    console.log('  ✅ /internal/topology → role:site');

    // 4d. SSR HTML preserves the user-visible live-pricing + BTC markers
    // that the user complained went missing. Their PRESENCE in baseline
    // mode proves the rollback didn't strip the underlying SSR contract.
    assert.ok(html.indexOf('data-pricing-value') !== -1,
      'baseline SSR HTML must still contain data-pricing-value hooks (live pricing DOM contract)');
    console.log('  ✅ SSR HTML contains data-pricing-value hooks');
    assert.ok(/BTC/i.test(html),
      'baseline SSR HTML must still contain BTC markers');
    console.log('  ✅ SSR HTML contains BTC markers');

    // 4e. Static asset /assets/app.js still served (just not from memcache).
    const jsRes = await fetch(base + '/assets/app.js');
    assert.equal(jsRes.status, 200, '/assets/app.js must respond 200 in baseline mode');
    const js = await jsRes.text();
    assert.ok(/openStream|openPricingStream|EventSource/.test(js),
      '/assets/app.js must still contain the baseline SSE wiring');
    console.log('  ✅ /assets/app.js still serves the SSE wiring');

    // 5. Predictive-prefetch stats endpoint reports the disabled state
    // honestly — proves the runtime switch reached the module.
    const ppStatsRes = await fetch(base + '/internal/prefetch/stats');
    if (ppStatsRes.status === 200) {
      const ppStats = await ppStatsRes.json();
      assert.equal(ppStats.enabled, false,
        '/internal/prefetch/stats must report enabled:false in baseline mode (got: ' + JSON.stringify(ppStats) + ')');
      console.log('  ✅ /internal/prefetch/stats reports enabled:false');
    } else {
      console.log('  ℹ /internal/prefetch/stats not present (acceptable in baseline mode)');
    }
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }

  console.log('legacy-baseline-mode test passed');
}

run().then(() => {
  // Force-exit: src/index.js loads long-lived intervals (predictive-scaler,
  // watchdogs, orchestrators) that legitimately keep the event loop alive.
  // See test/health.test.js, test/topology.test.js for the same pattern.
  process.exit(0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
