'use strict';

/**
 * continuity-attestation-chain.test.js — CAC/1.0
 * Heartbeat → bind Continuity Passport → verify chain + passport.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.IMMORTALITY_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'cac-test-' + process.pid + '-' + Date.now()
);
process.env.CAC_HMAC_SECRET = 'cac-unit-test-secret';
process.env.ICP_TICK_MS = '600000';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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
  // Fresh module load against temp data dir
  const cacPath = require.resolve('../backend/modules/immortality/continuity-attestation-chain');
  delete require.cache[cacPath];
  const cac = require('../backend/modules/immortality/continuity-attestation-chain');

  await check('CAC starts and appends signed heartbeats', () => {
    const st = cac.start();
    assert.equal(st.protocol, 'CAC/1.0');
    assert.equal(st.honesty.inventsUptime, false);
    const b1 = cac.appendHeartbeat({ plane: { reasons: ['unit'] } });
    assert.ok(b1.seq >= 1);
    assert.ok(b1.hash);
    assert.ok(b1.signature && b1.signature.signature);
    const b2 = cac.appendHeartbeat();
    assert.equal(b2.prevHash, b1.hash);
    assert.equal(b2.seq, b1.seq + 1);
  });

  await check('verifyChain passes for linked heartbeats', () => {
    const v = cac.verifyChain(20);
    assert.equal(v.ok, true);
    assert.ok(v.checked >= 2);
  });

  await check('bindOrder mints Continuity Passport with honest verdict', () => {
    const out = cac.bindOrder({
      orderId: 'ord_cac_unit_1',
      serviceId: 'instant-seo-content-pack',
      email: 'buyer@example.com',
      paidAt: new Date().toISOString(),
    });
    assert.equal(out.ok, true);
    assert.ok(out.passport);
    assert.equal(out.passport.protocol, 'CAC/1.0');
    assert.equal(out.passport.orderId, 'ord_cac_unit_1');
    assert.ok(out.passport.passportId.startsWith('cac_'));
    assert.ok(['continuous_bonded', 'degraded_window', 'insufficient_samples', 'commerce_blocked_window']
      .includes(out.passport.verdict));
    assert.equal(out.passport.honesty.inventsUptime, false);
  });

  await check('getPassport + verifyPassport round-trip', () => {
    const p = cac.getPassport('ord_cac_unit_1');
    assert.ok(p);
    const v = cac.verifyPassport(p);
    assert.equal(v.ok, true);
    assert.equal(v.orderId, 'ord_cac_unit_1');
  });

  await check('mountRoutes registers CAC endpoints', () => {
    const routes = [];
    const app = {
      get: (p) => routes.push(['GET', p]),
      post: (p) => routes.push(['POST', p]),
    };
    const out = cac.mountRoutes(app);
    assert.equal(out.ok, true);
    assert.ok(routes.some((r) => r[0] === 'GET' && r[1] === '/api/cac/status'));
    assert.ok(routes.some((r) => r[0] === 'POST' && r[1] === '/api/cac/bind'));
    assert.ok(routes.some((r) => r[1] === '/.well-known/continuity.json'));
  });

  await check('ICP composes CAC and exposes continuity', () => {
    const icpPath = require.resolve('../backend/modules/immortality-continuum-protocol');
    delete require.cache[icpPath];
    const icp = require('../backend/modules/immortality-continuum-protocol');
    icp.start();
    const s = icp.getStatus();
    assert.ok(s.inventions.some((i) => i.id === 'cac'));
    assert.ok(s.continuity);
    assert.ok(s.continuity.protocol === 'CAC/1.0' || s.continuity.tipHash != null || s.continuity.seq != null);
    const routes = [];
    icp.mountRoutes({
      get: (p) => routes.push(['GET', p]),
      post: (p) => routes.push(['POST', p]),
    });
    assert.ok(routes.some((r) => r[1] === '/api/cac/status'));
    assert.ok(routes.some((r) => r[1] === '/.well-known/continuity.json'));
  });

  await check('wsi-settle-bridge binds CAC on payment', () => {
    const bridge = fs.readFileSync(path.join(ROOT, 'src', 'commerce', 'wsi-settle-bridge.js'), 'utf8');
    assert.ok(bridge.includes('/api/cac/bind'));
    assert.ok(bridge.includes('continuity-attestation-chain'));
    assert.ok(bridge.includes('_bindContinuity'));
  });

  await check('site wires /continuity + CAC proxies + nginx exact match', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
    assert.ok(shell.includes("case '/continuity'"));
    assert.ok(shell.includes('continuity-surface'));
    assert.ok(shell.includes('href="/continuity"'));
    const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    assert.ok(indexJs.includes("'/continuity'"));
    assert.ok(indexJs.includes('/api/cac/status'));
    assert.ok(indexJs.includes('/.well-known/continuity.json'));
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /.well-known/continuity.json'));
    const page = require('../src/site/v2/continuity-surface').pageContinuity();
    assert.ok(page.includes('Continuity Attestation'));
    assert.ok(page.includes('Technical detail'));
    assert.ok(!/textContent\s*=\s*JSON\.stringify/.test(page));
  });

  await check('CAC CTAs use Live Inspect (no raw JSON tabs)', () => {
    const att = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'continuity-attestation.js'), 'utf8');
    assert.ok(att.includes('data-live-inspect="/api/cac/status"'));
    assert.ok(att.includes('data-live-inspect="/.well-known/continuity.json"'));
    assert.ok(!/<a[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*href="\/api\/cac\//.test(att));
  });

  console.log(`✅ continuity-attestation-chain: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
