'use strict';

/**
 * seo-viral-desk.test.js — SVD/1.0
 *
 * SEO + viral organs already run. This desk names the missing secret
 * and keeps discovery APIs from falling through to the stale SPA.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('  ✓', name); });
  }
  passed += 1;
  console.log('  ✓', name);
  return undefined;
}

console.log('SEO + viral desk (SVD/1.0)');

check('desk never invents visitors, users, reach, or posts', () => {
  const desk = require('../backend/modules/seo-viral-desk').desk();
  assert.strictEqual(desk.protocol, 'SVD/1.0');
  assert.strictEqual(desk.ok, true);
  assert.strictEqual(desk.inventsVisitors, false);
  assert.strictEqual(desk.inventsUsers, false);
  assert.strictEqual(desk.inventsReach, false);
  assert.strictEqual(desk.inventsShares, false);
  assert.strictEqual(desk.inventsPosts, false);
  assert.ok(Array.isArray(desk.missingSecrets));
  assert.ok(desk.tokenless.relay === '/relay');
  assert.ok(desk.tokenless.share === '/share');
  assert.ok(/BING_WEBMASTER_API_KEY|GOOGLE_SERVICE_ACCOUNT_JSON|\/relay/.test(desk.nextHumanAction));
  assert.ok(!/millions of users|biggest site|guaranteed traffic/i.test(JSON.stringify(desk)));
});

check('backend proxies discovery APIs so nginx /api/ cannot serve the SPA', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes("proxyToSite(req, res, '/api/world-index')"));
  assert.ok(src.includes("proxyToSite(req, res, '/api/world-index/activation')"));
  assert.ok(src.includes("proxyToSite(req, res, '/api/share/targets')"));
  assert.ok(src.includes("proxyToSite(req, res, '/api/relay-graft')"));
  assert.ok(src.includes("app.get('/api/seo/status'"));
  assert.ok(src.includes('seo-viral-desk'));
});

check('nginx pins world-index / share / relay APIs to the site', () => {
  const conf = read('scripts/nginx-unicorn.conf');
  const i = conf.indexOf('location ^~ /api/world-index');
  assert.ok(i >= 0, 'world-index prefix pin');
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(i, i + 420)));
  const j = conf.indexOf('location = /api/share/targets');
  assert.ok(j >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(j, j + 420)));
  const k = conf.indexOf('location = /api/relay-graft');
  assert.ok(k >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(k, k + 420)));
});

check('SEO desk page names the two search secrets and the tokenless hop', () => {
  const seo = read('src/site/v2/seo-surface.js');
  assert.ok(seo.includes('BING_WEBMASTER_API_KEY'));
  assert.ok(seo.includes('GOOGLE_SERVICE_ACCOUNT_JSON'));
  assert.ok(seo.includes('/relay'));
  assert.ok(seo.includes('/api/seo/status'));
  assert.ok(!/millions of users|biggest site/i.test(seo));
});

check('AACOS skip stays a skip — viralizer is the designated poster', () => {
  const avg = read('backend/modules/autoViralGrowth.js');
  assert.ok(avg.includes('vuk_not_designated'));
  assert.ok(avg.includes('socialMediaViralizer'));
  assert.ok(avg.includes('/relay'));
});

check('test:chain includes seo-viral-desk.test.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('seo-viral-desk.test.js'));
});

console.log('\n✅ seo-viral-desk: ' + passed + ' tests passed');
process.exit(0);
