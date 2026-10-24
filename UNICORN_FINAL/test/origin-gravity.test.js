'use strict';
/**
 * origin-gravity.test.js — OGP/1.0
 * Signed zero-customer genesis, founding passport, no fake humans.
 */
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';
delete process.env.OGP_DATA_DIR;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'backend', 'modules', 'origin-gravity-os.js');
const SITE_INDEX = path.join(ROOT, 'src', 'index.js');
const BACKEND_INDEX = path.join(ROOT, 'backend', 'index.js');
const SHELL = path.join(ROOT, 'src', 'site', 'v2', 'shell.js');
const CLIENT = path.join(ROOT, 'src', 'site', 'v2', 'client.js');
const NGINX = path.join(ROOT, 'scripts', 'nginx-unicorn.conf');
const SOV = path.join(ROOT, 'src', 'site', 'sovereign-extensions.js');
const TRAFFIC = path.join(ROOT, 'backend', 'modules', 'traffic-engine.js');
const IAK_DISC = path.join(ROOT, 'backend', 'modules', 'iak', 'module-discovery.js');
const PKG = path.join(ROOT, 'package.json');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

console.log('Origin Gravity Protocol (OGP/1.0)');

check('module file exists', () => {
  assert.ok(fs.existsSync(MOD), 'origin-gravity-os.js missing');
});

const ogp = require(MOD);
ogp._resetForTests();

check('exports protocol and never invents humans', () => {
  assert.strictEqual(ogp.PROTOCOL, 'OGP/1.0');
  assert.strictEqual(ogp.name, 'origin-gravity-os');
  assert.strictEqual(typeof ogp.recordPaidHuman, 'function');
  assert.strictEqual(typeof ogp.getStatus, 'function');
  assert.strictEqual(typeof ogp.discovery, 'function');
  const st = ogp.getStatus();
  assert.strictEqual(st.ok, true);
  assert.strictEqual(st.inventsHumans, false);
  assert.strictEqual(st.inventsVisitors, false);
  assert.strictEqual(st.inventsGmv, false);
  assert.strictEqual(st.paidHumans, 0);
  assert.strictEqual(st.originOpen, true);
  assert.strictEqual(st.nextOriginIndex, 1);
  assert.ok(st.genesisHash && st.genesisHash.length === 64);
  assert.strictEqual(st.chainOk, true);
  assert.ok(st.health === 'observe' || st.health === 'ok');
});

check('genesis is hash-chained and stable', () => {
  ogp._resetForTests();
  const a = ogp.ensureGenesis();
  const b = ogp.ensureGenesis();
  assert.strictEqual(a.originIndex, 0);
  assert.strictEqual(a.paidHumans, 0);
  assert.strictEqual(a.hash, b.hash);
  assert.strictEqual(ogp.hashBlock(a), a.hash);
  assert.ok(String(a.statement || '').toLowerCase().includes('zero'));
});

check('unpaid invoices never mint Origin #1', () => {
  ogp._resetForTests();
  const out = ogp.recordPaidHuman({ id: 'ord_pending', status: 'pending', serviceId: 'starter' });
  assert.strictEqual(out.recorded, false);
  assert.strictEqual(out.inventsHumans, false);
  assert.strictEqual(ogp.getStatus().paidHumans, 0);
  assert.strictEqual(ogp.getStatus().originOpen, true);
});

check('missing order id is refused', () => {
  ogp._resetForTests();
  const out = ogp.recordPaidHuman({ status: 'paid' });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(ogp.getStatus().paidHumans, 0);
});

check('first paid human mints founding passport; second is Origin #2; idempotent', () => {
  ogp._resetForTests();
  const first = ogp.recordPaidHuman({
    orderId: 'ord_origin_1',
    status: 'paid',
    serviceId: 'starter',
    rail: 'btc',
  });
  assert.strictEqual(first.recorded, true);
  assert.strictEqual(first.originIndex, 1);
  assert.strictEqual(first.founding, true);
  assert.ok(first.passport && first.passport.kind === 'founding-origin-passport');
  assert.strictEqual(first.passport.inventsHumans, false);
  assert.ok(first.invites && first.invites.length >= 1);

  const again = ogp.recordPaidHuman({
    orderId: 'ord_origin_1',
    status: 'paid',
    serviceId: 'starter',
    rail: 'btc',
  });
  assert.strictEqual(again.idempotent, true);
  assert.strictEqual(again.recorded, false);
  assert.strictEqual(ogp.getStatus().paidHumans, 1);

  const second = ogp.recordPaidHuman({
    id: 'ord_origin_2',
    status: 'settled',
    serviceId: 'pro',
    rail: 'paypal',
  });
  assert.strictEqual(second.originIndex, 2);
  assert.strictEqual(second.founding, false);
  assert.strictEqual(second.passport.kind, 'origin-passport');
  const st = ogp.getStatus();
  assert.strictEqual(st.paidHumans, 2);
  assert.strictEqual(st.originOpen, false);
  assert.strictEqual(st.nextOriginIndex, 3);
  assert.strictEqual(st.chainOk, true);
  const pass = ogp.getPassport(1);
  assert.strictEqual(pass.originIndex, 1);
  assert.ok(pass.hash);
});

