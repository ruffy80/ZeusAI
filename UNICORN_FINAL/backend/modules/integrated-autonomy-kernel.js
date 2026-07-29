// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Integrated Autonomy Kernel — IAK/1.0
 * =====================================
 * Single master orchestrator that consolidates the former competing
 * meta-orchestrators into one harmonic runtime:
 *
 *   • Mesh registry / health / heal / sync  (ex unicornMeshOrchestrator)
 *   • Guardian 8-engine activation          (ex unicornOrchestrator)
 *   • External sense (Hetzner/DNS/GitHub)   (ex central-orchestrator)
 *   • Multi-tenant AI task queue            (ex saas-orchestrator-v4)
 *
 * Innovations nobody had wired before:
 *   1. Harmonic Phased Tick — one master clock; phases sense→health→heal→sync→report
 *      so timers never thrash or race each other.
 *   2. Causal Boot Graph — register({ dependsOn }) delays "live" until deps healthy.
 *   3. Conflict Quarantine — duplicate capability claims are quarantined so two
 *      modules cannot fight over the same role.
 *
 * Public legacy entry points re-export facets of this singleton (shims).
 */

const { EventEmitter } = require('events');

// Facets live under ./iak and MUST NOT be loaded via public shims (cycle-safe).
const externalSense = require('./iak/external-sense');
const tenantQueue = require('./iak/tenant-queue');
const guardianEngines = require('./iak/guardian-engines');

const HARMONIC_MS = parseInt(process.env.IAK_HARMONIC_MS || '15000', 10);
const REPORT_EVERY = Math.max(1, parseInt(process.env.IAK_REPORT_EVERY || '20', 10)); // every N ticks
const SYNC_EVERY = Math.max(1, parseInt(process.env.IAK_SYNC_EVERY || '4', 10));
const KERNEL_ID = 'IAK/1.0';

const PHASES = Object.freeze(['sense', 'health', 'heal', 'sync', 'report']);

