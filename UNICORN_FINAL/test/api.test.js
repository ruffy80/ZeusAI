/**
 * Backend API integration tests
 * Tests /api/* endpoints: auth, health, users admin
 * Runs against the Express app on a random ephemeral port (no real DB needed — uses in-memory fallback).
 */
'use strict';

const assert = require('assert');

// Force in-memory mode so no SQLite file is created/needed in CI
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-ci-only';
process.env.ADMIN_MASTER_PASSWORD = 'TestAdmin2026!';
process.env.ADMIN_2FA_CODE = '999999';

const app = require('../backend/index');

let server;
let port;
let userToken;
let adminToken;

async function apiRequest(method, path, body, headers = {}) {
  const url = `http://127.0.0.1:${port}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let json = null;
  try { json = await res.json(); } catch (_) { /* empty */ }
  return { status: res.status, body: json, headers: res.headers };
}

async function setup() {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  port = server.address().port;
}

async function teardown() {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function runTests() {
  await setup();
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return fn().then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    }).catch((err) => {
      console.error(`  ❌ ${name}: ${err.message}`);
      failed++;
    });
  }

  console.log('\n🧪 Backend API Tests\n');

  // ── Health ──────────────────────────────────────────────────────────────────
  console.log('Health endpoint:');
  await test('GET /api/health returns ok', async () => {
    const r = await apiRequest('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
    assert.ok(typeof r.body.uptime === 'number');
    assert.ok(r.body.memory && r.body.memory.heapUsed);
    assert.ok(r.body.version);
  });

  await test('GET /api/health has security headers', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.ok(res.headers.get('x-content-type-options') === 'nosniff');
    assert.ok(res.headers.get('x-frame-options'));
    assert.ok(res.headers.get('content-security-policy'));
  });

  // ── LEGACY AUTH RETIRED — replaced by Ed25519 cryptoauth ──────────────────
  // The old password/JWT-email + passkey/WebAuthn stack on the backend has been
  // replaced by /api/cryptoauth/* (Ed25519 + IndexedDB + encrypted vault backup).
  // These tests assert the retirement contract: 410 Gone with Deprecation,
  // Sunset, Link rel=successor-version, X-Auth-Retired headers, plus the new
  // cryptoauth manifest reachable through the same backend.
  console.log('\nLegacy auth retirement (cryptoauth replaces password/passkey):');
  const RETIRED_POSTS = [
    '/api/customer/signup', '/api/customer/login', '/api/customer/logout',
    '/api/customer/forgot-password', '/api/customer/reset-password',
    '/api/auth/register', '/api/auth/login', '/api/auth/logout',
    '/api/auth/passkey/challenge', '/api/auth/passkey/register',
    '/api/auth/passkey/assert', '/api/webauthn/register/begin',
    '/api/device-key/register',
  ];
  for (const p of RETIRED_POSTS) {
    await test(`POST ${p} → 410 Gone (retired)`, async () => {
      const r = await apiRequest('POST', p, { email: 'x@y.z', password: 'irrelevant' });
      assert.equal(r.status, 410, `${p} should return 410, got ${r.status}`);
      assert.equal(r.body.error, 'auth_endpoint_retired');
      assert.ok(r.body.successor && r.body.successor.includes('cryptoauth'));
      assert.equal(r.headers.get('deprecation'), 'true');
      assert.ok(r.headers.get('sunset'));
      const link = r.headers.get('link') || '';
      assert.ok(/rel="successor-version"/i.test(link));
      assert.ok(r.headers.get('x-auth-retired'));
    });
  }
  await test('GET /api/cryptoauth/manifest → 200 with pack=zeus-cryptoauth', async () => {
    const r = await apiRequest('GET', '/api/cryptoauth/manifest');
    assert.equal(r.status, 200);
    assert.equal(r.body.pack, 'zeus-cryptoauth');
    assert.ok(/ed25519/i.test(String(r.body.algorithm)));
    assert.ok(r.body.endpoints && Object.keys(r.body.endpoints).length >= 6);
  });
  await test('GET /api/cryptoauth/me without token → 401', async () => {
    const r = await apiRequest('GET', '/api/cryptoauth/me');
    assert.equal(r.status, 401);
  });

  // ── Billing Plans ────────────────────────────────────────────────────────────
  console.log('\nBilling:');
  await test('GET /api/billing/plans/public → 200 with plans array', async () => {
    const r = await apiRequest('GET', '/api/billing/plans/public');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body) || (r.body && Array.isArray(r.body.plans)));
  });

  console.log('\nNOWPayments:');
  await test('GET /api/payment/nowpayments/security → 200 with provider status', async () => {
    const r = await apiRequest('GET', '/api/payment/nowpayments/security');
    assert.equal(r.status, 200);
    assert.equal(r.body.provider, 'nowpayments');
    assert.equal(typeof r.body.apiKeyConfigured, 'boolean');
    assert.equal(typeof r.body.webhookSecurityReady, 'boolean');
  });

  await test('POST /api/payment/nowpayments/create → fallback BTC invoice when API key absent', async () => {
    const r = await apiRequest('POST', '/api/payment/nowpayments/create', {
      amountUsd: 49,
      itemName: 'Smoke Service',
      itemId: 'smoke-service',
      clientId: 'test-client'
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.id);
    assert.equal(r.body.pay_currency, 'btc');
    assert.ok(r.body.pay_address);
    assert.equal(r.body.fallback, true);
  });

  console.log('\nQuantum Integrity Shield:');
  await test('GET /api/quantum-integrity/status → diagnostics without false PM2 names', async () => {
    const r = await apiRequest('GET', '/api/quantum-integrity/status');
    assert.equal(r.status, 200);
    assert.ok(r.body.diagnostics);
    assert.ok(Array.isArray(r.body.diagnostics.requiredPm2Processes));
    assert.ok(r.body.diagnostics.requiredPm2Processes.includes('unicorn-backend'));
    assert.ok(!r.body.diagnostics.requiredPm2Processes.includes('unicorn-orchestrator'));
  });

  console.log('\nWorld Standard APIs:');
  await test('GET /api/transparency/ledger → 200 with hash-chain status', async () => {
    const r = await apiRequest('GET', '/api/transparency/ledger');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.anchors.localHashChain, true);
  });

  await test('GET /api/resilience/backup/status → 200 with durable backup metadata', async () => {
    const r = await apiRequest('GET', '/api/resilience/backup/status');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.protects.includes('user sqlite database'));
  });

  await test('GET /api/vendor/marketplace/policy → 200 with quarantine policy', async () => {
    const r = await apiRequest('GET', '/api/vendor/marketplace/policy');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.onboarding.includes('signed module manifest'));
  });

  await test('POST /api/vendor/marketplace/submit → quarantines module', async () => {
    const r = await apiRequest('POST', '/api/vendor/marketplace/submit', { name: 'Smoke Vendor Module', vendor: 'Smoke Labs', manifest: { version: '1.0.0' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.module.status, 'quarantined-pending-review');
  });

  await test('GET /api/compliance/autopilot → 200 with privacy controls', async () => {
    const r = await apiRequest('GET', '/api/compliance/autopilot');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.controls.includes('export/delete workflow'));
  });

  // /api/privacy/export with auth needs cryptoauth-derived bearer (legacy JWT retired).
  // The unauthenticated denial contract is still enforced and verified here; the
  // authenticated success path will be re-introduced via a cryptoauth-aware test.
  await test('GET /api/privacy/export without token → 401 (auth still enforced)', async () => {
    const denied = await apiRequest('GET', '/api/privacy/export');
    assert.equal(denied.status, 401);
  });

  console.log('\nAutonomous Money Machine:');
  await test('GET /api/money-machine/status → 200 with all revenue modules', async () => {
    const r = await apiRequest('GET', '/api/money-machine/status');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.modules.includes('Autonomous Revenue Commander'));
    assert.ok(r.body.modules.includes('Customer Success Autopilot'));
  });

  await test('GET /api/revenue/commander → autonomous decision', async () => {
    const r = await apiRequest('GET', '/api/revenue/commander');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(Array.isArray(r.body.decision.actions));
  });

  await test('POST /api/offers/factory → generates checkout-ready offers', async () => {
    const r = await apiRequest('POST', '/api/offers/factory', { industry: 'fintech', segment: 'enterprise', budgetUsd: 5000 });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.offers.length >= 4);
    assert.ok(r.body.offers[0].checkoutPath.includes('/checkout'));
  });

  await test('POST /api/conversion/event + GET intelligence → records funnel data', async () => {
    const event = await apiRequest('POST', '/api/conversion/event', { type: 'checkout_started', path: '/checkout', valueUsd: 299 });
    assert.equal(event.status, 200);
    assert.equal(event.body.ok, true);
    const r = await apiRequest('GET', '/api/conversion/intelligence');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.eventCount >= 1);
  });

  await test('POST /api/checkout/recovery → queues recovery sequence', async () => {
    const r = await apiRequest('POST', '/api/checkout/recovery', { email: 'buyer@test.com', plan: 'money-machine-pro', amountUsd: 1499 });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.recovery.status, 'queued');
  });

  await test('POST /api/sales/sdr/lead → qualifies B2B lead', async () => {
    const r = await apiRequest('POST', '/api/sales/sdr/lead', { company: 'Acme SaaS', industry: 'SaaS', employeeCount: 42, budgetUsd: 2500, pain: 'need autonomous lead generation and checkout recovery' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.lead.score >= 70);
  });

  await test('POST /api/sales/closer/answer → returns CTA answer', async () => {
    const r = await apiRequest('POST', '/api/sales/closer/answer', { objection: 'price', plan: 'money-machine-pro' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.cta.includes('/checkout'));
  });

  await test('SEO and customer success APIs → live foundations', async () => {
    const seo = await apiRequest('GET', '/api/seo/programmatic/status');
    assert.equal(seo.status, 200);
    assert.equal(seo.body.ok, true);
    assert.ok(seo.body.pageTemplates >= 10);
    const success = await apiRequest('POST', '/api/customer-success/analyze', { paid: true, usage: 500, daysInactive: 0 });
    assert.equal(success.status, 200);
    assert.equal(success.body.ok, true);
    assert.equal(success.body.action, 'upsell-expansion');
  });

  console.log('\nUnicorn Commerce Connector:');
  await test('GET /api/unicorn-commerce/status → module registry becomes sellable BTC catalog', async () => {
    const r = await apiRequest('GET', '/api/unicorn-commerce/status');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.payout.rail, 'btc-direct');
    assert.equal(r.body.payout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.sellsCurrentModules >= 300);
    assert.ok(r.body.sellsFuturePrimitives >= 7);
  });

  await test('GET /api/unicorn-commerce/catalog → all current modules have checkout manifests', async () => {
    const r = await apiRequest('GET', '/api/unicorn-commerce/catalog');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.counts.registry >= 300);
    assert.ok(r.body.items.some(item => item.id === 'unicorn-module-autonomous-money-machine' && item.buyUrl.includes('/checkout')));
    assert.ok(r.body.items.every(item => item.checkout && item.checkout.btcAddress === 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'));
  });

  await test('GET /api/unicorn-commerce/future-primitives → labeled R&D innovations', async () => {
    const r = await apiRequest('GET', '/api/unicorn-commerce/future-primitives');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.count >= 7);
    assert.ok(r.body.items.some(item => item.id === 'intent-to-revenue-compiler'));
    assert.ok(r.body.items.every(item => item.autonomy.claimsGuardrail));
  });

  console.log('\nBillion-Scale Revenue Foundation:');
  await test('GET /api/billion-scale/status → high-ticket revenue layer is live', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/status');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.status, 'billion-scale-foundation-live');
    assert.equal(r.body.payout.rail, 'btc-direct');
    assert.equal(r.body.payout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.packageCount >= 5);
    assert.ok(r.body.maxPackageUsd >= 1000000);
    assert.ok(r.body.caveat.includes('actual revenue requires customers'));
  });

  await test('GET /api/billion-scale/packages → strategic BTC packages', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/packages');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.count >= 5);
    assert.ok(r.body.items.some(item => item.id === 'zeusai-sovereign-ai-private-deployment' && item.priceUsd >= 1000000));
    assert.ok(r.body.items.every(item => item.group === 'billion-scale-package'));
    assert.ok(r.body.items.every(item => item.checkout.btcAddress === 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e'));
  });

  await test('GET /api/billion-scale/dashboard → owner KPI and pipeline math', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/dashboard');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.payout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.pipelineMath.some(row => row.targetDealsFor1B >= 1));
    assert.ok(r.body.kpisNeeded.includes('ARR'));
  });

  await test('GET /api/billion-scale/marketplace-economics → billion take-rate model', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/marketplace-economics');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.model, 'marketplace-gmv-take-rate');
    assert.ok(r.body.annualRevenueUsd >= 1000000000);
    assert.equal(r.body.pathToBillionUsd, 'achieved-at-this-scale');
  });

  await test('POST /api/billion-scale/deal-desk/proposal → enterprise BTC proposal', async () => {
    const r = await apiRequest('POST', '/api/billion-scale/deal-desk/proposal', { packageId: 'zeusai-autonomous-saas-os', company: 'Acme Enterprise', seats: 3 });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.company, 'Acme Enterprise');
    assert.ok(r.body.proposedUsd >= 75000);
    assert.equal(r.body.btcCheckout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.btcCheckout.checkoutUrl.includes('/checkout'));
  });

  await test('GET /api/billion-scale/vertical-pages → enterprise SEO expansion', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/vertical-pages');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.count >= 10);
    assert.ok(r.body.pages.some(page => page.slug.includes('fintech-autonomous-revenue-machine')));
  });

  await test('GET /api/billion-scale/activation/status → existing modules are activated', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/activation/status');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.status, 'unicorn-billion-scale-modules-activated');
    assert.equal(r.body.payout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.summary.capabilityCount >= 8);
    assert.ok(r.body.summary.activatedExistingModules >= 20);
    assert.ok(r.body.summary.generatedControlModules >= 4);
  });

  await test('GET /api/billion-scale/activation/modules → capability graph maps Unicorn modules', async () => {
    const r = await apiRequest('GET', '/api/billion-scale/activation/modules');
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.capabilities.some(item => item.id === 'btc-revenue-settlement' && item.activeExisting.includes('billing-engine')));
    assert.ok(r.body.capabilities.some(item => item.id === 'marketplace-take-rate' && item.activeExisting.includes('serviceMarketplace')));
    assert.ok(r.body.generatedControlModules.some(item => item.id === 'billion-scale-activation-orchestrator'));
  });

  await test('POST /api/billion-scale/activation/run → activation plan with BTC payout', async () => {
    const r = await apiRequest('POST', '/api/billion-scale/activation/run', { packageId: 'zeusai-sovereign-ai-private-deployment', company: 'Global Buyer' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.status, 'activation-plan-ready');
    assert.equal(r.body.company, 'Global Buyer');
    assert.equal(r.body.payout.btcAddress, 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
    assert.ok(r.body.steps.length >= 6);
  });

  // ── Admin User Management (deferred — depends on retired admin password+2FA) ──
  // The legacy admin login flow used /api/auth/login with master password + 2FA.
  // That endpoint is retired (410). Admin-role authorization will be re-issued
  // through a cryptoauth-derived role grant. Until then we only verify the
  // unauthenticated denial contract is still enforced.
  console.log('\nAdmin - User Management (auth retired, denial contract only):');
  await test('GET /api/admin/users - no token → 401', async () => {
    const r = await apiRequest('GET', '/api/admin/users');
    assert.equal(r.status, 401);
  });
  await test('GET /api/admin/users/nonexistentid - no token → 401', async () => {
    const r = await apiRequest('GET', '/api/admin/users/nonexistentid');
    assert.equal(r.status, 401);
  });

  // ── Modules ───────────────────────────────────────────────────────────────────
  console.log('\nModules:');
  await test('GET /api/modules without token → 401 (auth still enforced)', async () => {
    const r = await apiRequest('GET', '/api/modules');
    assert.equal(r.status, 401);
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  console.log('\nSecurity:');
  await test('GET /api/health returns Content-Security-Policy header', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp && csp.includes("default-src 'self'"), 'CSP header missing or wrong');
  });

  await test('404 endpoint returns JSON', async () => {
    const r = await apiRequest('GET', '/api/nonexistent-endpoint-xyz');
    // Should either be 404 or fall through to SPA (200) — just not a crash
    assert.ok([200, 404].includes(r.status));
  });

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  await teardown();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
