'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SEO_BRIDGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ogd-'));

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const growth = require('../src/seo/organic-growth');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓', name);
}

console.log('Organic growth desk (OGD/1.0)');

check('fifty proposals stay unpublished and carry no session estimate', () => {
  const briefs = growth.articleBriefs();
  assert.strictEqual(briefs.length, 50);
  const titles = new Set();
  for (const item of briefs) {
    assert.strictEqual(item.published, false);
    assert.strictEqual(item.estimatedSessions, null);
    assert.strictEqual(item.competition, 'unmeasured');
    assert.ok(item.href.startsWith('/services/'));
    assert.ok(item.guide.startsWith('/guides/'));
    titles.add(item.title);
  }
  assert.strictEqual(titles.size, 50);
});

check('the public report refuses invented traffic and a Lighthouse score', () => {
  const body = growth.publicReport();
  assert.strictEqual(body.protocol, 'OGD/1.0');
  assert.strictEqual(body.inventsClicks, false);
  assert.strictEqual(body.inventsRankings, false);
  assert.strictEqual(body.estimatedSessions, null);
  assert.strictEqual(body.lighthouse.status, 'unmeasured');
  assert.strictEqual(body.lighthouse.value, null);
  assert.strictEqual(body.lighthouse.before, null);
  assert.strictEqual(body.lighthouse.after, null);
  assert.strictEqual(body.publishedBriefs, 0);
  assert.strictEqual(body.briefCount, 50);
  const text = JSON.stringify(body);
  assert.ok(!/PRIVATE KEY|ya29\.|1,200 visits|low competition/i.test(text));
});

check('potential keywords exist only when Search Console measured them', () => {
  assert.strictEqual(growth.keywordPotential(null).status, 'unavailable');
  assert.strictEqual(growth.keywordPotential({ status: 'unavailable', value: null }).value, null);
  const hit = growth.keywordPotential({
    status: 'measured',
    value: [
      { query: 'zeusai checkout', impressions: 4, position: 18, clicks: 0, ctr: 0 },
      { query: 'already first', impressions: 9, position: 3, clicks: 1, ctr: 0.1 },
      { query: 'unseen', impressions: 0, position: 40, clicks: 0, ctr: 0 },
    ],
  });
  assert.strictEqual(hit.status, 'measured');
  assert.deepStrictEqual(hit.value.map((row) => row.query), ['zeusai checkout']);
});

check('alias, robots, 404, and script preload are in the server source', () => {
  assert.strictEqual(growth.aliasTarget('/marketplace'), '/services');
  assert.strictEqual(growth.aliasTarget('/autonomy'), '/live-actions');
  assert.strictEqual(growth.aliasTarget('/services'), null);
  const site = read('src/index.js');
  assert.ok(site.includes("'/marketplace': '/services'"));
  assert.ok(site.includes('X-Robots-Tag\': \'noindex, nofollow\''));
  assert.ok(!site.includes('rel=preload; as=script'));
  const robots = read('src/site/sovereign-extensions.js');
  assert.ok(robots.includes('Disallow: /admin'));
  assert.ok(robots.includes('Sitemap: ${OWNER.domain}/sitemap.xml'));
  const shell = read('src/site/v2/shell.js');
  assert.ok(shell.includes("path === '/__not-found__'"));
  assert.ok(shell.includes("content=\"${ogType}\""));
  assert.ok(shell.includes("'@type': 'Article'"));
  const seo = read('src/site/v2/seo-surface.js');
  assert.ok(seo.includes('organic-growth'));
  const chain = JSON.parse(read('package.json')).scripts['test:chain'];
  assert.ok(chain.includes('organic-growth.test.js'));
});

check('the desk HTML shows unavailable metrics and the share bar uses this page', () => {
  const html = growth.deskHtml();
  assert.ok(html.includes('id="organicGrowth"'));
  assert.ok(html.includes('Unavailable'));
  assert.ok(html.includes('sessions unavailable'));
  assert.ok(!/PRIVATE KEY/.test(html));
  const share = require('../src/commerce/share-surface').pageShareHtml({
    path: '/insights/bitcoin-checkout',
    title: 'Bitcoin checkout',
  });
  assert.ok(share.includes('https://www.facebook.com/sharer/sharer.php'));
  assert.ok(share.includes('https://twitter.com/intent/tweet'));
  assert.ok(share.includes('https://www.linkedin.com/sharing/share-offsite/'));
  assert.ok(share.includes('https://wa.me/?text='));
  assert.ok(share.includes(encodeURIComponent('https://zeusai.pro/insights/bitcoin-checkout')));
  assert.strictEqual(require('../src/commerce/share-surface').pageShareHtml({ path: 'https://evil.example' }), '');
});

console.log('\n✅ organic-growth: ' + passed + ' tests passed');
process.exit(0);
