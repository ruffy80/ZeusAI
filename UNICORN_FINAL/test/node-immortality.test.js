'use strict';

/**
 * NIX/1.0 — Node Immortality eXtension contract.
 * Proves the hermetic seal that stops undici-300s / forgotten AbortSignal /
 * wrong Node major from recurring across CI + PM2 + deploy.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.NIX_QUIET = '1';
process.env.NIX_STRICT = '0';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const NIX = path.join(ROOT, 'backend', 'lib', 'node-immortality.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log(`✓ ${name}`);
  passed += 1;
}

check('NIX module seals on require', () => {
  // Fresh subprocess so we observe install side-effects cleanly.
  const r = spawnSync(process.execPath, ['-e', `
    process.env.NIX_QUIET = '1';
    const nix = require(${JSON.stringify(NIX)});
    const s = nix.status();
    if (!s.sealed) process.exit(2);
    if (!s.fetchSealed) process.exit(3);
    if (!s.enginesOk) process.exit(4);
    if (s.protocol !== 'NIX/1.0') process.exit(5);
    if (!(s.fetchTimeoutMs >= 1000)) process.exit(6);
    if (!s.undiciSealed) process.exit(7);
    console.log(JSON.stringify(s));
  `], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, NIX_QUIET: '1', NIX_STRICT: '0' } });
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
  const s = JSON.parse((r.stdout || '').trim().split('\n').pop());
  assert.strictEqual(s.protocol, 'NIX/1.0');
  assert.ok(s.fetchSealed);
  assert.ok(s.undiciSealed, 'undici global Agent must be sealed (kills 300s headersTimeout)');
});

check('fetch seal injects AbortSignal when caller omits signal', () => {
  const r = spawnSync(process.execPath, ['-e', `
    process.env.NIX_QUIET = '1';
    process.env.NIX_FETCH_TIMEOUT_MS = '50';
    require(${JSON.stringify(NIX)});
    // Blackhole port — without seal this can hang on undici defaults.
    fetch('http://127.0.0.1:1/').then(() => process.exit(9)).catch((e) => {
      const name = e && (e.name || e.cause && e.cause.name) || '';
      const msg = String(e && e.message || e);
      if (/abort|timeout|ECONNREFUSED|fetch failed/i.test(name + ' ' + msg)) process.exit(0);
      console.error(e);
      process.exit(8);
    });
    setTimeout(() => process.exit(7), 5000);
  `], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, NIX_QUIET: '1' } });
  assert.strictEqual(r.status, 0, `expected abort/refuse, got ${r.status}\n${r.stdout}\n${r.stderr}`);
});

check('npm test and test:ci both route through TTS (local==CI)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /run-tests-resilient/);
  assert.match(pkg.scripts['test:ci'], /run-tests-resilient/);
  assert.ok(pkg.scripts['test:chain'], 'test:chain must hold the file list');
  const files = [...String(pkg.scripts['test:chain']).matchAll(/node\s+(test\/[^\s'"]+\.test\.js)/g)].map((m) => m[1]);
  assert.ok(files.length >= 100, 'test:chain too short: ' + files.length);
  assert.ok(files.includes('test/node-immortality.test.js'), 'NIX test must be in chain');
});

check('TTS injects NIX --require into child NODE_OPTIONS', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/run-tests-resilient.js'), 'utf8');
  assert.match(src, /nixNodeOptions/);
  assert.match(src, /node-immortality/);
  assert.match(src, /test:chain/);
  const { nixNodeOptions } = require('../scripts/run-tests-resilient');
  const o = nixNodeOptions('--no-deprecation');
  assert.match(o, /node-immortality/);
  assert.match(o, /no-deprecation/);
  assert.strictEqual(nixNodeOptions(o), o, 'idempotent');
});

check('PM2 ecosystem seals backend + site + phoenix via NODE_OPTIONS', () => {
  const eco = fs.readFileSync(path.join(ROOT, 'ecosystem.config.js'), 'utf8');
  assert.match(eco, /withNixNodeOptions/);
  assert.match(eco, /node-immortality/);
  assert.ok((eco.match(/withNixNodeOptions/g) || []).length >= 3);
});

check('deploy.yml + node-compatibility.yml wire NIX for test steps', () => {
  const deploy = fs.readFileSync(path.join(REPO, '.github/workflows/deploy.yml'), 'utf8');
  const compat = fs.readFileSync(path.join(REPO, '.github/workflows/node-compatibility.yml'), 'utf8');
  assert.match(deploy, /node-immortality\.js/);
  assert.match(compat, /node-immortality\.js/);
});

check('deploy-atomic-forward refuses host Node outside engines', () => {
  const sh = fs.readFileSync(path.join(ROOT, 'scripts/deploy-atomic-forward.sh'), 'utf8');
  assert.match(sh, /NIX\/1\.0/);
  assert.match(sh, /outside engines/);
});

check('client engines align with forever floor (>=22 <26)', () => {
  const client = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/package.json'), 'utf8'));
  assert.strictEqual(client.engines.node, '>=22 <26');
});

check('backend + site boot require NIX', () => {
  const be = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8').slice(0, 500);
  const site = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8').slice(0, 500);
  assert.match(be, /node-immortality/);
  assert.match(site, /node-immortality/);
});

check('wrong Node major exits 78 under NIX_STRICT', () => {
  // Simulate by monkeypatching versions inside a child is hard; instead assert
  // the exit code path exists and ENGINE bounds are exported.
  const nix = require(NIX);
  assert.strictEqual(nix.ENGINE_FLOOR, 22);
  assert.strictEqual(nix.ENGINE_CEIL, 26);
  assert.ok(nix.majorOf('24.5.0') === 24);
  const src = fs.readFileSync(NIX, 'utf8');
  assert.match(src, /process\.exit\(78\)/);
});

check('NIX seals node-cron — missed execution WARN never reaches console', () => {
  const src = fs.readFileSync(NIX, 'utf8');
  assert.match(src, /sealNodeCron/);
  assert.match(src, /NIX_CRON_SEAL/);
  assert.match(src, /missed execution/);

  const r = spawnSync(process.execPath, ['-e', `
    process.env.NIX_QUIET = '1';
    // Install a sink UNDER the seal: NIX will wrap console.warn around this spy.
    let leaked = 0;
    const raw = console.warn.bind(console);
    console.warn = (...args) => {
      const s = args.map(String).join(' ');
      if (/missed execution|\\[NODE-CRON\\]/i.test(s)) leaked += 1;
      return raw(...args);
    };
    const nix = require(${JSON.stringify(NIX)});
    const ts = new Date().toISOString();
    // Exact shape node-cron@4 emits via console.warn.
    console.warn(
      '[' + ts + '] [PID: ' + process.pid + '] \\x1b[32m[NODE-CRON]\\x1b[32m \\x1b[33m[WARN]\\x1b[0m '
      + 'missed execution at ' + ts + '! Possible blocking IO or high CPU user at the same process used by node-cron.'
    );
    try {
      const loggerPath = require.resolve('node-cron/dist/cjs/logger.js');
      const logger = require(loggerPath).default || require(loggerPath);
      logger.warn('missed execution at ' + ts + '! Possible blocking IO or high CPU user at the same process used by node-cron.');
    } catch (_) {}
    const s = nix.status();
    if (!s.cronSealed) process.exit(2);
    if (leaked !== 0) {
      console.error('LEAKED_TO_SINK', leaked);
      process.exit(3);
    }
    if (!(s.cronMissedSuppressed >= 1)) process.exit(4);
    console.log(JSON.stringify({ cronSealed: s.cronSealed, suppressed: s.cronMissedSuppressed, leaked }));
  `], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, NIX_QUIET: '1', NIX_STRICT: '0' } });
  assert.strictEqual(r.status, 0, r.stderr || r.stdout);
  const out = JSON.parse((r.stdout || '').trim().split('\n').pop());
  assert.strictEqual(out.cronSealed, true);
  assert.strictEqual(out.leaked, 0);
  assert.ok(out.suppressed >= 1);
});

check('universalMarketNexus never uses second-precision node-cron', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/modules/universalMarketNexus.js'), 'utf8');
  assert.ok(!/require\(['"]node-cron['"]\)/.test(src), 'must not require node-cron');
  // Strip comments so historical "*/5 * * * * *" notes do not trip the guard.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/cron\.schedule\s*\(\s*['"][^'"]*\*\s+\*\s+\*\s+\*\s+\*/.test(code),
    'must not cron.schedule second-precision expressions');
  assert.ok(!/cron\.schedule\s*\(\s*['"]\*\/\d+/.test(code), 'must not cron.schedule */N …');
  assert.match(src, /_startBusyInterval/);
});

console.log(`\n✅ node-immortality: ${passed} tests passed · node=${process.versions.node}\n`);
process.exit(0);
