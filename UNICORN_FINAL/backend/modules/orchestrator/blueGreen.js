'use strict';

const DEFAULT_PARALLEL_CYCLES = 10;

function canonicalOutput(val) {
  if (val === undefined) return 'undefined';
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(canonicalOutput).join(',') + ']';
  const keys = Object.keys(val)
    .filter((k) => k !== 'timestamp' && k !== 'at' && k !== 'latencyMs' && k !== 'generatedAt')
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalOutput(val[k])).join(',') + '}';
}

class BlueGreenManager {
  constructor() {
    this.slots = new Map();
  }

  registerModule(moduleName, version, handlers = {}) {
    if (!this.slots.has(moduleName)) {
      this.slots.set(moduleName, {
        moduleName,
        activeVersion: version || '1.0.0',
        activeHandlers: { ...handlers },
        previousVersion: null,
        previousHandlers: null,
        stagedVersion: null,
        stagedHandlers: null,
        history: [],
      });
    }
    return this.slots.get(moduleName);
  }

  getSlot(moduleName) {
    return this.slots.get(moduleName) || null;
  }

  async stageUpgrade(moduleInput, newVersionInput, opts = {}) {
    const moduleName = typeof moduleInput === 'string' ? moduleInput : (moduleInput && moduleInput.name);
    const cycles = Number(opts.cycles || DEFAULT_PARALLEL_CYCLES);
    const maxLatencyDriftMs = Number(opts.maxLatencyDriftMs || 5000);

    let slot = this.slots.get(moduleName);
    if (!slot) {
      const initVer = (typeof moduleInput === 'object' && moduleInput.version) || '1.0.0';
      const initHandlers = (typeof moduleInput === 'object' && moduleInput.handlers) || {};
      slot = this.registerModule(moduleName, initVer, initHandlers);
    }

    const newVersion = typeof newVersionInput === 'string'
      ? newVersionInput
      : (newVersionInput && newVersionInput.version) || '1.0.1';

    const oldFn = opts.oldFn
      || opts.oldRunner
      || (typeof moduleInput === 'object' && moduleInput.oldFn)
      || (slot.activeHandlers && slot.activeHandlers.default)
      || (async () => ({ ok: true, mutated: false }));

    const newFn = opts.newFn
      || opts.newRunner
      || (typeof newVersionInput === 'object' && newVersionInput.fn)
      || (typeof moduleInput === 'object' && moduleInput.newFn)
      || oldFn;

    const newHandlers = (typeof newVersionInput === 'object' && newVersionInput.handlers)
      || opts.newHandlers
      || { ...slot.activeHandlers, default: newFn };

    const differences = [];
    const cycleMetrics = [];

    for (let i = 1; i <= cycles; i += 1) {
      const t0Old = Date.now();
      let oldOut;
      let oldErr = null;
      try {
        oldOut = await oldFn(i);
      } catch (e) {
        oldErr = e && e.message;
      }
      const oldLatency = Date.now() - t0Old;

      const t0New = Date.now();
      let newOut;
      let newErr = null;
      try {
        newOut = await newFn(i);
      } catch (e) {
        newErr = e && e.message;
      }
      const newLatency = Date.now() - t0New;

      cycleMetrics.push({ cycle: i, oldLatency, newLatency });

      if (oldErr !== newErr) {
        differences.push({
          cycle: i,
          type: 'error_mismatch',
          oldError: oldErr,
          newError: newErr,
        });
        continue;
      }

      const oldCanon = canonicalOutput(oldOut);
      const newCanon = canonicalOutput(newOut);
      if (oldCanon !== newCanon) {
        differences.push({
          cycle: i,
          type: 'output_mismatch',
          oldOutput: oldOut,
          newOutput: newOut,
        });
      }

      const oldMutated = Boolean(oldOut && oldOut.mutated);
      const newMutated = Boolean(newOut && newOut.mutated);
      if (oldMutated !== newMutated) {
        differences.push({
          cycle: i,
          type: 'side_effect_mismatch',
          oldMutated,
          newMutated,
        });
      }

      if (Math.abs(newLatency - oldLatency) > maxLatencyDriftMs) {
        differences.push({
          cycle: i,
          type: 'latency_regression',
          oldLatency,
          newLatency,
        });
      }
    }

    const staged = differences.length === 0;
    if (staged) {
      slot.stagedVersion = newVersion;
      slot.stagedHandlers = newHandlers;
      if (opts.autoPromote !== false) {
        this.promoteUpgrade(moduleName);
      }
    }

    const report = {
      module: moduleName,
      oldVersion: slot.previousVersion || slot.activeVersion,
      newVersion,
      activeVersion: slot.activeVersion,
      staged,
      promoted: staged && opts.autoPromote !== false,
      rolledBack: !staged,
      cyclesRun: cycles,
      differences,
      timestamp: new Date().toISOString(),
    };
    slot.history.push(report);
    return report;
  }

  promoteUpgrade(moduleInput) {
    const moduleName = typeof moduleInput === 'string' ? moduleInput : (moduleInput && moduleInput.name);
    const slot = this.slots.get(moduleName);
    if (!slot || !slot.stagedVersion) {
      return { ok: false, module: moduleName, reason: 'no_staged_upgrade' };
    }
    slot.previousVersion = slot.activeVersion;
    slot.previousHandlers = { ...slot.activeHandlers };
    slot.activeVersion = slot.stagedVersion;
    slot.activeHandlers = { ...slot.stagedHandlers };
    slot.stagedVersion = null;
    slot.stagedHandlers = null;
    return {
      ok: true,
      module: moduleName,
      previousVersion: slot.previousVersion,
      activeVersion: slot.activeVersion,
      switchedAt: new Date().toISOString(),
    };
  }

  rollbackUpgrade(moduleInput) {
    const moduleName = typeof moduleInput === 'string' ? moduleInput : (moduleInput && moduleInput.name);
    const slot = this.slots.get(moduleName);
    if (!slot || !slot.previousVersion) {
      return { ok: false, module: moduleName, reason: 'no_previous_version' };
    }
    const rolledBackFrom = slot.activeVersion;
    slot.activeVersion = slot.previousVersion;
    slot.activeHandlers = { ...slot.previousHandlers };
    slot.previousVersion = null;
    slot.previousHandlers = null;
    return {
      ok: true,
      module: moduleName,
      rolledBackFrom,
      activeVersion: slot.activeVersion,
      rolledBackAt: new Date().toISOString(),
    };
  }
}

const defaultManager = new BlueGreenManager();

module.exports = {
  BlueGreenManager,
  defaultManager,
  stageUpgrade: (mod, newVer, opts) => defaultManager.stageUpgrade(mod, newVer, opts),
  promoteUpgrade: (mod) => defaultManager.promoteUpgrade(mod),
  rollbackUpgrade: (mod) => defaultManager.rollbackUpgrade(mod),
};
