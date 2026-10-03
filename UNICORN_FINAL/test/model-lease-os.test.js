'use strict';

/**
 * model-lease-os.test.js — MLO/1.0
 * Newest catalog model under a price ceiling. No call without a real key.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENROUTER_MODEL;
process.env.MODEL_LEASE_LANE = 'current';
process.env.MODEL_LEASE_MAX_PROMPT_USD = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Model Lease OS (MLO/1.0)');

const lease = require('../backend/modules/model-lease-os');
const earn = require('../backend/modules/earn-then-lease');

const CATALOG = [
  { id: 'meta/llama:free', created: 50, context_length: 128000, pricing: { prompt: '0' } },
  { id: 'old/cheap', created: 100, context_length: 128000, pricing: { prompt: '0.0000002' } },
  { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
  { id: 'new/too-costly', created: 400, context_length: 1000000, pricing: { prompt: '0.00002' } },
];

check('zero confirmed cash leases the newest free row and holds paid pins', () => {
  delete process.env.OPENROUTER_MODEL;
  earn.setProbes({ confirmed: { paidUsd: 0, paidHumans: 0 }, spentUsd: 0 });
  const d = lease.ingest(CATALOG);
  assert.strictEqual(d.protocol, 'MLO/1.0');
  assert.strictEqual(d.inventsModels, false);
  assert.strictEqual(d.inventsCalls, false);
  assert.strictEqual(d.inventsProfit, false);
  assert.strictEqual(d.callsUnarmed, false);
  assert.strictEqual(d.armed, false);
  assert.strictEqual(d.secret, 'OPENROUTER_API_KEY');
  assert.strictEqual(d.earn.protocol, 'ETL/1.0');
  assert.strictEqual(d.earn.inventsProfit, false);
  assert.strictEqual(d.earn.lane, 'free');
  assert.strictEqual(d.earn.confirmedUsd, 0);
  assert.strictEqual(d.maxPromptUsdPerMillion, 0);
  assert.strictEqual(d.lease.id, 'meta/llama:free');
  assert.strictEqual(d.lease.lane, 'free');
  assert.strictEqual(lease.currentModelId(), 'meta/llama:free');
  process.env.OPENROUTER_MODEL = 'new/frontier';
  const held = lease.ingest(CATALOG);
  assert.strictEqual(held.lease.id, 'meta/llama:free');
  assert.strictEqual(held.earn.pinDeferred.reason, 'paid_pin_before_confirmed_profit');
  assert.strictEqual(lease.resolveOpenRouterModel(), 'meta/llama:free');
  delete process.env.OPENROUTER_MODEL;
});

check('confirmed cash raises the ceiling inside the remaining share', () => {
  delete process.env.OPENROUTER_MODEL;
  earn.setProbes({ confirmed: { paidUsd: 39, paidHumans: 1, paidOrders: 1 }, spentUsd: 0 });
  const d = lease.ingest(CATALOG);
  assert.strictEqual(d.earn.lane, 'earned');
  assert.strictEqual(d.earn.confirmedUsd, 39);
  assert.strictEqual(d.earn.fraction, 0.25);
  assert.strictEqual(d.earn.earnedCapUsd, 9.75);
  assert.strictEqual(d.earn.remainingUsd, 9.75);
  assert.strictEqual(d.maxPromptUsdPerMillion, 1);
  assert.strictEqual(d.lease.id, 'new/frontier');
  assert.strictEqual(d.lease.lane, 'current');
  process.env.OPENROUTER_MODEL = 'old/cheap';
  const pinned = lease.ingest(CATALOG);
  assert.strictEqual(pinned.lease.id, 'old/cheap');
  assert.strictEqual(pinned.lease.lane, 'pinned');
  process.env.OPENROUTER_MODEL = 'new/too-costly';
  const over = lease.ingest(CATALOG);
  assert.strictEqual(over.lease.id, 'new/frontier');
  assert.strictEqual(over.earn.pinDeferred.reason, 'pinned_over_earned_ceiling');
  delete process.env.OPENROUTER_MODEL;
  earn.setProbes({ confirmed: { paidUsd: 39, paidHumans: 1 }, spentUsd: 9.75 });
  const closed = lease.ingest(CATALOG);
  assert.strictEqual(closed.earn.lane, 'free');
  assert.strictEqual(closed.earn.remainingUsd, 0);
  assert.strictEqual(closed.lease.id, 'meta/llama:free');
  earn.setProbes({ confirmed: { paidUsd: 0, paidHumans: 1 }, spentUsd: 0 });
  const pending = lease.ingest(CATALOG);
  assert.strictEqual(pending.earn.cashPending, true);
  assert.strictEqual(pending.lease.id, 'meta/llama:free');
  earn.clearProbes();
});

check('UAIC, router, providers and fulfillment read the lease', () => {
  const uaic = read('backend/modules/universalAIConnector.js');
  assert.ok(uaic.includes('discoverNewModels'));
  assert.ok(uaic.includes('model-lease-os'));
  assert.ok(uaic.includes('resolveOpenRouterModel'));
  assert.ok(uaic.includes("model.name === 'openrouter'"));
  assert.ok(!uaic.includes('openrouter/auto'));
  const router = read('backend/modules/multi-model-router.js');
  assert.ok(router.includes("provider.name === 'openrouter'"));
  assert.ok(router.includes('resolveOpenRouterModel'));
  const providers = read('backend/modules/aiProviders.js');
  assert.ok(providers.includes('resolveOpenRouterModel'));
  assert.ok(providers.includes('providerCallable'));
  const orch = read('backend/modules/ai-orchestrator.js');
  assert.ok(orch.includes('resolveOpenRouterModel'));
  const fulfill = read('backend/modules/fulfillment-ai-os.js');
  assert.ok(fulfill.includes('modelLease'));
  const boot = read('backend/index.js');
  assert.ok(boot.includes("app.get(['/api/model-lease', '/.well-known/model-lease.json']"));
  assert.ok(boot.includes('lease.start()'));
  assert.ok(boot.includes('discoverNewModels'));
  assert.ok(boot.includes("res.set('X-Earn-Protocol', 'ETL/1.0')"));
});

check('nginx pins model-lease.json to the backend', () => {
  const conf = read('scripts/nginx-unicorn.conf');
  const i = conf.indexOf('location = /.well-known/model-lease.json');
  assert.ok(i >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(conf.slice(i, i + 500)));
});

check('test:chain includes model-lease and earn-then-lease', () => {
  const pkg = JSON.parse(read('package.json'));
  const chain = String(pkg.scripts['test:chain']);
  assert.ok(chain.includes('model-lease-os.test.js'));
  assert.ok(chain.includes('earn-then-lease.test.js'));
});

async function main() {
  earn.setProbes({ confirmed: { paidUsd: 0, paidHumans: 0 }, spentUsd: 0 });
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  let called = false;
  const out = await lease.complete({
    prompt: 'hi',
    fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; },
  });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.called, false);
  assert.strictEqual(out.reason, 'missing OPENROUTER_API_KEY');
  assert.strictEqual(called, false);
  passed += 1;
  console.log('  ✓ complete refuses to call when the key is missing');

  process.env.OPENROUTER_API_KEY = 'sk-test-lease-key-0001';
  lease.ingest([
    { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
  ]);
  called = false;
  const blocked = await lease.complete({
    prompt: 'invent a product',
    task: 'self-develop',
    fetchImpl: async () => { called = true; return { ok: true, json: async () => ({}) }; },
  });
  assert.strictEqual(blocked.called, false);
  assert.strictEqual(blocked.reason, 'no_free_model_before_profit');
  assert.strictEqual(called, false);
  passed += 1;
  console.log('  ✓ complete does not call a priced model before confirmed cash');

  earn.setProbes({ confirmed: { paidUsd: 39, paidHumans: 1 }, spentUsd: 0 });
  const spent = [];
  lease.ingest([
    { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
  ]);
  const paid = await lease.complete({
    prompt: 'improve the offer',
    task: 'self-develop',
    recordSpend: (row) => { spent.push(row); },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        model: 'new/frontier',
        usage: { total_tokens: 1000 },
        choices: [{ message: { content: 'ship the $39 resume' } }],
      }),
    }),
  });
  assert.strictEqual(paid.ok, true);
  assert.strictEqual(paid.called, true);
  assert.strictEqual(paid.model, 'new/frontier');
  assert.strictEqual(spent.length, 1);
  assert.strictEqual(spent[0].provider, 'openrouter');
  assert.strictEqual(spent[0].task, 'self-develop');
  assert.strictEqual(spent[0].tokens, 1000);
  assert.ok(spent[0].costUsd > 0);
  passed += 1;
  console.log('  ✓ confirmed cash calls the earned model and records spend');

  delete process.env.OPENROUTER_API_KEY;
  earn.clearProbes();
  console.log('\n✅ model-lease-os: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error('❌ model-lease-os failed:', err);
  process.exit(1);
});
