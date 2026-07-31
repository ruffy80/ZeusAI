'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
}

async function main() {
  const tep = require('../backend/modules/total-ecosystem-perfection-os');
  const pool = require('../backend/modules/adaptiveEnginePool');

  await check('AdaptiveModule01–82 and Engine1–62 materialize + load', () => {
    const mat = pool.materializeShims();
    assert.equal(mat.ok, true);
    const dir = path.join(__dirname, '../backend/modules');
    const adaptive = fs.readdirSync(dir).filter((f) => /^AdaptiveModule\d+\.js$/.test(f));
    const engines = fs.readdirSync(dir).filter((f) => /^Engine\d+\.js$/.test(f));
    assert.ok(adaptive.length >= 82, 'adaptive ' + adaptive.length);
    assert.ok(engines.length >= 62, 'engines ' + engines.length);
    const a = require('../backend/modules/AdaptiveModule01');
    const e = require('../backend/modules/Engine62');
    assert.equal(a.getStatus().module, 'AdaptiveModule01');
    assert.equal(e.getStatus().module, 'Engine62');
  });

  await check('TEP start reports 200+ modules and essential surface', () => {
    const s = tep.start();
    assert.equal(s.protocol, 'TEP/1.0');
    assert.ok(s.modulesDirCount >= 200, 'modules ' + s.modulesDirCount);
    assert.ok(s.over200);
    assert.equal(s.adaptiveShimCount >= 82, true);
    assert.equal(s.engineShimCount >= 62, true);
    assert.ok(s.essentialPresent >= 30, 'essential ' + s.essentialPresent);
  });

  await check('pool startAll arms workers', () => {
    const r = pool.startAll();
    assert.ok(r.started >= 140);
    assert.equal(pool.getWorker('AdaptiveModule10').getStatus().running, true);
  });

  await check('frontend ESIM + Payment + App routes', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '../client/src/pages/ESIM.jsx')));
    assert.ok(fs.existsSync(path.join(__dirname, '../client/src/pages/Payment.jsx')));
    const app = fs.readFileSync(path.join(__dirname, '../client/src/App.js'), 'utf8');
    assert.ok(app.includes('path="/esim"') && app.includes('<ESIM'));
    assert.ok(app.includes('path="/payment"'));
    assert.ok(app.includes('path="/generator"'));
  });

  await check('index wires TEP boot', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(src.includes('total-ecosystem-perfection-os'));
    assert.ok(src.includes('totalEcosystemPerfectionOs.start'));
  });

  await check('workflows are actionable', () => {
    const root = path.join(__dirname, '../..');
    const auto = fs.readFileSync(path.join(root, '.github/workflows/autonomous.yml'), 'utf8');
    assert.ok(auto.includes('npm run evolve'));
    assert.ok(auto.includes('npm run heal'));
    assert.ok(auto.includes('cron:'));
    const hetz = fs.readFileSync(path.join(root, '.github/workflows/deploy-hetzner.yml'), 'utf8');
    assert.ok(hetz.includes('deploy.yml'));
    assert.ok(fs.existsSync(path.join(root, 'scripts/setup-hetzner-auto.js')));
  });

  console.log(`✅ TEP/1.0: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
