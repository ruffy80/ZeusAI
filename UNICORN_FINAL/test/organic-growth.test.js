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

check('measured queries stay residue unless a shelf word matches', () => {
  const brand = growth.classifyQueries({
    status: 'measured',
    value: [
      { query: 'zeus ia', clicks: 0, impressions: 1, position: 14 },
      { query: 'zeus learn ai', clicks: 0, impressions: 1, position: 84 },
      { query: 'resume makeover bitcoin', clicks: 0, impressions: 2, position: 9 },
    ],
  });
  assert.deepStrictEqual(brand.residue.map((row) => row.query), ['zeus ia', 'zeus learn ai']);
  assert.strictEqual(brand.residue[0].article, null);
  assert.strictEqual(brand.echoes[0].href, '/services/instant-resume-makeover');
  const leaks = growth.noindexLeaks({
    status: 'measured',
    value: [
      { page: 'https://zeusai.pro/checkout', impressions: 1, clicks: 0 },
      { page: 'https://zeusai.pro/', impressions: 9, clicks: 3 },
    ],
  });
  assert.strictEqual(leaks.value.length, 1);
  assert.ok(leaks.value[0].page.endsWith('/checkout'));
  assert.strictEqual(growth.formatMetric({ status: 'measured', value: 0.3333333333333333 }, 'ctr'), '33.3%');
  assert.strictEqual(growth.formatMetric({ status: 'measured', value: 11.666666666666666 }, 'position'), '11.7');
  assert.ok(growth.sampleNote({ impressions: { status: 'measured', value: 9 } }).includes('too small'));
  assert.strictEqual(growth.sampleNote({ impressions: { status: 'measured', value: 40 } }), null);
  const site = read('src/index.js');
  assert.ok(site.includes("responseHeaders['X-Robots-Tag']"));
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

check('recommendations stay unwritten until all four metrics are measured', () => {
  const blocked = growth.recommendations({
    metrics: {
      clicks: { status: 'measured', value: 3 },
      impressions: { status: 'measured', value: 9 },
      ctr: { status: 'unavailable', value: null },
      position: { status: 'measured', value: 11.7 },
    },
  });
  assert.strictEqual(blocked.status, 'unavailable');
  assert.strictEqual(blocked.value, null);
  const view = {
    metrics: {
      clicks: { status: 'measured', value: 3 },
      impressions: { status: 'measured', value: 9 },
      ctr: { status: 'measured', value: 1 / 3 },
      position: { status: 'measured', value: 11.666666666666666 },
    },
    queries: {
      status: 'measured',
      value: [
        { query: 'zeus ia', clicks: 0, impressions: 1, ctr: 0, position: 14 },
        { query: 'zeus learn ai', clicks: 0, impressions: 1, ctr: 0, position: 84 },
      ],
    },
    pages: {
      status: 'measured',
      value: [
        { page: 'https://zeusai.pro/', clicks: 3, impressions: 9, ctr: 1 / 3, position: 11.67 },
        { page: 'https://zeusai.pro/checkout', clicks: 0, impressions: 1, ctr: 0, position: 5 },
        { page: 'https://zeusai.pro/docs', clicks: 0, impressions: 1, ctr: 0, position: 1 },
        { page: 'https://zeusai.pro/frontier', clicks: 0, impressions: 1, ctr: 0, position: 4 },
        { page: 'https://zeusai.pro/gift', clicks: 0, impressions: 1, ctr: 0, position: 1 },
      ],
    },
    inspections: {
      status: 'measured',
      value: [{
        inspectionUrl: 'https://zeusai.pro/checkout',
        status: 'measured',
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
        googleCanonical: 'https://zeusai.pro/checkout',
        userCanonical: 'https://zeusai.pro/checkout',
      }],
    },
  };
  view.leaks = growth.noindexLeaks(view.pages);
  view.demand = growth.classifyQueries(view.queries);
  const recs = growth.recommendations(view);
  assert.strictEqual(recs.status, 'measured');
  assert.strictEqual(recs.inventsTraffic, false);
  const ids = recs.value.map((item) => item.id);
  assert.ok(ids.includes('small-sample'));
  assert.strictEqual(ids.filter((id) => id === 'brand-residue').length, 2);
  assert.ok(ids.includes('noindex-shown'));
  assert.ok(ids.includes('indexed-noindex'));
  assert.deepStrictEqual(
    recs.value.filter((item) => item.id === 'shown-not-clicked').map((item) => item.action),
    [
      'Leave /docs unchanged until it gathers more impressions.',
      'Leave /frontier unchanged until it gathers more impressions.',
      'Leave /gift unchanged until it gathers more impressions.',
    ]
  );
  assert.ok(!ids.includes('offer-echo'));
  const text = JSON.stringify(recs);
  assert.ok(!/estimatedSessions|visits|sessions/.test(text));
  assert.ok(recs.value.some((item) => item.action.includes('zeus ia')));
});

check('the desk prints a measured read and its recommendations', () => {
  const bridgeDir = process.env.SEO_BRIDGE_DIR;
  fs.writeFileSync(path.join(bridgeDir, 'search-console-bridge.json'), JSON.stringify({
    performance: {
      ok: true,
      reason: 'search_console_row',
      siteUrl: 'sc-domain:zeusai.pro',
      range: { startDate: '2026-09-26', endDate: '2026-10-23' },
      metrics: {
        clicks: { status: 'measured', value: 3 },
        impressions: { status: 'measured', value: 9 },
        ctr: { status: 'measured', value: 1 / 3 },
        position: { status: 'measured', value: 11.666666666666666 },
      },
      queries: {
        status: 'measured',
        value: [
          { query: 'zeus ia', clicks: 0, impressions: 1, ctr: 0, position: 14 },
          { query: 'zeus learn ai', clicks: 0, impressions: 1, ctr: 0, position: 84 },
        ],
      },
      pages: {
        status: 'measured',
        value: [
          { page: 'https://zeusai.pro/', clicks: 3, impressions: 9, ctr: 1 / 3, position: 11.67 },
          { page: 'https://zeusai.pro/checkout', clicks: 0, impressions: 1, ctr: 0, position: 5 },
          { page: 'https://zeusai.pro/docs', clicks: 0, impressions: 1, ctr: 0, position: 1 },
        ],
      },
    },
  }));
  const view = growth.consoleView();
  assert.strictEqual(view.access.impressions, true);
  assert.strictEqual(view.access.clicks, true);
  assert.strictEqual(view.access.position, true);
  assert.strictEqual(view.access.ctr, true);
  assert.strictEqual(view.recommendations.status, 'measured');
  assert.strictEqual(view.inventsTraffic, false);
  const html = growth.deskHtml();
  assert.ok(html.includes('id="searchConsoleDashboard"'));
  assert.ok(html.includes('Accessible'));
  assert.ok(html.includes('33.3%'));
  assert.ok(html.includes('11.7'));
  assert.ok(html.includes('zeus ia'));
  assert.ok(html.includes('Do not create an article for'));
  assert.ok(html.includes('https://zeusai.pro/docs'));
  assert.ok(html.includes('not added into the property totals'));
  assert.ok(html.includes('2026-09-26'));
  assert.ok(!/estimated traffic is 9|1,200 visits/i.test(html));
  const pub = growth.publicReport();
  assert.strictEqual(pub.search.recommendations.inventsTraffic, false);
  assert.ok(!/private_key|ya29\./.test(JSON.stringify(pub)));
});

console.log('\n✅ organic-growth: ' + passed + ' tests passed');
process.exit(0);
