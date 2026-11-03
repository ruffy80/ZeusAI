'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shellPath = path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js');
const shell = fs.readFileSync(shellPath, 'utf8');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (err) {
    console.error('✗', name);
    console.error(err && err.stack || err);
    process.exit(1);
  }
}

function navBlock() {
  const start = shell.indexOf('function navBar(route)');
  const end = shell.indexOf('function footer(route, opts)', start);
  assert.ok(start >= 0 && end > start, 'navBar block must exist');
  return shell.slice(start, end);
}

check('public nav keeps exactly the customer-facing IA entries', () => {
  const nav = navBlock();
  const expected = [
    ['/', 'Home'],
    ['/products', 'Products'],
    ['/services', 'Marketplace'],
    ['/enterprise', 'Enterprise'],
    ['/pricing', 'Pricing'],
    ['/trust', 'Trust &amp; Security'],
    ['/docs', 'Developers'],
    ['/account', 'Account'],
  ];
  for (const [href, label] of expected) {
    assert.ok(nav.includes(`L('${href}', '${label}')`), `${href} ${label}`);
  }
});

check('public nav removes operator-facing top-level links', () => {
  const nav = navBlock();
  assert.ok(!nav.includes("L('/api-product', 'APIs')"));
  assert.ok(!nav.includes("L('/orchestrator', 'SDK')"));
  assert.ok(!nav.includes("L('/ledger', 'Ledger')"));
  assert.ok(!nav.includes("L('/report', 'Report')"));
});

check('nav has one primary CTA and keeps secondary support links', () => {
  const nav = navBlock();
  const primaryCount = (nav.match(/class="btn btn-primary"/g) || []).length;
  assert.equal(primaryCount, 1, 'one primary CTA in header');
  assert.ok(nav.includes('href="/products"') && nav.includes('Browse products'));
  assert.ok(nav.includes('href="/contact"') && nav.includes('Book Demo'));
  assert.ok(nav.includes('href="/telegram"') && nav.includes('Telegram'));
});

console.log(`✅ public-nav-ia: ${passed} tests passed`);
process.exit(0);
