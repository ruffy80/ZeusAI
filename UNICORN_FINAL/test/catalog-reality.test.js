'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = '999999';
process.env.PORT = process.env.PORT || '31994';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
process.env.FULFILLMENT_AI_ENABLED = '0';

for (const key of [
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
  'MISTRAL_API_KEY', 'COHERE_API_KEY', 'XAI_API_KEY', 'GROQ_API_KEY',
  'OPENROUTER_API_KEY', 'PERPLEXITY_API_KEY', 'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY', 'SAMBANOVA_API_KEY', 'NVIDIA_NIM_API_KEY',
  'HF_API_KEY', 'BACKEND_API_URL'
]) delete process.env[key];

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-reality-'));
process.env.UNICORN_DATA_DIR = path.join(tmpRoot, 'site-data');
process.env.UNICORN_RECEIPTS_FILE = path.join(tmpRoot, 'site-data', 'commerce-receipts.json');

const filter = require('../src/commerce/public-catalog-filter');
const site = require('../src/index');
const { createServer } = site;

let passed = 0;

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ✓', name);
}

async function request(base, requestPath, options = {}) {
  const res = await fetch(base + requestPath, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: res.status, body, text };
}

function assertNoSynthetics(items, label) {
  assert.ok(Array.isArray(items), label + ' must be an array');
  for (const item of items) {
    assert.ok(item && item.id, label + ' item missing id');
    assert.ok(!/^zacc-/i.test(String(item.id)), label + ' leaked zacc id: ' + item.id);
    assert.ok(item.synthetic !== true, label + ' leaked synthetic:true id: ' + item.id);
    assert.ok(!filter.isSyntheticCatalogItem(item), label + ' leaked synthetic item: ' + item.id);
  }
}

async function run() {
  await check('filter unit: detects zacc / unicorn-module / synthetic:true', () => {
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'zacc-ai-studio-abc123', group: 'zacc' }), true);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'unicorn-module-resource-monitor', group: 'unicorn-auto-module' }), true);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'fake-trend', synthetic: true }), true);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'adaptive-ai', group: 'professional' }), false);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'fintech-os', group: 'vertical' }), false);
    assert.strictEqual(filter.isSyntheticCatalogItem({ id: 'pro', group: 'service' }), false);
  });

  await check('filter unit: public filter drops synthetics and keeps core', () => {
    const items = [
      { id: 'adaptive-ai', group: 'professional' },
      { id: 'zacc-video-autopilot-g440q2', group: 'zacc' },
      { id: 'pro', group: 'service' },
      { id: 'clone-1', synthetic: true },
      { id: 'unicorn-module-circuit-breaker', group: 'unicorn-auto-module' },
      { id: 'fintech-os', group: 'vertical' }
    ];
    const out = filter.filterPublicCatalogItems(items);
    assert.deepStrictEqual(out.map((x) => x.id), ['adaptive-ai', 'pro', 'fintech-os']);
    const withSyn = filter.filterPublicCatalogItems(items, { includeSynthetic: true });
    assert.strictEqual(withSyn.length, 6);
  });

  await check('filter unit: wantsIncludeSynthetic parses query flags', () => {
    const url = new URL('http://x/api/catalog?includeSynthetic=1');
    assert.strictEqual(filter.wantsIncludeSynthetic(url), true);
    assert.strictEqual(filter.wantsIncludeSynthetic(new URL('http://x/api/catalog')), false);
    assert.strictEqual(filter.wantsIncludeSynthetic({ includeSynthetic: 'true' }), true);
  });

  const app = createServer();
  const port = Number(process.env.PORT);
  const base = `http://127.0.0.1:${port}`;
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));

  try {
    // Inject a burst of synthetic/zacc SKUs into the site runtime catalog sink.
    const injected = [
      { id: 'adaptive-ai', title: 'Adaptive AI', price: 499, group: 'strategic', segment: 'all' },
      { id: 'zacc-ai-customer-support-studio-rmn2bt', title: 'ZACC Support Studio', price: 161, group: 'zacc', segment: 'all', description: 'auto trend clone' },
      { id: 'zacc-sovereign-video-k9pnvz', title: 'ZACC Video', price: 198, group: 'zacc', segment: 'all' },
      { id: 'trend-clone-x', title: 'Trend Clone', price: 99, synthetic: true, group: 'strategic' },
      { id: 'unicorn-module-resource-monitor', title: 'Resource Monitor Service', price: 499, group: 'unicorn-auto-module' }
    ];
    if (site.__catalogTest && typeof site.__catalogTest.injectServices === 'function') {
      site.__catalogTest.injectServices(injected);
    } else {
      throw new Error('__catalogTest.injectServices missing — cannot validate public filter against injected synthetics');
    }

    await check('public /api/catalog/master has 0 zacc-/synthetic items', async () => {
      const res = await request(base, '/api/catalog/master');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assertNoSynthetics(res.body.items, '/api/catalog/master');
      assert.ok(res.body.items.some((it) => it.id === 'adaptive-ai' || it.id === 'pro' || it.group === 'instant' || it.group === 'professional'),
        'public catalog should retain curated/core products');
      // Vertical honesty: no "finished OS shipped" / turn-key OS claims
      for (const it of res.body.items.filter((x) => x.group === 'vertical')) {
        assert.match(String(it.description || ''), /engagement kickoff|architecture pack/i);
        assert.doesNotMatch(String(it.description || ''), /turn-key vertical AI OS/i);
      }
    });

    await check('public /api/catalog /api/services /api/products also filter synthetics', async () => {
      for (const p of ['/api/catalog', '/api/services', '/api/products']) {
        const res = await request(base, p);
        assert.strictEqual(res.status, 200, p + ' status');
        const items = Array.isArray(res.body)
          ? res.body
          : (res.body.items || res.body.services || res.body.products || []);
        assertNoSynthetics(items, p);
      }
    });

    await check('?includeSynthetic=1 re-exposes injected zacc/synthetic SKUs', async () => {
      const res = await request(base, '/api/catalog/master?includeSynthetic=1');
      assert.strictEqual(res.status, 200);
      const ids = (res.body.items || []).map((it) => it.id);
      assert.ok(ids.includes('zacc-ai-customer-support-studio-rmn2bt'), 'includeSynthetic should keep zacc SKUs');
      assert.ok(ids.some((id) => String(id).startsWith('unicorn-module-') || id === 'trend-clone-x'),
        'includeSynthetic should keep auto-module/synthetic SKUs');
    });

    await check('core plan remains buyable via BTC checkout create', async () => {
      const res = await request(base, '/api/checkout/create', {
        method: 'POST',
        body: JSON.stringify({ serviceId: 'adaptive-ai', qty: 1, email: 'catalog-reality@example.com' })
      });
      assert.ok(res.status === 200 || res.status === 201, 'checkout create status ' + res.status);
      assert.ok(res.body && (res.body.ok === true || res.body.checkout_url || res.body.orderId || res.body.order),
        'checkout create should succeed for core plan');
    });

    console.log(`\n✅ catalog-reality: ${passed} tests passed\n`);
  } finally {
    if (typeof app.closeAllConnections === 'function') {
      try { app.closeAllConnections(); } catch (_) {}
    }
    await new Promise((resolve) => app.close(() => resolve()));
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
}

run().then(() => process.exit(0)).catch((error) => {
  console.error('❌ catalog-reality.test.js failed:', error);
  process.exit(1);
});