class IntegratedAutonomyKernel extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.setMaxListeners(100);

    this.id = KERNEL_ID;
    this.registry = new Map();
    this.capabilities = new Map(); // capability → ownerName
    this.quarantine = new Map(); // name → { reason, since, capability }
    this.bootOrder = [];
    this.eventLog = [];
    this.healthLog = [];
    this.startedAt = Date.now();
    this.cycleCount = 0;
    this.phaseIndex = 0;
    this._timers = [];
    this.running = false;
    this.mode = null;
    this._facetBoot = { external: false, tenants: false, guardian: false };

    // Facet handles (same instances as public shims export)
    this.external = externalSense;
    this.tenants = tenantQueue;
    this.guardian = guardianEngines;
  }

  // ------------------------------------------------------------------ registry

  /**
   * @param {string} name
   * @param {object} instance
   * @param {object} [opts]
   * @param {string} [opts.statusFn]
   * @param {string[]} [opts.dependsOn]
   * @param {string|string[]} [opts.capability] — unique role claim(s)
   * @param {number} [opts.bootPriority] — lower boots first (causal order hint)
   */
  register(name, instance, opts = {}) {
    if (!name || !instance) return { ok: false, reason: 'invalid_args' };

    // Conflict Quarantine: refuse / quarantine duplicate capability owners
    const caps = []
      .concat(opts.capability || [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    for (const cap of caps) {
      const owner = this.capabilities.get(cap);
      if (owner && owner !== name) {
        this.quarantine.set(name, {
          reason: 'capability_conflict',
          capability: cap,
          owner,
          since: new Date().toISOString(),
        });
        this._log(`🚧 Quarantine ${name}: capability "${cap}" already owned by ${owner}`);
        this.emit('module:quarantined', { name, capability: cap, owner });
        return { ok: false, reason: 'capability_conflict', capability: cap, owner };
      }
    }

    if (this.quarantine.has(name)) {
      // Re-register after conflict cleared
      this.quarantine.delete(name);
    }

    const statusFn = opts.statusFn
      || (instance.getStatus ? 'getStatus' : null)
      || (instance.getRevenueStatus ? 'getRevenueStatus' : null)
      || (instance.getViralStatus ? 'getViralStatus' : null)
      || (instance.getMetrics ? 'getMetrics' : null)
      || null;

    const dependsOn = Array.isArray(opts.dependsOn)
      ? opts.dependsOn.map(String).filter(Boolean)
      : [];

    this.registry.set(name, {
      instance,
      statusFn,
      lastStatus: null,
      lastSeen: null,
      healthy: true,
      errors: 0,
      dependsOn,
      bootPriority: Number.isFinite(opts.bootPriority) ? opts.bootPriority : 100,
      capabilities: caps,
      depsReady: dependsOn.length === 0,
      live: dependsOn.length === 0,
    });

    for (const cap of caps) this.capabilities.set(cap, name);

    this._recomputeBootOrder();
    this._log(`✅ Modul înregistrat: ${name}${caps.length ? ` [${caps.join(',')}]` : ''}`);
    this.emit('module:registered', { name, ts: new Date().toISOString(), capabilities: caps });
    return { ok: true, name };
  }

  unregister(name) {
    const entry = this.registry.get(name);
    if (!entry) return false;
    for (const cap of entry.capabilities || []) {
      if (this.capabilities.get(cap) === name) this.capabilities.delete(cap);
    }
    this.registry.delete(name);
    this.quarantine.delete(name);
    this._recomputeBootOrder();
    return true;
  }

  _recomputeBootOrder() {
    const names = [...this.registry.keys()];
    names.sort((a, b) => {
      const ea = this.registry.get(a);
      const eb = this.registry.get(b);
      const pa = (ea && ea.bootPriority) || 100;
      const pb = (eb && eb.bootPriority) || 100;
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b);
    });
    // Kahn-ish: push modules whose deps appear earlier
    const ordered = [];
    const placed = new Set();
    let guard = 0;
    while (ordered.length < names.length && guard < names.length * 3) {
      guard++;
      let progressed = false;
      for (const n of names) {
        if (placed.has(n)) continue;
        const deps = (this.registry.get(n) && this.registry.get(n).dependsOn) || [];
        if (deps.every((d) => placed.has(d) || !this.registry.has(d))) {
          ordered.push(n);
          placed.add(n);
          progressed = true;
        }
      }
      if (!progressed) {
        for (const n of names) {
          if (!placed.has(n)) {
            ordered.push(n);
            placed.add(n);
          }
        }
      }
    }
    this.bootOrder = ordered;
  }

  // ------------------------------------------------------------------ start / stop

  /**
   * Idempotent master start. Starts harmonic tick + optionally facets.
   * @param {object} [opts]
   * @param {string} [opts.mode] — 'full' | 'monitor' | 'standard'
   * @param {boolean} [opts.ensureFacets=false]
   * @param {string} [opts.guardianMode]
   */
  start(opts = {}) {
    const mode = (opts && opts.mode) || this.mode || 'full';
    this.mode = mode;

    if (opts && opts.ensureFacets) {
      this.ensureFacets({ guardianMode: opts.guardianMode || (mode === 'monitor' ? 'idle' : 'full') });
    }

    if (this.running) {
      return this.getStatus();
    }

    this.running = true;
    this.startedAt = this.startedAt || Date.now();
    this._log(`🚀 ${KERNEL_ID} pornit — mode=${this.mode} (harmonic ${HARMONIC_MS}ms)`);

    // Immediate first phase slice (non-blocking)
    setTimeout(() => this._harmonicTick(), 2000);
    this._timers.push(setInterval(() => this._harmonicTick(), HARMONIC_MS));

    this.emit('orchestrator:started', { ts: new Date().toISOString(), mode: this.mode, id: KERNEL_ID });
    this.emit('iak:started', { ts: new Date().toISOString(), mode: this.mode });
    return this.getStatus();
  }

  /**
   * Start facet runtimes idempotently (external sense, tenant queue, guardian).
   */
  ensureFacets(opts = {}) {
    try {
      if (this.external && typeof this.external.start === 'function') {
        const s = typeof this.external.getStatus === 'function' ? this.external.getStatus() : {};
        if (!s.running) this.external.start();
        this._facetBoot.external = true;
      }
    } catch (e) {
      this._log(`⚠️ external.start failed: ${e.message}`);
    }

    try {
      if (this.tenants && typeof this.tenants.start === 'function') {
        this.tenants.start(); // idempotent via this.active
        this._facetBoot.tenants = true;
      }
    } catch (e) {
      this._log(`⚠️ tenants.start failed: ${e.message}`);
    }

    try {
      if (this.guardian && typeof this.guardian.start === 'function') {
        const gMode = opts.guardianMode || 'full';
        this.guardian.start(gMode);
        this._facetBoot.guardian = true;
      }
    } catch (e) {
      this._log(`⚠️ guardian.start failed: ${e.message}`);
    }

    return { ...this._facetBoot };
  }

  stop() {
    this._timers.forEach((t) => clearInterval(t));
    this._timers = [];
    this.running = false;
    this._log(`⏹️  ${KERNEL_ID} oprit`);
  }

  // ------------------------------------------------------------------ harmonic tick

  _harmonicTick() {
    this.cycleCount++;
    const phase = PHASES[this.phaseIndex % PHASES.length];
    this.phaseIndex++;

    try {
      switch (phase) {
        case 'sense':
          this._phaseSense();
          break;
        case 'health':
          this._phaseHealth();
          break;
        case 'heal':
          this._phaseHeal();
          break;
        case 'sync':
          if (this.cycleCount % SYNC_EVERY === 0) this._phaseSync();
          break;
        case 'report':
          if (this.cycleCount % REPORT_EVERY === 0) this._phaseReport();
          break;
        default:
          break;
      }
    } catch (err) {
      this._log(`❌ Harmonic phase ${phase} failed: ${err.message}`);
      this.emit('iak:phase-error', { phase, error: err.message });
    }

    this.emit('iak:tick', {
      cycle: this.cycleCount,
      phase,
      ts: new Date().toISOString(),
    });
  }

  _phaseSense() {
    // Soft nudge: if external facet exposes forceCheck / checkNow, use it sparingly.
    try {
      if (this.mode === 'monitor') return;
      if (this.external && typeof this.external.emit === 'function') {
        this.emit('iak:sense', {
          external: typeof this.external.getStatus === 'function' ? this.external.getStatus() : null,
          tenants: typeof this.tenants.getHealthReport === 'function' ? this.tenants.getHealthReport() : null,
        });
      }
    } catch (_) { /* sense is best-effort */ }
  }

  _phaseHealth() {
    const snapshot = {};
    const order = this.bootOrder.length ? this.bootOrder : [...this.registry.keys()];

    for (const name of order) {
      if (this.quarantine.has(name)) {
        snapshot[name] = { healthy: false, quarantined: true };
        continue;
      }
      const entry = this.registry.get(name);
      if (!entry) continue;

      // Causal Boot: deps must be healthy before module is "live"
      const deps = entry.dependsOn || [];
      let depsReady = true;
      for (const d of deps) {
        const dep = this.registry.get(d);
        if (dep && !dep.healthy) depsReady = false;
        if (this.quarantine.has(d)) depsReady = false;
      }
      entry.depsReady = depsReady;

      try {
        const status = entry.statusFn
          ? entry.instance[entry.statusFn]()
          : { health: 'unknown' };

        entry.lastStatus = status;
        entry.lastSeen = Date.now();
        const selfHealthy = this._isHealthy(status);
        entry.healthy = selfHealthy && depsReady;
        entry.live = entry.healthy;
        entry.errors = entry.healthy ? 0 : entry.errors + 1;

        snapshot[name] = {
          healthy: entry.healthy,
          depsReady,
          live: entry.live,
          ts: entry.lastSeen,
        };

        if (!entry.healthy) {
          this._log(`⚠️  Modul degradat: ${name} (erori: ${entry.errors}${depsReady ? '' : ', deps-blocked'})`);
          this.emit('module:unhealthy', { name, status, depsReady, ts: new Date().toISOString() });
        }
      } catch (err) {
        entry.errors++;
        entry.healthy = false;
        entry.live = false;
        this._log(`❌ Eroare status ${name}: ${err.message}`);
        this.emit('module:error', { name, error: err.message, ts: new Date().toISOString() });
        snapshot[name] = { healthy: false, error: err.message };
      }
    }

    this.healthLog.push({ cycle: this.cycleCount, ts: new Date().toISOString(), snapshot });
    if (this.healthLog.length > 100) this.healthLog.shift();
    this.emit('mesh:heartbeat', { cycle: this.cycleCount, modules: snapshot, ts: new Date().toISOString() });
  }

  _phaseHeal() {
    if (this.mode === 'monitor') return;
    for (const [name, entry] of this.registry) {
      if (this.quarantine.has(name)) continue;
      if (entry.healthy) continue;
      if (!entry.depsReady) continue; // Causal Boot: don't thrash heal before deps
      this._healModule(name, entry);
    }
  }

  _phaseSync() {
    this._log(`🔄 Sincronizare IAK (${this.registry.size} module, ${this.quarantine.size} quarantine)`);
    const aggregated = this._collectAggregate();
    for (const [name, entry] of this.registry) {
      if (this.quarantine.has(name)) continue;
      try {
        if (typeof entry.instance.onMeshSync === 'function') {
          entry.instance.onMeshSync(aggregated);
        }
      } catch { /* optional hook */ }
    }
    this.emit('mesh:sync', { aggregated, ts: new Date().toISOString() });
  }

  _phaseReport() {
    const report = this.getStatus();
    this._log(
      `📊 IAK raport: ${report.healthyModules}/${report.totalModules} sănătoase | ` +
      `q=${report.quarantined} | uptime: ${Math.floor(report.uptimeMs / 60000)} min`
    );
    this.emit('mesh:report', { report, ts: new Date().toISOString() });
  }

  // ------------------------------------------------------------------ healing

  _healModule(name, entry) {
    try {
      if (typeof entry.instance.heal === 'function') {
        entry.instance.heal();
        this._log(`🔧 heal() apelat pe: ${name}`);
      } else if (typeof entry.instance.restart === 'function') {
        entry.instance.restart();
        this._log(`🔄 restart() apelat pe: ${name}`);
      } else if (typeof entry.instance.start === 'function' && entry.errors > 3) {
        entry.instance.start();
        this._log(`▶️  start() re-apelat pe: ${name}`);
      }
    } catch (err) {
      this._log(`❌ Vindecare eșuată pentru ${name}: ${err.message}`);
    }
  }

  // ------------------------------------------------------------------ helpers

  _isHealthy(status) {
    if (!status) return false;
    const BAD_HEALTH = new Set(['error', 'failed', 'down', 'critical', 'compromised', 'crashed', 'unknown']);
    const BAD_STATUS = new Set(['error', 'failed', 'down', 'compromised', 'crashed']);
    if (status.health && typeof status.health === 'string' && BAD_HEALTH.has(status.health.toLowerCase())) return false;
    if (status.status && typeof status.status === 'string' && BAD_STATUS.has(status.status.toLowerCase())) return false;
    return true;
  }

  _collectAggregate() {
    const aggregate = {
      modules: {},
      quarantined: {},
      ts: new Date().toISOString(),
      meshHealthy: true,
      kernel: KERNEL_ID,
    };
    for (const [name, entry] of this.registry) {
      aggregate.modules[name] = {
        healthy: entry.healthy,
        errors: entry.errors,
        lastSeen: entry.lastSeen,
        status: entry.lastStatus,
        depsReady: entry.depsReady,
        live: entry.live,
      };
      if (!entry.healthy) aggregate.meshHealthy = false;
    }
    for (const [name, q] of this.quarantine) {
      aggregate.quarantined[name] = q;
      aggregate.meshHealthy = false;
    }
    return aggregate;
  }

  _log(message) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${message}`;
    console.log(`🧬 IAK: ${message}`);
    this.eventLog.push(line);
    if (this.eventLog.length > 200) this.eventLog.shift();
  }

  // ------------------------------------------------------------------ public API

  getStatus() {
    let healthyModules = 0;
    const moduleList = [];
    for (const [name, entry] of this.registry) {
      if (entry.healthy) healthyModules++;
      moduleList.push({
        name,
        healthy: entry.healthy,
        errors: entry.errors,
        depsReady: !!entry.depsReady,
        live: !!entry.live,
        capabilities: entry.capabilities || [],
        dependsOn: entry.dependsOn || [],
        lastSeen: entry.lastSeen ? new Date(entry.lastSeen).toISOString() : null,
      });
    }
    const quarantinedList = [...this.quarantine.entries()].map(([name, q]) => ({ name, ...q }));

    let externalStatus = null;
    let tenantStatus = null;
    let guardianStatus = null;
    try { externalStatus = this.external && this.external.getStatus ? this.external.getStatus() : null; } catch (_) {}
    try { tenantStatus = this.tenants && this.tenants.getStatus ? this.tenants.getStatus() : null; } catch (_) {}
    try { guardianStatus = this.guardian && this.guardian.getStatus ? this.guardian.getStatus() : null; } catch (_) {}

    return {
      ok: true,
      id: KERNEL_ID,
      running: this.running,
      mode: this.mode || 'full',
      uptimeMs: Date.now() - this.startedAt,
      cycleCount: this.cycleCount,
      phase: PHASES[(this.phaseIndex + PHASES.length - 1) % PHASES.length],
      harmonicMs: HARMONIC_MS,
      totalModules: this.registry.size,
      healthyModules,
      meshHealthy: healthyModules === this.registry.size && this.quarantine.size === 0,
      quarantined: this.quarantine.size,
      quarantine: quarantinedList,
      bootOrder: this.bootOrder.slice(),
      modules: moduleList,
      facets: {
        external: !!externalStatus,
        tenants: !!tenantStatus,
        guardian: !!guardianStatus,
        boot: { ...this._facetBoot },
      },
      external: externalStatus,
      tenants: tenantStatus,
      guardian: guardianStatus,
      recentLog: this.eventLog.slice(-20),
      innovations: [
        'harmonic_phased_tick',
        'causal_boot_graph',
        'conflict_quarantine',
      ],
    };
  }

  getHealthHistory(limit = 20) {
    return this.healthLog.slice(-Math.min(limit, 100));
  }

  getEventLog(limit = 50) {
    return this.eventLog.slice(-Math.min(limit, 200));
  }

  getQuarantine() {
    return [...this.quarantine.entries()].map(([name, q]) => ({ name, ...q }));
  }
}

const kernel = new IntegratedAutonomyKernel();

module.exports = kernel;
module.exports.IntegratedAutonomyKernel = IntegratedAutonomyKernel;
module.exports.KERNEL_ID = KERNEL_ID;
module.exports.external = externalSense;
module.exports.tenants = tenantQueue;
module.exports.guardian = guardianEngines;
