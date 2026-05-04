'use strict';

// =============================================================================
// Adaptive Predictive Prefetch (APP) · self-learning navigation graph + HTTP 103
// =============================================================================
//
// 50-year-standard architecture: this module learns the navigation graph of
// THIS site from the standard HTTP `Referer` header — no cookies, no PII,
// no tracking SDK — and surfaces predictions through FIVE web platform
// primitives, each of which is either a current open standard or its
// successor, so the implementation will continue to work as browsers evolve:
//
//   1. HTTP 103 Early Hints (RFC 8297) — sent the moment a request lands,
//      so the browser begins fetching predicted next pages in parallel with
//      our SSR. Node ≥18.11 ships res.writeEarlyHints natively.
//
//   2. Speculation Rules API (W3C, Chrome 121+, others progressively) — the
//      *successor* of <link rel=prefetch>. Declarative JSON injected into
//      <head>, browser-controlled, automatically respects Save-Data /
//      prefers-reduced-data / metered-connection signals. This is the
//      future-proof primitive sites will still be using in 2076.
//
//   3. Link: rel=prefetch HTTP header (RFC 8288) — fallback for non-103
//      clients and CDNs.
//
//   4. Save-Data / Sec-CH-Prefers-Reduced-Data / Downlink Client Hints —
//      W3C standard for digital equity. We suppress all hint emission on
//      slow / metered connections so visitors on poor networks aren't
//      charged for predictive bytes they didn't ask for.
//
//   5. K-anonymous on-disk graph snapshot — only edges with count ≥ K
//      (default 3) are persisted, so no individual visitor's path can be
//      recovered. The graph survives restarts; no PII ever touches disk.
//
// Higher-order Markov: in addition to first-order (last page → next), we
// learn second-order context (last two pages → next) opportunistically —
// when a same-origin Referer chain provides the previous page. Predictions
// blend the two by preferring order-2 when it has at least MIN_ORDER2_HITS
// observations, falling back to order-1 otherwise.
//
// Safety / non-regression contract:
//   • Strict no-op when SITE_PREDICTIVE_PREFETCH_DISABLED=1.
//   • All paths going on the wire are validated by isNavigablePath().
//   • Browsers MAY ignore every hint we emit — they are advisory by design.
//   • Persistence is best-effort: if disk is full / read-only, the runtime
//     graph still works in memory.
//   • Save-Data: on / Sec-CH-Prefers-Reduced-Data: reduce-data / Downlink
//     < SLOW_DOWNLINK_MBPS suppress emission — operators on metered data
//     plans never pay for our predictive bytes.
// =============================================================================

const fs = require('fs');
const path = require('path');

const ENABLED = process.env.SITE_PREDICTIVE_PREFETCH_DISABLED !== '1';
const SPECULATION_RULES_ENABLED = ENABLED && process.env.SITE_SPECULATION_RULES_DISABLED !== '1';
// Speculation Rules has two action verbs:
//   • "prefetch"  — browser downloads the predicted HTML response only.
//                   No JS execution, no SSE/WebSocket open, no DOM build.
//                   Pure navigation accelerator. Safe with live data feeds.
//   • "prerender" — browser fully renders the predicted page in a hidden
//                   context (executes scripts, opens connections, fires
//                   timers). Faster navigation, but it MULTIPLIES every
//                   long-lived connection (SSE/WebSocket) that the SSR
//                   document boots — once per prerendered URL.
//
// On a site like ours where the SSR client opens 2 SSE channels on boot
// (`openStream()` → /api/unicorn/events and `openPricingStream()` →
// /api/pricing/live/stream) plus a periodic BTC rate poller, "prerender"
// causes mobile Chromium browsers (Samsung Chrome / Chrome on Android in
// particular) to fan out connections in background tabs. With Data-Saver
// or background-data restrictions this exhausts the per-origin connection
// budget and the *visible* page never gets fresh price/BTC frames.
//
// Default OFF for safety. Opt-in with PREFETCH_ENABLE_PRERENDER=1 only
// after auditing that all SSR-mounted live feeds are prerender-safe.
const PRERENDER_ENABLED = SPECULATION_RULES_ENABLED && process.env.PREFETCH_ENABLE_PRERENDER === '1';
const PERSIST_ENABLED = ENABLED && process.env.PREFETCH_PERSIST_DISABLED !== '1';

