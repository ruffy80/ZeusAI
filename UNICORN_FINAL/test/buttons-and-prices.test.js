/**
 * buttons-and-prices.test.js — architectural regression guard for the two
 * defects reported on 2026-05-09 against zeusai.pro:
 *
 *   1. Prices on the marketplace / home / pricing pages bore no relation to
 *      the catalog (instant-pitch-deck SSR=$72 vs catalog=$149,
 *      unicorn-billion-scale-activation engine=$80 vs catalog=$500,000).
 *      Root cause: dynamic-pricing.js BASE_PRICES table only has 14 SaaS
 *      tier ids, so every catalog product fell back to a generic $99 base.
 *
 *   2. Filter chips on /services and the home grid (All / Instant /
 *      Professional / Enterprise) plus several CTAs were dead.
 *      Root cause: SSR chips emit data-group= but the only chip handler in
 *      client.js bound itself to data-cat= chips it built dynamically.
 *
 * This test is static (no server boot) and verifies four invariants:
 *   • dynamic-pricing.js exposes registerService / registerServices /
 *     hasService and getPrice() honors options.basePrice.
 *   • shell.js _loadCatalog passes a basePrice override into dp.getPrice().
 *   • src/index.js seeds the engine from unifiedCatalog/instantCatalog/
 *     entCatalog at boot AND has a recompute-with-real-base path on the
 *     /api/pricing/:serviceId proxy.
 *   • client.js binds a delegated handler on `[data-group]` chips that
 *     filters cards by `[data-tier]` on the live page.
 *   • client.js runs the visible-button audit on hydrate.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------- 1) dynamic-pricing.js · engine extension ----------
const DP = read('backend/modules/dynamic-pricing.js');
assert.ok(/options\.basePrice/.test(DP),
  'dynamic-pricing.js must accept options.basePrice override');
assert.ok(/function registerService\s*\(/.test(DP),
  'dynamic-pricing.js must export registerService(id, basePrice)');
assert.ok(/function registerServices\s*\(/.test(DP),
  'dynamic-pricing.js must export registerServices(items)');
assert.ok(/function hasService\s*\(/.test(DP),
  'dynamic-pricing.js must export hasService(id)');
assert.ok(/baseSource/.test(DP),
  'dynamic-pricing.js getPrice() must surface baseSource so callers can detect fallback-default');
assert.ok(/registerService\s*,\s*registerServices\s*,\s*hasService/.test(DP) ||
  /registerService,\s*registerServices,\s*hasService/.test(DP),
  'dynamic-pricing.js must export the new functions');

// Live behavior probe — load the module and verify override + register work.
delete require.cache[require.resolve(path.join(ROOT, 'backend/modules/dynamic-pricing'))];
const dp = require(path.join(ROOT, 'backend/modules/dynamic-pricing'));
assert.strictEqual(typeof dp.registerService, 'function');
assert.strictEqual(typeof dp.registerServices, 'function');
assert.strictEqual(typeof dp.hasService, 'function');
const before = dp.getPrice('test-id-' + Date.now());
assert.strictEqual(before.basePrice, 99,
  'unknown id must default to 99 base when no override');
assert.strictEqual(before.baseSource, 'fallback-default');
const withOverride = dp.getPrice('test-id-override', { basePrice: 50000 });
assert.strictEqual(withOverride.basePrice, 50000,
  'options.basePrice must override the table');
assert.strictEqual(withOverride.baseSource, 'override');
assert.ok(withOverride.finalPrice >= 50000 * 0.4 && withOverride.finalPrice <= 50000 * 2.0,
  'finalPrice must scale with override base (got ' + withOverride.finalPrice + ' from base 50000)');
const seeded = 'instant-pitch-deck-' + Date.now();
assert.strictEqual(dp.registerService(seeded, 149), true);
assert.strictEqual(dp.hasService(seeded), true);
const afterSeed = dp.getPrice(seeded);
assert.strictEqual(afterSeed.basePrice, 149);
assert.strictEqual(afterSeed.baseSource, 'registered');

// ---------- 2) shell.js · SSR uses basePrice override ----------
const SHELL = read('src/site/v2/shell.js');
assert.ok(/dp\.getPrice\([^)]*basePrice/.test(SHELL),
  'shell.js must pass basePrice into dp.getPrice() so the demand factor multiplies the catalog floor, not $99');
assert.ok(/dp\.registerService/.test(SHELL),
  'shell.js must register catalog ids with the engine for cross-process /api/pricing/{id}');
assert.ok(/baseSource\s*!==\s*['"]fallback-default['"]/.test(SHELL),
  'shell.js must reject the engine fallback so we never show a wrong $80 instead of the catalog price');

// ---------- 3) src/index.js · boot-time seeding + proxy correction ----------
const SITE = read('src/index.js');
assert.ok(/dynamicPricingEngine\.registerServices/.test(SITE),
  'src/index.js must seed the dynamic-pricing engine from the catalogs at boot');
assert.ok(/unifiedCatalog\.all\(\)/.test(SITE) && /instantCatalog\.all\(\)/.test(SITE) && /entCatalog\.all\(\)/.test(SITE),
  'src/index.js must seed from unified + instant + enterprise catalogs');
assert.ok(/_recomputeWithRealBase/.test(SITE),
  'src/index.js /api/pricing/:serviceId must have the recompute-with-real-base correction path');
assert.ok(/\/default\/i\.test\(upstream\.source\)/.test(SITE) || /\/default\/i\.test/.test(SITE),
  'src/index.js must detect the engine fallback-default response and override locally');
assert.ok(/'\/api\/site\/log'/.test(SITE),
  'src/index.js must accept the button-audit beacon at /api/site/log');

// ---------- 4) client.js · SSR chip handler + audit ----------
const CLIENT = read('src/site/v2/client.js');
assert.ok(/button\.chip\[data-group\]|chip\[data-group\]/.test(CLIENT),
  'client.js must have a delegated handler matching SSR `[data-group]` chips');
assert.ok(/data-tier/.test(CLIENT) && /catalogGrid|homeFeaturedGrid/.test(CLIENT),
  'client.js chip handler must filter by data-tier across catalogGrid + homeFeaturedGrid');
assert.ok(/_auditButtonsForMissingHandlers/.test(CLIENT),
  'client.js must run a visible-button audit on hydrate');
assert.ok(/sendBeacon\([^)]*\/api\/site\/log/.test(CLIENT),
  'client.js audit must beacon to /api/site/log when CTAs are dead');

console.log('✓ buttons-and-prices: dynamic-pricing engine accepts basePrice override + register API');
console.log('✓ buttons-and-prices: shell.js SSR multiplies demand on catalog floor');
console.log('✓ buttons-and-prices: src/index.js seeds engine + corrects proxy fallback');
console.log('✓ buttons-and-prices: client.js binds SSR chip filter + dead-CTA audit');
process.exit(0);
