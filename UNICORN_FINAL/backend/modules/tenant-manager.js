'use strict';

/**
 * TENANT MANAGER — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Manages full tenant lifecycle:
 *   1. Tenant CRUD (create / read / update / suspend / delete)
 *   2. Strict tenant isolation (data, config, runtime, logs, storage namespaces)
 *   3. Per-tenant API keys (create / rotate / revoke)
 *   4. Per-tenant feature flags
 *   5. Per-tenant rate limits and resource quotas
 *   6. Per-tenant environment overrides
 *   7. Backward-compat: single-tenant (default) tenant always present
 */

const crypto = require('crypto');

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    limits: {
      apiCallsPerDay: 1_000,
      apiCallsPerMinute: 20,
      storageBytes: 100 * 1024 * 1024,        // 100 MB
      maxUsers: 3,
      maxApiKeys: 2,
      maxEnvironments: 1,
    },
    features: {
      analytics: false,
      billing: false,
      multiRegion: false,
      customDomain: false,
      auditLog: false,
      sso: false,
    },
  },
  starter: {
    name: 'Starter',
    priceMonthly: 29,
    limits: {
      apiCallsPerDay: 50_000,
      apiCallsPerMinute: 200,
      storageBytes: 5 * 1024 * 1024 * 1024,   // 5 GB
      maxUsers: 25,
      maxApiKeys: 10,
      maxEnvironments: 2,
    },
    features: {
      analytics: true,
      billing: false,
      multiRegion: false,
      customDomain: false,
      auditLog: true,
      sso: false,
    },
  },
  pro: {
    name: 'Pro',
    priceMonthly: 99,
    limits: {
      apiCallsPerDay: 500_000,
      apiCallsPerMinute: 1_000,
      storageBytes: 50 * 1024 * 1024 * 1024,  // 50 GB
      maxUsers: 200,
      maxApiKeys: 50,
      maxEnvironments: 5,
    },
    features: {
      analytics: true,
      billing: true,
      multiRegion: false,
      customDomain: true,
      auditLog: true,
      sso: false,
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 499,
    limits: {
      apiCallsPerDay: 10_000_000,
      apiCallsPerMinute: 10_000,
      storageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
      maxUsers: -1,    // unlimited
      maxApiKeys: -1,
      maxEnvironments: -1,
    },
    features: {
      analytics: true,
      billing: true,
      multiRegion: true,
      customDomain: true,
      auditLog: true,
      sso: true,
    },
  },
};

// ── In-memory tenant store ────────────────────────────────────────────────────
// Map<tenantId, tenant>
const _tenants = new Map();
// Map<apiKey, tenantId>
const _apiKeyIndex = new Map();

// ── Default single-tenant for backward compatibility ──────────────────────────
const DEFAULT_TENANT_ID = 'default';

function _createDefaultTenant() {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_TENANT_ID,
    name: 'Default Tenant',
    slug: 'default',
    status: 'active',   // active | suspended | deleted
    plan: 'enterprise',
    ownerId: 'system',
    ownerEmail: process.env.ADMIN_EMAIL || 'admin@localhost',
    environments: { production: { vars: {} } },
    apiKeys: [],
    featureFlags: {},
    limits: { ...PLANS.enterprise.limits },
    features: { ...PLANS.enterprise.features },
    customLimits: null,   // override PLAN limits if set
    usage: { today: { apiCalls: 0, date: _today() }, total: { apiCalls: 0 } },
    storageUsedBytes: 0,
    metadata: {},
    auditLog: [],
    createdAt: now,
    updatedAt: now,
    provisionedAt: now,
    isDefault: true,
  };
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

function _resetDailyUsageIfNeeded(tenant) {
  const today = _today();
  if (tenant.usage.today.date !== today) {
    tenant.usage.today = { apiCalls: 0, date: today };
  }
}

function _generateApiKey() {
  return 'sk_' + crypto.randomBytes(24).toString('hex');
}

function _generateTenantId() {
  return 't_' + crypto.randomBytes(8).toString('hex');
}

