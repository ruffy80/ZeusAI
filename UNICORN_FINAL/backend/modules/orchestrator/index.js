'use strict';

// ============================================================================
// ZeusAI Unified Orchestrator — Full Autonomy Edition
// Coordinates module discovery, dependency graph, per-capability state machine,
// resource budgets & blast-radius isolation, graceful degradation tiers,
// emergency stop/resume, multi-model consensus for destructive actions,
// and blue/green zero-downtime capability upgrades.
// ============================================================================

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Worker } = require('worker_threads');

const { discoverModules, buildDependencyGraph, topologicalSort } = require('./discovery');
const { STATES, CapabilityStateMachine } = require('./stateMachine');
const { requiresConsensus, requestConsensus } = require('./consensus');
const { BlueGreenManager } = require('./blueGreen');

const STATE_DIR = process.env.ZEUS_STATE_DIR || '/opt/zeusai/state';

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) { /* read-only test */ }
}

function sendSnmAlert(kind, message, meta = {}) {
  try {
    const snm = require('../snm');
    if (snm && typeof snm.critical === 'function') {
      snm.critical(kind, typeof message === 'string' ? message : JSON.stringify(message), meta);
    }
  } catch (_) { /* SNM optional in isolated unit tests */ }
}

function isInfiniteSyncLoop(fn) {
  const src = Function.prototype.toString.call(fn || '');
  if (/\bawait\b/.test(src)) return false;
  return /while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\)/.test(src);
}

function runInWorkerWithTimeout(fnSource, timeoutMs) {
  return new Promise((resolve, reject) => {
    const workerCode = `
      const { parentPort } = require('worker_threads');
      (async () => {
        const fn = (${fnSource});
        const out = await fn();
        parentPort.postMessage({ ok: true, out });
      })().catch((e) => {
        parentPort.postMessage({ ok: false, error: (e && e.message) || String(e) });
      });
    `;
    const worker = new Worker(workerCode, { eval: true });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      reject(new Error('timeout'));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    worker.on('message', (msg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      if (msg && msg.ok) resolve(msg.out);
      else reject(new Error((msg && msg.error) || 'worker_error'));
    });
    worker.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      reject(err);
    });
  });
}

class UnifiedOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.locks = new Map();
    this.failures = new Map();
    this.predictions = new Map();
    this.replayLog = [];
    this.versions = new Map();
    this.discoveredModules = new Map();
    this.capabilities = new Map();
    this.dependencyOrder = [];
    this.dependencyGraph = { nodes: [], edges: [], cycles: [] };

    this.stateMachine = new CapabilityStateMachine();
    this.blueGreen = new BlueGreenManager();

    this.state = {
      running: false,
      cycles: 0,
      ordersProcessed: 0,
      modulesRepaired: 0,
      backupsDone: 0,
      lastErrors: [],
      shadowMode: process.env.SHADOW_MODE === 'true',
      degradationLevel: 'full',
      manualDegradationOverride: null,
      emergencyStopped: false,
      emergencyReason: null,
      emergencyStoppedAt: null,
      resourceUsage: {
        cpuMs: 0,
        memoryMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
    };

    this.businessCapabilities = new Set(['processPaidOrders', 'syncPrices']);
    this._timer = null;
    this._backupTimer = null;

    this.stateMachine.on('capability_quarantined', (evt) => {
      this.emit('capability_quarantined', evt);
      sendSnmAlert('capability_quarantined', `Capability ${evt.capability_id} quarantined: ${evt.reason}`, evt);
      this.evaluateDegradationTier();
      this.writeStatus();
    });
  }

  async withLock(resource, fn) {
    if (this.locks.get(resource)) return null;
    this.locks.set(resource, true);
    try {
      return await fn();
    } finally {
      this.locks.delete(resource);
    }
  }

  isCapabilityAllowedInTier(capId) {
    if (this.state.emergencyStopped) return false;
    const level = (this.state.degradationLevel || 'full').toLowerCase();
    if (level === 'full') return true;
    if (level === 'safe') {
      return capId === 'healthCheck';
    }
    if (level === 'minimal') {
      return capId === 'healthCheck' || capId === 'processPaidOrders';
    }
    if (level === 'degraded') {
      if (capId === 'healthCheck' || capId === 'processPaidOrders' || capId === 'syncPrices') return true;
      const meta = this.capabilities.get(capId);
      if (!meta) return true;
      // In DEGRADED mode, non-critical capabilities (type=notification, read) are paused
      return meta.type !== 'notification' && meta.type !== 'read';
    }
    return true;
  }

  evaluateDegradationTier() {
    if (this.state.manualDegradationOverride) {
      this.state.degradationLevel = this.state.manualDegradationOverride;
      return this.state.degradationLevel;
    }
    const records = this.stateMachine.listRecords();
    const total = records.length || 1;
    const quarantined = records.filter((r) => r.state === STATES.QUARANTINED).length;
    const ratio = quarantined / total;

    let nextLevel = 'full';
    if (ratio > 0.70) {
      nextLevel = 'safe';
    } else if (ratio > 0.50) {
      nextLevel = 'minimal';
    } else if (ratio > 0.30 || quarantined >= 5) {
      nextLevel = 'degraded';
    } else if (quarantined === 0) {
      nextLevel = 'full';
    } else {
      nextLevel = this.state.degradationLevel || 'full';
    }

    if (nextLevel !== this.state.degradationLevel) {
      const prev = this.state.degradationLevel;
      this.state.degradationLevel = nextLevel;
      this.emit('degradation_changed', { from: prev, to: nextLevel, quarantined, total });
    }
    return this.state.degradationLevel;
  }

  setDegradationLevel(level, opts = {}) {
    const normalized = String(level || '').toLowerCase();
    if (!['full', 'degraded', 'minimal', 'safe'].includes(normalized)) {
      throw new Error(`Invalid degradation level: ${level}`);
    }
    this.state.manualDegradationOverride = opts.manual === false ? null : normalized;
    this.state.degradationLevel = normalized;
    this.writeControlState();
    this.writeStatus();
    return {
      ok: true,
      degradationLevel: this.state.degradationLevel,
      timestamp: new Date().toISOString(),
    };
  }

  async emergencyStop(reason = 'Manual EMERGENCY STOP activated') {
    this.state.emergencyStopped = true;
    this.state.emergencyReason = reason;
    this.state.emergencyStoppedAt = new Date().toISOString();
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._backupTimer) {
      clearInterval(this._backupTimer);
      this._backupTimer = null;
    }

    // Let in-flight processes finish gracefully (bounded wait up to 2s)
    const waitStart = Date.now();
    while (this.locks.size > 0 && Date.now() - waitStart < 2000) {
      await new Promise((r) => setTimeout(r, 25));
    }

    this.stateMachine.disableAll(reason);
    const auditEntry = {
      event: 'EMERGENCY_STOP',
      reason,
      timestamp: this.state.emergencyStoppedAt,
    };
    this._writeAuditLog(auditEntry);
    sendSnmAlert('emergency_stop', 'EMERGENCY STOP activated: ' + reason, auditEntry);
    this.writeControlState();
    this.writeStatus();
    return {
      ok: true,
      status: 'DISABLED',
      emergencyStopped: true,
      reason,
      timestamp: this.state.emergencyStoppedAt,
    };
  }

  emergencyResume(confirmText) {
    if (confirmText !== 'I understand') {
      const err = new Error('Explicit confirmation required: { "confirm": "I understand" }');
      err.statusCode = 400;
      throw err;
    }
    this.state.emergencyStopped = false;
    this.state.emergencyReason = null;
    this.stateMachine.resumeAll('emergency_resume');
    const resumedAt = new Date().toISOString();
    this._writeAuditLog({
      event: 'EMERGENCY_RESUME',
      confirmed: true,
      timestamp: resumedAt,
    });
    if (this.state.running && !this._timer) {
      this._scheduleIntervals();
    }
    this.evaluateDegradationTier();
    this.writeControlState();
    this.writeStatus();
    return {
      ok: true,
      status: 'RESUMED',
      emergencyStopped: false,
      degradationLevel: this.state.degradationLevel,
      timestamp: resumedAt,
    };
  }

  _writeAuditLog(entry) {
    try {
      ensureDir(STATE_DIR);
      fs.appendFileSync(path.join(STATE_DIR, 'orchestrator-audit.jsonl'), JSON.stringify(entry) + '\n');
    } catch (_) { /* best-effort */ }
  }

  writeControlState() {
    try {
      ensureDir(STATE_DIR);
      fs.writeFileSync(path.join(STATE_DIR, 'orchestrator-control.json'), JSON.stringify({
        degradationLevel: this.state.degradationLevel,
        manualDegradationOverride: this.state.manualDegradationOverride,
        emergencyStopped: this.state.emergencyStopped,
        emergencyReason: this.state.emergencyReason,
        emergencyStoppedAt: this.state.emergencyStoppedAt,
        updatedAt: new Date().toISOString(),
      }));
    } catch (_) { /* best-effort */ }
  }

  syncControlState() {
    try {
      const ctrlFile = path.join(STATE_DIR, 'orchestrator-control.json');
      if (!fs.existsSync(ctrlFile)) return;
      const ctrl = JSON.parse(fs.readFileSync(ctrlFile, 'utf8'));
      if (ctrl && typeof ctrl.emergencyStopped === 'boolean') {
        if (ctrl.emergencyStopped && !this.state.emergencyStopped) {
          this.state.emergencyStopped = true;
          this.state.emergencyReason = ctrl.emergencyReason || 'Emergency stop via API';
          this.state.emergencyStoppedAt = ctrl.emergencyStoppedAt;
          this.stateMachine.disableAll(this.state.emergencyReason);
        } else if (!ctrl.emergencyStopped && this.state.emergencyStopped) {
          this.state.emergencyStopped = false;
          this.state.emergencyReason = null;
          this.stateMachine.resumeAll('emergency_resume_via_api');
        }
      }
      if (ctrl && ctrl.manualDegradationOverride) {
        this.state.manualDegradationOverride = ctrl.manualDegradationOverride;
        this.state.degradationLevel = ctrl.manualDegradationOverride;
      }
    } catch (_) { /* ignore */ }
  }

  async safeRun(name, fn, timeoutOverride) {
    const capMeta = this.capabilities.get(name) || {};
    const moduleName = capMeta.moduleName || 'orchestrator';
    const timeoutMs = Number(timeoutOverride || capMeta.timeout_ms || 25000);
    const budget = capMeta.resourceBudget || { maxCpuMs: 5000, maxMemoryMb: 256 };

    const isExplicitDegradationBlocked = this.state.manualDegradationOverride
      && !this.isCapabilityAllowedInTier(name);
    if (this.state.emergencyStopped || isExplicitDegradationBlocked) {
      return undefined;
    }

    const f = this.failures.get(name) || { count: 0, blockedUntil: 0 };
    if (Date.now() < f.blockedUntil) return undefined;

    const gate = this.stateMachine.canExecute(name);
    if (!gate.allowed) {
      return undefined;
    }

    if (requiresConsensus(capMeta, { affectedModules: 2 })) {
      const consensus = await requestConsensus({
        capability: name,
        type: capMeta.type,
        description: `Execute destructive capability ${name} in module ${moduleName}`,
        affectedModules: 2,
      });
      if (!consensus.approved) {
        this.emit('consensus_rejected', consensus);
        this.state.lastErrors.push({
          name,
          error: `consensus_rejected (${consensus.decision})`,
          at: Date.now(),
        });
        return undefined;
      }
    }

    const startWall = Date.now();
    const cpuStart = process.cpuUsage();
    this.stateMachine.markStart(name, moduleName, startWall);

    try {
      let result;
      if (isInfiniteSyncLoop(fn)) {
        result = await runInWorkerWithTimeout(Function.prototype.toString.call(fn), timeoutMs);
      } else {
        let timer = null;
        result = await Promise.race([
          Promise.resolve().then(() => fn()),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            if (typeof timer.unref === 'function') timer.unref();
          }),
        ]).finally(() => {
          if (timer) clearTimeout(timer);
        });
      }

      const duration = Date.now() - startWall;
      const cpuDelta = process.cpuUsage(cpuStart);
      const cpuUsedMs = (cpuDelta.user + cpuDelta.system) / 1000;
      const memAfterMb = process.memoryUsage().heapUsed / (1024 * 1024);

      this.state.resourceUsage = {
        cpuMs: Math.max(1, Math.round(cpuUsedMs)),
        memoryMb: Math.round(memAfterMb),
      };

      this.failures.set(name, { count: 0, blockedUntil: 0 });
      this.updatePrediction(name, duration);
      this.recordReplay(name, 'ok', duration);

      const maxCpuMs = Number(budget.maxCpuMs || 5000);
      const maxMemoryMb = Number(budget.maxMemoryMb || 256);
      if (cpuUsedMs > maxCpuMs || memAfterMb > maxMemoryMb) {
        const reason = `budget_exceeded (cpu=${Math.round(cpuUsedMs)}ms/${maxCpuMs}ms, mem=${Math.round(memAfterMb)}MB/${maxMemoryMb}MB)`;
        this.stateMachine.markDegraded(name, reason);
        this.emit('resource_budget_exceeded', { capability: name, cpuUsedMs, memAfterMb, budget });
      } else {
        this.stateMachine.markSuccess(name, moduleName);
      }

      this.evaluateDegradationTier();
      return result;
    } catch (err) {
      const duration = Date.now() - startWall;
      f.count += 1;
      const isBusiness = this.businessCapabilities.has(name);
      const isTimeout = err && err.message === 'timeout';

      if (isBusiness) {
        f.blockedUntil = Date.now() + 60000;
        this.emit('business_alert', { capability: name, error: err && err.message, at: Date.now() });
      } else if (f.count >= 3) {
        f.blockedUntil = Date.now() + 300000;
        this.writeAutopsy(name, err, f.count);
      }
      this.failures.set(name, f);

      if (isTimeout) {
        // Immediate quarantine on hard timeout of infinite loop or after 3 failures
        const rec = this.stateMachine.ensureCapability(name, moduleName);
        rec.consecutive_failures = Math.max(3, (rec.consecutive_failures || 0) + 1);
        this.stateMachine.markFailure(name, err && err.message);
      } else {
        this.stateMachine.markFailure(name, err && err.message);
      }

      this.evaluateDegradationTier();
      this.state.lastErrors.push({ name, error: err && err.message, at: Date.now() });
      if (this.state.lastErrors.length > 20) this.state.lastErrors.shift();
      this.recordReplay(name, 'error:' + (err && err.message), duration);
      return undefined;
    }
  }

  updatePrediction(name, duration) {
    const hist = this.predictions.get(name) || [];
    hist.push({ t: Date.now(), d: duration });
    if (hist.length > 20) hist.shift();
    this.predictions.set(name, hist);
    if (hist.length >= 10) {
      const recent = hist.slice(-5).reduce((a, b) => a + b.d, 0) / 5;
      const older = hist.slice(0, 5).reduce((a, b) => a + b.d, 0) / 5;
      if (older > 0 && recent > older * 2.5) {
        this.emit('predictive_warning', { capability: name, trend: recent / older });
      }
    }
  }

  flushReplay() {
    if (!this.replayLog.length) return;
    try {
      ensureDir(STATE_DIR);
      const data = this.replayLog.splice(0).map((entry) => JSON.stringify(entry)).join('\n') + '\n';
      fs.appendFileSync(path.join(STATE_DIR, 'orchestrator-replay.jsonl'), data);
    } catch (_) { /* test or read-only env */ }
  }

  recordReplay(name, outcome, duration) {
    this.replayLog.push({ t: Date.now(), name, outcome, duration });
    if (this.replayLog.length >= 100) this.flushReplay();
  }

  writeAutopsy(name, err, count) {
    try {
      const dir = path.join(STATE_DIR, 'autopsies');
      ensureDir(dir);
      const file = path.join(dir, `${name}_${Date.now()}.json`);
      fs.writeFileSync(file, JSON.stringify({
        capability: name,
        failures: count,
        error: err && err.message,
        stack: err && err.stack,
        mem: process.memoryUsage(),
        at: new Date().toISOString(),
      }, null, 2));
    } catch (_) { /* ignore when state dir is not writable */ }
  }

  versionSnapshot() {
    const out = [];
    for (const [name, meta] of this.versions.entries()) {
      out.push({ capability: name, ...meta });
    }
    return out;
  }

  persistVersions() {
    try {
      ensureDir(STATE_DIR);
      fs.writeFileSync(path.join(STATE_DIR, 'capability-versions.json'), JSON.stringify(this.versionSnapshot(), null, 2));
    } catch (_) { /* ignore */ }
  }

  registerModule(modDesc) {
    if (!modDesc || !modDesc.name) return;
    const prev = this.discoveredModules.get(modDesc.name);
    this.discoveredModules.set(modDesc.name, modDesc);
    this.blueGreen.registerModule(modDesc.name, modDesc.version, {});

    if (prev && prev.version && modDesc.version && prev.version !== modDesc.version) {
      this.blueGreen.stageUpgrade(modDesc.name, modDesc.version).catch(() => {});
    }

    const caps = Array.isArray(modDesc.capabilities) ? modDesc.capabilities : [];
    for (const cap of caps) {
      const capKey = modDesc.name === 'orchestrator' ? cap.id : `${modDesc.name}.${cap.id}`;
      const entry = {
        id: capKey,
        rawId: cap.id,
        moduleName: modDesc.name,
        version: modDesc.version || '1.0.0',
        type: cap.type || 'read',
        schedule: cap.schedule || null,
        timeout_ms: Number(cap.timeout_ms || 25000),
        resourceBudget: cap.resourceBudget || { maxCpuMs: 5000, maxMemoryMb: 256 },
      };
      this.capabilities.set(capKey, entry);
      this.stateMachine.ensureCapability(capKey, modDesc.name);

      const hash = crypto.createHash('sha256')
        .update(`${modDesc.name}:${cap.id}:${modDesc.version}:${cap.type}`)
        .digest('hex')
        .slice(0, 12);
      this.versions.set(capKey, {
        target: `${modDesc.name}.${cap.id}`,
        version: modDesc.version || '1.0.0',
        hash,
        registeredAt: new Date().toISOString(),
      });
    }
  }

  registerCapabilities(customRoots) {
    const modules = discoverModules(customRoots);
    const graph = buildDependencyGraph(modules);
    const order = topologicalSort(graph);

    this.dependencyGraph = {
      nodes: graph.nodes,
      edges: graph.edges,
      cycles: graph.cycles,
    };
    this.dependencyOrder = order.map((m) => m.name);

    for (const m of order) {
      this.registerModule(m);
    }

    console.log(
      `Discovered ${order.length} modules, ${this.capabilities.size} capabilities, dependency order: [${this.dependencyOrder.join(', ')}]`
    );
    this.persistVersions();
    return {
      modulesCount: order.length,
      capabilitiesCount: this.capabilities.size,
      dependencyOrder: this.dependencyOrder,
      cycles: graph.cycles,
    };
  }

  logShadow(entry) {
    const payload = {
      shadow: true,
      capability: entry.capability,
      wouldDo: entry.wouldDo,
      affectedResources: Array.isArray(entry.affectedResources) ? entry.affectedResources : [],
      estimatedImpact: entry.estimatedImpact || 'none',
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(payload);
    console.log(line);
    try {
      const logFile = process.env.ORCHESTRATOR_SHADOW_LOG || '/var/log/orchestrator-shadow.log';
      fs.appendFileSync(logFile, line + '\n');
    } catch (_) { /* fallback in non-root local test env */ }
  }

  probePostgres(port = 5432, host = '127.0.0.1') {
    const net = require('net');
    return new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout: 1500 });
      const done = (ok) => {
        try { socket.destroy(); } catch (_) {}
        resolve(ok);
      };
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
    });
  }

  health() {
    const start = Date.now();
    const payload = this.getHealthReport();
    return {
      ok: Boolean(payload.running && !this.state.emergencyStopped),
      latencyMs: Math.max(1, Date.now() - start),
      details: payload,
    };
  }

  getCapabilitiesList() {
    const records = this.stateMachine.listRecords();
    const byId = new Map(records.map((r) => [r.capability_id, r]));
    const out = [];
    for (const [id, meta] of this.capabilities.entries()) {
      const st = byId.get(id) || { state: STATES.IDLE, consecutive_failures: 0, quarantined_until: null };
      out.push({
        id,
        module: meta.moduleName,
        type: meta.type,
        schedule: meta.schedule,
        timeout_ms: meta.timeout_ms,
        resourceBudget: meta.resourceBudget,
        state: st.state,
        consecutive_failures: st.consecutive_failures || 0,
        last_success_at: st.last_success_at || null,
        last_error_at: st.last_error_at || null,
        quarantined_until: st.quarantined_until || null,
      });
    }
    for (const rec of records) {
      if (!this.capabilities.has(rec.capability_id)) {
        out.push({
          id: rec.capability_id,
          module: rec.module_name,
          type: 'read',
          state: rec.state,
          consecutive_failures: rec.consecutive_failures || 0,
          quarantined_until: rec.quarantined_until || null,
        });
      }
    }
    return out;
  }

  getHealthReport() {
    this.syncControlState();
    if (this.discoveredModules.size === 0) {
      try { this.registerCapabilities(); } catch (_) {}
    }
    const byState = this.stateMachine.countsByState();
    const records = this.stateMachine.listRecords();

    const modStates = new Map();
    for (const mName of this.discoveredModules.keys()) {
      modStates.set(mName, 'running');
    }
    for (const r of records) {
      if (!r.module_name || !modStates.has(r.module_name)) continue;
      if (r.state === STATES.QUARANTINED) {
        modStates.set(r.module_name, 'quarantined');
      } else if (r.state === STATES.DEGRADED && modStates.get(r.module_name) !== 'quarantined') {
        modStates.set(r.module_name, 'degraded');
      }
    }

    let runningMods = 0;
    let degradedMods = 0;
    let quarantinedMods = 0;
    for (const st of modStates.values()) {
      if (st === 'quarantined') quarantinedMods += 1;
      else if (st === 'degraded') degradedMods += 1;
      else runningMods += 1;
    }

    const totalCaps = Math.max(this.capabilities.size, records.length);

    return {
      running: Boolean(this.state.running && !this.state.emergencyStopped),
      shadowMode: Boolean(this.state.shadowMode),
      degradationLevel: this.state.degradationLevel || 'full',
      emergencyStopped: Boolean(this.state.emergencyStopped),
      cycles: this.state.cycles || 0,
      modules: {
        discovered: this.discoveredModules.size,
        running: runningMods,
        degraded: degradedMods,
        quarantined: quarantinedMods,
        dependencyOrder: this.dependencyOrder,
      },
      capabilities: {
        total: totalCaps,
        byState: {
          IDLE: byState.IDLE || 0,
          RUNNING: byState.RUNNING || 0,
          DEGRADED: byState.DEGRADED || 0,
          QUARANTINED: byState.QUARANTINED || 0,
          RECOVERING: byState.RECOVERING || 0,
          DISABLED: byState.DISABLED || 0,
        },
      },
      lastErrors: this.state.lastErrors || [],
      resourceUsage: this.state.resourceUsage || {
        cpuMs: 1,
        memoryMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      },
    };
  }

  async healthCheck() {
    const port = Number(process.env.PORT || 3000);
    const probeOnce = () => new Promise((resolve, reject) => {
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 4000,
      }, (resp) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            const body = JSON.parse(text);
            resolve({ statusCode: resp.statusCode, ok: body && body.ok === true, status: body && body.status });
          } catch (e) {
            reject(new Error('health_not_json'));
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('health_timeout')); });
      req.on('error', reject);
    });
    let res;
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        res = await probeOnce();
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    if (!res) throw lastErr;
    if (Array.isArray(this.state.lastErrors) && this.state.lastErrors.length > 0) {
      this.state.lastErrors = this.state.lastErrors.filter((e) => e && e.name !== 'healthCheck');
    }
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'healthCheck',
        wouldDo: 'Probe GET /api/health on 127.0.0.1:' + port + ' (status ' + res.statusCode + ')',
        affectedResources: ['backend:3000'],
        estimatedImpact: 'Health status verified (' + (res.status || 'ok') + ')',
      });
    }
    return res;
  }

  async syncPrices() {
    const priceNegotiator = require('../priceNegotiator');
    const quote = await priceNegotiator.getPrice('website-audit', {});
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'syncPrices',
        wouldDo: 'Sync live BTC/USD quote ($' + (quote && quote.usd) + ') from ' + (quote && quote.source),
        affectedResources: ['priceNegotiator', 'catalog'],
        estimatedImpact: 'Keep catalog BTC spot quotes synchronized',
      });
    }
    return {
      serviceId: quote && quote.serviceId,
      usd: quote && quote.usd,
      source: quote && quote.source,
      mutated: false,
    };
  }

  async processPaidOrders() {
    const ledger = require('../btcInvoiceLedger');
    const paidDelivery = require('../paid-delivery');
    const pending = typeof ledger.listPending === 'function' ? ledger.listPending() : [];
    const paidList = typeof ledger.listInvoices === 'function' ? ledger.listInvoices({ status: 'paid', limit: 200 }) : [];
    const delivDir = paidDelivery.deliveryDir();
    const undelivered = paidList.filter((inv) => {
      if (!inv || inv.id == null) return false;
      return !fs.existsSync(path.join(delivDir, String(inv.id) + '.json'));
    });

    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'processPaidOrders',
        wouldDo: 'Verify ' + pending.length + ' pending BTC invoices on-chain and fulfill ' + undelivered.length + ' paid undelivered orders',
        affectedResources: ['orders', 'deliveries', 'btcInvoiceLedger'],
        estimatedImpact: pending.length + ' pending orders checked, ' + undelivered.length + ' deliveries would be generated',
      });
      return {
        processed: 0,
        pending: pending.length,
        undelivered: undelivered.length,
        shadow: true,
        mutated: false,
      };
    }

    let verified = 0;
    let delivered = 0;
    const deliveredOrders = [];
    const verifier = require('../btcPaymentVerifier').createPaymentVerifier({
      address: ledger.PAYOUT_ADDRESS,
      onPaid: (inv) => {
        verified += 1;
        const out = paidDelivery.writePaidDelivery(inv, { licenseId: 'lic_' + inv.id });
        if (out && out.ok) {
          delivered += 1;
          deliveredOrders.push(inv.id);
          paidDelivery.queueDeliveryEmail(inv).catch(() => {});
        }
      },
    });
    await verifier.tick();

    for (const inv of undelivered) {
      const out = paidDelivery.writePaidDelivery(inv, { licenseId: 'lic_' + inv.id });
      if (out && out.ok && !out.already) {
        delivered += 1;
        deliveredOrders.push(inv.id);
        paidDelivery.queueDeliveryEmail(inv).catch(() => {});
      }
    }

    return {
      processed: verified + delivered,
      verified,
      delivered,
      deliveredOrders,
      pending: ledger.listPending().length,
      mutated: (verified + delivered) > 0,
    };
  }

  async autoRepair(opts = {}) {
    const pgUp = opts.simulatePostgresDown ? false : await this.probePostgres(5432, '127.0.0.1');
    const health = { postgres: pgUp ? 'up' : 'down' };

    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'autoRepair',
        wouldDo: health.postgres === 'down'
          ? 'Restart PostgreSQL via systemctl restart postgresql || docker restart unicorn-postgres'
          : 'Verify PostgreSQL (up) and run score.repair()',
        affectedResources: health.postgres === 'down' ? ['postgresql', 'unicorn-postgres'] : ['postgresql', 'score'],
        estimatedImpact: health.postgres === 'down'
          ? 'PostgreSQL service/container restarted to restore port 5432'
          : '0 restarts needed (PostgreSQL and services healthy)',
      });
      return {
        action: 'shadow',
        postgres: health.postgres,
        restarted: [],
        wouldRestart: health.postgres === 'down' ? ['postgresql'] : [],
      };
    }

    const restarted = [];
    let consensusResult = null;
    if (health.postgres === 'down') {
      consensusResult = await requestConsensus({
        capability: 'autoRepair',
        type: 'destructive',
        description: 'Restart PostgreSQL service/container to restore port 5432',
        affectedModules: 2,
        simulateVotes: opts.simulateVotes,
      });
      if (!consensusResult.approved) {
        return {
          action: 'escalated',
          postgres: health.postgres,
          restarted: [],
          consensus: consensusResult,
        };
      }
      if (!opts.dryRunExec) {
        const { execSync } = require('child_process');
        execSync('systemctl restart postgresql 2>/dev/null || docker restart unicorn-postgres', { timeout: 20000 });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const pgAfter = await this.probePostgres(5432, '127.0.0.1');
        health.postgres = pgAfter ? 'up' : 'down';
      } else {
        health.postgres = 'up';
      }
      restarted.push('postgresql');
    }

    let scoreRepair = null;
    try {
      let scoreMod;
      try {
        scoreMod = require('../../../modules/score');
      } catch (_) {
        try {
          scoreMod = require('../score');
        } catch (__) {
          scoreMod = require('/var/www/unicorn/current/modules/score');
        }
      }
      scoreRepair = scoreMod.repair();
    } catch (err) {
      scoreRepair = { ok: false, error: err && err.message };
    }
    return {
      action: restarted.length > 0 ? 'repaired' : 'healthy',
      postgres: health.postgres,
      restarted,
      consensus: consensusResult,
      scoreRepair,
    };
  }

  async backupDatabase() {
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'backupDatabase',
        wouldDo: 'Dump PostgreSQL database zeusai to /opt/zeusai/state/backups',
        affectedResources: ['postgresql:zeusai'],
        estimatedImpact: 'Create timestamped SQL backup file',
      });
      return { action: 'shadow', wouldBackup: 'zeusai' };
    }
    try {
      const { execSync } = require('child_process');
      const dir = path.join(STATE_DIR, 'backups');
      ensureDir(dir);
      const file = path.join(dir, 'zeusai_' + Date.now() + '.sql');
      execSync('docker exec -i unicorn-postgres pg_dump -U zeusai zeusai > ' + JSON.stringify(file), { timeout: 60000 });
      this.state.backupsDone = (this.state.backupsDone || 0) + 1;
      return { action: 'backed_up', file };
    } catch (err) {
      return { action: 'error', error: err && err.message };
    }
  }

  async commercialMonitor() {
    const layer = require('../commercial-layer');
    if (typeof layer.probeStores === 'function') {
      await layer.probeStores();
    }
    const snap = layer.status();
    if (this.state.shadowMode) {
      this.logShadow({
        capability: 'commercialMonitor',
        wouldDo: 'Monitor commercial layer storage (' + (snap.storage && snap.storage.engine) + ') and plans/bundles',
        affectedResources: ['commercial-layer', 'postgresql'],
        estimatedImpact: 'Verified storage engine=' + (snap.storage && snap.storage.engine) + ', plans=' + snap.plans + ', bundles=' + snap.bundles,
      });
    }
    return { ok: true, monitoring: true, repaired: false, plans: snap.plans, bundles: snap.bundles, storage: snap.storage };
  }

  writeStatus() {
    try {
      ensureDir(STATE_DIR);
      const report = this.getHealthReport();
      fs.writeFileSync(path.join(STATE_DIR, 'orchestrator-status.json'), JSON.stringify({
        pid: process.pid,
        at: new Date().toISOString(),
        state: {
          ...this.state,
          ...report,
        },
        healthReport: report,
        capabilitiesList: this.getCapabilitiesList(),
        versions: this.versionSnapshot(),
      }));
    } catch (_) { /* status file is best-effort */ }
  }

  _scheduleIntervals() {
    const tick = async () => {
      this.syncControlState();
      if (this.state.emergencyStopped) {
        this.writeStatus();
        return;
      }
      this.state.shadowMode = process.env.SHADOW_MODE === 'true';

      const healthRes = this.isCapabilityAllowedInTier('healthCheck')
        ? await this.withLock('health', () => this.safeRun('healthCheck', () => this.healthCheck()))
        : { skipped: true, tier: this.state.degradationLevel };

      const pricesRes = this.isCapabilityAllowedInTier('syncPrices')
        ? await this.withLock('prices', () => this.safeRun('syncPrices', () => this.syncPrices()))
        : { skipped: true, tier: this.state.degradationLevel };

      const ordersRes = this.isCapabilityAllowedInTier('processPaidOrders')
        ? await this.withLock('orders', () => this.safeRun('processPaidOrders', () => this.processPaidOrders()))
        : { skipped: true, tier: this.state.degradationLevel };

      const repairRes = this.isCapabilityAllowedInTier('autoRepair')
        ? await this.withLock('repair', () => this.safeRun('autoRepair', () => this.autoRepair()))
        : { skipped: true, tier: this.state.degradationLevel };

      const commRes = this.isCapabilityAllowedInTier('commercialMonitor')
        ? await this.withLock('commercial', () => this.safeRun('commercialMonitor', () => this.commercialMonitor()))
        : { skipped: true, tier: this.state.degradationLevel };

      this.state.cycles += 1;
      if (!this.state.shadowMode) {
        if (ordersRes && typeof ordersRes.processed === 'number') {
          this.state.ordersProcessed = (this.state.ordersProcessed || 0) + ordersRes.processed;
        }
        if (repairRes && Array.isArray(repairRes.restarted)) {
          this.state.modulesRepaired = (this.state.modulesRepaired || 0) + repairRes.restarted.length;
        }
        if (this.state.cycles === 1 && !this.state.backupsDone) {
          await this.withLock('backup', () => this.safeRun('backupDatabase', () => this.backupDatabase(), 300000));
        }
      }
      this.evaluateDegradationTier();
      this.writeStatus();
      const entry = JSON.stringify({
        cycle: this.state.cycles,
        shadowMode: this.state.shadowMode,
        degradationLevel: this.state.degradationLevel,
        ordersProcessed: this.state.ordersProcessed || 0,
        modulesRepaired: this.state.modulesRepaired || 0,
        backupsDone: this.state.backupsDone || 0,
        mem: process.memoryUsage().heapUsed,
        locks: [...this.locks.keys()],
        timestamp: new Date().toISOString(),
        results: {
          healthCheck: healthRes,
          syncPrices: pricesRes,
          processPaidOrders: ordersRes,
          autoRepair: repairRes,
          commercialMonitor: commRes,
        },
      });
      console.log(entry);
      if (!this.state.shadowMode) {
        try {
          const liveLog = process.env.ORCHESTRATOR_LIVE_LOG || '/var/log/orchestrator-live.log';
          fs.appendFileSync(liveLog, entry + '\n');
        } catch (_) { /* best-effort in read-only test env */ }
      }
    };
    this._tickFn = tick;
    this._timer = setInterval(tick, Number(process.env.ORCHESTRATOR_TICK_MS || 30000));
    this._backupTimer = setInterval(() => {
      if (!this.state.emergencyStopped) {
        this.withLock('backup', () => this.safeRun('backupDatabase', () => this.backupDatabase(), 300000));
      }
    }, 86400000);
    if (require.main !== module) {
      if (typeof this._timer.unref === 'function') this._timer.unref();
      if (typeof this._backupTimer.unref === 'function') this._backupTimer.unref();
    }
  }

  startScheduler() {
    this._scheduleIntervals();
    if (this._tickFn && !this.state.emergencyStopped) {
      this._tickFn().catch((e) => this.state.lastErrors.push({ name: 'tick', error: e.message, at: Date.now() }));
    }
  }

  async start() {
    if (this.state.running) return;
    this.state.running = true;
    const modules = discoverModules();
    const graph = buildDependencyGraph(modules);
    const order = topologicalSort(graph);
    this.dependencyGraph = { nodes: graph.nodes, edges: graph.edges, cycles: graph.cycles };
    this.dependencyOrder = order.map((m) => m.name);
    for (const m of order) {
      this.registerModule(m);
    }
    console.log(
      `Discovered ${order.length} modules, ${this.capabilities.size} capabilities, dependency order: [${this.dependencyOrder.join(', ')}]`
    );
    this.persistVersions();
    this.startScheduler();
    this.emit('started');
  }

  async shutdown() {
    this.state.running = false;
    if (this._timer) clearInterval(this._timer);
    if (this._backupTimer) clearInterval(this._backupTimer);
    const started = Date.now();
    while (this.locks.size && Date.now() - started < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.flushReplay();
  }
}

