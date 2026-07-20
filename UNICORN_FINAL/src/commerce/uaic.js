// commerce/uaic.js — Universal Autonomous Commerce
// Persistent receipts (JSONL) + license issuance (Ed25519) + USD↔BTC convert.
// Handles a small set of /api/uaic/* routes; the rest is owned by src/index.js.
//
// Public surface (consumed by src/index.js):
//   matches(urlPath) → boolean
//   handle(req, res, ctx) → Promise
//   convert(amount, currency)        → number (currency: 'BTC')
//   persistReceipt(receipt)          → receipt
//   getReceipts()                    → receipt[]
//   issueLicense(receipt)            → { token, body, alg }
//   listEntitlementsByEmail(email)   → entitlement[]
//   listEntitlementsByCustomer(cid)  → entitlement[]
//   buildCatalog({marketplace,industries}) → catalogItem[]

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.UNICORN_COMMERCE_DIR || path.join(__dirname, '..', '..', 'data', 'commerce');
const RECEIPTS_FILE = path.join(DATA_DIR, 'uaic-receipts.jsonl');
const SMOKE_RECEIPTS_FILE = path.join(DATA_DIR, 'uaic-smoke-receipts.jsonl');
const ENTITLEMENTS_FILE = path.join(DATA_DIR, 'uaic-entitlements.jsonl');

// SMOKE ISOLATION (audit 2026-06-12): deploy smoke-tests used to append
// thousands of loopback receipts into the canonical ledger (6.5MB of
// smoke@zeusai.pro rows). CI artifacts now land in a separate file so the
// canonical ledger stays pure revenue truth. In-memory index keeps them so
// the smoke flow itself still verifies end-to-end during the run.
// RO: chitanțele de smoke-test merg în fișier separat — ledger-ul canonic
// rămâne doar adevăr de venit.
const SMOKE_EMAILS = new Set(['smoke@zeusai.pro', 'test@test.com']);
function isSmokeReceipt(r) {
  try {
    if (!r) return false;
    if (SMOKE_EMAILS.has(String(r.email || '').toLowerCase())) return true;
    if (String(r.txid || '') === 'smoke-test-loopback') return true;
    if (r.confirmation && String(r.confirmation.txid || '') === 'smoke-test-loopback') return true;
  } catch (_) {}
  return false;
}

const _btcSpot = { usdPerBtc: Number(process.env.BTC_USD_FALLBACK) || 95000, fetchedAt: 0 };

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {} }

// ── Receipts (JSONL log + in-memory index) ───────────────────────────────
const _receipts = [];
const _receiptsById = new Map();
function _hydrateReceipts() {
  ensureDir();
  if (!fs.existsSync(RECEIPTS_FILE)) return;
  try {
    const text = fs.readFileSync(RECEIPTS_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const r = JSON.parse(t);
        if (!r || !r.id) continue;
        _receiptsById.set(r.id, r);
      } catch (_) {}
    }
    for (const r of _receiptsById.values()) _receipts.push(r);
  } catch (e) { console.warn('[uaic] hydrate failed:', e.message); }
}
function persistReceipt(receipt) {
  if (!receipt || !receipt.id) throw new Error('receipt_id_required');
  const existing = _receiptsById.get(receipt.id);
  if (existing) Object.assign(existing, receipt); else { _receiptsById.set(receipt.id, receipt); _receipts.push(receipt); }
  ensureDir();
  // Route CI/deploy smoke receipts to the isolated ledger — canonical file
  // holds only potentially-real commerce rows (reality-metrics truth guard
  // remains the final filter for on-chain verification).
  const targetFile = isSmokeReceipt(receipt) ? SMOKE_RECEIPTS_FILE : RECEIPTS_FILE;
  try { fs.appendFileSync(targetFile, JSON.stringify(receipt) + '\n'); } catch (e) { console.warn('[uaic] persist failed:', e.message); }
  // Auto-issue entitlement on paid receipts.
  if (receipt.status === 'paid') {
    try { _issueEntitlement(receipt); } catch (e) { console.warn('[uaic] entitlement failed:', e.message); }
  }
  return receipt;
}
function getReceipts() { return _receipts.slice(); }

