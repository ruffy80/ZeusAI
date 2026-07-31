// =============================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =============================================================================
/**
 * sovereign-commerce.js — REAL end-to-end sales layer for ZeusAI/Unicorn.
 * ----------------------------------------------------------------------------
 * Purpose: sell real Unicorn services from the site, settle directly on-chain
 * into the owner's existing BTC wallet, and deliver the service automatically
 * on payment confirmation. No custodian. No middleman. Self-sovereign.
 *
 * How payment matching works WITHOUT a wallet server and WITHOUT per-order
 * addresses: each order pays a unique amount (base satoshis + small nonce
 * 1..999). A background watcher polls mempool.space for incoming txs to the
 * owner's static address and matches incoming outputs by exact sat amount.
 * This is a well-known pattern used since 2013 by BTCPay/OpenNode-style
 * minimal checkouts.
 *
 * Delivery: on payment confirmation, the order is marked 'paid', an access
 * entitlement is appended to data/entitlements.jsonl, and a one-time access
 * token is issued (surfaced via /api/order/:id/status and shown on the
 * checkout page). The buyer receives a W3C Verifiable Credential receipt.
 *
 * Routes exposed (additive, handled BEFORE legacy dispatcher):
 *   POST /api/checkout/create        — create order (body: serviceId, qty, email?, currency?)
 *   GET  /checkout/:orderId          — human checkout page (QR + status polling)
 *   GET  /api/order/:orderId/status  — JSON status (pending/paid/expired)
 *   GET  /api/entitlements/:token    — verify entitlement and return grant info
 *   GET  /api/commerce/price         — BTC price (cached 5 min, multi-oracle)
 *   GET  /api/commerce/health        — watcher status + last scan
 *   POST /api/commerce/reconcile     — admin-triggered scan (HMAC: X-Commerce-Auth)
 *
 * ENV:
 *   BTC_WALLET_ADDRESS (default bc1q4f7e66z...) — destination for all payments
 *   COMMERCE_DATA_DIR  (default ./data/commerce)
 *   COMMERCE_WATCH_MS  (default 45000)          — poll interval
 *   COMMERCE_ORDER_TTL_MIN (default 60)         — minutes until order expires
 *   COMMERCE_MIN_CONFS (default 0)              — 0 = accept mempool (0-conf)
 *   COMMERCE_ADMIN_SECRET (optional)            — HMAC for admin endpoints
 *   COMMERCE_MEMPOOL_BASE (default https://mempool.space/api)
 *   COMMERCE_PRICE_FALLBACK_USD (default 60000)
 */
'use strict';

const fs       = require('fs');
const path     = require('path');
const http     = require('http');
const https    = require('https');
const crypto   = require('crypto');

// ── Real commerce metrics (kills fake Math.random on the SITE path) ─────────
// Counters live in src/monitoring/commerce-metrics.js. Best-effort require so
// the money path never depends on the metrics module being present.
let _metrics = null;
try { _metrics = require('../monitoring/commerce-metrics'); } catch (_) { _metrics = null; }
function _metricInc(name) { try { if (_metrics) _metrics.inc(name); } catch (_) { /* metrics are best-effort */ } }

// ── Defense-in-depth rate limiter for POST /api/checkout/create ─────────────
// Per-IP token bucket. Bypassed in tests and when COMMERCE_RATE_LIMIT=0 so the
// unit suite and internal reconciliation flows are never throttled.
const _RATE_LIMIT_DISABLED = process.env.NODE_ENV === 'test' || String(process.env.COMMERCE_RATE_LIMIT || '') === '0';
let _checkoutLimiter = null;
try {
  const { createLimiter } = require('../lib/rate-limiter');
  _checkoutLimiter = createLimiter({
    max: Math.max(1, +(process.env.COMMERCE_CHECKOUT_RATE_MAX || 20)),
    windowMs: 60 * 1000,
  });
} catch (_) { _checkoutLimiter = null; }
function _clientIp(req) {
  const xf = String((req && req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  if (xf) return xf;
  return (req && req.socket && req.socket.remoteAddress)
    || (req && req.connection && req.connection.remoteAddress)
    || 'unknown';
}

// ── Delivery hook (set by src/index.js after module load) ───────────────────
// Avoids a circular require: index.js registers runDeliveryForReceipt here
// after both modules are loaded. sovereign-commerce calls it fire-and-forget
// when an order transitions to 'paid'. Signature: hook(receiptLike) -> any.
let _deliveryHook = null;
function setDeliveryHook(fn) {
  _deliveryHook = typeof fn === 'function' ? fn : null;
}
function _fireDelivery(order) {
  if (!order) return;
  // World-Standard settle bridge (PoOP escrow + CTP twin) — before pack delivery
  try {
    const wsiBridge = require('../commerce/wsi-settle-bridge');
    wsiBridge.onPaymentConfirmed(order);
  } catch (e) {
    console.warn('[commerce] wsi paid bridge:', e && e.message);
  }
  if (!_deliveryHook) return;
  try {
    const receiptLike = {
      id: order.orderId,
      orderId: order.orderId,
      serviceId: order.serviceId,
      serviceName: order.serviceName,
      email: (order.buyer && order.buyer.email) || '',
      customerEmail: (order.buyer && order.buyer.email) || '',
      status: 'paid',
      method: 'BTC',
      txid: (order.txids && order.txids[0]) || null,
      amount_sats: order.amount_sats,
      amount_btc: order.amount_btc,
      currency: order.currency,
      subtotal_fiat: order.subtotal_fiat,
      paid_at: order.paid_at,
      access_token: order.access_token,
      entitlement_id: order.entitlement_id,
      // Pass-through so fulfillment packs can personalize from checkout inputs
      buyer: order.buyer || { email: (order.buyer && order.buyer.email) || '', inputs: {} },
      meta: Object.assign({}, order.meta || {}, {
        inputs: (order.meta && order.meta.inputs) || (order.buyer && order.buyer.inputs) || {},
        brief: (order.meta && order.meta.brief) || undefined,
        buyMode: order.buy_mode || (order.meta && order.meta.buyMode),
        requiresHumanFulfillment: !!(order.meta && order.meta.requiresHumanFulfillment),
      }),
      buy_mode: order.buy_mode || (order.meta && order.meta.buyMode),
      plan: order.serviceId,
      amount: order.subtotal_fiat,
    };
    Promise.resolve(_deliveryHook(receiptLike)).catch((e) =>
      console.warn('[commerce] delivery hook error for ' + order.orderId + ':', e.message)
    );
  } catch (e) {
    console.warn('[commerce] delivery hook fire error for ' + order.orderId + ':', e.message);
  }
}

// ── Config ──────────────────────────────────────────────────────────────────
const OWNER_BTC = (process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e').trim();
const OWNER_NAME   = process.env.OWNER_NAME  || 'Vladoi Ionut';
const OWNER_DOMAIN = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
const DATA_DIR     = process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce');
const ORDERS_FILE  = path.join(DATA_DIR, 'orders.jsonl');
const ENTITL_FILE  = path.join(DATA_DIR, 'entitlements.jsonl');
const STATE_FILE   = path.join(DATA_DIR, 'state.json');
const EXCEPTIONS_FILE = path.join(DATA_DIR, 'payment-exceptions.jsonl');
const WATCH_MS     = Math.max(15000, +(process.env.COMMERCE_WATCH_MS || 45000));
const ORDER_TTL_MS = Math.max(5, +(process.env.COMMERCE_ORDER_TTL_MIN || 60)) * 60 * 1000;
const MIN_CONFS    = Math.max(0, +(process.env.COMMERCE_MIN_CONFS || 0));
const ACCEPT_LATE_PAY = String(process.env.SOVEREIGN_ACCEPT_LATE_PAY || '') === '1';
// Tiered confirmation policy by USD amount (RO+EN):
//   < $50         → 0-conf (mempool acceptable)
//   $50–$1,000    → require 1 confirmation
//   > $1,000      → require 3 confirmations
// Override the entire policy via COMMERCE_TIERED_CONFS=disabled, or tune
// thresholds via COMMERCE_CONFS_TIER1_USD / TIER2_USD / TIER1_CONFS / TIER2_CONFS.
const TIERED_CONFS_ENABLED = String(process.env.COMMERCE_TIERED_CONFS || 'enabled').toLowerCase() !== 'disabled';
const TIER1_USD   = Math.max(0, +(process.env.COMMERCE_CONFS_TIER1_USD || 50));
const TIER2_USD   = Math.max(TIER1_USD, +(process.env.COMMERCE_CONFS_TIER2_USD || 1000));
const TIER1_CONFS = Math.max(0, +(process.env.COMMERCE_CONFS_TIER1_CONFS || 1));
const TIER2_CONFS = Math.max(TIER1_CONFS, +(process.env.COMMERCE_CONFS_TIER2_CONFS || 3));
function requiredConfsForUsd(usd) {
  if (!TIERED_CONFS_ENABLED) return MIN_CONFS;
  const n = Number(usd || 0);
  if (n >= TIER2_USD) return Math.max(MIN_CONFS, TIER2_CONFS);
  if (n >= TIER1_USD) return Math.max(MIN_CONFS, TIER1_CONFS);
  return MIN_CONFS;
}
const ADMIN_SECRET = process.env.COMMERCE_ADMIN_SECRET || '';
const MEMPOOL_BASE = (process.env.COMMERCE_MEMPOOL_BASE || 'https://mempool.space/api').replace(/\/+$/, '');
const MEMPOOL_FALLBACKS = String(process.env.COMMERCE_MEMPOOL_FALLBACKS || 'https://blockstream.info/api,https://mempool.emzy.de/api')
  .split(',')
  .map((s) => String(s || '').trim().replace(/\/+$/, ''))
  .filter(Boolean)
  .filter((u) => u !== MEMPOOL_BASE);
const EXPLORER_BASES = [MEMPOOL_BASE].concat(MEMPOOL_FALLBACKS);
const PRICE_FALLBACK_USD = +(process.env.COMMERCE_PRICE_FALLBACK_USD || 60000);
const CATALOG_SEEN_FILE = path.join(process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce'), 'catalog-seen.json');

// ── Storage ─────────────────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
const ORDERS = new Map();     // orderId -> order (in-memory; persisted on change)
const AMT_INDEX = new Map();  // amountSats -> orderId (pending only; fast match)
const SEEN_TXIDS = new Set(); // crediting txs already applied (from state file)
const CATALOG_SEEN = new Map(); // serviceId -> firstSeenAtMs (for /api/catalog/diff)
const PAYMENT_EXCEPTIONS = new Map(); // txid -> latest payment exception

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      for (const t of (s.seenTxids || [])) SEEN_TXIDS.add(t);
    }
  } catch {}
  // Replay orders from JSONL
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const lines = fs.readFileSync(ORDERS_FILE, 'utf8').split('\n').filter(Boolean);
      const latest = new Map();
      for (const l of lines) {
        try { const o = JSON.parse(l); if (o && o.orderId) latest.set(o.orderId, o); } catch {}
      }
      for (const o of latest.values()) {
        ORDERS.set(o.orderId, o);
        if (o.status === 'pending' && Date.now() < o.expires_at_ms) {
          AMT_INDEX.set(o.amount_sats, o.orderId);
        }
      }
    }
  } catch (e) { console.warn('[commerce] replay error:', e.message); }
}
function loadPaymentExceptions() {
  try {
    if (!fs.existsSync(EXCEPTIONS_FILE)) return;
    const lines = fs.readFileSync(EXCEPTIONS_FILE, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const ex = JSON.parse(line);
        if (ex && ex.txid) PAYMENT_EXCEPTIONS.set(String(ex.txid), ex);
      } catch (_) {}
    }
  } catch (e) { console.warn('[commerce] exception replay error:', e.message); }
}
function persistOrder(order) {
  try {
    fs.appendFileSync(ORDERS_FILE, JSON.stringify(order) + '\n');
  } catch (e) { console.warn('[commerce] persist error:', e.message); }
}
function persistEntitlement(ent) {
  try {
    fs.appendFileSync(ENTITL_FILE, JSON.stringify(ent) + '\n');
  } catch (e) { console.warn('[commerce] entitl persist error:', e.message); }
}
function persistState() {
  try {
    const keep = Array.from(SEEN_TXIDS).slice(-5000);
    fs.writeFileSync(STATE_FILE, JSON.stringify({ seenTxids: keep, updatedAt: new Date().toISOString() }));
  } catch {}
}
function nearestPendingAmount(outSats) {
  const target = Number(outSats || 0);
  if (!(target > 0)) return { closestOrderId: null, delta: null };
  let best = null;
  for (const [amount, orderId] of AMT_INDEX) {
    const amt = Number(amount);
    if (!(amt > 0)) continue;
    const delta = target - amt;
    const pct = Math.abs(delta) / amt;
    if (pct <= 0.05 && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { closestOrderId: orderId, delta };
    }
  }
  return best || { closestOrderId: null, delta: null };
}
function latestPaymentExceptionForOrder(orderId) {
  const id = String(orderId || '');
  let latest = null;
  for (const ex of PAYMENT_EXCEPTIONS.values()) {
    if (!ex || String(ex.closestOrderId || '') !== id) continue;
    if (!latest || String(ex.createdAt || '') > String(latest.createdAt || '')) latest = ex;
  }
  return latest;
}
function findExpiredOrderByExactAmountSats(outSats, nowMs) {
  const target = Number(outSats || 0);
  if (!(target > 0)) return null;
  for (const o of ORDERS.values()) {
    if (!o || Number(o.amount_sats || 0) !== target) continue;
    if (o.status === 'expired' || Number(nowMs || Date.now()) >= Number(o.expires_at_ms || 0)) return o;
  }
  return null;
}
function lateSettleAllowed(order, nowMs) {
  if (!ACCEPT_LATE_PAY || !order || !order.expires_at_ms) return false;
  const expiredBy = Number(nowMs || Date.now()) - Number(order.expires_at_ms || 0);
  return expiredBy >= 0 && expiredBy <= ORDER_TTL_MS;
}
function paymentProviderRefs(order) {
  if (!order) return [];
  if (Array.isArray(order.provider_refs) && order.provider_refs.length) return order.provider_refs.filter(Boolean);
  if (order.provider_settle && order.provider_settle.providerRef) return [order.provider_settle.providerRef];
  return (order.txids || []).filter(Boolean);
}
function isBtcPaidOrder(order) {
  const via = String((order && order.paid_via) || 'btc').toLowerCase();
  return via === 'btc' || via === 'bitcoin' || via === 'onchain';
}
function proofUrlForOrder(order, ref) {
  return ref && isBtcPaidOrder(order) ? `https://mempool.space/tx/${ref}` : null;
}
function recordPaymentException(fields) {
  const ex = Object.assign({
    txid: null,
    outSats: 0,
    closestOrderId: null,
    delta: null,
    createdAt: new Date().toISOString(),
  }, fields || {});
  if (!ex.txid) return null;
  PAYMENT_EXCEPTIONS.set(String(ex.txid), ex);
  try { fs.appendFileSync(EXCEPTIONS_FILE, JSON.stringify(ex) + '\n'); }
  catch (e) { console.warn('[commerce] exception persist error:', e.message); }
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      Promise.resolve(zac.sendTelegram([
        '⚠️ *BTC payment exception*',
        ex.kind ? `Kind: \`${ex.kind}\`` : null,
        `Tx: \`${ex.txid}\``,
        `Observed: ${ex.outSats} sats`,
        ex.closestOrderId ? `Closest order: \`${ex.closestOrderId}\`` : 'No pending order within 5%',
        ex.delta != null ? `Delta: ${ex.delta} sats` : null,
      ].filter(Boolean).join('\n'))).catch(() => {});
    }
  } catch (_) { /* Telegram alerts are best-effort */ }
  return ex;
}
function isBitcoinTxid(value) {
  return /^[a-fA-F0-9]{64}$/.test(String(value || '').trim());
}

