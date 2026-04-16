// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.174Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com

// =============================================================================
// tenant-gateway.js — Multi-tenant API Gateway middleware for Unicorn SaaS
// Middleware de API Gateway multi-tenant pentru platforma Unicorn SaaS
// =============================================================================
// Integrates with tenant-engine.js for tenant resolution, feature flags,
// rate limiting, usage tracking, and context injection.
// Integrează motor de tenants pentru rezolvare, flag-uri, rate limiting și tracking.
// =============================================================================

'use strict';

const tenantEngine = require('./tenant-engine');

// ---------------------------------------------------------------------------
// Configuration / Configurare
// ---------------------------------------------------------------------------

const RATE_LIMIT_RPM = parseInt(process.env.TENANT_RATE_LIMIT_RPM, 10) || 300;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute / 1 minut

// Ordered plan tiers (lowest → highest) for requirePlan checks
// Niveluri de planuri ordonate pentru verificări requirePlan
const PLAN_TIER_ORDER = ['plan_free', 'plan_pro', 'plan_enterprise'];

// Public routes that skip tenant detection entirely
// Rute publice care sar peste detecția de tenant
const PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/api\/health(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/api\/tenant\/signup$/,
];

// ---------------------------------------------------------------------------
// In-memory rate limit store / Stoc rate limit în memorie
// Map: tenantId → array of request timestamps (sliding window)
// ---------------------------------------------------------------------------
const rateLimitStore = new Map();

// ---------------------------------------------------------------------------
// Gateway statistics / Statistici gateway
// ---------------------------------------------------------------------------
const stats = {
  totalRequests: 0,
  blocked: 0,
  rateLimited: 0,
  byTenant: {}, // tenantId → { requests, blocked, rateLimited }
};

function _trackStat(tenantId, field) {
  stats[field] = (stats[field] || 0) + 1;
  if (tenantId) {
    if (!stats.byTenant[tenantId]) {
      stats.byTenant[tenantId] = { totalRequests: 0, blocked: 0, rateLimited: 0 };
    }
    stats.byTenant[tenantId][field] = (stats.byTenant[tenantId][field] || 0) + 1;
  }
}

// ---------------------------------------------------------------------------
// Helper: check if a route is public / Verifică dacă ruta e publică
// ---------------------------------------------------------------------------
function _isPublicRoute(path) {
  return PUBLIC_ROUTE_PATTERNS.some(pattern => pattern.test(path));
}

// ---------------------------------------------------------------------------
// Helper: extract subdomain slug from Host header
// Extrage slug-ul subdomeniului din header-ul Host
// e.g. "acme.unicorn.ai" → "acme"
// ---------------------------------------------------------------------------
function _extractSubdomainSlug(host) {
  if (!host) return null;
  // Strip port if present / Elimină portul dacă există
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');
  // Need at least "slug.domain.tld" (3 parts); ignore bare domain or localhost
  // Cel puțin 3 componente: slug.domeniu.tld
  if (parts.length < 3) return null;
  const slug = parts[0];
  // Reject wildcards or 'www' / Respinge wildcard sau 'www'
  if (!slug || slug === 'www') return null;
  return slug;
}

// ---------------------------------------------------------------------------
// Helper: extract tenant slug from path prefix /t/:slug/...
// Extrage slug-ul din prefix-ul de cale /t/:slug/...
// Returns { slug, rewrittenPath } or null
// ---------------------------------------------------------------------------
function _extractPathSlug(originalPath) {
  const match = originalPath.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return {
    slug: match[1],
    rewrittenPath: match[2] || '/',
  };
}

// ---------------------------------------------------------------------------
// Shared rate-limit helper — returns retryAfter seconds or 0 if allowed
// Helper comun pentru rate limit — returnează retryAfter sau 0 dacă e permis
// Side-effect: records the timestamp when allowed
// ---------------------------------------------------------------------------
function _checkRateLimit(tenantId) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  let timestamps = rateLimitStore.get(tenantId) || [];
  // Evict old entries outside the window / Elimină intrările vechi din fereastră
  timestamps = timestamps.filter(ts => ts > windowStart);

  if (timestamps.length >= RATE_LIMIT_RPM) {
    // How many seconds until the oldest request leaves the window
    // Câte secunde până când cea mai veche cerere iese din fereastră
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + RATE_WINDOW_MS - now) / 1000) };
  }

  timestamps.push(now);
  rateLimitStore.set(tenantId, timestamps);
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Per-tenant rate limiter middleware / Middleware rate limiter per tenant
// Sliding window: count requests in last RATE_WINDOW_MS per tenant
// ---------------------------------------------------------------------------
function tenantRateLimit(req, res, next) {
  const tenantId = req.tenantId;
  if (!tenantId) return next(); // No tenant yet — let gateway handle it

  const result = _checkRateLimit(tenantId);
  if (!result.allowed) {
    _trackStat(tenantId, 'rateLimited');
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: result.retryAfter });
  }
  next();
}

