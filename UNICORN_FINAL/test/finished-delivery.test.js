'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shelf = require('../src/commerce/public-shelf');
const engine = require('../src/site/v2/fulfillment-engine');
const finished = require('../src/commerce/finished-delivery');
const shell = require('../src/site/v2/shell');

let passed = 0;
const pending = [];
function check(name, fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    pending.push(result.then(() => {
      passed += 1;
      console.log('✓', name);
    }));
    return;
  }
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

check('an enterprise kickoff page collects the brief and the file keeps it', () => {
  const page = shell.getHtml('/services/ent-engagement-kickoff');
  const checkout = shell.getHtml('/checkout', { plan: 'ent-engagement-kickoff' });
  assert.ok(page.includes('data-order-input="legalEntity"'));
  assert.ok(checkout.includes('data-order-input="legalEntity"'));
  assert.ok(checkout.includes('data-order-input="contactName"'));
  assert.ok(!checkout.includes('data-order-input="contactEmail"'));
  return engine.fulfillService({
    id: 'ord-kick-brief',
    serviceId: 'ent-engagement-kickoff',
    plan: 'ent-engagement-kickoff',
    serviceName: 'Enterprise Engagement Kickoff',
    status: 'paid',
    amount: 2500,
    meta: { inputs: { legalEntity: 'Acme Holdings', contactName: 'Ada' } },
  }, 'ent-engagement-kickoff').then((artifact) => {
    const file = artifact && artifact.content || '';
    assert.ok(file.includes('legalEntity: Acme Holdings'));
    assert.ok(file.includes('contactName: Ada'));
    assert.ok(/does not deliver the license/i.test(file));
    assert.ok(/draft statement of work/i.test(file));
    assert.ok(file.includes('## The problem this file solves'));
  });
});

Promise.all(pending).then(() => {
  console.log('✅ finished-delivery: ' + passed + ' tests passed');
}).catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
