'use strict';

/**
 * discovery-seven.test.js — D7/1.0
 * The seven discovery checks stay honest. Guides, titles, and sitemap
 * paths come from the live shelf. Index, Search Console, and social
 * posts are not invented.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.DISCOVERY_SEVEN_FILE = require('path').join(require('os').tmpdir(), 'd7-' + process.pid + '.json');
delete process.env.GOOGLE_SITE_VERIFICATION;
delete process.env.GOOGLE_SITE_VERIFICATION_META;
delete process.env.GOOGLE_SITE_VERIFICATION_TOKEN;
delete process.env.GSC_HTML_TOKEN;
delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
delete process.env.X_BEARER_TOKEN;
delete process.env.FACEBOOK_PAGE_TOKEN;
delete process.env.LINKEDIN_ACCESS_TOKEN;
delete process.env.REDDIT_CLIENT_ID;

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const d7 = require('../backend/modules/discovery-seven');
const shelf = require('../src/commerce/public-shelf');
const seo = require('../src/seo/sitemap-helpers');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('audit names all seven checks and invents nothing', () => {
  const report = d7.audit();
  assert.strictEqual(report.protocol, 'D7/1.0');
  assert.strictEqual(report.inventsIndexed, false);
  assert.strictEqual(report.inventsVisitors, false);
  assert.strictEqual(report.inventsReach, false);
  assert.strictEqual(report.inventsPosts, false);
  assert.strictEqual(report.improvesForever, true);
  assert.strictEqual(report.points.length, 7);
  const indexed = report.points.find((p) => p.key === 'googleIndexed');
  assert.strictEqual(indexed.closed, false);
  assert.strictEqual(indexed.known, false);
  assert.strictEqual(indexed.indexed, null);
  const gsc = report.points.find((p) => p.key === 'searchConsole');
  assert.strictEqual(gsc.closed, false);
  assert.ok(String(gsc.blocker || '').includes('GOOGLE_SERVICE_ACCOUNT_JSON'));
  const promo = report.points.find((p) => p.key === 'promotion');
  assert.strictEqual(promo.closed, true);
  assert.strictEqual(promo.required, false);
  assert.strictEqual(promo.secondary, true);
  assert.strictEqual(promo.posted, false);
  assert.strictEqual(promo.whyOpen, null);
  assert.ok(promo.channels.every((c) => c.posted === false && c.armed === false));
  assert.ok(!/indexed: true|millions of users|guaranteed traffic/i.test(JSON.stringify(report)));
});

check('buyable guide matches shelf price and checkout', () => {
  const item = shelf.byId('instant-seo-content-pack');
  const guide = d7.guideFor(item.id);
  assert.ok(guide);
  assert.strictEqual(guide.priceUsd, item.priceUsd);
  assert.strictEqual(guide.ctaHref, item.ctaHref);
  assert.strictEqual(guide.buyable, true);
  const html = d7.guideHtml(item.id);
  assert.ok(html.includes('data-product-id="' + item.id + '"'));
  assert.ok(!html.includes('schema.org/InStock'), 'the guide does not publish a second merchant offer');
  assert.ok(html.includes('data-price-usd="' + item.priceUsd + '"'));
  assert.ok(html.includes(item.ctaHref));
  assert.ok(!/aggregateRating/.test(html));
  const meta = d7.serviceMeta(item.id);
  assert.ok(meta.title.includes('SEO'));
  assert.notStrictEqual(meta.title, 'Service');
  assert.ok(meta.description.includes(meta.title.slice(0, 24)));
});

check('the kickoff is the payable enterprise file and a contract figure is not on the shelf', () => {
  assert.strictEqual(shelf.byId('ent-acquisition-pack'), null);
  const html = d7.guideHtml('ent-engagement-kickoff');
  assert.ok(html.includes('does not deliver the license'));
  const kickItem = shelf.byId('ent-engagement-kickoff');
  assert.ok(kickItem.buyable);
  assert.ok(html.includes(kickItem.ctaHref));
});

check('sitemap and IndexNow list the service page and omit guides and internal routes', () => {
  const xml = seo.marketingUrlset('https://zeusai.pro');
  assert.ok(xml.includes('https://zeusai.pro/solutions/model-routing</loc>'));
  assert.ok(!xml.includes('https://zeusai.pro/services/instant-seo-content-pack</loc>'));
  assert.ok(xml.includes('<lastmod>'));
  assert.ok(!xml.includes('/guides'));
  assert.ok(!xml.includes('/seo</loc>'));
  assert.ok(!xml.includes('/origin</loc>'));
  assert.ok(!xml.includes('/api/'));
  const urls = require('../backend/modules/traffic-engine').urlsToSubmit();
  const paths = urls.map((u) => new URL(u).pathname);
  assert.ok(paths.includes('/solutions/model-routing'));
  assert.ok(!paths.includes('/services/instant-seo-content-pack'));
  assert.ok(!paths.some((p) => p === '/guides' || p.startsWith('/guides/')));
  assert.ok(!paths.includes('/origin'));
  assert.ok(!paths.some((p) => p.startsWith('/api/')));
  assert.ok(!paths.includes('/status'));
});

check('shell and SEO desk render the seven checks and unique service titles', () => {
  const shell = fs.readFileSync(path.join(__dirname, '../src/site/v2/shell.js'), 'utf8');
  assert.ok(shell.includes("case '/guides'"));
  assert.ok(shell.includes("route.startsWith('/guides/')"));
  assert.ok(shell.includes('serviceMeta'));
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(site.includes("'/guides'"));
  assert.ok(site.includes("v2Path.startsWith('/guides/')"));
  assert.ok(site.includes('/.well-known/discovery-seven.json'));
  const backend = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
  assert.ok(backend.includes("'/api/discovery-seven'"));
  const seoPage = require('../src/site/v2/seo-surface').pageSeo();
  assert.ok(seoPage.includes('id="discoverySeven"'));
  assert.ok(seoPage.includes('Site-ul este indexat în Google?'));
  assert.ok(/Not yet/.test(seoPage));
  const { getHtml } = require('../src/site/v2/shell');
  const html = getHtml('/services/instant-seo-content-pack', { id: 'instant-seo-content-pack' });
  assert.ok(html.includes('Instant SEO Content Pack'));
  assert.ok(!/<title>Service — ZEUSAI<\/title>/.test(html));
  const guidePage = getHtml('/guides/instant-seo-content-pack');
  assert.ok(guidePage.includes('id="offerGuide"'));
  assert.ok(guidePage.includes('Instant SEO Content Pack'));
});

check('tick remembers the guide set and still does not close Google', () => {
  const first = d7.tick();
  assert.strictEqual(first.firstObservation, true);
  assert.ok(fs.existsSync(process.env.DISCOVERY_SEVEN_FILE));
  const second = d7.tick();
  assert.strictEqual(second.firstObservation, false);
  assert.deepStrictEqual(second.addedSinceLastTick, []);
  assert.strictEqual(second.points.find((p) => p.key === 'googleIndexed').closed, false);
  assert.ok(second.points.find((p) => p.key === 'sitemap').closed);
  assert.ok(second.points.find((p) => p.key === 'articles').closed);
  assert.ok(second.points.find((p) => p.key === 'findability').closed);
});

check('llms lines list every shelf guide and do not require a social network', () => {
  const lines = d7.llmsOfferLines('https://zeusai.pro');
  assert.ok(lines.includes('without a social network'));
  assert.ok(lines.includes('https://zeusai.pro/guides'));
  assert.ok(lines.includes('https://zeusai.pro/llms.txt'));
  assert.ok(!/facebook\.com|tiktok\.com/i.test(lines));
  shelf.publicShelf().forEach((item) => {
    assert.ok(lines.includes('/guides/' + encodeURIComponent(item.id)), item.id);
    assert.ok(lines.includes(item.title), item.id);
  });
  const promo = d7.audit().points.find((p) => p.key === 'promotion');
  assert.strictEqual(promo.closed, true);
  assert.strictEqual(promo.posted, false);
  assert.ok(String(promo.note).includes('not how a stranger becomes a buyer'));
  const src = fs.readFileSync(path.join(__dirname, '../src/site/sovereign-extensions.js'), 'utf8');
  assert.ok(src.includes('llmsOfferLines'));
});

check('guides in the sitemap are shelf offers, and aliases do not share a title', () => {
  const { getHtml } = require('../src/site/v2/shell');
  const paths = d7.publicPaths().filter((p) => p.startsWith('/guides/'));
  const ids = shelf.publicShelf().map((item) => item.id);
  assert.strictEqual(paths.length, ids.length);
  ids.forEach((id) => {
    assert.ok(paths.includes('/guides/' + encodeURIComponent(id)), id);
    assert.ok(d7.guideFor(id), id);
  });
  const xml = seo.marketingUrlset('https://zeusai.pro');
  assert.ok(!xml.includes('/checkout</loc>'));
  assert.ok(!xml.includes('/marketplace</loc>'));
  assert.ok(!xml.includes('/guides/'));
  const bare = getHtml('/checkout');
  assert.match(bare, /name="robots" content="noindex"/);
  assert.match(bare, /rel="canonical" href="https:\/\/zeusai\.pro\/checkout"/);
  const priced = getHtml('/checkout', { plan: 'instant-resume-makeover' });
  assert.match(priced, /rel="canonical" href="https:\/\/zeusai\.pro\/services\/instant-resume-makeover"/);
  assert.match(priced, /name="robots" content="noindex"/);
  const missing = getHtml('/guides/not-a-real-offer');
  assert.match(missing, /name="robots" content="noindex"/);
  assert.match(missing, /Guide not on the shelf/);
  const x = (getHtml('/from/x').match(/<title>([^<]+)<\/title>/) || [])[1];
  const facebook = (getHtml('/from/facebook').match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.notStrictEqual(x, facebook);
  assert.match(x, /from X/);
  assert.match(facebook, /from Facebook/);
  const live = getHtml('/live-actions');
  assert.doesNotMatch(live, /<title>ZeusAI — ZEUSAI<\/title>/);
  assert.match(getHtml('/autonomy'), /rel="canonical" href="https:\/\/zeusai\.pro\/live-actions"/);
  assert.match(getHtml('/marketplace'), /rel="canonical" href="https:\/\/zeusai\.pro\/services"/);
  assert.doesNotMatch(getHtml('/'), /hreflang=/);
});

check('the homepage and account lead with the offer, and social stays secondary', () => {
  const { getHtml } = require('../src/site/v2/shell');
  const home = getHtml('/');
  assert.ok(home.includes('id="costDemo"'));
  assert.ok(home.includes('Get Enterprise Access'));
  assert.ok(home.includes('href="/services"'));
  assert.ok(!/sign in with (google|x|twitter|facebook)/i.test(home));
  const landing = require('../src/site/v2/discover-trust-os').homeLandingHtml();
  assert.ok(landing.includes('id="buyerWithoutSocial"'));
  assert.ok(landing.includes('No social account'));
  const account = getHtml('/account');
  assert.ok(account.includes('Browse offers'));
  assert.ok(account.includes('Social is optional'));
  assert.ok(!account.includes('Open ZeusAI Social'));
  const svc = getHtml('/services/instant-resume-makeover');
  assert.ok(svc.includes('No social account is required to pay'));
});

check('test chain includes this file', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.ok(String(pkg.scripts['test:chain']).includes('discovery-seven.test.js'));
});

console.log('\n✅ discovery-seven: ' + passed + ' tests passed');
process.exit(0);
