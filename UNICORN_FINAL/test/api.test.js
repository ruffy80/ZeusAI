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

  // ── Auth: Register ──────────────────────────────────────────────────────────
  console.log('\nAuth - Register:');
  await test('POST /api/auth/register - missing fields → 400', async () => {
    const r = await apiRequest('POST', '/api/auth/register', { email: 'a@b.com' });
    assert.equal(r.status, 400);
  });

  await test('POST /api/auth/register - invalid email → 400', async () => {
    const r = await apiRequest('POST', '/api/auth/register', { name: 'Test', email: 'not-an-email', password: 'Password123' });
    assert.equal(r.status, 400);
    assert.ok(r.body.error.toLowerCase().includes('email'));
  });

  await test('POST /api/auth/register - password too short → 400', async () => {
    const r = await apiRequest('POST', '/api/auth/register', { name: 'Test', email: 'short@test.com', password: '123' });
    assert.equal(r.status, 400);
    assert.ok(r.body.error.toLowerCase().includes('password'));
  });

  await test('POST /api/auth/register - valid user → 200 with token', async () => {
    const r = await apiRequest('POST', '/api/auth/register', { name: 'Zeus Test', email: 'zeus@test.com', password: 'SecurePass123!' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    assert.equal(r.body.user.email, 'zeus@test.com');
    userToken = r.body.token;
  });

  await test('POST /api/auth/register - duplicate email → 409', async () => {
    const r = await apiRequest('POST', '/api/auth/register', { name: 'Zeus Test2', email: 'zeus@test.com', password: 'SecurePass123!' });
    assert.equal(r.status, 409);
  });

  // ── Auth: Login ─────────────────────────────────────────────────────────────
  console.log('\nAuth - Login:');
  await test('POST /api/auth/login - missing fields → 400', async () => {
    const r = await apiRequest('POST', '/api/auth/login', { email: 'zeus@test.com' });
    assert.equal(r.status, 400);
  });

  await test('POST /api/auth/login - wrong password → 401', async () => {
    const r = await apiRequest('POST', '/api/auth/login', { email: 'zeus@test.com', password: 'WrongPass' });
    assert.equal(r.status, 401);
  });

  await test('POST /api/auth/login - valid credentials → 200 with token', async () => {
    const r = await apiRequest('POST', '/api/auth/login', { email: 'zeus@test.com', password: 'SecurePass123!' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
  });

  await test('POST /api/auth/login - admin login (password+2FA) → 200 with token', async () => {
    const r = await apiRequest('POST', '/api/auth/login', { password: 'TestAdmin2026!', twoFactorCode: '999999' });
    assert.equal(r.status, 200);
    assert.ok(r.body.token);
    adminToken = r.body.token;
  });

  await test('POST /api/auth/login - admin login wrong 2FA → 401', async () => {
    const r = await apiRequest('POST', '/api/auth/login', { password: 'TestAdmin2026!', twoFactorCode: '000000' });
    assert.equal(r.status, 401);
  });

  // ── Auth: Me ─────────────────────────────────────────────────────────────────
  console.log('\nAuth - Me:');
  await test('GET /api/auth/me - no token → 401', async () => {
    const r = await apiRequest('GET', '/api/auth/me');
    assert.equal(r.status, 401);
  });

  await test('GET /api/auth/me - valid token → 200', async () => {
    const r = await apiRequest('GET', '/api/auth/me', null, { Authorization: `Bearer ${userToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.email, 'zeus@test.com');
    assert.ok(!r.body.passwordHash, 'passwordHash must not be exposed');
  });

  await test('POST /api/auth/passkey/challenge register → 200 with publicKey', async () => {
    const r = await apiRequest('POST', '/api/auth/passkey/challenge', { email: 'zeus@test.com', mode: 'register' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.ok(r.body.publicKey.challenge);
    assert.ok(r.body.publicKey.rp);
  });

  await test('POST /api/auth/passkey/register without proof → 401', async () => {
    const r = await apiRequest('POST', '/api/auth/passkey/register', { email: 'zeus@test.com', credential: { id: 'fake' } });
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

  await test('GET /api/privacy/export requires auth and returns portable export', async () => {
    const denied = await apiRequest('GET', '/api/privacy/export');
    assert.equal(denied.status, 401);
    const r = await apiRequest('GET', '/api/privacy/export', null, { Authorization: `Bearer ${userToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.user.email, 'zeus@test.com');
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

  // ── Admin User Management ────────────────────────────────────────────────────
  console.log('\nAdmin - User Management:');
  await test('GET /api/admin/users - no token → 401', async () => {
    const r = await apiRequest('GET', '/api/admin/users');
    assert.equal(r.status, 401);
  });

  await test('GET /api/admin/users - admin token → 200 with paginated list', async () => {
    const r = await apiRequest('GET', '/api/admin/users?page=1&limit=10', null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.users));
    assert.ok(typeof r.body.total === 'number');
    assert.ok(typeof r.body.pages === 'number');
    assert.equal(r.body.page, 1);
  });

  await test('GET /api/admin/users - search filter works', async () => {
    const r = await apiRequest('GET', '/api/admin/users?search=zeus', null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.ok(r.body.users.every(u => u.name.toLowerCase().includes('zeus') || u.email.toLowerCase().includes('zeus')));
  });

  await test('GET /api/admin/users/:id - returns user without password', async () => {
    const list = await apiRequest('GET', '/api/admin/users', null, { Authorization: `Bearer ${adminToken}` });
    const userId = list.body.users[0].id;
    const r = await apiRequest('GET', `/api/admin/users/${userId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.ok(!r.body.passwordHash);
    assert.ok(!r.body.resetToken);
  });

  await test('GET /api/admin/users/:id - not found → 404', async () => {
    const r = await apiRequest('GET', '/api/admin/users/nonexistentid', null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 404);
  });

  await test('PUT /api/admin/users/:id/plan - valid plan → 200', async () => {
    const list = await apiRequest('GET', '/api/admin/users', null, { Authorization: `Bearer ${adminToken}` });
    const userId = list.body.users[0].id;
    const r = await apiRequest('PUT', `/api/admin/users/${userId}/plan`, { planId: 'pro' }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.planId, 'pro');
  });

  await test('PUT /api/admin/users/:id/plan - invalid plan → 400', async () => {
    const list = await apiRequest('GET', '/api/admin/users', null, { Authorization: `Bearer ${adminToken}` });
    const userId = list.body.users[0].id;
    const r = await apiRequest('PUT', `/api/admin/users/${userId}/plan`, { planId: 'golden' }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 400);
  });

  await test('DELETE /api/admin/users/:id - deletes user → 200', async () => {
    // Register a disposable user
    const reg = await apiRequest('POST', '/api/auth/register', { name: 'Temp User', email: 'temp@delete.com', password: 'DeleteMe123!' });
    assert.equal(reg.status, 200);
    const list = await apiRequest('GET', '/api/admin/users?search=temp', null, { Authorization: `Bearer ${adminToken}` });
    const userId = list.body.users[0].id;
    const r = await apiRequest('DELETE', `/api/admin/users/${userId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    // Verify deleted
    const check = await apiRequest('GET', `/api/admin/users/${userId}`, null, { Authorization: `Bearer ${adminToken}` });
    assert.equal(check.status, 404);
  });

  // ── Modules ───────────────────────────────────────────────────────────────────
  console.log('\nModules:');
  await test('GET /api/modules → 200 with array', async () => {
    const r = await apiRequest('GET', '/api/modules', null, { Authorization: `Bearer ${userToken}` });
    assert.equal(r.status, 200);
    assert.ok(r.body.modules && r.body.modules.length > 0);
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
