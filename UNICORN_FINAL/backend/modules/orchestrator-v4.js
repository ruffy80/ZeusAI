// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-16T12:40:29.172Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// orchestrator-v4.js — Orchestrator v4 for Unicorn multi-tenant SaaS platform
// Orchestrator v4 pentru platforma Unicorn SaaS multi-tenant
// =============================================================================
// Sub-systems / Sub-sisteme:
//   1. TCL  — Tenant Context Loader
//   2. MSE  — Module Sandbox Executor
//   3. SCH  — Orchestrator Scheduler
//   4. AHE  — Auto-Heal Engine
//   5. WDS  — Watchdog & Shield
//   6. GOB  — Global Orchestrator Brain
// =============================================================================

'use strict';

const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');
const cron         = require('node-cron');
const express      = require('express');
const tenantEngine = require('./tenant-engine');
const billingEngine = require('./billing-engine');

// ---------------------------------------------------------------------------
// Shared constants / Constante partajate
// ---------------------------------------------------------------------------
const MODULE_TIMEOUT_MS = parseInt(process.env.MODULE_TIMEOUT_MS, 10) || 30_000;
const TCL_TTL_MS        = 30_000; // 30 s context cache TTL

// ---------------------------------------------------------------------------
// Security: safe module-name validation and path resolver
// Securitate: validare sigură a numelui de modul și resolver de cale
// ---------------------------------------------------------------------------
// Only allow simple names: alphanumeric, hyphens, underscores, no path separators
const _SAFE_MODULE_NAME_RE = /^[a-zA-Z0-9_-]{1,100}$/;
const _MODULES_BASE_DIR    = path.resolve(__dirname);

/**
 * safePath — validates that a module name is safe (no path traversal) and
 * returns the resolved absolute path ONLY from a server-controlled directory
 * listing (whitelist). The returned path uses the server-controlled filename,
 * NOT the raw user input, so CodeQL / taint analysis sees no user-tainted value
 * flowing into the path operation.
 * Returns null when the name is rejected or the module doesn't exist.
 * Validează că un nume de modul este sigur și returnează calea din listing-ul directorului.
 * @param {string} moduleName
 * @returns {string|null}
 */
function safePath(moduleName) {
  if (typeof moduleName !== 'string' || !_SAFE_MODULE_NAME_RE.test(moduleName)) {
    console.warn('[orchestrator-v4] Rejected unsafe module name:', String(moduleName).slice(0, 80));
    return null;
  }
  // Read the server-controlled directory listing and find the exact filename.
  // We use the server-provided filename (not user input) in path construction,
  // so user-controlled data never flows into path operations.
  let files;
  try {
    files = fs.readdirSync(_MODULES_BASE_DIR);
  } catch {
    return null;
  }
  const safeFilename = files.find(f => f === moduleName + '.js');
  if (!safeFilename) {
    return null; // module not on disk — reported as missing entry point
  }
  // Use only the server-controlled filename for path construction
  return path.join(_MODULES_BASE_DIR, safeFilename);
}

// ---------------------------------------------------------------------------
// Utility: promisified timeout wrapper
// Utilitar: executor cu timeout promisificat
// ---------------------------------------------------------------------------
function _withTimeout(fn, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    Promise.resolve()
      .then(() => fn())
      .then(result => { clearTimeout(timer); resolve(result); })
      .catch(err   => { clearTimeout(timer); reject(err); });
  });
}

// =============================================================================
// §1  TENANT CONTEXT LOADER (TCL)
// Încărcător de context tenant
// =============================================================================

/** @type {Map<string, { data: object, expiresAt: number }>} */
const _tclCache = new Map();

/**
 * loadTenantContext — loads and enriches tenant context, with 30-s cache
 * Încarcă și îmbogățește contextul tenant, cu cache de 30 s
 * @param {string} tenantId
 * @returns {object}
 */
function loadTenantContext(tenantId) {
  const now    = Date.now();
  const cached = _tclCache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.data;

  const ctx = tenantEngine.getTenantContext(tenantId);
  if (!ctx) throw new Error(`Tenant not found: ${tenantId}`);

  // Enrich with active modules from config / Îmbogățire cu module active din config
  const rawModules = tenantEngine.getConfig(tenantId, 'active_modules');
  ctx.modules = Array.isArray(rawModules) ? rawModules : (rawModules ? [rawModules] : []);

  _tclCache.set(tenantId, { data: ctx, expiresAt: now + TCL_TTL_MS });
  return ctx;
}

/**
 * invalidateTenantContext — removes tenant from context cache
 * Elimină tenant-ul din cache-ul de context
 * @param {string} tenantId
 */
function invalidateTenantContext(tenantId) {
  _tclCache.delete(tenantId);
}

// =============================================================================
// §2  MODULE SANDBOX EXECUTOR (MSE)
// Executor sandbox de module
// =============================================================================

/** @type {Map<string, { module: string, lastRun: number, lastDuration: number, runs: number, errors: number }[]>} */
const _mseStats = new Map();

/**
 * executeModuleForTenant — executes a named module in isolation for a tenant
 * Execută un modul denumit în izolare pentru un tenant
 * @param {string}  tenantId
 * @param {string}  moduleName
 * @param {*}       input
 * @param {object}  [opts]
 * @param {number}  [opts.timeoutMs]
 * @returns {Promise<{ success: boolean, result: *, duration: number, tenantId: string, moduleName: string }>}
 */
