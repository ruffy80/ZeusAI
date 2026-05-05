// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-05T15:49:19.352Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * C5 — Sliding-window rate-limiter (in-RAM, additive, fail-open).
 *
 * Tiered limits keyed by visitor identity:
 *   anon       :   60 req / 60s
 *   auth       :  600 req / 60s   (Authorization header present)
 *   partner    : 6000 req / 60s   (X-Partner-Key matches PARTNER_KEYS env)
 *
 * Strictly additive — used as opt-in middleware on hot endpoints only.
 * Sliding window: ring of timestamps per key; cleanup on each hit.
 *
 * Headers (RFC 6585 + draft-polli-ratelimit-headers):
 *   X-RateLimit-Limit
 *   X-RateLimit-Remaining
 *   X-RateLimit-Reset    (unix ts)
 *   Retry-After          (seconds, only on 429)
 *
 * Whitelist:
 *   - 127.0.0.1 / ::1 (loopback, used by backend→site proxy)
 *   - process.env.RATE_LIMIT_DISABLE === '1' (escape hatch)
 */
'use strict';

const WINDOW_MS = 60_000;
const TIERS = {
  anon:    { limit:   60, label: 'anon'    },
  auth:    { limit:  600, label: 'auth'    },
  partner: { limit: 6000, label: 'partner' },
};

const _buckets = new Map(); // key -> [ts, ts, ...]
const _MAX_KEYS = 50_000;   // hard cap to prevent unbounded growth

function _identify(req) {
  const ip = (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return null; // skip loopback
  const partnerKey = String(req.headers['x-partner-key'] || '').slice(0, 64);
  if (partnerKey && _isValidPartnerKey(partnerKey)) {
    return { tier: 'partner', key: 'p:' + partnerKey };
  }
  if (req.headers.authorization) {
    return { tier: 'auth', key: 'a:' + ip + ':' + _hashAuth(req.headers.authorization) };
  }
  return { tier: 'anon', key: 'i:' + ip };
}

function _isValidPartnerKey(k) {
  const allowed = String(process.env.PARTNER_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(k);
}

function _hashAuth(auth) {
  // Cheap fingerprint — stable across requests, not a secret.
  let h = 0;
  for (let i = 0; i < auth.length; i++) h = (h * 31 + auth.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function _gc() {
  // Trigger only when over cap; remove oldest empty entries.
  if (_buckets.size <= _MAX_KEYS) return;
  const now = Date.now();
  for (const [k, arr] of _buckets) {
    while (arr.length && arr[0] < now - WINDOW_MS) arr.shift();
    if (!arr.length) _buckets.delete(k);
    if (_buckets.size <= _MAX_KEYS * 0.9) break;
  }
}

function rateLimit(opts = {}) {
  const overrides = opts.tiers || {};
  return function rateLimitMiddleware(req, res, next) {
    try {
      if (process.env.RATE_LIMIT_DISABLE === '1') return next();
      const id = _identify(req);
      if (!id) return next(); // loopback
      const tier = TIERS[id.tier];
      const limit = overrides[id.tier]?.limit ?? tier.limit;
      const now = Date.now();
      let arr = _buckets.get(id.key);
      if (!arr) { arr = []; _buckets.set(id.key, arr); _gc(); }
      // Drop expired timestamps from front.
      while (arr.length && arr[0] < now - WINDOW_MS) arr.shift();
      if (arr.length >= limit) {
        const oldest = arr[0] || now;
        const resetAt = Math.ceil((oldest + WINDOW_MS) / 1000);
        const retryAfter = Math.max(1, resetAt - Math.floor(now / 1000));
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', String(resetAt));
        res.setHeader('X-RateLimit-Tier', tier.label);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'rate_limited', tier: tier.label, retryAfter });
      }
      arr.push(now);
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - arr.length)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + WINDOW_MS) / 1000)));
      res.setHeader('X-RateLimit-Tier', tier.label);
      return next();
    } catch (e) {
      // Fail-open: never block traffic on internal errors.
      return next();
    }
  };
}

function getStats() {
  return {
    keys: _buckets.size,
    tiers: Object.fromEntries(Object.entries(TIERS).map(([k, v]) => [k, v.limit])),
    windowMs: WINDOW_MS,
  };
}

module.exports = { rateLimit, getStats, TIERS };
