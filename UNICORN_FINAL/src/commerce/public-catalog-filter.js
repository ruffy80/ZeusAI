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

  // Auto-published marketplace clones without a curated fulfillment recipe.
  if (item.autoPublished === true && (group === 'marketplace' || group === 'strategic' || !group)) {
    const hasRecipe = !!(item.fulfillmentRecipe || item.recipe || item.deliveryRecipe);
    if (!hasRecipe) return true;
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
  filterPublicCatalogItems,
  applyPublicCatalogFilter,
  wantsIncludeSynthetic,
  truthyQueryFlag,
};
