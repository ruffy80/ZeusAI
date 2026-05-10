// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-10T16:33:57.341Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut, GitHub @ruffy80, ZeusAI
// forward-only-safety.js — "Forward Only" Mode Enforcement
// 
// Strategic objective: Allow all autonomous engines to run in harmony
// WITHOUT risk of:
//   • Breaking changes or schema regressions
//   • Downtime or blocked operations
//   • Rollbacks or state corruption
//   • Inter-engine conflicts or deadlocks
//
// This module enforces:
//   1. Mutation Whitelist — only approved change types allowed
//   2. Rollback Prevention — immutability on critical state
//   3. Conflict Detection — cross-engine coordination
//   4. Harmony Monitoring — Swiss-watch synchronization
// =====================================================================
'use strict';

const _state = {
  name: 'forward-only-safety',
  label: 'Forward-Only Safety Framework',
  startedAt: null,
  mode: 'forward-only',
  health: 'good',
  enforced: true,
  rules: {},
  violations: [],
  approvedMutationTypes: new Set(),
  blockedOperations: new Set(),
  harmonySynth: null,
};

// ─── APPROVED MUTATION TYPES ────────────────────────────────────────
// These are the ONLY types of changes allowed in production:
// ✅ additions, ✅ extensions, ✅ optimizations
// ❌ deletions, ❌ regressions, ❌ rollbacks
const APPROVED_MUTATIONS = new Set([
  'feature.add',              // New feature, non-breaking
  'module.load',              // Load new module
  'module.extend',            // Add capability to existing module
  'performance.optimize',     // Improve speed/memory (non-breaking)
  'security.harden',          // Strengthen security (non-breaking)
  'configuration.expand',     // Add new config (non-breaking)
  'analytics.enhance',        // Add metrics/logs
  'cache.improve',            // Better caching strategy
  'error_handling.improve',   // Better error handling
  'compatibility.extend',     // Add backward-compat features
  'innovation.generate',      // Auto-innovation output
  'revenue.flow',             // New revenue stream
  'market.listing',           // New marketplace listing
  'integration.activate',     // Activate existing integration
  'service.publish',          // Publish new service
  'endpoint.add',             // Add new API endpoint
  'content.update',           // Update existing content
  'schema.migrate',           // Forward-compatible migration
  'capacity.scale',           // Auto-scaling operations
  'health.repair',            // Self-healing operations
  'audit.log',                // Write audit trail
]);

const FORBIDDEN_MUTATIONS = new Set([
  'schema.delete',            // ❌ Delete schema field
  'schema.drop',              // ❌ Drop table/collection
  'schema.rename',            // ❌ Rename breaking change
  'module.unload',            // ❌ Remove module (breaks routes)
  'module.replace',           // ❌ Swap implementation
  'configuration.remove',     // ❌ Delete required config
  'endpoint.remove',          // ❌ Retire endpoint without redirect
  'feature.remove',           // ❌ Delete feature (breaking)
  'rollback.execute',         // ❌ Revert to previous version
  'data.delete',              // ❌ Delete user/payment data
  'service.unpublish',        // ❌ Remove live service
  'downtime.execute',         // ❌ Schedule maintenance window
  'cache.flush',              // ❌ Clear production cache
  'index.rebuild',            // ❌ Rebuild without online capability
  'database.reset',           // ❌ Reset database
  'credentials.rotate',       // ❌ Rotate without ceremony
  'security.downgrade',       // ❌ Weaken security
  'rate_limit.disable',       // ❌ Remove rate limiting
  'encryption.disable',       // ❌ Disable encryption
  'audit.purge',              // ❌ Delete audit logs
]);

// ─── CRITICAL STATE ZONES (immutable during autonomous operation) ────
const PROTECTED_STATE = new Set([
  'PAYMENT_LEDGER',           // Never modify payment records
  'USER_IDENTITY',            // Never modify user accounts
  'AUTH_CREDENTIALS',         // Never modify auth tokens
  'AUDIT_LOG',                // Never purge/modify audit trail
  'MERCHANT_WALLET',          // Never change receiving address
  'DEPLOYMENT_MANIFEST',      // Never modify deployed version
  'SCHEMA_DEFINITION',        // Never alter DB schema (breaking)
  'SERVICE_CATALOG',          // Only append, never remove
  'REVENUE_PROOF',            // Never delete proof records
]);

// ─── INITIALIZATION ────────────────────────────────────────────────
function init() {
  _state.startedAt = new Date().toISOString();
  _state.approvedMutationTypes = new Set(APPROVED_MUTATIONS);
  _state.blockedOperations = new Set(FORBIDDEN_MUTATIONS);
  _state.rules = {
    allowApprovedMutations: true,
    blockForbiddenMutations: true,
    protectCriticalState: true,
    enforceAuditTrail: true,
    enableHarmonyMonitoring: true,
  };
  console.log('✅ [Forward-Only Safety] Mode initialized');
  console.log(`   Approved mutations: ${APPROVED_MUTATIONS.size}`);
  console.log(`   Forbidden mutations: ${FORBIDDEN_MUTATIONS.size}`);
  console.log(`   Protected state zones: ${PROTECTED_STATE.size}`);
}

