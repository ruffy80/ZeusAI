// commerce/unified-catalog.js
// Unifies instant-catalog + enterprise-catalog into a SINGLE canonical catalogue
// with the contract guarantee enforced by `MAX_PRODUCTS` and `TIERS`:
//
//   * Exactly 3 tiers: instant | professional | enterprise.
//   * Every curated instant and enterprise row is public. The cap is that
//     curated count, so a new shelf file cannot push the license off /api/products.
//
// Runtime marketplace/industry sources, if injected via `setRuntimeSources`,
// are normalized into one of the 3 tiers, deduped against the static seed and
// ONLY used to fill the remainder up to the cap — never to exceed it.
//
// Exports: byId(id), publicView({tier?}), summarize(), setRuntimeSources({marketplace, industries}), all()

const TIERS = ['instant', 'professional', 'enterprise'];

function curatedLength() {
  let count = 0;
  const inst = _instant();
  const ent = _enterprise();
  if (inst && typeof inst.all === 'function') count += (inst.all() || []).length;
  if (ent && typeof ent.all === 'function') count += (ent.all() || []).length;
  return count;
}

// The public catalogue is the curated seed, not a frozen 25. A shorter cap
// dropped ent-platform-license after the security desk was added, and
// /api/products then lost its annual billing.
const MAX_PRODUCTS = Math.max(1, curatedLength());

let _runtime = { marketplace: [], industries: [] };

function _instant() { try { return require('./instant-catalog'); } catch (_) { return null; } }
function _enterprise() { try { return require('./enterprise-catalog'); } catch (_) { return null; } }
function _omega() { try { return require('../../backend/modules/omega-ecosystem-os'); } catch (_) { return null; } }
function _genome() { try { return require('../../backend/modules/ai-genome-engine'); } catch (_) { return null; } }

function setRuntimeSources(sources) {
  if (!sources) return;
  if (Array.isArray(sources.marketplace)) _runtime.marketplace = sources.marketplace;
  if (Array.isArray(sources.industries))  _runtime.industries  = sources.industries;
}

// Coerce any incoming tier/group label to one of the 3 canonical tiers.
function _coerceTier(value, fallback) {
  const t = String(value || '').toLowerCase();
  if (t === 'instant') return 'instant';
  if (t === 'professional' || t === 'pro' || t === 'business') return 'professional';
  if (t === 'enterprise' || t === 'industry' || t === 'sovereign' || t === 'strategic') return 'enterprise';
  if (t === 'marketplace') return 'professional';
  return fallback || 'professional';
}

function _normalize(item, defaults) {
  const tier = _coerceTier(item.tier, _coerceTier(defaults.tier, 'professional'));
  const requiresHuman = item.requiresHumanFulfillment === true
    || tier === 'professional'
    || tier === 'enterprise'
    || /^professional-/i.test(String(item.id || ''))
    || /^ent-/i.test(String(item.id || ''));
  let base = {
    id: item.id || item.slug || item.title,
    title: item.title || item.name || item.id,
    tier,
    priceUSD: Number(item.priceUSD || item.priceUsd || item.price || 0),
    currency: item.currency || 'USD',
    billing: item.billing || null,
    description: item.description || '',
    inputs: item.inputs || [],
    group: tier === 'enterprise' ? 'enterprise' : (tier === 'instant' ? 'instant' : (defaults.group || tier)),
    deliveryMinutes: item.deliveryMinutes != null ? Number(item.deliveryMinutes) : undefined,
    deliveryDays: item.deliveryDays != null ? Number(item.deliveryDays) : undefined,
    requiresHumanFulfillment: requiresHuman,
    buyMode: /^ent-/i.test(String(item.id || '')) ? 'reserve' : (tier === 'enterprise' ? 'contact' : (tier === 'professional' ? 'reserve' : 'btc')),
  };
  try {
    const omega = _omega();
    if (omega && typeof omega.enrichCatalogItem === 'function') base = omega.enrichCatalogItem(base);
  } catch (_) { /* optional */ }
  try {
    const genome = _genome();
    if (genome && typeof genome.enrichCatalogItem === 'function') base = genome.enrichCatalogItem(base);
  } catch (_) { /* optional */ }
  try {
    const overlay = require('../../backend/modules/safe-catalog-overlay');
    if (overlay && typeof overlay.enrichCatalogItem === 'function') return overlay.enrichCatalogItem(base);
  } catch (_) { /* optional */ }
  return base;
}

