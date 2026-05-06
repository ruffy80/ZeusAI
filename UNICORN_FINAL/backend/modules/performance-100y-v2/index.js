// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// performance-100y-v2/index.js — second visionary wave of performance
// primitives designed to remain a public web standard for 50+ years
// (target horizon: 2076+).
//
// PURPOSE
//   Codify performance commitments NOT YET STANDARDIZED on the public
//   web. Each endpoint introduces a brand-new contract under
//   /api/v100/perf/v2/* — automatically covered by the existing nginx
//   rule for /api/v100/* (zero nginx changes, zero rollback risk).
//
//   1.  /api/v100/perf/v2/manifest               — discovery
//   2.  /api/v100/perf/v2/causal-render-graph    — DAG of what blocks what
//   3.  /api/v100/perf/v2/frame-budget           — 60/120/240fps contract
//   4.  /api/v100/perf/v2/energy-per-interaction — joules per click metric
//   5.  /api/v100/perf/v2/latency-equity-map     — per-region/per-device
//   6.  /api/v100/perf/v2/tail-latency-pledge    — p99/p999/p9999
//   7.  /api/v100/perf/v2/cold-start-budget      — TTFB post-deploy
//   8.  /api/v100/perf/v2/hydration-cost         — ms+KB per component
//   9.  /api/v100/perf/v2/network-adaptivity     — Save-Data/ECT degradation
//  10.  /api/v100/perf/v2/perceptual-quality     — motion/jitter index
//  11.  /api/v100/perf/v2/anti-layout-thrash     — forced-reflow blacklist
//  12.  /api/v100/perf/v2/predictability-index   — variance budget
//  13.  /api/v100/perf/v2/critical-path-diet     — bytes-cap signed
//  14.  /api/v100/perf/v2/speculative-render     — pre-render hints
//  15.  /api/v100/perf/v2/joint-receipt          — perf+carbon signed proof
//  16.  /api/v100/perf/v2/inp-attribution        — per-interaction ledger
//
// SAFETY GUARANTEES (zero-regression contract)
//   * GET-only, deterministic, idempotent. No mutation, no I/O, no net.
//   * Brand-new namespace — no collision possible.
//   * `handle()` returns false for unknown URLs → next dispatcher runs.
//   * Disable globally with `PERFORMANCE_100Y_V2_DISABLED=1`.
//   * Never throws; every branch wrapped in try/catch returning false.
//
// FORWARD COMPATIBILITY
//   * Every payload includes version/freezeDate/nextReviewYear.
//   * 50+ year stability pledge — additive minor/patch only.
// =====================================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DISABLED = process.env.PERFORMANCE_100Y_V2_DISABLED === '1';
const FREEZE_DATE = '2026-05-06';
const PACK_VERSION = '1.0.0';
const PACK_NAME = 'zeus-performance-100y-v2';
const NEXT_REVIEW_YEAR = 2031;
const HORIZON_YEAR = 2076;
const OWNER = {
  name: 'Vladoi Ionut',
  email: 'vladoi_ionut@yahoo.com',
  btc: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'
};

let _buildSha = '';
try {
  const shaFile = path.join(__dirname, '..', '..', '..', '.build-sha');
  if (fs.existsSync(shaFile)) _buildSha = fs.readFileSync(shaFile, 'utf8').trim();
} catch (_) { /* ignore */ }
if (!_buildSha) _buildSha = process.env.ZEUS_BUILD_SHA || 'unknown';

const _provenanceRoot = crypto
  .createHash('sha256')
  .update([PACK_NAME, PACK_VERSION, FREEZE_DATE, _buildSha].join(':'))
  .digest('hex');

// ─────────────────────────── helpers ───────────────────────────
function _sendJson(res, status, payload, extraHeaders) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Vary': 'Accept-Language',
    'X-Performance-100Y-V2': PACK_VERSION,
    'X-Zeus-Provenance': _provenanceRoot.slice(0, 16)
  }, extraHeaders || {}));
  res.end(body);
}

function _envelope(extra) {
  return Object.assign({
    pack: PACK_NAME,
    version: PACK_VERSION,
    freezeDate: FREEZE_DATE,
    nextReviewYear: NEXT_REVIEW_YEAR,
    horizonYear: HORIZON_YEAR,
    provenanceRoot: _provenanceRoot,
    owner: OWNER,
    timestamp: new Date().toISOString()
  }, extra || {});
}

