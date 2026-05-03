// commerce/unified-catalog.js
// Unifies instant-catalog + enterprise-catalog + (optionally) runtime marketplace
// + industries via setRuntimeSources(). Used by /api/instant/catalog when present.
//
// Exports: byId(id), publicView({tier?}), summarize(), setRuntimeSources({marketplace, industries}), all()

let _runtime = { marketplace: [], industries: [] };

function _instant() { try { return require('./instant-catalog'); } catch (_) { return null; } }
function _enterprise() { try { return require('./enterprise-catalog'); } catch (_) { return null; } }

function setRuntimeSources(sources) {
  if (!sources) return;
  if (Array.isArray(sources.marketplace)) _runtime.marketplace = sources.marketplace;
  if (Array.isArray(sources.industries))  _runtime.industries  = sources.industries;
}

function _normalize(item, defaults) {
  return {
    id: item.id || item.slug || item.title,
    title: item.title || item.name || item.id,
    tier: item.tier || defaults.tier || 'instant',
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
  const inst = _instant();
  if (inst) for (const p of inst.all()) { out.push(_normalize(p, { group: 'instant', tier: p.tier || 'instant' })); seen.add(out[out.length-1].id); }
  const ent = _enterprise();
  if (ent) for (const p of ent.all()) { if (!seen.has(p.id)) { out.push(_normalize(p, { group: 'enterprise', tier: p.tier || 'enterprise' })); seen.add(p.id); } }
  for (const m of _runtime.marketplace || []) {
    if (!m || !m.id || seen.has(m.id)) continue;
    out.push(_normalize(m, { group: 'marketplace', tier: m.tier || 'marketplace' }));
    seen.add(m.id);
  }
  for (const i of _runtime.industries || []) {
    if (!i || !i.id || seen.has(i.id)) continue;
    out.push(_normalize(i, { group: 'industry', tier: i.tier || 'industry' }));
    seen.add(i.id);
  }
  return out;
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
  const byTier = {}; const byGroup = {};
  let totalUSD = 0;
  for (const p of list) {
    byTier[p.tier] = (byTier[p.tier] || 0) + 1;
    byGroup[p.group] = (byGroup[p.group] || 0) + 1;
    totalUSD += Number(p.priceUSD || 0);
  }
  return { generatedAt: new Date().toISOString(), products: list.length, totalListedValueUSD: Number(totalUSD.toFixed(2)), byTier, byGroup };
}

module.exports = { all, byId, publicView, summarize, setRuntimeSources };