// ── Catalog diff tracking (first-seen timestamp per item id) ────────────────
function loadCatalogSeen() {
  try {
    if (fs.existsSync(CATALOG_SEEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(CATALOG_SEEN_FILE, 'utf8'));
      for (const [id, ts] of Object.entries(data || {})) {
        if (typeof ts === 'number' && ts > 0) CATALOG_SEEN.set(id, ts);
      }
    }
  } catch {}
}
function persistCatalogSeen() {
  try {
    const obj = {};
    for (const [id, ts] of CATALOG_SEEN) obj[id] = ts;
    fs.writeFileSync(CATALOG_SEEN_FILE, JSON.stringify(obj));
  } catch {}
}
// Mark every catalog item with a first-seen timestamp (idempotent).
function recordCatalogItems(items) {
  if (!Array.isArray(items)) return 0;
  const now = Date.now();
  let added = 0;
  for (const it of items) {
    const id = it && it.id;
    if (!id || CATALOG_SEEN.has(id)) continue;
    CATALOG_SEEN.set(id, now);
    added++;
  }
  if (added > 0) persistCatalogSeen();
  return added;
}

// ── Crypto helpers (Ed25519 signing for entitlements) ───────────────────────
function getSigningKey() {
  try {
    if (global.__COMMERCE_SIGN_KEY__) return global.__COMMERCE_SIGN_KEY__;
    const keyFile = path.join(DATA_DIR, 'signing.pem');
    if (fs.existsSync(keyFile)) {
      global.__COMMERCE_SIGN_KEY__ = crypto.createPrivateKey(fs.readFileSync(keyFile));
      return global.__COMMERCE_SIGN_KEY__;
    }
    const kp = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(keyFile, kp.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    global.__COMMERCE_SIGN_KEY__ = kp.privateKey;
    return kp.privateKey;
  } catch { return null; }
}
function sign(obj) {
  try {
    const k = getSigningKey();
    if (!k) return null;
    return crypto.sign(null, Buffer.from(JSON.stringify(obj)), k).toString('base64');
  } catch { return null; }
}
// Public verify path — mirrors sign() exactly (Ed25519, canonical JSON body).
// Derives the public key from the same site signing key. Exported so the
// money-path integrity verifier (src/site/commerce-integrity.js) can validate
// entitlement signatures WITHOUT reimplementing or altering money logic.
function getVerifyKey() {
  try {
    const k = getSigningKey();
    if (!k) return null;
    return crypto.createPublicKey(k);
  } catch { return null; }
}
function verify(obj, signatureB64) {
  try {
    const pub = getVerifyKey();
    if (!pub || !signatureB64) return false;
    return crypto.verify(null, Buffer.from(JSON.stringify(obj)), pub, Buffer.from(String(signatureB64), 'base64'));
  } catch { return false; }
}
// Verify a persisted entitlement: the `.signature` field was appended AFTER
// sign() ran over the rest of the object, so we strip it and verify the
// remaining canonical body (same key order preserved by JSON round-trip).
function verifyEntitlement(ent) {
  if (!ent || typeof ent !== 'object') return false;
  const sig = ent.signature;
  if (!sig) return false;
  const rest = {};
  for (const key of Object.keys(ent)) {
    if (key === 'signature') continue;
    rest[key] = ent[key];
  }
  return verify(rest, sig);
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function httpJson(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(u, { timeout: timeoutMs, headers: { 'User-Agent': 'ZeusAI-Commerce/1.0' } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve({ ok: true, data: JSON.parse(body) }); }
            catch { resolve({ ok: true, data: body }); }
          } else {
            resolve({ ok: false, status: res.statusCode, body });
          }
        });
      });
      req.on('error', (e) => resolve({ ok: false, error: String(e) }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    } catch (e) { resolve({ ok: false, error: String(e) }); }
  });
}

async function httpJsonExplorer(pathname, timeoutMs = 8000) {
  let last = { ok: false, error: 'no_explorer' };
  for (const base of EXPLORER_BASES) {
    const r = await httpJson(`${base}${pathname.startsWith('/') ? pathname : '/' + pathname}`, timeoutMs);
    if (r && r.ok) return Object.assign({}, r, { explorer: base });
    last = r || last;
  }
  return last;
}

// ── Price oracle (multi-source, 5 min cache) ────────────────────────────────
const PRICE_CACHE = { usd: 0, eur: 0, fetchedAt: 0, source: 'none', liveUpdatedAt: 0 };
async function getBtcPrice() {
  if (Date.now() - PRICE_CACHE.fetchedAt < 5 * 60 * 1000 && PRICE_CACHE.usd > 0) return PRICE_CACHE;

  // Try mempool.space first (same infra we already use)
  let r = await httpJson(`${MEMPOOL_BASE}/v1/prices`);
  if (r.ok && r.data && r.data.USD) {
    PRICE_CACHE.usd = Number(r.data.USD);
    PRICE_CACHE.eur = Number(r.data.EUR || (r.data.USD * 0.93));
    PRICE_CACHE.fetchedAt = Date.now();
    PRICE_CACHE.source = 'mempool.space';
    PRICE_CACHE.liveUpdatedAt = PRICE_CACHE.fetchedAt;
    return PRICE_CACHE;
  }
  // Fallback: coingecko
  r = await httpJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur');
  if (r.ok && r.data && r.data.bitcoin && r.data.bitcoin.usd) {
    PRICE_CACHE.usd = Number(r.data.bitcoin.usd);
    PRICE_CACHE.eur = Number(r.data.bitcoin.eur || (r.data.bitcoin.usd * 0.93));
    PRICE_CACHE.fetchedAt = Date.now();
    PRICE_CACHE.source = 'coingecko';
    PRICE_CACHE.liveUpdatedAt = PRICE_CACHE.fetchedAt;
    return PRICE_CACHE;
  }
  // Keep accepting a recent live quote during transient oracle outages.
  if (PRICE_CACHE.usd > 0 && PRICE_CACHE.liveUpdatedAt > 0 && Date.now() - PRICE_CACHE.liveUpdatedAt < 30 * 60 * 1000) {
    return PRICE_CACHE;
  }
  // Last resort: static fallback
  if (PRICE_CACHE.usd === 0) {
    PRICE_CACHE.usd = PRICE_FALLBACK_USD;
    PRICE_CACHE.eur = PRICE_FALLBACK_USD * 0.93;
    PRICE_CACHE.source = 'fallback-static';
    PRICE_CACHE.fetchedAt = Date.now();
  }
  return PRICE_CACHE;
}
function priceUnavailableForNewInvoices(price) {
  return !!(price && price.source === 'fallback-static' && !price.liveUpdatedAt);
}

// ── Unique amount allocation ────────────────────────────────────────────────
function allocateUniqueAmount(baseSats) {
  // Try up to 50 random nonces (1..999 sats). Guarantees uniqueness among pending.
  for (let i = 0; i < 50; i++) {
    const nonce = 1 + Math.floor(Math.random() * 999);
    const amt = baseSats + nonce;
    if (!AMT_INDEX.has(amt)) return { amount_sats: amt, nonce };
  }
  // Fallback: +1 until free (still unique, tiny overpay)
  let amt = baseSats + 1000;
  while (AMT_INDEX.has(amt)) amt++;
  return { amount_sats: amt, nonce: amt - baseSats };
}

// ── Body reader ─────────────────────────────────────────────────────────────
function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > maxBytes) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function sendJson(res, code, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Unicorn-Commerce': '1', ...extraHeaders });
  res.end(body);
}
function timingSafeEqHex(a, b) {
  try { const A = Buffer.from(a, 'hex'), B = Buffer.from(b, 'hex'); if (A.length !== B.length) return false; return crypto.timingSafeEqual(A, B); }
  catch { return false; }
}

// ── Idempotency cache (24h, in-memory; #3 forward-only) ────────────────────
// Replays prior responses for repeat POST /api/checkout/create with the
// same Idempotency-Key. Keeps the cache bounded so a flood of unique keys
// cannot exhaust memory. Entries older than 24h are evicted lazily.
const _IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const _IDEMPOTENCY_MAX = 5000;
const _IDEMPOTENCY = new Map(); // key -> { statusCode, body, ts }
function _idempotencyGet(key) {
  const entry = _IDEMPOTENCY.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > _IDEMPOTENCY_TTL_MS) { _IDEMPOTENCY.delete(key); return null; }
  return entry;
}
function _idempotencySet(key, statusCode, body) {
  if (_IDEMPOTENCY.size >= _IDEMPOTENCY_MAX) {
    // Evict oldest 10% to keep amortized O(1).
    const drop = Math.ceil(_IDEMPOTENCY_MAX * 0.1);
    let i = 0;
    for (const k of _IDEMPOTENCY.keys()) { _IDEMPOTENCY.delete(k); if (++i >= drop) break; }
  }
  _IDEMPOTENCY.set(key, { statusCode, body, ts: Date.now() });
}

// ── Service resolution (from live snapshot OR full master catalog) ─────────
// Supports two ctx accessors so any service from `/api/catalog/master`
// (Vertical OS, Frontier F1-F12, Activation packages, Future R&D primitives,
// auto-discovered connector modules, …) becomes purchasable via sovereign BTC.
async function resolveService(ctx, serviceId) {
  // PRICE COHERENCE GUARANTEE (forward-only, 2026-06): the storefront shows
  // the dynamic-pricing engine's number (e.g. $77.69). The snapshot below
  // carries the STATIC catalog price (e.g. $499). If we quote the snapshot
  // price, the buyer sees one price on the card and a different one at
  // checkout — a conversion killer and a trust breach. So: whatever path
  // resolves the service, the CANONICAL live USD (same source as
  // /api/pricing/:id and the SSR cards) always wins when available.
  // RO: prețul de pe card = prețul din checkout, întotdeauna.
  const canonicalUsd = await (async () => {
    try {
      if (ctx && typeof ctx.canonicalUsd === 'function') {
        const v = Number(await ctx.canonicalUsd(serviceId));
        if (Number.isFinite(v) && v >= 0) return v;
      }
    } catch {}
    return null;
  })();
  const withCanonical = (svc) => {
    if (!svc) return svc;
    if (canonicalUsd != null && canonicalUsd > 0) {
      return Object.assign({}, svc, { price: canonicalUsd, price_list: Number(svc.price || 0) || undefined });
    }
    return svc;
  };
  // 1) Fast path: live snapshot (existing behavior, kept for backwards compat)
  try {
    if (ctx && typeof ctx.buildSnapshot === 'function') {
      const snap = ctx.buildSnapshot();
      const all = [].concat(snap.marketplace || [], snap.services || []).filter((s) => s && s.id);
      const hit = all.find((s) => String(s.id) === String(serviceId));
      if (hit) return withCanonical(hit);
    }
  } catch {}
  // 2) Master catalog path: any deliverable Unicorn can sell
  try {
    if (ctx && typeof ctx.resolveCatalogItem === 'function') {
      const item = await ctx.resolveCatalogItem(serviceId);
      if (item && item.id) {
        // Normalize to the shape resolveService callers expect (.name + .price)
        // Preserve honesty fields so createOrder can gate buyability.
        return withCanonical({
          id: item.id,
          name: item.title || item.name || item.id,
          title: item.title || item.name || item.id,
          price: Number(item.priceUsd != null ? item.priceUsd : (item.priceUSD != null ? item.priceUSD : (item.price || 0))),
          description: item.description || '',
          segment: item.segment || item.group || 'unicorn',
          group: item.group || item.tier || item.segment || 'unicorn',
          tier: item.tier || item.group || item.segment || '',
          kpi: item.kpi || '',
          demoOnly: item.demoOnly === true,
          synthetic: item.synthetic === true,
          autoPublished: item.autoPublished === true,
          requiresHumanFulfillment: item.requiresHumanFulfillment === true,
          fulfillmentRecipe: item.fulfillmentRecipe || item.recipe || item.deliveryRecipe,
          inputs: item.inputs || [],
        });
      }
    }
  } catch {}
  return null;
}

// ── Order creation ──────────────────────────────────────────────────────────
// Sovereign discount applied to ALL BTC checkouts ("Pay with BTC, save 10%").
// Configurable via COMMERCE_BTC_DISCOUNT_PCT; default 10%. Strictly additive
// price reduction — never increases the quoted amount.
const BTC_DISCOUNT_PCT = Math.max(0, Math.min(50, +(process.env.COMMERCE_BTC_DISCOUNT_PCT || 10)));
// Pre-order discount (percent of full price the buyer pays now). E.g. 30 means
// pay 30% now, lock the future-primitive at this price for COMMERCE_PREORDER_DAYS.
const PREORDER_PCT  = Math.max(5, Math.min(90, +(process.env.COMMERCE_PREORDER_PCT  || 30)));
const PREORDER_DAYS = Math.max(7, Math.min(3650, +(process.env.COMMERCE_PREORDER_DAYS || 365)));

