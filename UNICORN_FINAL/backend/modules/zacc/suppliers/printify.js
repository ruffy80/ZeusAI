// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF connector — Printify (official REST API v1).
// Docs: https://developers.printify.com/
// Auth: Authorization: Bearer <PRINTIFY_API_TOKEN> + User-Agent
// Requires PRINTIFY_SHOP_ID for product/order calls.

'use strict';

const { capabilityMatrix, envArmed, ownerAuthStep } = require('./contract');

const ID = 'printify';
const DOCS = 'https://developers.printify.com/';
const BASE = () => String(process.env.PRINTIFY_API_BASE || 'https://api.printify.com/v1').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PRINTIFY_TIMEOUT_MS || 8000);
const UA = 'ZeusAI-USCF/1.0 (+https://zeusai.pro)';

function _token() {
  return String(process.env.PRINTIFY_API_TOKEN || process.env.PRINTIFY_API_KEY || '').trim();
}

function _shopId() {
  return String(process.env.PRINTIFY_SHOP_ID || '').trim();
}

function isConfigured() {
  return (envArmed('PRINTIFY_API_TOKEN', 16) || envArmed('PRINTIFY_API_KEY', 16)) && !!_shopId();
}

function capabilities() {
  return capabilityMatrix({
    products: true,
    inventory: true,
    pricing: true,
    orders: true,
    fulfillment: true,
    tracking: true,
    returns: false,
  });
}

function discovery() {
  const tokenOk = envArmed('PRINTIFY_API_TOKEN', 16) || envArmed('PRINTIFY_API_KEY', 16);
  const shopOk = !!_shopId();
  const armed = isConfigured();
  const missing = [];
  if (!tokenOk) missing.push('PRINTIFY_API_TOKEN');
  if (!shopOk) missing.push('PRINTIFY_SHOP_ID');
  return {
    id: ID,
    name: 'Printify',
    kind: 'print-on-demand',
    protocol: 'USCF/1.0',
    official: true,
    docsUrl: DOCS,
    baseUrl: BASE(),
    auth: { type: 'bearer', env: 'PRINTIFY_API_TOKEN', requires: ['PRINTIFY_SHOP_ID'] },
    envVars: ['PRINTIFY_API_TOKEN', 'PRINTIFY_API_KEY', 'PRINTIFY_SHOP_ID'],
    capabilities: capabilities(),
    configured: armed,
    status: armed ? 'live' : 'awaiting_owner_auth',
    ownerAuth: armed ? null : ownerAuthStep({
      id: ID,
      envVars: missing.length ? missing : ['PRINTIFY_API_TOKEN', 'PRINTIFY_SHOP_ID'],
      docsUrl: DOCS,
      howTo: [
        'Create a Printify account at https://printify.com',
        'Connections → Personal access tokens → Generate (shops/products/orders scopes)',
        'Copy shop id from Printify dashboard (or GET /v1/shops.json)',
        'POST /api/dropship/suppliers/arm with { "supplier": "printify", "apiKey": "...", "shopId": "..." }',
      ],
      armEndpoint: '/api/dropship/suppliers/arm',
      note: missing.length
        ? 'Missing: ' + missing.join(', ') + ' — owner authorization required.'
        : undefined,
    }),
  };
}

function _headers() {
  return {
    Authorization: 'Bearer ' + _token(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': UA,
  };
}

async function _fetch(pathPart, opts) {
  if (!isConfigured() && !(pathPart.includes('/shops.json'))) {
    // Allow shops list when token present but shop id missing (owner bootstrap).
    if (!(envArmed('PRINTIFY_API_TOKEN', 16) || envArmed('PRINTIFY_API_KEY', 16))) {
      return { ok: false, reason: 'printify_not_configured' };
    }
  }
  if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
  const url = BASE() + (pathPart.startsWith('/') ? pathPart : '/' + pathPart);
  try {
    const init = Object.assign({
      method: 'GET',
      headers: _headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }, opts || {});
    if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
    const r = await fetch(url, init);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: 'http_' + r.status, status: r.status, body: data };
    return { ok: true, status: r.status, body: data };
  } catch (e) {
    return { ok: false, reason: 'exception', message: e.message };
  }
}

