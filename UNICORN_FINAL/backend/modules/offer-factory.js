// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.268Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * offer-factory (REAL implementation)
 * -----------------------------------
 * Bundles N deliverables from the master catalog into a single high-ticket
 * offer with auto-applied volume discount. Persists the offer as a draft
 * order in the SQLite portal so the customer journey is identical to a
 * regular checkout (BTC URI, /order/:id polling, license issuance).
 *
 * Pure Node, in-process. No external network calls.
 *
 * API surface:
 *   bundle({ items, customerId, btcSpotUsd, btcWallet, label }) → offer
 *   listRecent(limit)                                           → array
 *   getStatus()                                                 → object
 *   run(input)                                                  → bundle()
 */

const path = require('path');
const crypto = require('crypto');

const NAME   = 'offer-factory';
const TITLE  = 'Offer Factory';
const DOMAIN = 'high-ticket-offers';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}

const _recent = [];
const MAX_RECENT = 200;

// Volume-tiered bundle discount — transparent and deterministic.
function bundleDiscountPct(itemCount, totalUsd) {
  let pct = 0;
  if (itemCount >= 3) pct += 5;
  if (itemCount >= 5) pct += 5;
  if (itemCount >= 8) pct += 5;
  if (totalUsd >= 1000) pct += 5;
  if (totalUsd >= 5000) pct += 5;
  return Math.min(pct, 25);
}

function bundle(input) {
  const items = Array.isArray(input && input.items) ? input.items : [];
  if (!items.length) {
    const err = new Error('items_required'); err.code = 'items_required'; throw err;
  }
  const cleanItems = items.map((it) => ({
    id: String(it.id || '').slice(0, 80),
    title: String(it.title || it.id || '').slice(0, 200),
    priceUsd: Math.max(0, Number(it.priceUsd || 0)),
    kpi: String(it.kpi || '').slice(0, 80),
    group: String(it.group || 'mixed').slice(0, 40)
  })).filter((it) => it.id);
  const grossUsd = cleanItems.reduce((s, it) => s + it.priceUsd, 0);
  const discountPct = bundleDiscountPct(cleanItems.length, grossUsd);
  const netUsd = +(grossUsd * (1 - discountPct / 100)).toFixed(2);
  const usdPerBtc = Math.max(1, Number(input && input.btcSpotUsd) || 95000);
  const btcAmount = +(netUsd / usdPerBtc).toFixed(8);
  const btcWallet = String((input && input.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
  const id = 'bundle_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  const label = String((input && input.label) || `Unicorn Bundle × ${cleanItems.length}`).slice(0, 120);
  const btcUri = btcAmount > 0
    ? `bitcoin:${btcWallet}?amount=${btcAmount.toFixed(8)}&label=${encodeURIComponent('ZeusAI-' + id)}`
    : null;

  const offer = {
    id,
    label,
    items: cleanItems,
    grossUsd: +grossUsd.toFixed(2),
    discountPct,
    netUsd,
    btcAmount,
    btcAddress: btcWallet,
    btcUri,
    createdAt: new Date().toISOString(),
    customerId: (input && input.customerId) || null,
    orderId: null
  };

  // Persist as draft order if portal is available and a customer is provided.
  if (portal && offer.customerId && typeof portal.createOrder === 'function') {
    try {
      const order = portal.createOrder({
        customerId: offer.customerId,
        productId: offer.id,
        priceUSD: netUsd,
        btcAmount: btcAmount,
        btcAddress: btcWallet,
        invoiceUri: btcUri,
        status: 'awaiting_payment',
        inputs: { bundle: cleanItems.map((it) => it.id), label }
      });
      offer.orderId = order && order.id ? order.id : null;
    } catch (_) { /* non-fatal */ }
  }

  _recent.push(offer);
  if (_recent.length > MAX_RECENT) _recent.shift();
  return offer;
}

function listRecent(limit) {
  const n = Math.min(MAX_RECENT, Math.max(1, parseInt(limit, 10) || 20));
  return _recent.slice(-n).reverse();
}

function getStatus(opts) {
  const totals = _recent.reduce((acc, o) => {
    acc.gmvUsd += o.netUsd; acc.grossUsd += o.grossUsd; acc.bundles += 1;
    acc.itemsBundled += o.items.length;
    return acc;
  }, { bundles: 0, itemsBundled: 0, grossUsd: 0, gmvUsd: 0 });
  return {
    ok: true,
    name: NAME,
    title: TITLE,
    domain: DOMAIN,
    summary: 'Bundles deliverables into discounted offers and persists drafts to the SQLite portal.',
    totals: { bundles: totals.bundles, itemsBundled: totals.itemsBundled, grossUsd: +totals.grossUsd.toFixed(2), netUsd: +totals.gmvUsd.toFixed(2) },
    portalAttached: !!portal,
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return bundle(input); }

module.exports = { name: NAME, title: TITLE, domain: DOMAIN, bundle, listRecent, getStatus, run };
