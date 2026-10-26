'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shelf = require('../src/commerce/public-shelf');
const money = require('../src/commerce/money-catalog');
const buyability = require('../src/commerce/commerce-buyability');
const engine = require('../src/site/v2/fulfillment-engine');
const shell = require('../src/site/v2/shell');
const integrity = require('../src/commerce/service-integrity');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function run() {
  await check('the three money lanes are on the shelf and buyable', () => {
    const rows = money.shelfRows();
    assert.strictEqual(rows.filter((row) => row.tier === 'frontier').length, 10);
    assert.strictEqual(rows.filter((row) => row.tier === 'industry').length, 18);
    assert.ok(rows.some((row) => row.id === 'dropship-listing-desk'));
    for (const row of rows) {
      const item = shelf.byId(row.id);
      assert.ok(item, row.id);
      assert.strictEqual(item.buyable, true, row.id);
      assert.strictEqual(item.mode, 'btc', row.id);
      assert.ok(item.ctaHref.includes('/checkout/?plan=' + row.id), row.id);
      assert.ok(item.priceUsd > 0, row.id);
    }
    assert.strictEqual(shelf.byId('frontier-pledge-pack'), null);
    const free = buyability.assessBuyability({ id: 'frontier-pledge-pack', group: 'frontier', priceUsd: 0 });
    assert.strictEqual(free.buyable, false);
    const gov = shelf.byId('govtech-os');
    assert.strictEqual(gov.ctaLabel, 'Buy the architecture pack →');
    const desk = shelf.byId('dropship-listing-desk');
    assert.strictEqual(desk.ctaLabel, 'Buy the listing desk →');
    assert.strictEqual(desk.priceFloorUsd, 49);
  });

  await check('advice names the file and refuses orbital compute', () => {
    const drop = shelf.advise('I want dropship from printful');
    assert.strictEqual(drop.primary.id, 'dropship-listing-desk');
    assert.ok(/does not dispatch a parcel/i.test(drop.primary.strategy));
    const tool = shelf.advise('sell me the frontier refund shield');
    assert.strictEqual(tool.primary.id, 'frontier-refund-shield');
    assert.ok(/does not sell orbital compute/i.test(tool.primary.strategy));
    const blocked = shelf.advise('I want a quantum channel and an implant');
    assert.ok(blocked.limits.some((item) => /not products/i.test(item.title)));
    const industry = shelf.advise('We need govtech');
    assert.strictEqual(industry.primary.id, 'govtech-os');
    assert.ok(/does not install an operating system/i.test(industry.primary.strategy));
  });

  await check('payment writes the three files and does not invent a parcel or an OS', async () => {
    const desk = await engine.fulfillService({ id: 'ord_desk', amount: 49 }, 'dropship-listing-desk');
    assert.strictEqual(desk.deliverableType, 'listing-desk');
    assert.ok(/Wireless Charging Stand/i.test(desk.content));
    assert.ok(/does not dispatch a parcel/i.test(desk.content));
    assert.ok(!/tracking number: 1Z/i.test(desk.content));
    assert.strictEqual(desk.requiresHumanFulfillment, false);
    const tool = await engine.fulfillService({ id: 'ord_tool', amount: 199 }, 'frontier-refund-shield');
    assert.strictEqual(tool.deliverableType, 'frontier-pack');
    assert.ok(tool.content.includes('/refund'));
    assert.ok(/does not sell orbital compute/i.test(tool.content));
    assert.ok(/refund closes once this file is issued/i.test(tool.content));
    const pack = await engine.fulfillService({ id: 'ord_os', amount: 5999 }, 'govtech-os');
    assert.strictEqual(pack.deliverableType, 'industry-pack');
    assert.ok(/does not install an operating system/i.test(pack.content));
    assert.ok(/not a certification/i.test(pack.content));
    assert.strictEqual(pack.requiresHumanFulfillment, false);
  });

  await check('service and checkout pages sell the file', () => {
    const page = shell.getHtml('/services/dropship-listing-desk');
    assert.ok(page.includes('Buy the listing desk'));
    assert.ok(page.includes('does not dispatch a parcel'));
    assert.ok(page.includes('/checkout/?plan=dropship-listing-desk'));
    const checkout = shell.getHtml('/checkout', { plan: 'frontier-refund-shield' });
    assert.ok(checkout.includes('Pay with Bitcoin') || checkout.includes('⚡ Pay with Bitcoin'));
    assert.ok(/does not sell orbital compute/i.test(checkout));
    const industry = shell.getHtml('/services/fintech-os');
    assert.ok(industry.includes('Buy the architecture pack'));
    assert.ok(industry.includes('"merchantReturnDays":30'));
    assert.ok(!industry.includes('KeepProduct'));
    assert.ok(!industry.includes('ReturnByMail'));
    assert.strictEqual((industry.match(/schema\.org\/InStock/g) || []).length, 1);
    assert.ok(!industry.includes('>/mo<'));
    const audit = integrity.audit();
    assert.strictEqual(audit.ok, true, JSON.stringify(audit.failing));
  });

  console.log('\n✅ money-catalog:', passed, 'tests passed');
  process.exit(0);
}

run().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
