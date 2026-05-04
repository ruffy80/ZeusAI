'use strict';

// =============================================================================
// Adaptive Predictive Prefetch (APP) · self-learning navigation graph + HTTP 103
// =============================================================================
//
// What this module does (and why it's genuinely novel for a public website):
//
//   Most sites use either no prefetch at all, or a *static, hand-written* set
//   of `<link rel="prefetch">` hints. The few that try anything dynamic rely
//   on tracking SDKs (Quicklink, Guess.js with Google Analytics, etc.) which
//   leak data, need cookies, and have to be tuned manually.
//
//   This module learns the *real* navigation graph of THIS site, in-process,
//   from the standard HTTP `Referer` header — no cookies, no third-party
//   scripts, no PII. For each "fromPath", it tracks how often visitors went
//   next to each "toPath", and on every incoming HTML request it can answer
//   "which 3 pages is this visitor most likely to click next?".
//
//   The predictions are then surfaced to the browser via:
//     1. **HTTP 103 Early Hints** (Node 18.11+, Chrome 103+, Firefox/Safari
//        progressively) — sent the moment the request lands, BEFORE the page
//        is rendered, so the browser starts fetching predicted pages in
//        parallel with the SSR work. This is one of the highest-leverage HTTP
//        capabilities introduced in the past decade and remains underused.
//     2. The standard `Link:` HTTP response header with `rel=prefetch` for
//        clients/proxies that don't speak 103 yet.
//
//   The data structure is a bounded LRU of fromPath → Map(toPath → count) so
//   memory stays flat under arbitrary traffic, and we periodically halve all
//   counts so the predictor adapts to changing user behavior (concept drift).
//
// Safety / non-regression contract:
//   • No global state escapes this module; the maps live in module scope and
//     reset cleanly when the process restarts.
//   • Browsers MAY ignore prefetch hints (data-saver mode, slow connection,
//     prefers-reduced-data, etc.) — they are advisory by design.
//   • All paths going on the wire are validated to be (a) same-origin
//     relative paths, (b) under MAX_PATH_LEN, (c) HTML-served routes.
//   • Disable entirely with SITE_PREDICTIVE_PREFETCH_DISABLED=1.
// =============================================================================

const ENABLED = process.env.SITE_PREDICTIVE_PREFETCH_DISABLED !== '1';

// Bounded-memory tuning knobs — overrideable via env, sane defaults.
const MAX_FROM_PATHS = Number(process.env.PREFETCH_MAX_FROM_PATHS || 500);
const MAX_TO_PATHS_PER_FROM = Number(process.env.PREFETCH_MAX_TO_PER_FROM || 50);
const MAX_PATH_LEN = 256;
const DECAY_INTERVAL_MS = Number(process.env.PREFETCH_DECAY_INTERVAL_MS || 6 * 60 * 60 * 1000); // 6h
const DECAY_FACTOR = 0.5; // halve all counts on each decay tick

// Insertion-ordered Map — Map iteration order is insertion order, so we get
// LRU-by-touch by deleting + re-setting on every access.
/** @type {Map<string, Map<string, number>>} */
const __graph = new Map();
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
  for (const [from, tos] of __graph) {
    for (const [to, count] of tos) {
      const next = Math.floor(count * DECAY_FACTOR);
      if (next <= 0) tos.delete(to);
      else tos.set(to, next);
    }
    if (tos.size === 0) __graph.delete(from);
  }
}

function recordTransition(fromPath, toPath) {
  if (!ENABLED) return false;
  if (!isNavigablePath(fromPath) || !isNavigablePath(toPath)) return false;
  if (fromPath === toPath) return false; // self-loops not useful
  _maybeDecay();
  let tos = __graph.get(fromPath);
  if (!tos) {
    // LRU eviction: drop oldest fromPath entry if at cap.
    if (__graph.size >= MAX_FROM_PATHS) {
      const oldestKey = __graph.keys().next().value;
      if (oldestKey !== undefined) __graph.delete(oldestKey);
    }
    tos = new Map();
    __graph.set(fromPath, tos);
  } else {
    // Touch: move to most-recent by re-inserting.
    __graph.delete(fromPath);
    __graph.set(fromPath, tos);
  }
  const prev = tos.get(toPath) || 0;
  tos.set(toPath, prev + 1);
  // Cap per-fromPath fanout — drop the lowest-count toPath if over the limit.
  if (tos.size > MAX_TO_PATHS_PER_FROM) {
    let minKey = null;
    let minVal = Infinity;
    for (const [k, v] of tos) {
      if (v < minVal) { minVal = v; minKey = k; }
    }
    if (minKey !== null) tos.delete(minKey);
  }
  __totalTransitions++;
  return true;
}

function predict(fromPath, k) {
  if (!ENABLED) return [];
  const limit = Math.max(1, Math.min(10, Number(k) || 3));
  const tos = __graph.get(fromPath);
  if (!tos || tos.size === 0) return [];
  // Sort by count desc, take top-k. Map.size is bounded by
  // MAX_TO_PATHS_PER_FROM (50) so this is O(n log n) with n ≤ 50.
  const arr = Array.from(tos.entries()).sort((a, b) => b[1] - a[1]);
  return arr.slice(0, limit).map(([path, count]) => ({ path, count }));
}

function getStats() {
  let edges = 0;
  for (const tos of __graph.values()) edges += tos.size;
  return {
    enabled: ENABLED,
    fromPaths: __graph.size,
    edges,
    totalTransitionsRecorded: __totalTransitions,
    lastDecayAt: new Date(__lastDecayAt).toISOString(),
    config: {
      maxFromPaths: MAX_FROM_PATHS,
      maxToPathsPerFrom: MAX_TO_PATHS_PER_FROM,
      decayIntervalMs: DECAY_INTERVAL_MS,
      decayFactor: DECAY_FACTOR
    }
  };
}

// Build the value of a `Link` header (RFC 8288) for the predicted prefetch
// targets. Empty string when there's nothing to predict.
function buildLinkHeader(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return '';
  return predictions
    .map(p => `<${p.path}>; rel=prefetch`)
    .join(', ');
}

// Send a 103 Early Hints response with predicted prefetch links. This is a
// no-op when the platform doesn't support it, when the response is already
// past headers, or when there are no predictions.
//
// `extraLinks` lets the caller bundle critical preload hints (CSS/JS) into
// the same Early Hints frame so the browser kicks off those downloads even
// earlier than they would from the final response's Link header.
function sendEarlyHints(res, predictions, extraLinks) {
  if (!ENABLED) return false;
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
    if (links.length === 0) return false;
    res.writeEarlyHints({ link: links });
    return true;
  } catch (_) {
    // Some Node http internals can throw if the connection has already been
    // hijacked (e.g. websocket upgrade). Never let early hints break the
    // request — they're a pure performance optimization.
    return false;
  }
}

// Reset state — used by tests to get a clean slate.
function _resetForTests() {
  __graph.clear();
  __totalTransitions = 0;
  __lastDecayAt = Date.now();
}

module.exports = {
  ENABLED,
  isNavigablePath,
  extractReferrerPath,
  recordTransition,
  predict,
  getStats,
  buildLinkHeader,
  sendEarlyHints,
  _resetForTests
};
