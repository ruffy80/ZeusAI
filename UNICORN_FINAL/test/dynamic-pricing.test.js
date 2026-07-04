'use strict';
/**
 * dynamic-pricing.test.js — Unit tests for backend/modules/dynamic-pricing.js
 *
 * Covers: getPrice, getAllPrices, registerService, registerServices, hasService,
 * activateSurge, setDiscount, getMarketConditions, getFallbackStatus, coupon
 * codes, volume discounts, loyalty discounts, and price clamping.
 */

const assert = require('assert');

// Isolate from side-effects of other modules that may auto-start servers
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const pricing = require('../backend/modules/dynamic-pricing');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── getPrice basics ──────────────────────────────────────────────────────────
console.log('Dynamic Pricing — getPrice basics');

check('returns an object with expected fields', () => {
  const result = pricing.getPrice('pro');
  assert.strictEqual(typeof result.finalPrice, 'number');
  assert.strictEqual(typeof result.basePrice, 'number');
  assert.strictEqual(result.serviceId, 'pro');
  assert.strictEqual(result.currency, 'USD');
  assert.strictEqual(typeof result.demandFactor, 'number');
  assert.strictEqual(typeof result.surgeActive, 'boolean');
});

check('known service uses registered BASE_PRICE', () => {
  const result = pricing.getPrice('starter');
  assert.strictEqual(result.basePrice, 29);
  assert.strictEqual(result.baseSource, 'registered');
});

check('accepts explicit basePrice via options', () => {
  const result = pricing.getPrice('custom-thing', { basePrice: 50 });
  assert.strictEqual(result.basePrice, 50);
  assert.strictEqual(result.baseSource, 'override');
});

check('unknown service falls back to $99 default', () => {
  const result = pricing.getPrice('nonexistent-xyz-abc-' + Date.now());
  assert.strictEqual(result.basePrice, 99);
  assert.strictEqual(result.baseSource, 'fallback-default');
});

check('finalPrice is always non-negative', () => {
  const result = pricing.getPrice('free');
  assert.ok(result.finalPrice >= 0, `Expected >= 0, got ${result.finalPrice}`);
});

check('finalPrice is clamped to 10,000,000 max', () => {
  // Use a very high base price to test the clamp
  const result = pricing.getPrice('extreme', { basePrice: 999999999 });
  assert.ok(result.finalPrice <= 10000000, `Expected <= 10M, got ${result.finalPrice}`);
});

// ── Coupons ─────────────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — Coupons');

check('UNICORN2026 coupon applies 30% discount', () => {
  const base = pricing.getPrice('pro', { basePrice: 100, fresh: true });
  const discounted = pricing.getPrice('pro', { basePrice: 100, coupon: 'UNICORN2026', fresh: true });
  // The coupon multiplies by 0.7, so discounted.finalPrice < base.finalPrice
  assert.ok(discounted.finalPrice < base.finalPrice,
    `Expected coupon price (${discounted.finalPrice}) < base price (${base.finalPrice})`);
});

check('LAUNCH50 coupon applies 50% discount', () => {
  const base = pricing.getPrice('starter', { basePrice: 100, fresh: true });
  const discounted = pricing.getPrice('starter', { basePrice: 100, coupon: 'LAUNCH50', fresh: true });
  assert.ok(discounted.finalPrice < base.finalPrice,
    `Expected coupon price (${discounted.finalPrice}) < base price (${base.finalPrice})`);
});

check('unknown coupon has no effect', () => {
  const a = pricing.getPrice('pro', { basePrice: 100, coupon: 'INVALID', fresh: true });
  const b = pricing.getPrice('pro', { basePrice: 100, fresh: true });
  assert.strictEqual(a.finalPrice, b.finalPrice);
});

// ── Volume discounts ────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — Volume discounts');

check('quantity >= 10 gets 15% discount', () => {
  const single = pricing.getPrice('pro', { basePrice: 200, quantity: 1, fresh: true });
  const bulk = pricing.getPrice('pro', { basePrice: 200, quantity: 10, fresh: true });
  assert.ok(bulk.finalPrice < single.finalPrice,
    `Expected bulk (${bulk.finalPrice}) < single (${single.finalPrice})`);
});

check('quantity >= 5 gets 8% discount', () => {
  const single = pricing.getPrice('pro', { basePrice: 200, quantity: 1, fresh: true });
  const mid = pricing.getPrice('pro', { basePrice: 200, quantity: 5, fresh: true });
  assert.ok(mid.finalPrice < single.finalPrice,
    `Expected mid (${mid.finalPrice}) < single (${single.finalPrice})`);
});

// ── Loyalty discount ────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — Loyalty discount');

