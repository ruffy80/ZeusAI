// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
//
// marketAnalytics.js — Market / demand analytics for commerce.
//
// Aggregates REAL demand signals per product category by ingesting the live
// platform catalog (ZACC dropship publisher + the main service catalog) and
// blending observed signals. Categories are scored by how much profitable,
// well-rated inventory the platform actually carries, so pricing, catalog
// ordering and marketing can react to what is genuinely trending.
//
// A tick applies a mild exponential decay to every category score, then blends
// in freshly-ingested demand (an EMA toward the current catalog weight) so a
// non-empty catalog always yields non-zero tops, while stale categories fade.
//
// Fully offline / deterministic: ingest reads in-process module singletons via
// try/catch require — NO network I/O — so it is safe on a 60s heartbeat, either
// in-process or via the standalone PM2 autonomous runner.
//
// Public surface: { getStatus, process, start, stop } (+ helpers).

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', '..', 'data', 'market-analytics');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Baseline commerce categories tracked out of the box. New categories are
// introduced dynamically via observed signals or catalog ingest.
const BASE_CATEGORIES = [
  'ai-services',
  'saas',
  'dropshipping',
  'automation',
  'analytics',
  'security',
  'infrastructure',
  'electronics',
  'fashion',
  'home',
  'beauty',
  'fitness',
  'pets',
  'outdoor',
  'general',
];

// Normalise the many category spellings that flow in from scraped/curated
// inventory into the canonical buckets above.
const CATEGORY_SYNONYMS = {
  electronic: 'electronics',
  tech: 'electronics',
  gadgets: 'electronics',
  gadget: 'electronics',
  phone: 'electronics',
  smartphones: 'electronics',
  laptops: 'electronics',
  clothing: 'fashion',
  apparel: 'fashion',
  'mens-shirts': 'fashion',
  'womens-dresses': 'fashion',
  'womens-shoes': 'fashion',
  'mens-shoes': 'fashion',
  shoes: 'fashion',
  jewelery: 'fashion',
  jewelry: 'fashion',
  watches: 'fashion',
  bags: 'fashion',
  'home-decoration': 'home',
  furniture: 'home',
  kitchen: 'home',
  'home-improvement': 'home',
  garden: 'home',
  skincare: 'beauty',
  fragrances: 'beauty',
  cosmetics: 'beauty',
  makeup: 'beauty',
  sports: 'fitness',
  'sports-accessories': 'fitness',
  gym: 'fitness',
  wellness: 'fitness',
  pet: 'pets',
  'pet-supplies': 'pets',
  camping: 'outdoor',
  travel: 'outdoor',
  automotive: 'outdoor',
  motorcycle: 'outdoor',
  ai: 'ai-services',
  'ai-service': 'ai-services',
  software: 'saas',
  subscription: 'saas',
  dropship: 'dropshipping',
};

const DECAY = 0.9; // per-tick multiplicative decay applied to demand scores

function _normalizeCategory(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!key) return 'general';
  if (CATEGORY_SYNONYMS[key]) return CATEGORY_SYNONYMS[key];
  return key;
}

function _defaultState() {
  const demand = {};
  for (const c of BASE_CATEGORIES) demand[c] = 0;
  return {
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ticks: 0,
    signals: 0,
    ingests: 0,
    lastIngestAt: null,
    ingestCounts: {},   // category → number of catalog items last ingested
    ingestTotals: { products: 0, sources: [] },
    demand, // { category: score }
    history: [], // capped list of { ts, top }
  };
}

function _loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const merged = { ..._defaultState(), ...parsed };
      merged.demand = { ..._defaultState().demand, ...(parsed.demand || {}) };
      merged.ingestCounts = { ...(parsed.ingestCounts || {}) };
      merged.ingestTotals = { ..._defaultState().ingestTotals, ...(parsed.ingestTotals || {}) };
      return merged;
    }
  } catch (_) { /* cold start */ }
  return _defaultState();
}

function _saveState(state) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (_) {
    return false;
  }
}

let _state = _loadState();
let _timer = null;

function _clampWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1000, n));
}

// Record an explicit demand signal for a category. Unknown categories are
// created on the fly so the analytics surface can grow with the catalog.
function _applySignal(category, weight) {
  const key = _normalizeCategory(category);
  if (!key) return false;
  const w = _clampWeight(weight);
  _state.demand[key] = Math.round(((_state.demand[key] || 0) + w) * 100) / 100;
  _state.signals += 1;
  return true;
}

