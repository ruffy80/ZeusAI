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
          // Rewrite path so downstream handlers see clean path
          // Rescrie calea astfel încât handler-ele downstream văd calea curată
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
    // 3. API Key Validation note
    // Validare cheie API — getTenantByApiKey already verified active key
    // and updated lastUsedAt. Additional guard for non-API-key paths done
    // via tenant status check above.
    // ------------------------------------------------------------------
    // (handled inline in step 1b via getTenantByApiKey)

    // ------------------------------------------------------------------
    // 4. Per-tenant Rate Limiting / Limitare rată per tenant
    // ------------------------------------------------------------------

    const rl = _checkRateLimit(tenantId);
    if (!rl.allowed) {
      _trackStat(tenantId, 'rateLimited');
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter });
    }

    // ------------------------------------------------------------------
    // 7. Tenant Context Injection / Injectare context tenant
    // ------------------------------------------------------------------

    req.tenantId = tenantId;
    req.tenantContext = tenantEngine.getTenantContext(tenantId);

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
module.exports = {
  tenantGateway,
  requireFeature,
  requirePlan,
  tenantRateLimit,
  getGatewayStats,
};
