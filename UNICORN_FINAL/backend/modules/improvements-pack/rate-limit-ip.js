// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-28T10:36:57.389Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// improvements-pack/rate-limit-ip.js · #9
//
// In-memory sliding-window per-IP rate limiter. Designed as a drop-in
// pre-flight middleware for cost-sensitive endpoints (e.g. /api/ai/dispatch)
// in addition to the existing tenant-scoped limit, NOT as a replacement.
//
// Pure additive · zero deps · O(1) amortized per request.
// =====================================================================

'use strict';

const STORES = new Map();

function _getStore(name) {
  let s = STORES.get(name);
  if (!s) { s = new Map(); STORES.set(name, s); }
  return s;
}

function _ip(req) {
  const xf = (req.headers && (req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'])) || '';
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || 'unknown';
}

/**
 * Build a sliding-window per-IP limiter middleware (Express compatible).
 * @param {object} opts
 * @param {string} opts.name           bucket name (isolates counters)
 * @param {number} opts.limit          max requests
 * @param {number} opts.windowMs       window length
 * @param {boolean=} opts.skipOnError  if true, allow on internal errors
 */
function buildIpLimiter(opts) {
  const o = opts || {};
  const name = String(o.name || 'default');
  const limit = Math.max(1, Number(o.limit) || 30);
  const windowMs = Math.max(100, Number(o.windowMs) || 60000);
  const skipOnError = o.skipOnError !== false;

  return function ipLimiter(req, res, next) {
    try {
      if (process.env.IP_RATELIMIT_DISABLED === '1') return next();
      const ip = _ip(req);
      const store = _getStore(name);
      const now = Date.now();
      const arr = store.get(ip) || [];
      // Drop entries older than window.
      let i = 0; while (i < arr.length && (now - arr[i]) > windowMs) i++;
      const trimmed = i ? arr.slice(i) : arr;
      if (trimmed.length >= limit) {
        const retryAfterMs = Math.max(0, windowMs - (now - trimmed[0]));
        if (typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
          res.setHeader('X-RateLimit-Limit', String(limit));
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + retryAfterMs) / 1000)));
        }
        if (typeof res.status === 'function') return res.status(429).json({ error: 'rate_limited', scope: 'ip', limit, windowMs });
        // Raw http fallback
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'rate_limited', scope: 'ip', limit, windowMs }));
      }
      trimmed.push(now);
      store.set(ip, trimmed);
      if (typeof res.setHeader === 'function') {
        res.setHeader('X-RateLimit-Limit', String(limit));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - trimmed.length)));
      }
      next();
    } catch (e) {
      if (skipOnError) return next();
      try { res.writeHead(500); res.end('rate_limit_error'); } catch (_) {}
    }
  };
}

function _resetForTests() { STORES.clear(); }

module.exports = { buildIpLimiter, _resetForTests };
