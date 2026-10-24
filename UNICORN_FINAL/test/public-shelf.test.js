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
  assert.strictEqual(acq.mode, 'reserve');
  assert.strictEqual(acq.buyable, true);
  assert.strictEqual(acq.ctaLabel, 'Buy the engagement pack →');
  assert.ok(acq.ctaHref.includes('/checkout/?plan=ent-acquisition-pack'));
  assert.ok(acq.when.includes('milestones in the pack'));
});

check('homepage renders the same ids and the same buttons as the shelf', () => {
  const html = shell.getHtml('/');
  for (const item of shelf.publicShelf()) {
    assert.ok(html.includes('data-product-id="' + item.id + '"'), item.id);
    assert.ok(html.includes(item.ctaHref), item.id + ' href');
  }
  assert.ok(html.includes('id="concierge"'));
  assert.ok(!html.includes('Get My $39 Resume Makeover'));
  assert.ok(html.includes('/checkout/?plan=ent-acquisition-pack'));
  assert.ok(html.includes('Buy the engagement pack →'));
  assert.ok(html.includes('They are not in the download'));
  assert.ok(!html.includes('/api/shelf/proposal/ent-acquisition-pack'));
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
  assert.ok(advice.also.some((x) => x.buyable === true && x.id !== 'ent-engagement-kickoff' && /Nu sunt în descărcare/.test(x.strategy)));
});

check('checkout uses the shelf price and sells the engagement pack', () => {
  const kick = shelf.byId('ent-engagement-kickoff');
  const pay = shell.getHtml('/checkout', { plan: 'ent-engagement-kickoff' });
  assert.ok(pay.includes(kick.title));
  assert.ok(pay.includes('id="coSkipForm"'));
  const proposal = shell.getHtml('/checkout', { plan: 'ent-acquisition-pack' });
  assert.ok(proposal.includes('id="coSkipForm"'));
  assert.ok(proposal.includes('They are not in this download'));
  assert.ok(proposal.includes('⚡ Pay with Bitcoin'));
  assert.ok(!proposal.includes('this figure is a proposal, not a cart'));
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

check('advise hears a person and keeps the resume file', () => {
  const advice = shelf.advise('I am a normal person and I need my resume and LinkedIn rewritten');
  const count = shelf.publicShelf().length;
  assert.strictEqual(advice.buyer.kind, 'person');
  assert.strictEqual(advice.buyer.org, null);
  assert.strictEqual(advice.primary.id, 'instant-resume-makeover');
  assert.strictEqual(advice.knownOffers, count);
  assert.ok(advice.primary.strategy.includes(advice.primary.priceLabel));
  assert.ok(advice.question.includes('Heard as a person'));
  assert.ok(advice.question.includes(String(count)));
});

check('advise keeps a file when the person works at Google', () => {
  const advice = shelf.advise('I work at Google and I need a resume');
  assert.strictEqual(advice.buyer.kind, 'person');
  assert.strictEqual(advice.buyer.org, 'Google');
  assert.strictEqual(advice.primary.id, 'instant-resume-makeover');
  assert.ok(advice.question.includes('does not replace Google'));
  assert.ok(advice.question.includes('file'));
  assert.notStrictEqual(advice.primary.id, 'ent-engagement-kickoff');
});

check('advise keeps a website audit as a file for Google', () => {
  const advice = shelf.advise('We are Google and we need a website audit');
  assert.strictEqual(advice.buyer.org, 'Google');
  assert.ok(['instant-website-audit', 'instant-landing-page', 'instant-seo-content-pack'].includes(advice.primary.id));
  assert.strictEqual(advice.primary.clock, 'minutes');
  assert.ok(advice.question.includes('does not replace Google'));
});

check('advise opens the kickoff for an AWS platform ask and does not replace AWS', () => {
  const advice = shelf.advise('We are AWS and we want a private cloud and the platform license');
  assert.strictEqual(advice.buyer.kind, 'hyperscale');
  assert.strictEqual(advice.buyer.org, 'AWS');
  assert.strictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.ok(advice.primary.strategy.includes('does not deliver the license'));
  assert.ok(advice.also.some((x) => x.buyable === true && x.mode === 'reserve' && x.id !== 'ent-engagement-kickoff'));
  assert.ok(advice.question.includes('does not replace AWS'));
  assert.ok(advice.question.includes('engagement kickoff'));
});

check('advise answers an open Google ask from the whole shelf without inventing a cloud', () => {
  const advice = shelf.advise('We are Google. What can you do for us?');
  const ids = new Set(shelf.publicShelf().map((p) => p.id));
  assert.strictEqual(advice.buyer.kind, 'hyperscale');
  assert.strictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.strictEqual(advice.knownOffers, ids.size);
  assert.ok(advice.question.includes('does not replace Google'));
  assert.ok(advice.also.some((x) => x.buyable === true && /^ent-/.test(x.id)));
  for (const row of [advice.primary].concat(advice.also)) {
    if (row && row.id) assert.ok(ids.has(row.id), row.id);
  }
});

check('advise reserves a build for a company and does not jump to the license', () => {
  const advice = shelf.advise('We are a company and we need a mobile app');
  assert.strictEqual(advice.buyer.kind, 'company');
  assert.strictEqual(advice.buyer.org, null);
  assert.strictEqual(advice.primary.id, 'professional-mobile-app');
  assert.notStrictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.ok(advice.question.includes('Heard as a company'));
  assert.ok(advice.question.includes('build'));
});

check('advise answers a Romanian person with the resume file', () => {
  const advice = shelf.advise('Sunt o persoană și vreau un CV pentru angajare');
  assert.strictEqual(advice.lang, 'ro');
  assert.strictEqual(advice.buyer.kind, 'person');
  assert.strictEqual(advice.primary.id, 'instant-resume-makeover');
  assert.ok(advice.question.includes('Te-am auzit ca om') || advice.question.includes('persoană'));
  assert.ok(!/Kickoff pack now|About \d+ days/.test(advice.primary.strategy));
  assert.ok(!/Kickoff pack now|About \d+ days/.test(advice.question));
});

check('advise finds a naming file from the whole shelf when the lane words are absent', () => {
  const advice = shelf.advise('I need 25 product names and free domains');
  const ids = new Set(shelf.publicShelf().map((p) => p.id));
  assert.strictEqual(advice.primary.id, 'instant-product-naming');
  assert.strictEqual(advice.primary.title, 'Instant Product Naming Sprint');
  assert.ok(String(advice.primary.description).includes('does not check whether a domain is available'));
  assert.ok(!/25 names|available \.com/.test(advice.primary.title + ' ' + advice.primary.description));
  assert.strictEqual(advice.knownOffers, ids.size);
  assert.ok(advice.also.some((x) => x.role === 'unasked'));
  assert.ok(advice.question.includes(String(ids.size)));
});

check('advise stays on real doors when nothing on the shelf matches', () => {
  const advice = shelf.advise('I want a purple elephant tomorrow');
  assert.strictEqual(advice.primary.role, 'start');
  assert.ok(['instant-website-audit', 'professional-ai-chatbot', 'ent-engagement-kickoff'].includes(advice.primary.id));
  assert.ok(advice.also.length >= 1);
  assert.ok(advice.question.includes('No precise match'));
});

check('advise treats an AWS landing zone as a platform ask, not a marketing page', () => {
  const advice = shelf.advise('We are AWS and we need a landing zone for our accounts');
  assert.strictEqual(advice.buyer.org, 'AWS');
  assert.strictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.ok(advice.question.includes('does not replace AWS'));
});

console.log('public-shelf: ' + passed + ' checks passed');
process.exit(0);
