'use strict';

/**
 * earn-then-lease.test.js — ETL/1.0
 * Free providers before confirmed cash. Priced providers after it.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.MODEL_LEASE_PROFIT_FRACTION = '0.25';
delete process.env.MODEL_LEASE_MAX_PROMPT_USD;

const assert = require('assert');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Earn-Then-Lease (ETL/1.0)');

const earn = require('../backend/modules/earn-then-lease');

check('zero cash keeps the lane free and does not invent profit', () => {
  earn.setProbes({ confirmed: { paidUsd: 0, paidHumans: 0 }, spentUsd: 0 });
  const r = earn.rung();
  assert.strictEqual(r.protocol, 'ETL/1.0');
  assert.strictEqual(r.inventsProfit, false);
  assert.strictEqual(r.lane, 'free');
  assert.strictEqual(r.confirmedUsd, 0);
  assert.strictEqual(r.maxPromptUsdPerMillion, 0);
  assert.strictEqual(r.remainingUsd, 0);
  assert.ok(r.payers.includes('ai-cost-ledger'));
  assert.ok(r.payers.includes('ai-cfo-agent'));
});

check('a paid-human count without dollars does not open priced models', () => {
  earn.setProbes({ confirmed: { paidUsd: 0, paidHumans: 2 }, spentUsd: 0 });
  const r = earn.rung();
  assert.strictEqual(r.cashPending, true);
  assert.strictEqual(r.lane, 'free');
});

check('confirmed cash opens a share and the ledger spend closes it', () => {
  earn.setProbes({ confirmed: { paidUsd: 39, onchainUsd: 39, paidHumans: 1 }, spentUsd: 0 });
  const open = earn.rung();
  assert.strictEqual(open.lane, 'earned');
  assert.strictEqual(open.earnedCapUsd, 9.75);
  assert.strictEqual(open.ownerCapUsd, null);
  assert.strictEqual(open.maxPromptUsdPerMillion, 9.75);
  earn.setProbes({ confirmed: { paidUsd: 39, paidHumans: 1 }, spentUsd: 9.75 });
  const closed = earn.rung();
  assert.strictEqual(closed.lane, 'free');
  assert.strictEqual(closed.remainingUsd, 0);
});

check('provider gate blocks priced tiers until the earned lane opens', () => {
  earn.setProbes({ confirmed: { paidUsd: 0 }, spentUsd: 0 });
  assert.strictEqual(earn.providerCallable('groq', 1, null, null).ok, true);
  assert.strictEqual(earn.providerCallable('openai', 3, null, null).ok, false);
  assert.strictEqual(earn.providerCallable('openai', 3, null, null).reason, 'paid_provider_before_profit');
  assert.strictEqual(earn.providerCallable('openrouter', 2, 'meta/llama:free', 0).ok, true);
  assert.strictEqual(earn.providerCallable('openrouter', 2, 'openai/gpt-4o', 5).ok, false);
  earn.setProbes({ confirmed: { paidUsd: 39, paidHumans: 1 }, spentUsd: 0 });
  assert.strictEqual(earn.providerCallable('openai', 3, null, null).ok, true);
  assert.strictEqual(earn.providerCallable('openrouter', 2, 'new/frontier', 0.4).ok, true);
  earn.clearProbes();
});

console.log('\n✅ earn-then-lease: ' + passed + ' tests passed');
