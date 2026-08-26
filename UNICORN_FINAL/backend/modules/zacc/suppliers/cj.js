// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF connector — CJ Dropshipping (official API 2.0).
// Wraps backend/modules/zacc/cj-api.js. Real HTTPS only; fail-honest.

'use strict';

const cjApi = require('../cj-api');
const { capabilityMatrix, envArmed, ownerAuthStep } = require('./contract');

const ID = 'cj-dropshipping';
const DOCS = 'https://developers.cjdropshipping.com/en/summary/course.html';
const SETUP = 'https://cjdropshipping.com → My CJ → Authorization → API → Generate API Key';
const FETCH_TIMEOUT_MS = Number(process.env.ZACC_CJ_TIMEOUT_MS || 8000);

function isConfigured() {
  return cjApi.isConfigured() || envArmed('CJ_API_KEY', 16);
}

function capabilities() {
  return capabilityMatrix({
    products: true,
    inventory: true,
    pricing: true,
    orders: true,
    fulfillment: true,
    tracking: true,
    returns: false, // CJ returns via support desk — not a public API we expose yet
  });
}

function discovery() {
  const armed = isConfigured();
  return {
    id: ID,
    name: 'CJ Dropshipping',
    kind: 'physical-dropship',
    protocol: 'USCF/1.0',
    official: true,
    docsUrl: DOCS,
    baseUrl: process.env.ZACC_CJ_API_BASE || 'https://developers.cjdropshipping.com/api2.0/v1',
    auth: { type: 'header', header: 'CJ-Access-Token', env: 'ZACC_CJ_API_KEY' },
    envVars: ['ZACC_CJ_API_KEY', 'CJ_API_KEY'],
    capabilities: capabilities(),
    configured: armed,
    status: armed ? 'live' : 'awaiting_owner_auth',
    ownerAuth: armed ? null : ownerAuthStep({
      id: ID,
      envVars: ['ZACC_CJ_API_KEY'],
      docsUrl: DOCS,
      howTo: [
        'Create a free account at https://cjdropshipping.com',
        SETUP,
        'On the VPS: bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh \'YOUR_KEY\'',
        'Or POST /api/dropship/fulfillment/arm-cj with admin auth { "apiKey": "..." }',
      ],
      armEndpoint: '/api/dropship/fulfillment/arm-cj',
      armScript: 'bash UNICORN_FINAL/scripts/arm-zacc-cj-key.sh \'YOUR_KEY\'',
    }),
  };
}

function acceptsSku(sku) {
  if (!sku || sku.demoOnly) return false;
  const supplier = String(sku.supplier || '').toLowerCase();
  const source = String(sku.source || '').toLowerCase();
  const ref = sku.supplierRef != null ? String(sku.supplierRef) : '';
  if (!ref || ref.includes(':')) return false;
  if (supplier === 'world-feed' || supplier === 'manual' || supplier === 'escuela-world') return false;
  if (/dummyjson|fakestore|escuela/.test(source)) return false;
  if (supplier.includes('printful') || supplier.includes('printify')) return false;
  // Prefer explicit CJ supplier, but bare vids from scraper are CJ-shaped.
  if (supplier.includes('cj') || source.includes('cj') || supplier === '' || supplier === 'unknown') {
    return true;
  }
  // Unknown physical suppliers with bare numeric/alphanumeric vids → CJ-eligible.
  return !supplier.includes('webhook');
}

async function searchProducts(opts) {
  if (!isConfigured()) return { ok: false, reason: 'cj_not_configured', items: [] };
  const items = await cjApi.searchProducts(opts || {});
  return { ok: true, items, provider: ID };
}

async function createOrder(order) {
  if (!isConfigured()) return { ok: false, reason: 'cj_not_configured' };
  if (!acceptsSku(order)) {
    return { ok: false, reason: order && order.demoOnly ? 'cj_skipped_demo_only' : 'cj_no_supplier_ref' };
  }
  const key = String(process.env.ZACC_CJ_API_KEY || process.env.CJ_API_KEY || '').trim();
  const endpoint = process.env.ZACC_CJ_ENDPOINT
    || 'https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder';
  const vid = String(order.supplierRef);
  if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
  try {
    const body = {
      orderNumber: order.id,
      shippingCountryCode: order.shipping && order.shipping.country,
      shippingProvince: order.shipping && order.shipping.region,
      shippingCity: order.shipping && order.shipping.city,
      shippingAddress: order.shipping && order.shipping.address,
      shippingCustomerName: order.shipping && order.shipping.name,
      shippingZip: order.shipping && order.shipping.zip,
      shippingPhone: order.shipping && order.shipping.phone,
      remark: 'ZACC USCF · ' + (order.productTitle || ''),
      products: [{ vid, quantity: Math.max(1, Number(order.qty) || 1) }],
    };
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.result === false) return { ok: false, reason: 'cj_error', details: data };
    const cjOrderId = (data.data && (data.data.orderId || data.data.cjOrderId)) || null;
    return {
      ok: true,
      provider: ID,
      externalId: cjOrderId,
      cjOrderId,
      fulfillmentMode: 'cj-auto',
    };
  } catch (e) {
    return { ok: false, reason: 'cj_exception', message: e.message };
  }
}

async function queryTracking(trackNumber) {
  if (!isConfigured()) return { ok: false, reason: 'cj_not_configured' };
  return cjApi.queryTracking(trackNumber);
}

module.exports = {
  id: ID,
  discovery,
  isConfigured,
  capabilities,
  acceptsSku,
  searchProducts,
  createOrder,
  queryTracking,
};
