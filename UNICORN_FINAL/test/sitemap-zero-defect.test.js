'use strict';

/**
 * sitemap-zero-defect.test.js — SEO sitemap honesty + human XSL
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
  const seo = require('../src/seo/sitemap-helpers');

  await check('helpers emit XSL-linked urlset with marketing pages only', () => {
    const xml = seo.marketingUrlset('https://zeusai.pro');
    assert.ok(xml.includes('xml-stylesheet'));
    assert.ok(xml.includes('/seo/sitemap.xsl'));
    assert.ok(xml.includes('<urlset'));
    for (const p of ['/', '/about', '/pricing', '/contact', '/insights/ai-resume-service-bitcoin', '/services/instant-resume-makeover']) {
      const loc = p === '/' ? 'https://zeusai.pro/</loc>' : `https://zeusai.pro${p}</loc>`;
      assert.ok(xml.includes(loc), 'missing ' + p);
    }
    for (const p of ['/buy', '/origin', '/status', '/health', '/admin', '/dashboard', '/api/', '/from/x', '/vertical/']) {
      assert.ok(!xml.includes(`https://zeusai.pro${p}`), 'leaked ' + p);
    }
    assert.ok(xml.includes('<lastmod>'));
    assert.ok(xml.includes('<changefreq>'));
    assert.ok(xml.includes('<priority>1.0</priority>'));
  });

  await check('helpers emit styled sitemap index', () => {
    const idx = seo.buildSitemapIndexXml('https://zeusai.pro', ['/sitemap.xml', '/seo/sitemap-services.xml']);
    assert.ok(idx.includes('sitemapindex'));
    assert.ok(idx.includes('xml-stylesheet'));
    assert.ok(idx.includes('https://zeusai.pro/sitemap.xml'));
    assert.ok(idx.includes('https://zeusai.pro/seo/sitemap-services.xml'));
  });

  await check('XSL stylesheet is valid HTML transform', () => {
    const xsl = seo.sitemapXsl();
    assert.ok(xsl.includes('xsl:stylesheet'));
    assert.ok(xsl.includes('ZeusAI'));
    assert.ok(xsl.includes('sm:urlset') || xsl.includes('urlset'));
  });

  await check('frontier sitemapXml no longer hijacks root /sitemap.xml shape', () => {
    const frontier = require('../src/frontier-engine');
    const xml = frontier.sitemapXml('https://zeusai.pro');
    assert.ok(xml.includes('sitemapindex'));
    assert.ok(xml.includes('xml-stylesheet'));
    // Must be index, not pretend to be the main urlset
    assert.ok(!xml.includes('<urlset'));
  });

  await check('sovereign /sitemap.xml is marketing pages and returns the urlset', async () => {
    const sov = require('../src/site/sovereign-extensions');
    let body = '';
    let status = 0;
    const res = {
      writeHead: (code) => { status = code; },
      end: (b) => { body = b; },
      setHeader: () => {},
    };
    const handled = await sov.handle(
      { url: '/sitemap.xml', method: 'GET', headers: {} },
      res,
      { buildSnapshot: () => ({ marketplace: [{ id: 'never-down-kernel' }, { id: 'instant-website-audit' }], services: [] }) }
    );
    assert.equal(handled, true);
    assert.equal(status, 200);
    assert.ok(body.includes('xml-stylesheet'));
    assert.ok(body.includes('https://zeusai.pro/</loc>') || body.includes('https://zeusai.pro</loc>'));
    assert.ok(body.includes('/about</loc>'));
    assert.ok(body.includes('/pricing</loc>'));
    assert.ok(body.includes('/contact</loc>'));
    assert.ok(body.includes('/services/instant-website-audit</loc>') || body.includes('/services/instant-resume-makeover</loc>'));
    assert.ok(body.includes('<lastmod>'));
    assert.ok(!body.includes('/dashboard</loc>'));
    assert.ok(!body.includes('/checkout</loc>'));
    assert.ok(!body.includes('/origin</loc>'));
    assert.ok(!body.includes('/status</loc>'));
    assert.ok(!body.includes('never-down-kernel'));
    assert.ok(!body.includes('/api/'));
  });

  await check('robots.txt blocks internal prefixes for Googlebot', async () => {
    const sov = require('../src/site/sovereign-extensions');
    let body = '';
    let status = 0;
    const res = {
      writeHead: (code) => { status = code; },
      end: (b) => { body = b; },
      setHeader: () => {},
    };
    const handled = await sov.handle({ url: '/robots.txt', method: 'GET', headers: {} }, res, {});
    assert.equal(handled, true);
    assert.equal(status, 200);
    for (const line of ['Disallow: /api/', 'Disallow: /status', 'Disallow: /health', 'Disallow: /origin', 'Disallow: /admin', 'Disallow: /dashboard']) {
      assert.ok(body.includes(line), line);
    }
    assert.ok(body.includes('User-agent: Googlebot'));
    assert.ok(body.includes('Sitemap: https://zeusai.pro/sitemap.xml'));
  });

  await check('site wires /seo desk + XSL route + footer sitemap', () => {
    const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
    assert.ok(shell.includes("case '/seo'"));
    assert.ok(shell.includes('href="/sitemap.xml"'));
    assert.ok(shell.includes('href="/seo"'));
    const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
    assert.ok(indexJs.includes('/seo/sitemap.xsl'));
    assert.ok(indexJs.includes('/seo/sitemap-index.xml'));
    // Root /sitemap.xml must NOT be served as frontier index anymore
    assert.ok(!/fu === '\/sitemap\.xml' \|\| fu === '\/seo\/sitemap\.xml'/.test(indexJs));
    assert.ok(indexJs.includes("'/seo'"));
  });

  await check('nginx self-heal requires ICP/CAC/MTS well-known exact matches', () => {
    const py = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-patch-public-discovery.py'), 'utf8');
    assert.ok(py.includes('location = /.well-known/immortality.json'));
    assert.ok(py.includes('location = /.well-known/continuity.json'));
    assert.ok(py.includes('location = /.well-known/merchant.json'));
    const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
    assert.ok(nginx.includes('location = /.well-known/merchant.json'));
  });

  console.log(`✅ sitemap-zero-defect: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
