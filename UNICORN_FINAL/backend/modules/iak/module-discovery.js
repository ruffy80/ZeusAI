// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * IAK Module Discovery — inventie ZeusAI
 *
 * Scans backend/modules for runtime-capable instances and classifies them
 * into tiers so the Integrated Autonomy Kernel can register, causal-start,
 * health-monitor, and heal every real module without breaking Boot Immortal
 * (stable/safe) or commerce honesty.
 */

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..');

/** Public shims / meta — never treat as domain modules */
const SKIP_FILES = new Set([
  'integrated-autonomy-kernel.js',
  'unicornMeshOrchestrator.js',
  'unicornOrchestrator.js',
  'central-orchestrator.js',
  'saas-orchestrator-v4.js',
  'meshOrchestrator.js',
  'recovery-orchestrator.js',
  'billion-scale-activation-orchestrator.js',
  'adaptiveEnginePool.js', // synthetic idle stubs
]);

/** Never auto-start (mutators / suicide paths) */
const MUTATOR_NAMES = new Set([
  'selfConstruction',
  'self-construction',
  'codeSanityEngine',
  'code-sanity-engine',
  'unicornAutonomousCore',
  'autoDeploy',
  'auto-deploy',
]);

/** Safe to start even under stable/safe (always-on autonomy spine) */
const STABLE_START_ALLOW = new Set([
  'boot-immortal-os',
  'bootImmortalOs',
  'never-down-kernel',
  'neverDownKernel',
  'never-down',
  'immortality-continuum-protocol',
  'immortalityContinuumProtocol',
  'totalAutonomyOs',
  'total-autonomy-os',
  'autonomy-action-continuum-os',
  'ops-watchdog',
  'opsWatchdog',
  'memoryPressureGuardian',
  'memory-pressure-guardian',
  'closed-loop-commerce-os',
  'module-reality-os',
  'forward-only-safety',
  'forwardOnlySafety',
  'platform-foundation',
  'platformFoundation',
  'world-standard-inventions',
  'worldStandardInventions',
  'dual-plane-autonomy-kernel',
  'dualPlaneAutonomyKernel',
  'external-immortality-quorum',
  'externalImmortalityQuorum',
  'armed-rails-continuum',
  'armedRailsContinuum',
  'mutation-boundary-enforcer',
  'mutationBoundaryEnforcer',
  'proof-of-outcome-protocol',
  'proofOfOutcomeProtocol',
  'agent-capability-exchange',
  'attention-revenue-continuum',
  'commerce-twin-portable',
  'delivery-passport-standard',
  'vertical-outcome-machines',
  'orchestrated-capability-continuum',
  'orchestratedCapabilityContinuum',
  'AGE',
  'agiSelfEvolution',
  'AGISelf-EvolutionEngine',
  'autonomousSpace',
  'AutonomousSpaceComputing',
  'digitalTwinNetwork',
  'DecentralizedDigitalTwinNetwork',
  'neuralInterfaceAPI',
  'NeuralInterfaceAPI',
  'quantumInternet',
  'QuantumInternetProtocol',
  'quantumML',
  'QuantumMachineLearningCore',
  'temporalDataLayer',
  'TemporalDataLayer',
  'essential-modules-continuum',
  'essentialModulesContinuum',
  'continuum-harmony-os',
  'continuumHarmonyOs',
  'total-ecosystem-perfection-os',
  'totalEcosystemPerfectionOs',
  'adaptiveEnginePool',
]);

/** Commerce / payment — monitor+register only unless configured */
const COMMERCE_NAMES = new Set([
  'paymentGateway',
  'payment-gateway',
  'paymentSystems',
  'payment-systems',
  'nowPayments',
  'now-payments',
  'stripe',
  'paypal',
  'billingEngine',
  'billing-engine',
  'tenantBilling',
  'tenant-billing',
  'closed-loop-commerce-os',
  'autonomousMoneyMachine',
  'money-machine',
]);

const STATUS_FNS = ['getStatus', 'getRevenueStatus', 'getViralStatus', 'getMetrics', 'getAllStatus', 'getStats', 'getHealthReport'];

function baseName(file) {
  return String(file || '').replace(/\.js$/i, '');
}

