'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const shell = require('../src/site/v2/shell');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

check('a shelf offer is a product page with its own checkout', () => {
  const html = shell.getHtml('/services/instant-resume-makeover');
  assert.ok(html.includes('instant-resume-makeover'));
  assert.ok(html.includes('data-sovereign-buy="instant-resume-makeover"'));
  assert.ok(!html.includes('data-server-module="1"'));
  assert.ok(!html.includes('name="robots" content="noindex, nofollow"') || html.includes('Instant Resume'));
});

check('a server module is not sold from its URL', () => {
  const html = shell.getHtml('/services/never-down-kernel');
  assert.ok(html.includes('data-server-module="1"'));
  assert.ok(html.includes('This stays on the server.'));
  assert.ok(html.includes('not for sale') || html.includes('not a product'));
  assert.ok(!html.includes('data-sovereign-buy="never-down-kernel"'));
  assert.ok(!html.includes('"@type":"Product"'));
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(html.includes('See what is for sale'));
});

check('the public menu does not advertise the organ sheet as a store', () => {
  const nav = shell.getHtml('/');
  const menu = nav.slice(nav.indexOf('id="nav-links"'), nav.indexOf('class="nav-cta"'));
  assert.ok(!menu.includes('/module-census'));
  assert.ok(menu.includes('/services'));
  assert.ok(menu.includes('/buy'));
});

check('the census page shows the shelf and keeps server files off the product grid', () => {
  const html = shell.getHtml('/module-census');
  assert.ok(html.includes('What you can buy'));
  assert.ok(html.includes('instant-website-audit'));
  assert.ok(html.includes('Creates or delivers a customer service'));
  assert.ok(html.includes('Every other module file works for Unicorn'));
  assert.ok(html.includes('A file name is not a customer delivery'));
  assert.ok(!html.includes('data-sovereign-buy="never-down-kernel"'));
});

check('hydration leaves a server-only page alone', () => {
  const client = fs.readFileSync(path.join(__dirname, '../src/site/v2/client.js'), 'utf8');
  assert.ok(client.includes("getAttribute('data-server-module') === '1'"));
});

console.log('shelf-server-split: ' + passed + ' checks passed');
process.exit(0);
