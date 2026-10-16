'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const policy = require('../src/commerce/native-ops-policy');

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

const ROUTINE = [
  'catalog', 'pricing', 'buy', 'btc_howto', 'paypal_howto',
  'my_services', 'activate', 'support', 'greet', 'enterprise',
  'compare', 'demo', 'security', 'growth', 'automation',
];

check('routine intents never call an external model, even with a billable key', () => {
  for (const intent of ROUTINE) {
    assert.strictEqual(policy.routineIntent(intent), true, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent, { billable: true }), false, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent, { billable: false }), false, intent);
  }
});

check('open intents call an external model only when a billable key exists', () => {
  for (const intent of ['general', 'forecast', 'roi']) {
    assert.strictEqual(policy.openIntent(intent), true, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent, { billable: true }), true, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent, { billable: false }), false, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent, {}), false, intent);
    assert.strictEqual(policy.shouldCallExternalModel(intent), false, intent);
  }
});

check('an unknown intent stays native', () => {
  assert.strictEqual(policy.shouldCallExternalModel('invented', { billable: true }), false);
  assert.strictEqual(policy.shouldCallExternalModel('', { billable: true }), false);
});

check('every classifyIntent result is classified A/B or C', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  const start = src.indexOf('function classifyIntent');
  const end = src.indexOf('function composeReply');
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  const returns = [...body.matchAll(/return '([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(returns.length >= 15);
  const known = new Set([...policy.NATIVE_INTENTS, ...policy.OPEN_INTENTS]);
  for (const intent of returns) assert.ok(known.has(intent), intent);
  assert.ok(returns.includes('general'));
  assert.ok(returns.includes('catalog'));
});

check('the concierge fetch is behind shouldCallExternalModel', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.strictEqual(src.includes("intent !== 'catalog'"), false);
  const gate = src.indexOf('shouldCallExternalModel(intent, { billable })');
  const fetchAt = src.indexOf("+'/api/chat'", gate);
  assert.ok(gate > 0);
  assert.ok(fetchAt > gate);
  assert.ok(src.includes('nativeOps: { protocol: nativeOpsProtocol, external: allowExternal, billable: !!billable }'));
});

console.log('✅ native-ops-policy: ' + passed + ' tests passed');
process.exit(0);