// ── Input validation + conversion funnel (forward-only) ─────────────────────
// Simple, permissive email check (empty email stays allowed — email is
// optional for sovereign BTC checkout). serviceId is sanitized to a safe id
// charset before it is ever used to resolve/allocate an order.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const _commerceFunnel = { create: 0, open: 0, paid: 0 };
const FUNNEL_URL = (process.env.UNICORN_BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '') + '/api/analytics/funnel';
// Fire-and-forget conversion event to the backend funnel. Never throws, never
// blocks the checkout path; a dead backend simply drops the beacon.
function _fireFunnel(event, extra) {
  try {
    if (event === 'checkout_create') _commerceFunnel.create++;
    else if (event === 'checkout_open') _commerceFunnel.open++;
    else if (event === 'checkout_paid') _commerceFunnel.paid++;
    if (typeof fetch !== 'function') return;
    fetch(FUNNEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ event, source: 'sovereign' }, extra || {})),
      signal: AbortSignal.timeout(1500),
    }).catch(() => {});
  } catch (_) { /* funnel is best-effort only */ }
}

async function createOrder(ctx, input) {
  const { qty = 1, currency = 'USD', preorder = false } = input || {};
  // Sanitize serviceId to a safe id charset before any resolution/allocation.
  const serviceId = String((input && input.serviceId) || '').trim().slice(0, 128).replace(/[^\w.:-]/g, '');
  if (!serviceId) return { error: 'serviceId_required', status: 400 };

  // Immortality Continuum — Commerce Pressure Gate (fail-closed under disk/RAM critical)
  try {
    const cpg = require('../commerce/commerce-pressure-gate');
    const pressure = cpg.assess();
    if (pressure && pressure.commerceBlocked) {
      return cpg.refusePayload(pressure);
    }
  } catch (_) { /* gate best-effort; buyability still applies */ }

  // Email is optional; if present it must look like an email. Normalize first.
  const email = String((input && input.email) || '').trim().toLowerCase().slice(0, 254);
  if (email && !EMAIL_RE.test(email)) return { error: 'invalid_email', status: 400 };
  // Affiliate / referral attribution from storefront ?ref= (Godmode Completion OS).
  const affiliateRef = String((input && (input.ref || input.affiliateRef || (input.affiliate && input.affiliate.ref))) || '')
    .trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32) || null;
  if (affiliateRef) {
    try {
      const refEng = require('../commerce/referral-engine-real');
      if (refEng && typeof refEng.ensureTrackedCode === 'function') refEng.ensureTrackedCode(affiliateRef);
    } catch (_) { /* attribution best-effort */ }
  }
  const svc = await resolveService(ctx, serviceId);
  if (!svc) return { error: 'service_not_found', serviceId, status: 404 };

  // Commerce Reality OS — refuse invoices for non-deliverable / contact-only SKUs.
  // Buy Immortal OS: fail-closed — never mint when buyability cannot be assessed.
  let buyability = {
    buyable: false,
    mode: 'unavailable',
    reason: 'buyability_module_unavailable',
    ctaHref: '/services',
  };
  try {
    const commerceBuyability = require('../commerce/commerce-buyability');
    buyability = commerceBuyability.assessBuyability(svc);
  } catch (err) {
    return {
      error: 'service_not_buyable',
      reason: 'buyability_fail_closed',
      mode: 'unavailable',
      contactHref: '/services',
      serviceId,
      status: 503,
      detail: String(err && err.message || err).slice(0, 160),
    };
  }
  if (!buyability.buyable) {
    const status = buyability.mode === 'contact' ? 409 : 404;
    return {
      error: buyability.mode === 'contact' ? 'contact_required' : 'service_not_buyable',
      reason: buyability.reason,
      mode: buyability.mode,
      contactHref: buyability.ctaHref || '/enterprise#enterprise-contact',
      serviceId,
      status,
    };
  }
  // Email is optional at invoice mint time (restores one-click Buy → BTC QR).
  // Buyers can attach a delivery email on /checkout/:orderId if they skipped it.

  const buyerInputs = (input && input.inputs && typeof input.inputs === 'object' && !Array.isArray(input.inputs))
    ? input.inputs
    : {};
  const brief = String((input && input.brief) || buyerInputs.brief || '').trim().slice(0, 4000);

  const unitFull = svc.price != null ? Number(svc.price) : 0;
  // Pre-orders pay only PREORDER_PCT of full price; everyone gets BTC_DISCOUNT_PCT off.
  // Both factors are multiplicative so a pre-order also benefits from BTC discount.
  const isPreorder = !!preorder;
  const preorderFactor = isPreorder ? (PREORDER_PCT / 100) : 1;
  const btcFactor      = (100 - BTC_DISCOUNT_PCT) / 100;
  const unit           = Number((unitFull * preorderFactor * btcFactor).toFixed(2));
  const q = Math.max(1, Math.min(100, Number(qty) || 1));
  const subtotalFiat = Number((unit * q).toFixed(2));
  if (!(subtotalFiat > 0)) return { error: 'service_not_priced', status: 409 };

  const price = await getBtcPrice();
  const fiatPerBtc = String(currency).toUpperCase() === 'EUR' ? price.eur : price.usd;
  if (priceUnavailableForNewInvoices(price)) { _metricInc('price_oracle_fail'); return { error: 'price_oracle_unavailable', status: 503 }; }
  if (!(fiatPerBtc > 0)) { _metricInc('price_oracle_fail'); return { error: 'price_oracle_unavailable', status: 503 }; }

  const baseSats = Math.max(1000, Math.round((subtotalFiat / fiatPerBtc) * 1e8)); // dust floor 1000 sat
  const alloc = allocateUniqueAmount(baseSats);
  const amountBtc = Number((alloc.amount_sats / 1e8).toFixed(8));

  const orderId = 'ord_' + crypto.randomBytes(9).toString('hex');
  const accessToken = 't_' + crypto.randomBytes(16).toString('hex');
  const nowMs = Date.now();
  const validUntilIso = isPreorder
    ? new Date(nowMs + PREORDER_DAYS * 24 * 3600 * 1000).toISOString()
    : null;
  const order = {
    orderId,
    serviceId,
    serviceName: svc.name || svc.title || serviceId,
    qty: q,
    currency: String(currency).toUpperCase(),
    unit_price_fiat: unit,
    unit_price_full_fiat: unitFull,
    subtotal_fiat: subtotalFiat,
    btc_discount_pct: BTC_DISCOUNT_PCT,
    preorder: isPreorder,
    preorder_pct: isPreorder ? PREORDER_PCT : null,
    valid_until: validUntilIso,
    btc_price_at_quote: fiatPerBtc,
    price_source: price.source,
    amount_sats: alloc.amount_sats,
    amount_btc: amountBtc,
    nonce: alloc.nonce,
    receive_address: OWNER_BTC,
    bip21: `bitcoin:${OWNER_BTC}?amount=${amountBtc.toFixed(8)}&label=${encodeURIComponent('ZeusAI ' + orderId)}&message=${encodeURIComponent(svc.name || serviceId)}`,
    checkout_url: `${OWNER_DOMAIN}/checkout/${orderId}`,
    status_url:   `${OWNER_DOMAIN}/api/order/${orderId}/status`,
    qr_url:       `${OWNER_DOMAIN}/api/checkout/${orderId}/qr.svg`,
    buyer: {
      email: String(email || '').slice(0, 200),
      inputs: buyerInputs,
    },
    meta: {
      brief: brief || undefined,
      inputs: buyerInputs,
      buyMode: buyability.mode,
      requiresHumanFulfillment: buyability.mode === 'reserve' || svc.requiresHumanFulfillment === true,
      affiliateRef: affiliateRef || undefined,
    },
    affiliate: affiliateRef ? { ref: affiliateRef, split: 0.1 } : null,
    buy_mode: buyability.mode,
    access_token: accessToken,
    status: 'pending',
    created_at: new Date(nowMs).toISOString(),
    expires_at: new Date(nowMs + ORDER_TTL_MS).toISOString(),
    expires_at_ms: nowMs + ORDER_TTL_MS,
    paid_at: null,
    txids: [],
    confirmations: 0,
    provider: { name: OWNER_NAME, domain: OWNER_DOMAIN, did: `did:web:${OWNER_DOMAIN.replace(/^https?:\/\//, '')}` },
  };
  order.signature = sign({
    orderId: order.orderId, serviceId: order.serviceId, amount_sats: order.amount_sats,
    receive_address: order.receive_address, created_at: order.created_at, expires_at: order.expires_at,
  });

  ORDERS.set(orderId, order);
  AMT_INDEX.set(order.amount_sats, orderId);
  persistOrder(order);
  // Canonical Settle Bridge — dual-write portal shadow for recovery/dashboard.
  try {
    const bridge = require('../commerce/canonical-settle-bridge');
    const b = bridge.bridgeCreate(order);
    if (b && b.ok && b.portalOrderId) {
      order.meta = Object.assign({}, order.meta || {}, {
        portalOrderId: b.portalOrderId,
        portalCustomerId: b.customerId || undefined,
        settleBridge: 'CSB/1.0',
      });
      persistOrder(order);
    }
  } catch (bridgeErr) {
    console.warn('[commerce] settle bridge create skipped:', bridgeErr && bridgeErr.message);
  }
  _fireFunnel('checkout_create', { serviceId, value: subtotalFiat });
  _metricInc('orders_created');
  return { order, status: 201 };
}

/**
 * Mark a sovereign order paid from an alternate rail (PayPal / NOWPayments).
 * Idempotent. Keeps BTC watcher safe by releasing the sats amount index.
 */
