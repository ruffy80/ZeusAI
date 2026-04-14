// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ======================================================================
// ROUTE CACHE — LRU in-memory cache + profiler de rute
// Implementează task-urile PR #194:
//   1. In-memory LRU caching pentru read endpoints frecvente (TTL=60s)
//   2. Profiler pentru top-5 cele mai lente rute
// ======================================================================

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 500;

// ── LRU Cache implementation (Map-based, no external deps) ────────────
class LRUCache {
  constructor(maxSize = MAX_CACHE_SIZE) {
    this._maxSize = maxSize;
    this._map = new Map(); // key → { value, expiresAt }
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    // Refresh LRU order — move to end
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    if (this._map.size >= this._maxSize) {
      // Evict the least-recently-used (oldest) entry
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  get size() { return this._map.size; }

  keys() { return [...this._map.keys()]; }
}

// ── Route profiler state ──────────────────────────────────────────────
// Map: "METHOD /path" → { count, totalMs, maxMs, minMs }
const _routeStats = new Map();

function _recordTiming(path, method, durationMs) {
  const key = `${method} ${path}`;
  const existing = _routeStats.get(key);
  if (existing) {
    existing.count++;
    existing.totalMs += durationMs;
    if (durationMs > existing.maxMs) existing.maxMs = durationMs;
    if (durationMs < existing.minMs) existing.minMs = durationMs;
  } else {
    _routeStats.set(key, {
      count: 1,
      totalMs: durationMs,
      maxMs: durationMs,
      minMs: durationMs,
    });
  }
}

// ── Cache instance + counters ─────────────────────────────────────────
const _cache = new LRUCache(MAX_CACHE_SIZE);
let _cacheHits = 0;
let _cacheMisses = 0;

// ── Profiler middleware ────────────────────────────────────────────────
// Înregistrează timpul de răspuns pentru fiecare rută
function profilerMiddleware() {
  return function routeProfiler(req, res, next) {
    const start = Date.now();
    const _origJson = res.json.bind(res);
    res.json = function (body) {
      _recordTiming(req.path, req.method, Date.now() - start);
      return _origJson(body);
    };
    next();
  };
}

// ── Cache middleware ────────────────────────────────────────────────────
// Caching LRU pentru răspunsuri GET cu TTL configurabil
function cacheMiddleware(ttlMs = DEFAULT_TTL_MS) {
  return function routeCache(req, res, next) {
    if (req.method !== 'GET') return next();
    const key = req.originalUrl || req.url;
    const cached = _cache.get(key);
    if (cached !== null) {
      _cacheHits++;
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
    _cacheMisses++;
    const _origJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode === 200) {
        _cache.set(key, body, ttlMs);
      }
      res.setHeader('X-Cache', 'MISS');
      return _origJson(body);
    };
    next();
  };
}

// ── Stats helpers ──────────────────────────────────────────────────────
function getTopSlowRoutes(limit = 5) {
  const routes = [];
  for (const [route, stats] of _routeStats.entries()) {
    routes.push({
      route,
      count: stats.count,
      avgMs: stats.count ? Math.round(stats.totalMs / stats.count) : 0,
      maxMs: stats.maxMs,
      minMs: stats.minMs,
    });
  }
  return routes
    .filter(r => r.count > 0)
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, limit);
}

function getCacheStatus() {
  return {
    size: _cache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: _cacheHits,
    misses: _cacheMisses,
    hitRate: (_cacheHits + _cacheMisses > 0)
      ? Math.round((_cacheHits / (_cacheHits + _cacheMisses)) * 100) + '%'
      : '0%',
    cachedKeys: _cache.keys(),
    defaultTtlMs: DEFAULT_TTL_MS,
  };
}

function getStats() {
  return {
    profiler: {
      trackedRoutes: _routeStats.size,
      top5Slowest: getTopSlowRoutes(5),
    },
    cache: getCacheStatus(),
    timestamp: new Date().toISOString(),
  };
}

function clearCache() {
  _cache.clear();
  _cacheHits = 0;
  _cacheMisses = 0;
  return { cleared: true, timestamp: new Date().toISOString() };
}

module.exports = {
  profilerMiddleware,
  cacheMiddleware,
  getStats,
  getCacheStatus,
  clearCache,
  DEFAULT_TTL_MS,
};