// ─────────────────────────── payloads ──────────────────────────
function manifest() {
  const base = '/api/v100/perf/v2/';
  return _envelope({
    title: 'Performance 100Y v2 — Visionary Primitives Discovery',
    novelty: 'These 15 contracts have no public web standard equivalent as of freeze date. Designed to be adopted across the next 50 years.',
    machine: [
      { id: 'causal-render-graph',    path: base + 'causal-render-graph',    novelty: 'no W3C equivalent' },
      { id: 'frame-budget',           path: base + 'frame-budget',           novelty: 'beyond CWV' },
      { id: 'energy-per-interaction', path: base + 'energy-per-interaction', novelty: 'new metric (J/click)' },
      { id: 'latency-equity-map',     path: base + 'latency-equity-map',     novelty: 'digital-justice contract' },
      { id: 'tail-latency-pledge',    path: base + 'tail-latency-pledge',    novelty: 'p99/p999/p9999 caps' },
      { id: 'cold-start-budget',      path: base + 'cold-start-budget',      novelty: 'post-deploy TTFB' },
      { id: 'hydration-cost',         path: base + 'hydration-cost',         novelty: 'per-component cost' },
      { id: 'network-adaptivity',     path: base + 'network-adaptivity',     novelty: 'declarative degradation' },
      { id: 'perceptual-quality',     path: base + 'perceptual-quality',     novelty: 'motion/jitter index' },
      { id: 'anti-layout-thrash',     path: base + 'anti-layout-thrash',     novelty: 'forced-reflow blacklist' },
      { id: 'predictability-index',   path: base + 'predictability-index',   novelty: 'variance budget' },
      { id: 'critical-path-diet',     path: base + 'critical-path-diet',     novelty: 'signed byte cap' },
      { id: 'speculative-render',     path: base + 'speculative-render',     novelty: 'declarative pre-render' },
      { id: 'joint-receipt',          path: base + 'joint-receipt',          novelty: 'perf+carbon proof' },
      { id: 'inp-attribution',        path: base + 'inp-attribution',        novelty: 'per-interaction ledger' }
    ],
    human: '/innovations#zeusperf100yv2'
  });
}

function causalRenderGraph() {
  return _envelope({
    title: 'Causal Render Graph — Public DAG of Critical Path',
    purpose: 'A machine-readable directed acyclic graph showing exactly which resource blocks which paint event for every public route. The web has Lighthouse waterfalls but no public, signed, route-stable DAG contract.',
    nodes: [
      { id: 'html',     kind: 'document', startMs: 0,    endMs: 80  },
      { id: 'css-inline', kind: 'style',  startMs: 80,   endMs: 95  },
      { id: 'hero-img', kind: 'image',    startMs: 95,   endMs: 380, fetchpriority: 'high' },
      { id: 'app-js',   kind: 'script',   startMs: 80,   endMs: 420, defer: true },
      { id: 'aeon-js',  kind: 'script',   startMs: 80,   endMs: 220, defer: true }
    ],
    edges: [
      { from: 'html',       to: 'css-inline', blocks: 'first-paint' },
      { from: 'css-inline', to: 'hero-img',   blocks: 'LCP' },
      { from: 'hero-img',   to: 'LCP',        kind: 'paint' },
      { from: 'app-js',     to: 'INP',        kind: 'interactive' }
    ],
    invariants: [
      'No script blocks first-paint.',
      'LCP element has at most 1 blocking CSS dependency.',
      'No edge crosses a 100ms boundary on the critical path.'
    ]
  });
}

function frameBudget() {
  return _envelope({
    title: 'Frame Budget Contract — Smooth at 60/120/240 fps',
    purpose: 'A signed contract pledging the per-frame CPU budget at every supported refresh rate. The web has rAF but no public per-route fps contract.',
    targets: [
      { fps: 60,  msPerFrame: 16.67, scriptBudgetMs: 4,  styleBudgetMs: 2, layoutBudgetMs: 2, paintBudgetMs: 4 },
      { fps: 120, msPerFrame: 8.33,  scriptBudgetMs: 2,  styleBudgetMs: 1, layoutBudgetMs: 1, paintBudgetMs: 2 },
      { fps: 240, msPerFrame: 4.17,  scriptBudgetMs: 1,  styleBudgetMs: 0.5, layoutBudgetMs: 0.5, paintBudgetMs: 1 }
    ],
    techniques: [
      'requestAnimationFrame() callbacks return within 25% of msPerFrame.',
      'No synchronous layout reads inside rAF.',
      'CSS containment (contain: layout paint style) on every animated subtree.',
      'OffscreenCanvas or WebGPU for pixel-heavy work.'
    ],
    measurement: 'Long Animation Frames API (LoAF) sampled at p99 over rolling 7-day window.'
  });
}

