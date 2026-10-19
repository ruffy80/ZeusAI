'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const bond = require('../src/commerce/module-bond');

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

check('every declared join resolves to a real file', () => {
  const report = bond.audit();
  assert.strictEqual(report.protocol, 'MBD/1.0');
  assert.strictEqual(report.inventsServices, false);
  for (const edge of report.edges) {
    assert.strictEqual(edge.ok, true, edge.from + ' -> ' + edge.spec);
  }
  assert.strictEqual(report.ok, true);
});

check('the immortality protocol and the attestation chain use different relative paths to the same kernel', () => {
  const report = bond.audit();
  const icp = report.edges.find((edge) => edge.from.endsWith('immortality-continuum-protocol.js'));
  const cac = report.edges.find((edge) => edge.from.endsWith('continuity-attestation-chain.js'));
  assert.strictEqual(icp.spec, './never-down-kernel');
  assert.strictEqual(cac.spec, '../never-down-kernel');
});

console.log('module-bond: ' + passed + ' checks passed');
process.exit(0);
