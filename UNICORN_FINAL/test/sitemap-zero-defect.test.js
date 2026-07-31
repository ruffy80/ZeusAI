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

  await check('helpers emit XSL-linked urlset with required conversion pages', () => {
    const xml = seo.buildUrlsetXml('https://zeusai.pro', seo.corePublicPaths());
    assert.ok(xml.includes('xml-stylesheet'));
    assert.ok(xml.includes('/seo/sitemap.xsl'));
    assert.ok(xml.includes('<urlset'));
    for (const p of ['/buy', '/continuity', '/standard', '/rails', '/outcomes', '/vom', '/agents', '/zacc']) {
      assert.ok(xml.includes(`https://zeusai.pro${p}</loc>`), 'missing ' + p);
    }
    assert.ok(!xml.includes('/dashboard</loc>'));
    assert.ok(!xml.includes('/account</loc>'));
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

  await check('sovereign /sitemap.xml uses helpers + includes /buy', async () => {
    const sov = require('../src/site/sovereign-extensions');
    let body = '';
    const res = {
      writeHead: () => {},
      end: (b) => { body = b; },
      setHeader: () => {},
    };
    const handled = await sov.handle(
      { url: '/sitemap.xml', method: 'GET', headers: {} },
      res,
      { buildSnapshot: () => ({ marketplace: [{ id: 'instant-website-audit' }], services: [] }) }
    );
    assert.equal(handled, true);
    assert.ok(body.includes('xml-stylesheet'));
    assert.ok(body.includes('/buy</loc>'));
    assert.ok(body.includes('/standard</loc>'));
    assert.ok(body.includes('/continuity</loc>'));
    assert.ok(body.includes('/services/instant-website-audit</loc>'));
    assert.ok(!body.includes('/dashboard</loc>'));
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
