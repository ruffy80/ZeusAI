'use strict';

/**
 * A public price is the price of the file the buyer downloads.
 * These ids name a contract figure. The license, the source, the cloud,
 * and the company are not in the file, so the figure is not a checkout price.
 */
const CONTRACT_FIGURE_IDS = new Set([
  'ent-acquisition-pack',
  'ent-sovereign-deployment',
  'ent-ai-transformation',
  'ent-white-label',
  'ent-platform-license',
  'ent-private-cloud',
  'ent-revenue-share',
]);

// Indicative segment prices. They are not the price of a file a customer downloads.
const INDICATIVE_PRICE_IDS = new Set([
  'enterprise',
  'enterprise-tier',
  'global-giants',
  'sme',
  'mid-market',
  'wealth-engine',
  'legal-bot',
  'cloud-broker',
]);

function isContractFigure(id) {
  return CONTRACT_FIGURE_IDS.has(String(id || ''));
}

function isNotAProductPrice(id) {
  const key = String(id || '');
  return CONTRACT_FIGURE_IDS.has(key) || INDICATIVE_PRICE_IDS.has(key);
}

module.exports = {
  CONTRACT_FIGURE_IDS,
  INDICATIVE_PRICE_IDS,
  isContractFigure,
  isNotAProductPrice,
};
