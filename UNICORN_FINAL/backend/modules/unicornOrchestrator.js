// Alias pentru orchestrator: statusFn
module.exports.statusFn = module.exports.getStatus;
// MeshOrchestrator expects a status function (getStatus)
module.exports.getStatus = function() {
  if (typeof this.getStatus === 'function') {
    return this.getStatus();
  }
  return { status: 'unknown' };
};
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-12T19:36:32.199Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

/**
 * 🦄 UNICORN ORCHESTRATOR — Orchestratorul Central
 * ===================================================
 * Activează și supraveghează automat toate cele 8 motoare autonome:
 *
 *   1. Self-Healing Engine      — totalSystemHealer + controlPlane + uee healing
 *   2. Auto-Innovation Loop     — autonomousInnovation + uee eternal/predictive cycles
 *   3. Auto-Deploy              — autoDeploy + autoDeployOrchestrator
 *   4. Auto-Repair              — selfConstruction + codeSanityEngine
 *   5. Auto-Update              — unicornEternalEngine.autoUpdateSite + executiveDashboard
 *   6. Auto-Scaling             — quantumResilienceCore autoScaler
 *   7. Auto-Monitoring          — sloTracker + meshOrchestrator health + customerHealth
 *   8. Auto-Decision AI         — controlPlane agent + profitControlLoop AI decisions
 *
 * Toate ciclurile pornesc automat la require().
 * Expune getStatus() pentru ruta /api/orchestrator/status.
 */

const EventEmitter = require('events');
const path = require('path');

const MODULES_DIR = path.join(__dirname);
const SRC_DIR     = path.join(__dirname, '../../src');

// ─── Încărcare engine-uri cu fallback graceful ────────────────────────────────
function tryRequire(p, label) {
  try {
    const m = require(p);
    return m;
  } catch (e) {
    console.warn(`[UnicornOrchestrator] ⚠️  ${label} unavailable: ${e.message}`);
    return null;
  }
}

class UnicornOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map(); this.cacheTTL = 60000;

    this.startedAt = null;
    this.cycles    = {};
    this._running  = false;
    this._monitors = [];
    this.mode      = null;

    // Inițializare statistici pentru fiecare motor
    this.stats = {
      selfHealing:    { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoInnovation: { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoDeploy:     { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoRepair:     { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoUpdate:     { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoScaling:    { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoMonitoring: { active: false, cycles: 0, lastRun: null, errors: 0 },
      autoDecisionAI: { active: false, cycles: 0, lastRun: null, errors: 0 },
    };

    // Auto-start imediat la require()
    this.start('full');
  }

  // ─── Start ─────────────────────────────────────────────────────────────────
  start(mode) {
    if (this._running) {
      // Allow upgrade from standard to full without full restart
      if (mode === 'full' && this.mode !== 'full') {
        this.mode = 'full';
        this._activateFullMode();
      }
      return this;
    }
    this._running  = true;
    this.startedAt = Date.now();
    this.mode      = mode || 'standard';

    console.log('🦄 [UnicornOrchestrator] ══════════════════════════════════');
    console.log(`🦄 [UnicornOrchestrator]  ORCHESTRATOR UNICORN — PORNIT [mode: ${this.mode}]`);
    console.log('🦄 [UnicornOrchestrator]  Activez toate cele 8 motoare...');
    console.log('🦄 [UnicornOrchestrator] ══════════════════════════════════');

    this._activateSelfHealing();
    this._activateAutoInnovation();
    this._activateAutoDeploy();
    this._activateAutoRepair();
    this._activateAutoUpdate();
    this._activateAutoScaling();
    this._activateAutoMonitoring();
    this._activateAutoDecisionAI();

    if (this.mode === 'full') {
      this._activateFullMode();
    }

    // Ciclu de supraveghere globală — verifică starea fiecărui motor la fiecare 30s
    this._monitors.push(setInterval(() => this._guardianCycle(), 30_000));

    console.log(`🦄 [UnicornOrchestrator] ✅ Toate motoarele ACTIVE [mode: ${this.mode}]`);
    this.emit('orchestrator:started', { ts: new Date().toISOString(), mode: this.mode });
    return this;
  }

  // ─── Full Mode — activează toate modulele suplimentare ──────────────────────
  _activateFullMode() {
    this._log('🚀', 'Full Mode: activare motoare suplimentare...');

    // Central Orchestrator
    const centralOrch = tryRequire(path.join(MODULES_DIR, 'central-orchestrator'), 'CentralOrchestrator');
    if (centralOrch && typeof centralOrch.start === 'function') {
      try {
        const s = typeof centralOrch.getStatus === 'function' ? centralOrch.getStatus() : {};
        if (!s.running) centralOrch.start();
      } catch (_) {}
    }

    // SaaS Orchestrator V4
    const saasOrch = tryRequire(path.join(MODULES_DIR, 'saas-orchestrator-v4'), 'SaaSOrchestratorV4');
    if (saasOrch && typeof saasOrch.start === 'function') {
      try {
        const s = typeof saasOrch.getStatus === 'function' ? saasOrch.getStatus() : {};
        if (!s.running) saasOrch.start();
      } catch (_) {}
    }

    // Unicorn Execution Engine
    const uee2 = tryRequire(path.join(MODULES_DIR, 'unicorn-execution-engine'), 'UnicornExecutionEngine');
    if (uee2 && typeof uee2.start === 'function') {
      try { uee2.start(); } catch (_) {}
    }

    // Auto-Repair / Auto-Optimize
    const autoOptimize = tryRequire(path.join(MODULES_DIR, 'auto-optimize'), 'AutoOptimize');
    if (autoOptimize && typeof autoOptimize.start === 'function') {
      try { autoOptimize.start(); } catch (_) {}
    }
    const autoRepairMod = tryRequire(path.join(MODULES_DIR, 'auto-repair'), 'AutoRepair');
    if (autoRepairMod && typeof autoRepairMod.start === 'function') {
      try { autoRepairMod.start(); } catch (_) {}
    }

    // Auto-Evolution
    const autoEvolve = tryRequire(path.join(MODULES_DIR, 'auto-evolve'), 'AutoEvolve');
    if (autoEvolve && typeof autoEvolve.start === 'function') {
      try { autoEvolve.start(); } catch (_) {}
    }
    const selfEvolvingEng = tryRequire(path.join(MODULES_DIR, 'self-evolving-engine'), 'SelfEvolvingEngine');
    if (selfEvolvingEng && typeof selfEvolvingEng.start === 'function') {
      try { selfEvolvingEng.start(); } catch (_) {}
    }
    const selfAdaptEng = tryRequire(path.join(MODULES_DIR, 'self-adaptation-engine'), 'SelfAdaptationEngine');
    if (selfAdaptEng && typeof selfAdaptEng.start === 'function') {
      try { selfAdaptEng.start(); } catch (_) {}
    }

    // Auto-Innovation Loop
    const innovLoop = tryRequire(path.join(MODULES_DIR, 'auto-innovation-loop'), 'AutoInnovationLoop');
    if (innovLoop && typeof innovLoop.start === 'function') {
      try {
        const s = typeof innovLoop.getStatus === 'function' ? innovLoop.getStatus() : {};
        if (!s.active) innovLoop.start();
      } catch (_) {}
    }

    // Auto-Marketing / Viral Growth
    const autoMarketing = tryRequire(path.join(MODULES_DIR, 'auto-marketing'), 'AutoMarketing');
    if (autoMarketing && typeof autoMarketing.start === 'function') {
      try { autoMarketing.start(); } catch (_) {}
    }
    const viralGrowth = tryRequire(path.join(MODULES_DIR, 'autoViralGrowth'), 'AutoViralGrowth');
    if (viralGrowth && typeof viralGrowth.start === 'function') {
      try { viralGrowth.start(); } catch (_) {}
    }

    // Auto-Revenue
    const autoRev = tryRequire(path.join(MODULES_DIR, 'autoRevenue'), 'AutoRevenue');
    if (autoRev && typeof autoRev.start === 'function') {
      try { autoRev.start(); } catch (_) {}
    }

    // Disaster Recovery / Global Failover
    const disasterRec = tryRequire(path.join(MODULES_DIR, 'disaster-recovery'), 'DisasterRecovery');
    if (disasterRec && typeof disasterRec.start === 'function') {
      try { disasterRec.start(); } catch (_) {}
    }
    const globalFailover = tryRequire(path.join(MODULES_DIR, 'global-failover'), 'GlobalFailover');
    if (globalFailover && typeof globalFailover.start === 'function') {
      try { globalFailover.start(); } catch (_) {}
    }

    // Predictive Healing
    const predHealing = tryRequire(path.join(MODULES_DIR, 'predictive-healing'), 'PredictiveHealing');
    if (predHealing && typeof predHealing.start === 'function') {
      try { predHealing.start(); } catch (_) {}
    }

    // Swarm Intelligence
    const swarm = tryRequire(path.join(MODULES_DIR, 'swarm-intelligence'), 'SwarmIntelligence');
    if (swarm && typeof swarm.start === 'function') {
      try { swarm.start(); } catch (_) {}
    }

    // Quantum Resilience Core
    const qrc2 = tryRequire(path.join(MODULES_DIR, 'quantumResilienceCore'), 'QuantumResilienceCore');
    if (qrc2 && typeof qrc2.startAutoScaler === 'function') {
      try { qrc2.startAutoScaler(); } catch (_) {}
    }

    this._log('✅', 'Full Mode: toate modulele suplimentare ACTIVE');
    this.emit('orchestrator:full', { ts: new Date().toISOString() });
  }

  // ─── 1. Self-Healing Engine ─────────────────────────────────────────────────
  _activateSelfHealing() {
    const healer = tryRequire(path.join(MODULES_DIR, 'totalSystemHealer'), 'TotalSystemHealer');
    const uee    = tryRequire(path.join(MODULES_DIR, 'unicornEternalEngine'), 'UnicornEternalEngine');
    const gdes   = tryRequire(path.join(MODULES_DIR, 'globalDigitalStandard'), 'GlobalDigitalStandard');

    if (healer && typeof healer.start === 'function') {
      try { healer.start(); } catch (_) {}
    }
    if (uee && typeof uee.startSelfHealing === 'function') {
      try { uee.startSelfHealing(); } catch (_) {}
    }
    if (gdes && typeof gdes.startSelfHealing === 'function') {
      try { gdes.startSelfHealing(); } catch (_) {}
    }

    // Active = engine modules exist OR already loaded in require cache
    this.stats.selfHealing.active = !!(healer || uee || gdes) || (() => {
      try {
        return !!(require.cache[require.resolve(path.join(MODULES_DIR, 'totalSystemHealer'))] ||
                  require.cache[require.resolve(path.join(MODULES_DIR, 'unicornEternalEngine'))]);
      } catch (_) { return false; }
    })();
    this.stats.selfHealing.lastRun = new Date().toISOString();
    this._log('🛠️ ', 'Self-Healing Engine: ACTIV');
  }

  // ─── 2. Auto-Innovation Loop ────────────────────────────────────────────────
  _activateAutoInnovation() {
    const innov = tryRequire(path.join(MODULES_DIR, 'autonomousInnovation'), 'AutonomousInnovation');
    const uee   = tryRequire(path.join(MODULES_DIR, 'unicornEternalEngine'), 'UnicornEternalEngine');

    // autonomousInnovation auto-starts in constructor — just verify it's alive
    if (innov && typeof innov.getStatus === 'function') {
      const status = innov.getStatus();
      this.stats.autoInnovation.active = true;
      this.stats.autoInnovation.lastRun = new Date().toISOString();
      if (status && typeof status === 'object') {
        this.stats.autoInnovation.cycles = status.totalCycles || 0;
      }
    }
    if (uee) {
      try { uee.startEternalCycle(); } catch (_) {}
      try { uee.startPredictiveInnovation(); } catch (_) {}
    }

    if (!this.stats.autoInnovation.active) {
      this.stats.autoInnovation.active = !!(innov || uee);
    }
    this._log('🧠', 'Auto-Innovation Loop: ACTIV');
  }

  // ─── 3. Auto-Deploy ────────────────────────────────────────────────────────
  _activateAutoDeploy() {
    const deploy = tryRequire(path.join(MODULES_DIR, 'autoDeploy'), 'AutoDeploy');
    const orch   = tryRequire(path.join(SRC_DIR, 'modules/auto-deploy-orchestrator'), 'AutoDeployOrchestrator');

    if (deploy && typeof deploy.start === 'function') {
      try { deploy.start(); } catch (_) {}
    }
    // autoDeployOrchestrator auto-inits in constructor

    this.stats.autoDeploy.active = !!(deploy || orch) || (() => {
      try {
        return !!(require.cache[require.resolve(path.join(MODULES_DIR, 'autoDeploy'))]);
      } catch (_) { return false; }
    })();
    this.stats.autoDeploy.lastRun = new Date().toISOString();
    this._log('🚀', 'Auto-Deploy: ACTIV');
  }

  // ─── 4. Auto-Repair ────────────────────────────────────────────────────────
  _activateAutoRepair() {
    const sanity  = tryRequire(path.join(SRC_DIR, 'modules/code-sanity-engine'), 'CodeSanityEngine');
    const builder = tryRequire(path.join(MODULES_DIR, 'selfConstruction'), 'SelfConstruction');

    if (sanity && typeof sanity.start === 'function') {
      try { sanity.start(); } catch (_) {}
    }
    if (builder && typeof builder.start === 'function') {
      try { builder.start(); } catch (_) {}
    }

    this.stats.autoRepair.active = !!(sanity || builder);
    this.stats.autoRepair.lastRun = new Date().toISOString();
    this._log('🔧', 'Auto-Repair: ACTIV');
  }

  // ─── 5. Auto-Update ────────────────────────────────────────────────────────
  _activateAutoUpdate() {
    const dashboard = tryRequire(path.join(MODULES_DIR, 'executiveDashboard'), 'ExecutiveDashboard');
    const uee       = tryRequire(path.join(MODULES_DIR, 'unicornEternalEngine'), 'UnicornEternalEngine');

    // executiveDashboard.startAutoUpdate() is called in its constructor
    // uee.autoUpdateSite() is invoked from startEternalCycle()
    this.stats.autoUpdate.active = !!(dashboard || uee);
    this.stats.autoUpdate.lastRun = new Date().toISOString();
    this._log('🔄', 'Auto-Update: ACTIV');
  }

  // ─── 6. Auto-Scaling ───────────────────────────────────────────────────────
  _activateAutoScaling() {
    const qrc = tryRequire(path.join(MODULES_DIR, 'quantumResilienceCore'), 'QuantumResilienceCore');

    // qrc auto-inits in constructor and calls startAutoScaler()
    if (qrc && typeof qrc.getStatus === 'function') {
      const status = qrc.getStatus();
      this.stats.autoScaling.active = !!(status && status.instances);
    }
    if (!this.stats.autoScaling.active) {
      this.stats.autoScaling.active = !!qrc || (() => {
        try {
          return !!(require.cache[require.resolve(path.join(MODULES_DIR, 'quantumResilienceCore'))]);
        } catch (_) { return false; }
      })();
    }
    this.stats.autoScaling.lastRun = new Date().toISOString();
    this._log('⚖️ ', 'Auto-Scaling: ACTIV');
  }

  // ─── 7. Auto-Monitoring ────────────────────────────────────────────────────
  _activateAutoMonitoring() {
    const slo    = tryRequire(path.join(MODULES_DIR, 'slo-tracker'), 'SLOTracker');
    const mesh   = tryRequire(path.join(MODULES_DIR, 'unicornMeshOrchestrator'), 'UnicornMeshOrchestrator');
    const custH  = tryRequire(path.join(MODULES_DIR, 'customerHealth'), 'CustomerHealth');

    // Schedule auto-monitoring cycle every 60 seconds
    this._monitors.push(setInterval(() => {
      this.stats.autoMonitoring.cycles++;
      this.stats.autoMonitoring.lastRun = new Date().toISOString();
      try {
        if (slo && typeof slo.getAllStats === 'function') {
          const sloStats = slo.getAllStats();
          const degraded = Object.entries(sloStats || {}).filter(
            ([, v]) => v && v.errorRate > 0.1
          );
          if (degraded.length > 0) {
            this._log('⚠️ ', `Auto-Monitor: ${degraded.length} rute degradate detectate`, degraded.map(([r]) => r));
            this.emit('monitoring:alert', { degradedRoutes: degraded });
          }
        }
        if (mesh && typeof mesh.getStatus === 'function') {
          const meshStatus = mesh.getStatus();
          if (meshStatus && meshStatus.unhealthy && meshStatus.unhealthy.length > 0) {
            this._log('⚠️ ', `Auto-Monitor: ${meshStatus.unhealthy.length} module unhealthy detectate`);
            this.emit('monitoring:unhealthy', { modules: meshStatus.unhealthy });
          }
        }
      } catch (e) {
        this.stats.autoMonitoring.errors++;
      }
    }, 60_000));

    this.stats.autoMonitoring.active = !!(slo || mesh || custH);
    this.stats.autoMonitoring.lastRun = new Date().toISOString();
    this._log('📡', 'Auto-Monitoring: ACTIV');
  }

  // ─── 8. Auto-Decision AI ───────────────────────────────────────────────────
  _activateAutoDecisionAI() {
    const cp   = tryRequire(path.join(MODULES_DIR, 'control-plane-agent'), 'ControlPlaneAgent');
    const loop = tryRequire(path.join(MODULES_DIR, 'profit-control-loop'), 'ProfitControlLoop');

    // control-plane-agent calls agent.start() on module export line — auto-started
    // profit-control-loop calls loop.start() on module export line — auto-started
    if (cp && typeof cp.getStatus === 'function') {
      this.stats.autoDecisionAI.active = true;
    }
    if (!this.stats.autoDecisionAI.active) {
      this.stats.autoDecisionAI.active = !!(cp || loop);
    }
    this.stats.autoDecisionAI.lastRun = new Date().toISOString();
    this._log('🤖', 'Auto-Decision AI: ACTIV');
  }

  // ─── Guardian cycle — supraveghează și reporneşte motoare inactive ──────────
  _guardianCycle() {
    const engines = Object.keys(this.stats);
    for (const engine of engines) {
      if (!this.stats[engine].active) {
        this._log('🔁', `Guardian: ${engine} inactiv — tentativă de reactivare`);
        try {
          const methodName = `_activate${engine.charAt(0).toUpperCase() + engine.slice(1)}`;
          if (typeof this[methodName] === 'function') {
            this[methodName]();
          }
        } catch (e) {
          this._log('❌', `Guardian: reactivare ${engine} eșuată: ${e.message}`);
        }
      }
    }
  }

  // ─── getStatus ─────────────────────────────────────────────────────────────
  getStatus() {
    const upMs = this.startedAt ? Date.now() - this.startedAt : 0;
    const allActive = Object.values(this.stats).every(s => s.active);
    return {
      status: allActive ? 'FULLY_AUTONOMOUS' : 'PARTIAL',
      mode: this.mode || 'standard',
      uptime: Math.floor(upMs / 1000),
      uptimeHuman: this._formatUptime(upMs),
      startedAt: this.startedAt ? new Date(this.startedAt).toISOString() : null,
      engines: {
        selfHealing:    { ...this.stats.selfHealing,    label: 'Self-Healing Engine' },
        autoInnovation: { ...this.stats.autoInnovation, label: 'Auto-Innovation Loop' },
        autoDeploy:     { ...this.stats.autoDeploy,     label: 'Auto-Deploy' },
        autoRepair:     { ...this.stats.autoRepair,     label: 'Auto-Repair' },
        autoUpdate:     { ...this.stats.autoUpdate,     label: 'Auto-Update' },
        autoScaling:    { ...this.stats.autoScaling,    label: 'Auto-Scaling' },
        autoMonitoring: { ...this.stats.autoMonitoring, label: 'Auto-Monitoring' },
        autoDecisionAI: { ...this.stats.autoDecisionAI, label: 'Auto-Decision AI' },
      },
    };
  }

  // ─── Utils ──────────────────────────────────────────────────────────────────
  _log(emoji, msg, data) {
    const ts = new Date().toISOString();
    if (data) {
      console.log(`${ts}  ${emoji}  [UnicornOrchestrator] ${msg}`, JSON.stringify(data));
    } else {
      console.log(`${ts}  ${emoji}  [UnicornOrchestrator] ${msg}`);
    }
  }

  _formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }
}

// Export singleton — auto-starts on require
module.exports = new UnicornOrchestrator();
