'use strict';

async function upgradePrices(domain) {
  let negotiator = null;
  try { negotiator = require('../../backend/modules/priceNegotiator'); } catch (_) { negotiator = null; }
  if (!negotiator || typeof negotiator.getPrice !== 'function') {
    console.warn('[score] priceNegotiator is unavailable. Upgrade prices are not invented.');
    return { ok: false, report: null, audit: null };
  }
  const report = await negotiator.getPrice('score-full-report', { basePrice: 29, userId: domain });
  const audit = await negotiator.getPrice('instant-website-audit', { userId: domain });
  return {
    ok: true,
    locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    report: { usd: report.usd, btc: report.btc, source: report.source, serviceId: report.serviceId },
    audit: { usd: audit.usd, btc: audit.btc, source: audit.source, serviceId: audit.serviceId },
  };
}

module.exports = { upgradePrices };
