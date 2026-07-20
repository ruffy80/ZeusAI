'use strict';

/**
 * Public storefront catalog filter.
 *
 * ZACC / trend-clone / unicorn-auto-module SKUs remain in internal data sinks
 * and admin/opt-in views, but must not appear as default buyable finished goods.
 */

const SYNTHETIC_GROUPS = new Set([
  'zacc',
  'unicorn-auto-module',
  'auto-module',
  'trend-clone',
  'synthetic',
]);

function truthyQueryFlag(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function wantsIncludeSynthetic(requestUrlOrQuery) {
  if (!requestUrlOrQuery) return false;
  if (typeof requestUrlOrQuery.get === 'function') {
    return truthyQueryFlag(requestUrlOrQuery.get('includeSynthetic'));
  }
  if (requestUrlOrQuery.searchParams && typeof requestUrlOrQuery.searchParams.get === 'function') {
    return truthyQueryFlag(requestUrlOrQuery.searchParams.get('includeSynthetic'));
  }
  if (typeof requestUrlOrQuery === 'object') {
    return truthyQueryFlag(requestUrlOrQuery.includeSynthetic);
  }
  return false;
}

/**
 * A "fulfillment recipe" is a real, curated definition of what the customer
 * actually receives when they pay. It can take three shapes:
 *   1) An explicit `fulfillmentRecipe` / `recipe` / `deliveryRecipe` object
 *      attached to the item (populated by e.g. the ZACC publisher).
 *   2) An implicit recipe — the item lives in one of the CURATED_RECIPE_GROUPS
 *      (canonical service tiers, curated verticals, enterprise packages, etc.)
 *      which are hand-authored deliverables inside this codebase.
 *   3) A canonical core plan id (`starter`, `pro`, `enterprise`, ...) — these
 *      are the ZeusAI-native plans with fixed activation recipes.
 * Items that are none of the above have no honest way to be fulfilled and
 * MUST NOT appear on the public storefront.
 */
const CURATED_RECIPE_GROUPS = new Set([
  'instant',
  'professional',
  'enterprise',
  'vertical',
  'frontier',
  'service',
  'strategic-package',
  'billion-scale-package',
  'billion-scale-activation',
  'future-invention',
  'core-plan',
]);
const CANONICAL_CORE_PLAN_IDS = new Set([
  'free', 'starter', 'pro', 'enterprise', 'api-call', 'ai-analysis',
  'wealth-engine', 'legal-bot', 'cloud-broker', 'data-export',
  'sme', 'mid-market', 'enterprise-tier', 'global-giants',
]);

function hasFulfillmentRecipe(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.fulfillmentRecipe && (item.fulfillmentRecipe.kind || item.fulfillmentRecipe.type)) return true;
  if (item.recipe || item.deliveryRecipe) return true;
  const id = String(item.id || item.serviceId || '').trim();
  if (CANONICAL_CORE_PLAN_IDS.has(id)) return true;
  const group = String(item.group || item.tier || item.segment || '').trim().toLowerCase();
  if (CURATED_RECIPE_GROUPS.has(group)) return true;
  return false;
}

function isSyntheticCatalogItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.synthetic === true) return true;
  if (item.syntheticOnly === true) return true;

  const id = String(item.id || item.serviceId || '').trim();
  if (/^zacc-/i.test(id)) return true;
  if (/^unicorn-(auto-)?module-/i.test(id)) return true;
  if (/^synthetic[_-]/i.test(id)) return true;

  const group = String(item.group || '').trim().toLowerCase();
  const segment = String(item.segment || '').trim().toLowerCase();
  const category = String(item.category || '').trim().toLowerCase();
  if (SYNTHETIC_GROUPS.has(group) || SYNTHETIC_GROUPS.has(segment) || SYNTHETIC_GROUPS.has(category)) {
    return true;
  }

  // Physical / dropship SKUs must always carry a real fulfillment recipe.
  // If they don't, we have no honest way to deliver them and they are excluded
  // from the public storefront regardless of any other flag.
  const type = String(item.type || '').trim().toLowerCase();
  const niche = String(item.niche || '').trim().toLowerCase();
  const isPhysicalOrDropship = type === 'physical' || niche === 'dropship' || group === 'dropship';
  if (isPhysicalOrDropship && !hasFulfillmentRecipe(item)) return true;

  // Auto-published marketplace clones without a curated fulfillment recipe.
  if (item.autoPublished === true && (group === 'marketplace' || group === 'strategic' || !group)) {
    if (!hasFulfillmentRecipe(item)) return true;
  }

  return false;
}

function filterPublicCatalogItems(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  if (options.includeSynthetic === true) {
    return list.slice();
  }
  return list.filter((item) => !isSyntheticCatalogItem(item));
}

function applyPublicCatalogFilter(catalog, options = {}) {
  if (!catalog || typeof catalog !== 'object') return catalog;
  const includeSynthetic = options.includeSynthetic === true;
  const items = filterPublicCatalogItems(catalog.items, { includeSynthetic });
  const groupCount = (g) => items.filter((x) => x && x.group === g).length;
  const next = {
    ...catalog,
    items,
    publicFilter: {
      includeSynthetic,
      filteredOut: Math.max(0, (Array.isArray(catalog.items) ? catalog.items.length : 0) - items.length),
      rule: 'exclude zacc-*/unicorn-module-*/synthetic:true/auto-module clones from default storefront',
    },
  };
  if (next.counts && typeof next.counts === 'object') {
    next.counts = {
      ...next.counts,
      total: items.length,
      instant: groupCount('instant'),
      professional: groupCount('professional'),
      enterprise: groupCount('enterprise'),
      strategic: groupCount('strategic'),
      frontier: groupCount('frontier'),
      vertical: groupCount('vertical'),
    };
  }
  return next;
}

module.exports = {
  isSyntheticCatalogItem,
  hasFulfillmentRecipe,
  filterPublicCatalogItems,
  applyPublicCatalogFilter,
  wantsIncludeSynthetic,
  truthyQueryFlag,
  CURATED_RECIPE_GROUPS,
  CANONICAL_CORE_PLAN_IDS,
};
