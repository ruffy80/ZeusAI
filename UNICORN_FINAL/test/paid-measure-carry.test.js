'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.SNM_ENABLED = '0';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const carry = require('../src/commerce/paid-measure-carry');
const audit = require('../src/commerce/audit-scan');
const shell = require('../src/site/v2/shell');
const catalog = require('../src/commerce/instant-catalog');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('a named door carries the website and no score', () => {
  const door = carry.doorFor('example.com');
  assert.strictEqual(door.ok, true);
  assert.strictEqual(door.score, null);
  assert.strictEqual(door.scoreBeforePayment, false);
  assert.strictEqual(door.url, 'https://example.com/');
  assert.ok(door.href.startsWith('https://zeusai.pro/checkout/?plan=instant-website-audit&url='));
  assert.ok(door.href.includes(encodeURIComponent('https://example.com/')));
  assert.ok(!door.href.includes('score'));
  const blocked = carry.doorFor('http://127.0.0.1/');
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reason, 'blocked_host');
  assert.strictEqual(blocked.score, null);
});

check('the public spec withholds the score and reads the real list price', () => {
  const doc = carry.document();
  assert.strictEqual(doc.protocol, 'PMC/1.0');
  assert.strictEqual(doc.scoreBeforePayment, false);
  assert.strictEqual(doc.listsCustomers, false);
  assert.strictEqual(doc.inventsVisitors, false);
  assert.strictEqual(doc.inventsUsers, false);
  assert.strictEqual(doc.scoreStaysIn, 'paid-file');
  assert.strictEqual(doc.travelingObject, 'named-checkout');
  assert.strictEqual(doc.checks.length, 6);
  assert.strictEqual(doc.listPriceUsd, catalog.byId('instant-website-audit').priceUSD);
  assert.ok(Number.isFinite(doc.paidHumans) && doc.paidHumans >= 0);
  assert.ok(doc.doorTemplate.endsWith('url={publicUrl}'));
  assert.ok(!JSON.stringify(doc).includes('Measured score'));
});

check('the paid file keeps the number and the traveling line has none', () => {
  const empty = audit.render({});
  assert.ok(empty.includes('No score is filled in'));
  assert.ok(empty.includes('## The line that travels'));
  const scored = audit.render({
    scan: {
      fetched: true,
      score: 4,
      scoreMax: 6,
      status: 200,
      finalUrl: 'https://example.com/',
      requestedUrl: 'https://example.com/',
      checks: [],
      title: 'Example',
      description: 'A page',
      h1: 1,
      canonical: 'https://example.com/',
      bytes: 10,
      contentType: 'text/html',
      cacheControl: '',
      lang: 'en',
      images: 0,
      imagesMissingAlt: 0,
    },
  });
  assert.ok(scored.includes('Measured score: 4 of 6'));
  const travel = scored.split('## The line that travels')[1];
  assert.ok(travel.includes('/checkout/?plan=instant-website-audit&url='));
  assert.ok(!travel.includes('4 of 6'));
  assert.ok(travel.includes('does not include a score'));
  assert.ok(travel.includes('does not list a company as a customer'));
});

check('the audit page can copy a door and the homepage does not grow a fame claim', () => {
  const page = shell.getHtml('/services/instant-website-audit');
  const checkout = shell.getHtml('/checkout', { plan: 'instant-website-audit', siteUrl: 'https://example.com' });
  const home = shell.getHtml('/');
  assert.ok(page.includes('data-measure-carry="1"'));
  assert.ok(page.includes('data-copy-measure-door="1"'));
  assert.ok(page.includes('The score stays in the paid file.'));
  assert.ok(page.includes('href="/.well-known/paid-measure.json"'));
  assert.ok(checkout.includes('data-copy-measure-door="1"'));
  assert.ok(!home.includes('data-measure-carry'));
  assert.ok(!home.includes('most known'));
  const root = path.join(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
  assert.ok(index.includes('/.well-known/paid-measure.json'));
  assert.ok(index.includes('score: null'));
  assert.ok(client.includes('Door copied. The score is not in the link.'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(String(pkg.scripts['test:chain']).includes('paid-measure-carry.test.js'));
});

console.log('✅ paid-measure-carry: ' + passed + ' tests passed');