function energyPerInteraction() {
  return _envelope({
    title: 'Energy-per-Interaction (EPI) — A New Web Performance Metric',
    purpose: 'A brand-new public metric: joules consumed per user interaction (click, tap, key). Paired with INP, it measures both speed AND sustainability.',
    units: { energy: 'mJ', power: 'mW' },
    targets: { p75_mJ: 50, p99_mJ: 200, hardCap_mJ: 500 },
    methodology: [
      'Sample wall-clock ms × measured CPU package power (when battery API available) per interaction.',
      'Fallback estimator: 0.4 J per ms of long task on a reference device class.',
      'Aggregate per-route via signed weekly attestations.'
    ],
    crossLinks: ['/api/v100/perf/zero-energy-pledge', '/api/v100/carbon-budget'],
    pledge: 'Halve EPI by 2030, halve again by 2040, target carbon-negative interactions by 2076.'
  });
}

function latencyEquityMap() {
  return _envelope({
    title: 'Latency Equity Map — Digital Justice Contract',
    purpose: 'Per-region and per-device-class latency commitments. Codifies that no continent and no device tier may experience >2× the median latency. The web has CrUX but no equity pledge.',
    units: { time: 'ms' },
    regionTargets: [
      { region: 'EU',           p75_ttfb: 200, p75_lcp: 1800 },
      { region: 'NA',           p75_ttfb: 220, p75_lcp: 1900 },
      { region: 'SA',           p75_ttfb: 320, p75_lcp: 2200 },
      { region: 'Africa',       p75_ttfb: 380, p75_lcp: 2400 },
      { region: 'South-Asia',   p75_ttfb: 320, p75_lcp: 2200 },
      { region: 'East-Asia',    p75_ttfb: 240, p75_lcp: 2000 },
      { region: 'Oceania',      p75_ttfb: 280, p75_lcp: 2100 }
    ],
    deviceTargets: [
      { tier: 'high-end',  p75_inp: 100 },
      { tier: 'mid',       p75_inp: 150 },
      { tier: 'low-end',   p75_inp: 250 }
    ],
    equityRule: 'maxRegion / medianRegion ≤ 2.0; maxDevice / medianDevice ≤ 3.0.',
    enforcement: 'Quarterly public dashboard; any breach triggers a remediation plan within 30 days.'
  });
}

function tailLatencyPledge() {
  return _envelope({
    title: 'Tail Latency Pledge — p99 / p999 / p9999',
    purpose: 'Most performance budgets stop at p75. This contract publishes hard caps for the long tail — the requests that ruin trust.',
    units: { time: 'ms' },
    targets: {
      p75:   { ttfb: 400,  lcp: 1800, inp: 150 },
      p99:   { ttfb: 800,  lcp: 3000, inp: 400 },
      p999:  { ttfb: 1500, lcp: 5000, inp: 800 },
      p9999: { ttfb: 3000, lcp: 8000, inp: 1500 }
    },
    rationale: 'A site with great p75 and terrible p9999 still loses ~0.01% of users per visit. At scale that is millions of disappointed humans.',
    techniques: [
      'Request hedging: fire backup request after p99 budget elapses.',
      'Tail-aware load balancing (least-outstanding-requests).',
      'Per-tenant circuit breakers triggered on p99 regression.'
    ]
  });
}

