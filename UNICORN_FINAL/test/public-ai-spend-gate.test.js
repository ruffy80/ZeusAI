'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');

const AI_KEYS = [
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY',
  'XAI_API_KEY',
];
for (const k of AI_KEYS) delete process.env[k];
delete process.env.PUBLIC_AI_ANON;

delete require.cache[require.resolve('../backend/modules/public-ai-spend-gate')];
const gate = require('../backend/modules/public-ai-spend-gate');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

check('no billable key → anonymous chat is allowed (fail-soft)', () => {
  assert.equal(gate.hasBillableLlm(), false);
  let nexted = false;
  const res = mockRes();
  gate.publicAiSpendGate({ headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, true);
  assert.equal(res.statusCode, 200);
});

check('billable key + no auth → 401 ai_auth_required', () => {
  process.env.OPENAI_API_KEY = 'sk-test-' + 'a'.repeat(40);
  delete require.cache[require.resolve('../backend/modules/fulfillment-ai-os')];
  delete require.cache[require.resolve('../backend/modules/public-ai-spend-gate')];
  const g = require('../backend/modules/public-ai-spend-gate');
  assert.equal(g.hasBillableLlm(), true);
  const res = mockRes();
  let nexted = false;
  g.publicAiSpendGate({ headers: {} }, res, () => { nexted = true; });
  assert.equal(nexted, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'ai_auth_required');
});

check('billable key + Bearer token proceeds', () => {
  process.env.OPENAI_API_KEY = 'sk-' + 'y'.repeat(40);
  delete require.cache[require.resolve('../backend/modules/public-ai-spend-gate')];
  const g = require('../backend/modules/public-ai-spend-gate');
  const res = mockRes();
  let nexted = false;
  g.publicAiSpendGate({ headers: { authorization: 'Bearer test-jwt' } }, res, () => { nexted = true; });
  assert.equal(nexted, true);
});

delete process.env.OPENAI_API_KEY;
console.log('\n✅ public-ai-spend-gate:', passed, 'tests passed');
process.exit(0);
