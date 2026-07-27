'use strict';
/**
 * triad-bond-os.test.js — Triad Never-Down Bond OS (TBOS/1.0)
 * Site + Unicorn + Server edge must all breathe.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
delete process.env.TBOS_FORCE_LIVE;

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'triad-bond-os.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const NAOS = path.join(ROOT, 'backend', 'modules', 'neural-autonomy-os.js');
const ZAC = path.join(ROOT, 'backend', 'modules', 'zeusAutonomousCore', 'index.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('  ✓', name);
  passed += 1;
}

console.log('Triad Never-Down Bond OS');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD));
});

const triad = require(MOD);

check('exports protocol + getStatus/getScore/sense', () => {
  assert.strictEqual(triad.PROTOCOL, 'TBOS/1.0');
  assert.strictEqual(typeof triad.getStatus, 'function');
  assert.strictEqual(typeof triad.getScore, 'function');
  assert.strictEqual(typeof triad.senseAsync, 'function');
});

check('synthetic test status is triad-bonded under stable', () => {
  const st = triad.getStatus();
  assert.strictEqual(st.protocol, 'TBOS/1.0');
  assert.strictEqual(st.bonded, true);
  assert.strictEqual(st.ok, true);
  assert.ok(st.score >= 80);
  assert.strictEqual(st.stableIdleOk, true);
  assert.ok(st.peers.site.ok && st.peers.unicorn.ok && st.peers.server.ok);
  assert.ok(st.peers.server.foreverKeyOk);
  assert.ok(st.innovations.includes('triple_peer_never_down_bond'));
});

check('composeStatus fails when forever-key is 403', () => {
  const st = triad.composeStatus(
    { ok: true, code: 200, body: { ok: true, status: 'healthy' }, raw: '', error: null },
    { ok: true, code: 200, body: { ok: true, status: 'ok' }, raw: '', error: null },
    { ok: false, code: 403, raw: '<html>403</html>', body: null, error: 'http_403' },
    { ok: true, code: 200, body: { payload: { version: 'x' }, signature: 'y' }, raw: '', error: null },
    {
      site: 'http://127.0.0.1:3001/health',
      unicorn: 'http://127.0.0.1:3000/api/health',
      foreverKey: 'https://zeusai.pro/.well-known/zeusai-key.pub',
      integrity: 'https://zeusai.pro/integrity.json',
    }
  );
  assert.strictEqual(st.bonded, false);
  assert.ok(st.score < 90);
  assert.ok(st.softHeal && st.softHeal.action === 'nginx_append_forever_key_location');
});

check('source forbids process.exit / pm2 invoke / armSafe', () => {
  const raw = fs.readFileSync(MOD, 'utf8');
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
  assert.ok(!/\bprocess\.exit\s*\(/.test(src));
  assert.ok(!/\brequire\s*\(\s*['"]pm2['"]\s*\)/.test(src));
  assert.ok(!/\barmSafe\s*\(/.test(src));
  assert.ok(/observe/i.test(raw));
});

check('backend wires triad routes + health triadBond', () => {
  const idx = fs.readFileSync(BACKEND_INDEX, 'utf8');
  assert.ok(idx.includes("require('./modules/triad-bond-os')"));
  assert.ok(idx.includes('/api/autonomy/triad'));
  assert.ok(idx.includes('triad-bond.json'));
  assert.ok(idx.includes('triadBond:'));
});

check('site proxies + local fallback + degraded health honesty', () => {
  const src = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(src.includes('/api/autonomy/triad'));
  assert.ok(src.includes('triad-bond-os'));
  assert.ok(src.includes("status: backendOk ? 'healthy' : 'degraded'") || src.includes("degraded: !backendOk"));
  assert.ok(src.includes('triadBond:'));
});

check('status page renders Triad Never-Down panel', () => {
  const src = fs.readFileSync(SHELL, 'utf8');
  assert.ok(src.includes('tbosPanel'));
  assert.ok(src.includes('loadTriadBond'));
  assert.ok(src.includes('/api/autonomy/triad'));
});

check('NAOS includes triad_bond organ', () => {
  const src = fs.readFileSync(NAOS, 'utf8');
  assert.ok(src.includes('senseTriadBond') || src.includes('triad_bond'));
});

check('nginx self-heal requires forever-key + triad-bond', () => {
  const patch = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
  assert.ok(patch.includes('location = /.well-known/zeusai-key.pub'));
  assert.ok(patch.includes('location = /.well-known/triad-bond.json'));
  const deploy = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-local.sh'), 'utf8');
  assert.ok(deploy.includes('location = /.well-known/zeusai-key.pub'));
  const unicorn = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  assert.ok(unicorn.includes('location = /.well-known/zeusai-key.pub'));
});

check('ZAC healer observe-only under stable (no thrash)', () => {
  const src = fs.readFileSync(ZAC, 'utf8');
  assert.ok(src.includes('SELF_HEALER_AUTO_RESTART'));
  assert.ok(src.includes('autoRestart: SELF_HEALER_AUTO_RESTART'));
});

console.log(`\n✅ triad-bond-os: ${passed} tests passed`);
process.exit(0);
