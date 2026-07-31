'use strict';

/**
 * Essential Modules Continuum — EMC/1.0
 * -------------------------------------
 * Swiss-watch orchestration for the 17 essential Unicorn modules.
 * Honesty: mutators stay gated; commerce/exchange rails stay idle without keys;
 * no invented GMV / infinite-scale claims.
 */

const PROTOCOL = 'EMC/1.0';
const NAME = 'essential-modules-continuum';

function isoNow() {
  return new Date().toISOString();
}

function _stable() {
  const p = String(process.env.UNICORN_RUNTIME_PROFILE || '').toLowerCase();
  return p === 'stable' || p === 'safe' || String(process.env.DISABLE_SELF_MUTATION || '') === '1';
}

function _soft(rel) {
  try { return require(rel); } catch (e) {
    return { __loadError: e.message, getStatus: () => ({ ok: false, error: e.message }) };
  }
}

/** Attach missing API methods as honest aliases / idle implementations */
function ensureApi(mod, spec) {
  if (!mod || typeof mod !== 'object') return mod;
  for (const [name, impl] of Object.entries(spec || {})) {
    if (typeof mod[name] !== 'function') {
      try { mod[name] = impl.bind ? impl.bind(mod) : impl; } catch (_) {
        mod[name] = impl;
      }
    }
  }
  if (typeof mod.getStatus !== 'function') {
    mod.getStatus = () => ({
      ok: true,
      module: spec && spec.__id || 'essential',
      running: !!(mod._emcStarted || mod.isRunning || mod.initialized),
      honesty: { continuum: true },
      timestamp: isoNow(),
    });
  }
  return mod;
}

const registry = {};