function camelFromKebab(name) {
  return String(name).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function classify(name) {
  const n = String(name || '');
  if (MUTATOR_NAMES.has(n) || /selfConstruction|self-construction|codeSanity|autoDeploy/i.test(n)) {
    return { tier: 'mutator', honestyClass: 'mutator', bootPriority: 900 };
  }
  // Infra allowlist wins over commerce heuristics (e.g. closed-loop-commerce-os)
  if (STABLE_START_ALLOW.has(n) || /never-down|boot-immortal|totalAutonomy|aacos|ops-watchdog|memory-pressure|forward-only|platform-foundation|module-reality/i.test(n)) {
    return { tier: 'infra', honestyClass: 'infra', bootPriority: 10 };
  }
  if (COMMERCE_NAMES.has(n) || /payment|billing|stripe|paypal|checkout|money-machine|commerce/i.test(n)) {
    return { tier: 'commerce', honestyClass: 'commerce', bootPriority: 40 };
  }
  if (/heal|guardian|resilience|failover|disaster|sentinel|watchdog/i.test(n)) {
    return { tier: 'resilience', honestyClass: 'autonomy', bootPriority: 30 };
  }
  if (/orchestrat|autonom|growth|innov|viral|revenue|marketing|deploy|evolve/i.test(n)) {
    return { tier: 'autonomy', honestyClass: 'autonomy', bootPriority: 50 };
  }
  return { tier: 'observe', honestyClass: 'observe', bootPriority: 100 };
}

function detectStatusFn(instance) {
  if (!instance || typeof instance !== 'object') return null;
  for (const fn of STATUS_FNS) {
    if (typeof instance[fn] === 'function') return fn;
  }
  return null;
}

function unwrapExport(mod) {
  if (!mod) return null;
  if (typeof mod === 'object' && (detectStatusFn(mod) || typeof mod.start === 'function' || typeof mod.init === 'function' || typeof mod.heal === 'function')) {
    return mod;
  }
  // Common patterns: { default }, { instance }, named singleton
  if (mod.default && typeof mod.default === 'object') return unwrapExport(mod.default);
  if (mod.instance && typeof mod.instance === 'object') return unwrapExport(mod.instance);
  return null;
}

function listTopLevelModuleFiles() {
  let files = [];
  try {
    files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith('.js') && !SKIP_FILES.has(f));
  } catch (_) {
    files = [];
  }
  return files;
}

/** Also discover OCC-managed capabilities under backend/generated/ */
function listGeneratedModuleFiles() {
  const genDir = path.join(MODULES_DIR, '..', 'generated');
  let files = [];
  try {
    files = fs.readdirSync(genDir).filter((f) => f.endsWith('.js'));
  } catch (_) {
    files = [];
  }
  return files.map((f) => ({ file: f, abs: path.join(genDir, f), name: baseName(f), sourceDir: 'generated' }));
}

