'use strict';

/**
 * world-index-os.test.js — WIVP/1.0 World Index Visibility
 * Honest discovery: IndexNow inventory, OG pages, no invented visitors.
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

console.log('World Index Visibility Protocol (WIVP/1.0)');

const wivp = require('../src/commerce/world-index-os');

check('discovery never invents visitors or users', () => {
  const d = wivp.discovery();
  assert.strictEqual(d.protocol, 'WIVP/1.0');
  assert.strictEqual(d.inventsVisitors, false);
  assert.strictEqual(d.inventsUsers, false);
  assert.strictEqual(d.inventsHumans, false);
  assert.strictEqual(d.inventsGmv, false);
  assert.strictEqual(d.inventsReach, false);
  assert.strictEqual(d.inventsCrawlCounts, false);
  assert.equal(typeof d.paidHumans, 'number');
  assert.ok(d.whyZeroVisitors && d.whyZeroVisitors.code);
  assert.ok(Array.isArray(d.operatorChecklist) && d.operatorChecklist.length >= 5);
  assert.ok(!/millions of users|nemaivazut|biggest site/i.test(JSON.stringify(d)));
});

check('visibleWorldHtml ships OG + JSON-LD and stays honest', () => {
  const html = wivp.visibleWorldHtml();
  assert.ok(html.includes('og:image'));
  assert.ok(html.includes('twitter:card'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('WIVP/1.0'));
  assert.ok(html.includes('inventsVisitors'));
  assert.ok(!/trusted by thousands|millions of users|billions of dollars in traffic/i.test(html));
});

check('shareHead includes canonical og:image', () => {
  const head = wivp.shareHead({ title: 'T', description: 'D', path: '/visible-world' });
  assert.ok(head.includes('property="og:image"'));
  assert.ok(head.includes('/visible-world'));
  assert.ok(wivp.ogImageUrl().includes('og-default'));
});

check('googleHtmlVerification is inert without a token', () => {
  delete process.env.GOOGLE_SITE_VERIFICATION_TOKEN;
  delete process.env.GSC_HTML_TOKEN;
  assert.strictEqual(wivp.googleHtmlVerification(), null);
  process.env.GOOGLE_SITE_VERIFICATION_TOKEN = 'abcXYZ123';
  const gsc = wivp.googleHtmlVerification();
  assert.strictEqual(gsc.path, '/googleabcXYZ123.html');
  assert.ok(gsc.body.includes('google-site-verification'));
  delete process.env.GOOGLE_SITE_VERIFICATION_TOKEN;
});

check('indexNowPriorityUrls cover money + visibility surfaces', () => {
  const urls = wivp.indexNowPriorityUrls('https://zeusai.pro');
  const joined = urls.join('\n');
  for (const p of ['/buy', '/first-dollar', '/visible-world', '/.well-known/world-index.json']) {
    assert.ok(joined.includes('https://zeusai.pro' + p), p);
  }
});

check('site + nginx + sitemap + traffic-engine are wired', () => {
  const site = read('src/index.js');
  assert.ok(site.includes('/.well-known/world-index.json'));
  assert.ok(site.includes("urlPath === '/visible-world'"));
  assert.ok(site.includes('worldIndex:'));
  const nginx = read('scripts/nginx-unicorn.conf');
  const idx = nginx.indexOf('location = /.well-known/world-index.json');
  assert.ok(idx >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(nginx.slice(idx, idx + 420)));
  const seo = read('src/seo/sitemap-helpers.js');
  assert.ok(seo.includes("'/visible-world'"));
  const te = read('backend/modules/traffic-engine.js');
  assert.ok(te.includes('/visible-world'));
  assert.ok(te.includes('world-index.json'));
  const sov = read('src/site/sovereign-extensions.js');
  assert.ok(sov.includes('World Index'));
  assert.ok(sov.includes('world-index.json'));
});

check('programmatic-seo IndexNow payload includes keyLocation', () => {
  const src = read('backend/modules/marketing-innovations/programmatic-seo.js');
  assert.ok(src.includes('keyLocation'));
  assert.ok(src.includes('resolveIndexNowKey'));
});

check('stale SPA public robots/sitemap no longer advertise unicorn.vladoi.io', () => {
  const robots = read('client/public/robots.txt');
  const sm = read('client/public/sitemap.xml');
  assert.ok(!robots.includes('unicorn.vladoi.io'));
  assert.ok(!sm.includes('unicorn.vladoi.io'));
  assert.ok(robots.includes('zeusai.pro'));
  assert.ok(sm.includes('zeusai.pro'));
});

check('backend warns when IndexNow is parked', () => {
  const src = read('backend/index.js');
  assert.ok(src.includes('TRAFFIC_ENGINE_DISABLED=1 — IndexNow will not ping'));
});

check('test:chain includes world-index-os.test.js', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(String(pkg.scripts['test:chain']).includes('world-index-os.test.js'));
});

async function main() {
  const pseo = require('../backend/modules/marketing-innovations/programmatic-seo');
  const idx = await pseo.indexNowPing({ host: 'zeusai.pro', urls: ['https://zeusai.pro/visible-world'] });
  assert.ok(idx.ok === false || idx.dryRun === true);
  if (idx.payload) {
    assert.ok(idx.payload.keyLocation && idx.payload.keyLocation.includes('zeusai.pro'));
    assert.ok(idx.payload.key);
  }
  passed += 1;
  console.log('  ✓ programmatic-seo IndexNow dryRun has keyLocation');

  console.log(`\n✅ world-index-os: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ world-index-os failed:', err);
  process.exit(1);
});
