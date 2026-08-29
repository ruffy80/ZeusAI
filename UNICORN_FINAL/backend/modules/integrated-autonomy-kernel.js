// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Integrated Autonomy Kernel — IAK/1.1
 * =====================================
 * Single master orchestrator that consolidates the former competing
 * meta-orchestrators into one harmonic runtime:
 *
 *   • Mesh registry / health / heal / sync  (ex unicornMeshOrchestrator)
 *   • Guardian 8-engine activation          (ex unicornOrchestrator)
 *   • External sense (Hetzner/DNS/GitHub)   (ex central-orchestrator)
 *   • Multi-tenant AI task queue            (ex saas-orchestrator-v4)
 *
 * Innovations:
 *   1. Harmonic Phased Tick — one master clock; phases sense→health→heal→sync→report
 *   2. Causal Boot Graph — register({ dependsOn }) delays "live" until deps healthy.
 *   3. Conflict Quarantine — duplicate capability claims cannot fight over one role.
 *   4. Total Module Continuum — discover → causalStart → health → heal → rediscover forever.
 *   5. Honesty Fence — commerce/mutator modules never auto-start when unsafe/unconfigured.
 *
 * Public legacy entry points re-export facets of this singleton (shims).
 */

const { EventEmitter } = require('events');

// Facets live under ./iak and MUST NOT be loaded via public shims (cycle-safe).
const externalSense = require('./iak/external-sense');
const tenantQueue = require('./iak/tenant-queue');
const guardianEngines = require('./iak/guardian-engines');
const moduleDiscovery = require('./iak/module-discovery');

