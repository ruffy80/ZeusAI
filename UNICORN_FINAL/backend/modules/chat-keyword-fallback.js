'use strict';

/**
 * Last chat reply when no provider and no local model answered.
 * The sentences follow the public shelf. They do not invent rails,
 * certifications, or revenue.
 */

const ROWS = [
  [['payment', 'paypal', 'pay', 'plată', 'plata', 'plăți', 'plati'], 'Bitcoin is the live payment rail. Card and PayPal appear at checkout when they are configured. Prices are on /pricing.'],
  [['marketplace'], 'Offers for sale are the public shelf at /pricing, /services, and /buy. The listing desk, the frontier tool packs, and the industry architecture packs are on that shelf.'],
  [['blockchain', 'crypto'], 'Bitcoin is the live payment rail. The public shelf does not sell a quantum blockchain or a smart-contract product. Priced frontier tools are on the shelf at /frontier. Orbital compute, a neural implant, and a quantum channel are not products.'],
  [['compliance', 'compliant', 'hipaa', 'sox', 'gdpr', 'legal'], 'ZeusAI does not sell a HIPAA, SOX, or multi-standard certification. The refund contract is at /refund. Privacy is at /privacy.'],
  [['revenue', 'profit'], 'This reply is not a live revenue metric. The public shelf does not generate deals by itself. Prices are on /pricing. Confirmed buyers are counted on /origin.'],
  [['plan', 'pricing', 'pret'], 'Prices are the public shelf at /pricing. Bitcoin is the live rail. An enterprise kickoff does not deliver the license, the source, or a private cloud.'],
  [['innovation', 'inova'], 'Offers for sale are the public shelf at /pricing. Priced frontier tools are on that shelf. Orbital compute, a neural implant, and a quantum channel are not products.'],
  [['admin', 'dashboard'], 'The operator login is /admin/login. It is not a public product and it does not publish live revenue.'],
];

const DEFAULT_REPLY = 'The catalog is the public shelf at /pricing, /services, and /buy. Say what you want to exist after you pay.';

function hasKey(hay, key) {
  if (key.length > 3) return hay.includes(key);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)').test(hay);
}

function replyFor(message) {
  const lower = String(message || '').toLowerCase();
  const matched = ROWS.find(([keywords]) => keywords.some((key) => hasKey(lower, key)));
  return {
    reply: matched ? matched[1] : DEFAULT_REPLY,
    model: 'keyword-fallback',
    degraded: true,
  };
}

module.exports = { replyFor, DEFAULT_REPLY };