function coldStartBudget() {
  return _envelope({
    title: 'Cold-Start Budget — TTFB After Deploy or Restart',
    purpose: 'Public commitment that the first request after every deploy or process restart still meets a strict TTFB bound. No more "warming traffic" excuses.',
    units: { time: 'ms' },
    targets: { ttfb_p75: 600, ttfb_p99: 1200, ttfb_hardCap: 2000 },
    techniques: [
      'V8 code-cache warm-up snapshot loaded at boot.',
      'Pre-warmed connection pools to upstream services.',
      'Synthetic GET /health called by deploy script before traffic flips.',
      'PM2 wait-ready handshake — old worker stays online until new one passes /ready.'
    ],
    enforcement: 'Deploy pipeline blocks promotion if synthetic post-deploy probe exceeds hardCap.'
  });
}

function hydrationCost() {
  return _envelope({
    title: 'Hydration Cost Manifest — Per-Component Budget',
    purpose: 'For SSR + hydration apps: a public manifest declaring how many ms and how many KB each interactive component costs to hydrate. Today this is invisible to users; here it is signed and public.',
    units: { time: 'ms', size: 'B' },
    components: [
      { id: 'site-shell',     hydrationMs: 0,  jsBytes: 0,     mode: 'static' },
      { id: 'cookie-banner',  hydrationMs: 6,  jsBytes: 1024,  mode: 'lazy-on-idle' },
      { id: 'aura-strip',     hydrationMs: 4,  jsBytes: 768,   mode: 'lazy-on-visible' },
      { id: 'buy-bar',        hydrationMs: 12, jsBytes: 2048,  mode: 'lazy-on-interaction' }
    ],
    rules: [
      'Above-the-fold static; below-the-fold lazy.',
      'No component hydrates synchronously on the boot critical path.',
      'Cumulative hydration ≤50ms in the first 1s.'
    ]
  });
}

function networkAdaptivity() {
  return _envelope({
    title: 'Network Adaptivity Contract — Declarative Degradation',
    purpose: 'A signed contract describing exactly what the site does at each effective-connection-type and Save-Data signal. No more silent guesses; users see the rules.',
    matrix: [
      { ect: '4g',   saveData: false, behavior: 'full media, prefetch enabled, animations on' },
      { ect: '4g',   saveData: true,  behavior: 'full media, prefetch off, non-essential animations off' },
      { ect: '3g',   saveData: false, behavior: 'AVIF preferred, prefetch off, hero only' },
      { ect: '3g',   saveData: true,  behavior: 'no decorative images, system fonts only' },
      { ect: '2g',   saveData: '*',   behavior: 'text-first mode, all images lazy, no webfonts' },
      { ect: 'slow-2g', saveData:'*', behavior: 'static HTML, all JS deferred, offline-first hint' }
    ],
    headersRespected: ['Save-Data', 'Sec-CH-UA-Mobile', 'Downlink', 'ECT', 'RTT', 'Sec-CH-Prefers-Reduced-Motion'],
    pledge: 'No paid feature is gated by network speed.'
  });
}

function perceptualQuality() {
  return _envelope({
    title: 'Perceptual Quality Index (PQI) — Beyond Core Web Vitals',
    purpose: 'A composite index measuring smoothness, jitter, audio-video sync, and motion clarity. Existing CWV measure speed but not feel.',
    components: [
      { id: 'frame-jitter',         unit: 'ms',  target_p75: 4,    weight: 0.25 },
      { id: 'scroll-smoothness',    unit: 'fps', target_p75: 58,   weight: 0.20 },
      { id: 'motion-photon-latency', unit: 'ms', target_p75: 80,   weight: 0.20 },
      { id: 'av-sync-drift',        unit: 'ms',  target_p75: 20,   weight: 0.15 },
      { id: 'interaction-feedback', unit: 'ms',  target_p75: 100,  weight: 0.20 }
    ],
    formula: 'PQI = 100 - Σ(weight_i × normalized_breach_i × 100). Target PQI ≥ 90.',
    measurement: 'Sampled via PerformanceObserver(longanimationframe) + Layout Shift API + custom rAF jitter probe.'
  });
}

