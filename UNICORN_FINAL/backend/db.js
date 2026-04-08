/**
 * SQLite persistence layer
 * Replaces all in-memory arrays/Maps so data survives server restarts.
 * Tables: users, payments, marketplace_purchases, api_keys, api_usage
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'unicorn.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// Schema creation
// ============================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    verifyToken TEXT,
    verifyExpires INTEGER,
    resetToken  TEXT,
    resetExpires INTEGER,
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    txId        TEXT PRIMARY KEY,
    clientId    TEXT NOT NULL DEFAULT 'guest',
    description TEXT NOT NULL,
    method      TEXT NOT NULL,
    provider    TEXT,
    currency    TEXT NOT NULL DEFAULT 'USD',
    amount      REAL NOT NULL,
    fee         REAL NOT NULL DEFAULT 0,
    total       REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'created',
    walletAddress TEXT,
    qrCode      TEXT,
    exchangeRate REAL,
    cryptoAmount REAL,
    providerPaymentId TEXT,
    providerStatus TEXT,
    checkoutUrl TEXT,
    nextAction  TEXT,
    processorResponse TEXT,
    metadata    TEXT NOT NULL DEFAULT '{}',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marketplace_purchases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId    TEXT NOT NULL,
    serviceId   TEXT NOT NULL,
    serviceName TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',
    price       REAL NOT NULL DEFAULT 0,
    paymentTxId TEXT,
    paymentMethod TEXT,
    purchasedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_marketplace_client ON marketplace_purchases(clientId);

  CREATE TABLE IF NOT EXISTS api_keys (
    keyId       TEXT PRIMARY KEY,
    keyHash     TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL DEFAULT '',
    clientId    TEXT NOT NULL,
    planId      TEXT NOT NULL DEFAULT 'starter',
    active      INTEGER NOT NULL DEFAULT 1,
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_usage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyId       TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    ts          INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_api_usage_key_ts ON api_usage(keyId, ts);
`);

// ============================================================
// Users
// ============================================================

const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (id, name, email, passwordHash, emailVerified, verifyToken, verifyExpires, createdAt)
    VALUES (@id, @name, @email, @passwordHash, @emailVerified, @verifyToken, @verifyExpires, @createdAt)
  `),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  findUserByVerifyToken: db.prepare('SELECT * FROM users WHERE verifyToken = ? AND verifyExpires > ?'),
  findUserByResetToken: db.prepare('SELECT * FROM users WHERE resetToken = ? AND resetExpires > ?'),
  updateUserProfile: db.prepare('UPDATE users SET name = @name, email = @email WHERE id = @id'),
  updatePassword: db.prepare('UPDATE users SET passwordHash = @passwordHash, resetToken = NULL, resetExpires = NULL WHERE id = @id'),
  setResetToken: db.prepare('UPDATE users SET resetToken = @resetToken, resetExpires = @resetExpires WHERE id = @id'),
  verifyEmail: db.prepare('UPDATE users SET emailVerified = 1, verifyToken = NULL, verifyExpires = NULL WHERE id = @id'),
  countUsers: db.prepare('SELECT COUNT(*) as cnt FROM users'),

  // Payments
  upsertPayment: db.prepare(`
    INSERT OR REPLACE INTO payments
      (txId, clientId, description, method, provider, currency, amount, fee, total,
       status, walletAddress, qrCode, exchangeRate, cryptoAmount,
       providerPaymentId, providerStatus, checkoutUrl, nextAction, processorResponse,
       metadata, createdAt, updatedAt)
    VALUES
      (@txId, @clientId, @description, @method, @provider, @currency, @amount, @fee, @total,
       @status, @walletAddress, @qrCode, @exchangeRate, @cryptoAmount,
       @providerPaymentId, @providerStatus, @checkoutUrl, @nextAction, @processorResponse,
       @metadata, @createdAt, @updatedAt)
  `),
  findPaymentByTxId: db.prepare('SELECT * FROM payments WHERE txId = ?'),
  listPayments: db.prepare('SELECT * FROM payments ORDER BY createdAt DESC'),
  listPaymentsByClient: db.prepare('SELECT * FROM payments WHERE clientId = ? ORDER BY createdAt DESC'),
  listPaymentsByStatus: db.prepare('SELECT * FROM payments WHERE status = ? ORDER BY createdAt DESC'),
  countCompletedRevenue: db.prepare(`SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) as cnt FROM payments WHERE status = 'completed'`),

  // Marketplace purchases
  insertPurchase: db.prepare(`
    INSERT INTO marketplace_purchases (clientId, serviceId, serviceName, description, category, price, paymentTxId, paymentMethod, purchasedAt)
    VALUES (@clientId, @serviceId, @serviceName, @description, @category, @price, @paymentTxId, @paymentMethod, @purchasedAt)
  `),
  listPurchasesByClient: db.prepare('SELECT * FROM marketplace_purchases WHERE clientId = ? ORDER BY purchasedAt DESC'),
  clientPurchaseStats: db.prepare('SELECT COUNT(*) as purchases, COALESCE(SUM(price),0) as totalSpent FROM marketplace_purchases WHERE clientId = ?'),

  // API keys
  insertApiKey: db.prepare(`
    INSERT INTO api_keys (keyId, keyHash, name, clientId, planId, active, createdAt)
    VALUES (@keyId, @keyHash, @name, @clientId, @planId, @active, @createdAt)
  `),
  findApiKeyByHash: db.prepare('SELECT * FROM api_keys WHERE keyHash = ? AND active = 1'),
  listApiKeysByClient: db.prepare('SELECT keyId, name, clientId, planId, active, createdAt FROM api_keys WHERE clientId = ?'),

  // API usage (for rate limiting)
  insertUsage: db.prepare('INSERT INTO api_usage (keyId, endpoint, ts) VALUES (?, ?, ?)'),
  countUsageInWindow: db.prepare('SELECT COUNT(*) as cnt FROM api_usage WHERE keyId = ? AND ts > ?'),
  pruneOldUsage: db.prepare('DELETE FROM api_usage WHERE ts < ?'),
};

// ============================================================
// Public API helpers
// ============================================================

const users = {
  create(user) {
    stmts.insertUser.run(user);
  },
  findByEmail(email) {
    return stmts.findUserByEmail.get(email) || null;
  },
  findById(id) {
    return stmts.findUserById.get(id) || null;
  },
  findByVerifyToken(token) {
    return stmts.findUserByVerifyToken.get(token, Date.now()) || null;
  },
  findByResetToken(token) {
    return stmts.findUserByResetToken.get(token, Date.now()) || null;
  },
  updateProfile(id, name, email) {
    stmts.updateUserProfile.run({ id, name, email });
  },
  updatePassword(id, passwordHash) {
    stmts.updatePassword.run({ id, passwordHash });
  },
  setResetToken(id, resetToken, resetExpires) {
    stmts.setResetToken.run({ id, resetToken, resetExpires });
  },
  verifyEmail(id) {
    stmts.verifyEmail.run({ id });
  },
  count() {
    return stmts.countUsers.get().cnt;
  },
};

const payments = {
  save(payment) {
    const row = {
      ...payment,
      nextAction: payment.nextAction ? JSON.stringify(payment.nextAction) : null,
      processorResponse: payment.processorResponse ? JSON.stringify(payment.processorResponse) : null,
      metadata: JSON.stringify(payment.metadata || {}),
    };
    stmts.upsertPayment.run(row);
  },
  findByTxId(txId) {
    const row = stmts.findPaymentByTxId.get(txId);
    return row ? deserializePayment(row) : null;
  },
  list(filters = {}) {
    let rows;
    if (filters.clientId) rows = stmts.listPaymentsByClient.all(filters.clientId);
    else if (filters.status) rows = stmts.listPaymentsByStatus.all(filters.status);
    else rows = stmts.listPayments.all();
    const result = rows.map(deserializePayment);
    if (filters.method) return result.filter(p => p.method === filters.method);
    return result;
  },
  revenueStats() {
    return stmts.countCompletedRevenue.get();
  },
};

function deserializePayment(row) {
  return {
    ...row,
    nextAction: row.nextAction ? JSON.parse(row.nextAction) : null,
    processorResponse: row.processorResponse ? JSON.parse(row.processorResponse) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

const purchases = {
  record(purchase) {
    stmts.insertPurchase.run(purchase);
  },
  listByClient(clientId) {
    return stmts.listPurchasesByClient.all(clientId);
  },
  statsForClient(clientId) {
    return stmts.clientPurchaseStats.get(clientId);
  },
};

const PLAN_LIMITS = {
  free:       { calls: 100,    windowMs: 60_000 },   // 100/min
  starter:    { calls: 500,    windowMs: 60_000 },   // 500/min
  pro:        { calls: 2000,   windowMs: 60_000 },   // 2000/min
  enterprise: { calls: 10000,  windowMs: 60_000 },   // 10k/min
};

const crypto = require('crypto');

const apiKeys = {
  create({ name, clientId, planId = 'starter' }) {
    const raw = 'api_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    const keyId = crypto.randomBytes(8).toString('hex');
    stmts.insertApiKey.run({
      keyId,
      keyHash,
      name: name || '',
      clientId,
      planId,
      active: 1,
      createdAt: new Date().toISOString(),
    });
    return { keyId, key: raw, name, clientId, planId };
  },
  verify(rawKey) {
    if (!rawKey) return null;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return stmts.findApiKeyByHash.get(keyHash) || null;
  },
  listForClient(clientId) {
    return stmts.listApiKeysByClient.all(clientId);
  },
  checkRateLimit(keyId, planId, endpoint) {
    const limit = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
    const windowStart = Date.now() - limit.windowMs;
    const { cnt } = stmts.countUsageInWindow.get(keyId, windowStart);
    if (cnt >= limit.calls) return false;
    stmts.insertUsage.run(keyId, endpoint, Date.now());
    return true;
  },
  pruneUsage() {
    const cutoff = Date.now() - 3_600_000; // keep 1 hour
    stmts.pruneOldUsage.run(cutoff);
  },
};

// Prune old usage rows hourly
setInterval(() => apiKeys.pruneUsage(), 3_600_000).unref();

module.exports = { db, users, payments, purchases, apiKeys };
