'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const shelf = require('../src/commerce/public-shelf');
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

check('public shelf lists every curated clock and the payable kickoff', () => {
  const items = shelf.publicShelf();
  const ids = items.map((p) => p.id);
  assert.ok(ids.includes('instant-website-audit'));
  assert.ok(ids.includes('professional-saas-mvp'));
  assert.ok(ids.includes('ent-engagement-kickoff'));
  assert.ok(ids.includes('ent-acquisition-pack'));
  assert.ok(ids.includes('ent-sovereign-deployment'));
  assert.ok(items.every((p) => p.ctaHref && p.mode && p.priceUsd > 0));
  const kick = shelf.byId('ent-engagement-kickoff');
  assert.strictEqual(kick.mode, 'reserve');
  assert.ok(kick.ctaHref.includes('ent-engagement-kickoff'));
  const acq = shelf.byId('ent-acquisition-pack');
  assert.strictEqual(acq.mode, 'contact');
  assert.strictEqual(acq.ctaLabel, 'Request a proposal →');
  assert.ok(acq.ctaHref.includes('enterprise'));
});

check('homepage renders the same ids and the same buttons as the shelf', () => {
  const html = shell.getHtml('/');
  for (const item of shelf.publicShelf()) {
    assert.ok(html.includes('data-product-id="' + item.id + '"'), item.id);
    assert.ok(html.includes(item.ctaHref), item.id + ' href');
  }
  assert.ok(html.includes('id="concierge"'));
  assert.ok(!html.includes('Get My $39 Resume Makeover'));
});

check('advise prices a website ask and adds an unasked neighbor', () => {
  const advice = shelf.advise('I run a shop and I need a website plus SEO');
  assert.strictEqual(advice.ok, true);
  assert.strictEqual(advice.lang, 'en');
  assert.ok(advice.primary);
  assert.ok(['instant-landing-page', 'instant-website-audit', 'instant-seo-content-pack'].includes(advice.primary.id));
  assert.strictEqual(advice.primary.priceUsd, shelf.byId(advice.primary.id).priceUsd);
  assert.ok(advice.also.length >= 1);
  assert.ok(advice.also.some((x) => x.role === 'unasked'));
  assert.ok(advice.also.every((x) => x.id !== advice.primary.id));
  assert.ok(advice.primary.strategy.includes(advice.primary.priceLabel));
});

check('advise answers in Romanian and routes a company ask to the kickoff', () => {
  const advice = shelf.advise('Am o companie și vreau licența și un private cloud');
  assert.strictEqual(advice.lang, 'ro');
  assert.strictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.ok(advice.primary.strategy.includes('Nu livrează licența'));
  assert.ok(advice.also.some((x) => x.mode === 'contact'));
});

check('checkout uses the shelf price and refuses a self-serve cart for a proposal', () => {
  const kick = shelf.byId('ent-engagement-kickoff');
  const pay = shell.getHtml('/checkout', { plan: 'ent-engagement-kickoff' });
  assert.ok(pay.includes(kick.title));
  assert.ok(pay.includes('id="coSkipForm"'));
  const proposal = shell.getHtml('/checkout', { plan: 'ent-acquisition-pack' });
  assert.ok(proposal.includes('Request a proposal →'));
  assert.ok(proposal.includes('hidden'));
  assert.ok(!proposal.includes('id="coSkipForm"'));
  assert.ok(pay.includes('It does not deliver the license, the source, or a private cloud.'));
  assert.ok(!proposal.includes('It does not deliver the license, the source, or a private cloud.'));
});

check('a paused power is explained without a price, then three real doors', () => {
  const advice = shelf.advise('I want to dropship with Printful');
  assert.ok(advice.limits && advice.limits.length === 1);
  assert.strictEqual(advice.limits[0].priced, false);
  assert.strictEqual(advice.limits[0].priceLabel, '');
  assert.ok(advice.limits[0].ctaHref.includes('/zacc'));
  assert.ok(advice.primary);
  assert.strictEqual(advice.primary.role, 'start');
  assert.ok(advice.also.length >= 1);
});

check('pricing, services, buy, and home share one shelf', () => {
  const kick = shelf.byId('ent-engagement-kickoff');
  const acq = shelf.byId('ent-acquisition-pack');
  for (const path of ['/', '/pricing', '/services', '/buy']) {
    const html = shell.getHtml(path);
    assert.ok(html.includes('data-product-id="' + kick.id + '"'), path + ' kickoff');
    assert.ok(html.includes(kick.ctaHref), path + ' kickoff href');
    assert.ok(html.includes(acq.ctaHref), path + ' proposal href');
  }
  const pricing = shell.getHtml('/pricing');
  assert.ok(!/\/checkout\/\?plan=starter(?![a-z0-9_-])/i.test(pricing));
  assert.ok(!/\/checkout\/\?plan=pro(?![a-z0-9_-])/i.test(pricing));
  const home = shell.getHtml('/');
  assert.ok(home.includes('id="heroShelfFacts"'));
  assert.ok(!home.includes('data-pricing-plan="starter"'));
  const ro = shelf.advise('Am o companie și vreau un chatbot');
  const en = shelf.advise('I need a chatbot for patient questions');
  assert.strictEqual(ro.lang, 'ro');
  assert.strictEqual(en.lang, 'en');
  assert.notStrictEqual(ro.primary.strategy, en.primary.strategy);
  assert.ok(!/Kickoff pack now|About \d+ days/.test(ro.primary.strategy));
  assert.ok(ro.primary.strategy.includes('zile') || ro.primary.strategy.includes('Nu este un coș') || ro.primary.strategy.includes('Rezervi'));
});

console.log('public-shelf: ' + passed + ' checks passed');
process.exit(0);
