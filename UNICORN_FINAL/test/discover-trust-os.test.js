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

check('five articles and twenty communities, desk excluded from sitemap', () => {
  assert.strictEqual(dto.ARTICLES.length, 5);
  assert.strictEqual(dto.outreachTargets().length, 20);
  const paths = dto.publicPaths();
  assert.ok(paths.includes('/trust-safety'));
  assert.ok(paths.includes('/insights/autonomous-ai-commerce'));
  assert.ok(paths.includes('/insights/reading-a-low-trust-score'));
  assert.ok(!paths.includes('/outreach-desk'));
  dto.ARTICLES.forEach((a) => {
    assert.ok(a.paragraphs.length >= 4);
    assert.ok(!/customers love us|rated 5 stars|testimonial from Jane/i.test(a.paragraphs.join(' ')));
  });
  const pub = seo.corePublicPaths();
  assert.ok(pub.includes('/trust-safety'));
  assert.ok(pub.includes('/insights/ai-resume-service-bitcoin'));
  assert.ok(!pub.includes('/outreach-desk'));
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
  assert.ok(home.includes('A resume written for the job you want.'));
  assert.ok(home.includes('id="dtHeroCta"'));
  assert.ok(home.includes('Get My $39 Resume Makeover'));
  assert.ok(home.includes('See How It Works'));
  assert.ok(home.includes('id="howItWorks"'));
  assert.ok(home.includes('id="homeTrust"'));
  assert.ok(home.includes('id="resumeSample"'));
  assert.ok(home.includes('No published buyer quotes yet.'));
  assert.ok(home.includes('does not publish invented testimonials'));
  assert.ok(home.includes('Is this a scam?'));
  assert.ok(home.includes('How does the refund work?'));
  assert.ok(home.includes('Do I need to pay with Bitcoin?'));
  assert.ok(home.includes('id="homeAtlas"'));
  assert.ok(home.includes('id="atlasMinutes"'));
  assert.ok(home.includes('id="atlasDays"'));
  assert.ok(home.includes('id="atlasContract"'));
  assert.ok(home.includes('data-product-id="instant-resume-makeover"'));
  assert.ok(home.includes('data-product-id="instant-website-audit"'));
  assert.ok(home.includes('data-product-id="professional-saas-mvp"'));
  assert.ok(home.includes('data-product-id="ent-engagement-kickoff"'));
  assert.ok(home.includes('data-product-id="ent-acquisition-pack"'));
  assert.ok(home.includes('data-product-id="ent-sovereign-deployment"'));
  assert.ok(home.includes('It does not deliver the license'));
  assert.ok(home.includes('not an instant download'));
  assert.ok(home.includes('See every priced deliverable'));
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
  assert.ok(trust.includes('Privacy is still on'));
  assert.ok(trust.includes('/refund'));
  assert.ok(trust.includes('vladoi_ionut@yahoo.com') || trust.includes('mailto:'));
  assert.ok(trust.includes('Not published'));
  assert.ok(!/123 Main Street|ACME LTD/i.test(trust));
  const article = shell.getHtml('/insights/bitcoin-checkout-for-ai-services');
  assert.ok(article.includes('How Bitcoin checkout works'));
  assert.ok(article.includes('"@type":"Article"'));
  assert.ok(article.includes('<link rel="canonical" href="https://zeusai.pro/insights/bitcoin-checkout-for-ai-services"/>'));
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
  const robots = fs.readFileSync(path.join(__dirname, '../src/site/sovereign-extensions.js'), 'utf8');
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
