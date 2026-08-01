'use strict';

/**
 * Billion Autonomy Loop OS — digital flywheel without inventing GMV/CJ vids.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.DISABLE_BILLION_AUTONOMY_LOOP = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'balos-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

let passed = 0;
function check(name, fn) {
  try {
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
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

async function main() {
  const balos = require('../src/commerce/billion-autonomy-loop-os');

  await check('protocol + top buyable instant SKUs', () => {
    assert.equal(balos.PROTOCOL, 'BALOS/1.0');
    const skus = balos.topBuyableInstant(8);
    assert.ok(Array.isArray(skus));
    assert.ok(skus.length >= 3, 'expected curated instant SKUs');
    assert.ok(skus.every((s) => s.buyable && s.checkoutHref.includes('/checkout/')));
  });

  await check('moneyUrls include buy/enterprise + service pages', () => {
    const urls = balos.moneyUrls(balos.topBuyableInstant(6));
    assert.ok(urls.some((u) => /\/buy$/.test(u)));
    assert.ok(urls.some((u) => /\/enterprise/.test(u)));
    assert.ok(urls.some((u) => /\/services\//.test(u)));
  });

  await check('cjArmStatus is honest when unarmed', () => {
    delete process.env.ZACC_CJ_API_KEY;
    delete process.env.CJ_API_KEY;
    const arm = balos.cjArmStatus();
    assert.equal(arm.armed, false);
    assert.ok(/digital flywheel|unarmed/i.test(arm.honesty));
  });

  await check('tick dryRun never invents GMV and records actions', async () => {
    const out = await balos.tick({ source: 'test', dryRun: true, limit: 6 });
    assert.equal(out.ok, true);
    assert.equal(out.dryRun, true);
    assert.ok(out.actions.length >= 3);
    assert.ok(/Never invents GMV/i.test(out.honesty));
    assert.ok(!JSON.stringify(out).includes('annualRevenueUsd'));
  });

  await check('status exposes flywheel + endpoints', () => {
    const s = balos.status();
    assert.equal(s.ok, true);
    assert.equal(s.protocol, 'BALOS/1.0');
    assert.ok(s.flywheel && s.flywheel.mode === 'digital_first');
    assert.ok(s.endpoints.status.includes('autonomy-loop'));
    assert.ok(Array.isArray(s.nextWithoutCj) && s.nextWithoutCj.length >= 3);
  });

  await check('source wiring: routes + enterprise notify + REV_AUTO + boot start', () => {
    const idx = read('src/index.js');
    assert.ok(idx.includes('/api/billion-scale/autonomy-loop'));
    assert.ok(idx.includes('notifyEnterpriseLead'));
    const be = read('backend/index.js');
    assert.ok(be.includes('billion-autonomy-loop-os'));
    assert.ok(be.includes('Billion Autonomy Loop'));
    assert.ok(be.includes('revenue-autopilot:'));
    const te = read('backend/modules/traffic-engine.js');
    assert.ok(te.includes('instant-catalog'));
    assert.ok(te.includes('/enterprise'));
  });

  console.log('\n' + passed + ' checks passed (billion-autonomy-loop-os)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
