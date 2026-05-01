// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T17:06:23.645Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * ai-sales-closer-pro (REAL)
 * --------------------------
 * Reads abandoned-cart / awaiting_payment orders from the SQLite portal
 * and prioritizes them by ICP-fit + value, producing actionable closer tasks.
 * Pure pull-based, no timers, deterministic. RO+EN comments preserved.
 */
const path = require('path');
const NAME = 'ai-sales-closer-pro';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}

function _scoreOrder(o, customer) {
  let score = 0;
  const usd = Number(o.priceUSD || 0);
  if (usd >= 5000) score += 50;
  else if (usd >= 1000) score += 30;
  else if (usd >= 200) score += 15;
  else score += 5;
  if (customer && customer.email && /\.(com|io|ai|co)$/.test(customer.email)) score += 10;
  if (customer && customer.email && !/(gmail|yahoo|hotmail|outlook|icloud)\./i.test(customer.email)) score += 15; // business domain
  const ageH = (Date.now() - (Date.parse(o.createdAt || '') || Date.now())) / 3600000;
  if (ageH > 1 && ageH < 48) score += 10; // hot zone
  return Math.min(100, score);
}

function buildPipeline(opts) {
  if (!portal || typeof portal._listOrders !== 'function') return { pipeline: [], totals: { count: 0, weightedUsd: 0 } };
  const orders = portal._listOrders({ status: 'awaiting_payment', limit: 500 });
  const items = orders.map((o) => {
    const c = o.customerId && typeof portal.getById === 'function' ? portal.getById(o.customerId) : null;
    const score = _scoreOrder(o, c);
    return {
      orderId: o.id, customerId: o.customerId, email: c && c.email || null,
      productId: o.productId, priceUSD: Number(o.priceUSD || 0),
      score, ageMinutes: Math.floor((Date.now() - (Date.parse(o.createdAt || '') || Date.now())) / 60000),
      action: score >= 60 ? 'call_now' : score >= 35 ? 'email_now' : 'sequence_normal'
    };
  }).sort((a, b) => b.score - a.score);
  const totals = items.reduce((acc, it) => { acc.count++; acc.weightedUsd += it.priceUSD * (it.score / 100); return acc; }, { count: 0, weightedUsd: 0 });
  totals.weightedUsd = +totals.weightedUsd.toFixed(2);
  return { pipeline: items.slice(0, Number((opts && opts.limit) || 50)), totals };
}

function getStatus(opts) {
  const p = buildPipeline(opts);
  return {
    ok: true, name: NAME, title: 'AI Sales Closer Pro', domain: 'sales-closer',
    summary: 'Prioritizes awaiting_payment orders by ICP-fit + value and emits actions.',
    portalAttached: !!portal, totals: p.totals, top: p.pipeline.slice(0, 5),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return buildPipeline(input); }
module.exports = { name: NAME, buildPipeline, getStatus, run };
