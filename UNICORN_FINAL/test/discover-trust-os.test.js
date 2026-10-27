'use strict';

/**
 * discover-trust-os.test.js — DTO/1.0
 * Honest discoverability: pages, sitemap paths, first-party A/B counts,
 * outreach drafts that are never sent.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dto = require('../src/site/v2/discover-trust-os');
const shell = require('../src/site/v2/shell');
const seo = require('../src/seo/sitemap-helpers');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

check('protocol stays honest', () => {
  dto.resetForTests();
  const s = dto.status();
  assert.strictEqual(s.protocol, 'DTO/1.0');
  assert.strictEqual(s.inventsTestimonials, false);
  assert.strictEqual(s.inventsAddress, false);
  assert.strictEqual(s.inventsReviews, false);
  assert.strictEqual(s.inventsVisitors, false);
  assert.strictEqual(s.inventsCustomers, false);
  assert.strictEqual(s.analytics.thirdPartyScriptsInjected, false);
  assert.strictEqual(s.analytics.ga4Enabled, false);
  assert.strictEqual(s.analytics.sentryEnabled, false);
});

check('ten articles, four topic pages, and twenty communities, desk excluded from sitemap', () => {
  assert.strictEqual(dto.ARTICLES.length, 10);
  assert.strictEqual(dto.LANDINGS.length, 4);
  assert.strictEqual(dto.socialDrafts().length, 5);
  dto.socialDrafts().forEach((d) => {
    assert.strictEqual(d.sent, false);
    assert.strictEqual(d.inventsReach, false);
  });
  assert.strictEqual(dto.outreachTargets().length, 20);
  const paths = dto.publicPaths();
  assert.ok(paths.includes('/trust-safety'));
  assert.ok(paths.includes('/insights/autonomous-ai-commerce'));
  assert.ok(paths.includes('/insights/ai-orchestration-on-a-public-shelf'));
  assert.ok(paths.includes('/insights/reading-a-low-trust-score'));
  assert.ok(paths.includes('/model-routing'));
  assert.ok(paths.includes('/experiment-engine'));
  assert.ok(!paths.includes('/outreach-desk'));
  dto.ARTICLES.forEach((a) => {
    assert.ok(a.paragraphs.length >= 4);
    assert.ok(!/customers love us|rated 5 stars|testimonial from Jane/i.test(a.paragraphs.join(' ')));
  });
  const pub = seo.corePublicPaths();
  assert.ok(pub.includes('/'));
  assert.ok(pub.includes('/about'));
  assert.ok(pub.includes('/pricing'));
  assert.ok(pub.includes('/contact'));
  assert.ok(pub.includes('/solutions/model-routing'));
  assert.ok(pub.includes('/solutions/self-healing'));
  assert.ok(pub.includes('/solutions/autonomous-agents'));
  assert.ok(!pub.includes('/insights/ai-resume-service-bitcoin'));
  assert.ok(!pub.includes('/services'));
  assert.ok(!pub.includes('/trust-safety'));
  assert.ok(!pub.includes('/multi-agent'));
  assert.ok(!pub.includes('/outreach-desk'));
  assert.ok(!pub.includes('/origin'));
});

check('A/B counts impressions and conversions without cloaking the price', () => {
  dto.resetForTests();
  assert.strictEqual(dto.ssrVariant().id, 'A');
  assert.strictEqual(dto.ssrVariant().href, dto.HEADLINES.B.href);
  assert.ok(dto.HEADLINES.A.h1 !== dto.HEADLINES.B.h1);
  const again = dto.pickVariant('zeta-seed');
  assert.strictEqual(dto.pickVariant('zeta-seed').id, again.id);
  dto.track('impression', { variant: 'A' });
  dto.track('impression', { variant: 'B' });
  dto.track('conversion', { variant: 'B' });
  dto.track('checkout_start', {});
  dto.track('btc_checkout', {});
  dto.track('contact_submit', {});
  const counts = dto.eventCounts();
  assert.strictEqual(counts.impression.A, 1);
  assert.strictEqual(counts.impression.B, 1);
  assert.strictEqual(counts.conversion.B, 1);
  assert.strictEqual(counts.checkout_start, 1);
  assert.strictEqual(counts.btc_checkout, 1);
  assert.strictEqual(counts.contact_submit, 1);
  assert.strictEqual(dto.track('not-an-event', {}).ok, false);
});

check('outreach drafts never send and leads redact email', () => {
  dto.resetForTests();
  const draft = dto.draftOutreach([{ name: 'Ada', email: 'ada@example.com', company: 'Analytical', note: 'Builds engines.' }]);
  assert.strictEqual(draft.sent, false);
  assert.strictEqual(draft.transport, 'none');
  assert.strictEqual(draft.messages[0].sent, false);
  assert.ok(draft.messages[0].body.includes('was not sent'));
  assert.ok(draft.messages[0].body.includes('Ada'));
  assert.ok(!/nodemailer|smtp/i.test(JSON.stringify(draft)));
  const saved = dto.addLead({ name: 'Ada', email: 'ada@example.com', channel: 'r/webdev', status: 'draft' });
  assert.strictEqual(saved.ok, true);
  const hidden = dto.listLeads('');
  assert.strictEqual(hidden.unlocked, false);
  assert.strictEqual(hidden.leads[0].email, 'redacted');
  process.env.DISCOVER_TRUST_DESK_TOKEN = 'desk-token-test';
  const open = dto.listLeads('desk-token-test');
  assert.strictEqual(open.unlocked, true);
  assert.strictEqual(open.leads[0].email, 'ada@example.com');
  delete process.env.DISCOVER_TRUST_DESK_TOKEN;
});

check('search console meta is inert until a token is set', () => {
  delete process.env.GOOGLE_SITE_VERIFICATION;
  assert.strictEqual(dto.headExtras(), '');
  assert.strictEqual(dto.analyticsConfig().searchConsoleMeta, false);
  process.env.GOOGLE_SITE_VERIFICATION = 'short';
  assert.strictEqual(dto.headExtras(), '');
  process.env.GOOGLE_SITE_VERIFICATION = 'google-token-ok';
  assert.ok(dto.headExtras().includes('google-site-verification'));
  assert.ok(!dto.headExtras().includes('googletagmanager'));
  assert.ok(!dto.headExtras().includes('plausible'));
  delete process.env.GOOGLE_SITE_VERIFICATION;
  process.env.GA_MEASUREMENT_ID = 'G-TEST1234';
  process.env.SENTRY_DSN = 'https://secret@sentry.example/1';
  const cfg = dto.analyticsConfig();
  assert.strictEqual(cfg.ga4Enabled, false);
  assert.strictEqual(cfg.sentryEnabled, false);
  assert.strictEqual(cfg.gaMeasurementPresent, true);
  assert.ok(!JSON.stringify(cfg).includes('secret'));
  delete process.env.GA_MEASUREMENT_ID;
  delete process.env.SENTRY_DSN;
});

check('pages render trust, articles, faq, and a noindex desk', () => {
  const home = shell.getHtml('/');
  assert.ok(home.includes('id="dtHeroH1"'));
  assert.ok(home.includes('Cut Your AI API Costs by 70% Automatically'));
  assert.ok(home.includes('id="dtHeroCta"'));
  assert.ok(home.includes('Get Enterprise Access'));
  assert.ok(home.includes('id="costDemo"'));
  assert.ok(home.includes('Test the Router Live'));
  assert.ok(!home.includes('Get My $39 Resume Makeover'));
  assert.ok(!home.includes('Show me the offer'));
  assert.ok(!home.includes('id="resumeSample"'));
  assert.ok(!home.includes('No published buyer quotes yet.'));
  const hero = home.slice(home.indexOf('id="costHero"'), home.indexOf('id="homeDoors"'));
  assert.ok(!/resume/i.test(hero));
  assert.ok(home.includes('href="/services/instant-resume-makeover"'));
  assert.ok(!home.includes('Is this a scam?'));
  assert.ok(!home.includes('unpaid-delivery'));
  assert.ok(!home.includes('low automated trust score'));
  assert.ok(!home.includes('Do I need to pay with Bitcoin?'));
  assert.ok(home.includes('href="/solutions/model-routing"'));
  assert.ok(home.includes('href="/solutions/self-healing"'));
  assert.ok(home.includes('href="/solutions/autonomous-agents"'));
  assert.ok(home.includes('href="/solutions/continuous-rd"'));
  assert.ok(!home.includes('id="homeAtlas"'));
  const objections = dto.objectionHtml();
  assert.ok(objections.includes('Who operates ZeusAI, and how does support work?'));
  assert.ok(objections.includes('How does the refund work?'));
  assert.ok(objections.includes('Do I need to pay with Bitcoin?'));
  const landing = dto.homeLandingHtml();
  assert.ok(landing.includes('No published buyer quotes yet.'));
  assert.ok(landing.includes('does not publish invented testimonials'));
  const shelfPage = shell.getHtml('/services');
  assert.ok(shelfPage.includes('id="homeAtlas"') || shelfPage.includes('data-product-id="instant-resume-makeover"'));
  assert.ok(shelfPage.includes('data-product-id="instant-resume-makeover"'));
  assert.ok(shelfPage.includes('data-product-id="instant-website-audit"'));
  assert.ok(shelfPage.includes('data-product-id="professional-saas-mvp"'));
  assert.ok(shelfPage.includes('data-product-id="ent-engagement-kickoff"'));
  assert.ok(shelfPage.includes('data-product-id="ent-acquisition-pack"'));
  assert.ok(shelfPage.includes('data-product-id="ent-sovereign-deployment"'));
  assert.ok(shelfPage.includes('It does not deliver the license'));
  assert.ok(shelfPage.includes('They are not in the download'));
  assert.ok(shelfPage.includes('not an instant download'));
  assert.ok(shelfPage.includes('Buy the engagement pack →'));
  assert.ok(shelfPage.includes('/checkout/?plan=ent-acquisition-pack'));
  assert.ok(shelfPage.includes('/checkout/?plan=ent-engagement-kickoff'));
  assert.ok(home.includes('"@type":"Service"'));
  assert.ok(!home.includes('id="homeRelayGraft"'));
  assert.ok(!home.includes('Ship AI products at machine speed'));
  assert.ok(!home.includes('stays at zero'));
  assert.ok(!home.includes('paidHumans stays 0'));
  assert.ok(!/when those rails are armed/.test(home));
  assert.ok(!/0 paid humans\.\s*<span class="grad">Be Origin #1\./.test(home));
  const origin = shell.getHtml('/origin');
  assert.ok(/paidHumans|0 paid humans/i.test(origin));
  const trust = shell.getHtml('/trust-safety');
  assert.ok(trust.includes('Trust, Transparency'));
  assert.ok(trust.includes('Delivery and contact'));
  assert.ok(trust.includes('Privacy is still on'));
  assert.ok(!trust.includes('Not denied'));
  assert.ok(!trust.includes('score near zero'));
  assert.ok(!trust.includes('Is this a scam?'));
  assert.ok(trust.includes('/refund'));
  assert.ok(trust.includes('vladoi_ionut@yahoo.com') || trust.includes('mailto:'));
  assert.ok(trust.includes('Not published'));
  assert.ok(!/123 Main Street|ACME LTD/i.test(trust));
  const scoreNote = shell.getHtml('/insights/reading-a-low-trust-score');
  assert.ok(scoreNote.includes('How to check ZeusAI before you pay'));
  assert.ok(!scoreNote.includes('complaint exists'));
  assert.ok(!scoreNote.includes('Scamadviser'));
  assert.ok(!scoreNote.includes('low automated trust score'));
  const faq = shell.getHtml('/faq');
  assert.ok(faq.includes('Who operates ZeusAI, and how does support work?'));
  assert.ok(!faq.includes('Is this a scam?'));
  assert.ok(!faq.includes('unpaid-delivery'));
  const article = shell.getHtml('/insights/bitcoin-checkout-for-ai-services');
  assert.ok(article.includes('How Bitcoin checkout works'));
  assert.ok(article.includes('"@type":"Article"'));
  assert.ok(article.includes('<link rel="canonical" href="https://zeusai.pro/insights/bitcoin-checkout-for-ai-services"/>'));
  const alias = shell.getHtml('/blog/bitcoin-checkout-for-ai-services');
  assert.ok(alias.includes('How Bitcoin checkout works'));
  assert.ok(alias.includes('<link rel="canonical" href="https://zeusai.pro/insights/bitcoin-checkout-for-ai-services"/>'));
  const topic = shell.getHtml('/model-routing');
  assert.ok(topic.includes('id="topicLanding"'));
  assert.ok(topic.includes('There is no secret model-routing product.'));
  assert.ok(topic.includes('not a new SKU'));
  assert.ok(topic.includes('href="/#concierge"'));
  assert.ok(!topic.includes('/checkout/?plan=model-routing'));
  const about = shell.getHtml('/about');
  assert.ok(about.includes('Street address: Not published'));
  assert.ok(about.includes('Phone: Not published'));
  assert.ok(about.includes('Company registration: Not published'));
  assert.ok(!about.includes('160+'));
  assert.ok(!/123 Main Street|ACME LTD/i.test(about));
  const offers = shelfPage.match(/"@type":"Offer"[^}]*/g) || [];
  assert.ok(offers.length > 0);
  offers.forEach((o) => assert.ok(/"price":"/.test(o), o));
  assert.ok(!home.includes('"@type":"Offer"'));
  assert.ok(!home.includes('googletagmanager'));
  assert.ok(!home.includes('plausible.io'));
  const blog = shell.getHtml('/blog');
  assert.ok(blog.includes('/insights/autonomous-ai-commerce'));
  const desk = shell.getHtml('/outreach-desk');
  assert.ok(desk.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(desk.includes('id="dtDeskForm"'));
  const how = shell.getHtml('/how');
  assert.ok(how.includes('id="howBuyerPath"'));
  assert.ok(how.includes('/refund'));
  assert.ok(!how.includes('572M reach'));
  const missing = shell.getHtml('/insights/not-a-real-article');
  assert.ok(missing.includes('noindex, nofollow'));
});

check('robots disallow the desk and the client logs variants', () => {
  const robots = require('../src/seo/sitemap-helpers').robotsTxt('https://zeusai.pro');
  assert.ok(robots.includes('Disallow: /outreach-desk'));
  const client = fs.readFileSync(path.join(__dirname, '../src/site/v2/client.js'), 'utf8');
  assert.ok(client.includes('initDiscoverTrust'));
  assert.ok(client.includes("postDiscoverTrust('impression'"));
  assert.ok(client.includes("postDiscoverTrust('conversion'"));
  assert.ok(client.includes("postDiscoverTrust('contact_submit'"));
  assert.ok(client.includes("postDiscoverTrust('btc_checkout'"));
  const site = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(site.includes("'/trust-safety'"));
  assert.ok(site.includes("v2Path.startsWith('/insights/')"));
  assert.ok(site.includes("urlPath.startsWith('/api/discover-trust')"));
  assert.ok(site.includes("role: 'site'"));
  assert.ok(site.includes('backendConfigured: false'));
  assert.ok(site.includes('dbConnected: false'));
  const uptime = fs.readFileSync(path.join(__dirname, '../scripts/uptime-ping.js'), 'utf8');
  assert.ok(uptime.includes('200000'));
  assert.ok(!uptime.includes('slice(0, 500)'));
});

check('outreach script prints drafts and does not send', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'dto-'));
  const csv = path.join(dir, 'prospects.csv');
  fs.writeFileSync(csv, 'name,email,company,note\nAda,ada@example.com,Analytical,Builds engines.\n');
  const script = path.join(__dirname, '../scripts/outreach-draft.js');
  const src = fs.readFileSync(script, 'utf8');
  assert.ok(!/nodemailer|require\('https'\)|require\('http'\)/.test(src));
  const run = spawnSync(process.execPath, [script, csv], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.ok(run.stdout.includes('Sent: false'));
  assert.ok(run.stdout.includes('None were sent'));
  assert.ok(run.stdout.includes('ada@example.com'));
});

console.log('discover-trust-os: ' + passed + ' checks passed');
process.exit(0);
