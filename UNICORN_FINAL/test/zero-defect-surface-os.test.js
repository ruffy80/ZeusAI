/**
 * zero-defect-surface-os.test.js
 * Permanent CI gate for routing overmatches, dishonest commerce copy, and PQ requires.
 */
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zdos = require('../backend/modules/zero-defect-surface-os');

const ROOT = path.join(__dirname, '..');

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

check('ZDOS module exports audit + status', () => {
  assert.strictEqual(zdos.PROTOCOL, 'ZDOS/1.0');
  assert.strictEqual(typeof zdos.runAudit, 'function');
  assert.strictEqual(typeof zdos.getStatus, 'function');
});

check('live tree passes Zero-Defect Surface audit', () => {
  const report = zdos.runAudit();
  if (!report.ok) {
    console.error(JSON.stringify(report.findings, null, 2));
  }
  assert.strictEqual(report.ok, true, 'ZDOS findings must be empty');
  assert.strictEqual(report.grade, 'S');
});

check('nginx forbids broad carbon/outcome prefixes and requires exact + v100', () => {
  const conf = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  assert.ok(!/location\s+\^~\s+\/api\/carbon\//.test(conf));
  assert.ok(!/location\s+\^~\s+\/api\/outcome\//.test(conf));
  assert.ok(/location\s+=\s+\/api\/carbon\/cart/.test(conf));
  assert.ok(/location\s+=\s+\/api\/outcome\/list/.test(conf));
  assert.ok(/location\s+\^~\s+\/api\/v100\//.test(conf));
});

check('JSON-LD pricing FAQ no longer claims automatic refund clawback', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
  assert.ok(!/SLA breach\s*→\s*automatic refund/i.test(shell));
  assert.ok(shell.includes('REFUND_INTENT') || shell.includes('owner-settled'));
});

check('PQ ml-dsa require uses .js export path', () => {
  const pq = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'innovations-50y', 'crypto-agility.js'), 'utf8');
  assert.ok(pq.includes("@noble/post-quantum/ml-dsa.js"));
  assert.ok(!/require\(['"]@noble\/post-quantum\/ml-dsa['"]\)/.test(pq));
  // Runtime smoke: export resolves.
  assert.doesNotThrow(() => require('@noble/post-quantum/ml-dsa.js'));
});

check('frontier carbonEstimate works without orderId', () => {
  const frontier = require('../src/frontier-engine');
  const est = frontier.carbonEstimate(100);
  assert.ok(est && est.ok === true);
  assert.strictEqual(est.mode, 'estimate');
  assert.ok(est.grams > 0);
  assert.ok(est.signature);
});

check('CFO + competitor spy status are honesty-labelled as simulated', () => {
  const cfo = require('../backend/modules/ai-cfo-agent');
  const spy = require('../backend/modules/competitor-spy-agent');
  assert.strictEqual(cfo.getStatus().simulated, true);
  assert.strictEqual(spy.getStatus().simulated, true);
});

console.log(`✅ zero-defect-surface-os: ${passed} tests passed`);
process.exit(0);