function markOrderPaidFromProvider(orderId, proof) {
  const id = String(orderId || '').trim();
  const order = ORDERS.get(id);
  if (!order) return { ok: false, error: 'order_not_found' };
  if (order.status === 'paid') return { ok: true, duplicate: true, orderId: id, entitlement_id: order.entitlement_id || null };
  if (order.status !== 'pending') return { ok: false, error: 'order_not_pending', status: order.status };
  const provider = String((proof && proof.provider) || 'alt-rail').toLowerCase().slice(0, 32);
  const providerRef = String((proof && (proof.providerRef || proof.txid || proof.paymentId || proof.paypalOrderId)) || '').slice(0, 128);
  order.status = 'paid';
  order.paid_at = new Date().toISOString();
  order.paid_via = provider;
  const txids = (Array.isArray(order.txids) ? order.txids : []).filter(isBitcoinTxid);
  if (isBitcoinTxid(providerRef)) txids.push(providerRef);
  order.txids = Array.from(new Set(txids));
  if (providerRef && provider !== 'btc' && provider !== 'bitcoin' && !isBitcoinTxid(providerRef)) {
    const refs = Array.isArray(order.provider_refs) ? order.provider_refs.slice() : [];
    if (!refs.some((r) => r && r.provider === provider && r.ref === providerRef)) {
      refs.push({ provider, ref: providerRef, at: order.paid_at });
    }
    order.provider_refs = refs;
  }
  order.confirmations = Number((proof && proof.confirmations) != null ? proof.confirmations : 1);
  order.provider_settle = {
    provider,
    providerRef,
    at: order.paid_at,
    meta: (proof && proof.meta) || undefined,
  };
  const entitlement = {
    entitlement_id: 'ent_' + crypto.randomBytes(9).toString('hex'),
    access_token: order.access_token,
    orderId: order.orderId,
    serviceId: order.serviceId,
    serviceName: order.serviceName,
    buyer: order.buyer,
    granted_at: new Date().toISOString(),
    valid_until: order.valid_until || null,
    preorder: !!order.preorder,
    txid: providerRef || provider,
    amount_sats: order.amount_sats,
    paid_via: provider,
  };
  entitlement.signature = sign(entitlement);
  order.entitlement_id = entitlement.entitlement_id;
  persistEntitlement(entitlement);
  if (order.amount_sats) AMT_INDEX.delete(order.amount_sats);
  persistOrder(order);
  _metricInc('orders_paid');
  console.log('[commerce] PAID via ' + provider, order.orderId, 'service=' + order.serviceId, 'ref=' + providerRef);
  try {
    const affRef = (order.affiliate && order.affiliate.ref) || (order.meta && order.meta.affiliateRef);
    if (affRef) {
      const refEng = require('../commerce/referral-engine-real');
      const buyerEmail = String((order.buyer && order.buyer.email) || '').trim().toLowerCase();
      const red = refEng.recordRedemption({
        code: affRef,
        referredEmail: buyerEmail,
        orderId: order.orderId,
        amountUsd: Number(order.subtotal_fiat || 0),
      });
      order.affiliate = Object.assign({}, order.affiliate || {}, {
        ref: affRef,
        redemption: { ok: !!(red && red.ok), payoutUsd: red && red.payoutUsd, duplicate: !!(red && red.duplicate) },
      });
      persistOrder(order);
    }
  } catch (affErr) {
    console.warn('[commerce] affiliate redeem skipped:', affErr && affErr.message);
  }
  try {
    const bridge = require('../commerce/canonical-settle-bridge');
    bridge.bridgePaid(order);
  } catch (_) { /* optional */ }
  _fireDelivery(order);
  _fireFunnel('checkout_paid', { serviceId: order.serviceId, value: order.subtotal_fiat, provider });
  try {
    const _whBase = process.env.UNICORN_BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
    fetch(_whBase + '/internal/webhooks/emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'order.paid',
        payload: {
          orderId: order.orderId,
          serviceId: order.serviceId,
          serviceName: order.serviceName,
          amount_sats: order.amount_sats,
          amount_btc: order.amount_btc,
          currency: order.currency,
          txid: providerRef,
          confirmations: order.confirmations,
          paid_at: order.paid_at,
          entitlement_id: order.entitlement_id,
          paid_via: provider,
        },
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch (_) {}
  return { ok: true, orderId: id, entitlement_id: order.entitlement_id, paid_via: provider, access_token: order.access_token };
}

/**
 * Revoke a paid sovereign order after PayPal refund/chargeback (or admin).
 * Marks refunded and clears usable entitlement binding — idempotent.
 */
function revokeOrderFromProvider(orderId, proof) {
  const id = String(orderId || '').trim();
  const order = ORDERS.get(id);
  if (!order) return { ok: false, error: 'order_not_found' };
  if (order.status === 'refunded' || order.status === 'revoked') {
    return { ok: true, duplicate: true, orderId: id, status: order.status };
  }
  if (order.status !== 'paid' && order.status !== 'pending') {
    return { ok: false, error: 'order_not_revocable', status: order.status };
  }
  const provider = String((proof && proof.provider) || 'alt-rail').toLowerCase().slice(0, 32);
  const providerRef = String((proof && (proof.providerRef || proof.paymentId || proof.paypalOrderId)) || '').slice(0, 128);
  order.status = 'refunded';
  order.refunded_at = new Date().toISOString();
  order.entitlement_revoked = true;
  order.refund = {
    provider,
    providerRef: providerRef || null,
    reason: String((proof && proof.reason) || 'provider_refund').slice(0, 80),
    at: order.refunded_at,
  };
  if (order.amount_sats) AMT_INDEX.delete(order.amount_sats);
  persistOrder(order);
  console.log('[commerce] REFUNDED via ' + provider, order.orderId, 'ref=' + providerRef);
  try {
    const zac = require('../../backend/modules/zacAlertChannel');
    if (zac && typeof zac.sendTelegram === 'function') {
      Promise.resolve(zac.sendTelegram([
        '↩️ *Order refunded/revoked*',
        `Order \`${order.orderId}\``,
        `Provider: ${provider}`,
        providerRef ? `Ref: ${providerRef}` : null,
        order.serviceId ? `Service: ${order.serviceId}` : null,
      ].filter(Boolean).join('\n'))).catch(() => {});
    }
  } catch (_) { /* optional */ }
  return { ok: true, orderId: id, status: 'refunded', paid_via: order.paid_via || null };
}

// ── Payment watcher (mempool.space) ─────────────────────────────────────────
const WATCH_STATE = { lastScanAt: 0, lastScanOk: false, lastError: null, totalScans: 0, totalMatched: 0 };
async function scanIncoming() {
  WATCH_STATE.totalScans++;
  WATCH_STATE.lastScanAt = Date.now();
  const scanNow = Date.now();
  // Expire before matching so stale invoices cannot be paid by a late tx unless
  // SOVEREIGN_ACCEPT_LATE_PAY=1 explicitly enables the bounded grace window.
  for (const [, o] of ORDERS) {
    if (o.status === 'pending' && scanNow >= o.expires_at_ms) {
      o.status = 'expired';
      AMT_INDEX.delete(o.amount_sats);
      persistOrder(o);
    }
  }
  const hasScannableOrder = Array.from(ORDERS.values()).some((o) => {
    if (!o) return false;
    if (o.status === 'pending' && scanNow < o.expires_at_ms) return true;
    return (o.status === 'expired' || scanNow >= Number(o.expires_at_ms || 0))
      && (scanNow - Number(o.expires_at_ms || 0) <= ORDER_TTL_MS);
  });
  if (!hasScannableOrder) { WATCH_STATE.lastScanOk = true; return { skipped: true }; }

  // Primary mempool.space, then Blockstream / alternate Esplora mirrors.
  const r = await httpJsonExplorer(`/address/${OWNER_BTC}/txs`);
  if (!r.ok) { WATCH_STATE.lastScanOk = false; WATCH_STATE.lastError = r.error || `status=${r.status}`; return { error: WATCH_STATE.lastError }; }
  WATCH_STATE.lastScanOk = true; WATCH_STATE.lastError = null;
  WATCH_STATE.lastExplorer = r.explorer || MEMPOOL_BASE;

  const txs = Array.isArray(r.data) ? r.data : [];
  // Tip height once per scan — required for real confirmation depth
  // (block_height alone is not confirmations).
  let tipHeight = 0;
  try {
    const tip = await httpJsonExplorer('/blocks/tip/height');
    if (tip && tip.ok) tipHeight = Number(tip.data) || 0;
  } catch (_) { tipHeight = 0; }
  let matched = 0;
  let seenDirty = false;
  for (const tx of txs) {
    if (!tx || !tx.txid) continue;
    if (SEEN_TXIDS.has(tx.txid)) continue;
    // Sum outputs to our address
    let outSats = 0;
    for (const vout of (tx.vout || [])) {
      const addr = vout && vout.scriptpubkey_address;
      if (addr === OWNER_BTC) outSats += Number(vout.value || 0);
    }
    if (outSats <= 0) continue;
    const confirmed = !!(tx.status && tx.status.confirmed);
    // Match against exact amount (strictest). Apply tiered confirmation policy:
    // small amounts may settle 0-conf, large amounts require N on-chain confs.
    let orderId = AMT_INDEX.get(outSats);
    let orderForTier = orderId ? ORDERS.get(orderId) : null;
    if (!orderForTier) {
      const exactExpired = findExpiredOrderByExactAmountSats(outSats, scanNow);
      if (exactExpired && (exactExpired.status === 'expired' || scanNow >= Number(exactExpired.expires_at_ms || 0))) {
        orderId = exactExpired.orderId;
        orderForTier = exactExpired;
      }
    }
    if (!orderForTier) {
      const nearest = nearestPendingAmount(outSats);
      recordPaymentException(Object.assign({
        kind: 'payment_amount_mismatch',
        txid: tx.txid,
        outSats,
      }, nearest));
      SEEN_TXIDS.add(tx.txid);
      seenDirty = true;
      continue;
    }
    // Orders store fiat as subtotal_fiat (NOT price_usd/amount_usd).
    const usdForTier = orderForTier && Number(
      orderForTier.subtotal_fiat || orderForTier.price_usd || orderForTier.amount_usd || 0
    );
    const neededConfs = requiredConfsForUsd(usdForTier || 0);
    const blockHeight = confirmed ? Number(tx.status && tx.status.block_height) || 0 : 0;
    let txConfs = 0;
    if (confirmed) {
      if (tipHeight > 0 && blockHeight > 0) txConfs = Math.max(1, tipHeight - blockHeight + 1);
      else txConfs = 1;
    }
    const expiredPayment = orderForTier.status === 'expired' || scanNow >= Number(orderForTier.expires_at_ms || 0);
    if (expiredPayment && !lateSettleAllowed(orderForTier, scanNow)) {
      if (orderForTier.status === 'pending') {
        orderForTier.status = 'expired';
        AMT_INDEX.delete(orderForTier.amount_sats);
        persistOrder(orderForTier);
      }
      recordPaymentException({
        kind: 'late_payment_expired',
        txid: tx.txid,
        outSats,
        closestOrderId: orderForTier.orderId,
        delta: outSats - Number(orderForTier.amount_sats || 0),
      });
      SEEN_TXIDS.add(tx.txid);
      seenDirty = true;
      continue;
    }
    if (orderId && (neededConfs === 0 ? true : txConfs >= neededConfs)) {
      const order = ORDERS.get(orderId);
      if (order && (order.status === 'pending' || (order.status === 'expired' && lateSettleAllowed(order, scanNow)))) {
        order.status = 'paid';
        order.paid_at = new Date().toISOString();
        order.paid_via = 'btc';
        order.txids = Array.from(new Set([...(order.txids || []), tx.txid]));
        order.confirmations = txConfs;
        order.confs_required = neededConfs;
        order.paid_sats_observed = outSats;
        // BTC txids stay in order.txids only — provider_refs is for PayPal/NOW refs.
        // Grant entitlement
        const entitlement = {
          entitlement_id: 'ent_' + crypto.randomBytes(9).toString('hex'),
          access_token: order.access_token,
          orderId: order.orderId,
          serviceId: order.serviceId,
          serviceName: order.serviceName,
          buyer: order.buyer,
          granted_at: new Date().toISOString(),
          valid_until: order.valid_until || null, // pre-orders carry an expiry; perpetual otherwise
          preorder: !!order.preorder,
          txid: tx.txid,
          amount_sats: outSats,
        };
        entitlement.signature = sign(entitlement);
        order.entitlement_id = entitlement.entitlement_id;
        persistEntitlement(entitlement);
        persistOrder(order);
        AMT_INDEX.delete(outSats);
        SEEN_TXIDS.add(tx.txid);
        seenDirty = true;
        matched++;
        _metricInc('orders_paid');
        console.log('[commerce] PAID', order.orderId, 'service=' + order.serviceId, 'sats=' + outSats, 'txid=' + tx.txid);
        // Affiliate redemption on settle (sovereign path — previously unwired).
        try {
          const affRef = (order.affiliate && order.affiliate.ref) || (order.meta && order.meta.affiliateRef);
          if (affRef) {
            const refEng = require('../commerce/referral-engine-real');
            const buyerEmail = String((order.buyer && order.buyer.email) || '').trim().toLowerCase();
            const red = refEng.recordRedemption({
              code: affRef,
              referredEmail: buyerEmail,
              orderId: order.orderId,
              amountUsd: Number(order.subtotal_fiat || 0),
            });
            order.affiliate = Object.assign({}, order.affiliate || {}, {
              ref: affRef,
              redemption: { ok: !!(red && red.ok), payoutUsd: red && red.payoutUsd, duplicate: !!(red && red.duplicate) },
            });
            persistOrder(order);
          }
        } catch (affErr) {
          console.warn('[commerce] affiliate redeem skipped:', affErr && affErr.message);
        }
        // Canonical Settle Bridge — mirror paid onto portal shadow order.
        try {
          const bridge = require('../commerce/canonical-settle-bridge');
          const bp = bridge.bridgePaid(order);
          if (bp && !bp.ok && bp.reason !== 'no_portal_order') {
            console.warn('[commerce] settle bridge paid:', bp.reason || bp.error);
          }
        } catch (bridgeErr) {
          console.warn('[commerce] settle bridge paid skipped:', bridgeErr && bridgeErr.message);
        }
        // ─── Delivery hook: forward-only, fire-and-forget via registered hook ─
        _fireDelivery(order);
        _fireFunnel('checkout_paid', { serviceId: order.serviceId, value: order.subtotal_fiat });
        // ─── C1: emit `order.paid` webhook (forward-only, fire-and-forget) ───
        // Backend webhook-emitter is reached via internal HTTP (loopback).
        // Failure is silent — order state is already persisted; subscribers
        // that miss the webhook can still poll /api/order/:id/status.
        try {
          const _whBase = process.env.UNICORN_BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
          fetch(_whBase + '/internal/webhooks/emit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'order.paid',
              payload: {
                orderId: order.orderId,
                serviceId: order.serviceId,
                serviceName: order.serviceName,
                amount_sats: outSats,
                amount_btc: order.amount_btc,
                currency: order.currency,
                txid: tx.txid,
                confirmations: txConfs,
                paid_at: order.paid_at,
                entitlement_id: order.entitlement_id,
              },
            }),
            signal: AbortSignal.timeout(3000),
          }).catch(() => {});
        } catch (_) {}
      }
    } else if (orderId && orderForTier && orderForTier.status === 'pending') {
      orderForTier.txids = Array.from(new Set([...(orderForTier.txids || []), tx.txid]));
      orderForTier.confirmations = Math.max(Number(orderForTier.confirmations || 0), txConfs);
      orderForTier.confs_required = neededConfs;
      orderForTier.paid_sats_observed = outSats;
      orderForTier.tx_seen = true;
      persistOrder(orderForTier);
      continue;
    }
    // Mark tx seen even if not matched (avoid re-scan cost next cycle)
    SEEN_TXIDS.add(tx.txid);
    seenDirty = true;
  }
  if (matched > 0) WATCH_STATE.totalMatched += matched;
  if (seenDirty || matched > 0) persistState();
  return { matched, scanned: txs.length };
}

// ── QR SVG (BIP-21, first-party endpoint) ───────────────────────────────────
async function qrSvg(data) {
  try {
    const QR = require('qrcode');
    return await QR.toString(String(data || ''), {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
    });
  } catch (_) {
    const txt = escapeHtml(String(data || ''));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360"><rect width="360" height="360" fill="#fff"/><text x="20" y="180" font-family="monospace" font-size="12" fill="#000">${txt}</text></svg>`;
  }
}

