'use strict';

/**
 * request-solution-clock.test.js — RCLK/1.0
 * One request walks six beats and returns the shelf price, not a margin.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clock = require('../backend/modules/iak/request-clock');
const shelf = require('../src/commerce/public-shelf');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Request Solution Clock (RCLK/1.0)');

check('a resume request quotes the shelf list and the bitcoin rail', () => {
  const item = shelf.byId('instant-resume-makeover');
  assert.ok(item);
  const out = clock.solve('I need a resume');
  assert.strictEqual(out.protocol, 'RCLK/1.0');
  assert.strictEqual(out.orchestrator, 'IAK/1.1');
  assert.deepStrictEqual(out.beats.map((row) => row.name), clock.BEATS.slice());
  assert.strictEqual(out.client.offerId, 'instant-resume-makeover');
  assert.strictEqual(out.action, 'checkout');
  assert.strictEqual(out.fit, 'match');
  assert.strictEqual(out.price.listUsd, item.priceUsd);
  const cents = Math.round(item.priceUsd * 100);
  assert.strictEqual(out.price.bitcoinUsd, Math.round(cents * 90 / 100) / 100);
  assert.strictEqual(out.price.cardUsd, item.priceUsd);
  assert.strictEqual(out.price.deliveryFeeUsd, 0);
  assert.strictEqual(out.price.fileStaysWithBuyer, true);
  assert.strictEqual(out.owner.collects, 'published_price');
  assert.strictEqual(out.owner.marginUsd, null);
  assert.strictEqual(out.owner.marginMeasured, false);
  assert.strictEqual(out.applied, false);
  assert.strictEqual(out.spent, false);
  assert.strictEqual(out.externalModel, false);
  assert.deepStrictEqual(out.filesWritten, []);
  assert.ok(out.reply.includes(item.title));
  assert.ok(out.client.checkout);
  assert.strictEqual(JSON.stringify(out).includes('paidHumans'), false);
});

check('a refund waits and collects nothing', () => {
  const out = clock.solve('refund the bitcoin payment');
  assert.strictEqual(out.action, 'wait_for_owner');
  assert.strictEqual(out.gate.requiresHuman, true);
  assert.strictEqual(out.gate.applied, false);
  assert.strictEqual(out.client.offerId, null);
  assert.strictEqual(out.client.checkout, null);
  assert.strictEqual(out.owner.collects, 'nothing_until_a_person_decides');
  assert.strictEqual(out.owner.listUsd, null);
  assert.strictEqual(out.price.bitcoinUsd, null);
  assert.ok(/nothing was refunded/i.test(out.reply));
});

check('an empty request asks again and does not invent an offer', () => {
  const out = clock.solve('   ');
  assert.strictEqual(out.fit, 'none');
  assert.strictEqual(out.action, 'ask_again');
  assert.strictEqual(out.client.offerId, null);
  assert.strictEqual(out.owner.marginMeasured, false);
  assert.ok(out.reply.length > 0);
});

check('the site, the backend, and the homepage dock call the clock', () => {
  const root = path.join(__dirname, '..');
  const site = fs.readFileSync(path.join(root, 'src/index.js'), 'utf8');
  const backend = fs.readFileSync(path.join(root, 'backend/index.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
  const kernel = fs.readFileSync(path.join(root, 'backend/modules/integrated-autonomy-kernel.js'), 'utf8');
  assert.ok(site.includes("urlPath === '/api/request-solution'"));
  assert.ok(backend.includes("app.post('/api/request-solution'"));
  assert.ok(shell.includes("fetch('/api/request-solution'"));
  assert.ok(client.includes("fetch('/api/request-solution'"));
  assert.ok(kernel.includes('request_solution_clock'));
  assert.ok(kernel.includes('solveRequest'));
  const status = clock.getStatus();
  assert.strictEqual(status.inventsMargin, false);
  assert.deepStrictEqual(status.beats, ['hear', 'match', 'deliver', 'price', 'gate', 'close']);
});

console.log(`\n✅ request-solution-clock: ${passed} tests passed`);
process.exit(0);