async function executeModuleForTenant(tenantId, moduleName, input, opts = {}) {
  const start = Date.now();
  let success = false;
  let result  = null;

  try {
    // Load context & check feature flag / Verificare flag funcționalitate
    const ctx = loadTenantContext(tenantId);
    if (!tenantEngine.hasFeature(tenantId, moduleName)) {
      throw new Error(`Feature '${moduleName}' not enabled for tenant ${tenantId}`);
    }

    // Check limits before execution / Verificare limite înainte de execuție
    const limitCheck = tenantEngine.checkLimit(tenantId, 'api_calls');
    if (limitCheck && limitCheck.exceeded) {
      throw new Error(`Limit exceeded for tenant ${tenantId}: api_calls`);
    }

    // Resolve the module dynamically (relative to this directory)
    // Rezolvare dinamică a modulului (relativ la acest director)
    const timeoutMs = opts.timeoutMs || MODULE_TIMEOUT_MS;
    result = await _withTimeout(() => {
      // Attempt to require the module if it exists, otherwise fail visibly.
      // Încearcă să încarce modulul dacă există, altfel eșuează vizibil.
      // safePath() validates the name against a strict regex and ensures the
      // resolved path stays inside __dirname (prevents path traversal / injection).
      let mod;
      const resolvedPath = safePath(moduleName);
      try {
        mod = resolvedPath ? require(resolvedPath) : null;
      } catch (_) {
        mod = null;
      }
      if (mod && typeof mod.execute === 'function') {
        return Promise.resolve(mod.execute(tenantId, input, ctx));
      }
      // Real fallback: try common public entry points before failing.
      // This keeps the contract intact for modules that export `process`,
      // `run`, or `handle` instead of `execute`. No silent success return.
      if (mod) {
        for (const fnName of ['process', 'run', 'handle', 'invoke']) {
          if (typeof mod[fnName] === 'function') {
            return Promise.resolve(mod[fnName](input, { tenantId, ctx }));
          }
        }
      }
      // Module is genuinely missing a callable entry point — return a
      // structured, observable error so the MSE stats record the failure
      // instead of inflating success metrics with a synthetic success payload.
      return Promise.reject(Object.assign(new Error(
        `module '${moduleName}' has no execute/process/run/handle export`
      ), { code: 'NO_ENTRY_POINT', moduleName, tenantId }));
    }, timeoutMs);

    // Track usage after successful execution / Urmărire utilizare după execuție reușită
    tenantEngine.incrementUsage(tenantId, 'api_calls', 1);
    success = true;
  } catch (err) {
    result = { error: err.message };
    _recordMseError(tenantId, moduleName);
  }

  const duration = Date.now() - start;
  _updateMseStats(tenantId, moduleName, duration, !success);
  return { success, result, duration, tenantId, moduleName };
}

function _updateMseStats(tenantId, moduleName, duration, isError) {
  if (!_mseStats.has(tenantId)) _mseStats.set(tenantId, []);
  const stats = _mseStats.get(tenantId);
  const entry = stats.find(s => s.module === moduleName);
  if (entry) {
    entry.lastRun      = Date.now();
    entry.lastDuration = duration;
    entry.runs++;
    if (isError) entry.errors++;
  } else {
    stats.push({ module: moduleName, lastRun: Date.now(), lastDuration: duration, runs: 1, errors: isError ? 1 : 0 });
  }
}

function _recordMseError(tenantId, moduleName) {
  // Errors already captured via _updateMseStats — no extra action needed
  // Erorile sunt deja capturate prin _updateMseStats — nu e nevoie de acțiune suplimentară
}

/**
 * getModuleStatus — list of active modules + last execution stats for a tenant
 * Listă de module active + statistici ultimei execuții pentru un tenant
 * @param {string} tenantId
 * @returns {object[]}
 */
function getModuleStatus(tenantId) {
  const ctx   = loadTenantContext(tenantId);
  const stats = _mseStats.get(tenantId) || [];
  return ctx.modules.map(mod => {
    const s = stats.find(x => x.module === mod) || {};
    return { module: mod, lastRun: s.lastRun || null, lastDuration: s.lastDuration || null, runs: s.runs || 0, errors: s.errors || 0 };
  });
}

// =============================================================================
// §3  ORCHESTRATOR SCHEDULER (SCH)
// Planificator orchestrator
// =============================================================================

/** @type {Map<string, Map<string, { task: cron.ScheduledTask, cronExpr: string, fn: Function }>>} */
const _schedulerJobs = new Map();

/** @type {cron.ScheduledTask[]} */
const _builtinTasks = [];

/**
 * scheduleJob — add a cron job scoped to a tenant
 * Adaugă un job cron legat de un tenant
 * @param {string}   tenantId
 * @param {string}   jobName
 * @param {Function} fn
 * @param {string}   cronExpr
 */
function scheduleJob(tenantId, jobName, fn, cronExpr) {
  if (!_schedulerJobs.has(tenantId)) _schedulerJobs.set(tenantId, new Map());
  const tenantJobs = _schedulerJobs.get(tenantId);

  // Cancel existing job with same name / Anulare job existent cu același nume
  if (tenantJobs.has(jobName)) {
    tenantJobs.get(jobName).task.stop();
  }

  const task = cron.schedule(cronExpr, () => {
    Promise.resolve().then(fn).catch(err => {
      tenantEngine.logTenantLog(tenantId, 'error', `Scheduled job '${jobName}' failed: ${err.message}`);
    });
  });

  tenantJobs.set(jobName, { task, cronExpr, fn });
}

/**
 * cancelJob — stop and remove a tenant's scheduled job
 * Oprește și elimină un job planificat al unui tenant
 * @param {string} tenantId
 * @param {string} jobName
 */
