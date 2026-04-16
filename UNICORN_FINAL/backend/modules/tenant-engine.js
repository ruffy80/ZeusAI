// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com

// =============================================================================
// tenant-engine.js — Core multi-tenant data model for Unicorn SaaS platform
// Motor de date multi-tenant pentru platforma Unicorn SaaS
// =============================================================================
// In-memory Maps for all tenant data, with optional SQLite persistence
// via better-sqlite3 (already present in package.json).
// Izolare strictă: fiecare entitate este cheiată după tenantId.
// =============================================================================

'use strict';

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Optional SQLite persistence — gracefully degraded if DB unavailable
// Persistență SQLite opțională — degradare elegantă dacă BD nu e disponibilă
// ---------------------------------------------------------------------------
let db = null;
try {
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = process.env.TENANT_DB_PATH || path.join(__dirname, '../../data/tenants.db');
  const fs = require('fs');
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  _initSchema(db);
} catch (err) {
  // SQLite not available — run fully in-memory / fără persistență SQLite
  db = null;
}

function _initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tenant_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_events_tenantId ON tenant_events(tenantId);

    CREATE TABLE IF NOT EXISTS tenant_logs (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_logs_tenantId ON tenant_logs(tenantId);
  `);
}

// ---------------------------------------------------------------------------
// Prepared SQLite statements (lazy — only if db is available)
// Declarații pregătite pentru SQLite (lazy)
// ---------------------------------------------------------------------------
let _stmtInsertEvent = null;
let _stmtInsertLog = null;
function _getStmtInsertEvent() {
  if (!db) return null;
  if (!_stmtInsertEvent) {
    _stmtInsertEvent = db.prepare(
      'INSERT INTO tenant_events (id, tenantId, type, payload, createdAt) VALUES (?, ?, ?, ?, ?)'
    );
  }
  return _stmtInsertEvent;
}
function _getStmtInsertLog() {
  if (!db) return null;
  if (!_stmtInsertLog) {
    _stmtInsertLog = db.prepare(
      'INSERT INTO tenant_logs (id, tenantId, level, message, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
  }
  return _stmtInsertLog;
}

// ---------------------------------------------------------------------------
// In-memory data stores / Stocare date în memorie
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} tenantId → tenant object */
const tenants = new Map();

/** @type {Map<string, object>} planId → plan object */
const plans = new Map();

/** @type {Map<string, object>} subscriptionId → subscription object */
const subscriptions = new Map();

/** @type {Map<string, object>} invoiceId → invoice object */
const invoices = new Map();

/** @type {Map<string, object>} keyId → tenantApiKey object */
const tenantApiKeys = new Map();

/** @type {Map<string, Map<string, *>>} tenantId → Map(key → value) */
const tenantConfigs = new Map();

/** @type {Map<string, Map<string, boolean>>} tenantId → Map(flagName → enabled) */
const tenantFeatureFlags = new Map();

/** @type {Map<string, object>} tenantId → usage metrics */
const usageMetrics = new Map();

/** @type {Array<object>} append-only event log (also persisted to SQLite if available) */
const tenantEvents = [];

/** @type {Array<object>} append-only operational log */
const tenantLogs = [];

// ---------------------------------------------------------------------------
// Seed built-in plans / Planuri predefinite
// ---------------------------------------------------------------------------

const PLAN_SEED = [
  {
    id: 'plan_free',
    name: 'Free',
    price: 0,
    limits: {
      requests_per_month: 1000,
      tokens_per_month: 10000,
      storage_mb: 100,
      jobs: 5,
      modules: 3,
    },
    features: ['basic_api', 'dashboard', 'email_support'],
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    price: 49,
    limits: {
      requests_per_month: 50000,
      tokens_per_month: 500000,
      storage_mb: 10240,   // 10 GB
      jobs: 100,
      modules: 20,
    },
    features: [
      'basic_api', 'advanced_api', 'dashboard', 'analytics',
      'webhooks', 'custom_domains', 'priority_support',
      'email_support', 'sla_99_9',
    ],
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    price: -1,             // custom pricing / preț personalizat
    limits: {
      requests_per_month: -1,   // -1 = unlimited / nelimitat
      tokens_per_month: -1,
      storage_mb: 1048576,      // 1 TB
      jobs: -1,
      modules: -1,
    },
    features: [
      'basic_api', 'advanced_api', 'admin_api', 'dashboard', 'analytics',
      'webhooks', 'custom_domains', 'priority_support', 'email_support',
      'phone_support', 'sla_99_99', 'sso', 'audit_log', 'data_export',
      'dedicated_infrastructure', 'custom_modules', 'white_label',
    ],
  },
];

// Populate plans map / Populează harta de planuri
for (const plan of PLAN_SEED) {
  plans.set(plan.id, Object.freeze({ ...plan }));
}

// ---------------------------------------------------------------------------
// Internal helpers / Funcții interne de ajutor
// ---------------------------------------------------------------------------

/** Generate a cryptographically secure random API key string */
function _generateRawKey() {
  return 'uk_' + crypto.randomBytes(32).toString('hex');
}

/** SHA-256 hash of a raw key — stored in place of the raw key */
function _hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Derive a safe 8-char prefix from the raw key for display/lookup */
function _keyPrefix(rawKey) {
  // e.g. "uk_a1b2c3d4..."
  return rawKey.slice(0, 11);
}

/** Trial period in days / Durata perioadei de probă în zile */
const TRIAL_DAYS = 14;

/** Determine the initial tenant/subscription status based on planId */
function _determineInitialStatus(planId) {
  return planId === 'plan_free' ? 'trial' : 'active';
}

/** Build a slug from a name string */
function _slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Ensure slug uniqueness by appending counter if needed */
function _uniqueSlug(base) {
  let slug = base;
  let counter = 1;
  while ([...tenants.values()].some(t => t.slug === slug)) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

/** Initialize default usage metrics for a tenant */
function _defaultUsage() {
  return {
    requests: 0,
    tokens: 0,
    storage_mb: 0,
    jobs: 0,
    resetAt: _nextMonthReset(),
  };
}

/** ISO timestamp for first day of next month (UTC) */
function _nextMonthReset() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/** Map plan limit key to usage metric key */
const LIMIT_KEY_MAP = {
  requests: 'requests_per_month',
  tokens: 'tokens_per_month',
  storage_mb: 'storage_mb',
  jobs: 'jobs',
  modules: 'modules',
};

// ---------------------------------------------------------------------------
// Public API / API public
// ---------------------------------------------------------------------------

/**
 * createTenant — creates a new tenant with default subscription, configs, flags, usage
 * Creează un tenant nou cu abonament, configurații, flag-uri și metrici de utilizare implicite
 *
 * @param {object} data - { name, email, planId?, slug? }
 * @returns {object} created tenant
 */
function createTenant(data) {
  const { name, email, planId = 'plan_free', slug: slugHint } = data || {};
  if (!name) throw new Error('Tenant name is required / Numele tenantului este obligatoriu');
  if (!email) throw new Error('Tenant email is required / Email-ul tenantului este obligatoriu');
  if (!plans.has(planId)) throw new Error(`Plan not found: ${planId}`);

  const tenantId = crypto.randomUUID();
  const slug = _uniqueSlug(slugHint ? _slugify(slugHint) : _slugify(name));
  const now = new Date().toISOString();

  const initialStatus = _determineInitialStatus(planId);

  const tenant = {
    id: tenantId,
    slug,
    name,
    email,
    status: initialStatus,
    planId,
    createdAt: now,
    dataPrefix: `tenant_${slug}_`,
  };

  tenants.set(tenantId, tenant);

  // Create subscription / Creează abonamentul
  const subscriptionId = crypto.randomUUID();
  const trialEnd = initialStatus === 'trial'
    ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const subscription = {
    id: subscriptionId,
    tenantId,
    planId,
    status: initialStatus,
    startDate: now,
    endDate: null,
    trialEnd,
    billingCycle: 'monthly',
  };
  subscriptions.set(subscriptionId, subscription);

  // Default configs / Configurații implicite
  tenantConfigs.set(tenantId, new Map([
    ['locale', 'en'],
    ['timezone', 'UTC'],
    ['notifications_enabled', 'true'],
    ['api_rate_limit_override', ''],
  ]));

  // Default feature flags / Flag-uri de funcționalitate implicite
  const plan = plans.get(planId);
  const flags = new Map();
  for (const feature of plan.features) {
    flags.set(feature, true);
  }
  tenantFeatureFlags.set(tenantId, flags);

  // Initialize usage / Inițializează utilizarea
  usageMetrics.set(tenantId, _defaultUsage());

  // Log creation event / Înregistrează evenimentul de creare
  logEvent(tenantId, 'tenant.created', { slug, planId, email });

  return { ...tenant };
}

/**
 * getTenant — returns tenant enriched with plan and active subscription
 * Returnează tenantul îmbogățit cu planul și abonamentul activ
 */
function getTenant(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return null;
  const plan = plans.get(tenant.planId) || null;
  const subscription = [...subscriptions.values()].find(s => s.tenantId === tenantId) || null;
  return { ...tenant, plan, subscription };
}

/**
 * getTenantBySlug — lookup by URL-friendly slug
 * Caută tenant după slug
 */
function getTenantBySlug(slug) {
  const tenant = [...tenants.values()].find(t => t.slug === slug);
  if (!tenant) return null;
  return getTenant(tenant.id);
}

/**
 * getTenantByApiKey — validates raw API key, returns associated tenant
 * Validează cheia API brută și returnează tenantul asociat
 *
 * @param {string} rawKey
 * @returns {object|null} tenant or null
 */
function getTenantByApiKey(rawKey) {
  if (!rawKey) return null;
  const hash = _hashKey(rawKey);
  const apiKey = [...tenantApiKeys.values()].find(k => k.keyHash === hash && k.isActive);
  if (!apiKey) return null;

  // Update lastUsedAt / Actualizează ultima utilizare
  apiKey.lastUsedAt = new Date().toISOString();

  return getTenant(apiKey.tenantId);
}

/**
 * suspendTenant — suspends a tenant and their subscription
 * Suspendă un tenant și abonamentul său
 */
function suspendTenant(tenantId, reason = '') {
  const tenant = tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  tenant.status = 'suspended';
  const sub = [...subscriptions.values()].find(s => s.tenantId === tenantId);
  if (sub) sub.status = 'suspended';
  logEvent(tenantId, 'tenant.suspended', { reason });
  return { ...tenant };
}

/**
 * reactivateTenant — restores a suspended tenant to active
 * Reactivează un tenant suspendat
 */
function reactivateTenant(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  tenant.status = 'active';
  const sub = [...subscriptions.values()].find(s => s.tenantId === tenantId);
  if (sub) sub.status = 'active';
  logEvent(tenantId, 'tenant.reactivated', {});
  return { ...tenant };
}

/**
 * deleteTenant — cascading removal of all tenant data
 * Ștergere în cascadă a tuturor datelor unui tenant
 */
function deleteTenant(tenantId) {
  if (!tenants.has(tenantId)) throw new Error(`Tenant not found: ${tenantId}`);

  // Remove subscriptions / Elimină abonamentele
  for (const [id, sub] of subscriptions) {
    if (sub.tenantId === tenantId) subscriptions.delete(id);
  }

  // Remove invoices / Elimină facturile
  for (const [id, inv] of invoices) {
    if (inv.tenantId === tenantId) invoices.delete(id);
  }

  // Remove API keys / Elimină cheile API
  for (const [id, key] of tenantApiKeys) {
    if (key.tenantId === tenantId) tenantApiKeys.delete(id);
  }

  // Remove config, flags, usage / Elimină configurații, flag-uri, utilizare
  tenantConfigs.delete(tenantId);
  tenantFeatureFlags.delete(tenantId);
  usageMetrics.delete(tenantId);

  logEvent(tenantId, 'tenant.deleted', {});
  tenants.delete(tenantId);

  return { deleted: true, tenantId };
}

/**
 * generateApiKey — generates a new API key for a tenant
 * Generează o nouă cheie API pentru un tenant
 * Raw key is returned ONCE and never stored.
 * Cheia brută este returnată o singură dată și nu este stocată.
 *
 * @param {string} tenantId
 * @param {string} name - human-readable label for this key
 * @param {string[]} permissions - array of permission strings e.g. ['read', 'write']
 * @returns {{ id, key, keyPrefix }}
 */
function generateApiKey(tenantId, name = 'default', permissions = ['read']) {
  if (!tenants.has(tenantId)) throw new Error(`Tenant not found: ${tenantId}`);
  if (!Array.isArray(permissions)) {
    throw new TypeError('permissions must be an array of strings, e.g. ["read", "write"]');
  }
  const rawKey = _generateRawKey();
  const keyId = crypto.randomUUID();
  const now = new Date().toISOString();

  tenantApiKeys.set(keyId, {
    id: keyId,
    tenantId,
    keyHash: _hashKey(rawKey),
    keyPrefix: _keyPrefix(rawKey),
    name,
    permissions: [...permissions],
    createdAt: now,
    lastUsedAt: null,
    isActive: true,
  });

  logEvent(tenantId, 'apikey.created', { keyId, name, keyPrefix: _keyPrefix(rawKey) });

  return { id: keyId, key: rawKey, keyPrefix: _keyPrefix(rawKey) };
}

/**
 * revokeApiKey — deactivates an API key
 * Dezactivează o cheie API
 */
function revokeApiKey(tenantId, keyId) {
  const apiKey = tenantApiKeys.get(keyId);
  if (!apiKey || apiKey.tenantId !== tenantId) {
    throw new Error('API key not found or does not belong to this tenant');
  }
  apiKey.isActive = false;
  logEvent(tenantId, 'apikey.revoked', { keyId });
  return { revoked: true, keyId };
}

/**
 * getTenantContext — full context snapshot used by middleware / TCL
 * Snapshot complet de context folosit de middleware
 *
 * @returns {{ tenant, plan, subscription, configs, featureFlags, usage }}
 */
function getTenantContext(tenantId) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return null;
  const plan = plans.get(tenant.planId) || null;
  const subscription = [...subscriptions.values()].find(s => s.tenantId === tenantId) || null;
  const configsMap = tenantConfigs.get(tenantId) || new Map();
  const configs = Object.fromEntries(configsMap);
  const flagsMap = tenantFeatureFlags.get(tenantId) || new Map();
  const featureFlags = Object.fromEntries(flagsMap);
  const usage = usageMetrics.get(tenantId) || _defaultUsage();
  return { tenant: { ...tenant }, plan, subscription, configs, featureFlags, usage: { ...usage } };
}

/**
 * hasFeature — check whether a tenant's plan includes a named feature
 * Verifică dacă planul tenantului include o funcționalitate dată
 */
function hasFeature(tenantId, featureName) {
  const flags = tenantFeatureFlags.get(tenantId);
  if (!flags) return false;
  return flags.get(featureName) === true;
}

/**
 * checkLimit — compare current usage against plan limit
 * Compară utilizarea curentă cu limita planului
 *
 * @returns {{ allowed: boolean, current: number, limit: number }}
 */
function checkLimit(tenantId, metric) {
  const tenant = tenants.get(tenantId);
  if (!tenant) return { allowed: false, current: 0, limit: 0 };
  const plan = plans.get(tenant.planId);
  if (!plan) return { allowed: false, current: 0, limit: 0 };

  const limitKey = LIMIT_KEY_MAP[metric] || metric;
  const limit = plan.limits[limitKey] ?? 0;
  const usage = usageMetrics.get(tenantId) || _defaultUsage();
  const current = usage[metric] ?? 0;

  // -1 means unlimited / -1 înseamnă nelimitat
  const allowed = limit === -1 || current < limit;
  return { allowed, current, limit };
}

/**
 * incrementUsage — increments a usage counter and returns updated check result
 * Incrementează un contor de utilizare și returnează rezultatul verificării
 */
function incrementUsage(tenantId, metric, amount = 1) {
  if (!tenants.has(tenantId)) throw new Error(`Tenant not found: ${tenantId}`);
  let usage = usageMetrics.get(tenantId);
  if (!usage) {
    usage = _defaultUsage();
    usageMetrics.set(tenantId, usage);
  }

  // Auto-reset if past the reset date / Reset automat dacă a expirat perioada
  if (usage.resetAt && new Date() >= new Date(usage.resetAt)) {
    resetUsage(tenantId);
    usage = usageMetrics.get(tenantId);
  }

  usage[metric] = (usage[metric] || 0) + amount;
  return checkLimit(tenantId, metric);
}

/**
 * resetUsage — resets all monthly counters for a tenant
 * Resetează toți contoarele lunare pentru un tenant
 */
function resetUsage(tenantId) {
  const fresh = _defaultUsage();
  usageMetrics.set(tenantId, fresh);
  return { ...fresh };
}

/**
 * getUsage — returns current usage object for a tenant
 * Returnează obiectul de utilizare curent al unui tenant
 */
function getUsage(tenantId) {
  return { ...(usageMetrics.get(tenantId) || _defaultUsage()) };
}

/**
 * setConfig — set a config key for a tenant
 * Setează o cheie de configurare pentru un tenant
 */
function setConfig(tenantId, key, value) {
  if (!tenants.has(tenantId)) throw new Error(`Tenant not found: ${tenantId}`);
  if (!tenantConfigs.has(tenantId)) tenantConfigs.set(tenantId, new Map());
  tenantConfigs.get(tenantId).set(key, value);
}

/**
 * getConfig — get a config value for a tenant
 * Obține o valoare de configurare pentru un tenant
 */
function getConfig(tenantId, key) {
  const configs = tenantConfigs.get(tenantId);
  if (!configs) return undefined;
  return configs.get(key);
}

/**
 * setFeatureFlag — enable or disable a feature flag for a tenant
 * Activează sau dezactivează un flag de funcționalitate pentru un tenant
 */
function setFeatureFlag(tenantId, flag, enabled) {
  if (!tenants.has(tenantId)) throw new Error(`Tenant not found: ${tenantId}`);
  if (!tenantFeatureFlags.has(tenantId)) tenantFeatureFlags.set(tenantId, new Map());
  tenantFeatureFlags.get(tenantId).set(flag, Boolean(enabled));
}

/**
 * logEvent — records a domain event for a tenant (in-memory + optional SQLite)
 * Înregistrează un eveniment de domeniu pentru un tenant
 */
function logEvent(tenantId, type, payload = {}) {
  const event = {
    id: crypto.randomUUID(),
    tenantId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  tenantEvents.push(event);

  const stmt = _getStmtInsertEvent();
  if (stmt) {
    try {
      stmt.run(event.id, event.tenantId, event.type, JSON.stringify(event.payload), event.createdAt);
    } catch (err) {
      console.error('[tenant-engine] Failed to persist event:', err.message);
    }
  }

  return event;
}

/**
 * logTenantLog — records an operational log entry for a tenant
 * Înregistrează o intrare de jurnal operațional pentru un tenant
 */
function logTenantLog(tenantId, level, message, metadata = {}) {
  const entry = {
    id: crypto.randomUUID(),
    tenantId,
    level,
    message,
    metadata,
    createdAt: new Date().toISOString(),
  };
  tenantLogs.push(entry);

  const stmt = _getStmtInsertLog();
  if (stmt) {
    try {
      stmt.run(entry.id, entry.tenantId, entry.level, entry.message, JSON.stringify(entry.metadata), entry.createdAt);
    } catch (err) {
      console.error('[tenant-engine] Failed to persist log entry:', err.message);
    }
  }

  return entry;
}

/**
 * getAllTenants — returns a shallow copy array of all tenant records
 * Returnează o copie a tuturor înregistrărilor de tenant
 */
function getAllTenants() {
  return [...tenants.values()].map(t => ({ ...t }));
}

/**
 * getStats — global admin stats across all tenants
 * Statistici globale pentru panoul de administrare
 */
function getStats() {
  const allTenants = [...tenants.values()];
  const allSubs = [...subscriptions.values()];
  const allKeys = [...tenantApiKeys.values()];

  const byStatus = {};
  for (const t of allTenants) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  const byPlan = {};
  for (const t of allTenants) {
    byPlan[t.planId] = (byPlan[t.planId] || 0) + 1;
  }

  let totalRequests = 0;
  let totalTokens = 0;
  for (const u of usageMetrics.values()) {
    totalRequests += u.requests || 0;
    totalTokens += u.tokens || 0;
  }

  return {
    tenants: {
      total: allTenants.length,
      byStatus,
      byPlan,
    },
    subscriptions: {
      total: allSubs.length,
      active: allSubs.filter(s => s.status === 'active').length,
      trial: allSubs.filter(s => s.status === 'trial').length,
      suspended: allSubs.filter(s => s.status === 'suspended').length,
    },
    apiKeys: {
      total: allKeys.length,
      active: allKeys.filter(k => k.isActive).length,
    },
    invoices: {
      total: invoices.size,
      paid: [...invoices.values()].filter(i => i.status === 'paid').length,
      pending: [...invoices.values()].filter(i => i.status === 'pending').length,
    },
    usage: {
      totalRequests,
      totalTokens,
    },
    events: {
      total: tenantEvents.length,
    },
    plans: [...plans.values()].map(p => ({ id: p.id, name: p.name, tenants: byPlan[p.id] || 0 })),
  };
}

// ---------------------------------------------------------------------------
// Singleton export / Export singleton
// ---------------------------------------------------------------------------

module.exports = {
  // Data stores (read-only references — do not mutate directly)
  // Referințe la stocurile de date (nu modificați direct)
  tenants,
  plans,
  subscriptions,
  invoices,
  tenantApiKeys,
  tenantConfigs,
  tenantFeatureFlags,
  usageMetrics,
  tenantEvents,
  tenantLogs,

  // Tenant lifecycle / Ciclu de viață tenant
  createTenant,
  getTenant,
  getTenantBySlug,
  getTenantByApiKey,
  suspendTenant,
  reactivateTenant,
  deleteTenant,

  // API keys / Chei API
  generateApiKey,
  revokeApiKey,

  // Context / Contexte
  getTenantContext,

  // Features & limits / Funcționalități și limite
  hasFeature,
  checkLimit,
  incrementUsage,
  resetUsage,
  getUsage,

  // Config / Configurare
  setConfig,
  getConfig,

  // Feature flags / Flag-uri
  setFeatureFlag,

  // Observability / Observabilitate
  logEvent,
  logTenantLog,

  // Admin / Administrare
  getAllTenants,
  getStats,
};
