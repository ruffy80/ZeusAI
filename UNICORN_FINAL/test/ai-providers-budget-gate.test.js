'use strict';

/**
 * ai-providers-budget-gate.test.js
 * Locks the AI monthly budget hard-gate in aiProviders.chat so over-budget
 * spend cannot continue once ai-cost-ledger reports overBudget.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.AI_BUDGET_HARD_GATE = '1';
process.env.AI_MONTHLY_BUDGET_USD = '1';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-budget-'));
process.env.AI_COST_MAX_ENTRIES = '100';

// Point ledger at an isolated data dir by loading after monkey-patching cwd-relative paths
// is awkward; instead we use the real module and clear() between cases.
const ledger = require('../backend/modules/ai-cost-ledger');
const aiProviders = require('../backend/modules/aiProviders');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' — ' + (e && e.message ? e.message : e));
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' — ' + (e && e.message ? e.message : e));
  }
}

console.log('ai-providers budget gate tests');

check('assertWithinBudget exports and passes when under budget', () => {
  ledger.clear();
  const r = aiProviders.assertWithinBudget();
  assert.equal(r.ok, true);
});

check('assertWithinBudget fails when over budget', () => {
  ledger.clear();
  // Force spend above $1 monthly budget.
  ledger.record({ provider: 'test', model: 'gpt-4o', task: 'chat', tokens: 0, costUsd: 2 });
  const r = aiProviders.assertWithinBudget();
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AI_BUDGET_EXCEEDED');
  assert.ok(r.budget && r.budget.overBudget === true);
});

check('assertWithinBudget respects ignoreBudget', () => {
  ledger.clear();
  ledger.record({ provider: 'test', model: 'gpt-4o', task: 'chat', tokens: 0, costUsd: 9 });
  const r = aiProviders.assertWithinBudget({ ignoreBudget: true });
  assert.equal(r.ok, true);
});

check('assertWithinBudget respects AI_BUDGET_HARD_GATE=0', () => {
  ledger.clear();
  ledger.record({ provider: 'test', model: 'gpt-4o', task: 'chat', tokens: 0, costUsd: 9 });
  const prev = process.env.AI_BUDGET_HARD_GATE;
  process.env.AI_BUDGET_HARD_GATE = '0';
  try {
    const r = aiProviders.assertWithinBudget();
    assert.equal(r.ok, true);
  } finally {
    process.env.AI_BUDGET_HARD_GATE = prev;
  }
});

(async () => {
  await checkAsync('chat() throws AI_BUDGET_EXCEEDED when over budget', async () => {
    ledger.clear();
    ledger.record({ provider: 'test', model: 'gpt-4o', task: 'chat', tokens: 0, costUsd: 5 });
    process.env.AI_BUDGET_HARD_GATE = '1';
    let threw = null;
    try {
      await aiProviders.chat('hello', []);
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw');
    assert.equal(threw.code, 'AI_BUDGET_EXCEEDED');
  });

  console.log(tmp ? '' : '');
  if (failed) {
    console.error(`\n❌ ai-providers-budget-gate: ${failed} failed, ${passed} passed`);
    process.exit(1);
  }
  console.log(`\n✅ ai-providers-budget-gate: ${passed} tests passed`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
