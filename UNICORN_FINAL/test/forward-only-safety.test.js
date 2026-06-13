'use strict';
/**
 * forward-only-safety.test.js — Unit tests for backend/modules/forward-only-safety.js
 *
 * Covers: classifyMutation, checkMutation, registerEngine, getHarmonySnapshot,
 * listApprovedMutations, listForbiddenMutations, listProtectedZones,
 * listViolations, clearViolations, setEnforcement, getStatus.
 */

const assert = require('assert');

process.env.NODE_ENV = 'test';

const safety = require('../backend/modules/forward-only-safety');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── classifyMutation ────────────────────────────────────────────────────────
console.log('Forward-Only Safety — classifyMutation');

check('classifies approved mutations correctly', () => {
  const result = safety.classifyMutation({ type: 'feature.add' });
  assert.strictEqual(result.classification, 'approved');
  assert.strictEqual(result.allowed, true);
});

check('classifies forbidden mutations correctly', () => {
  const result = safety.classifyMutation({ type: 'schema.delete' });
  assert.strictEqual(result.classification, 'forbidden');
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'explicitly_forbidden_mutation_type');
});

check('classifies unknown mutation types as denied', () => {
  const result = safety.classifyMutation({ type: 'some.random.action' });
  assert.strictEqual(result.classification, 'unknown_approved');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.suggestion);
});

check('handles invalid operation input', () => {
  const r1 = safety.classifyMutation(null);
  assert.strictEqual(r1.allowed, false);
  assert.strictEqual(r1.reason, 'invalid_operation');

  const r2 = safety.classifyMutation({});
  assert.strictEqual(r2.allowed, false);
  assert.strictEqual(r2.reason, 'missing_type');
});

check('protected zone: denies write, allows readonly', () => {
  const writeOp = { type: 'custom.write', affectsState: 'PAYMENT_LEDGER' };
  const r1 = safety.classifyMutation(writeOp);
  assert.strictEqual(r1.classification, 'protected_zone');
  assert.strictEqual(r1.allowed, false);

  const readOp = { type: 'custom.read', affectsState: 'PAYMENT_LEDGER', readonly: true };
  const r2 = safety.classifyMutation(readOp);
  assert.strictEqual(r2.classification, 'protected_zone');
  assert.strictEqual(r2.allowed, true);
});

check('type matching is case-insensitive and trimmed', () => {
  const result = safety.classifyMutation({ type: '  Feature.Add  ' });
  assert.strictEqual(result.classification, 'approved');
  assert.strictEqual(result.allowed, true);
});

// ── checkMutation ───────────────────────────────────────────────────────────
console.log('\nForward-Only Safety — checkMutation');

check('returns ok:true for approved mutations', () => {
  const result = safety.checkMutation({ type: 'module.load', id: 'op-1' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.allowed, true);
});

check('returns ok:false for forbidden mutations', () => {
  const result = safety.checkMutation({ type: 'database.reset', id: 'op-2' });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.violates, true);
});

check('records violations', () => {
  safety.clearViolations();
  safety.checkMutation({ type: 'data.delete', id: 'op-del-1' });
  safety.checkMutation({ type: 'rollback.execute', id: 'op-roll-1' });
  const violations = safety.listViolations();
  assert.strictEqual(violations.length, 2);
  assert.strictEqual(violations[0].type, 'data.delete');
  assert.strictEqual(violations[1].type, 'rollback.execute');
});

check('skips enforcement when disabled', () => {
  safety.setEnforcement(false);
  const result = safety.checkMutation({ type: 'database.reset', id: 'op-nocheck' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.enforcement, 'disabled');
  safety.setEnforcement(true); // restore
});

// ── setEnforcement ──────────────────────────────────────────────────────────
console.log('\nForward-Only Safety — setEnforcement');

check('toggles enforcement and returns status', () => {
  const r1 = safety.setEnforcement(false);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.enforcement, false);

  const r2 = safety.setEnforcement(true);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.enforcement, true);
  assert.strictEqual(r2.changed, true);
});

// ── clearViolations ─────────────────────────────────────────────────────────
console.log('\nForward-Only Safety — clearViolations');

check('clears all violations', () => {
  safety.checkMutation({ type: 'schema.drop' });
  assert.ok(safety.listViolations().length > 0);
  const result = safety.clearViolations();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(safety.listViolations().length, 0);
});

// ── listApprovedMutations / listForbiddenMutations / listProtectedZones ────
console.log('\nForward-Only Safety — Lists');

check('listApprovedMutations returns sorted array', () => {
  const list = safety.listApprovedMutations();
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 10);
  assert.ok(list.includes('feature.add'));
  assert.ok(list.includes('module.load'));
  // Verify sorted
  const sorted = [...list].sort();
  assert.deepStrictEqual(list, sorted);
});

check('listForbiddenMutations returns sorted array', () => {
  const list = safety.listForbiddenMutations();
  assert.ok(Array.isArray(list));
  assert.ok(list.includes('schema.delete'));
  assert.ok(list.includes('database.reset'));
});

check('listProtectedZones returns sorted array', () => {
  const list = safety.listProtectedZones();
  assert.ok(Array.isArray(list));
  assert.ok(list.includes('PAYMENT_LEDGER'));
  assert.ok(list.includes('USER_IDENTITY'));
  assert.ok(list.includes('AUTH_CREDENTIALS'));
});

// ── registerEngine / getHarmonySnapshot ─────────────────────────────────────
console.log('\nForward-Only Safety — Engine registry');

check('registerEngine adds an engine', () => {
  const result = safety.registerEngine('test-engine', () => ({ active: true }));
  assert.strictEqual(result, true);
});

check('registerEngine rejects invalid inputs', () => {
  assert.strictEqual(safety.registerEngine('', () => {}), false);
  assert.strictEqual(safety.registerEngine('x', 'not-a-function'), false);
});

check('getHarmonySnapshot includes registered engines', () => {
  safety.registerEngine('harmony-test', () => ({ active: true }));
  const snapshot = safety.getHarmonySnapshot();
  assert.strictEqual(typeof snapshot.health, 'string');
  assert.ok(snapshot.totalEngines >= 1);
  assert.ok(snapshot.activeEngines >= 1);
  assert.ok(Array.isArray(snapshot.engines));
  const found = snapshot.engines.find(e => e.name === 'harmony-test');
  assert.ok(found);
  assert.strictEqual(found.active, true);
});

check('getHarmonySnapshot reports errors gracefully', () => {
  safety.registerEngine('broken-engine', () => { throw new Error('boom'); });
  const snapshot = safety.getHarmonySnapshot();
  assert.ok(snapshot.engineErrors >= 1);
  const found = snapshot.engines.find(e => e.name === 'broken-engine');
  assert.ok(found);
  assert.strictEqual(found.active, false);
  assert.ok(found.error.includes('boom'));
});

// ── getStatus ───────────────────────────────────────────────────────────────
console.log('\nForward-Only Safety — getStatus');

check('returns comprehensive status object', () => {
  const status = safety.getStatus();
  assert.strictEqual(status.name, 'forward-only-safety');
  assert.strictEqual(status.mode, 'forward-only');
  assert.strictEqual(typeof status.approvedMutationCount, 'number');
  assert.strictEqual(typeof status.blockedOperationCount, 'number');
  assert.strictEqual(typeof status.protectedZoneCount, 'number');
  assert.strictEqual(typeof status.violationCount, 'number');
  assert.ok(status.harmonyStatus);
});

console.log(`\n✅ forward-only-safety: ${passed} tests passed\n`);
