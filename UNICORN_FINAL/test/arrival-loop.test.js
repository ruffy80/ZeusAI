'use strict';

/**
 * arrival-loop.test.js
 * Homepage → named shelf offer → checkout, then a sentence the visitor can send.
 * English stays the only document. The marketing sitemap stays seven URLs.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const shell = require('../src/site/v2/shell');
const seo = require('../src/seo/sitemap-helpers');
const shelf = require('../src/commerce/public-shelf');
const growth = require('../src/seo/organic-growth');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

function money(n) {
  return shelf.money(n);
}

console.log('Arrival loop');

check('the first screen names the file, the list price, and the next button', () => {
  const home = shell.getHtml('/');
  const hero = home.slice(home.indexOf('id="costHero"'), home.indexOf('id="homeDoors"'));
  const item = shelf.byId('instant-website-audit');
  assert.ok(item && item.priceUsd > 0);
  assert.match(home, /<h1 id="dtHeroH1">Cut Your AI API Costs by 70% Automatically<\/h1>/);
  assert.ok(hero.includes('id="homeOfferWhat"'));
  assert.ok(hero.includes('Markdown website audit'));
  assert.ok(hero.includes('id="homeOfferPrice"'));
  assert.ok(hero.includes('List <b>' + money(item.priceUsd) + '</b>'));
  assert.ok(hero.includes('Delivery $0'));
  assert.ok(hero.includes('Bitcoin on the next page is 10% under this list.'));
  assert.ok(!hero.includes('$39'));
  assert.match(hero, /id="homeOfferNext"[^>]*href="\/services\/instant-website-audit"/);
  assert.ok(hero.includes('>Open this file<'));
  assert.match(hero, /id="dtHeroCta"[^>]*href="\/services\/ent-engagement-kickoff"[^>]*>Get Enterprise Access</);
  assert.ok(!/resume/i.test(hero));
  assert.ok(!home.includes('id="homeAtlas"'));
  assert.ok(!home.includes('hreflang'));
  assert.ok(home.includes('id="homeLocale"'));
});

check('pricing and the three solution pages open one named shelf offer', () => {
  const audit = shelf.byId('instant-website-audit');
  const kick = shelf.byId('ent-engagement-kickoff');
  const pricing = shell.getHtml('/pricing');
  assert.ok(pricing.includes('data-offer-id="instant-website-audit"'));
  assert.ok(pricing.includes('href="/services/instant-website-audit"'));
  assert.ok(pricing.includes('<dt>List</dt><dd>' + money(audit.priceUsd) + '</dd>'));
  assert.ok(pricing.includes('href="/services/ent-engagement-kickoff"'));
  for (const path of ['/solutions/model-routing', '/solutions/self-healing', '/solutions/autonomous-agents']) {
    const html = shell.getHtml(path);
    assert.ok(html.includes('Contact Sales'), path);
    assert.ok(html.includes('data-offer-id="ent-engagement-kickoff"'), path);
    assert.ok(html.includes('href="/services/ent-engagement-kickoff"'), path);
    assert.ok(html.includes('<dt>List</dt><dd>' + money(kick.priceUsd) + '</dd>'), path);
    assert.ok(html.includes('<dt>Bitcoin</dt>'), path);
    assert.ok(html.includes('<dt>Delivery</dt><dd>$0</dd>'), path);
    assert.ok(!html.includes('"@type":"Offer"'), path);
  }
});

check('the offer and the checkout leave a sentence the visitor can send', () => {
  const offer = shell.getHtml('/services/instant-website-audit');
  assert.ok(offer.includes('id="sendDoor"'));
  assert.ok(offer.includes('id="sendText"'));
  assert.ok(offer.includes('has not taken payment and has not issued the file'));
  assert.ok(offer.includes('https://zeusai.pro/services/instant-website-audit'));
  assert.ok(offer.includes('The server does not post.'));
  assert.ok(offer.includes('https://twitter.com/intent/tweet?text='));
  assert.ok(offer.includes('https://www.linkedin.com/sharing/share-offsite/?url='));
  assert.ok(offer.includes('https://www.reddit.com/submit?url='));
  assert.ok(offer.includes('https://medium.com/new-story'));
  assert.ok(offer.includes('https://dev.to/new'));
  assert.ok(offer.includes('https://news.ycombinator.com/submitlink?u='));
  assert.ok(offer.includes('<dt>Bitcoin</dt>'));
  assert.ok(offer.includes('<dt>Delivery</dt><dd>$0</dd>'));
  assert.ok(offer.includes('You keep the file.'));
  assert.ok(offer.includes('id="svcBuyBtn"'));
  assert.ok(offer.includes('href="/checkout/?plan=instant-website-audit"'));
  const checkout = shell.getHtml('/checkout', { plan: 'instant-website-audit' });
  assert.ok(checkout.includes('id="sendText"'));
  assert.ok(checkout.includes('has not taken payment and has not issued the file'));
  assert.ok(checkout.includes('id="checkoutPayBitcoin"'));
  assert.ok(checkout.includes('>⚡ Pay with Bitcoin<'));
  assert.ok(checkout.includes('Delivery'));
  let paypal = false;
  let card = false;
  try {
    const rails = require('../src/commerce/alt-rails-os');
    paypal = !!(rails.isPaypalArmed && rails.isPaypalArmed());
    card = !!(rails.isNowPaymentsArmed && rails.isNowPaymentsArmed());
  } catch (_) { /* bitcoin only */ }
  if (!paypal) assert.match(checkout, /id="coBuyPaypalTop"[^>]*\shidden/);
  if (!card) assert.match(checkout, /id="coBuyNowTop"[^>]*\shidden/);
  const kick = shell.getHtml('/services/ent-engagement-kickoff');
  assert.ok(kick.includes('has not issued the pack'));
  assert.ok(kick.includes('does not deliver the license, the source, or a private cloud'));
});

check('the marketing sitemap stays the seven pages and traffic is not invented', () => {
  const paths = seo.corePublicPaths();
  assert.deepStrictEqual(paths, [
    '/',
    '/about',
    '/pricing',
    '/contact',
    '/solutions/model-routing',
    '/solutions/self-healing',
    '/solutions/autonomous-agents',
  ]);
  const html = growth.deskHtml();
  const view = growth.consoleView();
  if (!view.armed) {
    assert.ok(html.includes('id="trafficUnmeasured"'));
    assert.ok(html.includes('Traffic is not measured.'));
  } else {
    assert.ok(html.includes('Queries Google returned'));
    assert.ok(html.includes('Pages Google returned'));
  }
  assert.ok(!/estimated visitors/i.test(html));
  assert.ok(!/top 1%/i.test(html));
  const seoPage = shell.getHtml('/seo');
  assert.ok(!seoPage.includes('Googlebot is blocked from /origin'));
  assert.ok(seoPage.includes('stay crawlable so Google can read that tag'));
});

console.log('\n✅ arrival-loop: ' + passed + ' tests passed');
process.exit(0);
