'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const desk = require('../src/commerce/delivery-contract-os');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('the status vocabulary cannot mark an untested stage as PASS', () => {
  assert.deepStrictEqual(desk.STATUSES.slice(), [
    'PASS', 'FAIL', 'BLOCKED', 'NOT_IMPLEMENTED', 'CONTRACT_UNDEFINED', 'NOT_TESTED',
  ]);
  assert.strictEqual(desk.rollup([
    desk.stage('contract', 'PASS', 'defined'),
    desk.stage('chain_payment', 'NOT_TESTED', 'no chain'),
  ]), 'NOT_TESTED');
  assert.strictEqual(desk.rollup([
    desk.stage('promise_matches_file', 'FAIL', 'mismatch'),
    desk.stage('chain_payment', 'NOT_TESTED', 'no chain'),
  ]), 'FAIL');
  assert.strictEqual(desk.rollup([
    desk.stage('a', 'PASS', ''),
    desk.stage('b', 'PASS', ''),
  ]), 'PASS');
});

check('every census file is counted and no offer is production-ready without a chain test', () => {
  const report = desk.report();
  assert.strictEqual(report.protocol, 'DCO/1.0');
  assert.strictEqual(report.inventsDelivery, false);
  assert.strictEqual(report.inventsMetrics, false);
  assert.ok(report.inventory.files > 600);
  assert.strictEqual(report.inventory.organStatus, 'NOT_TESTED');
  assert.strictEqual(report.inventory.absent, 0);
  assert.ok(report.offers > 0);
  assert.deepStrictEqual(report.productionReady, []);
  const audit = report.rows.find((row) => row.id === 'instant-website-audit');
  assert.ok(audit, 'audit offer missing');
  assert.strictEqual(audit.price, null);
  assert.ok(audit.promise.includes('Markdown'));
  assert.ok(audit.stages.some((row) => row.id === 'chain_payment' && row.status === 'NOT_TESTED'));
  assert.ok(audit.stages.some((row) => row.id === 'model_output' && (row.status === 'BLOCKED' || row.status === 'NOT_TESTED')));
  assert.notStrictEqual(audit.status, 'PASS');
  assert.ok(report.doNotAdvertiseAsFullyOperational.includes('instant-website-audit'));
  const sum = desk.STATUSES.reduce((total, name) => total + report.counts[name], 0);
  assert.strictEqual(sum, report.offers);
});

check('a drill does not grant a license', () => {
  const sales = require('../backend/modules/salesOrchestrator');
  const out = sales.handlePaid({
    id: 'drill-not-a-sale',
    status: 'paid',
    txid: 'simulated-test',
    service: 'instant-website-audit',
  });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.granted, false);
  assert.strictEqual(out.error, 'drill_not_a_sale');
});

check('the site and the backend publish the desk', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src/site/v2/shell.js'), 'utf8');
  const site = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
  assert.ok(shell.includes("case '/delivery-contracts'"));
  assert.ok(shell.includes("path === '/delivery-contracts'"));
  assert.ok(site.includes("'/delivery-contracts'"));
  assert.ok(site.includes("urlPath === '/api/delivery-contracts'"));
  assert.ok(backend.includes("app.get('/api/delivery-contracts'"));
  assert.ok(backend.includes('if (drill) return;'));
  const html = require('../src/site/v2/shell').getHtml('/delivery-contracts');
  assert.ok(html.includes('noindex, nofollow'));
  assert.ok(html.includes('instant-website-audit'));
  assert.ok(!html.includes('$44'));
});

console.log('✅ delivery-contract-os: ' + passed + ' tests passed');