// ── Entitlements ─────────────────────────────────────────────────────────
const _entitlements = [];
function _hydrateEntitlements() {
  ensureDir();
  if (!fs.existsSync(ENTITLEMENTS_FILE)) return;
  try {
    const text = fs.readFileSync(ENTITLEMENTS_FILE, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { const e = JSON.parse(t); if (e && e.id) _entitlements.push(e); } catch (_) {}
    }
  } catch (e) { console.warn('[uaic] entitlements hydrate failed:', e.message); }
}
function _issueEntitlement(receipt) {
  // Idempotent: don't double-issue for same receiptId.
  if (_entitlements.some(e => e.receiptId === receipt.id)) return;
  const services = Array.isArray(receipt.services) && receipt.services.length ? receipt.services : [receipt.plan || '*'];
  const ent = {
    id: 'ent_' + crypto.randomBytes(8).toString('hex'),
    receiptId: receipt.id,
    customerId: receipt.customerId || null,
    email: String(receipt.email || '').toLowerCase() || null,
    plan: receipt.plan || 'starter',
    serviceIds: services,
    amount: receipt.amount || 0,
    currency: receipt.currency || 'USD',
    issuedAt: new Date().toISOString(),
    activeUntil: new Date(Date.now() + 365*24*3600*1000).toISOString(),
    licenseToken: receipt.license && receipt.license.token ? receipt.license.token : null
  };
  _entitlements.push(ent);
  try { fs.appendFileSync(ENTITLEMENTS_FILE, JSON.stringify(ent) + '\n'); } catch (e) { console.warn('[uaic] entitlement append failed:', e.message); }
  return ent;
}
function listEntitlementsByEmail(email) {
  const e = String(email || '').toLowerCase();
  if (!e) return [];
  return _entitlements.filter(x => x.email === e);
}
function listEntitlementsByCustomer(cid) {
  if (!cid) return [];
  return _entitlements.filter(x => x.customerId === cid);
}

// ── License (Ed25519 if site-sign key present, else fallback HMAC) ────────
function issueLicense(receipt) {
  const body = {
    iss: 'ZeusAI',
    sub: receipt.email || receipt.customerId || 'anonymous',
    receiptId: receipt.id,
    plan: receipt.plan || 'starter',
    serviceIds: Array.isArray(receipt.services) && receipt.services.length ? receipt.services : [receipt.plan || '*'],
    seats: Number(receipt.seats || 1),
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
  };
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  let signature = '';
  let alg = 'HS256';
  try {
    if (global.__SITE_SIGN_KEY__) {
      signature = crypto.sign(null, Buffer.from(payload), global.__SITE_SIGN_KEY__).toString('base64url');
      alg = 'Ed25519';
    } else {
      signature = crypto.createHmac('sha256', process.env.LICENSE_SECRET || 'unicorn-license').update(payload).digest('base64url');
    }
  } catch (_) {
    signature = crypto.createHash('sha256').update(payload + String(receipt.id)).digest('base64url');
    alg = 'sha256';
  }
  return { body, token: payload + '.' + signature, alg };
}

// ── Currency convert ─────────────────────────────────────────────────────
function _btcRate() { return _btcSpot.usdPerBtc || 95000; }
function convert(amount, currency) {
  const usd = Number(amount || 0);
  const c = String(currency || 'USD').toUpperCase();
  if (c === 'USD') return usd;
  if (c === 'BTC') return Number((usd / _btcRate()).toFixed(8));
  return usd;
}
async function refreshBtcRate() {
  const now = Date.now();
  if (now - _btcSpot.fetchedAt < 60000) return _btcSpot.usdPerBtc;
  const sources = [
    { url: 'https://api.coinbase.com/v2/prices/BTC-USD/spot', pick: j => Number(j && j.data && j.data.amount) },
    { url: 'https://www.bitstamp.net/api/v2/ticker/btcusd/',   pick: j => Number(j && j.last) }
  ];
  for (const s of sources) {
    try {
      const r = await fetch(s.url, { headers: { 'User-Agent': 'ZeusAI-UAIC/1.0' } });
      if (!r.ok) continue;
      const j = await r.json();
      const p = s.pick(j);
      if (p && p > 1000 && p < 10000000) { _btcSpot.usdPerBtc = p; _btcSpot.fetchedAt = now; return p; }
    } catch (_) {}
  }
  _btcSpot.fetchedAt = now;
  return _btcSpot.usdPerBtc;
}

