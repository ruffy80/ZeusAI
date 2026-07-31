'use strict';

/**
 * continuum-harmony-os.test.js — CHO/1.0
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.OCC_TICK_MS = '60000';
process.env.CHO_TICK_MS = '60000';
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
  return undefined;
}

async function main() {
  const cho = require('../backend/modules/continuum-harmony-os');
  const emc = require('../backend/modules/essential-modules-continuum');
  const occ = require('../backend/modules/orchestrated-capability-continuum');

  const app = {
    __flags: {},
    get(p, h) {
      this.routes = this.routes || [];
      this.routes.push(['GET', p]);
    },
    post(p, h) {
      this.routes = this.routes || [];
      this.routes.push(['POST', p]);
    },
  };

  await check('CHO start arms OCC+EMC under stable', async () => {
    const s = cho.start({ app, stable: true });
    assert.equal(s.protocol, 'CHO/1.0');
    assert.equal(s.running, true);
    assert.equal(s.honesty.neverRestarts, true);
    // allow immediate tick
    await new Promise((r) => setTimeout(r, 50));
    const st = cho.getStatus();
    assert.ok(st.occ && st.occ.running, 'OCC should be running');
    assert.ok(st.emc && st.emc.running, 'EMC should be running');
  });

  await check('EMC reports intentional idle healer as ok', () => {
    const s = emc.getStatus();
    assert.equal(s.protocol, 'EMC/1.0');
    assert.ok(s.modules.healer, 'healer present');
    assert.equal(s.modules.healer.ok, true, 'healer idle under stable must be ok');
    assert.ok(s.okCount >= 17, `expected okCount>=17 got ${s.okCount}`);
  });

  await check('CHO tick produces soft plan without restart actions', async () => {
    const h = await cho.tick();
    assert.ok(h.ok || Array.isArray(h.conflicts));
    assert.ok(Array.isArray(h.softPlan));
    const blob = JSON.stringify(h);
    assert.ok(!/pm2 restart|process\.exit/i.test(blob));
  });

  await check('route mounting is idempotent (no stack storm)', () => {
    const before = (app.routes || []).length;
    cho.ensureRoutes(app);
    cho.ensureRoutes(app);
    occ.mountRoutes(app);
    emc.mountRoutes(app);
    const after = (app.routes || []).length;
    assert.equal(after, before, `routes grew ${before}->${after}`);
    const paths = (app.routes || []).map((r) => r[1]);
    assert.ok(paths.includes('/api/continuum/status'));
    assert.ok(paths.includes('/api/cho/status'));
  });

  await check('index.js wires CHO boot + autonomy surfaces', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(src.includes('continuum-harmony-os'));
    assert.ok(src.includes('continuumHarmonyOs.start'));
    assert.ok(src.includes('Continuum Harmony OS'));
    assert.ok(src.includes("collect('continuumHarmonyOs'"));
    assert.ok(src.includes("collect('essentialModulesContinuum'"));
  });

  await check('healer getStatus never returns ok:false when loaded', () => {
    const healer = require('../backend/modules/totalSystemHealer');
    const st = healer.getStatus();
    assert.equal(st.ok, true);
    assert.equal(st.module, 'totalSystemHealer');
  });

  try { cho.stop(); } catch (_) { /* ok */ }
  try {
    for (const cap of Object.values(occ.capabilities || {})) {
      if (cap && typeof cap.stop === 'function') cap.stop();
    }
    if (occ.age && typeof occ.age.stop === 'function') occ.age.stop();
  } catch (_) { /* ok */ }

  console.log(`✅ CHO/1.0: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error('CHO test failed:', e);
  process.exit(1);
});