check('invites refuse before Origin #1 and do not increment humans', () => {
  ogp._resetForTests();
  const early = ogp.mintInvite({});
  assert.strictEqual(early.ok, false);
  ogp.recordPaidHuman({ orderId: 'ord_inv', status: 'paid' });
  const minted = ogp.mintInvite({});
  assert.strictEqual(minted.ok, true);
  assert.strictEqual(minted.inventsHumans, false);
  const before = ogp.getStatus().paidHumans;
  const redeemed = ogp.redeemInvite(minted.code);
  assert.strictEqual(redeemed.ok, true);
  assert.strictEqual(redeemed.inventsHumans, false);
  assert.strictEqual(ogp.getStatus().paidHumans, before);
});

check('well-known discovery admits zero humans and points at buy path', () => {
  ogp._resetForTests();
  const d = ogp.discovery();
  assert.strictEqual(d.protocol, 'OGP/1.0');
  assert.strictEqual(d.paidHumans, 0);
  assert.strictEqual(d.originOpen, true);
  assert.ok(String(d.claim).toLowerCase().includes('zero paid humans'));
  assert.ok(d.howToBecomeOrigin.human.includes('/buy'));
  assert.ok(d.urls.some((u) => u.endsWith('/origin')));
  assert.ok(d.urls.some((u) => u.includes('origin-gravity.json')));
  const hdr = ogp.originHeaders();
  assert.strictEqual(hdr['X-Origin-Humans'], '0');
  assert.strictEqual(hdr['X-Origin-Open'], '1');
});

check('IAK treats idle OGP as observe-healthy', () => {
  ogp._resetForTests();
  const IAK = require('../backend/modules/integrated-autonomy-kernel');
  let iak = IAK;
  if (typeof IAK === 'function') {
    try { iak = new IAK({ mode: 'monitor' }); } catch (_) { iak = IAK; }
  }
  if (iak && iak.default) iak = iak.default;
  const st = ogp.getStatus();
  assert.equal(iak._isHealthy(st), true);
});

check('IAK stable allowlist includes origin-gravity-os', () => {
  const disc = require(IAK_DISC);
  assert.ok(disc.STABLE_START_ALLOW.has('origin-gravity-os'));
});

check('backend mounts OGP, paid hook, and well-known', () => {
  const src = fs.readFileSync(BACKEND_INDEX, 'utf8');
  assert.ok(src.includes('origin-gravity-os'));
  assert.ok(src.includes('/api/origin-gravity'));
  assert.ok(src.includes('origin-gravity.json'));
  assert.ok(src.includes('recordPaidHuman'));
});

check('site serves well-known + /origin route + health snippet', () => {
  const src = fs.readFileSync(SITE_INDEX, 'utf8');
  assert.ok(src.includes('origin-gravity-os'));
  assert.ok(src.includes('/.well-known/origin-gravity.json'));
  assert.ok(src.includes("'/origin'"));
});

check('homepage + /origin page lean into zero humans', () => {
  const shell = fs.readFileSync(SHELL, 'utf8');
  assert.ok(shell.includes('id="homeOriginGravity"') || shell.includes('id="ogpBanner"'));
  assert.ok(shell.includes('Origin #1'));
  assert.ok(shell.includes('function pageOrigin') || shell.includes("case '/origin'"));
  assert.ok(/paidHumans|0 paid humans/i.test(shell));
});

check('client hydrates origin gravity from live API', () => {
  const client = fs.readFileSync(CLIENT, 'utf8');
  assert.ok(client.includes('hydrateOriginGravity'));
  assert.ok(client.includes('/api/origin-gravity'));
});

check('llms.txt tells agents Origin #1 is open and not to invent counts', () => {
  const src = fs.readFileSync(SOV, 'utf8');
  assert.ok(src.includes('Origin Gravity'));
  assert.ok(src.includes('paidHumans'));
  assert.ok(src.includes('Origin #1'));
});

check('sitemap and IndexNow omit /origin', () => {
  const seo = require('../src/seo/sitemap-helpers');
  assert.ok(!seo.corePublicPaths().includes('/origin'));
  assert.ok(seo.robotsTxt('https://zeusai.pro').includes('Disallow: /origin'));
  const urls = require('../backend/modules/traffic-engine').urlsToSubmit();
  assert.ok(!urls.some((u) => /\/origin$/.test(u)));
});

check('nginx pins origin-gravity.json to backend', () => {
  const conf = fs.readFileSync(NGINX, 'utf8');
  assert.ok(/location\s+=\s+\/\.well-known\/origin-gravity\.json/.test(conf));
  const idx = conf.indexOf('location = /.well-known/origin-gravity.json');
  const win = conf.slice(idx, idx + 400);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_backend\b/.test(win));
});

check('test:chain includes origin-gravity.test.js', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  assert.ok(String(pkg.scripts['test:chain']).includes('origin-gravity.test.js'));
});

check('modules-real-world-complete allowlists OGP', () => {
  const src = fs.readFileSync(path.join(ROOT, 'test', 'modules-real-world-complete.test.js'), 'utf8');
  assert.ok(src.includes('origin-gravity-os'));
});

async function main() {
  ogp._resetForTests();
  const pulse = await ogp.pulseDiscovery({ dryRun: true });
  assert.strictEqual(pulse.ok, true);
  assert.strictEqual(pulse.inventsReach, false);
  assert.ok(pulse.dryRun === true);
  passed += 1;
  console.log('✓ IndexNow pulse is dry-run in tests and never invents reach');
  console.log(`\n✅ origin-gravity: ${passed} tests passed\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
