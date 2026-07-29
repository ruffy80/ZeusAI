'use strict';

/**
 * autonomy-action-continuum-os.test.js — AACOS/1.0
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.AACOS_DISABLED = '1'; // don't auto-start interval during test require
process.env.AACOS_DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'aacos-'));
process.env.OUTBOUND_DRY_RUN = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1;
      console.log('\u2713', name);
    });
}

const ROOT = path.join(__dirname, '..');

(async () => {
  const aacos = require('../backend/modules/autonomy-action-continuum-os');

  await check('AACOS protocol identity', () => {
    assert.equal(aacos.PROTOCOL, 'AACOS/1.0');
    const d = aacos.discovery();
    assert.equal(d.protocol, 'AACOS/1.0');
    assert.ok(d.endpoints.wellKnown.includes('aacos.json'));
    assert.ok(Array.isArray(d.pledge));
  });

  await check('start + tick emits skipped without credentials (honest)', async () => {
    aacos.start({ force: true });
    const r = await aacos.tick({ force: true, source: 'test' });
    assert.equal(r.ok, true);
    assert.ok(r.tick >= 1);
    assert.ok(r.drain);
    assert.ok(r.drain.type === 'skipped' || r.drain.type === 'published');
    if (r.drain.type === 'skipped') {
      assert.ok(r.drain.reason);
    }
  });

  await check('viral status no longer hardcodes ACTIVE theater', () => {
    const avg = require('../backend/modules/autoViralGrowth');
    const st = avg.getViralStatus();
    assert.ok(st.state !== 'AUTONOMOUS_VIRAL_GROWTH_ACTIVE');
    assert.ok(st.continuum || st.honesty);
    assert.equal(typeof st.loopRunning, 'boolean');
  });

  await check('socialMediaViralizer exposes broadcast continuum entry', async () => {
    const viralizer = require('../backend/modules/socialMediaViralizer');
    assert.equal(typeof viralizer.broadcast, 'function');
    const r = await viralizer.broadcast({ body: 'test continuum' });
    assert.ok(r && typeof r === 'object', 'broadcast must return an object');
    assert.ok('ok' in r || 'reason' in r || 'type' in r, 'broadcast result must be shaped');
  });

  await check('backend wires AACOS start + routes + mesh monitor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'backend/index.js'), 'utf8');
    assert.ok(src.includes('autonomy-action-continuum-os'));
    assert.ok(src.includes('/.well-known/aacos.json'));
    assert.ok(src.includes("mode: 'monitor'"));
    assert.ok(src.includes('/api/aacos/tick'));
  });

  await check('site + nginx expose aacos.json', () => {
    const site = fs.readFileSync(path.join(ROOT, 'src/index.js'), 'utf8');
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts/nginx-unicorn.conf'), 'utf8');
    const snip = fs.readFileSync(path.join(ROOT, 'scripts/nginx-public-discovery.snippet.conf'), 'utf8');
    const patch = fs.readFileSync(path.join(ROOT, 'scripts/nginx-patch-public-discovery.py'), 'utf8');
    assert.ok(site.includes('/.well-known/aacos.json'));
    assert.ok(nginx.includes('location = /.well-known/aacos.json'));
    assert.ok(snip.includes('location = /.well-known/aacos.json'));
    assert.ok(patch.includes('location = /.well-known/aacos.json'));
  });

  await check('mesh start accepts monitor mode without heal', () => {
    // Mesh public entry is an IAK shim; behaviour lives in integrated-autonomy-kernel.
    const shim = fs.readFileSync(path.join(ROOT, 'backend/modules/unicornMeshOrchestrator.js'), 'utf8');
    const src = fs.readFileSync(path.join(ROOT, 'backend/modules/integrated-autonomy-kernel.js'), 'utf8');
    assert.ok(shim.includes('integrated-autonomy-kernel'));
    assert.ok(src.includes("this.mode = (opts && opts.mode) || 'full'"));
    assert.ok(src.includes("this.mode !== 'monitor'"));
  });

  aacos.stop();
  console.log('\n\u2705 autonomy-action-continuum-os: ' + passed + ' tests passed');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
