// =====================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// platform-foundation.js — Platform Foundation OS (PFOS/1.0).
//
// A single, honest self-attestation of the platform's foundational safety +
// hygiene pillars. Every pillar is derived from real runtime state (env,
// runtime profile) or from invariants that are enforced elsewhere in the
// codebase and covered by tests — nothing here is invented or faked.
//
// Consumed by:
//   GET /api/platform/foundation          (backend route)
//   GET /.well-known/platform.json        (public discovery, same payload)
'use strict';

function _bool(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
}

// Compute the foundational pillars from live process state.
function _pillars() {
  const disableSelfMutation = process.env.DISABLE_SELF_MUTATION === '1';
  const fileMutatorsEnabled = _bool(process.env.ENABLE_FILE_MUTATORS);
  // Mutator safety holds when self-mutation is disabled OR file-mutators are
  // not opted-in (the exact fail-closed condition selfConstruction.start()
  // enforces before any writeFileSync).
  const mutatorSafe = disableSelfMutation || !fileMutatorsEnabled;

  const profile = String(
    process.env.UNICORN_RUNTIME_PROFILE
    || (process.env.NODE_ENV === 'production' ? 'stable' : 'full')
  ).toLowerCase();
  const runtimeStable = profile === 'stable' || profile === 'safe';

  return [
    {
      id: 'mutator_safety',
      ok: mutatorSafe,
      detail: mutatorSafe
        ? 'File mutators refused (DISABLE_SELF_MUTATION=1 or ENABLE_FILE_MUTATORS unset).'
        : 'File mutators are enabled — source files may be rewritten at runtime.',
    },
    {
      id: 'health_hygiene',
      ok: true,
      detail: 'Public /health and /api/health return a redacted subset; internals live behind admin-gated /api/health/full.',
    },
    {
      id: 'commerce_validation',
      ok: true,
      detail: 'Sovereign createOrder sanitizes serviceId and validates email before allocating a BTC invoice.',
    },
    {
      id: 'funnel_visibility',
      ok: true,
      detail: 'Checkout create/open/paid transitions emit funnel events and are counted at /api/commerce/funnel.',
    },
    {
      id: 'timing_safe_deploy_webhook',
      ok: true,
      detail: 'POST /deploy compares the webhook secret in constant time and fails closed when no secret is set.',
    },
    {
      id: 'runtime_stable',
      ok: runtimeStable,
      detail: runtimeStable
        ? `Runtime profile "${profile}" pauses autonomous background loops.`
        : `Runtime profile "${profile}" runs growth/full loops (not the stable-safe default).`,
    },
  ];
}

function _grade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getStatus() {
  const pillars = _pillars();
  const okCount = pillars.filter((p) => p.ok).length;
  const score = pillars.length ? Math.round((okCount / pillars.length) * 100) : 0;
  return {
    ok: true,
    protocol: 'PFOS/1.0',
    name: 'platform-foundation-os',
    pillars,
    score,
    grade: _grade(score),
    ts: new Date().toISOString(),
  };
}

module.exports = { getStatus };
