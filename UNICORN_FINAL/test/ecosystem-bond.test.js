'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.IAK_HARMONIC_MS = '60000';
delete process.env.AUTONOMY_KILL_SWITCH;
delete process.env.UNICORN_AUTONOMY;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bond = require('../backend/modules/ecosystem-bond');
const memory = require('../backend/modules/usi-memory');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('static map marks the kernel active and does not execute modules', () => {
  bond.resetForTests();
  const map = bond.buildMap();
  assert.strictEqual(map.protocol, 'EBO/1.0');
  assert.strictEqual(map.inventsModules, false);
  assert.strictEqual(map.executedModules, false);
  assert.ok(map.counts.active > 400);
  assert.ok(map.counts.orphaned > 50);
  const kernel = map.modules.find((row) => row.name === 'integrated-autonomy-kernel');
  assert.strictEqual(kernel.status, 'active');
  assert.strictEqual(kernel.entrypoint, 'backend/index.js');
  const self = map.modules.find((row) => row.name === 'ecosystem-bond');
  assert.strictEqual(self.status, 'active');
  assert.ok(!JSON.stringify(map).includes(process.env.JWT_SECRET || 'jwt-secret-should-not-appear'));
});

check('a memory task validates, stores, and is audited', () => {
  bond.resetForTests();
  const out = bond.dispatch({
    type: 'memory.write',
    payload: { key: 'ebo-origin', value: 1 },
    permissions: ['memory'],
    expected_schema: { ok: 'boolean' },
  }, {
    'memory.write': (task) => memory.remember(task.payload.key, task.payload.value),
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(memory.recall('ebo-origin').value, 1);
  assert.strictEqual(bond.summary().audit.length > 0, true);
});

check('schema mismatch escalates and a provider failure falls back', () => {
  bond.resetForTests();
  const bad = bond.dispatch({
    type: 'memory.write',
    expected_schema: { ok: 'boolean' },
    permissions: [],
  }, {
    'memory.write': () => ({ nope: true }),
  });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.escalated, true);
  bond.resetForTests();
  const down = new Error('provider down');
  down.code = 'provider_down';
  const saved = bond.dispatch({
    type: 'model',
    permissions: ['model'],
    cost_budget: 0,
    expected_schema: { ok: 'boolean' },
  }, {
    model: () => { throw down; },
    'model:fallback': () => ({ ok: true, route: 'fallback' }),
  });
  assert.strictEqual(saved.ok, true);
  assert.strictEqual(saved.fallback, true);
  assert.strictEqual(saved.result.route, 'fallback');
});

check('kill switch and missing permission block the action', () => {
  bond.resetForTests();
  process.env.AUTONOMY_KILL_SWITCH = '1';
  const blocked = bond.dispatch({ type: 'memory.write', permissions: ['memory'] }, {
    'memory.write': () => ({ ok: true }),
  });
  assert.strictEqual(blocked.blocked, true);
  assert.strictEqual(blocked.reason, 'kill_switch');
  delete process.env.AUTONOMY_KILL_SWITCH;
  const denied = bond.dispatch({ type: 'payment', payload: { amount: 1 } }, {
    payment: () => ({ ok: true }),
  });
  assert.strictEqual(denied.blocked, true);
  assert.strictEqual(denied.reason, 'permission_denied');
});

check('a paused handler keeps the task and a later drain finishes it', () => {
  bond.resetForTests();
  const queued = bond.dispatch({ type: 'memory.write', payload: { key: 'later', value: 2 }, expected_schema: { ok: 'boolean' } }, {});
  assert.strictEqual(queued.queued, true);
  const drained = bond.drain({
    'memory.write': (task) => memory.remember(task.payload.key, task.payload.value),
  });
  assert.strictEqual(drained[0].ok, true);
  assert.strictEqual(memory.recall('later').value, 2);
});

check('three failures open the circuit and a slow file only proposes', () => {
  bond.resetForTests();
  const boom = () => { throw new Error('down'); };
  const third = bond.dispatch({ type: 'ping' }, { ping: boom });
  assert.strictEqual(third.escalated, true);
  const open = bond.dispatch({ type: 'ping' }, { ping: () => ({ ok: true }) });
  assert.strictEqual(open.degraded, true);
  assert.strictEqual(open.reason, 'circuit_open');
  const proposal = bond.propose();
  assert.strictEqual(proposal.applied, false);
  assert.strictEqual(proposal.requiresHuman, true);
  assert.strictEqual(proposal.inventsDeploys, false);
});

check('one hundred tasks finish and the kernel can register the bond', () => {
  bond.resetForTests();
  for (let i = 0; i < 100; i++) {
    const out = bond.dispatch({
      type: 'noop',
      payload: { i },
      expected_schema: { ok: 'boolean' },
    }, {
      noop: (task) => ({ ok: task.payload.i === i }),
    });
    assert.strictEqual(out.ok, true);
  }
  const census = require('../backend/modules/module-census-os');
  const health = bond.healthOf(census);
  assert.strictEqual(health.status, 'ok');
  assert.strictEqual(typeof health.latency_ms, 'number');
  assert.strictEqual(health.deps_ok, true);
  process.env.UNICORN_RUNTIME_PROFILE = 'stable';
  const iak = require('../backend/modules/integrated-autonomy-kernel');
  const attached = bond.attach(iak);
  assert.strictEqual(attached.ok, true);
  const status = iak.getStatus();
  assert.strictEqual(status.id, 'IAK/1.1');
});

check('committed map matches the builder protocol', () => {
  const file = path.join(__dirname, '..', 'SYSTEM_MAP.json');
  const md = fs.readFileSync(path.join(__dirname, '..', 'SYSTEM_MAP.md'), 'utf8');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(json.protocol, 'EBO/1.0');
  assert.strictEqual(json.executedModules, false);
  assert.ok(md.includes('orphaned files'));
  assert.ok(md.includes('IAK/1.1'));
});

console.log('ecosystem-bond: ' + passed + ' checks passed');
process.exit(0);
