// commerce/customer-portal.js — SQLite WAL backed (auto-migrates from legacy portal.json)
//
// Drop-in replacement preserving the original public API (RO+EN comments).
// Pe scurt: persistă utilizatori și comenzi în SQLite WAL pentru cluster-safe
// concurrent access; dacă better-sqlite3 nu se încarcă, revine automat la
// stocarea JSON legacy. Migrarea din portal.json se face o singură dată,
// la primul boot cu SQLite activ. Fișierul JSON rămâne ca backup.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let bcrypt;
try { bcrypt = require('bcryptjs'); } catch (_) { bcrypt = null; }

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const STORE_FILE = path.join(DATA_DIR, 'portal.json');
const SQLITE_FILE = path.join(DATA_DIR, 'portal.sqlite');
const SECRET_FILE = path.join(DATA_DIR, 'portal.secret');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

function loadOrCreateSecret() {
  ensureDir();
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const s = String(fs.readFileSync(SECRET_FILE, 'utf8') || '').trim();
      if (s.length >= 32) return s;
    }
  } catch (_) {}
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(SECRET_FILE, s + '\n', { mode: 0o600 }); } catch (_) {}
  return s;
}

// ── SQLite backend (preferred) ───────────────────────────────────────────
let db = null;
let usingSqlite = false;
try {
  const Database = require('better-sqlite3');
  ensureDir();
  db = new Database(SQLITE_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL,
      bridged INTEGER DEFAULT 0,
      totp_secret TEXT,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      product_id TEXT,
      price_usd REAL DEFAULT 0,
      btc_amount REAL DEFAULT 0,
      btc_address TEXT,
      invoice_uri TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      delivered_at TEXT,
      data TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE TABLE IF NOT EXISTS api_keys (
      key TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_id TEXT,
      order_id TEXT,
      issued_at TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_customer ON api_keys(customer_id);
    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ip TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pwreset_email ON password_resets(email);
    CREATE INDEX IF NOT EXISTS idx_pwreset_expires ON password_resets(expires_at);
  `);
  usingSqlite = true;
  console.log('[portal] SQLite WAL backend active at ' + SQLITE_FILE);

  // One-time migration from legacy portal.json
  const migrated = db.prepare("SELECT COUNT(*) AS n FROM customers").get();
  if (!migrated || migrated.n === 0) {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        const insertC = db.prepare(`INSERT OR IGNORE INTO customers (id,email,name,password_hash,created_at,bridged,data) VALUES (?,?,?,?,?,?,?)`);
        const insertK = db.prepare(`INSERT OR IGNORE INTO api_keys (key,customer_id,product_id,order_id,issued_at,active) VALUES (?,?,?,?,?,?)`);
        const insertO = db.prepare(`INSERT OR IGNORE INTO orders (id,customer_id,product_id,price_usd,btc_amount,btc_address,invoice_uri,status,created_at,paid_at,delivered_at,data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        const tx = db.transaction(() => {
          for (const c of (raw.customers || [])) {
            insertC.run(c.id, c.email, c.name || '', c.passwordHash || null, c.createdAt || new Date().toISOString(), c.bridged ? 1 : 0, JSON.stringify(c));
            for (const k of (c.apiKeys || [])) {
              insertK.run(k.key, c.id, k.productId || null, k.orderId || null, k.issuedAt || new Date().toISOString(), k.active === false ? 0 : 1);
            }
          }
          for (const o of (raw.orders || [])) {
            insertO.run(o.id, o.customerId || null, o.productId || null, Number(o.priceUSD || 0), Number(o.btcAmount || 0), o.btcAddress || null, o.invoiceUri || null, o.status || 'awaiting_payment', o.createdAt || new Date().toISOString(), o.paidAt || null, o.deliveredAt || null, JSON.stringify(o));
          }
        });
        tx();
        const stats = db.prepare("SELECT (SELECT COUNT(*) FROM customers) AS c, (SELECT COUNT(*) FROM orders) AS o").get();
        console.log(`[portal] migrated ${stats.c} customers + ${stats.o} orders from portal.json → SQLite`);
      }
    } catch (e) {
      console.warn('[portal] JSON→SQLite migration failed:', e.message);
    }
  }
} catch (e) {
  console.warn('[portal] SQLite unavailable, falling back to JSON storage:', e.message);
  db = null;
  usingSqlite = false;
}

