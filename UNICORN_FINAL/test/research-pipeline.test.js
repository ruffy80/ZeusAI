'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.IAK_HARMONIC_MS = '60000';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
delete process.env.RESEARCH_PIPELINE_SCHEDULE;
for (const key of [
  'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY', 'GEMINI_API_KEY', 'COHERE_API_KEY', 'HUGGINGFACE_API_KEY',
  'SAMBANOVA_API_KEY', 'NVIDIA_NIM_API_KEY', 'OPENAI_API_KEY', 'PERPLEXITY_API_KEY',
  'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY',
]) {
  delete process.env[key];
}

const os = require('os');
const path = require('path');
const assert = require('assert');

const dbPath = path.join(os.tmpdir(), `research-pipeline-test-${process.pid}.db`);
process.env.PIPELINE_MEMORY_DB = dbPath;

const router = require('../backend/modules/multi-model-router');
const research = require('../backend/modules/research-agent');
const memory = require('../backend/modules/pipeline-memory');
const pipeline = require('../backend/modules/research-pipeline');
const discovery = require('../backend/modules/iak/module-discovery');
const kernel = require('../backend/modules/integrated-autonomy-kernel');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('  ✓', name);
    });
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function cards() {
  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return [
    { id: 'old/card', createdAt: '2020-01-01T00:00:00.000Z', downloads: 9, pipeline_tag: 'text-generation' },
    { id: 'new/card', createdAt: recent, downloads: 3, pipeline_tag: 'text-generation' },
    { id: 'not a model', createdAt: recent, downloads: 1 },
  ];
}

async function main() {
  console.log('Research pipeline');

  await check('stable profile allows research-pipeline', async () => {
    assert.ok(discovery.STABLE_START_ALLOW.has('research-pipeline'));
    const entry = kernel.registry.get('research-pipeline');
    assert.ok(entry, 'kernel.register did not keep research-pipeline');
    assert.ok(entry.capabilities.includes('research-to-memory'));
    assert.strictEqual(entry.tier, 'infra');
    const gate = discovery.mayStart({
      name: 'research-pipeline',
      instance: entry.instance,
      hasStart: true,
      hasInit: false,
      tier: entry.tier,
      honestyClass: entry.honestyClass,
    }, { stable: true, selfMutationDisabled: true });
    assert.strictEqual(gate.ok, true);
    assert.strictEqual(gate.reason, 'stable_allowlist');
    const idle = pipeline.start();
    assert.strictEqual(idle.scheduled, false);
    const tick = await pipeline.noteTick();
    assert.strictEqual(tick.ran, false);
    assert.strictEqual(tick.reason, 'schedule_off');
  });

  await check('router chooses groq on cost and speed when no key is set', () => {
    const choice = router.chooseProvider('simple');
    assert.strictEqual(choice.provider, 'groq');
    assert.strictEqual(choice.model, 'llama3-8b-8192');
    assert.strictEqual(choice.configured, false);
    assert.ok(choice.costPer1KTokens < 0.0002);
    assert.ok(choice.speedScore >= 0.99);
  });

  await check('router prefers a configured key over a cheaper missing key', () => {
    process.env.DEEPSEEK_API_KEY = 'test-key-not-real';
    try {
      const choice = router.chooseProvider('simple');
      assert.strictEqual(choice.provider, 'deepseek');
      assert.strictEqual(choice.configured, true);
    } finally {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });

  await check('schema requires title, description, and an https source', () => {
    const bad = pipeline.validateSummary({ title: 'ab', description: 'short', sourceUrl: 'http://example.com' });
    assert.strictEqual(bad.ok, false);
    assert.ok(bad.errors.includes('title'));
    assert.ok(bad.errors.includes('description'));
    assert.ok(bad.errors.includes('sourceUrl'));
    const good = pipeline.validateSummary({
      title: 'new/card',
      description: 'A public model card with a real source URL.',
      sourceUrl: 'https://huggingface.co/new/card',
    });
    assert.strictEqual(good.ok, true);
  });

  await check('empty 7-day window stays an honest record', async () => {
    const found = await research.research('Find the latest AI model released in the last 7 days', {
      fetch: async () => jsonResponse([
        { id: 'old/card', createdAt: '2020-01-01T00:00:00.000Z', downloads: 1, pipeline_tag: 'text-generation' },
      ]),
    });
    assert.strictEqual(found.found, false);
    assert.strictEqual(found.sourceUrl, research.HF_MODELS_URL);
    assert.ok(!/gpt|claude|gemini/i.test(found.title));
    const check = pipeline.validateSummary(found);
    assert.strictEqual(check.ok, true);
  });

  await check('run writes the in-window card into sqlite', async () => {
    const result = await pipeline.run({
      task: 'Find the latest AI model released in the last 7 days',
      dbPath,
      correlationId: 'corr-test-1',
      fetch: async () => jsonResponse(cards()),
    });
    assert.strictEqual(result.correlationId, 'corr-test-1');
    assert.strictEqual(result.summary.title, 'new/card');
    assert.strictEqual(result.summary.sourceUrl, 'https://huggingface.co/new/card');
    assert.strictEqual(result.choice.provider, 'groq');
    const row = memory.readByCorrelation('corr-test-1', dbPath);
    assert.ok(row);
    assert.strictEqual(row.title, 'new/card');
    assert.strictEqual(row.sourceUrl, 'https://huggingface.co/new/card');
    assert.strictEqual(row.provider, 'groq');
    assert.strictEqual(row.model, 'llama3-8b-8192');
    assert.strictEqual(row.payload.providerInvoked, false);
    assert.strictEqual(row.payload.research.found, true);
  });

  memory.close(dbPath);
  pipeline.stop();
  console.log(`\n✅ research-pipeline: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  try { memory.close(dbPath); } catch (_) { /* closed */ }
  process.exit(1);
});
