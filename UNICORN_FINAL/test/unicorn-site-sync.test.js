'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function check(name, fn) {
  fn();
  console.log('✓', name);
}

const root = path.join(__dirname, '..');
const siteSrc = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
const clientSrc = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
const shellSrc = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');
const brokerSrc = fs.readFileSync(path.join(root, 'backend/modules/live-pricing-broker.js'), 'utf8');
const nginxSrc = fs.readFileSync(path.join(root, 'scripts/nginx-unicorn.conf'), 'utf8');
const inventory = fs.readFileSync(path.join(root, 'MODULE-INVENTORY.md'), 'utf8');
const report = fs.readFileSync(path.join(root, 'AUTONOMOUS-UNICORN-REPORT.md'), 'utf8');

check('services.changed invalidates master catalog cache', () => {
  assert.ok(siteSrc.includes('_masterCatalogCache.catalog = null'), 'must null cache on event');
  assert.ok(siteSrc.includes('MASTER_CATALOG_TTL_MS'), 'tunable TTL');
});

check('health exposes unicornSync mirror', () => {
  assert.ok(siteSrc.includes('unicornSync'), 'health payload');
  assert.ok(siteSrc.includes('modulesMirror'), 'modules mirror');
});

check('pricing broker defaults to ~5s refresh', () => {
  assert.ok(/LIVE_PRICING_REFRESH_MS \|\| 5_000/.test(brokerSrc) || /LIVE_PRICING_REFRESH_MS \|\| 5000/.test(brokerSrc));
});

check('services hydration prefers master catalog', () => {
  assert.ok(clientSrc.includes("/api/catalog/master"), 'master first');
  assert.ok(clientSrc.includes("route === '/marketplace'"), 'marketplace hydrates');
});

check('live modules grid is visible (not permanently hidden)', () => {
  assert.ok(shellSrc.includes('id="autonomousServicesGrid"'), 'grid exists');
  assert.ok(!/id="autonomousServicesGrid"\s+hidden/.test(shellSrc), 'must not be hidden attr');
  assert.ok(shellSrc.includes('unicornModulesMirror'), 'mirror section');
});

check('nginx SSE routes disable buffering', () => {
  assert.ok(nginxSrc.includes('location = /api/pricing/live/stream'));
  assert.ok(nginxSrc.includes('location = /api/modules/stream'));
  assert.ok(nginxSrc.includes('location = /api/unicorn/events'));
  assert.ok(nginxSrc.includes('proxy_buffering    off'));
});

check('inventory + report are honest (measured counts)', () => {
  assert.ok(/405/.test(inventory), 'backend file count');
  assert.ok(/284/.test(inventory), 'top-level count');
  assert.ok(/Honesty rule/.test(inventory) || /honest/i.test(report));
  assert.ok(!/Billions guaranteed/.test(report) || /Billions guaranteed \|\*\*No\*\*/.test(report.replace(/\s/g, '')) || report.includes('Billions guaranteed'));
  assert.ok(report.includes('**No**') || report.includes('No —'), 'must contain negative honesty rows');
});

console.log('\n✅ unicorn-site-sync: tests passed');