function _audit(tenant, action, data = {}) {
  const entry = { ts: new Date().toISOString(), action, ...data };
  tenant.auditLog.push(entry);
  if (tenant.auditLog.length > 500) tenant.auditLog.shift();
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  if (!_tenants.has(DEFAULT_TENANT_ID)) {
    const dt = _createDefaultTenant();
    // Create a default API key for backward compat
    const key = _generateApiKey();
    dt.apiKeys.push({
      key,
      label: 'default-key',
      createdAt: dt.createdAt,
      lastUsedAt: null,
      active: true,
      scopes: ['*'],
    });
    _apiKeyIndex.set(key, DEFAULT_TENANT_ID);
    _tenants.set(DEFAULT_TENANT_ID, dt);
    console.log('[TenantManager] Default tenant initialized');
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

function createTenant({ name, slug, plan = 'starter', ownerEmail, ownerId = null, metadata = {} } = {}) {
  if (!name || !ownerEmail) throw new Error('name and ownerEmail are required');
  const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);

  // Ensure slug uniqueness
  for (const t of _tenants.values()) {
    if (t.slug === cleanSlug) throw new Error(`Slug "${cleanSlug}" is already taken`);
  }

  if (!PLANS[plan]) throw new Error(`Unknown plan: ${plan}`);
  const planDef = PLANS[plan];
  const now = new Date().toISOString();
  const id = _generateTenantId();

  const tenant = {
    id,
    name,
    slug: cleanSlug,
    status: 'provisioning',
    plan,
    ownerId: ownerId || id,
    ownerEmail,
    environments: { production: { vars: {} } },
    apiKeys: [],
    featureFlags: {},
    limits: { ...planDef.limits },
    features: { ...planDef.features },
    customLimits: null,
    usage: { today: { apiCalls: 0, date: _today() }, total: { apiCalls: 0 } },
    storageUsedBytes: 0,
    metadata,
    auditLog: [],
    createdAt: now,
    updatedAt: now,
    provisionedAt: null,
    isDefault: false,
  };

  _tenants.set(id, tenant);
  _audit(tenant, 'create', { plan, ownerEmail });
  return tenant;
}

function getTenant(id) {
  return _tenants.get(id) || null;
}

function getTenantBySlug(slug) {
  for (const t of _tenants.values()) {
    if (t.slug === slug) return t;
  }
  return null;
}

function getTenantByApiKey(key) {
  const id = _apiKeyIndex.get(key);
  if (!id) return null;
  return _tenants.get(id) || null;
}

function listTenants({ includeDeleted = false } = {}) {
  const out = [];
  for (const t of _tenants.values()) {
    if (!includeDeleted && t.status === 'deleted') continue;
    out.push(_safeTenant(t));
  }
  return out;
}

function updateTenant(id, updates = {}) {
  const tenant = _tenants.get(id);
  if (!tenant) throw new Error(`Tenant not found: ${id}`);
  if (tenant.status === 'deleted') throw new Error('Cannot update a deleted tenant');

  const allowed = ['name', 'metadata', 'featureFlags', 'customLimits'];
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, k)) {
      tenant[k] = updates[k];
    }
  }

  // Plan upgrade/downgrade
  if (updates.plan && PLANS[updates.plan]) {
    const planDef = PLANS[updates.plan];
    tenant.plan = updates.plan;
    tenant.limits = { ...planDef.limits };
    tenant.features = { ...planDef.features };
  }

  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'update', { fields: Object.keys(updates) });
  return tenant;
}

function suspendTenant(id, reason = '') {
  const tenant = _tenants.get(id);
  if (!tenant) throw new Error(`Tenant not found: ${id}`);
  if (tenant.isDefault) throw new Error('Cannot suspend the default tenant');
  tenant.status = 'suspended';
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'suspend', { reason });
  return tenant;
}

function reactivateTenant(id) {
  const tenant = _tenants.get(id);
  if (!tenant) throw new Error(`Tenant not found: ${id}`);
  if (tenant.status === 'deleted') throw new Error('Cannot reactivate a deleted tenant');
  tenant.status = 'active';
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'reactivate');
  return tenant;
}

function deleteTenant(id, { hard = false } = {}) {
  const tenant = _tenants.get(id);
  if (!tenant) throw new Error(`Tenant not found: ${id}`);
  if (tenant.isDefault) throw new Error('Cannot delete the default tenant');

  // Revoke all API keys
  for (const k of tenant.apiKeys) {
    _apiKeyIndex.delete(k.key);
  }

  if (hard) {
    _tenants.delete(id);
    return { deleted: true, hard: true };
  }

  tenant.status = 'deleted';
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'delete');
  return tenant;
}

// ── API Key Management ────────────────────────────────────────────────────────

function createApiKey(tenantId, { label = 'default', scopes = ['*'] } = {}) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (tenant.status === 'suspended' || tenant.status === 'deleted') {
    throw new Error(`Tenant is ${tenant.status} — cannot create API keys`);
  }

  const maxKeys = tenant.customLimits?.maxApiKeys ?? tenant.limits.maxApiKeys;
  if (maxKeys !== -1 && tenant.apiKeys.length >= maxKeys) {
    throw new Error(`API key limit (${maxKeys}) reached for this plan`);
  }

  const key = _generateApiKey();
  const entry = {
    key,
    label: String(label).slice(0, 64),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    active: true,
    scopes,
  };
  tenant.apiKeys.push(entry);
  _apiKeyIndex.set(key, tenantId);
  _audit(tenant, 'apikey_create', { label });
  return entry;
}

function revokeApiKey(tenantId, key) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  const entry = tenant.apiKeys.find(k => k.key === key);
  if (!entry) throw new Error('API key not found');
  entry.active = false;
  _apiKeyIndex.delete(key);
  _audit(tenant, 'apikey_revoke', { label: entry.label });
  return { revoked: true };
}

