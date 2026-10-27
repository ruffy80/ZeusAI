'use strict';

/**
 * Facts for answer engines. The pages explain ZeusAI and refuse invented
 * benchmarks, health scores, videos, and customers.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

async function main() {
  const geo = require('../src/site/v2/geo-desk');
  const seo = require('../src/seo/sitemap-helpers');

  await check('registry covers facts, worksheets, and checklists', () => {
    const paths = geo.paths();
    assert.ok(paths.length >= 80, 'expected a broad fact surface, got ' + paths.length);
    ['/what-is-zeus-ai', '/why-zeus-ai', '/zeus-ai-summary', '/zeus-ai-facts', '/zeus-ai-explained',
      '/cursor-alternative', '/tools', '/commit-message-generator', '/benchmarks',
      '/public-health-scores', '/repositories', '/videos', '/customer-stories', '/compliance',
      '/github-lists', '/republish', '/state-of-ai-engineering',
      '/best-code-review-tool-for/react', '/best-code-analysis-tool-for/python',
      '/javascript-code-quality', '/javascript-technical-debt', '/architecture/react',
    ].forEach((route) => assert.ok(geo.has(route), route));
    assert.strictEqual(paths.filter((p) => p.startsWith('/best-code-review-tool-for/')).length, 18);
    assert.strictEqual(paths.filter((p) => p.startsWith('/best-code-analysis-tool-for/')).length, 8);
  });

  await check('pages cite facts and refuse review schema', () => {
    geo.paths().forEach((route) => {
      const page = geo.meta(route);
      const html = geo.render(route);
      assert.strictEqual((html.match(/<h1/g) || []).length, 1, route);
      assert.ok(html.includes(geo.DISCLAIMER), route);
      assert.ok(html.includes('href="/services"'), route);
      assert.ok(html.includes('href="/pricing"'), route);
      assert.ok(html.includes('href="/learn"'), route);
      assert.ok(html.includes('"@type":"WebPage"'), route);
      assert.ok(html.includes('"@type":"FAQPage"'), route);
      assert.ok(!html.includes('"@type":"Review"'), route);
      assert.ok(!html.includes('"@type":"AggregateRating"'), route);
      assert.ok(!html.includes('"@type":"VideoObject"'), route);
      assert.ok(!html.includes('"@type":"SoftwareApplication"'), route);
      assert.ok(!/strongest authority/i.test(page.title + page.description + html), route);
      assert.ok(!page.title.includes('"'), route);
    });
  });

  await check('a worksheet formats input and does not invent a score', () => {
    const commit = geo.render('/commit-message-generator', { toolQuery: { type: 'fix', scope: 'seo', summary: 'describe the shelf' } });
    assert.ok(commit.includes('fix(seo): describe the shelf'));
    const blank = geo.render('/commit-message-generator', { toolQuery: {} });
    assert.ok(blank.includes('Type a summary'));
    const debt = geo.render('/tech-debt-calculator', { toolQuery: { hours: '2', rate: '10' } });
    assert.ok(debt.includes('Your inputs'));
    assert.ok(debt.includes('20'));
    assert.ok(debt.includes('not a ZeusAI debt balance'));
    const health = geo.render('/repository-health-check', { toolQuery: { mark: ['tests', 'owners'] } });
    assert.ok(health.includes('You marked 2 of 4'));
    assert.ok(health.includes('did not inspect a repository'));
    const bench = geo.render('/benchmarks');
    assert.ok(bench.includes('not measured'));
    assert.ok(!/\b\d{2,}\s*%/.test(bench));
  });

  await check('machine documents and the geo sitemap stay out of the seven URLs', async () => {
    const marketing = seo.marketingUrlset('https://zeusai.pro');
    assert.strictEqual((marketing.match(/<loc>/g) || []).length, 7);
    assert.ok(!marketing.includes('/what-is-zeus-ai'));
    const robots = seo.robotsTxt('https://zeusai.pro');
    assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap-geo.xml'));
    const facts = JSON.parse(geo.documentFor('/facts.json').body);
    assert.ok(facts.product.doesNot.includes('open a repository'));
    assert.strictEqual(facts.product.fileDeliveryUsd, 0);
    assert.ok(facts.statements.some((row) => row.status === 'not measured' && /benchmark/i.test(row.statement)));
    const csv = geo.documentFor('/facts.csv').body;
    assert.ok(csv.startsWith('statement,status,source'));
    assert.ok(csv.includes('not measured'));
    const pdf = geo.documentFor('/facts.pdf').body;
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.ok(pdf.includes('does not contain a benchmark'));
    const index = JSON.parse(geo.documentFor('/ai-index.json').body);
    assert.ok(index.doNotClaim.includes('review a pull request'));
    assert.strictEqual(index.language, 'en');
    const graph = JSON.parse(geo.documentFor('/knowledge-graph.json').body);
    assert.strictEqual(graph['@type'], 'Organization');
    assert.ok(!JSON.stringify(graph).includes('AggregateRating'));
    const sov = require('../src/site/sovereign-extensions');
    let body = '';
    let type = '';
    const res = {
      writeHead: (code, headers) => { type = headers['Content-Type'] || ''; },
      end: (b) => { body = b; },
      setHeader: () => {},
    };
    assert.strictEqual(await sov.handle({ url: '/sitemap-geo.xml', method: 'GET', headers: {} }, res, {}), true);
    assert.ok(type.includes('xml'));
    assert.ok(body.includes('/what-is-zeus-ai</loc>'));
    assert.ok(!body.includes('/learn</loc>'));
    const shell = require('../src/site/v2/shell');
    const page = shell.getHtml('/what-is-zeus-ai');
    assert.ok(page.includes('id="geoPage"'));
    assert.ok(page.includes('rel="canonical" href="https://zeusai.pro/what-is-zeus-ai"'));
    assert.ok(!page.includes('hreflang'));
    assert.ok(!page.includes('"@type":"VideoObject"'));
    const videos = shell.getHtml('/videos');
    assert.ok(videos.includes('No video is published'));
    assert.ok(videos.includes('no VideoObject'));
    assert.ok(!videos.includes('"@type":"VideoObject"'));
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /sitemap-geo.xml'));
    const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    assert.ok(indexJs.includes("require('./site/v2/geo-desk').has(v2Path)"));
    assert.ok(indexJs.includes('toolQuery'));
  });

  console.log('✅ geo-desk: ' + passed + ' tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
