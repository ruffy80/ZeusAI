'use strict';

/**
 * module-census-os.test.js — MCO/1.0
 * Every module file is sheeted. Incomplete registry names are bound or refused.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

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

console.log('Module Census OS (MCO/1.0)');

const census = require('../backend/modules/module-census-os');
census.clearCache();
const d = census.discovery();

check('census lists every file and invents nothing', () => {
  assert.strictEqual(d.protocol, 'MCO/1.0');
  assert.strictEqual(d.inventsModules, false);
  assert.strictEqual(d.inventsRoles, false);
  assert.ok(d.files > 600);
  assert.strictEqual(d.absent, 0);
  assert.strictEqual(d.refused, 5);
  assert.ok(d.virtualWorkers >= 144);
  assert.ok(d.aliases >= 20);
});

check('refused names have no file and a reason', () => {
  const row = census.find('QuantumInternetProtocol');
  assert.ok(row);
  assert.strictEqual(row.kind, 'refused');
  assert.ok(row.reason.length > 10);
  assert.strictEqual(fs.existsSync(path.join(ROOT, 'backend/modules/QuantumInternetProtocol.js')), false);
});

check('registry aliases point at existing implementations', () => {
  const uaic = census.find('unicorn-uaic');
  assert.strictEqual(uaic.kind, 'alias');
  assert.ok(String(uaic.aliasOf).includes('universalAIConnector'));
  const shim = read('backend/modules/unicorn-uaic.js');
  assert.ok(shim.includes("require('./universalAIConnector')"));
  const zdt = read('backend/modules/zero-downtime-controller.js');
  assert.ok(zdt.includes('zero-downtime-controller'));
});

check('new organs remember, rank, count, and refuse invented proof', () => {
  const memory = require('../backend/modules/usi-memory');
  assert.strictEqual(memory.remember('origin', 1).ok, true);
  assert.strictEqual(memory.recall('origin').value, 1);
  assert.strictEqual(memory.getStatus().inventsMemory, false);
  const reason = require('../backend/modules/usi-reasoning');
  const ranked = reason.rank(['a', 'longer']);
  assert.strictEqual(ranked.inventsCertainty, false);
  assert.strictEqual(ranked.ranked[0].text, 'longer');
  const skills = require('../backend/modules/usi-skills');
  const sum = skills.invoke('checksum', { n: 2 });
  assert.strictEqual(sum.ok, true);
  assert.ok(sum.result.checksum);
  const persona = require('../backend/modules/usi-personality');
  assert.strictEqual(persona.getStatus().policy.inventsCustomers, false);
  assert.strictEqual(persona.process().answered, false);
  const demand = require('../backend/modules/unicorn-vertical-demand-engine');
  assert.strictEqual(demand.record('not-a-vertical').ok, false);
  assert.strictEqual(demand.record('fintech').inquiries, 1);
  assert.strictEqual(demand.getStatus().inventsDemand, false);
  const proof = require('../backend/modules/unicorn-case-study-proof-engine');
  const cases = proof.list();
  assert.strictEqual(cases.inventsCases, false);
  assert.ok(Array.isArray(cases.cases));
});

check('capability router resolves a real file', () => {
  const router = require('../backend/modules/unicorn-capability-router');
  const hit = router.resolve('usi-memory');
  assert.strictEqual(hit.found, true);
  assert.strictEqual(hit.kind, 'file');
  const miss = router.resolve('QuantumInternetProtocol');
  assert.strictEqual(miss.found, true);
  assert.strictEqual(miss.kind, 'refused');
});

check('pool workers return a real checksum', () => {
  const pool = require('../backend/modules/adaptiveEnginePool');
  const out = pool.invoke('EnginePool#1');
  assert.strictEqual(out.ok, true);
  assert.equal(typeof out.checksum, 'string');
  assert.ok(out.checksum.length >= 8);
});

check('site and API publish the census', () => {
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes("case '/module-census'"));
  assert.ok(shell.includes('pageModules'));
  const site = read('src/index.js');
  assert.ok(site.includes("'/module-census'"));
  assert.ok(site.includes('/.well-known/module-census.json'));
  const boot = read('backend/index.js');
  assert.ok(boot.includes('/api/module-census'));
  assert.ok(!boot.includes('total * 0.15'));
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('module-census-os.test.js'));
});

console.log('\n✅ module-census-os: ' + passed + ' tests passed');
