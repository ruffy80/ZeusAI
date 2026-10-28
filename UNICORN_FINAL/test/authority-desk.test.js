'use strict';

/**
 * Engineering guides stay honest: they explain the search topics, they do
 * not claim ZeusAI reviews a repository, and they stay out of the 7-URL sitemap.
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

const EXPECTED = {
  blog: [
    'what-is-ai-code-review', 'ai-code-review-best-practices', 'ai-codebase-analysis-explained',
    'how-ai-understands-large-repositories', 'best-ai-coding-assistants', 'ai-software-engineering-platforms',
    'reduce-technical-debt-with-ai', 'monorepo-analysis-with-ai', 'repository-intelligence-explained',
    'ai-refactoring-guide', 'ai-architecture-review', 'ai-pull-request-review',
    'ai-developer-productivity-guide', 'ai-code-quality-metrics', 'ai-engineering-workflows',
    'best-developer-ai-tools', 'ai-for-startups', 'ai-for-software-agencies',
    'ai-for-enterprise-development', 'complete-guide-to-ai-software-engineering',
  ],
  compare: [
    'cursor', 'windsurf', 'github-copilot', 'devin', 'sourcegraph-cody',
    'replit', 'bolt', 'lovable', 'claude-code', 'openai-codex',
  ],
  use: [
    'startups', 'saas', 'agencies', 'enterprise', 'freelancers',
    'open-source', 'devops', 'qa-teams', 'engineering-managers', 'tech-leads',
    'founders', 'product-teams',
  ],
  framework: [
    'react', 'nextjs', 'vue', 'angular', 'nodejs', 'express', 'nest', 'laravel',
    'php', 'python', 'django', 'flask', 'java', 'spring', 'csharp', 'dotnet', 'go', 'rust',
  ],
  docs: [
    'getting-started', 'project-upload', 'code-review', 'feature-generator', 'engineer-mode',
    'health-score', 'git-tools', 'vs-code-extension', 'byok', 'team-workflows',
  ],
};

async function main() {
  const authority = require('../src/site/v2/authority-desk');
  const seo = require('../src/seo/sitemap-helpers');

  await check('registry covers the guide library', () => {
    const paths = authority.paths();
    assert.strictEqual(paths.length, 184);
    assert.ok(paths.includes('/learn'));
    assert.ok(paths.includes('/testimonials'));
    assert.ok(paths.includes('/use-cases'));
    assert.ok(paths.includes('/case-studies'));
    EXPECTED.blog.forEach((slug) => assert.ok(authority.has('/blog/' + slug), slug));
    EXPECTED.compare.forEach((slug) => assert.ok(authority.has('/' + slug + '-vs-zeus-ai'), slug));
    EXPECTED.use.forEach((slug) => assert.ok(authority.has('/use-cases/' + slug), slug));
    EXPECTED.framework.forEach((slug) => assert.ok(authority.has('/' + slug + '-ai-code-review'), slug));
    EXPECTED.docs.forEach((slug) => assert.ok(authority.has('/docs/' + slug), slug));
    assert.strictEqual(paths.filter((p) => p.startsWith('/best-ai-tool-for/')).length, 100);
    assert.ok(authority.has('/best-ai-tool-for/fullstack'));
    assert.ok(!authority.has('/docs'));
    assert.ok(!authority.has('/'));
    assert.ok(!authority.has('/blog'));
  });

  await check('every page is a guide, not a review or a ranking', () => {
    const titles = new Map();
    const descriptions = new Map();
    authority.paths().forEach((route) => {
      const page = authority.meta(route);
      assert.ok(page.title, route);
      assert.ok(page.description, route);
      assert.ok(!titles.has(page.title), 'duplicate title ' + page.title);
      assert.ok(!descriptions.has(page.description), 'duplicate description ' + route);
      titles.set(page.title, route);
      descriptions.set(page.description, route);
      assert.ok(!page.title.includes('"'), route);
      assert.ok(!page.description.includes('"'), route);
      const html = authority.render(route);
      assert.ok(html.includes('id="authorityPage"'), route);
      assert.ok(html.includes(authority.DISCLAIMER), route);
      assert.ok(html.includes('<h1'), route);
      assert.strictEqual((html.match(/<h1/g) || []).length, 1, route);
      assert.ok(html.includes('href="/services"'), route);
      assert.ok(html.includes('href="/pricing"'), route);
      assert.ok(html.includes('href="/contact"'), route);
      assert.ok(html.includes('"@type":"BreadcrumbList"'), route);
      assert.ok(html.includes('"@type":"FAQPage"'), route);
      assert.ok(!html.includes('"@type":"Review"'), route);
      assert.ok(!html.includes('"@type":"AggregateRating"'), route);
      assert.ok(!html.includes('"@type":"SoftwareApplication"'), route);
      assert.ok(!html.includes('"@type":"Product"'), route);
    });
  });

  await check('comparisons refuse the alternative claim', () => {
    EXPECTED.compare.forEach((slug) => {
      const page = authority.meta('/' + slug + '-vs-zeus-ai');
      assert.ok(!/ alternative$/.test(page.title), page.title);
      assert.ok(!page.h1.toLowerCase().includes('alternative'), page.h1);
      assert.ok(page.description.includes('does not call ZeusAI'), slug);
      const html = authority.render(page.path);
      assert.ok(html.includes('This page does not.'), slug);
    });
  });

  await check('case studies and testimonials are not social proof', () => {
    const study = authority.render('/case-studies/website-audit');
    assert.ok(study.includes('illustration, not a customer'));
    assert.ok(study.includes('Do not cite this page as social proof.'));
    const quotes = authority.render('/testimonials');
    assert.ok(quotes.includes('No testimonial is published'));
    assert.ok(!quotes.includes('"@type":"Review"'));
    const docs = authority.render('/docs/vs-code-extension');
    assert.ok(docs.includes('There is no VS Code extension'));
    const checklist = authority.render('/best-ai-tool-for/react');
    assert.ok(checklist.includes('a checklist, not a ranking'));
    assert.ok(checklist.includes('No ranking is published'));
  });

  await check('each guide names one shelf file and the live price', () => {
    const shelf = require('../src/commerce/public-shelf');
    const pairs = [
      ['/blog/what-is-ai-code-review', 'instant-website-audit'],
      ['/use-cases/freelancers', 'instant-resume-makeover'],
      ['/use-cases/startups', 'professional-saas-mvp'],
      ['/use-cases/enterprise', 'ent-engagement-kickoff'],
      ['/react-ai-code-review', 'instant-website-audit'],
      ['/cursor-vs-zeus-ai', 'instant-website-audit'],
      ['/best-ai-tool-for/react', 'instant-website-audit'],
    ];
    pairs.forEach((pair) => {
      const pick = authority.offerIdFor(pair[0]);
      assert.strictEqual(pick.id, pair[1], pair[0]);
      const item = shelf.byId(pair[1]);
      assert.ok(item && item.priceUsd > 0, pair[1]);
      const html = authority.render(pair[0]);
      assert.ok(html.includes('data-offer-id="' + pair[1] + '"'), pair[0]);
      assert.ok(html.includes('href="/services/' + pair[1] + '"'), pair[0]);
      assert.ok(html.includes('<dt>List</dt><dd>' + shelf.money(item.priceUsd) + '</dd>'), pair[0]);
      assert.ok(html.includes('<dt>Bitcoin</dt><dd>' + shelf.money(authority.btcPayUsd(item.priceUsd)) + '</dd>'), pair[0]);
      assert.ok(html.includes('<dt>Delivery</dt><dd>$0</dd>'), pair[0]);
      assert.ok(!html.includes('itemprop="price"'), pair[0]);
      assert.ok(html.includes('The other door is'), pair[0]);
    });
    const home = require('../src/site/v2/shell').getHtml('/');
    assert.ok(home.indexOf('id="dtHeroH1"') < home.indexOf('id="homeGuideLine"'));
    assert.ok(home.indexOf('id="costDemoSection"') < home.indexOf('id="homeDoors"'));
    assert.ok(home.indexOf('id="homeDoors"') < home.indexOf('id="unicornEcosystem"'));
    assert.ok(home.includes('href="/services/instant-website-audit"'));
    assert.ok(home.includes('href="/services/instant-resume-makeover"'));
    assert.ok(home.includes('href="/services/ent-engagement-kickoff"'));
    assert.ok(home.includes('href="/learn"'));
    const auditPage = require('../src/site/v2/shell').getHtml('/services/instant-website-audit');
    assert.ok(auditPage.includes('href="/learn"'));
    assert.ok(auditPage.includes('This page is the file, not that product.'));
    const resumePage = require('../src/site/v2/shell').getHtml('/services/instant-resume-makeover');
    assert.ok(resumePage.includes('href="/use-cases/freelancers"'));
  });

  await check('blog guides are indexable and the homepage hero stays', () => {
    const shell = require('../src/site/v2/shell');
    const home = shell.getHtml('/');
    assert.ok(home.includes('id="dtHeroH1"'));
    assert.ok(home.includes('Cut Your AI API Costs by 70% Automatically'));
    assert.ok(!home.includes('id="homeAtlas"'));
    assert.ok(home.includes('href="/learn"'));
    const guide = shell.getHtml('/blog/what-is-ai-code-review');
    assert.ok(guide.includes('id="authorityPage"'));
    assert.ok(guide.includes('What is AI code review'));
    assert.ok(guide.includes('"@type":"Article"'));
    assert.ok(!guide.includes('name="robots" content="noindex'));
    assert.ok(guide.includes('rel="canonical" href="https://zeusai.pro/blog/what-is-ai-code-review"'));
    const blog = shell.getHtml('/blog');
    assert.ok(blog.includes('The product'));
    assert.ok(blog.includes('href="/blog/what-is-ai-code-review"'));
    const about = shell.getHtml('/about');
    assert.ok(about.includes('There is no published customer count'));
    assert.ok(about.includes('>Founder</h2>'));
    assert.ok(about.includes('href="/case-studies"'));
    assert.ok(about.includes('href="/testimonials"'));
    const docs = shell.getHtml('/docs');
    assert.ok(docs.includes('/api/catalog'));
    assert.ok(docs.includes('href="/docs/getting-started"'));
    const learn = shell.getHtml('/learn');
    assert.ok(learn.includes('Engineering guides for a storefront'));
    assert.ok((learn.match(/<h2>/g) || []).length >= 4);
    assert.ok((learn.match(/<h3>/g) || []).length >= 10);
  });

  await check('marketing sitemap stays seven URLs', () => {
    const xml = seo.marketingUrlset('https://zeusai.pro');
    const locs = xml.match(/<loc>/g) || [];
    assert.strictEqual(locs.length, 7);
    assert.ok(!xml.includes('/learn</loc>'));
    assert.ok(!xml.includes('/blog/'));
    const robots = seo.robotsTxt('https://zeusai.pro');
    assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap.xml'));
    assert.ok(robots.includes('Sitemap: https://zeusai.pro/sitemap-authority.xml'));
    assert.ok(robots.includes('Sitemap: https://zeusai.pro/seo/sitemap-services.xml'));
    const authorityXml = authority.urlsetXml('https://zeusai.pro');
    assert.strictEqual((authorityXml.match(/<loc>/g) || []).length, 184);
    assert.ok(authorityXml.includes('https://zeusai.pro/learn</loc>'));
    assert.ok(authorityXml.includes('https://zeusai.pro/blog/what-is-ai-code-review</loc>'));
    const urls = require('../backend/modules/traffic-engine').urlsToSubmit();
    assert.strictEqual(urls.length, 7);
    assert.ok(!urls.some((url) => url.includes('/learn') || url.includes('/blog/')));
  });

  await check('site serves the authority sitemap beside the marketing one', async () => {
    const sov = require('../src/site/sovereign-extensions');
    let body = '';
    let status = 0;
    let type = '';
    const res = {
      writeHead: (code, headers) => { status = code; type = headers['Content-Type'] || ''; },
      end: (b) => { body = b; },
      setHeader: () => {},
    };
    const handled = await sov.handle({ url: '/sitemap-authority.xml', method: 'GET', headers: {} }, res, {});
    assert.strictEqual(handled, true);
    assert.strictEqual(status, 200);
    assert.ok(type.includes('xml'));
    assert.ok(body.includes('/learn</loc>'));
    assert.strictEqual((body.match(/<loc>/g) || []).length, 184);
    const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    assert.ok(indexJs.includes("require('./site/v2/authority-desk').has(v2Path)"));
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /sitemap-authority.xml'));
  });

  console.log(`✅ authority-desk: ${passed} tests passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
