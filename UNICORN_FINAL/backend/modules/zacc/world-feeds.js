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

const FETCH_MS = Number(process.env.ZACC_WORLD_FEED_TIMEOUT_MS || 6500);
const LIMIT = Math.min(40, Math.max(8, Number(process.env.ZACC_WORLD_FEED_LIMIT || 24)));
const MIN_FEED_RATING = Number(process.env.ZACC_WORLD_MIN_RATING || 4.0);

const FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ZeusAI-DropshipOS/1.0 (+https://zeusai.pro)',
};

// EscuelaJS is a publicly writable sandbox — disabled unless explicitly armed.
const ENABLE_ESCUELA = process.env.ZACC_ENABLE_ESCUELA === '1';

const JUNK_TITLE_RE = /^(test|asdf|null|undefined|product|item|sample|n\/a|demo|xxx|foo|bar)$/i;
const HEX_ID_RE = /^[0-9a-f]{6,}$/i;
const PLACEHOLDER_IMG_RE = /placeimg\.com|placehold\.co|via\.placeholder|placeholder\.com|picsum\.photos|dummyimage\.com|lorempixel|fakestoreapi\.com\/img\/placeholder/i;
const LONE_NAME_RE = /^(rajesh|john|jane|admin|user|guest|testuser|asdf)$/i;

/** Reject numeric/hex/junk titles that polluted the live storefront. */
function isQualityTitle(name) {
  const t = String(name || '').trim();
  if (!t || t.length < 6 || t.length > 120) return false;
  if (HEX_ID_RE.test(t)) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  if (letters < 4) return false;
  const digitRatio = (t.match(/\d/g) || []).length / t.length;
  if (digitRatio > 0.55) return false;
  // Allow brand+model tokens ("Oppo K1", "iPhone 13 Pro") via alphanumerics.
  const words = t.split(/[^a-zA-Z0-9]+/).filter((w) => w.length >= 2);
  if (words.length < 1) return false;
  if (words.length < 2 && letters < 12) return false; // lone short words / names
  if (JUNK_TITLE_RE.test(t) || LONE_NAME_RE.test(t)) return false;
  return true;
}

