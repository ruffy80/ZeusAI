'use strict';

/**
 * Orchestrated Capability Continuum — OCC/1.0
 * -------------------------------------------
 * Starts + meshes the Unicorn "future" capabilities as a Swiss-watch continuum:
 * AGISelf-Evolution, AutonomousSpaceComputing, DigitalTwin, NeuralInterface,
 * QuantumInternet, QuantumML, TemporalData, and AGE (Autonomous Governance Executor).
 *
 * Honesty: observe/tick/recommend only. No AGI theater, no invented quantum nets.
 */

const path = require('path');
const fs = require('fs');
const {
  createCapability,
  hostPlaneSense,
  foreverKeySense,
  isoNow,
  dataRoot,
} = require('./capability-factory');

const PROTOCOL = 'OCC/1.0';
const NAME = 'orchestrated-capability-continuum';

function _safeRequire(rel) {
  try { return require(rel); } catch (_) { return null; }
}

function _meshHealth() {
  try {
    const mesh = _safeRequire('./unicornMeshOrchestrator')
      || _safeRequire('./iak')
      || null;
    if (mesh && typeof mesh.getStatus === 'function') return mesh.getStatus();
    if (mesh && typeof mesh.getRegistryStatus === 'function') return mesh.getRegistryStatus();
  } catch (_) { /* ok */ }
  return null;
}

function _ndkSense() {
  try {
    const ndk = require('./never-down-kernel');
    if (typeof ndk.healthEnvelope === 'function') return ndk.healthEnvelope();
    if (typeof ndk.getStatus === 'function') return ndk.getStatus();
  } catch (_) { /* ok */ }
  return null;
}

function _commerceTwinSense() {
  try {
    const twin = require('./world-standard/commerce-twin-portable');
    if (typeof twin.getStatus === 'function') return twin.getStatus();
  } catch (_) { /* ok */ }
  try {
    const dir = path.join(dataRoot(), 'world-standard');
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
      return { ok: true, twinArtifacts: files.length, dir };
    }
  } catch (_) { /* ok */ }
  return { ok: true, twinArtifacts: 0 };
}

function _pricingSense() {
  try {
    const dp = require('./dynamic-pricing');
    if (typeof dp.getStatus === 'function') return dp.getStatus();
  } catch (_) { /* ok */ }
  return { ok: true, pricing: 'unavailable' };
}

