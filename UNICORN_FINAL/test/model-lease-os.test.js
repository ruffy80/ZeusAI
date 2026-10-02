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

check('newest model under the ceiling wins; expensive and pinned behave', () => {
  delete process.env.OPENROUTER_MODEL;
  const d = lease.ingest([
    { id: 'old/cheap', created: 100, context_length: 128000, pricing: { prompt: '0.0000002' } },
    { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
    { id: 'new/too-costly', created: 400, context_length: 1000000, pricing: { prompt: '0.00002' } },
  ]);
  assert.strictEqual(d.protocol, 'MLO/1.0');
  assert.strictEqual(d.inventsModels, false);
  assert.strictEqual(d.inventsCalls, false);
  assert.strictEqual(d.callsUnarmed, false);
  assert.strictEqual(d.armed, false);
  assert.strictEqual(d.secret, 'OPENROUTER_API_KEY');
  assert.strictEqual(d.lease.id, 'new/frontier');
  assert.strictEqual(d.lease.lane, 'current');
  assert.strictEqual(lease.currentModelId(), 'new/frontier');
  process.env.OPENROUTER_MODEL = 'old/cheap';
  const pinned = lease.ingest([
    { id: 'old/cheap', created: 100, context_length: 128000, pricing: { prompt: '0.0000002' } },
    { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
  ]);
  assert.strictEqual(pinned.lease.id, 'old/cheap');
  assert.strictEqual(pinned.lease.lane, 'pinned');
  delete process.env.OPENROUTER_MODEL;
  lease.ingest([
    { id: 'new/frontier', created: 300, context_length: 200000, pricing: { prompt: '0.0000004' } },
  ]);
});

check('UAIC, router, providers and fulfillment read the lease', () => {
  const uaic = read('backend/modules/universalAIConnector.js');
  assert.ok(uaic.includes('discoverNewModels'));
  assert.ok(uaic.includes('model-lease-os'));
  assert.ok(uaic.includes("model.name === 'openrouter'"));
  const router = read('backend/modules/multi-model-router.js');
  assert.ok(router.includes("provider.name === 'openrouter'"));
  assert.ok(router.includes('model-lease-os'));
  const providers = read('backend/modules/aiProviders.js');
  assert.ok(providers.includes('model-lease-os'));
  const fulfill = read('backend/modules/fulfillment-ai-os.js');
  assert.ok(fulfill.includes('modelLease'));
  const boot = read('backend/index.js');
  assert.ok(boot.includes("app.get(['/api/model-lease', '/.well-known/model-lease.json']"));
  assert.ok(boot.includes('lease.start()'));
  assert.ok(boot.includes('discoverNewModels'));
});

check('nginx pins model-lease.json to the backend', () => {
  const conf = read('scripts/nginx-unicorn.conf');
  const i = conf.indexOf('location = /.well-known/model-lease.json');
  assert.ok(i >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(conf.slice(i, i + 500)));
});

check('test:chain includes model-lease-os.test.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('model-lease-os.test.js'));
});

async function main() {
  delete process.env.OPENROUTER_API_KEY;
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
  console.log('\n✅ model-lease-os: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error('❌ model-lease-os failed:', err);
  process.exit(1);
});