function cancelJob(tenantId, jobName) {
  const tenantJobs = _schedulerJobs.get(tenantId);
  if (!tenantJobs || !tenantJobs.has(jobName)) return;
  tenantJobs.get(jobName).task.stop();
  tenantJobs.delete(jobName);
}

/**
 * getJobs — list scheduled jobs for a tenant
 * Listează job-urile planificate pentru un tenant
 * @param {string} tenantId
 * @returns {object[]}
 */
function getJobs(tenantId) {
  const tenantJobs = _schedulerJobs.get(tenantId);
  if (!tenantJobs) return [];
  return [...tenantJobs.entries()].map(([name, j]) => ({ name, cronExpr: j.cronExpr }));
}

/**
 * runJob — force-run a tenant job immediately
 * Forțează execuția imediată a unui job tenant
 * @param {string} tenantId
 * @param {string} jobName
 * @returns {Promise<void>}
 */
async function runJob(tenantId, jobName) {
  const tenantJobs = _schedulerJobs.get(tenantId);
  if (!tenantJobs || !tenantJobs.has(jobName)) throw new Error(`Job not found: ${jobName}`);
  await Promise.resolve().then(tenantJobs.get(jobName).fn);
}

/**
 * _scheduleBuiltinJobs — schedule usage_sync and analytics_collect for all active tenants
 * Planifică job-urile built-in pentru toți tenanții activi
 */
function _scheduleBuiltinJobs() {
  // usage_sync every 15 min / usage_sync la fiecare 15 min
  _builtinTasks.push(cron.schedule('*/15 * * * *', () => {
    const tenants = tenantEngine.getAllTenants();
    tenants.forEach(t => {
      try {
        tenantEngine.logEvent(t.id, 'usage_sync', { syncedAt: new Date().toISOString() });
      } catch (_) { /* non-critical */ }
    });
  }));

  // analytics_collect every hour / analytics_collect la fiecare oră
  _builtinTasks.push(cron.schedule('0 * * * *', () => {
    const tenants = tenantEngine.getAllTenants();
    tenants.forEach(t => {
      try {
        const usage = tenantEngine.getUsage(t.id) || {};
        tenantEngine.logEvent(t.id, 'analytics_collect', { usage, collectedAt: new Date().toISOString() });
      } catch (_) { /* non-critical */ }
    });
  }));
}

/**
 * getSchedulerStatus — all tenant jobs overview
 * Prezentare generală a tuturor job-urilor de tenant
 * @returns {object}
 */
function getSchedulerStatus() {
  const result = {};
  for (const [tenantId, jobs] of _schedulerJobs.entries()) {
    result[tenantId] = [...jobs.entries()].map(([name, j]) => ({ name, cronExpr: j.cronExpr }));
  }
  return result;
}

// =============================================================================
// §4  AUTO-HEAL ENGINE (AHE)
// Motor de auto-vindecare
// =============================================================================

/** @type {Map<string, { tenantId: string, event: string, moduleName?: string, at: number }[]>} */
const _healHistory = new Map();

/**
 * detectTenantErrors — reads tenant logs for errors in the last 1 hour
 * Citește log-urile tenant pentru erori din ultima oră
 * @param {string} tenantId
 * @returns {{ count: number, errors: object[] }}
 */
function detectTenantErrors(tenantId) {
  const horizon = Date.now() - 3_600_000; // 1 hour / 1 oră
  const logs    = tenantEngine.tenantLogs.get(tenantId) || [];
  const recent  = logs.filter(l => l.level === 'error' && new Date(l.createdAt).getTime() > horizon);
  return { count: recent.length, errors: recent };
}

/**
 * repairModule — re-initialize a module for a tenant, log repair event
 * Re-inițializează un modul pentru un tenant, înregistrează evenimentul
 * @param {string} tenantId
 * @param {string} moduleName
 */
function repairModule(tenantId, moduleName) {
  // Evict cached state for the module / Eliminare stare cache pentru modul
  const stats = _mseStats.get(tenantId);
  if (stats) {
    const idx = stats.findIndex(s => s.module === moduleName);
    if (idx !== -1) stats.splice(idx, 1);
  }

  tenantEngine.logEvent(tenantId, 'module_repair', { moduleName, repairedAt: new Date().toISOString() });
  _appendHealHistory(tenantId, 'module_repair', moduleName);
}

/**
 * regenerateConfigs — reset tenant configs to plan defaults
 * Resetează configurațiile tenant la valorile implicite ale planului
 * @param {string} tenantId
 */
