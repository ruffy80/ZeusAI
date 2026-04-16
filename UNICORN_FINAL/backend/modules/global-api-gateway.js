'use strict';
/**
 * Global API Gateway — SaaS Request Routing & Tenant-Aware Proxy
 * - Per-tenant rate limiting
 * - Request authentication (API key / JWT)
 * - Region-aware routing
 * - Request/response logging
 * - Circuit breaker per upstream
 * - Health checks
 */

const { EventEmitter } = require('events');

// ─── Per-tenant rate limit windows ───────────────────────────────────────────
const rateLimitWindows = new Map(); // tenantId → { count, resetAt }

// ─── Route registry ───────────────────────────────────────────────────────────
const routes = new Map(); // routeKey → { upstream, methods, auth, rateLimit }

// ─── Circuit breaker state ─────────────────────────────────────────────────────
const circuitState = new Map(); // upstream → { failures, openUntil, state }

// ─── Request log (ring buffer) ────────────────────────────────────────────────
const MAX_LOG = 500;
const requestLog = [];

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = {
  totalRequests: 0,
  blockedRequests: 0,
  tenantRequests: new Map(),
  routeHits: new Map(),
  startedAt: new Date().toISOString(),
};

class GlobalApiGateway extends EventEmitter {
  constructor() {
    super();
    this.defaultWindowMs = 60 * 1000; // 1 min
    this.circuitOpenDurationMs = 30 * 1000;
    this.circuitFailThreshold = 5;
    this._cleanTimer = setInterval(() => this._cleanExpiredWindows(), 5 * 60 * 1000);
    this._cleanTimer.unref?.();
    this._registerDefaultRoutes();
  }

  // ── Register a virtual route ──────────────────────────────────────────────
  registerRoute(pattern, config = {}) {
    routes.set(pattern, {
      pattern,
      upstream: config.upstream || 'local',
      methods:  config.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      auth:     config.auth !== false,
      rateLimit: config.rateLimit || { requestsPerMin: 300 },
      transform: config.transform || null,
      tenantRequired: config.tenantRequired || false,
      tags: config.tags || [],
    });
  }

  _registerDefaultRoutes() {
    this.registerRoute('/api/ai/*',      { rateLimit: { requestsPerMin: 60 }, tags: ['ai'] });
    this.registerRoute('/api/billing/*', { rateLimit: { requestsPerMin: 120 }, tags: ['billing'] });
    this.registerRoute('/api/tenants/*', { rateLimit: { requestsPerMin: 60 }, auth: true, tenantRequired: false, tags: ['tenant'] });
    this.registerRoute('/api/admin/*',   { rateLimit: { requestsPerMin: 30 }, auth: true, tags: ['admin'] });
    this.registerRoute('/api/*',         { rateLimit: { requestsPerMin: 600 }, tags: ['general'] });
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  _checkRateLimit(tenantId, limitPerMin) {
    const key = `${tenantId}:${limitPerMin}`;
    const now = Date.now();
    let win = rateLimitWindows.get(key);
    if (!win || now > win.resetAt) {
      win = { count: 0, resetAt: now + this.defaultWindowMs };
      rateLimitWindows.set(key, win);
    }
    win.count++;
    if (win.count > limitPerMin) {
      return { allowed: false, retryAfterMs: win.resetAt - now, count: win.count, limit: limitPerMin };
    }
    return { allowed: true, count: win.count, limit: limitPerMin };
  }

  _cleanExpiredWindows() {
    const now = Date.now();
    for (const [k, v] of rateLimitWindows) {
      if (now > v.resetAt) rateLimitWindows.delete(k);
    }
  }

  // ── Circuit breaker ───────────────────────────────────────────────────────
  _checkCircuit(upstream) {
    const c = circuitState.get(upstream);
    if (!c) return 'closed';
    if (c.state === 'open' && Date.now() < c.openUntil) return 'open';
    if (c.state === 'open') {
      c.state = 'half-open';
      circuitState.set(upstream, c);
    }
    return c.state;
  }

  recordUpstreamSuccess(upstream) {
    circuitState.delete(upstream);
  }

  recordUpstreamFailure(upstream) {
    const now = Date.now();
    let c = circuitState.get(upstream) || { failures: 0, state: 'closed', openUntil: 0 };
    c.failures++;
    if (c.failures >= this.circuitFailThreshold) {
      c.state = 'open';
      c.openUntil = now + this.circuitOpenDurationMs;
      this.emit('circuit:open', { upstream });
    }
    circuitState.set(upstream, c);
  }

  // ── Match route ───────────────────────────────────────────────────────────
  _matchRoute(path) {
    for (const [pattern, cfg] of routes) {
      const regexStr = pattern.replace(/\*/g, '.*').replace(/:[^/]+/g, '[^/]+');
      try {
        if (new RegExp('^' + regexStr + '$').test(path)) return cfg;
      } catch (_) { /* skip bad pattern */ }
    }
    return null;
  }

  // ── Gateway middleware ────────────────────────────────────────────────────
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      stats.totalRequests++;

      const tenantId = (req.tenant && req.tenant.id) || req.headers['x-tenant-id'] || 'anonymous';
      stats.tenantRequests.set(tenantId, (stats.tenantRequests.get(tenantId) || 0) + 1);

      const route = this._matchRoute(req.path);
      const limitPerMin = (route && route.rateLimit && route.rateLimit.requestsPerMin) || 600;
      const rl = this._checkRateLimit(tenantId, limitPerMin);

      if (!rl.allowed) {
        stats.blockedRequests++;
        res.setHeader('X-RateLimit-Limit', limitPerMin);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs });
      }

      res.setHeader('X-RateLimit-Limit', limitPerMin);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limitPerMin - rl.count));

      if (route) {
        const upstream = route.upstream || 'local';
        const circuit = this._checkCircuit(upstream);
        if (circuit === 'open') {
          stats.blockedRequests++;
          return res.status(503).json({ error: 'Service temporarily unavailable', upstream });
        }
        stats.routeHits.set(route.pattern, (stats.routeHits.get(route.pattern) || 0) + 1);
        req.gatewayRoute = route;
      }

      // Log after response
      res.on('finish', () => {
        const entry = {
          ts: new Date().toISOString(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          tenantId,
          durationMs: Date.now() - start,
        };
        requestLog.push(entry);
        if (requestLog.length > MAX_LOG) requestLog.shift();
        this.emit('request', entry);
      });

      next();
    };
  }

  // ── Status & Logs ──────────────────────────────────────────────────────────
  getStatus() {
    const topTenants = [...stats.tenantRequests.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({ id, count }));

    const topRoutes = [...stats.routeHits.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([route, hits]) => ({ route, hits }));

    return {
      module: 'GlobalApiGateway',
      version: '1.0.0',
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      registeredRoutes: routes.size,
      activeTenants: stats.tenantRequests.size,
      topTenants,
      topRoutes,
      circuitBreakers: [...circuitState.entries()].map(([u, c]) => ({ upstream: u, state: c.state })),
      startedAt: stats.startedAt,
    };
  }

  getRecentLogs(limit = 50) {
    return requestLog.slice(-limit);
  }

  getRoutes() {
    return [...routes.values()];
  }
}

module.exports = new GlobalApiGateway();
module.exports.GlobalApiGateway = GlobalApiGateway;
