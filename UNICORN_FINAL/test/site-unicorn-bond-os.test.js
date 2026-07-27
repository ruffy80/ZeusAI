'use strict';
/**
 * site-unicorn-bond-os.test.js — Site↔Unicorn Bond OS (SUBOS/1.0)
 * Integrated Autonomy Kernel: both peers must breathe.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
delete process.env.SUBOS_FORCE_LIVE;

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'site-unicorn-bond-os.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const NAOS = path.join(ROOT, 'backend', 'modules', 'neural-autonomy-os.js');
const TAOS = path.join(ROOT, 'backend', 'modules', 'totalAutonomyOs.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('  ✓', name);
  passed += 1;
}

console.log('Site↔Unicorn Bond OS');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD), 'site-unicorn-bond-os.js missing');
});

const bond = require(MOD);

check('exports protocol + getStatus/getScore/sense', () => {
  assert.strictEqual(bond.PROTOCOL, 'SUBOS/1.0');
  assert.strictEqual(typeof bond.getStatus, 'function');
  assert.strictEqual(typeof bond.getScore, 'function');
  assert.strictEqual(typeof bond.sense, 'function');
  assert.strictEqual(typeof bond.senseAsync, 'function');
  assert.strictEqual(typeof bond.composeStatus, 'function');
});

check('synthetic test status is bonded under stable', () => {
  const st = bond.getStatus();
  assert.strictEqual(st.protocol, 'SUBOS/1.0');
  assert.strictEqual(st.bonded, true);
  assert.strictEqual(st.ok, true);
  assert.ok(st.score >= 80 && st.score <= 100);
  assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(st.grade));
  assert.strictEqual(st.stableIdleOk, true);
  assert.ok(Array.isArray(st.pillars) && st.pillars.length >= 3);
  assert.ok(st.innovations.includes('dual_peer_heartbeat_bond'));
});

check('composeStatus detects split brain when site dark', () => {
  const st = bond.composeStatus(
    { ok: false, code: 0, latencyMs: 5, body: null, error: 'timeout' },
    { ok: true, code: 200, latencyMs: 3, body: { ok: true, status: 'ok' }, error: null },
    'http://127.0.0.1:3001/health',
    'http://127.0.0.1:3000/api/health'
  );
  assert.strictEqual(st.bonded, false);
  assert.ok(st.score < 70);
  assert.ok(st.softHeal && st.softHeal.action === 'reprobe_peers');
});

check('getScore is compact', () => {
  const s = bond.getScore();
  assert.strictEqual(s.protocol, 'SUBOS/1.0');
  assert.ok(typeof s.score === 'number');
  assert.ok(s.grade);
  assert.strictEqual(typeof s.bonded, 'boolean');
});

check('source forbids process.exit / pm2 / armSafe', () => {
  const raw = fs.readFileSync(MOD, 'utf8');
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
  assert.ok(!/\bprocess\.exit\s*\(/.test(src));
  assert.ok(!/\bpm2\s/i.test(src) && !/\bpm2\./i.test(src));
  assert.ok(!/\barmSafe\s*\(/.test(src));
  assert.ok(/observe/i.test(raw));
});

check('backend wires bond routes + health envelope', () => {
  const idx = fs.readFileSync(BACKEND_INDEX, 'utf8');
  assert.ok(idx.includes("require('./modules/site-unicorn-bond-os')"));
  assert.ok(idx.includes('/api/autonomy/bond'));
  assert.ok(idx.includes('autonomy-bond.json'));
  assert.ok(idx.includes('siteBond:'));
  assert.ok(idx.includes('neuralAutonomy:'));
});

check('site proxies + local fallback + health siteBond', () => {
  const src = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(src.includes('/api/autonomy/bond'));
  assert.ok(src.includes('site-unicorn-bond-os'));
  assert.ok(src.includes('autonomy_bond') || src.includes('autonomy-bond.json'));
  assert.ok(src.includes('siteBond:'));
});

check('status page renders Site↔Unicorn Bond panel', () => {
  const src = fs.readFileSync(SHELL, 'utf8');
  assert.ok(src.includes('subosPanel'));
  assert.ok(src.includes('loadSiteBond'));
  assert.ok(src.includes('/api/autonomy/bond'));
});

check('NAOS includes site_bond organ', () => {
  const src = fs.readFileSync(NAOS, 'utf8');
  assert.ok(src.includes('senseSiteBond') || src.includes('site_bond'));
  assert.ok(src.includes('site-unicorn-bond-os'));
});

check('TAOS includes site_bond pillar', () => {
  const src = fs.readFileSync(TAOS, 'utf8');
  assert.ok(src.includes("site_bond") || src.includes('site-unicorn-bond-os'));
});

check('nginx self-heal allowlists autonomy-bond.json', () => {
  const patch = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
  assert.ok(patch.includes('location = /.well-known/autonomy-bond.json'));
  const snippet = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-public-discovery.snippet.conf'), 'utf8');
  assert.ok(snippet.includes('location = /.well-known/autonomy-bond.json'));
});

console.log(`\n✅ site-unicorn-bond-os: ${passed} tests passed`);
process.exit(0);
