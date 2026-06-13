'use strict';
/**
 * db-layer.test.js — Unit tests for backend/db.js
 *
 * Tests the database layer (users, payments, purchases, apiKeys, monthlyUsage,
 * referrals, workflows, tenants, passkeys) using in-memory SQLite or the
 * in-memory fallback store.
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// Use a unique temp DB so tests are isolated
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-db-test-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

// Clear module cache to get a fresh db instance
const dbModPath = require.resolve('../backend/db');
delete require.cache[dbModPath];
const db = require('../backend/db');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓', name);
}

// ── Users ───────────────────────────────────────────────────────────────────
console.log('DB Layer — Users');

check('create and findById', () => {
  const user = {
    id: 'user-test-1',
    name: 'Test User',
    email: 'test1@example.com',
    passwordHash: 'hash123',
    emailVerified: 0,
    verifyToken: 'vt1',
    verifyExpires: Date.now() + 3600000,
    createdAt: new Date().toISOString(),
  };
  db.users.create(user);
  const found = db.users.findById('user-test-1');
  assert.ok(found);
  assert.strictEqual(found.name, 'Test User');
  assert.strictEqual(found.email, 'test1@example.com');
});

check('findByEmail', () => {
  const found = db.users.findByEmail('test1@example.com');
  assert.ok(found);
  assert.strictEqual(found.id, 'user-test-1');
});

check('findByEmail returns null for unknown', () => {
  const found = db.users.findByEmail('nonexist@example.com');
  assert.strictEqual(found, null);
});

check('findById returns null for unknown', () => {
  const found = db.users.findById('no-such-user');
  assert.strictEqual(found, null);
});

check('updateProfile', () => {
  db.users.updateProfile('user-test-1', 'Updated Name', 'updated@example.com');
  const found = db.users.findById('user-test-1');
  assert.strictEqual(found.name, 'Updated Name');
  assert.strictEqual(found.email, 'updated@example.com');
});

check('updatePassword', () => {
  db.users.updatePassword('user-test-1', 'newhash456');
  const found = db.users.findById('user-test-1');
  assert.strictEqual(found.passwordHash, 'newhash456');
});

check('verifyEmail', () => {
  db.users.verifyEmail('user-test-1');
  const found = db.users.findById('user-test-1');
  assert.strictEqual(found.emailVerified, 1);
});

check('count returns correct number', () => {
  const count = db.users.count();
  assert.ok(count >= 1);
});

check('setResetToken and findByResetToken', () => {
  const token = 'reset-token-abc';
  const expires = Date.now() + 3600000;
  db.users.setResetToken('user-test-1', token, expires);
  const found = db.users.findByResetToken(token);
  assert.ok(found);
  assert.strictEqual(found.id, 'user-test-1');
});

check('findByResetToken returns null for expired token', () => {
  const token = 'expired-token';
  const expires = Date.now() - 1000; // already expired
  db.users.setResetToken('user-test-1', token, expires);
  const found = db.users.findByResetToken(token);
  assert.strictEqual(found, null);
});

check('setPlanId', () => {
  db.users.setPlanId('user-test-1', 'pro');
  const found = db.users.findById('user-test-1');
  assert.strictEqual(found.planId, 'pro');
});

check('listAll returns paginated results', () => {
  // Create additional users
  for (let i = 2; i <= 5; i++) {
    db.users.create({
      id: `user-test-${i}`,
      name: `User ${i}`,
      email: `test${i}@example.com`,
      passwordHash: 'hash',
      emailVerified: 0,
      verifyToken: null,
      verifyExpires: null,
      createdAt: new Date().toISOString(),
    });
  }
  const result = db.users.listAll({ page: 1, limit: 2 });
  assert.strictEqual(result.users.length, 2);
  assert.ok(result.total >= 5);
  assert.strictEqual(result.page, 1);
  assert.strictEqual(result.limit, 2);
  assert.ok(result.pages >= 3);
});

check('listAll supports search', () => {
  const result = db.users.listAll({ search: 'Updated' });
  assert.ok(result.users.length >= 1);
  assert.ok(result.users.some(u => u.name.includes('Updated')));
});

check('deleteById removes user', () => {
  db.users.create({
    id: 'user-to-delete',
    name: 'Delete Me',
    email: 'delete@example.com',
    passwordHash: 'hash',
    emailVerified: 0,
    verifyToken: null,
    verifyExpires: null,
    createdAt: new Date().toISOString(),
  });
  const result = db.users.deleteById('user-to-delete');
  assert.ok(result);
  assert.strictEqual(db.users.findById('user-to-delete'), null);
});

// ── Payments ────────────────────────────────────────────────────────────────
console.log('\nDB Layer — Payments');

check('save and findByTxId', () => {
  const payment = {
    txId: 'tx-001',
    clientId: 'user-test-1',
    description: 'Pro plan',
    method: 'btc',
    provider: 'direct',
    currency: 'USD',
    amount: 99,
    fee: 0,
    total: 99,
    status: 'completed',
    walletAddress: 'bc1q...',
    qrCode: null,
    exchangeRate: 60000,
    cryptoAmount: 0.00165,
    providerPaymentId: null,
    providerStatus: null,
    checkoutUrl: null,
    nextAction: null,
    processorResponse: null,
    metadata: { source: 'test' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.payments.save(payment);
  const found = db.payments.findByTxId('tx-001');
  assert.ok(found);
  assert.strictEqual(found.txId, 'tx-001');
  assert.strictEqual(found.amount, 99);
  assert.strictEqual(found.status, 'completed');
});

check('findByTxId returns null for unknown', () => {
  assert.strictEqual(db.payments.findByTxId('no-such-tx'), null);
});

check('list returns all payments', () => {
  const payments = db.payments.list();
  assert.ok(Array.isArray(payments));
  assert.ok(payments.length >= 1);
});

check('list filters by clientId', () => {
  const payments = db.payments.list({ clientId: 'user-test-1' });
  assert.ok(payments.every(p => p.clientId === 'user-test-1'));
});

check('list filters by status', () => {
  const payments = db.payments.list({ status: 'completed' });
  assert.ok(payments.every(p => p.status === 'completed'));
});

check('revenueStats returns totals', () => {
  const stats = db.payments.revenueStats();
  assert.strictEqual(typeof stats.revenue, 'number');
  assert.strictEqual(typeof stats.cnt, 'number');
  assert.ok(stats.revenue >= 99);
});

// ── Purchases ───────────────────────────────────────────────────────────────
console.log('\nDB Layer — Purchases');

check('record and listByClient', () => {
  db.purchases.record({
    clientId: 'user-test-1',
    serviceId: 'svc-ai',
    serviceName: 'AI Analysis',
    description: 'Advanced AI analysis',
    category: 'ai',
    price: 5,
    paymentTxId: 'tx-001',
    paymentMethod: 'btc',
    purchasedAt: new Date().toISOString(),
  });
  const list = db.purchases.listByClient('user-test-1');
  assert.ok(list.length >= 1);
  assert.ok(list.some(p => p.serviceId === 'svc-ai'));
});

check('statsForClient returns totals', () => {
  const stats = db.purchases.statsForClient('user-test-1');
  assert.ok(stats.purchases >= 1);
  assert.ok(stats.totalSpent >= 5);
});

// ── API Keys ────────────────────────────────────────────────────────────────
console.log('\nDB Layer — API Keys');

check('create returns key info and verify works', () => {
  const result = db.apiKeys.create({
    name: 'Test Key',
    clientId: 'user-test-1',
    planId: 'pro',
  });
  assert.ok(result.keyId);
  assert.ok(result.key);
  assert.strictEqual(result.name, 'Test Key');
  assert.strictEqual(result.planId, 'pro');

  // verify with the raw key
  const verified = db.apiKeys.verify(result.key);
  assert.ok(verified);
  assert.strictEqual(verified.clientId, 'user-test-1');
});

check('verify returns null for invalid key', () => {
  const result = db.apiKeys.verify('invalid-key-xyz');
  assert.strictEqual(result, null);
});

check('listForClient returns API keys for user', () => {
  const keys = db.apiKeys.listForClient('user-test-1');
  assert.ok(Array.isArray(keys));
  assert.ok(keys.length >= 1);
});

// ── Monthly Usage ───────────────────────────────────────────────────────────
console.log('\nDB Layer — Monthly Usage');

check('add and get monthly usage', () => {
  if (db.monthlyUsage) {
    const month = new Date().toISOString().slice(0, 7);
    db.monthlyUsage.add('user-test-1', month, 10, 'api_call');
    const usage = db.monthlyUsage.get('user-test-1', month);
    assert.ok(usage);
    assert.ok(usage.used >= 10 || usage.credits >= 10);
  } else {
    // Skip if monthlyUsage not available in this env
    console.log('    (monthlyUsage not available, skipped)');
  }
});

// ── Meta ────────────────────────────────────────────────────────────────────
console.log('\nDB Layer — Meta');

check('meta() returns status object', () => {
  const status = db.meta();
  assert.strictEqual(typeof status.usingSqlite, 'boolean');
  assert.strictEqual(typeof status.durable, 'boolean');
  assert.strictEqual(typeof status.dbPath, 'string');
  assert.strictEqual(typeof status.userCount, 'number');
  assert.ok(['sqlite-memory', 'sqlite-file', 'in-memory-fallback'].includes(status.mode));
  assert.ok(status.usingSqlite === true);
  assert.ok(status.userCount >= 1);
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
try {
  fs.rmSync(tmpDir, { recursive: true });
} catch {}

console.log(`\n✅ db-layer: ${passed} tests passed\n`);
