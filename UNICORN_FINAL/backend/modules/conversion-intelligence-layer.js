// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:06:23.821Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * conversion-intelligence-layer (REAL)
 * ------------------------------------
 * Funnel analyzer over real SQLite portal: leads → orders → paid → delivered.
 * Computes drop-off rates, GMV by stage, top products, conversion rate.
 * Pure read-only, deterministic. RO+EN comments preserved.
 */
const fs = require('fs');
const path = require('path');
const NAME = 'conversion-intelligence-layer';

const LEADS_FILE = path.join(__dirname, '..', '..', 'data', 'marketing', 'leads.jsonl');

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}

function _countLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return 0;
    return fs.readFileSync(LEADS_FILE, 'utf8').split('\n').filter(Boolean).length;
  } catch (_) { return 0; }
}

function buildFunnel() {
  if (!portal || typeof portal._listOrders !== 'function') {
    return { funnel: { leads: 0, orders: 0, paid: 0, delivered: 0 }, conversionPct: 0, gmvUsd: 0, topProducts: [] };
  }
  const orders = portal._listOrders({ limit: 5000 });
  const leads = _countLeads();
  const paid = orders.filter((o) => o.status === 'paid' || o.status === 'delivered');
  const delivered = orders.filter((o) => o.status === 'delivered');
  const gmvUsd = +paid.reduce((s, o) => s + Number(o.priceUSD || 0), 0).toFixed(2);
  const productMap = new Map();
  for (const o of paid) {
    const k = o.productId || 'unknown';
    productMap.set(k, (productMap.get(k) || 0) + Number(o.priceUSD || 0));
  }
  const topProducts = Array.from(productMap.entries())
    .map(([id, gmv]) => ({ productId: id, gmvUsd: +gmv.toFixed(2) }))
    .sort((a, b) => b.gmvUsd - a.gmvUsd).slice(0, 10);
  const conversionPct = leads > 0 ? +((paid.length / leads) * 100).toFixed(2) : 0;
  return {
    funnel: { leads, orders: orders.length, awaitingPayment: orders.filter((o) => o.status === 'awaiting_payment').length, paid: paid.length, delivered: delivered.length },
    conversionPct, gmvUsd, topProducts,
    dropOff: {
      leadToOrder: leads > 0 ? +(((leads - orders.length) / leads) * 100).toFixed(2) : 0,
      orderToPaid: orders.length > 0 ? +(((orders.length - paid.length) / orders.length) * 100).toFixed(2) : 0,
      paidToDelivered: paid.length > 0 ? +(((paid.length - delivered.length) / paid.length) * 100).toFixed(2) : 0
    }
  };
}

function getStatus(opts) {
  const f = buildFunnel();
  return {
    ok: true, name: NAME, title: 'Conversion Intelligence Layer', domain: 'conversion',
    summary: 'Real-time funnel analyzer over SQLite portal + lead ledger.',
    portalAttached: !!portal, ...f,
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return buildFunnel(input); }
module.exports = { name: NAME, buildFunnel, getStatus, run };
