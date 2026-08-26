// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF connector — Printful (official REST API).
// Docs: https://developers.printful.com/docs/
// Auth: Authorization: Bearer <PRINTFUL_API_TOKEN>
// Optional store scope: X-PF-Store-Id
// Stops at owner authorization when token missing — never invents keys.

'use strict';

const { capabilityMatrix, envArmed, ownerAuthStep } = require('./contract');

const ID = 'printful';
const DOCS = 'https://developers.printful.com/docs/';
const BASE = () => String(process.env.PRINTFUL_API_BASE || 'https://api.printful.com').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PRINTFUL_TIMEOUT_MS || 8000);

function _token() {
  return String(process.env.PRINTFUL_API_TOKEN || process.env.PRINTFUL_API_KEY || '').trim();
}

function isConfigured() {
  return envArmed('PRINTFUL_API_TOKEN', 16) || envArmed('PRINTFUL_API_KEY', 16);
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
  const armed = isConfigured();
  return {
    id: ID,
    name: 'Printful',
    kind: 'print-on-demand',
    protocol: 'USCF/1.0',
    official: true,
    docsUrl: DOCS,
    baseUrl: BASE(),
    auth: { type: 'bearer', env: 'PRINTFUL_API_TOKEN', storeHeader: 'X-PF-Store-Id' },
    envVars: ['PRINTFUL_API_TOKEN', 'PRINTFUL_API_KEY', 'PRINTFUL_STORE_ID'],
    capabilities: capabilities(),
    configured: armed,
    status: armed ? 'live' : 'awaiting_owner_auth',
    ownerAuth: armed ? null : ownerAuthStep({
      id: ID,
      envVars: ['PRINTFUL_API_TOKEN', 'PRINTFUL_STORE_ID'],
      docsUrl: DOCS,
      howTo: [
        'Create a Printful account at https://www.printful.com',
        'Developers → Private tokens → Generate token (scopes: orders, sync_products)',
        'Optional: set PRINTFUL_STORE_ID for account-level tokens',
        'POST /api/dropship/suppliers/arm with admin auth { "supplier": "printful", "apiKey": "..." }',
      ],
      armEndpoint: '/api/dropship/suppliers/arm',
    }),
  };
}

function _headers() {
  const h = {
    Authorization: 'Bearer ' + _token(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const storeId = String(process.env.PRINTFUL_STORE_ID || '').trim();
  if (storeId) h['X-PF-Store-Id'] = storeId;
  return h;
}

async function _fetch(pathPart, opts) {
  if (!isConfigured()) return { ok: false, reason: 'printful_not_configured' };
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
  if (!(supplier.includes('printful') || source.includes('printful'))) return false;
  const ref = sku.supplierRef != null ? String(sku.supplierRef) : '';
  if (!ref) return false;
  // Accept bare sync_variant id or printful:<id>
  const id = ref.includes(':') ? ref.split(':').pop() : ref;
  return !!id && /^\d+$/.test(id);
}

function _variantId(order) {
  const ref = order && order.supplierRef != null ? String(order.supplierRef) : '';
  if (!ref) return null;
  const id = ref.includes(':') ? ref.split(':').pop() : ref;
  return /^\d+$/.test(id) ? Number(id) : null;
}

async function searchProducts(opts) {
  opts = opts || {};
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const r = await _fetch('/store/products?limit=' + limit);
  if (!r.ok) return { ok: false, reason: r.reason, items: [] };
  const result = (r.body && r.body.result) || [];
  const items = [];
  for (const p of (Array.isArray(result) ? result : [])) {
    const name = String(p.name || '').trim();
    if (!name) continue;
    const syncId = p.id != null ? String(p.id) : '';
    items.push({
      source: 'printful',
      supplier: 'printful',
      supplierRef: syncId ? 'printful:' + syncId : null,
      name,
      category: 'apparel',
      costUsd: 0,
      shippingUsd: 4.99,
      suggestedRetailUsd: 0,
      image: (p.thumbnail_url || ''),
      demoOnly: false,
      live: true,
      note: 'Sync product — expand variants before auto-order (needs sync_variant id).',
    });
  }
  return { ok: true, items, provider: ID };
}

async function createOrder(order) {
  if (!isConfigured()) return { ok: false, reason: 'printful_not_configured' };
  if (!acceptsSku(order)) return { ok: false, reason: 'printful_no_variant_ref' };
  const variantId = _variantId(order);
  if (!variantId) return { ok: false, reason: 'printful_no_variant_ref' };
  const ship = order.shipping || {};
  const r = await _fetch('/orders', {
    method: 'POST',
    body: {
      recipient: {
        name: ship.name || 'Customer',
        address1: ship.address || '',
        city: ship.city || '',
        state_code: ship.region || '',
        country_code: ship.country || 'US',
        zip: ship.zip || '',
        phone: ship.phone || '',
        email: order.email || undefined,
      },
      items: [{
        sync_variant_id: variantId,
        quantity: Math.max(1, Number(order.qty) || 1),
      }],
      external_id: order.id || order.orderToken || undefined,
    },
  });
  if (!r.ok) return { ok: false, reason: r.reason || 'printful_error', details: r.body };
  const result = r.body && r.body.result;
  const externalId = result && (result.id || result.order_id) || null;
  return {
    ok: true,
    provider: ID,
    externalId: externalId != null ? String(externalId) : null,
    fulfillmentMode: 'printful-auto',
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
