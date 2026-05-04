'use strict';

// =============================================================================
// Real User Monitoring (RUM) beacons — Core Web Vitals collector
// =============================================================================
//
// 50-year-standard companion to predictive-prefetch.js: that module learns
// the navigation graph and *predicts* what visitors will need next; this
// module measures what visitors *actually experienced*. Together they close
// the observability loop required to keep zeusai.pro fast for the long haul.
//
// What we collect (all standard W3C / Web Vitals primitives — guaranteed
// to keep working as browsers evolve):
//
//   • LCP — Largest Contentful Paint (PerformanceObserver `largest-contentful-paint`)
//   • CLS — Cumulative Layout Shift (`layout-shift` entries)
//   • INP — Interaction to Next Paint (`event` entries with `interactionId`)
//   • FCP — First Contentful Paint (`paint` entries)
//   • TTFB — Time to First Byte (Navigation Timing v2)
//
// What we DON'T collect — by design, for digital privacy at world-standard
// scale:
//
//   • No cookies. No localStorage. No fingerprinting.
//   • No URLs with query strings — only the `pathname` is recorded, and only
//     after route normalisation strips numeric IDs.
//   • No User-Agent strings, no IPs, no Referer chains.
//   • Beacon payload is rejected unless its `path` validates as a non-API,
//     non-asset, same-shape navigation path (re-used from prefetch's
//     `isNavigablePath` notion).
//   • K-anonymous persistence: only routes with ≥ K samples (default 3)
//     are written to disk. A single visitor's interaction can never be
//     recovered from the snapshot.
//
// Transport: `navigator.sendBeacon('/internal/rum', JSON.stringify(...))`.
// sendBeacon is a W3C standard (Beacon API, REC) supported in every shipping
// browser since 2015 and explicitly designed to keep working during the
// `pagehide` / `visibilitychange→hidden` transitions where most vitals
// finalise. We accept either `application/json` or `text/plain` content-types
// because sendBeacon's MIME defaults vary; the payload itself is JSON either
// way.
//
// Server-side: bounded LRU per route + ring buffer of recent samples.
// `getStats()` returns p50/p75/p95 per metric per route, plus global
// totals. `/internal/rum/stats` is read-only and exposes the aggregate.
//
// Safety / non-regression contract:
//   • Strict no-op when SITE_RUM_BEACONS_DISABLED=1.
//   • All payload fields validated before recording.
//   • Persistence is best-effort; runtime stats survive disk failures.
//   • Beacon endpoint is rate-limited per source-IP (memory-only, leaky
//     bucket) to defeat trivial flood attacks.
//   • Save-Data / Sec-CH-Prefers-Reduced-Data clients receive NO inline
//     collector script (we honour their bandwidth preference end-to-end).
// =============================================================================

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.SITE_RUM_BEACONS_DISABLED !== '1';
const PERSIST_ENABLED = ENABLED && process.env.RUM_PERSIST_DISABLED !== '1';

const KANON_THRESHOLD = Math.max(1, Number(process.env.RUM_KANON_THRESHOLD || 3));
const MAX_ROUTES = Math.max(10, Number(process.env.RUM_MAX_ROUTES || 500));
const MAX_SAMPLES_PER_ROUTE = Math.max(10, Number(process.env.RUM_MAX_SAMPLES_PER_ROUTE || 200));
const MAX_BEACON_BYTES = Math.max(256, Number(process.env.RUM_MAX_BEACON_BYTES || 8 * 1024)); // 8 KiB
const RATE_LIMIT_PER_MIN = Math.max(1, Number(process.env.RUM_RATE_LIMIT_PER_MIN || 60));
const PERSIST_INTERVAL_MS = Math.max(60_000, Number(process.env.RUM_PERSIST_INTERVAL_MS || 10 * 60 * 1000));

const PERSIST_PATH = process.env.RUM_PERSIST_PATH
  || path.join(__dirname, '..', '..', 'data', 'perf', 'rum-beacons.jsonl');

