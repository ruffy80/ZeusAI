'use strict';

// ===========================================================================
// Boot Immortal OS — inventie ZeusAI
//
// Problema: sub UNICORN_RUNTIME_PROFILE=stable, require()-time auto-starters
// (unicornOrchestrator → UEE eternal cycle, code-sanity execSync, QIS pm2 jlist)
// blocheaza event-loop-ul → /api/health timeout → healers/PM2 restart → loop.
//
// Contract:
//   * isStableProfile() — single source of truth for "business loops off"
//   * assertStableIdle() — used by heavy engines before starting timers
//   * Never throws into money path
// ===========================================================================

function runtimeProfile() {
  return String(
    process.env.UNICORN_RUNTIME_PROFILE
      || (process.env.NODE_ENV === 'production' ? 'stable' : 'full')
  ).toLowerCase();
}

function isStableProfile() {
  const p = runtimeProfile();
  return p === 'stable' || p === 'safe';
}

function isGrowthProfile() {
  const p = runtimeProfile();
  return p === 'growth' || p === 'full';
}

/**
 * Heavy autonomous loops must call this before scheduling work.
 * Returns { ok:true } under growth/full, or { ok:false, reason } under stable/safe.
 */
function assertStableIdle(engineName) {
  if (!isStableProfile()) return { ok: true, profile: runtimeProfile() };
  return {
    ok: false,
    profile: runtimeProfile(),
    reason: 'stable_idle',
    engine: String(engineName || 'unknown'),
    note: 'Autonomous background loops are paused under stable/safe. Set UNICORN_RUNTIME_PROFILE=growth to arm.',
  };
}

function getStatus() {
  return {
    ok: true,
    invention: 'boot-immortal-os',
    module: 'boot-immortal-os',
    profile: runtimeProfile(),
    stable: isStableProfile(),
    growth: isGrowthProfile(),
    selfMutationDisabled: String(process.env.DISABLE_SELF_MUTATION || '') === '1',
    liveSyncDefaultOff: true,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runtimeProfile,
  isStableProfile,
  isGrowthProfile,
  assertStableIdle,
  getStatus,
};