const capabilities = {
  agiSelfEvolution: createCapability({
    id: 'AGISelf-EvolutionEngine',
    title: 'AGI Self-Evolution Engine',
    protocol: 'OCC-AGI/1.0',
    year: 2029,
    impact: 'critical',
    role: 'mesh_evolution_observer',
    honestyNote: 'Observes mesh registry evolution — does not claim artificial general intelligence.',
    sense: () => {
      const mesh = _meshHealth();
      const ndk = _ndkSense();
      const regCount = mesh && (mesh.total || mesh.registered || (mesh.engines && mesh.engines.length));
      return {
        ok: true,
        meshPresent: !!mesh,
        registryHint: regCount != null ? regCount : null,
        ndkHealth: ndk && (ndk.health || ndk.status) || null,
        evolutionHint: ndk && ndk.health === 'critical' ? 'prioritize_heal_observe' : 'hold_stable',
      };
    },
  }),

  autonomousSpace: createCapability({
    id: 'AutonomousSpaceComputing',
    title: 'Autonomous Space Computing',
    protocol: 'OCC-SPACE/1.0',
    year: 2046,
    impact: 'high',
    role: 'compute_plane_sensor',
    honestyNote: 'Senses local compute plane (CPU/RAM/disk) — not orbital satellites.',
    sense: () => {
      const host = hostPlaneSense();
      const stressed = (host.freeMemPct != null && host.freeMemPct < 15)
        || (host.diskUsedPct != null && host.diskUsedPct >= 90);
      return Object.assign({}, host, {
        computePlane: stressed ? 'stressed' : 'nominal',
      });
    },
  }),

  digitalTwinNetwork: createCapability({
    id: 'DecentralizedDigitalTwinNetwork',
    title: 'Decentralized Digital Twin Network',
    protocol: 'OCC-TWIN/1.0',
    year: 2036,
    impact: 'high',
    role: 'commerce_twin_observer',
    honestyNote: 'Observes commerce/twin artifacts on disk — not a planetary twin grid.',
    sense: () => _commerceTwinSense(),
  }),

  neuralInterfaceAPI: createCapability({
    id: 'NeuralInterfaceAPI',
    title: 'Neural Interface API',
    protocol: 'OCC-NEURAL/1.0',
    year: 2034,
    impact: 'high',
    role: 'api_surface_sensor',
    honestyNote: 'Scores API/process surface health — not a brain-computer implant API.',
    sense: () => {
      const host = hostPlaneSense();
      const memScore = host.freeMemPct == null ? 50 : Math.min(100, host.freeMemPct);
      return {
        ok: true,
        apiSurfaceScore: memScore,
        uptimeSec: host.uptimeSec,
        signal: memScore >= 40 ? 'clear' : 'noisy',
      };
    },
  }),

  quantumInternet: createCapability({
    id: 'QuantumInternetProtocol',
    title: 'Quantum Internet Protocol',
    protocol: 'OCC-QNET/1.0',
    year: 2031,
    impact: 'critical',
    role: 'crypto_channel_attestor',
    honestyNote: 'Attests forever-key / crypto channel presence — not a quantum entanglement network.',
    sense: () => {
      const key = foreverKeySense();
      let triad = null;
      try {
        const tbos = require('./triad-bond-os');
        triad = typeof tbos.getScore === 'function' ? tbos.getScore() : null;
      } catch (_) { /* ok */ }
      return {
        ok: true,
        foreverKeyPresent: key.foreverKeyPresent,
        triadGrade: triad && triad.grade,
        triadPending: !!(triad && triad.pending),
        channel: key.foreverKeyPresent ? 'classical_forever_key' : 'unsigned_fallback',
      };
    },
  }),

  quantumML: createCapability({
    id: 'QuantumMachineLearningCore',
    title: 'Quantum Machine Learning Core',
    protocol: 'OCC-QML/1.0',
    year: 2032,
    impact: 'high',
    role: 'pricing_signal_observer',
    honestyNote: 'Observes pricing/ML-adjacent signals — not a quantum computer.',
    sense: () => {
      const pricing = _pricingSense();
      return {
        ok: true,
        pricingPresent: !!(pricing && pricing.ok !== false),
        pricingHint: pricing && (pricing.mode || pricing.status || pricing.protocol) || null,
      };
    },
  }),

  temporalData: createCapability({
    id: 'TemporalDataLayer',
    title: 'Temporal Data Layer',
    protocol: 'OCC-TEMPORAL/1.0',
    year: 2041,
    impact: 'medium',
    role: 'temporal_state_observer',
    honestyNote: 'Tracks process temporal state / tick chronology — not time travel.',
    sense: () => ({
      ok: true,
      now: isoNow(),
      uptimeSec: Math.round(process.uptime()),
      hrtimeMs: (() => {
        try {
          const h = process.hrtime();
          return h[0] * 1000 + Math.round(h[1] / 1e6);
        } catch (_) { return Date.now(); }
      })(),
    }),
  }),
};

