'use strict';
/**
 * credit-system.test.js — Unit tests for backend/modules/creditSystem.js
 *
 * Covers: PLAN_CREDITS, CREDIT_COSTS, getUsage, addUsage,
 * checkAndDeductCredits, getUsageSummary, requireCredits middleware,
 * getCurrentMonth.
 */

const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const credits = require('../backend/modules/creditSystem');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── Constants ───────────────────────────────────────────────────────────────
console.log('Credit System — Constants');

check('PLAN_CREDITS has expected tiers', () => {
  assert.strictEqual(credits.PLAN_CREDITS.free, 100);
  assert.strictEqual(credits.PLAN_CREDITS.starter, 10000);
  assert.strictEqual(credits.PLAN_CREDITS.pro, 120000);
  assert.strictEqual(credits.PLAN_CREDITS.enterprise, 1500000);
});

check('CREDIT_COSTS has expected actions', () => {
  assert.strictEqual(credits.CREDIT_COSTS.chat, 1);
  assert.strictEqual(credits.CREDIT_COSTS.compliance, 10);
  assert.strictEqual(credits.CREDIT_COSTS.negotiate, 5);
  assert.strictEqual(credits.CREDIT_COSTS.blueprint, 20);
  assert.strictEqual(credits.CREDIT_COSTS.ma_analyze, 50);
});

// ── getCurrentMonth ─────────────────────────────────────────────────────────
console.log('\nCredit System — getCurrentMonth');

check('returns YYYY-MM format', () => {
  const month = credits.getCurrentMonth();
  assert.ok(/^\d{4}-\d{2}$/.test(month), `Expected YYYY-MM, got ${month}`);
});

check('matches current date', () => {
  const d = new Date();
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  assert.strictEqual(credits.getCurrentMonth(), expected);
});

// ── getUsage / addUsage ─────────────────────────────────────────────────────
console.log('\nCredit System — getUsage / addUsage');

check('getUsage returns zero for new user', () => {
  const usage = credits.getUsage('new-user-' + Date.now());
  assert.strictEqual(usage.used, 0);
});

check('addUsage increments usage', () => {
  const userId = 'add-usage-test-' + Date.now();
  credits.addUsage(userId, 5, 'chat');
  credits.addUsage(userId, 10, 'compliance');
  const usage = credits.getUsage(userId);
  assert.strictEqual(usage.used, 15);
});

// ── checkAndDeductCredits ───────────────────────────────────────────────────
console.log('\nCredit System — checkAndDeductCredits');

check('allows deduction within limits', () => {
  const userId = 'deduct-ok-' + Date.now();
  const result = credits.checkAndDeductCredits(userId, 'chat', 'free');
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.cost, 1);
  assert.strictEqual(result.limit, 100);
});

check('blocks deduction when limit exceeded', () => {
  const userId = 'deduct-block-' + Date.now();
  // Fill up almost all credits (free = 100)
  credits.addUsage(userId, 99, 'fill');
  // Next deduction for 'compliance' (cost=10) exceeds limit
  const result = credits.checkAndDeductCredits(userId, 'compliance', 'free');
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.overage, true);
});

check('uses correct cost for action', () => {
  const userId = 'cost-check-' + Date.now();
  const result = credits.checkAndDeductCredits(userId, 'blueprint', 'pro');
  assert.strictEqual(result.cost, 20);
  assert.strictEqual(result.allowed, true);
});

check('unknown action defaults to cost 1', () => {
  const userId = 'unknown-action-' + Date.now();
  const result = credits.checkAndDeductCredits(userId, 'unknown_xyz', 'free');
  assert.strictEqual(result.cost, 1);
});

check('unknown plan defaults to free limit (100)', () => {
  const userId = 'unknown-plan-' + Date.now();
  const result = credits.checkAndDeductCredits(userId, 'chat', 'nonexistent');
  assert.strictEqual(result.limit, 100);
});

// ── getUsageSummary ─────────────────────────────────────────────────────────
console.log('\nCredit System — getUsageSummary');

check('returns complete summary object', () => {
  const userId = 'summary-' + Date.now();
  credits.addUsage(userId, 25, 'test');
  const summary = credits.getUsageSummary(userId, 'starter');
  assert.strictEqual(summary.userId, userId);
  assert.strictEqual(summary.used, 25);
  assert.strictEqual(summary.limit, 10000);
  assert.strictEqual(summary.remaining, 9975);
  assert.strictEqual(typeof summary.percentUsed, 'number');
  assert.ok(summary.month);
  assert.deepStrictEqual(summary.creditCosts, credits.CREDIT_COSTS);
  assert.deepStrictEqual(summary.planLimits, credits.PLAN_CREDITS);
});

check('percentUsed calculates correctly', () => {
  const userId = 'percent-' + Date.now();
  credits.addUsage(userId, 50, 'test');
  const summary = credits.getUsageSummary(userId, 'free');
  assert.strictEqual(summary.percentUsed, 50); // 50/100 = 50%
});

// ── requireCredits middleware ───────────────────────────────────────────────
console.log('\nCredit System — requireCredits middleware');

check('returns a function', () => {
  const mw = credits.requireCredits('chat');
  assert.strictEqual(typeof mw, 'function');
});

check('calls next() when no req.user (auth handles it)', () => {
  const mw = credits.requireCredits('chat');
  let nextCalled = false;
  const req = {};
  const res = {};
  mw(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

check('skips credit check in test mode (NODE_ENV=test)', () => {
  const mw = credits.requireCredits('chat');
  let nextCalled = false;
  const req = { user: { id: 'mw-test-user' } };
  const res = {};
  mw(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

console.log(`\n✅ credit-system: ${passed} tests passed\n`);