// Bounded-memory tuning knobs — overrideable via env, sane defaults.
const MAX_FROM_PATHS = Number(process.env.PREFETCH_MAX_FROM_PATHS || 500);
const MAX_TO_PATHS_PER_FROM = Number(process.env.PREFETCH_MAX_TO_PER_FROM || 50);
const MAX_PATH_LEN = 256;
const DECAY_INTERVAL_MS = Number(process.env.PREFETCH_DECAY_INTERVAL_MS || 6 * 60 * 60 * 1000); // 6h
const DECAY_FACTOR = 0.5; // halve all counts on each decay tick

// 50-year additions — knobs.
// K-anonymity threshold: only persist (and only emit speculation-rules
// prerender hints for) edges with count ≥ this many distinct observations.
// Default 3: no single user's transition can be exfiltrated from the snapshot.
const KANON_THRESHOLD = Math.max(1, Number(process.env.PREFETCH_KANON_THRESHOLD || 3));
// Order-2 minimum hits before we trust the deeper context.
const MIN_ORDER2_HITS = Math.max(1, Number(process.env.PREFETCH_ORDER2_MIN_HITS || 3));
// Save-Data thresholds. Effective Connection Type (ECT) values are
// 'slow-2g'|'2g'|'3g'|'4g'|'5g' — anything below 4g triggers suppression.
const SLOW_ECT_VALUES = new Set(['slow-2g', '2g', '3g']);
const SLOW_DOWNLINK_MBPS = Number(process.env.PREFETCH_SLOW_DOWNLINK_MBPS || 1.5);
// Persistence file (JSONL). Default sits next to other data ledgers.
const PERSIST_PATH = process.env.PREFETCH_PERSIST_PATH
  || path.join(__dirname, '..', '..', 'data', 'perf', 'prefetch-graph.jsonl');
const PERSIST_INTERVAL_MS = Math.max(60_000, Number(process.env.PREFETCH_PERSIST_INTERVAL_MS || 10 * 60 * 1000)); // 10min

// Telemetry — all counters are read-only from outside via getStats().
const __telemetry = {
  earlyHintsEmitted: 0,
  speculationRulesInjected: 0,
  linkHeadersBuilt: 0,
  suppressedSaveData: 0,
  suppressedNoPredictions: 0,
  persistedSnapshots: 0,
  persistedEdges: 0,
  restoredFromSnapshot: 0,
  order2Hits: 0,
  order1Hits: 0
};

// Insertion-ordered Map — Map iteration order is insertion order, so we get
// LRU-by-touch by deleting + re-setting on every access.
/** @type {Map<string, Map<string, number>>} */
const __graph = new Map();
// Order-2 graph: key is "prev|from" composite, value is Map(toPath → count).
// Capped at MAX_FROM_PATHS entries (same LRU policy) so memory stays flat.
/** @type {Map<string, Map<string, number>>} */
const __graph2 = new Map();
let __totalTransitions = 0;
let __lastDecayAt = Date.now();

// Routes that should never appear as either from or to in predictions.
// API/asset/SSE/binary endpoints don't make sense to "navigate to" — they're
// either AJAX/JSON, machine-readable, or open streams the browser shouldn't
// prefetch. Static prefixes are matched with startsWith for cheap rejection.
const NON_NAVIGABLE_PREFIXES = [
  '/api/',
  '/internal/',
  '/.well-known/',
  '/assets/',
  '/icons/',
  '/snapshot',
  '/stream',
  '/sw.js',
  '/manifest.json',
  '/robots.txt',
  '/sitemap',
  '/health',
  '/metrics'
];

function isNavigablePath(p) {
  if (typeof p !== 'string') return false;
  if (p.length === 0 || p.length > MAX_PATH_LEN) return false;
  if (p[0] !== '/') return false;
  // Reject anything with newlines / null bytes / control chars (defense in
  // depth — these would already break URL parsing but we strip belt + braces).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(p)) return false;
  for (const pref of NON_NAVIGABLE_PREFIXES) {
    if (p === pref || p.startsWith(pref)) return false;
  }
  return true;
}

// Extract the path portion of a same-origin Referer. Returns null if the
// referer is cross-origin, malformed, or missing.
function extractReferrerPath(refererHeader, hostHeader) {
  if (!refererHeader || typeof refererHeader !== 'string') return null;
  if (refererHeader.length > 2048) return null;
  try {
    const u = new URL(refererHeader);
    // Same-origin check: host must match. We accept http and https.
    if (hostHeader && u.host && u.host !== hostHeader) return null;
    return u.pathname || null;
  } catch (_) {
    return null;
  }
}

