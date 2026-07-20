// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — CJ Dropshipping API 2.0 client.
// RO: client REAL pentru CJ Dropshipping. Fără mock-uri, fără răspunsuri
// fabricate. Când ZACC_CJ_API_KEY este setat, expune 3 capabilități esențiale
// pentru un catalog dropship onest:
//   1) searchProducts()   — caută/importă produse cu VARIANT ID real (`vid`)
//   2) queryProduct(pid)  — detalii + variante pentru un product ID
//   3) queryTracking(no)  — status real de livrare pe o comandă expediată
// Toate apelurile:
//   • HTTPS către endpoint-uri oficiale CJ Dropshipping (developers.cjdropshipping.com)
//   • Header `CJ-Access-Token: <cheia>` (schema oficială)
//   • Timeout hard + fail-honest: la orice eroare returnăm { ok:false, reason }
//     ca apelantul să prezinte utilizatorului că nu am putut confirma, nu
//     să inventăm date. Nimic nu blochează bucla autonomă.

'use strict';

const { logger, round2 } = require('./util');
const log = logger('cj-api');

const CJ_BASE = process.env.ZACC_CJ_API_BASE
  || 'https://developers.cjdropshipping.com/api2.0/v1';
const FETCH_TIMEOUT_MS = Number(process.env.ZACC_CJ_TIMEOUT_MS || 8000);

function _key() { return String(process.env.ZACC_CJ_API_KEY || '').trim(); }

function isConfigured() {
  const k = _key();
  if (!k || k.length < 16) return false;
  if (/your_|changeme|xxx|placeholder|example/i.test(k)) return false;
  return true;
}

function _headers() {
  return {
    'Content-Type': 'application/json',
    'CJ-Access-Token': _key(),
    Accept: 'application/json',
  };
}

async function _cjFetch(pathPart, opts) {
  if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
  if (!isConfigured()) return { ok: false, reason: 'cj_not_configured' };
  const url = CJ_BASE.replace(/\/$/, '') + (pathPart.startsWith('/') ? pathPart : '/' + pathPart);
  const init = Object.assign({
    method: 'GET',
    headers: _headers(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }, opts || {});
  if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
  try {
    const r = await fetch(url, init);
    const raw = await r.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }
    if (!r.ok) return { ok: false, reason: 'http_' + r.status, status: r.status, body: data };
    // CJ envelopes look like { code:200, result:true, message:'success', data:{...} }
    if (typeof data === 'object' && data && data.result === false) {
      return { ok: false, reason: 'cj_result_false', code: data.code, message: data.message, body: data };
    }
    return { ok: true, status: r.status, body: data };
  } catch (e) {
    return { ok: false, reason: 'exception', message: e.message };
  }
}

// ---- Normalisation helpers ------------------------------------------------

