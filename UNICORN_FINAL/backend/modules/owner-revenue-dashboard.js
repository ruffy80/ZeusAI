// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:06:23.823Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * owner-revenue-dashboard (REAL)
 * ------------------------------
 * Aggregates real GMV / payouts / per-product breakdown from SQLite portal.
 * Output is the canonical owner financial snapshot used by /api/admin/owner-revenue.
 * Pure read-only. RO+EN comments preserved.
 */
const path = require('path');
const NAME = 'owner-revenue-dashboard';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}

function _allOrders() {
  if (!portal || typeof portal._listOrders !== 'function') return [];
  return portal._listOrders({ limit: 10000 });
}

function snapshot(opts) {
  const orders = _allOrders();
  const paid = orders.filter((o) => o.status === 'paid' || o.status === 'delivered');
  const gmvUsd = +paid.reduce((s, o) => s + Number(o.priceUSD || 0), 0).toFixed(2);
  const gmvBtc = +paid.reduce((s, o) => s + Number(o.btcAmount || 0), 0).toFixed(8);
  const now = Date.now();
  const last24h = paid.filter((o) => (Date.parse(o.paidAt || o.createdAt || '') || 0) > now - 86400000);
  const last7d = paid.filter((o) => (Date.parse(o.paidAt || o.createdAt || '') || 0) > now - 7 * 86400000);
  const last30d = paid.filter((o) => (Date.parse(o.paidAt || o.createdAt || '') || 0) > now - 30 * 86400000);
  const productMap = new Map();
  for (const o of paid) {
    const k = o.productId || 'unknown';
    const cur = productMap.get(k) || { productId: k, count: 0, gmvUsd: 0, gmvBtc: 0 };
    cur.count += 1; cur.gmvUsd += Number(o.priceUSD || 0); cur.gmvBtc += Number(o.btcAmount || 0);
    productMap.set(k, cur);
  }
  const byProduct = Array.from(productMap.values())
    .map((p) => ({ ...p, gmvUsd: +p.gmvUsd.toFixed(2), gmvBtc: +p.gmvBtc.toFixed(8) }))
    .sort((a, b) => b.gmvUsd - a.gmvUsd);
  const btcWallet = (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
  return {
    owner: { name: 'Vladoi Ionut', btcAddress: btcWallet },
    totals: {
      ordersAll: orders.length,
      ordersAwaiting: orders.filter((o) => o.status === 'awaiting_payment').length,
      ordersPaid: paid.length,
      ordersDelivered: orders.filter((o) => o.status === 'delivered').length,
      gmvUsd, gmvBtc,
      gmvUsd24h: +last24h.reduce((s, o) => s + Number(o.priceUSD || 0), 0).toFixed(2),
      gmvUsd7d: +last7d.reduce((s, o) => s + Number(o.priceUSD || 0), 0).toFixed(2),
      gmvUsd30d: +last30d.reduce((s, o) => s + Number(o.priceUSD || 0), 0).toFixed(2)
    },
    byProduct,
    payout: { rail: 'btc-direct', btcAddress: btcWallet, currency: 'USD' }
  };
}

function getStatus(opts) {
  const s = snapshot(opts);
  return {
    ok: true, name: NAME, title: 'Owner Revenue Dashboard', domain: 'revenue',
    summary: 'Real GMV + per-product breakdown direct from SQLite portal. No middleman.',
    portalAttached: !!portal,
    ...s,
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return snapshot(input); }
module.exports = { name: NAME, snapshot, getStatus, run };
