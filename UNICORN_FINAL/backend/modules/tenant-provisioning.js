// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.174Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * TENANT PROVISIONING ENGINE — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Auto-provisions new tenants with zero manual intervention:
 *   1. Reserve slug + create tenant record
 *   2. Generate initial API keys
 *   3. Set up environments (production + staging)
 *   4. Apply plan-based feature flags
 *   5. Send onboarding notification
 *   6. Mark tenant as active once complete
 *   7. Self-heal: retry failed provisions automatically
 */

const crypto = require('crypto');
const tenantManager = require('./tenant-manager');

// ── Provision queue ───────────────────────────────────────────────────────────
// Map<tenantId, { status, attempts, log, startedAt, completedAt }>
const _queue = new Map();
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

// ── Onboarding steps ──────────────────────────────────────────────────────────
const STEPS = [
  'create_record',
  'generate_api_keys',
  'setup_environments',
  'apply_feature_flags',
  'send_welcome',
  'mark_active',
];

async function _step_create_record(tenant, opts) {
  // Already created by caller (createTenant). Just validate.
  if (!tenant) throw new Error('Tenant record missing');
  return { tenantId: tenant.id };
}

async function _step_generate_api_keys(tenant) {
  // Create primary + secondary API keys
  const primary = tenantManager.createApiKey(tenant.id, { label: 'primary', scopes: ['*'] });
  let secondary = null;
  if (tenant.limits.maxApiKeys === -1 || tenant.limits.maxApiKeys >= 2) {
    secondary = tenantManager.createApiKey(tenant.id, { label: 'secondary', scopes: ['read'] });
  }
  return { primary: primary.key, secondary: secondary ? secondary.key : null };
}

async function _step_setup_environments(tenant) {
  const environments = [];
  const maxEnv = tenant.customLimits?.maxEnvironments ?? tenant.limits.maxEnvironments;
  if (maxEnv === -1 || maxEnv >= 2) {
    tenantManager.addEnvironment(tenant.id, 'staging', {});
    environments.push('staging');
  }
  if (maxEnv === -1 || maxEnv >= 3) {
    tenantManager.addEnvironment(tenant.id, 'development', {});
    environments.push('development');
  }
  return { environments };
}

async function _step_apply_feature_flags(tenant) {
  const planFeatures = tenant.features;
  for (const [flag, enabled] of Object.entries(planFeatures)) {
    tenantManager.setFeatureFlag(tenant.id, flag, enabled);
  }
  return { flags: Object.keys(planFeatures) };
}

async function _step_send_welcome(tenant) {
  // Non-blocking best-effort email/webhook
  try {
    const emailService = require('../email');
    if (emailService && typeof emailService.sendWelcomeEmail === 'function') {
      await emailService.sendWelcomeEmail({
        name: tenant.name,
        email: tenant.ownerEmail,
      });
    }
  } catch { /* non-critical */ }
  return { notified: tenant.ownerEmail };
}

async function _step_mark_active(tenant) {
  tenantManager.updateTenant(tenant.id, {}); // touch updatedAt
  const raw = tenantManager.getTenant(tenant.id);
  raw.status = 'active';
  raw.provisionedAt = new Date().toISOString();
  raw.updatedAt = raw.provisionedAt;
  return { status: 'active', provisionedAt: raw.provisionedAt };
}

// ── Run provisioning ──────────────────────────────────────────────────────────

async function _runProvision(tenantId) {
  const entry = _queue.get(tenantId);
  const tenant = tenantManager.getTenant(tenantId);
  if (!tenant) {
    entry.status = 'failed';
    entry.log.push({ ts: new Date().toISOString(), step: 'init', error: 'Tenant not found' });
    return;
  }

  entry.status = 'in_progress';
  const stepFns = {
    create_record:       () => _step_create_record(tenant),
    generate_api_keys:   () => _step_generate_api_keys(tenant),
    setup_environments:  () => _step_setup_environments(tenant),
    apply_feature_flags: () => _step_apply_feature_flags(tenant),
    send_welcome:        () => _step_send_welcome(tenant),
    mark_active:         () => _step_mark_active(tenant),
  };

  for (const step of STEPS) {
    try {
      const result = await stepFns[step]();
      entry.log.push({ ts: new Date().toISOString(), step, result });
    } catch (err) {
      entry.log.push({ ts: new Date().toISOString(), step, error: err.message });
      entry.status = 'failed';
      entry.attempts++;
      if (entry.attempts < MAX_ATTEMPTS) {
        entry.log.push({ ts: new Date().toISOString(), step: 'retry', attempt: entry.attempts });
        setTimeout(() => _runProvision(tenantId), RETRY_DELAY_MS * entry.attempts);
      } else {
        entry.log.push({ ts: new Date().toISOString(), step: 'exhausted', message: 'Max retries reached' });
      }
      return;
    }
  }

  entry.status = 'completed';
  entry.completedAt = new Date().toISOString();
  console.log(`[TenantProvisioning] Tenant ${tenantId} provisioned successfully`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * provision({ name, slug, plan, ownerEmail, ownerId, metadata })
 * Creates and auto-provisions a new tenant. Returns { tenantId, apiKey, status }.
 */
async function provision(opts = {}) {
  const tenant = tenantManager.createTenant(opts);

  const entry = {
    tenantId: tenant.id,
    status: 'queued',
    attempts: 0,
    log: [{ ts: new Date().toISOString(), step: 'queued' }],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  _queue.set(tenant.id, entry);

  // Run async — do not block caller
  setImmediate(() => _runProvision(tenant.id));

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    status: 'provisioning',
    message: 'Tenant is being provisioned. Check /api/tenant/provision/status/:id',
  };
}

function getProvisionStatus(tenantId) {
  const entry = _queue.get(tenantId);
  if (!entry) return { status: 'unknown', tenantId };
  return { ...entry, log: entry.log.slice(-20) };
}

function listProvisions() {
  const out = [];
  for (const e of _queue.values()) {
    out.push({
      tenantId: e.tenantId,
      status: e.status,
      attempts: e.attempts,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
    });
  }
  return out;
}

function getStatus() {
  const statuses = { queued: 0, in_progress: 0, completed: 0, failed: 0 };
  for (const e of _queue.values()) {
    statuses[e.status] = (statuses[e.status] || 0) + 1;
  }
  return {
    module: 'TenantProvisioning',
    status: 'active',
    ...statuses,
    totalProvisions: _queue.size,
  };
}

module.exports = {
  provision,
  getProvisionStatus,
  listProvisions,
  getStatus,
};