// ── Legacy JSON fallback storage ─────────────────────────────────────────
function loadJson() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { customers: [], orders: [] };
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      customers: Array.isArray(raw.customers) ? raw.customers : [],
      orders: Array.isArray(raw.orders) ? raw.orders : []
    };
  } catch (e) { console.warn('[portal] load failed:', e.message); return { customers: [], orders: [] }; }
}
function saveJson(state) {
  ensureDir();
  try {
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STORE_FILE);
  } catch (e) { console.warn('[portal] save failed:', e.message); }
}
const jsonState = usingSqlite ? null : loadJson();

// ── JWT (HMAC) with optional rotation: JWT_SECRET + JWT_SECRET_PREVIOUS ──
function tokenSecretPrimary() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!global.__PORTAL_STABLE_SECRET__) global.__PORTAL_STABLE_SECRET__ = loadOrCreateSecret();
  return global.__PORTAL_STABLE_SECRET__;
}
function tokenSecretsAll() {
  // Primary first; previous accepted for verify only (graceful rotation).
  const list = [tokenSecretPrimary()];
  if (process.env.JWT_SECRET_PREVIOUS && process.env.JWT_SECRET_PREVIOUS !== process.env.JWT_SECRET) {
    list.push(process.env.JWT_SECRET_PREVIOUS);
  }
  return list;
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function fromB64url(s) { return Buffer.from(String(s||'').replace(/-/g,'+').replace(/_/g,'/'), 'base64'); }
function signToken(payload) {
  const head = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', tokenSecretPrimary()).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}
function verifyToken(token) {
  try {
    const [h, b, s] = String(token||'').split('.');
    if (!h || !b || !s) return null;
    const candidate = Buffer.from(s);
    let matched = false;
    for (const secret of tokenSecretsAll()) {
      const expected = Buffer.from(b64url(crypto.createHmac('sha256', secret).update(h + '.' + b).digest()));
      if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) { matched = true; break; }
    }
    if (!matched) return null;
    const payload = JSON.parse(fromB64url(b).toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.cid || null;
  } catch (_) { return null; }
}

// ── Password hashing ─────────────────────────────────────────────────────
function hashPassword(plain) {
  if (bcrypt) return bcrypt.hashSync(String(plain), 10);
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(plain), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (typeof stored === 'string' && stored.startsWith('scrypt$')) {
    const [, saltHex, keyHex] = stored.split('$');
    try {
      const salt = Buffer.from(saltHex, 'hex');
      const key = crypto.scryptSync(String(plain), salt, 64);
      return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
    } catch (_) { return false; }
  }
  if (bcrypt) { try { return bcrypt.compareSync(String(plain), stored); } catch (_) { return false; } }
  return false;
}

// ── Row → public shape helpers ───────────────────────────────────────────
function customerRowToFull(row) {
  if (!row) return null;
  let extra = {};
  try { extra = row.data ? JSON.parse(row.data) : {}; } catch (_) {}
  const apiKeys = usingSqlite ? db.prepare(`SELECT key,product_id AS productId,order_id AS orderId,issued_at AS issuedAt,active FROM api_keys WHERE customer_id=? AND active=1`).all(row.id) : (extra.apiKeys || []);
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    bridged: !!row.bridged,
    totpSecret: row.totp_secret || extra.totpSecret || null,
    apiKeys: apiKeys.map(k => ({ ...k, active: k.active !== 0 && k.active !== false }))
  };
}
function orderRowToFull(row) {
  if (!row) return null;
  let extra = {};
  try { extra = row.data ? JSON.parse(row.data) : {}; } catch (_) {}
  return {
    id: row.id,
    customerId: row.customer_id,
    productId: row.product_id,
    inputs: extra.inputs || {},
    priceUSD: row.price_usd,
    btcAmount: row.btc_amount,
    btcAddress: row.btc_address,
    invoiceUri: row.invoice_uri,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    deliveredAt: row.delivered_at,
    deliverables: extra.deliverables || [],
    summary: extra.summary || null,
    error: extra.error || null,
    ...extra
  };
}

function publicCustomer(c) {
  if (!c) return null;
  return {
    id: c.id,
    email: c.email,
    name: c.name || '',
    createdAt: c.createdAt,
    apiKeys: (c.apiKeys || []).map(k => ({
      productId: k.productId, orderId: k.orderId, issuedAt: k.issuedAt,
      keyPreview: (k.key || '').slice(0,16) + '…', active: k.active !== false
    }))
  };
}

// ── byEmail / getById ────────────────────────────────────────────────────
function byEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (usingSqlite) {
    const row = db.prepare(`SELECT * FROM customers WHERE LOWER(email)=?`).get(e);
    return customerRowToFull(row);
  }
  return jsonState.customers.find(c => String(c.email||'').toLowerCase() === e) || null;
}
function getById(id) {
  if (!id) return null;
  if (usingSqlite) {
    const row = db.prepare(`SELECT * FROM customers WHERE id=?`).get(id);
    return customerRowToFull(row);
  }
  return jsonState.customers.find(c => c.id === id) || null;
}

