// commerce/unified-catalog.js
// Unifies instant-catalog + enterprise-catalog into a SINGLE canonical catalogue
// with the contract guarantee enforced by `MAX_PRODUCTS` and `TIERS`:
//
//   * Exactly 3 tiers: instant | professional | enterprise.
//   * At most `MAX_PRODUCTS` (25) products in any public response.
//
// Runtime marketplace/industry sources, if injected via `setRuntimeSources`,
// are normalized into one of the 3 tiers, deduped against the static seed and
// ONLY used to fill the remainder up to MAX_PRODUCTS — never to exceed it.
//
// Exports: byId(id), publicView({tier?}), summarize(), setRuntimeSources({marketplace, industries}), all()

const MAX_PRODUCTS = 25;
const TIERS = ['instant', 'professional', 'enterprise'];

let _runtime = { marketplace: [], industries: [] };

function _instant() { try { return require('./instant-catalog'); } catch (_) { return null; } }
function _enterprise() { try { return require('./enterprise-catalog'); } catch (_) { return null; } }

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
  return {
    id: item.id || item.slug || item.title,
    title: item.title || item.name || item.id,
    tier: _coerceTier(item.tier, _coerceTier(defaults.tier, 'professional')),
    priceUSD: Number(item.priceUSD || item.priceUsd || item.price || 0),
    currency: item.currency || 'USD',
    description: item.description || '',
    inputs: item.inputs || [],
    group: defaults.group
  };
}

function all() {
  const out = [];
  const seen = new Set();

  // Static catalogues are the source of truth and ship the canonical 25.
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
  let list = all();
  if (tier) list = list.filter(p => p.tier === tier);
  return list;
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

module.exports = { all, byId, publicView, summarize, setRuntimeSources, MAX_PRODUCTS, TIERS };