// Turn a list of catalog products into per-category demand weight. Each product
// contributes count * (marginPct||20) * (rating||4) to its category, so the
// platform's own profitable, well-rated inventory drives the demand picture.
function _weighProducts(products) {
  const counts = {};   // category → item count
  const weights = {};  // category → summed demand weight
  for (const p of (products || [])) {
    if (!p) continue;
    const cat = _normalizeCategory(p.category || p.group || p.segment || p.niche || 'general');
    const margin = Number(p.marginPct) > 0 ? Number(p.marginPct) : 20;
    const rating = Number(p.rating) > 0 ? Number(p.rating) : 4;
    counts[cat] = (counts[cat] || 0) + 1;
    weights[cat] = (weights[cat] || 0) + (margin * rating);
  }
  return { counts, weights };
}

// Best-effort collection of live catalog products from in-process singletons.
// NO network I/O — pure require + property reads, all guarded.
function _collectCatalog(explicit) {
  const products = [];
  const sources = [];

  // Explicitly-provided products (used by process({action:'ingest', products}))
  // and for deterministic testing without a live ZACC instance.
  if (Array.isArray(explicit) && explicit.length) {
    for (const p of explicit) products.push(p);
    sources.push('explicit');
  }

  // ZACC autonomous commerce publisher — the primary live inventory source.
  try {
    const zacc = require('./zacc');
    const published = zacc && zacc.publisher && Array.isArray(zacc.publisher.published)
      ? zacc.publisher.published
      : [];
    if (published.length) {
      for (const p of published) products.push(p);
      sources.push('zacc.publisher');
    }
  } catch (_) { /* zacc absent — fine */ }

  // Main service catalog (in-process synchronous view only — never triggers
  // an HTTP fetch here).
  try {
    const sc = require('./serviceCatalog');
    const items = typeof sc.listSync === 'function' ? sc.listSync() : [];
    if (Array.isArray(items) && items.length) {
      for (const it of items) products.push(it);
      sources.push('serviceCatalog');
    }
  } catch (_) { /* catalog absent — fine */ }

  return { products, sources };
}

// Ingest the live catalog into demand: decay existing scores, then blend each
// ingested category toward its current catalog weight (EMA). Returns a summary.
function ingest(explicit) {
  const { products, sources } = _collectCatalog(explicit);
  const { counts, weights } = _weighProducts(products);

  // Decay all existing demand first so stale categories fade.
  _decayDemand();

  // Blend: EMA toward the freshly-ingested weight for each observed category.
  const ingestedCategories = Object.keys(weights);
  for (const cat of ingestedCategories) {
    const target = weights[cat];
    const old = Number(_state.demand[cat]) || 0;
    const blended = old * DECAY + target * (1 - DECAY);
    _state.demand[cat] = Math.round(blended * 100) / 100;
  }

  _state.ingests += 1;
  _state.lastIngestAt = new Date().toISOString();
  _state.ingestCounts = counts;
  _state.ingestTotals = { products: products.length, sources };
  _state.updatedAt = _state.lastIngestAt;
  _saveState(_state);

  return {
    ok: true,
    action: 'ingest',
    products: products.length,
    sources,
    categoriesIngested: ingestedCategories.length,
    top: _rankings().slice(0, 5),
  };
}

function _decayDemand() {
  for (const key of Object.keys(_state.demand)) {
    const decayed = Number(_state.demand[key]) * DECAY;
    _state.demand[key] = decayed < 0.01 ? 0 : Math.round(decayed * 100) / 100;
  }
}

function _rankings() {
  return Object.entries(_state.demand)
    .map(([category, sc]) => ({ category, score: Math.round(Number(sc) * 100) / 100 }))
    .sort((a, b) => b.score - a.score);
}

function tick() {
  // A tick performs a full live ingest (which internally applies decay then
  // blends catalog weight). If the catalog is empty, ingest still decays so the
  // surface behaves like the classic decay-only loop.
  const res = ingest();
  _state.ticks += 1;
  _state.updatedAt = new Date().toISOString();
  const ranked = _rankings();
  _state.history.push({ ts: _state.updatedAt, top: ranked.slice(0, 3).map((r) => r.category) });
  if (_state.history.length > 200) _state.history = _state.history.slice(-200);
  _saveState(_state);
  return {
    ok: true,
    action: 'tick',
    ticks: _state.ticks,
    ingestedProducts: res.products,
    top: ranked.slice(0, 5),
  };
}