const HARMONIC_MS = parseInt(process.env.IAK_HARMONIC_MS || '15000', 10);
const REPORT_EVERY = Math.max(1, parseInt(process.env.IAK_REPORT_EVERY || '20', 10)); // every N ticks
const SYNC_EVERY = Math.max(1, parseInt(process.env.IAK_SYNC_EVERY || '4', 10));
const KERNEL_ID = 'IAK/1.1';

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
    this._discovery = {
      lastScan: null,
      registered: 0,
      started: 0,
      skipped: 0,
      continuumCycles: 0,
      lastCausalStart: null,
    };
    this._startedByIak = new Set();
    this._continuumEvery = Math.max(2, parseInt(process.env.IAK_CONTINUUM_EVERY || '8', 10));

    // Facet handles (same instances as public shims export)
    this.external = externalSense;
    this.tenants = tenantQueue;
    this.guardian = guardianEngines;
    this.discovery = moduleDiscovery;
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

    // Merge if already registered — preserve health counters, upgrade metadata
    const prev = this.registry.get(name);
    this.registry.set(name, {
      instance,
      statusFn,
      lastStatus: prev ? prev.lastStatus : null,
      lastSeen: prev ? prev.lastSeen : null,
      healthy: prev ? prev.healthy : true,
      errors: prev ? prev.errors : 0,
      dependsOn,
      bootPriority: Number.isFinite(opts.bootPriority) ? opts.bootPriority : 100,
      capabilities: caps,
      depsReady: dependsOn.length === 0,
      live: dependsOn.length === 0,
      tier: opts.tier || (prev && prev.tier) || 'observe',
      honestyClass: opts.honestyClass || (prev && prev.honestyClass) || 'observe',
      hasStart: typeof instance.start === 'function',
      hasInit: typeof instance.init === 'function',
      hasHeal: typeof instance.heal === 'function',
      startedByIak: prev ? !!prev.startedByIak : false,
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
    this.mode = (opts && opts.mode) || 'full';

    if (opts && opts.ensureFacets) {
      this.ensureFacets({
        guardianMode: opts.guardianMode || (this.mode === 'monitor' ? 'idle' : 'full'),
      });
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
    try {
      // Perpetual Module Continuum — rediscover + causal-start gaps forever
      if (this.cycleCount > 0 && this.cycleCount % this._continuumEvery === 0) {
        this._continuumReconcile();
      }
      if (this.mode === 'monitor') {
        this.emit('iak:sense', { mode: 'monitor', continuum: this._discovery });
        return;
      }
      this.emit('iak:sense', {
        external: typeof this.external.getStatus === 'function' ? this.external.getStatus() : null,
        tenants: typeof this.tenants.getHealthReport === 'function' ? this.tenants.getHealthReport() : null,
        continuum: this._discovery,
      });
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
        // No statusFn → observe-only (healthy). Never invent health:'unknown'
        // (that string used to trip BAD_HEALTH and spam "Modul degradat").
        let status;
        if (entry.statusFn && entry.instance && typeof entry.instance[entry.statusFn] === 'function') {
          status = entry.instance[entry.statusFn]();
        } else {
          status = { ok: true, health: 'observe', note: 'no_status_fn' };
        }

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
    // monitor = observe only. safe-autonomy + full = heal non-mutators.
    if (this.mode === 'monitor') return;
    for (const [name, entry] of this.registry) {
      if (this.quarantine.has(name)) continue;
      if (entry.healthy) continue;
      if (!entry.depsReady) continue; // Causal Boot: don't thrash heal before deps
      // Under safe-autonomy never heal mutator-tier modules
      if (this.mode === 'safe-autonomy' && entry.tier === 'mutator') continue;
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
      // MBE: refuse mutative heal/restart under safe plane / forbidden paths
      try {
        const mbe = require('./world-standard/mutation-boundary-enforcer');
        const gate = mbe.enforce({
          type: 'health.repair',
          engine: 'iak:' + name,
          targets: entry.tier === 'mutator' ? ['backend/modules/' + name + '.js'] : ['data/iak-heal/' + name],
        });
        if (gate && gate.ok === false && entry.tier === 'mutator') {
          this._log(`🚧 MBE blocked heal for mutator ${name}: ${(gate.reasons || []).join(',')}`);
          return;
        }
      } catch (_) { /* MBE optional */ }

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


  // ------------------------------------------------------------------ discovery + continuum

  /**
   * Compat for sovereign_innovations registerSovereignInnovations.js
   */
  registerModule(instance, opts = {}) {
    if (!instance) return { ok: false, reason: 'invalid_args' };
    const name = opts.name
      || instance.name
      || instance.id
      || instance.module
      || instance.constructor && instance.constructor.name
      || null;
    if (!name || name === 'Object') {
      return { ok: false, reason: 'missing_name' };
    }
    const cls = moduleDiscovery.classify(name);
    return this.register(String(name), instance, {
      statusFn: opts.statusFn,
      dependsOn: opts.dependsOn,
      capability: opts.capability || name,
      bootPriority: opts.bootPriority != null ? opts.bootPriority : cls.bootPriority,
      tier: opts.tier || cls.tier,
      honestyClass: opts.honestyClass || cls.honestyClass,
    });
  }

  /**
   * Discover all runtime-capable modules and register them on the mesh.
   * Idempotent — skips names already registered unless opts.replace.
   */
  discoverAndRegister(opts = {}) {
    const manifest = moduleDiscovery.scan({
      softRequireMissing: opts.softRequireMissing !== false,
      maxSoftRequires: opts.maxSoftRequires,
    });
    let registered = 0;
    let skipped = 0;
    for (const m of manifest.modules) {
      if (this.registry.has(m.name) && !opts.replace) {
        skipped++;
        continue;
      }
      // Capability: use name-scoped capability so we don't quarantine everything
      const r = this.register(m.name, m.instance, {
        statusFn: m.statusFn || undefined,
        dependsOn: opts.ignoreDepends ? [] : moduleDiscovery.defaultDependsOn(m.name, m.tier),
        capability: opts.uniqueCapabilities ? m.name : undefined,
        bootPriority: m.bootPriority,
        tier: m.tier,
        honestyClass: m.honestyClass,
      });
      if (r && r.ok) registered++;
      else skipped++;
    }
    this._discovery.lastScan = new Date().toISOString();
    this._discovery.registered += registered;
    this._discovery.skipped += skipped;
    this._log(`🔎 Discovery: ${manifest.count} found · +${registered} registered · ${skipped} skipped · soft=${manifest.softRequires}`);
    this.emit('iak:discovered', { found: manifest.count, registered, skipped });
    return { found: manifest.count, registered, skipped, softRequires: manifest.softRequires, totalModules: this.registry.size };
  }

  /**
   * Walk causal boot order and start modules allowed by profile + honesty fence.
   */
  causalStart(opts = {}) {
    let bootImmortal = null;
    try { bootImmortal = require('./boot-immortal-os'); } catch (_) { bootImmortal = null; }
    const stable = bootImmortal && typeof bootImmortal.isStableProfile === 'function'
      ? bootImmortal.isStableProfile()
      : (String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase() === 'stable'
        || String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase() === 'safe');
    const selfMutationDisabled = String(process.env.DISABLE_SELF_MUTATION || '') === '1';

    const order = this.bootOrder.length ? this.bootOrder : [...this.registry.keys()];
    let started = 0;
    let skipped = 0;
    const details = [];

    for (const name of order) {
      if (this.quarantine.has(name)) { skipped++; continue; }
      const entry = this.registry.get(name);
      if (!entry) { skipped++; continue; }

      const probe = {
        name,
        instance: entry.instance,
        hasStart: entry.hasStart || typeof entry.instance.start === 'function',
        hasInit: entry.hasInit || typeof entry.instance.init === 'function',
        tier: entry.tier || 'observe',
        honestyClass: entry.honestyClass || 'observe',
      };

      const gate = moduleDiscovery.mayStart(probe, { stable, selfMutationDisabled });
      if (!gate.ok) {
        skipped++;
        details.push({ name, action: 'skip', reason: gate.reason });
        continue;
      }

      // Already running?
      try {
        if (entry.statusFn && typeof entry.instance[entry.statusFn] === 'function') {
          const st = entry.instance[entry.statusFn]();
          if (st && (st.running === true || st.active === true || st.started === true)) {
            skipped++;
            details.push({ name, action: 'already_running' });
            continue;
          }
        }
      } catch (_) { /* proceed to start */ }

      if (this._startedByIak.has(name) && !opts.force) {
        skipped++;
        details.push({ name, action: 'already_iak_started' });
        continue;
      }

      try {
        if (typeof entry.instance.init === 'function' && !entry.startedByIak) {
          entry.instance.init();
        }
        if (typeof entry.instance.start === 'function') {
          entry.instance.start(opts.startArg);
        }
        entry.startedByIak = true;
        this._startedByIak.add(name);
        started++;
        details.push({ name, action: 'started', reason: gate.reason });
      } catch (e) {
        skipped++;
        entry.errors = (entry.errors || 0) + 1;
        details.push({ name, action: 'error', reason: e.message });
        this._log(`⚠️ causalStart ${name}: ${e.message}`);
      }
    }

    this._discovery.started += started;
    const skipReasons = {};
    for (const d of details) {
      if (d.action === 'skip' && d.reason) {
        skipReasons[d.reason] = (skipReasons[d.reason] || 0) + 1;
      }
    }
    this._discovery.lastCausalStart = {
      at: new Date().toISOString(),
      started,
      skipped,
      stable,
      selfMutationDisabled,
      skipReasons,
      details: details.slice(0, 80),
    };
    this._log(`▶️  Causal start: +${started} started · ${skipped} skipped (stable=${stable})`);
    this.emit('iak:causal-start', { started, skipped, stable, skipReasons });
    return { started, skipped, stable, skipReasons, details: details.slice(0, 80) };
  }

  /**
   * Forever reconcile: rediscover gaps + retry causal starts for modules that should be live.
   */
  _continuumReconcile() {
    this._discovery.continuumCycles++;
    try {
      this.discoverAndRegister({ softRequireMissing: true, maxSoftRequires: 50 });
    } catch (e) {
      this._log(`⚠️ continuum discover failed: ${e.message}`);
    }
    try {
      // Under monitor/safe-autonomy still allow stable allowlist starts (infra forever-on)
      this.causalStart();
    } catch (e) {
      this._log(`⚠️ continuum causalStart failed: ${e.message}`);
    }
    // Master duty: drive TAAC armAll under safe-autonomy / full (never invent GMV)
    try {
      this.ensureSafeAutonomyActivation({ source: 'iak-continuum' });
    } catch (e) {
      this._log(`⚠️ TAAC arm via IAK failed: ${e.message}`);
    }
  }

  /**
   * IAK master → TAAC activation organ.
   * Idempotent. Never enables file mutators.
   */
  ensureSafeAutonomyActivation(opts = {}) {
    const mode = this.mode || 'monitor';
    if (mode === 'monitor' && process.env.IAK_FORCE_TAAC !== '1') {
      return { ok: false, skipped: true, reason: 'iak_monitor_no_taac' };
    }
    try {
      const taac = require('./total-autonomy-activation-continuum');
      if (!taac) return { ok: false, reason: 'taac_unavailable' };
      if (typeof taac.start === 'function' && process.env.TAAC_DISABLED !== '1') {
        try { taac.start({ bootDelayMs: 1000 }); } catch (_) { /* already running */ }
      }
      if (typeof taac.armAll !== 'function') return { ok: false, reason: 'taac_no_armAll' };
      const p = taac.armAll({ source: opts.source || 'iak', dryRun: !!opts.dryRun });
      this._discovery.lastSafeActivation = {
        at: new Date().toISOString(),
        source: opts.source || 'iak',
        pending: !!(p && typeof p.then === 'function'),
      };
      if (p && typeof p.then === 'function') {
        p.then((r) => {
          this._discovery.lastSafeActivation = {
            at: new Date().toISOString(),
            source: opts.source || 'iak',
            armedOk: r && r.armedOk,
            ok: !!(r && r.ok),
          };
        }).catch((e) => {
          this._discovery.lastSafeActivation = {
            at: new Date().toISOString(),
            ok: false,
            error: String(e && e.message || e).slice(0, 120),
          };
        });
        return { ok: true, queued: true };
      }
      this._discovery.lastSafeActivation = {
        at: new Date().toISOString(),
        source: opts.source || 'iak',
        armedOk: p && p.armedOk,
        ok: !!(p && p.ok),
      };
      return Object.assign({ ok: !!(p && p.ok) }, p || {});
    } catch (e) {
      return { ok: false, error: String(e && e.message || e).slice(0, 120) };
    }
  }

  /** Public alias used by /api/mesh/sync and legacy callers */
  syncNow() {
    this._phaseSync();
    return { ok: true, ts: new Date().toISOString() };
  }

  /** Legacy UnicornMeshOrchestrator API */
  _syncCycle() {
    return this.syncNow();
  }

  _healthCycle() {
    return this._phaseHealth();
  }

  _reportCycle() {
    return this._phaseReport();
  }

  // ------------------------------------------------------------------ helpers


  _isHealthy(status) {
    if (!status) return false;
    // 'unknown' / 'observe' are NOT faults — only explicit negative health.
    const BAD_HEALTH = new Set(['error', 'failed', 'down', 'critical', 'compromised', 'crashed']);
    const BAD_STATUS = new Set(['error', 'failed', 'down', 'compromised', 'crashed']);
    if (status.ok === false && (status.error || status.fault)) return false;
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
        tier: entry.tier || 'observe',
        honestyClass: entry.honestyClass || 'observe',
        startedByIak: !!entry.startedByIak,
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

    // Collapse peer autonomy organs into one report (no parallel meta-orchestrator).
    const organs = {};
    const soft = (key, rel) => {
      try {
        const m = require(rel);
        if (m && typeof m.getStatus === 'function') organs[key] = m.getStatus();
        else if (m) organs[key] = { present: true };
      } catch (e) {
        organs[key] = { available: false, error: e && e.message };
      }
    };
    soft('spine', './autonomy-spine');
    soft('pcl', './profit-control-loop');
    soft('cpa', './control-plane-agent');
    soft('aacos', './autonomy-action-continuum-os');
    soft('taos', './totalAutonomyOs');
    soft('taac', './total-autonomy-activation-continuum');
    soft('rocs', './reality-ops-continuum');
    soft('clos', './closed-loop-commerce-os');
    soft('preKeys', './pre-keys-activation');
    soft('workflowEngine', './workflowEngine');
    soft('agde', './autonomousGlobalDominanceEngine');
    soft('tcc', './telegram-credential-continuum');
    soft('traffic', './traffic-engine');
    soft('growthBrain', './growth-brain');
    try {
      const rivos = require('../../src/commerce/revenue-invention-continuum-os');
      if (rivos && typeof rivos.status === 'function') organs.rivos = rivos.status();
      else if (rivos && typeof rivos.discovery === 'function') organs.rivos = rivos.discovery();
      else organs.rivos = { present: !!rivos };
    } catch (e) {
      organs.rivos = { available: false, error: e && e.message };
    }
    try {
      const balos = require('../../src/commerce/billion-autonomy-loop-os');
      if (balos && typeof balos.status === 'function') organs.balos = balos.status();
      else organs.balos = { present: !!balos };
    } catch (e) {
      organs.balos = { available: false, error: e && e.message };
    }

    const lastCausal = this._discovery.lastCausalStart;

    return {
      ok: true,
      id: KERNEL_ID,
      master: true,
      role: 'Integrated Autonomy Kernel — single master orchestrator',
      running: this.running,
      mode: this.mode || 'full',
      safeAutonomy: this.mode === 'safe-autonomy' || this.mode === 'full',
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
      discovery: { ...this._discovery, startedByIak: this._startedByIak.size },
      lastCausalStart: lastCausal,
      lastSafeActivation: this._discovery.lastSafeActivation || null,
      continuum: {
        skipReasons: (lastCausal && lastCausal.skipReasons) || {},
        started: lastCausal && lastCausal.started,
        skipped: lastCausal && lastCausal.skipped,
        stable: lastCausal && lastCausal.stable,
        at: lastCausal && lastCausal.at,
      },
      organs,
      policy: {
        inventGmv: 'never',
        fileMutators: 'never_under_safe_autonomy',
        ueeEternal: 'never_under_safe_autonomy',
        outbound: 'credential_gated',
      },
      innovations: [
        'harmonic_phased_tick',
        'causal_boot_graph',
        'conflict_quarantine',
        'total_module_continuum',
        'honesty_fence',
        'organ_status_collapse',
        'safe_autonomy_plane',
        'taac_master_activation',
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
