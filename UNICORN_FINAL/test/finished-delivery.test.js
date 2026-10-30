'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shelf = require('../src/commerce/public-shelf');
const engine = require('../src/site/v2/fulfillment-engine');
const finished = require('../src/commerce/finished-delivery');
const shell = require('../src/site/v2/shell');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

check('every shelf offer downloads a finished file for its own job', () => {
  const rows = shelf.publicShelf();
  assert.ok(rows.length >= 55);
  rows.forEach((item) => {
    if (item.mode === 'unavailable') return;
    const file = engine.buyerFile(item);
    const verdict = finished.review(item, file);
    assert.equal(verdict.pass, true, item.id + ' ' + verdict.failures.join(','));
    assert.ok(file.indexOf(item.title) !== -1, item.id);
  });
});

check('the audit page asks for the URL the file is written from', () => {
  const html = shell.getHtml('/services/instant-website-audit');
  assert.ok(html.includes('data-order-input="url"'));
  const checkout = shell.getHtml('/checkout', { plan: 'instant-website-audit' });
  assert.ok(checkout.includes('data-order-input="url"'));
});

check('an audit file states the job and does not invent a score', () => {
  const file = engine.buyerFile({
    id: 'instant-website-audit',
    title: 'Instant Website Audit (AI)',
    description: 'The file is a Markdown audit.',
    priceUsd: 44.1,
    mode: 'checkout',
    clock: 'minutes',
    buyable: true,
  });
  assert.ok(file.includes('No score is filled in'));
  assert.ok(file.includes('## The problem this file solves'));
});

console.log('✅ finished-delivery: ' + passed + ' tests passed');