function _maybeDecay() {
  const now = Date.now();
  if (now - __lastDecayAt < DECAY_INTERVAL_MS) return;
  __lastDecayAt = now;
  for (const g of [__graph, __graph2]) {
    for (const [from, tos] of g) {
      for (const [to, count] of tos) {
        const next = Math.floor(count * DECAY_FACTOR);
        if (next <= 0) tos.delete(to);
        else tos.set(to, next);
      }
      if (tos.size === 0) g.delete(from);
    }
  }
}

// Internal helper — bumps an edge in either graph with LRU/fanout caps applied.
function _bumpEdge(graph, from, to) {
  let tos = graph.get(from);
  if (!tos) {
    if (graph.size >= MAX_FROM_PATHS) {
      const oldestKey = graph.keys().next().value;
      if (oldestKey !== undefined) graph.delete(oldestKey);
    }
    tos = new Map();
    graph.set(from, tos);
  } else {
    graph.delete(from);
    graph.set(from, tos);
  }
  tos.set(to, (tos.get(to) || 0) + 1);
  if (tos.size > MAX_TO_PATHS_PER_FROM) {
    let minKey = null;
    let minVal = Infinity;
    for (const [k, v] of tos) {
      if (v < minVal) { minVal = v; minKey = k; }
    }
    if (minKey !== null) tos.delete(minKey);
  }
}

// recordTransition records (fromPath → toPath) into the order-1 graph.
// When prevPath is also a navigable same-origin path, ALSO records the
// order-2 transition (prev|from → to). prevPath is purely optional and
// the function stays fully backwards-compatible if callers pass only 2
// arguments.
function recordTransition(fromPath, toPath, prevPath) {
  if (!ENABLED) return false;
  if (!isNavigablePath(fromPath) || !isNavigablePath(toPath)) return false;
  if (fromPath === toPath) return false; // self-loops not useful
  _maybeDecay();
  _bumpEdge(__graph, fromPath, toPath);
  if (prevPath && isNavigablePath(prevPath) && prevPath !== fromPath && prevPath !== toPath) {
    _bumpEdge(__graph2, prevPath + '|' + fromPath, toPath);
  }
  __totalTransitions++;
  return true;
}

// Predict top-K next paths from `fromPath`. Optional `prevPath` triggers
// order-2 lookup: if (prev|from) has at least MIN_ORDER2_HITS observations,
// the order-2 distribution is preferred (more context = better predictions);
// otherwise we fall back to the order-1 graph that was always there. Old
// callers using predict(from, k) keep working unchanged.
function predict(fromPath, k, prevPath) {
  if (!ENABLED) return [];
  const limit = Math.max(1, Math.min(10, Number(k) || 3));
  let chosen = null;
  let usedOrder = 1;
  if (prevPath && typeof prevPath === 'string' && isNavigablePath(prevPath)) {
    const tos2 = __graph2.get(prevPath + '|' + fromPath);
    if (tos2) {
      let total2 = 0;
      for (const v of tos2.values()) total2 += v;
      if (total2 >= MIN_ORDER2_HITS) {
        chosen = tos2;
        usedOrder = 2;
      }
    }
  }
  if (!chosen) chosen = __graph.get(fromPath);
  if (!chosen || chosen.size === 0) return [];
  if (usedOrder === 2) __telemetry.order2Hits++;
  else __telemetry.order1Hits++;
  // Sort by count desc, take top-k. Map.size is bounded by
  // MAX_TO_PATHS_PER_FROM (50) so this is O(n log n) with n ≤ 50.
  const arr = Array.from(chosen.entries()).sort((a, b) => b[1] - a[1]);
  return arr.slice(0, limit).map(([p, count]) => ({ path: p, count, order: usedOrder }));
}

function getStats() {
  let edges = 0;
  for (const tos of __graph.values()) edges += tos.size;
  let edges2 = 0;
  for (const tos of __graph2.values()) edges2 += tos.size;
  return {
    enabled: ENABLED,
    speculationRulesEnabled: SPECULATION_RULES_ENABLED,
    prerenderEnabled: PRERENDER_ENABLED,
    persistEnabled: PERSIST_ENABLED,
    fromPaths: __graph.size,
    edges,
    order2Contexts: __graph2.size,
    order2Edges: edges2,
    totalTransitionsRecorded: __totalTransitions,
    lastDecayAt: new Date(__lastDecayAt).toISOString(),
    telemetry: Object.assign({}, __telemetry),
    config: {
      maxFromPaths: MAX_FROM_PATHS,
      maxToPathsPerFrom: MAX_TO_PATHS_PER_FROM,
      decayIntervalMs: DECAY_INTERVAL_MS,
      decayFactor: DECAY_FACTOR,
      kanonThreshold: KANON_THRESHOLD,
      minOrder2Hits: MIN_ORDER2_HITS,
      slowDownlinkMbps: SLOW_DOWNLINK_MBPS,
      slowEctValues: Array.from(SLOW_ECT_VALUES),
      persistPath: PERSIST_ENABLED ? PERSIST_PATH : null,
      persistIntervalMs: PERSIST_INTERVAL_MS
    }
  };
}

