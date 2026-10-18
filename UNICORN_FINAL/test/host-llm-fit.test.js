'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fit = require('../backend/modules/host-llm-fit');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

const host = { totalMB: 7741, availableMB: 5666 };

check('the 3B model fits the 8GB commerce host', () => {
  const choice = fit.selectModel(Object.assign({ requested: fit.SAFE_MODEL }, host));
  assert.strictEqual(choice.model, 'llama3.2:3b-instruct-q4_K_M');
  assert.strictEqual(choice.reason, 'fits');
  assert.ok(choice.runtimeMB <= 3200);
});

check('llama3:latest and the 8B default do not fit that host', () => {
  for (const name of ['llama3:latest', 'llama3.1:8b-instruct-q4_K_M']) {
    const choice = fit.selectModel(Object.assign({ requested: name }, host));
    assert.strictEqual(choice.model, null, name);
    assert.strictEqual(choice.reason, 'host_ram', name);
    assert.strictEqual(choice.refused, name);
  }
});

check('a large host may keep an 8B model', () => {
  const choice = fit.selectModel({
    requested: 'llama3.1:8b-instruct-q4_K_M',
    totalMB: 32000,
    availableMB: 20000,
  });
  assert.strictEqual(choice.model, 'llama3.1:8b-instruct-q4_K_M');
});

check('the local prompt is the shelf and does not invent a plan', () => {
  const text = fit.unicornShelfContext();
  assert.ok(text.includes('instant-resume-makeover'));
  assert.ok(text.includes('does not deliver the license'));
  assert.ok(text.includes('Dropship is paused'));
  assert.ok(!text.includes('$29'));
  assert.ok(!text.includes('50+'));
});

check('the bridge defaults to the safe model and refuses a tight host before generate', () => {
  const src = fs.readFileSync(path.join(__dirname, '../backend/modules/llamaBridge.js'), 'utf8');
  assert.ok(src.includes('hostFit.SAFE_MODEL'));
  assert.ok(!src.includes('llama3.1:8b-instruct-q4_K_M'));
  assert.ok(src.includes('if (!choice.model)'));
  const chat = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.ok(chat.includes('localLlmContext()'));
  assert.ok(!chat.includes('Starter ($29'));
});

console.log(`\n✅ host-llm-fit: ${passed} tests passed`);
process.exit(0);