function acceptsSku(sku) {
  if (!sku || sku.demoOnly) return false;
  const supplier = String(sku.supplier || '').toLowerCase();
  const source = String(sku.source || '').toLowerCase();
  if (!(supplier.includes('printify') || source.includes('printify'))) return false;
  const ref = sku.supplierRef != null ? String(sku.supplierRef) : '';
  if (!ref) return false;
  // Formats: printify:<productId>:<variantId> OR printify:<variantId> OR bare digits
  const parts = ref.includes(':') ? ref.split(':').filter(Boolean) : [ref];
  const last = parts[parts.length - 1];
  return !!last && /^\d+$/.test(last);
}

function _parseRef(order) {
  const ref = order && order.supplierRef != null ? String(order.supplierRef) : '';
  const parts = ref.includes(':')
    ? ref.split(':').filter((p) => p && p.toLowerCase() !== 'printify')
    : [ref];
  if (parts.length >= 2) {
    return { productId: parts[0], variantId: Number(parts[1]) };
  }
  if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    return { productId: null, variantId: Number(parts[0]) };
  }
  return null;
}

async function searchProducts(opts) {
  opts = opts || {};
  if (!isConfigured()) return { ok: false, reason: 'printify_not_configured', items: [] };
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const r = await _fetch('/shops/' + encodeURIComponent(_shopId()) + '/products.json?limit=' + limit);
  if (!r.ok) return { ok: false, reason: r.reason, items: [] };
  const list = Array.isArray(r.body) ? r.body : (r.body && r.body.data) || [];
  const items = [];
  for (const p of list) {
    const name = String(p.title || p.name || '').trim();
    if (!name) continue;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const v = variants.find((x) => x && x.is_enabled !== false) || variants[0];
    const variantId = v && v.id != null ? String(v.id) : '';
    const productId = p.id != null ? String(p.id) : '';
    const priceCents = v && (v.price != null) ? Number(v.price) : 0;
    const costUsd = priceCents > 0 ? Math.round((priceCents / 100) * 100) / 100 : 0;
    items.push({
      source: 'printify',
      supplier: 'printify',
      supplierRef: productId && variantId ? 'printify:' + productId + ':' + variantId : (variantId ? 'printify:' + variantId : null),
      name,
      category: 'apparel',
      costUsd,
      shippingUsd: 3.99,
      suggestedRetailUsd: costUsd > 0 ? Math.round(costUsd * 2.4 * 100) / 100 : 0,
      image: (p.images && p.images[0] && p.images[0].src) || '',
      demoOnly: false,
      live: true,
    });
  }
  return { ok: true, items, provider: ID };
}

async function createOrder(order) {
  if (!isConfigured()) return { ok: false, reason: 'printify_not_configured' };
  if (!acceptsSku(order)) return { ok: false, reason: 'printify_no_variant_ref' };
  const parsed = _parseRef(order);
  if (!parsed || !parsed.variantId) return { ok: false, reason: 'printify_no_variant_ref' };
  const ship = order.shipping || {};
  const line = {
    product_id: parsed.productId ? String(parsed.productId) : undefined,
    variant_id: parsed.variantId,
    quantity: Math.max(1, Number(order.qty) || 1),
  };
  if (!line.product_id) delete line.product_id;
  const r = await _fetch('/shops/' + encodeURIComponent(_shopId()) + '/orders.json', {
    method: 'POST',
    body: {
      external_id: order.id || order.orderToken || undefined,
      label: order.productTitle || undefined,
      line_items: [line],
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: {
        first_name: (ship.name || 'Customer').split(/\s+/)[0] || 'Customer',
        last_name: (ship.name || '').split(/\s+/).slice(1).join(' ') || 'Buyer',
        email: order.email || 'buyer@zeusai.pro',
        phone: ship.phone || '',
        country: ship.country || 'US',
        region: ship.region || '',
        address1: ship.address || '',
        city: ship.city || '',
        zip: ship.zip || '',
      },
    },
  });
  if (!r.ok) return { ok: false, reason: r.reason || 'printify_error', details: r.body };
  const externalId = r.body && (r.body.id || r.body.order_id);
  return {
    ok: true,
    provider: ID,
    externalId: externalId != null ? String(externalId) : null,
    fulfillmentMode: 'printify-auto',
  };
}

module.exports = {
  id: ID,
  discovery,
  isConfigured,
  capabilities,
  acceptsSku,
  searchProducts,
  createOrder,
};