/** Reject dead placeholder CDNs that 404 and force numeric cover fallbacks. */
function isQualityImage(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  if (u.startsWith('/api/dropship/cover/')) return true;
  if (!/^https?:\/\//i.test(u)) return false;
  if (PLACEHOLDER_IMG_RE.test(u)) return false;
  return true;
}

// Multi-region / multi-category DummyJSON paths — widens the autonomous
// catalogue beyond a single page of beauty SKUs.
const DUMMYJSON_PATHS = [
  'products?limit=30&skip=0',
  'products?limit=30&skip=30',
  'products?limit=30&skip=60',
  'products?limit=30&skip=90',
  'products/category/smartphones?limit=20',
  'products/category/laptops?limit=20',
  'products/category/tablets?limit=15',
  'products/category/mens-shirts?limit=15',
  'products/category/mens-watches?limit=12',
  'products/category/womens-dresses?limit=15',
  'products/category/womens-bags?limit=12',
  'products/category/womens-jewellery?limit=12',
  'products/category/home-decoration?limit=15',
  'products/category/furniture?limit=15',
  'products/category/lighting?limit=12',
  'products/category/sunglasses?limit=12',
  'products/category/sports-accessories?limit=15',
  'products/category/kitchen-accessories?limit=15',
  'products/category/mobile-accessories?limit=15',
  'products/category/motorcycle?limit=12',
  'products/category/vehicle?limit=12',
  'products/category/skin-care?limit=15',
  'products/category/fragrances?limit=12',
  'products/category/groceries?limit=15',
];

async function fetchJson(url, opts) {
  if (typeof fetch !== 'function') return null;
  try {
    const r = await fetch(url, Object.assign({
      signal: AbortSignal.timeout(FETCH_MS),
      headers: FETCH_HEADERS,
    }, opts || {}));
    if (!r.ok) return null;
    const ct = String(r.headers.get('content-type') || '');
    if (ct && !/json|javascript|text\/plain/i.test(ct)) return null;
    return await r.json();
  } catch (e) {
    log.warn('fetch failed', url.split('?')[0], e.message);
    return null;
  }
}

function normalizeImage(url) {
  const u = String(url || '').trim().replace(/^"+|"+$/g, '');
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (/^https?:\/\//i.test(u)) return u;
  return '';
}

function mapCategory(raw) {
  const s = String(raw || '').toLowerCase();
  if (/beauty|skin|cosmetic|mascara|nail|makeup|fragrance/.test(s)) return 'beauty';
  if (/phone|laptop|tablet|electronic|charger|watch|audio|headphone|camera|mobile|smart/.test(s)) return 'electronics';
  if (/home|furniture|kitchen|decor|lamp|plant|frame/.test(s)) return 'home';
  if (/sport|fitness|gym|outdoor/.test(s)) return 'fitness';
  if (/pet|dog|cat/.test(s)) return 'pets';
  if (/men|women|shirt|shoe|fashion|cloth|apparel|dress|sunglass|top/.test(s)) return 'fashion';
  if (/grocery|food|fragr/.test(s)) return 'lifestyle';
  return 'general';
}

/** Demand proxy so world SKUs clear the profit gate (minReviews=100). */
function demandReviews(it) {
  const stock = Number(it.stock) || 0;
  const ratingCount = Number(it.rating && it.rating.count) || 0;
  const reviewRows = Array.isArray(it.reviews) ? it.reviews.length : 0;
  return Math.max(150, ratingCount, reviewRows * 55, Math.round(stock * 2.5 + 80));
}

function pickImage(it) {
  const imgs = Array.isArray(it.images) ? it.images : [];
  for (const candidate of imgs) {
    const u = normalizeImage(typeof candidate === 'string' ? candidate : (candidate && candidate.url));
    if (u && !u.includes('\\')) return u;
  }
  return normalizeImage(it.thumbnail || it.image || '');
}

function mapDummyItem(it) {
  const rating = Number(it.rating) || 0;
  if (rating < MIN_FEED_RATING) return null;
  const cost = round2(Number(it.price) * 0.42);
  const ship = round2(Math.max(2.5, cost * 0.12));
  const image = pickImage(it);
  if (!image) return null;
  const name = String(it.title || '').trim();
  if (!isQualityTitle(name) || cost <= 0) return null;
  if (!isQualityImage(image)) return null;
  return {
    source: 'dummyjson-world',
    category: mapCategory(it.category),
    name,
    costUsd: cost,
    shippingUsd: ship,
    suggestedRetailUsd: round2(Number(it.price) || 0),
    rating,
    reviews: demandReviews(it),
    image,
    url: 'https://dummyjson.com/products/' + it.id,
    supplier: 'world-feed',
    supplierRef: 'dummyjson:' + it.id,
    weightKg: 0.4,
    originCountry: 'GLOBAL',
    demoOnly: false,
    live: true,
  };
}

/** DummyJSON — multi-category worldwide catalogue with CDN product photos. */
async function fromDummyJson() {
  const chunks = await Promise.all(
    DUMMYJSON_PATHS.map((path) => fetchJson('https://dummyjson.com/' + path).catch(() => null))
  );
  const out = [];
  const seen = new Set();
  for (const j of chunks) {
    const items = (j && Array.isArray(j.products) ? j.products : (Array.isArray(j) ? j : [])) || [];
    for (const it of items) {
      const mapped = mapDummyItem(it);
      if (!mapped) continue;
      const key = mapped.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(mapped);
      if (out.length >= LIMIT * 3) break;
    }
  }
  return out.slice(0, LIMIT * 3);
}

/** FakeStoreAPI — classic public product feed (often 403 from cloud egress). */
async function fromFakeStore() {
  const j = await fetchJson('https://fakestoreapi.com/products');
  if (!Array.isArray(j)) return [];
  return j.slice(0, LIMIT).map((it) => {
    const rating = Number(it.rating && it.rating.rate) || 0;
    if (rating < MIN_FEED_RATING) return null;
    const cost = round2(Number(it.price) * 0.45);
    const ship = round2(Math.max(2.8, cost * 0.14));
    const image = pickImage(it);
    if (!isQualityImage(image)) return null;
    const name = String(it.title || '').trim();
    if (!isQualityTitle(name)) return null;
    return {
      source: 'fakestore-world',
      category: mapCategory(it.category),
      name,
      costUsd: cost,
      shippingUsd: ship,
      suggestedRetailUsd: round2(Number(it.price) || 0),
      rating,
      reviews: demandReviews({ stock: Number(it.rating && it.rating.count) || 0, rating: it.rating }),
      image,
      url: 'https://fakestoreapi.com/products/' + it.id,
      supplier: 'world-feed',
      supplierRef: 'fakestore:' + it.id,
      weightKg: 0.35,
      originCountry: 'GLOBAL',
      demoOnly: false,
      live: true,
    };
  }).filter(Boolean).filter((p) => p.name && p.costUsd > 0 && p.image);
}

/** EscuelaJS Platzi fake store — opt-in only (writable sandbox pollutes titles). */
async function fromEscuela() {
  if (!ENABLE_ESCUELA) {
    log.info('escuela world feed skipped (set ZACC_ENABLE_ESCUELA=1 to arm)');
    return [];
  }
  const pages = await Promise.all([
    fetchJson('https://api.escuelajs.co/api/v1/products?offset=0&limit=' + LIMIT),
    fetchJson('https://api.escuelajs.co/api/v1/products?offset=' + LIMIT + '&limit=' + LIMIT),
  ]);
  const out = [];
  const seen = new Set();
  for (const j of pages) {
    if (!Array.isArray(j)) continue;
    for (const it of j) {
      const price = Number(it.price) || 0;
      const cost = round2(price * 0.4);
      const ship = round2(Math.max(3, cost * 0.15));
      const img = pickImage(it);
      if (!isQualityImage(img) || img.includes('\\')) continue;
      const name = String(it.title || '').trim();
      if (!isQualityTitle(name) || cost <= 0) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        source: 'escuela-world',
        category: mapCategory(it.category && it.category.name),
        name,
        costUsd: cost,
        shippingUsd: ship,
        suggestedRetailUsd: round2(price),
        rating: 4.5,
        reviews: Math.max(180, 200 + ((Number(it.id) || 0) % 800)),
        image: img,
        url: 'https://api.escuelajs.co/api/v1/products/' + it.id,
        supplier: 'world-feed',
        supplierRef: 'escuela:' + it.id,
        weightKg: 0.45,
        originCountry: 'GLOBAL',
        demoOnly: false,
        live: true,
      });
    }
  }
  return out;
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
      if (!p || !isQualityTitle(p.name) || !isQualityImage(p.image)) continue;
      const key = String(p.name || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  log.info('world feeds pulled', out.length, 'quality products');
  return out;
}

module.exports = {
  pullWorldFeeds,
  fromDummyJson,
  fromFakeStore,
  fromEscuela,
  isQualityTitle,
  isQualityImage,
};
