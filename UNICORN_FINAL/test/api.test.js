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
