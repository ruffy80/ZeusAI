'use strict';

/**
 * TAAC/1.0 — Total Autonomy Activation Continuum tests
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.TAAC_DISABLED = '1'; // don't start interval
process.env.DISABLE_BILLION_AUTONOMY_LOOP = '0';
process.env.BILLION_AUTONOMY_LOOP_FORCE = '1';
process.env.TOTAL_AUTONOMY_SAFE_ARM = '0';
process.env.TAOS_SAFE_ARM = '0';
process.env.AACOS_DISABLED = '1';
process.env.AGDE_DISABLED = '1';
process.env.RIVOS_DISABLED = '1';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
process.env.GROWTH_STACK_DISABLED = '1';
process.env.TAAC_DATA_DIR = require('os').tmpdir() + '/taac-test-' + Date.now();

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const taac = require('../backend/modules/total-autonomy-activation-continuum');

let passed = 0;
function check(name, fn) {
  const r = fn();
  if (r && typeof r.then === 'function') {
    return r.then(() => {
      console.log('✓', name);
      passed += 1;
    }).catch((e) => {
      console.error('✗', name);
      console.error(e && e.stack || e);
      process.exit(1);
    });
  }
  console.log('✓', name);
  passed += 1;
  return Promise.resolve();
}

async function main() {
  await check('discovery exposes protocol + honesty + never mutators', () => {
    const d = taac.discovery();
    assert.equal(d.protocol, 'TAAC/1.0');
    assert.ok(d.inventions || d.invention);
    assert.equal(d.policy.mutators, 'never');
    assert.equal(d.policy.ueeEternal, 'never');
    assert.ok(/Never invents GMV/i.test(d.honesty));
  });

  await check('armAll dryRun lists all organs', async () => {
    const r = await taac.armAll({ dryRun: true });
    assert.equal(r.ok, true);
    assert.equal(r.dryRun, true);
    assert.ok(r.plan.includes('balos'));
    assert.ok(r.plan.includes('aacos'));
    assert.ok(r.plan.includes('rivos'));
  });

  await check('armAll live refuses mutators and records organs', async () => {
    const r = await taac.armAll({ dryRun: false });
    assert.ok(r.refused);
    assert.equal(r.refused.file_mutators, 'parked_by_policy');
    assert.equal(r.refused.uee_eternal, 'parked_by_policy');
    assert.ok(r.tcc);
    assert.ok(r.balos);
  });

  await check('ecosystem defaults arm BALOS + TAAC + SAFE_ARM', () => {
    const src = fs.readFileSync(path.join(__dirname, '../ecosystem.config.js'), 'utf8');
    assert.ok(src.includes("DISABLE_BILLION_AUTONOMY_LOOP: process.env.DISABLE_BILLION_AUTONOMY_LOOP || '0'"));
    assert.ok(src.includes("BILLION_AUTONOMY_LOOP_FORCE: process.env.BILLION_AUTONOMY_LOOP_FORCE || '1'"));
    assert.ok(src.includes("TOTAL_AUTONOMY_SAFE_ARM: process.env.TOTAL_AUTONOMY_SAFE_ARM || '1'"));
    assert.ok(src.includes("TAAC_DISABLED: process.env.TAAC_DISABLED || '0'"));
    assert.ok(src.includes("LEAD_HUNTER_FORCE: process.env.LEAD_HUNTER_FORCE || '1'"));
  });

  await check('backend mounts TAAC + routes', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(src.includes('total-autonomy-activation-continuum'));
    assert.ok(src.includes('/.well-known/taac.json'));
    assert.ok(src.includes('/api/taac/arm'));
  });

  await check('site proxies /.well-known/taac.json', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
    assert.ok(src.includes('/.well-known/taac.json'));
  });

  await check('unicorn-full-activate writes FULL autonomy env', () => {
    const src = fs.readFileSync(path.join(__dirname, '../scripts/unicorn-full-activate.sh'), 'utf8');
    assert.ok(src.includes('DISABLE_BILLION_AUTONOMY_LOOP=0'));
    assert.ok(src.includes('BILLION_AUTONOMY_LOOP_FORCE=1'));
    assert.ok(src.includes('TAAC_DISABLED=0'));
    assert.ok(src.includes('TOTAL_AUTONOMY_SAFE_ARM=1'));
  });

  console.log('\n✅ total-autonomy-activation-continuum:', passed, 'tests passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
