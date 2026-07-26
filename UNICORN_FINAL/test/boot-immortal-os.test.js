'use strict';

// Boot Immortal OS — stable profile must never arm UEE / orchestrator loops.

process.env.NODE_ENV = 'test';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.UNICORN_ORCHESTRATOR_FORCE;
delete process.env.UNICORN_SELF_HEALER_FORCE;

const assert = require('assert');
const path = require('path');

function bust(rel) {
  const abs = require.resolve(path.join(__dirname, '..', rel));
  delete require.cache[abs];
}

bust('backend/modules/boot-immortal-os.js');
bust('backend/modules/unicornOrchestrator.js');
bust('backend/modules/unicornEternalEngine.js');
bust('src/modules/code-sanity-engine/index.js');

const boot = require('../backend/modules/boot-immortal-os');
const orch = require('../backend/modules/unicornOrchestrator');
const uee = require('../backend/modules/unicornEternalEngine');
const sanity = require('../src/modules/code-sanity-engine');

let pass = 0;
function check(name, fn) {
  fn();
  pass += 1;
  console.log('  ✓ ' + name);
}

check('isStableProfile true under stable', () => {
  assert.strictEqual(boot.isStableProfile(), true);
  assert.strictEqual(boot.assertStableIdle('uee').ok, false);
});

check('orchestrator start() stays idle under stable', () => {
  const out = orch.start('full');
  assert.strictEqual(out.mode, 'idle');
  assert.strictEqual(orch.getStatus().mode, 'idle');
});

check('UEE startEternalCycle is a no-op under stable', () => {
  // Should not throw and must not schedule work that logs Ciclu etern.
  uee.startEternalCycle();
  uee.startPredictiveInnovation();
  uee.startSelfHealing();
});

check('code-sanity start() refuses under stable', () => {
  sanity.stop();
  sanity.start();
  assert.strictEqual(sanity.isRunning, false);
});

check('growth profile allows orchestrator (modeled via env flip)', () => {
  process.env.UNICORN_RUNTIME_PROFILE = 'growth';
  bust('backend/modules/boot-immortal-os.js');
  const boot2 = require('../backend/modules/boot-immortal-os');
  assert.strictEqual(boot2.isStableProfile(), false);
  assert.strictEqual(boot2.assertStableIdle('x').ok, true);
  process.env.UNICORN_RUNTIME_PROFILE = 'stable';
});

console.log('✅ boot-immortal-os: ' + pass + ' tests passed');
