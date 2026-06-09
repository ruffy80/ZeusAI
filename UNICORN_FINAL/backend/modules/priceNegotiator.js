'use strict';

// priceNegotiator.js — single source for profitable, dynamic product pricing.
// Uses Unicorn dynamic-pricing when available and enforces a hard minimum
// profit floor (>= 30%) per mapped product cost.

const dynamicPricing = (() => {
  try { return require('./dynamic-pricing'); } catch (_) { return null; }
})();

const PRODUCT_ALIASES = Object.freeze({
  'website-audit': 'instant-website-audit',
  'brand-logo-kit': 'instant-logo-kit',
  'pitch-deck': 'instant-pitch-deck',
  'seo-content-pack': 'instant-seo-content-pack',
  'landing-page': 'instant-landing-page',
  'brand-name-icon': 'instant-product-naming',
  'email-onboarding': 'instant-email-sequence',
  'business-launch': 'professional-saas-mvp',
  'decima-inkathon': 'enterprise-decima-inkathon',
});

const BASE_COST_USD = Object.freeze({
  'website-audit': 15,
  'brand-logo-kit': 10,
  'pitch-deck': 20,
  'seo-content-pack': 35,
  'landing-page': 25,
  'brand-name-icon': 8,
  'email-onboarding': 12,
  'business-launch': 50,
  'decima-inkathon': 80,

  'instant-website-audit': 15,
  'instant-logo-kit': 10,
  'instant-pitch-deck': 20,
  'instant-seo-content-pack': 35,
  'instant-landing-page': 25,
  'instant-product-naming': 8,
  'instant-email-sequence': 12,
  'professional-saas-mvp': 50,
  'enterprise-decima-inkathon': 80,
});

const BASE_BTC_HINT = Object.freeze({
  'website-audit': 0.00035,
  'brand-logo-kit': 0.00022,
  'pitch-deck': 0.00048,
  'seo-content-pack': 0.00085,
  'landing-page': 0.00060,
  'brand-name-icon': 0.00018,
  'email-onboarding': 0.00028,
  'business-launch': 0.00120,
  'decima-inkathon': 0.00190,
});

const PROFIT_MARGIN = 1.30;

function resolveProductId(rawId) {
  const requested = String(rawId || '').trim();
  if (!requested) return { requested: 'unknown', serviceId: 'unknown' };
  return { requested, serviceId: PRODUCT_ALIASES[requested] || requested };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function getPrice(productId, context = {}) {
  const ids = resolveProductId(productId);
  const cost = Number(BASE_COST_USD[ids.requested] || BASE_COST_USD[ids.serviceId] || 0);
  const minUsd = cost > 0 ? round2(cost * PROFIT_MARGIN) : 0;

  let usd = 0;
  let source = 'fallback';
  if (dynamicPricing && typeof dynamicPricing.getPrice === 'function') {
    const opts = {
      userId: context.userId || null,
      coupon: context.coupon || null,
    };
    if (Number.isFinite(Number(context.basePrice)) && Number(context.basePrice) > 0) {
      opts.basePrice = Number(context.basePrice);
    }
    try {
      const q = dynamicPricing.getPrice(ids.serviceId, opts);
      const fromEngine = Number(q && q.finalPrice);
      if (fromEngine > 0) {
        usd = round2(fromEngine);
        source = 'dynamic-pricing';
      }
    } catch (_) {}
  }

  if (!(usd > 0)) usd = minUsd || 34.99;
  if (minUsd > 0 && usd < minUsd) usd = minUsd;

  let btc = null;
  const rate = Number(context.btcRate || 0);
  if (rate > 0) {
    btc = (usd / rate).toFixed(8);
  } else {
    const fallbackBase = Number(BASE_BTC_HINT[ids.requested] || 0);
    const fallback = fallbackBase > 0 ? (fallbackBase * PROFIT_MARGIN) : 0.00050;
    btc = fallback.toFixed(8);
    source += '-btc-fallback';
  }

  return {
    productId: ids.requested,
    serviceId: ids.serviceId,
    usd: round2(usd),
    btc,
    profitMargin: PROFIT_MARGIN,
    source,
  };
}

module.exports = { getPrice, PROFIT_MARGIN, resolveProductId };
