'use strict';

/**
 * FCO/1.0 binds the five frontier engines to confirmed cash and the listed shelf.
 * A listed package price is not a sale.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => {
      passed += 1;
      console.log('✓', name);
    });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function main() {
  const fco = require('../backend/modules/frontier-continuum');

  await check('free lane offers the cheapest listed package and does not mark it sold', () => {
    const out = fco.cycle({ sense: { lane: 'free', confirmedUsd: 0, paidHumans: 0, freeMemPct: 80 } });
    assert.strictEqual(out.ok, true);
    assert.strictEqual(out.action, 'offer_listed_package');
    assert.strictEqual(out.inventsSales, false);
    assert.strictEqual(out.claimsQuantumChannel, false);
    assert.strictEqual(out.claimsOrbital, false);
    assert.strictEqual(out.nextOffer.sold, false);
    assert.strictEqual(out.nextOffer.priceUsd, 25000);
    assert.strictEqual(out.nextOffer.id, 'zeusai-revenue-machine');
    assert.ok(out.shelf.maxUsd >= 250000);
    assert.strictEqual(out.seal.ok, true);
    assert.equal(typeof out.seal.mac, 'string');
    assert.strictEqual(out.model.agrees, true);
    assert.equal(typeof out.job.checksum, 'string');
    assert.strictEqual(out.dispatch, true);
  });

  await check('stressed compute defers the offer', () => {
    const out = fco.cycle({ sense: { lane: 'earned', confirmedUsd: 100, paidHumans: 1, freeMemPct: 5 } });
    assert.strictEqual(out.action, 'defer_heavy');
    assert.strictEqual(out.dispatch, false);
    assert.strictEqual(out.lane, 'earned');
    assert.strictEqual(out.confirmedUsd, 100);
    assert.strictEqual(out.nextOffer.sold, false);
    assert.strictEqual(out.model.agrees, true);
  });

  await check('earned lane with room opens priced work and keeps the shelf listed', () => {
    const out = fco.cycle({ sense: { lane: 'earned', confirmedUsd: 25000, paidHumans: 1, freeMemPct: 60 } });
    assert.strictEqual(out.action, 'earned_lane_open');
    assert.strictEqual(out.dispatch, true);
    assert.strictEqual(out.paidHumans, 1);
    assert.strictEqual(out.inventsSales, false);
  });

  await check('neural frontier command returns the same cycle', () => {
    const neural = require('../backend/modules/NeuralInterfaceAPI');
    const out = neural.dispatch('frontier');
    assert.strictEqual(out.intent, 'frontier');
    assert.strictEqual(out.claimsNeuralImplant, false);
    assert.strictEqual(out.result.inventsSales, false);
    assert.ok(out.result.nextOffer && out.result.nextOffer.sold === false);
    const memory = require('../backend/modules/usi-memory');
    const recalled = memory.recall('frontier');
    assert.strictEqual(recalled.found, true);
    assert.equal(typeof recalled.value.action, 'string');
  });

  await check('site and API publish the cycle', () => {
    const root = path.join(__dirname, '..');
    const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
    const shell = read('src/site/v2/shell.js');
    assert.ok(shell.includes('FCO/1.0'));
    assert.ok(shell.includes('inventsSales = false'));
    const site = read('src/index.js');
    assert.ok(site.includes('/.well-known/frontier.json'));
    const boot = read('backend/index.js');
    assert.ok(boot.includes('/api/frontier'));
    const pkg = JSON.parse(read('package.json'));
    assert.ok(String(pkg.scripts['test:chain']).includes('frontier-continuum.test.js'));
  });

  console.log('\n✅ frontier-continuum: ' + passed + ' tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
