'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssw-'));
const queryFile = path.join(tmp, 'queries.json');
const saleDir = path.join(tmp, 'sales');
const viewFile = path.join(tmp, 'views.jsonl');
fs.mkdirSync(saleDir);
fs.writeFileSync(queryFile, JSON.stringify([
  { query: 'website audit bitcoin', clicks: 0, impressions: 4 },
  { query: 'empty phrase', clicks: 0, impressions: 0 },
  { query: 'x', clicks: 2, impressions: 2 },
]));
fs.writeFileSync(path.join(saleDir, 'ord-real.json'), JSON.stringify({
  orderId: 'ord-real',
  serviceId: 'instant-website-audit',
  mock: false,
  paidAt: '2026-10-28T00:00:00.000Z',
  email: 'buyer@example.com',
}));
fs.writeFileSync(path.join(saleDir, 'ord-drill.json'), JSON.stringify({
  orderId: 'ord-drill',
  serviceId: 'instant-website-audit',
  mock: true,
  txid: 'simulated-1',
  email: 'drill@example.com',
}));

process.env.SSW_QUERY_FILE = queryFile;
process.env.SSW_SALE_DIR = saleDir;
process.env.SSW_VIEW_FILE = viewFile;

const witness = require('../backend/modules/sale-search-witness');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓ ' + name);
}

check('measured query with impressions becomes one page', () => {
  const rows = witness.queryPages();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].query, 'website audit bitcoin');
  assert.equal(rows[0].path, '/witness/q/website-audit-bitcoin');
});

check('a drill delivery does not become a public sale page', () => {
  const rows = witness.salePages();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'ord-real');
});

check('query page names the Search Console numbers and the offer', () => {
  const page = witness.render('/witness/q/website-audit-bitcoin');
  assert.equal(page.status, 200);
  assert.ok(page.html.includes('website audit bitcoin'));
  assert.ok(page.html.includes('Impressions: 4'));
  assert.ok(page.html.includes('/services/instant-website-audit'));
  assert.ok(!page.html.includes('buyer@example.com'));
});

check('sale page omits the buyer email', () => {
  const page = witness.render('/witness/sale/ord-real');
  assert.equal(page.status, 200);
  assert.ok(page.html.includes('ord-real'));
  assert.ok(!page.html.includes('buyer@example.com'));
  assert.ok(!page.html.includes('drill@example.com'));
});

check('visitor count is the render ledger, not a forecast', () => {
  assert.equal(witness.viewCount(), 0);
  witness.recordView('/witness');
  witness.recordView('/witness/q/website-audit-bitcoin');
  const body = witness.status();
  assert.equal(body.inventsVisitors, false);
  assert.equal(body.inventsQueries, false);
  assert.equal(body.inventsSales, false);
  assert.equal(body.visitors, 2);
  assert.equal(body.queryPages, 1);
  assert.equal(body.salePages, 1);
});

check('site and backend expose the witness', () => {
  const site = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '..', 'backend', 'index.js'), 'utf8');
  assert.ok(site.includes('/api/sale-search-witness'));
  assert.ok(site.includes("urlPath === '/witness'"));
  assert.ok(backend.includes('/api/sale-search-witness'));
  assert.ok(site.includes('sale-search-witness'));
});

console.log('sale-search-witness: ' + passed + ' checks passed');
