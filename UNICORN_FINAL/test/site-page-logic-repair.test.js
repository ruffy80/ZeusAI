'use strict';
/**
 * Guards the site-page logic repair (2026-07):
 *  - nested data-reveal must not leave marketplace/catalog invisible
 *  - Buy CTAs must not race SPA data-link vs sovereign checkout
 *  - /store must preserve SSR when instant catalog is empty
 *  - alias routes must redirect (not homepage clone)
 *  - modules mirror seeds from GET /api/modules
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const client = read('src/site/v2/client.js');
const styles = read('src/site/v2/styles.js');
const shell = read('src/site/v2/shell.js');
const site = read('src/index.js');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

check('reveal helper keeps commerce sections visible', () => {
  assert.ok(client.includes('_sectionMustStayVisible'), 'helper present');
  assert.ok(client.includes("id === 'autonomousLiveSection'"), 'services section protected');
  assert.ok(client.includes('unicornModulesMirror'), 'modules section protected');
  assert.ok(/sections\.forEach\(function\(s\)\{\s*s\.classList\.add\('revealed'\)/.test(client)
    || client.includes("sections.forEach(function(s){ s.classList.add('revealed'); })"),
    'force-reveal all sections after timeout');
});

check('CSS never leaves commerce at opacity 0', () => {
  assert.ok(styles.includes('#autonomousLiveSection'), 'css protect live section');
  assert.ok(styles.includes('#unicornModulesMirror'), 'css protect modules');
  assert.ok(styles.includes('opacity:1!important') || styles.includes('opacity: 1 !important'), 'force visible');
});

check('Buy CTAs use sovereign without data-link race', () => {
  assert.ok(client.includes("data-sovereign-buy=\"' + idAttr + '\""), 'hydrated buy sovereign');
  assert.ok(!/data-link data-sovereign-buy/.test(client), 'no dual data-link+sovereign on buy');
  assert.ok(client.includes('stopImmediatePropagation'), 'stops competing handlers');
  assert.ok(shell.includes('data-sovereign-buy="${id}"'), 'SSR catalog cards sovereign');
});

check('store hydrate preserves SSR on empty API', () => {
  assert.ok(client.includes('ssrCards'), 'ssr card count');
  assert.ok(client.includes('Showing server-rendered catalog'), 'preserve path message');
  assert.ok(client.includes("grid.dataset.storeTabsWired"), 'tabs bound once');
});

check('modules mirror seeds from public /api/modules/list', () => {
  assert.ok(client.includes('seedAutonomousModulesFromApi'), 'seed fn');
  assert.ok(client.includes("/api/modules/list"), 'public list first');
  assert.ok(client.includes('/api/modules/stream'), 'SSE modules stream');
  assert.ok(client.includes('seedAutonomousModulesFromApi()'), 'called on subscribe');
});

check('nginx routes site BFF /api/modules + /api/events', () => {
  const nginx = read('scripts/nginx-unicorn.conf');
  assert.ok(nginx.includes('location = /api/modules'), 'modules location');
  assert.ok(nginx.includes('location = /api/events'), 'events location');
  assert.ok(/location = \/api\/modules \{[\s\S]*?unicorn_site/.test(nginx), 'modules → site');
  assert.ok(/location = \/api\/events \{[\s\S]*?unicorn_site/.test(nginx), 'events → site');
});

check('alias routes redirect instead of homepage clone', () => {
  assert.ok(site.includes("'/unicorn': '/unicorn-cockpit'"), 'unicorn alias');
  assert.ok(site.includes("'/catalog': '/services'"), 'catalog alias');
  assert.ok(site.includes("'/orders': '/account'"), 'orders alias');
  assert.ok(site.includes("'/wallet': '/account'"), 'wallet alias');
  assert.ok(site.includes("v2.getHtml('/__not-found__'"), '404 page');
  assert.ok(site.includes("writeHead(404"), '404 status');
});

check('marketplace/modules SPA partials redirect to HTML', () => {
  assert.ok(site.includes("x-unicorn-partial") && site.includes("'/marketplace'"), 'marketplace partial');
  assert.ok(site.includes('/services#unicornModulesMirror'), 'modules → services mirror');
});

check('hydratePage does not run master catalog on /store', () => {
  assert.ok(client.includes("route === '/services' || route === '/marketplace'"), 'services+marketplace only');
  assert.ok(!/route === '\/services' \|\| route === '\/marketplace' \|\| route === '\/store'/.test(client),
    'store must not call hydrateMasterCatalog');
});

console.log('\n✅ site-page-logic-repair: tests passed');
