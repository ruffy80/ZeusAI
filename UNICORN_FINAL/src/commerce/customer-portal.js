// commerce/customer-portal.js
// Site-local customer portal: signup/login (bcrypt + JWT-like HMAC tokens),
// orders, API keys. Persists to data/commerce/portal.json.
//
// API surface required by src/index.js:
//   signup(email, password, name) → { customer, token }
//   login(email, password)        → { customer, token }
//   verifyToken(token)            → customerId | null
//   getById(id) / byEmail(email)  → customer (raw) | null
//   publicCustomer(c)             → safe view
//   createOrder(fields)           → order
//   getOrder(id) / updateOrder(id, patch) → order
//   listOrdersByCustomer(cid)     → order[]
//   findByApiKey(key)             → { customer, key } | null
//   upsertFromBackend({email,name,password}) → { customer, token, bridged:true }
//
// Bilingual logs (RO/EN) are preserved as in the rest of the codebase.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let bcrypt;
try { bcrypt = require('bcryptjs'); } catch (_) { bcrypt = null; }

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const STORE_FILE = path.join(DATA_DIR, 'portal.json');

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

function load() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { customers: [], orders: [] };
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      customers: Array.isArray(raw.customers) ? raw.customers : [],
      orders: Array.isArray(raw.orders) ? raw.orders : []
    };
  } catch (e) { console.warn('[portal] load failed:', e.message); return { customers: [], orders: [] }; }
}

function save(state) {
  ensureDir();
  try {
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, STORE_FILE);
  } catch (e) { console.warn('[portal] save failed:', e.message); }
}

const state = load();

// ── Token (HMAC, JWT-like, no external dep) ─────────────────────────────
function tokenSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!global.__PORTAL_BOOT_SECRET__) {
    global.__PORTAL_BOOT_SECRET__ = crypto.randomBytes(32).toString('hex');
  }
  return global.__PORTAL_BOOT_SECRET__;
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function fromB64url(s) { return Buffer.from(String(s||'').replace(/-/g,'+').replace(/_/g,'/'), 'base64'); }
function signToken(payload) {
  const head = b64url(JSON.stringify({ alg:'HS256', typ:'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', tokenSecret()).update(head + '.' + body).digest());
  return head + '.' + body + '.' + sig;
}
function verifyToken(token) {
  try {
    const [h, b, s] = String(token||'').split('.');
    if (!h || !b || !s) return null;
    const expected = b64url(crypto.createHmac('sha256', tokenSecret()).update(h + '.' + b).digest());
    // timing-safe compare
    const a = Buffer.from(s); const e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const payload = JSON.parse(fromB64url(b).toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.cid || null;
  } catch (_) { return null; }
}

// ── Password hashing ─────────────────────────────────────────────────────
function hashPassword(plain) {
  if (bcrypt) return bcrypt.hashSync(String(plain), 10);
  // Fallback: scrypt with random salt (still strong, deterministic schema).
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

// ── Customer model helpers ───────────────────────────────────────────────
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

function byEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return state.customers.find(c => String(c.email||'').toLowerCase() === e) || null;
}
function getById(id) { return state.customers.find(c => c.id === id) || null; }

function makeAuthResult(customer) {
  const token = signToken({ cid: customer.id, iat: Date.now(), exp: Date.now() + 30*24*3600*1000 });
  return { ok: true, customer: publicCustomer(customer), token };
}

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
  state.customers.push(customer);
  save(state);
  return makeAuthResult(customer);
}

function login(email, password) {
  const c = byEmail(email);
  if (!c) { const err = new Error('email_not_found'); err.code='email_not_found'; throw err; }
  if (!verifyPassword(password, c.passwordHash)) { const err = new Error('wrong_password'); err.code='wrong_password'; throw err; }
  return makeAuthResult(c);
}

// Bridge: a backend system already authenticated the user; mirror locally.
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
    state.customers.push(c);
  } else if (password) {
    // Re-mirror password so subsequent local logins work.
    c.passwordHash = hashPassword(password);
    c.bridged = true;
    if (name && !c.name) c.name = String(name).slice(0,80);
  }
  save(state);
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
  state.orders.push(order);
  save(state);
  return order;
}
function getOrder(id) { return state.orders.find(o => o.id === id) || null; }
function updateOrder(id, patch) {
  const o = getOrder(id);
  if (!o) return null;
  Object.assign(o, patch || {});
  save(state);
  return o;
}
function listOrdersByCustomer(cid) {
  if (!cid) return [];
  return state.orders.filter(o => o.customerId === cid).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
}

// ── API keys ─────────────────────────────────────────────────────────────
function issueApiKey(customerId, productId, orderId) {
  const c = getById(customerId);
  if (!c) return null;
  const key = 'unc_' + crypto.randomBytes(24).toString('hex');
  const entry = { key, productId: productId || null, orderId: orderId || null, issuedAt: new Date().toISOString(), active: true };
  c.apiKeys = c.apiKeys || [];
  c.apiKeys.push(entry);
  save(state);
  return entry;
}
function findByApiKey(key) {
  if (!key) return null;
  for (const c of state.customers) {
    for (const k of (c.apiKeys || [])) {
      if (k.key === key && k.active !== false) return { customer: c, key: k };
    }
  }
  return null;
}

// ── Maintenance helpers (for tests + ops) ────────────────────────────────
function _resetForTests() {
  state.customers.length = 0;
  state.orders.length = 0;
  save(state);
}

module.exports = {
  signup, login, upsertFromBackend, verifyToken,
  byEmail, getById, publicCustomer,
  createOrder, getOrder, updateOrder, listOrdersByCustomer,
  issueApiKey, findByApiKey,
  _resetForTests,
  // expose counts for diagnostics
  _stats: () => ({ customers: state.customers.length, orders: state.orders.length })
};