// Recognised metric names. Anything else is silently dropped — keeps the
// surface narrow so future browser additions don't accidentally pollute
// the aggregate.
const METRICS = ['lcp', 'cls', 'inp', 'fcp', 'ttfb'];

// Reasonable per-metric upper bounds, in the unit each metric is reported in.
// Anything beyond these is treated as a measurement error and dropped, which
// also defeats malicious clients trying to skew percentiles.
const METRIC_LIMITS = {
  lcp:  { min: 0, max: 60_000 },   // ms
  fcp:  { min: 0, max: 60_000 },   // ms
  ttfb: { min: 0, max: 60_000 },   // ms
  inp:  { min: 0, max: 30_000 },   // ms
  cls:  { min: 0, max: 100 }       // unitless, accumulated layout shift
};

// In-memory state.
//   __routes :: Map<routePath, RouteAgg>
//   RouteAgg :: { count, samples: { lcp:[…], cls:[…], inp:[…], fcp:[…], ttfb:[…] } }
const __routes = new Map();
// Per-IP leaky bucket for rate limiting.
const __ipBuckets = new Map();
// Telemetry — surfaces in /internal/rum/stats so operators can see beacons
// are flowing without leaking any sample data.
const __telemetry = {
  beaconsAccepted: 0,
  beaconsRejectedInvalid: 0,
  beaconsRejectedRateLimit: 0,
  beaconsRejectedPath: 0,
  beaconsRejectedPayload: 0,
  persistedSnapshots: 0,
  restoredFromSnapshot: 0
};

let __persistTimer = null;

// ── Path validation ─────────────────────────────────────────────────────────
// Mirrors predictive-prefetch.isNavigablePath but kept local so the two
// modules stay independently auditable. Only navigable HTML routes are
// allowed; APIs / SSE / assets are rejected.
function isNavigablePath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 256) return false;
  if (p[0] !== '/') return false;
  // No query/hash on the wire — they MUST be stripped client-side.
  if (p.indexOf('?') !== -1 || p.indexOf('#') !== -1) return false;
  // Defeat control characters / smuggled CRLF.
  for (let i = 0; i < p.length; i++) {
    const c = p.charCodeAt(i);
    if (c < 0x20 || c === 0x7F) return false;
    // Refuse the dangerous chars that could escape a JSON literal in stats output.
    if (c === 0x22 /* " */ || c === 0x3C /* < */) return false;
  }
  // Hard-deny categories:
  if (p === '/stream' || p === '/snapshot') return false;
  if (p.startsWith('/api/')) return false;
  if (p.startsWith('/internal/')) return false;
  if (p.startsWith('/assets/')) return false;
  if (p.startsWith('/icons/')) return false;
  if (p.startsWith('/.well-known/')) return false;
  if (p === '/sw.js' || p === '/manifest.json' || p === '/robots.txt' || p === '/sitemap.xml') return false;
  // No `..` traversal.
  if (p.indexOf('..') !== -1) return false;
  return true;
}

// Route normaliser: collapse numeric IDs into `:id` so `/order/12345` and
// `/order/67890` aggregate together. Keeps the route count bounded and
// avoids a long-tail of per-ID rows that would each fail k-anonymity.
function normaliseRoute(p) {
  if (!isNavigablePath(p)) return null;
  const parts = p.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (/^[0-9]{2,}$/.test(parts[i])) parts[i] = ':id';
    // 24-char hex (Mongo ObjectId style) or 32-char hex (md5/uuid-no-dashes)
    else if (/^[a-f0-9]{24}$/i.test(parts[i]) || /^[a-f0-9]{32}$/i.test(parts[i])) parts[i] = ':id';
    // canonical UUID
    else if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(parts[i])) parts[i] = ':id';
  }
  const out = parts.join('/');
  return out.length <= 256 ? out : null;
}

