'use strict';

/**
 * site-zero-defect.test.js — public surface contract fixes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Site zero-defect public surfaces');

check('site proxies /.well-known/agde.json to backend AGDE status', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("/.well-known/agde.json"));
  assert.ok(src.includes("siteProxyToUnicorn('/api/agde/status')"));
  assert.ok(src.includes("agde:              '/.well-known/agde.json'") || src.includes("agde:"));
});

check('nginx discovery includes agde.json location', () => {
  assert.ok(read('scripts/nginx-unicorn.conf').includes('location = /.well-known/agde.json'));
  assert.ok(read('scripts/nginx-public-discovery.snippet.conf').includes('location = /.well-known/agde.json'));
  assert.ok(read('scripts/nginx-patch-public-discovery.py').includes('agde.json'));
  assert.ok(read('scripts/deploy-local.sh').includes('agde.json'));
});

check('/referral aliases to /affiliate', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("'/referral': '/affiliate'"));
  assert.ok(src.includes("'/rss': '/feed.xml'") || src.includes("'/rss.xml': '/feed.xml'"));
});

check('/industries HTML navigations redirect to /verticals', () => {
  const src = read('src/index.js');
  const idx = src.indexOf("if (urlPath === '/industries')");
  assert.ok(idx > 0);
  const slice = src.slice(idx, idx + 900);
  assert.ok(slice.includes("Location: '/verticals'"));
  assert.ok(slice.includes('wantsHtml'));
});

check('IndexNow submits to Yandex and surfaces Bing verify note', () => {
  const src = read('backend/modules/traffic-engine.js');
  assert.ok(src.includes('yandex.com/indexnow'));
  assert.ok(src.includes('UserForbiddedToAccessSite') || src.includes('Bing Webmaster'));
  assert.ok(src.includes('errorCode'));
});

console.log(`\n✅ site-zero-defect: ${passed} tests passed`);
process.exit(0);
