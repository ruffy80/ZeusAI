// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// self-evolving-engine.js — Self-Evolving Engine (SEE) for Unicorn SaaS
// Motor de auto-evoluție (SEE) pentru platforma Unicorn SaaS multi-tenant
// =============================================================================
// Sub-systems / Sub-sisteme:
//   1. Module Analyzer      — LOC, complexity, error patterns, usage stats
//   2. Behavior Profiler    — call counts, avg duration, error rate per tenant
//   3. Evolution Planner    — generates refactor/repair/deprecate/newModule tasks
//   4. Code Generator       — safe stub mode; proposals only, no auto-write
//   5. Safety Validator     — syntax check + dangerous-pattern scan
//   6. Auto-Deploy Integrator — validated rollout, monitoring, rollback
// =============================================================================

'use strict';

const fs          = require('fs');
const path        = require('path');
const crypto      = require('crypto');
const { execFile } = require('child_process');
const express     = require('express');
const cron        = require('node-cron');

// ---------------------------------------------------------------------------
// Peer modules / Module peer
// ---------------------------------------------------------------------------
let aiOrchestrator = null;
let autoRepair     = null;

try { aiOrchestrator = require('./ai-orchestrator'); } catch (_) {}
try { autoRepair     = require('./auto-repair');      } catch (_) {}

// ---------------------------------------------------------------------------
// Paths / Căi
// ---------------------------------------------------------------------------
const MODULES_DIR   = __dirname;
const GENERATED_DIR = path.join(__dirname, '..', 'generated');
const BACKUPS_DIR   = path.join(GENERATED_DIR, 'backups');