function makeAuthResult(customer) {
  const token = signToken({ cid: customer.id, iat: Date.now(), exp: Date.now() + 30*24*3600*1000 });
  return { ok: true, customer: publicCustomer(customer), token };
}

// ── Signup / Login ───────────────────────────────────────────────────────
function signup(email, password, name) {
  const e = String(email || '').trim().toLowerCase();
  const pw = String(password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { const err = new Error('invalid_email'); err.code='invalid_email'; throw err; }
  if (pw.length < 8) { const err = new Error('password_too_short'); err.code='password_too_short'; throw err; }
  if (byEmail(e)) { const err = new Error('email_taken'); err.code='email_taken'; throw err; }
  const customer = {
    id: 'cust_' + crypto.randomBytes(8).toString('hex'),
    email: e,
    name: String(name || '').slice(0, 80),
    passwordHash: hashPassword(pw),
    createdAt: new Date().toISOString(),
    apiKeys: []
  };
  if (usingSqlite) {
    db.prepare(`INSERT INTO customers (id,email,name,password_hash,created_at,bridged) VALUES (?,?,?,?,?,0)`).run(customer.id, customer.email, customer.name, customer.passwordHash, customer.createdAt);
  } else {
    jsonState.customers.push(customer);
    saveJson(jsonState);
  }
  return makeAuthResult(customer);
}

function login(email, password) {
  const c = byEmail(email);
  if (!c) { const err = new Error('email_not_found'); err.code='email_not_found'; throw err; }
  if (!verifyPassword(password, c.passwordHash)) { const err = new Error('wrong_password'); err.code='wrong_password'; throw err; }
  return makeAuthResult(c);
}

function upsertFromBackend({ email, name, password }) {
  const e = String(email||'').trim().toLowerCase();
  if (!e) { const err = new Error('invalid_email'); err.code='invalid_email'; throw err; }
  let c = byEmail(e);
  if (!c) {
    c = {
      id: 'cust_' + crypto.randomBytes(8).toString('hex'),
      email: e,
      name: String(name || '').slice(0, 80),
      passwordHash: password ? hashPassword(password) : null,
      createdAt: new Date().toISOString(),
      apiKeys: [],
      bridged: true
    };
    if (usingSqlite) {
      db.prepare(`INSERT INTO customers (id,email,name,password_hash,created_at,bridged) VALUES (?,?,?,?,?,1)`).run(c.id, c.email, c.name, c.passwordHash, c.createdAt);
    } else {
      jsonState.customers.push(c);
      saveJson(jsonState);
    }
  } else if (password) {
    if (usingSqlite) {
      db.prepare(`UPDATE customers SET password_hash=?, bridged=1, name=COALESCE(NULLIF(name,''),?) WHERE id=?`).run(hashPassword(password), name ? String(name).slice(0,80) : c.name, c.id);
      c = byEmail(e);
    } else {
      c.passwordHash = hashPassword(password);
      c.bridged = true;
      if (name && !c.name) c.name = String(name).slice(0,80);
      saveJson(jsonState);
    }
  }
  return makeAuthResult(c);
}

// ── Orders ───────────────────────────────────────────────────────────────
function createOrder(fields) {
  const now = new Date().toISOString();
  const order = {
    id: 'ord_' + crypto.randomBytes(8).toString('hex'),
    customerId: fields.customerId || null,
    productId: fields.productId,
    inputs: fields.inputs || {},
    priceUSD: Number(fields.priceUSD || 0),
    btcAmount: Number(fields.btcAmount || 0),
    btcAddress: fields.btcAddress || null,
    invoiceUri: fields.invoiceUri || null,
    status: fields.status || 'awaiting_payment',
    createdAt: now,
    paidAt: null,
    deliveredAt: null,
    deliverables: [],
    summary: null,
    error: null
  };
  if (usingSqlite) {
    const extra = { inputs: order.inputs, deliverables: order.deliverables };
    db.prepare(`INSERT INTO orders (id,customer_id,product_id,price_usd,btc_amount,btc_address,invoice_uri,status,created_at,data) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(order.id, order.customerId, order.productId, order.priceUSD, order.btcAmount, order.btcAddress, order.invoiceUri, order.status, order.createdAt, JSON.stringify(extra));
  } else {
    jsonState.orders.push(order);
    saveJson(jsonState);
  }
  return order;
}
function getOrder(id) {
  if (!id) return null;
  if (usingSqlite) {
    const row = db.prepare(`SELECT * FROM orders WHERE id=?`).get(id);
    return orderRowToFull(row);
  }
  return jsonState.orders.find(o => o.id === id) || null;
}
function updateOrder(id, patch) {
  if (!id || !patch) return getOrder(id);
  if (usingSqlite) {
    const row = db.prepare(`SELECT * FROM orders WHERE id=?`).get(id);
    if (!row) return null;
    const current = orderRowToFull(row);
    const merged = { ...current, ...patch };
    let extra = {};
    try { extra = row.data ? JSON.parse(row.data) : {}; } catch (_) {}
    Object.assign(extra, patch);
    db.prepare(`UPDATE orders SET status=?, paid_at=?, delivered_at=?, btc_amount=?, btc_address=?, invoice_uri=?, price_usd=?, data=? WHERE id=?`).run(
      merged.status, merged.paidAt || null, merged.deliveredAt || null,
      Number(merged.btcAmount || 0), merged.btcAddress || null, merged.invoiceUri || null,
      Number(merged.priceUSD || 0), JSON.stringify(extra), id
    );
    return orderRowToFull(db.prepare(`SELECT * FROM orders WHERE id=?`).get(id));
  }
  const o = jsonState.orders.find(x => x.id === id);
  if (!o) return null;
  Object.assign(o, patch);
  saveJson(jsonState);
  return o;
}
function listOrdersByCustomer(cid) {
  if (!cid) return [];
  if (usingSqlite) {
    const rows = db.prepare(`SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC`).all(cid);
    return rows.map(orderRowToFull);
  }
  return jsonState.orders.filter(o => o.customerId === cid).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
}

// ── API keys ─────────────────────────────────────────────────────────────
function issueApiKey(customerId, productId, orderId) {
  const c = getById(customerId);
  if (!c) return null;
  const key = 'unc_' + crypto.randomBytes(24).toString('hex');
  const entry = { key, productId: productId || null, orderId: orderId || null, issuedAt: new Date().toISOString(), active: true };
  if (usingSqlite) {
    db.prepare(`INSERT INTO api_keys (key,customer_id,product_id,order_id,issued_at,active) VALUES (?,?,?,?,?,1)`).run(entry.key, customerId, entry.productId, entry.orderId, entry.issuedAt);
  } else {
    c.apiKeys = c.apiKeys || [];
    c.apiKeys.push(entry);
    saveJson(jsonState);
  }
  return entry;
}
function findByApiKey(key) {
  if (!key) return null;
  if (usingSqlite) {
    const row = db.prepare(`SELECT k.*, c.* FROM api_keys k JOIN customers c ON c.id=k.customer_id WHERE k.key=? AND k.active=1`).get(key);
    if (!row) return null;
    return { customer: customerRowToFull({ id: row.customer_id, email: row.email, name: row.name, password_hash: row.password_hash, created_at: row.created_at, bridged: row.bridged, totp_secret: row.totp_secret, data: row.data }), key: { key: row.key, productId: row.product_id, orderId: row.order_id, issuedAt: row.issued_at, active: !!row.active } };
  }
  for (const c of jsonState.customers) {
    for (const k of (c.apiKeys || [])) {
      if (k.key === key && k.active !== false) return { customer: c, key: k };
    }
  }
  return null;
}

// ── GDPR helpers (export + delete) ───────────────────────────────────────
function exportCustomer(id) {
  const c = getById(id);
  if (!c) return null;
  return {
    customer: publicCustomer(c),
    raw: { id: c.id, email: c.email, name: c.name, createdAt: c.createdAt },
    orders: listOrdersByCustomer(id),
    apiKeys: (c.apiKeys || []).map(k => ({ key: k.key, productId: k.productId, orderId: k.orderId, issuedAt: k.issuedAt, active: k.active }))
  };
}
function deleteCustomer(id) {
  if (!id) return { ok: false, reason: 'missing_id' };
  if (usingSqlite) {
    const info = db.prepare(`DELETE FROM customers WHERE id=?`).run(id);
    return { ok: info.changes > 0, deleted: info.changes };
  }
  const idx = jsonState.customers.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  jsonState.customers.splice(idx, 1);
  // Also wipe orders attached to this customer (tombstone customer_id reference)
  const remaining = jsonState.orders.filter(o => o.customerId !== id);
  jsonState.orders.length = 0;
  jsonState.orders.push(...remaining);
  saveJson(jsonState);
  return { ok: true };
}

// ── TOTP MFA fallback (RFC 6238) ─────────────────────────────────────────
function base32Encode(buf) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(s || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function generateTotpSecret(customerId) {
  const secretBuf = crypto.randomBytes(20);
  const secretBase32 = base32Encode(secretBuf);
  if (usingSqlite) {
    db.prepare(`UPDATE customers SET totp_secret=? WHERE id=?`).run(secretBase32, customerId);
  } else {
    const c = jsonState.customers.find(x => x.id === customerId);
    if (c) { c.totpSecret = secretBase32; saveJson(jsonState); }
  }
  return secretBase32;
}
function totpCodeFor(secretBase32, time = Date.now()) {
  const counter = Math.floor(time / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secretBase32);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset+1] & 0xff) << 16) | ((hmac[offset+2] & 0xff) << 8) | (hmac[offset+3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}
function verifyTotp(customerId, code) {
  const c = getById(customerId);
  if (!c || !c.totpSecret) return false;
  const codeStr = String(code || '').replace(/\D/g, '');
  if (codeStr.length !== 6) return false;
  const now = Date.now();
  // ±1 window for clock skew
  for (const drift of [-1, 0, 1]) {
    if (totpCodeFor(c.totpSecret, now + drift * 30000) === codeStr) return true;
  }
  return false;
}

// ── Maintenance helpers (tests + ops) ────────────────────────────────────
function _resetForTests() {
  if (usingSqlite) {
    db.exec(`DELETE FROM api_keys; DELETE FROM orders; DELETE FROM customers;`);
  } else {
    jsonState.customers.length = 0;
    jsonState.orders.length = 0;
    saveJson(jsonState);
  }
}

function _stats() {
  if (usingSqlite) {
    const r = db.prepare("SELECT (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM orders) AS orders").get();
    return { customers: r.customers, orders: r.orders, backend: 'sqlite' };
  }
  return { customers: jsonState.customers.length, orders: jsonState.orders.length, backend: 'json' };
}

// ── Cluster-wide order scan (used by checkout-recovery + customer-success) ──
function _listOrders(filter) {
  filter = filter || {};
  const limit = Math.max(1, Math.min(5000, Number(filter.limit) || 2000));
  if (usingSqlite) {
    const where = []; const args = [];
    if (filter.status) { where.push('status=?'); args.push(filter.status); }
    if (filter.customerId) { where.push('customer_id=?'); args.push(filter.customerId); }
    const sql = `SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`;
    args.push(limit);
    return db.prepare(sql).all(...args).map(orderRowToFull);
  }
  let rows = jsonState.orders.slice();
  if (filter.status) rows = rows.filter((o) => o.status === filter.status);
  if (filter.customerId) rows = rows.filter((o) => o.customerId === filter.customerId);
  rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return rows.slice(0, limit);
}

// ── Password reset (single-use tokens, 1h TTL) ──────────────────────────
// Persistent in SQLite (or in-memory map for JSON fallback).
const PWRESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const _pwResetMem = new Map(); // fallback storage when SQLite unavailable

function createPasswordResetToken(email, opts) {
  const e = String(email || '').trim().toLowerCase();
  const c = byEmail(e);
  if (!c) return null; // caller should still respond 200 to avoid email enumeration
  const token = crypto.randomBytes(32).toString('hex'); // 256-bit
  const expiresAt = Date.now() + PWRESET_TTL_MS;
  const createdAt = new Date().toISOString();
  const ip = (opts && opts.ip) || null;
  if (usingSqlite) {
    db.prepare(`INSERT INTO password_resets (token,customer_id,email,expires_at,used,created_at,ip) VALUES (?,?,?,?,0,?,?)`)
      .run(token, c.id, e, expiresAt, createdAt, ip);
    // Opportunistic GC: delete expired/used tokens older than 7d.
    try { db.prepare(`DELETE FROM password_resets WHERE expires_at < ? AND created_at < ?`).run(Date.now() - 7*24*3600*1000, new Date(Date.now() - 7*24*3600*1000).toISOString()); } catch(_) {}
  } else {
    _pwResetMem.set(token, { customerId: c.id, email: e, expiresAt, used: false, createdAt, ip });
  }
  return { token, expiresAt, customerId: c.id, email: e };
}

function verifyPasswordResetToken(token) {
  const t = String(token || '').trim();
  if (!t || t.length < 32) return null;
  let row = null;
  if (usingSqlite) {
    row = db.prepare(`SELECT * FROM password_resets WHERE token=?`).get(t);
    if (!row) return null;
    if (row.used) return null;
    if (Date.now() > Number(row.expires_at)) return null;
    return { customerId: row.customer_id, email: row.email, expiresAt: Number(row.expires_at) };
  }
  row = _pwResetMem.get(t);
  if (!row) return null;
  if (row.used) return null;
  if (Date.now() > row.expiresAt) return null;
  return { customerId: row.customerId, email: row.email, expiresAt: row.expiresAt };
}

function consumePasswordResetToken(token, newPassword) {
  const t = String(token || '').trim();
  const pw = String(newPassword || '');
  if (pw.length < 8) { const err = new Error('password_too_short'); err.code = 'password_too_short'; throw err; }
  const verified = verifyPasswordResetToken(t);
  if (!verified) { const err = new Error('invalid_or_expired_token'); err.code = 'invalid_or_expired_token'; throw err; }
  const newHash = hashPassword(pw);
  if (usingSqlite) {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE customers SET password_hash=? WHERE id=?`).run(newHash, verified.customerId);
      db.prepare(`UPDATE password_resets SET used=1 WHERE token=?`).run(t);
      // Invalidate ALL other outstanding reset tokens for this customer
      // (defense in depth — if multiple were issued, only the consumed one
      // already used; the rest are nuked so a stolen link expires immediately).
      db.prepare(`UPDATE password_resets SET used=1 WHERE customer_id=? AND used=0`).run(verified.customerId);
    });
    tx();
  } else {
    const c = jsonState.customers.find(x => x.id === verified.customerId);
    if (c) { c.passwordHash = newHash; saveJson(jsonState); }
    const row = _pwResetMem.get(t); if (row) row.used = true;
    for (const [k, v] of _pwResetMem.entries()) {
      if (v.customerId === verified.customerId) v.used = true;
    }
  }
  // Issue a fresh session token for the customer (auto-login after reset).
  const fresh = byEmail(verified.email);
  return makeAuthResult(fresh);
}

module.exports = {
  signup, login, upsertFromBackend, verifyToken,
  byEmail, getById, publicCustomer,
  createOrder, getOrder, updateOrder, listOrdersByCustomer,
  issueApiKey, findByApiKey,
  // Password reset (1h tokens, single-use)
  createPasswordResetToken, verifyPasswordResetToken, consumePasswordResetToken,
  // GDPR
  exportCustomer, deleteCustomer,
  // TOTP MFA
  generateTotpSecret, verifyTotp, totpCodeFor,
  _resetForTests,
  _stats,
  _listOrders
};