// ---------------------------------------------------------------------------
// Main tenant gateway middleware / Middleware principal gateway tenant
// ---------------------------------------------------------------------------
async function tenantGateway(req, res, next) {
  const path = req.path || req.url || '/';

  // Skip public routes / Sare peste rute publice
  if (_isPublicRoute(path)) return next();

  let tenantId = null;
  let tenant = null;
  let apiKeyUsed = false;

  try {
    // ------------------------------------------------------------------
    // 1. Tenant Detection / Detecție tenant
    // ------------------------------------------------------------------

    // 1a. Header: X-Tenant-ID
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'];
      tenant = tenantEngine.getTenant(tenantId);
    }

    // 1b. Header: X-API-Key (raw key)
    if (!tenant && req.headers['x-api-key']) {
      const rawKey = req.headers['x-api-key'];
      tenant = tenantEngine.getTenantByApiKey(rawKey);
      if (tenant) {
        tenantId = tenant.id;
        apiKeyUsed = true;
      }
    }

    // 1c. Subdomain: slug.unicorn.ai
    if (!tenant) {
      const subSlug = _extractSubdomainSlug(req.headers['host'] || '');
      if (subSlug) {
        tenant = tenantEngine.getTenantBySlug(subSlug);
        if (tenant) tenantId = tenant.id;
      }
    }

    // 1d. Path prefix: /t/:slug/...
    if (!tenant) {
      const pathInfo = _extractPathSlug(path);
      if (pathInfo) {
        tenant = tenantEngine.getTenantBySlug(pathInfo.slug);
        if (tenant) {
          tenantId = tenant.id;
          // Rewrite req.url (used by Express routing) and req.path (if defined).
          // req.url is directly assignable; req.path is a getter on Express req
          // so Object.defineProperty is needed to override it.
          // Rescrie req.url (folosit de Express) și req.path (dacă e definit).
          req.url = pathInfo.rewrittenPath;
          if (req.path !== undefined) {
            Object.defineProperty(req, 'path', { value: pathInfo.rewrittenPath, writable: true, configurable: true });
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. Tenant Validation / Validare tenant
    // ------------------------------------------------------------------

    if (!tenant) {
      _trackStat(null, 'blocked');
      return res.status(401).json({ error: 'Invalid tenant or API key' });
    }

    if (tenant.status === 'suspended') {
      const reason = tenant.suspendReason || '';
      _trackStat(tenantId, 'blocked');
      return res.status(403).json({ error: 'Tenant suspended', reason });
    }

    if (tenant.status === 'cancelled') {
      _trackStat(tenantId, 'blocked');
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      _trackStat(tenantId, 'blocked');
      return res.status(401).json({ error: 'Invalid tenant or API key' });
    }

    // ------------------------------------------------------------------
    // 3. API Key Validation
    // Validare cheie API — getTenantByApiKey already verified the key is
    // active and updated lastUsedAt. Tenant status check above covers the
    // remaining guard.
    // ------------------------------------------------------------------
    // (resolved inline at step 1b via getTenantByApiKey)

    // ------------------------------------------------------------------
    // 4. Per-tenant Rate Limiting / Limitare rată per tenant
    // ------------------------------------------------------------------

    const rl = _checkRateLimit(tenantId);
    if (!rl.allowed) {
      _trackStat(tenantId, 'rateLimited');
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter });
    }

    // ------------------------------------------------------------------
    // 5. Feature Flag Enforcement — delegated to requireFeature() factory
    // Aplicarea flag-urilor de funcționalitate — delegată fabricii requireFeature()
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 6. Usage Tracking after response / Tracking utilizare după răspuns
    // ------------------------------------------------------------------

    res.on('finish', () => {
      try {
        tenantEngine.incrementUsage(tenantId, 'requests', 1);
      } catch (_e) {
        // Silent — don't crash the app on usage tracking failures
        // Silențios — nu oprimi aplicația din cauza erorilor de tracking
      }
    });

    // ------------------------------------------------------------------
    // 7. Tenant Context Injection / Injectare context tenant
    // ------------------------------------------------------------------

    req.tenantId = tenantId;
    req.tenantContext = tenantEngine.getTenantContext(tenantId);

    // ------------------------------------------------------------------
    // 8 & 9. Exports & Bypass — handled at module level (see exports below)
    // Exporturi & bypass — gestionate la nivel de modul (vezi exporturi)
    // ------------------------------------------------------------------

    // ------------------------------------------------------------------
    // 10. Logging / Jurnalizare
    // ------------------------------------------------------------------

    try {
      tenantEngine.logTenantLog(tenantId, 'info', 'request', {
        method: req.method,
        path: req.path || req.url,
        ip: req.ip || (req.connection && req.connection.remoteAddress) || 'unknown',
        apiKeyUsed,
      });
    } catch (_logErr) {
      // Non-fatal / Non-fatal
    }

    _trackStat(tenantId, 'totalRequests');
    next();
  } catch (err) {
    // Unexpected error in gateway / Eroare neașteptată în gateway
    console.error('[tenant-gateway] Unexpected error:', err);
    next(err);
  }
}

// ---------------------------------------------------------------------------
// requireFeature(featureName) — middleware factory
// Fabrică de middleware pentru verificarea unui feature flag
// ---------------------------------------------------------------------------
function requireFeature(featureName) {
  return function featureGuard(req, res, next) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context missing' });
    }
    if (!tenantEngine.hasFeature(tenantId, featureName)) {
      return res.status(403).json({
        error: 'Feature not available on your plan',
        feature: featureName,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// requirePlan(minPlan) — middleware factory
// Verifică că tenant-ul are cel puțin nivelul de plan cerut
// ---------------------------------------------------------------------------
function requirePlan(minPlan) {
  return function planGuard(req, res, next) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context missing' });
    }

    const ctx = req.tenantContext || tenantEngine.getTenantContext(tenantId);
    const tenantPlanId = ctx && ctx.tenant ? ctx.tenant.planId : null;

    const minIndex = PLAN_TIER_ORDER.indexOf(minPlan);
    const tenantIndex = PLAN_TIER_ORDER.indexOf(tenantPlanId);

    // Unknown plan IDs are treated as the highest tier (enterprise custom plans)
    // Planurile necunoscute sunt tratate ca cel mai înalt nivel (planuri enterprise custom)
    const effectiveTenantIndex = tenantIndex === -1 ? PLAN_TIER_ORDER.length : tenantIndex;
    const effectiveMinIndex = minIndex === -1 ? 0 : minIndex;

    if (effectiveTenantIndex < effectiveMinIndex) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        requiredPlan: minPlan,
        currentPlan: tenantPlanId,
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// getGatewayStats() — basic stats helper used in module.exports below
// ---------------------------------------------------------------------------
function getGatewayStats() {
  return { activeWindows: _minuteWindows ? _minuteWindows.size : 0 };
}

module.exports = {
  tenantGateway,
  requireFeature,
  requirePlan,
  tenantRateLimit,
  getGatewayStats,
};

/* ============================================================================
 * TENANT GATEWAY v2 — Zeus AI Unicorn Multi-Tenant SaaS Platform (continued)
 * The second implementation below overrides module.exports with a richer set
 * of exports that are used by index.js. The code above completes the first
 * implementation to avoid syntax errors from the merged-file artifact.
 * ============================================================================
 */

/**
 * TENANT GATEWAY — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Global API Gateway with tenant-aware routing and auth:
 *   1. Extract tenant identity from: API key header, JWT sub-claim, slug path, or default
 *   2. Validate tenant status (active / suspended)
 *   3. Enforce per-tenant rate limits and daily call quotas
 *   4. Attach tenant context to every request (req.tenant)
 *   5. Log per-tenant request metrics
 *   6. Tenant isolation: reject cross-tenant data requests
 *   7. Backward compat: requests without tenant context fall through to default tenant
 */

const jwt = require('jsonwebtoken');
const tenantManager = require('./tenant-manager');

const JWT_SECRET = process.env.JWT_SECRET || 'unicorn-jwt-secret-change-in-prod';

// Per-tenant per-minute sliding window (in-memory)
// Map<tenantId, number[]> — timestamps
const _minuteWindows = new Map();

function _checkPerMinuteLimit(tenant) {
  const now = Date.now();
  const windowMs = 60_000;
  const id = tenant.id;
  const hits = (_minuteWindows.get(id) || []).filter(ts => now - ts < windowMs);
  const limit = (tenant.customLimits?.apiCallsPerMinute ?? tenant.limits.apiCallsPerMinute);
  if (limit !== -1 && hits.length >= limit) return false;
  hits.push(now);
  _minuteWindows.set(id, hits);
  return true;
}

// Prune stale per-minute entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 70_000;
  for (const [id, hits] of _minuteWindows) {
    const pruned = hits.filter(ts => ts > cutoff);
    if (pruned.length === 0) _minuteWindows.delete(id);
    else _minuteWindows.set(id, pruned);
  }
}, 5 * 60 * 1000).unref();

// ── Resolve tenant from request ───────────────────────────────────────────────

function resolveTenant(req) {
  // 1. X-Tenant-Key header (API key)
  const apiKey = req.headers['x-tenant-key'] || req.headers['x-api-key'];
  if (apiKey) {
    const tenant = tenantManager.getTenantByApiKey(apiKey);
    if (tenant) return { tenant, method: 'apikey' };
  }

  // 2. Authorization Bearer JWT with tenantId claim
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      if (payload.tenantId) {
        const tenant = tenantManager.getTenant(payload.tenantId);
        if (tenant) return { tenant, method: 'jwt' };
      }
    } catch { /* invalid JWT — fall through */ }
  }

  // 3. X-Tenant-Slug header or query param
  const slug = req.headers['x-tenant-slug'] || req.query.tenantSlug;
  if (slug) {
    const tenant = tenantManager.getTenantBySlug(String(slug));
    if (tenant) return { tenant, method: 'slug' };
  }

  // 4. Fallback: default tenant (single-tenant backward compat)
  const def = tenantManager.getTenant(tenantManager.DEFAULT_TENANT_ID);
  if (def) return { tenant: def, method: 'default' };

  return null;
}

