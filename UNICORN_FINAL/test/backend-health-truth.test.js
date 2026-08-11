'use strict';

// Unit-tests the pure health derivation used by buildHealthResponse() /
// buildPublicHealthResponse() in backend/index.js. Kept standalone (no backend
// boot) so it runs in milliseconds and stays deterministic.

const assert = require('assert');
const { deriveHealthStatus } = require('../backend/health-status');

function run() {
  // Normal production: durable sqlite-file, not draining → ok + dbConnected.
  {
    const r = deriveHealthStatus({ durable: true, drainMode: false });
    assert.equal(r.status, 'ok', 'durable + not draining should be ok');
    assert.equal(r.dbConnected, true, 'durable should report dbConnected true');
  }

  // Draining (SIGTERM) even with durable db → degraded.
  {
    const r = deriveHealthStatus({ durable: true, drainMode: true });
    assert.equal(r.status, 'degraded', 'draining should be degraded');
    assert.equal(r.dbConnected, true, 'durable still true while draining');
  }

  // Non-durable persistence (in-memory fallback) → degraded + dbConnected false.
  {
    const r = deriveHealthStatus({ durable: false, drainMode: false });
    assert.equal(r.status, 'degraded', 'non-durable should be degraded');
    assert.equal(r.dbConnected, false, 'non-durable should report dbConnected false');
  }

  // Non-durable AND draining → degraded + false.
  {
    const r = deriveHealthStatus({ durable: false, drainMode: true });
    assert.equal(r.status, 'degraded');
    assert.equal(r.dbConnected, false);
  }

  // Defensive: missing/undefined durable is treated as not connected.
  {
    const r = deriveHealthStatus({});
    assert.equal(r.status, 'degraded');
    assert.equal(r.dbConnected, false);
  }

  // Public contract mirror: ok === (status === 'ok').
  {
    const durable = deriveHealthStatus({ durable: true, drainMode: false });
    assert.equal(durable.status === 'ok', true);
    const degraded = deriveHealthStatus({ durable: false, drainMode: false });
    assert.equal(degraded.status === 'ok', false);
  }

  console.log('backend-health-truth test passed');
}

run();
