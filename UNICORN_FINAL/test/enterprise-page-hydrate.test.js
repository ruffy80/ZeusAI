'use strict';

/**
 * The public enterprise page sells catalog packs and a note to the owner.
 * Hydration must not paint floor/anchor/topstone cards or a computed ACV desk.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
const shellSrc = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');

function sliceFn(src, name, next) {
  const start = src.indexOf('async function ' + name);
  const alt = start >= 0 ? start : src.indexOf('function ' + name);
  const end = src.indexOf('function ' + next, alt + 1);
  assert.ok(alt >= 0 && end > alt, name + ' slice');
  return src.slice(alt, end);
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('enterprise SSR lists catalog packs and the owner form', () => {
  const shell = require('../src/site/v2/shell');
  const html = shell.getHtml('/enterprise');
  assert.ok(html.includes('Write to the owner'));
  assert.ok(html.includes('Send to the owner'));
  assert.ok(html.includes('does not mint a contract'));
  assert.ok(html.includes('data-product-id="ent-engagement-kickoff"'));
  assert.ok(!html.includes('data-product-id="ent-acquisition-pack"'));
  assert.ok(!html.includes('data-product-id="ent-sovereign-deployment"'));
  assert.ok(!html.includes('$4,000,000'));
  assert.ok(html.includes('href="/checkout/?plan=ent-engagement-kickoff"'));
  assert.ok(html.includes('Buy the engagement pack →'));
  assert.ok(!html.includes('id="entNegotiator"'));
  assert.ok(!/>Floor</.test(html));
  assert.ok(!/>Anchor</.test(html));
  assert.ok(!/>Topstone</.test(html));
  assert.ok(!html.includes('Start Autonomous Deal'));
});

check('hydrateEnterprise paints the catalog price and leaves checkout alone', () => {
  const card = sliceFn(client, 'entPackCard', 'hydrateEnterprise');
  const fn = sliceFn(client, 'hydrateEnterprise', 'wireEnterpriseContactForm');
  assert.ok(card.includes('Buy the engagement pack →'));
  assert.ok(card.includes('/checkout/?plan='));
  assert.ok(card.includes('entPackNote'));
  assert.ok(fn.includes("api('/api/enterprise/catalog')"));
  assert.ok(fn.includes('priceUSD'));
  assert.ok(fn.includes('entPackCard'));
  assert.ok(!fn.includes('openEntNegotiator'));
  assert.ok(!fn.includes('renderEntDeals'));
  assert.ok(!fn.includes('floorFmt'));
  assert.ok(!fn.includes('>Floor<'));
  assert.ok(!fn.includes('Negotiate ACV'));
  assert.ok(!card.includes('floorFmt'));
});

check('the owner form does not revive the autonomous deal desk', () => {
  const fn = sliceFn(client, 'wireEnterpriseContactForm', 'openEntNegotiator');
  assert.ok(fn.includes('Send to the owner'));
  assert.ok(fn.includes("fetch('/api/enterprise/contact'"));
  assert.ok(fn.includes('/checkout/?plan='));
  assert.ok(fn.includes('did not compute a private contract value'));
  assert.ok(!fn.includes('Start Autonomous Deal'));
  assert.ok(!fn.includes('Negotiate ACV'));
  assert.ok(!fn.includes('AEDO'));
  assert.ok(!fn.includes('openEntNegotiator'));
  assert.ok(!fn.includes('acvMid'));
});

check('shell source still has the viewport-safe enterprise grid', () => {
  assert.ok(shellSrc.includes('minmax(min(380px,100%),1fr)'));
  assert.ok(shellSrc.includes('id="entProductsGrid"'));
});

console.log('enterprise-page-hydrate: ' + passed + ' checks passed');
process.exit(0);