/** AGE — Autonomous Governance Executor (real constrained actions, not AGI) */
const age = createCapability({
  id: 'AGE',
  title: 'Autonomous Governance Executor',
  protocol: 'AGE/1.0',
  year: 2026,
  impact: 'critical',
  role: 'governance_executor',
  honestyNote: 'Returns constrained observe/heal recommendations from live metrics — never invents payment rails or restarts.',
  sense: () => {
    const ndk = _ndkSense() || {};
    const host = hostPlaneSense();
    const key = foreverKeySense();
    return {
      ok: true,
      ndkHealth: ndk.health || 'unknown',
      commerceBlocked: !!ndk.commerceBlocked,
      freeMemPct: host.freeMemPct,
      diskUsedPct: host.diskUsedPct,
      foreverKeyPresent: key.foreverKeyPresent,
    };
  },
  onProcess: async (body, sensed) => {
    const actions = [];
    if (sensed.commerceBlocked) {
      actions.push({
        action: 'hold_checkout',
        reason: 'commerce_pressure_blocked',
        severity: 'high',
      });
    }
    if (sensed.diskUsedPct != null && sensed.diskUsedPct >= 92) {
      actions.push({
        action: 'request_disk_cleaner',
        reason: 'disk_critical',
        severity: 'high',
        note: 'External healer owns cleanup — AGE only recommends',
      });
    }
    if (sensed.freeMemPct != null && sensed.freeMemPct < 12) {
      actions.push({
        action: 'soft_degrade',
        reason: 'ram_pressure',
        severity: 'medium',
      });
    }
    if (!sensed.foreverKeyPresent) {
      actions.push({
        action: 'ensure_forever_key',
        reason: 'signing_key_missing',
        severity: 'medium',
      });
    }
    if (!actions.length) {
      actions.push({
        action: 'hold_stable',
        reason: 'plane_nominal',
        severity: 'info',
      });
    }
    return {
      age: true,
      actions,
      requested: body && body.intent || null,
      neverRestarts: true,
      neverInventRails: true,
    };
  },
});

const state = {
  running: false,
  startedAt: null,
};

function allCapabilities() {
  return {
    ...capabilities,
    age,
  };
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  const caps = allCapabilities();
  for (const cap of Object.values(caps)) {
    try { if (cap && typeof cap.start === 'function') cap.start(); } catch (_) { /* isolate */ }
  }
  console.log(`[occ] ${PROTOCOL} started · capabilities=${Object.keys(caps).length}`);
  return getStatus();
}

function getStatus() {
  const caps = allCapabilities();
  const details = {};
  let runningCount = 0;
  for (const [key, cap] of Object.entries(caps)) {
    try {
      const s = cap.getStatus();
      details[key] = {
        module: s.module,
        running: s.running,
        ticks: s.ticks,
        ok: s.ok,
        role: s.role,
      };
      if (s.running) runningCount += 1;
    } catch (e) {
      details[key] = { ok: false, error: e.message };
    }
  }
  return {
    ok: runningCount > 0,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Orchestrated Capability Continuum',
    running: !!state.running,
    startedAt: state.startedAt,
    capabilityCount: Object.keys(caps).length,
    runningCount,
    capabilities: details,
    honesty: {
      claimsAgi: false,
      claimsQuantumInternet: false,
      note: 'Continuum orchestrates real observe/tick loops under honest roles — not sci-fi hardware.',
    },
    timestamp: isoNow(),
  };
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  app.get('/api/occ/status', (req, res) => res.json(getStatus()));
  app.get('/api/age/status', (req, res) => res.json(age.getStatus()));
  app.post('/api/age/act', (req, res) => {
    Promise.resolve(age.process(req.body || {}))
      .then((out) => res.json(out))
      .catch((e) => res.status(500).json({ ok: false, error: e.message }));
  });
  return { ok: true };
}

function registerWithMesh(meshOrchestrator) {
  if (!meshOrchestrator || typeof meshOrchestrator.register !== 'function') return { ok: false };
  const caps = allCapabilities();
  const registered = [];
  for (const [key, cap] of Object.entries(caps)) {
    try {
      meshOrchestrator.register(key, cap, { statusFn: 'getStatus' });
      registered.push(key);
    } catch (_) { /* isolate */ }
  }
  try {
    meshOrchestrator.register('orchestratedCapabilityContinuum', module.exports, { statusFn: 'getStatus' });
    registered.push('orchestratedCapabilityContinuum');
  } catch (_) { /* ok */ }
  return { ok: true, registered };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  mountRoutes,
  registerWithMesh,
  capabilities,
  age,
  // Convenience aliases matching backend/index.js bindings
  agiSelfEvolution: capabilities.agiSelfEvolution,
  autonomousSpace: capabilities.autonomousSpace,
  digitalTwinNetwork: capabilities.digitalTwinNetwork,
  neuralInterfaceAPI: capabilities.neuralInterfaceAPI,
  quantumInternet: capabilities.quantumInternet,
  quantumML: capabilities.quantumML,
  temporalDataLayer: capabilities.temporalData,
};
