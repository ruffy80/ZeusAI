// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.390Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/snapshot-cache.js · #12
//
// Wraps any zero-arg `buildSnapshot()` function with a short TTL cache so
// repeated requests within a few seconds reuse the previous payload. The
// payload **shape** is preserved exactly — only the timing/recomputation
// changes. Disabled if `SNAPSHOT_CACHE_DISABLED=1`.
//
// Pure additive: callers can opt-in via `cachedSnapshot(buildFn, opts)`.
// Default TTL is 5s; bounded to [0, 60s].
// =====================================================================

'use strict';

function _ttlMs() {
  const raw = Number(process.env.SNAPSHOT_CACHE_TTL_MS || 5000);
  if (!Number.isFinite(raw)) return 5000;
  return Math.min(60000, Math.max(0, raw));
}

function createSnapshotCache(buildFn, opts) {
  if (typeof buildFn !== 'function') {
    throw new TypeError('snapshot-cache: buildFn must be a function');
  }
  const ttl = (opts && Number.isFinite(opts.ttlMs)) ? Math.max(0, opts.ttlMs) : _ttlMs();
  let lastAt = 0;
  let lastValue = null;
  let inflight = null;

  function isDisabled() { return process.env.SNAPSHOT_CACHE_DISABLED === '1' || ttl <= 0; }

  async function get() {
    if (isDisabled()) return await buildFn();
    const now = Date.now();
    if (lastValue !== null && (now - lastAt) < ttl) return lastValue;
    if (inflight) return inflight;
    inflight = Promise.resolve()
      .then(() => buildFn())
      .then((v) => { lastAt = Date.now(); lastValue = v; inflight = null; return v; })
      .catch((e) => { inflight = null; throw e; });
    return inflight;
  }

  function getSync() {
    if (isDisabled()) return buildFn();
    const now = Date.now();
    if (lastValue !== null && (now - lastAt) < ttl) return lastValue;
    const v = buildFn();
    lastAt = Date.now();
    lastValue = v;
    return v;
  }

  function invalidate() { lastAt = 0; lastValue = null; }
  function status() {
    return {
      enabled: !isDisabled(),
      ttlMs: ttl,
      hasValue: lastValue !== null,
      ageMs: lastValue !== null ? (Date.now() - lastAt) : null
    };
  }

  return { get, getSync, invalidate, status };
}

module.exports = { createSnapshotCache };