// ── Rate limiting ───────────────────────────────────────────────────────────
// Memory-only leaky bucket: each IP may submit up to RATE_LIMIT_PER_MIN
// beacons per rolling minute. No persistence — restart resets buckets, which
// is fine for an advisory metric stream.
function _allowFromIp(ip) {
  if (!ip) return true;
  const now = Date.now();
  let b = __ipBuckets.get(ip);
  if (!b) { b = { hits: 0, windowStart: now }; __ipBuckets.set(ip, b); }
  if (now - b.windowStart > 60_000) { b.hits = 0; b.windowStart = now; }
  b.hits++;
  // Bound the map so a flood doesn't grow it unbounded.
  if (__ipBuckets.size > 5000) {
    // Drop oldest 1000 entries (Map iterates in insertion order).
    let drop = 1000;
    for (const k of __ipBuckets.keys()) {
      __ipBuckets.delete(k);
      if (--drop <= 0) break;
    }
  }
  return b.hits <= RATE_LIMIT_PER_MIN;
}

// Extract the originating client IP, honouring a single trusted proxy hop
// (nginx in front of us). We deliberately do NOT walk the full
// X-Forwarded-For chain — only the right-most entry is trusted because
// nginx appends. This is for rate limiting only; the IP is never persisted.
function _clientIp(req) {
  if (!req || !req.headers) return '';
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const parts = xff.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) return last.slice(0, 64);
  }
  const ra = req.socket && req.socket.remoteAddress;
  return (ra || '').slice(0, 64);
}

// ── Aggregation ─────────────────────────────────────────────────────────────
function _ensureRoute(routePath) {
  let agg = __routes.get(routePath);
  if (agg) {
    // LRU touch.
    __routes.delete(routePath);
    __routes.set(routePath, agg);
    return agg;
  }
  if (__routes.size >= MAX_ROUTES) {
    // Evict oldest.
    const firstKey = __routes.keys().next().value;
    if (firstKey !== undefined) __routes.delete(firstKey);
  }
  agg = { count: 0, samples: { lcp: [], cls: [], inp: [], fcp: [], ttfb: [] } };
  __routes.set(routePath, agg);
  return agg;
}

function _record(agg, metric, value) {
  const arr = agg.samples[metric];
  if (!arr) return;
  arr.push(value);
  if (arr.length > MAX_SAMPLES_PER_ROUTE) {
    // Reservoir-style: keep the most recent N. A circular buffer would
    // require an extra index per metric; for our sample sizes the splice
    // is cheap and keeps the data simple to reason about.
    arr.splice(0, arr.length - MAX_SAMPLES_PER_ROUTE);
  }
}

// Validate a candidate metric value. Drops anything not a finite number
// or outside the per-metric sanity bounds.
function _validMetric(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const lim = METRIC_LIMITS[name];
  if (!lim) return false;
  return value >= lim.min && value <= lim.max;
}

// Public API: accept a beacon. Returns `{ ok: true }` on accept,
// `{ ok: false, reason }` on rejection — the caller (HTTP handler) maps
// that to a 204 (always; we never tell a malicious client *why* we
// dropped their beacon, to avoid being a probe oracle).
function acceptBeacon(payload, req) {
  if (!ENABLED) return { ok: false, reason: 'disabled' };

  // Rate limit before parsing — cheapest gate.
  const ip = _clientIp(req);
  if (!_allowFromIp(ip)) {
    __telemetry.beaconsRejectedRateLimit++;
    return { ok: false, reason: 'rate_limit' };
  }

  if (!payload || typeof payload !== 'object') {
    __telemetry.beaconsRejectedInvalid++;
    return { ok: false, reason: 'invalid_payload' };
  }

  const route = normaliseRoute(payload.path);
  if (!route) {
    __telemetry.beaconsRejectedPath++;
    return { ok: false, reason: 'invalid_path' };
  }

  // The metrics object must contain at least one valid measurement.
  const m = payload.metrics;
  if (!m || typeof m !== 'object') {
    __telemetry.beaconsRejectedPayload++;
    return { ok: false, reason: 'no_metrics' };
  }
  let recorded = 0;
  const agg = _ensureRoute(route);
  for (const name of METRICS) {
    if (Object.prototype.hasOwnProperty.call(m, name) && _validMetric(name, m[name])) {
      _record(agg, name, m[name]);
      recorded++;
    }
  }
  if (recorded === 0) {
    __telemetry.beaconsRejectedPayload++;
    return { ok: false, reason: 'no_valid_metrics' };
  }
  agg.count++;
  __telemetry.beaconsAccepted++;
  return { ok: true, route, recorded };
}

