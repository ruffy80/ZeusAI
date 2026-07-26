'use strict';

/**
 * Commerce Reality OS — single source of truth for what may be sold
 * self-serve vs contact-only vs unavailable on the public storefront.
 *
 * Modes:
 *   btc         — full self-serve Bitcoin checkout (instant digital)
 *   reserve     — BTC reserve / kickoff for human-built professional work
 *   contact     — SOW / enterprise sales only (no full-price self-serve buy)
 *   unavailable — demo, synthetic, or non-deliverable (must not checkout)
 */

const publicCatalogFilter = (() => {
  try { return require('./public-catalog-filter'); } catch (_) { return null; }
})();

const PUBLIC_SELF_SERVE_CORE_IDS = new Set([
  'free',
  'starter',
  'pro',
  'ai-analysis',
  'data-export',
]);

const CONTACT_CORE_IDS = new Set([
  'enterprise',
  'enterprise-tier',
  'global-giants',
  'sme',
  'mid-market',
  'api-call',
  'wealth-engine',
  'legal-bot',
  'cloud-broker',
]);

const ENTERPRISE_ID_RE = /^(ent-|enterprise)/i;
const PROFESSIONAL_ID_RE = /^professional-/i;
const INSTANT_ID_RE = /^instant-/i;

function _id(itemOrId) {
  if (itemOrId == null) return '';
  if (typeof itemOrId === 'string') return itemOrId.trim();
  return String(itemOrId.id || itemOrId.serviceId || '').trim();
}

function _tier(item, id) {
  if (item && typeof item === 'object') {
    const t = String(item.tier || item.group || item.segment || '').trim().toLowerCase();
    if (t) return t;
  }
  if (ENTERPRISE_ID_RE.test(id)) return 'enterprise';
  if (PROFESSIONAL_ID_RE.test(id)) return 'professional';
  if (INSTANT_ID_RE.test(id)) return 'instant';
  return '';
}

function _price(item) {
  if (!item || typeof item !== 'object') return 0;
  const n = Number(
    item.price != null ? item.price
      : (item.priceUsd != null ? item.priceUsd
        : (item.priceUSD != null ? item.priceUSD : 0))
  );
  return Number.isFinite(n) ? n : 0;
}

function isUnavailableItem(item, id) {
  if (!item || typeof item !== 'object') {
    if (/^zacc-/i.test(id) || /^unicorn-(auto-)?module-/i.test(id) || /^synthetic[_-]/i.test(id)) {
      return true;
    }
    return false;
  }
  if (item.demoOnly === true || item.synthetic === true || item.syntheticOnly === true) return true;
  if (item.dispatchable === false && (item.type === 'physical' || item.niche === 'dropship')) return true;
  if (publicCatalogFilter && typeof publicCatalogFilter.isSyntheticCatalogItem === 'function') {
    if (publicCatalogFilter.isSyntheticCatalogItem(item)) return true;
  }
  if (/^zacc-/i.test(id) || /^unicorn-(auto-)?module-/i.test(id)) return true;
  const group = String(item.group || item.segment || item.category || '').toLowerCase();
  if (group === 'zacc' || group === 'unicorn-auto-module' || group === 'auto-module' || group === 'synthetic') {
    return true;
  }
  if (item.autoPublished === true && group !== 'future-invention') return true;
  return false;
}

/**
 * @returns {{ mode: 'btc'|'reserve'|'contact'|'unavailable', buyable: boolean, reason: string, ctaLabel: string, ctaHref: string|null }}
 */