// ── Catalog builder ──────────────────────────────────────────────────────
function buildCatalog(sources) {
  const out = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || !item.id || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };
  const m = (sources && sources.marketplace) || [];
  if (Array.isArray(m)) for (const it of m) push({
    id: it.id || it.slug || it.title,
    title: it.title || it.name || it.id,
    description: it.description || '',
    priceUSD: Number(it.priceUSD || it.priceUsd || it.price || 0),
    kpi: it.kpi || null,
    group: 'marketplace'
  });
  const ind = (sources && sources.industries) || [];
  if (Array.isArray(ind)) for (const it of ind) push({
    id: it.id || it.slug,
    title: it.title || it.name || it.id,
    description: it.description || '',
    priceUSD: Number(it.priceUSD || it.priceUsd || it.price || 0),
    kpi: it.kpi || null,
    group: 'industry'
  });
  return out;
}

// ── HTTP routes owned by UAIC ────────────────────────────────────────────
const OWNED_PATHS = new Set([
  '/api/uaic/order',
  '/api/uaic/paypal/capture',
  '/api/uaic/admin/summary',
  '/api/uaic/health',
  '/api/uaic/convert'
]);
function matches(urlPath) { return OWNED_PATHS.has(urlPath); }

function _readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 256*1024) { try { req.destroy(); } catch(_){} reject(new Error('body_too_large')); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
function _json(res, code, obj) {
  try { res.writeHead(code, { 'Content-Type':'application/json' }); res.end(JSON.stringify(obj)); } catch (_) {}
}

// PayPal credential gate — canonical PAYPAL_CLIENT_SECRET + legacy PAYPAL_SECRET alias.
function _paypalClientId() {
  return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}
function _paypalSecret() {
  return String(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET || '').trim();
}
function _paypalConfigured() {
  return !!( _paypalClientId() && _paypalSecret() );
}
function _paypalBaseUrl() {
  const env = String(process.env.PAYPAL_ENV || process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return env === 'live' || env === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}
async function _paypalAccessToken() {
  const id = _paypalClientId();
  const secret = _paypalSecret();
  if (!id || !secret) throw new Error('paypal_not_configured');
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const r = await fetch(_paypalBaseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error('paypal_auth_failed:' + r.status);
  const d = await r.json();
  if (!d || !d.access_token) throw new Error('paypal_auth_empty');
  return d.access_token;
}
async function _createPaypalOrder({ amountUsd, description, customId }) {
  const token = await _paypalAccessToken();
  const r = await fetch(_paypalBaseUrl() + '/v2/checkout/orders', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: customId || undefined,
        custom_id: customId || undefined,
        description: description || 'ZeusAI Service',
        amount: { currency_code: 'USD', value: Number(amountUsd || 0).toFixed(2) },
      }],
    }),
  });
  if (!r.ok) throw new Error('paypal_order_create_failed:' + r.status);
  const d = await r.json();
  const approvalUrl = Array.isArray(d.links) ? (d.links.find((l) => l.rel === 'approve') || {}).href : null;
  return { orderId: d.id, approvalUrl, status: d.status };
}
async function _capturePaypalOrder(orderId) {
  if (!orderId || !/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) {
    throw new Error('invalid_paypal_order_id');
  }
  const token = await _paypalAccessToken();
  const r = await fetch(_paypalBaseUrl() + '/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  if (!r.ok) {
    let detail = '';
    try { detail = await r.text(); } catch (_) {}
    throw new Error('paypal_capture_failed:' + r.status + (detail ? (':' + detail.slice(0, 200)) : ''));
  }
  return await r.json();
}

