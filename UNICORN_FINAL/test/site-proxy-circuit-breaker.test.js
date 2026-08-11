'use strict';

// Unit tests for the site → backend proxy circuit breaker, focused on the
// HALF_OPEN single-flight probe behaviour.

const assert = require('assert');
const { createSiteProxyCircuitBreaker } = require('../src/site-proxy-circuit-breaker');

function run() {
  // 1) Three failures trip the breaker OPEN.
  {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 50 });
    assert.equal(cb.shouldAllow(), true, 'closed breaker admits traffic');
    cb.recordFailure();
    cb.recordFailure();
    assert.equal(cb.snapshot().state, 'CLOSED', 'still closed under threshold');
    cb.recordFailure();
    assert.equal(cb.snapshot().state, 'OPEN', 'threshold failures open the breaker');
    assert.equal(cb.shouldAllow(), false, 'open breaker denies traffic during cooldown');
  }

  // 2) After cooldown, exactly one probe is admitted (HALF_OPEN single-flight);
  //    a second concurrent request is denied until the probe settles.
  {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 50 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    assert.equal(cb.snapshot().state, 'OPEN');

    const openTs = cb.snapshot().lastFailTs;
    const afterCooldown = openTs + 60;

    // First admission after cooldown flips OPEN → HALF_OPEN and marks in-flight.
    assert.equal(cb.shouldAllow(afterCooldown), true, 'cooldown admits one probe');
    assert.equal(cb.snapshot().state, 'HALF_OPEN');
    assert.equal(cb.snapshot().halfOpenInFlight, true, 'probe marked in-flight');

    // Second concurrent request while the probe is in flight is denied.
    assert.equal(cb.shouldAllow(afterCooldown), false, 'concurrent half-open probe denied');
    assert.equal(cb.shouldAllow(afterCooldown + 5), false, 'still denied until probe settles');
  }

  // 3) Success on the half-open probe closes the breaker and clears in-flight.
  {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 50 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    const afterCooldown = cb.snapshot().lastFailTs + 60;
    assert.equal(cb.shouldAllow(afterCooldown), true);
    assert.equal(cb.snapshot().state, 'HALF_OPEN');

    cb.recordSuccess();
    assert.equal(cb.snapshot().state, 'CLOSED', 'successful probe closes breaker');
    assert.equal(cb.snapshot().halfOpenInFlight, false, 'in-flight cleared on success');
    assert.equal(cb.snapshot().failures, 0, 'failures reset on success');
    assert.equal(cb.shouldAllow(), true, 'closed breaker admits traffic again');
  }

  // 4) Failure on the half-open probe reopens the breaker and clears in-flight.
  {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 50 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    const afterCooldown = cb.snapshot().lastFailTs + 60;
    assert.equal(cb.shouldAllow(afterCooldown), true);
    assert.equal(cb.snapshot().state, 'HALF_OPEN');

    cb.recordFailure();
    assert.equal(cb.snapshot().state, 'OPEN', 'failed probe reopens breaker');
    assert.equal(cb.snapshot().halfOpenInFlight, false, 'in-flight cleared on failure');
    // Immediately after reopening, traffic is denied until the next cooldown.
    assert.equal(cb.shouldAllow(cb.snapshot().lastFailTs + 1), false, 'reopened breaker denies traffic');

    // After another cooldown a fresh single probe is admitted.
    const afterCooldown2 = cb.snapshot().lastFailTs + 60;
    assert.equal(cb.shouldAllow(afterCooldown2), true, 'new cooldown admits a fresh probe');
    assert.equal(cb.snapshot().halfOpenInFlight, true);
  }

  // 5) reset() returns the breaker to a clean CLOSED state.
  {
    const cb = createSiteProxyCircuitBreaker({ threshold: 3, cooldownMs: 50 });
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    cb.reset();
    const s = cb.snapshot();
    assert.equal(s.state, 'CLOSED');
    assert.equal(s.failures, 0);
    assert.equal(s.halfOpenInFlight, false);
  }

  console.log('site-proxy-circuit-breaker test passed');
}

run();
