'use strict';

/**
 * Dual-Plane Autonomy Kernel — DPAK/1.0
 * Safe plane always-on under stable; growth plane opt-in for mutative autonomy.
 * Unifies Boot Immortal doctrine with IAK continuum.
 */

const { isoNow } = require('./_util');

const PROTOCOL = 'DPAK/1.0';
const NAME = 'dual-plane-autonomy-kernel';

const SAFE_ORGANS = Object.freeze([
  'iak-monitor',
  'never-down-kernel',
  'boot-immortal-os',
  'armed-rails-continuum',
  'external-immortality-quorum',
  'autonomy-action-continuum-os',
  'ops-watchdog',
  'module-reality-os',
  'forward-only-safety',
  'mutation-boundary-enforcer',
]);

const GROWTH_ORGANS = Object.freeze([
  'iak-heal',
  'guardian-engines',
  'uee-cycles',
  'self-construction',
  'auto-deploy',
  'auto-innovation',
  'code-sanity',
]);

const state = {
  startedAt: null,
  running: false,
  safeTicks: 0,
  growthDenied: 0,
  growthAllowed: 0,
};

function _boot() {
  try { return require('../boot-immortal-os'); } catch (_) { return null; }
}

function currentPlanes() {
  const boot = _boot();
  const profile = boot && boot.runtimeProfile ? boot.runtimeProfile() : String(process.env.UNICORN_RUNTIME_PROFILE || 'stable').toLowerCase();
  const stable = boot && boot.isStableProfile ? boot.isStableProfile() : (profile === 'stable' || profile === 'safe');
  const selfMutationDisabled = String(process.env.DISABLE_SELF_MUTATION || '') === '1';
  return {
    profile,
    safe: {
      armed: true,
      organs: SAFE_ORGANS.slice(),
      mode: 'monitor_attest_discover',
    },
    growth: {
      armed: !stable && !selfMutationDisabled,
      organs: GROWTH_ORGANS.slice(),
      mode: stable ? 'idle' : 'active',
      blockers: [
        ...(stable ? ['stable_profile'] : []),
        ...(selfMutationDisabled ? ['DISABLE_SELF_MUTATION'] : []),
      ],
    },
  };
}

function start() {
  if (state.running) return getStatus();
  state.running = true;
  state.startedAt = state.startedAt || isoNow();
  return getStatus();
}

/**
 * IAK / guardian should ask before running growth work.
 */
function assertGrowthPlane(engineName) {
  const planes = currentPlanes();
  if (planes.growth.armed) {
    state.growthAllowed += 1;
    return { ok: true, plane: 'growth', profile: planes.profile, engine: engineName || null };
  }
  state.growthDenied += 1;
  return {
    ok: false,
    plane: 'safe',
    profile: planes.profile,
    reason: 'growth_plane_idle',
    blockers: planes.growth.blockers,
    engine: engineName || null,
    note: 'Safe plane remains armed. Set UNICORN_RUNTIME_PROFILE=growth and DISABLE_SELF_MUTATION=0 to arm growth.',
  };
}

function assertSafePlane(organName) {
  return {
    ok: true,
    plane: 'safe',
    organ: organName || null,
    armed: true,
  };
}

/**
 * Recommend IAK start mode for current profile.
 * Stable/safe → 'safe-autonomy' (not bare 'monitor'); growth → 'full'.
 */
function recommendIakMode() {
  const planes = currentPlanes();
  // Under stable/safe: safe-autonomy (IAK owns TAAC arming + non-mutator heal).
  // Growth plane armed → full (facets + guardian).
  if (planes.growth.armed) {
    return {
      mode: 'full',
      ensureFacets: true,
      guardianMode: 'full',
      planes,
    };
  }
  return {
    mode: 'safe-autonomy',
    ensureFacets: false,
    guardianMode: 'idle',
    planes,
  };
}

function tickSafe() {
  start();
  state.safeTicks += 1;
  return { ok: true, safeTicks: state.safeTicks, at: isoNow() };
}

function getStatus() {
  const planes = currentPlanes();
  return {
    ok: true,
    protocol: PROTOCOL,
    module: NAME,
    invention: 'Dual-Plane Autonomy Kernel',
    running: !!state.running,
    startedAt: state.startedAt,
    planes,
    counters: {
      safeTicks: state.safeTicks,
      growthAllowed: state.growthAllowed,
      growthDenied: state.growthDenied,
    },
    iakRecommendation: recommendIakMode(),
    timestamp: isoNow(),
  };
}

function discovery() {
  return {
    ...getStatus(),
    endpoints: [
      'GET /api/dpak/status',
      'GET /api/dpak/planes',
      'POST /api/dpak/assert-growth',
      'POST /api/dpak/tick-safe',
    ],
  };
}

module.exports = {
  PROTOCOL,
  NAME,
  SAFE_ORGANS,
  GROWTH_ORGANS,
  start,
  getStatus,
  discovery,
  currentPlanes,
  assertGrowthPlane,
  assertSafePlane,
  recommendIakMode,
  tickSafe,
};