async function handle(req, res, ctx) {
  const ctxSafe = ctx || {};
  const u = (req.url || '/').split('?')[0];
  if (u === '/api/uaic/health') {
    return _json(res, 200, { ok: true, service: 'uaic', receipts: _receipts.length, entitlements: _entitlements.length });
  }
  if (u === '/api/uaic/admin/summary') {
    const paid = _receipts.filter(r => r.status === 'paid');
    return _json(res, 200, {
      ok: true,
      receipts: { total: _receipts.length, paid: paid.length, pending: _receipts.length - paid.length },
      entitlements: _entitlements.length,
      revenueUsd: paid.reduce((s, r) => s + Number(r.amount || 0), 0),
      btcSpotUsd: _btcRate()
    });
  }
  if (u === '/api/uaic/convert') {
    const amount = Number((req.headers['x-amount'] || req.url.split('amount=')[1] || '0').toString().split('&')[0]) || 0;
    return _json(res, 200, { amount, btc: convert(amount, 'BTC'), usdPerBtc: _btcRate() });
  }
  if (u === '/api/uaic/order' && req.method === 'POST') {
    try {
      const body = await _readBody(req);
      const p = JSON.parse(body || '{}');
      const method = String(p.method || 'BTC').toUpperCase();
      const plan = String(p.plan || p.serviceId || 'starter');
      // Server-authoritative price (RO: prețul oficial calculat pe server).
      // For any KNOWN product the catalog price ALWAYS wins over the
      // client-supplied amount, so a $500,000 service can never be invoiced at
      // $70 (and nobody can tamper the amount field to underpay).
      const _clientAmount = Number(p.amount || p.amount_usd || p.amountUSD || p.priceUSD || 0);
      let amount = _clientAmount;
      try {
        if (ctxSafe && typeof ctxSafe.resolvePrice === 'function') {
          const canon = ctxSafe.resolvePrice(plan);
          if (canon != null && Number.isFinite(Number(canon))) amount = Number(canon);
        }
      } catch (_) { /* keep client amount on resolver failure */ }
      const email = String(p.email || (p.customer && p.customer.email) || '').toLowerCase();
      const portal = ctxSafe.portal;
      let customerId = p.customerId || null;
      if (!customerId && portal && p.customerToken) customerId = portal.verifyToken(p.customerToken);
      const receiptId = crypto.randomBytes(16).toString('hex');
      const btcAmount = method === 'BTC' ? convert(amount, 'BTC') : null;
      const receipt = {
        id: receiptId, method, plan, amount, currency: p.currency || 'USD',
        email, customerId,
        services: Array.isArray(p.services) && p.services.length ? p.services : [plan],
        createdAt: new Date().toISOString(), status: 'pending',
        btcAmount,
        btcAddress: method === 'BTC' ? (process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || null) : null,
        affiliate: p.ref ? { ref: p.ref, split: 0.1 } : null,
        did: p.did || null
      };
      // PayPal: create a real Orders API order when credentials are armed.
      // Accepts PAYPAL_CLIENT_SECRET (canonical) or legacy PAYPAL_SECRET alias.
      if (method === 'PAYPAL' && _paypalConfigured()) {
        try {
          const created = await _createPaypalOrder({
            amountUsd: amount,
            description: 'ZeusAI ' + plan,
            customId: receiptId,
          });
          if (created && created.orderId) {
            receipt.paypalOrderId = created.orderId;
            receipt.approveHref = created.approvalUrl || null;
            receipt.destination = { kind: 'paypal', orderId: created.orderId };
          }
        } catch (e) {
          console.warn('[uaic] paypal order create failed:', e && e.message);
        }
      }
      if (method === 'PAYPAL' && !receipt.approveHref) {
        const handle = process.env.PAYPAL_ME || process.env.PAYPAL_EMAIL || '';
        receipt.destination = receipt.destination || { kind: 'paypal', handle, owner: process.env.OWNER_NAME || 'ZeusAI' };
        receipt.approveHref = handle && !String(handle).includes('@')
          ? ('https://paypal.me/' + encodeURIComponent(handle) + '/' + amount)
          : (handle ? ('mailto:' + encodeURIComponent(handle) + '?subject=Unicorn%20' + encodeURIComponent(plan)) : null);
      }
      persistReceipt(receipt);
      return _json(res, 200, { ok: true, receipt });
    } catch (e) {
      return _json(res, 400, { error: 'bad_request', detail: e.message });
    }
  }
  if (u === '/api/uaic/paypal/capture' && req.method === 'POST') {
    try {
      const body = await _readBody(req);
      const p = JSON.parse(body || '{}');
      const receipt = _receiptsById.get(String(p.receiptId || ''));
      if (!receipt) return _json(res, 404, { error: 'receipt_not_found' });
      if (!_paypalConfigured()) {
        return _json(res, 503, { error: 'paypal_not_configured' });
      }
      const paypalOrderId = String(p.paypalOrderId || receipt.paypalOrderId || '').trim();
      if (!paypalOrderId) {
        return _json(res, 400, { error: 'paypal_order_id_required' });
      }
      // Real Capture API — never mark paid without a COMPLETED capture.
      const capture = await _capturePaypalOrder(paypalOrderId);
      const captureStatus = String(capture && capture.status || '').toUpperCase();
      const unitOk = Array.isArray(capture && capture.purchase_units)
        && capture.purchase_units.some((u) => {
          const caps = u && u.payments && u.payments.captures;
          return Array.isArray(caps) && caps.some((c) => String(c.status || '').toUpperCase() === 'COMPLETED');
        });
      if (captureStatus !== 'COMPLETED' && !unitOk) {
        return _json(res, 402, {
          error: 'paypal_capture_incomplete',
          status: captureStatus || null,
          paypalOrderId,
        });
      }
      receipt.status = 'paid';
      receipt.paidAt = new Date().toISOString();
      receipt.paypalOrderId = paypalOrderId;
      receipt.confirmation = {
        network: 'paypal',
        by: 'capture',
        at: receipt.paidAt,
        paypalOrderId,
        captureId: (capture && capture.id) || null,
        status: captureStatus,
      };
      receipt.license = receipt.license || issueLicense(receipt);
      persistReceipt(receipt);
      return _json(res, 200, { ok: true, receipt, capture: { status: captureStatus, id: capture && capture.id } });
    } catch (e) {
      return _json(res, 400, { error: 'bad_request', detail: e.message });
    }
  }
  return _json(res, 404, { error: 'uaic_route_not_found' });
}

