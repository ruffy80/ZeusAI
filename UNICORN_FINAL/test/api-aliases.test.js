/**
 * api-aliases.test.js — Verifies the additive smoke-test aliases.
 *
 * Guarantees that:
 *   - GET /api/services        responds 200 with { services: [...] } (alias of /api/services/list)
 *   - GET /api/btc/rate        responds 200 with the BTC rate payload   (alias of /api/payment/btc-rate)
 *   - GET /api/services/list   keeps responding 200 (no regression)
 *   - GET /api/payment/btc-rate keeps responding 200 (no regression)
 *
 * These aliases exist purely for smoke-test ergonomics and frontend symmetry;
 * they MUST NOT change the payload shape of the canonical routes.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = process.env.ADMIN_2FA_CODE || '999999';
process.env.BTC_FX_OVERRIDE = process.env.BTC_FX_OVERRIDE || '60000';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-api-aliases-'));
process.env.UI_BUILD_CACHE_FILE = path.join(tmpRoot, 'ui-build-cache.json');
process.env.MARKETING_INNOVATION_LEDGER = path.join(tmpRoot, 'innovation-ledger.jsonl');
process.env.MARKETING_INNOVATION_LOOP_DISABLED = '1';

const app = require('../backend/index');

let server;
let port;

async function get(path) {
  const url = `http://127.0.0.1:${port}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  let body = null;
  try { body = await res.json(); } catch (_) { /* non-json ok */ }
  return { status: res.status, body };
}

async function setup() {
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  port = server.address().port;
}

async function teardown() {
  await new Promise((resolve) => { server.close(() => resolve()); });
}

async function run() {
  await setup();
  try {
    // Canonical /api/services/list — must keep working
    const list = await get('/api/services/list');
    assert.strictEqual(list.status, 200, '/api/services/list status');
    assert.ok(list.body && Array.isArray(list.body.services), '/api/services/list shape');
    console.log('[ok] /api/services/list still responds 200 with services[]');

    // Alias /api/services
    const alias = await get('/api/services');
    assert.strictEqual(alias.status, 200, '/api/services status');
    assert.ok(alias.body && Array.isArray(alias.body.services), '/api/services shape');
    assert.strictEqual(alias.body.services.length, list.body.services.length,
      '/api/services count must match /api/services/list');
    console.log('[ok] /api/services alias responds 200 with same services count');

    // Canonical /api/payment/btc-rate — must keep working
    const btcCanonical = await get('/api/payment/btc-rate');
    assert.strictEqual(btcCanonical.status, 200, '/api/payment/btc-rate status');
    assert.ok(btcCanonical.body && typeof btcCanonical.body === 'object', '/api/payment/btc-rate body');
    console.log('[ok] /api/payment/btc-rate still responds 200');

    // Alias /api/btc/rate
    const btcAlias = await get('/api/btc/rate');
    assert.strictEqual(btcAlias.status, 200, '/api/btc/rate status');
    assert.ok(btcAlias.body && typeof btcAlias.body === 'object', '/api/btc/rate body');
    console.log('[ok] /api/btc/rate alias responds 200');

    console.log('\n[api-aliases.test.js] all assertions passed');
  } finally {
    await teardown();
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
}

run().then(() => {
  if (process.exitCode === 1) process.exit(1);
  process.exit(0);
}).catch((err) => {
  console.error('[api-aliases.test.js] FAIL:', err && err.stack || err);
  process.exit(1);
});
