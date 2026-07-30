'use strict';

/**
 * merchant-trust-standard.test.js — MTS/1.0
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.MTS_HMAC_SECRET = 'mts-unit-test-secret';
process.env.IMMORTALITY_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'mts-icp-' + process.pid
);

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('MTS builds signed envelope with honesty + commerceReady', () => {
  const mts = require('../backend/modules/merchant-trust-standard');
  const env = mts.buildEnvelope();
  assert.equal(env.protocol, 'MTS/1.0');
  assert.equal(env.honesty.inventsGmv, false);
  assert.equal(env.honesty.inventsUptime, false);
  assert.equal(env.honesty.inventsPaymentRails, false);
  assert.ok(env.hash);
  assert.ok(env.signature && env.signature.signature);
  assert.ok(env.buyableFloor);
  assert.ok(env.buyableFloor.btcSelfServeCount >= 1);
  assert.equal(env.commerceReady, true);
  assert.ok(env.paths && env.paths.buy === '/buy');
  assert.ok(env.merchant && env.merchant.btcWallet);
});

check('mountRoutes registers merchant discovery', () => {
  const mts = require('../backend/modules/merchant-trust-standard');
  const routes = [];
  const app = { get: (p) => routes.push(['GET', p]), post: (p) => routes.push(['POST', p]) };
  assert.equal(mts.mountRoutes(app).ok, true);
  assert.ok(routes.some((r) => r[1] === '/api/merchant/standard'));
  assert.ok(routes.some((r) => r[1] === '/.well-known/merchant.json'));
});

check('SUBOS cold probes grade P (pending) not F', () => {
  const subos = require('../backend/modules/site-unicorn-bond-os');
  const cold = { ok: false, code: 0, latencyMs: 0, body: null, error: 'cold' };
  const st = subos.composeStatus(cold, cold, 'http://s', 'http://u');
  assert.equal(st.pending, true);
  assert.equal(st.grade, 'P');
  assert.equal(st.bonded, false);
});

check('site wires /standard + nginx merchant exact match', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
  assert.ok(shell.includes("case '/standard'"));
  assert.ok(shell.includes('merchant-standard-surface'));
  assert.ok(shell.includes('href="/standard"'));
  const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  assert.ok(indexJs.includes("'/standard'"));
  assert.ok(indexJs.includes('/.well-known/merchant.json'));
  assert.ok(indexJs.includes('/api/merchant/standard'));
  const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  assert.ok(nginx.includes('location = /.well-known/merchant.json'));
  const page = require('../src/site/v2/merchant-standard-surface').pageStandard();
  assert.ok(page.includes('Merchant Trust Standard'));
  assert.ok(page.includes('data-live-inspect="/.well-known/merchant.json"'));
  assert.ok(!/textContent\s*=\s*JSON\.stringify/.test(page));
});

check('Node compat matrix forever-policy: no required Node 20', () => {
  const wf = fs.readFileSync(path.join(ROOT, '..', '.github', 'workflows', 'node-compatibility.yml'), 'utf8');
  assert.ok(wf.includes('node: [22, 24]'));
  assert.ok(!/node:\s*\[20/.test(wf));
  assert.ok(wf.includes('npm ci attempt'));
  assert.ok(wf.includes('build-essential'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(String(pkg.engines.node).includes('>=22'));
  const nvm = fs.readFileSync(path.join(ROOT, '..', '.nvmrc'), 'utf8').trim();
  assert.equal(nvm, '22');
});

check('backend boots MTS + bond warm on listen', () => {
  const backend = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  assert.ok(backend.includes('merchant-trust-standard'));
  assert.ok(backend.includes('senseAsync'));
  assert.ok(backend.includes('Bond Boot Accelerator') || backend.includes('warm SUBOS'));
});

console.log(`✅ merchant-trust-standard: ${passed} tests passed`);
