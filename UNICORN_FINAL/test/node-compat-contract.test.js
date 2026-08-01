'use strict';

/**
 * Forever Node compatibility contract.
 * Fails CI when engines / .nvmrc / workflow matrix drift, or when stale
 * checkout QR assertions would red-fail the Node Compatibility Matrix
 * (misreported as "Node 22/24 compatibility" even though Node is fine).
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
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

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
const nvmrcUf = fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
const nvmrcRoot = fs.readFileSync(path.join(REPO, '.nvmrc'), 'utf8').trim();
const wf = fs.readFileSync(path.join(REPO, '.github/workflows/node-compatibility.yml'), 'utf8');
const honesty = fs.readFileSync(path.join(ROOT, 'test/payment-honesty.test.js'), 'utf8');
const sov = fs.readFileSync(path.join(ROOT, 'src/site/sovereign-commerce.js'), 'utf8');

check('runtime is Node 22+ (Active LTS floor)', () => {
  const major = Number(process.versions.node.split('.')[0]);
  assert.ok(major >= 22, 'expected Node >= 22, got ' + process.versions.node);
  assert.ok(major < 26, 'expected Node < 26, got ' + process.versions.node);
});

check('package engines align (UNICORN_FINAL + root)', () => {
  assert.strictEqual(pkg.engines && pkg.engines.node, '>=22 <26');
  assert.strictEqual(rootPkg.engines && rootPkg.engines.node, '>=22 <26');
  assert.ok(String(pkg.engines.npm || '').includes('10'));
});

check('.nvmrc pins Node 22 at repo + UNICORN_FINAL', () => {
  assert.strictEqual(nvmrcUf, '22');
  assert.strictEqual(nvmrcRoot, '22');
});

check('node-compatibility workflow matrix is 22 + 24 only', () => {
  assert.ok(/node:\s*\[22,\s*24\]/.test(wf) || /node:\s*\[\s*22\s*,\s*24\s*\]/.test(wf),
    'matrix must be node: [22, 24]');
  assert.ok(!/node:\s*\[[^\]]*20/.test(wf), 'Node 20 must stay removed (native rebuild flakes)');
  assert.ok(wf.includes('engines: ">=22 <26"') || wf.includes('>=22 <26'),
    'workflow docs must mention engines floor');
});

check('sovereign QR prefers /checkout/:id/qr.svg (site pin)', () => {
  assert.ok(sov.includes('/checkout/${orderId}/qr.svg'),
    'qr_url / img src must use /checkout/:id/qr.svg');
});

check('payment-honesty accepts preferred /checkout QR (not API-only)', () => {
  // Stale exclusive API assertions caused Node compat + Deploy to fail
  // after the durable QR path moved under ^~ /checkout/.
  assert.ok(honesty.includes('/checkout/${orderId}/qr.svg'),
    'payment-honesty must accept /checkout/${orderId}/qr.svg');
  const exclusiveApiOnly =
    /assert\.ok\(\s*sovSrc\.includes\("'\/api\/checkout\/' \+"\)\s*\|\|\s*sovSrc\.includes\('\/api\/checkout\/\$\{orderId\}\/qr\.svg'\)\s*,/.test(honesty);
  assert.ok(!exclusiveApiOnly,
    'payment-honesty must not require API-only QR path exclusively');
});

check('better-sqlite3 is in engines-compatible range', () => {
  const ver = String((pkg.dependencies && pkg.dependencies['better-sqlite3']) || '');
  assert.ok(ver, 'better-sqlite3 dependency required');
  // ^12.x ships Node 22/24 prebuilds; keep the floor documented.
  assert.ok(/\^?12\./.test(ver) || />=\s*12/.test(ver),
    'better-sqlite3 should stay on 12.x for Node 22/24 prebuilds, got ' + ver);
});

check('Compat Truth Preflight is wired (CTOS forever — no fake Node ABI reds)', () => {
  assert.ok(wf.includes('compat-truth-preflight.js'),
    'node-compatibility.yml must run scripts/compat-truth-preflight.js');
  assert.ok(wf.includes('Compat Truth Preflight') || wf.includes('CTOS'),
    'workflow step should be named Compat Truth / CTOS');
  const preflight = fs.readFileSync(path.join(ROOT, 'scripts/compat-truth-preflight.js'), 'utf8');
  assert.ok(preflight.includes('no-raw-json-cta-guard.test.js'),
    'CTOS must classify SITE_CTA_REGRESSION via no-raw-json-cta-guard');
  assert.ok(preflight.includes('SITE_CTA_REGRESSION'));
  assert.ok(preflight.includes('COMPAT_TRUTH'));
  assert.ok(preflight.includes('::error title=COMPAT_TRUTH'),
    'CTOS must emit GitHub Actions error annotations with class labels');
});

console.log('node-compat-contract.test.js: ' + passed + ' passed · node=' + process.versions.node);
process.exit(0);
