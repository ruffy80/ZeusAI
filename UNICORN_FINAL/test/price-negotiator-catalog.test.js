'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const pn = require('../backend/modules/priceNegotiator');
const money = require('../src/commerce/money-catalog');
const instant = require('../src/commerce/instant-catalog');
const enterprise = require('../src/commerce/enterprise-catalog');

function expectNegotiated(row) {
  const floor = Number(row.priceUSD != null ? row.priceUSD : row.priceUsd);
  const quote = pn.getPriceSync(row.id, { userId: null, btcRate: 80000 });
  const expected = Math.round(floor * 0.9 * 100) / 100;
  assert.equal(quote.ok, true, row.id + ' ' + quote.error);
  assert.equal(quote.usd, expected, row.id + ' negotiated ' + quote.usd + ' floor ' + floor);
  assert.equal(quote.btc, (expected / 80000).toFixed(8), row.id);
  assert.notEqual(quote.baseSource, 'fallback-default', row.id);
}

const rows = []
  .concat(instant.all() || [])
  .concat(enterprise.all() || [])
  .concat(money.shelfRows() || []);
assert.ok(rows.length >= 55, 'catalog should cover the public shelf');
for (const row of rows) {
  if (!row || !row.id || !(Number(row.priceUSD || row.priceUsd) > 0)) continue;
  expectNegotiated(row);
}

const unknown = pn.getPriceSync('nonexistent-xyz-abc-price-check', { userId: null, btcRate: 80000 });
assert.equal(unknown.ok, false);
assert.equal(unknown.error, 'no_catalog_price');

const audit = pn.getPriceSync('website-audit', { userId: null, btcRate: 80000 });
assert.equal(audit.ok, true);
assert.equal(audit.serviceId, 'instant-website-audit');
assert.equal(audit.usd, 44.1);

console.log('price-negotiator-catalog.test.js: ok', rows.length);
