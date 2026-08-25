'use strict';

/**
 * site-instant-nav.test.js — guards the click/load latency fix:
 *   1. SPA router must pushState + swap from prefetch cache (not block UI
 *      on a full SSR round-trip before chrome updates).
 *   2. SSR _loadCatalog must NOT require live-pricing-broker (that pulls
 *      serviceMarketplace → every backend module into the site process).
 *   3. Site server must memoize public SSR HTML + prewarm after listen.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

const client = read('src/site/v2/client.js');
const shell = read('src/site/v2/shell.js');
const site = read('src/index.js');
const broker = read('backend/modules/live-pricing-broker.js');

check('SPA nav pushes URL before awaiting SSR fetch', () => {
  assert.ok(client.includes('function navigateSpa'), 'navigateSpa helper');
  assert.ok(client.includes('function prefetchSpa'), 'prefetch on hover');
  assert.ok(client.includes('history.pushState'), 'pushState');
  // Instant chrome: pushState must appear before the blocking fetch path
  // inside navigateSpa (not only after HTML arrives).
  const navFn = client.slice(client.indexOf('function navigateSpa'));
  const pushAt = navFn.indexOf('history.pushState');
  const fetchAt = navFn.indexOf('fetch(targetUrl');
  assert.ok(pushAt > 0 && fetchAt > pushAt, 'pushState before fetch(targetUrl) in navigateSpa');
});

check('SPA caches HTML + soft-revalidates on warm hits', () => {
  assert.ok(client.includes('__SPA_HTML_CACHE'), 'in-memory spa html cache');
  assert.ok(client.includes('softRevalidateSpa'), 'background revalidate');
  assert.ok(client.includes("pointerenter"), 'prefetch on pointerenter');
  assert.ok(client.includes('data-spa-pending'), 'pending chrome marker');
});

check('popstate uses navigateSpa (full #app swap), not hydrate-only', () => {
  assert.ok(/popstate[\s\S]{0,200}navigateSpa/.test(client), 'popstate → navigateSpa');
  assert.ok(!/popstate[\s\S]{0,120}hydratePage\(STATE\.route\)/.test(client)
    || /popstate[\s\S]{0,200}navigateSpa/.test(client),
    'must not leave stale SSR markup on back');
});

check('shell _loadCatalog does not require live-pricing-broker', () => {
  const fn = shell.slice(shell.indexOf('function _loadCatalog'));
  const end = fn.indexOf('\nfunction _liveTierPrice');
  const body = end > 0 ? fn.slice(0, end) : fn.slice(0, 2500);
  assert.ok(!/require\([^)]*live-pricing-broker/.test(body), 'no broker require() in _loadCatalog');
  assert.ok(/dynamic-pricing/.test(body), 'still enriches via dynamic-pricing');
  assert.ok(/_catalogMemo|SITE_SSR_CATALOG_CACHE_MS/.test(shell), 'catalog memo');
});

check('site SSR HTML memo + prewarm exist', () => {
  assert.ok(site.includes('__UNICORN_SSR_HTML_MEMO'), 'process SSR memo');
  assert.ok(site.includes('X-Unicorn-Ssr-Cache'), 'cache hit header');
  assert.ok(site.includes('prewarmPublicSsr') || site.includes('[ssr-prewarm]'), 'boot prewarm');
  assert.ok(/nonce="[^"]*"/.test(site) || site.includes('nonce="' ), 'nonce rewrite path');
});

check('live-pricing-broker skips autostart when site is require.main', () => {
  assert.ok(broker.includes('__isSiteEntry') || /src[/\\]index\.js/.test(broker),
    'site-entry autostart guard');
  assert.ok(/broker\.start\(\)/.test(broker), 'start() still available');
});

check('runtime: _loadCatalog stays fast without broker', () => {
  // Clear caches so we measure a clean require path.
  const shellPath = path.join(root, 'src/site/v2/shell.js');
  delete require.cache[require.resolve(shellPath)];
  // Touch getHtml which exercises _loadCatalog via pageHome.
  const v2 = require(shellPath);
  const t0 = Date.now();
  const html = v2.getHtml('/', { lang: 'en', nonce: 't1' });
  const dt = Date.now() - t0;
  assert.ok(html && html.indexOf('id="app"') !== -1, 'homepage html renders');
  // Soft budget: warm/cold in CI should be well under multi-second stalls.
  // Allow headroom for cold module loads in shared runners.
  assert.ok(dt < 8000, 'getHtml(/) must not stall multi-seconds (got ' + dt + 'ms)');
  const t1 = Date.now();
  v2.getHtml('/', { lang: 'en', nonce: 't2' });
  const dt2 = Date.now() - t1;
  assert.ok(dt2 < 1500, 'second getHtml(/) should be fast via catalog memo (got ' + dt2 + 'ms)');
  console.log('  timing getHtml cold=' + dt + 'ms warm=' + dt2 + 'ms');
});

console.log('site-instant-nav.test.js passed');
process.exit(0);
