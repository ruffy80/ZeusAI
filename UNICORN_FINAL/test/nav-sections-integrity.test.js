/**
 * nav-sections-integrity.test.js
 * Permanent CI guard for footer PRODUCT / DEVELOPERS / TRUST / COMPANY sections.
 * Ensures every footer href resolves to a real page or an allowed live-inspect
 * surface — never a known 404 alias or raw-JSON dead-end CTA.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
const indexJs = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
const nginx = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
const backend = fs.readFileSync(path.join(ROOT, 'backend', 'index.js'), 'utf8');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
    passed += 1;
  } catch (e) {
    console.error('✗', name);
    console.error(e && e.stack || e);
    process.exit(1);
  }
}

function footerBlock() {
  const start = shell.indexOf('footer-col-title">Product</h3>');
  const end = shell.indexOf('class="foot-bot"', start);
  assert.ok(start > 0 && end > start, 'footer Product…Company block must exist');
  return shell.slice(start, end);
}

check('footer Product/Developers/Trust/Company columns exist', () => {
  const f = footerBlock();
  for (const col of ['Product', 'Developers', 'Trust', 'Company']) {
    assert.ok(f.includes(`footer-col-title">${col}</h3>`) || f.includes(`footer-col-title">${col}`), col);
  }
});

check('TRUST Live Status points at /status (not 404 unicorn-status.html)', () => {
  const f = footerBlock();
  assert.ok(f.includes('href="/status"'), 'footer must link Live Status to /status');
  assert.ok(!f.includes('/unicorn-status.html'), 'legacy unicorn-status.html must be gone from footer');
  assert.ok(indexJs.includes("urlPath === '/unicorn-status.html'") && indexJs.includes("Location: '/status'"),
    'site must 301 /unicorn-status.html → /status');
  assert.ok(nginx.includes('location = /unicorn-status.html') && nginx.includes('return 301 /status'),
    'nginx must 301 /unicorn-status.html → /status');
});

check('DEVELOPERS footer does not dump raw OpenAPI/snapshot/stream as primary CTAs', () => {
  const f = footerBlock();
  assert.ok(f.includes('data-live-inspect="/openapi.json"'), 'OpenAPI via live-inspect');
  assert.ok(f.includes('data-live-inspect="/snapshot"'), 'snapshot via live-inspect');
  assert.ok(f.includes('data-live-inspect="/health"') || f.includes('/api-explorer?endpoint=/health'), 'health inspectable');
  assert.ok(!/<a href="\/stream"/.test(f), 'raw /stream SSE link must not be in footer');
  assert.ok(!/<a href="\/openapi\.json"/.test(f), 'raw openapi anchor must not be in footer');
  assert.ok(!/<a href="\/snapshot"/.test(f), 'raw snapshot anchor must not be in footer');
});

check('PRODUCT store tab no longer promises Instant <60s on-chain', () => {
  assert.ok(shell.includes('Instant digital'), 'store tab honest label');
  assert.ok(!/Instant &lt;60s/.test(shell), 'no Instant <60s claim');
});

check('TRUST keys + commerce integrity are reachable (not broken well-known/keys 403 path)', () => {
  assert.ok(shell.includes('data-live-inspect="/api/v50/keys.json"') || shell.includes("data-live-inspect=\"/api/v50/keys.json\""));
  assert.ok(shell.includes('data-live-inspect="/api/commerce/integrity"'));
  assert.ok(backend.includes("proxyToSite(req, res, '/api/commerce/integrity')"));
  assert.ok(backend.includes("/.well-known/keys.json") && backend.includes('/api/v50/keys.json'));
  assert.ok(nginx.includes('location = /.well-known/keys.json'));
  assert.ok(nginx.includes('location = /api/commerce/integrity'));
});

check('COMPANY privacy no longer points at missing /api/privacy/dsr', () => {
  assert.ok(!/\/api\/privacy\/dsr/.test(shell), 'dead DSR path removed');
  assert.ok(shell.includes('/api/privacy/export') || shell.includes('/account'), 'real GDPR path mentioned');
});

check('SLA / docs honesty fixes present', () => {
  assert.ok(!/every API call &lt; 60s eligible/.test(shell));
  assert.ok(shell.includes('paid receipt is eligible') || shell.includes('daily signed Merkle'));
  assert.ok(shell.includes('order.receiptId') || shell.includes('order.receiptId || order.orderId'));
  assert.ok(!/order\.receipt\.id/.test(shell));
});

check('Frontier cascade probe is dryRun (no junk orders)', () => {
  assert.ok(shell.includes('dryRun:true') || shell.includes('dryRun: true'));
  const fe = fs.readFileSync(path.join(ROOT, 'src', 'frontier-engine.js'), 'utf8');
  assert.ok(fe.includes('dryRun') && fe.includes('if (!dryRun) append'));
});

check('renderRoute covers all data-link footer paths (or explicit redirects)', () => {
  const f = footerBlock();
  const hrefs = [...f.matchAll(/href="(\/[^"#?]+)"/g)].map((m) => m[1]);
  const allowedOutsideRender = new Set([
    '/zacc', '/dropship', // legacy renderPage path in index.js
    '/seo/sitemap.xml', // XML allow-raw
    '/sw-reset', // emergency SW kill-switch in src/index.js
  ]);
  // Extract case arms from renderRoute switch
  const rrStart = shell.indexOf('function renderRoute');
  const rr = shell.slice(rrStart, rrStart + 2500);
  for (const href of hrefs) {
    if (allowedOutsideRender.has(href)) continue;
    if (href.startsWith('mailto:')) continue;
    const ok = rr.includes(`'${href}'`) || rr.includes(`"${href}"`) || shell.includes(`case '${href}'`) || indexJs.includes(`urlPath === '${href}'`);
    assert.ok(ok, `footer href ${href} must have a page/route handler`);
  }
});

console.log(`✅ nav-sections-integrity: ${passed} tests passed`);
process.exit(0);
