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

/**
 * DTBG/1.0 — Delivery-Truth Buy Gate
 * Refuse self-serve buy when no honest delivery lane exists:
 *   - physical / dropship without dispatchable supplier
 *   - explicit requiresLiveAi / ai_required when AI Eternal OS is unarmed
 * Digital instant SKUs remain buyable via deterministic activation packs
 * even when AI is unarmed (honest lane = deterministic).
 */
function assessDeliveryTruth(itemOrId, opts = {}) {
  const id = _id(itemOrId);
  const item = (itemOrId && typeof itemOrId === 'object') ? itemOrId : (opts.item || null);
  if (!id) {
    return { ok: false, lane: 'none', reason: 'missing_id', protocol: 'DTBG/1.0' };
  }

  const niche = String((item && (item.niche || item.type || item.category)) || '').toLowerCase();
  const isPhysical = niche === 'physical' || niche === 'dropship'
    || (item && (item.type === 'physical' || item.fulfillment === 'physical'));

  if (isPhysical || /^ds[_:-]/i.test(id) || /^dropship[_:-]/i.test(id)) {
    if (item && item.dispatchable === false) {
      return { ok: false, lane: 'none', reason: 'no_supplier_dispatch', protocol: 'DTBG/1.0' };
    }
    if (item && item.dispatchable === true) {
      return { ok: true, lane: 'supplier', reason: 'auto_ship_ready', protocol: 'DTBG/1.0' };
    }
    // Virtual dropship honesty is handled by UPR; bare physical without truth → block
    if (isPhysical && !(item && item.dispatchable === true)) {
      return { ok: false, lane: 'none', reason: 'delivery_truth_unknown', protocol: 'DTBG/1.0' };
    }
  }

  const requiresLiveAi = !!(item && (item.requiresLiveAi === true || item.ai_required === true
    || String(item.fulfillmentMode || '').toLowerCase() === 'ai_required'));

  let aiArmed = false;
  let aiWouldUse = false;
  try {
    const ai = require('../../backend/modules/fulfillment-ai-os');
    if (ai && typeof ai.isArmed === 'function') aiArmed = !!ai.isArmed();
    if (ai && typeof ai.shouldUseAiForSku === 'function') aiWouldUse = !!ai.shouldUseAiForSku(id);
  } catch (_) { /* ignore */ }

  if (requiresLiveAi && !aiArmed) {
    return {
      ok: false,
      lane: 'none',
      reason: 'ai_fulfillment_unarmed',
      protocol: 'DTBG/1.0',
      aiArmed: false,
    };
  }

  if (aiWouldUse && aiArmed) {
    return { ok: true, lane: 'ai', reason: 'ai_eternal_armed', protocol: 'DTBG/1.0', aiArmed: true };
  }

  // Professional / human reserve lanes are buyable as reserve elsewhere
  if (PROFESSIONAL_ID_RE.test(id) || (item && String(item.tier || '').toLowerCase() === 'professional')) {
    return { ok: true, lane: 'human', reason: 'human_build_kickoff', protocol: 'DTBG/1.0' };
  }

  return {
    ok: true,
    lane: 'deterministic',
    reason: aiWouldUse ? 'digital_deterministic_while_ai_unarmed' : 'digital_deterministic',
    protocol: 'DTBG/1.0',
    aiArmed,
  };
}

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

  // Universal Payment Rails — virtual SKUs (dropship / social-tip).
  // Dropship must still pass dispatchable / demo honesty (no invoice bypass).
  try {
    const upr = require('./universal-payment-rails');
    if (upr && typeof upr.isVirtualSku === 'function' && upr.isVirtualSku(id)) {
      const virtual = upr.assessVirtualBuyability(id, item || undefined);
      // Map UPR "checkout" mode onto storefront "btc" multi-rail chooser semantics.
      if (virtual && virtual.buyable && virtual.mode === 'checkout') {
        return Object.assign({}, virtual, { mode: 'btc' });
      }
      return virtual;
    }
  } catch (_) { /* fall through */ }

  if (isUnavailableItem(item, id)) {
    return {
      mode: 'unavailable', buyable: false, reason: 'not_for_sale',
      ctaLabel: 'Not for sale', ctaHref: null,
    };
  }

  // Self-serve enterprise kickoff — only ent-* SKU that is buyable.
  // Full ACV packages stay contact/negotiate; cash closes via this deposit.
  if (id === 'ent-engagement-kickoff' || group === 'enterprise-kickoff') {
    return {
      mode: 'reserve',
      buyable: true,
      reason: 'enterprise_kickoff',
      ctaLabel: 'Start autonomous deal →',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  if (CONTACT_CORE_IDS.has(id) || ENTERPRISE_ID_RE.test(id) || tier === 'enterprise' || group === 'enterprise') {
    return {
      mode: 'contact', buyable: false, reason: 'enterprise_sow',
      ctaLabel: 'Start autonomous deal →',
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
      ctaLabel: 'Start autonomous deal →',
      ctaHref: '/enterprise#enterprise-contact',
    };
  }

  if (PROFESSIONAL_ID_RE.test(id) || tier === 'professional' || group === 'professional') {
    return {
      mode: 'reserve', buyable: true, reason: 'human_build_kickoff',
      ctaLabel: 'Reserve → choose payment',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  if (INSTANT_ID_RE.test(id) || tier === 'instant' || group === 'instant' || PUBLIC_SELF_SERVE_CORE_IDS.has(id)) {
    const dt = assessDeliveryTruth(item || id, { item });
    if (!dt.ok) {
      return {
        mode: dt.reason === 'ai_fulfillment_unarmed' ? 'contact' : 'unavailable',
        buyable: false,
        reason: dt.reason,
        ctaLabel: dt.reason === 'ai_fulfillment_unarmed' ? 'AI fulfillment arming →' : 'Unavailable',
        ctaHref: dt.reason === 'ai_fulfillment_unarmed' ? '/enterprise#enterprise-contact' : null,
        deliveryTruth: dt,
      };
    }
    return {
      mode: 'btc', buyable: true, reason: 'digital_deliverable',
      ctaLabel: 'Buy → choose payment',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
      deliveryTruth: dt,
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
      ctaLabel: 'Buy → choose payment',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }
  if (publicCatalogFilter && typeof publicCatalogFilter.hasFulfillmentRecipe === 'function') {
    if (item && publicCatalogFilter.hasFulfillmentRecipe(item)) {
      return {
        mode: 'btc', buyable: true, reason: 'curated_deliverable',
        ctaLabel: 'Buy → choose payment',
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
      ctaLabel: PROFESSIONAL_ID_RE.test(id) ? 'Reserve → choose payment' : 'Buy → choose payment',
      ctaHref: '/checkout/?plan=' + encodeURIComponent(id),
    };
  }

  // Priced, non-synthetic catalog/snapshot item (tests + curated sinks).
  if (item && price > 0) {
    return {
      mode: 'btc', buyable: true, reason: 'priced_catalog_item',
      ctaLabel: 'Buy → choose payment',
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
  assessDeliveryTruth,
  isSelfServeBuyable,
  isUnavailableItem,
  publicServiceIdsFromUnified,
  PUBLIC_SELF_SERVE_CORE_IDS,
  CONTACT_CORE_IDS,
};