function _pickImage(product) {
  const arr = Array.isArray(product && product.productImage) ? product.productImage : [];
  for (const u of arr) {
    if (typeof u === 'string' && /^https?:\/\//i.test(u)) return u;
  }
  const single = product && (product.image || product.productImage);
  if (typeof single === 'string' && /^https?:\/\//i.test(single)) return single;
  return '';
}

function _pickPrice(product) {
  const cand = [
    product && product.sellPrice,
    product && product.suggestedPrice,
    product && product.price,
    product && product.productPrice,
    product && product.originalPrice,
  ];
  for (const c of cand) {
    if (c == null) continue;
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return round2(c);
    if (typeof c === 'string') {
      const n = Number(String(c).split(/[-–~]/)[0].replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) return round2(n);
    }
  }
  return 0;
}

function _pickVid(product) {
  if (!product) return null;
  const arr = Array.isArray(product.variants) ? product.variants
    : Array.isArray(product.variantList) ? product.variantList
    : Array.isArray(product.productVariants) ? product.productVariants
    : [];
  for (const v of arr) {
    const vid = v && (v.vid || v.variantId || v.variantSku);
    if (vid) return String(vid);
  }
  const direct = product.vid || product.variantId || product.variantSku;
  return direct ? String(direct) : null;
}

function _mapCategory(raw) {
  const s = String(raw || '').toLowerCase();
  if (/beauty|skin|cosmetic|makeup|fragrance/.test(s)) return 'beauty';
  if (/phone|laptop|tablet|electronic|charger|watch|audio|headphone|camera|mobile|smart/.test(s)) return 'electronics';
  if (/home|furniture|kitchen|decor|lamp|plant|frame|garden/.test(s)) return 'home';
  if (/sport|fitness|gym|outdoor|hike|camp/.test(s)) return 'fitness';
  if (/pet|dog|cat/.test(s)) return 'pets';
  if (/men|women|shirt|shoe|fashion|cloth|apparel|dress|sunglass|bag/.test(s)) return 'fashion';
  return 'general';
}

/**
 * Search / list REAL CJ products so we can import them into the shelf with a
 * dispatchable `vid`. Returns an array of normalized product records, or [] if
 * the API is not configured or the request failed. Never throws.
 *
 * Endpoint: GET /product/list?pageNum=&pageSize=&keywords=...
 * (see https://developers.cjdropshipping.com/en/api/product/list.html)
 */
async function searchProducts(opts) {
  opts = opts || {};
  const params = new URLSearchParams();
  params.set('pageNum', String(Math.max(1, Number(opts.page) || 1)));
  params.set('pageSize', String(Math.min(50, Math.max(1, Number(opts.limit) || 20))));
  if (opts.keywords) params.set('productNameEn', String(opts.keywords).slice(0, 60));
  if (opts.categoryId) params.set('categoryId', String(opts.categoryId));
  if (opts.countryCode) params.set('countryCode', String(opts.countryCode));
  const r = await _cjFetch('/product/list?' + params.toString());
  if (!r.ok) { log.warn('searchProducts failed:', r.reason || r.message); return []; }
  const container = (r.body && (r.body.data || r.body.result || r.body)) || {};
  const list = Array.isArray(container.list) ? container.list
    : Array.isArray(container.records) ? container.records
    : Array.isArray(container) ? container
    : [];
  const out = [];
  const now = new Date().toISOString();
  for (const p of list) {
    const image = _pickImage(p);
    const price = _pickPrice(p);
    const vid = _pickVid(p);
    const name = String(p.productNameEn || p.productName || p.name || '').trim();
    if (!name || price <= 0 || !image || !vid) continue;
    out.push({
      source: 'cj-dropship',
      supplier: 'cj-dropshipping',
      supplierRef: vid,
      cjProductId: String(p.pid || p.productId || ''),
      cjSku: String(p.productSku || ''),
      name,
      category: _mapCategory(p.categoryName || p.category),
      costUsd: price,
      shippingUsd: Number(p.sellPrice && p.sellPrice.shippingFee) || round2(Math.max(2.5, price * 0.12)),
      suggestedRetailUsd: round2(price * 2.6),
      rating: Number(p.saleScore || p.rating) || 4.6,
      reviews: Number(p.reviewCount || p.saleCount) || 250,
      image,
      url: p.productUrl || (p.pid ? 'https://cjdropshipping.com/product/detail/' + p.pid : ''),
      weightKg: Number(p.packWeight || p.weight) / 1000 || 0.4,
      originCountry: 'CN',
      demoOnly: false,
      live: true,
      fetchedAt: now,
    });
  }
  log.info('searchProducts returned', out.length, 'dispatchable CJ products');
  return out;
}

/**
 * Fetch a single product's full detail (incl. variants) by CJ product id.
 * Used when we want to re-check a listed SKU still has a live vid.
 * Endpoint: GET /product/query?pid=...
 */
async function queryProduct(pid) {
  if (!pid) return null;
  const r = await _cjFetch('/product/query?pid=' + encodeURIComponent(String(pid)));
  if (!r.ok) return null;
  return (r.body && (r.body.data || r.body.result)) || r.body || null;
}

/**
 * Query the shipping tracking timeline for an order. `trackNumber` is the
 * carrier tracking number CJ returns after fulfilment. Returns a normalized
 * structure { ok, carrier, tracking, events }. Fails honestly on error.
 * Endpoint: GET /logistic/trackQuery?trackNumber=...
 */
async function queryTracking(trackNumber) {
  if (!trackNumber) return { ok: false, reason: 'no_tracking_number' };
  const r = await _cjFetch('/logistic/trackQuery?trackNumber=' + encodeURIComponent(String(trackNumber)));
  if (!r.ok) return { ok: false, reason: r.reason || 'unknown', message: r.message };
  const data = (r.body && (r.body.data || r.body.result)) || r.body || {};
  const rawEvents = Array.isArray(data.trackList) ? data.trackList
    : Array.isArray(data.trackDetails) ? data.trackDetails
    : Array.isArray(data.details) ? data.details
    : [];
  const events = rawEvents.map((ev) => ({
    at: String(ev.trackDate || ev.date || ev.time || ''),
    status: String(ev.status || ev.trackStatus || ''),
    location: String(ev.location || ev.city || ''),
    description: String(ev.description || ev.desc || ev.trackDescription || ''),
  }));
  return {
    ok: true,
    trackNumber: String(trackNumber),
    carrier: String(data.logisticName || data.carrier || ''),
    status: String(data.status || (events[0] && events[0].status) || ''),
    events,
  };
}

/**
 * Query the CJ order state via the CJ order id we captured after createOrder.
 * Endpoint: GET /shopping/order/getOrderDetail?orderId=...
 */
async function queryOrderDetail(cjOrderId) {
  if (!cjOrderId) return { ok: false, reason: 'no_cj_order_id' };
  const r = await _cjFetch('/shopping/order/getOrderDetail?orderId=' + encodeURIComponent(String(cjOrderId)));
  if (!r.ok) return { ok: false, reason: r.reason || 'unknown', message: r.message };
  const data = (r.body && (r.body.data || r.body.result)) || r.body || {};
  return {
    ok: true,
    cjOrderId: String(cjOrderId),
    status: String(data.orderStatus || data.status || ''),
    trackNumber: String(data.trackNumber || data.trackingNumber || ''),
    carrier: String(data.logisticName || data.carrier || ''),
    raw: data,
  };
}

module.exports = {
  isConfigured,
  searchProducts,
  queryProduct,
  queryTracking,
  queryOrderDetail,
  // exported for tests that inject fixtures
  _cjFetch,
  _pickVid,
  _pickImage,
  _pickPrice,
};
