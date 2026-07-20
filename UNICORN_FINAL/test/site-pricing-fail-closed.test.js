// =====================================================================
// site-pricing-fail-closed.test.js
// P0 doctrine: when the backend is unreachable AND the site cannot anchor a
// real catalog floor for the requested id, the public pricing endpoint MUST
// fail closed with HTTP 503 — never fabricate a $99 placeholder for a
// customer. Also verifies that the module pricing endpoint fails closed.
// =====================================================================
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
process.env.PORT = process.env.PORT || '31993';
process.env.PUBLIC_APP_URL = 'https://zeusai.pro';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS
  || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
process.env.FULFILLMENT_AI_ENABLED = '0';
// Backend deliberately absent → fail-closed path exercises.
delete process.env.BACKEND_API_URL;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'site-pricing-fail-closed-'));
process.env.UNICORN_DATA_DIR = path.join(tmpRoot, 'site-data');
process.env.UNICORN_RECEIPTS_FILE = path.join(tmpRoot, 'site-data', 'commerce-receipts.json');
process.env.SITE_PUBLIC_PRICING_SNAPSHOT = path.join(tmpRoot, 'site-data', 'pricing-snapshots.json');

const site = require('../src/index');
const { createServer } = site;

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  \u2713', name);
}

async function request(base, requestPath, options = {}) {
  const res = await fetch(base + requestPath, options);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: res.status, headers: res.headers, body, text };
}

async function run() {
  const app = createServer();
  const port = Number(process.env.PORT);
  const base = 'http://127.0.0.1:' + port;
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));
  try {
    await check('unknown service without snapshot → HTTP 503 (no fake $99)', async () => {
      const res = await request(base, '/api/pricing/definitely-not-a-real-service-xyz-999');
      assert.strictEqual(res.status, 503, 'must fail closed with 503, got ' + res.status);
      assert.ok(res.body && res.body.error === 'pricing_unavailable',
        'error code must be pricing_unavailable, got ' + JSON.stringify(res.body));
      assert.notStrictEqual(res.body && res.body.price_usd, 99, 'must not fabricate $99');
      const src = res.headers.get('x-source') || '';
      assert.doesNotMatch(src, /site-fallback-mock/i, 'must not use site-fallback-mock');
      assert.ok(res.body && res.body.degraded === true, 'must flag degraded=true');
    });

    await check('unknown module without snapshot → HTTP 503 (no fake $99)', async () => {
      const res = await request(base, '/api/pricing/module/some-unknown-module-id-xyz');
      assert.strictEqual(res.status, 503);
      assert.ok(res.body && res.body.error === 'module_pricing_unavailable');
      assert.ok(res.body && res.body.moduleId === 'some-unknown-module-id-xyz');
      assert.notStrictEqual(res.body && res.body.pricing && res.body.pricing.usd, 99);
      const src = res.headers.get('x-source') || '';
      assert.match(src, /fail-closed/i, 'must announce fail-closed via X-Source');
    });

    await check('known canonical plan still resolves via local catalog', async () => {
      const res = await request(base, '/api/pricing/pro');
      assert.strictEqual(res.status, 200, 'canonical plan must return 200');
      assert.ok(res.body && Number(res.body.price_usd) > 0,
        'canonical plan must produce a real price without backend');
      const src = res.headers.get('x-source') || '';
      assert.doesNotMatch(src, /site-fallback-mock/i, 'canonical plan must not use fake fallback');
    });

    console.log('\n\u2705 site-pricing-fail-closed: ' + passed + ' tests passed\n');
  } finally {
    if (typeof app.closeAllConnections === 'function') {
      try { app.closeAllConnections(); } catch (_) {}
    }
    await new Promise((resolve) => app.close(() => resolve()));
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
}

run().then(() => process.exit(0)).catch((e) => {
  console.error('\u274c site-pricing-fail-closed FAILED:', e);
  process.exit(1);
});
