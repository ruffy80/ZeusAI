// Polish-pack tests — additive site polish layer.
// Verifies: /.well-known/security.txt, /humans.txt, /offline.html,
// shell SEO/PWA enrichments (hreflang, JSON-LD blocks, apple-touch, mask-icon),
// manifest icons (PNG + maskable + svg) and second sitemap line in robots.txt.
'use strict';

const assert = require('assert');

(async function main() {
  const pp = require('../backend/modules/polish-pack');
  const sov = require('../src/site/sovereign-extensions');
  const v2 = require('../src/site/v2/shell');

  // --- polish-pack: security.txt ---
  {
    let body = '', code = 0, headers = {};
    const res = { writeHead: (c, h) => { code = c; headers = h; }, end: b => body = b };
    const handled = await pp.handle({ url: '/.well-known/security.txt', headers: {} }, res);
    assert.strictEqual(handled, true, 'security.txt should be handled');
    assert.strictEqual(code, 200);
    assert.match(body, /^Contact: mailto:/m, 'must include Contact line');
    assert.match(body, /^Expires:/m, 'must include Expires line');
    assert.match(body, /^Preferred-Languages: en, ro$/m);
    assert.match(body, /^Canonical:/m);
    assert.strictEqual(headers['X-Polish-Pack'], '1');
  }

  // --- polish-pack: humans.txt ---
  {
    let body = '';
    const res = { writeHead: () => {}, end: b => body = b };
    const handled = await pp.handle({ url: '/humans.txt', headers: {} }, res);
    assert.strictEqual(handled, true);
    assert.match(body, /TEAM/);
  }

  // --- polish-pack: offline.html ---
  {
    let body = '', code = 0;
    const res = { writeHead: (c) => { code = c; }, end: b => body = b };
    const handled = await pp.handle({ url: '/offline.html', headers: {} }, res);
    assert.strictEqual(handled, true);
    assert.strictEqual(code, 200);
    assert.match(body, /<title>Offline/);
    assert.match(body, /Retry/);
  }

  // --- polish-pack: unknown route falls through ---
  {
    const res = { writeHead: () => {}, end: () => {} };
    const handled = await pp.handle({ url: '/api/health', headers: {} }, res);
    assert.strictEqual(handled, false);
  }

  // --- shell.js: head() enrichments ---
  {
    const html = v2.getHtml('/', { lang: 'en', nonce: 'n1' });
    assert.match(html, /hreflang="en"/, 'hreflang en');
    assert.match(html, /hreflang="ro"/, 'hreflang ro');
    assert.match(html, /hreflang="es"/, 'hreflang es');
    assert.match(html, /hreflang="x-default"/, 'hreflang x-default');
    assert.match(html, /apple-touch-icon/, 'apple-touch-icon link');
    assert.match(html, /mask-icon/, 'mask-icon link');
    assert.match(html, /og:image" content="https:\/\/zeusai\.pro\/assets\/icons\/og-default\.[a-z0-9]+\.png/, 'og image dedicated');
    assert.match(html, /<noscript>/, 'noscript fallback');
    assert.match(html, /rel="preload" as="image" href="\/assets\/zeus\/hero\.[a-z0-9]+\.jpg"/, 'preload hero');
    // 4 JSON-LD blocks on most routes (Primary + Organization + WebSite + Breadcrumb).
    const blocks = (html.match(/application\/ld\+json/g) || []).length;
    assert.ok(blocks >= 4, 'expected >=4 JSON-LD blocks, got ' + blocks);
    assert.match(html, /"@type":"Organization"/);
    assert.match(html, /"@type":"WebSite".*SearchAction/s);
    assert.match(html, /"@type":"BreadcrumbList"/);
  }

  // --- shell.js: FAQPage on /pricing and /how ---
  {
    const pricing = v2.getHtml('/pricing', { lang: 'en' });
    assert.match(pricing, /"@type":"FAQPage"/, 'FAQPage on /pricing');
    const how = v2.getHtml('/how', { lang: 'en' });
    assert.match(how, /"@type":"FAQPage"/, 'FAQPage on /how');
  }

  // --- sovereign-extensions: robots.txt has both sitemap lines ---
  {
    let body = '';
    const res = { setHeader: () => {}, writeHead: () => {}, end: b => body = b };
    const handled = await sov.handle({ url: '/robots.txt', headers: {} }, res, { buildSnapshot: () => ({}) });
    assert.strictEqual(handled, true);
    assert.match(body, /Sitemap: https:\/\/zeusai\.pro\/sitemap\.xml/);
    assert.match(body, /Sitemap: https:\/\/zeusai\.pro\/seo\/sitemap-services\.xml/);
  }

  // --- sovereign-extensions: manifest has PNG + maskable + shortcuts + share_target ---
  {
    let body = '';
    const res = { setHeader: () => {}, writeHead: () => {}, end: b => body = b };
    await sov.handle({ url: '/manifest.webmanifest', headers: {} }, res, { buildSnapshot: () => ({}) });
    const m = JSON.parse(body);
    assert.ok(m.icons.find(i => i.purpose === 'maskable' && i.type === 'image/png'), 'maskable PNG icon');
    assert.ok(m.icons.find(i => i.sizes === '192x192' && i.type === 'image/png'), '192 PNG icon');
    assert.ok(m.icons.find(i => i.sizes === '512x512' && i.type === 'image/png'), '512 PNG icon');
    assert.ok(Array.isArray(m.shortcuts) && m.shortcuts.length >= 3, 'shortcuts present');
    assert.ok(m.share_target && m.share_target.action === '/services', 'share_target wired');
    assert.ok(Array.isArray(m.screenshots) && m.screenshots.length >= 1, 'screenshots present');
  }

  // --- sovereign-extensions: /assets/icons/icon.svg ---
  {
    let body = '', headers = {};
    const res = { setHeader: () => {}, writeHead: (_, h) => { headers = h; }, end: b => body = b };
    const handled = await sov.handle({ url: '/assets/icons/icon.svg', headers: {} }, res, { buildSnapshot: () => ({}) });
    assert.strictEqual(handled, true);
    assert.match(headers['Content-Type'] || '', /image\/svg\+xml/);
    assert.match(body, /<svg /);
  }

  // --- icons on disk are valid PNGs ---
  {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', 'src', 'site', 'v2', 'assets', 'icons');
    const expected = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'og-default.png'];
    for (const f of expected) {
      const buf = fs.readFileSync(path.join(dir, f));
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      assert.deepStrictEqual([...buf.slice(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], f + ' is not a valid PNG');
      assert.ok(buf.length > 200, f + ' is too small');
    }
  }

  console.log('polish-pack tests passed');
  // Required: shell.js transitively starts long-lived intervals
  // (autonomousInnovation, service-watchdog, orchestrator) that keep the
  // event loop alive and would hang `npm test` until CI timeout.
  process.exit(0);
})().catch(e => {
  console.error('polish-pack tests FAILED:', e);
  process.exit(1);
});
