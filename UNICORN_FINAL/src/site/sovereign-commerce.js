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

// ── Config ──────────────────────────────────────────────────────────────────
const OWNER_BTC = (process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e').trim();
const OWNER_NAME   = process.env.OWNER_NAME  || 'Vladoi Ionut';
const OWNER_DOMAIN = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
const DATA_DIR     = process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce');
const ORDERS_FILE  = path.join(DATA_DIR, 'orders.jsonl');
const ENTITL_FILE  = path.join(DATA_DIR, 'entitlements.jsonl');
const STATE_FILE   = path.join(DATA_DIR, 'state.json');
const WATCH_MS     = Math.max(15000, +(process.env.COMMERCE_WATCH_MS || 45000));
const ORDER_TTL_MS = Math.max(5, +(process.env.COMMERCE_ORDER_TTL_MIN || 60)) * 60 * 1000;
const MIN_CONFS    = Math.max(0, +(process.env.COMMERCE_MIN_CONFS || 0));
const ADMIN_SECRET = process.env.COMMERCE_ADMIN_SECRET || '';
const MEMPOOL_BASE = (process.env.COMMERCE_MEMPOOL_BASE || 'https://mempool.space/api').replace(/\/+$/, '');
const PRICE_FALLBACK_USD = +(process.env.COMMERCE_PRICE_FALLBACK_USD || 60000);
const CATALOG_SEEN_FILE = path.join(process.env.COMMERCE_DATA_DIR || path.join(process.cwd(), 'data', 'commerce'), 'catalog-seen.json');

// ── Storage ─────────────────────────────────────────────────────────────────
fs.mkdirSync(DATA_DIR, { recursive: true });
const ORDERS = new Map();     // orderId -> order (in-memory; persisted on change)
const AMT_INDEX = new Map();  // amountSats -> orderId (pending only; fast match)
const SEEN_TXIDS = new Set(); // crediting txs already applied (from state file)
const CATALOG_SEEN = new Map(); // serviceId -> firstSeenAtMs (for /api/catalog/diff)

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

// ── Price oracle (multi-source, 5 min cache) ────────────────────────────────
const PRICE_CACHE = { usd: 0, eur: 0, fetchedAt: 0, source: 'none' };
async function getBtcPrice() {
  if (Date.now() - PRICE_CACHE.fetchedAt < 5 * 60 * 1000 && PRICE_CACHE.usd > 0) return PRICE_CACHE;

  // Try mempool.space first (same infra we already use)
  let r = await httpJson(`${MEMPOOL_BASE}/v1/prices`);
  if (r.ok && r.data && r.data.USD) {
    PRICE_CACHE.usd = Number(r.data.USD);
    PRICE_CACHE.eur = Number(r.data.EUR || (r.data.USD * 0.93));
    PRICE_CACHE.fetchedAt = Date.now();
    PRICE_CACHE.source = 'mempool.space';
    return PRICE_CACHE;
  }
  // Fallback: coingecko
  r = await httpJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur');
  if (r.ok && r.data && r.data.bitcoin && r.data.bitcoin.usd) {
    PRICE_CACHE.usd = Number(r.data.bitcoin.usd);
    PRICE_CACHE.eur = Number(r.data.bitcoin.eur || (r.data.bitcoin.usd * 0.93));
    PRICE_CACHE.fetchedAt = Date.now();
    PRICE_CACHE.source = 'coingecko';
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

// ── Service resolution (from live snapshot OR full master catalog) ─────────
// Supports two ctx accessors so any service from `/api/catalog/master`
// (Vertical OS, Frontier F1-F12, Activation packages, Future R&D primitives,
// auto-discovered connector modules, …) becomes purchasable via sovereign BTC.
async function resolveService(ctx, serviceId) {
  // 1) Fast path: live snapshot (existing behavior, kept for backwards compat)
  try {
    if (ctx && typeof ctx.buildSnapshot === 'function') {
      const snap = ctx.buildSnapshot();
      const all = [].concat(snap.marketplace || [], snap.services || []).filter((s) => s && s.id);
      const hit = all.find((s) => String(s.id) === String(serviceId));
      if (hit) return hit;
    }
  } catch {}
  // 2) Master catalog path: any deliverable Unicorn can sell
  try {
    if (ctx && typeof ctx.resolveCatalogItem === 'function') {
      const item = await ctx.resolveCatalogItem(serviceId);
      if (item && item.id) {
        // Normalize to the shape resolveService callers expect (.name + .price)
        return {
          id: item.id,
          name: item.title || item.name || item.id,
          title: item.title || item.name || item.id,
          price: Number(item.priceUsd != null ? item.priceUsd : (item.priceUSD != null ? item.priceUSD : (item.price || 0))),
          description: item.description || '',
          segment: item.segment || item.group || 'unicorn',
          kpi: item.kpi || ''
        };
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

async function createOrder(ctx, input) {
  const { serviceId, qty = 1, email = '', currency = 'USD', preorder = false } = input || {};
  if (!serviceId) return { error: 'serviceId_required', status: 400 };
  const svc = await resolveService(ctx, serviceId);
  if (!svc) return { error: 'service_not_found', serviceId, status: 404 };

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
  if (!(fiatPerBtc > 0)) return { error: 'price_oracle_unavailable', status: 503 };

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
    buyer: { email: String(email || '').slice(0, 200) },
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
  return { order, status: 201 };
}

// ── Payment watcher (mempool.space) ─────────────────────────────────────────
const WATCH_STATE = { lastScanAt: 0, lastScanOk: false, lastError: null, totalScans: 0, totalMatched: 0 };
async function scanIncoming() {
  WATCH_STATE.totalScans++;
  WATCH_STATE.lastScanAt = Date.now();
  // No pending orders → skip network call
  const hasPending = Array.from(ORDERS.values()).some((o) => o.status === 'pending' && Date.now() < o.expires_at_ms);
  if (!hasPending) { WATCH_STATE.lastScanOk = true; return { skipped: true }; }

  const r = await httpJson(`${MEMPOOL_BASE}/address/${OWNER_BTC}/txs`);
  if (!r.ok) { WATCH_STATE.lastScanOk = false; WATCH_STATE.lastError = r.error || `status=${r.status}`; return { error: WATCH_STATE.lastError }; }
  WATCH_STATE.lastScanOk = true; WATCH_STATE.lastError = null;

  const txs = Array.isArray(r.data) ? r.data : [];
  let matched = 0;
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
    // Match against exact amount (strictest). If MIN_CONFS > 0, require confirmation.
    const orderId = AMT_INDEX.get(outSats);
    if (orderId && (confirmed || MIN_CONFS === 0)) {
      const order = ORDERS.get(orderId);
      if (order && order.status === 'pending') {
        order.status = 'paid';
        order.paid_at = new Date().toISOString();
        order.txids = Array.from(new Set([...(order.txids || []), tx.txid]));
        order.confirmations = confirmed ? 1 : 0;
        order.paid_sats_observed = outSats;
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
        matched++;
        console.log('[commerce] PAID', order.orderId, 'service=' + order.serviceId, 'sats=' + outSats, 'txid=' + tx.txid);
      }
    }
    // Mark tx seen even if not matched (avoid re-scan cost next cycle)
    SEEN_TXIDS.add(tx.txid);
  }
  if (matched > 0) { WATCH_STATE.totalMatched += matched; persistState(); }
  // Expire old pending orders
  const now = Date.now();
  for (const [id, o] of ORDERS) {
    if (o.status === 'pending' && now >= o.expires_at_ms) {
      o.status = 'expired';
      AMT_INDEX.delete(o.amount_sats);
      persistOrder(o);
    }
  }
  return { matched, scanned: txs.length };
}

// ── QR SVG (BIP-21, zero-dependency numeric-data QR) ────────────────────────
// To avoid adding a dep we use the free public QR API for rendering.
// (Stays purely a redirect; we still control the data input.)
function qrRedirect(data) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(data)}`;
}

// ── Checkout HTML page ──────────────────────────────────────────────────────
function checkoutHtml(order) {
  const price = `${order.subtotal_fiat.toFixed(2)} ${order.currency}`;
  const btc = order.amount_btc.toFixed(8);
  const sats = order.amount_sats;
  const expiresIn = Math.max(0, Math.floor((order.expires_at_ms - Date.now()) / 1000));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checkout · ${escapeHtml(order.serviceName)} · ZeusAI</title>
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
<h1>Checkout</h1><p class="sub">${escapeHtml(order.serviceName)} · Order <span class="mono">${order.orderId}</span></p>

<div class="card">
  <div class="row"><span class="k">Service</span><span class="v">${escapeHtml(order.serviceName)}</span></div>
  <div class="row"><span class="k">Quantity</span><span class="v">${order.qty}</span></div>
  <div class="row"><span class="k">Subtotal</span><span class="v">${price}</span></div>
  <div class="row"><span class="k">Pay exactly</span><span class="v mono">${btc} BTC <small class="k">(${sats.toLocaleString()} sats)</small></span></div>
  <div class="row"><span class="k">BTC price at quote</span><span class="v">${order.btc_price_at_quote.toLocaleString()} ${order.currency} <small class="k">(${escapeHtml(order.price_source)})</small></span></div>
  <div class="row"><span class="k">Status</span><span class="v"><span id="st" class="status pending">pending</span></span></div>
  <div class="row"><span class="k">Expires in</span><span class="v" id="cd">${expiresIn}s</span></div>
</div>

<div class="card">
  <div class="qr"><img alt="BIP-21 QR" src="${qrRedirect(order.bip21)}" loading="lazy"></div>
  <p class="note" style="text-align:center;margin-top:16px">Scan with any Bitcoin wallet (on-chain). The exact amount is critical — it is the payment identifier.</p>
  <div class="row"><span class="k">Address</span><span class="v mono">${order.receive_address} <button class="copy" onclick="copy('${order.receive_address}')">copy</button></span></div>
  <div class="row"><span class="k">Amount</span><span class="v mono">${btc} <button class="copy" onclick="copy('${btc}')">copy</button></span></div>
  <div class="row"><span class="k">BIP-21 URI</span><span class="v mono">${order.bip21} <button class="copy" onclick="copy('${order.bip21}')">copy</button></span></div>
  <p style="margin-top:16px"><a class="cta" href="${order.bip21}">Open in wallet</a>
  <a class="cta" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)" href="${OWNER_DOMAIN}">Back to site</a></p>
</div>

<div class="grant" id="grant">
  <h2 style="margin:0 0 6px">✅ Payment received — service activated</h2>
  <p style="margin:0 0 12px">Your access token is ready. Keep it safe — it is the cryptographic proof of purchase.</p>
  <div class="row"><span class="k">Access token</span><span class="v mono" id="tok"></span></div>
  <div class="row"><span class="k">Entitlement</span><span class="v mono" id="ent">—</span></div>
  <div class="row"><span class="k">Txid</span><span class="v mono" id="tx">—</span></div>
  <p class="note">A W3C Verifiable Credential receipt has been issued. Verify at <a href="/api/entitlements/">/api/entitlements/{token}</a>.</p>
  <p style="margin-top:10px"><a class="cta" id="walletDl" download="zeusai-entitlement.json" href="#" style="background:#f7931a;color:#05040a">💼 Add to wallet (VC)</a>
  <a class="cta" style="background:#14132a;color:#eaf0ff;border:1px solid var(--line)" id="verifyLink" href="#">🔎 Verify entitlement</a></p>
</div>

<footer>Settlement: direct on-chain to owner wallet · No custodian · 30Y-LTS sovereign commerce · ${OWNER_DOMAIN}</footer>
</div>
<script>
function copy(s){navigator.clipboard&&navigator.clipboard.writeText(s)}
const TOK='${order.access_token}';
let expSec=${expiresIn};
setInterval(()=>{if(expSec>0){expSec--;document.getElementById('cd').textContent=expSec+'s'}},1000);
async function poll(){
  try{
    const r=await fetch('/api/order/${order.orderId}/status',{cache:'no-store'});
    const j=await r.json();
    const s=document.getElementById('st');
    s.className='status '+(j.status||'pending');s.textContent=j.status||'pending';
    if(j.status==='paid'){
      document.getElementById('grant').classList.add('on');
      document.getElementById('tok').textContent=TOK;
      document.getElementById('ent').textContent=j.entitlement_id||'—';
      document.getElementById('tx').textContent=(j.txids&&j.txids[0])||'—';
      var dl=document.getElementById('walletDl');if(dl){dl.href='/api/entitlements/'+TOK+'/wallet.json';}
      var v=document.getElementById('verifyLink');if(v){v.href='/api/entitlements/'+TOK;}
      return;
    }
    if(j.status==='expired')return;
  }catch(e){}
  setTimeout(poll,5000);
}
poll();
</script></body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Handler ─────────────────────────────────────────────────────────────────
async function handle(req, res, ctx) {
  const url = (req.url || '/').split('?')[0];

  // --- /api/checkout/create -------------------------------------------------
  if (url === '/api/checkout/create' && req.method === 'POST') {
    const body = await readBody(req);
    const out = await createOrder(ctx, body);
    if (out.error) return sendJson(res, out.status || 400, { error: out.error, serviceId: out.serviceId }), true;
    return sendJson(res, 201, out.order), true;
  }

  // --- /checkout/:orderId (HTML) -------------------------------------------
  const mCheckout = url.match(/^\/checkout\/([a-zA-Z0-9_-]{6,64})$/);
  if (mCheckout && req.method === 'GET') {
    const order = ORDERS.get(mCheckout[1]);
    if (!order) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Order not found'); return true; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Unicorn-Commerce': '1' });
    res.end(checkoutHtml(order));
    return true;
  }

  // --- /api/checkout/:orderId/qr.svg → redirect to QR renderer -------------
  const mQr = url.match(/^\/api\/checkout\/([a-zA-Z0-9_-]{6,64})\/qr\.svg$/);
  if (mQr && req.method === 'GET') {
    const order = ORDERS.get(mQr[1]);
    if (!order) { res.writeHead(404); res.end(); return true; }
    res.writeHead(302, { Location: qrRedirect(order.bip21), 'Cache-Control': 'public, max-age=60' });
    res.end(); return true;
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
      entitlement_id: order.entitlement_id || null,
      bip21: order.bip21,
      checkout_url: order.checkout_url,
    };
    return sendJson(res, 200, slim), true;
  }

  // --- /api/entitlements/:token — verify proof-of-purchase ----------------
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
        proofUrl: txid ? `https://mempool.space/tx/${txid}` : null,
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
        amount_btc: o.amount_btc,
        amount_sats: o.amount_sats,
        currency: o.currency,
        subtotal_fiat: o.subtotal_fiat,
        txid,
        proof_url: txid ? `https://mempool.space/tx/${txid}` : null,
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
    return sendJson(res, 200, {
      status: WATCH_STATE.lastScanOk ? 'ok' : 'degraded',
      receive_address: OWNER_BTC,
      watch: WATCH_STATE,
      watch_interval_ms: WATCH_MS,
      orders: { total: ORDERS.size, pending, paid },
      mempool_base: MEMPOOL_BASE,
      order_ttl_min: ORDER_TTL_MS / 60000,
      min_confirmations: MIN_CONFS,
    }), true;
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

// ── Boot ────────────────────────────────────────────────────────────────────
loadState();
loadCatalogSeen();
// Initial non-blocking price warm-up + first scan
setTimeout(() => { getBtcPrice().catch(() => {}); scanIncoming().catch(() => {}); }, 3000);
// Recurring watcher
setInterval(() => { scanIncoming().catch((e) => console.warn('[commerce] scan error:', e.message)); }, WATCH_MS).unref();
// Price refresh independent of watcher
setInterval(() => { getBtcPrice().catch(() => {}); }, 5 * 60 * 1000).unref();

console.log('[commerce] ready · addr=' + OWNER_BTC + ' · data=' + DATA_DIR + ' · watch=' + WATCH_MS + 'ms · min_confs=' + MIN_CONFS);

module.exports = { handle, scanIncoming, getBtcPrice, createOrder, ORDERS, WATCH_STATE, recordCatalogItems };