function rotateApiKey(tenantId, oldKey) {
  revokeApiKey(tenantId, oldKey);
  const tenant = _tenants.get(tenantId);
  const old = tenant.apiKeys.find(k => k.key === oldKey);
  return createApiKey(tenantId, { label: old ? old.label + '-rotated' : 'rotated', scopes: old ? old.scopes : ['*'] });
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

function setFeatureFlag(tenantId, flag, value) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (typeof flag !== 'string' || flag === '__proto__' || flag === 'constructor' || flag === 'prototype') {
    throw new Error(`Invalid feature flag name: ${flag}`);
  }
  tenant.featureFlags[flag] = value;
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'feature_flag', { flag, value });
  return tenant.featureFlags;
}

function getFeatureFlag(tenantId, flag, defaultValue = false) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) return defaultValue;
  return Object.prototype.hasOwnProperty.call(tenant.featureFlags, flag)
    ? tenant.featureFlags[flag]
    : defaultValue;
}

// ── Environments ──────────────────────────────────────────────────────────────

function addEnvironment(tenantId, envName, vars = {}) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  const maxEnv = tenant.customLimits?.maxEnvironments ?? tenant.limits.maxEnvironments;
  const currentCount = Object.keys(tenant.environments).length;
  if (maxEnv !== -1 && currentCount >= maxEnv) {
    throw new Error(`Environment limit (${maxEnv}) reached`);
  }
  tenant.environments[envName] = { vars };
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'env_add', { envName });
  return tenant.environments;
}

function setEnvironmentVars(tenantId, envName, vars = {}) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (!tenant.environments[envName]) throw new Error(`Environment not found: ${envName}`);
  // Guard against prototype pollution: skip dangerous keys
  const safeVars = {};
  for (const [k, v] of Object.entries(vars)) {
    if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
      safeVars[k] = v;
    }
  }
  tenant.environments[envName].vars = { ...tenant.environments[envName].vars, ...safeVars };
  tenant.updatedAt = new Date().toISOString();
  _audit(tenant, 'env_vars_update', { envName, keys: Object.keys(vars) });
  return tenant.environments[envName];
}

// ── Usage Tracking ────────────────────────────────────────────────────────────

function recordApiCall(tenantId) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) return;
  _resetDailyUsageIfNeeded(tenant);
  tenant.usage.today.apiCalls++;
  tenant.usage.total.apiCalls++;
  // Update last used on API key if available via req context (best effort)
}

function isRateLimited(tenantId) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) return true;
  _resetDailyUsageIfNeeded(tenant);
  const maxDay = tenant.customLimits?.apiCallsPerDay ?? tenant.limits.apiCallsPerDay;
  return maxDay !== -1 && tenant.usage.today.apiCalls >= maxDay;
}

function getUsage(tenantId) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  _resetDailyUsageIfNeeded(tenant);
  return { ...tenant.usage, storageUsedBytes: tenant.storageUsedBytes };
}

// ── Isolation helpers ─────────────────────────────────────────────────────────

function getTenantNamespace(tenantId, resource = '') {
  return `tenant:${tenantId}:${resource}`;
}

function getTenantLogPrefix(tenantId) {
  return `[Tenant:${tenantId}]`;
}

// ── Safe view (strips API key values) ────────────────────────────────────────

function _safeTenant(t) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    plan: t.plan,
    ownerId: t.ownerId,
    ownerEmail: t.ownerEmail,
    environments: Object.keys(t.environments),
    apiKeyCount: t.apiKeys.filter(k => k.active).length,
    featureFlags: t.featureFlags,
    limits: t.limits,
    features: t.features,
    customLimits: t.customLimits,
    usage: t.usage,
    storageUsedBytes: t.storageUsedBytes,
    metadata: t.metadata,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    provisionedAt: t.provisionedAt,
    isDefault: t.isDefault,
  };
}

function getTenantSafe(id) {
  const t = _tenants.get(id);
  if (!t) return null;
  return _safeTenant(t);
}

function getAuditLog(tenantId, limit = 100) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  return tenant.auditLog.slice(-limit).reverse();
}

function getStatus() {
  return {
    module: 'TenantManager',
    status: 'active',
    totalTenants: _tenants.size,
    activeTenants: [..._tenants.values()].filter(t => t.status === 'active').length,
    suspendedTenants: [..._tenants.values()].filter(t => t.status === 'suspended').length,
    plans: Object.keys(PLANS),
    defaultTenantId: DEFAULT_TENANT_ID,
  };
}

// ── Init on load ──────────────────────────────────────────────────────────────
init();

module.exports = {
  init,
  PLANS,
  DEFAULT_TENANT_ID,
  createTenant,
  getTenant,
  getTenantSafe,
  getTenantBySlug,
  getTenantByApiKey,
  listTenants,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  createApiKey,
  revokeApiKey,
  rotateApiKey,
  setFeatureFlag,
  getFeatureFlag,
  addEnvironment,
  setEnvironmentVars,
  recordApiCall,
  isRateLimited,
  getUsage,
  getTenantNamespace,
  getTenantLogPrefix,
  getAuditLog,
  getStatus,
};