// ── Checkout HTML page ──────────────────────────────────────────────────────
// Renders the human-facing /checkout/:orderId page. Historic bug: the template
// referenced `${TOK}` as a JS expression (undefined) which threw at render
// time AFTER `res.writeHead(200)` had already been sent — leaving nginx to
// serve the "restoring service" maintenance page. Fixed by using the escaped
// order.access_token directly for server-rendered hrefs, and by using
// `${'${TOK}'}` (a literal `${TOK}` in the emitted JS) as a placeholder that
// only the client-side <script> reads. All numeric formatters are wrapped in
// Number(...||0).toFixed(...) so missing fields cannot throw.
function checkoutHtml(order, opts) {
  const o = order || {};
  const nonce = opts && opts.nonce ? String(opts.nonce) : '';
  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : '';
  const currency = escapeHtml(o.currency || 'USD');
  const subtotal = Number(o.subtotal_fiat || 0).toFixed(2);
  const price = `${subtotal} ${currency}`;
  const btc = Number(o.amount_btc || 0).toFixed(8);
  const sats = Number(o.amount_sats || 0);
  const btcPriceAtQuote = Number(o.btc_price_at_quote || 0);
  const expiresAtMs = Number(o.expires_at_ms || 0);
  const expiresIn = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
  const orderId = escapeHtml(o.orderId || '');
  const orderIdJs = jsStringEscape(o.orderId || '');
  const serviceName = escapeHtml(o.serviceName || o.serviceId || 'Service');
  const qty = Number(o.qty || 1);
  const receiveAddress = escapeHtml(o.receive_address || '');
  const bip21 = escapeHtml(o.bip21 || '');
  const bip21Js = jsStringEscape(o.bip21 || '');
  const receiveAddressJs = jsStringEscape(o.receive_address || '');
  const btcJs = jsStringEscape(btc);
  const priceSource = escapeHtml(o.price_source || '');
  // Access token: use the actual escaped token for server-rendered hrefs, and
  // pass it into the client-side script via a safely JS-escaped literal.
  const accessToken = escapeHtml(o.access_token || '');
  const accessTokenJs = jsStringEscape(o.access_token || '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout · ${serviceName} · ZeusAI</title>
<meta name="robots" content="noindex">
<style>
:root{color-scheme:dark;--bg:#05040a;--fg:#eaf0ff;--mut:#9aa3b2;--acc:#7cf3ff;--ok:#28f088;--warn:#ffb86b;--line:#1a1a2e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,Segoe UI,Inter,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:32px 20px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 24px}
.card{background:#0b0a15;border:1px solid var(--line);border-radius:14px;padding:22px;margin:16px 0}
.row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed var(--line)}
.row:last-child{border-bottom:0}.k{color:var(--mut)}.v{font-weight:600}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;word-break:break-all}
.copy{background:#14132a;border:1px solid var(--line);color:var(--fg);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;margin-left:6px}
.qr{display:flex;justify-content:center;padding:14px;background:#fff;border-radius:12px}
.qr img{width:260px;height:260px;display:block}
.cta{display:inline-block;background:var(--acc);color:#05040a;font-weight:700;padding:10px 16px;border-radius:10px;text-decoration:none;margin-right:8px}
.status{display:inline-block;padding:6px 12px;border-radius:999px;font-weight:700;font-size:13px}
.status.pending{background:#2a210b;color:var(--warn)}.status.paid{background:#0f2a1b;color:var(--ok)}.status.expired{background:#2a0f0f;color:#ff6b6b}
.note{color:var(--mut);font-size:13px;margin-top:8px}
.grant{background:#0f2a1b;border:1px solid #165232;border-radius:12px;padding:16px;margin-top:16px;display:none}
.grant.on{display:block}
footer{color:var(--mut);font-size:12px;margin-top:32px;text-align:center}
a{color:var(--acc)}
</style></head><body><div class="wrap">
<h1>Checkout</h1><p class="sub">${serviceName} · Order <span class="mono">${orderId}</span></p>

<div class="card">
  <div class="row"><span class="k">Service</span><span class="v">${serviceName}</span></div>
  <div class="row"><span class="k">Quantity</span><span class="v">${qty}</span></div>
  <div class="row"><span class="k">Subtotal</span><span class="v">${price}</span></div>
  <div class="row"><span class="k">Pay exactly</span><span class="v mono">${btc} BTC <small class="k">(${sats.toLocaleString()} sats)</small></span></div>
  <div class="row"><span class="k">BTC price at quote</span><span class="v">${btcPriceAtQuote.toLocaleString()} ${currency} <small class="k">(${priceSource})</small></span></div>
  <div class="row"><span class="k">Status</span><span class="v"><span id="st" class="status pending">pending</span></span></div>
  <div class="row"><span class="k">Expires in</span><span class="v" id="cd">${expiresIn}s</span></div>
  <div class="row"><span class="k">Delivery email</span><span class="v" id="buyerEmailLabel">${escapeHtml((o.buyer && o.buyer.email) || 'optional — add below')}</span></div>
</div>

<div class="card" id="armedRailsContinuum" data-ark="1.0">
  <p style="margin:0 0 8px"><b>Armed Rails Continuum</b> <span class="k">— live settle / notify status</span></p>
  <div class="row"><span class="k">BTC</span><span class="v" id="arkBtc">armed · primary</span></div>
  <div class="row"><span class="k">PayPal</span><span class="v" id="arkPaypal">checking…</span></div>
  <div class="row"><span class="k">NOWPayments</span><span class="v" id="arkNow">checking…</span></div>
  <div class="row"><span class="k">Email recovery</span><span class="v" id="arkEmail">checking…</span></div>
  <p class="note" id="arkNote" style="margin-top:8px">Optional rails appear only when runtime keys are present. BTC owner-wallet is always the primary settle path.</p>
</div>
<script>
(function(){
  function set(id,t){var el=document.getElementById(id);if(el)el.textContent=t;}
  fetch('/api/payment/methods',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){
    var methods=(j&&j.methods)||[];
    var paypal=methods.some(function(m){return String((m&&m.id)||'').toLowerCase()==='paypal'&&m.active!==false&&m.settleReady!==false;});
    var nowp=methods.some(function(m){return String((m&&m.id)||'').toLowerCase()==='nowpayments'&&m.active!==false&&m.settleReady!==false;});
    var email=!!(j&&j.emailConfigured);
    set('arkPaypal', paypal ? 'armed · Orders API' : 'idle · needs PAYPAL_CLIENT_ID/SECRET');
    set('arkNow', nowp ? 'armed · hosted invoice' : 'idle · needs NOWPAYMENTS_API_KEY');
    set('arkEmail', email ? 'armed · recovery can email buyers' : 'idle · needs RESEND/BREVO/SMTP');
    var alt=document.getElementById('altRailsCard');
    if(alt) alt.style.display = (paypal || nowp) ? '' : 'none';
    var btnPp=document.getElementById('payPaypalBtn');
    var btnNp=document.getElementById('payNowBtn');
    if(btnPp) btnPp.style.display = paypal ? '' : 'none';
    if(btnNp) btnNp.style.display = nowp ? '' : 'none';
    set('arkNote', 'Live rails: BTC'+(paypal?' · PayPal':'')+(nowp?' · NOWPayments':'')+(email?' · Email':'')+'.');
  }).catch(function(){
    set('arkPaypal','unknown'); set('arkNow','unknown'); set('arkEmail','unknown');
  });
})();
</script>

${!String((o.buyer && o.buyer.email) || '').trim() ? `
<div class="card" id="emailCaptureCard">
  <p style="margin:0 0 10px"><b>Delivery email</b> <span class="k">(optional — for receipt + deliverable)</span></p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <input id="deliveryEmail" type="email" autocomplete="email" placeholder="you@company.com" style="flex:1;min-width:200px;background:#14132a;border:1px solid var(--line);color:var(--fg);padding:10px 12px;border-radius:8px;font-size:14px"/>
    <button type="button" class="cta" id="saveEmailBtn" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)">Save email</button>
  </div>
  <p class="note" id="emailSaveMsg" style="margin-top:8px">You can pay first — email can be added any time before delivery.</p>
</div>` : ''}

<div class="card">
  <div class="qr"><img alt="BIP-21 QR" src="/api/checkout/${orderId}/qr.svg" loading="lazy"></div>
  <p class="note" style="text-align:center;margin-top:16px">Scan with any Bitcoin wallet (on-chain). The exact amount is critical — it is the payment identifier.</p>
  <div class="row"><span class="k">Address</span><span class="v mono">${receiveAddress} <button class="copy" data-copy="${receiveAddress}">copy</button></span></div>
  <div class="row"><span class="k">Amount</span><span class="v mono">${btc} BTC <button class="copy" data-copy="${escapeHtml(btc)}">copy</button></span></div>
  <div class="row"><span class="k">Exact sats</span><span class="v mono">${sats.toLocaleString()} <button class="copy" data-copy="${escapeHtml(String(sats))}">copy</button></span></div>
  <div class="row"><span class="k">BIP-21 URI</span><span class="v mono">${bip21} <button class="copy" data-copy="${bip21}">copy</button></span></div>
  <div class="row"><span class="k">Share invoice</span><span class="v mono" id="shareInvoiceUrl">/checkout/${orderId} <button class="copy" data-copy="${escapeHtml(OWNER_DOMAIN)}/checkout/${orderId}">copy link</button></span></div>
  <p style="margin-top:16px"><a class="cta" href="${bip21}" target="_blank" rel="noopener">Open in wallet</a>
  <a class="cta" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)" href="${escapeHtml(OWNER_DOMAIN)}" target="_blank" rel="noopener">Back to site</a></p>
  <p class="note">Air-gapped wallets: copy exact sats + address, or scan the QR. The unique sat amount is the payment identifier — no account required.</p>
</div>

<div class="card" id="altRailsCard">
  <p style="margin:0 0 10px"><b>Other payment rails</b> <span class="k">(optional — BTC above stays primary)</span></p>
  <p style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap">
    <button type="button" class="cta" id="payPaypalBtn" style="background:#0070ba;color:#fff">Pay with PayPal</button>
    <button type="button" class="cta" id="payNowBtn" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)">Pay with card / crypto (NOWPayments)</button>
  </p>
  <p class="note" id="altRailsMsg">Buttons appear only when PayPal / NOWPayments secrets are armed at runtime.</p>
</div>

  <div class="grant" id="confirmWait" style="background:#2a210b;border-color:#5c4316;color:#ffdf9d">
  <h2 style="margin:0 0 6px">⏳ Payment seen — awaiting confirmations</h2>
  <p style="margin:0" id="confirmWaitText">Waiting for the required confirmation depth before activation.</p>
  </div>

  <div class="grant" id="grant">
  <h2 style="margin:0 0 6px">✅ Payment received — service activated</h2>
  <p style="margin:0 0 12px">Your access token is ready. Keep it safe — it is the cryptographic proof of purchase.</p>
  <div class="row"><span class="k">Access token</span><span class="v mono" id="tok"></span></div>
  <div class="row"><span class="k">Entitlement</span><span class="v mono" id="ent">—</span></div>
  <div class="row"><span class="k">Txid</span><span class="v mono" id="tx">—</span></div>
  <p class="note">A W3C Verifiable Credential receipt has been issued. Use the verify button below to check the entitlement.</p>
  <p style="margin-top:10px"><a class="cta" id="walletDl" download="zeusai-entitlement.json" href="/api/entitlements/${accessToken}/wallet.json" style="background:#f7931a;color:#05040a">💼 Add to wallet (VC)</a>
  <button type="button" class="cta" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)" id="verifyLink" data-live-inspect="/api/entitlements/${accessToken}" data-live-title="Verify entitlement">🔎 Verify entitlement</button>
  <button type="button" class="cta" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)" id="deliveryLink" data-live-inspect="/api/delivery/${orderId}?access_token=${accessToken}" data-live-title="Delivery package">📦 View delivery package</button></p>
  <p class="note" style="margin-top:8px">Delivery is processing automatically. The delivery link above will show your artifacts once ready.</p>
  <div style="margin-top:14px;padding-top:12px;border-top:1px dashed #165232">
    <p style="margin:0 0 6px"><b>🎁 Gift this service</b></p>
    <p class="note" style="margin:0 0 8px">Mint a signed redemption code — recipient gets ZeusAI on you. Public endpoint, no login.</p>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <input id="giftFrom" type="email" placeholder="Your email" style="flex:1;min-width:160px;background:#14132a;border:1px solid var(--line);color:var(--fg);padding:8px 10px;border-radius:8px;font-size:13px"/>
      <input id="giftTo" type="email" placeholder="Recipient email (optional)" style="flex:1;min-width:180px;background:#14132a;border:1px solid var(--line);color:var(--fg);padding:8px 10px;border-radius:8px;font-size:13px"/>
      <button type="button" class="cta" id="giftBtn" style="background:#8a5cff;color:#fff">Mint gift code →</button>
    </div>
    <div id="giftOut" class="note" style="margin-top:8px"></div>
  </div>
</div>

<footer>Settlement: direct on-chain to owner wallet · No custodian · 30Y-LTS sovereign commerce · ${escapeHtml(OWNER_DOMAIN)}</footer>
</div>
${require('./live-inspect-bootstrap').scriptTag().replace('<script>', `<script${nonceAttr}>`)}
<script${nonceAttr}>
(function(){
  var TOK='${accessTokenJs}';
  var ORDER_ID='${orderIdJs}';
  var expSec=${expiresIn};
  function copy(s){try{navigator.clipboard&&navigator.clipboard.writeText(s)}catch(e){}}
  document.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest&&ev.target.closest('button.copy[data-copy]');
    if(b){copy(b.getAttribute('data-copy'));}
  });
  setInterval(function(){if(expSec>0){expSec--;var cd=document.getElementById('cd');if(cd)cd.textContent=expSec+'s';}},1000);
  function poll(){
    fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/status',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var s=document.getElementById('st');
      if(s){s.className='status '+(j.status||'pending');s.textContent=j.status||'pending';}
      var wait=document.getElementById('confirmWait');
      var confs=Number((j&&j.confirmations)||0), req=Number((j&&j.confs_required)||0);
      var hasTx=!!(j&&j.txids&&j.txids.length);
      if(wait){
        var waiting=(j.status==='pending' && (confs>0 || (req>0 && hasTx)));
        wait.classList.toggle('on', waiting);
        var wt=document.getElementById('confirmWaitText');
        if(wt&&waiting) wt.textContent='Transaction seen: '+confs+'/'+req+' confirmations. Delivery unlocks automatically when confirmed.';
      }
      if(j.status==='paid'){
        var g=document.getElementById('grant');if(g)g.classList.add('on');
        var tk=document.getElementById('tok');if(tk)tk.textContent=TOK;
        var en=document.getElementById('ent');if(en)en.textContent=j.entitlement_id||'—';
        var tx=document.getElementById('tx');if(tx)tx.textContent=(j.txids&&j.txids[0])||'—';
        var dl=document.getElementById('walletDl');if(dl){dl.href='/api/entitlements/'+encodeURIComponent(TOK)+'/wallet.json';}
        var v=document.getElementById('verifyLink');if(v){v.setAttribute('data-live-inspect','/api/entitlements/'+encodeURIComponent(TOK));}
        var del=document.getElementById('deliveryLink');if(del){del.setAttribute('data-live-inspect','/api/delivery/'+encodeURIComponent(ORDER_ID)+'?access_token='+encodeURIComponent(TOK));}
        return;
      }
      if(j.status==='expired')return;
      setTimeout(poll,5000);
    }).catch(function(){setTimeout(poll,5000);});
  }
  poll();
  function setAltMsg(t){var el=document.getElementById('altRailsMsg');if(el)el.textContent=t;}
  var payPaypalBtn=document.getElementById('payPaypalBtn');
  if(payPaypalBtn){payPaypalBtn.addEventListener('click',function(){
    setAltMsg('Creating PayPal order…');
    fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/paypal/create',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ access_token: TOK })
    }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});}).then(function(res){
      if(!res.ok || !(res.j&&res.j.approveHref)){ setAltMsg((res.j&&(res.j.detail||res.j.error))||'PayPal unavailable'); return; }
      setAltMsg('Redirecting to PayPal…');
      window.location.href = res.j.approveHref;
    }).catch(function(e){ setAltMsg('PayPal error: '+(e&&e.message||e)); });
  });}
  var payNowBtn=document.getElementById('payNowBtn');
  if(payNowBtn){payNowBtn.addEventListener('click',function(){
    setAltMsg('Creating NOWPayments invoice…');
    fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/nowpayments/create',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ access_token: TOK, payCurrency: 'any' })
    }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});}).then(function(res){
      if(!res.ok || !(res.j&&res.j.invoiceUrl)){ setAltMsg((res.j&&(res.j.detail||res.j.error))||'NOWPayments unavailable'); return; }
      setAltMsg('Redirecting to NOWPayments…');
      window.location.href = res.j.invoiceUrl;
    }).catch(function(e){ setAltMsg('NOWPayments error: '+(e&&e.message||e)); });
  });}
  try {
    var qs = new URLSearchParams(window.location.search||'');
    if(qs.get('paypal')==='return'){
      var token = qs.get('token') || qs.get('PayerID') || '';
      setAltMsg('Capturing PayPal payment…');
      fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/paypal/capture',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ access_token: TOK, paypalOrderId: token || undefined })
      }).then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){ setAltMsg('PayPal payment captured — activating…'); poll(); }
        else setAltMsg((j&&(j.detail||j.error))||'PayPal capture pending — webhook will settle shortly.');
      }).catch(function(){ setAltMsg('PayPal capture pending — keep this page open.'); });
    } else if(qs.get('np')==='success'){
      setAltMsg('NOWPayments return received — waiting for IPN settle…');
    }
  } catch(_){}
  var saveEmailBtn=document.getElementById('saveEmailBtn');
  if(saveEmailBtn){saveEmailBtn.addEventListener('click',function(){
    var inp=document.getElementById('deliveryEmail');
    var msg=document.getElementById('emailSaveMsg');
    var email=String((inp&&inp.value)||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ if(msg) msg.textContent='Enter a valid email.'; return; }
    fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/email',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ email: email, access_token: TOK })
    }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});}).then(function(res){
      if(!res.ok){ if(msg) msg.textContent=(res.j&&res.j.error)||'Could not save email'; return; }
      var lab=document.getElementById('buyerEmailLabel'); if(lab) lab.textContent=email;
      var card=document.getElementById('emailCaptureCard'); if(card) card.style.display='none';
      if(msg) msg.textContent='Email saved for delivery.';
    }).catch(function(e){ if(msg) msg.textContent='Save failed: '+(e&&e.message||e); });
  });}
  var gb=document.getElementById('giftBtn');
  if(gb){gb.addEventListener('click',function(){
    var out=document.getElementById('giftOut');
    var payload={ sku:'${jsStringEscape(o.serviceId || '')}', valueUsd:${Number(o.subtotal_fiat || 0)}, fromEmail:(document.getElementById('giftFrom')||{}).value||'', toEmail:(document.getElementById('giftTo')||{}).value||'', message:'Use ZeusAI on me', paidOrderId:ORDER_ID, accessToken:TOK };
    fetch('/api/gift/mint',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json();}).then(function(d){
      if(!out) return;
      if(d && d.ok!==false && d.code){ var url=location.origin+(d.redeemUrl||('/gift?c='+d.code)); out.innerHTML='<b>'+d.code+'</b> — share: <code>'+url+'</code>'; }
      else { out.textContent='Could not mint gift'+(d&&d.error?(': '+d.error):' — pay first, then mint'); }
    }).catch(function(e){ if(out) out.textContent='Gift mint failed: '+(e&&e.message||e); });
  });}
})();
</script></body></html>`;
}

// Escape a string for safe embedding inside a JavaScript single-quoted string
// literal. Prevents `</script>` and quote-injection breakouts and also blocks
// U+2028 / U+2029, which terminate JS lines but not HTML strings.
function jsStringEscape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/\u0000/g, '\\u0000');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Handler ─────────────────────────────────────────────────────────────────
async function handle(req, res, ctx) {
  const url = (req.url || '/').split('?')[0];

  // --- /api/checkout/create -------------------------------------------------
  if (url === '/api/checkout/create' && req.method === 'POST') {
    // ── #3 Idempotency-Key (forward-only): if the client sends an
    //    Idempotency-Key header, replay the prior 201 response for 24h
    //    instead of allocating a NEW BTC amount. Critical for sovereign
    //    BTC checkout where double-click would otherwise create two
    //    distinct receive addresses and fragment funds. Standards-aligned
    //    with Stripe / IETF draft-ietf-httpapi-idempotency-key.
    //
    //    The idempotency check is headers-only, so it runs BEFORE the rate
    //    limiter: a cached replay is not a "new" request and must never be
    //    throttled with a 429 (a retrying client would otherwise be told to
    //    back off from a response we already have on hand).
    const idemKey = String(req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || '').slice(0, 128);
    if (idemKey) {
      const cached = _idempotencyGet(idemKey);
      if (cached) {
        return sendJson(res, cached.statusCode, cached.body, { 'Idempotent-Replay': '1' }), true;
      }
    }
    // Defense-in-depth: per-IP token bucket in front of order allocation.
    // Applied only after the idempotency replay short-circuit above.
    if (!_RATE_LIMIT_DISABLED && _checkoutLimiter) {
      const verdict = _checkoutLimiter(_clientIp(req));
      if (!verdict.ok) {
        return sendJson(res, 429, { error: 'rate_limited', retryAfter: verdict.retryAfter }, { 'Retry-After': String(verdict.retryAfter) }), true;
      }
    }
    const body = await readBody(req);
    const out = await createOrder(ctx, body);
    if (out.error) {
      return sendJson(res, out.status || 400, {
        error: out.error,
        reason: out.reason || undefined,
        mode: out.mode || undefined,
        contactHref: out.contactHref || undefined,
        serviceId: out.serviceId,
      }), true;
    }
    try {
      const tx = require('../commerce/transactional-email');
      const buyerEmail = String(out.order && out.order.buyer && out.order.buyer.email || '').trim().toLowerCase();
      if (tx && typeof tx.sendTransactional === 'function' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
        Promise.resolve(tx.sendTransactional({
          to: buyerEmail,
          template: 'payment_pending',
          data: {
            orderId: out.order.orderId,
            checkout_url: out.order.checkout_url,
            amount_btc: out.order.amount_btc,
            btcAmount: out.order.amount_btc,
            btcAddress: out.order.receive_address || OWNER_BTC,
            serviceName: out.order.serviceName,
            priceUSD: out.order.subtotal_fiat
          }
        })).catch(() => {});
      }
    } catch (_) {}
    if (idemKey) _idempotencySet(idemKey, 201, out.order);
    return sendJson(res, 201, out.order), true;
  }

  // --- /checkout/:orderId (HTML) -------------------------------------------
  // CRITICAL: render the HTML BEFORE calling writeHead so any template error
  // (see historical `${TOK}` ReferenceError) surfaces as a 500 with a proper
  // body instead of a half-written response that later throws
  // ERR_HTTP_HEADERS_SENT and hangs the connection through nginx.
  const mCheckout = url.match(/^\/checkout\/([a-zA-Z0-9_-]{6,64})$/);
  if (mCheckout && req.method === 'GET') {
    const order = ORDERS.get(mCheckout[1]);
    if (!order) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Order not found'); return true; }
    let html;
    try {
      const nonce = (ctx && ctx.nonce) || String(req.headers['x-csp-nonce'] || '');
      html = checkoutHtml(order, { nonce });
    } catch (e) {
      console.warn('[commerce] checkoutHtml render error for ' + mCheckout[1] + ':', e && e.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Checkout page temporarily unavailable — order ' + mCheckout[1] + ' exists; please refresh.');
      }
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Unicorn-Commerce': '1' });
    res.end(html);
    _fireFunnel('checkout_open', { serviceId: order.serviceId, value: order.subtotal_fiat });
    _metricInc('checkout_open');
    return true;
  }

  // --- /api/checkout/:orderId/qr.svg → first-party QR renderer -------------
  const mQr = url.match(/^\/api\/checkout\/([a-zA-Z0-9_-]{6,64})\/qr\.svg$/);
  if (mQr && req.method === 'GET') {
    const order = ORDERS.get(mQr[1]);
    if (!order) { res.writeHead(404); res.end(); return true; }
    const svg = await qrSvg(order.bip21);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
    res.end(svg); return true;
  }

  // --- /api/order/:orderId/email (attach delivery email after invoice mint) -
  const mEmail = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/email$/);
  if (mEmail && req.method === 'POST') {
    const order = ORDERS.get(mEmail[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    const body = await readBody(req);
    const token = String((body && body.access_token) || '').trim();
    if (!token || token !== String(order.access_token || '')) {
      return sendJson(res, 401, { error: 'invalid_access_token' }), true;
    }
    const nextEmail = String((body && body.email) || '').trim().toLowerCase().slice(0, 254);
    if (!EMAIL_RE.test(nextEmail)) return sendJson(res, 400, { error: 'invalid_email' }), true;
    order.buyer = order.buyer || {};
    order.buyer.email = nextEmail;
    persistOrder(order);
    return sendJson(res, 200, { ok: true, orderId: order.orderId, email: nextEmail }), true;
  }

  // --- /api/order/:orderId/paypal/create — optional PayPal rail (BTC remains primary)
  const mPaypalCreate = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/paypal\/create$/);
  if (mPaypalCreate && req.method === 'POST') {
    const order = ORDERS.get(mPaypalCreate[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    if (order.status !== 'pending') return sendJson(res, 409, { error: 'order_not_pending', status: order.status }), true;
    const body = await readBody(req);
    const token = String((body && body.access_token) || '').trim();
    if (!token || token !== String(order.access_token || '')) {
      return sendJson(res, 401, { error: 'invalid_access_token' }), true;
    }
    try {
      const alt = require('../commerce/alt-rails-os');
      if (!alt.isPaypalArmed()) return sendJson(res, 503, { error: 'paypal_not_configured' }), true;
      const created = await alt.createPaypalOrderForSovereign(order);
      order.meta = Object.assign({}, order.meta || {}, {
        paypalOrderId: created.paypalOrderId,
        paypalApproveHref: created.approveHref,
      });
      persistOrder(order);
      return sendJson(res, 200, created), true;
    } catch (e) {
      return sendJson(res, 502, { error: 'paypal_create_failed', detail: String(e && e.message || e).slice(0, 200) }), true;
    }
  }

  // --- /api/order/:orderId/paypal/capture — after buyer returns from PayPal
  const mPaypalCapture = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/paypal\/capture$/);
  if (mPaypalCapture && req.method === 'POST') {
    const order = ORDERS.get(mPaypalCapture[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    const body = await readBody(req);
    const token = String((body && body.access_token) || '').trim();
    if (!token || token !== String(order.access_token || '')) {
      return sendJson(res, 401, { error: 'invalid_access_token' }), true;
    }
    if (order.status === 'paid') {
      return sendJson(res, 200, { ok: true, duplicate: true, orderId: order.orderId, status: 'paid' }), true;
    }
    try {
      const alt = require('../commerce/alt-rails-os');
      const paypalOrderId = String((body && body.paypalOrderId) || (order.meta && order.meta.paypalOrderId) || '').trim();
      const cap = await alt.capturePaypalOrder(paypalOrderId);
      const captureCustomId = String(cap.custom_id || cap.customId || '').trim();
      const captureReferenceId = String(cap.reference_id || cap.referenceId || '').trim();
      if (captureCustomId !== order.orderId && captureReferenceId !== order.orderId) {
        throw new Error('paypal_capture_order_mismatch');
      }
      const expectedAmount = Number(order.subtotal_fiat || 0);
      const capturedAmount = Number(cap.amount);
      if (!Number.isFinite(capturedAmount) || Math.abs(capturedAmount - expectedAmount) > 0.01) {
        throw new Error('paypal_capture_amount_mismatch');
      }
      const expectedCurrency = String(order.currency || 'USD').toUpperCase();
      if (String(cap.currency || '').toUpperCase() !== expectedCurrency) {
        throw new Error('paypal_capture_currency_mismatch');
      }
      const settled = markOrderPaidFromProvider(order.orderId, {
        provider: 'paypal',
        providerRef: cap.captureId || paypalOrderId,
        paypalOrderId,
        meta: {
          captureStatus: cap.status,
          amount: cap.amount,
          currency: cap.currency,
          custom_id: cap.custom_id || null,
          reference_id: cap.reference_id || null,
        },
      });
      return sendJson(res, settled.ok ? 200 : 409, settled), true;
    } catch (e) {
      const code = /incomplete|not_configured|invalid_|mismatch|missing/.test(String(e && e.message || '')) ? 402 : 502;
      return sendJson(res, code, { error: 'paypal_capture_failed', detail: String(e && e.message || e).slice(0, 200) }), true;
    }
  }

  // --- /api/order/:orderId/nowpayments/create — hosted invoice redirect
  const mNpCreate = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/nowpayments\/create$/);
  if (mNpCreate && req.method === 'POST') {
    const order = ORDERS.get(mNpCreate[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    if (order.status !== 'pending') return sendJson(res, 409, { error: 'order_not_pending', status: order.status }), true;
    const body = await readBody(req);
    const token = String((body && body.access_token) || '').trim();
    if (!token || token !== String(order.access_token || '')) {
      return sendJson(res, 401, { error: 'invalid_access_token' }), true;
    }
    try {
      const alt = require('../commerce/alt-rails-os');
      if (!alt.isNowPaymentsArmed()) return sendJson(res, 503, { error: 'nowpayments_not_configured' }), true;
      const created = await alt.createNowPaymentsInvoiceForSovereign(order, {
        payCurrency: (body && body.payCurrency) || 'any',
      });
      order.meta = Object.assign({}, order.meta || {}, {
        nowpaymentsInvoiceId: created.invoiceId,
        nowpaymentsInvoiceUrl: created.invoiceUrl,
      });
      persistOrder(order);
      return sendJson(res, 200, created), true;
    } catch (e) {
      return sendJson(res, 502, { error: 'nowpayments_create_failed', detail: String(e && e.message || e).slice(0, 200) }), true;
    }
  }

  // --- /api/order/:orderId/provider-settle — internal webhook bridge (PayPal IPN / NOW IPN)
  const mProviderSettle = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/provider-settle$/);
  if (mProviderSettle && req.method === 'POST') {
    const order = ORDERS.get(mProviderSettle[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    const body = await readBody(req);
    const expected = process.env.INTERNAL_SETTLE_SECRET || process.env.COMMERCE_ADMIN_SECRET || process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || '';
    const provided = String(req.headers['x-internal-settle-secret'] || req.headers['x-admin-secret'] || (body && body.settleSecret) || '');
    const token = String((body && body.access_token) || '').trim();
    const tokenOk = !!(token && token === String(order.access_token || ''));
    const secretOk = !!(expected && provided && provided === expected);
    if (!tokenOk && !secretOk) {
      return sendJson(res, 401, { error: 'unauthorized', honesty: 'provider_settle_requires_internal_secret_or_access_token' }), true;
    }
    const hasAmount = body && body.amountUsd != null && String(body.amountUsd).trim() !== '';
    if (hasAmount) {
      const expectedAmount = Number(order.subtotal_fiat || 0);
      const amountUsd = Number(body.amountUsd);
      if (!Number.isFinite(amountUsd) || Math.abs(amountUsd - expectedAmount) > 0.05) {
        return sendJson(res, 402, {
          error: 'provider_amount_mismatch',
          expectedAmountUsd: expectedAmount,
          receivedAmountUsd: Number.isFinite(amountUsd) ? amountUsd : null,
        }), true;
      }
    }
    const meta = Object.assign({}, (body && body.meta) || {});
    if (body && body.invoiceId) meta.invoiceId = String(body.invoiceId).slice(0, 128);
    const settled = markOrderPaidFromProvider(order.orderId, {
      provider: (body && body.provider) || 'alt-rail',
      providerRef: (body && (body.providerRef || body.txid || body.paymentId || body.paypalOrderId)) || null,
      confirmations: (body && body.confirmations) || 1,
      meta,
    });
    return sendJson(res, settled.ok ? 200 : 409, settled), true;
  }

  // --- /api/order/:orderId/provider-revoke — refund/chargeback bridge
  const mProviderRevoke = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/provider-revoke$/);
  if (mProviderRevoke && req.method === 'POST') {
    const order = ORDERS.get(mProviderRevoke[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    const body = await readBody(req);
    const expected = process.env.INTERNAL_SETTLE_SECRET || process.env.COMMERCE_ADMIN_SECRET || process.env.ADMIN_SECRET || process.env.ADMIN_TOKEN || '';
    const provided = String(req.headers['x-internal-settle-secret'] || req.headers['x-admin-secret'] || (body && body.settleSecret) || '');
    if (!expected || !provided || provided !== expected) {
      return sendJson(res, 401, { error: 'unauthorized' }), true;
    }
    const revoked = revokeOrderFromProvider(order.orderId, {
      provider: (body && body.provider) || 'alt-rail',
      providerRef: (body && (body.providerRef || body.paymentId || body.paypalOrderId)) || null,
      reason: (body && body.reason) || 'provider_refund',
    });
    return sendJson(res, revoked.ok ? 200 : 409, revoked), true;
  }

  // --- /api/order/:orderId/status -----------------------------------------
  const mStatus = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/status$/);
  if (mStatus && req.method === 'GET') {
    const order = ORDERS.get(mStatus[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    const slim = {
      orderId: order.orderId,
      status: order.status,
      service: { id: order.serviceId, name: order.serviceName },
      amount_sats: order.amount_sats,
      amount_btc: order.amount_btc,
      currency: order.currency,
      subtotal_fiat: order.subtotal_fiat,
      receive_address: order.receive_address,
      expires_at: order.expires_at,
      paid_at: order.paid_at,
      txids: order.txids || [],
      paid_via: order.paid_via || null,
      confs_required: Number(order.confs_required != null ? order.confs_required : requiredConfsForUsd(order.subtotal_fiat || 0)),
      confirmations: Number(order.confirmations || 0),
      provider_refs: paymentProviderRefs(order),
      payment_exception: latestPaymentExceptionForOrder(order.orderId),
      tx_seen: !!(order.tx_seen || (order.txids && order.txids.length)),
      entitlement_id: order.entitlement_id || null,
      bip21: order.bip21,
      checkout_url: order.checkout_url,
    };
    return sendJson(res, 200, slim), true;
  }

  // ─── C6: signed receipt — JSON + HTML, verifiable offline ─────────────
  // /api/order/:id/receipt.json  → canonical receipt with Ed25519 signature
  // /checkout/:id/receipt        → printable HTML receipt
  // Uses the same Ed25519 site signing key (sign(...) helper above).
  const mReceiptJson = url.match(/^\/api\/order\/([a-zA-Z0-9_-]{6,64})\/receipt\.json$/);
  if (mReceiptJson && req.method === 'GET') {
    const order = ORDERS.get(mReceiptJson[1]);
    if (!order) return sendJson(res, 404, { error: 'order_not_found' }), true;
    if (order.status !== 'paid') return sendJson(res, 409, { error: 'order_not_paid', status: order.status }), true;
    const canonical = {
      type: 'unicorn-receipt-v1',
      orderId: order.orderId,
      service: { id: order.serviceId, name: order.serviceName },
      amount: { sats: order.amount_sats, btc: order.amount_btc, fiat: order.subtotal_fiat, currency: order.currency },
      buyer: order.buyer,
      paid_at: order.paid_at,
      paid_via: order.paid_via || 'btc',
      txids: order.txids || [],
      provider_refs: paymentProviderRefs(order),
      entitlement_id: order.entitlement_id || null,
      issuer: { did: `did:web:${OWNER_DOMAIN.replace(/^https?:\/\//, '')}`, name: OWNER_NAME, btcAddress: order.receive_address },
    };
    const sig = sign(canonical);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return sendJson(res, 200, {
      ...canonical,
      signature: sig ? { alg: 'ed25519', sig, encoding: 'base64' } : null,
      verifyHint: 'sha256(canonical_json) signed with site Ed25519 key — fetch /.well-known/keys.json or /api/v50/keys.json for public key.',
    }), true;
  }
  const mReceiptHtml = url.match(/^\/checkout\/([a-zA-Z0-9_-]{6,64})\/receipt$/);
  if (mReceiptHtml && req.method === 'GET') {
    const order = ORDERS.get(mReceiptHtml[1]);
    if (!order) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Order not found'); return true; }
    if (order.status !== 'paid') { res.writeHead(409, { 'Content-Type': 'text/plain' }); res.end('Order not paid yet'); return true; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt — ${escapeHtml(order.orderId)}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:640px;margin:2em auto;padding:0 1em;color:#222}h1{border-bottom:2px solid #000}dt{font-weight:600;margin-top:.6em}dd{margin:0 0 .4em 0}.sig{font-family:monospace;font-size:.75em;word-break:break-all;background:#f4f4f4;padding:.6em;border-radius:6px}@media print{body{margin:0}}</style></head>
<body><h1>🦄 Unicorn — Receipt</h1>
<dl>
<dt>Order ID</dt><dd>${escapeHtml(order.orderId)}</dd>
<dt>Service</dt><dd>${escapeHtml(order.serviceName)} (${escapeHtml(order.serviceId)})</dd>
<dt>Amount</dt><dd>${escapeHtml(String(order.amount_btc))} BTC ≈ ${escapeHtml(String(order.subtotal_fiat))} ${escapeHtml(order.currency)}</dd>
<dt>Paid at</dt><dd>${escapeHtml(order.paid_at || '')}</dd>
<dt>TXIDs</dt><dd>${(order.txids || []).map(t => `<code>${escapeHtml(t)}</code>`).join('<br>') || '—'}</dd>
<dt>Entitlement</dt><dd><code>${escapeHtml(order.entitlement_id || '—')}</code></dd>
<dt>Issuer</dt><dd>${escapeHtml(OWNER_NAME)} · did:web:${escapeHtml(OWNER_DOMAIN.replace(/^https?:\/\//, ''))}</dd>
</dl>
<details><summary>🔐 Cryptographic signature (Ed25519)</summary>
<p class="sig" id="sig-data">—</p>
<p><a href="/checkout/${escapeHtml(order.orderId)}/receipt" target="_blank" rel="noopener">Open HTML receipt</a> · <a href="/docs#keys" target="_blank" rel="noopener">Public key</a></p></details>
<script>fetch('/api/order/${escapeHtml(order.orderId)}/receipt.json').then(r=>r.json()).then(d=>{document.getElementById('sig-data').textContent=JSON.stringify(d.signature,null,2)}).catch(()=>{var el=document.getElementById('sig-data');if(el){el.textContent='Signature unavailable — refresh or download the signed JSON below.';}});</script>
</body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'X-Unicorn-Receipt': '1' });
    res.end(html);
    return true;
  }

  const mEnt = url.match(/^\/api\/entitlements\/([a-zA-Z0-9_-]{8,128})$/);
  if (mEnt && req.method === 'GET') {
    const token = mEnt[1];
    let found = null;
    for (const o of ORDERS.values()) {
      if (o.access_token === token && o.status === 'paid') { found = o; break; }
    }
    if (!found) return sendJson(res, 404, { valid: false, reason: 'not_found_or_unpaid' }), true;
    return sendJson(res, 200, {
      valid: true,
      orderId: found.orderId,
      service: { id: found.serviceId, name: found.serviceName },
      buyer: found.buyer,
      granted_at: found.paid_at,
      entitlement_id: found.entitlement_id,
      valid_until: found.valid_until || null,
      preorder: !!found.preorder,
      txid: (found.txids || [])[0] || null,
      signature: found.signature,
      issuer: { did: `did:web:${OWNER_DOMAIN.replace(/^https?:\/\//, '')}`, name: OWNER_NAME },
      // Discoverability — wallet-importable W3C VC + Apple Wallet/Google Wallet pass.
      add_to_wallet_url: `${OWNER_DOMAIN}/api/entitlements/${token}/wallet.json`,
    }), true;
  }

  // --- /api/entitlements/:token/wallet.json — W3C VC download ("Add to wallet") --
  // Returns a Verifiable Credential (JSON-LD) with Content-Disposition: attachment
  // so any wallet that supports VC import (or even the OS download dialog) can
  // store the proof-of-purchase off-server. Includes Ed25519 proof from the order.
  const mWallet = url.match(/^\/api\/entitlements\/([a-zA-Z0-9_-]{8,128})\/wallet\.json$/);
  if (mWallet && req.method === 'GET') {
    const token = mWallet[1];
    let found = null;
    for (const o of ORDERS.values()) {
      if (o.access_token === token && o.status === 'paid') { found = o; break; }
    }
    if (!found) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not_found_or_unpaid' })); return true; }
    const issuerDid = `did:web:${OWNER_DOMAIN.replace(/^https?:\/\//, '')}`;
    const txid = (found.txids || [])[0] || null;
    const vc = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'ProofOfPurchaseCredential'],
      id: `urn:zeusai:entitlement:${found.entitlement_id}`,
      issuer: { id: issuerDid, name: OWNER_NAME },
      issuanceDate: found.paid_at || new Date().toISOString(),
      expirationDate: found.valid_until || undefined,
      credentialSubject: {
        id: `urn:zeusai:order:${found.orderId}`,
        accessToken: token,
        service: { id: found.serviceId, name: found.serviceName },
        preorder: !!found.preorder,
        amount_sats: found.amount_sats,
        amount_btc: found.amount_btc,
        currency: found.currency,
        subtotal_fiat: found.subtotal_fiat,
        bitcoinTxId: txid,
        proofUrl: proofUrlForOrder(found, txid),
        receiveAddress: found.receive_address,
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: found.created_at,
        proofPurpose: 'assertionMethod',
        verificationMethod: `${issuerDid}#owner-ed25519`,
        proofValue: found.signature,
      },
    };
    if (!vc.expirationDate) delete vc.expirationDate;
    const filename = `zeusai-entitlement-${found.entitlement_id}.json`;
    res.writeHead(200, {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(vc, null, 2));
    return true;
  }

  // --- /api/commerce/price -------------------------------------------------
  if (url === '/api/commerce/price' && req.method === 'GET') {
    const p = await getBtcPrice();
    return sendJson(res, 200, {
      btc_usd: p.usd, btc_eur: p.eur, source: p.source,
      fetched_at: new Date(p.fetchedAt).toISOString(),
      fresh_seconds: Math.round((Date.now() - p.fetchedAt) / 1000),
    }, { 'Cache-Control': 'public, max-age=60' }), true;
  }

  // --- /api/admin/owner-revenue --------------------------------------------
  // Live owner-wallet revenue dashboard data: queries mempool.space directly
  // for confirmed balance + last 50 transactions to bc1q4f… and merges with
  // local order ledger so the dashboard tab can show "received vs invoiced".
  // Public-readable (the address is published on the trust page anyway) but
  // contains no buyer PII — only on-chain data + service ids from local orders.
  if (url === '/api/admin/owner-revenue' && req.method === 'GET') {
    let chain = null;
    let txs = [];
    try {
      const stats = await httpJson(`${MEMPOOL_BASE}/address/${OWNER_BTC}`, 6000).catch(() => null);
      if (stats && stats.chain_stats) {
        chain = {
          confirmed_received_sats: Number(stats.chain_stats.funded_txo_sum || 0),
          confirmed_spent_sats:    Number(stats.chain_stats.spent_txo_sum  || 0),
          confirmed_balance_sats:  Number(stats.chain_stats.funded_txo_sum || 0) - Number(stats.chain_stats.spent_txo_sum || 0),
          tx_count:                Number(stats.chain_stats.tx_count      || 0),
          mempool_received_sats:   Number((stats.mempool_stats || {}).funded_txo_sum || 0),
        };
      }
      const list = await httpJson(`${MEMPOOL_BASE}/address/${OWNER_BTC}/txs`, 8000).catch(() => null);
      if (Array.isArray(list)) {
        txs = list.slice(0, 50).map((tx) => {
          let inSats = 0;
          for (const v of (tx.vout || [])) { if (v && v.scriptpubkey_address === OWNER_BTC) inSats += Number(v.value || 0); }
          // Cross-reference with local order ledger to attribute sales by service.
          let attribution = null;
          for (const o of ORDERS.values()) {
            if (o.txids && o.txids.includes(tx.txid)) {
              attribution = { orderId: o.orderId, serviceId: o.serviceId, serviceName: o.serviceName, preorder: !!o.preorder };
              break;
            }
          }
          return {
            txid: tx.txid,
            confirmed: !!(tx.status && tx.status.confirmed),
            block_height: (tx.status && tx.status.block_height) || null,
            block_time: (tx.status && tx.status.block_time) || null,
            received_sats: inSats,
            attribution,
            proof_url: `https://mempool.space/tx/${tx.txid}`,
          };
        });
      }
    } catch (_) { /* mempool.space outage — return what we have */ }
    // Local ledger summary (always available even if mempool.space is unreachable).
    const orders = Array.from(ORDERS.values());
    const ledger = {
      total_orders:    orders.length,
      paid_orders:     orders.filter((o) => o.status === 'paid').length,
      pending_orders:  orders.filter((o) => o.status === 'pending').length,
      preorders_paid:  orders.filter((o) => o.status === 'paid' && o.preorder).length,
      paid_sats:       orders.filter((o) => o.status === 'paid').reduce((s, o) => s + (o.paid_sats_observed || o.amount_sats || 0), 0),
    };
    return sendJson(res, 200, {
      receive_address: OWNER_BTC,
      owner: OWNER_NAME,
      mempool_base: MEMPOOL_BASE,
      chain,
      ledger,
      transactions: txs,
      generated_at: new Date().toISOString(),
    }, { 'Cache-Control': 'no-store' }), true;
  }

  // --- /api/commerce/recent-sales ------------------------------------------
  // Public, anonymized list of paid orders for the home-page revenue ticker.
  // Each entry includes a mempool.space tx proof URL so buyers can verify
  // settlement on-chain. No buyer email or PII is exposed.
  if (url === '/api/commerce/recent-sales' && req.method === 'GET') {
    const qs = (req.url.split('?')[1] || '');
    const lm = qs.match(/limit=(\d+)/);
    const limit = Math.max(1, Math.min(50, lm ? +lm[1] : 10));
    const paid = [];
    for (const o of ORDERS.values()) {
      if (o.status !== 'paid') continue;
      const txid = (o.txids || [])[0] || null;
      paid.push({
        orderId: o.orderId,
        service: { id: o.serviceId, name: o.serviceName },
        paid_at: o.paid_at,
        paid_via: o.paid_via || 'btc',
        amount_btc: o.amount_btc,
        amount_sats: o.amount_sats,
        currency: o.currency,
        subtotal_fiat: o.subtotal_fiat,
        txid,
        provider_refs: paymentProviderRefs(o),
        proof_url: proofUrlForOrder(o, txid),
      });
    }
    paid.sort((a, b) => String(b.paid_at || '').localeCompare(String(a.paid_at || '')));
    return sendJson(res, 200, {
      receive_address: OWNER_BTC,
      total_paid: paid.length,
      sales: paid.slice(0, limit),
    }, { 'Cache-Control': 'public, max-age=15' }), true;
  }

  // --- /api/catalog/diff?since_hours=168 -----------------------------------
  // Returns catalog item ids first observed in the last N hours so the UI
  // can surface a "🆕 New this week" section. The watcher updates first-seen
  // timestamps every time a snapshot or master catalog is fetched (see
  // `commerce.recordCatalogItems`). Default window: 7 days.
  if (url === '/api/catalog/diff' && req.method === 'GET') {
    const params = (req.url.split('?')[1] || '');
    const m = params.match(/since_hours=(\d+)/);
    const sinceHours = Math.max(1, Math.min(24 * 30, m ? +m[1] : 168));
    const cutoff = Date.now() - sinceHours * 3600 * 1000;
    const newIds = [];
    for (const [id, ts] of CATALOG_SEEN) {
      if (ts >= cutoff) newIds.push({ id, firstSeenAt: new Date(ts).toISOString() });
    }
    newIds.sort((a, b) => String(b.firstSeenAt).localeCompare(String(a.firstSeenAt)));
    return sendJson(res, 200, {
      sinceHours,
      cutoff: new Date(cutoff).toISOString(),
      total_known: CATALOG_SEEN.size,
      newCount: newIds.length,
      items: newIds,
    }, { 'Cache-Control': 'public, max-age=60' }), true;
  }

  // --- /api/commerce/health -----------------------------------------------
  if (url === '/api/commerce/health' && req.method === 'GET') {
    const pending = Array.from(ORDERS.values()).filter((o) => o.status === 'pending').length;
    const paid = Array.from(ORDERS.values()).filter((o) => o.status === 'paid').length;
    let buyImmortal = null;
    try { buyImmortal = require('../commerce/buy-immortal').getStatus(); } catch (_) { buyImmortal = { ok: false }; }
    return sendJson(res, 200, {
      status: WATCH_STATE.lastScanOk ? 'ok' : 'degraded',
      receive_address: OWNER_BTC,
      watch: WATCH_STATE,
      watch_interval_ms: WATCH_MS,
      orders: { total: ORDERS.size, pending, paid },
      mempool_base: MEMPOOL_BASE,
      order_ttl_min: ORDER_TTL_MS / 60000,
      min_confirmations: MIN_CONFS,
      buyImmortal,
    }), true;
  }

  // --- /api/commerce/integrity (ESOS money-path verifier) -----------------
  // Reads orders.jsonl + entitlements.jsonl from the commerce data dir and
  // validates entitlement signatures + invariants. No buyer PII in the body.
  if (url === '/api/commerce/integrity' && req.method === 'GET') {
    let result;
    try {
      const integrity = require('./commerce-integrity');
      result = integrity.verify({ dataDir: DATA_DIR });
    } catch (e) {
      return sendJson(res, 500, { ok: false, protocol: 'ESOS/1.0', error: 'integrity_verifier_unavailable' }), true;
    }
    _metricInc(result && result.ok ? 'integrity_ok' : 'integrity_fail');
    return sendJson(res, 200, result, { 'Cache-Control': 'no-store' }), true;
  }

  // --- /api/commerce/metrics (public-safe real counters) ------------------
  if (url === '/api/commerce/metrics' && req.method === 'GET') {
    const snap = _metrics ? _metrics.json() : { ok: false, protocol: 'ESOS/1.0', error: 'metrics_unavailable' };
    return sendJson(res, 200, snap, { 'Cache-Control': 'no-store' }), true;
  }

  // --- /metrics/commerce (Prometheus text exposition, optional) -----------
  if (url === '/metrics/commerce' && req.method === 'GET') {
    const text = _metrics ? _metrics.promText() : '';
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(text);
    return true;
  }

  // --- /api/commerce/funnel (public conversion counters) ------------------
  if (url === '/api/commerce/funnel' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      create: _commerceFunnel.create,
      open: _commerceFunnel.open,
      paid: _commerceFunnel.paid,
      ts: new Date().toISOString(),
    }, { 'Cache-Control': 'no-store' }), true;
  }

  // --- /api/commerce/reconcile (admin-triggered manual scan) --------------
  if (url === '/api/commerce/reconcile' && req.method === 'POST') {
    if (ADMIN_SECRET) {
      const sig = String(req.headers['x-commerce-auth'] || '');
      const body = await readBody(req);
      const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(JSON.stringify(body || {})).digest('hex');
      if (!timingSafeEqHex(sig, expected)) return sendJson(res, 401, { error: 'unauthorized' }), true;
    }
    const out = await scanIncoming();
    return sendJson(res, 200, { ok: true, ...out, watch: WATCH_STATE }), true;
  }

  return false;
}

