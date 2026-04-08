// dynamic-pricing.js – Dynamic pricing engine based on market conditions and client behavior
'use strict';

const BASE_PRICES = {
  starter: 29,
  pro: 99,
  enterprise: 499,
  'api-call': 0.01,
  'ai-analysis': 5,
  'wealth-engine': 199,
  'legal-bot': 49,
  'cloud-broker': 79,
  'data-export': 9,
};

const DEMAND_FACTOR_HISTORY = [];
let currentDemandFactor = 1.0;
let peakHoursActive = false;
let surgeActive = false;
let discountActive = true; // 20% discount as per spec

function updateDemandFactor() {
  const hour = new Date().getHours();
  // Peak hours: 9-12 and 14-18 (European business hours)
  peakHoursActive = (hour >= 9 && hour <= 12) || (hour >= 14 && hour <= 18);

  const base = peakHoursActive ? 1.05 : 0.95;
  const noise = (Math.random() - 0.5) * 0.1;
  currentDemandFactor = Math.max(0.7, Math.min(1.5, base + noise));

  DEMAND_FACTOR_HISTORY.push({ factor: currentDemandFactor, ts: new Date().toISOString() });
  if (DEMAND_FACTOR_HISTORY.length > 100) DEMAND_FACTOR_HISTORY.shift();
}

function getPrice(serviceId, options = {}) {
  const base = BASE_PRICES[serviceId] ?? 99;
  const { userId, quantity = 1, coupon } = options;

  let price = base * currentDemandFactor;

  // Volume discounts
  if (quantity >= 10) price *= 0.85;
  else if (quantity >= 5) price *= 0.92;

  // Loyalty discount (returning user)
  if (userId) price *= 0.95;

  // Surge pricing
  if (surgeActive) price *= 1.2;

  // Global 20% discount
  if (discountActive) price *= 0.80;

  // Coupon codes
  if (coupon === 'UNICORN2026') price *= 0.7;
  if (coupon === 'LAUNCH50') price *= 0.5;

  return {
    serviceId,
    basePrice: base,
    finalPrice: Math.max(0.01, Math.round(price * 100) / 100),
    demandFactor: currentDemandFactor,
    discountApplied: discountActive,
    surgeActive,
    peakHours: peakHoursActive,
    currency: 'USD',
    btcEquivalent: null, // filled on demand
    quantity,
  };
}

function getAllPrices(options = {}) {
  return Object.keys(BASE_PRICES).reduce((acc, k) => {
    acc[k] = getPrice(k, options);
    return acc;
  }, {});
}

function activateSurge(durationMs = 3600000) {
  surgeActive = true;
  setTimeout(() => { surgeActive = false; }, durationMs);
  console.log('[DynamicPricing] Surge pricing activated for', durationMs / 60000, 'min');
}

function setDiscount(active) {
  discountActive = active;
}

function getMarketConditions() {
  return {
    demandFactor: currentDemandFactor,
    peakHours: peakHoursActive,
    surgeActive,
    discountActive,
    history: DEMAND_FACTOR_HISTORY.slice(-10),
  };
}

// Update demand factor every 5 minutes
setInterval(updateDemandFactor, 5 * 60 * 1000);
updateDemandFactor(); // initial call

module.exports = { getPrice, getAllPrices, activateSurge, setDiscount, getMarketConditions, BASE_PRICES };
