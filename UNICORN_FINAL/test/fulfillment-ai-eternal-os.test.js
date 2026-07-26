'use strict';

// Fulfillment AI Eternal OS — Key Continuum + force on/off + allowlist.

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

process.env.NODE_ENV = 'test';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-fulfill-ai-'));
process.env.UNICORN_DATA_DIR = TMP;

const AI_KEYS = [
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY',
  'XAI_API_KEY', 'HF_API_KEY', 'HUGGINGFACE_API_KEY', 'PERPLEXITY_API_KEY',
  'TOGETHER_API_KEY', 'FIREWORKS_API_KEY', 'SAMBANOVA_API_KEY', 'NVIDIA_NIM_API_KEY',
  'GOOGLE_API_KEY',
];

for (const k of AI_KEYS) delete process.env[k];
delete process.env.FULFILLMENT_AI_ENABLED;
delete process.env.FULFILLMENT_AI_SKUS;

// Fresh require after env scrub
delete require.cache[require.resolve('../backend/modules/fulfillment-ai-os')];
const eternal = require('../backend/modules/fulfillment-ai-os');
delete require.cache[require.resolve('../src/site/v2/fulfillment-engine')];
const engine = require('../src/site/v2/fulfillment-engine');

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log('  ✓ ' + name);
}

check('resolveMode maps auto/on/off', () => {
  assert.strictEqual(eternal.resolveMode('auto'), 'auto');
  assert.strictEqual(eternal.resolveMode(''), 'auto');
  assert.strictEqual(eternal.resolveMode(undefined), 'auto');
  assert.strictEqual(eternal.resolveMode('1'), 'on');
  assert.strictEqual(eternal.resolveMode('true'), 'on');
  assert.strictEqual(eternal.resolveMode('eternal'), 'on');
  assert.strictEqual(eternal.resolveMode('0'), 'off');
  assert.strictEqual(eternal.resolveMode('off'), 'off');
});

check('auto + no keys = disarmed', () => {
  delete process.env.FULFILLMENT_AI_ENABLED;
  assert.strictEqual(eternal.isArmed(), false);
  assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), false);
});

check('force-off wins even with a key', () => {
  process.env.OPENAI_API_KEY = 'sk-test-' + 'x'.repeat(40);
  process.env.FULFILLMENT_AI_ENABLED = '0';
  assert.strictEqual(eternal.isArmed(), false);
  assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), false);
});

check('auto + real key = armed for default allowlist SKUs', () => {
  process.env.FULFILLMENT_AI_ENABLED = 'auto';
  process.env.OPENAI_API_KEY = 'sk-test-' + 'y'.repeat(40);
  assert.strictEqual(eternal.isArmed(), true);
  assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), true);
  assert.strictEqual(engine.shouldUseAiForSku('instant-landing-page'), true);
  assert.strictEqual(engine.shouldUseAiForSku('instant-logo-kit'), false);
  assert.strictEqual(engine.shouldUseAiForSku('professional-saas-mvp'), false);
});

check('unset flag behaves as auto when key present', () => {
  delete process.env.FULFILLMENT_AI_ENABLED;
  process.env.DEEPSEEK_API_KEY = 'sk-deep-' + 'z'.repeat(40);
  assert.strictEqual(eternal.resolveMode(process.env.FULFILLMENT_AI_ENABLED), 'auto');
  assert.strictEqual(eternal.isArmed(), true);
  assert.strictEqual(engine.shouldUseAiForSku('instant-pitch-deck'), true);
});

check('placeholder keys do not arm', () => {
  for (const k of AI_KEYS) delete process.env[k];
  process.env.FULFILLMENT_AI_ENABLED = 'auto';
  process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
  assert.strictEqual(eternal.isArmed(), false);
});

check('force-on attempts allowlisted SKUs even without key; armed needs key', () => {
  for (const k of AI_KEYS) delete process.env[k];
  process.env.FULFILLMENT_AI_ENABLED = '1';
  assert.strictEqual(eternal.isArmed(), false);
  assert.strictEqual(engine.shouldUseAiForSku('instant-seo-content-pack'), true,
    'force-on should attempt AI (fail-soft later)');
  process.env.GROQ_API_KEY = 'gsk_' + 'a'.repeat(48);
  assert.strictEqual(eternal.isArmed(), true);
});

check('getStatus never leaks key material', () => {
  process.env.OPENAI_API_KEY = 'sk-secret-' + 'b'.repeat(40);
  process.env.FULFILLMENT_AI_ENABLED = 'auto';
  const st = eternal.getStatus();
  assert.strictEqual(st.ok, true);
  assert.strictEqual(st.armed, true);
  assert.strictEqual(st.mode, 'auto');
  assert.ok(st.providersConfigured >= 1);
  const blob = JSON.stringify(st);
  assert.ok(!/sk-secret/.test(blob), 'status must not contain key value');
  assert.ok(fs.existsSync(path.join(TMP, 'fulfillment-ai-eternal.json')), 'eternal ledger written');
});

check('SKU * allowlist opens non-default instant SKUs', () => {
  process.env.FULFILLMENT_AI_ENABLED = '1';
  process.env.OPENAI_API_KEY = 'sk-test-' + 'c'.repeat(40);
  process.env.FULFILLMENT_AI_SKUS = '*';
  assert.strictEqual(engine.shouldUseAiForSku('instant-logo-kit'), true);
  delete process.env.FULFILLMENT_AI_SKUS;
});

check('isRealKey rejects short / placeholder', () => {
  assert.strictEqual(eternal.isRealKey('short'), false);
  assert.strictEqual(eternal.isRealKey('changeme'), false);
  assert.strictEqual(eternal.isRealKey('sk-' + 'd'.repeat(40)), true);
});

console.log('✅ fulfillment-ai-eternal-os: ' + pass + ' tests passed');
