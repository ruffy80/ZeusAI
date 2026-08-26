// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF/1.0 — Universal Supplier Connector Framework
// Registry that maps new suppliers onto the canonical commerce pipeline:
//   products → inventory → pricing → orders → fulfillment → tracking → returns
// and routes paid orders to the first armed connector that accepts the SKU.
// Never invents credentials. Surfaces awaiting_owner_auth until keys are armed.

'use strict';

const { PIPELINE_STAGES } = require('./contract');
const cj = require('./cj');
const printful = require('./printful');
const printify = require('./printify');
const webhook = require('./webhook');

const PROTOCOL = 'USCF/1.0';

/** Registration order = default route priority (physical → POD → webhook). */
const CONNECTORS = [cj, printful, printify, webhook];

function listConnectors() {
  return CONNECTORS.slice();
}

function getConnector(id) {
  const needle = String(id || '').toLowerCase();
  return CONNECTORS.find((c) => c.id === needle || (c.discovery && c.discovery().id === needle)) || null;
}

function discovery() {
  const suppliers = CONNECTORS.map((c) => c.discovery());
  const armed = suppliers.filter((s) => s.configured);
  const awaiting = suppliers.filter((s) => !s.configured).map((s) => ({
    id: s.id,
    name: s.name,
    envVars: (s.ownerAuth && s.ownerAuth.envVars) || s.envVars || [],
    howTo: (s.ownerAuth && s.ownerAuth.howTo) || [],
    docsUrl: (s.ownerAuth && s.ownerAuth.docsUrl) || s.docsUrl || null,
    armEndpoint: (s.ownerAuth && s.ownerAuth.armEndpoint) || null,
  }));

  const pipeline = {};
  for (const stage of PIPELINE_STAGES) {
    pipeline[stage] = suppliers
      .filter((s) => s.capabilities && s.capabilities[stage] === true)
      .map((s) => ({
        id: s.id,
        name: s.name,
        configured: s.configured,
        status: s.status,
      }));
  }

  const liveFulfill = armed.filter((s) => s.capabilities && s.capabilities.orders).length;

  return {
    ok: true,
    protocol: PROTOCOL,
    invention: 'Universal Supplier Connector Framework',
    pipelineStages: PIPELINE_STAGES.slice(),
    suppliers,
    armedCount: armed.length,
    awaitingOwnerAuth: awaiting,
    pipeline,
    autoShipReady: liveFulfill > 0,
    note: liveFulfill > 0
      ? (armed.length + ' supplier rail(s) armed — dispatchable SKUs auto-ship.')
      : 'No supplier API key armed yet. Storefront + desk queue stay live; paste a real CJ / Printful / Printify key to unlock AUTO-SHIP.',
  };
}

/**
 * Honest AUTO-SHIP predicate for a published / scraped SKU.
 * Returns { dispatchable, provider, fulfillmentMode, badge, note }.
 */
function evaluateSku(sku) {
  const empty = {
    dispatchable: false,
    provider: null,
    fulfillmentMode: 'desk',
    badge: 'DESK-FULFIL',
    deliveryMode: 'zeus-fulfillment-desk',
    note: 'No armed supplier accepts this SKU — Zeus Fulfillment Desk.',
  };
  if (!sku || sku.demoOnly === true) {
    return Object.assign({}, empty, {
      note: 'Demo / curated preview — desk only (never auto-ship).',
    });
  }
  for (const c of CONNECTORS) {
    if (!c.isConfigured || !c.isConfigured()) continue;
    if (typeof c.acceptsSku === 'function' && !c.acceptsSku(sku)) continue;
    // Webhook is a catch-all — do not mark AUTO-SHIP solely because webhook is set
    // unless the SKU explicitly targets webhook.
    if (c.id === 'fulfill-webhook') {
      const supplier = String(sku.supplier || '').toLowerCase();
      if (supplier !== 'webhook' && supplier !== 'fulfill-webhook') continue;
    }
    const id = c.id;
    const mode = id === 'cj-dropshipping' ? 'cj-auto'
      : id === 'printful' ? 'printful-auto'
        : id === 'printify' ? 'printify-auto'
          : 'webhook';
    const deliveryMode = id === 'cj-dropshipping' ? 'cj-global-dropship'
      : id === 'printful' ? 'printful-pod'
        : id === 'printify' ? 'printify-pod'
          : 'webhook-fulfill';
    return {
      dispatchable: true,
      provider: id,
      fulfillmentMode: mode,
      badge: 'AUTO-SHIP',
      deliveryMode,
      note: 'Ships automatically via ' + id + ' using supplierRef '
        + (sku.supplierRef != null ? String(sku.supplierRef) : '') + '.',
    };
  }
  const anyArmed = CONNECTORS.some((c) => c.isConfigured && c.isConfigured() && c.id !== 'fulfill-webhook');
  return Object.assign({}, empty, {
    note: anyArmed
      ? 'Armed supplier(s) present but this SKU has no dispatchable variant id — desk queue.'
      : 'No CJ / Printful / Printify API key armed yet — desk queue until owner authorization.',
  });
}