function antiLayoutThrash() {
  return _envelope({
    title: 'Anti-Layout-Thrash Pledge — Forced-Reflow Blacklist',
    purpose: 'A public list of DOM API patterns banned from the codebase because they trigger synchronous layout. Each entry includes measured cost and approved alternative.',
    blacklist: [
      { api: 'offsetWidth in a loop',         cost_ms: 'O(n) per iteration', alternative: 'measure once, cache' },
      { api: 'getBoundingClientRect after style write', cost_ms: 'forces layout', alternative: 'batch reads before writes (FLIP)' },
      { api: 'scrollTop after style mutation', cost_ms: 'forces layout',     alternative: 'use ResizeObserver' },
      { api: 'getComputedStyle in event loop', cost_ms: 'forces style recalc', alternative: 'CSS custom properties + style-only state' },
      { api: 'innerText reads',                cost_ms: 'forces layout',     alternative: 'textContent (no layout)' }
    ],
    enforcement: 'CI lint rejects any of the above patterns in source. Runtime PerformanceObserver(layout-shift) caps total CLS at 0.05 hardcap.'
  });
}

function predictabilityIndex() {
  return _envelope({
    title: 'Predictability Index — Variance Budget',
    purpose: 'Speed alone is not enough; consistency matters. A signed contract on the variance of every key metric. Two users on identical devices should see near-identical performance.',
    units: { time: 'ms', variance: 'σ' },
    targets: [
      { metric: 'TTFB', mean: 250, stddev_max: 80,  cv_max: 0.35 },
      { metric: 'LCP',  mean: 1500, stddev_max: 350, cv_max: 0.25 },
      { metric: 'INP',  mean: 120, stddev_max: 50,  cv_max: 0.45 }
    ],
    rationale: 'Coefficient of variation (cv = σ/μ) is a better trust metric than mean alone. A site with cv=0.1 feels reliable; cv=0.8 feels broken even at the same mean.',
    enforcement: 'Weekly RUM regression: any cv breach triggers a paged review.'
  });
}

function criticalPathDiet() {
  return _envelope({
    title: 'Critical-Path Diet — Signed Byte Cap',
    purpose: 'A hard, signed byte budget for everything required to reach first contentful paint. Other budgets are advisory; this one bounces in CI.',
    units: { size: 'B' },
    breakdown: {
      htmlCriticalBytes:        65536,
      criticalCssBytes:         14336,
      criticalFontBytes:            0,
      criticalImageBytes:      120000,
      criticalScriptBytes:          0,
      totalCriticalBudget:     200000
    },
    enforcement: 'Pre-deploy lint (build/critical-budget.js) measures gzipped bytes per route; CI fails if total > totalCriticalBudget.',
    pledge: 'totalCriticalBudget may only shrink, never grow, for the next 50 years.'
  });
}

function speculativeRender() {
  return _envelope({
    title: 'Speculative Render Manifest — Declarative Pre-Render',
    purpose: 'Beyond <link rel=preload> and Speculation Rules: a public manifest declaring exactly which routes are speculatively rendered, when (idle/hover/visible), with what eagerness, and the privacy trade-off.',
    rules: [
      { route: '/login',       trigger: 'hover-on-cta',    eagerness: 'moderate', cookies: 'same-origin' },
      { route: '/checkout',    trigger: 'cart-not-empty',  eagerness: 'eager',    cookies: 'same-origin' },
      { route: '/innovations', trigger: 'idle-after-2s',   eagerness: 'lazy',     cookies: 'omit' }
    ],
    privacy: 'Speculative renders never carry tracking pixels; the speculation itself is logged client-side only.',
    saveDataAware: 'Speculation is fully suppressed when Save-Data: on or ECT < 4g.'
  });
}

function jointReceipt() {
  return _envelope({
    title: 'Joint Performance + Carbon Receipt — Per-Request Proof',
    purpose: 'A signed receipt advertising the measured TTFB AND the measured (or estimated) gCO₂ for a representative request. Combines what today are siloed RUM and ESG signals.',
    sample: {
      route: '/',
      ttfbMs: 248,
      lcpMs: 1620,
      inpMs: 110,
      gco2: 0.043,
      energyJ: 0.32,
      gridIntensityGco2PerKwh: 280,
      datacenterRegion: 'eu-central',
      pue: 1.12,
      signedAt: new Date().toISOString()
    },
    signatureAlgorithm: 'Ed25519 + ML-DSA-65 hybrid',
    verificationEndpoint: '/api/v100/provenance',
    crossLinks: ['/api/v100/perf/zero-energy-pledge', '/api/v100/carbon-budget']
  });
}