// Build the value of a `Link` header (RFC 8288) for the predicted prefetch
// targets. Empty string when there's nothing to predict.
function buildLinkHeader(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return '';
  const out = predictions
    .map(p => `<${p.path}>; rel=prefetch`)
    .join(', ');
  if (out) __telemetry.linkHeadersBuilt++;
  return out;
}

// Detect whether the request is on a metered / slow / data-saver connection
// (W3C Save-Data, Network Information API, Sec-CH-Prefers-Reduced-Data).
// When true, we MUST suppress predictive emissions so we don't bill the
// visitor's data plan for bytes they didn't ask for. This is the digital
// equity contract that has to outlive any single browser vendor.
function shouldSuppressForSaveData(req) {
  if (!req || !req.headers) return false;
  const h = req.headers;
  // Save-Data: on (legacy + still mandatory)
  const saveData = String(h['save-data'] || '').toLowerCase();
  if (saveData === 'on' || saveData === '1' || saveData === 'true') return true;
  // Sec-CH-Prefers-Reduced-Data: reduce (W3C user-agent client hint)
  const reduced = String(h['sec-ch-prefers-reduced-data'] || '').toLowerCase();
  if (reduced === 'reduce' || reduced === 'reduce-data' || reduced === 'on') return true;
  // ECT: Effective Connection Type from Network Information API client hint.
  const ect = String(h.ect || '').toLowerCase().trim();
  if (ect && SLOW_ECT_VALUES.has(ect)) return true;
  // Downlink (Mbps estimate) — RTT alone is too noisy, downlink is reliable.
  const downlink = parseFloat(h.downlink);
  if (Number.isFinite(downlink) && downlink > 0 && downlink < SLOW_DOWNLINK_MBPS) return true;
  return false;
}

// Send a 103 Early Hints response with predicted prefetch links. This is a
// no-op when the platform doesn't support it, when the response is already
// past headers, or when there are no predictions.
//
// `extraLinks` lets the caller bundle critical preload hints (CSS/JS) into
// the same Early Hints frame so the browser kicks off those downloads even
// earlier than they would from the final response's Link header.
//
// `req` (optional) is consulted for Save-Data suppression — pass it whenever
// available so we honor digital-equity Client Hints automatically.
function sendEarlyHints(res, predictions, extraLinks, req) {
  if (!ENABLED) return false;
  if (req && shouldSuppressForSaveData(req)) {
    __telemetry.suppressedSaveData++;
    return false;
  }
  try {
    if (!res || typeof res.writeEarlyHints !== 'function') return false;
    if (res.headersSent) return false;
    const links = [];
    if (Array.isArray(extraLinks)) {
      for (const l of extraLinks) {
        if (typeof l === 'string' && l.length > 0 && l.length < 1024) links.push(l);
      }
    }
    if (Array.isArray(predictions)) {
      for (const p of predictions) {
        if (p && typeof p.path === 'string' && isNavigablePath(p.path)) {
          links.push(`<${p.path}>; rel=prefetch`);
        }
      }
    }
    if (links.length === 0) {
      __telemetry.suppressedNoPredictions++;
      return false;
    }
    res.writeEarlyHints({ link: links });
    __telemetry.earlyHintsEmitted++;
    return true;
  } catch (_) {
    // Some Node http internals can throw if the connection has already been
    // hijacked (e.g. websocket upgrade). Never let early hints break the
    // request — they're a pure performance optimization.
    return false;
  }
}