function isDispatchableSku(sku) {
  return evaluateSku(sku).dispatchable === true;
}

/**
 * Route a paid order through the first accepting armed connector.
 */
async function createOrder(order) {
  const errors = [];
  // Prefer connector matching explicit supplier id when present.
  const preferred = String((order && order.supplier) || '').toLowerCase();
  const ordered = CONNECTORS.slice().sort((a, b) => {
    const aHit = preferred && (a.id.includes(preferred) || preferred.includes(a.id.replace(/-dropshipping$/, ''))) ? 0 : 1;
    const bHit = preferred && (b.id.includes(preferred) || preferred.includes(b.id.replace(/-dropshipping$/, ''))) ? 0 : 1;
    return aHit - bHit;
  });

  for (const c of ordered) {
    if (!c.isConfigured || !c.isConfigured()) continue;
    if (typeof c.acceptsSku === 'function' && !c.acceptsSku(order)) {
      errors.push({ provider: c.id, reason: 'sku_not_accepted' });
      continue;
    }
    if (typeof c.createOrder !== 'function') continue;
    try {
      const result = await c.createOrder(order);
      if (result && result.ok) return result;
      errors.push({ provider: c.id, reason: (result && result.reason) || 'failed' });
    } catch (e) {
      errors.push({ provider: c.id, reason: 'exception', message: e.message });
    }
  }
  return {
    ok: false,
    reason: errors.length ? (errors[errors.length - 1].reason || 'no_provider') : 'no_automatic_provider',
    tried: errors,
  };
}

/**
 * Pull products from every armed connector that implements searchProducts.
 * Used by scraper / world continuum when keys are present.
 */
async function searchAllProducts(opts) {
  const batches = [];
  for (const c of CONNECTORS) {
    if (!c.isConfigured || !c.isConfigured()) continue;
    if (typeof c.searchProducts !== 'function') continue;
    try {
      const r = await c.searchProducts(opts || {});
      if (r && r.ok && Array.isArray(r.items) && r.items.length) {
        batches.push({ provider: c.id, items: r.items });
      }
    } catch (_) { /* fail-soft */ }
  }
  const items = [];
  for (const b of batches) {
    for (const it of b.items) items.push(it);
  }
  return { ok: true, providers: batches.map((b) => b.provider), count: items.length, items };
}

/**
 * Persist a supplier credential into shared/process env (owner-authorized path).
 * Does NOT invent keys — only writes what the caller (admin) provides.
 */
function armEnvMap(supplier, body) {
  const id = String(supplier || '').toLowerCase();
  const apiKey = String((body && (body.apiKey || body.key || body.token)) || '').trim();
  const shopId = String((body && (body.shopId || body.storeId || body.PRINTFUL_STORE_ID || body.PRINTIFY_SHOP_ID)) || '').trim();
  const out = { env: {}, required: [] };

  if (id === 'cj' || id === 'cj-dropshipping') {
    out.required = ['apiKey'];
    if (apiKey) out.env.ZACC_CJ_API_KEY = apiKey;
    return out;
  }
  if (id === 'printful') {
    out.required = ['apiKey'];
    if (apiKey) {
      out.env.PRINTFUL_API_TOKEN = apiKey;
      out.env.PRINTFUL_API_KEY = apiKey;
    }
    if (shopId) out.env.PRINTFUL_STORE_ID = shopId;
    return out;
  }
  if (id === 'printify') {
    out.required = ['apiKey', 'shopId'];
    if (apiKey) {
      out.env.PRINTIFY_API_TOKEN = apiKey;
      out.env.PRINTIFY_API_KEY = apiKey;
    }
    if (shopId) out.env.PRINTIFY_SHOP_ID = shopId;
    return out;
  }
  if (id === 'webhook' || id === 'fulfill-webhook') {
    out.required = ['apiKey']; // apiKey field carries the URL
    const url = String((body && (body.url || body.apiKey || body.webhookUrl)) || '').trim();
    if (url) out.env.ZACC_FULFILL_WEBHOOK_URL = url;
    return out;
  }
  out.error = 'unknown_supplier';
  return out;
}

module.exports = {
  PROTOCOL,
  PIPELINE_STAGES,
  CONNECTORS,
  listConnectors,
  getConnector,
  discovery,
  evaluateSku,
  isDispatchableSku,
  createOrder,
  searchAllProducts,
  armEnvMap,
  cj,
  printful,
  printify,
  webhook,
};