// ─── MUTATION CLASSIFICATION ──────────────────────────────────────
function classifyMutation(operation) {
  if (!operation || typeof operation !== 'object') {
    return { classification: 'unknown', allowed: false, reason: 'invalid_operation' };
  }
  const type = String(operation.type || '').toLowerCase().trim();
  if (!type) return { classification: 'unclassified', allowed: false, reason: 'missing_type' };

  const isApproved = APPROVED_MUTATIONS.has(type);
  const isForbidden = FORBIDDEN_MUTATIONS.has(type);
  const affectsProtected = operation.affectsState && PROTECTED_STATE.has(operation.affectsState);

  if (isForbidden) {
    return {
      classification: 'forbidden',
      allowed: false,
      reason: 'explicitly_forbidden_mutation_type',
      type,
    };
  }

  if (affectsProtected && operation.affectsState) {
    return {
      classification: 'protected_zone',
      allowed: operation.readonly === true || operation.readOnly === true,
      reason: 'protected_state_zone_requires_readonly',
      protectedZone: operation.affectsState,
    };
  }

  if (isApproved) {
    return {
      classification: 'approved',
      allowed: true,
      reason: 'approved_mutation_type',
      type,
    };
  }

  // Unknown type — whitelist principle: DENY by default
  return {
    classification: 'unknown_approved',
    allowed: false,
    reason: 'mutation_type_not_in_approved_list',
    type,
    suggestion: `Add '${type}' to APPROVED_MUTATIONS if this is intentional forward-only change`,
  };
}

// ─── GATE KEEPER — Enforce mutation policy ────────────────────────
function checkMutation(operation, context = {}) {
  if (!_state.enforced) {
    return { ok: true, enforcement: 'disabled', operationId: operation.id };
  }

  const classification = classifyMutation(operation);
  const allowed = classification.allowed === true;
  const violation = !allowed;

  const record = {
    id: operation.id || (`op-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    type: operation.type,
    classification: classification.classification,
    allowed,
    violation,
    reason: classification.reason,
    actor: String(context.actor || context.userId || 'unknown'),
    timestamp: new Date().toISOString(),
    context,
  };

  if (violation) {
    _state.violations.push(record);
    if (_state.violations.length > 1000) _state.violations = _state.violations.slice(-1000);
  }

  return {
    ok: allowed,
    operationId: record.id,
    classification: classification.classification,
    allowed,
    reason: classification.reason,
    violates: violation ? true : undefined,
    audit: record,
  };
}

// ─── HARMONY MONITORING — Cross-engine synchronization ─────────────
// Swiss-watch model: all engines fire in coordination, no overlaps
const _engineRegistry = new Map();

function registerEngine(engineName, getStatusFn) {
  if (!engineName || typeof getStatusFn !== 'function') return false;
  _engineRegistry.set(engineName, { name: engineName, getStatus: getStatusFn, lastRunAt: null, isRunning: false });
  return true;
}

function startHarmonyMonitor() {
  _state.harmonyMonitor = setInterval(() => {
    const snapshot = getHarmonySnapshot();
    if (snapshot.health !== 'good') {
      _state.health = snapshot.health;
      console.warn(`⚠️  [Forward-Only Safety] Harmony degraded: ${snapshot.reason}`);
    } else {
      _state.health = 'good';
    }
  }, 5000);
  if (typeof _state.harmonyMonitor.unref === 'function') _state.harmonyMonitor.unref();
}

function getHarmonySnapshot() {
  const engines = [];
  let activeCount = 0;
  let errorCount = 0;

  for (const [name, engine] of _engineRegistry) {
    try {
      const status = engine.getStatus();
      const active = status && status.active;
      if (active) activeCount++;
      const hasError = status && status.error;
      if (hasError) errorCount++;
      engines.push({
        name,
        active,
        error: hasError ? status.error : null,
        lastRun: engine.lastRunAt,
      });
    } catch (e) {
      errorCount++;
      engines.push({
        name,
        active: false,
        error: String(e && e.message || e),
      });
    }
  }

  const health = errorCount === 0 && activeCount > 0 ? 'good' : (errorCount > 0 ? 'degraded' : 'idle');
  const reason = errorCount > 0 ? `${errorCount} engines reporting errors` : (activeCount === 0 ? 'no_engines_active' : null);

  return {
    timestamp: new Date().toISOString(),
    health,
    reason,
    totalEngines: _engineRegistry.size,
    activeEngines: activeCount,
    engineErrors: errorCount,
    engines,
  };
}

// ─── STATUS & INTROSPECTION ────────────────────────────────────────
function getStatus() {
  return {
    ..._state,
    approvedMutationCount: _state.approvedMutationTypes.size,
    blockedOperationCount: _state.blockedOperations.size,
    protectedZoneCount: PROTECTED_STATE.size,
    violationCount: _state.violations.length,
    recentViolations: _state.violations.slice(-5),
    harmonyStatus: getHarmonySnapshot(),
  };
}

function listApprovedMutations() {
  return Array.from(_state.approvedMutationTypes).sort();
}

function listForbiddenMutations() {
  return Array.from(_state.blockedOperations).sort();
}

function listProtectedZones() {
  return Array.from(PROTECTED_STATE).sort();
}

function listViolations(limit = 50) {
  return _state.violations.slice(-limit);
}

function clearViolations() {
  _state.violations = [];
  return { ok: true, cleared: true };
}

// ─── ENFORCEMENT TOGGLE ────────────────────────────────────────────
function setEnforcement(enabled) {
  const wasEnforced = _state.enforced;
  _state.enforced = !!enabled;
  return {
    ok: true,
    enforcement: _state.enforced,
    changed: wasEnforced !== _state.enforced,
    changedAt: new Date().toISOString(),
  };
}

// ─── EXPORT ────────────────────────────────────────────────────────
init();

module.exports = {
  name: _state.name,
  label: _state.label,
  init,
  getStatus,
  classifyMutation,
  checkMutation,
  registerEngine,
  startHarmonyMonitor,
  getHarmonySnapshot,
  listApprovedMutations,
  listForbiddenMutations,
  listProtectedZones,
  listViolations,
  clearViolations,
  setEnforcement,
};
