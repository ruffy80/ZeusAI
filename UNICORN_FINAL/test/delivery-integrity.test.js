'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dip = require('../src/commerce/delivery-integrity');
const integrity = require('../src/commerce/service-integrity');
const shelf = require('../src/commerce/public-shelf');
const engine = require('../src/site/v2/fulfillment-engine');

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

check('every published service can be delivered in full', () => {
  const report = dip.audit(shelf.publicShelf(), (item) => engine.offerPreview(item.id, {
    mode: item.mode,
    clock: item.clock,
    tier: item.tier,
  }));
  assert.strictEqual(report.protocol, 'DIP/1.0');
  assert.strictEqual(report.marginalUsd, 0);
  assert.strictEqual(report.inventsPrice, false);
  assert.ok(report.offers >= 20);
  if (!report.ok) {
    const sample = report.failing.slice(0, 8).map((row) => row.id + ' ' + row.failures.join(',')).join('\n');
    assert.fail(sample);
  }
  assert.strictEqual(report.publishable, report.offers);
  for (const row of report.failing) assert.fail(row.id);
  const priced = shelf.publicShelf().filter((item) => item.buyable === true);
  for (const item of priced) {
    const cost = dip.priceCovers(item);
    assert.strictEqual(cost.coversDelivery, true, item.id);
    assert.ok(cost.displayedUsd > cost.marginalUsd, item.id);
    assert.strictEqual(cost.remedy, null, item.id);
  }
});

check('checkout proof uses the same gate', () => {
  const report = integrity.audit();
  assert.strictEqual(report.ok, true, JSON.stringify(report.failing.slice(0, 5)));
  assert.strictEqual(integrity.status().deliveryProtocol, 'DIP/1.0');
});

check('a promise the file does not contain is not publishable', () => {
  const logo = Object.assign({}, shelf.byId('instant-logo-kit'), {
    description: 'You receive a hosted site and a Word file.',
  });
  const preview = engine.offerPreview(logo.id, { mode: logo.mode, clock: logo.clock, tier: logo.tier });
  const bad = dip.review(logo, preview);
  assert.strictEqual(bad.publishable, false);
  assert.ok(bad.failures.indexOf('undeliverable_promise') !== -1, bad.failures.join(','));
});

check('a buyable price of zero does not cover delivery', () => {
  const cost = dip.priceCovers({ buyable: true, priceUsd: 0 });
  assert.strictEqual(cost.marginalUsd, 0);
  assert.strictEqual(cost.coversDelivery, false);
  assert.strictEqual(cost.remedy, 'raise_price');
  assert.strictEqual(cost.inventsPrice, undefined);
});

check('a shorter model reply keeps the promised headings', () => {
  const preview = engine.offerPreview('instant-seo-content-pack', { mode: 'btc', clock: 'minutes', tier: 'instant' });
  const floor = engine.buyerFile(shelf.byId('instant-seo-content-pack'));
  const kept = dip.keepSections('Keywords: alpha only.', preview.sections, floor);
  assert.ok(kept.indexOf('Keywords: alpha only.') === 0);
  for (const section of preview.sections) {
    assert.ok(kept.toLowerCase().indexOf(section.toLowerCase()) !== -1, section);
  }
});

check('the kickoff file contains the three promised documents', () => {
  const item = shelf.byId('ent-engagement-kickoff');
  const text = engine.buyerFile(item);
  assert.ok(/discovery brief/i.test(text));
  assert.ok(/commercial proposal/i.test(text));
  assert.ok(/draft statement of work/i.test(text));
  assert.ok(/credited toward a signed engagement/i.test(text));
  assert.ok(/does not deliver the license/i.test(text));
  assert.ok(!/team delivers the build/i.test(text));
});

check('a generated engagement document still says the license is not in the file', () => {
  const item = {
    id: 'ent-platform-license',
    title: 'Unicorn Platform — Enterprise License',
    description: 'Engagement pack.',
    priceUsd: 250000,
    mode: 'reserve',
    clock: 'contract',
  };
  const text = engine.buyerFile(item);
  assert.ok(/master service agreement \(msa\)/i.test(text));
  assert.ok(/statement of work/i.test(text));
  assert.ok(/technical appendix/i.test(text));
  assert.ok(/security pack/i.test(text));
  assert.ok(/timeline/i.test(text));
  assert.ok(/payment schedule/i.test(text));
  assert.ok(/not in this download/i.test(text));
  assert.ok(!/source code is attached/i.test(text));
});

check('the service page does not promise a build the file does not contain', () => {
  const root = path.join(__dirname, '..');
  const shell = fs.readFileSync(path.join(root, 'src/site/v2/shell.js'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'src/site/v2/client.js'), 'utf8');
  assert.ok(!shell.includes('Integrates with all 42 giant connectors'));
  assert.ok(!client.includes('Integrates with all 42 giant connectors'));
  assert.ok(!shell.includes('human-built system'));
  assert.ok(!shell.includes('human milestone delivery'));
  assert.ok(!client.includes('human milestone delivery'));
  assert.ok(!shell.includes('The finished system is human-delivered'));
  const saas = shelf.byId('professional-saas-mvp');
  assert.ok(/project kickoff/i.test(saas.description));
  assert.ok(/does not include a running SaaS/i.test(saas.description));
  assert.strictEqual(saas.clock, 'minutes');
  assert.ok(saas.deliveryMinutes > 0);
  assert.ok(!(saas.deliveryDays > 0));
});

console.log('\n✅ delivery-integrity: ' + passed + ' tests passed');
process.exit(0);