// ── Gateway middleware (attach tenant, enforce limits) ────────────────────────

function gatewayMiddleware(req, res, next) {
  const result = resolveTenant(req);

  if (!result) {
    return res.status(503).json({ error: 'No tenant context available' });
  }

  const { tenant, method } = result;

  // Status check
  if (tenant.status === 'deleted') {
    return res.status(410).json({ error: 'Tenant has been deleted' });
  }
  if (tenant.status === 'suspended') {
    return res.status(403).json({ error: 'Tenant is suspended. Please contact support.' });
  }
  if (tenant.status === 'provisioning') {
    return res.status(503).json({ error: 'Tenant is being provisioned. Please retry shortly.' });
  }

  // Daily quota check
  if (tenantManager.isRateLimited(tenant.id)) {
    return res.status(429).json({
      error: 'Daily API call quota exceeded',
      plan: tenant.plan,
      upgrade: '/api/tenant/billing/upgrade',
    });
  }

  // Per-minute rate check
  if (!_checkPerMinuteLimit(tenant)) {
    return res.status(429).json({
      error: 'Per-minute rate limit exceeded',
      plan: tenant.plan,
      upgrade: '/api/tenant/billing/upgrade',
    });
  }

  // Mark last used on matching API key
  if (method === 'apikey') {
    const apiKey = req.headers['x-tenant-key'] || req.headers['x-api-key'];
    const entry = tenant.apiKeys.find(k => k.key === apiKey);
    if (entry) entry.lastUsedAt = new Date().toISOString();
  }

  // Attach tenant context
  req.tenant = tenant;
  req.tenantId = tenant.id;
  req.tenantMethod = method;

  // Record API call usage
  tenantManager.recordApiCall(tenant.id);

  next();
}