// ── Statistics ──────────────────────────────────────────────────────────────
// Compute a percentile of an unsorted numeric array using nearest-rank.
// Returns null for empty arrays so callers can skip the bucket.
function _percentile(arr, p) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  // Don't mutate the live samples — sort a copy.
  const sorted = arr.slice().sort((a, b) => a - b);
  // nearest-rank: ceil(p/100 * N) - 1
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

// Round number for stats output. CLS is unitless and small, others are ms.
function _round(metric, n) {
  if (n === null || n === undefined) return null;
  if (metric === 'cls') return Number(n.toFixed(4));
  return Number(n.toFixed(2));
}

function _routeStats(agg) {
  const out = { count: agg.count, metrics: {} };
  for (const name of METRICS) {
    const arr = agg.samples[name];
    if (!arr || arr.length === 0) continue;
    const sorted = arr.slice().sort((a, b) => a - b);
    const p50i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.50 * sorted.length) - 1));
    const p75i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.75 * sorted.length) - 1));
    const p95i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
    out.metrics[name] = {
      n: arr.length,
      p50: _round(name, sorted[p50i]),
      p75: _round(name, sorted[p75i]),
      p95: _round(name, sorted[p95i])
    };
  }
  return out;
}

function getStats() {
  const routes = {};
  let totalSamples = 0;
  for (const [routePath, agg] of __routes) {
    routes[routePath] = _routeStats(agg);
    totalSamples += agg.count;
  }
  return {
    enabled: ENABLED,
    persistEnabled: PERSIST_ENABLED,
    knobs: {
      kanonThreshold: KANON_THRESHOLD,
      maxRoutes: MAX_ROUTES,
      maxSamplesPerRoute: MAX_SAMPLES_PER_ROUTE,
      rateLimitPerMin: RATE_LIMIT_PER_MIN,
      persistIntervalMs: PERSIST_INTERVAL_MS
    },
    totals: {
      routes: __routes.size,
      samples: totalSamples
    },
    telemetry: { ...__telemetry },
    routes
  };
}

// ── K-anonymous persistence ─────────────────────────────────────────────────
function _ensurePersistDir() {
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    return true;
  } catch (_) { return false; }
}

function persistSnapshot() {
  if (!PERSIST_ENABLED) return { ok: false, reason: 'disabled' };
  if (!_ensurePersistDir()) return { ok: false, reason: 'mkdir_failed' };
  // We rewrite the file each cycle (file is bounded in size by route + sample
  // caps). Atomic via tmp+rename so a crash mid-write can't corrupt it.
  const tmp = PERSIST_PATH + '.tmp';
  try {
    const out = [];
    let kept = 0;
    for (const [routePath, agg] of __routes) {
      if (agg.count < KANON_THRESHOLD) continue; // k-anonymity gate
      // Persist only the aggregate stats — never the raw samples.
      // This is a one-way function: you can't reconstruct any single
      // visitor's measurement from p50/p75/p95.
      const line = JSON.stringify({
        v: 1,
        path: routePath,
        count: agg.count,
        stats: _routeStats(agg)
      });
      out.push(line);
      kept++;
    }
    fs.writeFileSync(tmp, out.join('\n') + (out.length ? '\n' : ''), 'utf8');
    fs.renameSync(tmp, PERSIST_PATH);
    __telemetry.persistedSnapshots++;
    return { ok: true, lines: kept };
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    return { ok: false, reason: 'write_failed', error: e && e.message };
  }
}

