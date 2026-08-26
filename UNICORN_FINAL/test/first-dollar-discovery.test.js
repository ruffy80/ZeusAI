'use strict';

/**
 * first-dollar-discovery.test.js — FDDP/1.0
 * Guards the real zero-visitor fixes: IndexNow protocol root key +
 * always-on traffic under stable (not parked by GROWTH_STACK_DISABLED).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
process.env.GROWTH_STACK_DISABLED = '1';

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('First-Dollar Discovery Pulse');

check('traffic-engine keyLocation is protocol root /{key}.txt', () => {
  const te = require('../backend/modules/traffic-engine');
  const key = te.indexNowKey();
  assert.ok(/^[0-9a-f]{16,64}$/.test(key), 'key hex');
  const loc = te.indexNowKeyLocation();
  assert.ok(loc.endsWith('/' + key + '.txt'), loc);
  assert.ok(!loc.includes('/indexnow-'), 'canonical location is not prefixed');
  const st = te.getStatus();
  assert.equal(st.indexNowKeyLocation, loc);
  assert.ok(st.indexNowKeyAlias && st.indexNowKeyAlias.includes('/indexnow-'));
});

check('pingAll dryRun uses protocol keyLocation', async () => {
  const te = require('../backend/modules/traffic-engine');
  const sub = await te.pingAll({ dryRun: true, urls: ['https://zeusai.pro/'] });
  assert.ok(sub.keyLocation.endsWith('/' + te.indexNowKey() + '.txt'));
  assert.ok(sub.engines.some((e) => e.engine === 'indexnow.org'));
});

check('site serves /{key}.txt and /indexnow-{key}.txt', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("fu === '/' + inKey + '.txt'"));
  assert.ok(src.includes("fu === '/indexnow-' + inKey + '.txt'"));
});

check('ecosystem defaults arm discovery (not park it)', () => {
  const src = read('ecosystem.config.js');
  assert.ok(src.includes("GROWTH_STACK_DISABLED: process.env.GROWTH_STACK_DISABLED || '0'"));
  assert.ok(src.includes("TRAFFIC_ENGINE_DISABLED: process.env.TRAFFIC_ENGINE_DISABLED || '0'"));
  assert.ok(!/GROWTH_STACK_DISABLED: process\.env\.GROWTH_STACK_DISABLED \|\| '1'/.test(src));
});

check('backend always starts traffic-engine unless TRAFFIC_ENGINE_DISABLED', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes("TRAFFIC_ENGINE_DISABLED !== '1'"));
  assert.ok(src.includes('First-Dollar Discovery Pulse') || src.includes('trafficEngine.start()'));
  // traffic start must not be solely inside GROWTH_STACK_DISABLED gate
  const idxTraffic = src.indexOf("TRAFFIC_ENGINE_DISABLED !== '1'");
  const idxGrowth = src.indexOf("GROWTH_STACK_DISABLED !== '1'");
  assert.ok(idxTraffic > 0 && idxGrowth > 0);
  assert.ok(idxTraffic < idxGrowth, 'traffic arm before growth-stack gate');
});

check('pre-keys exports agentReady', () => {
  const src = read('backend/modules/pre-keys-activation.js');
  assert.ok(src.includes('agentReady: waitingAgents.length === 0'));
});

check('deterministic key matches live host derivation', () => {
  const key = crypto.createHash('sha256').update('zeusai-indexnow:zeusai.pro').digest('hex').slice(0, 32);
  assert.equal(key, '1aa130e226c2219006d6eb466e2195dc');
});

console.log(`\n✅ first-dollar-discovery: ${passed} tests passed`);
process.exit(0);
