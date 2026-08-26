'use strict';

/**
 * autonomous-global-dominance.test.js — WGC/1.0 / AGDE
 * Honest gravity continuum: sense→score→dispatch existing organs only.
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.AGDE_DISABLED = '1';
process.env.AACOS_DISABLED = '1';
process.env.TAOS_DISABLED = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'autonomousGlobalDominanceEngine.js');
const INDEX = path.join(ROOT, 'backend', 'index.js');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Autonomous Global Dominance Engine (WGC/1.0)');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD));
});

const agde = require(MOD);

check('exports protocol + lifecycle', () => {
  assert.equal(agde.PROTOCOL, 'WGC/1.0');
  assert.equal(agde.INVENTION, 'World Gravity Continuum');
  assert.equal(typeof agde.start, 'function');
  assert.equal(typeof agde.tick, 'function');
  assert.equal(typeof agde.getStatus, 'function');
  assert.equal(typeof agde.mountRoutes, 'function');
});

check('sense + score never invent viral reach', () => {
  const snap = agde.sense();
  assert.ok(snap && typeof snap === 'object');
  assert.ok(!('viralReach' in snap) || snap.viralReach == null);
  const scored = agde.scoreGravity(snap);
  assert.ok(scored.gravity >= 0 && scored.gravity <= 100);
  assert.ok(['attention', 'trust', 'distribution', 'conversion'].includes(scored.bottleneck));
  assert.ok(scored.stages.attention && scored.stages.conversion);
});

check('start + tick dispatches existing organs only (no HTML mutation)', async () => {
  agde.start({ force: true });
  const out = await agde.tick({ force: true, source: 'test' });
  assert.equal(out.ok, true);
  assert.ok(out.gravity != null);
  assert.ok(out.bottleneck);
  if (out.dispatch && out.dispatch.actions) {
    const organs = out.dispatch.actions.map((a) => a.organ);
    for (const o of organs) {
      assert.ok(
        /^(traffic-engine|growth-brain|seo-optimizer|aacos|pre-keys-activation|serpapi)$/.test(o),
        'unexpected organ ' + o
      );
    }
  }
  const st = agde.getStatus();
  assert.equal(st.honesty.neverMutatesHtml, true);
  assert.equal(st.honesty.neverInventsViralReach, true);
  agde.stop();
});

check('backend wires AGDE start + routes + mesh', () => {
  const src = fs.readFileSync(INDEX, 'utf8');
  assert.ok(src.includes("require('./modules/autonomousGlobalDominanceEngine')"));
  assert.ok(src.includes('mountRoutes(app'));
  assert.ok(src.includes("register('autonomousGlobalDominanceEngine'"));
  assert.ok(src.includes('AGDE') || src.includes('World Gravity'));
  const mod = fs.readFileSync(MOD, 'utf8');
  assert.ok(mod.includes('/api/agde/status'));
  assert.ok(mod.includes('/.well-known/agde.json'));
});

check('draft anti-patterns are absent (no client HTML rewrite / fake reach)', () => {
  const src = fs.readFileSync(MOD, 'utf8');
  assert.ok(!/require\(['"]node-cron['"]\)/.test(src), 'must not require cron package');
  assert.ok(!src.includes('client/public/index.html'));
  assert.ok(!src.includes('writeFileSync(indexHtmlPath'));
  assert.ok(!/viralReach\s*\+=/.test(src));
  assert.ok(!src.includes('competitor1.com'));
});

check('TAOS armSafe includes AGDE', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend/modules/totalAutonomyOs.js'), 'utf8');
  assert.ok(src.includes("tryStart('autonomousGlobalDominanceEngine'"));
  assert.ok(src.includes("this._pillar('agde'"));
});

console.log(`\n✅ autonomous-global-dominance: ${passed} tests passed`);
process.exit(0);
