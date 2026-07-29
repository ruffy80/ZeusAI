/**
 * pages-frontier-innov-bridge.test.js
 * Guards the Frontier / Innovations / Crypto Bridge page repairs:
 *   - frontierStatus exposes count + inventionList (object inventions ≠ array)
 *   - pledge returns commitments (not principles)
 *   - gift mint/redeem round-trip
 *   - cancel message is honest (intent recorded, not "within 60s")
 *   - shell SSR pages include interactive tools + coverage hydrate hooks
 *   - crypto bridge module mounts health + destination-check
 */
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(os.tmpdir(), 'zeus-frontier-pages-' + process.pid);
fs.mkdirSync(DATA, { recursive: true });
process.env.FRONTIER_DATA_DIR = DATA;

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

const frontier = require(path.join(ROOT, 'src', 'frontier-engine.js'));
const shellSrc = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
const nginxSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
const backendSrc = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');

check('frontierStatus reports inventionsAvailable=12 and inventionList', () => {
  const st = frontier.frontierStatus();
  assert.strictEqual(st.ok, true);
  assert.strictEqual(st.count, 12);
  assert.strictEqual(st.inventionsAvailable, 12);
  assert.ok(Array.isArray(st.inventionList));
  assert.strictEqual(st.inventionList.length, 12);
  assert.strictEqual(typeof st.inventions, 'object');
  assert.ok(!Array.isArray(st.inventions));
});

check('pledge() returns commitments array (UI reads commitments)', () => {
  const p = frontier.pledge();
  assert.ok(Array.isArray(p.commitments));
  assert.ok(p.commitments.length >= 5);
  assert.ok(p.signature);
});

check('gift mint → redeem round-trip works', () => {
  const minted = frontier.giftMint({ sku: 'adaptive-ai', valueUsd: 49, fromEmail: 'a@test.com' });
  assert.ok(minted.code && minted.code.startsWith('GIFT-'));
  assert.ok(String(minted.redeemUrl || '').includes('c='));
  const redeemed = frontier.giftRedeem({ code: minted.code, byEmail: 'b@test.com' });
  assert.strictEqual(redeemed.ok, true);
  const again = frontier.giftRedeem({ code: minted.code, byEmail: 'c@test.com' });
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.error, 'already_redeemed');
});

check('universalCancel records intent without false 60s claim', () => {
  const r = frontier.universalCancel({ email: 'cancel@test.com', reason: 'test' });
  assert.strictEqual(r.ok, true);
  assert.ok(String(r.message || '').toLowerCase().includes('recorded'));
  assert.ok(!/within 60s/i.test(String(r.message || '')));
  assert.strictEqual(r.status, 'intent_recorded');
});

check('refundGuarantee exposes signed rules (not fake mode/windowHours)', () => {
  const g = frontier.refundGuarantee();
  assert.ok(Array.isArray(g.rules) && g.rules.length >= 3);
  assert.ok(g.signature);
  assert.ok(g.hash);
});

check('shell pageFrontier counts object inventions + workshop tools', () => {
  assert.ok(shellSrc.includes('function pageFrontier'));
  assert.ok(shellSrc.includes('Object.keys(inv).length'));
  assert.ok(shellSrc.includes('frWorkshop'));
  assert.ok(shellSrc.includes('/api/discount/timelocked'));
  assert.ok(shellSrc.includes('/api/gift/redeem'));
  assert.ok(shellSrc.includes('d.commitments'));
  assert.ok(shellSrc.includes('invCoverageGrid'));
  assert.ok(shellSrc.includes('/api/v50/status'));
  assert.ok(shellSrc.includes('destination-check'));
  assert.ok(shellSrc.includes('Transfer Intelligence'));
  assert.ok(shellSrc.includes("case '/innovation-log'"));
});

check('nginx routes frontier APIs to unicorn_site', () => {
  assert.ok(nginxSrc.includes('location ^~ /api/pledge'));
  assert.ok(nginxSrc.includes('location ^~ /api/gift/'));
  assert.ok(nginxSrc.includes('location ^~ /api/refund/'));
  assert.ok(nginxSrc.includes('location ^~ /api/bandit/'));
  assert.ok(nginxSrc.includes('location = /api/innovation/coverage'));
});

check('backend proxies frontier/coverage to site (SPA catch-all defense)', () => {
  assert.ok(backendSrc.includes("proxyToSite(req, res, '/api/pledge')"));
  assert.ok(backendSrc.includes("proxyToSite(req, res, '/api/innovation/coverage')"));
  assert.ok(backendSrc.includes("proxyPostToSite(req, res, '/api/gift/mint')"));
  assert.ok(backendSrc.includes("proxyPostToSite(req, res, '/api/gift/redeem')"));
  assert.ok(backendSrc.includes("proxyToSite(req, res, '/api/bandit/transparency')"));
});

check('cryptoBridge module exports mount + destination/fee tools', () => {
  const cb = require(path.join(ROOT, 'backend', 'modules', 'cryptoBridge', 'index.js'));
  assert.strictEqual(typeof cb.mount, 'function');
  const routes = [];
  const fakeApp = {
    get(p) { routes.push(['GET', p]); },
    post(p) { routes.push(['POST', p]); },
  };
  cb.mount(fakeApp);
  const paths = routes.map((r) => r[1]);
  assert.ok(paths.includes('/api/crypto-bridge/health'));
  assert.ok(paths.includes('/api/crypto-bridge/destination-check'));
  assert.ok(paths.includes('/api/crypto-bridge/fee-lock'));
  assert.ok(paths.includes('/api/crypto-bridge/smart-routing'));
});

console.log(`✅ pages-frontier-innov-bridge: ${passed} tests passed`);
process.exit(0);
