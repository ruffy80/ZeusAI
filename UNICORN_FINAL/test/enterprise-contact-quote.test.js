'use strict';

/**
 * enterprise-contact-quote.test.js
 * Ensures the enterprise contact → deal-desk quote path stays wired
 * (lead response includes a BTC quote payload when buildQuote succeeds).
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const desk = require('../backend/modules/enterprise-deal-desk');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
}

console.log('enterprise contact → quote tests');

check('buildQuote returns btcUri for enterprise starter interest', () => {
  const quote = desk.buildQuote({
    items: [{ id: 'enterprise-starter', title: 'Enterprise starter', priceUsd: 2500 }],
    seats: 5,
    slaTier: 'enterprise',
    customerId: 'lead@example.com',
    btcSpotUsd: 100000,
  });
  assert.ok(quote.id);
  assert.ok(quote.netUsd > 0);
  assert.ok(quote.btcAmount > 0);
  assert.ok(String(quote.btcUri || '').startsWith('bitcoin:'));
});

check('buildQuote rejects empty items', () => {
  let err = null;
  try { desk.buildQuote({ items: [] }); } catch (e) { err = e; }
  assert.ok(err);
  assert.equal(err.code, 'items_required');
});

check('src/index.js wires contact → buildQuote', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(src.includes("urlPath === '/api/enterprise/contact'"));
  assert.ok(src.includes('enterprise-deal-desk'));
  assert.ok(src.includes('desk.buildQuote') || src.includes('.buildQuote('));
  assert.ok(src.includes('enterprise-quotes.jsonl'));
  assert.ok(src.includes('btcUri'));
});

console.log(`\n✅ enterprise-contact-quote: ${passed} tests passed`);
