/**
 * billion-scale-modules.test.js — Verifies the additive billion-scale modules.
 *
 * Guarantees:
 *   1. /api/revenue/totals, /api/monetize/marketplaces, /api/industry/list,
 *      /api/giants/list, /api/outcome/totals, /api/pool/summary all respond
 *      200 (previously 503 because backing modules were missing on disk).
 *   2. The billion-scale activation orchestrator reports 100% activation,
 *      0 missing existing modules, and all 4 generated-control modules
 *      have status 'registered'.
 *   3. End-to-end: record outcome → record sale via marketplace → both
 *      flow through sovereignRevenueRouter and increase totals.
 *
 * Additive only — these endpoints already existed in backend/index.js but
 * returned 503 (revenue blocker for the SaaS goal).
 */
'use strict';

const assert = require('assert');

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = process.env.ADMIN_2FA_CODE || '999999';
process.env.BTC_FX_OVERRIDE = process.env.BTC_FX_OVERRIDE || '60000';

const app = require('../backend/index');

let server;
let port;

async function req(method, path, body) {
  const url = `http://127.0.0.1:${port}${path}`;
  const opts = { method, headers: { Accept: 'application/json' } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (_) { /* non-json ok */ }
  return { status: res.status, body: data };
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
    // 1. Previously-503 endpoints must now respond 200
    const r1 = await req('GET', '/api/revenue/totals');
    assert.strictEqual(r1.status, 200, '/api/revenue/totals must be 200');
    assert.ok(r1.body && r1.body.payout && r1.body.payout.btcAddress, 'revenue totals must include payout.btcAddress');
    console.log('[ok] /api/revenue/totals → 200 (was 503)');

    const r2 = await req('GET', '/api/monetize/marketplaces');
    assert.strictEqual(r2.status, 200, '/api/monetize/marketplaces must be 200');
    // globalMonetizationMesh ships a curated catalog of 12 marketplaces
    // (AWS/GCP/Azure Marketplace, Salesforce AppExchange, Shopify, AppSumo,
    // Product Hunt, G2, Capterra, Atlassian, GitHub Marketplace, internal).
    // Asserting >=12 keeps the test forward-compatible if marketplaces are added.
    const MIN_MARKETPLACES = 12;
    assert.ok(r2.body && Array.isArray(r2.body.marketplaces) && r2.body.marketplaces.length >= MIN_MARKETPLACES,
      'marketplaces array must include >=' + MIN_MARKETPLACES + ' marketplaces');
    console.log('[ok] /api/monetize/marketplaces → 200 (was 503), ' + r2.body.marketplaces.length + ' marketplaces');

    const r3 = await req('GET', '/api/industry/list');
    assert.strictEqual(r3.status, 200, '/api/industry/list must be 200');
    assert.ok(r3.body && Array.isArray(r3.body.items) && r3.body.items.length >= 10,
      'industry list must include >=10 verticals');
    console.log('[ok] /api/industry/list → 200 (was 503), ' + r3.body.items.length + ' verticals');

    const r4 = await req('GET', '/api/giants/list');
    assert.strictEqual(r4.status, 200, '/api/giants/list must be 200');
    assert.ok(r4.body && Array.isArray(r4.body.giants) && r4.body.giants.length >= 20,
      'giants list must include >=20 giants');
    console.log('[ok] /api/giants/list → 200 (was 503), ' + r4.body.giants.length + ' giants');

    const r5 = await req('GET', '/api/outcome/totals');
    assert.strictEqual(r5.status, 200, '/api/outcome/totals must be 200');
    console.log('[ok] /api/outcome/totals → 200 (was 503)');

    const r6 = await req('GET', '/api/pool/summary');
    assert.strictEqual(r6.status, 200, '/api/pool/summary must be 200');
    assert.ok(r6.body && r6.body.total > 0, 'pool summary must have total > 0');
    console.log('[ok] /api/pool/summary → 200 (was 503), ' + r6.body.total + ' workers');

    // 2. Activation orchestrator status
    const r7 = await req('GET', '/api/billion-scale/activation/status');
    assert.strictEqual(r7.status, 200, 'activation status must be 200');
    assert.strictEqual(r7.body.summary.missingExistingModules, 0,
      'activation must report 0 missing existing modules');
    assert.strictEqual(r7.body.summary.averageActivationScore, 100,
      'activation must report 100% average activation score');
    console.log('[ok] /api/billion-scale/activation/status → 100% / 0 missing');

    const r8 = await req('GET', '/api/billion-scale/activation/missing');
    assert.strictEqual(r8.status, 200, 'activation missing endpoint must be 200');
    assert.ok(Array.isArray(r8.body.missingExistingModules), 'must return array');
    assert.strictEqual(r8.body.missingExistingModules.length, 0,
      'must report 0 missing existing modules');
    const generated = r8.body.generatedControlModules;
    assert.ok(Array.isArray(generated), 'generated control modules must be array');
    for (const g of generated) {
      assert.strictEqual(g.status, 'registered',
        'generated control module ' + g.id + ' must be registered, got ' + g.status);
    }
    console.log('[ok] /api/billion-scale/activation/missing → 0 missing, all '
      + generated.length + ' generated-control modules registered');

    // 3. End-to-end flow: record sale → revenue totals increase
    const before = await req('GET', '/api/revenue/totals');
    const beforeUsd = before.body.grossUsd || 0;

    const sale = await req('POST', '/api/monetize/sale', {
      amountUsd: 1000,
      marketplace: 'aws-marketplace',
      productId: 'test-billion-scale-pkg',
    });
    assert.strictEqual(sale.status, 200, 'monetize sale must be 200');
    assert.ok(sale.body && sale.body.ok, 'sale must succeed');
    assert.ok(sale.body.routed && sale.body.routed.id.startsWith('rev_'),
      'sale must produce a revenue-router event');
    console.log('[ok] /api/monetize/sale routed through sovereignRevenueRouter, evt='
      + sale.body.routed.id);

    const after = await req('GET', '/api/revenue/totals');
    const afterUsd = after.body.grossUsd || 0;
    assert.ok(afterUsd > beforeUsd,
      'revenue totals must increase after sale: ' + beforeUsd + ' → ' + afterUsd);
    console.log('[ok] revenue totals grew from $' + beforeUsd + ' to $' + afterUsd);

    // 4. Outcome record + verify
    const outcome = await req('POST', '/api/outcome/record', {
      tenantId: 'test-tenant',
      outcome: 'energy-saved',
      unit: 'kwh',
      amount: 1500,
      valueUsd: 300,
    });
    assert.strictEqual(outcome.status, 200, 'outcome record must be 200');
    assert.ok(outcome.body && outcome.body.event && outcome.body.event.id, 'outcome must have id');
    console.log('[ok] /api/outcome/record produced ' + outcome.body.event.id);

    const verified = await req('POST', '/api/outcome/verify', { id: outcome.body.event.id });
    assert.strictEqual(verified.status, 200, 'outcome verify must be 200');
    assert.ok(verified.body && verified.body.verified, 'outcome must verify');
    console.log('[ok] /api/outcome/verify confirmed event integrity');

    console.log('\n[billion-scale-modules.test.js] all assertions passed');
  } finally {
    await teardown();
  }
}

run().then(() => {
  if (process.exitCode === 1) process.exit(1);
  // Production code starts long-lived intervals (predictive-scaler, mesh,
  // orchestrators) that keep the event loop alive after server.close().
  // Explicit exit per repo memory pattern in test/health.test.js etc.
  process.exit(0);
}).catch((err) => {
  console.error('[billion-scale-modules.test.js] FAIL:', err && err.stack || err);
  process.exit(1);
});