function report() {
  const ranked = _rankings();
  const total = ranked.reduce((a, r) => a + r.score, 0);
  return {
    ok: true,
    action: 'report',
    generatedAt: new Date().toISOString(),
    categories: ranked.length,
    totalDemand: Math.round(total * 100) / 100,
    rankings: ranked,
    signals: _state.signals,
    ticks: _state.ticks,
    ingests: _state.ingests,
    lastIngestAt: _state.lastIngestAt,
    ingestCounts: _state.ingestCounts,
  };
}

function top(n = 5) {
  const limit = Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 5;
  return { ok: true, action: 'top', top: _rankings().slice(0, limit) };
}

// Recommend which categories to push next, with a reason blending live demand
// score and how much profitable inventory the platform carries.
function recommend(n = 5) {
  const limit = Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 5;
  const ranked = _rankings().filter((r) => r.score > 0);
  const recs = ranked.slice(0, limit).map((r) => {
    const count = _state.ingestCounts[r.category] || 0;
    const bits = [`demand score ${r.score}`];
    if (count) bits.push(`${count} live catalog SKUs`);
    else bits.push('signal-driven demand');
    return {
      category: r.category,
      score: r.score,
      liveSkus: count,
      why: bits.join('; '),
    };
  });
  return {
    ok: true,
    action: 'recommend',
    generatedAt: new Date().toISOString(),
    recommendations: recs,
    basedOnIngestAt: _state.lastIngestAt,
  };
}

function getStatus() {
  const ranked = _rankings();
  return {
    module: 'marketAnalytics',
    name: 'Market & Demand Analytics',
    status: 'active',
    ticks: _state.ticks,
    signals: _state.signals,
    ingests: _state.ingests,
    lastIngestAt: _state.lastIngestAt,
    trackedCategories: ranked.length,
    liveCatalogProducts: _state.ingestTotals.products || 0,
    ingestSources: _state.ingestTotals.sources || [],
    top: ranked.slice(0, 5),
    createdAt: _state.createdAt,
    updatedAt: _state.updatedAt,
  };
}

// NOTE: named runAction (not `process`) to avoid shadowing Node's global
// `process` object inside this module scope. Exported below as `process`.
async function runAction(input = {}) {
  const action = (input && input.action) || 'tick';
  switch (action) {
    case 'tick':
      return tick();
    case 'ingest':
      return ingest(Array.isArray(input.products) ? input.products : null);
    case 'report':
      return report();
    case 'top':
      return top(input.n);
    case 'recommend':
      return recommend(input.n);
    case 'signal': {
      // Accept either { category, weight } or { signals: [{category, weight}] }.
      let applied = 0;
      if (Array.isArray(input.signals)) {
        for (const s of input.signals) {
          if (s && _applySignal(s.category, s.weight)) applied += 1;
        }
      } else if (input.category) {
        if (_applySignal(input.category, input.weight)) applied += 1;
      }
      _saveState(_state);
      return { ok: true, action: 'signal', applied, top: _rankings().slice(0, 5) };
    }
    case 'status':
      return getStatus();
    default:
      return {
        ok: false,
        error: `unknown action: ${action}`,
        supported: ['tick', 'ingest', 'report', 'top', 'recommend', 'signal', 'status'],
      };
  }
}

function start(opts = {}) {
  const intervalMs = Number(opts.intervalMs) > 0 ? Number(opts.intervalMs) : 60_000;
  tick();
  if (!_timer) {
    _timer = setInterval(() => {
      try { tick(); } catch (_) { /* keep alive */ }
    }, intervalMs);
    if (typeof _timer.unref === 'function') _timer.unref();
  }
  return { applied: false, started: true, intervalMs, status: getStatus() };
}

function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  return { stopped: true };
}

module.exports = {
  name: 'marketAnalytics',
  getStatus,
  process: runAction,
  report,
  top,
  tick,
  ingest,
  recommend,
  start,
  stop,
  BASE_CATEGORIES,
};
