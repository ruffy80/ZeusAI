'use strict';

/**
 * search-essentials.test.js
 * Google Search Central rules that this site can apply with one English document:
 * noindex pages stay crawlable, FAQ and breadcrumb markup match the visible page,
 * and the advertised shelf search returns results in the HTML.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const shell = require('../src/site/v2/shell');
const seo = require('../src/seo/sitemap-helpers');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Search essentials');

check('noindex HTML stays out of robots.txt so Google can read the tag', () => {
  const robots = seo.robotsTxt('https://zeusai.pro');
  assert.ok(robots.includes('Disallow: /api/'));
  assert.ok(robots.includes('Disallow: /admin'));
  assert.ok(robots.includes('Disallow: /internal'));
  assert.ok(robots.includes('Disallow: /metrics'));
  for (const line of ['Disallow: /checkout', 'Disallow: /origin', 'Disallow: /account', 'Disallow: /status', 'Disallow: /outreach-desk']) {
    assert.ok(!robots.includes(line), line);
  }
  assert.ok(!seo.marketingUrlset('https://zeusai.pro').includes('/origin'));
  const origin = shell.getHtml('/origin');
  assert.match(origin, /name="robots" content="noindex, nofollow"/);
  const checkout = shell.getHtml('/checkout');
  assert.match(checkout, /name="robots" content="noindex"/);
});

check('pricing questions in the FAQ schema are on the page', () => {
  const html = shell.getHtml('/pricing');
  assert.match(html, /"@type":"FAQPage"/);
  assert.ok(html.includes('id="pageFaq"'));
  assert.ok(html.includes('How do I pay?'));
  assert.ok(html.includes('Is there a refund?'));
  assert.ok(html.includes('Do you store my data?'));
  const visible = html.slice(html.indexOf('id="pageFaq"'));
  assert.ok(visible.includes('Direct BTC checkout is the primary production rail.'));
});

check('the how-it-works questions in the FAQ schema are on the page', () => {
  const html = shell.getHtml('/how');
  assert.ok(html.includes('id="pageFaq"'));
  assert.ok(html.includes('What is ZeusAI?'));
  assert.ok(html.includes('How does delivery work?'));
  assert.ok(html.includes('Can I cancel anytime?'));
});

check('the visible breadcrumb uses the same names as BreadcrumbList', () => {
  const html = shell.getHtml('/solutions/model-routing');
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.ok(html.includes('>Home</a>'));
  assert.ok(html.includes('Cut AI API Costs with Autonomous Model Routing'));
  assert.ok(html.includes('"name":"Cut AI API Costs with Autonomous Model Routing"'));
  assert.ok(html.includes('"name":"Home"'));
  const home = shell.getHtml('/');
  assert.ok(!home.includes('aria-label="Breadcrumb"'));
  assert.match(home, /"@type":"BreadcrumbList"/);
  assert.ok(!home.includes('id="homeAtlas"'));
});

check('the shelf search advertised to Google is in the HTML', () => {
  const page = shell.getHtml('/services');
  assert.match(page, /action="\/services"/);
  assert.match(page, /name="q"/);
  const hit = shell.getHtml('/services', { q: 'resume' });
  assert.ok(hit.includes('id="shelfQuery"'));
  assert.match(hit, /resume/i);
  assert.ok(hit.includes('shelf offer'));
  const miss = shell.getHtml('/services', { q: 'zzznomatch' });
  assert.ok(miss.includes('No shelf offer matches'));
  assert.ok(miss.includes('Show the full shelf'));
});

console.log(`\n✅ search-essentials: ${passed} tests passed`);
process.exit(0);
