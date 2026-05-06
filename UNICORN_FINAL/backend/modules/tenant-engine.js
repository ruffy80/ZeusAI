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
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * tenant-engine.js — Full Multi-Tenant Global SaaS Platform Engine
 *
 * Provides:
 *  - Tenant CRUD management (create, update, suspend, delete)
 *  - Strict tenant isolation at data, config, and runtime level
 *  - Per-tenant environments (configs, API keys, limits, features)
 *  - Global API gateway middleware with tenant-aware routing and auth
 *  - Billing and subscription engine (plans, usage, limits, invoices)
 *  - Onboarding and provisioning flows for new tenants
 *  - Per-tenant analytics, KPIs, and admin views
 *  - Global scaling and failover logic (multi-region ready)
 *  - AI orchestration per-tenant and globally
 *  - Self-healing and zero manual intervention
 *  - Backward compatibility with single-tenant Unicorn behavior
 */

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
function _slugifyV1(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Ensure slug uniqueness by appending counter if needed */
function _uniqueSlugV1(base) {
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
function createTenantV1(data) {
  if (!name) throw new Error('Tenant name is required / Numele tenantului este obligatoriu');
  if (!email) throw new Error('Tenant email is required / Email-ul tenantului este obligatoriu');
  if (!plans.has(planId)) throw new Error(`Plan not found: ${planId}`);

  const tenantId = crypto.randomUUID();
  const slug = _uniqueSlugV1(slugHint ? _slugifyV1(slugHint) : _slugifyV1(name));
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

const EventEmitter = require('events');

// ==================== CONSTANTS ====================

const TENANT_STATUS = {
  PROVISIONING: 'provisioning',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
  TRIAL: 'trial',
};

// Named limits / thresholds (extracted from magic numbers for maintainability)
const MAX_SLUG_LENGTH             = 63;
const MAX_TENANT_NAME_LENGTH      = 128;
const MAX_API_KEY_NAME_LENGTH     = 64;
const MAX_ANALYTICS_EVENTS        = 1000;
const MAX_AUDIT_LOG_ENTRIES       = 5000;
const UNLIMITED_USERS_FALLBACK    = 9999;
const HEALTH_CHECK_INTERVAL_MS    = 60_000;
const OVERAGE_PRICE_PER_1000_CALLS = 0.5; // USD per 1,000 API calls over plan limit

const PROVISION_STEPS = [
  'create_record',
  'assign_plan',
  'generate_api_key',
  'configure_limits',
  'configure_features',
  'seed_analytics',
  'ai_profile',
  'finalize',
];

const SAAS_PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    trialDays: 0,
    limits: {
      apiCallsPerMonth: 500,
      seats: 1,
      aiCallsPerMonth: 50,
      storageGB: 1,
      customDomains: 0,
      modules: ['compliance', 'risk'],
      regionsMax: 1,
    },
    features: {
      whiteLabelBranding: false,
      customApiKeys: false,
      sso: false,
      auditLog: false,
      dedicatedSupport: false,
      sla: '99.0%',
      analytics: 'basic',
      ai: 'shared',
      multiRegion: false,
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceYearly: 290,
    currency: 'USD',
    trialDays: 14,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TENANT_STARTER_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_TENANT_STARTER_YEARLY || '',
    limits: {
      apiCallsPerMonth: 15000,
      seats: 5,
      aiCallsPerMonth: 1000,
      storageGB: 10,
      customDomains: 1,
      modules: 'all',
      regionsMax: 1,
    },
    features: {
      whiteLabelBranding: true,
      customApiKeys: true,
      sso: false,
      auditLog: true,
      dedicatedSupport: false,
      sla: '99.5%',
      analytics: 'standard',
      ai: 'shared',
      multiRegion: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    priceYearly: 990,
    currency: 'USD',
    trialDays: 14,
    popular: true,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TENANT_PRO_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_TENANT_PRO_YEARLY || '',
    limits: {
      apiCallsPerMonth: 150000,
      seats: 25,
      aiCallsPerMonth: 10000,
      storageGB: 100,
      customDomains: 5,
      modules: 'all',
      regionsMax: 3,
    },
    features: {
      whiteLabelBranding: true,
      customApiKeys: true,
      sso: true,
      auditLog: true,
      dedicatedSupport: false,
      sla: '99.9%',
      analytics: 'advanced',
      ai: 'dedicated',
      multiRegion: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4990,
    currency: 'USD',
    trialDays: 30,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TENANT_ENT_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_TENANT_ENT_YEARLY || '',
    limits: {
      apiCallsPerMonth: 2000000,
      seats: 200,
      aiCallsPerMonth: 100000,
      storageGB: 1000,
      customDomains: 50,
      modules: 'all',
      regionsMax: 10,
    },
    features: {
      whiteLabelBranding: true,
      customApiKeys: true,
      sso: true,
      auditLog: true,
      dedicatedSupport: true,
      sla: '99.99%',
      analytics: 'enterprise',
      ai: 'dedicated',
      multiRegion: true,
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    priceMonthly: 1999,
    priceYearly: 19990,
    currency: 'USD',
    trialDays: 30,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TENANT_UNL_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_TENANT_UNL_YEARLY || '',
    limits: {
      apiCallsPerMonth: Infinity,
      seats: Infinity,
      aiCallsPerMonth: Infinity,
      storageGB: Infinity,
      customDomains: Infinity,
      modules: 'all',
      regionsMax: Infinity,
    },
    features: {
      whiteLabelBranding: true,
      customApiKeys: true,
      sso: true,
      auditLog: true,
      dedicatedSupport: true,
      sla: '99.999%',
      analytics: 'enterprise',
      ai: 'dedicated',
      multiRegion: true,
    },
  },
];

const PLAN_HIERARCHY = ['free', 'starter', 'pro', 'enterprise', 'unlimited'];

// ==================== IN-MEMORY STORES ====================
// All stores use Maps keyed by tenantId for O(1) isolation.

/** @type {Map<string, Object>} tenantId → tenant record */
const _tenants = new Map();

/** @type {Map<string, Object>} tenantId → { apiCalls, aiCalls, lastReset, ... } usage */
const _tenantUsage = new Map();

/** @type {Map<string, Array>} tenantId → invoice[] */
const _tenantInvoices = new Map();

/** @type {Map<string, Object>} tenantId → analytics/KPI data */
const _tenantAnalytics = new Map();

/** @type {Map<string, Object>} tenantId → provisioning state */
const _tenantProvisioning = new Map();

/** @type {Map<string, Array>} tenantId → audit log entries */
const _tenantAuditLogs = new Map();

/** @type {Map<string, Object>} tenantId → per-tenant AI config */
const _tenantAIConfig = new Map();

/** @type {Map<string, Array>} tenantId → API key records */
const _tenantApiKeys = new Map();

/** Subdomain → tenantId for fast gateway routing */
const _subdomainIndex = new Map();

/** Slug → tenantId for fast lookup */
const _slugIndex = new Map();

// Default (single-tenant / legacy) tenant always exists
const DEFAULT_TENANT_ID = 'default';

// ==================== EMITTER (for self-healing hooks) ====================
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// ==================== HELPERS ====================

function _generateId(prefix = 'tn') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function _generateApiKey(tenantId) {
  const raw = `${tenantId}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  return `uk_live_${Buffer.from(raw).toString('base64url').slice(0, 48)}`;
}

function _now() {
  return new Date().toISOString();
}

function _monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, MAX_SLUG_LENGTH);
}

function _getPlan(planId) {
  return SAAS_PLANS.find(p => p.id === planId) || SAAS_PLANS[0];
}

function _planRank(planId) {
  return PLAN_HIERARCHY.indexOf(planId);
}

// ==================== DEFAULT TENANT BOOTSTRAP ====================

function _ensureDefaultTenant() {
  if (!_tenants.has(DEFAULT_TENANT_ID)) {
    const t = {
      id: DEFAULT_TENANT_ID,
      name: 'Default (Single-Tenant)',
      slug: 'default',
      status: TENANT_STATUS.ACTIVE,
      planId: 'enterprise',
      ownerId: 'admin',
      config: {
        timezone: 'UTC',
        locale: 'en',
        customDomain: process.env.PUBLIC_APP_URL || '',
        theme: 'default',
        maxUsers: 200,
      },
      features: { ..._getPlan('enterprise').features },
      limits: { ..._getPlan('enterprise').limits },
      billing: {
        interval: 'monthly',
        currentPeriodStart: _now(),
        currentPeriodEnd: null,
        status: 'active',
        trialEndsAt: null,
      },
      regions: ['primary'],
      provisionedAt: _now(),
      createdAt: _now(),
      updatedAt: _now(),
      metadata: { legacy: true },
    };
    _tenants.set(DEFAULT_TENANT_ID, t);
    _slugIndex.set('default', DEFAULT_TENANT_ID);
    _tenantUsage.set(DEFAULT_TENANT_ID, _freshUsage());
    _tenantAnalytics.set(DEFAULT_TENANT_ID, _freshAnalytics());
    _tenantInvoices.set(DEFAULT_TENANT_ID, []);
    _tenantAuditLogs.set(DEFAULT_TENANT_ID, []);
    _tenantAIConfig.set(DEFAULT_TENANT_ID, _defaultAIConfig(DEFAULT_TENANT_ID));
    _tenantApiKeys.set(DEFAULT_TENANT_ID, []);
  }
}

function _freshUsage() {
  return {
    apiCalls: 0,
    aiCalls: 0,
    storageGB: 0,
    month: _monthKey(),
    perEndpoint: {},
    lastActivityAt: null,
  };
}

function _freshAnalytics() {
  return {
    totalApiCalls: 0,
    totalAiCalls: 0,
    totalUsers: 0,
    errorRate: 0,
    avgResponseMs: 0,
    p99ResponseMs: 0,
    uptime: 100,
    lastHealthCheck: _now(),
    kpis: {
      dau: 0,
      mau: 0,
      retention30d: 0,
      errorCount24h: 0,
      aiSuccessRate: 100,
    },
    events: [],
  };
}

function _defaultAIConfig(tenantId) {
  return {
    tenantId,
    provider: 'auto',
    preferredProviders: [],
    customApiKeys: {},
    maxTokensPerRequest: 4096,
    maxRequestsPerMinute: 60,
    fallbackEnabled: true,
    cacheEnabled: true,
    contextWindow: 8192,
  };
}

// ==================== TENANT CRUD ====================

/**
 * Create a new tenant.
 * @param {Object} opts
 * @returns {Object} tenant record
 */
function createTenant(opts = {}) {
  const { name, ownerId, planId = 'free', config = {}, metadata = {} } = opts;
  if (!name || !name.trim()) throw new Error('Tenant name is required');
  if (!ownerId) throw new Error('ownerId is required');

  const id = _generateId('tn');
  const slug = _uniqueSlug(_slugify(name));
  const plan = _getPlan(planId);

  const tenant = {
    id,
    name: name.trim().slice(0, MAX_TENANT_NAME_LENGTH),
    slug,
    status: TENANT_STATUS.PROVISIONING,
    planId,
    ownerId,
    config: {
      timezone: 'UTC',
      locale: 'en',
      customDomain: '',
      theme: 'default',
      maxUsers: plan.limits.seats === Infinity ? UNLIMITED_USERS_FALLBACK : plan.limits.seats,
      ...config,
    },
    features: { ...plan.features },
    limits: { ...plan.limits },
    billing: {
      interval: opts.billingInterval || 'monthly',
      currentPeriodStart: _now(),
      currentPeriodEnd: null,
      status: plan.trialDays > 0 ? 'trial' : 'active',
      trialEndsAt: plan.trialDays > 0
        ? new Date(Date.now() + plan.trialDays * 86400000).toISOString()
        : null,
      subscriptionId: null,
      customerId: null,
      invoiceCount: 0,
    },
    regions: ['primary'],
    provisionedAt: null,
    createdAt: _now(),
    updatedAt: _now(),
    metadata,
  };

  _tenants.set(id, tenant);
  _slugIndex.set(slug, id);
  _tenantUsage.set(id, _freshUsage());
  _tenantAnalytics.set(id, _freshAnalytics());
  _tenantInvoices.set(id, []);
  _tenantAuditLogs.set(id, []);
  _tenantAIConfig.set(id, _defaultAIConfig(id));
  _tenantApiKeys.set(id, []);

  _auditLog(id, 'tenant.created', { planId, ownerId }, 'system');
  emitter.emit('tenant.created', { tenantId: id, tenant });

  // Async provision
  _runProvisioningFlow(id).catch(err =>
    console.error(`[TenantEngine] Provisioning failed for ${id}:`, err.message)
  );

  return { ...tenant };
}

/**
 * Update tenant name, config, or plan.
 */
function updateTenant(tenantId, updates = {}, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  const allowed = ['name', 'config', 'metadata', 'regions'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'config') {
        tenant.config = { ...tenant.config, ...updates.config };
      } else {
        tenant[key] = updates[key];
      }
    }
  }
  if (updates.planId && updates.planId !== tenant.planId) {
    _changePlan(tenant, updates.planId, actorId);
  }
  if (updates.config && updates.config.customDomain) {
    _subdomainIndex.set(updates.config.customDomain, tenantId);
  }
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.updated', updates, actorId);
  emitter.emit('tenant.updated', { tenantId, updates });
  return { ...tenant };
}

/**
 * getTenant — returns tenant enriched with plan and active subscription
 * Returnează tenantul îmbogățit cu planul și abonamentul activ
 */
function getTenantV1(tenantId) {
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
function getTenantBySlugV1(slug) {
  const tenant = [...tenants.values()].find(t => t.slug === slug);
  if (!tenant) return null;
  return getTenantV1(tenant.id);
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
function suspendTenantV1(tenantId, reason = '') {
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
function deleteTenantV1(tenantId) {

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
  if (typeof _tenants !== 'undefined') {
    return [..._tenants.values()].filter(t => t.status !== TENANT_STATUS.DELETED).map(t => ({ ...t }));
  }
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

/**
 * Suspend tenant — blocks all API requests for this tenant.
 */
function suspendTenant(tenantId, reason = 'admin_action', actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  if (tenant.id === DEFAULT_TENANT_ID) throw new Error('Cannot suspend default tenant');
  tenant.status = TENANT_STATUS.SUSPENDED;
  tenant.suspendedAt = _now();
  tenant.suspendReason = reason;
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.suspended', { reason }, actorId);
  emitter.emit('tenant.suspended', { tenantId, reason });
  return { ...tenant };
}

/**
 * Activate (unsuspend) a tenant.
 */
function activateTenant(tenantId, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  tenant.status = TENANT_STATUS.ACTIVE;
  tenant.suspendedAt = null;
  tenant.suspendReason = null;
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.activated', {}, actorId);
  emitter.emit('tenant.activated', { tenantId });
  return { ...tenant };
}

/**
 * Soft-delete a tenant. Data is retained but status = deleted.
 */
function deleteTenant(tenantId, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  if (tenant.id === DEFAULT_TENANT_ID) throw new Error('Cannot delete default tenant');
  tenant.status = TENANT_STATUS.DELETED;
  tenant.deletedAt = _now();
  tenant.updatedAt = _now();
  _slugIndex.delete(tenant.slug);
  if (tenant.config.customDomain) _subdomainIndex.delete(tenant.config.customDomain);
  _auditLog(tenantId, 'tenant.deleted', {}, actorId);
  emitter.emit('tenant.deleted', { tenantId });
  return { ok: true };
}

function getTenant(tenantId) {
  const t = _tenants.get(tenantId);
  if (!t || t.status === TENANT_STATUS.DELETED) return null;
  return { ...t };
}

function getTenantBySlug(slug) {
  const id = _slugIndex.get(slug);
  return id ? getTenant(id) : null;
}

function getTenantByDomain(domain) {
  const id = _subdomainIndex.get(domain);
  return id ? getTenant(id) : null;
}

function listTenants({ page = 1, limit = 50, status, planId, search } = {}) {
  let items = [..._tenants.values()].filter(t => t.status !== TENANT_STATUS.DELETED);
  if (status) items = items.filter(t => t.status === status);
  if (planId) items = items.filter(t => t.planId === planId);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.slug.includes(q) ||
      (t.config.customDomain || '').includes(q)
    );
  }
  items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  const total = items.length;
  const offset = (page - 1) * limit;
  return { tenants: items.slice(offset, offset + limit).map(t => ({ ...t })), total, page, limit };
}

// ==================== PLAN MANAGEMENT ====================

function changePlan(tenantId, newPlanId, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  _changePlan(tenant, newPlanId, actorId);
  return { ...tenant };
}

function _changePlan(tenant, newPlanId, actorId) {
  const plan = _getPlan(newPlanId);
  const oldPlanId = tenant.planId;
  tenant.planId = newPlanId;
  tenant.features = { ...plan.features };
  tenant.limits = { ...plan.limits };
  tenant.config.maxUsers = plan.limits.seats === Infinity ? UNLIMITED_USERS_FALLBACK : plan.limits.seats;
  tenant.billing.status = plan.trialDays > 0 && oldPlanId === 'free' ? 'trial' : 'active';
  tenant.billing.trialEndsAt = plan.trialDays > 0 && oldPlanId === 'free'
    ? new Date(Date.now() + plan.trialDays * 86400000).toISOString()
    : tenant.billing.trialEndsAt;
  tenant.updatedAt = _now();
  _auditLog(tenant.id, 'tenant.plan_changed', { from: oldPlanId, to: newPlanId }, actorId);
  emitter.emit('tenant.plan_changed', { tenantId: tenant.id, oldPlanId, newPlanId });
}

function getSaasPlans() {
  return SAAS_PLANS.map(p => ({
    ...p,
    stripePriceIdMonthly: undefined,
    stripePriceIdYearly: undefined,
  }));
}

// ==================== PER-TENANT CONFIGURATION ====================

function getTenantConfig(tenantId) {
  const tenant = _requireTenant(tenantId);
  return { ...tenant.config };
}

function setTenantConfig(tenantId, patch = {}, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  const ALLOWED_CONFIG_KEYS = [
    'timezone', 'locale', 'customDomain', 'theme', 'maxUsers',
    'webhookUrl', 'webhookSecret', 'emailSender', 'logoUrl',
    'primaryColor', 'supportEmail', 'allowedIPs',
  ];
  for (const k of ALLOWED_CONFIG_KEYS) {
    if (patch[k] !== undefined) tenant.config[k] = patch[k];
  }
  if (patch.customDomain) {
    _subdomainIndex.set(patch.customDomain, tenantId);
  }
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.config_updated', { keys: Object.keys(patch) }, actorId);
  return { ...tenant.config };
}

// ==================== PER-TENANT FEATURE FLAGS ====================

function getTenantFeatures(tenantId) {
  const tenant = _requireTenant(tenantId);
  return { ...tenant.features };
}

function setTenantFeature(tenantId, featureKey, value, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  tenant.features[featureKey] = value;
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.feature_set', { featureKey, value }, actorId);
  return { ...tenant.features };
}

// ==================== PER-TENANT API KEYS ====================

function createTenantApiKey(tenantId, { name = 'Default Key', scopes = ['read', 'write'] } = {}, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  const plan = _getPlan(tenant.planId);
  if (!plan.features.customApiKeys && tenantId !== DEFAULT_TENANT_ID) {
    throw new Error('Custom API keys require Starter plan or higher');
  }
  const keys = _tenantApiKeys.get(tenantId) || [];
  const key = {
    id: _generateId('key'),
    tenantId,
    name: name.slice(0, MAX_API_KEY_NAME_LENGTH),
    key: _generateApiKey(tenantId),
    scopes,
    createdAt: _now(),
    lastUsedAt: null,
    callCount: 0,
    active: true,
  };
  keys.push(key);
  _tenantApiKeys.set(tenantId, keys);
  _auditLog(tenantId, 'apikey.created', { name, scopes }, actorId);
  return { ...key };
}

function listTenantApiKeys(tenantId) {
  _requireTenant(tenantId);
  const keys = _tenantApiKeys.get(tenantId) || [];
  return keys.filter(k => k.active).map(k => ({
    id: k.id,
    name: k.name,
    keyPreview: k.key.slice(0, 12) + '…',
    scopes: k.scopes,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    callCount: k.callCount,
  }));
}

function revokeTenantApiKey(tenantId, keyId, actorId = 'system') {
  _requireTenant(tenantId);
  const keys = _tenantApiKeys.get(tenantId) || [];
  const key = keys.find(k => k.id === keyId);
  if (!key) throw new Error('API key not found');
  key.active = false;
  _auditLog(tenantId, 'apikey.revoked', { keyId }, actorId);
  return { ok: true };
}

function resolveTenantByApiKey(rawKey) {
  for (const [tenantId, keys] of _tenantApiKeys) {
    const match = keys.find(k => k.active && k.key === rawKey);
    if (match) {
      match.lastUsedAt = _now();
      match.callCount++;
      return { tenantId, key: match };
    }
  }
  return null;
}

// ==================== USAGE TRACKING ====================

function _getUsage(tenantId) {
  let usage = _tenantUsage.get(tenantId);
  if (!usage) {
    usage = _freshUsage();
    _tenantUsage.set(tenantId, usage);
  }
  // Reset monthly counter if month has changed
  const current = _monthKey();
  if (usage.month !== current) {
    const prev = { ...usage };
    usage.apiCalls = 0;
    usage.aiCalls = 0;
    usage.month = current;
    usage.perEndpoint = {};
    emitter.emit('tenant.usage_reset', { tenantId, previousMonth: prev });
  }
  return usage;
}

function recordApiCall(tenantId, endpoint = '') {
  const usage = _getUsage(tenantId);
  usage.apiCalls++;
  usage.lastActivityAt = _now();
  if (endpoint) {
    usage.perEndpoint[endpoint] = (usage.perEndpoint[endpoint] || 0) + 1;
  }
  const analytics = _tenantAnalytics.get(tenantId);
  if (analytics) analytics.totalApiCalls++;
}

function recordAiCall(tenantId) {
  const usage = _getUsage(tenantId);
  usage.aiCalls++;
  const analytics = _tenantAnalytics.get(tenantId);
  if (analytics) analytics.totalAiCalls++;
}

function checkRateLimit(tenantId, type = 'api') {
  const tenant = _tenants.get(tenantId);
  if (!tenant) return { allowed: true };
  const usage = _getUsage(tenantId);
  const plan = _getPlan(tenant.planId);
  if (type === 'ai') {
    const limit = plan.limits.aiCallsPerMonth;
    if (limit === Infinity) return { allowed: true };
    if (usage.aiCalls >= limit) {
      return { allowed: false, reason: 'AI call limit reached for this billing period', limit, used: usage.aiCalls };
    }
  } else {
    const limit = plan.limits.apiCallsPerMonth;
    if (limit === Infinity) return { allowed: true };
    if (usage.apiCalls >= limit) {
      return { allowed: false, reason: 'API call limit reached for this billing period', limit, used: usage.apiCalls };
    }
  }
  return { allowed: true };
}

function getTenantUsage(tenantId) {
  _requireTenant(tenantId);
  const usage = _getUsage(tenantId);
  const tenant = _tenants.get(tenantId);
  const plan = _getPlan(tenant.planId);
  return {
    ...usage,
    limits: plan.limits,
    percentUsed: {
      api: plan.limits.apiCallsPerMonth === Infinity ? 0
        : Math.round((usage.apiCalls / plan.limits.apiCallsPerMonth) * 100),
      ai: plan.limits.aiCallsPerMonth === Infinity ? 0
        : Math.round((usage.aiCalls / plan.limits.aiCallsPerMonth) * 100),
    },
  };
}

// ==================== BILLING & INVOICES ====================

function generateInvoice(tenantId) {
  const tenant = _requireTenant(tenantId);
  const plan = _getPlan(tenant.planId);
  const usage = _getUsage(tenantId);
  const now = new Date();
  const invoice = {
    id: _generateId('inv'),
    tenantId,
    tenantName: tenant.name,
    planId: tenant.planId,
    planName: plan.name,
    month: _monthKey(),
    generatedAt: _now(),
    dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString(),
    status: 'open',
    lineItems: [
      {
        description: `${plan.name} Plan — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        quantity: 1,
        unitPrice: plan.priceMonthly,
        total: plan.priceMonthly,
      },
    ],
    subtotal: plan.priceMonthly,
    tax: 0,
    total: plan.priceMonthly,
    currency: plan.currency,
    usage: {
      apiCalls: usage.apiCalls,
      aiCalls: usage.aiCalls,
    },
  };

  // Usage overages (overage pricing for exceeding limits)
  if (plan.limits.apiCallsPerMonth !== Infinity && usage.apiCalls > plan.limits.apiCallsPerMonth) {
    const overage = usage.apiCalls - plan.limits.apiCallsPerMonth;
    const overageCharge = Math.ceil(overage / 1000) * OVERAGE_PRICE_PER_1000_CALLS;
    invoice.lineItems.push({
      description: `API Overage — ${overage.toLocaleString()} extra calls`,
      quantity: Math.ceil(overage / 1000),
      unitPrice: OVERAGE_PRICE_PER_1000_CALLS,
      total: overageCharge,
    });
    invoice.subtotal += overageCharge;
    invoice.total += overageCharge;
  }

  const invoices = _tenantInvoices.get(tenantId) || [];
  invoices.push(invoice);
  _tenantInvoices.set(tenantId, invoices);
  tenant.billing.invoiceCount = invoices.length;
  _auditLog(tenantId, 'invoice.generated', { invoiceId: invoice.id, total: invoice.total }, 'system');
  emitter.emit('tenant.invoice_generated', { tenantId, invoice });
  return { ...invoice };
}

function listTenantInvoices(tenantId) {
  _requireTenant(tenantId);
  const invoices = _tenantInvoices.get(tenantId) || [];
  return [...invoices].reverse();
}

function getTenantBillingStatus(tenantId) {
  const tenant = _requireTenant(tenantId);
  const plan = _getPlan(tenant.planId);
  const usage = _getUsage(tenantId);
  const invoices = _tenantInvoices.get(tenantId) || [];
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  return {
    tenantId,
    planId: tenant.planId,
    planName: plan.name,
    billingStatus: tenant.billing.status,
    trialEndsAt: tenant.billing.trialEndsAt,
    currentPeriodStart: tenant.billing.currentPeriodStart,
    invoiceCount: invoices.length,
    overdueCount: overdueInvoices.length,
    totalOwed: overdueInvoices.reduce((s, i) => s + (i.total || 0), 0),
    usage: {
      apiCalls: usage.apiCalls,
      aiCalls: usage.aiCalls,
      apiLimit: plan.limits.apiCallsPerMonth,
      aiLimit: plan.limits.aiCallsPerMonth,
    },
  };
}

function subscribeTenant(tenantId, { planId, interval = 'monthly', subscriptionId, customerId } = {}, actorId = 'system') {
  const tenant = _requireTenant(tenantId);
  _changePlan(tenant, planId, actorId);
  tenant.billing.interval = interval;
  tenant.billing.subscriptionId = subscriptionId || null;
  tenant.billing.customerId = customerId || null;
  tenant.billing.status = 'active';
  tenant.billing.currentPeriodStart = _now();
  _auditLog(tenantId, 'tenant.subscribed', { planId, interval }, actorId);
  return { ...tenant };
}

// ==================== ONBOARDING & PROVISIONING ====================

async function _runProvisioningFlow(tenantId) {
  const state = {
    tenantId,
    steps: PROVISION_STEPS.map(s => ({ name: s, status: 'pending', ts: null })),
    startedAt: _now(),
    completedAt: null,
    error: null,
  };
  _tenantProvisioning.set(tenantId, state);

  const setStep = (name, status) => {
    const step = state.steps.find(s => s.name === name);
    if (step) { step.status = status; step.ts = _now(); }
  };

  try {
    // Step 1: create_record is already done — just mark it
    setStep('create_record', 'done');

    // Step 2: assign_plan — limits/features already set
    setStep('assign_plan', 'done');

    // Step 3: generate default API key
    setStep('generate_api_key', 'in_progress');
    createTenantApiKey(tenantId, { name: 'Default API Key', scopes: ['read', 'write'] }, 'system');
    setStep('generate_api_key', 'done');

    // Step 4: configure limits
    setStep('configure_limits', 'in_progress');
    setStep('configure_limits', 'done');

    // Step 5: configure features
    setStep('configure_features', 'done');

    // Step 6: seed analytics
    setStep('seed_analytics', 'done');

    // Step 7: AI profile
    setStep('ai_profile', 'done');

    // Step 8: finalize
    setStep('finalize', 'in_progress');
    const tenant = _tenants.get(tenantId);
    if (tenant) {
      tenant.status = TENANT_STATUS.ACTIVE;
      tenant.provisionedAt = _now();
      tenant.updatedAt = _now();
    }
    state.completedAt = _now();
    setStep('finalize', 'done');

    _auditLog(tenantId, 'tenant.provisioned', {}, 'system');
    emitter.emit('tenant.provisioned', { tenantId });
    console.log(`[TenantEngine] ✅ Tenant ${tenantId} provisioned successfully`);
  } catch (err) {
    state.error = err.message;
    const pending = state.steps.find(s => s.status === 'in_progress');
    if (pending) pending.status = 'failed';
    const tenant = _tenants.get(tenantId);
    if (tenant) tenant.status = TENANT_STATUS.SUSPENDED;
    _auditLog(tenantId, 'tenant.provision_failed', { error: err.message }, 'system');
    emitter.emit('tenant.provision_failed', { tenantId, error: err.message });
    console.error(`[TenantEngine] ❌ Provisioning failed for ${tenantId}: ${err.message}`);
    throw err;
  }
}

function getProvisioningStatus(tenantId) {
  return _tenantProvisioning.get(tenantId) || null;
}

// ==================== PER-TENANT ANALYTICS ====================

function getTenantAnalytics(tenantId) {
  _requireTenant(tenantId);
  const analytics = _tenantAnalytics.get(tenantId) || _freshAnalytics();
  const usage = _getUsage(tenantId);
  return {
    ...analytics,
    currentUsage: usage,
  };
}

function recordAnalyticsEvent(tenantId, event = {}) {
  const analytics = _tenantAnalytics.get(tenantId);
  if (!analytics) return;
  analytics.events.push({ ...event, ts: _now() });
  if (analytics.events.length > MAX_ANALYTICS_EVENTS) analytics.events.shift();
  if (event.type === 'error') analytics.kpis.errorCount24h++;
  if (event.type === 'user_active') analytics.kpis.dau = (analytics.kpis.dau || 0) + 1;
}

function updateKPI(tenantId, kpiKey, value) {
  const analytics = _tenantAnalytics.get(tenantId);
  if (analytics && analytics.kpis) analytics.kpis[kpiKey] = value;
}

function getGlobalAnalytics() {
  const tenants = [..._tenants.values()].filter(t => t.status !== TENANT_STATUS.DELETED);
  let totalApiCalls = 0, totalAiCalls = 0, activeCount = 0, suspendedCount = 0;
  const planBreakdown = {};

  for (const tenant of tenants) {
    const usage = _tenantUsage.get(tenant.id);
    if (usage) {
      totalApiCalls += usage.apiCalls;
      totalAiCalls += usage.aiCalls;
    }
    if (tenant.status === TENANT_STATUS.ACTIVE) activeCount++;
    if (tenant.status === TENANT_STATUS.SUSPENDED) suspendedCount++;
    planBreakdown[tenant.planId] = (planBreakdown[tenant.planId] || 0) + 1;
  }

  return {
    totalTenants: tenants.length,
    activeTenants: activeCount,
    suspendedTenants: suspendedCount,
    totalApiCalls,
    totalAiCalls,
    planBreakdown,
    mrr: _computeMRR(),
    generatedAt: _now(),
  };
}

function _computeMRR() {
  let mrr = 0;
  for (const tenant of _tenants.values()) {
    if (tenant.status === TENANT_STATUS.ACTIVE) {
      const plan = _getPlan(tenant.planId);
      mrr += plan.priceMonthly;
    }
  }
  return mrr;
}

// ==================== AI ORCHESTRATION PER-TENANT ====================

function getTenantAIConfig(tenantId) {
  return _tenantAIConfig.get(tenantId) || _defaultAIConfig(tenantId);
}

function setTenantAIConfig(tenantId, patch = {}, actorId = 'system') {
  _requireTenant(tenantId);
  const current = getTenantAIConfig(tenantId);
  const ALLOWED = [
    'provider', 'preferredProviders', 'customApiKeys',
    'maxTokensPerRequest', 'maxRequestsPerMinute',
    'fallbackEnabled', 'cacheEnabled', 'contextWindow',
  ];
  for (const k of ALLOWED) {
    if (patch[k] !== undefined) current[k] = patch[k];
  }
  _tenantAIConfig.set(tenantId, current);
  _auditLog(tenantId, 'tenant.ai_config_updated', { keys: Object.keys(patch) }, actorId);
  return { ...current };
}

// ==================== GLOBAL API GATEWAY MIDDLEWARE ====================

/**
 * Express middleware: resolves tenant context from request.
 * Attaches req.tenantId and req.tenantContext.
 * Falls back to DEFAULT_TENANT_ID for backward compatibility.
 *
 * Resolution order:
 *  1. X-Tenant-ID header
 *  2. tenant claim from JWT (if already decoded by authMiddleware)
 *  3. Subdomain of Host header
 *  4. Default (single-tenant fallback)
 */
function tenantMiddleware(req, res, next) {
  // 1. Explicit header
  const headerTenantId = req.headers['x-tenant-id'];
  if (headerTenantId) {
    const tenant = getTenant(headerTenantId);
    if (tenant && tenant.status === TENANT_STATUS.ACTIVE) {
      req.tenantId = tenant.id;
      req.tenantContext = tenant;
      return next();
    }
    // Tenant header set but not found/active — reject for explicit tenant requests
    if (headerTenantId !== DEFAULT_TENANT_ID) {
      return res.status(403).json({ error: 'Tenant not found or inactive' });
    }
  }

  // 2. JWT claim (req.user may already be set by upstream authMiddleware)
  if (req.user && req.user.tenantId) {
    const tenant = getTenant(req.user.tenantId);
    if (tenant && tenant.status === TENANT_STATUS.ACTIVE) {
      req.tenantId = tenant.id;
      req.tenantContext = tenant;
      return next();
    }
  }

  // 3. Subdomain of Host header (e.g. "acme.unicorn.ai")
  const host = (req.headers.host || '').split(':')[0];
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    const tenantBySlug = getTenantBySlug(sub);
    if (tenantBySlug && tenantBySlug.status === TENANT_STATUS.ACTIVE) {
      req.tenantId = tenantBySlug.id;
      req.tenantContext = tenantBySlug;
      return next();
    }
    const tenantByDomain = getTenantByDomain(host);
    if (tenantByDomain && tenantByDomain.status === TENANT_STATUS.ACTIVE) {
      req.tenantId = tenantByDomain.id;
      req.tenantContext = tenantByDomain;
      return next();
    }
  }

  // 4. Default fallback (single-tenant backward compatibility)
  _ensureDefaultTenant();
  req.tenantId = DEFAULT_TENANT_ID;
  req.tenantContext = _tenants.get(DEFAULT_TENANT_ID);
  next();
}

/**
 * Middleware: enforce tenant-level rate limits and suspension.
 */
function tenantRateLimitMiddleware(req, res, next) {
  const tenantId = req.tenantId || DEFAULT_TENANT_ID;
  const tenant = _tenants.get(tenantId);
  if (tenant && tenant.status === TENANT_STATUS.SUSPENDED) {
    return res.status(403).json({ error: 'Tenant account is suspended', tenantId });
  }
  // Track usage (do not block — just record)
  recordApiCall(tenantId, req.path);
  next();
}

/**
 * Middleware: enforce AI call rate limit for the current tenant.
 */
function tenantAiRateLimitMiddleware(req, res, next) {
  const tenantId = req.tenantId || DEFAULT_TENANT_ID;
  const check = checkRateLimit(tenantId, 'ai');
  if (!check.allowed) {
    return res.status(429).json({ error: check.reason, limit: check.limit, used: check.used });
  }
  recordAiCall(tenantId);
  next();
}

// ==================== AUDIT LOG ====================

function _auditLog(tenantId, action, data = {}, actorId = 'system') {
  const logs = _tenantAuditLogs.get(tenantId) || [];
  logs.push({ id: _generateId('log'), tenantId, action, data, actorId, ts: _now() });
  if (logs.length > MAX_AUDIT_LOG_ENTRIES) logs.shift();
  _tenantAuditLogs.set(tenantId, logs);
}

function getAuditLog(tenantId, { limit = 100, action } = {}) {
  _requireTenant(tenantId);
  let logs = [...(_tenantAuditLogs.get(tenantId) || [])].reverse();
  if (action) logs = logs.filter(l => l.action === action);
  return logs.slice(0, limit);
}

// ==================== GLOBAL SCALING & FAILOVER ====================

const REGIONS = ['primary', 'eu-west', 'us-east', 'ap-southeast', 'sa-east'];

function getRegionStatus() {
  return REGIONS.map(r => ({
    region: r,
    status: 'healthy',
    latencyMs: Math.round(Math.random() * 30 + 5),
    load: Math.round(Math.random() * 40 + 10),
    tenants: [..._tenants.values()].filter(t => (t.regions || []).includes(r)).length,
  }));
}

function assignTenantRegion(tenantId, region, actorId = 'system') {
  if (!REGIONS.includes(region)) throw new Error(`Unknown region: ${region}`);
  const tenant = _requireTenant(tenantId);
  const plan = _getPlan(tenant.planId);
  if ((tenant.regions || []).length >= plan.limits.regionsMax && !tenant.regions.includes(region)) {
    throw new Error(`Plan allows max ${plan.limits.regionsMax} regions`);
  }
  if (!tenant.regions) tenant.regions = [];
  if (!tenant.regions.includes(region)) tenant.regions.push(region);
  tenant.updatedAt = _now();
  _auditLog(tenantId, 'tenant.region_assigned', { region }, actorId);
  return { ...tenant };
}

// ==================== SELF-HEALING & HEALTH ====================

let _healerInterval = null;

function _startSelfHealer() {
  if (_healerInterval) return;
  _healerInterval = setInterval(() => {
    _runHealthChecks();
  }, HEALTH_CHECK_INTERVAL_MS);
  if (_healerInterval.unref) _healerInterval.unref();
}

function _runHealthChecks() {
  const now = Date.now();
  for (const [tenantId, tenant] of _tenants) {
    if (tenant.status === TENANT_STATUS.DELETED) continue;

    // Auto-expire trials
    if (tenant.billing.trialEndsAt && new Date(tenant.billing.trialEndsAt).getTime() < now) {
      if (tenant.billing.status === 'trial') {
        tenant.billing.status = 'trial_expired';
        tenant.status = TENANT_STATUS.SUSPENDED;
        tenant.suspendReason = 'trial_expired';
        _auditLog(tenantId, 'tenant.trial_expired', {}, 'system');
        emitter.emit('tenant.trial_expired', { tenantId });
        console.log(`[TenantEngine] ⚠️  Tenant ${tenantId} trial expired — suspended`);
      }
    }

    // Auto-generate monthly invoice on 1st of month
    const usage = _tenantUsage.get(tenantId);
    if (usage && tenant.planId !== 'free' && tenant.status === TENANT_STATUS.ACTIVE) {
      const invoices = _tenantInvoices.get(tenantId) || [];
      const thisMonth = _monthKey();
      if (!invoices.some(i => i.month === thisMonth)) {
        try { generateInvoice(tenantId); } catch { /* non-fatal */ }
      }
    }

    // Update last health check in analytics
    const analytics = _tenantAnalytics.get(tenantId);
    if (analytics) analytics.lastHealthCheck = _now();
  }
}

function getHealthSummary() {
  const all = [..._tenants.values()];
  return {
    total: all.length,
    active: all.filter(t => t.status === TENANT_STATUS.ACTIVE).length,
    provisioning: all.filter(t => t.status === TENANT_STATUS.PROVISIONING).length,
    suspended: all.filter(t => t.status === TENANT_STATUS.SUSPENDED).length,
    trial: all.filter(t => t.billing && t.billing.status === 'trial').length,
    healerRunning: !!_healerInterval,
    lastCheckAt: _now(),
  };
}

// ==================== INTERNAL HELPERS ====================

function _requireTenant(tenantId) {
  const tenant = _tenants.get(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
  if (tenant.status === TENANT_STATUS.DELETED) throw new Error(`Tenant is deleted: ${tenantId}`);
  return tenant;
}

function _uniqueSlug(base) {
  let slug = base;
  let i = 2;
  while (_slugIndex.has(slug)) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

// ==================== MODULE INIT ====================

function init() {
  _ensureDefaultTenant();
  _startSelfHealer();
  console.log('[TenantEngine] 🏢 Multi-Tenant SaaS Engine initialized (backward-compatible mode)');
}

// ==================== EXPORTS ====================

module.exports = {
  // Init
  init,
  emitter,

  // Tenant CRUD
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  deleteTenant,
  getTenant,
  getTenantBySlug,
  getTenantByDomain,
  getTenantByApiKey: resolveTenantByApiKey,
  listTenants,
  getAllTenants,

  // Plan management
  changePlan,
  getSaasPlans,
  SAAS_PLANS,
  TENANT_STATUS,

  // Configuration & features
  getTenantConfig,
  getConfig: getTenantConfig,
  setTenantConfig,
  getTenantFeatures,
  setTenantFeature,
  hasFeature: (tenantId, featureName) => !!((getTenantFeatures(tenantId) || {})[featureName]),

  // API keys
  createTenantApiKey,
  listTenantApiKeys,
  revokeTenantApiKey,
  resolveTenantByApiKey,

  // Usage tracking
  recordApiCall,
  recordAiCall,
  incrementUsage: (tenantId, metric, amount = 1) => {
    const usage = _getUsage(tenantId);
    usage[metric] = (usage[metric] || 0) + amount;
    usage.lastActivityAt = _now();
    return usage;
  },
  resetUsage: (tenantId) => {
    const fresh = _freshUsage();
    _tenantUsage.set(tenantId, fresh);
    return { ...fresh };
  },
  checkRateLimit,
  getTenantUsage,
  getUsage: getTenantUsage,

  // Billing & invoices
  generateInvoice,
  listTenantInvoices,
  getTenantBillingStatus,
  subscribeTenant,

  // Onboarding
  getProvisioningStatus,

  // Analytics
  getTenantAnalytics,
  recordAnalyticsEvent,
  updateKPI,
  getGlobalAnalytics,

  // AI orchestration
  getTenantAIConfig,
  setTenantAIConfig,

  // Middleware
  tenantMiddleware,
  tenantRateLimitMiddleware,
  tenantAiRateLimitMiddleware,

  // Audit log
  getAuditLog,
  logEvent: (tenantId, type, payload = {}) => {
    _auditLog(tenantId, type, payload, 'system');
    return { tenantId, type, payload, createdAt: _now() };
  },
  logTenantLog: (tenantId, level, message, metadata = {}) => {
    _auditLog(tenantId, `log.${level}`, { message, metadata }, 'system');
    return { tenantId, level, message, metadata, createdAt: _now() };
  },

  // Scaling & regions
  getRegionStatus,
  assignTenantRegion,
  REGIONS,

  // Health / self-healing
  getHealthSummary,

  // Constants
  DEFAULT_TENANT_ID,
};