check('userId gets 5% loyalty discount', () => {
  const anon = pricing.getPrice('starter', { basePrice: 100, fresh: true });
  const user = pricing.getPrice('starter', { basePrice: 100, userId: 'user-123', fresh: true });
  assert.ok(user.finalPrice < anon.finalPrice,
    `Expected user (${user.finalPrice}) < anon (${anon.finalPrice})`);
});

// ── registerService / hasService ────────────────────────────────────────────
console.log('\nDynamic Pricing — registerService');

check('registerService adds new service to BASE_PRICES', () => {
  const id = 'test-svc-' + Date.now();
  assert.strictEqual(pricing.hasService(id), false);
  const ok = pricing.registerService(id, 42);
  assert.strictEqual(ok, true);
  assert.strictEqual(pricing.hasService(id), true);
  assert.strictEqual(pricing.BASE_PRICES[id], 42);
});

check('registerService rejects invalid inputs', () => {
  assert.strictEqual(pricing.registerService('', 10), false);
  assert.strictEqual(pricing.registerService(null, 10), false);
  assert.strictEqual(pricing.registerService('x', -5), false);
  assert.strictEqual(pricing.registerService('x', NaN), false);
});

check('registerService with force:false does not overwrite', () => {
  const id = 'no-overwrite-' + Date.now();
  pricing.registerService(id, 100);
  pricing.registerService(id, 999, { force: false });
  assert.strictEqual(pricing.BASE_PRICES[id], 100);
});

// ── registerServices (bulk) ─────────────────────────────────────────────────
console.log('\nDynamic Pricing — registerServices');

check('registerServices registers multiple items', () => {
  const items = [
    { id: 'bulk-a-' + Date.now(), priceUsd: 10 },
    { id: 'bulk-b-' + Date.now(), priceUsd: 20 },
    { id: 'bulk-c-' + Date.now(), price: 30 },
  ];
  const count = pricing.registerServices(items);
  assert.strictEqual(count, 3);
  items.forEach(it => assert.strictEqual(pricing.hasService(it.id), true));
});

check('registerServices skips invalid entries', () => {
  const count = pricing.registerServices([null, {}, { id: '', price: 5 }]);
  assert.strictEqual(count, 0);
});

// ── getAllPrices ─────────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — getAllPrices');

check('getAllPrices returns object with known services', () => {
  const all = pricing.getAllPrices();
  assert.strictEqual(typeof all, 'object');
  assert.ok('pro' in all);
  assert.ok('starter' in all);
  assert.strictEqual(typeof all.pro.finalPrice, 'number');
});

// ── Surge pricing ───────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — Surge');

check('activateSurge sets surgeActive', () => {
  pricing.activateSurge('30min');
  const conditions = pricing.getMarketConditions();
  assert.strictEqual(conditions.surgeActive, true);
});

// ── Discount toggle ─────────────────────────────────────────────────────────
console.log('\nDynamic Pricing — Discount toggle');

check('setDiscount(false) disables global discount', () => {
  pricing.setDiscount(false);
  const conditions = pricing.getMarketConditions();
  assert.strictEqual(conditions.discountActive, false);
  pricing.setDiscount(true); // restore
});

// ── getMarketConditions ─────────────────────────────────────────────────────
console.log('\nDynamic Pricing — getMarketConditions');

check('returns expected shape', () => {
  const mc = pricing.getMarketConditions();
  assert.strictEqual(typeof mc.demandFactor, 'number');
  assert.strictEqual(typeof mc.peakHours, 'boolean');
  assert.strictEqual(typeof mc.surgeActive, 'boolean');
  assert.strictEqual(typeof mc.discountActive, 'boolean');
  assert.ok(Array.isArray(mc.history));
});

// ── getFallbackStatus ───────────────────────────────────────────────────────
console.log('\nDynamic Pricing — getFallbackStatus');

check('returns fallback tracking info', () => {
  const status = pricing.getFallbackStatus();
  assert.ok(Array.isArray(status.fallbackIds));
  assert.strictEqual(typeof status.fallbackCount, 'number');
  assert.strictEqual(typeof status.registeredCount, 'number');
  assert.ok(Array.isArray(status.registeredIds));
});

// ── ALLOWED_SURGE_DURATIONS_MS ──────────────────────────────────────────────
console.log('\nDynamic Pricing — ALLOWED_SURGE_DURATIONS_MS');

check('exports known duration keys', () => {
  const durations = pricing.ALLOWED_SURGE_DURATIONS_MS;
  assert.strictEqual(durations['30min'], 1800000);
  assert.strictEqual(durations['1h'], 3600000);
  assert.strictEqual(durations['24h'], 86400000);
});

console.log(`\n✅ dynamic-pricing: ${passed} tests passed\n`);
process.exit(0);
