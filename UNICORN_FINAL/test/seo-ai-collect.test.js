'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
delete process.env.BING_SITE_VERIFICATION;

const assert = require('assert');
const shell = require('../src/site/v2/shell');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('✓', name);
}

function lenBetween(html, start, end, min, max) {
  const i = html.indexOf(start);
  assert.ok(i >= 0, start);
  const j = html.indexOf(end, i + start.length);
  const value = html.slice(i + start.length, j);
  assert.ok(value.length >= min && value.length <= max, value.length + ' ' + value);
  return value;
}

check('home metadata stays the locked sentence and the other three pages fit the length window', () => {
  const home = shell.getHtml('/');
  assert.ok(home.includes('<title>ZeusAI | Enterprise AI Cost Optimization & Orchestration</title>'));
  assert.ok(home.includes('Reduce your LLM API costs by 70% with our autonomous model router. Enterprise-grade multi-agent orchestration and self-healing infrastructure.'));
  assert.ok(!home.includes('googletagmanager'));
  assert.ok(home.includes('data-ai-summary='));
  const services = shell.getHtml('/services');
  const servicesTitle = lenBetween(services, '<title>', '</title>', 50, 60);
  assert.ok(servicesTitle.includes('Model Router'));
  lenBetween(services, '<meta name="description" content="', '"/>', 150, 160);
  const pricing = shell.getHtml('/pricing');
  lenBetween(pricing, '<title>', '</title>', 50, 60);
  lenBetween(pricing, '<meta name="description" content="', '"/>', 150, 160);
  const docs = shell.getHtml('/docs');
  lenBetween(docs, '<title>', '</title>', 50, 60);
  lenBetween(docs, '<meta name="description" content="', '"/>', 150, 160);
  assert.ok(docs.includes('<h2>What is the model router?</h2>'));
  assert.ok(docs.includes('<h2>What is self-healing?</h2>'));
  const faq = shell.getHtml('/faq');
  assert.ok(faq.includes('<h2>Where is the list price?</h2>'));
  assert.ok(faq.includes('action="/newsletter"'));
  assert.ok(faq.includes('does not claim the address is deleted'));
  assert.ok(!faq.includes('no data retention'));
});

check('Bing verification is a meta tag and stays absent until configured', () => {
  assert.ok(!shell.getHtml('/').includes('msvalidate.01'));
  process.env.BING_SITE_VERIFICATION = 'abcDEF12_ok';
  try {
    const html = shell.getHtml('/');
    assert.ok(html.includes('<meta name="msvalidate.01" content="abcDEF12_ok"/>'));
    assert.ok(!html.includes('bing.com'));
  } finally {
    delete process.env.BING_SITE_VERIFICATION;
  }
});

check('a shelf offer states the USD list price and the Bitcoin amount outside the offer currency', () => {
  const html = shell.getHtml('/services/instant-resume-makeover');
  assert.ok(html.includes('"name":"List price"'));
  assert.ok(html.includes('"priceCurrency":"USD"'));
  assert.ok(!html.includes('"priceCurrency":"BTC"'));
  assert.ok(!html.includes('content="BTC"'));
  assert.ok(html.includes('id="svcLiveBtc"'));
  assert.ok(html.includes('Bitcoin is 10% under the list price'));
  assert.strictEqual((html.match(/schema\.org\/InStock/g) || []).length, 1);
});

check('llms.txt states the router, the shelf, and the seven-URL sitemap', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/site/sovereign-extensions.js'), 'utf8');
  assert.ok(src.includes('## Capabilities for language models'));
  assert.ok(src.includes('homepage slogan is not a measured customer saving'));
  assert.ok(src.includes('/seo/sitemap-services.xml'));
  const seo = require('../src/seo/sitemap-helpers');
  assert.strictEqual((seo.marketingUrlset('https://zeusai.pro').match(/<loc>/g) || []).length, 7);
  assert.ok(seo.robotsTxt('https://zeusai.pro').includes('Sitemap: https://zeusai.pro/seo/sitemap-services.xml'));
});

console.log('✅ seo-ai-collect: ' + passed + ' tests passed');