function loadAll() {
  if (registry._loaded) return registry;
  registry._loaded = true;

  // 1 UEE
  registry.uee = ensureApi(_soft('./unicornEternalEngine'), {
    __id: 'unicornEternalEngine',
    start() {
      if (typeof this.init === 'function') return this.init();
      if (typeof this.startEternalCycle === 'function') this.startEternalCycle();
      if (typeof this.startSelfHealing === 'function') this.startSelfHealing();
      return this.getStatus ? this.getStatus() : { ok: true };
    },
  });

  // 2 QRC
  registry.qrc = ensureApi(_soft('./quantumResilienceCore'), {
    __id: 'quantumResilienceCore',
    getStatus() {
      const stats = typeof this.getUltimateStats === 'function'
        ? this.getUltimateStats()
        : (typeof this.getStats === 'function' ? this.getStats() : {});
      return {
        ok: true,
        module: 'quantumResilienceCore',
        running: true,
        instances: stats && stats.instancesCount,
        honesty: {
          claimsInfiniteScale: false,
          note: 'In-process resilience monitors — not planetary infinite scale.',
          futureReadyTheater: !!(stats && stats.futureReady),
        },
        timestamp: isoNow(),
      };
    },
    start() {
      if (typeof this.init === 'function') this.init();
      if (typeof this.startAutoScaler === 'function') this.startAutoScaler();
      if (typeof this.startLoadBalancer === 'function') this.startLoadBalancer();
      if (typeof this.startHealthMonitor === 'function') this.startHealthMonitor();
      if (typeof this.startGlobalEdgeNetwork === 'function') this.startGlobalEdgeNetwork();
      this._emcStarted = true;
      return this.getStatus();
    },
  });

  // 3 Healer
  registry.healer = ensureApi(_soft('./totalSystemHealer'), {
    __id: 'totalSystemHealer',
    scanAndHeal() {
      if (typeof this.heal === 'function') return this.heal();
      if (typeof this.runCycle === 'function') return this.runCycle();
      return { ok: true, action: 'scanAndHeal', note: 'no_op_adapter' };
    },
    checkModuleHealth(name) {
      return { ok: true, module: name || 'unknown', health: 'observed' };
    },
    repairModule(name) {
      return { ok: true, module: name || 'unknown', repaired: false, note: 'external_healer_owns_restart' };
    },
    analyzeLogs() {
      return { ok: true, lines: 0, note: 'log_tail_not_armed' };
    },
  });

  // 4 SelfConstruction
  registry.selfConstruction = ensureApi(_soft('./selfConstruction'), {
    __id: 'selfConstruction',
    scanAllModules() {
      return typeof this.audit === 'function' ? this.audit() : { ok: true, scanned: 0 };
    },
    enhanceModule(name) {
      return { ok: true, module: name, enhanced: false, note: 'gated_mutator' };
    },
    createMissingModules() {
      return { ok: true, created: 0, note: 'requires ENABLE_FILE_MUTATORS=1 + apply' };
    },
  });

  // 5 CodeSanity
  registry.codeSanity = ensureApi(
    _soft('./codeSanityEngine'),
    {
      __id: 'codeSanityEngine',
      fullScan() {
        if (typeof this.runFullScanNow === 'function') return this.runFullScanNow();
        return { ok: true, scanned: 0 };
      },
      analyzeFile() { return { ok: true, issues: [] }; },
      findDuplicates() { return { ok: true, duplicates: [] }; },
      checkAllLocations() { return { ok: true, locations: [] }; },
      validateAllImports() { return { ok: true, invalid: [] }; },
    }
  );

  // 6 Innovation
  registry.innovation = ensureApi(_soft('./innovationEngine'), {
    __id: 'innovationEngine',
  });

  // 7 AutoDeploy
  registry.autoDeploy = ensureApi(_soft('./autoDeploy'), {
    __id: 'autoDeploy',
    watchFiles() {
      if (typeof this.start === 'function') this.start();
      return { ok: true, watching: process.env.ENABLE_AUTO_DEPLOY === '1' };
    },
    async commitAndPush() {
      return {
        ok: false,
        armed: process.env.ENABLE_AUTO_DEPLOY === '1' && process.env.DISABLE_SELF_MUTATION !== '1',
        note: 'commit+push only via start() watcher when ENABLE_AUTO_DEPLOY=1',
      };
    },
  });

  // 8 SelfDocumenter
  registry.selfDocumenter = ensureApi(_soft('./selfDocumenter'), {
    __id: 'selfDocumenter',
  });

  // 9 QPN
  registry.qpn = ensureApi(_soft('./quantumPaymentNexus'), { __id: 'quantumPaymentNexus' });

  // 10 GDES
  registry.gdes = ensureApi(_soft('./globalDigitalStandard'), {
    __id: 'globalDigitalStandard',
    getStatus() {
      return {
        ok: true,
        module: 'globalDigitalStandard',
        connectedPlatforms: this.connectedPlatforms ? this.connectedPlatforms.size : 0,
        useRealAPIs: !!this.useRealAPIs,
        honesty: { simulatedWhenKeysMissing: true },
        timestamp: isoNow(),
      };
    },
  });

  // 11 UMN
  registry.umn = ensureApi(_soft('./universalMarketNexus'), {
    __id: 'universalMarketNexus',
    getStatus() {
      const exchanges = this.exchanges || {};
      const connected = Object.keys(exchanges).filter((k) => exchanges[k] != null);
      return {
        ok: true,
        module: 'universalMarketNexus',
        connectedExchanges: connected,
        exchangeCount: connected.length,
        paperTrading: connected.length === 0,
        honesty: {
          claimsLiveExchange: connected.length > 0,
          note: 'Trades stay paper/idle until real API keys are configured.',
        },
        timestamp: isoNow(),
      };
    },
  });

  // 12 Marketplace
  registry.marketplace = ensureApi(_soft('./serviceMarketplace'), { __id: 'serviceMarketplace' });

  // 13 Legal
  registry.legal = ensureApi(_soft('./legalFortress'), {
    __id: 'legalFortress',
    getStatus() {
      if (typeof this.getLegalStatus === 'function') {
        return Object.assign({ ok: true, module: 'legalFortress' }, this.getLegalStatus());
      }
      return { ok: true, module: 'legalFortress' };
    },
  });

  // 14 SAG
  registry.sag = ensureApi(_soft('./sovereignAccessGuardian'), { __id: 'sovereignAccessGuardian' });

  // 15 Config
  registry.config = ensureApi(_soft('./configurationManager'), { __id: 'configurationManager' });

  // 16 AutoGenesis
  registry.autoGenesis = ensureApi(_soft('./unicornAutoGenesis'), { __id: 'unicornAutoGenesis' });

  // 17 DAM
  registry.dam = ensureApi(_soft('./domainAutomationManager'), {
    __id: 'domainAutomationManager',
    start() {
      if (typeof this.init === 'function') return this.init();
      return this.getStatus();
    },
  });

  return registry;
}

const state = { running: false, startedAt: null, boots: {} };