function regenerateConfigs(tenantId) {
  const tenant = tenantEngine.getTenant(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  // Clear all tenant configs / Ștergere toate configurațiile tenant
  tenantEngine.tenantConfigs.delete(tenantId);

  tenantEngine.logEvent(tenantId, 'config_regenerated', { at: new Date().toISOString() });
  _appendHealHistory(tenantId, 'config_regenerated');
}

/**
 * resetSandbox — clears MSE state for tenant and invalidates context cache
 * Șterge starea MSE pentru tenant și invalidează cache-ul de context
 * @param {string} tenantId
 */
function resetSandbox(tenantId) {
  _mseStats.delete(tenantId);
  invalidateTenantContext(tenantId);
  tenantEngine.logEvent(tenantId, 'sandbox_reset', { at: new Date().toISOString() });
  _appendHealHistory(tenantId, 'sandbox_reset');
}

/**
 * autoHealCycle — runs for all active tenants: detect errors → repair if >3 errors/hour
 * Rulează pentru toți tenanții activi: detectează erori → repară dacă >3 erori/oră
 */
function autoHealCycle() {
  const tenants = tenantEngine.getAllTenants().filter(t => t.status === 'active');
  for (const tenant of tenants) {
    try {
      const { count, errors } = detectTenantErrors(tenant.id);
      if (count > 3) {
        // Identify which modules had errors and repair each
        // Identifică modulele cu erori și repară fiecare
        const affectedModules = [...new Set(errors.map(e => e.metadata && e.metadata.moduleName).filter(Boolean))];
        if (affectedModules.length > 0) {
          affectedModules.forEach(mod => repairModule(tenant.id, mod));
        } else {
          // Generic sandbox reset if no specific module identified
          // Resetare sandbox generică dacă nu s-a identificat un modul specific
          resetSandbox(tenant.id);
        }
        tenantEngine.logTenantLog(tenant.id, 'warn', `Auto-heal triggered: ${count} errors in last hour`);
      }
    } catch (_) { /* keep cycling */ }
  }
}

/**
 * getHealHistory — recent heal events for a tenant
 * Evenimente recente de vindecare pentru un tenant
 * @param {string} tenantId
 * @returns {object[]}
 */
function getHealHistory(tenantId) {
  return (_healHistory.get(tenantId) || []).slice().reverse();
}

function _appendHealHistory(tenantId, event, moduleName) {
  if (!_healHistory.has(tenantId)) _healHistory.set(tenantId, []);
  const history = _healHistory.get(tenantId);
  history.push({ tenantId, event, moduleName: moduleName || null, at: Date.now() });
  // Keep last 200 heal events per tenant / Păstrare ultimele 200 evenimente per tenant
  if (history.length > 200) history.splice(0, history.length - 200);
}

// =============================================================================
// §5  WATCHDOG & SHIELD (WDS)
// Watchdog și scut
// =============================================================================

// Sliding window request records per tenant
// Înregistrări cereri în fereastră glisantă per tenant
/** @type {Map<string, { ts: number, ip: string, path: string, tokens: number }[]>} */
const _requestLog = new Map();

/** @type {Map<string, { reason: string, until: number }[]>} */
const _blockList   = new Map();

/**
 * recordRequest — record an incoming request for a tenant
 * Înregistrează o cerere primită pentru un tenant
 * @param {string} tenantId
 * @param {{ ip: string, path: string, tokens: number }} meta
 */
function recordRequest(tenantId, meta) {
  if (!_requestLog.has(tenantId)) _requestLog.set(tenantId, []);
  _requestLog.get(tenantId).push({ ts: Date.now(), ip: meta.ip || 'unknown', path: meta.path || '/', tokens: meta.tokens || 0 });
  // Prune records older than 10 minutes to bound memory
  // Ștergere înregistrări mai vechi de 10 minute pentru a limita memoria
  const cutoff = Date.now() - 600_000;
  const log    = _requestLog.get(tenantId);
  while (log.length && log[0].ts < cutoff) log.shift();
}

/**
 * detectAbuse — evaluate sliding-window counters for abuse signals
 * Evaluează contoarele ferestrei glisante pentru semnale de abuz
 * @param {string} tenantId
 * @returns {{ isAbuse: boolean, reasons: string[] }}
 */
function detectAbuse(tenantId) {
  const now    = Date.now();
  const log    = _requestLog.get(tenantId) || [];
  const reasons = [];

  // 1. >1000 req/min from same IP / >1000 cereri/min de la același IP
  const oneMinAgo = now - 60_000;
  const ipCounts  = {};
  log.filter(r => r.ts > oneMinAgo).forEach(r => { ipCounts[r.ip] = (ipCounts[r.ip] || 0) + 1; });
  for (const [ip, count] of Object.entries(ipCounts)) {
    if (count > 1000) reasons.push(`IP ${ip} sent ${count} requests in 1 min`);
  }

  // 2. >500 token requests in 10 min / >500 cereri token în 10 min
  const tenMinAgo   = now - 600_000;
  const totalTokens = log.filter(r => r.ts > tenMinAgo).reduce((s, r) => s + r.tokens, 0);
  if (totalTokens > 500) reasons.push(`${totalTokens} token requests in 10 min`);

  // 3. >100 unique paths in 5 min (path scanning) / >100 căi unice în 5 min (scanare căi)
  const fiveMinAgo  = now - 300_000;
  const uniquePaths = new Set(log.filter(r => r.ts > fiveMinAgo).map(r => r.path));
  if (uniquePaths.size > 100) reasons.push(`${uniquePaths.size} unique paths in 5 min (path scanning)`);

  return { isAbuse: reasons.length > 0, reasons };
}

/**
 * blockTenant — temporarily block a tenant
 * Blochează temporar un tenant
 * @param {string} tenantId
 * @param {string} reason
 * @param {number} durationMs
 */
function blockTenant(tenantId, reason, durationMs) {
  if (!_blockList.has(tenantId)) _blockList.set(tenantId, []);
  _blockList.get(tenantId).push({ reason, until: Date.now() + durationMs, blockedAt: Date.now() });
  tenantEngine.logEvent(tenantId, 'tenant_blocked', { reason, durationMs });
}

/**
 * isBlocked — check if tenant has an active block
 * Verifică dacă tenant-ul are un bloc activ
 * @param {string} tenantId
 * @returns {boolean}
 */
function isBlocked(tenantId) {
  const blocks = _blockList.get(tenantId) || [];
  return blocks.some(b => b.until > Date.now());
}

/**
 * getShieldStatus — current threat level + recent blocks for a tenant
 * Nivel curent de amenințare + blocuri recente pentru un tenant
 * @param {string} tenantId
 * @returns {object}
 */
function getShieldStatus(tenantId) {
  const abuse  = detectAbuse(tenantId);
  const blocks = (_blockList.get(tenantId) || []).filter(b => b.until > Date.now() - 3_600_000);
  const level  = abuse.isAbuse ? 'high' : (blocks.length > 0 ? 'medium' : 'low');
  return { tenantId, threatLevel: level, isBlocked: isBlocked(tenantId), activeBlocks: blocks, abuseSignals: abuse.reasons };
}

/**
 * watchdogCycle — runs every minute, scans all tenants for abuse
 * Rulează în fiecare minut, scanează toți tenanții pentru abuz
 */
function watchdogCycle() {
  const tenants = tenantEngine.getAllTenants();
  for (const tenant of tenants) {
    try {
      const { isAbuse, reasons } = detectAbuse(tenant.id);
      if (isAbuse) {
        blockTenant(tenant.id, reasons.join('; '), 300_000); // 5-min block / blocare 5 min
        tenantEngine.logTenantLog(tenant.id, 'warn', `Abuse detected: ${reasons.join('; ')}`);
      }
    } catch (_) { /* keep cycling */ }
  }
}

// =============================================================================
// §6  GLOBAL ORCHESTRATOR BRAIN (GOB)
// Creierul orchestratorului global
// =============================================================================

// In-memory aggregate counters / Contoare agregate în memorie
const _globalStats = {
  totalRequests:   0,
  totalErrors:     0,
  responseTimes:   [],   // last 1000 durations / ultimele 1000 durate
  optimizeEvents:  [],
};

/** Append a response time sample, capped at 1000 / Adaugă un eșantion de timp de răspuns, limitat la 1000 */
function _recordResponseTime(ms) {
  _globalStats.responseTimes.push(ms);
  if (_globalStats.responseTimes.length > 1000) _globalStats.responseTimes.shift();
}

/**
 * getSystemHealth — aggregated health snapshot
 * Instantaneu de sănătate agregat
 * @returns {object}
 */
function getSystemHealth() {
  const tenants       = tenantEngine.getAllTenants();
  const activeCount   = tenants.filter(t => t.status === 'active').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;
  const avgRT         = _globalStats.responseTimes.length
    ? Math.round(_globalStats.responseTimes.reduce((a, b) => a + b, 0) / _globalStats.responseTimes.length)
    : 0;
  const errorRate     = _globalStats.totalRequests > 0
    ? (_globalStats.totalErrors / _globalStats.totalRequests)
    : 0;

  return {
    tenantCount:     tenants.length,
    activeCount,
    suspendedCount,
    totalRequests:   _globalStats.totalRequests,
    errorRate:       parseFloat(errorRate.toFixed(4)),
    avgResponseTime: avgRT,
  };
}

/**
 * getScalingRecommendation — recommend scale direction based on usage
 * Recomandare direcție de scalare pe baza utilizării
 * @returns {{ scale: 'up'|'down'|'ok', reason: string }}
 */
function getScalingRecommendation() {
  const health = getSystemHealth();

  if (health.errorRate > 0.05 || health.avgResponseTime > 3000) {
    return { scale: 'up', reason: `High error rate (${health.errorRate}) or slow response (${health.avgResponseTime}ms)` };
  }
  if (health.activeCount === 0 || (health.totalRequests < 100 && health.avgResponseTime < 200)) {
    return { scale: 'down', reason: 'Low activity — scale down to reduce cost' };
  }
  return { scale: 'ok', reason: 'System within normal operating parameters' };
}

/**
 * getFailoverStatus — primary/failover region status
 * Status regiune primară/failover
 * @returns {object}
 */
function getFailoverStatus() {
  return {
    primaryRegion:  process.env.PRIMARY_REGION   || 'eu-central-1',
    failoverRegion: process.env.FAILOVER_REGION  || 'eu-west-1',
    status:         'primary_active',
    lastChecked:    new Date().toISOString(),
  };
}

/**
 * optimizeTenants — suspend tenants idle for 30 days, log optimization events
 * Suspendă tenanții inactivi 30 de zile, înregistrează evenimentele de optimizare
 */
function optimizeTenants() {
  const cutoff  = Date.now() - 30 * 24 * 3_600_000;
  const tenants = tenantEngine.getAllTenants().filter(t => t.status === 'active');
  let optimized = 0;

  for (const tenant of tenants) {
    try {
      const log    = _requestLog.get(tenant.id) || [];
      const recent = log.filter(r => r.ts > cutoff);
      if (recent.length === 0) {
        tenantEngine.suspendTenant(tenant.id, 'Idle for 30+ days — auto-optimized');
        tenantEngine.logEvent(tenant.id, 'idle_suspended', { at: new Date().toISOString() });
        _globalStats.optimizeEvents.push({ tenantId: tenant.id, at: Date.now(), reason: 'idle_30d' });
        optimized++;
      }
    } catch (_) { /* non-critical */ }
  }

  return { optimized };
}

/**
 * getGlobalStats — aggregated stats for admin panel
 * Statistici agregate pentru panoul de administrare
 * @returns {object}
 */
function getGlobalStats() {
  const health     = getSystemHealth();
  const tenants    = tenantEngine.getAllTenants();
  const scaling    = getScalingRecommendation();
  const failover   = getFailoverStatus();
  const scheduler  = getSchedulerStatus();

  return {
    health,
    scaling,
    failover,
    schedulerJobCount: Object.values(scheduler).reduce((s, arr) => s + arr.length, 0),
    optimizeEvents:    _globalStats.optimizeEvents.slice(-20),
    tenantBreakdown: {
      total:     tenants.length,
      active:    tenants.filter(t => t.status === 'active').length,
      suspended: tenants.filter(t => t.status === 'suspended').length,
      trial:     tenants.filter(t => t.status === 'trial').length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * runGlobalBrain — orchestrates all sub-systems: health, auto-heal, watchdog, scaling
 * Orchestrează toate sub-sistemele: sănătate, auto-vindecare, watchdog, scalare
 * @returns {object}
 */
function runGlobalBrain() {
  const health  = getSystemHealth();
  const scaling = getScalingRecommendation();

  autoHealCycle();
  watchdogCycle();

  // Record the brain run globally / Înregistrare rulare globală a creierului
  _globalStats.totalRequests++;

  tenantEngine.getAllTenants().slice(0, 1).forEach(t => {
    // Log a single system-level event to avoid log spam
    // Înregistrare un singur eveniment la nivel de sistem pentru a evita spam-ul de log
    tenantEngine.logEvent(t.id, 'gob_cycle', { health, scaling, at: new Date().toISOString() });
  });

  return { health, scaling, at: new Date().toISOString() };
}

// =============================================================================
// Cron tasks for this module / Sarcini cron pentru acest modul
// =============================================================================
let _cronAhe    = null;
let _cronWds    = null;
let _cronGob    = null;

// =============================================================================
// Legacy subsystem methods (TCL / MSE / SCH / AHE / WDS / GOB)
// Metode subsistem vechi — delegate-uri din instanța OrchestratorV4 de mai jos
// =============================================================================

const _legacyOrch = {
  // ------- TCL -------
  loadTenantContext,
  invalidateTenantContext,

  // ------- MSE -------
  executeModuleForTenant,
  getModuleStatus,

  // ------- SCH -------
  scheduleJob,
  cancelJob,
  getJobs,
  runJob,
  getSchedulerStatus,

  // ------- AHE -------
  detectTenantErrors,
  repairModule,
  regenerateConfigs,
  resetSandbox,
  autoHealCycle,
  getHealHistory,

  // ------- WDS -------
  recordRequest,
  detectAbuse,
  blockTenant,
  isBlocked,
  getShieldStatus,
  watchdogCycle,

  // ------- GOB -------
  getSystemHealth,
  getScalingRecommendation,
  getFailoverStatus,
  optimizeTenants,
  getGlobalStats,
  runGlobalBrain,

  // ------- Lifecycle -------

  /**
   * init — start all sub-system cron jobs and built-in scheduler jobs
   * Pornește toate job-urile cron ale sub-sistemelor și job-urile built-in
   */
  init() {
    _scheduleBuiltinJobs();

    // AHE every 5 min / AHE la fiecare 5 min
    _cronAhe = cron.schedule('*/5 * * * *', () => {
      try { autoHealCycle(); } catch (_) { /* non-critical */ }
    });

    // WDS every 1 min / WDS la fiecare minut
    _cronWds = cron.schedule('* * * * *', () => {
      try { watchdogCycle(); } catch (_) { /* non-critical */ }
    });

    // GOB health every 10 min / GOB sănătate la fiecare 10 min
    _cronGob = cron.schedule('*/10 * * * *', () => {
      try { runGlobalBrain(); } catch (_) { /* non-critical */ }
    });
  },

  /**
   * stop — stop all managed cron jobs
   * Oprește toate job-urile cron gestionate
   */
  stop() {
    if (_cronAhe) { _cronAhe.stop(); _cronAhe = null; }
    if (_cronWds) { _cronWds.stop(); _cronWds = null; }
    if (_cronGob) { _cronGob.stop(); _cronGob = null; }
    _builtinTasks.forEach(t => t.stop());
    _builtinTasks.length = 0;

    // Stop all per-tenant jobs / Oprire toate job-urile per-tenant
    for (const tenantJobs of _schedulerJobs.values()) {
      for (const { task } of tenantJobs.values()) task.stop();
    }
    _schedulerJobs.clear();
  },

  /**
   * getStatus — full status report
   * Raport complet de stare
   * @returns {object}
   */
  getStatus() {
    return {
      health:    getSystemHealth(),
      scaling:   getScalingRecommendation(),
      failover:  getFailoverStatus(),
      scheduler: getSchedulerStatus(),
      globalStats: _globalStats.optimizeEvents.slice(-5),
      running: {
        ahe: _cronAhe !== null,
        wds: _cronWds !== null,
        gob: _cronGob !== null,
      },
    };
  },

  /**
   * createExpressRouter — returns an Express Router with all orchestrator endpoints
   * Returnează un Router Express cu toate endpoint-urile orchestratorului
   * @returns {express.Router}
   */
  createExpressRouter() {
    const router = express.Router();

    // GET /context/:tenantId — load tenant context
    // Încărcare context tenant
    router.get('/context/:tenantId', (req, res) => {
      try {
        const ctx = loadTenantContext(req.params.tenantId);
        res.json({ ok: true, context: ctx });
      } catch (err) {
        res.status(404).json({ ok: false, error: err.message });
      }
    });

    // POST /module/execute — execute a module for a tenant
    // Execuție modul pentru un tenant
    router.post('/module/execute', async (req, res) => {
      const { tenantId, moduleName, input } = req.body || {};
      if (!tenantId || !moduleName) return res.status(400).json({ ok: false, error: 'tenantId and moduleName required' });
      try {
        const result = await executeModuleForTenant(tenantId, moduleName, input);
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    // GET /jobs/:tenantId — list tenant scheduled jobs
    // Listare job-uri planificate tenant
    router.get('/jobs/:tenantId', (req, res) => {
      res.json({ ok: true, jobs: getJobs(req.params.tenantId) });
    });

    // POST /jobs/:tenantId/run — force-run a tenant job
    // Forțare execuție job tenant
    router.post('/jobs/:tenantId/run', async (req, res) => {
      const { jobName } = req.body || {};
      if (!jobName) return res.status(400).json({ ok: false, error: 'jobName required' });
      try {
        await runJob(req.params.tenantId, jobName);
        res.json({ ok: true });
      } catch (err) {
        res.status(404).json({ ok: false, error: err.message });
      }
    });

    // GET /heal/:tenantId — heal history
    // Istoric de vindecare
    router.get('/heal/:tenantId', (req, res) => {
      res.json({ ok: true, history: getHealHistory(req.params.tenantId) });
    });

    // POST /heal/:tenantId/repair — repair a module
    // Reparare modul
    router.post('/heal/:tenantId/repair', (req, res) => {
      const { moduleName } = req.body || {};
      if (!moduleName) return res.status(400).json({ ok: false, error: 'moduleName required' });
      try {
        repairModule(req.params.tenantId, moduleName);
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    // GET /shield/:tenantId — shield status
    // Status scut
    router.get('/shield/:tenantId', (req, res) => {
      res.json({ ok: true, shield: getShieldStatus(req.params.tenantId) });
    });

    // GET /global/health — system health snapshot
    // Instantaneu de sănătate sistem
    router.get('/global/health', (_req, res) => {
      res.json({ ok: true, health: getSystemHealth() });
    });

    // GET /global/stats — aggregated global stats
    // Statistici globale agregate
    router.get('/global/stats', (_req, res) => {
      res.json({ ok: true, stats: getGlobalStats() });
    });

    // GET /status — full orchestrator status
    // Stare completă a orchestratorului
    router.get('/status', (_req, res) => {
      res.json({ ok: true, status: orchestratorV4.getStatus() });
    });

    return router;
  },
};
'use strict';

/**
 * ORCHESTRATOR V4 — Zeus AI Unicorn Multi-Tenant SaaS Platform
 *
 * Per-tenant execution engine and scaling controller:
 *   1. Per-tenant task queues (isolated from other tenants)
 *   2. Priority scheduling (enterprise > pro > starter > free)
 *   3. Per-tenant concurrency limits based on plan
 *   4. Automatic back-pressure and queue overflow protection
 *   5. Health monitoring of all tenant execution contexts
 *   6. Self-healing: detect and recover stalled tenant queues
 *   7. Global load balancing across worker slots
 *   8. Backward compat: single-tenant (default) always present
 */

const EventEmitter = require('events');
const tenantManager = require('./tenant-manager');

// ── Config ────────────────────────────────────────────────────────────────────
const PLAN_CONCURRENCY = {
  free:       1,
  starter:    3,
  pro:        10,
  enterprise: 50,
};

const PLAN_QUEUE_SIZE = {
  free:       20,
  starter:    100,
  pro:        500,
  enterprise: 5_000,
};

const PLAN_PRIORITY = {
  enterprise: 0,
  pro:        1,
  starter:    2,
  free:       3,
};

const STALL_DETECT_MS   = parseInt(process.env.ORCH_V4_STALL_MS   || '30000', 10);
const HEALTH_INTERVAL_MS = parseInt(process.env.ORCH_V4_HEALTH_MS || '15000', 10);

// ── Per-tenant execution context ──────────────────────────────────────────────

class TenantExecutionContext {
  constructor(tenantId, plan) {
    this.tenantId   = tenantId;
    this.plan       = plan;
    this.concurrency = PLAN_CONCURRENCY[plan] || 1;
    this.maxQueue    = PLAN_QUEUE_SIZE[plan]   || 20;
    this.priority    = PLAN_PRIORITY[plan]     || 3;

    this._queue      = [];
    this._running    = 0;
    this._stats      = { enqueued: 0, completed: 0, failed: 0, overflows: 0, stalls: 0 };
    this._lastActivity = Date.now();
    this._status     = 'idle';
  }

  canAccept() {
    return this._queue.length < this.maxQueue;
  }

  enqueue(task) {
    if (!this.canAccept()) {
      this._stats.overflows++;
      throw new Error(`[OrchestratorV4] Queue full for tenant ${this.tenantId} (plan: ${this.plan})`);
    }
    this._queue.push(task);
    this._stats.enqueued++;
    this._lastActivity = Date.now();
    this._drain();
  }

  _drain() {
    while (this._running < this.concurrency && this._queue.length > 0) {
      const task = this._queue.shift();
      this._running++;
      this._status = 'running';
      this._execute(task);
    }
    if (this._running === 0 && this._queue.length === 0) this._status = 'idle';
  }

  async _execute(task) {
    const startTs = Date.now();
    try {
      const result = await task.fn();
      this._stats.completed++;
      task.resolve(result);
    } catch (err) {
      this._stats.failed++;
      task.reject(err);
    } finally {
      this._running--;
      this._lastActivity = Date.now();
      this._drain();
    }
  }

  getStats() {
    return {
      tenantId: this.tenantId,
      plan: this.plan,
      status: this._status,
      running: this._running,
      queued: this._queue.length,
      concurrency: this.concurrency,
      maxQueue: this.maxQueue,
      priority: this.priority,
      ...this._stats,
      lastActivity: new Date(this._lastActivity).toISOString(),
    };
  }

  isStalled() {
    return this._running > 0 && (Date.now() - this._lastActivity) > STALL_DETECT_MS;
  }

  heal() {
    if (this.isStalled()) {
      this._stats.stalls++;
      this._running = 0;
      this._status = 'idle';
      this._drain();
      console.warn(`[OrchestratorV4] Healed stalled context for tenant ${this.tenantId}`);
    }
  }
}

// ── Orchestrator V4 ───────────────────────────────────────────────────────────

class OrchestratorV4 extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 60000;
    this._contexts = new Map(); // Map<tenantId, TenantExecutionContext>
    this._running  = false;
    this._healthTimer = null;
    this._globalStats = {
      totalTasksDispatched: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
    };
  }

  _getContext(tenantId) {
    if (!this._contexts.has(tenantId)) {
      const tenant = tenantManager.getTenant(tenantId);
      const plan   = tenant ? tenant.plan : 'free';
      this._contexts.set(tenantId, new TenantExecutionContext(tenantId, plan));
    }
    return this._contexts.get(tenantId);
  }

  /**
   * dispatch(tenantId, fn, opts)
   * fn must be an async function returning a result.
   * Returns a Promise that resolves/rejects when fn completes.
   */
  dispatch(tenantId, fn, { timeout = 60_000 } = {}) {
    const ctx = this._getContext(tenantId);
    this._globalStats.totalTasksDispatched++;

    // Clamp timeout to prevent resource exhaustion from caller-controlled durations
    const safeTimeout = Math.min(Math.max(parseInt(timeout, 10) || 60_000, 1_000), 300_000);

    return new Promise((resolve, reject) => {
      const wrappedFn = () => {
        const timer = setTimeout(() => {
          reject(new Error(`[OrchestratorV4] Task timeout (${safeTimeout}ms) for tenant ${tenantId}`));
        }, safeTimeout);

        return Promise.resolve()
          .then(() => fn())
          .then(r => { clearTimeout(timer); return r; })
          .catch(e => { clearTimeout(timer); throw e; });
      };

      try {
        ctx.enqueue({ fn: wrappedFn, resolve: (r) => { this._globalStats.totalTasksCompleted++; resolve(r); }, reject: (e) => { this._globalStats.totalTasksFailed++; reject(e); } });
      } catch (err) {
        this._globalStats.totalTasksFailed++;
        reject(err);
      }
    });
  }

  /**
   * dispatchBatch(tasks)
   * tasks = [{ tenantId, fn, opts }]
   * Tasks are sorted by tenant priority before dispatch.
   */
  async dispatchBatch(tasks = []) {
    const sorted = [...tasks].sort((a, b) => {
      const ctxA = this._getContext(a.tenantId);
      const ctxB = this._getContext(b.tenantId);
      return ctxA.priority - ctxB.priority;
    });

    const results = await Promise.allSettled(
      sorted.map(t => this.dispatch(t.tenantId, t.fn, t.opts || {}))
    );

    return results.map((r, i) => ({
      tenantId: sorted[i].tenantId,
      status: r.status,
      value: r.value,
      reason: r.reason ? r.reason.message : undefined,
    }));
  }

  start() {
    if (this._running) return;
    this._running = true;
    // Init default tenant context
    this._getContext(tenantManager.DEFAULT_TENANT_ID);

    this._healthTimer = setInterval(() => this._healthCheck(), HEALTH_INTERVAL_MS);
    this._healthTimer.unref();
    console.log('[OrchestratorV4] Started');
  }

  stop() {
    this._running = false;
    if (this._healthTimer) { clearInterval(this._healthTimer); this._healthTimer = null; }
    console.log('[OrchestratorV4] Stopped');
  }

  _healthCheck() {
    for (const ctx of this._contexts.values()) {
      // Sync plan if tenant plan changed
      const tenant = tenantManager.getTenant(ctx.tenantId);
      if (tenant && tenant.plan !== ctx.plan) {
        ctx.plan        = tenant.plan;
        ctx.concurrency = PLAN_CONCURRENCY[tenant.plan] || 1;
        ctx.maxQueue    = PLAN_QUEUE_SIZE[tenant.plan]   || 20;
        ctx.priority    = PLAN_PRIORITY[tenant.plan]     || 3;
      }
      ctx.heal();
    }
    this.emit('health', this.getStatus());
  }

  getContextStats(tenantId) {
    if (!this._contexts.has(tenantId)) return null;
    return this._contexts.get(tenantId).getStats();
  }

  getAllContextStats() {
    const out = [];
    for (const ctx of this._contexts.values()) {
      out.push(ctx.getStats());
    }
    return out;
  }

  getStatus() {
    const contexts = this.getAllContextStats();
    return {
      module: 'OrchestratorV4',
      status: this._running ? 'active' : 'stopped',
      tenantContexts: contexts.length,
      globalStats: this._globalStats,
      contexts,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const orchestratorV4 = new OrchestratorV4();
orchestratorV4.start();

// Attach legacy subsystem methods not present on OrchestratorV4 class
// Atașare metode subsistem vechi care nu există pe clasa OrchestratorV4
orchestratorV4.init               = () => _legacyOrch.init();
orchestratorV4.createExpressRouter = () => _legacyOrch.createExpressRouter();
orchestratorV4.executeModuleForTenant = _legacyOrch.executeModuleForTenant;
orchestratorV4.scheduleJob            = _legacyOrch.scheduleJob;
orchestratorV4.cancelJob              = _legacyOrch.cancelJob;
orchestratorV4.getJobs                = _legacyOrch.getJobs;
orchestratorV4.runJob                 = _legacyOrch.runJob;
orchestratorV4.getSchedulerStatus     = _legacyOrch.getSchedulerStatus;
orchestratorV4.repairModule           = _legacyOrch.repairModule;
orchestratorV4.getHealHistory         = _legacyOrch.getHealHistory;
orchestratorV4.getShieldStatus        = _legacyOrch.getShieldStatus;
orchestratorV4.loadTenantContext      = _legacyOrch.loadTenantContext;
orchestratorV4.invalidateTenantContext = _legacyOrch.invalidateTenantContext;

module.exports = orchestratorV4;