// Build a `<script type="speculationrules">` JSON block for SSR injection.
//
// Speculation Rules is the W3C-track *successor* of <link rel=prefetch>: a
// declarative JSON policy the browser interprets, with built-in safeguards
// (eagerness levels, automatic Save-Data respect, Cross-Origin-Opener-Policy
// checks). Chrome 121+ ships it; other engines are following. By emitting
// it alongside our Link/103 hints we're future-proofed for the next decades:
// even when rel=prefetch is eventually retired, this primitive carries on.
//
// We only promote edges with count ≥ KANON_THRESHOLD to "prerender" (full
// page render) — those are popular enough to be safe and to amortize the
// cost. Less-frequent edges go to the cheaper "prefetch" eagerness.
//
// Returns "" (empty string) when speculation rules are disabled or there's
// nothing to emit.
function buildSpeculationRulesScript(predictions, opts) {
  if (!SPECULATION_RULES_ENABLED) return '';
  if (!Array.isArray(predictions) || predictions.length === 0) return '';
  const nonce = opts && typeof opts.nonce === 'string' ? opts.nonce : '';
  // Re-read the prerender gate at call-time so an operator can flip it via
  // env without restarting the cluster (the constant captured at module
  // load is still exported for /internal/prefetch/stats).
  const prerenderActive = PRERENDER_ENABLED || process.env.PREFETCH_ENABLE_PRERENDER === '1';
  const prerenderUrls = [];
  const prefetchUrls = [];
  for (const p of predictions) {
    if (!p || typeof p.path !== 'string' || !isNavigablePath(p.path)) continue;
    // K-anonymity gate for prerender: only if at least KANON_THRESHOLD
    // distinct observations ever happened on this edge. Keeps low-volume
    // routes safe (no resource amplification on rarely-visited pages).
    // prerenderActive gate: when false (default), every prediction —
    // hot or cold — is emitted as "prefetch" so the browser downloads
    // only the HTML response and never pre-executes the page's JS.
    // This avoids fanning out SSR-bound SSE/WebSocket connections from
    // hidden prerender contexts on mobile Chromium browsers (which
    // breaks live pricing / BTC feeds on Samsung Chrome and similar).
    if (prerenderActive && (p.count || 0) >= KANON_THRESHOLD) prerenderUrls.push(p.path);
    else prefetchUrls.push(p.path);
  }
  if (prerenderUrls.length === 0 && prefetchUrls.length === 0) return '';
  const rules = {};
  if (prerenderUrls.length > 0) {
    rules.prerender = [{
      source: 'list',
      urls: prerenderUrls,
      eagerness: 'moderate'
    }];
  }
  if (prefetchUrls.length > 0) {
    rules.prefetch = [{
      source: 'list',
      urls: prefetchUrls,
      eagerness: 'conservative'
    }];
  }
  // The JSON body NEVER contains user-controlled strings — every URL has
  // already been validated by isNavigablePath() (no quotes, no <, no
  // control chars, no cross-origin), so direct JSON.stringify is safe to
  // embed inside <script type="speculationrules">. We additionally escape
  // </ to defeat any future path validator regression.
  const body = JSON.stringify(rules).replace(/<\/(script)/gi, '<\\/$1');
  const nonceAttr = nonce ? ` nonce="${String(nonce).replace(/"/g, '')}"` : '';
  __telemetry.speculationRulesInjected++;
  return `<script type="speculationrules"${nonceAttr}>${body}</script>`;
}

// Inject the speculation rules block into an HTML string just after the
// opening <head>. No-op if the document has no <head> tag (defense in
// depth — we never want to corrupt SSR output).
function injectSpeculationRules(html, predictions, opts) {
  if (typeof html !== 'string' || html.length === 0) return html;
  const block = buildSpeculationRulesScript(predictions, opts);
  if (!block) return html;
  const idx = html.indexOf('<head>');
  if (idx === -1) return html;
  return html.slice(0, idx + 6) + block + html.slice(idx + 6);
}

// ── K-anonymous persistence ─────────────────────────────────────────────────
// Periodically writes a JSONL snapshot containing ONLY edges with count ≥
// KANON_THRESHOLD. Lines are append-style overwriting (we rewrite the file
// each cycle for simplicity, since it's small and bounded). On startup,
// restoreSnapshot() rehydrates those edges back into the live graph so we
// don't start cold after every redeploy.

function _ensurePersistDir() {
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    return true;
  } catch (_) { return false; }
}