// Ensure generated directories exist / Asigură existența directoarelor generate
function _ensureDirs() {
  [GENERATED_DIR, BACKUPS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}
_ensureDirs();

// ---------------------------------------------------------------------------
// In-memory state / Stare în memorie
// ---------------------------------------------------------------------------
/** @type {Map<string, object>} moduleName → analysis result */
const _analysisCache = new Map();

/** @type {Map<string, object>} moduleName → behavior profile */
const _behaviorCache = new Map();

/** @type {{ tasks: object[], generatedAt: string|null }} */
const _evolutionPlan = { tasks: [], generatedAt: null };

/** @type {Map<string, object>} taskId → task */
const _tasks = new Map();

/** @type {Map<string, object>} proposalId → proposal */
const _proposals = new Map();

/** @type {object[]} recent rollout history */
const _rolloutHistory = [];

const _state = {
  name:           'self-evolving-engine',
  label:          'Self-Evolving Engine (SEE)',
  startedAt:      null,
  running:        false,
  lastAnalysis:   null,
  lastPlan:       null,
  analysisCount:  0,
  planCount:      0,
  lastError:      null,
  cronHandles:    [],
};

// =============================================================================
// §1  MODULE ANALYZER — Analizor de module
// =============================================================================

/**
 * analyzeModule — scans a single module file for metrics
 * Analizează un singur fișier modul pentru metrici
 * @param {string} moduleName — bare name (e.g. 'billing-engine') or full filename
 * @returns {object}
 */
function analyzeModule(moduleName) {
  const fileName = moduleName.endsWith('.js') ? moduleName : `${moduleName}.js`;
  const filePath  = path.join(MODULES_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return { moduleName, error: 'File not found / Fișier negăsit', filePath };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const loc   = lines.length;

  // Count exported functions / Numără funcțiile exportate
  const exportedFunctions = (raw.match(/module\.exports\s*=\s*\{[^}]*\}/s) || [''])[0]
    .split(',').filter(Boolean).length
    + (raw.match(/exports\.[a-zA-Z_$]/g) || []).length;

  // Error-handling patterns / Tipare de gestionare erori
  const tryCatchCount   = (raw.match(/\btry\s*\{/g) || []).length;
  const catchCount      = (raw.match(/\bcatch\s*\(/g) || []).length;
  const rejectCount     = (raw.match(/reject\s*\(/g) || []).length;
  const errorHandlers   = tryCatchCount + catchCount + rejectCount;

  // Complexity heuristic: long functions, nested callbacks, switch statements
  // Euristică complexitate: funcții lungi, callback-uri imbricate, switch
  const nestingScore  = Math.min(100, (raw.match(/\{\s*\n/g) || []).length * 0.3);
  const switchScore   = Math.min(30,  (raw.match(/\bswitch\s*\(/g) || []).length * 5);
  const callbackScore = Math.min(20,  (raw.match(/function\s*\(/g) || []).length * 0.5);
  const locScore      = Math.min(30,  loc / 50);
  const complexityScore = Math.round(Math.min(100, nestingScore + switchScore + callbackScore + locScore));

  const stat      = fs.statSync(filePath);
  const lastModified = stat.mtime.toISOString();

  // Usage stats: check behavior cache if already profiled
  // Statistici utilizare: verifică cache-ul de comportament dacă a fost deja profilat
  const behavior  = _behaviorCache.get(moduleName) || null;
  const usageStats = behavior
    ? { callCount: behavior.callCount, errorRate: behavior.errorRate, lastCalled: behavior.lastCalled }
    : { callCount: 0, errorRate: 0, lastCalled: null };

  const result = {
    moduleName,
    filePath,
    loc,
    exportedFunctions,
    errorHandlers: { tryCatch: tryCatchCount, catch: catchCount, reject: rejectCount, total: errorHandlers },
    complexityScore,
    lastModified,
    usageStats,
    analyzedAt: new Date().toISOString(),
  };

  _analysisCache.set(moduleName, result);
  return result;
}

/**
 * analyzeAllModules — scans every .js file in MODULES_DIR
 * Analizează toate fișierele .js din MODULES_DIR
 * @returns {object[]}
 */
function analyzeAllModules() {
  const files = fs.readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.js') && f !== 'self-evolving-engine.js');

  const results = files.map(f => {
    try {
      return analyzeModule(f.replace(/\.js$/, ''));
    } catch (err) {
      return { moduleName: f, error: err.message };
    }
  });

  _state.lastAnalysis  = new Date().toISOString();
  _state.analysisCount += 1;
  return results;
}

/**
 * getAnalysisReport — sorted list by complexity then error count
 * Raport de analiză sortat după complexitate, apoi erori
 * @returns {object[]}
 */
function getAnalysisReport() {
  const items = [..._analysisCache.values()].filter(r => !r.error);
  return items.sort((a, b) => {
    const diff = b.complexityScore - a.complexityScore;
    if (diff !== 0) return diff;
    return (b.errorHandlers?.total || 0) - (a.errorHandlers?.total || 0);
  });
}

// =============================================================================
// §2  BEHAVIOR & USAGE PROFILER — Profiler de comportament și utilizare
// =============================================================================

// In-memory call log: moduleName → [{ tenantId, duration, error, ts }]
// Jurnal apeluri în memorie
const _callLog = new Map();

/**
 * recordCall — called by other modules to register a module invocation
 * Apelat de alte module pentru a înregistra o invocare
 * @param {string} moduleName
 * @param {string} tenantId
 * @param {number} durationMs
 * @param {string|null} errorMsg
 */
function recordCall(moduleName, tenantId, durationMs, errorMsg = null) {
  if (!_callLog.has(moduleName)) _callLog.set(moduleName, []);
  const log = _callLog.get(moduleName);
  log.push({ tenantId, durationMs, error: errorMsg, ts: Date.now() });
  // Keep last 2000 entries per module / Păstrează ultimele 2000 înregistrări per modul
  if (log.length > 2000) log.splice(0, log.length - 2000);
}

/**
 * profileModule — derive behavior profile from call log
 * Derivă profilul de comportament din jurnalul de apeluri
 * @param {string} moduleName
 * @param {string|null} tenantId — filter by tenant, or null for all
 * @returns {object}
 */
function profileModule(moduleName, tenantId = null) {
  const raw = (_callLog.get(moduleName) || []).filter(e =>
    tenantId == null || e.tenantId === tenantId
  );

  const callCount    = raw.length;
  const avgDuration  = callCount
    ? Math.round(raw.reduce((s, e) => s + (e.durationMs || 0), 0) / callCount)
    : 0;
  const errors       = raw.filter(e => e.error);
  const errorRate    = callCount ? parseFloat(((errors.length / callCount) * 100).toFixed(2)) : 0;
  const lastCalled   = raw.length ? new Date(Math.max(...raw.map(e => e.ts))).toISOString() : null;

  // Top errors: most frequent error messages / Cele mai frecvente mesaje de eroare
  const errFreq = {};
  errors.forEach(e => { errFreq[e.error] = (errFreq[e.error] || 0) + 1; });
  const topErrors = Object.entries(errFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([msg, count]) => ({ msg, count }));

  const profile = { moduleName, tenantId, callCount, avgDuration, errorRate, lastCalled, topErrors, profiledAt: new Date().toISOString() };
  _behaviorCache.set(moduleName, profile);
  return profile;
}

/**
 * profileAllModules — profile every module across all tenants
 * Profilează toate modulele pentru toți tenanții
 * @returns {object[]}
 */
function profileAllModules() {
  const files = fs.readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.js') && f !== 'self-evolving-engine.js');
  return files.map(f => profileModule(f.replace(/\.js$/, ''), null));
}

/**
 * getBehaviorReport — behavior summary for evolution planning
 * Rezumat de comportament pentru planificarea evoluției
 * @returns {object}
 */
function getBehaviorReport() {
  const profiles = [..._behaviorCache.values()];
  return {
    total:       profiles.length,
    withErrors:  profiles.filter(p => p.errorRate > 0).length,
    unused:      profiles.filter(p => p.callCount === 0).length,
    highError:   profiles.filter(p => p.errorRate > 5),
    mostCalled:  [...profiles].sort((a, b) => b.callCount - a.callCount).slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// §3  EVOLUTION PLANNER — Planificator de evoluție
// =============================================================================

const COMPLEXITY_REFACTOR_THRESHOLD = 80;   // complexity score / scor complexitate
const ERROR_RATE_REPAIR_THRESHOLD   = 5;    // % error rate / rata erorilor %
const UNUSED_DAYS_DEPRECATE         = 30;   // days without calls / zile fără apeluri

/**
 * planEvolution — generate evolution tasks from analysis + behavior data
 * Generează sarcini de evoluție din datele de analiză și comportament
 * @returns {{ tasks: object[] }}
 */
function planEvolution() {
  const tasks = [];
  const now   = Date.now();

  // Refresh profiles before planning / Reîmprospătează profilurile înainte de planificare
  const analyses  = getAnalysisReport();
  const profiles  = [..._behaviorCache.values()];

  // Map behavior by moduleName for fast lookup
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.moduleName] = p; });

  for (const analysis of analyses) {
    const { moduleName, complexityScore, loc } = analysis;
    const behavior = profileMap[moduleName] || { callCount: 0, errorRate: 0, lastCalled: null };

    // Candidate for refactor / Candidat pentru refactorizare
    if (complexityScore > COMPLEXITY_REFACTOR_THRESHOLD) {
      tasks.push({
        id:       crypto.randomUUID(),
        type:     'refactor',
        target:   moduleName,
        reason:   `Complexity score ${complexityScore}/100 exceeds threshold ${COMPLEXITY_REFACTOR_THRESHOLD} / Scor complexitate depășit`,
        priority: complexityScore >= 95 ? 'critical' : complexityScore >= 90 ? 'high' : 'medium',
        status:   'pending',
        metadata: { complexityScore, loc },
        createdAt: new Date().toISOString(),
      });
    }

    // Candidate for repair / Candidat pentru reparare
    if (behavior.errorRate > ERROR_RATE_REPAIR_THRESHOLD) {
      tasks.push({
        id:       crypto.randomUUID(),
        type:     'repair',
        target:   moduleName,
        reason:   `Error rate ${behavior.errorRate}% exceeds threshold ${ERROR_RATE_REPAIR_THRESHOLD}% / Rata erorilor depășită`,
        priority: behavior.errorRate >= 20 ? 'critical' : behavior.errorRate >= 10 ? 'high' : 'medium',
        status:   'pending',
        metadata: { errorRate: behavior.errorRate, topErrors: behavior.topErrors },
        createdAt: new Date().toISOString(),
      });
    }

    // Candidate for deprecation — no calls in UNUSED_DAYS_DEPRECATE days
    // Candidat pentru deprecare — fără apeluri în ultimele N zile
    const lastCalledMs = behavior.lastCalled ? new Date(behavior.lastCalled).getTime() : 0;
    const daysSinceCall = (now - lastCalledMs) / (1000 * 60 * 60 * 24);
    if (behavior.callCount > 0 && daysSinceCall > UNUSED_DAYS_DEPRECATE) {
      tasks.push({
        id:       crypto.randomUUID(),
        type:     'deprecate',
        target:   moduleName,
        reason:   `No calls in ${Math.round(daysSinceCall)} days (threshold: ${UNUSED_DAYS_DEPRECATE}) / Nicio invocare în ultimele zile`,
        priority: 'low',
        status:   'pending',
        metadata: { daysSinceCall: Math.round(daysSinceCall), lastCalled: behavior.lastCalled },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Persist tasks in map / Persistă sarcinile în map
  tasks.forEach(t => _tasks.set(t.id, t));
  _evolutionPlan.tasks      = tasks;
  _evolutionPlan.generatedAt = new Date().toISOString();
  _state.lastPlan  = _evolutionPlan.generatedAt;
  _state.planCount += 1;

  return { tasks, generatedAt: _evolutionPlan.generatedAt };
}

/**
 * getEvolutionPlan — current plan snapshot
 * Instantaneu al planului curent
 */
function getEvolutionPlan() {
  return {
    tasks:       [..._tasks.values()],
    generatedAt: _evolutionPlan.generatedAt,
  };
}

/**
 * approveTask — mark a task as approved for code generation
 * Marchează o sarcină ca aprobată pentru generarea de cod
 * @param {string} taskId
 * @returns {object}
 */
function approveTask(taskId) {
  const task = _tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId} / Sarcină negăsită`);
  if (task.status === 'rejected') throw new Error('Cannot approve a rejected task / Nu se poate aproba o sarcină respinsă');
  task.status     = 'approved';
  task.approvedAt = new Date().toISOString();
  return task;
}

/**
 * rejectTask — mark a task as rejected with reason
 * Marchează o sarcină ca respinsă cu motiv
 * @param {string} taskId
 * @param {string} reason
 * @returns {object}
 */
function rejectTask(taskId, reason = '') {
  const task = _tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId} / Sarcină negăsită`);
  task.status       = 'rejected';
  task.rejectReason = reason;
  task.rejectedAt   = new Date().toISOString();
  return task;
}

// =============================================================================
// §4  CODE GENERATOR (safe/stub mode) — Generator de cod (mod sigur/stub)
// =============================================================================

/**
 * generateModuleCode — use ai-orchestrator to produce an improvement proposal
 * Folosește ai-orchestrator pentru a produce o propunere de îmbunătățire
 * @param {string} taskId
 * @returns {Promise<object>}
 */
async function generateModuleCode(taskId) {
  const task = _tasks.get(taskId);
  if (!task) throw new Error(`Task not found: ${taskId} / Sarcină negăsită`);
  if (task.status !== 'approved') throw new Error('Task must be approved before code generation / Sarcina trebuie aprobată înainte de generarea codului');

  const prompt = `You are a senior Node.js architect reviewing a SaaS backend module.
Module: ${task.target}
Task type: ${task.type}
Reason: ${task.reason}
Metadata: ${JSON.stringify(task.metadata || {})}

Provide a structured improvement plan (NOT executable code) including:
1. Key issues identified
2. Recommended refactoring steps
3. Estimated risk level (low/medium/high)
4. Estimated time to implement
5. Expected impact on performance and reliability

Be concise and actionable. Respond in English.`;

  let proposal = '[AI orchestrator unavailable — stub proposal / orchestrator AI indisponibil]';
  let estimatedImpact = 'unknown';

  if (aiOrchestrator) {
    try {
      const response  = await aiOrchestrator.ask(prompt, { task: 'reasoning', maxTokens: 800 });
      proposal        = typeof response === 'string' ? response : (response?.text || JSON.stringify(response));
      estimatedImpact = task.type === 'repair' ? 'high' : task.type === 'refactor' ? 'medium' : 'low';
    } catch (err) {
      proposal = `[AI error: ${err.message}]`;
    }
  }

  const proposalId = crypto.randomUUID();
  const record = {
    proposalId,
    taskId,
    task: { ...task },
    proposal,
    estimatedImpact,
    status:      'proposed',
    createdAt:   new Date().toISOString(),
    validatedAt: null,
    appliedAt:   null,
  };

  _proposals.set(proposalId, record);
  task.proposalId = proposalId;
  return record;
}

/**
 * applyProposal — (admin-only) writes generated code to backend/generated/
 * (doar admin) Scrie codul generat în backend/generated/
 * Does NOT touch modules dir without explicit safeRollout call.
 * Nu atinge directorul modules fără un apel explicit safeRollout.
 * @param {string} proposalId
 * @returns {object}
 */
function applyProposal(proposalId) {
  const rec = _proposals.get(proposalId);
  if (!rec) throw new Error(`Proposal not found: ${proposalId} / Propunere negăsită`);
  if (rec.status === 'applied') throw new Error('Already applied / Deja aplicată');

  _ensureDirs();

  const outFile = path.join(GENERATED_DIR, `${rec.task.target}.generated.js`);

  // Write a structured proposal file — never executable without review
  // Scrie un fișier propunere structurat — niciodată executabil fără revizuire
  const content = [
    `// AUTO-GENERATED PROPOSAL — NOT executable without review`,
    `// Propunere auto-generată — NU este executabilă fără revizuire`,
    `// Task:       ${rec.taskId}`,
    `// Module:     ${rec.task.target}`,
    `// Type:       ${rec.task.type}`,
    `// Generated:  ${rec.createdAt}`,
    `// Impact:     ${rec.estimatedImpact}`,
    `//`,
    `// ===== PROPOSAL =====`,
    `//`,
    rec.proposal.split('\n').map(l => `// ${l}`).join('\n'),
    `//`,
    `// ===== END PROPOSAL =====`,
    ``,
    `module.exports = { _proposalId: ${JSON.stringify(proposalId)}, _status: 'proposal-only' };`,
  ].join('\n');

  fs.writeFileSync(outFile, content, 'utf8');
  rec.status    = 'applied';
  rec.appliedAt = new Date().toISOString();
  rec.outputFile = outFile;
  return rec;
}

/**
 * getProposals — list all proposals
 * Listează toate propunerile
 * @returns {object[]}
 */
function getProposals() {
  return [..._proposals.values()];
}

// =============================================================================
// §5  REGRESSION & SAFETY VALIDATOR — Validator de regresie și siguranță
// =============================================================================

const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/,              label: 'eval()' },
  { pattern: /\bexec\s*\(/,             label: 'exec()' },
  { pattern: /process\.exit\s*\(/,      label: 'process.exit()' },
  { pattern: /require\s*\(\s*['"]child_process['"]/, label: "require('child_process')" },
  { pattern: /new\s+Function\s*\(/,     label: 'new Function()' },
  { pattern: /vm\.runInThisContext/,    label: 'vm.runInThisContext' },
];

/**
 * runSafetyChecks — scan code string for dangerous patterns
 * Scanează codul pentru tipare periculoase
 * @param {string} code
 * @returns {{ safe: boolean, violations: string[] }}
 */
function runSafetyChecks(code) {
  const violations = [];
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) violations.push(label);
  }
  return { safe: violations.length === 0, violations };
}

/**
 * validateProposal — syntax check via `node --check`, then safety scan
 * Verificare sintaxă via `node --check`, apoi scanare siguranță
 * @param {string} proposalId
 * @returns {Promise<object>}
 */
function validateProposal(proposalId) {
  const rec = _proposals.get(proposalId);
  if (!rec) return Promise.reject(new Error(`Proposal not found: ${proposalId}`));

  // If not yet applied to a file, run safety checks on proposal text only
  // Dacă nu a fost încă aplicat, rulează verificări de siguranță pe textul propunerii
  const codeToCheck = rec.outputFile && fs.existsSync(rec.outputFile)
    ? fs.readFileSync(rec.outputFile, 'utf8')
    : rec.proposal;

  const safety = runSafetyChecks(codeToCheck);
  const report = {
    proposalId,
    syntaxValid: null,
    syntaxError: null,
    safety,
    validatedAt: new Date().toISOString(),
  };

  if (!rec.outputFile || !fs.existsSync(rec.outputFile)) {
    // No file to syntax-check — mark as skipped / Fără fișier pentru verificare sintaxă
    report.syntaxValid = true;
    report.syntaxNote  = 'Syntax check skipped — no output file yet / Verificare sintaxă omisă';
    rec.validationReport = report;
    return Promise.resolve(report);
  }

  return new Promise((resolve) => {
    execFile(process.execPath, ['--check', rec.outputFile], (err) => {
      report.syntaxValid = !err;
      report.syntaxError = err ? err.message : null;
      rec.validationReport = report;
      rec.validatedAt      = report.validatedAt;
      resolve(report);
    });
  });
}

/**
 * getValidationReport — retrieve stored validation report for a proposal
 * Recuperează raportul de validare stocat pentru o propunere
 * @param {string} proposalId
 * @returns {object|null}
 */
function getValidationReport(proposalId) {
  const rec = _proposals.get(proposalId);
  if (!rec) throw new Error(`Proposal not found: ${proposalId}`);
  return rec.validationReport || null;
}

// =============================================================================
// §6  AUTO-DEPLOY & AUTO-HEAL INTEGRATOR — Integrator de auto-deploy și auto-heal
// =============================================================================

/**
 * safeRollout — copy validated .generated.js to modules dir, invalidate require cache
 * Copiază fișierul .generated.js validat în modules dir, invalidează cache require
 * Only proceeds if validation passed / Continuă doar dacă validarea a trecut
 * @param {string} proposalId
 * @returns {object}
 */
function safeRollout(proposalId) {
  const rec = _proposals.get(proposalId);
  if (!rec) throw new Error(`Proposal not found: ${proposalId} / Propunere negăsită`);

  const vr = rec.validationReport;
  if (!vr)         throw new Error('Proposal must be validated before rollout / Propunerea trebuie validată înainte de lansare');
  if (!vr.syntaxValid) throw new Error(`Syntax validation failed: ${vr.syntaxError}`);
  if (!vr.safety.safe) throw new Error(`Safety checks failed: ${vr.safety.violations.join(', ')}`);
  if (!rec.outputFile || !fs.existsSync(rec.outputFile)) {
    throw new Error('No generated file to roll out / Niciun fișier generat de lansat');
  }

  const targetModule = rec.task.target;
  const destFile     = path.join(MODULES_DIR, `${targetModule}.js`);
  const backupFile   = path.join(BACKUPS_DIR, `${targetModule}.${Date.now()}.bak.js`);

  // Backup existing module / Backup modul existent
  if (fs.existsSync(destFile)) {
    fs.copyFileSync(destFile, backupFile);
  }

  // Copy generated file to modules dir / Copiază fișierul generat în modules dir
  fs.copyFileSync(rec.outputFile, destFile);

  // Invalidate Node require cache for module / Invalidează cache-ul require al modulului
  const resolvedPath = require.resolve(destFile);
  if (require.cache[resolvedPath]) delete require.cache[resolvedPath];

  const rolloutRecord = {
    rolloutId:    crypto.randomUUID(),
    proposalId,
    taskId:       rec.taskId,
    targetModule,
    destFile,
    backupFile:   fs.existsSync(backupFile) ? backupFile : null,
    rolledOutAt:  new Date().toISOString(),
    status:       'active',
    monitoring:   true,
    monitorEnd:   new Date(Date.now() + 10 * 60 * 1000).toISOString(), // +10 min
    rolledBackAt: null,
  };

  _rolloutHistory.unshift(rolloutRecord);
  if (_rolloutHistory.length > 50) _rolloutHistory.splice(50);

  rec.status    = 'rolled-out';
  rec.rolloutId = rolloutRecord.rolloutId;

  console.log(`🚀 [SEE] safeRollout: ${targetModule} → ${destFile} (backup: ${rolloutRecord.backupFile})`);
  return rolloutRecord;
}

/**
 * monitorRollout — sample error rates for 10 minutes after rollout
 * Eșantionează ratele de eroare timp de 10 minute după lansare
 * Returns current monitoring status / Returnează starea curentă a monitorizării
 * @param {string} proposalId
 * @returns {object}
 */
function monitorRollout(proposalId) {
  const rollout = _rolloutHistory.find(r => r.proposalId === proposalId);
  if (!rollout) throw new Error(`No rollout found for proposal: ${proposalId}`);

  const now       = Date.now();
  const endTime   = new Date(rollout.monitorEnd).getTime();
  const remaining = Math.max(0, Math.round((endTime - now) / 1000));
  const behavior  = _behaviorCache.get(rollout.targetModule);

  const health = behavior && behavior.errorRate > ERROR_RATE_REPAIR_THRESHOLD
    ? 'degraded'
    : 'healthy';

  return {
    rolloutId:       rollout.rolloutId,
    targetModule:    rollout.targetModule,
    monitorEnd:      rollout.monitorEnd,
    remainingSeconds: remaining,
    monitoring:      remaining > 0,
    health,
    currentErrorRate: behavior?.errorRate ?? 0,
    threshold:       ERROR_RATE_REPAIR_THRESHOLD,
  };
}

/**
 * rollback — restore previous backup version of a module
 * Restabilește versiunea de backup anterioară a unui modul
 * @param {string} proposalId
 * @returns {object}
 */
function rollback(proposalId) {
  const rollout = _rolloutHistory.find(r => r.proposalId === proposalId);
  if (!rollout) throw new Error(`No rollout found for proposal: ${proposalId}`);
  if (rollout.status === 'rolled-back') throw new Error('Already rolled back / Deja restaurat');
  if (!rollout.backupFile || !fs.existsSync(rollout.backupFile)) {
    throw new Error('No backup file available / Niciun fișier de backup disponibil');
  }

  fs.copyFileSync(rollout.backupFile, rollout.destFile);

  // Invalidate require cache after restore / Invalidează cache-ul require după restaurare
  try {
    const resolvedPath = require.resolve(rollout.destFile);
    if (require.cache[resolvedPath]) delete require.cache[resolvedPath];
  } catch (_) {}

  rollout.status       = 'rolled-back';
  rollout.rolledBackAt = new Date().toISOString();
  rollout.monitoring   = false;

  console.log(`↩️  [SEE] rollback: ${rollout.targetModule} restored from ${rollout.backupFile}`);
  return rollout;
}

/**
 * getRolloutHistory — recent rollout records
 * Istoricul recent al lansărilor
 * @returns {object[]}
 */
function getRolloutHistory() {
  return [..._rolloutHistory];
}

// =============================================================================
// §7  LIFECYCLE — init / stop / getStatus
// =============================================================================

/**
 * init — start cron jobs: analysis every 6h, evolution plan every 24h
 * Pornește cron jobs: analiză la 6h, plan evoluție la 24h
 */
function init() {
  if (_state.running) return;
  _state.running   = true;
  _state.startedAt = new Date().toISOString();

  // Every 6 hours — analyze all modules / La fiecare 6 ore — analizează toate modulele
  const analysisCron = cron.schedule('0 */6 * * *', () => {
    try {
      analyzeAllModules();
      profileAllModules();
      console.log(`🔬 [SEE] Analysis cycle complete / Ciclu analiză complet — ${new Date().toISOString()}`);
    } catch (err) {
      _state.lastError = err.message;
      console.error(`❌ [SEE] Analysis error: ${err.message}`);
    }
  });

  // Every 24 hours — generate evolution plan / La fiecare 24 ore — generează plan evoluție
  const planCron = cron.schedule('0 3 * * *', () => {
    try {
      planEvolution();
      console.log(`📋 [SEE] Evolution plan updated / Plan evoluție actualizat — ${new Date().toISOString()}`);
    } catch (err) {
      _state.lastError = err.message;
      console.error(`❌ [SEE] Plan error: ${err.message}`);
    }
  });

  _state.cronHandles = [analysisCron, planCron];

  // Initial run immediately / Rulare inițială imediat
  setImmediate(() => {
    try { analyzeAllModules(); profileAllModules(); } catch (_) {}
  });

  console.log('🧬 [SEE] Self-Evolving Engine started / Motor de auto-evoluție pornit');
}

/**
 * stop — halt cron jobs
 * Oprește cron jobs
 */
function stop() {
  _state.cronHandles.forEach(h => { try { h.stop(); } catch (_) {} });
  _state.cronHandles = [];
  _state.running     = false;
  console.log('⛔ [SEE] Self-Evolving Engine stopped / Motor de auto-evoluție oprit');
}

/**
 * getStatus — full SEE runtime status
 * Starea completă a runtime SEE
 * @returns {object}
 */
function getStatus() {
  return {
    ..._state,
    cronHandles:       undefined,   // not serializable / neserializabil
    analysisModules:   _analysisCache.size,
    behaviorModules:   _behaviorCache.size,
    pendingTasks:      [..._tasks.values()].filter(t => t.status === 'pending').length,
    approvedTasks:     [..._tasks.values()].filter(t => t.status === 'approved').length,
    proposals:         _proposals.size,
    rollouts:          _rolloutHistory.length,
    aiOrchestratorOk:  aiOrchestrator ? true : false,
    autoRepairOk:      autoRepair ? true : false,
    memMB:             Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec:         Math.round(process.uptime()),
  };
}

// =============================================================================
// §8  EXPRESS ROUTER — Router Express
// =============================================================================

/**
 * createExpressRouter — returns a configured Express Router
 * Returnează un Router Express configurat
 * @returns {express.Router}
 */
function createExpressRouter() {
  const router = express.Router();

  // GET /analysis — full analysis report / Raport complet de analiză
  router.get('/analysis', (_req, res) => {
    res.json({ report: getAnalysisReport(), count: _analysisCache.size });
  });

  // GET /analysis/:moduleName — single module analysis / Analiză modul individual
  router.get('/analysis/:moduleName', (req, res) => {
    try {
      const result = analyzeModule(req.params.moduleName);
      if (result.error) return res.status(404).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /behavior — behavior report / Raport de comportament
  router.get('/behavior', (_req, res) => {
    res.json(getBehaviorReport());
  });

  // GET /evolution/plan — current evolution plan / Plan evoluție curent
  router.get('/evolution/plan', (_req, res) => {
    res.json(getEvolutionPlan());
  });

  // POST /evolution/approve/:taskId — approve a task / Aprobă o sarcină
  router.post('/evolution/approve/:taskId', (req, res) => {
    try {
      const task = approveTask(req.params.taskId);
      res.json({ task });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /evolution/reject/:taskId  { reason? } — reject a task / Respinge o sarcină
  router.post('/evolution/reject/:taskId', (req, res) => {
    try {
      const task = rejectTask(req.params.taskId, req.body?.reason || '');
      res.json({ task });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /proposals — list all proposals / Listează toate propunerile
  router.get('/proposals', (_req, res) => {
    res.json({ proposals: getProposals() });
  });

  // POST /proposals/:proposalId/apply — apply proposal to generated dir
  // Aplică propunerea în directorul generated
  router.post('/proposals/:proposalId/apply', (req, res) => {
    try {
      const rec = applyProposal(req.params.proposalId);
      res.json({ proposal: rec });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /proposals/:proposalId/validate — validate syntax + safety
  // Validează sintaxa și siguranța
  router.post('/proposals/:proposalId/validate', async (req, res) => {
    try {
      const report = await validateProposal(req.params.proposalId);
      res.json({ report });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /rollouts — rollout history / Istoricul lansărilor
  router.get('/rollouts', (_req, res) => {
    res.json({ rollouts: getRolloutHistory() });
  });

  // GET /status — engine status / Starea motorului
  router.get('/status', (_req, res) => {
    res.json(getStatus());
  });

  return router;
}

// =============================================================================
// Singleton export / Export singleton
// =============================================================================
const seeEngine = {
  // §1 Analyzer
  analyzeModule,
  analyzeAllModules,
  getAnalysisReport,
  // §2 Profiler
  recordCall,
  profileModule,
  profileAllModules,
  getBehaviorReport,
  // §3 Planner
  planEvolution,
  getEvolutionPlan,
  approveTask,
  rejectTask,
  // §4 Generator
  generateModuleCode,
  applyProposal,
  getProposals,
  // §5 Validator
  runSafetyChecks,
  validateProposal,
  getValidationReport,
  // §6 Deploy/Heal
  safeRollout,
  monitorRollout,
  rollback,
  getRolloutHistory,
  // §7 Lifecycle
  init,
  stop,
  getStatus,
  // §8 Router
  createExpressRouter,
  // Metadata
  name: 'self-evolving-engine',
};

module.exports = seeEngine;