function looksLikeModuleSource(filePath) {
  try {
    const head = fs.readFileSync(filePath, 'utf8').slice(0, 12000);
    if (/module\.exports\s*=\s*require\s*\(/.test(head) && head.length < 800) return false; // pure shim
    return /getStatus\s*\(|getMetrics\s*\(|getRevenueStatus\s*\(|\.start\s*=\s*function|start\s*\(\s*\)|heal\s*\(/.test(head);
  } catch (_) {
    return false;
  }
}

function isCommerceConfigured(instance) {
  try {
    if (typeof instance.isConfigured === 'function') return !!instance.isConfigured();
    if (typeof instance.getStatus === 'function') {
      const s = instance.getStatus();
      if (s && typeof s === 'object') {
        if (s.configured === false || s.ready === false) return false;
        if (s.configured === true || s.ready === true) return true;
        if (s.ok === false && (s.reason || s.error)) return false;
      }
    }
  } catch (_) { /* treat as not configured */ }
  return false;
}

/**
 * Build discovery manifest from require.cache + optional soft-require of gaps.
 * @param {object} [opts]
 * @param {boolean} [opts.softRequireMissing=true]
 * @param {number} [opts.maxSoftRequires=200]
 */
function scan(opts = {}) {
  const softRequireMissing = opts.softRequireMissing !== false;
  const maxSoftRequires = Number.isFinite(opts.maxSoftRequires) ? opts.maxSoftRequires : 200;
  const byName = new Map();

  // 1) Already-loaded modules in require.cache
  const cachePaths = Object.keys(require.cache || {});
  const modulesPrefix = MODULES_DIR + path.sep;
  for (const abs of cachePaths) {
    if (!abs.startsWith(modulesPrefix)) continue;
    const rel = abs.slice(modulesPrefix.length);
    if (rel.includes(`${path.sep}`)) continue; // only top-level for now
    if (!rel.endsWith('.js') || SKIP_FILES.has(rel)) continue;
    const name = baseName(rel);
    try {
      const mod = require.cache[abs] && require.cache[abs].exports;
      const instance = unwrapExport(mod);
      if (!instance) continue;
      const statusFn = detectStatusFn(instance);
      if (!statusFn && typeof instance.start !== 'function' && typeof instance.heal !== 'function') continue;
      const cls = classify(name);
      byName.set(name, {
        name,
        file: rel,
        instance,
        statusFn,
        hasStart: typeof instance.start === 'function',
        hasInit: typeof instance.init === 'function',
        hasHeal: typeof instance.heal === 'function',
        ...cls,
        source: 'require.cache',
      });
    } catch (_) { /* skip */ }
  }

  // 2) Soft-require gaps from disk (surgical — only files that look like modules)
  let softCount = 0;
  if (softRequireMissing) {
    for (const file of listTopLevelModuleFiles()) {
      const name = baseName(file);
      if (byName.has(name)) continue;
      const abs = path.join(MODULES_DIR, file);
      if (!looksLikeModuleSource(abs)) continue;
      if (softCount >= maxSoftRequires) break;
      try {
        softCount++;
        // Dynamic path from MODULES_DIR scan — intentional soft-require of gaps.
        const mod = require(abs); // eslint-disable-line global-require
        const instance = unwrapExport(mod);
        if (!instance) continue;
        const statusFn = detectStatusFn(instance);
        if (!statusFn && typeof instance.start !== 'function' && typeof instance.heal !== 'function') continue;
        const cls = classify(name);
        byName.set(name, {
          name,
          file,
          instance,
          statusFn,
          hasStart: typeof instance.start === 'function',
          hasInit: typeof instance.init === 'function',
          hasHeal: typeof instance.heal === 'function',
          ...cls,
          source: 'soft-require',
        });
      } catch (_) { /* optional module */ }
    }

    // 2b) OCC-managed capabilities in backend/generated/
    for (const entry of listGeneratedModuleFiles()) {
      if (byName.has(entry.name)) continue;
      if (softCount >= maxSoftRequires) break;
      try {
        // Generated shims are short re-exports — allow even if head looks like shim
        const head = fs.readFileSync(entry.abs, 'utf8').slice(0, 4000);
        const isOcc = /orchestrated-capability-continuum|createCapability|getStatus/.test(head);
        if (!isOcc && !looksLikeModuleSource(entry.abs)) continue;
        softCount++;
        const mod = require(entry.abs); // eslint-disable-line global-require
        const instance = unwrapExport(mod);
        if (!instance) continue;
        const statusFn = detectStatusFn(instance);
        if (!statusFn && typeof instance.start !== 'function' && typeof instance.heal !== 'function') continue;
        const cls = classify(entry.name);
        // Force infra tier for OCC continuum members so stable profile starts them
        const tier = (STABLE_START_ALLOW.has(entry.name) || /AGE|AGISelf|AutonomousSpace|DigitalTwin|NeuralInterface|QuantumInternet|QuantumMachine|TemporalData|orchestrated/i.test(entry.name))
          ? { tier: 'infra', honestyClass: 'infra', bootPriority: 15 }
          : cls;
        byName.set(entry.name, {
          name: entry.name,
          file: path.join('generated', entry.file),
          instance,
          statusFn,
          hasStart: typeof instance.start === 'function',
          hasInit: typeof instance.init === 'function',
          hasHeal: typeof instance.heal === 'function',
          ...tier,
          source: 'generated',
        });
      } catch (_) { /* optional */ }
    }
  }

  return {
    modulesDir: MODULES_DIR,
    count: byName.size,
    softRequires: softCount,
    modules: [...byName.values()],
  };
}

/**
 * Decide if IAK may call start()/init() for this module under current profile.
 */
function mayStart(entry, profileOpts = {}) {
  if (!entry) return { ok: false, reason: 'missing' };
  if (!entry.hasStart && !entry.hasInit) return { ok: false, reason: 'no_start' };

  const stable = !!profileOpts.stable;
  const selfMutationDisabled = String(process.env.DISABLE_SELF_MUTATION || '') === '1'
    || !!profileOpts.selfMutationDisabled;

  if (entry.tier === 'mutator' || MUTATOR_NAMES.has(entry.name)) {
    if (stable || selfMutationDisabled) return { ok: false, reason: 'mutator_blocked' };
    if (String(process.env.ENABLE_FILE_MUTATORS || '') !== '1') return { ok: false, reason: 'mutators_off' };
  }

  if (entry.honestyClass === 'commerce' || entry.tier === 'commerce') {
    if (!isCommerceConfigured(entry.instance)) {
      return { ok: false, reason: 'commerce_unconfigured' };
    }
  }

  if (stable) {
    if (STABLE_START_ALLOW.has(entry.name) || entry.tier === 'infra') {
      return { ok: true, reason: 'stable_allowlist' };
    }
    return { ok: false, reason: 'stable_idle' };
  }

  // growth/full — start autonomy + resilience + infra + configured commerce
  if (entry.tier === 'observe' && !entry.hasStart) return { ok: false, reason: 'observe_only' };
  return { ok: true, reason: 'profile_ok' };
}

function defaultDependsOn(name, tier) {
  // Lightweight causal hints — infra first, then resilience, then autonomy
  if (tier === 'infra') return [];
  if (tier === 'resilience') return [];
  if (tier === 'commerce') return [];
  if (tier === 'autonomy') return ['boot-immortal-os'].filter(() => false); // no hard fail if missing
  return [];
}

module.exports = {
  MODULES_DIR,
  SKIP_FILES,
  STABLE_START_ALLOW,
  MUTATOR_NAMES,
  COMMERCE_NAMES,
  scan,
  classify,
  detectStatusFn,
  unwrapExport,
  mayStart,
  isCommerceConfigured,
  defaultDependsOn,
  baseName,
  camelFromKebab,
  listTopLevelModuleFiles,
  listGeneratedModuleFiles,
};
