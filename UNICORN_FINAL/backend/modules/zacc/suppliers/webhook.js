// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// USCF connector — generic fulfillment webhook (any external warehouse/ERP).

'use strict';

const { capabilityMatrix, envArmed, ownerAuthStep } = require('./contract');

const ID = 'fulfill-webhook';
const TIMEOUT_MS = 6000;

function isConfigured() {
  return envArmed('ZACC_FULFILL_WEBHOOK_URL', 8)
    && /^https?:\/\//i.test(String(process.env.ZACC_FULFILL_WEBHOOK_URL || '').trim());
}

function capabilities() {
  return capabilityMatrix({
    products: false,
    inventory: false,
    pricing: false,
    orders: true,
    fulfillment: true,
    tracking: false,
    returns: false,
  });
}

function discovery() {
  const armed = isConfigured();
  return {
    id: ID,
    name: 'Generic Fulfill Webhook',
    kind: 'webhook',
    protocol: 'USCF/1.0',
    official: false,
    docsUrl: null,
    auth: { type: 'url', env: 'ZACC_FULFILL_WEBHOOK_URL' },
    envVars: ['ZACC_FULFILL_WEBHOOK_URL'],
    capabilities: capabilities(),
    configured: armed,
    status: armed ? 'live' : 'awaiting_owner_auth',
    ownerAuth: armed ? null : ownerAuthStep({
      id: ID,
      envVars: ['ZACC_FULFILL_WEBHOOK_URL'],
      howTo: [
        'Point ZACC_FULFILL_WEBHOOK_URL at your warehouse/ERP HTTPS endpoint',
        'Zeus POSTs { kind: "zacc.order", order } on every paid invoice when primary suppliers miss',
      ],
      note: 'Optional catch-all rail when CJ/Printful/Printify are not used.',
    }),
  };
}

function acceptsSku() {
  return isConfigured();
}

async function createOrder(order) {
  if (!isConfigured()) return { ok: false, reason: 'webhook_not_configured' };
  if (typeof fetch !== 'function') return { ok: false, reason: 'fetch_unavailable' };
  const url = String(process.env.ZACC_FULFILL_WEBHOOK_URL || '').trim();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'zacc.order', order, uscf: '1.0' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) return { ok: false, reason: 'webhook_status_' + r.status };
    return { ok: true, provider: ID, fulfillmentMode: 'webhook' };
  } catch (e) {
    return { ok: false, reason: 'webhook_exception', message: e.message };
  }
}

module.exports = {
  id: ID,
  discovery,
  isConfigured,
  capabilities,
  acceptsSku,
  createOrder,
};
