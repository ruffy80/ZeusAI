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
 * enterprise-deal-desk (REAL)
 * ---------------------------
 * Builds enterprise quotes (multi-vertical bundles, custom MSA terms, SLA tier),
 * persists as a draft order in the SQLite portal, returns a quote URL + BTC URI.
 * RO+EN comments preserved.
 */
const path = require('path');
const crypto = require('crypto');
const NAME = 'enterprise-deal-desk';

let portal = null;
try { portal = require(path.join(__dirname, '..', '..', 'src', 'commerce', 'customer-portal.js')); } catch (_) {}

const SLA_TIERS = {
  'standard':    { uplift: 1.0,  slaUptime: '99.9%',  responseHours: 24, label: 'Standard' },
  'enterprise':  { uplift: 1.25, slaUptime: '99.95%', responseHours: 4,  label: 'Enterprise' },
  'mission':     { uplift: 1.5,  slaUptime: '99.99%', responseHours: 1,  label: 'Mission-Critical' }
};

function buildQuote(input) {
  const items = Array.isArray(input && input.items) ? input.items : [];
  if (!items.length) { const err = new Error('items_required'); err.code = 'items_required'; throw err; }
  const tierKey = String((input && input.slaTier) || 'standard').toLowerCase();
  const tier = SLA_TIERS[tierKey] || SLA_TIERS.standard;
  const seats = Math.max(1, Number((input && input.seats) || 1));
  const cleanItems = items.map((it) => ({
    id: String(it.id || '').slice(0, 80),
    title: String(it.title || it.id || '').slice(0, 200),
    priceUsd: Math.max(0, Number(it.priceUsd || 0))
  })).filter((it) => it.id);
  const baseUsd = cleanItems.reduce((s, it) => s + it.priceUsd, 0);
  const seatMultiplier = seats <= 5 ? 1 : seats <= 25 ? Math.log10(seats + 1) : Math.log2(seats + 1);
  const subtotalUsd = +(baseUsd * seatMultiplier * tier.uplift).toFixed(2);
  const customDiscount = Math.max(0, Math.min(30, Number((input && input.discountPct) || 0)));
  const netUsd = +(subtotalUsd * (1 - customDiscount / 100)).toFixed(2);
  const usdPerBtc = Math.max(1, Number((input && input.btcSpotUsd) || 95000));
  const btcAmount = +(netUsd / usdPerBtc).toFixed(8);
  const btcWallet = String((input && input.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
  const id = 'quote_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
  const btcUri = btcAmount > 0 ? `bitcoin:${btcWallet}?amount=${btcAmount.toFixed(8)}&label=${encodeURIComponent('ZeusAI-' + id)}` : null;

  const quote = {
    id,
    customerId: (input && input.customerId) || null,
    items: cleanItems,
    seats,
    slaTier: { key: tierKey, ...tier },
    baseUsd: +baseUsd.toFixed(2),
    seatMultiplier: +seatMultiplier.toFixed(3),
    subtotalUsd,
    discountPct: customDiscount,
    netUsd,
    btcAmount, btcAddress: btcWallet, btcUri,
    msaUrl: input && input.msaUrl ? String(input.msaUrl).slice(0, 500) : null,
    createdAt: new Date().toISOString(),
    orderId: null
  };

  if (portal && quote.customerId && typeof portal.createOrder === 'function') {
    try {
      const o = portal.createOrder({
        customerId: quote.customerId, productId: quote.id,
        priceUSD: netUsd, btcAmount, btcAddress: btcWallet, invoiceUri: btcUri,
        status: 'awaiting_payment', inputs: { quote: cleanItems.map((it) => it.id), seats, slaTier: tierKey }
      });
      quote.orderId = o && o.id ? o.id : null;
    } catch (_) {}
  }
  return quote;
}

function getStatus(opts) {
  return {
    ok: true, name: NAME, title: 'Enterprise Deal Desk', domain: 'enterprise-quoting',
    summary: 'Builds enterprise quotes (seat-tiered, SLA-uplift) and persists draft orders.',
    portalAttached: !!portal,
    slaTiers: Object.entries(SLA_TIERS).map(([k, v]) => ({ key: k, ...v })),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) { return buildQuote(input); }
module.exports = { name: NAME, buildQuote, getStatus, run };