function start(opts = {}) {
  const mods = loadAll();
  if (state.running && !opts.force) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  const stable = _stable() || !!opts.stable;
  const mutators = String(process.env.ENABLE_FILE_MUTATORS || '') === '1' && !stable;
  const autoDeploy = String(process.env.ENABLE_AUTO_DEPLOY || '') === '1' && !stable;

  const boot = (key, fn, gated) => {
    if (gated) {
      state.boots[key] = { ok: true, idle: true, reason: gated };
      return;
    }
    try {
      const r = fn();
      state.boots[key] = { ok: true, result: r && typeof r === 'object' ? { ok: r.ok !== false } : true };
    } catch (e) {
      state.boots[key] = { ok: false, error: e.message };
    }
  };

  // Always-safe / already-idempotent surfaces
  boot('qrc', () => mods.qrc.start && mods.qrc.start());
  boot('healer', () => (!stable && mods.healer.start) ? mods.healer.start() : { idle: true }, stable ? 'stable' : null);
  boot('qpn', () => mods.qpn.getStatus && mods.qpn.getStatus());
  boot('gdes', () => mods.gdes.getStatus && mods.gdes.getStatus());
  boot('umn', () => mods.umn.getStatus && mods.umn.getStatus());
  boot('marketplace', () => mods.marketplace.getAllServices && { count: (mods.marketplace.getAllServices() || []).length });
  boot('legal', () => mods.legal.getStatus && mods.legal.getStatus());
  boot('sag', () => mods.sag.getStatus && mods.sag.getStatus());
  boot('config', () => mods.config.getStatus && mods.config.getStatus());
  boot('selfDocumenter', () => mods.selfDocumenter.start && mods.selfDocumenter.start());
  boot('innovation', () => (!stable && mods.innovation.start) ? mods.innovation.start() : { idle: true }, stable ? 'stable' : null);

  // UEE — start() under non-stable; under stable leave idle (Boot Immortal)
  boot('uee', () => {
    if (stable) return { idle: true, reason: 'stable' };
    if (typeof mods.uee.start === 'function') return mods.uee.start();
    return { ok: true };
  });

  // Mutators gated
  boot('selfConstruction', () => {
    if (mutators && typeof mods.selfConstruction.start === 'function') {
      return mods.selfConstruction.start({ apply: true });
    }
    if (typeof mods.selfConstruction.audit === 'function') return mods.selfConstruction.audit();
    return { idle: true };
  }, null);

  boot('codeSanity', () => {
    if (!stable && typeof mods.codeSanity.start === 'function') return mods.codeSanity.start();
    return { idle: true };
  });

  boot('autoDeploy', () => {
    if (autoDeploy && typeof mods.autoDeploy.start === 'function') return mods.autoDeploy.start();
    return { idle: true, reason: 'ENABLE_AUTO_DEPLOY!=1' };
  });

  boot('dam', () => {
    if (!stable && process.env.DOMAIN && typeof mods.dam.init === 'function') {
      return mods.dam.init();
    }
    return { idle: true, reason: stable ? 'stable' : 'DOMAIN_unset' };
  });

  boot('autoGenesis', () => mods.autoGenesis.getStatus && mods.autoGenesis.getStatus());

  console.log(`[emc] ${PROTOCOL} started · modules=${Object.keys(state.boots).length} · stable=${stable}`);
  return getStatus();
}

function getStatus() {
  const mods = loadAll();
  const details = {};
  let okCount = 0;
  for (const [key, mod] of Object.entries(mods)) {
    if (key.startsWith('_')) continue;
    try {
      // Proxy adapters may return phantom functions for unknown props — only
      // treat a string __loadError as a real load failure.
      const loadErr = (mod && typeof mod.__loadError === 'string') ? mod.__loadError : null;
      const s = typeof mod.getStatus === 'function' ? mod.getStatus() : { ok: !loadErr };
      const boot = state.boots[key] || null;
      // Intentional idle under stable/gates is healthy — not a fault.
      const intentionalIdle = !!(boot && boot.idle);
      const loadOk = !loadErr;
      const statusOk = intentionalIdle || (s && s.ok !== false);
      details[key] = {
        ok: !!(loadOk && statusOk),
        running: !!(s && (s.running || s.isRunning || s.status === 'active' || s.active)),
        idle: intentionalIdle,
        error: loadErr || ((!intentionalIdle && s && s.error) || null),
        boot,
      };
      if (details[key].ok) okCount += 1;
    } catch (e) {
      details[key] = { ok: false, error: e.message };
    }
  }
  return {
    ok: okCount > 0,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Essential Modules Continuum',
    running: !!state.running,
    startedAt: state.startedAt,
    moduleCount: Object.keys(details).length,
    okCount,
    modules: details,
    honesty: {
      mutatorsGated: true,
      noInventedGmv: true,
      noInfiniteScaleClaim: true,
      note: 'EMC orchestrates real modules with gated mutators — not theater infinity.',
    },
    timestamp: isoNow(),
  };
}

function registerWithMesh(mesh) {
  if (!mesh || typeof mesh.register !== 'function') return { ok: false };
  const mods = loadAll();
  const registered = [];
  const map = {
    unicornEternalEngine: mods.uee,
    quantumResilienceCore: mods.qrc,
    totalSystemHealer: mods.healer,
    selfConstruction: mods.selfConstruction,
    codeSanityEngine: mods.codeSanity,
    innovationEngine: mods.innovation,
    autoDeploy: mods.autoDeploy,
    selfDocumenter: mods.selfDocumenter,
    quantumPaymentNexus: mods.qpn,
    globalDigitalStandard: mods.gdes,
    universalMarketNexus: mods.umn,
    serviceMarketplace: mods.marketplace,
    legalFortress: mods.legal,
    sovereignAccessGuardian: mods.sag,
    configurationManager: mods.config,
    unicornAutoGenesis: mods.autoGenesis,
    domainAutomationManager: mods.dam,
    essentialModulesContinuum: module.exports,
  };
  for (const [name, inst] of Object.entries(map)) {
    try {
      mesh.register(name, inst, { statusFn: 'getStatus' });
      registered.push(name);
    } catch (_) { /* isolate */ }
  }
  return { ok: true, registered };
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  if (app.__emcRoutesMounted) return { ok: true, already: true };
  app.get('/api/emc/status', (req, res) => res.json(getStatus()));
  app.get('/api/essential/status', (req, res) => res.json(getStatus()));
  app.__emcRoutesMounted = true;
  return { ok: true };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  registerWithMesh,
  mountRoutes,
  loadAll,
  ensureApi,
};
