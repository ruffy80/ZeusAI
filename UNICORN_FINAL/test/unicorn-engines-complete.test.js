'use strict';
/**
 * unicorn-engines-complete.test.js — Regression tests for the supreme-engine
 * status paths that were hanging or falsely reporting critical.
 *
 * Covers:
 *   1. unicornBrain.getStatus() is JSON-serializable and its embedded
 *      `lastStatus` is a slim, non-recursive snapshot (depth < 5) — guards
 *      against the self-nesting hang on /api/brain/status & /api/supreme/status.
 *   2. autonomous-intelligence-core.getStatus().health is 'idle'/'good' when
 *      cold (no tracked agents) — never 'critical'.
 */

const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const brain = require('../backend/modules/unicornBrain');
const aic = require('../backend/modules/autonomous-intelligence-core');
const moduleIdentity = require('../backend/modules/moduleIdentity');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// Object depth measurement with cycle detection. Returns Infinity if a cycle
// is encountered (which is exactly the failure mode we are guarding against).
function depth(obj, seen = new Set()) {
  if (obj === null || typeof obj !== 'object') return 0;
  if (seen.has(obj)) return Infinity;
  seen.add(obj);
  let max = 0;
  for (const v of Object.values(obj)) {
    const d = depth(v, seen);
    if (d > max) max = d;
  }
  seen.delete(obj);
  return max + 1;
}

// ── unicornBrain — status is serializable & non-recursive ────────────────────
console.log('Unicorn Engines Complete — unicornBrain.getStatus');

check('getStatus() is JSON-serializable (no self-nesting hang)', () => {
  const a = brain.getStatus();
  assert.doesNotThrow(() => JSON.stringify(a));
  const b = brain.getStatus();
  assert.doesNotThrow(() => JSON.stringify(b));
});

check('getStatus() has bounded, finite depth', () => {
  const d = depth(brain.getStatus());
  assert.ok(Number.isFinite(d), `expected finite depth, got ${d}`);
  assert.ok(d < 10, `expected shallow status object, got depth ${d}`);
});

check('lastStatus is a slim snapshot (depth < 5) when null before first tick', () => {
  const status = brain.getStatus();
  // Before the first tick lastStatus is null; either way it must not be a deep
  // recursive object.
  const d = depth(status.lastStatus);
  assert.ok(d < 5, `expected lastStatus depth < 5, got ${d}`);
});

// ── autonomous-intelligence-core — cold health ───────────────────────────────
console.log('\nUnicorn Engines Complete — autonomous-intelligence-core.getStatus');

check('health is idle/good (never critical) when cold', () => {
  const status = aic.getStatus();
  assert.ok(
    status.health === 'idle' || status.health === 'good',
    `expected idle/good when cold, got '${status.health}'`
  );
  assert.strictEqual(status.trackedAgents, 0);
});

// ── moduleIdentity — real HMAC attestation + mesh seeding ────────────────────
console.log('\nUnicorn Engines Complete — moduleIdentity');

check('ensureMany seeds DIDs for mesh-like engine names', () => {
  const r = moduleIdentity.ensureMany(['unicornBrain', 'profitAutopilot', 'zacc']);
  assert.equal(r.ok, true);
  assert.ok(r.count >= 3);
  const list = moduleIdentity.list();
  assert.ok(list.count >= 3);
  assert.ok(list.modules.unicornBrain);
});

check('attest + verify round-trip with hmac-sha256', () => {
  const payload = { ping: true, ts: 1 };
  const att = moduleIdentity.attest('unicornBrain', payload);
  assert.equal(att.ok, true);
  assert.equal(att.algorithm, 'hmac-sha256');
  const v = moduleIdentity.verify(att.did, payload, att.signature);
  assert.equal(v.valid, true);
  const bad = moduleIdentity.verify(att.did, payload, '0'.repeat(64));
  assert.equal(bad.valid, false);
});

// ── tick-dependent: lastStatus stays slim after a real brain tick ────────────
// Under NODE_ENV=test the brain keeps a 1s main cycle (even when the suite
// forces UNICORN_RUNTIME_PROFILE=stable). Wait for at least one tick and
// re-verify the snapshot is still slim (guards the recursion hang).
setTimeout(() => {
  check('after a tick, lastStatus is populated and remains slim (depth < 5)', () => {
    const status = brain.getStatus();
    assert.ok(status.lastStatus, 'expected lastStatus to be populated after a tick');
    assert.strictEqual(typeof status.lastStatus.mainCycleCount, 'number');
    assert.strictEqual(typeof status.lastStatus.activeLayers, 'number');
    const d = depth(status.lastStatus);
    assert.ok(d < 5, `expected lastStatus depth < 5 after tick, got ${d}`);
    assert.doesNotThrow(() => JSON.stringify(brain.getStatus()));
  });

  console.log(`\n✅ unicorn-engines-complete: ${passed} tests passed\n`);
  // Brain timer is .unref()'d; exit explicitly for the same pattern as
  // dynamic-pricing.test.js (and in case other modules hold the loop open).
  process.exit(0);
}, 1300);