// ── Sovereign abandoned-checkout recovery (always-on, site process) ─────────
// Portal recovery agent only sees SQLite awaiting_payment. Primary money path
// is sovereign pending in ORDERS — recover those here with email + Telegram.
const _sovRecoverySent = new Map(); // orderId → ts
const SOV_RECOVERY_STUCK_MS = Math.max(5 * 60 * 1000, Number(process.env.SOVEREIGN_RECOVERY_STUCK_MS || 30 * 60 * 1000));
const SOV_RECOVERY_COOLDOWN_MS = 24 * 3600 * 1000;
const SOV_RECOVERY_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.SOVEREIGN_RECOVERY_INTERVAL_MS || 15 * 60 * 1000));

async function recoverStuckPending(opts) {
  const now = Date.now();
  const stuckAfter = Math.max(60 * 1000, Number((opts && opts.stuckAfterMs) || SOV_RECOVERY_STUCK_MS));
  const dryRun = !!(opts && opts.dryRun);
  const stuck = [];
  const sent = [];
  const skipped = [];
  for (const o of ORDERS.values()) {
    if (!o || o.status !== 'pending') continue;
    if (o.expires_at_ms && now >= o.expires_at_ms) continue;
    const created = Date.parse(o.created_at || '') || (o.expires_at_ms ? o.expires_at_ms - ORDER_TTL_MS : 0);
    const ageMs = now - created;
    if (!(ageMs >= stuckAfter)) continue;
    stuck.push(o);
  }
  let mailer = null;
  try { mailer = require('../commerce/transactional-email'); } catch (_) {}
  for (const o of stuck) {
    const last = _sovRecoverySent.get(o.orderId) || 0;
    if (now - last < SOV_RECOVERY_COOLDOWN_MS) { skipped.push({ orderId: o.orderId, reason: 'cooldown' }); continue; }
    if (dryRun) { skipped.push({ orderId: o.orderId, reason: 'dry_run' }); continue; }
    const buyerEmail = String((o.buyer && o.buyer.email) || '').trim().toLowerCase();
    let emailed = false;
    let emailReason = null;
    if (mailer && EMAIL_RE.test(buyerEmail)) {
      try {
        let r = null;
        if (typeof mailer.sendTransactional === 'function') {
          r = await mailer.sendTransactional({
            to: buyerEmail,
            template: 'payment_pending',
            data: {
              orderId: o.orderId,
              checkout_url: o.checkout_url,
              amount_btc: o.amount_btc,
              btcAmount: o.amount_btc,
              btcAddress: o.receive_address || OWNER_BTC,
              serviceName: o.serviceName,
              priceUSD: o.subtotal_fiat,
            },
          });
        } else if (typeof mailer.sendRaw === 'function') {
          const addr = o.receive_address || OWNER_BTC;
          r = await mailer.sendRaw({
            to: buyerEmail,
            subject: `Your ZeusAI order ${o.orderId} — payment still pending`,
            text: `Your order ${o.orderId} (${o.serviceName}) for $${o.subtotal_fiat} (≈ ${o.amount_btc} BTC) is still awaiting payment.\n\nSend exactly ${o.amount_btc} BTC to ${addr}.\n\nPay here: ${o.checkout_url}\n\n— ZeusAI`,
          });
        }
        // Phase 2 honesty: only count as sent when provider reports ok.
        emailed = !!(r && r.ok);
        if (!emailed) emailReason = (r && (r.reason || r.error || r.skipped)) || 'send_failed';
      } catch (sendErr) {
        emailed = false;
        emailReason = String(sendErr && sendErr.message || 'send_failed').slice(0, 80);
      }
    } else if (!EMAIL_RE.test(buyerEmail)) {
      emailReason = 'no_buyer_email';
    } else {
      emailReason = 'email_unconfigured';
    }
    let telegramed = false;
    // Owner Telegram nudge when email rail missing / unarmed / failed.
    if (!emailed) {
      try {
        const zac = require('../../backend/modules/zacAlertChannel');
        if (zac && typeof zac.sendTelegram === 'function') {
          const tg = await Promise.resolve(zac.sendTelegram([
            '🛒 *Sovereign checkout recovery*',
            `Order \`${o.orderId}\` still pending (${Math.floor(ageMsOf(o, now) / 60000)}m).`,
            o.serviceId ? `Service: ${o.serviceId}` : null,
            o.subtotal_fiat != null ? `Amount: $${o.subtotal_fiat}` : null,
            o.checkout_url ? `Pay: ${o.checkout_url}` : null,
            buyerEmail ? `Buyer: ${buyerEmail}` : 'No buyer email on invoice',
            emailReason ? `Email: ${emailReason}` : null,
          ].filter(Boolean).join('\n')));
          telegramed = !!(tg && tg.ok !== false);
        }
      } catch (_) { /* optional */ }
    }
    // Cooldown only after a real channel attempt succeeded (email or telegram).
    if (emailed || telegramed) {
      _sovRecoverySent.set(o.orderId, now);
      sent.push({ orderId: o.orderId, emailed, telegramed, email: buyerEmail || null, emailReason });
    } else {
      skipped.push({ orderId: o.orderId, reason: emailReason || 'no_channel' });
    }
  }
  return { ok: true, stuck: stuck.length, sent: sent.length, skipped: skipped.length, sentList: sent, skippedList: skipped };
}