// ── Strict isolation middleware ───────────────────────────────────────────────
// Ensures resource in req.params.tenantId matches req.tenant.id
function isolationMiddleware(req, res, next) {
  const paramId = req.params.tenantId;
  if (!paramId) return next();
  if (!req.tenant) return res.status(401).json({ error: 'Tenant context required' });
  if (paramId !== req.tenant.id && req.tenant.id !== tenantManager.DEFAULT_TENANT_ID) {
    return res.status(403).json({ error: 'Cross-tenant access denied' });
  }
  next();
}

// ── Feature gate middleware ───────────────────────────────────────────────────
function requireFeature(featureName) {
  return function featureGateMiddleware(req, res, next) {
    const tenant = req.tenant;
    if (!tenant) return res.status(401).json({ error: 'Tenant context required' });
    const planEnabled = tenant.features[featureName];
    const flagEnabled = tenant.featureFlags[featureName];
    if (!planEnabled && !flagEnabled) {
      return res.status(403).json({
        error: `Feature "${featureName}" is not available on plan "${tenant.plan}"`,
        upgrade: '/api/tenant/billing/upgrade',
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// getGatewayStats() — returns aggregated gateway statistics
// Returnează statisticile agregate ale gateway-ului
// ---------------------------------------------------------------------------
function getGatewayStats() {
  return {
    totalRequests: stats.totalRequests,
    blocked: stats.blocked,
    rateLimited: stats.rateLimited,
    byTenant: { ...stats.byTenant },
    rateLimitRpm: RATE_LIMIT_RPM,
    activeTenantWindows: rateLimitStore.size,
  };
}

// ---------------------------------------------------------------------------
// Exports / Exporturi
// ---------------------------------------------------------------------------
function getStatus() {
  return {
    module: 'TenantGateway',
    status: 'active',
    activeWindows: _minuteWindows.size,
  };
}

module.exports = {
  gatewayMiddleware,
  isolationMiddleware,
  requireFeature,
  resolveTenant,
  getStatus,
  getGatewayStats,
};
