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

check('public shelf lists payable files and keeps contract figures off the cart', () => {
  const items = shelf.publicShelf();
  const ids = items.map((p) => p.id);
  assert.ok(ids.includes('instant-website-audit'));
  assert.ok(ids.includes('professional-saas-mvp'));
  assert.ok(ids.includes('ent-engagement-kickoff'));
  assert.ok(!ids.includes('ent-acquisition-pack'));
  assert.ok(!ids.includes('ent-sovereign-deployment'));
  assert.ok(!ids.includes('ent-platform-license'));
  assert.ok(items.every((p) => p.ctaHref && p.mode && p.priceUsd > 0));
  const kick = shelf.byId('ent-engagement-kickoff');
  assert.strictEqual(kick.mode, 'reserve');
  assert.ok(kick.ctaHref.includes('ent-engagement-kickoff'));
  assert.strictEqual(shelf.byId('ent-acquisition-pack'), null);
});

check('the marketplace renders the same ids and the same buttons as the shelf', () => {
  const html = shell.getHtml('/services');
  for (const item of shelf.publicShelf()) {
    assert.ok(html.includes('data-product-id="' + item.id + '"'), item.id);
    assert.ok(html.includes(item.ctaHref), item.id + ' href');
  }
  assert.ok(!html.includes('Get My $39 Resume Makeover'));
  assert.ok(!html.includes('/checkout/?plan=ent-acquisition-pack'));
  assert.ok(!html.includes('$4,000,000'));
  assert.ok(html.includes('/checkout/?plan=ent-engagement-kickoff'));
  const home = shell.getHtml('/');
  assert.ok(home.includes('Get Enterprise Access'));
  assert.ok(home.includes('href="/solutions/model-routing"'));
  assert.ok(!home.includes('data-product-id="instant-resume-makeover"'));
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
  assert.ok(!advice.also.some((x) => x.id === 'ent-acquisition-pack' || x.id === 'ent-platform-license'));
});

check('checkout uses the shelf price and sells the engagement pack', () => {
  const kick = shelf.byId('ent-engagement-kickoff');
  const pay = shell.getHtml('/checkout', { plan: 'ent-engagement-kickoff' });
  assert.ok(pay.includes(kick.title));
  assert.ok(pay.includes('id="coSkipForm"'));
  const proposal = shell.getHtml('/checkout', { plan: 'ent-acquisition-pack' });
  assert.ok(proposal.includes('This figure is not a product price'));
  assert.ok(proposal.includes('/checkout/?plan=ent-engagement-kickoff'));
  assert.ok(!proposal.includes('⚡ Pay with Bitcoin'));
  assert.ok(!proposal.includes('$4,000,000'));
  assert.ok(pay.includes('It does not deliver the license, the source, or a private cloud.'));
});

check('dropship buys the listing desk, and orbital compute stays unpriced', () => {
  const advice = shelf.advise('I want to dropship with Printful');
  assert.strictEqual(advice.primary.id, 'dropship-listing-desk');
  assert.strictEqual(advice.primary.buyable, true);
  assert.ok(advice.primary.ctaHref.includes('/checkout/?plan=dropship-listing-desk'));
  assert.ok(/does not dispatch a parcel/i.test(advice.primary.strategy));
  const blocked = shelf.advise('I want orbital compute');
  assert.ok(blocked.limits && blocked.limits.length === 1);
  assert.strictEqual(blocked.limits[0].priced, false);
  assert.strictEqual(blocked.limits[0].priceLabel, '');
  assert.ok(blocked.limits[0].ctaHref.includes('/frontier'));
  assert.ok(blocked.primary);
});

check('pricing, services, buy, and home share one shelf', () => {
  const kick = shelf.byId('ent-engagement-kickoff');
  for (const path of ['/pricing', '/services', '/buy']) {
    const html = shell.getHtml(path);
    assert.ok(html.includes('data-product-id="' + kick.id + '"'), path + ' kickoff');
    assert.ok(html.includes(kick.ctaHref), path + ' kickoff href');
    assert.ok(!html.includes('/checkout/?plan=ent-acquisition-pack'), path + ' contract figure');
    assert.ok(!html.includes('$4,000,000'), path + ' contract price');
  }
  const pricing = shell.getHtml('/pricing');
  assert.ok(!/\/checkout\/\?plan=starter(?![a-z0-9_-])/i.test(pricing));
  assert.ok(!/\/checkout\/\?plan=pro(?![a-z0-9_-])/i.test(pricing));
  const home = shell.getHtml('/');
  assert.ok(home.includes('id="costDemo"'));
  assert.ok(!home.includes('data-pricing-plan="starter"'));
  const ro = shelf.advise('Am o companie și vreau un chatbot');
  const en = shelf.advise('I need a chatbot for patient questions');
  assert.strictEqual(ro.lang, 'ro');
  assert.strictEqual(en.lang, 'en');
  assert.notStrictEqual(ro.primary.strategy, en.primary.strategy);
  assert.ok(!/Kickoff pack now|About \d+ days|Sistemul finit ajunge/.test(ro.primary.strategy));
  assert.ok(ro.primary.strategy.includes('zile') || ro.primary.strategy.includes('Nu este un coș') || ro.primary.strategy.includes('Rezervi') || ro.primary.strategy.includes('Plătești') || ro.primary.strategy.includes('Primești'));
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
  assert.ok(!advice.also.some((x) => x.id === 'ent-acquisition-pack' || x.id === 'ent-platform-license' || x.id === 'ent-private-cloud'));
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
  assert.ok(advice.also.some((x) => x.buyable === true && x.id !== 'ent-engagement-kickoff'));
  assert.ok(!advice.also.some((x) => require('../src/commerce/real-price').isContractFigure(x.id)));
  for (const row of [advice.primary].concat(advice.also)) {
    if (row && row.id) assert.ok(ids.has(row.id), row.id);
  }
});

check('advise reserves a kickoff file for a company and does not jump to the license', () => {
  const advice = shelf.advise('We are a company and we need a mobile app');
  assert.strictEqual(advice.buyer.kind, 'company');
  assert.strictEqual(advice.buyer.org, null);
  assert.strictEqual(advice.primary.id, 'professional-mobile-app');
  assert.notStrictEqual(advice.primary.id, 'ent-engagement-kickoff');
  assert.ok(advice.question.includes('Heard as a company'));
  assert.ok(advice.question.includes('file'));
  assert.ok(advice.primary.title.includes('Kickoff'));
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