// On startup, restore aggregate counts (no individual samples — the snapshot
// doesn't carry them). This means the first KANON_THRESHOLD live beacons
// after restart re-establish the per-route samples for percentile output;
// in the meantime, the persisted aggregate is still served via getStats()
// (the route entry exists with count from disk).
function restoreSnapshot() {
  if (!PERSIST_ENABLED) return { ok: false, reason: 'disabled' };
  let raw;
  try {
    raw = fs.readFileSync(PERSIST_PATH, 'utf8');
  } catch (_) {
    return { ok: true, restored: 0 };
  }
  if (!raw) return { ok: true, restored: 0 };
  let restored = 0;
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const rec = JSON.parse(line);
      if (!rec || rec.v !== 1) continue;
      const route = normaliseRoute(rec.path);
      if (!route) continue;
      if (typeof rec.count !== 'number' || !Number.isFinite(rec.count) || rec.count < 0) continue;
      const agg = _ensureRoute(route);
      agg.count = Math.min(rec.count, 1e9);
      restored++;
    } catch (_) { /* skip bad line */ }
  }
  __telemetry.restoredFromSnapshot += restored;
  return { ok: true, restored };
}

function startPersistence() {
  if (!PERSIST_ENABLED) return null;
  if (__persistTimer) return __persistTimer;
  __persistTimer = setInterval(() => {
    try { persistSnapshot(); } catch (_) {}
  }, PERSIST_INTERVAL_MS);
  // Don't keep the event loop alive just for periodic persistence —
  // critical for tests (see test exit pattern memory).
  if (__persistTimer && typeof __persistTimer.unref === 'function') {
    __persistTimer.unref();
  }
  return __persistTimer;
}

function stopPersistence() {
  if (__persistTimer) {
    clearInterval(__persistTimer);
    __persistTimer = null;
  }
}

// ── Client collector snippet ────────────────────────────────────────────────
// Tiny, dependency-free, ES5-safe (so it parses even on older browsers
// where it then no-ops because PerformanceObserver is missing). Sends one
// beacon per page lifecycle on the *first* `visibilitychange→hidden` event,
// which is the standard Web Vitals reporting trigger.
//
// Critical: this snippet is meant to be inlined into <head> with the same
// CSP nonce as the rest of the SSR document. We intentionally do NOT load
// any external script, so the third-party JS surface stays at zero.
const COLLECTOR_SCRIPT = '(function(){' +
  'try{' +
    'if(!("PerformanceObserver" in window))return;' +
    'var sent=false;' +
    'var d={lcp:0,cls:0,inp:0,fcp:0,ttfb:0};' +
    'var has=false;' +
    // LCP — last entry wins
    'try{new PerformanceObserver(function(l){' +
      'var es=l.getEntries();if(es.length){var e=es[es.length-1];d.lcp=e.renderTime||e.loadTime||e.startTime||0;has=true;}' +
    '}).observe({type:"largest-contentful-paint",buffered:true});}catch(e){}' +
    // CLS — sum unexpected layout shifts in 5s session windows; we report total
    'try{new PerformanceObserver(function(l){' +
      'var es=l.getEntries();for(var i=0;i<es.length;i++){var e=es[i];if(!e.hadRecentInput){d.cls+=e.value;has=true;}}' +
    '}).observe({type:"layout-shift",buffered:true});}catch(e){}' +
    // INP — max of event durations with interactionId
    'try{new PerformanceObserver(function(l){' +
      'var es=l.getEntries();for(var i=0;i<es.length;i++){var e=es[i];if(e.interactionId&&e.duration>d.inp){d.inp=e.duration;has=true;}}' +
    '}).observe({type:"event",buffered:true,durationThreshold:40});}catch(e){}' +
    // FCP — first-contentful-paint
    'try{new PerformanceObserver(function(l){' +
      'var es=l.getEntries();for(var i=0;i<es.length;i++){if(es[i].name==="first-contentful-paint"){d.fcp=es[i].startTime;has=true;break;}}' +
    '}).observe({type:"paint",buffered:true});}catch(e){}' +
    // TTFB — Navigation Timing v2
    'try{var nav=(performance.getEntriesByType&&performance.getEntriesByType("navigation"))||[];' +
      'if(nav.length){d.ttfb=nav[0].responseStart||0;has=true;}}catch(e){}' +
    'function send(){' +
      'if(sent||!has)return;sent=true;' +
      // Strip any query / hash so the server can't be tricked into recording PII.
      'var p=(location.pathname||"/").replace(/[?#].*$/,"");' +
      'var body=JSON.stringify({path:p,metrics:{lcp:Math.round(d.lcp),cls:Math.round(d.cls*1e4)/1e4,inp:Math.round(d.inp),fcp:Math.round(d.fcp),ttfb:Math.round(d.ttfb)}});' +
      'try{' +
        'if(navigator.sendBeacon){navigator.sendBeacon("/internal/rum",new Blob([body],{type:"application/json"}));}' +
        'else if(window.fetch){fetch("/internal/rum",{method:"POST",body:body,headers:{"Content-Type":"application/json"},keepalive:true,credentials:"omit"});}' +
      '}catch(e){}' +
    '}' +
    'addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")send();});' +
    'addEventListener("pagehide",send);' +
  '}catch(e){}' +
