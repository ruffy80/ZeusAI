'use strict';
/**
 * Tenant Manager — Global SaaS Multi-Tenant Engine
 * Manages tenant lifecycle: creation, isolation, quotas, metadata, suspension, deletion.
 * Each tenant gets its own namespace, resource limits, and AI config.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ─── In-memory tenant store ───────────────────────────────────────────────────
const tenantStore = new Map();   // tenantId → tenant object
const subdomainIndex = new Map(); // subdomain → tenantId
const apiKeyIndex = new Map();    // apiKey → tenantId

// ─── Default plans ───────────────────────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free',
    maxUsers: 5,
    maxApiCallsPerDay: 1000,
    maxStorageMB: 100,
    aiModels: ['fast'],
    features: ['basic_api', 'analytics'],
    price: 0,
  },
  starter: {
    name: 'Starter',
    maxUsers: 25,
    maxApiCallsPerDay: 10000,
    maxStorageMB: 1024,
    aiModels: ['fast', 'chat', 'reasoning'],
    features: ['basic_api', 'analytics', 'billing', 'webhooks'],
    price: 49,
  },
  pro: {
    name: 'Pro',
    maxUsers: 100,
    maxApiCallsPerDay: 100000,
    maxStorageMB: 10240,
    aiModels: ['fast', 'chat', 'reasoning', 'coding', 'analysis'],
    features: ['basic_api', 'analytics', 'billing', 'webhooks', 'sso', 'custom_domain'],
    price: 199,
  },
  enterprise: {
    name: 'Enterprise',
    maxUsers: -1, // unlimited
    maxApiCallsPerDay: -1,
    maxStorageMB: -1,
    aiModels: ['fast', 'chat', 'reasoning', 'coding', 'analysis', 'embeddings', 'tool_use'],
    features: ['basic_api', 'analytics', 'billing', 'webhooks', 'sso', 'custom_domain', 'white_label', 'dedicated_support', 'sla'],
    price: 999,
  },
};

// ─── Tenant Manager class ─────────────────────────────────────────────────────
class TenantManager extends EventEmitter {
  constructor() {
    super();
    this.startTime = Date.now();
    this._usageResetTimer = setInterval(() => this._resetDailyUsage(), 24 * 60 * 60 * 1000);
    this._usageResetTimer.unref?.();
  }

  // ── Create tenant ──────────────────────────────────────────────────────────
  createTenant(data = {}) {
    const {
      name,
      ownerId,
      subdomain,
      plan = 'free',
      region = 'us-east',
      metadata = {},
    } = data;

    if (!name) throw new Error('Tenant name is required');
    if (!ownerId) throw new Error('ownerId is required');

    const sub = (subdomain || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 63);
    if (subdomainIndex.has(sub)) throw new Error(`Subdomain "${sub}" already in use`);

    const tenantId = 'ten_' + crypto.randomBytes(10).toString('hex');
    const apiKey   = 'tkey_' + crypto.randomBytes(20).toString('hex');
    const now = new Date().toISOString();

    const tenant = {
      id: tenantId,
      name,
      ownerId,
      subdomain: sub,
      plan,
      region,
      status: 'active',   // active | suspended | pending | deleted
      apiKey,
      metadata,
      settings: {
        allowedOrigins: [],
        webhookUrl: null,
        aiConfig: {},
        customDomain: null,
        ssoEnabled: false,
      },
      usage: {
        apiCallsToday: 0,
        storageMB: 0,
        totalApiCalls: 0,
        users: 0,
        lastResetAt: now,
      },
      limits: { ...PLANS[plan] || PLANS.free },
      createdAt: now,
      updatedAt: now,
    };

    tenantStore.set(tenantId, tenant);
    subdomainIndex.set(sub, tenantId);
    apiKeyIndex.set(apiKey, tenantId);

    this.emit('tenant:created', { tenantId, name, plan });
    return { ...tenant, apiKey };
  }

  // ── Get tenant ─────────────────────────────────────────────────────────────
  getTenant(tenantId) {
    return tenantStore.get(tenantId) || null;
  }

  getTenantBySubdomain(subdomain) {
    const id = subdomainIndex.get(subdomain);
    return id ? tenantStore.get(id) : null;
  }

  getTenantByApiKey(apiKey) {
    const id = apiKeyIndex.get(apiKey);
    return id ? tenantStore.get(id) : null;
  }

  getTenantsByOwner(ownerId) {
    const result = [];
    for (const t of tenantStore.values()) {
      if (t.ownerId === ownerId && t.status !== 'deleted') result.push(t);
    }
    return result;
  }

  listTenants({ status, plan, region, page = 1, limit = 50 } = {}) {
    let list = [...tenantStore.values()];
    if (status) list = list.filter(t => t.status === status);
    if (plan)   list = list.filter(t => t.plan === plan);
    if (region) list = list.filter(t => t.region === region);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = list.length;
    const offset = (page - 1) * limit;
    return { tenants: list.slice(offset, offset + limit), total, page, limit };
  }

  // ── Update tenant ──────────────────────────────────────────────────────────
  updateTenant(tenantId, updates = {}) {
    const tenant = tenantStore.get(tenantId);
    if (!tenant) throw new Error('Tenant not found');
    const allowed = ['name', 'plan', 'region', 'metadata', 'settings'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        if (typeof tenant[key] === 'object' && !Array.isArray(tenant[key])) {
          tenant[key] = { ...tenant[key], ...updates[key] };
        } else {
          tenant[key] = updates[key];
        }
      }
    }
    if (updates.plan && PLANS[updates.plan]) {
      tenant.limits = { ...PLANS[updates.plan] };
    }
    tenant.updatedAt = new Date().toISOString();
    this.emit('tenant:updated', { tenantId, updates });
    return { ...tenant };
  }

  // ── Suspend / unsuspend ────────────────────────────────────────────────────
  suspendTenant(tenantId, reason = '') {
    const t = tenantStore.get(tenantId);
    if (!t) throw new Error('Tenant not found');
    t.status = 'suspended';
    t.suspendReason = reason;
    t.updatedAt = new Date().toISOString();
    this.emit('tenant:suspended', { tenantId, reason });
    return { tenantId, status: 'suspended' };
  }

  reactivateTenant(tenantId) {
    const t = tenantStore.get(tenantId);
    if (!t) throw new Error('Tenant not found');
    t.status = 'active';
    t.suspendReason = null;
    t.updatedAt = new Date().toISOString();
    this.emit('tenant:reactivated', { tenantId });
    return { tenantId, status: 'active' };
  }

  deleteTenant(tenantId) {
    const t = tenantStore.get(tenantId);
    if (!t) throw new Error('Tenant not found');
    t.status = 'deleted';
    t.deletedAt = new Date().toISOString();
    subdomainIndex.delete(t.subdomain);
    apiKeyIndex.delete(t.apiKey);
    this.emit('tenant:deleted', { tenantId });
    return { tenantId, status: 'deleted' };
  }

  // ── Usage tracking ─────────────────────────────────────────────────────────
  recordApiCall(tenantId) {
    const t = tenantStore.get(tenantId);
    if (!t) return false;
    t.usage.apiCallsToday++;
    t.usage.totalApiCalls++;
    return true;
  }

  checkQuota(tenantId, resource = 'apiCallsToday') {
    const t = tenantStore.get(tenantId);
    if (!t) return { allowed: false, reason: 'Tenant not found' };
    if (t.status !== 'active') return { allowed: false, reason: `Tenant is ${t.status}` };
    const limitKey = resource === 'apiCallsToday' ? 'maxApiCallsPerDay' : null;
    if (!limitKey) return { allowed: true };
    const limit = t.limits[limitKey];
    if (limit === -1) return { allowed: true, unlimited: true };
    const used = t.usage[resource] || 0;
    if (used >= limit) return { allowed: false, reason: `${limitKey} exceeded (${used}/${limit})` };
    return { allowed: true, used, limit, remaining: limit - used };
  }

  _resetDailyUsage() {
    const now = new Date().toISOString();
    for (const t of tenantStore.values()) {
      t.usage.apiCallsToday = 0;
      t.usage.lastResetAt = now;
    }
  }

  // ── Tenant isolation middleware ────────────────────────────────────────────
  /**
   * Express middleware: resolves tenant from X-Tenant-ID header or api key,
   * enforces quota, attaches req.tenant.
   */
  middleware() {
    return (req, res, next) => {
      const tenantId  = req.headers['x-tenant-id'];
      const apiKey    = req.headers['x-tenant-api-key'] || req.headers['x-api-key'];

      let tenant = null;
      if (tenantId) {
        tenant = this.getTenant(tenantId);
      } else if (apiKey) {
        tenant = this.getTenantByApiKey(apiKey);
      }

      if (!tenant) {
        // Allow passthrough — routes that don't need tenant context
        return next();
      }

      const quota = this.checkQuota(tenant.id);
      if (!quota.allowed) {
        return res.status(429).json({ error: 'Tenant quota exceeded', reason: quota.reason });
      }

      this.recordApiCall(tenant.id);
      req.tenant = tenant;
      next();
    };
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  getStatus() {
    const tenants = [...tenantStore.values()];
    const byStatus = {};
    const byPlan = {};
    for (const t of tenants) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byPlan[t.plan]     = (byPlan[t.plan] || 0) + 1;
    }
    return {
      module: 'TenantManager',
      version: '2.0.0',
      total: tenants.length,
      byStatus,
      byPlan,
      plans: Object.keys(PLANS),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getPlans() { return PLANS; }
}

module.exports = new TenantManager();
module.exports.TenantManager = TenantManager;
module.exports.PLANS = PLANS;
