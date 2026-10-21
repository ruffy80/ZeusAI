'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const edge = require('../src/security/request-edge');
const ROOT = path.join(__dirname, '..');

const queue = [];
function check(name, fn) {
  queue.push({ name, fn });
}

check('shelf paths stay open and foreign runtimes are refused', () => {
  edge.resetForTests();
  const open = [
    '/pricing',
    '/sitemap.xml',
    '/assets/app.js',
    '/guides/instant-resume-makeover',
    '/google4757746388248111.html',
    '/api/health',
    '/pricing?x=shell.php',
  ];
  for (const item of open) assert.strictEqual(edge.classify(item), null, item);

  assert.strictEqual(edge.classify('/index.php'), 'php');
  assert.strictEqual(edge.classify('/wp-login.php'), 'php');
  assert.strictEqual(edge.classify('/xmlrpc.php'), 'php');
  assert.strictEqual(edge.classify('/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php'), 'php');
  assert.strictEqual(edge.classify('/shell.php.jpg'), 'php');
  assert.strictEqual(edge.classify('/foo.php/bar'), 'php');
  assert.strictEqual(edge.classify('/%69ndex.php'), 'php');
  assert.strictEqual(edge.classify('/index.php%00.html'), 'php');
  assert.strictEqual(edge.classify('/old.phtml'), 'php');
  assert.strictEqual(edge.classify('/old.phar'), 'php');
  assert.strictEqual(edge.classify('/legacy.asp'), 'asp');
  assert.strictEqual(edge.classify('/legacy.aspx'), 'asp');
  assert.strictEqual(edge.classify('/legacy.jsp'), 'jsp');
  assert.strictEqual(edge.classify('/legacy.cgi'), 'cgi');
  assert.strictEqual(edge.classify('/.env'), 'sensitive');
  assert.strictEqual(edge.classify('/%252eenv'), 'sensitive');
  assert.strictEqual(edge.classify('/wp-config.php'), 'sensitive');
});

check('the counter keeps no path and no query', () => {
  edge.resetForTests();
  assert.strictEqual(edge.refused('/wp-login.php?cmd=id'), 'php');
  assert.strictEqual(edge.refused('/.git/config'), 'sensitive');
  const snap = edge.snapshot();
  const text = JSON.stringify(snap);
  assert.strictEqual(snap.php, 1);
  assert.strictEqual(snap.sensitive, 1);
  assert.strictEqual(snap.storesPaths, false);
  assert.strictEqual(snap.storesQuery, false);
  assert.ok(!text.includes('wp-login'));
  assert.ok(!text.includes('cmd'));
  const defense = require('../backend/modules/defenseModule');
  const reported = defense.edgeRefusal();
  assert.strictEqual(reported.php, 1);
  assert.strictEqual(reported.storesPaths, false);
  edge.resetForTests();
});

check('both servers and nginx refuse the same dead runtimes', () => {
  const backend = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
  const site = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  const snippet = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-public-discovery.snippet.conf'), 'utf8');
  const patch = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
  assert.ok(backend.includes("app.disable('x-powered-by')"));
  assert.ok(backend.includes('request-edge'));
  assert.ok(site.includes("app.disable('x-powered-by')"));
  assert.ok(site.includes('requestEdge.refused(earlyPath)'));
  assert.ok(snippet.includes('php[3-8]?'));
  assert.ok(snippet.includes('[a-z0-9]+'));
  assert.ok(snippet.includes('access_log off'));
  assert.ok(patch.includes('php[3-8]?'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const keys = Object.keys(pkg.scripts).filter((key) => key === 'test:chain');
  assert.strictEqual(keys.length, 1);
  assert.ok(pkg.scripts['test:chain'].includes('dead-runtime-gate.test.js'));
});

async function main() {
  let passed = 0;
  for (const t of queue) {
    await t.fn();
    passed += 1;
    console.log('  ✓', t.name);
  }
  console.log(`\n✅ dead-runtime-gate: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
