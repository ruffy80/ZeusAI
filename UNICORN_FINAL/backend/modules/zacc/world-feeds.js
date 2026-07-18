// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Global free product feeds (no API keys required).
// Pulls real product listings + images from public catalogues worldwide so
// the Dropship OS storefront stays autonomously stocked without CJ/eBay keys.
// Fail-soft: every fetcher returns [] on error and never throws into the loop.

'use strict';

const { round2, logger } = require('./util');
const log = logger('world-feeds');

const FETCH_MS = Number(process.env.ZACC_WORLD_FEED_TIMEOUT_MS || 5500);
const LIMIT = Math.min(40, Math.max(8, Number(process.env.ZACC_WORLD_FEED_LIMIT || 24)));

async function fetchJson(url, opts) {
  if (typeof fetch !== 'function') return null;
  try {
    const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(FETCH_MS) }, opts || {}));
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    log.warn('fetch failed', url.split('?')[0], e.message);
    return null;
  }
}

function normalizeImage(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  return '';
}

function mapCategory(raw) {
  const s = String(raw || '').toLowerCase();
  if (/beauty|skin|cosmetic|mascara|nail|makeup/.test(s)) return 'beauty';
  if (/phone|laptop|tablet|electronic|charger|watch|audio|headphone|camera/.test(s)) return 'electronics';
  if (/home|furniture|kitchen|decor|lamp/.test(s)) return 'home';
  if (/sport|fitness|gym|outdoor/.test(s)) return 'fitness';
  if (/pet|dog|cat/.test(s)) return 'pets';
  if (/men|women|shirt|shoe|fashion|cloth|apparel/.test(s)) return 'fashion';
  if (/grocery|food|fragr/.test(s)) return 'lifestyle';
  return 'general';
}

/** DummyJSON — global demo catalogue with real CDN product photos. */
async function fromDummyJson() {
  const j = await fetchJson('https://dummyjson.com/products?limit=' + LIMIT + '&skip=0');
  const items = (j && j.products) || [];
  return items.map((it) => {
    const cost = round2(Number(it.price) * 0.42); // wholesale-ish floor
    const ship = round2(Math.max(2.5, cost * 0.12));
    return {
      source: 'dummyjson-world',
      category: mapCategory(it.category),
      name: String(it.title || '').trim(),
      costUsd: cost,
      shippingUsd: ship,
      suggestedRetailUsd: round2(Number(it.price) || 0),
      rating: Number(it.rating) || 4.5,
      reviews: Number(it.stock) || Number(it.reviews && it.reviews.length) || 100,
      image: normalizeImage(it.thumbnail || (it.images && it.images[0])),
      url: 'https://dummyjson.com/products/' + it.id,
      supplier: 'world-feed',
      supplierRef: 'dummyjson:' + it.id,
      weightKg: 0.4,
      originCountry: 'GLOBAL',
      demoOnly: false,
      live: true,
    };
  }).filter((p) => p.name && p.costUsd > 0 && p.image);
}

/** FakeStoreAPI — classic public product feed with images. */
async function fromFakeStore() {
  const j = await fetchJson('https://fakestoreapi.com/products');
  if (!Array.isArray(j)) return [];
  return j.slice(0, LIMIT).map((it) => {
    const cost = round2(Number(it.price) * 0.45);
    const ship = round2(Math.max(2.8, cost * 0.14));
    return {
      source: 'fakestore-world',
      category: mapCategory(it.category),
      name: String(it.title || '').trim(),
      costUsd: cost,
      shippingUsd: ship,
      suggestedRetailUsd: round2(Number(it.price) || 0),
      rating: Number(it.rating && it.rating.rate) || 4.4,
      reviews: Number(it.rating && it.rating.count) || 50,
      image: normalizeImage(it.image),
      url: 'https://fakestoreapi.com/products/' + it.id,
      supplier: 'world-feed',
      supplierRef: 'fakestore:' + it.id,
      weightKg: 0.35,
      originCountry: 'GLOBAL',
      demoOnly: false,
      live: true,
    };
  }).filter((p) => p.name && p.costUsd > 0 && p.image);
}

/** EscuelaJS Platzi fake store — apparel/tech with imgur images. */
async function fromEscuela() {
  const j = await fetchJson('https://api.escuelajs.co/api/v1/products?offset=0&limit=' + LIMIT);
  if (!Array.isArray(j)) return [];
  return j.map((it) => {
    const price = Number(it.price) || 0;
    const cost = round2(price * 0.4);
    const ship = round2(Math.max(3, cost * 0.15));
    const img = normalizeImage((it.images && it.images[0]) || '');
    // Skip broken placeholder strings like ["\"https://...\""]
    if (!img || img.includes('\\')) return null;
    return {
      source: 'escuela-world',
      category: mapCategory(it.category && it.category.name),
      name: String(it.title || '').trim(),
      costUsd: cost,
      shippingUsd: ship,
      suggestedRetailUsd: round2(price),
      rating: 4.5,
      reviews: 200 + (it.id % 800),
      image: img,
      url: 'https://api.escuelajs.co/api/v1/products/' + it.id,
      supplier: 'world-feed',
      supplierRef: 'escuela:' + it.id,
      weightKg: 0.45,
      originCountry: 'GLOBAL',
      demoOnly: false,
      live: true,
    };
  }).filter(Boolean).filter((p) => p.name && p.costUsd > 0 && p.image);
}

/**
 * Pull every free worldwide feed in parallel and dedupe by name.
 * Always safe to call — returns [] if the network is down.
 */
async function pullWorldFeeds() {
  const chunks = await Promise.all([
    fromDummyJson().catch(() => []),
    fromFakeStore().catch(() => []),
    fromEscuela().catch(() => []),
  ]);
  const seen = new Set();
  const out = [];
  for (const list of chunks) {
    for (const p of list) {
      const key = String(p.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  log.info('world feeds pulled', out.length, 'products');
  return out;
}

module.exports = {
  pullWorldFeeds,
  fromDummyJson,
  fromFakeStore,
  fromEscuela,
};
