'use strict';

/**
 * storefront-gravity-os.test.js — FDGP/1.0 First-Dollar Gravity
 * Catalog rank, ghost filter, nginx BTC pins, honest zero-revenue discovery.
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.TRAFFIC_ENGINE_DISABLED = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
process.env.OGP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fdgp-ogp-'));

const gravity = require('../src/commerce/storefront-gravity-os');
const filter = require('../src/commerce/public-catalog-filter');

let passed = 0;
function check(name, fn) {
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.then(() => { passed += 1; console.log('  ✓', name); });
  }
  passed += 1;
  console.log('  ✓', name);
  return undefined;
}

console.log('First-Dollar Gravity Protocol (FDGP/1.0)');

check('protocol never invents humans or GMV', () => {
  assert.strictEqual(gravity.PROTOCOL, 'FDGP/1.0');
  assert.strictEqual(gravity.DEFAULT_HERO_SKU, 'instant-resume-makeover');
  const d = gravity.discovery();
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.inventsHumans, false);
  assert.strictEqual(d.inventsGmv, false);
  assert.strictEqual(d.inventsVisitors, false);
  assert.strictEqual(typeof d.paidHumans, 'number');
  assert.ok(d.paidHumans >= 0);
  assert.strictEqual(d.firstDollar.serviceId, 'instant-resume-makeover');
  assert.ok(d.firstDollar.priceUsd >= 29);
  assert.ok(d.firstDollar.buyUrl.includes('instant-resume-makeover'));
  assert.strictEqual(d.whyZero.code, d.paidHumans === 0 ? 'no_confirmed_settlement' : 'settlements_exist');
});

check('ghosts are filtered; giants sort after instant SKUs', () => {
  const items = [
    { id: 'global-giants', priceUsd: 99999, group: 'service' },
    { id: 'api-call', priceUsd: 0.01, group: 'service' },
    { id: 'free', priceUsd: 0, group: 'service' },
    { id: 'instant-website-audit', priceUsd: 49, group: 'instant', tier: 'instant' },
    { id: 'instant-resume-makeover', priceUsd: 39, group: 'instant', tier: 'instant' },
    { id: 'starter', priceUsd: 29, group: 'service' },
  ];
  assert.strictEqual(filter.isGhostMeteredItem({ id: 'api-call' }), true);
  assert.strictEqual(filter.isGhostMeteredItem({ id: 'free' }), true);
  const publicItems = filter.filterPublicCatalogItems(items);
  assert.ok(!publicItems.some((x) => x.id === 'api-call' || x.id === 'free'));
  const ranked = gravity.rankPublicCatalogItems(publicItems);
  assert.strictEqual(ranked[0].id, 'instant-resume-makeover');
  const giantsIdx = ranked.findIndex((x) => x.id === 'global-giants');
  const resumeIdx = ranked.findIndex((x) => x.id === 'instant-resume-makeover');
  assert.ok(resumeIdx >= 0 && giantsIdx > resumeIdx);
});

check('hero picks default to resume makeover then other instant SKUs', () => {
  const items = require('../src/commerce/unified-catalog').all();
  const picks = gravity.pickHeroQuickPicks(items, 6);
  assert.ok(picks.length >= 1);
  assert.strictEqual(picks[0].id, 'instant-resume-makeover');
  assert.ok(picks.every((p) => Number(p.priceUSD || p.priceUsd || 0) >= 29));
  assert.ok(!picks.some((p) => p.id === 'api-call' || p.id === 'global-giants'));
});

check('site catalog handler no longer unshifts CANONICAL_CORE_PLANS', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');
  assert.ok(src.includes('storefrontGravity.PUBLIC_SELF_SERVE_CORE_IDS'));
  assert.ok(src.includes('storefrontGravity.rankPublicCatalogItems'));
  assert.ok(!/for \(const id of Object\.keys\(CANONICAL_CORE_PLANS\)\)/.test(src));
  assert.ok(src.includes('/.well-known/first-dollar.json'));
  assert.ok(src.includes("urlPath === '/first-dollar'"));
});

check('hero SSR defaults to instant-resume-makeover', () => {
  const shell = fs.readFileSync(path.join(ROOT, 'src', 'site', 'v2', 'shell.js'), 'utf8');
  assert.ok(shell.includes("require('../../commerce/storefront-gravity-os')"));
  assert.ok(shell.includes("id === 'instant-resume-makeover'"));
  assert.ok(shell.includes('/checkout/?plan=instant-resume-makeover'));
});

check('nginx pins BTC rate aliases to unicorn_site', () => {
  const conf = fs.readFileSync(path.join(ROOT, 'scripts', 'nginx-unicorn.conf'), 'utf8');
  for (const p of ['/api/payment/btc-rate', '/api/btc/spot', '/api/btc/rate']) {
    const idx = conf.indexOf('location = ' + p);
    assert.ok(idx >= 0, 'missing location ' + p);
    const win = conf.slice(idx, idx + 420);
    assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(win), p + ' must hit unicorn_site');
  }
  const fd = conf.indexOf('location = /.well-known/first-dollar.json');
  assert.ok(fd >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(fd, fd + 420)));
  const wi = conf.indexOf('location = /.well-known/world-index.json');
  assert.ok(wi >= 0);
  assert.ok(/proxy_pass\s+http:\/\/unicorn_site\b/.test(conf.slice(wi, wi + 420)));
});

check('paymentGateway serves last-good without blocking', () => {
  const src = fs.readFileSync(path.join(ROOT, 'backend', 'modules', 'paymentGateway.js'), 'utf8');
  assert.ok(src.includes('_refreshBitcoinRate'));
  assert.ok(src.includes('Serving last-good BTC rate while sources refresh'));
});

check('firstDollarHtml is honest about zero revenue', () => {
  const html = gravity.firstDollarHtml();
  assert.ok(html.includes('paidHumans'));
  assert.ok(html.includes('FDGP/1.0'));
  assert.ok(html.includes('og:image'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(!/trusted by thousands|millions of users|billions in revenue/i.test(html));
});

async function runHttp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fdgp-'));
  process.env.UNICORN_DATA_DIR = path.join(tmp, 'data');
  process.env.UNICORN_RECEIPTS_FILE = path.join(tmp, 'data', 'commerce-receipts.json');
  process.env.PORT = process.env.FDGP_TEST_PORT || '31995';
  process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
  process.env.DB_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';

  const site = require('../src/index');
  const { createServer } = site;
  const app = createServer();
  const port = Number(process.env.PORT);
  const base = `http://127.0.0.1:${port}`;
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));

  try {
    await check('GET /.well-known/first-dollar.json is honest', async () => {
      const res = await fetch(base + '/.well-known/first-dollar.json');
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.protocol, 'FDGP/1.0');
      assert.strictEqual(body.inventsHumans, false);
      assert.strictEqual(body.inventsGmv, false);
      assert.ok(body.firstDollar && body.firstDollar.serviceId === 'instant-resume-makeover');
    });

    await check('GET /.well-known/world-index.json never invents visitors', async () => {
      const res = await fetch(base + '/.well-known/world-index.json');
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.protocol, 'WIVP/1.0');
      assert.strictEqual(body.inventsVisitors, false);
      assert.strictEqual(body.inventsUsers, false);
      assert.ok(body.whyZeroVisitors && body.whyZeroVisitors.code);
    });

    await check('GET /visible-world ships Open Graph', async () => {
      const res = await fetch(base + '/visible-world');
      assert.strictEqual(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes('og:image'));
      assert.ok(html.includes('WIVP/1.0'));
      assert.ok(html.includes('inventsVisitors'));
      assert.ok(!/millions of users|biggest site in the world/i.test(html));
    });

    await check('GET /api/catalog ranks resume-makeover before global-giants', async () => {
      const res = await fetch(base + '/api/catalog');
      assert.strictEqual(res.status, 200);
      const items = await res.json();
      assert.ok(Array.isArray(items) && items.length > 0);
      const ids = items.map((x) => x.id);
      assert.notStrictEqual(ids[0], 'global-giants');
      assert.notStrictEqual(ids[0], 'api-call');
      assert.ok(!ids.includes('api-call'), 'ghost api-call must not ship on public catalog');
      const resumeIdx = ids.indexOf('instant-resume-makeover');
      const giantsIdx = ids.indexOf('global-giants');
      assert.ok(resumeIdx >= 0, 'instant-resume-makeover must be listed');
      if (giantsIdx >= 0) assert.ok(resumeIdx < giantsIdx);
    });

    await check('POST /api/checkout/create instant-resume-makeover returns BIP-21', async () => {
      const res = await fetch(base + '/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'instant-resume-makeover',
          qty: 1,
          email: 'first-dollar@example.com',
        }),
      });
      const body = await res.json();
      assert.ok(res.status === 200 || res.status === 201, 'status ' + res.status + ' ' + JSON.stringify(body).slice(0, 240));
      const order = body.order || body;
      assert.ok(order.orderId || body.orderId, 'orderId');
      const bip21 = order.bip21 || body.bip21;
      assert.ok(typeof bip21 === 'string' && bip21.startsWith('bitcoin:'), 'bip21 ' + bip21);
      assert.ok(Number(order.subtotal_fiat || body.subtotal_fiat) > 0);
      assert.notStrictEqual(order.status, 'paid');
    });

    await check('GET /api/payment/btc-rate returns quickly with a number', async () => {
      const t0 = Date.now();
      const res = await fetch(base + '/api/payment/btc-rate');
      const ms = Date.now() - t0;
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const rate = Number(body.usdPerBtc || body.rate || body.usd);
      assert.ok(rate > 0, 'rate ' + rate);
      assert.ok(ms < 8000, 'btc-rate took ' + ms + 'ms');
    });
  } finally {
    if (typeof app.closeAllConnections === 'function') {
      try { app.closeAllConnections(); } catch (_) {}
    }
    await new Promise((resolve) => app.close(() => resolve()));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

runHttp().then(() => {
  console.log(`\n✅ storefront-gravity-os: ${passed} tests passed`);
  process.exit(0);
}).catch((err) => {
  console.error('❌ storefront-gravity-os failed:', err);
  process.exit(1);
});