function ageMsOf(o, now) {
  const created = Date.parse(o.created_at || '') || 0;
  return Math.max(0, (now || Date.now()) - created);
}

// ── Boot ────────────────────────────────────────────────────────────────────
loadState();
loadPaymentExceptions();
loadCatalogSeen();
// Initial non-blocking price warm-up + first scan
setTimeout(() => { getBtcPrice().catch((e) => console.warn('[commerce] initial BTC price fetch error:', e.message)); scanIncoming().catch((e) => console.warn('[commerce] initial scan error:', e.message)); }, 3000);
// Recurring watcher
setInterval(() => { scanIncoming().catch((e) => console.warn('[commerce] scan error:', e.message)); }, WATCH_MS).unref();
// Price refresh independent of watcher
setInterval(() => { getBtcPrice().catch((e) => console.warn('[commerce] BTC price refresh error:', e.message)); }, 5 * 60 * 1000).unref();
// Abandoned sovereign invoice recovery (always-on — not gated on revenue autopilot)
setTimeout(() => {
  Promise.resolve(recoverStuckPending({ dryRun: false }))
    .catch((e) => console.warn('[commerce] recovery boot:', e && e.message));
}, 45 * 1000);
setInterval(() => {
  Promise.resolve(recoverStuckPending({ dryRun: false }))
    .catch((e) => console.warn('[commerce] recovery tick:', e && e.message));
}, SOV_RECOVERY_INTERVAL_MS).unref();

console.log('[commerce] ready · addr=' + OWNER_BTC + ' · data=' + DATA_DIR + ' · watch=' + WATCH_MS + 'ms · min_confs=' + MIN_CONFS + ' · recovery=' + SOV_RECOVERY_INTERVAL_MS + 'ms');

module.exports = { handle, scanIncoming, getBtcPrice, createOrder, ORDERS, AMT_INDEX, PAYMENT_EXCEPTIONS, WATCH_STATE, recordCatalogItems, setDeliveryHook, _fireDelivery, checkoutHtml, renderCheckoutPage: checkoutHtml, sign, verify, verifyEntitlement, recoverStuckPending, markOrderPaidFromProvider, revokeOrderFromProvider };
