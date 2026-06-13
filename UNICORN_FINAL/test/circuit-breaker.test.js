'use strict';
/**
 * circuit-breaker.test.js — Unit tests for backend/modules/circuit-breaker.js
 *
 * Covers: InnovationCircuitBreaker state transitions (CLOSED → OPEN → HALF_OPEN),
 * isOpen(), recordSuccess(), recordFailure(), getStatus(), history management,
 * and configurable thresholds.
 */

const assert = require('assert');

const { InnovationCircuitBreaker } = require('../backend/modules/circuit-breaker');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── Initial state ───────────────────────────────────────────────────────────
console.log('Circuit Breaker — Initial state');

check('starts in CLOSED state', () => {
  const cb = new InnovationCircuitBreaker();
  assert.strictEqual(cb.state, 'CLOSED');
  assert.strictEqual(cb.consecutiveFailures, 0);
  assert.strictEqual(cb.isOpen(), false);
});

check('default threshold is 3', () => {
  const cb = new InnovationCircuitBreaker();
  assert.strictEqual(cb.failureThreshold, 3);
});

check('accepts custom options', () => {
  const cb = new InnovationCircuitBreaker({ failureThreshold: 5, pauseDurationMs: 30000 });
  assert.strictEqual(cb.failureThreshold, 5);
  assert.strictEqual(cb.pauseDurationMs, 30000);
});

// ── recordSuccess ───────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — recordSuccess');

check('resets consecutive failures on success', () => {
  const cb = new InnovationCircuitBreaker();
  cb.consecutiveFailures = 2;
  cb.recordSuccess({ experiment: 'test' });
  assert.strictEqual(cb.consecutiveFailures, 0);
  assert.strictEqual(cb.state, 'CLOSED');
});

check('transitions from HALF_OPEN to CLOSED on success', () => {
  const cb = new InnovationCircuitBreaker();
  cb.state = 'HALF_OPEN';
  cb.recordSuccess();
  assert.strictEqual(cb.state, 'CLOSED');
});

check('adds SUCCESS entry to history', () => {
  const cb = new InnovationCircuitBreaker();
  cb.recordSuccess({ id: 'exp1' });
  assert.strictEqual(cb.history.length, 1);
  assert.strictEqual(cb.history[0].outcome, 'SUCCESS');
  assert.ok(cb.history[0].ts > 0);
});

// ── recordFailure ───────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — recordFailure');

check('increments consecutive failures', () => {
  const cb = new InnovationCircuitBreaker();
  cb.recordFailure();
  assert.strictEqual(cb.consecutiveFailures, 1);
  cb.recordFailure();
  assert.strictEqual(cb.consecutiveFailures, 2);
});

check('opens after threshold consecutive failures', () => {
  const cb = new InnovationCircuitBreaker({ failureThreshold: 3 });
  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.state, 'CLOSED');
  cb.recordFailure();
  assert.strictEqual(cb.state, 'OPEN');
  assert.ok(cb.openedAt > 0);
});

check('failure in HALF_OPEN reopens the breaker', () => {
  const cb = new InnovationCircuitBreaker({ pauseDurationMs: 100 });
  cb.state = 'HALF_OPEN';
  cb.recordFailure();
  assert.strictEqual(cb.state, 'OPEN');
  assert.ok(cb.openedAt > 0);
});

check('adds FAILURE entry with consecutiveCount', () => {
  const cb = new InnovationCircuitBreaker();
  cb.recordFailure({ loss: 50 });
  assert.strictEqual(cb.history[0].outcome, 'FAILURE');
  assert.strictEqual(cb.history[0].consecutiveCount, 1);
});

// ── isOpen ──────────────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — isOpen');

check('returns false when CLOSED', () => {
  const cb = new InnovationCircuitBreaker();
  assert.strictEqual(cb.isOpen(), false);
});

check('returns true when OPEN and pause not expired', () => {
  const cb = new InnovationCircuitBreaker({ pauseDurationMs: 60000 });
  cb.state = 'OPEN';
  cb.openedAt = Date.now();
  assert.strictEqual(cb.isOpen(), true);
});

check('transitions to HALF_OPEN when pause expires', () => {
  const cb = new InnovationCircuitBreaker({ pauseDurationMs: 100 });
  cb.state = 'OPEN';
  cb.openedAt = Date.now() - 200; // expired
  assert.strictEqual(cb.isOpen(), false);
  assert.strictEqual(cb.state, 'HALF_OPEN');
});

// ── getStatus ───────────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — getStatus');

check('returns expected status shape', () => {
  const cb = new InnovationCircuitBreaker();
  const status = cb.getStatus();
  assert.strictEqual(status.state, 'CLOSED');
  assert.strictEqual(status.consecutiveFailures, 0);
  assert.strictEqual(status.failureThreshold, 3);
  assert.strictEqual(status.pauseRemainingMs, 0);
  assert.strictEqual(status.pauseRemainingMin, 0);
  assert.strictEqual(status.openedAt, null);
  assert.ok(Array.isArray(status.recentHistory));
});

check('shows pause remaining when OPEN', () => {
  const cb = new InnovationCircuitBreaker({ pauseDurationMs: 60000 });
  cb.state = 'OPEN';
  cb.openedAt = Date.now();
  const status = cb.getStatus();
  assert.ok(status.pauseRemainingMs > 0);
  assert.ok(status.pauseRemainingMin > 0);
});

// ── History management ──────────────────────────────────────────────────────
console.log('\nCircuit Breaker — History management');

check('history is capped at 100 entries', () => {
  const cb = new InnovationCircuitBreaker({ failureThreshold: 999 });
  for (let i = 0; i < 110; i++) {
    cb.recordFailure({ i });
  }
  assert.strictEqual(cb.history.length, 100);
});

check('getStatus shows last 10 in recentHistory', () => {
  const cb = new InnovationCircuitBreaker({ failureThreshold: 999 });
  for (let i = 0; i < 20; i++) cb.recordFailure({ i });
  const status = cb.getStatus();
  assert.strictEqual(status.recentHistory.length, 10);
});

// ── Full lifecycle ──────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — Full lifecycle');

check('CLOSED → OPEN → HALF_OPEN → CLOSED', () => {
  const cb = new InnovationCircuitBreaker({ failureThreshold: 2, pauseDurationMs: 50 });

  // CLOSED → OPEN (2 failures)
  cb.recordFailure();
  cb.recordFailure();
  assert.strictEqual(cb.state, 'OPEN');

  // Simulate pause expiry
  cb.openedAt = Date.now() - 100;
  assert.strictEqual(cb.isOpen(), false);
  assert.strictEqual(cb.state, 'HALF_OPEN');

  // Probe succeeds → CLOSED
  cb.recordSuccess();
  assert.strictEqual(cb.state, 'CLOSED');
  assert.strictEqual(cb.consecutiveFailures, 0);
});

// ── Singleton export ────────────────────────────────────────────────────────
console.log('\nCircuit Breaker — Singleton');

check('module exports a singleton breaker instance', () => {
  const breaker = require('../backend/modules/circuit-breaker');
  assert.strictEqual(typeof breaker.isOpen, 'function');
  assert.strictEqual(typeof breaker.recordSuccess, 'function');
  assert.strictEqual(typeof breaker.recordFailure, 'function');
  assert.strictEqual(typeof breaker.getStatus, 'function');
});

console.log(`\n✅ circuit-breaker: ${passed} tests passed\n`);