function publicServiceIds() {
  return new Set(publicView().map((p) => String(p.id)).filter(Boolean));
}

function isPublicServiceId(id) {
  return publicServiceIds().has(String(id || '').trim());
}

function all() {
  const out = [];
  const seen = new Set();

  // Static catalogues are the source of truth and all of them ship.
  const inst = _instant();
  if (inst) {
    for (const p of inst.all()) {
      if (out.length >= MAX_PRODUCTS) break;
      const norm = _normalize(p, { group: 'instant', tier: p.tier || 'instant' });
      if (!norm.id || seen.has(norm.id)) continue;
      out.push(norm); seen.add(norm.id);
    }
  }
  const ent = _enterprise();
  if (ent) {
    for (const p of ent.all()) {
      if (out.length >= MAX_PRODUCTS) break;
      const norm = _normalize(p, { group: 'enterprise', tier: p.tier || 'enterprise' });
      if (!norm.id || seen.has(norm.id)) continue;
      out.push(norm); seen.add(norm.id);
    }
  }

  // Runtime marketplace/industry items only fill the remaining headroom (if any)
  // and are coerced into one of the 3 canonical tiers — they NEVER exceed
  // MAX_PRODUCTS and never leak a 4th tier label.
  for (const m of _runtime.marketplace || []) {
    if (out.length >= MAX_PRODUCTS) break;
    if (!m || !m.id || seen.has(m.id)) continue;
    out.push(_normalize(m, { group: 'professional', tier: m.tier || 'professional' }));
    seen.add(m.id);
  }
  for (const i of _runtime.industries || []) {
    if (out.length >= MAX_PRODUCTS) break;
    if (!i || !i.id || seen.has(i.id)) continue;
    out.push(_normalize(i, { group: 'enterprise', tier: i.tier || 'enterprise' }));
    seen.add(i.id);
  }

  return out.slice(0, MAX_PRODUCTS);
}

function byId(id) {
  const k = String(id || '');
  return all().find(p => p.id === k) || null;
}
function publicView(opts) {
  const tier = opts && opts.tier;
  let list = all().filter((row) => !require('./real-price').isContractFigure(row && row.id));
  if (tier) list = list.filter(p => p.tier === tier);
  return list;
}
function publicSummary(products) {
  const list = Array.isArray(products) ? products : publicView();
  const byTier = TIERS.reduce((acc, t) => { acc[t] = 0; return acc; }, {});
  let totalUSD = 0;
  for (const p of list) {
    const tier = p && p.tier;
    if (TIERS.indexOf(tier) !== -1) byTier[tier] += 1;
    totalUSD += Number((p && (p.priceUSD != null ? p.priceUSD : p.priceUsd)) || 0);
  }
  return {
    generatedAt: new Date().toISOString(),
    products: list.length,
    maxProducts: MAX_PRODUCTS,
    tiers: TIERS.slice(),
    totalListedValueUSD: Number(totalUSD.toFixed(2)),
    byTier,
    publicPricesOnly: true,
  };
}
function summarize() {
  const list = all();
  const byTier = TIERS.reduce((acc, t) => { acc[t] = 0; return acc; }, {});
  let totalUSD = 0;
  for (const p of list) {
    if (TIERS.indexOf(p.tier) !== -1) byTier[p.tier] += 1;
    totalUSD += Number(p.priceUSD || 0);
  }
  return {
    generatedAt: new Date().toISOString(),
    products: list.length,
    maxProducts: MAX_PRODUCTS,
    tiers: TIERS.slice(),
    totalListedValueUSD: Number(totalUSD.toFixed(2)),
    byTier
  };
}

module.exports = {
  all, byId, publicView, publicSummary, summarize, setRuntimeSources,
  publicServiceIds, isPublicServiceId,
  MAX_PRODUCTS, TIERS,
};