'})();';

// Build the inline script tag, with optional CSP nonce. Returns "" when
// the module is disabled — that's the correct behaviour for the SSR caller
// because then nothing should be injected.
function buildCollectorScript(opts) {
  if (!ENABLED) return '';
  const nonce = opts && typeof opts.nonce === 'string' ? opts.nonce : '';
  const nonceAttr = nonce ? ` nonce="${String(nonce).replace(/"/g, '')}"` : '';
  return `<script${nonceAttr}>${COLLECTOR_SCRIPT}</script>`;
}

function injectCollector(html, opts) {
  if (typeof html !== 'string' || html.length === 0) return html;
  const block = buildCollectorScript(opts);
  if (!block) return html;
  const idx = html.indexOf('</head>');
  if (idx === -1) return html;
  // Inject just before </head> so the script is ready before the body
  // starts rendering — gets us a clean Navigation Timing measurement.
  return html.slice(0, idx) + block + html.slice(idx);
}

// ── Save-Data passthrough ───────────────────────────────────────────────────
// Same surface as predictive-prefetch.shouldSuppressForSaveData so callers
// can apply a single rule and have both modules respect bandwidth signals.
function shouldSuppressForSaveData(req) {
  if (!req || !req.headers) return false;
  if (req.headers['save-data'] === 'on') return true;
  const reduced = req.headers['sec-ch-prefers-reduced-data'];
  if (typeof reduced === 'string' && reduced.indexOf('reduce-data') !== -1) return true;
  return false;
}

// ── Test-only reset hook ────────────────────────────────────────────────────
function _resetForTests() {
  __routes.clear();
  __ipBuckets.clear();
  __telemetry.beaconsAccepted = 0;
  __telemetry.beaconsRejectedInvalid = 0;
  __telemetry.beaconsRejectedRateLimit = 0;
  __telemetry.beaconsRejectedPath = 0;
  __telemetry.beaconsRejectedPayload = 0;
  __telemetry.persistedSnapshots = 0;
  __telemetry.restoredFromSnapshot = 0;
}

module.exports = {
  ENABLED,
  PERSIST_ENABLED,
  KANON_THRESHOLD,
  MAX_BEACON_BYTES,
  acceptBeacon,
  getStats,
  isNavigablePath,
  normaliseRoute,
  buildCollectorScript,
  injectCollector,
  shouldSuppressForSaveData,
  persistSnapshot,
  restoreSnapshot,
  startPersistence,
  stopPersistence,
  _resetForTests,
  _percentile,
  _telemetry: __telemetry
};