// Initialize at module load.
_hydrateReceipts();
_hydrateEntitlements();
// Best-effort BTC rate refresh (non-blocking, only if fetch is available).
// Track the interval handle so _resetForTests can clear it and re-requires don't stack timers.
let _btcRateInterval = null;
if (typeof fetch === 'function') {
  refreshBtcRate().catch(()=>{});
  _btcRateInterval = setInterval(() => refreshBtcRate().catch(()=>{}), 5*60*1000);
  if (_btcRateInterval && typeof _btcRateInterval.unref === 'function') _btcRateInterval.unref();
}

module.exports = {
  matches, handle,
  convert, refreshBtcRate,
  persistReceipt, getReceipts,
  issueLicense,
  isSmokeReceipt,
  listEntitlementsByEmail, listEntitlementsByCustomer,
  buildCatalog,
  // for tests
  _resetForTests: () => { _receipts.length = 0; _receiptsById.clear(); _entitlements.length = 0; if (_btcRateInterval) { clearInterval(_btcRateInterval); _btcRateInterval = null; } try { fs.rmSync(RECEIPTS_FILE, { force: true }); fs.rmSync(SMOKE_RECEIPTS_FILE, { force: true }); fs.rmSync(ENTITLEMENTS_FILE, { force: true }); } catch (_) {} }
};
