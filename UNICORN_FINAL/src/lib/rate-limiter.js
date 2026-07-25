// =============================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =============================================================================
/**
 * rate-limiter.js — dependency-free in-memory fixed-window rate limiter.
 * ----------------------------------------------------------------------------
 * `createLimiter({ max, windowMs })` returns a function `(key) => verdict`
 * where verdict is `{ ok, retryAfter, remaining, limit }`. Intended as
 * defense-in-depth in front of hot POST endpoints (e.g. checkout create) — the
 * authoritative rate limiting still lives at the nginx edge; this catches
 * bursts that bypass or outrun the edge (loopback, misconfig, internal proxy).
 *
 * The window is per-key (typically the client IP). Buckets are swept lazily so
 * a flood of unique keys cannot grow memory unbounded.
 */
'use strict';

function createLimiter(opts = {}) {
  const max = Math.max(1, Math.floor(Number(opts.max) || 20));
  const windowMs = Math.max(1, Math.floor(Number(opts.windowMs) || 60 * 1000));
  const maxKeys = Math.max(1000, Math.floor(Number(opts.maxKeys) || 50000));
  const buckets = new Map(); // key -> { count, resetAt }

  function _sweep(now) {
    if (buckets.size < maxKeys) return;
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  return function check(key) {
    const now = Date.now();
    const k = String(key == null ? 'unknown' : key);
    let b = buckets.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(k, b);
    }
    b.count += 1;
    if (b.count > max) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      return { ok: false, retryAfter, remaining: 0, limit: max };
    }
    _sweep(now);
    return { ok: true, retryAfter: 0, remaining: Math.max(0, max - b.count), limit: max };
  };
}

module.exports = { createLimiter };
