'use strict';

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
};