function assessBuyability(itemOrId, opts = {}) {
  const id = _id(itemOrId);
  const item = (itemOrId && typeof itemOrId === 'object') ? itemOrId : (opts.item || null);
  const tier = _tier(item, id);
  const group = String((item && (item.group || item.segment)) || tier || '').toLowerCase();
  const price = _price(item);

  if (!id) {
    return {
      mode: 'unavailable', buyable: false, reason: 'missing_id',
      ctaLabel: 'Unavailable', ctaHref: null,
    };
  }

  if (isUnavailableItem(item, id)) {
    return {
      mode: 'unavailable', buyable: false, reason: 'not_for_sale',
      ctaLabel: 'Not for sale', ctaHref: null,
    };
  }

  if (CONTACT_CORE_IDS.has(id) || ENTERPRISE_ID_RE.test(id) || tier === 'enterprise' || group === 'enterprise') {
    return {
      mode: 'contact', buyable: false, reason: 'enterprise_sow',
      ctaLabel: 'Request proposal →',
      ctaHref: '/enterprise#enterprise-contact',
    };
  }

  if (
    group === 'billion-scale-package'
    || group === 'billion-scale-activation'
    || group === 'strategic-package'
    || price >= 5000
  ) {
    return {
      mode: 'contact', buyable: false, reason: 'high_ticket_sow',
      ctaLabel: 'Request proposal →',
      ctaHref: '/enterprise#enterprise-contact',
    };
  }

  if (PROFESSIONAL_ID_RE.test(id) || tier === 'professional' || group === 'professional') {
    return {
      mode: 'reserve', buyable: true, reason: 'human_build_kickoff',
      ctaLabel: 'Reserve with BTC →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  if (INSTANT_ID_RE.test(id) || tier === 'instant' || group === 'instant' || PUBLIC_SELF_SERVE_CORE_IDS.has(id)) {
    return {
      mode: 'btc', buyable: true, reason: 'digital_deliverable',
      ctaLabel: 'Buy with BTC →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  // Curated strategic / frontier / vertical / future-invention deliverables:
  // self-serve when under the high-ticket threshold (handled above).
  // Aspirational / billion-scale / future-invention: never self-serve.
  if (
    group === 'future-invention'
    || group === 'billion-scale-package'
    || group === 'billion-scale-activation'
    || group === 'strategic-package'
    || /^(activation-|billion-|future-)/i.test(id)
  ) {
    return {
      mode: 'unavailable', buyable: false, reason: 'aspirational_not_for_sale',
      ctaLabel: 'Not available yet', ctaHref: null,
    };
  }

  const curatedPublicGroups = new Set([
    'strategic', 'frontier', 'vertical', 'service', 'core-plan',
  ]);
  if (curatedPublicGroups.has(group) || curatedPublicGroups.has(tier)) {
    return {
      mode: 'btc', buyable: true, reason: 'curated_deliverable',
      ctaLabel: 'Buy with BTC →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }
  if (publicCatalogFilter && typeof publicCatalogFilter.hasFulfillmentRecipe === 'function') {
    if (item && publicCatalogFilter.hasFulfillmentRecipe(item)) {
      return {
        mode: 'btc', buyable: true, reason: 'curated_deliverable',
        ctaLabel: 'Buy with BTC →',
        ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
      };
    }
  }

  // Known curated ids without a full item payload (checkout deep-link).
  if (INSTANT_ID_RE.test(id) || PROFESSIONAL_ID_RE.test(id) || PUBLIC_SELF_SERVE_CORE_IDS.has(id)) {
    return {
      mode: PROFESSIONAL_ID_RE.test(id) ? 'reserve' : 'btc',
      buyable: true,
      reason: 'seed_catalog',
      ctaLabel: PROFESSIONAL_ID_RE.test(id) ? 'Reserve with BTC →' : 'Buy with BTC →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  // Priced, non-synthetic catalog/snapshot item (tests + curated sinks).
  if (item && price > 0) {
    return {
      mode: 'btc', buyable: true, reason: 'priced_catalog_item',
      ctaLabel: 'Buy with BTC →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  return {
    mode: 'unavailable', buyable: false, reason: 'no_fulfillment_recipe',
    ctaLabel: 'Unavailable', ctaHref: null,
  };
}

function isSelfServeBuyable(itemOrId, opts) {
  return assessBuyability(itemOrId, opts).buyable === true;
}

function publicServiceIdsFromUnified() {
  try {
    const unified = require('./unified-catalog');
    const ids = new Set();
    for (const p of unified.all() || []) {
      if (p && p.id) ids.add(String(p.id));
    }
    return ids;
  } catch (_) {
    return new Set();
  }
}

module.exports = {
  assessBuyability,
  isSelfServeBuyable,
  isUnavailableItem,
  publicServiceIdsFromUnified,
  PUBLIC_SELF_SERVE_CORE_IDS,
  CONTACT_CORE_IDS,
};
