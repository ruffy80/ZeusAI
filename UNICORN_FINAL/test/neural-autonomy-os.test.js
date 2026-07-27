'use strict';
/**
 * neural-autonomy-os.test.js — Neural Autonomy OS (NAOS/1.0)
 * Composition plane over immortal organs; observe-only (never thrash).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.SELF_CONSTRUCTION_APPLY = '0';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'neural-autonomy-os.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const CLIENT = path.join(ROOT, 'src', 'site', 'v2', 'client.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');

let passed = 0;
function check(name, fn) {
  fn();
  console.log('  ✓', name);
  passed += 1;
}

console.log('Neural Autonomy OS');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD), 'neural-autonomy-os.js missing');
});

const naos = require(MOD);

check('exports protocol + getStatus/getScore/sense', () => {
  assert.strictEqual(naos.PROTOCOL, 'NAOS/1.0');
  assert.strictEqual(typeof naos.getStatus, 'function');
  assert.strictEqual(typeof naos.getScore, 'function');
  assert.strictEqual(typeof naos.sense, 'function');
  assert.strictEqual(typeof naos.composeOrgans, 'function');
});

check('getStatus score 0..100 with organs + innovations', () => {
  const st = naos.getStatus();
  assert.strictEqual(st.protocol, 'NAOS/1.0');
  assert.ok(typeof st.score === 'number');
  assert.ok(st.score >= 0 && st.score <= 100);
  assert.ok(['S', 'A', 'B', 'C', 'D', 'F'].includes(st.grade));
  assert.ok(Array.isArray(st.organs) && st.organs.length >= 6);
  assert.ok(Array.isArray(st.innovations) && st.innovations.includes('organ_continuum_map'));
  assert.ok(st.continuum && typeof st.continuum.live === 'number');
  assert.ok(st.doctrine && typeof st.doctrine === 'object');
});

check('stable + DISABLE_SELF_MUTATION ⇒ stableIdleOk', () => {
  const st = naos.getStatus();
  assert.strictEqual(st.stableIdleOk, true, JSON.stringify({ profile: st.profile, stableIdleOk: st.stableIdleOk }));
});

check('organs include buy/boot/fulfillment/taos/never_down', () => {
  const st = naos.getStatus();
  const ids = st.organs.map((o) => o.id);
  for (const need of ['buy_immortal', 'boot_immortal', 'fulfillment_ai', 'taos', 'never_down', 'mutator_safety', 'site_bond', 'triad_bond']) {
    assert.ok(ids.includes(need), `missing organ ${need}`);
  }
});

check('getScore is compact', () => {
  const s = naos.getScore();
  assert.strictEqual(s.protocol, 'NAOS/1.0');
  assert.ok(typeof s.score === 'number');
  assert.ok(s.grade);
  assert.ok(typeof s.stableIdleOk === 'boolean');
});

check('gradeFor boundaries', () => {
  assert.strictEqual(naos.gradeFor(95), 'S');
  assert.strictEqual(naos.gradeFor(82), 'A');
  assert.strictEqual(naos.gradeFor(70), 'B');
  assert.strictEqual(naos.gradeFor(55), 'C');
  assert.strictEqual(naos.gradeFor(40), 'D');
  assert.strictEqual(naos.gradeFor(10), 'F');
});

check('source forbids process.exit / pm2 / armSafe / mutator arming', () => {
  const raw = fs.readFileSync(MOD, 'utf8');
  // Strip block + line comments so doctrine docs may mention forbidden verbs.
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!/\bprocess\.exit\s*\(/.test(src), 'must not call process.exit');
  assert.ok(!/\bpm2\b/i.test(src), 'must not reference pm2');
  assert.ok(!/\barmSafe\s*\(/.test(src), 'must not call armSafe');
  assert.ok(!/ENABLE_FILE_MUTATORS\s*=\s*['"]1['"]/.test(src), 'must not arm file mutators');
  assert.ok(/observe/i.test(raw), 'must document observe-only');
});

check('backend wires NAOS routes', () => {
  const idx = fs.readFileSync(BACKEND_INDEX, 'utf8');
  assert.ok(idx.includes("require('./modules/neural-autonomy-os')"));
  assert.ok(idx.includes('/api/autonomy/neural'));
  assert.ok(idx.includes('/api/autonomy/neural/score'));
  assert.ok(idx.includes('neural-autonomy.json') || idx.includes('/.well-known/neural-autonomy.json'));
});

check('site proxies + local fallback for NAOS', () => {
  const src = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(src.includes('/api/autonomy/neural'));
  assert.ok(src.includes('/api/autonomy/neural/score'));
  assert.ok(src.includes('neural-autonomy-os'));
  assert.ok(src.includes('neural_autonomy') || src.includes('neural-autonomy.json'));
});

check('status page renders Neural Autonomy OS panel', () => {
  const src = fs.readFileSync(SHELL, 'utf8');
  assert.ok(src.includes('naosPanel'));
  assert.ok(src.includes('Neural Autonomy OS'));
  assert.ok(src.includes('loadNeuralOs'));
  assert.ok(src.includes('/api/autonomy/neural'));
});

check('client hydrates autonomy from neural score with TAOS fallback', () => {
  const src = fs.readFileSync(CLIENT, 'utf8');
  assert.ok(src.includes('/api/autonomy/neural/score'));
  assert.ok(src.includes('statTaos'));
  assert.ok(src.includes('/api/autonomy/score'));
});

check('nginx discovery allowlists neural-autonomy.json', () => {
  const snippet = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-public-discovery.snippet.conf'), 'utf8');
  assert.ok(snippet.includes('location = /.well-known/neural-autonomy.json'));
  const patch = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
  assert.ok(patch.includes('location = /.well-known/neural-autonomy.json'));
  assert.ok(patch.includes('_MINIMAL_SNIPPET') || patch.includes('_install_snippet'), 'collision-safe installer required');
  assert.ok(patch.includes('collision') || patch.includes('/api/eop'), 'must document /api/eop collision avoidance');
});

console.log(`\n✅ neural-autonomy-os: ${passed} tests passed`);
process.exit(0);