async function runSandbox(ms = 60000) {
  const orch = new UnifiedOrchestrator();
  const log = [];
  let overlaps = 0;
  let active = 0;
  const cap = async (name) => {
    for (;;) {
      const result = await orch.withLock('sandbox-resource', async () => {
        active += 1;
        if (active > 1) overlaps += 1;
        log.push({ name, at: Date.now() });
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        return name;
      });
      if (result !== null) return result;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  };
  const started = Date.now();
  let rounds = 0;
  const budget = Math.max(200, Number(ms) || 60000);
  while (Date.now() - started < budget) {
    await Promise.all([cap('alpha'), cap('beta')]);
    rounds += 1;
  }
  return {
    ok: overlaps === 0 && log.some((row) => row.name === 'alpha') && log.some((row) => row.name === 'beta'),
    overlaps,
    rounds,
    logCount: log.length,
    ranMs: Date.now() - started,
    conflicts: overlaps,
  };
}

const orchestrator = new UnifiedOrchestrator();

if (require.main === module) {
  process.on('SIGTERM', async () => { await orchestrator.shutdown(); process.exit(0); });
  process.on('SIGINT', async () => { await orchestrator.shutdown(); process.exit(0); });
  orchestrator.start().catch((e) => {
    console.error('[orchestrator] start failed', e && e.message);
    process.exit(1);
  });
}

module.exports = orchestrator;
module.exports.UnifiedOrchestrator = UnifiedOrchestrator;
module.exports.runSandbox = runSandbox;
module.exports.health = () => orchestrator.health();