function inpAttribution() {
  return _envelope({
    title: 'INP Attribution Ledger — Per-Interaction Public Audit',
    purpose: 'For every user interaction whose INP exceeds the budget, a signed attribution entry explains which script, which event handler, and which long task is responsible. Public, auditable, indexable.',
    schema: {
      interactionId: 'string (uuid)',
      interactionType: 'click|tap|key',
      inputDelayMs: 'number',
      processingMs: 'number',
      presentationMs: 'number',
      totalInpMs: 'number',
      culprits: [
        { kind: 'script', src: '/assets/app.[hash].js', functionName: 'handleClick', selfMs: 'number' }
      ],
      remediation: 'enum(yield-after-event, debounce, web-worker, css-only, defer)'
    },
    samplePolicy: 'Sample at 1/100 of breaching interactions; aggregate publicly weekly.',
    pledge: 'No paid plan, no tracker, can fork an entry. The ledger is read-only public.'
  });
}

// ─────────────────────────── dispatcher ──────────────────────────
async function handle(req, res) {
  if (DISABLED) return false;
  if (!req || !req.url) return false;
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') return false;

  let urlPath;
  try {
    const u = new URL(req.url, 'http://local');
    urlPath = u.pathname;
  } catch (_) { return false; }

  // Fast prefix gate — avoid cost on unrelated requests.
  if (!urlPath.startsWith('/api/v100/perf/v2/')) return false;

  try {
    if (urlPath === '/api/v100/perf/v2/manifest')               { _sendJson(res, 200, manifest()); return true; }
    if (urlPath === '/api/v100/perf/v2/causal-render-graph')    { _sendJson(res, 200, causalRenderGraph()); return true; }
    if (urlPath === '/api/v100/perf/v2/frame-budget')           { _sendJson(res, 200, frameBudget()); return true; }
    if (urlPath === '/api/v100/perf/v2/energy-per-interaction') { _sendJson(res, 200, energyPerInteraction()); return true; }
    if (urlPath === '/api/v100/perf/v2/latency-equity-map')     { _sendJson(res, 200, latencyEquityMap()); return true; }
    if (urlPath === '/api/v100/perf/v2/tail-latency-pledge')    { _sendJson(res, 200, tailLatencyPledge()); return true; }
    if (urlPath === '/api/v100/perf/v2/cold-start-budget')      { _sendJson(res, 200, coldStartBudget()); return true; }
    if (urlPath === '/api/v100/perf/v2/hydration-cost')         { _sendJson(res, 200, hydrationCost()); return true; }
    if (urlPath === '/api/v100/perf/v2/network-adaptivity')     { _sendJson(res, 200, networkAdaptivity()); return true; }
    if (urlPath === '/api/v100/perf/v2/perceptual-quality')     { _sendJson(res, 200, perceptualQuality()); return true; }
    if (urlPath === '/api/v100/perf/v2/anti-layout-thrash')     { _sendJson(res, 200, antiLayoutThrash()); return true; }
    if (urlPath === '/api/v100/perf/v2/predictability-index')   { _sendJson(res, 200, predictabilityIndex()); return true; }
    if (urlPath === '/api/v100/perf/v2/critical-path-diet')     { _sendJson(res, 200, criticalPathDiet()); return true; }
    if (urlPath === '/api/v100/perf/v2/speculative-render')     { _sendJson(res, 200, speculativeRender()); return true; }
    if (urlPath === '/api/v100/perf/v2/joint-receipt')          { _sendJson(res, 200, jointReceipt()); return true; }
    if (urlPath === '/api/v100/perf/v2/inp-attribution')        { _sendJson(res, 200, inpAttribution()); return true; }
  } catch (e) {
    if (!res.headersSent) {
      try {
        _sendJson(res, 500, _envelope({ error: 'performance_100y_v2_internal', message: e && e.message }));
        return true;
      } catch (_) { /* ignore */ }
    }
  }

  return false;
}

module.exports = {
  handle,
  _internals: {
    PACK_NAME, PACK_VERSION, FREEZE_DATE, NEXT_REVIEW_YEAR, HORIZON_YEAR,
    manifest, causalRenderGraph, frameBudget, energyPerInteraction,
    latencyEquityMap, tailLatencyPledge, coldStartBudget, hydrationCost,
    networkAdaptivity, perceptualQuality, antiLayoutThrash,
    predictabilityIndex, criticalPathDiet, speculativeRender, jointReceipt,
    inpAttribution,
    provenanceRoot: _provenanceRoot
  }
};
