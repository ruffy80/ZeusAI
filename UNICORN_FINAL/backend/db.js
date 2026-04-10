// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:05:42.460Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:21:47.828Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:18:03.097Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:58.868Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:24.728Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.243Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:40.779Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.045Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:02.798Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:46.889Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:00.757Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.393Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.559Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SQLite persistence layer
 * Replaces all in-memory arrays/Maps so data survives server restarts.
 * Tables: users, payments, marketplace_purchases, api_keys, api_usage
 *
 * Falls back to in-memory store if better-sqlite3 is unavailable
 * (e.g. Vercel Lambda, CI environments without native module support).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'unicorn.db');

// ============================================================
// Try to initialise SQLite; fall back to in-memory store
// ============================================================

let db = null;
let usingSqlite = false;

try {
  const Database = require('better-sqlite3');

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token       TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      createdAt   TEXT NOT NULL,
      expiresAt   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_admin_sessions_exp ON admin_sessions(expiresAt);
  `);

  // Migrate: add planId column if not present (idempotent)
  try {
    db.exec("ALTER TABLE users ADD COLUMN planId TEXT NOT NULL DEFAULT 'free'");
  } catch (err) {
    // Ignore "duplicate column name" – any other error is unexpected
    if (err.message && !err.message.includes('duplicate column name')) {
      console.error('[DB] Migration error (planId):', err.message);
    }
  }

  usingSqlite = true;
  console.log('✅ SQLite database connected:', DB_PATH);
} catch (err) {
  console.warn('⚠️  SQLite unavailable – using in-memory store (data will not persist across restarts):', err.message);
  db = null;
}

// ============================================================
// In-memory store (used when SQLite is unavailable)
// ============================================================

let mem = {
  users: new Map(),
  payments: new Map(),
  purchases: [],
  apiKeys: new Map(),
  apiKeysByHash: new Map(),
  usage: [],
};

// ============================================================
// Prepared statements (SQLite path only)
// ============================================================

let stmts = null;
if (usingSqlite) {
  stmts = {
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
    listUsers: db.prepare(`
      SELECT id, name, email, emailVerified, planId, createdAt
      FROM users
      WHERE (@search IS NULL OR name LIKE @search OR email LIKE @search)
      ORDER BY createdAt DESC
      LIMIT @limit OFFSET @offset
    `),
    countUsersFiltered: db.prepare(`
      SELECT COUNT(*) as cnt FROM users
      WHERE (@search IS NULL OR name LIKE @search OR email LIKE @search)
    `),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

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

    insertPurchase: db.prepare(`
      INSERT INTO marketplace_purchases (clientId, serviceId, serviceName, description, category, price, paymentTxId, paymentMethod, purchasedAt)
      VALUES (@clientId, @serviceId, @serviceName, @description, @category, @price, @paymentTxId, @paymentMethod, @purchasedAt)
    `),
    listPurchasesByClient: db.prepare('SELECT * FROM marketplace_purchases WHERE clientId = ? ORDER BY purchasedAt DESC'),
    clientPurchaseStats: db.prepare('SELECT COUNT(*) as purchases, COALESCE(SUM(price),0) as totalSpent FROM marketplace_purchases WHERE clientId = ?'),

    insertApiKey: db.prepare(`
      INSERT INTO api_keys (keyId, keyHash, name, clientId, planId, active, createdAt)
      VALUES (@keyId, @keyHash, @name, @clientId, @planId, @active, @createdAt)
    `),
    findApiKeyByHash: db.prepare('SELECT * FROM api_keys WHERE keyHash = ? AND active = 1'),
    listApiKeysByClient: db.prepare('SELECT keyId, name, clientId, planId, active, createdAt FROM api_keys WHERE clientId = ?'),

    insertUsage: db.prepare('INSERT INTO api_usage (keyId, endpoint, ts) VALUES (?, ?, ?)'),
    countUsageInWindow: db.prepare('SELECT COUNT(*) as cnt FROM api_usage WHERE keyId = ? AND ts > ?'),
    pruneOldUsage: db.prepare('DELETE FROM api_usage WHERE ts < ?'),

    updateUserPlanId: db.prepare("UPDATE users SET planId = @planId WHERE id = @id"),

    insertAdminSession: db.prepare('INSERT OR REPLACE INTO admin_sessions (token, email, createdAt, expiresAt) VALUES (@token, @email, @createdAt, @expiresAt)'),
    hasAdminSession: db.prepare('SELECT 1 FROM admin_sessions WHERE token = ? AND expiresAt > ?'),
    deleteAdminSession: db.prepare('DELETE FROM admin_sessions WHERE token = ?'),
    countAdminSessions: db.prepare('SELECT COUNT(*) as cnt FROM admin_sessions WHERE expiresAt > ?'),
    pruneAdminSessions: db.prepare('DELETE FROM admin_sessions WHERE expiresAt <= ?'),
  };
}

// ============================================================
// Public API helpers
// ============================================================

const users = usingSqlite ? {
  create(user) { stmts.insertUser.run(user); },
  findByEmail(email) { return stmts.findUserByEmail.get(email) || null; },
  findById(id) { return stmts.findUserById.get(id) || null; },
  findByVerifyToken(token) { return stmts.findUserByVerifyToken.get(token, Date.now()) || null; },
  findByResetToken(token) { return stmts.findUserByResetToken.get(token, Date.now()) || null; },
  updateProfile(id, name, email) { stmts.updateUserProfile.run({ id, name, email }); },
  updatePassword(id, passwordHash) { stmts.updatePassword.run({ id, passwordHash }); },
  setResetToken(id, resetToken, resetExpires) { stmts.setResetToken.run({ id, resetToken, resetExpires }); },
  verifyEmail(id) { stmts.verifyEmail.run({ id }); },
  count() { return stmts.countUsers.get().cnt; },
  setPlanId(id, planId) { stmts.updateUserPlanId.run({ id, planId }); },
  listAll({ page = 1, limit = 20, search = null } = {}) {
    const offset = (Math.max(1, page) - 1) * limit;
    // Escape SQLite LIKE wildcards (%, _) in user-supplied search to prevent unexpected matches
    const searchParam = search ? `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%` : null;
    const rows = stmts.listUsers.all({ search: searchParam, limit, offset });
    const total = stmts.countUsersFiltered.get({ search: searchParam }).cnt;
    return { users: rows, total, page, limit, pages: Math.ceil(total / limit) };
  },
  deleteById(id) { return stmts.deleteUser.run(id).changes > 0; },
} : {
  // In-memory fallback
  create(user) { mem.users.set(user.id, { ...user }); },
  findByEmail(email) { for (const u of mem.users.values()) if (u.email === email) return u; return null; },
  findById(id) { return mem.users.get(id) || null; },
  findByVerifyToken(token) { const now = Date.now(); for (const u of mem.users.values()) if (u.verifyToken === token && u.verifyExpires > now) return u; return null; },
  findByResetToken(token) { const now = Date.now(); for (const u of mem.users.values()) if (u.resetToken === token && u.resetExpires > now) return u; return null; },
  updateProfile(id, name, email) { const u = mem.users.get(id); if (u) { u.name = name; u.email = email; } },
  updatePassword(id, passwordHash) { const u = mem.users.get(id); if (u) { u.passwordHash = passwordHash; u.resetToken = null; u.resetExpires = null; } },
  setResetToken(id, resetToken, resetExpires) { const u = mem.users.get(id); if (u) { u.resetToken = resetToken; u.resetExpires = resetExpires; } },
  verifyEmail(id) { const u = mem.users.get(id); if (u) { u.emailVerified = 1; u.verifyToken = null; u.verifyExpires = null; } },
  count() { return mem.users.size; },
  setPlanId(id, planId) { const u = mem.users.get(id); if (u) { u.planId = planId; } },
  listAll({ page = 1, limit = 20, search = null } = {}) {
    const all = Array.from(mem.users.values()).map(u => ({
      id: u.id, name: u.name, email: u.email,
      emailVerified: u.emailVerified, planId: u.planId || 'free', createdAt: u.createdAt,
    }));
    const filtered = search
      ? all.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
      : all;
    filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const offset = (Math.max(1, page) - 1) * limit;
    return { users: filtered.slice(offset, offset + limit), total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) };
  },
  deleteById(id) { return mem.users.delete(id); },
};

function deserializePayment(row) {
  return {
    ...row,
    nextAction: row.nextAction ? JSON.parse(row.nextAction) : null,
    processorResponse: row.processorResponse ? JSON.parse(row.processorResponse) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

const payments = usingSqlite ? {
  save(payment) {
    const row = {
      ...payment,
      nextAction: payment.nextAction ? JSON.stringify(payment.nextAction) : null,
      processorResponse: payment.processorResponse ? JSON.stringify(payment.processorResponse) : null,
      metadata: JSON.stringify(payment.metadata || {}),
    };
    stmts.upsertPayment.run(row);
  },
  findByTxId(txId) { const row = stmts.findPaymentByTxId.get(txId); return row ? deserializePayment(row) : null; },
  list(filters = {}) {
    let rows;
    if (filters.clientId) rows = stmts.listPaymentsByClient.all(filters.clientId);
    else if (filters.status) rows = stmts.listPaymentsByStatus.all(filters.status);
    else rows = stmts.listPayments.all();
    const result = rows.map(deserializePayment);
    if (filters.method) return result.filter(p => p.method === filters.method);
    return result;
  },
  revenueStats() { return stmts.countCompletedRevenue.get(); },
} : {
  save(payment) { mem.payments.set(payment.txId, { ...payment }); },
  findByTxId(txId) { return mem.payments.get(txId) || null; },
  list(filters = {}) {
    let result = Array.from(mem.payments.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters.clientId) result = result.filter(p => p.clientId === filters.clientId);
    if (filters.status) result = result.filter(p => p.status === filters.status);
    if (filters.method) result = result.filter(p => p.method === filters.method);
    return result;
  },
  revenueStats() {
    const completed = Array.from(mem.payments.values()).filter(p => p.status === 'completed');
    return { revenue: completed.reduce((s, p) => s + (p.total || 0), 0), cnt: completed.length };
  },
};

const purchases = usingSqlite ? {
  record(purchase) { stmts.insertPurchase.run(purchase); },
  listByClient(clientId) { return stmts.listPurchasesByClient.all(clientId); },
  statsForClient(clientId) { return stmts.clientPurchaseStats.get(clientId); },
} : {
  record(purchase) { mem.purchases.push({ ...purchase, id: mem.purchases.length + 1 }); },
  listByClient(clientId) { return mem.purchases.filter(p => p.clientId === clientId).sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)); },
  statsForClient(clientId) {
    const list = mem.purchases.filter(p => p.clientId === clientId);
    return { purchases: list.length, totalSpent: list.reduce((s, p) => s + (p.price || 0), 0) };
  },
};

const PLAN_LIMITS = {
  free:       { calls: 100,    windowMs: 60_000 },
  starter:    { calls: 500,    windowMs: 60_000 },
  pro:        { calls: 2000,   windowMs: 60_000 },
  enterprise: { calls: 10000,  windowMs: 60_000 },
};

const apiKeys = usingSqlite ? {
  create({ name, clientId, planId = 'starter' }) {
    const raw = 'api_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    const keyId = crypto.randomBytes(8).toString('hex');
    stmts.insertApiKey.run({ keyId, keyHash, name: name || '', clientId, planId, active: 1, createdAt: new Date().toISOString() });
    return { keyId, key: raw, name, clientId, planId };
  },
  verify(rawKey) {
    if (!rawKey) return null;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return stmts.findApiKeyByHash.get(keyHash) || null;
  },
  listForClient(clientId) { return stmts.listApiKeysByClient.all(clientId); },
  checkRateLimit(keyId, planId, endpoint) {
    const limit = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
    const windowStart = Date.now() - limit.windowMs;
    const { cnt } = stmts.countUsageInWindow.get(keyId, windowStart);
    if (cnt >= limit.calls) return false;
    stmts.insertUsage.run(keyId, endpoint, Date.now());
    return true;
  },
  pruneUsage() { stmts.pruneOldUsage.run(Date.now() - 3_600_000); },
} : {
  create({ name, clientId, planId = 'starter' }) {
    const raw = 'api_live_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    const keyId = crypto.randomBytes(8).toString('hex');
    const entry = { keyId, keyHash, name: name || '', clientId, planId, active: 1, createdAt: new Date().toISOString() };
    mem.apiKeys.set(keyId, entry);
    mem.apiKeysByHash.set(keyHash, entry);
    return { keyId, key: raw, name, clientId, planId };
  },
  verify(rawKey) {
    if (!rawKey) return null;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return mem.apiKeysByHash.get(keyHash) || null;
  },
  listForClient(clientId) { return Array.from(mem.apiKeys.values()).filter(k => k.clientId === clientId).map(({ keyHash: _, ...k }) => k); },
  checkRateLimit(keyId, planId, endpoint) {
    const limit = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
    const windowStart = Date.now() - limit.windowMs;
    const cnt = mem.usage.filter(u => u.keyId === keyId && u.ts > windowStart).length;
    if (cnt >= limit.calls) return false;
    mem.usage.push({ keyId, endpoint, ts: Date.now() });
    return true;
  },
  pruneUsage() {
    const cutoff = Date.now() - 3_600_000;
    const before = mem.usage.length;
    mem.usage = mem.usage.filter(u => u.ts >= cutoff);
    return before - mem.usage.length;
  },
};

// Prune old usage rows hourly
setInterval(() => apiKeys.pruneUsage(), 3_600_000).unref();

// ============================================================
// Admin Sessions (SQLite-backed, survives restarts)
// ============================================================

const adminSessions = usingSqlite ? {
  add(token, email, expiresAt) {
    stmts.insertAdminSession.run({ token, email, createdAt: new Date().toISOString(), expiresAt });
  },
  has(token) {
    return Boolean(stmts.hasAdminSession.get(token, Date.now()));
  },
  delete(token) {
    stmts.deleteAdminSession.run(token);
  },
  get size() {
    return stmts.countAdminSessions.get(Date.now()).cnt;
  },
  prune() {
    stmts.pruneAdminSessions.run(Date.now());
  },
} : (() => {
  const _map = new Map(); // token -> expiresAt
  return {
    add(token, _email, expiresAt) { _map.set(token, expiresAt); },
    has(token) { const exp = _map.get(token); if (!exp || exp <= Date.now()) { _map.delete(token); return false; } return true; },
    delete(token) { _map.delete(token); },
    get size() { const now = Date.now(); let cnt = 0; for (const exp of _map.values()) if (exp > now) cnt++; return cnt; },
    prune() { const now = Date.now(); for (const [t, exp] of _map) if (exp <= now) _map.delete(t); },
  };
})();

// Prune expired admin sessions hourly
setInterval(() => adminSessions.prune(), 3_600_000).unref();

module.exports = { db, users, payments, purchases, apiKeys, adminSessions };
