'use strict';

/**
 * Total Ecosystem Perfection OS — TEP/1.0
 * Inventory + ensure Adaptive/Engine shims + essential surface health.
 * Honesty: registers/observes; mutators stay gated; no invented GMV.
 */

const fs = require('fs');
const path = require('path');

const PROTOCOL = 'TEP/1.0';
const NAME = 'total-ecosystem-perfection-os';
const MODULES_DIR = __dirname;
const GENERATED_DIR = path.join(__dirname, '..', 'generated');

const ESSENTIAL = [
  'unicornEternalEngine', 'quantumResilienceCore', 'totalSystemHealer',
  'selfConstruction', 'codeSanityEngine', 'innovationEngine', 'autoDeploy',
  'quantumPaymentNexus', 'serviceMarketplace', 'globalDigitalStandard',
  'universalMarketNexus', 'legalFortress', 'sovereignAccessGuardian',
  'configurationManager', 'domainAutomationManager', 'unicornAutoGenesis',
  'executiveDashboard', 'aiNegotiator', 'carbonExchange', 'riskAnalyzer',
  'opportunityRadar', 'businessBlueprint', 'complianceEngine', 'reputationProtocol',
  'aviationModule', 'defenseModule', 'governmentModule', 'telecomModule',
  'socialMediaViralizer', 'revenueModules', 'quantumVault',
  'orchestrated-capability-continuum', 'essential-modules-continuum',
  'continuum-harmony-os', 'adaptiveEnginePool',
];

const state = {
  running: false,
  startedAt: null,
  lastInventory: null,
  lastEnsure: null,
};

function isoNow() {
  return new Date().toISOString();
}

function inventory() {
  let moduleFiles = [];
  let generatedFiles = [];
  try {
    moduleFiles = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith('.js'));
  } catch (_) { /* ok */ }
  try {
    generatedFiles = fs.readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.js'));
  } catch (_) { /* ok */ }

  const adaptive = moduleFiles.filter((f) => /^AdaptiveModule\d+\.js$/i.test(f));
  const engines = moduleFiles.filter((f) => /^Engine\d+\.js$/i.test(f));

  const essential = {};
  for (const name of ESSENTIAL) {
    const candidates = [
      path.join(MODULES_DIR, name + '.js'),
      path.join(MODULES_DIR, name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '.js'),
    ];
    // also try kebab known aliases
    const kebabMap = {
      codeSanityEngine: 'codeSanityEngine.js',
      socialMediaViralizer: 'socialMediaViralizer.js',
    };
    const file = kebabMap[name] || (name + '.js');
    const abs = path.join(MODULES_DIR, file);
    essential[name] = {
      present: fs.existsSync(abs),
      path: abs,
    };
  }

  const inv = {
    ok: true,
    modulesDirCount: moduleFiles.length,
    generatedCount: generatedFiles.length,
    adaptiveShimCount: adaptive.length,
    engineShimCount: engines.length,
    poolTotal: adaptive.length + engines.length,
    essentialPresent: Object.values(essential).filter((e) => e.present).length,
    essentialTotal: ESSENTIAL.length,
    essential,
    timestamp: isoNow(),
  };
  state.lastInventory = inv;
  return inv;
}

function ensurePool() {
  let pool;
  try { pool = require('./adaptiveEnginePool'); } catch (e) {
    return { ok: false, error: e.message };
  }
  const mats = typeof pool.materializeShims === 'function' ? pool.materializeShims() : { ok: false };
  const started = typeof pool.start === 'function' ? pool.start() : null;
  const out = {
    ok: !!(mats && mats.ok !== false),
    materialize: mats,
    poolStatus: started || (pool.getStatus && pool.getStatus()),
  };
  state.lastEnsure = out;
  return out;
}

function start(opts = {}) {
  if (state.running && !opts.force) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  inventory();
  ensurePool();
  console.log(`[tep] ${PROTOCOL} started · modules≈${(state.lastInventory && state.lastInventory.modulesDirCount) || '?'}`);
  return getStatus();
}

function getStatus() {
  const inv = state.lastInventory || inventory();
  const essentialOk = inv.essentialPresent >= inv.essentialTotal;
  const poolOk = inv.adaptiveShimCount >= 82 && inv.engineShimCount >= 62;
  return {
    ok: essentialOk && poolOk && inv.modulesDirCount >= 200,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Total Ecosystem Perfection OS',
    running: !!state.running,
    startedAt: state.startedAt,
    modulesDirCount: inv.modulesDirCount,
    generatedCount: inv.generatedCount,
    adaptiveShimCount: inv.adaptiveShimCount,
    engineShimCount: inv.engineShimCount,
    essentialPresent: inv.essentialPresent,
    essentialTotal: inv.essentialTotal,
    over200: inv.modulesDirCount >= 200,
    lastEnsure: state.lastEnsure,
    honesty: {
      allWorkersIndependentAgi: false,
      mutatorsGated: true,
      note: 'TEP inventories + ensures pool shims — does not force file mutators or invent revenue.',
    },
    timestamp: isoNow(),
  };
}

function mountRoutes(app) {
  if (!app || typeof app.get !== 'function') return { ok: false };
  if (app.__tepRoutesMounted) return { ok: true, already: true };
  app.get('/api/tep/status', (req, res) => res.json(getStatus()));
  app.get('/api/ecosystem/inventory', (req, res) => res.json(inventory()));
  app.post('/api/tep/ensure-pool', (req, res) => res.json(ensurePool()));
  app.__tepRoutesMounted = true;
  return { ok: true };
}

function registerWithMesh(mesh) {
  if (!mesh || typeof mesh.register !== 'function') return { ok: false };
  const registered = [];
  try {
    mesh.register('totalEcosystemPerfectionOs', module.exports, { statusFn: 'getStatus' });
    registered.push('totalEcosystemPerfectionOs');
  } catch (_) { /* ok */ }
  try {
    const pool = require('./adaptiveEnginePool');
    mesh.register('adaptiveEnginePool', pool, { statusFn: 'getStatus' });
    registered.push('adaptiveEnginePool');
  } catch (_) { /* ok */ }
  return { ok: true, registered };
}

module.exports = {
  PROTOCOL,
  NAME,
  start,
  getStatus,
  inventory,
  ensurePool,
  mountRoutes,
  registerWithMesh,
};
