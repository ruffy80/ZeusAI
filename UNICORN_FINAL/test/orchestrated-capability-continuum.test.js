'use strict';

/**
 * orchestrated-capability-continuum.test.js — OCC/1.0
 * Honest observe/tick continuum for AGI/Space/Twin/Neural/Quantum/AGE.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.OCC_TICK_MS = '60000';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => {
      passed += 1;
      console.log('✓', name);
    });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function main() {
  const occ = require('../backend/modules/orchestrated-capability-continuum');
  const factory = require('../backend/modules/capability-factory');

  await check('createCapability does not shadow Node process.env', () => {
    const cap = factory.createCapability({
      id: 'TestCap',
      title: 'Test Cap',
      role: 'unit',
      sense: () => ({ ok: true }),
    });
    assert.equal(typeof cap.start, 'function');
    assert.equal(typeof cap.process, 'function');
    const st = cap.start();
    assert.equal(st.running, true);
    assert.equal(st.honesty.stubTheater, false);
    cap.stop();
  });

  await check('OCC start runs all continuum capabilities', () => {
    const s = occ.start();
    assert.equal(s.protocol, 'OCC/1.0');
    assert.equal(s.running, true);
    assert.ok(s.runningCount >= 8, `expected >=8 running, got ${s.runningCount}`);
    assert.equal(s.honesty.claimsAgi, false);
    assert.equal(s.honesty.claimsQuantumInternet, false);
  });

  await check('generated shims re-export live OCC capabilities', () => {
    const names = [
      'AGISelf-EvolutionEngine',
      'AutonomousSpaceComputing',
      'DecentralizedDigitalTwinNetwork',
      'NeuralInterfaceAPI',
      'QuantumInternetProtocol',
      'QuantumMachineLearningCore',
      'TemporalDataLayer',
      'AGE',
    ];
    for (const n of names) {
      const mod = require(path.join('..', 'backend', 'generated', n));
      const st = mod.getStatus();
      assert.equal(st.running, true, `${n} should be running`);
      assert.equal(st.honesty.stubTheater, false, `${n} must not be theater`);
      assert.ok(st.ticks >= 1, `${n} should have ticked`);
    }
  });

  await check('AGE act returns constrained governance recommendations', async () => {
    const out = await occ.age.process({ intent: 'observe' });
    assert.equal(out.ok, true);
    assert.equal(out.age, true);
    assert.ok(Array.isArray(out.actions) && out.actions.length >= 1);
    assert.equal(out.neverRestarts, true);
    assert.equal(out.neverInventRails, true);
    for (const a of out.actions) {
      assert.ok(a.action, 'action id required');
      assert.ok(!/pm2|process\.exit|restart_backend/i.test(JSON.stringify(a)));
    }
  });

  await check('OCC mountRoutes exposes /api/occ/status and /api/age/act', async () => {
    const routes = [];
    const app = {
      get(p, h) { routes.push(['GET', p, h]); },
      post(p, h) { routes.push(['POST', p, h]); },
    };
    const mounted = occ.mountRoutes(app);
    assert.equal(mounted.ok, true);
    const paths = routes.map((r) => r[0] + ' ' + r[1]);
    assert.ok(paths.includes('GET /api/occ/status'));
    assert.ok(paths.includes('GET /api/age/status'));
    assert.ok(paths.includes('POST /api/age/act'));

    const statusHandler = routes.find((r) => r[1] === '/api/occ/status')[2];
    let payload = null;
    statusHandler({}, { json: (x) => { payload = x; } });
    assert.equal(payload.running, true);

    const actHandler = routes.find((r) => r[1] === '/api/age/act')[2];
    const actPayload = await new Promise((resolve) => {
      actHandler({ body: { intent: 'tick' } }, { json: resolve, status() { return this; } });
    });
    assert.equal(actPayload.ok, true);
    assert.ok(actPayload.actions.length >= 1);
  });

  await check('mesh register wires OCC keys', () => {
    const registered = [];
    const mesh = {
      register(name, inst, opts) {
        registered.push({ name, hasStatus: typeof inst.getStatus === 'function', opts });
      },
    };
    const r = occ.registerWithMesh(mesh);
    assert.equal(r.ok, true);
    assert.ok(registered.some((x) => x.name === 'agiSelfEvolution'));
    assert.ok(registered.some((x) => x.name === 'age'));
    assert.ok(registered.some((x) => x.name === 'orchestratedCapabilityContinuum'));
  });

  await check('UEE template never emits future_ready theater for OCC names', () => {
    const UEE = require('../backend/modules/unicornEternalEngine');
    const eng = UEE && UEE.constructor && !(typeof UEE.getInnovationTemplate === 'function')
      ? null
      : UEE;
    let tplFn = null;
    if (eng && typeof eng.getInnovationTemplate === 'function') {
      tplFn = eng.getInnovationTemplate.bind(eng);
    } else if (typeof UEE === 'function') {
      const inst = new UEE();
      tplFn = inst.getInnovationTemplate.bind(inst);
    } else if (eng && eng.prototype && eng.prototype.getInnovationTemplate) {
      const inst = Object.create(eng.prototype);
      tplFn = eng.prototype.getInnovationTemplate.bind(inst);
    }
    assert.ok(tplFn, 'UEE getInnovationTemplate available');
    const tpl = tplFn({ name: 'AGISelf-EvolutionEngine', year: 2029, impact: 'critical' });
    assert.ok(/orchestrated-capability-continuum/.test(tpl));
    assert.ok(/agiSelfEvolution/.test(tpl));
    assert.ok(!/status:\s*'future_ready'/.test(tpl));
    assert.ok(!/status:\s*'active',\s*ready:\s*true/.test(tpl));
    assert.ok(!/createCapability/.test(tpl), 'OCC names must re-export continuum, not invent a new stub');
  });

  await check('IAK discovery lists generated OCC files', () => {
    const disco = require('../backend/modules/iak/module-discovery');
    assert.equal(typeof disco.listGeneratedModuleFiles, 'function');
    const files = disco.listGeneratedModuleFiles();
    const names = files.map((f) => f.name);
    assert.ok(names.includes('AGISelf-EvolutionEngine'));
    assert.ok(names.includes('AGE'));
    assert.ok(disco.STABLE_START_ALLOW.has('AGISelf-EvolutionEngine'));
    assert.ok(disco.STABLE_START_ALLOW.has('orchestrated-capability-continuum'));
  });

  await check('index.js status routes use honest _occStatus (no hard-coded ready:true)', () => {
    const indexPath = path.join(__dirname, '..', 'backend', 'index.js');
    const src = fs.readFileSync(indexPath, 'utf8');
    assert.ok(src.includes('function _occStatus'));
    assert.ok(src.includes('Orchestrated Capability Continuum'));
    assert.ok(src.includes('orchestratedCapabilityContinuum.start()'));
    assert.ok(src.includes('orchestratedCapabilityContinuum.mountRoutes'));
    // Theater pattern must be gone from generated status routes
    assert.ok(!/module:\s*'AGI Self-Evolution Engine',\s*status:\s*'active',\s*ready:\s*true/.test(src));
    assert.ok(!/module:\s*'Quantum Machine Learning Core',\s*status:\s*'active',\s*ready:\s*true/.test(src));
  });

  // Stop continuum timers so the process can exit
  for (const cap of Object.values(occ.capabilities)) {
    try { if (cap && typeof cap.stop === 'function') cap.stop(); } catch (_) { /* ok */ }
  }
  try { if (occ.age && typeof occ.age.stop === 'function') occ.age.stop(); } catch (_) { /* ok */ }

  console.log(`✅ OCC/1.0: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error('OCC test failed:', e);
  process.exit(1);
});