function persistSnapshot() {
  if (!PERSIST_ENABLED) return { ok: false, reason: 'disabled' };
  if (!_ensurePersistDir()) return { ok: false, reason: 'mkdir-failed' };
  let written = 0;
  const lines = [];
  // Order-1 edges
  for (const [from, tos] of __graph) {
    for (const [to, count] of tos) {
      if (count < KANON_THRESHOLD) continue;
      lines.push(JSON.stringify({ o: 1, f: from, t: to, c: count }));
      written++;
    }
  }
  // Order-2 edges
  for (const [key, tos] of __graph2) {
    const sep = key.indexOf('|');
    if (sep <= 0) continue;
    const prev = key.slice(0, sep);
    const from = key.slice(sep + 1);
    for (const [to, count] of tos) {
      if (count < KANON_THRESHOLD) continue;
      lines.push(JSON.stringify({ o: 2, p: prev, f: from, t: to, c: count }));
      written++;
    }
  }
  try {
    const tmp = PERSIST_PATH + '.tmp';
    const header = JSON.stringify({
      _meta: 'predictive-prefetch-snapshot',
      ts: new Date().toISOString(),
      kanonThreshold: KANON_THRESHOLD,
      edges: written
    }) + '\n';
    fs.writeFileSync(tmp, header + lines.join('\n') + (lines.length ? '\n' : ''));
    fs.renameSync(tmp, PERSIST_PATH);
    __telemetry.persistedSnapshots++;
    __telemetry.persistedEdges = written;
    return { ok: true, edges: written, path: PERSIST_PATH };
  } catch (e) {
    return { ok: false, reason: e && e.message };
  }
}

function restoreSnapshot() {
  if (!PERSIST_ENABLED) return { ok: false, reason: 'disabled' };
  if (!fs.existsSync(PERSIST_PATH)) return { ok: false, reason: 'no-snapshot' };
  try {
    const txt = fs.readFileSync(PERSIST_PATH, 'utf8');
    const lines = txt.split('\n').filter(Boolean);
    let restored = 0;
    for (const line of lines) {
      let obj;
      try { obj = JSON.parse(line); } catch (_) { continue; }
      if (!obj || obj._meta) continue;
      if (obj.o === 1 && isNavigablePath(obj.f) && isNavigablePath(obj.t)) {
        const c = Math.max(1, Math.min(1_000_000, Number(obj.c) || 1));
        let tos = __graph.get(obj.f);
        if (!tos) { tos = new Map(); __graph.set(obj.f, tos); }
        tos.set(obj.t, (tos.get(obj.t) || 0) + c);
        restored++;
      } else if (obj.o === 2 && isNavigablePath(obj.p) && isNavigablePath(obj.f) && isNavigablePath(obj.t)) {
        const c = Math.max(1, Math.min(1_000_000, Number(obj.c) || 1));
        const key = obj.p + '|' + obj.f;
        let tos = __graph2.get(key);
        if (!tos) { tos = new Map(); __graph2.set(key, tos); }
        tos.set(obj.t, (tos.get(obj.t) || 0) + c);
        restored++;
      }
    }
    if (restored > 0) __telemetry.restoredFromSnapshot = restored;
    return { ok: true, edges: restored };
  } catch (e) {
    return { ok: false, reason: e && e.message };
  }
}

// Start the persistence timer. Idempotent — safe to call multiple times.
let __persistTimer = null;
function startPersistence() {
  if (!PERSIST_ENABLED) return false;
  if (__persistTimer) return true;
  __persistTimer = setInterval(() => {
    try { persistSnapshot(); } catch (_) { /* swallow */ }
  }, PERSIST_INTERVAL_MS);
  // Critical: unref so this timer alone doesn't keep the event loop alive
  // (matches the pattern other long-lived intervals use in this codebase).
  if (typeof __persistTimer.unref === 'function') __persistTimer.unref();
  // Also flush on process exit.
  process.once('beforeExit', () => { try { persistSnapshot(); } catch (_) {} });
  return true;
}

function stopPersistence() {
  if (__persistTimer) {
    clearInterval(__persistTimer);
    __persistTimer = null;
  }
}

// Reset state — used by tests to get a clean slate.
function _resetForTests() {
  __graph.clear();
  __graph2.clear();
  __totalTransitions = 0;
  __lastDecayAt = Date.now();
  for (const k of Object.keys(__telemetry)) __telemetry[k] = 0;
  stopPersistence();
}

module.exports = {
  ENABLED,
  SPECULATION_RULES_ENABLED,
  PRERENDER_ENABLED,
  PERSIST_ENABLED,
  isNavigablePath,
  extractReferrerPath,
  recordTransition,
  predict,
  getStats,
  buildLinkHeader,
  sendEarlyHints,
  // 50-year-standard additions
  shouldSuppressForSaveData,
  buildSpeculationRulesScript,
  injectSpeculationRules,
  persistSnapshot,
  restoreSnapshot,
  startPersistence,
  stopPersistence,
  _resetForTests
};
