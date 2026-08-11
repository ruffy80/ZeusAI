'use strict';

/**
 * site-proxy-circuit-breaker.js
 * Extracted helper so the site's backend-proxy CB is unit-testable and
 * tunable without booting the full SSR server.
 *
 * States: CLOSED → OPEN → HALF_OPEN.
 * HALF_OPEN admits exactly ONE probe at a time (single-flight): the first
 * request that flips OPEN→HALF_OPEN is admitted and marked in-flight; any
 * concurrent request is denied until that probe settles (success → CLOSED,
 * failure → OPEN). This prevents a thundering herd from hammering a still-
 * recovering backend the instant the cooldown elapses.
 */

function createSiteProxyCircuitBreaker(opts = {}) {
  const state = {
    state: 'CLOSED',
    failures: 0,
    lastFailTs: 0,
    lastSuccessTs: Date.now(),
    threshold: Number(opts.threshold || process.env.SITE_PROXY_CB_THRESHOLD || 3),
    cooldownMs: Number(opts.cooldownMs || process.env.SITE_PROXY_CB_COOLDOWN_MS || 10000),
    tripped: 0,
    halfOpenInFlight: false,
  };

  function recordSuccess() {
    state.failures = 0;
    state.lastSuccessTs = Date.now();
    state.halfOpenInFlight = false;
    if (state.state !== 'CLOSED') state.state = 'CLOSED';
  }

  function recordFailure() {
    state.failures += 1;
    state.lastFailTs = Date.now();
    if (state.state === 'HALF_OPEN') {
      state.state = 'OPEN';
      state.halfOpenInFlight = false;
      state.tripped += 1;
    } else if (state.state === 'CLOSED' && state.failures >= state.threshold) {
      state.state = 'OPEN';
      state.tripped += 1;
    }
  }

  function shouldAllow(now = Date.now()) {
    if (state.state === 'CLOSED') return true;
    if (state.state === 'OPEN') {
      if ((now - state.lastFailTs) >= state.cooldownMs) {
        state.state = 'HALF_OPEN';
        state.halfOpenInFlight = true; // admit exactly this one probe
        return true;
      }
      return false;
    }
    // HALF_OPEN — only a single probe is allowed until it settles.
    if (state.halfOpenInFlight) return false;
    state.halfOpenInFlight = true;
    return true;
  }

  function snapshot() {
    return {
      state: state.state,
      failures: state.failures,
      tripped: state.tripped,
      threshold: state.threshold,
      cooldownMs: state.cooldownMs,
      lastFailTs: state.lastFailTs,
      lastSuccessTs: state.lastSuccessTs,
      halfOpenInFlight: state.halfOpenInFlight,
      open: state.state === 'OPEN',
    };
  }

  function reset() {
    state.state = 'CLOSED';
    state.failures = 0;
    state.lastFailTs = 0;
    state.lastSuccessTs = Date.now();
    state.halfOpenInFlight = false;
  }

  return { recordSuccess, recordFailure, shouldAllow, snapshot, reset, _state: state };
}

module.exports = { createSiteProxyCircuitBreaker };
