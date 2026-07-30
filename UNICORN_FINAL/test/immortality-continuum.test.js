'use strict';

/**
 * immortality-continuum.test.js — ICP/1.0 (DCA + CPG + EBS)
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.IMMORTALITY_DATA_DIR = require('path').join(
  require('os').tmpdir(),
  'icp-test-' + process.pid
);
process.env.NDK_SAMPLE_MS = '60000';
process.env.ICP_TICK_MS = '600000';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
  const icp = require('../backend/modules/immortality-continuum-protocol');
  icp.start();

  await check('ICP starts with neverKill + no absolute uptime claim', () => {
    const s = icp.getStatus();
    assert.equal(s.protocol, 'ICP/1.0');
    assert.equal(s.neverKill, true);
    assert.equal(s.claimsAbsoluteUptime, false);
    assert.ok(Array.isArray(s.inventions) && s.inventions.length >= 4);
  });

  await check('DCA records promote and canary fail honestly', () => {
    const sha = 'abc1234deadbeef';
    assert.equal(icp.dca.recordPromote({ sha, note: 'unit' }).ok, true);
    const st = icp.dca.getStatus();
    assert.equal(st.liveSha, sha);
    assert.equal(st.knownGoodSha, sha);
    assert.equal(st.stuckForward, false);
    icp.dca.recordCanaryFail({ sha: 'badsha99', reason: 'canary health timeout' });
    const st2 = icp.dca.getStatus();
    assert.equal(st2.stuckForward, true);
    assert.ok(st2.lastCanaryFailReason.includes('canary'));
    assert.equal(st2.honesty.claimsAbsoluteUptime, false);
  });

  await check('DCA quarantine marks tipQuarantined', () => {
    icp.dca.recordPromote({ sha: 'ffff1111aaaa' });
    icp.dca.recordQuarantine({ sha: 'ffff1111aaaa', reason: 'post-promote regression' });
    const st = icp.dca.getStatus();
    assert.equal(st.tipQuarantined, true);
  });

  await check('commerce pressure gate refuses under forced disk critical', () => {
    const cpg = require('../src/commerce/commerce-pressure-gate');
    const pressureFile = path.join(process.env.IMMORTALITY_DATA_DIR, 'commerce-pressure.json');
    fs.mkdirSync(path.dirname(pressureFile), { recursive: true });
    fs.writeFileSync(pressureFile, JSON.stringify({
      protocol: 'CPG/1.0',
      commerceBlocked: true,
      reasons: ['disk_critical'],
      diskUsedPct: 99,
      updatedAt: new Date().toISOString(),
    }));
    process.env.COMMERCE_PRESSURE_FILE = pressureFile;
    // Reload assess path uses COMMERCE_PRESSURE_FILE
    delete require.cache[require.resolve('../src/commerce/commerce-pressure-gate')];
    const cpg2 = require('../src/commerce/commerce-pressure-gate');
    const a = cpg2.assess();
    assert.equal(a.commerceBlocked, true);
    assert.ok(a.reasons.includes('disk_critical'));
    const refuse = cpg2.refusePayload(a);
    assert.equal(refuse.error, 'commerce_paused');
    assert.equal(refuse.status, 503);
    delete process.env.COMMERCE_PRESSURE_FILE;
    void cpg;
  });

  await check('createOrder path wires commerce-pressure-gate', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'site', 'sovereign-commerce.js'), 'utf8');
    assert.ok(src.includes('commerce-pressure-gate'));
    assert.ok(src.includes('commerce_paused') || src.includes('refusePayload'));
  });

  await check('EBS publish writes edge-bond signal without nginx rewrite claim', () => {
    const signal = icp.ebs.publish({
      localSiteOk: true,
      localBackendOk: true,
      publicEdgeOk: false,
      triadScore: 80,
      bonded: true,
      reasons: ['edge_fail'],
    });
    assert.equal(signal.protocol, 'EBS/1.0');
    assert.equal(signal.honesty.rewritesNginx, false);
    assert.equal(signal.recommendation, 'public_edge_degraded_while_local_green');
    const read = icp.ebs.read();
    assert.ok(read && read.updatedAt);
  });

  await check('mountRoutes registers ICP endpoints', () => {
    const routes = [];
    const app = {
      get: (p) => routes.push(['GET', p]),
      post: (p) => routes.push(['POST', p]),
    };
    const out = icp.mountRoutes(app);
    assert.equal(out.ok, true);
    assert.ok(routes.some((r) => r[1] === '/api/icp/status'));
    assert.ok(routes.some((r) => r[1] === '/.well-known/immortality.json'));
    assert.ok(routes.some((r) => r[1] === '/api/icp/dca/promote'));
    assert.ok(routes.some((r) => r[1] === '/api/cac/status'));
    assert.ok(routes.some((r) => r[1] === '/.well-known/continuity.json'));
  });

  await check('ICP status includes CAC continuity invention', () => {
    const s = icp.getStatus();
    assert.ok(s.inventions.some((i) => i.id === 'cac' && i.protocol === 'CAC/1.0'));
    assert.ok(s.continuity);
    assert.equal(s.claimsAbsoluteUptime, false);
  });

  await check('NDK envelope exposes commerceBlocked', () => {
    const ndk = require('../backend/modules/never-down-kernel');
    const e = ndk.healthEnvelope();
    assert.strictEqual(typeof e.commerceBlocked, 'boolean');
  });

  await check('CCG client continuum + deploy DCA hooks present', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
    assert.ok(shell.includes('Client Continuum Guardian') || shell.includes('zeus.ccg.drift'));
    assert.ok(shell.includes('/sw-reset'));
    const deploy = fs.readFileSync(path.join(ROOT, 'scripts', 'deploy-atomic-forward.sh'), 'utf8');
    assert.ok(deploy.includes('dca_canary_fail'));
    assert.ok(deploy.includes('dca promote recorded') || deploy.includes('/api/icp/dca/promote'));
    assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'zeus-pm2-resurrect.sh')));
    const resurrect = fs.readFileSync(path.join(ROOT, 'scripts', 'zeus-pm2-resurrect.sh'), 'utf8');
    assert.ok(resurrect.includes('pm2 ping'));
    assert.ok(resurrect.includes('zeus-pm2-resurrect.disabled'));
  });

  await check('backend boots ICP and enriches /api/health immortality', () => {
    const backend = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');
    assert.ok(backend.includes('immortality-continuum-protocol'));
    assert.ok(backend.includes('immortality:'));
    assert.ok(backend.includes('ICP/1.0'));
  });

  await check('nginx + site proxy immortality discovery', () => {
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /.well-known/immortality.json'));
    assert.ok(nginx.includes('location = /.well-known/continuity.json'));
    const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    assert.ok(indexJs.includes('/.well-known/immortality.json'));
    assert.ok(indexJs.includes('/api/icp/status'));
    assert.ok(indexJs.includes('/.well-known/continuity.json'));
    assert.ok(indexJs.includes('/api/cac/status'));
  });

  console.log(`✅ immortality-continuum: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
