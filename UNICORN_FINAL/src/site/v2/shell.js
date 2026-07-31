// UNICORN V2 — SSR shell + per-route HTML fragments
// Original work, © Vladoi Ionut. Cinematic single-page portal synced with Unicorn backend.
'use strict';

const { CSS } = require('./styles');
const { BUILD_ID, assetPath, browserAssetManifest } = require('./build-id');
const sellSurface = require('./sell-surface');
const continuitySurface = require('./continuity-surface');
const continuityAttestation = require('./continuity-attestation');
const merchantStandardSurface = require('./merchant-standard-surface');
const seoSurface = require('./seo-surface');

const OWNER = {
  name: process.env.OWNER_NAME || 'Vladoi Ionut',
  email: process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'vladoi_ionut@yahoo.com',
  btc: process.env.BTC_WALLET_ADDRESS || process.env.OWNER_BTC_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  paypal: process.env.PAYPAL_ME || process.env.PAYPAL_EMAIL || 'vladoi_ionut@yahoo.com',
  domain: process.env.PUBLIC_APP_URL || 'https://zeusai.pro'
};

// Languages with first-class UI translations + a default sitewide fallback.
const HREFLANGS = ['en', 'ro', 'es'];

// ── SSR catalogue helpers ───────────────────────────────────────────────
// The previous build rendered all marketplace/pricing/store pages purely
// client-side — when JS was slow or disabled, users saw "Loading…" stubs
// instead of real products. These helpers SSR the canonical 25-product
// unified catalogue (10 instant + 8 professional + 7 enterprise) directly
// into the HTML so the site is *always* a working storefront on first paint.
// Live JS hydration still runs on top to refresh prices.
function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Best-effort sync access to the live BTC/USD spot cached by src/index.js
// (same process). Used as a fallback when the broker snapshot does not
// already provide priceBtc per item — guarantees every SSR card renders an
// "≈ X BTC" line at first paint, which the client then keeps refreshed via
// openPricingStream() over SSE.
function _btcSpotUsd() {
  // IMPORTANT: avoid requiring ../../index.js from here; that created a
  // circular import (index -> shell -> index) in audits. The site and server
  // share process globals, so read the cache bridge exposed by src/index.js.
  try {
    const cache = global.__btcSpotCache || global._btcSpotCache;
    if (cache && Number(cache.usdPerBtc) > 0) return Number(cache.usdPerBtc);
  } catch (_) { /* unavailable */ }
  // Conservative last-known fallback — same default the rest of the app
  // uses, so the BTC amount will be in the right order of magnitude even
  // before the first /api/btc/spot refresh lands.
  return 95000;
}
function _toBtc(usd) {
  const r = _btcSpotUsd();
  if (!(r > 0)) return 0;
  const u = Number(usd || 0);
  if (!(u > 0)) return 0;
  return Number((u / r).toFixed(8));
}
function _loadCatalog() {
  try {
    const u = require('../../commerce/unified-catalog');
    const all = (typeof u.all === 'function') ? u.all() : [];
    if (!Array.isArray(all)) return [];
    // Best-effort enrichment with the live AI-negotiated price computed by
    // backend/modules/dynamic-pricing.js (BASE_PRICES × demand × surge ×
    // peak × per-service variance × discount). When the module is loadable
    // in this process we use it for SSR so the first paint already shows
    // the same "live" number the client polls afterwards. When it isn't
    // loadable (separate site/backend processes), or the broker has no
    // entry for an id, we keep the static priceUSD from the catalogue.
    let dp = null;
    try { dp = require('../../../backend/modules/dynamic-pricing'); } catch (_) {}
    let broker = null;
    try { broker = require('../../../backend/modules/live-pricing-broker'); } catch (_) {}
    const snap = (broker && typeof broker.getSnapshot === 'function') ? (broker.getSnapshot() || null) : null;
    const brokerById = {};
    if (snap && Array.isArray(snap.items)) {
      for (const it of snap.items) { if (it && it.id) brokerById[it.id] = it; }
    }
    return all.map(p => {
      const out = Object.assign({}, p);
      const fromBroker = brokerById[p.id];
      if (fromBroker && Number(fromBroker.priceUsd) > 0) {
        out.priceUSD = Number(fromBroker.priceUsd);
        out.livePriceSource = 'broker';
        if (fromBroker.priceBtc) out.priceBtc = Number(fromBroker.priceBtc);
      } else if (dp && typeof dp.getPrice === 'function') {
        try {
          // CRITICAL: pass the catalog’s priceUSD as the engine’s basePrice
          // override. Without it, every catalog id (instant-pitch-deck=$149,
          // unicorn-billion-scale-activation=$500k, etc.) falls back to the
          // engine’s generic $99 default and the SSR shows a wrong $72-89
          // price. With the override the demand factor multiplies the real
          // catalog floor and the on-page price stays correct ± a tight band.
          const catalogBase = Number(p.priceUSD != null ? p.priceUSD : p.price);
          if (Number.isFinite(catalogBase) && catalogBase > 0 && typeof dp.registerService === 'function') {
            try { dp.registerService(p.id, catalogBase, { force: false }); } catch (_) {}
          }
          const live = dp.getPrice(p.id, Number.isFinite(catalogBase) && catalogBase > 0 ? { basePrice: catalogBase } : {});
          if (live && Number(live.finalPrice) > 0 && live.baseSource !== 'fallback-default') {
            out.priceUSD = Number(live.finalPrice);
            out.livePriceSource = 'dynamic-pricing';
            out.demandFactor = live.demandFactor;
            out.surgeActive = !!live.surgeActive;
          }
        } catch (_) { /* keep static */ }
      }
      return out;
    });
  } catch (_) { return []; }
}
// Read the live AI-negotiated price for a subscription tier (starter/pro/
// enterprise). Falls back to the documented base price when the engine is
// not available in this process. Returns { price, demandFactor, surge,
// source } so callers can show why the number changed.
function _liveTierPrice(tierId, fallback) {
  let dp = null;
  try { dp = require('../../../backend/modules/dynamic-pricing'); } catch (_) {}
  if (dp && typeof dp.getPrice === 'function') {
    try {
      const live = dp.getPrice(tierId);
      if (live && Number(live.finalPrice) > 0) {
        return { price: Number(live.finalPrice), demandFactor: live.demandFactor, surge: !!live.surgeActive, source: 'dynamic-pricing' };
      }
    } catch (_) {}
  }
  return { price: Number(fallback || 0), demandFactor: 1, surge: false, source: 'static-fallback' };
}
// Load the full Unicorn module library autonomously from
// backend/modules/serviceMarketplace.js. Returns every loaded module as a
// sellable item enriched with the live AI-negotiated price. Items that are
// already in the unified catalog (passed via `excludeIds`) are filtered
// out so the SSR section below the unified catalog shows only the long
// tail. Returns [] silently if the marketplace module is not loadable in
// this process (split site/backend mode) — the client-side hydration then
// fetches `/api/catalog/master` via SSE and fills the section non-stop.
function _loadFullLibrary(excludeIds) {
  // CLEANUP 2026-05-29: the auto-published "full library" dumped ~185 internal
  // engine modules (resource-monitor, deepseek-governor, circuit-breaker…) and
  // 144 near-identical "Adaptive/Engine Pool" clones onto /store, most with the
  // Romanian placeholder "Serviciu AI avansat pentru…". They are NOT real,
  // differentiated deliverables and destroyed buyer trust + SEO. The store now
  // shows only the curated 3-tier catalogue. Set ZEUS_SHOW_FULL_LIBRARY=1 to
  // re-enable (only after each module gets a real title/description/price).
  // Bilingual note (RO): biblioteca auto a fost dezactivată — doar produse reale.
  if (String(process.env.ZEUS_SHOW_FULL_LIBRARY || '') !== '1') return [];
  const exclude = new Set(Array.isArray(excludeIds) ? excludeIds.map(String) : []);
  let marketplace = null;
  try { marketplace = require('../../../backend/modules/serviceMarketplace'); } catch (_) {}
  if (!marketplace || typeof marketplace.getAllServices !== 'function') return [];
  let dp = null;
  try { dp = require('../../../backend/modules/dynamic-pricing'); } catch (_) {}
  const all = [];
  try {
    const services = marketplace.getAllServices() || [];
    for (const s of services) {
      if (!s || !s.id || exclude.has(String(s.id))) continue;
      let price = Number(s.price || s.basePrice || 0);
      let liveSrc = 'marketplace';
      let demandFactor = null;
      if (dp && typeof dp.getPrice === 'function') {
        try {
          const catalogBase = price > 0 ? price : Number(s.basePrice || 0);
          if (catalogBase > 0 && typeof dp.registerService === 'function') {
            try { dp.registerService(s.id, catalogBase, { force: false }); } catch (_) {}
          }
          const live = dp.getPrice(s.id, catalogBase > 0 ? { basePrice: catalogBase } : {});
          if (live && Number(live.finalPrice) > 0 && live.baseSource !== 'fallback-default') {
            price = Number(live.finalPrice);
            liveSrc = 'dynamic-pricing';
            demandFactor = live.demandFactor;
          }
        } catch (_) { /* keep marketplace price */ }
      }
      all.push({
        id: String(s.id),
        title: String(s.name || s.id),
        description: String(s.description || ('Adaptive AI module — ' + (s.category || 'general'))),
        category: String(s.category || 'general'),
        priceUSD: price,
        livePriceSource: liveSrc,
        demandFactor,
        autoPublished: true,
      });
    }
  } catch (_) { /* swallow */ }
  return all;
}
function _ctaForProduct(p) {
  try {
    const buyability = require('../../commerce/commerce-buyability');
    return buyability.assessBuyability(p);
  } catch (_) {
    const tier = String((p && (p.tier || p.group)) || '').toLowerCase();
    const id = String((p && p.id) || '');
    if (/^ent-/i.test(id) || tier === 'enterprise') {
      return { mode: 'contact', buyable: false, ctaLabel: 'Request proposal →', ctaHref: '/enterprise#enterprise-contact' };
    }
    if (/^professional-/i.test(id) || tier === 'professional') {
      return { mode: 'reserve', buyable: true, ctaLabel: 'Reserve with BTC →', ctaHref: '/checkout/?plan=' + encodeURIComponent(id) };
    }
    return { mode: 'btc', buyable: true, ctaLabel: 'Buy with BTC →', ctaHref: '/checkout/?plan=' + encodeURIComponent(id) };
  }
}

function _primaryCtaHtml(p, opts) {
  const o = opts || {};
  const id = String((p && p.id) || '');
  const title = _esc(p.title || p.id || 'Service');
  const cta = _ctaForProduct(p);
  const flex = o.flex ? 'flex:1;justify-content:center;' : '';
  const size = o.compact ? 'font-size:12px;padding:6px 10px;' : '';
  if (cta.mode === 'contact') {
    return `<a class="btn btn-gold" href="${_esc(cta.ctaHref || '/enterprise#enterprise-contact')}" data-link aria-label="Request proposal for ${title}" style="${flex}${size}">${_esc(cta.ctaLabel || 'Request proposal →')}</a>`;
  }
  if (cta.mode === 'unavailable' || !cta.buyable) {
    return `<a class="btn btn-ghost" href="/services/${encodeURIComponent(id)}" data-link aria-label="View ${title}" style="${flex}${size}">${_esc(cta.ctaLabel || 'Not for sale')}</a>`;
  }
  const label = cta.ctaLabel || 'Buy with BTC →';
  return `<a class="btn btn-primary" href="/checkout/?plan=${encodeURIComponent(id)}" data-sovereign-buy="${_esc(id)}" data-buy-mode="${_esc(cta.mode)}" aria-label="${_esc(label)} ${title}" style="${flex}${size}">${_esc(label)}</a>`;
}

function _libraryCard(p) {
  const id = _esc(p.id || '');
  const title = _esc(p.title || p.id || 'Service');
  const desc = _esc(p.description || '');
  const cat = _esc(p.category || 'general');
  const price = Number(p.priceUSD || 0);
  const priceTxt = price > 0 ? ('$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 })) : 'Custom';
  const liveBadge = p.livePriceSource === 'dynamic-pricing'
    ? `<span class="tag" title="Live AI-negotiated price${p.demandFactor ? ' · demand=' + Number(p.demandFactor).toFixed(2) : ''}" style="background:rgba(127,255,212,.12);color:#7fffd4;border:1px solid rgba(127,255,212,.35);font-size:10px;margin-left:6px">⚡ live</span>`
    : '';
  const autoBadge = p.autoPublished
    ? `<span class="tag" title="Operational mirror from a backend module — not a public checkout SKU" style="background:rgba(255,211,106,.10);color:#ffd36a;border:1px solid rgba(255,211,106,.30);font-size:10px;margin-left:6px">🤖 mirror</span>`
    : '';
  const priceBtcNum = Number(p.priceBtc || 0) || _toBtc(price);
  const btcTxt = priceBtcNum > 0 ? ('≈ ' + priceBtcNum.toFixed(8) + ' BTC') : '';
  return `<article class="card" data-product-id="${id}" data-price-source="${_esc(p.livePriceSource || 'marketplace')}" data-auto-published="${p.autoPublished ? '1' : '0'}" data-not-for-sale="1" itemscope itemtype="https://schema.org/Product" style="display:flex;flex-direction:column;gap:8px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <span class="tag" style="background:rgba(138,92,255,.12);color:#bda4ff;border:1px solid rgba(138,92,255,.30);font-size:10px">${cat}</span>
      <span style="font-family:var(--mono);font-size:14px;color:var(--gold);text-align:right" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="USD"/><span itemprop="price" data-pricing-value="${id}">${priceTxt}</span>${liveBadge}${autoBadge}<span class="btc-line" data-price-btc-value="${id}" style="display:block;font-size:10.5px;color:#f7a13b;font-weight:600;margin-top:2px">${btcTxt}</span></span>
    </div>
    <h3 style="margin:2px 0 0;font-size:14px;line-height:1.3" itemprop="name">${title}</h3>
    <p style="margin:0;color:var(--ink-dim);font-size:12px;line-height:1.4;flex:1" itemprop="description">${desc}</p>
    <a class="btn btn-ghost" href="/services/${encodeURIComponent(String(p.id || ''))}" data-link aria-label="View ${title} module mirror" style="font-size:12px;padding:6px 10px">Module mirror · not for sale</a>
  </article>`;
}
function _tierBadge(tier) {
  const t = String(tier || 'professional').toLowerCase();
  const meta = {
    instant:      { label: '⚡ Instant',      color: '#8a5cff', bg: 'rgba(138,92,255,.15)'  },
    professional: { label: '💼 Professional', color: '#3ea0ff', bg: 'rgba(62,160,255,.15)' },
    enterprise:   { label: '👑 Enterprise',   color: '#ffd36a', bg: 'rgba(255,211,106,.15)' }
  }[t] || { label: t, color: '#8a5cff', bg: 'rgba(138,92,255,.15)' };
  return `<span class="tag" style="background:${meta.bg};color:${meta.color};border:1px solid ${meta.color}33">${_esc(meta.label)}</span>`;
}
function _catalogCard(p) {
  const id = _esc(p.id || '');
  const title = _esc(p.title || p.id || 'Service');
  const desc = _esc(p.description || '');
  const price = Number(p.priceUSD || p.priceUsd || p.price || 0);
  // Always render with up to 2 decimals so dynamic values like 25.08 / 465.92
  // surface accurately. Integers stay clean (e.g. "99" not "99.00").
  const _hasFrac = Number.isFinite(price) && Math.abs(price - Math.round(price)) > 0.0049;
  const priceTxt = price > 0
    ? ('$' + price.toLocaleString('en-US', { minimumFractionDigits: _hasFrac ? 2 : 0, maximumFractionDigits: 2 }))
    : 'Free';
  const billing = price > 0 && (p.billing === 'monthly') ? '<small style="color:var(--ink-dim);font-weight:400">/mo</small>' : '';
  // BTC price line — shown next to the "Buy with BTC →" CTA so users can see
  // the exact Bitcoin amount that will be requested at checkout. Sourced from
  // the AI-negotiated pricing pipeline (priceNegotiator → live BTC rate),
  // with a sync fallback via _toBtc(usd) for items the broker hasn't tagged.
  const priceBtcNum = Number(p.priceBtc || 0) || _toBtc(price);
  const btcTxt = priceBtcNum > 0 ? ('≈ ' + priceBtcNum.toFixed(8) + ' BTC') : '';
  // World-Profit-OS: reinforce the native-BTC advantage right next to every
  // priced card. Only shown for paid items (free/activate cards omit it).
  const btcDiscountNote = price > 0
    ? `<span class="btc-discount" style="display:block;font-size:10.5px;color:#ffd36a;font-weight:600;margin-top:2px;letter-spacing:.2px;opacity:.85">10% BTC discount applied</span>`
    : '';
  // When the live pricing engine produced this number, surface a small badge
  // so the user (and ops) can tell it is the AI-negotiated value, not a
  // static catalogue floor.
  const liveBadge = p.livePriceSource && p.livePriceSource !== 'static-fallback'
    ? `<span class="tag" title="Live AI-negotiated price · source=${_esc(p.livePriceSource)}${p.demandFactor ? ' · demand=' + Number(p.demandFactor).toFixed(2) : ''}" style="background:rgba(127,255,212,.12);color:#7fffd4;border:1px solid rgba(127,255,212,.35);font-size:10px;margin-left:6px">⚡ live${p.surgeActive ? ' · surge' : ''}</span>`
    : '';
  return `<article class="card" data-tier="${_esc(p.tier || '')}" data-product-id="${id}" data-price-source="${_esc(p.livePriceSource || 'static')}" itemscope itemtype="https://schema.org/Product" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">${_tierBadge(p.tier)}<span style="font-family:var(--mono);font-size:18px;color:var(--gold);text-align:right" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="USD"/><span itemprop="price" data-pricing-value="${id}">${priceTxt}</span>${billing}${liveBadge}<span class="btc-line" data-price-btc-value="${id}" style="display:block;font-size:11.5px;color:#f7a13b;font-weight:600;margin-top:3px;letter-spacing:.2px">${btcTxt}</span>${btcDiscountNote}</span></div>
    <h3 style="margin:4px 0 0;font-size:18px;line-height:1.25" itemprop="name">${title}</h3>
    <p style="margin:0;color:var(--ink-dim);font-size:13px;line-height:1.45;flex:1" itemprop="description">${desc}</p>
    <div style="display:flex;gap:8px;margin-top:6px">${price > 0
      ? _primaryCtaHtml(p, { flex: true })
      : `<a class="btn btn-ghost" href="/services/${encodeURIComponent(id)}" data-link aria-label="Activate ${title}" style="flex:1;justify-content:center">Activate free</a>`
    }<a class="btn btn-ghost" href="/services/${encodeURIComponent(id)}" data-link aria-label="View details for ${title}">Details</a></div>
  </article>`;
}
function _ssrCatalogGrid(items, opts) {
  const o = opts || {};
  if (!items || !items.length) {
    return `<div class="card"><p style="color:var(--ink-dim);margin:0">Catalog refreshing… open <a href="/services" data-link>/services</a> for the marketplace.</p></div>`;
  }
  const cards = items.map(_catalogCard).join('');
  const cols = Math.max(160, Number(o.minCol) || 300);
  return `<div class="grid" id="${_esc(o.gridId || 'catalogGrid')}" style="grid-template-columns:repeat(auto-fill,minmax(min(${cols}px,100%),1fr));gap:16px">${cards}</div>`;
}

function buildJsonLd(title, route, canonical, desc, opts) {
  const base = OWNER.domain.replace(/\/$/, '');
  const blocks = [];
  // 1) Primary entity — SoftwareApplication / Product depending on route.
  blocks.push({
    '@context': 'https://schema.org',
    '@type': route === '/pricing' || route === '/services' ? 'Product' : 'SoftwareApplication',
    name: 'ZeusAI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: canonical,
    description: desc,
    creator: { '@type': 'Person', name: OWNER.name, email: OWNER.email },
    offers: { '@type': 'Offer', priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
  });
  // 2) Organization — same on every page so search engines can dedupe.
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ZeusAI',
    url: base + '/',
    logo: base + assetPath('/assets/icons/icon-512.png'),
    email: OWNER.email,
    sameAs: [base + '/about', base + '/trust', base + '/security'],
    founder: { '@type': 'Person', name: OWNER.name }
  });
  // 3) WebSite with SearchAction (sitelinks search box).
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ZeusAI',
    url: base + '/',
    potentialAction: {
      '@type': 'SearchAction',
      target: base + '/services?q={search_term_string}',
      'query-input': 'required name=search_term_string'
    }
  });
  // 4) BreadcrumbList — derived from path segments.
  const segs = (route || '/').split('/').filter(Boolean);
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }];
  let acc = '';
  segs.forEach((s, i) => {
    acc += '/' + s;
    items.push({ '@type': 'ListItem', position: i + 2, name: s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), item: base + acc });
  });
  blocks.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
  // 5) FAQPage on /how, /pricing and /faq — small but valuable for rich results.
  if (route === '/how' || route === '/pricing' || route === '/faq') {
    const faq = route === '/faq' ? FAQ_ITEMS.map((f) => ({ q: f.q, a: f.a }))
    : route === '/pricing' ? [
      { q: 'How do I pay?', a: 'Direct BTC checkout is the primary production rail. Card/Stripe, PayPal and NOWPayments appear only when configured in runtime env. Every receipt is Ed25519-signed and stored in your account.' },
      { q: 'Is there a refund?', a: 'Yes — a cryptographic refund guarantee: on SLA breach a signed REFUND_INTENT is sealed and owner-settled (not an automatic on-chain clawback). Plus a 30-day pre-activation money-back window. See /refund.' },
      { q: 'Do you store my data?', a: 'Minimal data, no resale, no model training on personal data. See our DPA and Privacy Policy for full details.' }
    ] : [
      { q: 'What is ZeusAI?', a: 'A sovereign autonomous AI operating system that ships signed outcomes, BTC-native commerce, and self-healing automation.' },
      { q: 'How does delivery work?', a: 'Each purchase mints a verifiable capability credential. Delivery runs autonomously and posts proof to your account.' },
      { q: 'Can I cancel anytime?', a: 'Yes. /cancel records a signed cancellation intent with no dark patterns; the owner processes active subscriptions against that intent.' }
    ];
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }
  return blocks;
}

// ── ZEUS PER-PAGE BACKDROP (SSR) ──────────────────────────────────────────
// Render the page-wide Zeus background image inline at SSR time so it
// appears on first paint, before any JavaScript runs. Mirrors the
// client-side ZEUS_BACKDROP_BY_ROUTE map in src/site/v2/client.js so SPA
// navigation continues to crossfade smoothly. Two distinct portraits:
//   • hero.jpg  — full Zeus-on-throne (flagship pages: services, enterprise…)
//   • brand.jpg — close-up bust (content pages: about, docs, account…)
// Home (`/`) keeps its dedicated hero <picture>, so we render an empty
// container there to let the existing CSS rule
// `body[data-route="/"] .zeus-page-bg{opacity:0}` apply.
const _ZEUS_BG_HERO  = ['/services','/enterprise','/wizard','/frontier','/dashboard','/checkout','/security','/trust','/operator'];
const _ZEUS_BG_BRAND = ['/pricing','/store','/innovations','/docs','/account','/about','/legal','/status','/observability','/transparency','/responsible-ai','/dpa','/payment-terms','/refund','/sla','/pledge','/cancel','/gift','/aura','/api-explorer','/changelog','/terms','/privacy','/innovation-log','/admin','/contact','/faq','/blog','/affiliate','/partners','/roadmap','/careers','/press'];
function _pickZeusBgSSR(route) {
  if (!route || route === '/') return null;
  // Exact match first.
  if (_ZEUS_BG_HERO.indexOf(route)  >= 0) return assetPath('/assets/zeus/hero.jpg');
  if (_ZEUS_BG_BRAND.indexOf(route) >= 0) return assetPath('/assets/zeus/brand.jpg');
  // Sub-route prefix (e.g. /services/foo, /admin/x, /vertical/health-os).
  for (let i = 0; i < _ZEUS_BG_HERO.length;  i++) if (route.indexOf(_ZEUS_BG_HERO[i]  + '/') === 0) return assetPath('/assets/zeus/hero.jpg');
  for (let i = 0; i < _ZEUS_BG_BRAND.length; i++) if (route.indexOf(_ZEUS_BG_BRAND[i] + '/') === 0) return assetPath('/assets/zeus/brand.jpg');
  // Verticals + grow + any remaining route → deterministic alternation by
  // simple hash so each page gets the SAME Zeus on every visit.
  let h = 0; for (let i = 0; i < route.length; i++){ h = (h * 31 + route.charCodeAt(i)) >>> 0; }
  return (h % 2 === 0)
    ? assetPath('/assets/zeus/hero.jpg')
    : assetPath('/assets/zeus/brand.jpg');
}
function zeusPageBgSSR(route) {
  const url = _pickZeusBgSSR(route);
  if (!url) {
    return `<div class="zeus-page-bg" id="zeusPageBg" aria-hidden="true"><div class="zeus-page-bg__layer zeus-page-bg__layer--a"></div><div class="zeus-page-bg__layer zeus-page-bg__layer--b"></div><div class="zeus-page-bg__veil"></div></div>`;
  }
  // Pre-activate layer A with the chosen URL so the background paints on
  // first frame, even if /assets/app.js never executes. Client-side
  // applyZeusBackdrop() will swap to layer B for SPA navigation.
  return `<div class="zeus-page-bg is-active" id="zeusPageBg" aria-hidden="true"><div class="zeus-page-bg__layer zeus-page-bg__layer--a is-on" style="background-image:url('${url}')"></div><div class="zeus-page-bg__layer zeus-page-bg__layer--b"></div><div class="zeus-page-bg__veil"></div></div>`;
}

function head(title, route, opts) {
  opts = opts || {};
  const lang = opts.lang || 'en';
  const nonce = opts.nonce || '';
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  const base = OWNER.domain.replace(/\/$/, '');
  const canonical = base + (route || '/');
  // Per-route OG image: dedicated 1200x630 banner with safe fallback.
  const ogImage = base + assetPath('/assets/icons/og-default.png');
  const desc = routeDescription(route);
  const jsonLdBlocks = buildJsonLd(title, route, canonical, desc, opts)
    .map(b => `<script type="application/ld+json"${nonceAttr}>${JSON.stringify(b)}</script>`).join('\n');
  // hreflang alternates — keep simple: same path across languages via ?lang=
  const hreflangs = HREFLANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${canonical}${route.indexOf('?') >= 0 ? '&' : '?'}lang=${l}"/>`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${canonical}"/>`;
  // Auto-translate priming: when the visitor's effective language is not
  // English we set the `googtrans` cookie BEFORE loading the Google Translate
  // widget so the page is translated in-place into the country's language
  // without a flicker. Source language is always English (`en`) — that is the
  // language the SSR HTML is authored in.
  const gtTarget = (lang && lang !== 'en') ? lang : '';
  const gtPrimer = gtTarget
    ? `<script${nonceAttr}>(function(){try{var p='/en/${gtTarget}';var d=document.cookie;if(d.indexOf('googtrans=')<0){document.cookie='googtrans='+p+'; path=/; samesite=lax';var h=location.hostname.split('.');if(h.length>=2){document.cookie='googtrans='+p+'; path=/; domain=.'+h.slice(-2).join('.')+'; samesite=lax';}}}catch(_){}})();</script>`
    : '';
  return `<!doctype html>
<html lang="${lang}" data-route="${route}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#05040a"/>
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>
<meta http-equiv="Pragma" content="no-cache"/>
<meta http-equiv="Expires" content="0"/>
<meta name="color-scheme" content="dark"/>
<title>${title} — ZEUSAI</title>
<meta name="description" content="${desc}"/>
<link rel="canonical" href="${canonical}"/>
${hreflangs}
<meta property="og:site_name" content="ZeusAI — Sovereign AI OS"/>
<meta property="og:title" content="${title} — ZeusAI"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="ZeusAI — Sovereign AI OS"/>
<meta property="og:locale" content="${lang}_${(lang === 'en' ? 'US' : lang.toUpperCase())}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title} — ZeusAI"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${ogImage}"/>
${jsonLdBlocks}
<link rel="manifest" href="/manifest.webmanifest"/>
<!-- Visionary display fonts (non-blocking): Syne + Orbitron for the homepage
     hero-vision panel. media=print + onload keeps them off the critical path. -->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Orbitron:wght@600;700&display=swap" media="print" onload="this.media='all'"/>
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Orbitron:wght@600;700&display=swap"/></noscript>
<!-- Responsive LCP preload: tiny mobile AVIF/WebP first, full hero only on wider viewports. -->
<link rel="preload" as="image" type="image/avif" href="${assetPath('/assets/zeus/hero-640.avif')}" imagesrcset="${assetPath('/assets/zeus/hero-640.avif')} 640w" imagesizes="100vw" fetchpriority="high"/>
<link rel="stylesheet" href="${assetPath('/assets/app.css')}"/>
<link rel="icon" type="image/png" sizes="32x32" href="${assetPath('/assets/icons/favicon-32.png')}"/>
<link rel="icon" type="image/png" sizes="192x192" href="${assetPath('/assets/icons/icon-192.png')}"/>
<link rel="apple-touch-icon" sizes="180x180" href="${assetPath('/assets/icons/apple-touch-icon.png')}"/>
<link rel="mask-icon" href="/assets/icons/icon.svg" color="#8a5cff"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop offset='0' stop-color='%238a5cff'/%3E%3Cstop offset='0.5' stop-color='%233ea0ff'/%3E%3Cstop offset='1' stop-color='%23ffd36a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath fill='url(%23g)' d='M32 4l8 14h14l-12 10 5 18-15-10-15 10 5-18L10 18h14z'/%3E%3C/svg%3E"/>
<style${nonceAttr}>
/* ============================================================
   Critical above-the-fold CSS (inlined for instant FCP/LCP).
   Mirrors the base layout in src/site/v2/styles.js so the hero,
   nav, and primary CTA paint immediately while /assets/app.css
   finishes loading in parallel. Keep this block tiny.
   Font strategy: pure system-ui stack (no @font-face, no
   web-font requests). Eliminates blocking font I/O on slow 4G
   and removes the 4 silent 404s reported by Lighthouse.
   ============================================================ */
:root{--bg:#05040a;--bg2:#0a0818;--ink:#e8ecff;--ink-dim:#8fa1d4;--violet:#8a5cff;--blue:#3ea0ff;--gold:#ffd36a;--stroke:rgba(163,138,255,.22);--radius:18px;--font:"Space Grotesk","Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--cic-zeus-a:#FF3B5C;--cic-zeus-b:#FF9F1C;--cic-zeus-c:#FFEE32;--cic-zeus-d:#FF6B35;--cic-ai-a:#00E8A0;--cic-ai-b:#2DE2E6;--cic-frame-glow:rgba(255,159,28,.48)}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body{min-height:100vh;background:radial-gradient(1400px 900px at 50% 0%,rgba(255,159,28,.10),transparent 55%),radial-gradient(1200px 800px at 100% 100%,rgba(0,232,160,.07),transparent 60%),linear-gradient(180deg,#05040a 0%,#0a0818 100%)}
a{color:#6fd3ff;text-decoration:none}
img{max-width:100%;display:block}
.zeus-page-bg{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:1}
.zeus-page-bg__layer{position:absolute;inset:0;background-size:cover;background-position:center 28%;background-repeat:no-repeat}
.zeus-page-bg__veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,4,10,.42),rgba(5,4,10,.74))}
.nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px 32px;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:linear-gradient(180deg,rgba(5,4,10,.7),rgba(5,4,10,.3));border-bottom:1px solid var(--stroke)}
.brand{display:flex;align-items:center;gap:16px}
.brand-logo{width:72px;height:72px;border-radius:22px;border:3px solid transparent;background:linear-gradient(#0a0818,#0a0818) padding-box,conic-gradient(from 210deg,#FF3B5C,#FF9F1C,#FFEE32,#00E8A0,#2DE2E6,#FF3B5C) border-box;overflow:hidden;box-shadow:0 0 36px rgba(255,159,28,.48)}
.brand-logo img{width:100%;height:100%;object-fit:cover;object-position:center 18%;border-radius:18px}
.zeus-wordmark{font-family:"Segoe UI Variable Display","Avenir Next Condensed","Futura","Century Gothic",system-ui,sans-serif;font-weight:800;font-size:26px;letter-spacing:-.038em;background:linear-gradient(115deg,#FF3B5C,#FF9F1C,#FFEE32,#FF6B35);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.zeus-wordmark .ai{background:linear-gradient(125deg,#00E8A0,#2DE2E6,#E8FFF8,#7CF7C0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.btn{display:inline-block;padding:14px 20px;border-radius:14px;border:1px solid rgba(255,255,255,.18);color:#fff;text-decoration:none;background:rgba(255,255,255,.08)}
.btn.primary{background:linear-gradient(135deg,var(--violet),var(--blue));border-color:transparent}
.hero,.hero-grid,.hero-copy,.hero h1{overflow:visible!important}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;padding:96px 7vw}
@media(max-width:980px){.hero{padding-top:168px}}
@media(max-width:640px){.hero{padding-top:176px}}
.hero-copy{padding:28px 0 20px}
.hero h1{line-height:1.22;padding:0;margin:24px 0 22px;font-size:clamp(44px,6vw,88px);font-weight:700;letter-spacing:-1.5px;color:#f4f7ff;-webkit-text-fill-color:#f4f7ff}
.hero h1 .hero-brand{color:#fff;-webkit-text-fill-color:#fff;text-shadow:0 0 28px rgba(255,255,255,.18)}
.hero h1 .grad{background:none!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;-webkit-text-fill-color:#9fd0ff;color:#9fd0ff;filter:none!important;text-shadow:0 0 34px rgba(111,211,255,.42),0 2px 18px rgba(0,0,0,.35)}
.hero-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:40px;align-items:center;max-width:1480px;margin:0 auto;width:100%}
.hero-side{position:relative;z-index:3;display:flex;justify-content:flex-end}
.hero-vision-frame{position:relative;width:min(420px,100%);padding:28px 26px 26px;border-radius:22px;background:linear-gradient(155deg,rgba(8,12,22,.55),rgba(5,8,16,.35));border:1px solid transparent;background-clip:padding-box;box-shadow:0 0 0 1px rgba(255,159,28,.28),0 24px 60px -28px rgba(0,232,160,.35),inset 0 1px 0 rgba(255,255,255,.08);overflow:hidden}
.hero-vision-kicker{margin:0 0 12px;font-family:Orbitron,ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:#FF9F1C}
.hero-vision-title{margin:0;font-family:Syne,"Segoe UI Variable Display",system-ui,sans-serif;font-weight:800;font-size:clamp(1.55rem,2.6vw,2.35rem);line-height:1.05;letter-spacing:-.03em;background:linear-gradient(115deg,#FF3B5C 0%,#FF9F1C 28%,#FFEE32 52%,#00E8A0 78%,#2DE2E6 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.hero-vision-sub{margin:14px 0 0;font-family:Syne,system-ui,sans-serif;font-weight:700;font-size:clamp(1.05rem,1.5vw,1.25rem);line-height:1.25;color:#E8FFF8;text-shadow:0 0 24px rgba(0,232,160,.35)}
.hero-vision-line{margin:10px 0 0;font-size:14px;line-height:1.45;color:#9fd0ff;max-width:34ch}
@media(max-width:1100px){.hero-grid{grid-template-columns:1fr}.hero-side{justify-content:center}}
section.hero[data-reveal],section.hero{opacity:1!important;transform:none!important}
/* Hide the Google Translate banner/iframe so the auto-translation is
   applied silently and the layout never shifts. The widget itself stays
   active in #google_translate_element (kept off-screen). */
.skiptranslate,
.goog-te-banner-frame,
.goog-te-gadget-icon,
#goog-gt-tt,
.goog-tooltip,
.goog-tooltip:hover,
.VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
.VIpgJd-ZVi9od-ORHb-OEVmcd { display:none !important; visibility:hidden !important; }
body { top:0 !important; position:static !important; }
font[style*="vertical-align"] { background:none !important; box-shadow:none !important; }
#google_translate_element { position:absolute !important; left:-9999px !important; top:-9999px !important; width:1px; height:1px; overflow:hidden; }
</style>
${gtPrimer}
</head>
<body>
<a href="#app" style="position:absolute;left:-999px;top:10px;background:#fff;color:#05040a;padding:10px 14px;border-radius:10px;z-index:9999" onfocus="this.style.left='10px'" onblur="this.style.left='-999px'">Skip to content</a>
<noscript><div style="position:relative;z-index:10;max-width:760px;margin:120px auto 20px;padding:18px 22px;border-radius:14px;background:rgba(138,92,255,.08);border:1px solid rgba(138,92,255,.3);color:#e8f4ff;font-family:system-ui,Arial">ZeusAI runs best with JavaScript enabled. Static pages, sitemap, and the service marketplace are still available without it: visit <a href="/sitemap.xml" style="color:#8a5cff">/sitemap.xml</a>, <a href="/docs" style="color:#8a5cff">/docs</a>, or <a href="/services" data-link style="color:#8a5cff">/services</a>.</div></noscript>
<div class="galaxy-bg" id="zeusCanvas" aria-hidden="true"></div>
${zeusPageBgSSR(route)}
<div class="toasts" id="toasts"></div>
${navBar(route, opts)}
<main id="app">`;
}

function navBar(route, opts) {
  opts = opts || {};
  const curLang = opts.lang || 'en';
  const autoLang = (opts.autoLang || curLang || 'en');
  const L = (href, label) => `<a href="${href}" data-link${route === href ? ' class="active"' : ''}>${label}</a>`;
  // 30Y-LTS: country-aware auto-translate.
  //   The site is detected and translated automatically into the visitor's
  //   country's language (Google Translate widget, primed via the `googtrans`
  //   cookie set in `<head>`). The small toggle below lets the visitor force
  //   English or revert to the auto-detected language.
  const showingEnglish = curLang === 'en';
  const targetLang = showingEnglish ? autoLang : 'en';
  const targetLabel = showingEnglish
    ? (autoLang === 'en' ? 'EN' : autoLang.toUpperCase())
    : 'EN';
  const targetTitle = showingEnglish
    ? `Display in ${autoLang.toUpperCase()} (auto-detected)`
    : 'Display in English';
  const langToggle = `<button class="lang-toggle" type="button" data-target-lang="${targetLang}" aria-label="${targetTitle}" title="${targetTitle}">🌐 ${targetLabel}</button>`;
  return `<nav class="nav" data-nav-open="false">
<div class="brand"><div class="brand-logo brand-logo-photo" aria-hidden="true"><picture><source type="image/avif" srcset="${assetPath('/assets/zeus/brand-176.avif')} 1x, ${assetPath('/assets/zeus/brand-264.avif')} 2x"/><source type="image/webp" srcset="${assetPath('/assets/zeus/brand-176.webp')} 1x, ${assetPath('/assets/zeus/brand-264.webp')} 2x"/><img src="${assetPath('/assets/zeus/brand-176.jpg')}" srcset="${assetPath('/assets/zeus/brand-176.jpg')} 1x, ${assetPath('/assets/zeus/brand-264.jpg')} 2x" alt="" width="72" height="72" decoding="async" fetchpriority="high" onerror="this.style.display='none'"/></picture></div><div><span class="zeus-wordmark" data-cic="volt-aurora" aria-label="ZeusAI">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
<button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
  <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
</button>
<div class="nav-links" id="nav-links">
${L('/', 'Home')}${L('/buy', 'Buy')}${L('/services', 'Marketplace')}<a class="nav-link nav-link-zacc" href="/zacc" data-link aria-label="Zeus Dropship OS autonomy cockpit">🛒 Dropship <span style="display:inline-block;margin-left:6px;padding:1px 7px;font-size:10px;font-weight:700;letter-spacing:.08em;border-radius:999px;background:linear-gradient(135deg,#8a5cff,#3ea0ff);color:#05060e;vertical-align:middle">LIVE</span></a>${L('/pricing', 'Pricing')}${L('/account', 'Account')}
<div class="nav-more" data-nav-more>
  <button type="button" class="nav-more-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="nav-more-menu" data-nav-more-btn>More <span aria-hidden="true" style="display:inline-block;margin-left:4px">▾</span></button>
  <div class="nav-more-menu" id="nav-more-menu" role="menu" data-nav-more-menu hidden>
    ${L('/social-network', 'ZeusAI Social')}
    ${L('/frontier', 'Frontier')}
    ${L('/innovations', 'Innovations')}
    ${L('/agents', 'Agents')}
    ${L('/wizard', 'Find my plan')}
    ${L('/store', 'Store')}
    ${L('/crypto-fiat-bridge', 'Crypto Bridge')}
    ${L('/enterprise', 'Enterprise')}
    ${L('/docs', 'API &amp; Docs')}
    ${L('/status', 'Autonomy OS')}
    ${L('/trust', 'Trust Center')}
  </div>
</div>
</div>
<div class="nav-cta">
${langToggle}
<a class="btn btn-ghost" href="/account" data-link data-customer-cta>Sign in</a>
<a class="btn btn-primary" href="/services" data-link>Explore Services</a>
</div>
</nav>`;
}

function footer(route, opts) {
  opts = opts || {};
  const nonce = opts.nonce || '';
  const N = nonce ? ` nonce="${nonce}"` : '';
  return `</main>
<footer>
  <div class="foot-grid">
    <div>
      <div class="brand" style="margin-bottom:14px"><div class="brand-logo" aria-hidden="true"></div><div><span class="zeus-wordmark" data-cic="volt-aurora" aria-label="ZeusAI">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
      <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;max-width:360px">Autonomous AI operating system. Every module signed with W3C DID. Every outcome routed through Merkle-chained receipts. Property of ${OWNER.name}.</p>
    </div>
    <div><h3 class="footer-col-title">Product</h3><ul>
      <li><a href="/buy" data-link><strong style="color:#f7931a">Buy now</strong></a></li>
      <li><a href="/zacc" data-link><strong style="color:#8a5cff">🛒 Zeus Dropship OS</strong></a></li>
      <li><a href="/social-network" data-link><strong style="color:#7cf7c0">ZeusAI Social</strong></a></li>
      <li><a href="/services" data-link>Marketplace</a></li>
      <li><a href="/outcomes" data-link>Outcomes</a></li>
      <li><a href="/twin" data-link>Buyer twin</a></li>
      <li><a href="/vom" data-link>Vertical machines</a></li>
      <li><a href="/wizard" data-link>Find my plan</a></li>
      <li><a href="/pricing" data-link>Pricing</a></li>
      <li><a href="/how" data-link>How it works</a></li>
      <li><a href="/dashboard" data-link>Dashboard</a></li>
      <li><a href="/store" data-link>Instant Store</a></li>
      <li><a href="/gift" data-link>Gift</a></li>
    </ul></div>
    <div><h3 class="footer-col-title">Developers</h3><ul>
      <li><a href="/docs" data-link>API &amp; Docs</a></li>
      <li><a href="/api-explorer" data-link>API Explorer</a></li>
      <li><button type="button" class="btn" data-live-inspect="/openapi.json" data-live-title="OpenAPI 3.1" style="background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-align:left">OpenAPI 3.1</button></li>
      <li><a href="/seo" data-link>SEO desk</a></li>
      <li><a href="/sitemap.xml" data-allow-raw="1">Sitemap</a></li>
      <li><button type="button" class="btn" data-live-inspect="/snapshot" data-live-title="Live snapshot" style="background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-align:left">Live snapshot</button></li>
      <li><a href="/api-explorer?endpoint=/health" data-link>Health explorer</a></li>
      <li><button type="button" class="btn" data-live-inspect="/health" data-live-title="Health" style="background:none;border:0;padding:0;color:inherit;font:inherit;cursor:pointer;text-align:left">/health</button></li>
    </ul></div>
    <div><h3 class="footer-col-title">Trust</h3><ul>
      <li><a href="/rails" data-link>Payment rails</a></li>
      <li><a href="/continuity" data-link>Continuity attestation</a></li>
      <li><a href="/standard" data-link>Merchant standard</a></li>
      <li><a href="/trust" data-link>Trust Center</a></li>
      <li><a href="/security" data-link>Security</a></li>
      <li><a href="/responsible-ai" data-link>Responsible AI</a></li>
      <li><a href="/refund" data-link>Refund Guarantee</a></li>
      <li><a href="/sla" data-link>SLA</a></li>
      <li><a href="/pledge" data-link>Anti-Dark-Pattern Pledge</a></li>
      <li><a href="/cancel" data-link>Universal Cancel</a></li>
      <li><a href="/transparency" data-link>Bandit Transparency</a></li>
      <li><a href="/aura" data-link>Live Aura</a></li>
      <li><a href="/status" data-link>Live Status</a></li>
      <li><a href="/innovations" data-link>30Y Innovations</a></li>
      <li><a href="/frontier" data-link>Frontier (F1–F12)</a></li>
      <li><a href="/sw-reset">Clear cache</a></li>
    </ul></div>
    <div><h3 class="footer-col-title">Company</h3><ul>
      <li><a href="/about" data-link>About</a></li>
      <li><a href="/contact" data-link>Contact</a></li>
      <li><a href="/faq" data-link>FAQ</a></li>
      <li><a href="/blog" data-link>Insights</a></li>
      <li><a href="/roadmap" data-link>Roadmap</a></li>
      <li><a href="/partners" data-link>Partners</a></li>
      <li><a href="/affiliate" data-link>Affiliate</a></li>
      <li><a href="/careers" data-link>Careers</a></li>
      <li><a href="/press" data-link>Press</a></li>
      <li><a href="/changelog" data-link>Changelog</a></li>
      <li><a href="/legal" data-link>Legal</a></li>
      <li><a href="/terms" data-link>Terms</a></li>
      <li><a href="/privacy" data-link>Privacy</a></li>
      <li><a href="/dpa" data-link>DPA</a></li>
      <li><a href="/payment-terms" data-link>Payment Terms</a></li>
      <li><a href="/operator" data-link>Operator Console</a></li>
      <li><a href="mailto:${OWNER.email}">${OWNER.email}</a></li>
    </ul></div>
  </div>
  <div class="foot-bot">
    <span>© ${new Date().getFullYear()} ${OWNER.name}. All code, models and UI are original and the sole property of the repo owner.</span>
    <span>Powered by Zeus Core · Merkle-chained receipts · Ed25519 signatures</span>
  </div>
</footer>
${concierge()}
${globalChrome(N)}
<noscript><div style="position:fixed;bottom:0;left:0;right:0;padding:14px 18px;background:#05040a;color:#e8f0ff;border-top:1px solid #3ea0ff;font:14px/1.4 system-ui;z-index:99">This site works fully without JavaScript. Cinematic effects are disabled in no-JS mode; all services, pricing and APIs remain reachable.</div></noscript>
<script${N}>window.__UNICORN__=${JSON.stringify({ owner: OWNER, route })};</script>
<script${N}>window.__ZEUS_ASSETS__=${JSON.stringify(browserAssetManifest())};</script>
<script${N}>
/* CIC/1.0 — hydrate brand spectrum CSS vars site-wide (40y chromatic continuum) */
(function(){
  function apply(vars){
    if(!vars||typeof vars!=='object') return;
    try{
      var root=document.documentElement;
      Object.keys(vars).forEach(function(k){ if(String(k).indexOf('--')===0) root.style.setProperty(k, vars[k]); });
    }catch(_){}
  }
  fetch('/api/brand/spectrum',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
    if(d&&d.cssVars) apply(d.cssVars);
    else if(d&&d.spectrum&&d.spectrum.cssVars) apply(d.spectrum.cssVars);
  }).catch(function(){});
})();
</script>
<script${N} data-local-three-version="r160">
// Trusted Types: register a passthrough 'default' policy early — before any
// third-party script runs — so raw innerHTML / script.src assignments from any
// module are automatically routed through it, satisfying require-trusted-types-for
// 'script' without breaking existing functionality.
(function(){
  if (!window.trustedTypes || typeof window.trustedTypes.createPolicy !== 'function') return;
  try { window.trustedTypes.createPolicy('default', {
    createHTML: function(s){ return String(s == null ? '' : s); },
    createScriptURL: function(s){ return String(s == null ? '' : s); },
    createScript: function(s){ return String(s == null ? '' : s); }
  }); } catch(_) { /* already registered — allow-duplicates in CSP is set */ }
})();
// 30Y-LTS: try locally vendored Three.js first, fall back to CDN only when absent.
// PERF: defer until the browser is idle (or 1.5 s after load) so Three.js parsing
// never blocks LCP / TBT. The galaxy canvas already has a CSS-only fallback
// painted for the first frame so deferring is purely additive.
(function loadThree(){
  function inject(){
    if (window.__zeusThreeLoaded) return; window.__zeusThreeLoaded = true;
    function loadCdnFallback(){
      if (window.__zeusThreeCdnLoaded) return;
      window.__zeusThreeCdnLoaded = true;
      var f=document.createElement('script');
      var _fsrc='https://unpkg.com/three@0.160.0/build/three.min.js';
      try { f.src = (window.trustedTypes && window.trustedTypes.defaultPolicy) ? window.trustedTypes.defaultPolicy.createScriptURL(_fsrc) : _fsrc; } catch(_e){ try{ f.setAttribute('src',_fsrc); }catch(__){} }
      f.async=true;document.head.appendChild(f);
    }
    var s=document.createElement('script');
    var _src='${assetPath('/assets/vendor/three.min.js')}';
    // Use Trusted Types createScriptURL when available (satisfies TrustedScriptURL sink)
    try { s.src = (window.trustedTypes && window.trustedTypes.defaultPolicy) ? window.trustedTypes.defaultPolicy.createScriptURL(_src) : _src; } catch(_e){ try{ s.setAttribute('src',_src); }catch(__){} }
    s.async=true;
    s.onerror=loadCdnFallback;
    s.onload=function(){
      try {
        if (window.__UNICORN_THREE_STUB__ || !window.THREE) loadCdnFallback();
      } catch(_) { loadCdnFallback(); }
    };
    document.head.appendChild(s);
  }
  var ric = window.requestIdleCallback || function(cb){ return setTimeout(cb, 1500); };
  if (document.readyState === 'complete') ric(inject, { timeout: 3000 });
  else window.addEventListener('load', function(){ ric(inject, { timeout: 3000 }); }, { once: true });
})();
</script>
<script${N}>
// 30Y-LTS — country-aware language toggle.
// The site is auto-translated into the visitor's country's language via the
// Google Translate widget (primed by the googtrans cookie set server-side
// in head). The small "EN / auto" button toggles between English and the
// auto-detected language without flicker.
(function(){
  function setCookie(name, value, days){
    var d = new Date(); d.setTime(d.getTime() + (days||365) * 86400000);
    var base = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;samesite=lax';
    document.cookie = base;
    // Also write on the registrable domain so subdomains share the choice.
    try {
      var h = location.hostname.split('.');
      if (h.length >= 2) {
        document.cookie = base + ';domain=.' + h.slice(-2).join('.');
      }
    } catch(_) {}
  }
  function clearCookie(name){
    setCookie(name, '', -1);
    // Clear googtrans on every variant Google may have written.
    if (name === 'googtrans') {
      try {
        var h = location.hostname.split('.');
        for (var i=0; i<h.length-1; i++) {
          var dom = h.slice(i).join('.');
          document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + dom;
          document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + dom;
        }
      } catch(_) {}
      document.cookie = 'googtrans=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    }
  }
  document.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest && ev.target.closest('.lang-toggle');
    if (!b) return;
    ev.preventDefault();
    var target = b.getAttribute('data-target-lang') || 'en';
    if (target === 'en') {
      // User wants English — clear translation cookie and remember the choice.
      setCookie('lang', 'en', 365);
      clearCookie('googtrans');
    } else {
      // User wants the auto-detected language — clear the override and let
      // the server-side detection pick it up on reload.
      clearCookie('lang');
      setCookie('googtrans', '/en/' + target, 365);
    }
    location.reload();
  }, false);
})();
// Google Translate widget bootstrap. The googtrans cookie (set in head
// when the visitor's country language is not English) drives the in-place
// translation; the banner is hidden via CSS, so the page is translated
// silently.
window.googleTranslateElementInit = function(){
  try {
    new google.translate.TranslateElement({
      pageLanguage: 'en',
      autoDisplay: false,
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
  } catch(_){ }
};
</script>
<div id="google_translate_element" aria-hidden="true"></div>

<script${N}>
// Service worker cleanup: unregister any legacy workers and drop their caches
// so future navigations are always fetched fresh from origin. The user keeps
// the page they're currently viewing — we deliberately do NOT trigger a
// location.reload() here. The previous version did, and that one-per-build
// forced reload was both visible to the user as an "auto-refresh" and
// re-entered the still-controlling legacy SW, which on some Android browsers
// (Samsung Internet, older Chromium) returned a stale/empty HTML and left the
// Marketplace page blank. Cleanup is still effective: the next user-initiated
// navigation runs entirely SW-free.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){
    navigator.serviceWorker.getRegistrations().then(function(regs){
      if (!regs || !regs.length) return null;
      return Promise.all(regs.map(function(reg){ return reg.unregister().catch(function(){}); }))
        .then(function(){ return (window.caches && caches.keys) ? caches.keys() : []; })
        .then(function(keys){ return Promise.all((keys || []).map(function(key){ return caches.delete(key).catch(function(){}); })); });
    }).catch(function(){});
  });
}
/* CCG/1.0 — Client Continuum Guardian: detect build SHA drift vs integrity.json.
   Soft-only: one sessionStorage-gated hint banner, never infinite reload loops. */
(function(){
  try {
    var meta = document.querySelector('meta[name="x-zeus-build"]');
    var pageSha = meta && meta.getAttribute('content');
    if (!pageSha) return;
    fetch('/integrity.json', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(d){
      var live = (d && d.payload && d.payload.version) || (d && d.version) || '';
      if (!live) return;
      var a = String(pageSha).slice(0, 7);
      var b = String(live).slice(0, 7);
      if (!a || !b || a === b) return;
      var key = 'zeus.ccg.drift.' + b;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch(_){}
      var bar = document.createElement('div');
      bar.setAttribute('role', 'status');
      bar.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:80;max-width:560px;margin:0 auto;padding:12px 14px;border-radius:12px;background:rgba(5,4,10,.92);border:1px solid rgba(247,147,26,.45);color:#e8ecff;font:13px/1.45 system-ui;box-shadow:0 12px 40px rgba(0,0,0,.45)';
      bar.innerHTML = 'Newer ZeusAI build is live (<code>'+b+'</code>). You are on <code>'+a+'</code>. <a href="/sw-reset" style="color:#ffd36a;font-weight:600">Clear cache &amp; reload</a>';
      document.body.appendChild(bar);
    }).catch(function(){});
  } catch(_){}
})();
// CSP violation reporter (defensive)
window.addEventListener('securitypolicyviolation', function(e){
  try{
    fetch('/csp-violations', { method:'POST', headers:{'Content-Type':'application/csp-report'}, body: JSON.stringify({
      'csp-report': {
        'document-uri': location.href,
        'violated-directive': e.violatedDirective,
        'effective-directive': e.effectiveDirective,
        'blocked-uri': e.blockedURI,
        'source-file': e.sourceFile,
        'line-number': e.lineNumber,
        'status-code': e.statusCode || 0
      }
    })}).catch(function(){});
  }catch(_){ }
});
</script>
<script${N} src="${assetPath('/assets/aeon.js')}" defer></script>
<script${N} src="${assetPath('/assets/app.js')}" defer></script>
</body></html>`;
}

function concierge() {
  return `<div class="concierge" id="concierge">
  <button class="concierge-btn" id="conciergeBtn" aria-label="Zeus Concierge">⚡</button>
  <div class="concierge-panel" id="conciergePanel" role="dialog" aria-label="Zeus AI Sales Agent">
    <div class="concierge-head"><span class="dot"></span> Zeus · <span style="color:var(--violet2);font-weight:700">30Y</span> AI<span class="meta" id="conciergeMeta">zeus-30y</span></div>
    <div class="concierge-body" id="conciergeBody" aria-live="polite">
      <div class="msg bot"><div class="msg-body">Salut! Sunt <b>Zeus-30Y</b> — standardul AI sales pentru următorii 30 de ani. Streaming, voce, memorie, recomandări live, checkout BTC direct și activare instant.\n\nHi! I'm <b>Zeus-30Y</b> — the 30-year AI sales standard. Streaming, voice, memory, live recs, direct BTC checkout, instant activation.</div></div>
    </div>
    <div class="chips" id="conciergeChips">
      <button class="chip" data-q="Ce servicii ai și ce prețuri?">💰 Prețuri</button>
      <button class="chip" data-q="Cum plătesc în BTC?">₿ BTC checkout</button>
      <button class="chip" data-q="Recomandă-mi pachetul pentru lead generation">🚀 Growth</button>
      <button class="chip" data-q="What's the best service for enterprise?">🏢 Enterprise</button>
      <button class="chip" data-q="Arată-mi serviciile mele">📦 My services</button>
    </div>
    <div class="concierge-foot">
      <textarea id="conciergeInput" rows="1" placeholder="Întreabă Zeus orice… / Ask Zeus anything…  (Enter · Shift+Enter newline)" autocomplete="off" aria-label="Ask Zeus anything"></textarea>
      <button id="conciergeSend" aria-label="Send">→</button>
    </div>
  </div>
</div>`;
}

// ================== PAGES ==================

function globalChrome(N) {
  N = N || '';
  return `<div id="zeus-cookie" class="zeus-cookie" hidden>
  <div class="zeus-cookie-text">We use only first-party, signed analytics — no trackers, no ad networks. <a href="/privacy" data-link>Privacy</a> · <a href="/pledge" data-link>Pledge</a>.</div>
  <div class="zeus-cookie-cta"><button id="zeus-cookie-accept" class="btn btn-primary btn-sm">Accept</button><button id="zeus-cookie-deny" class="btn btn-ghost btn-sm">Deny</button></div>
</div>
<!-- Removed: zeus-buy-bar footer CTA banner permanently (2026-06-09) -->
<!-- Founders' brief exit-intent popup removed — was blocking /account access for logged-in users.
     Newsletter signup remains available in the footer (non-blocking). -->
<script${N}>
(function(){
  // Early resilient fetch: applies before /assets/app.js loads, so inline
  // telemetry/aura/newsletter requests also get 3x retry + last-good fallback.
  try {
    if (!window.__zeusResilientFetchInstalled && window.fetch) {
      window.__zeusResilientFetchInstalled = true;
      var nativeFetch = window.fetch.bind(window);
      var cachePrefix = 'zeus_last_good_response:';
      var wait = function(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); };
      var methodOf = function(input, init){ return String((init && init.method) || (input && input.method) || 'GET').toUpperCase(); };
      var urlOf = function(input){ try { return new URL((typeof input === 'string' ? input : input.url), location.origin).href; } catch(_) { return String(input || ''); } };
      var sameSite = function(url){ try { return new URL(url, location.origin).origin === location.origin; } catch(_) { return false; } };
      var keyOf = function(method, url){ return cachePrefix + method + ':' + url; };
      var rateLimitMessage = function(response){
        var retryAfter = response && response.headers && response.headers.get && response.headers.get('retry-after');
        return 'Live API is protecting the service from too many requests. Please try again' + (retryAfter ? ' in ' + retryAfter + 's.' : ' in a moment.');
      };
      var remember = function(method, url, response){
        if (method !== 'GET' || !sameSite(url) || !response || !response.ok) return;
        try { response.clone().text().then(function(body){
          if (!body || body.length > 250000) return;
          localStorage.setItem(keyOf(method, url), JSON.stringify({ body: body, type: response.headers.get('content-type') || 'application/json', status: response.status, ts: Date.now() }));
        }).catch(function(){}); } catch(_) {}
      };
      var cached = function(method, url){
        if (method !== 'GET' || !sameSite(url)) return null;
        try {
          var item = JSON.parse(localStorage.getItem(keyOf(method, url)) || 'null');
          if (!item || typeof item.body !== 'string') return null;
          document.documentElement.setAttribute('data-zeus-api-fallback','1');
          return new Response(item.body, { status: 200, statusText: 'OK (cached)', headers: { 'Content-Type': item.type || 'application/json', 'X-Zeus-Cache-Fallback': '1', 'X-Zeus-Cache-Ts': String(item.ts || '') } });
        } catch(_) { return null; }
      };
      window.fetch = async function zeusResilientFetch(input, init){
        var method = methodOf(input, init), url = urlOf(input), lastError = null, lastResponse = null;
        for (var attempt = 1; attempt <= 3; attempt++) {
          try {
            var response = await nativeFetch(input, init);
            if (response.ok) { remember(method, url, response); return response; }
            if (response.status===429) {
              try { document.documentElement.setAttribute('data-zeus-rate-limited', '1'); window.dispatchEvent(new CustomEvent('zeus:rate-limit', { detail: { message: rateLimitMessage(response), url: url } })); } catch(_) {}
              return response;
            }
            lastResponse = response;
            if (response.status < 500) return response;
          } catch(err) { lastError = err; if (init && init.signal && init.signal.aborted) break; }
          if (attempt < 3) await wait(250 * attempt);
        }
        return cached(method, url) || lastResponse || Promise.reject(lastError || new Error('Network error'));
      };
    }
  } catch(_){ }
  // Mobile nav hamburger toggle
  try {
    var navEl = document.querySelector('nav.nav');
    var navBtn = document.querySelector('.nav-toggle');
    var navLinks = document.getElementById('nav-links');
    if (navEl && navBtn && navLinks){
      var setOpen = function(open){
        navEl.setAttribute('data-nav-open', open ? 'true':'false');
        navBtn.setAttribute('aria-expanded', open ? 'true':'false');
        document.documentElement.style.overflow = open ? 'hidden' : '';
      };
      navBtn.addEventListener('click', function(){
        setOpen(navEl.getAttribute('data-nav-open') !== 'true');
      });
      navLinks.addEventListener('click', function(e){
        if (e.target && e.target.tagName === 'A') setOpen(false);
      });
      // Close on resize to desktop
      window.addEventListener('resize', function(){
        if (window.innerWidth > 980) setOpen(false);
      });
      // Close on Esc
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });
    }
  } catch(_){ }
  // Nav "More" overflow menu (Social / Frontier / Innovations / Docs / Trust)
  // Opens on click, closes on outside click / Escape / route change. Reuses
  // the mobile hamburger's overlay pattern.
  try {
    var moreEl = document.querySelector('[data-nav-more]');
    if (moreEl) {
      var moreBtn = moreEl.querySelector('[data-nav-more-btn]');
      var moreMenu = moreEl.querySelector('[data-nav-more-menu]');
      var setMore = function(open){
        moreEl.setAttribute('data-open', open ? 'true' : 'false');
        if (moreBtn) moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (moreMenu){
          if (open) moreMenu.removeAttribute('hidden');
          else moreMenu.setAttribute('hidden', '');
        }
      };
      if (moreBtn) moreBtn.addEventListener('click', function(e){
        e.stopPropagation();
        setMore(moreEl.getAttribute('data-open') !== 'true');
      });
      document.addEventListener('click', function(e){
        if (!moreEl.contains(e.target)) setMore(false);
      });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMore(false); });
      if (moreMenu) moreMenu.addEventListener('click', function(e){
        if (e.target && e.target.tagName === 'A') setMore(false);
      });
    }
  } catch(_){ }
  // Cookie banner
  try {
    var c = document.getElementById('zeus-cookie');
    if (c && !document.cookie.match(/zeus_consent=/)) c.hidden = false;
    document.getElementById('zeus-cookie-accept').onclick = function(){ document.cookie='zeus_consent=1; path=/; max-age=31536000; samesite=lax'; c.hidden=true; };
    document.getElementById('zeus-cookie-deny').onclick = function(){ document.cookie='zeus_consent=0; path=/; max-age=31536000; samesite=lax'; c.hidden=true; };
  } catch(_){ }
  // Live aura strip — pull every 30s
  function pullAura(){
    try {
      fetch('/api/aura').then(function(r){return r.json();}).then(function(j){
        var t = document.getElementById('zeus-aura-text'); if (!t) return;
        var k = j && j.kpis ? j.kpis : {};
        var bits = [];
        if (k.signedReceipts != null) bits.push(k.signedReceipts + ' signed receipts');
        if (k.refundsHonored != null) bits.push(k.refundsHonored + ' refunds honored');
        if (k.uptime != null) bits.push(k.uptime + ' uptime');
        if (k.activeCarts != null) bits.push(k.activeCarts + ' live carts');
        t.textContent = bits.length ? bits.join(' · ') : 'sovereign · self-evolving · signed';
      }).catch(function(){});
    } catch(_){ }
  }
  pullAura(); setInterval(pullAura, 30000);
  // Sticky buy bar permanently removed (2026-06-09)
  // Exit-intent popup permanently removed — was blocking /account access for
  // logged-in users. Newsletter signup lives in the footer (non-blocking).
  // Defensive cleanup: if a stale modal element ever lingers in the DOM
  // (e.g. cached HTML), force-hide it.
  try {
    var staleExit = document.getElementById('zeus-exit');
    if (staleExit && staleExit.parentNode) staleExit.parentNode.removeChild(staleExit);
  } catch(_){ }
  // Track pageview
  try {
    fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'pageview', route: location.pathname, ref: document.referrer || '' }) }).catch(function(){});
  } catch(_){ }
})();
</script>
<style>
.zeus-cookie{position:fixed;left:18px;right:18px;bottom:18px;z-index:90;background:rgba(8,10,18,.94);backdrop-filter:blur(18px);border:1px solid rgba(120,140,200,.25);border-radius:14px;padding:12px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:13.5px/1.5 system-ui;color:#cdd6e4;box-shadow:0 14px 40px rgba(0,0,0,.5)}
.zeus-cookie-text{flex:1;min-width:240px}.zeus-cookie-cta{display:flex;gap:8px}
.zeus-aura-strip{position:fixed;left:14px;top:74px;z-index:60;background:rgba(8,10,18,.7);backdrop-filter:blur(12px);border:1px solid rgba(120,140,200,.18);border-radius:999px;padding:6px 12px;font:12px/1 'JetBrains Mono',monospace;color:#cdd6e4;display:none;align-items:center;gap:8px}
@media (min-width: 920px){.zeus-aura-strip{display:inline-flex}}
.zeus-aura-strip .dot{width:8px;height:8px;border-radius:50%;background:#3effa1;box-shadow:0 0 12px #3effa1;animation:zpulse 1.4s ease-in-out infinite}
.zeus-aura-more{color:#7aa9ff;text-decoration:none;margin-left:4px}
@keyframes zpulse{0%,100%{opacity:.7}50%{opacity:1}}
/* .zeus-buy-bar, .zeus-buy-text, .zeus-buy-cta removed permanently (2026-06-09) */
.btn-sm{padding:8px 14px;font-size:13px}
[hidden]{display:none !important}
/* .zeus-buy-bar[hidden] removed — buy bar element itself removed (2026-06-09) */
.zeus-cookie[hidden]{display:none !important}
/* .zeus-exit*: removed (founders' brief popup eliminated) */
/* Heading-rename visual preservation (a11y h2→h3 chain, no visual regression) */
.pillar-title{margin:8px 0 6px;font-size:16px;font-weight:600;line-height:1.25;letter-spacing:.01em}
.footer-col-title{margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-dim,#9aa6bd)}
</style>`;
}

function pageHome() {
  // Featured 6 services for SSR strip on the homepage. We pick the 2 cheapest
  // from each tier so the page always shows a buyable price range without
  // depending on JS hydration.
  const _all = _loadCatalog();
  const _byTier = { instant: [], professional: [], enterprise: [] };
  _all.forEach(p => { const t = String(p.tier || 'professional'); if (_byTier[t]) _byTier[t].push(p); });
  // World-Profit-OS: featured strip = instant + professional ONLY (no enterprise
  // hero card spam). Enterprise gets its own explicit CTA row underneath so
  // scaling buyers still have a signalled path.
  const _featured = []
    .concat(_byTier.instant.slice().sort((a,b)=>(a.priceUSD||0)-(b.priceUSD||0)).slice(0,2))
    .concat(_byTier.professional.slice().sort((a,b)=>(a.priceUSD||0)-(b.priceUSD||0)).slice(0,2));
  const _featuredHtml = _featured.length
    ? `<section id="homeFeatured" style="margin:40px 0 0">
  <div class="section-title">
    <div><span class="kicker">Featured services</span><h2>Buy a real ZeusAI service <span class="grad">in under a minute.</span></h2></div>
    <p>Four concrete deliverables you can pay for right now in BTC. Browse the full catalogue on <a href="/services" data-link>/services</a>.</p>
  </div>
  ${_ssrCatalogGrid(_featured, { gridId: 'homeFeaturedGrid', minCol: 280 })}
  <div id="homeEnterpriseRow" class="card" style="margin:18px 0 0;padding:16px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(138,92,255,.10),rgba(62,160,255,.06));border:1px solid rgba(138,92,255,.35)">
    <div style="min-width:240px;flex:1">
      <span class="kicker">Building at scale?</span>
      <h3 style="margin:6px 0 2px;font-size:18px">Enterprise · outcome-priced, signed SLAs, dedicated Zeus cluster.</h3>
      <p style="margin:0;color:var(--ink-dim);font-size:13.5px">Value-Proof Ledger auto-invoices bps share on measured outcomes.</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-ghost" href="/services" data-link>Explore Enterprise →</a>
      <a class="btn" href="/pricing" data-link>See pricing</a>
    </div>
  </div>
  <p style="text-align:center;margin:18px 0 0"><a class="btn btn-ghost" href="/services" data-link>Browse the full catalogue →</a></p>
</section>` : '';
  // Post-featured commerce proof rail: live on-chain sales + BTC-discount chip.
  // Both are SSR containers hydrated by client.js hydrateHomeProof().
  const _homeProofRail = `<section id="homeProofRail" style="margin:26px 0 0">
  <div class="grid phone-stack" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px">
    <div id="homeLiveSales" class="card" style="background:linear-gradient(135deg,rgba(0,255,163,.06),rgba(0,212,255,.06));border:1px solid rgba(0,255,163,.30);padding:18px" data-home-live-sales>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <span class="kicker" style="color:#00ffa3">⚡ Live on-chain settlements</span>
        <span style="font-size:11px;color:var(--ink-dim)">Verifiable on <a href="https://mempool.space" target="_blank" rel="noopener" style="color:#00ffa3">mempool.space</a></span>
      </div>
      <div id="homeLiveSalesBody" style="margin-top:10px;font-family:var(--mono);font-size:12.5px;line-height:1.7;color:var(--ink-dim)">Live paid orders load here — every entry is a verifiable BTC settlement to the owner wallet.</div>
    </div>
    <div id="homeBtcDiscount" class="card" style="padding:18px;background:linear-gradient(135deg,rgba(247,147,26,.14),rgba(255,211,106,.08));border:1px solid rgba(247,147,26,.45);display:flex;flex-direction:column;justify-content:center;gap:8px">
      <span class="kicker" style="color:#f7931a">₿ Native Bitcoin pricing</span>
      <h3 style="margin:0;font-size:22px;line-height:1.2">Pay in BTC → <span class="grad">save 10%</span></h3>
      <p style="margin:0;color:var(--ink-dim);font-size:13px">Every catalog price already reflects the 10% BTC discount — instant, custodian-free, receipt signed Ed25519.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <a class="btn btn-primary" href="/services" data-link>Buy in BTC →</a>
        <a class="btn btn-ghost" href="/wizard" data-link>Find my plan</a>
      </div>
    </div>
  </div>
</section>`;
  // Hero quick-buy — pre-populated with top 6 catalog services (cheapest of
  // each) so a first-time visitor can jump straight from the hero to a BTC
  // invoice without touching the catalog. Hydrated by client.js.
  const _heroQuickPicks = _all
    .filter(p => Number(p.priceUSD || p.priceUsd || p.price || 0) > 0)
    .sort((a,b)=> (Number(a.priceUSD||a.priceUsd||a.price||0) - Number(b.priceUSD||b.priceUsd||b.price||0)))
    .slice(0, 6);
  const _heroQuickOpts = _heroQuickPicks.map(p => {
    const id = _esc(p.id || '');
    const title = _esc(p.title || p.id || 'Service');
    const price = Number(p.priceUSD || p.priceUsd || p.price || 0);
    const label = price > 0 ? (title + ' · $' + price.toLocaleString('en-US', { maximumFractionDigits: 2 })) : title;
    return `<option value="${id}">${label}</option>`;
  }).join('');
  const _heroQuickBuy = _heroQuickPicks.length ? `<form id="heroQuickBuy" data-hero-quick-buy class="card" style="margin:18px 0 0;padding:14px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:rgba(11,15,23,.55);border:1px solid var(--stroke)" onsubmit="return false">
      <span class="kicker" style="width:100%;margin-bottom:4px">30-second BTC checkout</span>
      <select id="heroQuickPick" aria-label="Pick a ZeusAI service" style="flex:2;min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:13.5px">${_heroQuickOpts}</select>
      <input id="heroQuickEmail" type="email" placeholder="you@company.com" autocomplete="email" aria-label="Email for activation" style="flex:2;min-width:180px;padding:10px 12px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:13.5px"/>
      <button type="button" class="btn btn-primary" id="heroQuickBuyBtn" data-hero-quick-buy-btn style="flex:1;min-width:180px;justify-content:center">Get BTC invoice →</button>
    </form>` : '';
  // ZACC — Zeus Autonomic Commerce Core banner. Shown right after the hero,
  // before any other section, so the world\u2019s first fully-autonomous economic
  // engine is impossible to miss from the homepage.
  const _zaccBanner = `<section id="homeZacc" style="margin:48px 0 0">
  <div class="card phone-stack" style="padding:36px;background:linear-gradient(135deg,rgba(138,92,255,.18),rgba(62,160,255,.10));border:1px solid rgba(138,92,255,.45);border-radius:18px;display:grid;grid-template-columns:1.4fr 1fr;gap:32px;align-items:center">
    <div>
      <span class="hero-eyebrow" style="background:linear-gradient(135deg,#8a5cff,#3ea0ff);color:#05060e;font-weight:800;padding:5px 12px;border-radius:999px;font-size:11px;letter-spacing:.1em">\u26a1 NEW \u00b7 WORLD-FIRST</span>
      <h2 style="margin:14px 0 6px;font-size:clamp(26px,3vw,40px);line-height:1.1">Zeus Autonomic Commerce <span class="grad">\u2014 the first fully-autonomous economic engine</span></h2>
      <p style="color:var(--ink-dim);font-size:15px;margin:0 0 18px;line-height:1.55">Sources products from a seed catalogue plus live marketplace APIs when provider keys are configured. Synthesises ideas, prices them, sells in BTC (confirmed on-chain via mempool.space), and heals itself. Orders route to CJ Dropshipping automatically when configured; otherwise queued for manual fulfilment.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn btn-primary" href="/zacc" data-link>\u26a1 Open Autonomous Commerce \u2192</a>
        <button type="button" class="btn" data-live-inspect="/api/zacc/public" data-live-title="Inspect live snapshot" style="margin-top:8px">Inspect live snapshot</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
      <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:14px"><div style="font-size:11px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.08em">9 components</div><div style="font-size:18px;font-weight:700;margin-top:4px">All autonomous</div></div>
      <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:14px"><div style="font-size:11px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.08em">21 sources</div><div style="font-size:18px;font-weight:700;margin-top:4px">Market scanner</div></div>
      <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:14px"><div style="font-size:11px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.08em">BTC \u00b7 on-chain</div><div style="font-size:18px;font-weight:700;margin-top:4px">Verified payouts</div></div>
      <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:14px"><div style="font-size:11px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.08em">Persistent</div><div style="font-size:18px;font-weight:700;margin-top:4px">Self-learning</div></div>
    </div>
  </div>
</section>`;
  return `<section class="hero">
  <div class="zeus-scene" aria-hidden="true">
    <picture><source type="image/avif" srcset="${assetPath('/assets/zeus/hero-640.avif')} 640w, ${assetPath('/assets/zeus/hero.avif')} 800w" sizes="100vw"/><source type="image/webp" srcset="${assetPath('/assets/zeus/hero-640.webp')} 640w, ${assetPath('/assets/zeus/hero.webp')} 800w" sizes="100vw"/><img id="zeusHeroImg" class="zeus-hero-image" src="${assetPath('/assets/zeus/hero-640.jpg')}" srcset="${assetPath('/assets/zeus/hero-640.jpg')} 640w, ${assetPath('/assets/zeus/hero.jpg')} 800w" sizes="100vw" data-zeus-src="${assetPath('/assets/zeus/hero.jpg')}" alt="" width="1600" height="900" decoding="async" fetchpriority="high" loading="eager" onerror="this.onerror=null;this.src='${assetPath('/assets/zeus/placeholder.svg')}'"/></picture>
    <div class="zeus-halo zeus-halo-a"></div>
    <div class="zeus-halo zeus-halo-b"></div>
    <div class="zeus-stars"></div>
    <div class="zeus-vignette"></div>
  </div>
  <div class="hero-fx" aria-hidden="true">
    <div class="fx-orb fx-orb-a"></div>
    <div class="fx-orb fx-orb-b"></div>
    <div class="fx-orb fx-orb-c"></div>
    <div class="fx-grid"></div>
    <div class="fx-scan"></div>
  </div>
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="hero-eyebrow"><span class="dot"></span> ₿ Native Bitcoin · save 10% · instant delivery</span>
      <h1><span class="hero-brand">ZeusAI</span> <span class="grad">Ship AI products at machine speed.</span></h1>
      <p class="lead">Live autonomous AI commerce platform: ZeusAI turns modules, verticals and marketplaces into buyable AI services with direct BTC checkout, signed receipts and instant delivery.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/buy" data-link>Buy what we deliver →</a>
        <a class="btn btn-ghost" href="/services" data-link>Full marketplace</a>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:13.5px;color:var(--ink-dim)">
        <a href="/wizard" data-link style="color:var(--violet2)">Not sure what to buy? → 30-second plan finder</a>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:var(--ink-dim)">
        <a href="/status" data-link style="color:var(--violet2)">Autonomy OS</a>
        <a href="/pricing" data-link style="color:var(--violet2)">Transparent pricing</a>
        <a href="/trust" data-link style="color:var(--violet2)">Trust center</a>
      </div>
      ${_heroQuickBuy}
      <div class="hero-stats" id="heroStats" style="margin-top:14px">
        <div class="hero-stat"><b>Signed receipts</b><span>Every order verifiable</span></div>
        <div class="hero-stat"><b>&lt; 60s checkout</b><span>BTC direct owner wallet</span></div>
        <div class="hero-stat"><b>Live pricing</b><span>Server-validated at pay time</span></div>
        <div class="hero-stat"><b>Refund contract</b><span>Public guarantee page</span></div>
      </div>
      <div class="hero-stats" style="margin-top:14px">
        <div class="hero-stat"><b id="statModules">169</b><span>Modules</span></div>
        <div class="hero-stat"><b id="statVerticals">18</b><span>Verticals</span></div>
        <div class="hero-stat"><b id="statMarkets">41</b><span>Marketplaces</span></div>
        <div class="hero-stat"><b id="statBtcSave">10%</b><span>BTC discount</span></div>
        <div class="hero-stat"><b id="statTaos">—</b><span>Autonomy</span></div>
      </div>
    </div>
    <aside class="hero-side hero-vision" aria-label="Building the future">
      <div class="hero-vision-frame">
        <span class="hero-vision-beam" aria-hidden="true"></span>
        <p class="hero-vision-kicker">Future in motion</p>
        <p class="hero-vision-title">Building the AI feature</p>
        <p class="hero-vision-sub">We build the future — Construim viitorul.</p>
        <p class="hero-vision-line">Autonomous software that invents, ships, and sells itself.</p>
      </div>
    </aside>
  </div>
</section>

${sellSurface.homeBuyStripHtml(_all.length)}

${merchantStandardSurface.homeStripHtml()}

${_featuredHtml}

${_homeProofRail}

${_zaccBanner}

<section id="commerceProof">
  <div class="section-title">
    <div><span class="kicker">Live commerce proof</span><h2>Everything we ship is <span class="grad">wired into the site.</span></h2></div>
    <p>Not just hidden APIs: the catalogue, BTC/BTCPay-ready checkout, automatic delivery, the customer portal and the admin cockpit are all visible and testable directly from the interface.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:14px">
    <div class="card" style="border-color:rgba(255,211,106,.42)">
      <span class="tag" style="background:rgba(255,211,106,.15);color:var(--gold)">Master Catalog</span>
      <h3 id="commerceProofCatalog">${_all.length} live products</h3>
      <p>Strategic services + Frontier + Vertical OS + AI modules. Deterministic fallback keeps CI/live smoke above 25.</p>
      <a class="btn btn-primary" href="/services" data-link>Open catalog →</a>
    </div>
    <div class="card" style="border-color:rgba(247,147,26,.45)">
      <span class="tag" style="background:rgba(247,147,26,.15);color:#f7931a">BTC / BTCPay</span>
      <h3 id="commerceProofBtcProvider">Checking payment rail…</h3>
      <p id="commerceProofPaymentCopy">BTC direct is primary. Card/Stripe, PayPal and global crypto appear only when configured live.</p>
      <a class="btn btn-primary" href="/checkout/?plan=adaptive-ai" data-link>Test checkout →</a>
    </div>
    <div class="card" style="border-color:rgba(110,231,183,.42)">
      <span class="tag" style="background:rgba(110,231,183,.16);color:#6ee7b7">Delivery Registry</span>
      <h3 id="commerceProofDelivery">serviceId → deliver()</h3>
      <p>Paid orders generate real deliverables: API key, workspace, task, webhook secret, report, onboarding and license.</p>
      <a class="btn btn-ghost" href="/docs" data-link>See API docs →</a>
    </div>
    <div class="card" style="border-color:rgba(138,92,255,.42)">
      <span class="tag" style="background:rgba(138,92,255,.16);color:var(--violet2)">Customer Portal</span>
      <h3>Orders · licenses · downloads</h3>
      <p>Email account access for orders, active services, API keys, pending payments, invoices and deliverable downloads.</p>
      <a class="btn btn-primary" href="/account" data-link>Open portal →</a>
    </div>
    <div class="card" style="border-color:rgba(255,120,160,.42)">
      <span class="tag" style="background:rgba(255,120,160,.16);color:#ff9cbe">Admin Commerce</span>
      <h3 id="commerceProofAdmin">Refund protected</h3>
      <p>Admin endpoints cover receipts, paid/unpaid, manual confirm, refund, resend license and retry delivery.</p>
      <a class="btn btn-ghost" href="/admin" data-link>Admin login →</a>
    </div>
    <div class="card" style="border-color:rgba(62,160,255,.42)">
      <span class="tag" style="background:rgba(62,160,255,.16);color:#6fd3ff">Live Smoke</span>
      <h3 id="commerceProofSmoke">EXPECTED_MIN_CATALOG_ITEMS=25</h3>
      <p>Post-deploy smoke validates catalog, checkout, confirmation, license, delivery, refund protection and cleanup.</p>
      <button type="button" class="btn" data-live-inspect="/health" data-live-title="Inspect health" style="margin-top:8px">Inspect health</button>
    </div>
  </div>
</section>

<section id="finalLive">
  <div class="section-title">
    <div><span class="kicker">Final upgrade</span><h2>ZeusAI Final mode is <span class="grad">live now.</span></h2></div>
    <p>This section proves runtime integration in production: service sync, user services and real-time event stream.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    <div class="card"><span class="tag">Services sync</span><h3 id="fuServices">—</h3><p>Source: <code class="inline">/api/services/list</code></p></div>
    <div class="card"><span class="tag">Realtime stream</span><h3 id="fuEvents">Connecting…</h3><p>Source: <code class="inline">/api/unicorn/events</code></p></div>
    <div class="card"><span class="tag">User services</span><h3 id="fuUser">—</h3><p>Source: <code class="inline">/api/user/services</code></p></div>
    <div class="card"><span class="tag">AI registry</span><h3 id="fuAiCount">—</h3><p>Source: <code class="inline">/api/ai/registry</code></p></div>
    <div class="card"><span class="tag">AI auto-router</span><h3 id="fuAiMode">Analyzing…</h3><p>Source: <code class="inline">/api/ai/use</code></p></div>
    <div class="card"><span class="tag">Post-quantum security</span><h3 id="fuPq">Checking…</h3><p>Source: <code class="inline">/api/security/pq/status</code></p></div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Quick buy test (live)</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Creates a real order through <code class="inline">/api/services/buy</code>.</p>
    <div class="pl-row">
      <select id="fuService" aria-label="Select service to test-buy"><option value="adaptive-ai">adaptive-ai</option></select>
      <input id="fuEmail" type="email" placeholder="you@company.com" aria-label="Email address for test order" />
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuBuyBtn">Create live order</button></div>
    <div class="pl-output" id="fuOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">AI Gateway test (live)</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Routes your request to the best AI automatically via <code class="inline">/api/ai/use</code>.</p>
    <div class="pl-row">
      <input id="fuAiPrompt" placeholder="Summarize a go-to-market strategy for a new AI service" aria-label="AI gateway prompt" />
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuAiBtn">Run AI gateway</button></div>
    <div class="pl-output" id="fuAiOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">ZeusAI Control Tower</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Live sync quality across site ↔ ZeusAI backend.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Latency</span><h3 id="fuLatency">Measuring…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Sync drift</span><h3 id="fuDrift">Measuring…</h3></div>
    </div>
    <div class="pl-output" id="fuEventLog" style="margin-top:10px;max-height:180px;overflow:auto">Waiting for live events…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">30-Year Standard Capsule</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Future-proof manifest for portability, compatibility and resilience.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Readiness score</span><h3 id="fuFutureScore">Calculating…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Manifest API</span><h3><code class="inline">/api/future/standard</code></h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuFutureBtn">Download future manifest</button></div>
    <div class="pl-output" id="fuFutureOut">Ready.</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Autonomous Evolution Loop</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Self-optimization with guardrails, bandit strategy and instant rollback readiness.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Optimization score</span><h3 id="fuOptScore">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Rollback readiness</span><h3 id="fuRollback">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Strategy split</span><h3 id="fuStrategy">—</h3></div>
    </div>
    <div class="pl-output" id="fuLoopOut" style="margin-top:10px">Waiting for loop snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Trust & Transparency Ledger</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Unified proof layer for integrity signatures, receipt auditability and owner revenue routing.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Integrity score</span><h3 id="fuTrustSig">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Paid receipts</span><h3 id="fuTrustReceipts">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Revenue proof</span><h3 id="fuRevTotal">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Payout channels</span><h3 id="fuRevMethods">—</h3></div>
    </div>
    <div class="pl-output" id="fuTrustOut" style="margin-top:10px">Waiting for trust snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Resilience Drill Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Live failover drill to validate recovery posture and rollback speed.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Drill score</span><h3 id="fuDrillScore">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Avg recovery</span><h3 id="fuDrillRecovery">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Total runs</span><h3 id="fuDrillRuns">—</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuDrillBtn">Run drill now</button></div>
    <div class="pl-output" id="fuDrillOut">Waiting for resilience snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Cinematic Auto-Tune</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Reglează efectele vizuale automat, în funcție de performanța curentă.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Profile</span><h3 id="fuTuneMode">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Intensity</span><h3 id="fuTuneIntensity">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Motion</span><h3 id="fuTuneMotion">—</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuTuneBtn">Apply live profile</button></div>
    <div class="pl-output" id="fuTuneOut">Waiting for auto-tune profile…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Performance Governance Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">p95/p99 latency guardrails with adaptive cinematic downgrade policy.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">API latency</span><h3 id="fuPerfP95">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Render latency</span><h3 id="fuPerfP99">—</h3></div>
      <div class="card" style="margin:0"><span class="tag">Mode</span><h3 id="fuPerfMode">—</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuPerfBtn">Refresh governance</button></div>
    <div class="pl-output" id="fuPerfOut">Waiting for performance governance snapshot…</div>
  </div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Why ZeusAI</span><h2>Six pillars. <span class="grad">Zero dependencies on middlemen.</span></h2></div>
    <p>Each pillar is a production subsystem running on Hetzner, verified by Merkle chains and W3C DIDs. Together they compose the first truly sovereign AI platform.</p>
  </div>
  <div class="panels" id="pillarPanels">
    <div class="panel pillar" data-pillar="autonomy" tabindex="0" role="button" aria-label="Open Zeus Orchestrator live view"><div class="ic">⚡</div><h3 class="pillar-title">Zeus Orchestrator</h3><p>Autonomy chain (PCMC) + capability tokens (CBAT). Every decision append-only, every action capability-bound.</p><span class="pillar-cta">Open live chain →</span></div>
    <div class="panel pillar" data-pillar="quarantine" tabindex="0" role="button" aria-label="Open Quarantine Buffer live view"><div class="ic">🛡️</div><h3 class="pillar-title">Quarantine Buffer</h3><p>Quantum Integrity Shield isolates suspect modules before they touch the core. Safe‑code‑writer enforces review gates.</p><span class="pillar-cta">Open live quarantine →</span></div>
    <div class="panel pillar" data-pillar="did" tabindex="0" role="button" aria-label="Open Self-Sovereign DIDs live view"><div class="ic">🪪</div><h3 class="pillar-title">Self‑Sovereign DIDs</h3><p>Ed25519 identities per module. Every receipt, every invoice, every module action is independently verifiable.</p><span class="pillar-cta">Resolve & verify →</span></div>
    <div class="panel pillar" data-pillar="outcome" tabindex="0" role="button" aria-label="Open Outcome Economics live view"><div class="ic">💎</div><h3 class="pillar-title">Outcome Economics</h3><p>Value‑Proof Ledger meters delivered value in $. Auto‑invoices a share. Owner keeps sovereignty through direct BTC settlement.</p><span class="pillar-cta">Record outcome →</span></div>
    <div class="panel pillar" data-pillar="giants" tabindex="0" role="button" aria-label="Open Giant Integration Fabric live view"><div class="ic">🌐</div><h3 class="pillar-title">Giant Integration Fabric</h3><p>42 hyperscaler / enterprise adapters (AWS, Azure, GCP, SF, SAP, SNOW, OpenAI, NVIDIA…). In-memory orchestration — live dispatch requires provider API keys.</p><span class="pillar-cta">Open local orchestrator →</span></div>
    <div class="panel pillar" data-pillar="monetize" tabindex="0" role="button" aria-label="Open Global Monetization Mesh live view"><div class="ic">🚀</div><h3 class="pillar-title">Global Monetization Mesh</h3><p>41 marketplace adapters, multi‑armed bandit pricing. In-memory listing planner — live publish requires marketplace API keys.</p><span class="pillar-cta">Open listing planner →</span></div></div>
  <div id="pillarLive" class="pillar-live" aria-live="polite"></div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Live from the fabric</span><h2>Top services, <span class="grad">streaming from ZeusAI.</span></h2></div>
    <p>Pulled in real time from <code class="inline">/api/services</code>. When ZeusAI adds or reprices a service, this section updates automatically.</p>
  </div>
  ${(function(){
    // SSR-render 8 hero cards immediately so visitors NEVER see a "Loading…"
    // placeholder on the home page. Hydration in client.js will replace this
    // grid with the live master catalogue once /api/catalog/master returns,
    // but the first paint already shows real products with real BTC prices.
    try {
      const all = _loadCatalog() || [];
      // Heuristic mix: take some strategic, some frontier, some vertical,
      // some marketplace — cheapest of each so users immediately see a
      // buyable price range. Falls back to first 8 of any group.
      const byGroup = (g, n) => all
        .filter(p => (p.group === g || p.category === g) && Number(p.priceUSD || p.priceUsd || p.price || 0) > 0)
        .sort((a,b) => Number(a.priceUSD||a.priceUsd||a.price||0) - Number(b.priceUSD||b.priceUsd||b.price||0))
        .slice(0, n);
      let picks = [
        ...byGroup('strategic', 2),
        ...byGroup('frontier', 2),
        ...byGroup('vertical', 2),
        ...byGroup('marketplace', 2),
      ];
      if (picks.length < 6) picks = all.filter(p => Number(p.priceUSD||p.priceUsd||p.price||0) > 0).slice(0, 8);
      if (!picks.length) {
        return `<div class="grid" id="liveServices"><div class="card"><p style="margin:0;color:var(--ink-dim)">Catalog refreshing — open <a href="/services" data-link style="color:var(--violet2)">/services</a> for the marketplace.</p></div></div>`;
      }
      const cards = picks.map(_catalogCard).join('');
      return `<div class="grid" id="liveServices" style="grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:16px">${cards}</div>`;
    } catch (e) {
      return `<div class="grid" id="liveServices"><div class="card"><p style="margin:0;color:var(--ink-dim)">Catalog refreshing — open <a href="/services" data-link style="color:var(--violet2)">/services</a> for the marketplace.</p></div></div>`;
    }
  })()}
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Verticals</span><h2>Eighteen industries. <span class="grad">One sovereign brain.</span></h2></div>
    <p>From finance to pharma, ZeusAI offers vertical architecture packs — engagement kickoff with compliance, pricing, and marketplace lineage. Not a finished OS shipped on payment.</p>
  </div>
  <div class="grid" id="verticals"></div>
</section>`;
}

function pageServices() {
  const catalog = _loadCatalog();
  const counts = catalog.reduce((acc, p) => { const t = String(p.tier || 'professional'); acc[t] = (acc[t] || 0) + 1; return acc; }, {});
  const summary = `${catalog.length} live products · ${counts.instant || 0} instant · ${counts.professional || 0} professional · ${counts.enterprise || 0} enterprise`;
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Marketplace · Master Catalog · ${_esc(summary)}</span><h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Every ZeusAI deliverable, <span class="grad">one sovereign storefront.</span></h1></div>
    <p>Strategic services + Frontier inventions + Vertical OSes + Adaptive AI modules — all live from the ZeusAI fabric. Buy any item directly in BTC. Receipt is Ed25519-signed and revenue routes 100% to the owner wallet.</p>
  </div>
  <div id="servicesStickySummary" class="card" style="position:sticky;top:88px;z-index:4;margin:12px 0 18px;padding:12px 14px;background:rgba(11,15,23,.88);backdrop-filter:blur(8px);border:1px solid var(--stroke);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div style="font-size:13px;color:var(--ink-dim)">Live catalog synced from server pricing. Final amount is revalidated before payment.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/wizard" data-link>Find my plan →</a>
      <a class="btn btn-ghost" href="/checkout/?plan=custom" data-link title="Skip catalog and open a manual BTC invoice for a custom amount">Custom order</a>
    </div>
  </div>
  <div class="card" style="margin:16px 0 22px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(127,90,240,.10));border:1px solid rgba(247,147,26,.45)">
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
      <div style="flex:1;min-width:280px">
        <span class="kicker">₿ Native Bitcoin commerce · zero custodian</span>
        <h3 style="margin:8px 0;font-size:22px">Pay any service direct in BTC. <span id="catBtcSpot" style="color:var(--gold);font-family:var(--mono);font-size:14px">—</span></h3>
        <p style="color:var(--ink-dim);margin:0;font-size:14px">Owner wallet routes 100% of revenue. Each invoice generates an Ed25519 receipt + on-chain proof via mempool.space.</p>
        <div class="btc-addr" id="svcHeroBtcAddr" data-copy="${OWNER.btc}" title="Click to copy the full owner wallet address">${_esc(String(OWNER.btc).slice(0,10) + '…' + String(OWNER.btc).slice(-8))}</div>
        <p style="color:var(--ink-dim);margin:6px 0 0;font-size:11.5px;font-style:italic">Revenue destination — use checkout for a unique per-order invoice.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:200px">
        <div id="catCounts" style="font-size:12px;color:var(--ink-dim);text-align:right;font-family:var(--mono)">${_esc(summary)}</div>
        <a class="btn btn-primary" href="/wizard" data-link>Find my plan →</a>
      </div>
    </div>
  </div>
  <section id="catWhatYouReceive" class="card" style="margin:0 0 18px;padding:18px">
    <span class="kicker">What you receive</span>
    <h3 style="margin:6px 0 12px;font-size:20px">Every purchase ships a concrete artefact — not a promise.</h3>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
      <div class="card" style="margin:0;padding:14px"><span class="tag">Website Audit</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">HTML report</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Signed audit with performance, accessibility, SEO and conversion notes — delivered as a single self-contained HTML file.</p></div>
      <div class="card" style="margin:0;padding:14px"><span class="tag">Logo Kit</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">SVG + palette</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Vector logo, monochrome variants and a documented color palette. Import-ready in Figma, Illustrator, or any browser.</p></div>
      <div class="card" style="margin:0;padding:14px"><span class="tag">SEO Pack</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">Articles + brief</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Editorial-quality articles targeting your chosen keywords plus a linking + on-page brief. Markdown + HTML both included.</p></div>
    </div>
  </section>
  <div class="filters" id="catFilters" role="tablist" aria-label="Filter services by tier">
    <button class="chip on" data-group="all" type="button">All (${catalog.length})</button>
    <button class="chip" data-group="instant" type="button">⚡ Instant (${counts.instant || 0})</button>
    <button class="chip" data-group="professional" type="button">💼 Professional (${counts.professional || 0})</button>
    <button class="chip" data-group="enterprise" type="button">👑 Enterprise (${counts.enterprise || 0})</button>
    <a class="chip" href="/wizard" data-link style="text-decoration:none">🧭 Find my plan →</a>
  </div>
  <section id="autonomousLiveSection" style="margin:20px 0 30px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <h3 style="margin:0;font-size:20px;letter-spacing:-0.01em">⚡ Live from Unicorn fabric <small style="color:var(--ink-dim);font-size:12px;font-weight:400">— rendered server-side, refreshed live</small></h3>
      <span id="autonomousStatus" style="font-size:11px;color:var(--ink-dim);font-family:var(--mono)">${catalog.length} products SSR · hydrating…</span>
    </div>
    ${_ssrCatalogGrid(catalog, { gridId: 'catalogGrid', minCol: 300 })}
  </section>
  <section id="unicornModulesMirror" aria-label="Live Unicorn modules" style="margin:28px 0 10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <h3 style="margin:0;font-size:20px;letter-spacing:-0.01em">🧬 Live Unicorn modules <small style="color:var(--ink-dim);font-size:12px;font-weight:400">— operational mirror from backend (not the buyable 25-SKU catalog)</small></h3>
      <span id="autonomousModulesHint" style="font-size:11px;color:var(--ink-dim);font-family:var(--mono)">connecting to Unicorn modules…</span>
    </div>
    <div id="autonomousServicesGrid" class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px"></div>
  </section>
</section>`;
}

function pageService(id) {
  // SSR the full product card on the first paint (no "Loading…" stub).
  // We look up the service in the unified catalog / serviceMarketplace with
  // live-priced enrichment already baked in by _loadCatalog(). If the id is
  // not in the catalog (e.g. one of the many marketplace-only modules), we
  // still SSR a real card sourced from the module registry so the URL is
  // never a dead placeholder. The v2 client-side hydration (hydratePage in
  // client.js) still runs on top and refreshes the price / narrative UI.
  //
  // RO: prima pictura contine deja detaliile produsului — fara "Loading…".
  const safeId = String(id || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120);
  if (!safeId) return `<section style="padding-top:140px"><div class="card"><p>Missing service id.</p><a class="btn" href="/services" data-link>Back to marketplace</a></div></section>`;

  let s = null;
  try {
    const catalog = _loadCatalog() || [];
    s = catalog.find((p) => String(p.id) === safeId) || null;
  } catch (_) { s = null; }
  if (!s) {
    // Fallback: pull straight from the module registry if the id isn't
    // in the canonical unified catalog. Keeps every module URL alive.
    try {
      const marketplace = require('../../../backend/modules/serviceMarketplace');
      if (marketplace && typeof marketplace.getService === 'function') {
        const m = marketplace.getService(safeId);
        if (m) {
          s = {
            id: String(m.id || safeId),
            title: String(m.name || safeId),
            description: String(m.description || ''),
            priceUSD: Number(m.price || m.basePrice || 0),
            category: String(m.category || 'core'),
            tier: 'professional',
          };
        }
      }
    } catch (_) { /* module not loadable in split-process mode */ }
  }

  if (!s) {
    return `<section style="padding-top:140px" id="servicePage" data-id="${_esc(safeId)}">
  <div id="serviceMain"><div class="card" style="max-width:640px;margin:24px auto"><h1 style="margin:0 0 10px">Service not found</h1><p style="color:var(--ink-dim)">The id <code>${_esc(safeId)}</code> is not in the live catalog. Browse the marketplace to find a matching product.</p><a class="btn btn-primary" href="/services" data-link style="margin-top:14px">← All services</a></div></div>
</section>`;
  }

  const title = String(s.title || s.name || s.id);
  const desc = String(s.description || 'Core ZeusAI service delivering measurable, signed outcomes across the platform.');
  const price = Number(s.priceUSD != null ? s.priceUSD : (s.priceUsd != null ? s.priceUsd : (s.price != null ? s.price : 0))) || 0;
  const hasFrac = Math.abs(price - Math.round(price)) > 0.0049;
  const priceTxt = price > 0
    ? ('$' + price.toLocaleString('en-US', { minimumFractionDigits: hasFrac ? 2 : 0, maximumFractionDigits: 2 }))
    : 'Custom';
  const priceBtcNum = Number(s.priceBtc || 0) || _toBtc(price);
  const btcTxt = priceBtcNum > 0 ? ('≈ ' + priceBtcNum.toFixed(8) + ' BTC') : '';
  const liveBadge = s.livePriceSource && s.livePriceSource !== 'static-fallback'
    ? `<span class="tag" title="Live AI-negotiated price · source=${_esc(s.livePriceSource)}" style="background:rgba(127,255,212,.12);color:#7fffd4;border:1px solid rgba(127,255,212,.35);font-size:10px;margin-left:6px">⚡ live</span>`
    : '';
  const tierBadge = _tierBadge(s.tier || 'professional');
  const category = _esc(s.category || s.segment || 'core');
  const encId = encodeURIComponent(safeId);
  const canonical = OWNER.domain.replace(/\/$/, '') + '/services/' + encId;

  // JSON-LD Product markup so the URL is a real, indexable product page —
  // not a client-hydrated shell.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: desc.slice(0, 400),
    url: canonical,
    brand: { '@type': 'Brand', name: 'ZeusAI' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: price > 0 ? price.toFixed(2) : undefined,
      availability: 'https://schema.org/InStock',
      url: OWNER.domain.replace(/\/$/, '') + '/checkout/?plan=' + encId,
    },
  };

  return `<section style="padding-top:140px" id="servicePage" data-id="${_esc(safeId)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<div id="serviceMain">
  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:28px" class="svc-grid-ssr">
    <div class="svc-cine-card" data-tilt itemscope itemtype="https://schema.org/Product">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${tierBadge}<span class="kicker">${category}</span>${liveBadge}
      </div>
      <h1 style="font-size:clamp(34px,4vw,52px);margin:10px 0 20px;line-height:1.05" itemprop="name">${_esc(title)}</h1>
      <p style="color:var(--ink-dim);font-size:17px;line-height:1.7" itemprop="description">${_esc(desc)}</p>
      <div class="svc-delivery-timeline" id="svcDeliveryTimeline" style="margin:22px 0 6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        <div class="card" style="margin:0;padding:14px;border-color:rgba(247,147,26,.35)"><span class="tag" style="background:rgba(247,147,26,.16);color:#f7931a">Step 1</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">Pay BTC</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Scan the invoice QR or copy the BIP-21 URI. Direct on-chain — no custodian.</p></div>
        <div class="card" style="margin:0;padding:14px;border-color:rgba(127,255,212,.32)"><span class="tag" style="background:rgba(127,255,212,.12);color:#7fffd4">Step 2</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">Mempool confirm</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Server watches mempool.space every ~30s until your tx settles.</p></div>
        <div class="card" style="margin:0;padding:14px;border-color:rgba(110,231,183,.42)"><span class="tag" style="background:rgba(110,231,183,.2);color:#6ee7b7">Step 3</span><p class="card-title" style="margin:6px 0 4px;font-size:15px">Signed delivery</p><p style="margin:0;color:var(--ink-dim);font-size:12.5px">Ed25519 receipt + license + downloadable artefacts appear in your account.</p></div>
      </div>
      <div class="panels" style="margin-top:20px">
        <div class="panel"><div class="ic">✓</div><p class="card-title">Signed outcomes</p><p>Every run produces an Ed25519‑signed proof in the Value‑Proof Ledger.</p></div>
        <div class="panel"><div class="ic">🔌</div><p class="card-title">API first</p><p>REST + SSE. Integrates with all 42 giant connectors through the Integration Fabric.</p></div>
        <div class="panel"><div class="ic">💎</div><p class="card-title">Outcome pricing</p><p>Enterprise plans bill a share of measured value delivered.</p></div>
      </div>
    </div>
    <aside class="co-box" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
      <meta itemprop="priceCurrency" content="USD"/>
      <span class="kicker">Pricing</span>
      <h3 style="margin:6px 0 10px">${_esc(title)}</h3>
      <div class="price" id="svcLivePrice" data-pricing-value="${_esc(safeId)}" style="font-size:42px;font-weight:700;background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">
        <span itemprop="price" content="${price > 0 ? price.toFixed(2) : ''}">${priceTxt}</span>${(s.billing === 'monthly' || String(s.tier || '').toLowerCase() === 'enterprise') ? '<small style="font-size:14px;color:var(--ink-dim);-webkit-text-fill-color:var(--ink-dim)">/mo</small>' : ''}
      </div>
      <div id="svcLiveBtc" style="font-size:12px;color:var(--ink-dim);margin-top:4px">${btcTxt}</div>
      ${price > 0 ? '<div style="font-size:11.5px;color:#ffd36a;font-weight:600;margin-top:4px;letter-spacing:.2px">10% BTC discount applied</div>' : ''}
      ${(() => {
        const cta = _ctaForProduct(s);
        if (cta.mode === 'contact') {
          return `<p style="color:var(--ink-dim);font-size:13.5px">Enterprise engagements start with a signed SOW — not a self-serve cart. Request a proposal and our team responds with scope, milestones and settlement options.</p>
      <a class="btn btn-gold" id="svcBuyBtn" href="${_esc(cta.ctaHref || '/enterprise#enterprise-contact')}" data-link style="width:100%;justify-content:center;margin-top:10px">${_esc(cta.ctaLabel || 'Request proposal →')}</a>`;
        }
        if (cta.mode === 'reserve') {
          return `<p style="color:var(--ink-dim);font-size:13.5px">BTC reserve unlocks a signed kickoff pack immediately. The finished build is delivered by the ZeusAI team across stated milestones. Email is optional — you can add it on the payment page.</p>
      <label style="display:block;margin-top:10px;font-size:12px;color:var(--ink-dim)">Delivery email <span style="opacity:.7">(optional)</span>
        <input id="svcBuyEmail" type="email" autocomplete="email" data-checkout-email="1" placeholder="you@company.com (optional)" style="width:100%;margin-top:4px;padding:10px 12px;border-radius:8px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
      </label>
      <button type="button" class="btn btn-primary" id="svcBuyBtn" data-sovereign-buy="${_esc(safeId)}" data-buy-mode="reserve" style="width:100%;justify-content:center;margin-top:10px">₿ Reserve with BTC →</button>`;
        }
        return `<p style="color:var(--ink-dim);font-size:13.5px">Pay with BTC, receive a signed receipt and the digital deliverable for this SKU. Click Buy to open the BTC invoice instantly — email is optional.</p>
      <label style="display:block;margin-top:10px;font-size:12px;color:var(--ink-dim)">Delivery email <span style="opacity:.7">(optional)</span>
        <input id="svcBuyEmail" type="email" autocomplete="email" data-checkout-email="1" placeholder="you@company.com (optional)" style="width:100%;margin-top:4px;padding:10px 12px;border-radius:8px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink)"/>
      </label>
      <button type="button" class="btn btn-primary" id="svcBuyBtn" data-sovereign-buy="${_esc(safeId)}" data-buy-mode="btc" style="width:100%;justify-content:center;margin-top:10px">₿ Buy now → BTC checkout</button>`;
      })()}
      <div id="svcUpsell" data-upsell-anchor="${_esc(safeId)}" style="margin-top:12px"></div>
      <a class="btn" href="/services" data-link style="width:100%;justify-content:center;margin-top:8px">← All services</a>
      <link itemprop="availability" href="https://schema.org/InStock"/>
    </aside>
  </div>
</div>
</section>`;
}

function pagePricing() {
  // Subscription tiers — render the AI-negotiated live price if the
  // dynamic-pricing engine is loadable in this process (single-process
  // dev/CI mode). In split-process production (site:3001 + backend:3000),
  // the engine is on the backend so we fall back to the documented base
  // values here ($29/$99/$499) and let hydratePricingPage() in client.js
  // refresh them from /api/pricing/:id which proxies to the backend.
  const starter    = _liveTierPrice('starter', 29);
  const pro        = _liveTierPrice('pro', 99);
  const enterprise = _liveTierPrice('enterprise', 499);
  const liveTag = (info) => info.source !== 'static-fallback'
    ? `<span class="tag" title="Live AI-negotiated · demand=${Number(info.demandFactor||1).toFixed(2)}${info.surge ? ' · surge active' : ''}" style="background:rgba(127,255,212,.12);color:#7fffd4;border:1px solid rgba(127,255,212,.35);font-size:10px;margin-left:6px">⚡ live${info.surge ? ' · surge' : ''}</span>`
    : '';
  const fmt = (info) => {
    const n = Number(info.price);
    if (!Number.isFinite(n)) return '—';
    const hasFrac = Math.abs(n - Math.round(n)) > 0.0049;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: hasFrac ? 2 : 0, maximumFractionDigits: 2 });
  };
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Pricing · live AI-negotiated rates</span><h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Fair. Sovereign. <span class="grad">Outcome‑aligned.</span></h1></div>
    <p>Simple plans for teams. Prices below are computed live by the ZeusAI dynamic-pricing engine (demand × peak × per-tier variance × surge). For enterprise verticals, ZeusAI ships outcome‑based pricing — you pay a share of measured value delivered, auto‑invoiced via the Value‑Proof Ledger.</p>
  </div>
  <div class="card" style="margin:10px 0 16px;padding:12px 14px;font-size:13px;color:var(--ink-dim)">
    Prices are refreshed from live APIs and revalidated at checkout. Last sync: <span id="pricingLastSync" style="font-family:var(--mono)">pending…</span>
  </div>
  <div class="pricing">
    <div class="plan" data-pricing-plan="starter">
      <h3>Starter</h3>
      <div class="price" data-pricing-value="starter">${fmt(starter)}<small>/mo</small>${liveTag(starter)}</div>
      <p style="color:var(--ink-dim);margin:0">For founders & indie teams.</p>
      <ul>
        <li>10,000 API calls / month</li>
        <li>3 seats · all AI modules</li>
        <li id="pricingPaymentRail">Direct BTC checkout · optional rails only when configured</li>
        <li>14-day trial · community support</li>
      </ul>
      <a class="btn" data-plan-cta="starter" href="/checkout/?plan=starter" data-sovereign-buy="starter" data-buy-mode="btc">Get BTC invoice →</a>
    </div>
    <div class="plan highlight" data-pricing-plan="pro">
      <h3>Growth</h3>
      <div class="price" data-pricing-value="pro">${fmt(pro)}<small>/mo</small>${liveTag(pro)}</div>
      <p style="color:var(--ink-dim);margin:0">For scaling companies.</p>
      <ul>
        <li>120,000 API calls / month</li>
        <li>15 seats · all AI modules</li>
        <li>Quantum Blockchain · M&amp;A Advisor · Legal Contracts</li>
        <li>SSO, priority support · signed outcome reports</li>
      </ul>
      <a class="btn btn-primary" data-plan-cta="pro" href="/checkout/?plan=pro" data-sovereign-buy="pro" data-buy-mode="btc">Get BTC invoice →</a>
    </div>
    <div class="plan" data-pricing-plan="enterprise">
      <h3>Enterprise</h3>
      <div class="price" data-pricing-value="enterprise">${fmt(enterprise)}<small>/mo</small>${liveTag(enterprise)}</div>
      <p style="color:var(--ink-dim);margin:0">Outcome‑priced. Global.</p>
      <ul>
        <li>1.5M API calls / month · 100 seats</li>
        <li>All 18 verticals · 42 giants · 41 marketplaces</li>
        <li>Dedicated Zeus cluster · SLA 99.9%</li>
        <li>Value‑Proof Ledger (bps share)</li>
      </ul>
      <a class="btn btn-gold" data-plan-cta="enterprise" href="/enterprise#enterprise-contact" data-link>Request proposal →</a>
    </div>
  </div>
  <div id="pricingCatalogCrossLink" class="card" style="margin-top:20px;padding:18px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(138,92,255,.06));border:1px solid rgba(247,147,26,.35)">
    <div style="min-width:260px;flex:1">
      <span class="kicker">One-time deliverables</span>
      <h3 style="margin:6px 0 4px;font-size:20px">Prefer a one-shot BTC purchase?</h3>
      <p style="margin:0;color:var(--ink-dim);font-size:13.5px">Browse the one-time catalog — signed artefacts, no subscription, no card. 10% BTC discount already baked into every price.</p>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/services" data-link>Open one-time catalog →</a>
      <a class="btn btn-ghost" href="/wizard" data-link>Find my plan</a>
    </div>
  </div>
  <div class="card" style="margin-top:16px;padding:12px 14px">
    <b>Use-case playbooks:</b>
    <a href="/solutions/ai-pricing" data-link style="margin-left:8px">AI pricing engine</a> ·
    <a href="/solutions/ai-checkout" data-link>AI checkout optimizer</a> ·
    <a href="/solutions/ai-self-healing" data-link>AI self-healing ops</a>
  </div>
</section>`;
}

function pageCheckout(params) {
  // CONVERSION SSR (2026-06): when the buyer lands from a card click
  // (/checkout/?plan=adaptive-ai), the plan id AND its canonical live price
  // are already rendered server-side — the exact number from the card they
  // clicked. No "computing…", no price flicker, no mismatch. RO: prețul de
  // pe card e în HTML înainte de orice JS.
  const p = params || {};
  const ssrPlan = String(p.plan || 'starter').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || 'starter';
  const ssrUsd = (Number.isFinite(Number(p.planUsd)) && Number(p.planUsd) > 0) ? Number(p.planUsd) : null;
  const ssrAmountAttr = ssrUsd != null ? String(ssrUsd) : '';
  const ssrAmountSummary = ssrUsd != null ? ('$' + ssrUsd.toFixed(2)) : '—';
  // Buy Immortal OS: every checkout landing exposes one-click sovereign mint
  // as the primary CTA. The manual form remains as a secondary path.
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Checkout promise</span><h2>Pay direct in BTC. <span class="grad">Activation is automatic.</span></h2></div>
    <p>Every payment generates an Ed25519‑signed receipt appended to the Merkle chain. Keep this window open: ZeusAI watches settlement and unlocks delivery/license credentials automatically.</p>
  </div>
  <div id="checkoutBuying" class="card" style="margin:0 0 18px;padding:14px 18px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(138,92,255,.10));border:1px solid rgba(247,147,26,.35);display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between">
    <div style="min-width:220px">
      <span class="kicker">You are buying</span>
      <h3 style="margin:6px 0 2px;font-size:20px" id="checkoutBuyingPlan">${_esc(ssrPlan)}</h3>
      <p style="margin:0;color:var(--ink-dim);font-size:13px">Amount <b id="checkoutBuyingAmount" style="color:var(--gold)">${ssrAmountSummary}</b> · 10% BTC discount already applied.</p>
    </div>
    <button type="button" class="btn btn-primary" id="coSovereignPrimary" data-sovereign-buy="${_esc(ssrPlan)}" title="One-click signed BTC invoice — email optional on the payment page" style="min-width:240px">⚡ Get BTC invoice now</button>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:0 0 22px">
    <div class="card"><span class="tag">Step 1</span><h3>Get BTC invoice</h3><p style="color:var(--ink-dim)">One click opens a signed sats-exact invoice. Email is optional — add it on the payment page for delivery.</p></div>
    <div class="card"><span class="tag">Step 2</span><h3>Pay on-chain</h3><p id="checkoutPaymentRailCopy" style="color:var(--ink-dim)">Scan QR or open BIP-21 in any Bitcoin wallet. Exact amount identifies your order.</p></div>
    <div class="card"><span class="tag">Step 3</span><h3>Delivery / license</h3><p style="color:var(--ink-dim)">After settlement, receipt, license token and deliverable unlock automatically.</p></div>
  </div>
  <div class="checkout">
    <div class="co-box">
      <div class="co-method">
        <button class="chip on" data-method="btc">₿ Bitcoin</button>
      </div>
      <div id="coPanelBtc">
        <div class="phone-stack" style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
          <div>
            <div class="field"><label for="coAmount">Amount (USD)</label><input id="coAmount" type="number" min="1" step="1" value="${ssrAmountAttr}"/></div>
            <div class="field"><label for="coPlan">Plan / product</label><input id="coPlan" value="${ssrPlan}"/></div>
            <div class="field"><label for="coEmail">Email for delivery <span style="opacity:.7">(optional)</span></label><input id="coEmail" type="email" autocomplete="email" data-checkout-email="1" placeholder="you@company.com (optional)"/></div>
            <div class="field"><label for="coBtc">BTC quote</label><input id="coBtc" readonly value="computing…"/></div>
            <div class="btc-addr" id="btcAddr">${OWNER.btc}</div>
            <div id="coFxStrip" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
            <button class="btn btn-primary" id="coPay" style="margin-top:14px;width:100%;justify-content:center">Generate secure BTC invoice</button>
            <p id="coQuickHint" style="color:var(--ink-dim);font-size:12px;margin-top:8px">Prefer the gold button above for one-click sovereign invoice. This form also works — email is optional.</p>
          </div>
          <div class="co-qr"><canvas id="btcQr" width="320" height="320"></canvas></div>
        </div>
        <div id="coStatus"></div>
      </div>
      <div id="coPanelPaypal" style="display:none">
        <div class="field"><label for="coAmountPP">Amount (USD)</label><input id="coAmountPP" type="number" min="1" step="1" value=""/></div>
        <div class="field"><label for="coPlanPP">Plan / product</label><input id="coPlanPP" value="starter"/></div>
        <div class="field"><label for="coEmailPP">Email for activation</label><input id="coEmailPP" type="email" placeholder="you@company.com"/></div>
        <button class="btn btn-primary" id="coPayPP" style="width:100%;justify-content:center;margin-bottom:8px">Start PayPal payment →</button>
        <a class="btn btn-gold" id="coPaypal" style="width:100%;justify-content:center" target="_blank" rel="noopener">Or tip via paypal.me</a>
        <p id="paypalRailCopy" style="color:var(--ink-dim);font-size:13px;margin-top:14px">PayPal appears only when runtime credentials are configured. Current production checkout routes revenue directly to the BTC owner wallet.</p>
      </div>
    </div>
    <aside class="co-box">
      <h3 style="margin:0 0 8px">Order summary</h3>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Plan</span><b id="sumPlan" style="color:#fff">${ssrPlan}</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Amount</span><b id="sumAmount" style="color:#fff">${ssrAmountSummary}</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Owner</span><b style="color:#fff">${OWNER.name}</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0"><span>Receipt</span><b style="color:var(--ok)">Ed25519 signed</b></div>
      <p style="color:var(--ink-dim);font-size:12.5px;line-height:1.6;margin-top:14px">Every receipt is routed by <code class="inline">sovereignRevenueRouter</code>. On enterprise plans, a share of delivered value is auto‑invoiced via the Value‑Proof Ledger.</p>
    </aside>
  </div>
  <details id="checkoutFaq" class="card" style="margin:18px 0 0;padding:14px 18px">
    <summary style="cursor:pointer;font-weight:600;font-size:15px">What happens after I send BTC?</summary>
    <ol style="margin:12px 0 0;padding-left:20px;color:var(--ink-dim);font-size:13.5px;line-height:1.7">
      <li><b style="color:var(--ink)">Broadcast:</b> your wallet sends the exact BTC amount from the invoice directly to the ZeusAI owner wallet — no custodian.</li>
      <li><b style="color:var(--ink)">Mempool watch:</b> the server polls mempool.space every ~30s until your transaction is seen and reaches at least 1 confirmation.</li>
      <li><b style="color:var(--ink)">Signed receipt:</b> an Ed25519 receipt is appended to the autonomy chain the moment payment is observed.</li>
      <li><b style="color:var(--ink)">Delivery + license:</b> your entitlement token, license and downloadable artefacts are generated and become available on this page and in your account.</li>
      <li><b style="color:var(--ink)">Refund contract:</b> if delivery fails, the public <a href="/refund" data-link>refund guarantee</a> applies — no email chase required.</li>
    </ol>
  </details>
</section>`;
}

function pageSolution(kind) {
  const key = String(kind || '').toLowerCase();
  const cfg = {
    pricing: {
      kicker: 'AI pricing solution',
      title: 'Adaptive AI Pricing Engine',
      copy: 'Continuously re-prices your catalog from demand, competition and conversion telemetry. Every quote remains auditable and revalidated at checkout.',
      bullets: ['Real-time quote updates', 'Bandit-aware offer ranking', 'Signed quote history'],
      cta: '/pricing',
      ctaLabel: 'Open live pricing'
    },
    checkout: {
      kicker: 'AI checkout solution',
      title: 'AI Checkout Conversion Optimizer',
      copy: 'Improves payment completion with live quote confidence, route fallback and automatic recovery after pending payments.',
      bullets: ['Inline validation + trust copy', 'Payment rail fallback', 'Receipt + delivery auto-issue'],
      cta: '/checkout/?plan=starter',
      ctaLabel: 'Open optimized checkout'
    },
    'ai-self-healing': {
      kicker: 'AI reliability solution',
      title: 'AI Self-Healing Operations',
      copy: 'Tracks latency, error patterns and module health to auto-diagnose faults while keeping customer-facing flows stable.',
      bullets: ['SLO + route latency telemetry', 'Autonomous recovery playbooks', 'Operator-safe guardrails'],
      cta: '/observability',
      ctaLabel: 'Open observability'
    }
  }[key] || {
    kicker: 'AI solution',
    title: 'ZeusAI Solution',
    copy: 'Deploy an autonomous AI capability with signed outcomes and sovereign commerce.',
    bullets: ['Sovereign architecture', 'Signed receipts', 'Live AI governance'],
    cta: '/services',
    ctaLabel: 'Browse services'
  };

  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">${_esc(cfg.kicker)}</span><h1>${_esc(cfg.title)}</h1></div>
    <p>${_esc(cfg.copy)}</p>
  </div>
  <div class="card" style="padding:18px">
    <ul style="margin:0;padding-left:18px;line-height:1.8;color:var(--ink-dim)">${cfg.bullets.map((b) => `<li>${_esc(b)}</li>`).join('')}</ul>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
      <a class="btn btn-primary" href="${_esc(cfg.cta)}" data-link>${_esc(cfg.ctaLabel)} →</a>
      <a class="btn" href="/services" data-link>View marketplace</a>
    </div>
  </div>
</section>`;
}

function pageDashboard() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Dashboard</span><h1>My <span class="grad">ZeusAI</span></h1></div>
    <p>Live telemetry from your ZeusAI instance. All numbers sourced from the server — no mocks.</p>
  </div>
  <div class="co-box" id="passkeyBox" style="margin-bottom:22px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div><span class="kicker">Sovereign login</span><h3 style="margin:4px 0 0;font-size:18px">Sign in with a passkey — no passwords, ever.</h3><p style="color:var(--ink-dim);font-size:13.5px;margin:6px 0 0">WebAuthn (FIDO2). Private key never leaves your device. Signed DID binds your account to the ZeusAI autonomy chain.</p></div>
    <div style="display:flex;gap:10px;align-items:center">
      <input id="pkEmail" placeholder="you@company.com" style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-size:14px;font-family:inherit;min-width:220px"/>
      <button class="btn" id="pkLogin">Sign in</button>
      <button class="btn btn-primary" id="pkRegister">Create passkey</button>
    </div>
  </div>
  <div class="dash-grid" id="dashKpis"></div>
  <div class="co-box" style="margin:22px 0">
    <span class="kicker">Command Center</span>
    <h3 style="margin:6px 0 10px">Next best actions</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0 0 14px">Jump straight to the high-value live areas: checkout, platform health and innovation coverage.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/services" data-link>Buy AI Service</a>
      <a class="btn" href="/status" data-link>Live status</a>
      <a class="btn" href="/innovations" data-link>Innovation map</a>
    </div>
  </div>
  <div class="grid" id="dashServices"><div class="card"><p>Loading services…</p><p class="dash-offline" style="color:var(--ink-dim);font-size:12px;margin:8px 0 0">If this stays blank, open <a href="/services" data-link>Marketplace</a>.</p></div></div>
  <div class="section-title" style="margin-top:50px"><div><h2 style="font-size:24px">Recent receipts</h2></div></div>
  <div id="dashReceipts" class="card"><p>Loading receipts…</p></div>
  <div class="co-box" style="margin-top:22px">
    <span class="kicker">Affiliate program</span>
    <h3 style="margin:6px 0 10px">Your referral link · 10% signed split</h3>
    <p style="color:var(--ink-dim);font-size:13.5px;margin:0 0 10px">Every paid receipt attributed to your code is appended to the affiliate chain with an Ed25519 signature. Payouts are automatic on the 1st of each month.</p>
    <input id="affLink" readonly style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-family:ui-monospace,monospace;font-size:13px" onclick="this.select();document.execCommand&&document.execCommand('copy')"/>
  </div>
</section>`;
}

function pageHow() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">How it works</span><h2>Seven layers. <span class="grad">One clockwork.</span></h2></div>
    <p>ZeusAI is engineered like a Swiss tourbillon — every component locked by cryptography, every movement measurable.</p>
  </div>
  <div class="panels">
    <div class="panel"><div class="ic">1</div><h3 class="pillar-title">Zeus Core</h3><p>Deterministic decision engine. Schedules every action through capability tokens (CBAT).</p></div>
    <div class="panel"><div class="ic">2</div><h3 class="pillar-title">Autonomy Chain</h3><p>PCMC — Merkle chain of every decision. Tamper‑evident, verifiable at <code class="inline">/api/autonomy/verify</code>.</p></div>
    <div class="panel"><div class="ic">3</div><h3 class="pillar-title">Module Mesh</h3><p>169 living modules. 144 legacy stubs were retired; adaptive/engine pools materialize workers on demand.</p></div>
    <div class="panel"><div class="ic">4</div><h3 class="pillar-title">Quarantine Shield</h3><p>Isolates suspect behavior. No auto‑restart loops. Safe‑code‑writer gates every change.</p></div>
    <div class="panel"><div class="ic">5</div><h3 class="pillar-title">Revenue Router</h3><p>Every $ is Ed25519‑signed and routed to the owner's BTC. Zero custodians.</p></div>
    <div class="panel"><div class="ic">6</div><h3 class="pillar-title">Value‑Proof Ledger</h3><p>Every outcome is measured in $. Auto‑invoice (bps share) on proven value.</p></div>
    <div class="panel"><div class="ic">7</div><h3 class="pillar-title">Monetization Mesh</h3><p>41 marketplace adapters, multi‑armed bandit pricing. In-memory listing planner — live publish requires marketplace API keys.</p></div>
  </div>
</section>

<section>
  <div class="section-title"><div><h2 style="font-size:28px">The clockwork flow</h2></div></div>
  <pre class="code">request  →  Zeus Core  →  capability token (CBAT)  →  Module
                                 ↓
                          Merkle chain (PCMC)
                                 ↓
                          Outcome measured (USD Δ)
                                 ↓
                 Value‑Proof Ledger  →  auto‑invoice (bps)
                                 ↓
                 Revenue Router (Ed25519)  →  BTC / PayPal
                                 ↓
                       Marketplace Mesh  →  572M reach</pre>
</section>`;
}

function pageDocs() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">API &amp; Docs</span><h1>Talk to <span class="grad">ZeusAI.</span></h1></div>
    <p>All endpoints live on the same server that rendered this page. Everything is JSON. Auth where required is capability token (CBAT) — issued per action.</p>
  </div>
  <table class="doc">
    <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
    <tbody>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/health</code></td><td>Liveness</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/snapshot</code></td><td>Full snapshot of modules/verticals/telemetry</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/stream</code></td><td>SSE stream of snapshots (5s)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/unicorn/events</code></td><td>Realtime ZeusAI events stream (SSE)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services</code></td><td>Live service catalogue (marketplace + verticals)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services/list</code></td><td>Catalogue alias for API clients</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/services/:id</code></td><td>Service detail</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/services/buy</code></td><td>Unified buy flow (BTC / PayPal)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/user/services</code></td><td>User active/purchased services</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/checkout/btc</code></td><td>Create BTC invoice + signed receipt</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/checkout/paypal</code></td><td>Create PayPal link + signed receipt</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/payments/btc/confirm</code></td><td>Confirm BTC payment settlement</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/payments/paypal/confirm</code></td><td>Confirm PayPal capture/settlement</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/delivery/:receiptId</code></td><td>Delivery registry package: API key, workspace, report, onboarding, downloads</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/customer/me</code></td><td>Customer portal: orders, licenses, services, pending payments, deliverables</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/admin/commerce</code></td><td>Protected commerce cockpit: receipts, paid/unpaid, delivery state</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/admin/commerce/refund</code></td><td>Protected refund action for paid/pending receipts</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/security/pq/status</code></td><td>Post-quantum readiness + payment confirmation security mode</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/future/standard</code></td><td>30-year readiness manifest and architecture guarantees</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/evolution/loop</code></td><td>Autonomous optimization loop status + guardrails</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/trust/ledger</code></td><td>Integrity + receipt trust ledger snapshot</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/revenue/proof</code></td><td>Owner revenue proof (paid receipts + payout channels)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/resilience/drill</code></td><td>Resilience drill status and recovery metrics</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/resilience/drill/run</code></td><td>Trigger a live failover drill run</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/ui/autotune</code></td><td>Adaptive cinematic UI profile (performance-aware)</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/performance/governance</code></td><td>p95/p99 telemetry with adaptive cinematic downgrade policy</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/ai/registry</code></td><td>Live AI registry (current + future adapters)</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/ai/use</code></td><td>Unified AI gateway with automatic model selection</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/activate</code></td><td>Activate a purchased service</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/autonomy/verify</code></td><td>Verify Merkle chain integrity</td></tr>
      <tr><td><code class="inline">GET</code></td><td><code class="inline">/api/autonomy/did</code></td><td>List registered module DIDs</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/revenue/route</code></td><td>Route a revenue event (signed)</td></tr>
      <tr><td><code class="inline">POST</code></td><td><code class="inline">/api/outcome/record</code></td><td>Record proven outcome → auto‑invoice</td></tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top:40px"><div><h2 style="font-size:22px">Example: create BTC invoice</h2></div></div>
  <pre class="code">curl -s -X POST https://zeusai.pro/api/checkout/btc \\
  -H 'Content-Type: application/json' \\
  -d '{"amount":49,"currency":"USD","plan":"starter","email":"you@company.com"}'</pre>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px;margin-top:22px">
    <div class="card"><span class="tag">Node SDK quickstart</span><pre class="code">const order = await fetch('https://zeusai.pro/api/checkout/btc', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ plan:'starter', amountUSD:49, customer:{ email:'you@company.com' } })
}).then(r => r.json());
console.log(order.receiptId || order.orderId, order.btcUri || order.bip21);</pre></div>
    <div class="card"><span class="tag">Python SDK quickstart</span><pre class="code">import requests
order = requests.post('https://zeusai.pro/api/checkout/btc', json={
  'plan':'starter', 'amountUSD':49, 'customer':{'email':'you@company.com'}
}).json()
print(order.get('receiptId') or order.get('orderId'), order.get('btcUri') or order.get('bip21'))</pre></div>
    <div class="card"><span class="tag">Webhook verification</span><pre class="code"># NOWPayments IPN
GET  /api/payment/nowpayments/security
POST /api/payment/nowpayments/webhook

# The webhook is HMAC-SHA512 verified when
# NOWPAYMENTS_IPN_SECRET is configured.</pre></div>
    <div class="card"><span class="tag">Agent-to-agent checkout</span><pre class="code">GET  /openapi.json
POST /api/checkout/cascade
GET  /api/capability/credential/{receiptId}
GET  /api/delivery/{receiptId}</pre></div>
  </div>
</section>`;
}

function pageAbout() {
  return `<section style="padding-top:140px;max-width:900px">
  <span class="kicker">About</span>
  <h1 style="font-size:clamp(34px,4.5vw,58px);margin:10px 0 24px;line-height:1.05">A sovereign AI operating system, <span style="background:linear-gradient(120deg,#fff,var(--violet2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">hand‑forged</span> by its owner.</h1>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">ZeusAI began as one question: what if every action inside a SaaS platform could be cryptographically proven, and every dollar routed without a custodian?</p>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">Today it is a running operating system for the AI era. <span id="aboutModules">—</span> living modules. <span id="aboutVerticals">—</span> pre‑wired vertical industries. Hyperscaler integrations and marketplaces under one Zeus core. All of it owned by one person — ${OWNER.name} — and designed so that no one else can silently take a slice.</p>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">It is not a product. It is a sovereign thesis: that intelligence, value, and property can finally be unified inside a single cryptographic chassis. This is the chassis.</p>
  <div style="display:flex;gap:14px;margin-top:30px"><a class="btn btn-primary" href="/services" data-link>See the fabric</a><a class="btn" href="mailto:${OWNER.email}">Contact the owner</a></div>
  <script>
  (function(){
    function set(id,v){ var el=document.getElementById(id); if(el && v!=null) el.textContent=v; }
    fetch('/api/innovation/coverage',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var s=d&&d.summary||{};
      if (s.total!=null) set('aboutModules', s.total);
    }).catch(function(){ set('aboutModules','160+'); });
    fetch('/health',{cache:'no-store'}).then(function(r){return r.json()}).then(function(d){
      var n = d && d.unicornSync && d.unicornSync.modulesMirror && d.unicornSync.modulesMirror.count;
      if (n!=null) set('aboutModules', n);
    }).catch(function(){});
    fetch('/api/trust/center',{cache:'no-store'}).then(function(r){return r.json()}).then(function(){ set('aboutVerticals','18'); }).catch(function(){ set('aboutVerticals','18'); });
  })();
  </script>
</section>`;
}

function pageLegal() {
  return `<section style="padding-top:140px;max-width:900px">
  <span class="kicker">Legal</span>
  <h1 style="font-size:clamp(30px,3.6vw,44px);margin:10px 0 24px">Terms, privacy &amp; property</h1>
  <h3>Property</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">ZeusAI — including all source code, AI models, generated artefacts, UI, 3D assets, signatures, and brand — is the exclusive property of ${OWNER.name} (${OWNER.email}). No license to copy, fork, redistribute, resell, sub‑license or otherwise transfer any part is granted unless a separate written agreement, signed by the owner, explicitly says so.</p>
  <h3>Terms of service</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">By using ZeusAI you agree that all outputs, telemetry and receipts are generated honestly and routed to the owner's accounts. You agree not to attempt to bypass capability tokens, forge signatures, or exploit the autonomy chain.</p>
  <h3>Privacy</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">ZeusAI stores the minimum data necessary to deliver services: email (for activation), plan, receipts. No data is sold. No data is shared. Cryptographic receipts are append‑only and owner‑owned.</p>
  <h3>Payments</h3>
  <p style="color:var(--ink-dim);font-size:15px;line-height:1.7">Payments are BTC-first and route directly to the owner-controlled wallet. Card/Stripe, PayPal and NOWPayments are optional live rails and are shown only when configured.</p>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:30px">Last updated: ${new Date().toISOString().slice(0,10)} · Jurisdiction: owner of record.</p>
</section>`;
}

function pageTrustCenter() {
  const btcShort = String(OWNER.btc || '').slice(0, 10) + '…' + String(OWNER.btc || '').slice(-8);
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">Trust Center · public proofs</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Operational trust, <span class="grad">signed and inspectable.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">This page combines uptime, deploy identity, integrity signatures, owner BTC routing, payment readiness, security posture, audit logs and incident history. No private secrets are exposed.</p>
  <div id="trustStaticGrid" class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
    <div class="card"><span class="tag">Owner BTC wallet</span><h3 style="margin:6px 0;font-size:16px;font-family:var(--mono)">${_esc(btcShort)}</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Revenue destination. 100% owner-routed — no custodian ever holds funds.</p><div style="margin-top:8px"><span class="btc-addr" data-copy="${OWNER.btc}" title="Click to copy full address">Copy full address</span></div></div>
    <div class="card"><span class="tag">Integrity manifest</span><h3 style="margin:6px 0;font-size:16px">/integrity.json</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Deploy SHA + Ed25519 signature over the deployed bundle.</p><div style="margin-top:8px"><button type="button" class="btn btn-ghost" data-live-inspect="/integrity.json" data-live-title="Inspect integrity">Inspect integrity live →</button></div></div>
    <div class="card"><span class="tag">Refund guarantee</span><h3 style="margin:6px 0;font-size:16px">/refund</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Public refund contract — no email chase, no fine print.</p><div style="margin-top:8px"><a class="btn btn-ghost" href="/refund" data-link>Read refund contract →</a></div></div>
    <div class="card"><span class="tag">Anti-dark-pattern pledge</span><h3 style="margin:6px 0;font-size:16px">/pledge</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Signed pledge: no forced upsells, no hidden auto-renew, no fake scarcity.</p><div style="margin-top:8px"><a class="btn btn-ghost" href="/pledge" data-link>Read the pledge →</a></div></div>
    <div class="card"><span class="tag">Public keys</span><h3 style="margin:6px 0;font-size:16px">/api/v50/keys.json</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Ed25519 verification keys used to sign receipts, licenses and integrity manifests.</p><div style="margin-top:8px"><button type="button" class="btn" data-live-inspect="/api/v50/keys.json" data-live-title="Inspect public keys" style="margin-top:8px">Inspect keys</button></div></div>
    <div class="card"><span class="tag">Money-path integrity</span><h3 style="margin:6px 0;font-size:16px">/api/commerce/integrity</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">ESOS/1.0 verifier: every paid order has a signed entitlement, no orphans, no signature failures.</p><div style="margin-top:8px"><button type="button" class="btn btn-ghost" data-live-inspect="/api/commerce/integrity" data-live-title="Open integrity report">Open integrity report</button></div></div>
    <div class="card"><span class="tag">Enterprise Standard OS</span><h3 style="margin:6px 0;font-size:16px">/.well-known/enterprise.json</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">ESOS/1.0 posture: money integrity, real commerce metrics, rate-limit, AI-cost visibility.</p><div style="margin-top:8px"><button type="button" class="btn" data-live-inspect="/.well-known/enterprise.json" data-live-title="Inspect enterprise posture" style="margin-top:8px">Inspect enterprise posture</button></div></div>
    ${continuityAttestation.trustCardHtml()}
    <div class="card" data-mts-trust-card="1"><span class="tag">MTS/1.0 Merchant Standard</span><h3 style="margin:6px 0;font-size:16px">/standard</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Signed commerce-ready envelope — buyable floor, armed rails honesty, bond + continuity. Agents verify before paying.</p><div style="margin-top:8px"><a class="btn btn-ghost" href="/standard" data-link>Open merchant standard →</a></div></div>
  </div>
  <div class="grid" id="trustGrid" style="margin-top:22px"><div class="card"><p>Loading trust center…</p></div></div>
  <div class="card" style="padding:22px;margin-top:18px"><span class="kicker">Integrity document</span><pre class="code" id="trustRaw">—</pre></div>
  <script>
  (async function(){
    const grid=document.getElementById('trustGrid'), raw=document.getElementById('trustRaw');
    try {
      const [tc, integ] = await Promise.all([
        fetch('/api/trust/center').then(r=>r.json()),
        fetch('/.well-known/unicorn-integrity.json').then(r=>r.json())
      ]);
      const cards = [
        ['Health', tc.health.status, tc.health.summary],
        ['Deploy SHA', tc.deploy.sha, tc.deploy.generatedAt],
        ['Integrity', integ.alg, 'Public key + signature live'],
        ['BTC proof', tc.owner.btc.slice(0,18)+'…', '100% owner-routed wallet'],
        ['Payments', tc.payments.mode, tc.payments.action],
        ['Security', tc.security.posture, tc.security.summary],
        ['Incidents', tc.incidents.count+' sealed', tc.incidents.status],
        ['SLO', tc.slo.uptimeTarget, tc.slo.probe]
      ];
      grid.innerHTML = cards.map(c=>'<div class="card"><span class="tag">'+c[0]+'</span><h3>'+c[1]+'</h3><p style="color:var(--ink-dim)">'+c[2]+'</p></div>').join('');
      raw.textContent = 'health: '+(tc.health && tc.health.status || 'ok')+' · deploy: '+(tc.deploy && tc.deploy.sha || '—')+' · integrity: '+(integ && integ.alg || 'ed25519')+' · incidents: '+(tc.incidents && tc.incidents.count || 0);
    } catch(e) {
      grid.innerHTML='<div class="card"><p style="color:var(--danger)">Trust center unavailable: '+e.message+'</p></div>';
      // Also clear the SSR "Loading…" placeholder on the integrity document
      // element — same regression class as the /services BTC spot rate bug.
      raw.textContent = 'Integrity document unavailable: '+e.message;
    }
  })();
  </script>
</section>`;
}

function pageSecurity() {
  return _policyPage('Security', 'Security posture', [
    ['Runtime hardening', 'Helmet CSP, HSTS in production, CORS allow-listing, rate limits and body sanitization protect public APIs.'],
    ['Secrets', 'GitHub Actions can sync secrets to Hetzner .env with masked values, SSH validation and PM2 reload. External provider secrets are optional until enabled.'],
    ['Payments', 'Direct BTC owner-wallet checkout is the current production rail. NOWPayments uses HMAC IPN verification only when enabled later.'],
    ['Integrity', 'The site publishes Ed25519-signed integrity at /.well-known/unicorn-integrity.json and DID discovery at /.well-known/did.json.'],
    ['QuantumIntegrityShield', 'The backend exposes exact diagnostics at /api/quantum-integrity/status and avoids false degraded state from retired PM2 process names.'],
    ['Incident handling', 'Incidents are sealed publicly and linked from /status and /trust.']
  ]);
}

function pageResponsibleAi() {
  return _policyPage('Responsible AI', 'Responsible AI controls', [
    ['Human sovereignty', 'High-risk actions remain owner-approved through admin gates, kill-switch policy and capability boundaries.'],
    ['No dark patterns', 'The anti-dark-pattern pledge forbids fake scarcity, forced accounts, drip pricing and retention traps.'],
    ['Transparency', 'Pricing experiments publish public aggregate metrics at /transparency.'],
    ['Data minimization', 'Personal data is limited to activation, receipts, support and delivery records.'],
    ['Agent boundaries', 'Agent-to-agent checkout uses signed receipts and endpoint-scoped capability credentials.'],
    ['Rollback', 'Temporal product memory records deploy identity, risk and rollback-ready status.']
  ]);
}

function pageDpa() {
  return _policyPage('Data Processing Agreement', 'Data Processing Agreement', [
    ['Controller / Processor', `${OWNER.name} operates ZeusAI as owner. Customer-specific processing is limited to service activation, delivery, support and billing.`],
    ['Data categories', 'Email, plan, order intent, receipt metadata, delivery entitlements, API keys and support messages.'],
    ['Security measures', 'TLS, signed receipts, access tokens, admin authorization, body sanitization, operational logging and least-data retention.'],
    ['Sub-processors', 'Payment and infrastructure subprocessors are disclosed through compliance attestation endpoints when configured.'],
    ['Retention', 'Receipts and integrity logs are append-only for auditability; user support data can be exported or deleted where legally allowed.'],
    ['International transfers', 'Transfers are limited to configured infrastructure/payment providers and documented in the customer agreement.']
  ]);
}

function pagePaymentTerms() {
  return _policyPage('Payment Terms', 'Payment Terms', [
    ['Current rail', 'BTC direct wallet is the active production payout path; revenue goes to the owner-controlled BTC address.'],
    ['Later rails', 'PayPal and NOWPayments are optional integrations that can be configured later without changing the BTC primary path.'],
    ['Settlement', 'Paid receipts issue delivery/license credentials after confirmation or admin settlement.'],
    ['Refunds', 'Refund guarantee and SLA breach logic are documented at /refund and /sla.'],
    ['Taxes', 'Customer is responsible for applicable taxes unless an enterprise contract states otherwise.'],
    ['Receipts', 'Every order is recorded with signed receipt metadata and owner-routed payout destination.']
  ]);
}

function pageOperator() {
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">Operator Console · public-safe</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Commerce, health and deploy <span class="grad">in one cockpit.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">Sanitized operator view for orders, payments, leads, AI provider readiness, errors, revenue proof, deploy health and webhook failures. Admin-only actions remain protected.</p>
  <div class="grid" id="opGrid" style="margin-top:22px"><div class="card"><p>Operator snapshot will appear here.</p></div></div>
  <pre class="code" id="opRaw" style="margin-top:18px;max-height:420px;overflow:auto">Operator summary will appear here.</pre>
  <div class="card" style="margin-top:18px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <span class="tag">Admin ops summary</span>
        <h3 style="margin:8px 0 4px">Funnel, SLO and DeepSeek in one panel</h3>
        <p style="margin:0;color:var(--ink-dim);font-size:13px">Uses <code class="inline">/api/admin/ops/summary</code>. Token is stored in <code class="inline">sessionStorage</code> only.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;min-width:min(100%,520px)">
        <input id="opAdminToken" type="password" placeholder="Admin JWT token" style="flex:1;min-width:220px;padding:10px;border-radius:10px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-family:var(--mono)"/>
        <button class="btn btn-primary" id="opLoadAdmin">Load admin KPIs</button>
        <button class="btn" id="opClearAdmin">Clear token</button>
        <button class="btn" id="opAutoRefresh">Auto refresh: ON</button>
      </div>
    </div>
    <div class="grid" id="opOpsGrid" style="margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))"><div class="card"><p style="margin:0;color:var(--ink-dim)">Admin KPIs locked.</p></div></div>
    <pre class="code" id="opOpsRaw" style="margin-top:12px;max-height:260px;overflow:auto">Awaiting admin token…</pre>
  </div>
  <script>
  (function(){
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    const fmtNum = (n) => {
      const v = Number(n || 0);
      if (!Number.isFinite(v)) return '0';
      return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    function loadPublic(){
      fetch('/api/operator/console').then(r=>r.json()).then(d=>{
        const cards=[['Orders', d.orders.total], ['Paid', d.orders.paid], ['Revenue', '$'+fmtNum(d.revenue.totalUsd)], ['Payment rail', d.payments.mode], ['AI providers', d.ai.active+'/'+d.ai.total], ['Deploy', d.deploy.sha], ['Errors', d.errors.count], ['Webhooks', d.webhooks.status]];
        const g = document.getElementById('opGrid');
        if (g) g.innerHTML=cards.map(c=>'<div class="card"><span class="tag">'+esc(c[0])+'</span><h3>'+esc(c[1])+'</h3></div>').join('');
        const r = document.getElementById('opRaw');
        if (r) r.textContent='deploy '+(d.deploy.sha||'—')+' · payments '+(d.payments.mode||'—')+' · revenue $'+fmtNum(d.revenue.totalUsd);
      }).catch(e=>{
        const g = document.getElementById('opGrid');
        if (g) g.innerHTML = '<div class="card"><p style="color:var(--ink-dim)">Operator snapshot unavailable. Retrying.</p></div>';
        const r = document.getElementById('opRaw');
        if (r) r.textContent = 'Operator console unavailable: '+(e && e.message || e);
      });
    }

    function loadAdminOps(token){
      const opsGrid = document.getElementById('opOpsGrid');
      const opsRaw = document.getElementById('opOpsRaw');
      if (!token) {
        if (opsGrid) opsGrid.innerHTML = '<div class="card"><p style="margin:0;color:var(--ink-dim)">Admin KPIs locked.</p></div>';
        if (opsRaw) opsRaw.textContent = 'Awaiting admin token…';
        return;
      }
      if (opsRaw) opsRaw.textContent = 'Loading admin ops summary…';
      fetch('/api/admin/ops/summary', { headers: { Authorization: 'Bearer ' + token } }).then(async (r) => {
        const txt = await r.text();
        let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (_) { d = null; }
        if (!r.ok) {
          throw new Error((d && (d.error || d.reason)) || ('HTTP ' + r.status));
        }
        return d || {};
      }).then((d) => {
        const f = d.funnel || {};
        const ds = d.deepseek || {};
        const cards = [
          ['Views/h', fmtNum(f.viewsHour)],
          ['Checkout/h', fmtNum(f.checkoutHour)],
          ['Paid/h', fmtNum(f.paidHour)],
          ['View→Checkout', (Number(f.conversionViewToCheckout || 0) * 100).toFixed(1) + '%'],
          ['Checkout→Paid', (Number(f.conversionCheckoutToPaid || 0) * 100).toFixed(1) + '%'],
          ['DeepSeek actions/h', fmtNum(ds.actionsLastHour)],
          ['DeepSeek actions/day', fmtNum(ds.actionsLastDay)],
          ['Pending req ids', fmtNum(ds.pendingRequestIds)]
        ];
        if (opsGrid) {
          opsGrid.innerHTML = cards.map((c) => '<div class="card"><span class="tag">' + esc(c[0]) + '</span><h3>' + esc(c[1]) + '</h3></div>').join('');
        }
        if (opsRaw) {
          opsRaw.textContent = 'ts ' + (d.ts || '—') + '\n' +
            'funnel events buffered: ' + fmtNum(f.bufferedEvents) + '\n' +
            'perf.slo: ' + JSON.stringify((d.performance && d.performance.slo) || {}, null, 2);
        }
      }).catch((e) => {
        if (opsGrid) opsGrid.innerHTML = '<div class="card"><p style="margin:0;color:#ffb4b4">Admin summary unavailable.</p></div>';
        if (opsRaw) opsRaw.textContent = 'Admin ops summary error: ' + (e && e.message || e);
      });
    }

    const tokenInput = document.getElementById('opAdminToken');
    const loadBtn = document.getElementById('opLoadAdmin');
    const clearBtn = document.getElementById('opClearAdmin');
    const autoBtn = document.getElementById('opAutoRefresh');
    let autoTimer = null;
    let autoOn = true;

    function setAutoRefresh(on){
      autoOn = !!on;
      if (autoBtn) autoBtn.textContent = 'Auto refresh: ' + (autoOn ? 'ON' : 'OFF');
      try { sessionStorage.setItem('zeus_admin_ops_autorefresh', autoOn ? '1' : '0'); } catch (_) {}
    }

    function armAutoRefresh(token){
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      if (!autoOn || !token) return;
      autoTimer = setInterval(function(){ loadAdminOps(token); }, 30000);
    }

    let saved = '';
    try { saved = sessionStorage.getItem('zeus_admin_jwt') || ''; } catch (_) { saved = ''; }
    if (tokenInput && saved) tokenInput.value = saved;
    try { setAutoRefresh((sessionStorage.getItem('zeus_admin_ops_autorefresh') || '1') === '1'); } catch (_) { setAutoRefresh(true); }
    if (loadBtn) {
      loadBtn.addEventListener('click', function(){
        const t = tokenInput ? String(tokenInput.value || '').trim() : '';
        try {
          if (t) sessionStorage.setItem('zeus_admin_jwt', t);
          else sessionStorage.removeItem('zeus_admin_jwt');
        } catch (_) {}
        loadAdminOps(t);
        armAutoRefresh(t);
      });
    }
    if (tokenInput) {
      tokenInput.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' && loadBtn) { ev.preventDefault(); loadBtn.click(); }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function(){
        if (tokenInput) tokenInput.value = '';
        try { sessionStorage.removeItem('zeus_admin_jwt'); } catch (_) {}
        loadAdminOps('');
        armAutoRefresh('');
      });
    }
    if (autoBtn) {
      autoBtn.addEventListener('click', function(){
        setAutoRefresh(!autoOn);
        const t = tokenInput ? String(tokenInput.value || '').trim() : '';
        armAutoRefresh(t);
      });
    }

    loadPublic();
    if (saved) {
      loadAdminOps(saved);
      armAutoRefresh(saved);
    }
  })();
  </script>
</section>`;
}

function pageObservability() {
  return `<section style="padding-top:140px;max-width:1120px">
  <span class="kicker">Observability</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">SLOs, probes and <span class="grad">self-healing signals.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:820px">Public status page foundation for synthetic checkout probes, robots/sitemap/payment monitoring, SLO budgets and alert readiness.</p>
  <div class="grid" id="obsGrid" style="margin-top:22px"><div class="card"><p>Observability probes will appear here.</p></div></div>
  <pre class="code" id="obsRaw" style="margin-top:18px">Observability summary will appear here.</pre>
  <script>
  fetch('/api/observability/status').then(r=>r.json()).then(d=>{
    document.getElementById('obsGrid').innerHTML=(d.probes||[]).map(p=>'<div class="card"><span class="tag">'+p.status+'</span><h3>'+p.name+'</h3><p style="color:var(--ink-dim)">'+p.target+' · '+p.interval+'</p></div>').join('');
    document.getElementById('obsRaw').textContent='probes: '+((d.probes||[]).length)+' · last update: '+(d.generatedAt||new Date().toISOString());
  }).catch(e=>{
    // Never leave the SSR "Observability probes will appear here." placeholder stuck.
    const g = document.getElementById('obsGrid');
    if (g) g.innerHTML = '<div class="card"><p style="color:var(--ink-dim)">Observability snapshot unavailable. Retrying.</p></div>';
    const r = document.getElementById('obsRaw');
    if (r) r.textContent = 'Observability unavailable: '+(e && e.message || e);
  });
  </script>
</section>`;
}

function pageStore() {
  const catalog = _loadCatalog();
  const byTier = { instant: [], professional: [], enterprise: [] };
  catalog.forEach(p => { const t = String(p.tier || 'professional'); if (byTier[t]) byTier[t].push(p); });
  const counts = { instant: byTier.instant.length, professional: byTier.professional.length, enterprise: byTier.enterprise.length };
  const totalUsd = catalog.reduce((s, p) => s + Number(p.priceUSD || p.priceUsd || 0), 0);
  // Auto-published library: every service.js module loaded by
  // serviceMarketplace at runtime gets a card here (deduplicated against
  // the unified catalog above). Grouped by category so a 100+ list stays
  // navigable. Hydration via the existing services.changed SSE event
  // re-renders this block whenever a new module appears at runtime.
  const library = _loadFullLibrary(catalog.map(p => p.id));
  const libByCat = {};
  for (const it of library) {
    const c = String(it.category || 'general');
    if (!libByCat[c]) libByCat[c] = [];
    libByCat[c].push(it);
  }
  const libCategories = Object.keys(libByCat).sort();
  const libCount = library.length;
  const renderLibrarySection = (cat, items) => {
    if (!items.length) return '';
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `<details class="library-cat-block" data-category="${_esc(cat)}" style="margin:0 0 18px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:10px;background:rgba(138,92,255,.06);border:1px solid rgba(138,92,255,.2);font-weight:600;font-size:13px"><span>${_esc(label)} · ${items.length} services</span><span style="color:var(--ink-dim);font-family:var(--mono);font-size:11px">click to expand</span></summary><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:10px">${items.map(_libraryCard).join('')}</div></details>`;
  };
  const renderTierSection = (tier, label, items) => {
    if (!items.length) return '';
    return `<details class="store-tier-block" data-tier="${tier}" open style="margin:0 0 30px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-radius:12px;background:rgba(138,92,255,.08);border:1px solid rgba(138,92,255,.25);font-weight:600"><span>${_esc(label)} · ${items.length} products</span><span style="color:var(--ink-dim);font-family:var(--mono);font-size:12px">click to collapse</span></summary><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:18px;margin-top:14px">${items.map(_catalogCard).join('')}</div></details>`;
  };
  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1280px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#ffd36a">ZeusAI Store · ${catalog.length} curated products · honest checkout · $${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} listed catalogue value</span>
    <h1 style="font-size:clamp(36px,5vw,64px);line-height:1.04;margin:14px 0 18px;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#ffd36a 40%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Real products. Real BTC settlement. Real delivery.</h1>
    <p style="color:var(--ink-dim);font-size:18px;max-width:900px;line-height:1.55">Instant SKUs deliver digital packs after on-chain payment. Professional builds are BTC reserves with a signed kickoff pack now and human milestone delivery after. Enterprise licenses start as SOW proposals — not a self-serve cart. Module mirrors below are operational references, not checkout SKUs. Every receipt Ed25519-signed.</p>

    <div id="storeStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:30px 0 20px">
      <div class="card"><span class="tag">Instant</span><h3 style="margin:6px 0 0;font-size:24px">${counts.instant}</h3></div>
      <div class="card"><span class="tag">Professional</span><h3 style="margin:6px 0 0;font-size:24px">${counts.professional}</h3></div>
      <div class="card"><span class="tag">Enterprise</span><h3 style="margin:6px 0 0;font-size:24px">${counts.enterprise}</h3></div>
      <div class="card"><span class="tag" style="background:rgba(255,211,106,.10);color:#ffd36a;border:1px solid rgba(255,211,106,.30)">🤖 Auto-published</span><h3 style="margin:6px 0 0;font-size:24px" data-library-count>${libCount}</h3></div>
    </div>

    <div id="storeTabs" style="display:flex;gap:8px;margin:30px 0 10px;flex-wrap:wrap;border-bottom:1px solid rgba(138,92,255,.2);padding-bottom:4px">
      <button class="store-tab" data-tier="instant" type="button" style="background:linear-gradient(135deg,#8a5cff,#6d28d9);color:#fff;border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">⚡ Instant digital (${counts.instant})</button>
      <button class="store-tab" data-tier="professional" type="button" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">💼 Professional builds (${counts.professional})</button>
      <button class="store-tab" data-tier="enterprise" type="button" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">👑 Enterprise SOW (${counts.enterprise})</button>
    </div>
    <div id="storeTabNote" style="color:var(--ink-dim);font-size:13px;margin:6px 0 20px">${catalog.length} curated products rendered server-side · ${libCount} module mirrors listed as reference only (not for sale) · live JS hydration refreshes prices via SSE.</div>

    <div id="storeGrid" style="margin:20px 0 40px">
      ${renderTierSection('instant', '⚡ Instant digital deliverables', byTier.instant)}
      ${renderTierSection('professional', '💼 Professional build engagements (BTC reserve + human delivery)', byTier.professional)}
      ${renderTierSection('enterprise', '👑 Enterprise licenses (request proposal)', byTier.enterprise)}
    </div>

    ${libCount > 0 ? `<div id="autoLibrary" style="margin:50px 0 80px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;border-top:1px solid rgba(138,92,255,.2);padding-top:30px">
        <div>
          <span class="kicker" style="color:#ffd36a">🤖 Unicorn module mirror · not for sale</span>
          <h2 style="margin:6px 0 0;font-size:28px;line-height:1.2">Operational modules, shown for transparency.</h2>
        </div>
        <span style="color:var(--ink-dim);font-size:13px;font-family:var(--mono)" data-library-count-label>${libCount} mirrors · not checkout SKUs</span>
      </div>
      <p style="color:var(--ink-dim);font-size:14px;line-height:1.55;max-width:820px;margin:0 0 20px">Backend modules appear here as an operational mirror so you can see what the platform runs. They are <b style="color:#fff;font-weight:600">not</b> public checkout products — buy only from the curated Instant / Professional / Enterprise catalogue above.</p>
      <div id="autoLibraryGrid">
        ${libCategories.map(c => renderLibrarySection(c, libByCat[c])).join('')}
      </div>
    </div>` : ''}
    <div id="storeCheckout" style="margin:40px 0 80px"></div>
  </div>
</section>`;
}

function pageAccount(opts) {
  // ────────────────────────────────────────────────────────────────────
  // Revolutionary cryptographic auth (Ed25519 + IndexedDB + encrypted vault).
  // SOLE auth surface on this site. No passwords. No emails for auth.
  // No SMS. No magic links. Private key never leaves the user's device.
  // Mobile + desktop parity by design (single responsive layout).
  // ────────────────────────────────────────────────────────────────────
  var _nonce = (opts && opts.nonce) ? String(opts.nonce) : '';
  var _N = _nonce ? ' nonce="' + _nonce + '"' : '';
  return `<section style="padding:120px 0 80px;min-height:100vh">
  <div style="max-width:760px;margin:0 auto;padding:0 20px">
    <span class="kicker" style="color:#7cffb8">Cryptographic identity \u00b7 Ed25519</span>
    <h1 style="font-size:clamp(32px,4vw,48px);line-height:1.05;margin:14px 0 10px;letter-spacing:-0.02em">Your account</h1>
    <p id="acaTagline" style="color:var(--ink-dim);font-size:16px;line-height:1.55;margin:0 0 28px">No passwords. No emails to verify. Your device generates the keypair \u2014 the private key never leaves your browser. To recover, import the encrypted backup file you download once at registration.</p>

    <div id="acaState" class="card" style="padding:26px;background:linear-gradient(135deg,rgba(124,255,184,.07),rgba(138,92,255,.07));border:1px solid rgba(124,255,184,.25);min-height:120px">
      <div style="color:var(--ink-dim);font-size:14px">Loading\u2026</div>
    </div>

    <div id="acaPanels" style="margin-top:22px"></div>

    <details id="acaAdvanced" style="margin-top:22px;background:rgba(10,8,30,.4);border:1px solid rgba(138,92,255,.18);border-radius:10px;padding:14px 18px">
      <summary style="cursor:pointer;font-weight:600;color:#9ab4ff">Advanced \u00b7 Sign out from this device only \u00b7 Wipe local key</summary>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="acaLogoutBtn" class="btn btn-ghost">Sign out</button>
        <button id="acaWipeBtn" class="btn btn-ghost" style="color:#ff9c9c;border-color:rgba(255,156,156,.4)">Wipe local key (irreversible without backup)</button>
      </div>
      <p style="color:var(--ink-dim);font-size:12.5px;margin:12px 0 0;line-height:1.5">Wiping removes the private key from this browser only. To get back in, import your <code style="color:#7cffb8">.zeus-vault</code> backup file.</p>
    </details>

    <div style="margin-top:30px;padding:18px;background:rgba(255,211,106,.04);border:1px solid rgba(255,211,106,.18);border-radius:10px">
      <div style="font-size:13px;color:#ffd36a;font-weight:600;margin-bottom:6px">Why this is future-proof</div>
      <ul style="color:var(--ink-dim);font-size:13px;line-height:1.65;margin:0;padding-left:20px">
        <li><b style="color:#fff">No password</b> means no leak, no phishing, no reuse risk \u2014 ever.</li>
        <li><b style="color:#fff">Ed25519</b> is the same algorithm SSH, signal apps and crypto wallets use \u2014 will be safe for decades.</li>
        <li><b style="color:#fff">Your private key</b> sits in IndexedDB on your device. The server stores only the public key.</li>
        <li><b style="color:#fff">Recovery</b> = re-import the encrypted vault file you downloaded at signup. No email, no SMS, no support ticket.</li>
        <li><b style="color:#fff">User ID</b> is derived from the public key (<code style="color:#7cffb8">zid_\u2026</code>) \u2014 no central database controls who you are.</li>
      </ul>
    </div>
  </div>
</section>

<dialog id="acaDlg" style="border:none;border-radius:14px;padding:0;background:transparent;max-width:520px;width:92%">
  <div class="card" style="padding:26px;border:1px solid rgba(124,255,184,.3);background:#0a0c14">
    <h3 id="acaDlgTitle" style="margin:0 0 8px">Backup your private key</h3>
    <div id="acaDlgBody" style="color:var(--ink-dim);font-size:14px;line-height:1.55"></div>
    <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
      <button id="acaDlgCancel" class="btn btn-ghost">Cancel</button>
      <button id="acaDlgOk" class="btn btn-primary">OK</button>
    </div>
  </div>
</dialog>

<script${_N}>
(function(){
  if (window.__zeusCryptoAuthInit) return; window.__zeusCryptoAuthInit = true;
  var ttPolicy = null;
  try {
    if (window.trustedTypes && typeof window.trustedTypes.createPolicy === 'function') {
      ttPolicy = window.trustedTypes.createPolicy('zeus', {
        createHTML: function(v){ return String(v == null ? '' : v); },
        createScriptURL: function(v){ return String(v == null ? '' : v); },
        createScript: function(v){ return String(v == null ? '' : v); }
      });
    }
  } catch (_) {}
  function setHtml(el, html) {
    if (!el) return;
    try {
      el.innerHTML = ttPolicy ? ttPolicy.createHTML(html) : html;
    } catch (_) {
      try { el.innerHTML = html; } catch (__){ }
    }
  }
  // ── Polyfilled-safe Web Crypto check ──
  var subtle = (window.crypto && window.crypto.subtle) || null;
  if (!subtle || !window.indexedDB) {
    var s = document.getElementById('acaState');
    setHtml(s, '<b style="color:#ff9c9c">This browser does not support Web Crypto / IndexedDB.</b><br><span style="color:var(--ink-dim);font-size:13px">Use any modern browser (Chrome, Firefox, Safari, Edge \u2265 2020).</span>');
    return;
  }

  var DB_NAME = 'zeus-cryptoauth';
  var STORE = 'keys';
  var KEY_ID = 'primary';
  var TOKEN_KEY = 'zeus_cryptoauth_token';
  var USERID_KEY = 'zeus_cryptoauth_userid';
  var naclReady = null;

  function loadNacl() {
    if (window.nacl) return Promise.resolve(window.nacl);
    if (naclReady) return naclReady;
    naclReady = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js';
      s.async = true;
      s.onload = function(){
        if (window.nacl) resolve(window.nacl);
        else reject(new Error('nacl_unavailable'));
      };
      s.onerror = function(){ reject(new Error('nacl_load_failed')); };
      document.head.appendChild(s);
    });
    return naclReady;
  }

  // ── IndexedDB tiny wrapper ──
  function dbOpen() {
    return new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore(STORE); };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }
  function dbGet(key) {
    return dbOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      tx.onsuccess = function(){ res(tx.result || null); };
      tx.onerror = function(){ rej(tx.error); };
    }); });
  }
  function dbPut(key, val) {
    return dbOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
      tx.onsuccess = function(){ res(); };
      tx.onerror = function(){ rej(tx.error); };
    }); });
  }
  function dbDel(key) {
    return dbOpen().then(function(db){ return new Promise(function(res, rej){
      var tx = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
      tx.onsuccess = function(){ res(); };
      tx.onerror = function(){ rej(tx.error); };
    }); });
  }

  // ── base64 helpers (URL-safe-tolerant) ──
  function b64encode(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function b64decode(s) {
    var raw = atob(s);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function utf8(s) { return new TextEncoder().encode(s); }

  // ── Ed25519 keypair (Web Crypto, raw export for interop with Node) ──
  // Note: SubtleCrypto Ed25519 is supported in Chrome 113+, Safari 17+, Firefox 130+.
  // Safe across modern browsers; fallback handled with clear error.
  function genKeypair() {
    return subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).catch(function(){
      return loadNacl().then(function(n){
        var kp = n.sign.keyPair();
        return {
          __nacl: true,
          publicKey: kp.publicKey,
          privateKey: { __naclSk: kp.secretKey }
        };
      });
    });
  }
  function exportPublicRaw(kp) {
    if (kp && kp.__nacl && kp.publicKey) return Promise.resolve((new Uint8Array(kp.publicKey)).buffer);
    return subtle.exportKey('raw', kp.publicKey);
  }
  function exportPrivatePkcs8(kp) {
    if (kp && kp.__nacl && kp.privateKey && kp.privateKey.__naclSk) {
      return Promise.resolve((new Uint8Array(kp.privateKey.__naclSk)).buffer);
    }
    return subtle.exportKey('pkcs8', kp.privateKey);
  }
  function importPrivate(pkcs8) {
    var raw = new Uint8Array(pkcs8);
    if (raw.length === 64) {
      return loadNacl().then(function(){ return { __naclSk: new Uint8Array(raw) }; });
    }
    return subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
  }
  function importPublic(raw) {
    return subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
  }
  function sign(privKey, data) {
    if (privKey && privKey.__naclSk) {
      return loadNacl().then(function(n){
        var sig = n.sign.detached(new Uint8Array(data), new Uint8Array(privKey.__naclSk));
        return (new Uint8Array(sig)).buffer;
      });
    }
    return subtle.sign({ name: 'Ed25519' }, privKey, data);
  }

  // ── AES-GCM vault encrypt/decrypt with PBKDF2 ──
  function deriveAesKey(password, salt) {
    return subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']).then(function(km){
      return subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: 250000, hash: 'SHA-256' },
        km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    });
  }
  function encryptVault(privatePkcs8, publicRaw, meta, password) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveAesKey(password, salt).then(function(key){
      var blob = JSON.stringify({
        priv: b64encode(privatePkcs8),
        pub: b64encode(publicRaw),
        meta: meta || {},
        createdAt: new Date().toISOString()
      });
      return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, utf8(blob)).then(function(ct){
        return {
          format: 'zeus-vault-v1',
          alg: 'AES-GCM-256+PBKDF2-SHA256-250k',
          salt: b64encode(salt),
          iv: b64encode(iv),
          ciphertext: b64encode(ct),
          createdAt: new Date().toISOString()
        };
      });
    });
  }
  function decryptVault(vault, password) {
    if (!vault || vault.format !== 'zeus-vault-v1') throw new Error('Unknown vault format');
    var salt = b64decode(vault.salt);
    var iv = b64decode(vault.iv);
    var ct = b64decode(vault.ciphertext);
    return deriveAesKey(password, salt).then(function(key){
      return subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    }).then(function(plain){
      return JSON.parse(new TextDecoder().decode(plain));
    });
  }

  // ── Server interactions ──
  // Each attempt has a 15s timeout; transient failures (server cold-start,
  // restart race, nginx 502/timeout → status 0) are auto-retried with
  // exponential backoff so a briefly-unresponsive server self-recovers
  // instead of dumping "Server timeout" on the user.
  var API_TIMEOUT_MS = 15000;
  var API_MAX_ATTEMPTS = 3; // 1 initial + 2 retries
  function _delay(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function _fetchOnce(path, opts) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tid = ctrl ? setTimeout(function(){ ctrl.abort(); }, API_TIMEOUT_MS) : null;
    opts.signal = ctrl ? ctrl.signal : undefined;
    return fetch(path, opts).then(function(r){
      if (tid) clearTimeout(tid);
      return r.json().then(function(j){ return { status: r.status, body: j }; });
    }).catch(function(e){
      if (tid) clearTimeout(tid);
      var code = (e && e.name === 'AbortError') ? 'timeout' : 'network_error';
      return { status: 0, body: { ok: false, error: code } };
    });
  }
  // Retry only on transient transport failures (status 0). Real HTTP responses
  // (4xx/5xx) are returned to the caller unchanged so existing handlers keep
  // their precise error semantics (e.g. challenge_invalid_or_expired retries).
  function _fetchRetry(path, opts, attempt) {
    attempt = attempt || 1;
    return _fetchOnce(path, opts).then(function(res){
      if (res.status === 0 && attempt < API_MAX_ATTEMPTS) {
        return _delay(600 * Math.pow(2, attempt - 1)).then(function(){ return _fetchRetry(path, opts, attempt + 1); });
      }
      return res;
    });
  }
  function api(path, body) {
    return _fetchRetry(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }
  function apiGet(path, token) {
    return _fetchRetry(path, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {}
    });
  }
  function friendlyError(code) {
    var map = {
      'challenge_invalid_or_expired': 'Sesiunea a expirat \u2014 re\u00eencerc\u0103 / Session expired, retrying\u2026',
      'signature_invalid': 'Eroare de semn\u0103tur\u0103 \u2014 cheia nu corespunde / Signature mismatch',
      'user_not_found': 'Cont neg\u0103sit \u2014 folosete \u201cCre\u0103z\u0103 cont\u201d sau \u201cImport\u0103 vault\u201d / Account not found',
      'too_many_requests': 'Prea multe \u00eencerc\u0103ri, a\u015fteapt\u0103 un minut / Too many attempts, please wait',
      'jwt_unavailable': 'Eroare de server \u2014 \u00eencerc\u0103 mai t\u00e2rziu / Server error, try again later',
      'network_error': 'Eroare de re\u0163ea \u2014 verific\u0103 conexiunea / Network error, check your connection',
      'timeout': 'Serverul nu r\u0103spunde \u2014 \u00eencerc\u0103 mai t\u00e2rziu / Server timeout, try again later',
      'login_failed': 'Autentificare e\u015fuat\u0103 \u2014 re\u00eencerc\u0103 / Login failed, please retry',
      'register_failed': 'Creare cont e\u015fuat\u0103 \u2014 re\u00eencerc\u0103 / Account creation failed',
      'recover_failed': 'Recuperare e\u015fuat\u0103 \u2014 verific\u0103 parola vault-ului / Recovery failed, check vault password',
      'login_after_register_failed': 'Contul a fost creat, dar autentificarea automat\u0103 a e\u015fuat \u2014 apas\u0103 \u201cSign in with this device\u201d / Account created but auto-login failed \u2014 tap "Sign in with this device"',
      'recover_register_failed': 'Importul vault-ului a e\u015fuat \u2014 re\u00eencerc\u0103 / Vault import failed, please retry',
      'nacl_load_failed': 'Bibliotec\u0103 criptografic\u0103 indisponibil\u0103 \u2014 dezactiveaz\u0103 ad-blocker-ul \u015fi re\u00eencerc\u0103 / Crypto library unavailable \u2014 disable ad-blocker and retry',
      'nacl_unavailable': 'Bibliotec\u0103 criptografic\u0103 indisponibil\u0103 \u2014 dezactiveaz\u0103 ad-blocker-ul \u015fi re\u00eencerc\u0103 / Crypto library unavailable \u2014 disable ad-blocker and retry',
      'missing_publicKey': 'Eroare intern\u0103 la generarea cheii \u2014 re\u00eencerc\u0103 / Internal key generation error \u2014 please retry',
      'invalid_publicKey_length': 'Eroare intern\u0103 la generarea cheii \u2014 re\u00eencerc\u0103 / Internal key generation error \u2014 please retry',
      'missing_fields': 'Date lips\u0103 \u2014 re\u00eencerc\u0103 / Missing data \u2014 please retry',
      'auth_endpoint_retired': 'Aceast\u0103 metod\u0103 de autentificare nu mai este activ\u0103 / This auth method has been retired',
      'internal': 'Eroare intern\u0103 de server / Internal server error'
    };
    return map[code] || code;
  }

  // ── State & UI ──
  var $state = document.getElementById('acaState');
  var $panels = document.getElementById('acaPanels');
  var $logout = document.getElementById('acaLogoutBtn');
  var $wipe = document.getElementById('acaWipeBtn');
  var $dlg = document.getElementById('acaDlg');
  var $dlgTitle = document.getElementById('acaDlgTitle');
  var $dlgBody = document.getElementById('acaDlgBody');
  var $dlgOk = document.getElementById('acaDlgOk');
  var $dlgCancel = document.getElementById('acaDlgCancel');

  function html(s){ return s.replace(/[&<>\"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'})[c]; }); }
  function showDialog(title, bodyHtml, okText) {
    $dlgTitle.textContent = title;
    setHtml($dlgBody, bodyHtml);
    $dlgOk.textContent = okText || 'OK';
    return new Promise(function(resolve){
      function done(v){ $dlgOk.removeEventListener('click', okH); $dlgCancel.removeEventListener('click', cancelH); $dlg.close(); resolve(v); }
      function okH(){ done(true); }
      function cancelH(){ done(false); }
      $dlgOk.addEventListener('click', okH);
      $dlgCancel.addEventListener('click', cancelH);
      if ($dlg.showModal) $dlg.showModal(); else $dlg.setAttribute('open','open');
    });
  }

  function statusError(msg) {
    setHtml($state, '<div style=\"color:#ff9c9c;font-weight:600\">' + html(msg) + '</div>');
  }
  function statusOk(msg) {
    setHtml($state, '<div style=\"color:#7cffb8;font-weight:600\">' + html(msg) + '</div>');
  }

  function renderLoggedIn(user) {
    setHtml($state,
      '<div style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap\">' +
        '<div style=\"width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#7cffb8,#8a5cff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;font-size:18px\">' + html((user.name || user.userId).slice(0,1).toUpperCase()) + '</div>' +
        '<div style=\"flex:1;min-width:200px\">' +
          '<div style=\"font-size:18px;font-weight:600\">' + html(user.name || 'Signed in') + '</div>' +
          '<div style=\"color:var(--ink-dim);font-size:13px\">' + (user.email ? html(user.email) + ' \u00b7 ' : '') + '<code style=\"font-size:12px;color:#9ab4ff\">' + html(user.userId) + '</code></div>' +
          '<div style=\"color:var(--ink-dim);font-size:12px;margin-top:4px\">' + (function(){ var d = user.createdAt ? new Date(user.createdAt) : null; return (d && !isNaN(d.getTime())) ? 'Member since ' + html(d.toLocaleDateString()) : 'Active account'; })() + '</div>' +
        '</div>' +
        '<span style=\"background:rgba(124,255,184,.15);color:#7cffb8;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600\">\u25cf Signed in</span>' +
        '<a class=\"btn btn-primary\" href=\"/social-network\" data-link style=\"margin-left:auto\">Open ZeusAI Social \u2192</a>' +
      '</div>');
    // Commerce ledger mount — paid orders, entitlements, downloadable deliverables.
    setHtml($panels,
      '<div id=\"accountRoot\" data-commerce-mount=\"1\"></div>' +
      '<p style=\"color:var(--ink-dim);font-size:12.5px;margin:10px 0 0;line-height:1.5\">After BTC payment confirms, your signed receipt, license and deliverable appear below. Add the same email at checkout so orders bind to this account.</p>');
    try {
      if (user && user.email) localStorage.setItem('u_email', String(user.email));
    } catch (_) {}
    function tryHydrateCommerce(attempt) {
      try {
        if (typeof window.hydrateAccount === 'function') {
          window.hydrateAccount();
          return;
        }
      } catch (_) {}
      if ((attempt || 0) < 25) setTimeout(function(){ tryHydrateCommerce((attempt || 0) + 1); }, 200);
    }
    tryHydrateCommerce(0);
    try {
      var next = new URLSearchParams(location.search).get('next');
      if (next && next.charAt(0) === '/' && next.indexOf('//') < 0 && next.indexOf('/api') !== 0) {
        setTimeout(function(){ location.replace(next); }, 400);
      }
    } catch (_) {}
  }

  function renderLoggedOut() {
    setHtml($state,
      '<div style=\"font-size:15px;color:var(--ink-dim);line-height:1.55\">You are not signed in. Create a new account in 5 seconds, sign in with the key already saved on this device, or recover by importing your encrypted backup vault.</div>');
    setHtml($panels,
      '<div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px\">' +
        '<div class=\"card\" style=\"padding:22px\">' +
          '<h3 style=\"margin:0 0 6px\">Create new account</h3>' +
          '<p style=\"color:var(--ink-dim);font-size:13.5px;margin:0 0 14px\">Generates an Ed25519 keypair on this device. You will be prompted to download an encrypted backup.</p>' +
          '<input id=\"acaName\" placeholder=\"Display name (optional)\" style=\"width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:8px;font-size:14px\">' +
          '<input id=\"acaEmail\" type=\"email\" placeholder=\"Email (optional, for hint only)\" style=\"width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-bottom:14px;font-size:14px\">' +
          '<button id=\"acaCreate\" class=\"btn btn-primary\" style=\"width:100%;padding:12px\">Create account \u2192</button>' +
        '</div>' +
        '<div class=\"card\" style=\"padding:22px\">' +
          '<h3 style=\"margin:0 0 6px\">Sign in (this device)</h3>' +
          '<p style=\"color:var(--ink-dim);font-size:13.5px;margin:0 0 14px\">If you already created an account on this browser, just tap below. The key is read from IndexedDB \u2014 no password.</p>' +
          '<button id=\"acaSignin\" class=\"btn btn-primary\" style=\"width:100%;padding:12px\">Sign in with this device \u2192</button>' +
          '<hr style=\"border:none;border-top:1px solid rgba(255,255,255,.08);margin:18px 0\">' +
          '<h3 style=\"margin:0 0 6px;font-size:15px\">Recover account · Import vault</h3>' +
          '<p style=\"color:var(--ink-dim);font-size:13px;margin:0 0 10px\">Restore access from the encrypted <code style=\"color:#7cffb8\">.zeus-vault</code> backup file you downloaded at account creation.</p>' +
          '<input id=\"acaVaultFile\" type=\"file\" accept=\".zeus-vault,.json,application/json\" style=\"width:100%;font-size:13px;color:#cdd5e6;margin-bottom:8px\">' +
          '<button id=\"acaImport\" class=\"btn btn-ghost\" style=\"width:100%;padding:10px\">Import &amp; sign in \u2192</button>' +
        '</div>' +
      '</div>');

    document.getElementById('acaCreate').addEventListener('click', onCreate);
    document.getElementById('acaSignin').addEventListener('click', onSignin);
    document.getElementById('acaImport').addEventListener('click', onImport);
  }

  function persistKeyAndAuth(privateKey, publicKeyB64, userId, token) {
    return Promise.all([
      dbPut(KEY_ID, { priv: privateKey, pub: publicKeyB64 })
    ]).then(function(){
      try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USERID_KEY, userId); } catch(_) {}
    });
  }

  function onCreate() {
    var name = (document.getElementById('acaName').value || '').trim();
    var email = (document.getElementById('acaEmail').value || '').trim();
    var btn = document.getElementById('acaCreate');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating\u2026'; }
    statusOk('Generating keypair\u2026');
    genKeypair().then(function(kp){
      return Promise.all([exportPublicRaw(kp), exportPrivatePkcs8(kp)]).then(function(arr){
        var publicRaw = arr[0], privatePkcs8 = arr[1];
        var publicKeyB64 = b64encode(publicRaw);
        return api('/api/cryptoauth/register', { publicKey: publicKeyB64, name: name, email: email }).then(function(r){
          if (r.status !== 200 || !r.body || !r.body.ok) throw new Error((r.body && r.body.error) || 'register_failed');
          var userId = r.body.userId;
          // Sign challenge to immediately log in; auto-retry once on expiry.
          function doLoginWithChallenge(challenge, attempt) {
            return sign(kp.privateKey, utf8(challenge)).then(function(sig){
              return api('/api/cryptoauth/login', { userId: userId, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
                if (lr.status === 400 && lr.body && lr.body.error === 'challenge_invalid_or_expired' && attempt < 2) {
                  statusOk('Refreshing session\u2026');
                  return api('/api/cryptoauth/challenge', { userId: userId }).then(function(cr){
                    if (cr.status !== 200 || !cr.body || !cr.body.challenge) throw new Error((cr.body && cr.body.error) || 'login_after_register_failed');
                    return doLoginWithChallenge(cr.body.challenge, attempt + 1);
                  });
                }
                if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error((lr.body && lr.body.error) || 'login_after_register_failed');
                return persistKeyAndAuth(kp.privateKey, publicKeyB64, userId, lr.body.token).then(function(){
                  return promptBackupDownload(privatePkcs8, publicRaw, { userId: userId, name: name, email: email }).then(function(){
                    return refresh();
                  });
                });
              });
            });
          }
          return doLoginWithChallenge(r.body.challenge, 1);
        });
      });
    }).catch(function(e){
      statusError('Nu s-a putut crea contul: ' + friendlyError(e.message || e));
      if (btn) { btn.disabled = false; btn.textContent = 'Create account \u2192'; }
    });
  }

  function promptBackupDownload(privatePkcs8, publicRaw, meta) {
    var bodyHtml =
      '<p>Your private key was just generated <b>on this device</b>. Download the encrypted backup file now \u2014 it is the only way to recover your account on another device or after wiping this browser.</p>' +
      '<label style=\"display:block;margin-top:12px;font-size:13px;color:#cdd5e6\">Encryption password (min 8 chars)</label>' +
      '<input id=\"acaVaultPw\" type=\"password\" autocomplete=\"new-password\" style=\"width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-top:6px\">' +
      '<div id=\"acaVaultErr\" style=\"color:#ff9c9c;font-size:12.5px;margin-top:8px\"></div>';
    return showDialog('Download your backup vault', bodyHtml, 'Download .zeus-vault').then(function(ok){
      if (!ok) {
        // Allow user to skip but warn.
        return showDialog('Skip backup?', '<p style=\"color:#ff9c9c\"><b>Warning:</b> Without the backup file, you will lose access if this browser is cleared or if you switch devices.</p>', 'Skip anyway').then(function(skip){
          if (skip) return; else return promptBackupDownload(privatePkcs8, publicRaw, meta);
        });
      }
      var pw = (document.getElementById('acaVaultPw') || {}).value || '';
      if (pw.length < 8) {
        return showDialog('Password too short', '<p style=\"color:#ff9c9c\">Use at least 8 characters.</p>', 'Try again').then(function(){
          return promptBackupDownload(privatePkcs8, publicRaw, meta);
        });
      }
      return encryptVault(privatePkcs8, publicRaw, meta, pw).then(function(vault){
        var blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'zeus-' + (meta.userId || 'account').slice(0, 16) + '.zeus-vault';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      });
    });
  }

  function onSignin() {
    statusOk('Reading local key\u2026');
    dbGet(KEY_ID).then(function(rec){
      if (!rec || !rec.priv || !rec.pub) {
        return statusError('No local key on this device. Use \"Create new account\" or \"Import vault\".');
      }
      // Auto-retry once when challenge expired (e.g. after server restart).
      function doChallengeThenLogin(attempt) {
        return api('/api/cryptoauth/challenge', { publicKey: rec.pub }).then(function(r){
          if (r.status === 404) return api('/api/cryptoauth/register', { publicKey: rec.pub });
          return r;
        }).then(function(r){
          if (r.status !== 200 || !r.body || !r.body.ok) throw new Error((r.body && r.body.error) || 'challenge_failed');
          var userId = r.body.userId;
          var challenge = r.body.challenge;
          return sign(rec.priv, utf8(challenge)).then(function(sig){
            return api('/api/cryptoauth/login', { userId: userId, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
              if (lr.status === 400 && lr.body && lr.body.error === 'challenge_invalid_or_expired' && attempt < 2) {
                statusOk('Retrying sign-in\u2026');
                return doChallengeThenLogin(attempt + 1);
              }
              if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error((lr.body && lr.body.error) || 'login_failed');
              try { localStorage.setItem(TOKEN_KEY, lr.body.token); localStorage.setItem(USERID_KEY, userId); } catch(_){}
              return refresh();
            });
          });
        });
      }
      return doChallengeThenLogin(1);
    }).catch(function(e){ statusError('Sign in failed: ' + friendlyError(e.message || e)); });
  }

  function onImport() {
    var f = (document.getElementById('acaVaultFile') || {}).files;
    if (!f || !f[0]) return statusError('Choose a .zeus-vault file first.');
    var file = f[0];
    showDialog('Decrypt vault', '<p>Enter the password you set when you downloaded this vault.</p><label style=\"display:block;margin-top:10px;font-size:13px;color:#cdd5e6\">Vault password</label><input id=\"acaImportPw\" type=\"password\" style=\"width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid rgba(138,92,255,.3);background:rgba(10,8,30,.4);color:#fff;margin-top:6px\">', 'Decrypt').then(function(ok){
      if (!ok) return;
      var pw = (document.getElementById('acaImportPw') || {}).value || '';
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var vault = JSON.parse(reader.result);
          decryptVault(vault, pw).then(function(unpacked){
            var pkcs8 = b64decode(unpacked.priv);
            var pubB64 = unpacked.pub;
            return importPrivate(pkcs8.buffer).then(function(privKey){
              // Auto-retry once on challenge_invalid_or_expired (server restart race).
              function doRegisterRecover(attempt) {
                statusOk(attempt > 1 ? 'Retrying recovery\u2026' : 'Recovering account\u2026');
                return api('/api/cryptoauth/register', { publicKey: pubB64 }).then(function(r){
                  if (r.status !== 200 || !r.body || !r.body.ok) throw new Error((r.body && r.body.error) || 'recover_register_failed');
                  var userId = r.body.userId;
                  var challenge = r.body.challenge;
                  return sign(privKey, utf8(challenge)).then(function(sig){
                    return api('/api/cryptoauth/recover', { publicKey: pubB64, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
                      if (lr.status === 400 && lr.body && lr.body.error === 'challenge_invalid_or_expired' && attempt < 2) {
                        return doRegisterRecover(attempt + 1);
                      }
                      if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error((lr.body && lr.body.error) || 'recover_failed');
                      return persistKeyAndAuth(privKey, pubB64, userId, lr.body.token).then(refresh);
                    });
                  });
                });
              }
              return doRegisterRecover(1);
            });
          }).catch(function(e){
            var code = e && e.message;
            if (code === 'recover_register_failed' || code === 'recover_failed' || code === 'too_many_requests') {
              statusError(friendlyError(code));
            } else {
              statusError('Decryption failed. Wrong password or corrupted vault.');
            }
          });
        } catch (e) { statusError('Could not parse vault file.'); }
      };
      reader.onerror = function(){ statusError('Could not read the vault file. Try selecting it again.'); };
      reader.readAsText(file);
    });
  }

  function logout() {
    var t;
    try { t = localStorage.getItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USERID_KEY); } catch(_){}
    api('/api/cryptoauth/logout', { token: t }).catch(function(){});
    refresh();
  }
  function wipeLocal() {
    showDialog('Wipe local key?', '<p style=\"color:#ff9c9c\">This removes your private key from this browser. Without your <code style=\"color:#7cffb8\">.zeus-vault</code> backup file, you will lose access to this account.</p>', 'Wipe').then(function(ok){
      if (!ok) return;
      Promise.all([dbDel(KEY_ID)]).then(function(){
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USERID_KEY); } catch(_){}
        refresh();
      }).catch(function(){
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USERID_KEY); } catch(_){}
        refresh();
      });
    });
  }
  if ($logout) $logout.addEventListener('click', logout);
  if ($wipe) $wipe.addEventListener('click', wipeLocal);

  function refresh() {
    var token; try { token = localStorage.getItem(TOKEN_KEY); } catch(_) { token = null; }
    if (!token) { renderLoggedOut(); return Promise.resolve(); }
    return apiGet('/api/cryptoauth/me', token).then(function(r){
      if (r.status === 200 && r.body && r.body.ok) renderLoggedIn(r.body);
      else { try { localStorage.removeItem(TOKEN_KEY); } catch(_){} renderLoggedOut(); }
    }).catch(function(){ renderLoggedOut(); });
  }

  refresh();
})();
</script>`;
}

function pageEnterprise() {
  const modules = [
    { id: 'aws-auto-healer', icon: '🛠️', title: 'AWS Auto-Healer', tagline: 'Self-healing infrastructure for AWS — detects faults, auto-restarts, fails over without humans.', endpoint: '/api/enterprise/aws/auto-heal', kpi: 'MTTR < 90s' },
    { id: 'gcp-cost-optimizer', icon: '📉', title: 'Google Cost Optimizer', tagline: 'Continuous GCP spend reduction — rightsizing, commitment optimization, idle resource cleanup.', endpoint: '/api/enterprise/gcp/cost-optimize', kpi: 'Up to −40% spend' },
    { id: 'azure-security-bot', icon: '🛡️', title: 'Azure Security Bot', tagline: 'Continuously audits and auto-remediates misconfigurations across Azure subscriptions.', endpoint: '/api/enterprise/azure/security-scan', kpi: 'CIS L1+L2 enforced' },
    { id: 'multi-cloud-orchestrator', icon: '☁️', title: 'Multi-Cloud Orchestrator', tagline: 'Workload portability — migrate live between AWS, GCP, Azure based on price/latency/policy.', endpoint: '/api/enterprise/multi-cloud/migrate', kpi: 'Zero-downtime moves' },
    { id: 'k8s-self-healer', icon: '⚙️', title: 'K8s Self-Healer', tagline: 'Watches every cluster — heals broken pods, restarts deployments, repairs node-level drift.', endpoint: '/api/enterprise/k8s/heal', kpi: '99.99%+ uptime' },
    { id: 'database-optimizer', icon: '🗄️', title: 'Database Optimizer', tagline: 'AI rewrites slow queries, indexes hot tables, vacuums and tunes — Postgres, MySQL, Mongo.', endpoint: '/api/enterprise/db/optimize', kpi: 'Up to 10× faster' },
    { id: 'disaster-recovery-autopilot', icon: '🚀', title: 'Disaster Recovery Autopilot', tagline: 'Continuous backup, geo-replication, signed restoration drills — every 24h, fully automated.', endpoint: '/api/enterprise/dr/run', kpi: 'RPO ≤ 60s, RTO ≤ 15m' },
  ];
  const moduleCards = modules.map(m => `
    <div class="card ent-module-card" data-module-id="${m.id}" style="padding:24px;display:flex;flex-direction:column;gap:12px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(20,12,40,.55),rgba(8,6,18,.55))">
      <div style="font-size:34px;line-height:1">${m.icon}</div>
      <h3 style="font-size:20px;line-height:1.2;margin:0;letter-spacing:-0.01em">${m.title}</h3>
      <p style="color:var(--ink-dim);font-size:14px;margin:0;line-height:1.55">${m.tagline}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);margin-top:auto">
        <code class="inline" style="font-size:11px;color:#6fd3ff">${m.endpoint}</code>
        <span style="font-size:11px;color:#ffd36a;font-weight:600">${m.kpi}</span>
      </div>
      <button type="button" class="btn btn-ghost ent-module-cta" data-module="${m.id}" data-module-title="${m.title}" style="font-size:13px;padding:8px 14px">Request demo →</button>
    </div>`).join('');

  const apiExamples = modules.slice(0, 3).map(m => `
    <details style="margin-bottom:8px;background:rgba(8,6,18,.5);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:14px 18px">
      <summary style="cursor:pointer;font-weight:600;color:#6fd3ff">${m.endpoint}</summary>
      <pre style="margin:12px 0 0;padding:14px;background:#000;border-radius:6px;overflow:auto;font-size:12px;line-height:1.5;color:#a3ffce"><code>POST ${m.endpoint}
Authorization: Bearer &lt;ENTERPRISE_API_TOKEN&gt;
Content-Type: application/json

{
  "tenantId": "your-org-id",
  "scope": ["prod", "staging"],
  "dryRun": false
}

→ 200 OK
{
  "ok": true,
  "module": "${m.id}",
  "actions": [...],
  "kpi": "${m.kpi}",
  "auditId": "audit-2026-..."
}</code></pre>
    </details>`).join('');

  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1280px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#ffd36a">Enterprise · Hyperscaler grade</span>
    <h1 style="font-size:clamp(40px,5.4vw,72px);line-height:1.02;margin:14px 0 18px;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#ffd36a 40%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Licenses built for AWS, Google, Microsoft, Meta, Apple, Amazon.</h1>
    <p style="color:var(--ink-dim);font-size:19px;max-width:900px;line-height:1.55">Enterprise licenses and transformations are scoped under a signed SOW with human deal leads — not a self-serve cart. Pricing is proposal-based from the catalogue anchors below. Every engagement includes signed deliverables, milestone acceptance, and BTC or wire settlement options agreed in the contract.</p>

    <div style="display:flex;gap:14px;flex-wrap:wrap;margin:28px 0 0">
      <a href="#enterprise-contact" class="btn btn-gold" style="font-size:16px;padding:14px 26px">📩 Contact Enterprise Sales</a>
      <a href="#enterprise-modules" class="btn btn-ghost" style="font-size:16px;padding:14px 26px">View modules</a>
      <a href="#enterprise-api" class="btn btn-ghost" style="font-size:16px;padding:14px 26px">API endpoints</a>
    </div>

    <div id="entSummary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:32px 0 40px">
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Products</div><div style="font-size:32px;font-weight:700;margin-top:6px" id="entProducts">10</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Target accounts</div><div style="font-size:32px;font-weight:700;margin-top:6px" id="entAccounts">—</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Portfolio anchor</div><div style="font-size:32px;font-weight:700;margin-top:6px;color:#8a5cff" id="entAnchor">—</div></div>
      <div class="card" style="padding:20px"><div style="color:var(--ink-dim);font-size:12px;text-transform:uppercase;letter-spacing:.12em">Topstone potential</div><div style="font-size:32px;font-weight:700;margin-top:6px;color:#ffd36a" id="entTop">—</div></div>
    </div>

    <h2 id="enterprise-modules" style="font-size:32px;letter-spacing:-0.01em;margin:60px 0 8px">Enterprise modules — production-ready</h2>
    <p style="color:var(--ink-dim);font-size:15px;max-width:800px;margin:0 0 24px">Seven flagship modules covering cloud reliability, cost, security and disaster recovery. Each is exposed as a public API, deployable on your VPC or ours, with signed audit trails.</p>
    <div id="entModulesGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:20px;margin-bottom:60px">${moduleCards}</div>

    <h2 id="enterprise-api" style="font-size:32px;letter-spacing:-0.01em;margin:60px 0 8px">API endpoints exposed</h2>
    <p style="color:var(--ink-dim);font-size:15px;max-width:800px;margin:0 0 24px">Every enterprise module is fully programmatic. Request a sandbox token via the contact form below — typical turnaround &lt; 4 hours.</p>
    <div style="margin-bottom:24px">${apiExamples}</div>
    <p style="color:var(--ink-dim);font-size:13px;margin-bottom:60px">📖 Full reference: <a href="/docs" data-link style="color:#6fd3ff">/docs</a> · 🧪 Sandbox available on request · 🔐 Every response is Ed25519-signed.</p>

    <h2 style="font-size:32px;letter-spacing:-0.01em;margin:60px 0 8px">Enterprise license catalogue</h2>
    <p style="color:var(--ink-dim);font-size:15px;max-width:800px;margin:0 0 24px">Ten pre-packaged Anchor &amp; Topstone licenses for hyperscalers and Fortune 50.</p>
    <div id="entProductsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr));gap:22px;margin-bottom:50px"></div>
    <div id="entNegotiator" style="margin:40px 0"></div>
    <div id="entDeals" style="margin:40px 0 60px"></div>

    <section id="enterprise-contact" style="margin:60px 0 80px;padding:40px;border:1px solid rgba(255,211,106,.3);border-radius:14px;background:linear-gradient(180deg,rgba(255,211,106,.04),rgba(138,92,255,.04))">
      <h2 style="font-size:32px;letter-spacing:-0.01em;margin:0 0 6px;background:linear-gradient(135deg,#ffd36a 0%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Contact Enterprise Sales</h2>
      <p style="color:var(--ink-dim);font-size:15px;max-width:700px;margin:0 0 24px">Tell us about your scale, your stack, and what you need to ship. We reply within <b style="color:#fff">24 hours</b>. For procurement &amp; legal, ask for the deal-desk packet.</p>
      <form id="entContactForm" class="phone-stack" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:760px" novalidate>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Full name *
          <input name="name" required maxlength="200" placeholder="Jane Doe" style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px" />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Company *
          <input name="company" required maxlength="200" placeholder="Acme Corp" style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px" />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Work email *
          <input name="email" type="email" required maxlength="200" placeholder="jane@acme.com" style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px" />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Phone (optional)
          <input name="phone" maxlength="80" placeholder="+1 555 ..." style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px" />
        </label>
        <label style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Module of interest
          <select name="interest" style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px">
            <option value="">— Select (optional) —</option>
            ${modules.map(m => `<option value="${m.id}">${m.title}</option>`).join('')}
            <option value="anchor-license">Anchor / Topstone license</option>
            <option value="custom">Custom deployment</option>
          </select>
        </label>
        <label style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-dim)">Message *
          <textarea name="message" required maxlength="4000" rows="5" placeholder="Tell us about your scale, timeline, security requirements..." style="padding:12px 14px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.3);color:#fff;border-radius:8px;font-size:14px;resize:vertical;min-height:120px;font-family:inherit"></textarea>
        </label>
        <div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:6px">
          <p style="color:var(--ink-dim);font-size:12px;margin:0">By submitting you accept our <a href="/legal" data-link style="color:#6fd3ff">terms</a> &amp; <a href="/dpa" data-link style="color:#6fd3ff">DPA</a>. No newsletter spam.</p>
          <button type="submit" class="btn btn-gold" style="padding:14px 28px;font-size:15px;font-weight:600">Send to Enterprise Sales →</button>
        </div>
        <div id="entContactStatus" style="grid-column:1/-1;display:none;padding:14px 18px;border-radius:8px;font-size:14px"></div>
      </form>
    </section>
  </div>
</section>`;
}

function pageCryptoFiatBridge() {
  return `<section style="padding-top:140px;max-width:1120px">
  <span class="kicker">Transfer Intelligence · non-custodial</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Crypto ↔ Fiat <span class="grad">routing intelligence.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">ZeusAI computes optimal routing, fees and destination risk checks for crypto transfer workflows <strong style="color:#fff">without ever holding funds</strong>. Responses are signed recommendations and optional owner-routed fee invoices — not a custodial bridge.</p>

  <div class="grid" id="cbCards" style="margin-top:22px"><div class="card" style="padding:18px"><p>Loading services…</p></div></div>

  <div class="card" style="margin-top:22px;padding:18px">
    <span class="tag">Live BTC rate</span>
    <h3 id="cbRate" style="margin:8px 0">$…</h3>
    <p id="cbRateMeta" style="color:var(--ink-dim);font-size:13px;margin:0">Fetching live source…</p>
  </div>

  <div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px">
    <div class="card" style="padding:18px">
      <span class="tag">Tool · Destination check</span>
      <h3 style="margin:8px 0 10px">Is this address safe to send to?</h3>
      <div class="field"><label>BTC / ETH address</label><input id="cbDestAddr" placeholder="bc1q… or 0x…" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      <div class="field"><label>Amount USD (optional)</label><input id="cbDestUsd" type="number" value="100" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      <button class="btn btn-primary" id="cbDestBtn" style="width:100%;justify-content:center;margin-top:8px">Check destination →</button>
      <pre class="code" id="cbDestOut" style="margin-top:12px;max-height:220px;overflow:auto;font-size:12px">Result will appear here.</pre>
    </div>
    <div class="card" style="padding:18px">
      <span class="tag">Tool · Fee lock</span>
      <h3 style="margin:8px 0 10px">Lock a mempool fee quote</h3>
      <div class="field"><label>Amount BTC</label><input id="cbFeeAmt" type="number" step="0.0001" value="0.001" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      <div class="field"><label>Priority</label><select id="cbFeePri" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"><option value="fastestFee">fastest</option><option value="halfHourFee">~30 min</option><option value="hourFee">~1 hour</option><option value="economyFee">economy</option></select></div>
      <button class="btn btn-primary" id="cbFeeBtn" style="width:100%;justify-content:center;margin-top:8px">Lock fee quote →</button>
      <pre class="code" id="cbFeeOut" style="margin-top:12px;max-height:220px;overflow:auto;font-size:12px">Result will appear here.</pre>
    </div>
    <div class="card" style="padding:18px">
      <span class="tag">Tool · Smart routing</span>
      <h3 style="margin:8px 0 10px">Recommend a transfer path</h3>
      <div class="field"><label>Destination address</label><input id="cbRouteAddr" placeholder="bc1q…" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      <div class="field"><label>Amount</label><input id="cbRouteAmt" type="number" step="0.0001" value="0.01" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      <div class="field"><label>Currency</label><select id="cbRouteCur" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"><option>BTC</option><option>ETH</option></select></div>
      <button class="btn btn-primary" id="cbRouteBtn" style="width:100%;justify-content:center;margin-top:8px">Compute route →</button>
      <pre class="code" id="cbRouteOut" style="margin-top:12px;max-height:220px;overflow:auto;font-size:12px">Result will appear here.</pre>
    </div>
  </div>

  <div class="card" style="margin-top:22px;padding:18px">
    <h3 style="margin:0 0 8px">API surface</h3>
    <ul style="margin:0;padding-left:18px;color:var(--ink-dim);line-height:1.8">
      <li><code class="inline">GET /api/crypto-bridge/services</code></li>
      <li><code class="inline">GET /api/crypto-bridge/btc-rate</code></li>
      <li><code class="inline">GET /api/crypto-bridge/destination-check</code></li>
      <li><code class="inline">GET /api/crypto-bridge/fee-lock</code></li>
      <li><code class="inline">POST /api/crypto-bridge/smart-routing</code></li>
      <li><code class="inline">GET /api/crypto-bridge/health</code></li>
    </ul>
    <p style="color:var(--ink-dim);font-size:13px;margin:12px 0 0">Honesty: ZeusAI never custodians, never re-routes value, never holds private keys. Tools return recommendations from public on-chain feeds.</p>
  </div>

  <script>
  (async function(){
    function show(el, obj){ if(!el) return; el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2); }
    var host = document.getElementById('cbCards');
    try {
      const servicesResp = await fetch('/api/crypto-bridge/services');
      const servicesJson = await servicesResp.json();
      const services = Array.isArray(servicesJson && servicesJson.services) ? servicesJson.services : [];
      if (host) {
        host.innerHTML = services.length
          ? services.map(function(s){
              return '<div class="card" style="padding:18px">'
                + '<span class="tag">'+(s.id || 'service')+'</span>'
                + '<h3 style="margin:8px 0">'+(s.name || 'Crypto service')+'</h3>'
                + '<p style="color:var(--ink-dim);font-size:13.5px">'+(s.tagline || '')+'</p>'
                + '</div>';
            }).join('')
          : '<div class="card" style="padding:18px"><p style="color:var(--ink-dim)">No services available right now.</p></div>';
      }
    } catch(_) {
      if (host) host.innerHTML = '<div class="card" style="padding:18px"><p style="color:var(--ink-dim)">Crypto bridge services unavailable. Try again in a moment.</p></div>';
    }

    var rateEl = document.getElementById('cbRate');
    var meta = document.getElementById('cbRateMeta');
    try {
      const rateResp = await fetch('/api/crypto-bridge/btc-rate');
      const rateJson = await rateResp.json();
      var rate = Number(rateJson && (rateJson.rate || rateJson.usd || 0));
      if (rateEl) rateEl.textContent = rate > 0 ? '$' + rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Rate unavailable';
      if (meta) meta.textContent = 'Source: ' + ((rateJson && rateJson.source) || 'unknown') + (rateJson && rateJson.degraded ? ' · degraded fallback' : ' · live');
    } catch(_) {
      if (rateEl) rateEl.textContent = 'Rate unavailable';
      if (meta) meta.textContent = 'Live source temporarily offline';
    }

    var destBtn = document.getElementById('cbDestBtn');
    if (destBtn) destBtn.addEventListener('click', async function(){
      var out = document.getElementById('cbDestOut'); show(out, 'Checking…');
      try {
        var q = new URLSearchParams({ address: (document.getElementById('cbDestAddr').value||'').trim(), amountUsd: document.getElementById('cbDestUsd').value||'0' });
        var d = await (await fetch('/api/crypto-bridge/destination-check?'+q)).json();
        show(out, d);
      } catch(e) { show(out, 'Error: '+(e.message||e)); }
    });
    var feeBtn = document.getElementById('cbFeeBtn');
    if (feeBtn) feeBtn.addEventListener('click', async function(){
      var out = document.getElementById('cbFeeOut'); show(out, 'Locking…');
      try {
        var q = new URLSearchParams({ amount: document.getElementById('cbFeeAmt').value||'0.001', priority: document.getElementById('cbFeePri').value||'fastestFee' });
        var d = await (await fetch('/api/crypto-bridge/fee-lock?'+q)).json();
        show(out, d);
      } catch(e) { show(out, 'Error: '+(e.message||e)); }
    });
    var routeBtn = document.getElementById('cbRouteBtn');
    if (routeBtn) routeBtn.addEventListener('click', async function(){
      var out = document.getElementById('cbRouteOut'); show(out, 'Computing…');
      try {
        var body = {
          address: (document.getElementById('cbRouteAddr').value||'').trim(),
          amount: Number(document.getElementById('cbRouteAmt').value)||0.01,
          currency: document.getElementById('cbRouteCur').value||'BTC',
          maxWaitHours: 1
        };
        var d = await (await fetch('/api/crypto-bridge/smart-routing', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })).json();
        show(out, d);
      } catch(e) { show(out, 'Error: '+(e.message||e)); }
    });
  })();
  </script>
</section>`;
}

// ----------------------------------------------------------------------------
// DeepSeek Autonomy Cockpit (objective `deepseek-autonomy-cockpit`).
// Read-only operator console that surfaces the autonomous loop's state:
//   • Roadmap objectives (GET /api/admin/roadmap)
//   • Governor status + counters (GET /api/admin/deepseek/status)
//   • Pending operator commands (GET /api/admin/deepseek/commands)
//   • Latest code_proposal envelopes (GET /api/admin/deepseek/proposals)
// Plus a "Queue command" form (POST /api/admin/deepseek/command) so operators
// can steer DeepSeek without curl. Token is provided by the operator and kept
// in sessionStorage only — never embedded in SSR HTML. All API-sourced strings
// are written via textContent to avoid XSS even if a malicious envelope lands
// in data/deepseek-proposals/.
// ----------------------------------------------------------------------------
// Cockpit DeepSeek (obiectiv `deepseek-autonomy-cockpit`).
// Consolă operator read-only care expune starea loop-ului autonom:
//   • Roadmap, status governor, comenzi în coadă, ultimele propuneri.
// Token-ul e introdus de operator și păstrat doar în sessionStorage.
function pageDeepseekCockpit() {
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">DeepSeek Autonomy Cockpit · admin-only</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Roadmap, proposals and <span class="grad">operator commands in one cockpit.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">Live view of the autonomous DeepSeek loop: roadmap objectives, governor status, queued operator instructions and the latest <code class="inline">code_proposal</code> envelopes awaiting review. Paste your admin token to load the data — it is kept in browser session storage only.</p>

  <div class="card" style="margin-top:22px;padding:18px">
    <label for="dsToken" style="font-size:12px;color:var(--ink-dim);display:block;margin-bottom:6px">Admin token (x-auth-token / Bearer / DEEPSEEK_LOOP_ADMIN_TOKEN)</label>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="dsToken" type="password" autocomplete="off" placeholder="paste admin token" style="flex:1 1 320px;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px;font-family:ui-monospace,monospace">
      <button id="dsLoadBtn" class="btn btn-primary" type="button">Refresh</button>
      <button id="dsClearBtn" class="btn" type="button">Clear token</button>
    </div>
    <p id="dsAuthMsg" style="color:var(--ink-dim);font-size:13px;margin:10px 0 0;min-height:18px">Token is held in sessionStorage only — never sent to anywhere except <code class="inline">/api/admin/deepseek/*</code> and <code class="inline">/api/admin/roadmap</code> on this origin.</p>
  </div>

  <div class="grid" id="dsSummary" style="margin-top:22px"><div class="card"><p>Summary will appear here after you load with a valid token.</p></div></div>

  <div class="card" style="margin-top:22px;padding:18px">
    <span class="tag">Roadmap</span>
    <h3 style="margin:8px 0 12px">Objectives</h3>
    <div id="dsRoadmap"><p style="color:var(--ink-dim);margin:0">Roadmap will appear here after refresh.</p></div>
  </div>

  <div class="card" style="margin-top:22px;padding:18px">
    <span class="tag">Operator command queue</span>
    <h3 style="margin:8px 0 12px">Queue a new instruction</h3>
    <form id="dsCmdForm" style="display:grid;gap:10px;max-width:720px">
      <label style="font-size:12px;color:var(--ink-dim)">Instruction (max 4096 chars)</label>
      <textarea id="dsCmdInstr" rows="3" maxlength="4096" placeholder="e.g. Audit /api/instant/catalog response and propose a fail-soft fix" style="padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px;font-family:ui-monospace,monospace"></textarea>
      <label style="font-size:12px;color:var(--ink-dim)">Priority</label>
      <select id="dsCmdPri" style="padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px;max-width:200px">
        <option value="1">1 — top</option>
        <option value="2" selected>2 — high</option>
        <option value="3">3 — normal</option>
        <option value="5">5 — low</option>
      </select>
      <div><button class="btn btn-primary" type="submit">Queue command</button></div>
      <p id="dsCmdMsg" style="color:var(--ink-dim);font-size:13px;margin:0;min-height:18px"></p>
    </form>
    <h3 style="margin:18px 0 8px">Pending</h3>
    <div id="dsCmdList"><p style="color:var(--ink-dim);margin:0">Queue will appear here after refresh.</p></div>
  </div>

  <div class="card" style="margin-top:22px;padding:18px">
    <span class="tag">code_proposal envelopes</span>
    <h3 style="margin:8px 0 12px">Latest proposals (review-only — never auto-applied)</h3>
    <div id="dsProposals"><p style="color:var(--ink-dim);margin:0">Proposals will appear here after refresh.</p></div>
  </div>

  <pre class="code" id="dsRaw" style="margin-top:22px;max-height:280px;overflow:auto">Raw governor status will appear here.</pre>

  <script>
  (function(){
    var TOKEN_KEY = 'zeus_ds_admin_token';
    var tokenInput = document.getElementById('dsToken');
    var authMsg = document.getElementById('dsAuthMsg');
    var summary = document.getElementById('dsSummary');
    var roadmapEl = document.getElementById('dsRoadmap');
    var cmdList = document.getElementById('dsCmdList');
    var proposalsEl = document.getElementById('dsProposals');
    var rawEl = document.getElementById('dsRaw');
    var cmdForm = document.getElementById('dsCmdForm');
    var cmdInstr = document.getElementById('dsCmdInstr');
    var cmdPri = document.getElementById('dsCmdPri');
    var cmdMsg = document.getElementById('dsCmdMsg');
    var loadBtn = document.getElementById('dsLoadBtn');
    var clearBtn = document.getElementById('dsClearBtn');

    try { var stored = sessionStorage.getItem(TOKEN_KEY); if (stored) tokenInput.value = stored; } catch(_){}

    function setAuthMsg(text, kind){
      authMsg.textContent = text;
      authMsg.style.color = kind === 'err' ? '#ff6b6b' : (kind === 'ok' ? '#7ee2a8' : 'var(--ink-dim)');
    }

    function el(tag, attrs, text){
      var n = document.createElement(tag);
      if (attrs) for (var k in attrs) { if (Object.prototype.hasOwnProperty.call(attrs,k)) n.setAttribute(k, attrs[k]); }
      if (text != null) n.textContent = String(text);
      return n;
    }

    function clearChildren(node){ while (node.firstChild) node.removeChild(node.firstChild); }

    function authHeaders(){
      var t = (tokenInput.value || '').trim();
      if (!t) return null;
      return { 'x-auth-token': t, 'authorization': 'Bearer ' + t };
    }

    async function fetchJson(url, opts){
      var headers = authHeaders();
      if (!headers) throw new Error('token_missing');
      var init = Object.assign({ headers: headers }, opts || {});
      if (init.body && !init.headers['content-type']) init.headers['content-type'] = 'application/json';
      var r = await fetch(url, init);
      if (r.status === 204) return null;
      var txt = await r.text();
      var j = null;
      try { j = txt ? JSON.parse(txt) : null; } catch(_){ j = { raw: txt }; }
      if (!r.ok) { var err = new Error('http_'+r.status); err.body = j; throw err; }
      return j;
    }

    function renderRoadmap(roadmap){
      clearChildren(roadmapEl);
      if (!roadmap || !Array.isArray(roadmap.objectives) || !roadmap.objectives.length){
        roadmapEl.appendChild(el('p', { style:'color:var(--ink-dim);margin:0' }, 'No objectives in roadmap.'));
        return;
      }
      var list = el('div', { style:'display:grid;gap:10px' });
      roadmap.objectives.slice().sort(function(a,b){ return (a.priority||99)-(b.priority||99); }).forEach(function(o){
        var row = el('div', { style:'padding:12px;border:1px solid #1f2a3b;border-radius:8px;background:#0b0f17' });
        var head = el('div', { style:'display:flex;gap:10px;flex-wrap:wrap;align-items:center' });
        head.appendChild(el('span', { class:'tag' }, 'P'+(o.priority||'?')));
        head.appendChild(el('span', { class:'tag' }, String(o.status||'unknown')));
        head.appendChild(el('strong', { style:'font-size:14px' }, String(o.id||'')));
        row.appendChild(head);
        row.appendChild(el('p', { style:'margin:6px 0 0;color:var(--ink-dim);font-size:13.5px' }, String(o.title||'')));
        if (o.metricEndpoint) row.appendChild(el('p', { style:'margin:4px 0 0;color:var(--ink-dim);font-size:12px;font-family:ui-monospace,monospace' }, o.metricEndpoint+' · target '+String(o.comparison||'')+' '+String(o.target||'')));
        list.appendChild(row);
      });
      roadmapEl.appendChild(list);
    }

    function renderCommands(commands){
      clearChildren(cmdList);
      var arr = Array.isArray(commands) ? commands : [];
      if (!arr.length){
        cmdList.appendChild(el('p', { style:'color:var(--ink-dim);margin:0' }, 'No pending operator commands.'));
        return;
      }
      var list = el('div', { style:'display:grid;gap:8px' });
      arr.forEach(function(c){
        var row = el('div', { style:'padding:10px;border:1px solid #1f2a3b;border-radius:8px;background:#0b0f17' });
        var head = el('div', { style:'display:flex;gap:8px;flex-wrap:wrap;align-items:center' });
        head.appendChild(el('span', { class:'tag' }, 'P'+(c.priority||'?')));
        head.appendChild(el('span', { class:'tag' }, c.consumed ? 'consumed' : 'pending'));
        head.appendChild(el('span', { style:'font-size:12px;color:var(--ink-dim);font-family:ui-monospace,monospace' }, String(c.id||'')));
        row.appendChild(head);
        row.appendChild(el('p', { style:'margin:6px 0 0;font-size:13.5px;white-space:pre-wrap' }, String(c.instruction||'')));
        list.appendChild(row);
      });
      cmdList.appendChild(list);
    }

    function renderProposals(data){
      clearChildren(proposalsEl);
      var arr = (data && Array.isArray(data.proposals)) ? data.proposals : [];
      if (!arr.length){
        proposalsEl.appendChild(el('p', { style:'color:var(--ink-dim);margin:0' }, 'No proposals yet.'));
        return;
      }
      var list = el('div', { style:'display:grid;gap:10px' });
      arr.forEach(function(p){
        var row = el('div', { style:'padding:12px;border:1px solid #1f2a3b;border-radius:8px;background:#0b0f17' });
        var head = el('div', { style:'display:flex;gap:8px;flex-wrap:wrap;align-items:center' });
        head.appendChild(el('span', { class:'tag' }, String(p.status||'pending-review')));
        if (p.riskLevel) head.appendChild(el('span', { class:'tag' }, 'risk:'+String(p.riskLevel)));
        if (p.bytes != null) head.appendChild(el('span', { class:'tag' }, String(p.bytes)+' B'));
        head.appendChild(el('span', { style:'font-size:12px;color:var(--ink-dim);font-family:ui-monospace,monospace' }, String(p.proposalId||'')));
        row.appendChild(head);
        if (p.targetPath) row.appendChild(el('p', { style:'margin:6px 0 0;font-size:13px;font-family:ui-monospace,monospace;color:var(--ink-dim)' }, String(p.targetPath)));
        if (p.objectiveId) row.appendChild(el('p', { style:'margin:4px 0 0;font-size:12px;color:var(--ink-dim)' }, 'objective: '+String(p.objectiveId)));
        if (p.rationalePreview) row.appendChild(el('p', { style:'margin:6px 0 0;font-size:13px;white-space:pre-wrap' }, String(p.rationalePreview)));
        list.appendChild(row);
      });
      proposalsEl.appendChild(list);
      var totalNote = el('p', { style:'margin:10px 0 0;color:var(--ink-dim);font-size:12px' }, 'Showing '+arr.length+' of '+String(data.total||arr.length)+'. Envelopes are NEVER auto-applied; review them in data/deepseek-proposals/ before merging.');
      proposalsEl.appendChild(totalNote);
    }

    function renderSummary(status, roadmap, commands, proposals){
      clearChildren(summary);
      var cards = [
        ['Objectives open', (roadmap && Array.isArray(roadmap.objectives)) ? roadmap.objectives.filter(function(o){return o.status!=='done';}).length : '—'],
        ['Pending commands', Array.isArray(commands) ? commands.filter(function(c){return !c.consumed;}).length : '—'],
        ['Proposals total', (proposals && proposals.total != null) ? proposals.total : '—'],
        ['Loop tick', (status && status.lastTickAt) ? status.lastTickAt : '—'],
        ['Loop state', (status && status.state) ? status.state : '—'],
        ['Actions today', (status && status.actionsToday != null) ? status.actionsToday : '—']
      ];
      cards.forEach(function(c){
        var card = el('div', { class:'card', style:'padding:14px' });
        card.appendChild(el('span', { class:'tag' }, String(c[0])));
        card.appendChild(el('h3', { style:'margin:6px 0 0' }, String(c[1])));
        summary.appendChild(card);
      });
    }

    async function refresh(){
      var h = authHeaders();
      if (!h){ setAuthMsg('Token required to load cockpit data.', 'err'); return; }
      setAuthMsg('Loading…', '');
      try { sessionStorage.setItem(TOKEN_KEY, tokenInput.value.trim()); } catch(_){}
      var status=null, roadmap=null, cmds=null, props=null, errs=[];
      try { status = await fetchJson('/api/admin/deepseek/status'); } catch(e){ errs.push('status:'+e.message); }
      try { roadmap = await fetchJson('/api/admin/roadmap'); } catch(e){ errs.push('roadmap:'+e.message); }
      try { var cj = await fetchJson('/api/admin/deepseek/commands?includeConsumed=0&limit=50'); cmds = cj && cj.commands; } catch(e){ errs.push('commands:'+e.message); }
      try { props = await fetchJson('/api/admin/deepseek/proposals?limit=20'); } catch(e){ errs.push('proposals:'+e.message); }
      renderSummary(status, roadmap, cmds, props);
      renderRoadmap(roadmap);
      renderCommands(cmds);
      renderProposals(props);
      try { rawEl.textContent = JSON.stringify(status || { error:'governor_unavailable' }, null, 2); } catch(_){ rawEl.textContent = 'status unavailable'; }
      if (errs.length) setAuthMsg('Loaded with errors: '+errs.join(' · '), 'err');
      else setAuthMsg('Loaded at '+new Date().toISOString(), 'ok');
    }

    loadBtn.addEventListener('click', function(ev){ ev.preventDefault(); refresh(); });
    clearBtn.addEventListener('click', function(ev){
      ev.preventDefault();
      tokenInput.value = '';
      try { sessionStorage.removeItem(TOKEN_KEY); } catch(_){}
      setAuthMsg('Token cleared.', '');
    });

    cmdForm.addEventListener('submit', async function(ev){
      ev.preventDefault();
      var instr = (cmdInstr.value || '').trim();
      if (!instr){ cmdMsg.textContent = 'Instruction is empty.'; cmdMsg.style.color = '#ff6b6b'; return; }
      var pri = parseInt(cmdPri.value, 10) || 3;
      cmdMsg.style.color = 'var(--ink-dim)';
      cmdMsg.textContent = 'Queuing…';
      try {
        var r = await fetchJson('/api/admin/deepseek/command', { method:'POST', body: JSON.stringify({ instruction: instr, priority: pri }) });
        cmdMsg.style.color = '#7ee2a8';
        cmdMsg.textContent = 'Queued (id '+ (r && r.id ? r.id : '?') + ', priority '+pri+').';
        cmdInstr.value = '';
        refresh();
      } catch(e){
        cmdMsg.style.color = '#ff6b6b';
        cmdMsg.textContent = 'Failed: '+(e && e.message || 'unknown') + ((e && e.body && e.body.error) ? ' · '+e.body.error : '');
      }
    });
  })();
  </script>
</section>`;
}

function renderRoute(route, params = {}) {
  switch (route) {
    case '/': return pageHome();
    case '/buy': return sellSurface.pageBuy();
    case '/outcomes': return sellSurface.pageOutcomes();
    case '/rails': return sellSurface.pageRails();
    case '/twin': return sellSurface.pageTwin(params.twinId || params.id || '');
    case '/vom': return sellSurface.pageVom();
    case '/continuity': return continuitySurface.pageContinuity();
    case '/standard': return merchantStandardSurface.pageStandard();
    case '/seo': return seoSurface.pageSeo();
    case '/social-network': return pageSocialNetwork();
    case '/services': return pageServices();
    case '/pricing': return pagePricing();
    case '/solutions/ai-pricing': return pageSolution('pricing');
    case '/solutions/ai-checkout': return pageSolution('checkout');
    case '/solutions/ai-self-healing': return pageSolution('ai-self-healing');
    case '/checkout':
    case '/checkout/': return pageCheckout(params);
    case '/dashboard': return pageDashboard();
    case '/how': return pageHow();
    case '/docs': return pageDocs();
    case '/about': return pageAbout();
    case '/legal': return pageLegal();
    case '/trust': return pageTrustCenter();
    case '/security': return pageSecurity();
    case '/responsible-ai': return pageResponsibleAi();
    case '/dpa': return pageDpa();
    case '/payment-terms': return pagePaymentTerms();
    case '/operator': return pageOperator();
    case '/observability': return pageObservability();
    case '/enterprise': return pageEnterprise();
    case '/crypto-fiat-bridge': return pageCryptoFiatBridge();
    case '/crypto-bridge': return pageCryptoFiatBridge();
    case '/store': return pageStore();
    case '/innovations': return pageInnovations();
    case '/innovation-log': return pageInnovations();
    case '/account': return pageAccount(params);
    case '/auth': return pageAccount(params);
    case '/login': return pageAccount(params);
    case '/signup': return pageAccount(params);
    case '/admin/services': return pageAdminServices();
    case '/admin/social-network': return pageAdminSocialNetwork();
    case '/admin': return pageAdminLogin();
    case '/admin/login': return pageAdminLogin();
    case '/wizard': return pageWizard();
    case '/status': return pageStatus(params);
    case '/changelog': return pageChangelog();
    case '/terms': return pageTerms();
    case '/privacy': return pagePrivacy();
    case '/refund': return pageRefund();
    case '/sla': return pageSla();
    case '/pledge': return pagePledge();
    case '/cancel': return pageCancel();
    case '/gift': return pageGift();
    case '/aura': return pageAura();
    case '/api-explorer': return pageApiExplorer();
    case '/transparency': return pageTransparency();
    case '/frontier': return pageFrontier();
    case '/deepseek-cockpit': return pageDeepseekCockpit();
    case '/marketplace': return pageServices();
    case '/contact': return pageContact();
    case '/faq': return pageFaq();
    case '/blog': return pageBlog();
    case '/affiliate': return pageAffiliate();
    case '/partners': return pagePartners();
    case '/roadmap': return pageRoadmap();
    case '/careers': return pageCareers();
    case '/press': return pagePress();
    case '/agents': return pageAgents();
    case '/__not-found__': return pageNotFound(params.missingPath || route);
    default:
      if (route.startsWith('/services/')) return pageService(params.id || route.slice(10));
      if (route.startsWith('/order/')) return pageOrderPassport(params.id || route.slice(7));
      if (route.startsWith('/twin/')) return sellSurface.pageTwin(params.twinId || params.id || route.slice(6));
      return pageNotFound(route);
  }
}

function pageSocialNetwork() {
  let ssrFeed = '';
  let ssrStories = '';
  let ssrInventions = '';
  try {
    const surface = require('../../../backend/modules/social-orchestrator/social-surface');
    ssrFeed = surface.renderSsrFeed(6);
    const st = surface.stories();
    ssrStories = (st.items || []).map((s) => {
      const name = (s.author && s.author.displayName) || 'Creator';
      return `<button type="button" class="za-story${s.unseen ? ' is-unseen' : ''}" data-story="${_esc(s.id)}"><span class="za-story-ring"><span class="za-story-av">${_esc(name.slice(0, 1))}</span></span><em>${_esc(name)}</em></button>`;
    }).join('');
    ssrInventions = (surface.inventions().items || []).map((inv) => (
      `<article class="za-inv"><h3>${_esc(inv.title)}</h3><p>${_esc(inv.problem)}</p><p class="za-inv-sol">${_esc(inv.solution)}</p></article>`
    )).join('');
  } catch (_) {
    ssrFeed = '<p class="za-social-empty">Feed offline — sign in or retry shortly to see the live surface.</p>';
  }

  return `<section class="za-social">
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet"/>
  <header class="za-social-hero">
    <div class="za-social-hero__atm" aria-hidden="true"></div>
    <div class="za-social-hero__plane" aria-hidden="true"></div>
    <div class="za-social-hero__inner">
      <p class="za-social-live"><span class="za-social-live__dot"></span> Live · same account as the rest of ZeusAI</p>
      <h1 class="za-social-brand">ZeusAI <span>Social</span></h1>
      <p class="za-social-lead">Create, follow, message and go viral with the exact cryptoauth identity you use on /account — every button hits a real API.</p>
      <div class="za-social-cta">
        <a class="btn btn-primary" href="#za-app">Enter the feed</a>
        <a class="btn btn-ghost" id="zaHeroAuth" href="/account?next=/social-network" data-link>Create account / Sign in</a>
      </div>
    </div>
  </header>

  ${sellSurface.socialArcPanelHtml()}

  <div class="za-social-body" id="za-app">
    <div class="za-authbar" id="zaAuthBar">
      <span id="zaAuthLabel">Checking session…</span>
      <a class="btn btn-primary" id="zaAuthCta" href="/account?next=/social-network" data-link>Sign in</a>
      <button type="button" class="btn btn-ghost" id="zaSharePage">Share ZeusAI Social</button>
    </div>

    <div class="za-rail" role="tablist" aria-label="ZeusAI Social modes">
      <button type="button" class="za-rail-btn is-on" data-pane="home" role="tab" aria-selected="true">For You</button>
      <button type="button" class="za-rail-btn" data-pane="following" role="tab">Following</button>
      <button type="button" class="za-rail-btn" data-pane="stories" role="tab">Stories</button>
      <button type="button" class="za-rail-btn" data-pane="shorts" role="tab">Shorts</button>
      <button type="button" class="za-rail-btn" data-pane="explore" role="tab">Explore</button>
      <button type="button" class="za-rail-btn" data-pane="messages" role="tab">Messages</button>
      <button type="button" class="za-rail-btn" data-pane="notifications" role="tab">Notifications <span class="za-notif-badge" id="zaNotifBadge" hidden>0</span></button>
      <button type="button" class="za-rail-btn" data-pane="bookmarks" role="tab">Bookmarks</button>
      <button type="button" class="za-rail-btn" data-pane="profile" role="tab">Profile</button>
      <button type="button" class="za-rail-btn" data-pane="inventions" role="tab">Inventions</button>
      <button type="button" class="za-rail-btn" data-pane="world" role="tab">World Standard</button>
      <button type="button" class="za-rail-btn" data-pane="ledger" role="tab">Ledger</button>
    </div>

    <div class="za-intent" id="zaIntent">
      <span>Intent</span>
      <button type="button" data-intent="discover" class="is-on">Discover</button>
      <button type="button" data-intent="learn">Learn</button>
      <button type="button" data-intent="connect">Connect</button>
      <button type="button" data-intent="create">Create</button>
      <button type="button" data-intent="trade">Trade</button>
      <strong id="zaIntentAttn" class="za-attn-strip" hidden>Attention —</strong>
      <strong id="zaWellbeing" class="za-wellbeing">Wellbeing —</strong>
    </div>

    <form class="za-composer" id="zaComposer">
      <label class="za-sr" for="zaComposeText">Compose</label>
      <textarea id="zaComposeText" maxlength="2000" rows="2" placeholder="Share a signal — sealed with Proof-of-Authorship (sign in required)"></textarea>
      <div class="za-composer-actions">
        <select id="zaComposeKind" aria-label="Post kind">
          <option value="text">Post (X / FB)</option>
          <option value="image">Image (IG)</option>
          <option value="short">Short (TikTok)</option>
          <option value="reel">Reel (IG)</option>
          <option value="story">Story (IG / FB)</option>
        </select>
        <button class="btn btn-primary" type="submit" id="zaPublishBtn">Publish</button>
      </div>
      <details class="za-composer-extra">
        <summary>Advanced · bond, claim, co-creator split, bandwidth</summary>
        <div class="za-composer-extra-grid">
          <label>Anti-deepfake bond (BTC)<input id="zaCxBond" type="text" inputmode="decimal" placeholder="0.0001" maxlength="16"/></label>
          <label>Claim state<select id="zaCxClaim"><option value="">none</option><option value="unverified">unverified</option><option value="contested">contested</option><option value="verified">verified</option></select></label>
          <label>Co-creator handle (50/50 split)<input id="zaCxSplit" placeholder="aria.builds" maxlength="40"/></label>
          <label class="za-cx-check"><input type="checkbox" id="zaCxBandwidth"/> Override emotional-bandwidth cap</label>
        </div>
      </details>
      <p class="za-auth-hint" id="zaComposeHint" hidden>Sign in with your ZeusAI account to publish.</p>
    </form>

    <div class="za-stories" id="zaStories">${ssrStories}</div>
    <div id="zaStoryViewer" class="za-story-viewer" hidden></div>

    <div class="za-panes">
      <section class="za-pane is-on" data-pane="home" id="zaPaneHome">
        <div id="zaFeed" class="za-feed" aria-live="polite">${ssrFeed}</div>
      </section>
      <section class="za-pane" data-pane="following" id="zaPaneFollowing"><div id="zaFollowing" class="za-feed"></div></section>
      <section class="za-pane" data-pane="stories" id="zaPaneStories"><div id="zaStoriesPane" class="za-feed"></div></section>
      <section class="za-pane" data-pane="shorts" id="zaPaneShorts"><div id="zaShorts" class="za-shorts"></div></section>
      <section class="za-pane" data-pane="explore" id="zaPaneExplore"><div id="zaExplore" class="za-explore"></div></section>
      <section class="za-pane" data-pane="messages" id="zaPaneMessages">
        <form class="za-dm-compose" id="zaDmForm">
          <input id="zaDmTo" placeholder="Handle (e.g. aria.builds)" maxlength="40"/>
          <input id="zaDmText" placeholder="Encrypted message…" maxlength="1000"/>
          <button class="btn btn-primary" type="submit">Send DM</button>
        </form>
        <div id="zaMessages" class="za-messages"></div>
      </section>
      <section class="za-pane" data-pane="notifications" id="zaPaneNotifications">
        <div class="za-notif-head"><button type="button" class="btn btn-ghost" id="zaNotifReadAll">Mark all read</button></div>
        <div id="zaNotifs" class="za-feed"></div>
      </section>
      <section class="za-pane" data-pane="bookmarks" id="zaPaneBookmarks"><div id="zaBookmarks" class="za-feed"></div></section>
      <section class="za-pane" data-pane="profile" id="zaPaneProfile"><div id="zaProfile" class="za-profile"></div></section>
      <section class="za-pane" data-pane="inventions" id="za-inventions"><div id="zaInventions" class="za-inv-grid">${ssrInventions}</div></section>
      <section class="za-pane" data-pane="world" id="zaPaneWorld">
        <div class="za-world-head">
          <h2 class="za-social-h2">World Standard · 12 inventions</h2>
          <p class="za-social-sub">Live primitives that outclass every existing social network — all wired to your cryptoauth identity.</p>
        </div>
        <div id="zaWorldStatus" class="za-social-metrics"></div>
        <div class="za-world-grid">
          <article class="za-world-card">
            <h3>Attention Ledger</h3>
            <p id="zaAttnBal">Balance —</p>
            <button type="button" id="zaAttnRefresh" class="btn btn-ghost">Refresh</button>
            <button type="button" id="zaAttnDonate" class="btn btn-primary">Donate 60s to @zeusai</button>
          </article>
          <article class="za-world-card">
            <h3>Proof-of-Human Light</h3>
            <p id="zaHumanPrompt">Challenge idle</p>
            <button type="button" id="zaHumanStart" class="btn btn-ghost">Get challenge</button>
            <input id="zaHumanAns" placeholder="Answer" maxlength="8"/>
            <button type="button" id="zaHumanVerify" class="btn btn-primary">Verify</button>
          </article>
          <article class="za-world-card">
            <h3>Emotional Bandwidth</h3>
            <p>Cap aggressive density · override if needed</p>
            <button type="button" id="zaBwOverride" class="btn btn-primary">Override 30 min</button>
          </article>
          <article class="za-world-card">
            <h3>Consent Graph</h3>
            <p>Peer handle + channels</p>
            <input id="zaConsentPeer" placeholder="aria.builds" maxlength="40"/>
            <label><input type="checkbox" id="zaCFeed" checked/> feed</label>
            <label><input type="checkbox" id="zaCStory" checked/> story</label>
            <label><input type="checkbox" id="zaCDm" checked/> dm</label>
            <label><input type="checkbox" id="zaCRec" checked/> recommend</label>
            <button type="button" id="zaConsentSave" class="btn btn-primary">Save consent</button>
          </article>
          <article class="za-world-card">
            <h3>Anti-Deepfake Bond</h3>
            <input id="zaBondPost" placeholder="post id" maxlength="64"/>
            <input id="zaBondAmt" placeholder="0.0001 BTC" maxlength="16"/>
            <button type="button" id="zaBondPostBtn" class="btn btn-primary">Post bond</button>
            <div id="zaBondList"></div>
          </article>
          <article class="za-world-card">
            <h3>Ambiguity / Claim</h3>
            <input id="zaClaimPost" placeholder="post id" maxlength="64"/>
            <select id="zaClaimState"><option value="unverified">unverified</option><option value="contested">contested</option><option value="verified">verified</option></select>
            <input id="zaClaimEv" placeholder="evidence" maxlength="200"/>
            <button type="button" id="zaClaimSave" class="btn btn-primary">Set claim</button>
          </article>
          <article class="za-world-card">
            <h3>Creator Split</h3>
            <input id="zaSplitPost" placeholder="post id" maxlength="64"/>
            <input id="zaSplitPeer" placeholder="co-creator handle" maxlength="40"/>
            <button type="button" id="zaSplitSave" class="btn btn-primary">50/50 split</button>
          </article>
          <article class="za-world-card">
            <h3>Intent Ads (Zero default)</h3>
            <p id="zaAdPolicy">Ads off unless intent=trade</p>
            <button type="button" id="zaAdSlot" class="btn btn-primary">Sign ad slot (trade)</button>
          </article>
          <article class="za-world-card">
            <h3>Exit-Complete Export</h3>
            <p>Full portable pack — leave anytime</p>
            <button type="button" id="zaExport" class="btn btn-primary">Download exit pack</button>
          </article>
          <article class="za-world-card">
            <h3>Re-anchor Virality</h3>
            <input id="zaReanchorPost" placeholder="your post id" maxlength="64"/>
            <button type="button" id="zaReanchor" class="btn btn-primary">Re-anchor 72h</button>
          </article>
          <article class="za-world-card">
            <h3>Federation Mesh</h3>
            <p>Every compose pins a content-addressed CID. Lookup by post id.</p>
            <input id="zaFedPost" placeholder="post id" maxlength="64"/>
            <button type="button" id="zaFedLookup" class="btn btn-primary">Lookup CID</button>
            <p id="zaFedOut" class="za-social-sub">—</p>
          </article>
          <article class="za-world-card">
            <h3>Reputation Without Mob</h3>
            <p>Trust from bonds, anchors, ledger — not likes.</p>
            <input id="zaRepHandle" placeholder="handle" maxlength="40"/>
            <button type="button" id="zaRepLookup" class="btn btn-primary">Lookup score</button>
            <p id="zaRepOut" class="za-social-sub">—</p>
          </article>
        </div>
        <div id="zaWorldInv" class="za-inv-grid" style="margin-top:22px"></div>
      </section>
      <section class="za-pane" data-pane="ledger" id="zaPaneLedger">
        <div id="zaReach" class="za-social-metrics"></div>
        <div id="zaParity" class="za-parity"></div>
        <div id="zaLedger" class="za-social-ledger"></div>
        <div id="zaLoops" class="za-social-loops"></div>
      </section>
    </div>
    <p class="za-social-foot">Account · <a href="/account?next=/social-network" data-link>/account</a> (create · sign in · vault recovery) · APIs <code class="inline">/api/zeusai-social/*</code> · Share this page worldwide</p>
  </div>
  <script>
  (function(){
    var TOKEN_KEY='zeus_cryptoauth_token';
    var me=null;
    function esc(s){return String(s||'').replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]})}
    function token(){try{return localStorage.getItem(TOKEN_KEY)}catch(_){return null}}
    function authHeaders(json){
      var h={}; if(json) h['Content-Type']='application/json';
      var t=token(); if(t) h['Authorization']='Bearer '+t;
      return h;
    }
    function needAuth(){
      location.href='/account?next='+encodeURIComponent('/social-network'+location.search);
    }
    async function api(path, opts){
      opts=opts||{};
      var r=await fetch(path,{method:opts.method||'GET',headers:authHeaders(!!opts.body),body:opts.body?JSON.stringify(opts.body):undefined,cache:'no-store'});
      var j=await r.json().catch(function(){return{}});
      if(r.status===401){ return {ok:false,error:'auth_required',status:401, body:j}; }
      j.status=r.status; return j;
    }
    function isFollowing(id){ return !!(id&&me&&me.followingIds&&me.followingIds.indexOf(id)>=0); }
    function quotedHtml(q){
      if(!q) return '';
      var qa=q.author||{};
      return '<blockquote class="za-quote" data-profile="'+esc(qa.handle||'')+'">'+
        '<span class="za-quote-h"><strong>'+esc(qa.displayName||'')+'</strong> @'+esc(qa.handle||'')+'</span>'+
        '<span class="za-quote-t">'+esc(q.text||'')+'</span></blockquote>';
    }
    function postHtml(p){
      var media=p.media?'<div class="za-post-media za-post-media--'+esc(p.media.poster||'gradient-mint')+'" data-aspect="'+esc(p.media.aspect||'1:1')+'"><span>'+esc(p.kind)+'</span>'+(p.media.sound?'<em>'+esc(p.media.sound)+'</em>':'')+'</div>':'';
      var a=p.author||{};
      var followed=isFollowing(a.id);
      var quoted=p.quotedPost?quotedHtml(p.quotedPost):'';
      return '<article class="za-post" data-id="'+esc(p.id)+'" data-cue="'+esc(p.platformCue)+'">'+
        '<header class="za-post-head"><div class="za-avatar" data-profile="'+esc(a.handle||'')+'" data-presence="'+esc(a.presence||'quiet')+'">'+esc((a.displayName||'?').slice(0,1))+'</div>'+
        '<div class="za-post-meta"><strong>'+esc(a.displayName||'')+(a.verified?' <span class="za-verified">✓</span>':'')+(a.system?' <span class="za-system">official</span>':'')+'</strong>'+
        '<span><button type="button" class="za-handle" data-profile="'+esc(a.handle||'')+'">@'+esc(a.handle||'')+'</button> · '+esc(p.platformCue||'')+' · passport '+esc(a.passport)+' · rep '+esc(a.reputation)+'</span></div></header>'+
        '<p class="za-post-text">'+esc(p.text)+'</p>'+quoted+
        '<div class="za-post-flags"><span data-claim="'+esc(p.claimState||'unverified')+'">claim:'+esc(p.claimState||'unverified')+'</span>'+
        (p.virality&&p.virality.expired?'<span class="za-viral-expired">virality expired</span>':'<span class="za-viral-live">viral window</span>')+
        (p.federationCid?'<span class="za-cid" title="'+esc(p.federationCid)+'">CID</span>':'')+
        '</div>'+media+
        '<footer class="za-post-foot">'+
          '<button type="button" data-react="like" data-id="'+esc(p.id)+'">Like '+(p.stats&&p.stats.likes||0)+'</button>'+
          '<button type="button" data-comment="'+esc(p.id)+'">Reply '+(p.stats&&p.stats.comments||0)+'</button>'+
          '<button type="button" data-quote="'+esc(p.id)+'">Quote</button>'+
          '<button type="button" data-share="'+esc(p.id)+'">Share '+(p.stats&&p.stats.shares||0)+'</button>'+
          '<button type="button" data-react="save" data-id="'+esc(p.id)+'">Save '+(p.stats&&p.stats.saves||0)+'</button>'+
          '<button type="button" data-follow="'+esc(a.id)+'"'+(a.handle?' data-handle="'+esc(a.handle)+'"':'')+'>'+(followed?'Following':'Follow')+'</button>'+
          '<span class="za-post-proof" title="Proof-of-Authorship">'+esc(String(p.proofOfAuthorship||'').slice(0,10))+'…</span>'+
        '</footer>'+
        '<div class="za-comments" data-comments-for="'+esc(p.id)+'" hidden></div>'+
        '</article>';
    }
    function commentHtml(c){
      var a=c.author||{};
      var name=a.displayName||a.handle||c.authorHandle||c.from||'anon';
      var handle=a.handle||c.authorHandle||'';
      return '<div class="za-comment"><strong'+(handle?' class="za-handle" data-profile="'+esc(handle)+'"':'')+'>'+esc(name)+'</strong>'+
        (handle?' <span class="za-comment-h">@'+esc(handle)+'</span>':'')+
        '<p>'+esc(c.text||'')+'</p></div>';
    }
    async function loadComments(postId, box){
      box.innerHTML='<p class="za-social-sub">Loading replies…</p>';
      var r=await api('/api/zeusai-social/comments/'+encodeURIComponent(postId));
      var items=(r&&r.items)||[];
      var list=items.map(commentHtml).join('')||'<p class="za-social-empty">No replies yet — be the first.</p>';
      box.innerHTML='<div class="za-comment-list">'+list+'</div>'+
        '<form class="za-comment-form"><input class="za-comment-input" maxlength="500" placeholder="Write a reply…"/><button type="button" class="btn btn-primary za-comment-send">Reply</button></form>';
      var form=box.querySelector('.za-comment-form');
      var send=form.querySelector('.za-comment-send');
      var inp=form.querySelector('.za-comment-input');
      send.onclick=async function(){
        if(!token()){ needAuth(); return; }
        var txt=(inp.value||'').trim();
        if(!txt) return;
        var cr=await api('/api/zeusai-social/comment',{method:'POST',body:{postId:postId,text:txt}});
        if(cr&&cr.status===401){ needAuth(); return; }
        if(cr&&cr.ok){ inp.value=''; await loadComments(postId, box); }
        else alert((cr&&cr.error)||'Reply failed');
      };
      inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); send.click(); } });
    }
    function setAuthUi(){
      var label=document.getElementById('zaAuthLabel');
      var cta=document.getElementById('zaAuthCta');
      var hero=document.getElementById('zaHeroAuth');
      var hint=document.getElementById('zaComposeHint');
      var pub=document.getElementById('zaPublishBtn');
      if(me&&me.profile){
        label.textContent='Signed in as @'+me.profile.handle+' · '+me.profile.displayName;
        cta.textContent='My Account'; cta.href='/account';
        if(hero){ hero.textContent='Open feed as @'+me.profile.handle; hero.href='#za-app'; }
        if(hint) hint.hidden=true;
        if(pub) pub.disabled=false;
      } else {
        label.textContent='Not signed in — create / login / recover vault on /account (same system as the whole site)';
        cta.textContent='Create account / Sign in'; cta.href='/account?next=/social-network';
        if(hero){ hero.textContent='Create account / Sign in'; hero.href='/account?next=/social-network'; }
        if(hint) hint.hidden=false;
        if(pub) pub.disabled=false; // click still redirects via 401
      }
    }
    async function refreshMe(){
      var t=token();
      if(!t){ me=null; setAuthUi(); return; }
      var j=await api('/api/zeusai-social/me');
      if(j&&j.ok) me=j; else me=null;
      setAuthUi();
    }
    function showPane(name){
      document.querySelectorAll('.za-rail-btn').forEach(function(b){var on=b.getAttribute('data-pane')===name;b.classList.toggle('is-on',on);b.setAttribute('aria-selected',on?'true':'false')});
      document.querySelectorAll('.za-pane').forEach(function(p){p.classList.toggle('is-on',p.getAttribute('data-pane')===name)});
    }
    document.querySelectorAll('.za-rail-btn').forEach(function(b){b.addEventListener('click',function(){showPane(b.getAttribute('data-pane')); loadPane(b.getAttribute('data-pane'))})});
    document.querySelectorAll('[data-intent]').forEach(function(b){
      b.addEventListener('click',async function(){
        if(!token()){ needAuth(); return; }
        document.querySelectorAll('[data-intent]').forEach(function(x){x.classList.remove('is-on')});
        b.classList.add('is-on');
        var nextIntent=b.getAttribute('data-intent');
        var r=await api('/api/zeusai-social/intent',{method:'POST',body:{intent:nextIntent}});
        if(r&&r.status===401){ needAuth(); return; }
        if(r&&r.ok){ me=me||{}; me.session=me.session||{}; me.session.intent=(r.intent||nextIntent); _adSlotCache=null; }
        showPane('home'); loadPane('home');
      });
    });
    async function doCompose(extra){
      var text=document.getElementById('zaComposeText').value;
      var kind=document.getElementById('zaComposeKind').value;
      var cue=kind==='short'?'tiktok':(kind==='reel'||kind==='image'||kind==='story')?'instagram':'x';
      var body={text:text,kind:kind,platformCue:cue};
      var bond=(document.getElementById('zaCxBond').value||'').trim();
      if(bond) body.bondBtc=bond;
      var claim=document.getElementById('zaCxClaim').value;
      if(claim) body.claimState=claim;
      if(document.getElementById('zaCxBandwidth').checked) body.bandwidthOverride=true;
      var splitHandle=(document.getElementById('zaCxSplit').value||'').trim().replace(/^@/,'');
      if(splitHandle&&me&&me.profile){
        var pr=await api('/api/zeusai-social/user/'+encodeURIComponent(splitHandle));
        if(pr&&pr.ok&&pr.profile) body.splitShares=[{userId:me.profile.id,pct:50},{userId:pr.profile.id,pct:50}];
      }
      if(extra) Object.assign(body,extra);
      return api('/api/zeusai-social/compose',{method:'POST',body:body});
    }
    async function submitCompose(extra){
      var r=await doCompose(extra);
      if(r&&r.status===401){ needAuth(); return; }
      if(r&&r.ok){
        document.getElementById('zaComposeText').value='';
        document.getElementById('zaCxBond').value='';
        document.getElementById('zaCxSplit').value='';
        document.getElementById('zaCxClaim').value='';
        document.getElementById('zaCxBandwidth').checked=false;
        showPane('home'); loadPane('home');
        return;
      }
      if(r&&r.error==='needs_human_challenge'){
        var ch=await api('/api/zeusai-social/world/human/challenge',{method:'POST',body:{}});
        if(ch&&ch.ok){
          var ans=prompt('Human check — '+(ch.prompt||'answer the challenge'));
          if(ans==null) return;
          var v=await api('/api/zeusai-social/world/human/verify',{method:'POST',body:{challengeId:ch.challengeId,answer:ans}});
          if(v&&v.ok){ await submitCompose(extra); }
          else alert('Human check failed — try publishing again.');
        } else alert('Could not load human check.');
        return;
      }
      if(r&&r.error==='emotional_bandwidth_cap'){
        if(confirm('Emotional-bandwidth cap reached. Override and publish anyway?')){
          await submitCompose(Object.assign({},extra||{},{bandwidthOverride:true}));
        }
        return;
      }
      alert((r&&r.error)||'Publish failed');
    }
    document.getElementById('zaComposer').addEventListener('submit',async function(e){
      e.preventDefault();
      if(!token()){ needAuth(); return; }
      await submitCompose(null);
    });
    document.getElementById('zaDmForm').addEventListener('submit',async function(e){
      e.preventDefault();
      if(!token()){ needAuth(); return; }
      var handle=document.getElementById('zaDmTo').value.trim().replace(/^@/,'');
      var text=document.getElementById('zaDmText').value;
      var prof=await api('/api/zeusai-social/user/'+encodeURIComponent(handle));
      if(!prof||!prof.ok){ alert('User not found'); return; }
      var r=await api('/api/zeusai-social/dm',{method:'POST',body:{to:prof.profile.id,text:text}});
      if(r&&r.status===401){ needAuth(); return; }
      if(r&&r.ok){ document.getElementById('zaDmText').value=''; loadPane('messages'); }
      else alert((r&&r.error)||'DM failed');
    });
    document.body.addEventListener('click',async function(e){
      var story=e.target.closest('[data-story]');
      if(story){
        if(!token()){ needAuth(); return; }
        var sid=story.getAttribute('data-story');
        var r=await api('/api/zeusai-social/story/view',{method:'POST',body:{storyId:sid}});
        if(r&&r.status===401){ needAuth(); return; }
        if(r&&r.ok){
          var box=document.getElementById('zaStoryViewer');
          box.hidden=false;
          box.innerHTML='<div class="za-story-view"><strong>'+esc(r.story.author&&r.story.author.displayName)+'</strong><p>'+(r.story.items||[]).map(function(i){return esc(i.text||i.kind)}).join(' · ')+'</p><button type="button" id="zaCloseStory">Close</button></div>';
          document.getElementById('zaCloseStory').onclick=function(){ box.hidden=true; };
          story.classList.remove('is-unseen');
        }
        return;
      }
      var share=e.target.closest('[data-share]');
      if(share){
        if(!token()){ needAuth(); return; }
        var pid=share.getAttribute('data-share');
        var r=await api('/api/zeusai-social/share',{method:'POST',body:{postId:pid}});
        if(r&&r.status===401){ needAuth(); return; }
        if(r&&r.ok){
          var url=location.origin+(r.shareUrl||('/social-network?post='+pid));
          if(navigator.share){ try{ await navigator.share({title:'ZeusAI Social',url:url,text:'See this on ZeusAI Social'}); }catch(_){}}
          else { try{ await navigator.clipboard.writeText(url); alert('Link copied — share it worldwide'); }catch(_){ prompt('Copy link', url); } }
          loadPane(document.querySelector('.za-rail-btn.is-on').getAttribute('data-pane')||'home');
        }
        return;
      }
      var follow=e.target.closest('[data-follow]');
      if(follow){
        if(!token()){ needAuth(); return; }
        var tid=follow.getAttribute('data-follow');
        var currently=isFollowing(tid);
        var path=currently?'/api/zeusai-social/unfollow':'/api/zeusai-social/follow';
        var r=await api(path,{method:'POST',body:{targetId:tid}});
        if(r&&r.status===401){ needAuth(); return; }
        if(r&&r.ok){
          var nowFollowing=!currently;
          me=me||{}; me.followingIds=me.followingIds||[];
          if(nowFollowing){ if(me.followingIds.indexOf(tid)<0) me.followingIds.push(tid); }
          else { me.followingIds=me.followingIds.filter(function(x){return x!==tid}); }
          document.querySelectorAll('[data-follow]').forEach(function(bb){
            if(bb.getAttribute('data-follow')!==tid) return;
            if(bb.classList.contains('za-profile-follow')){
              bb.textContent=nowFollowing?'Unfollow':'Follow';
              bb.classList.toggle('btn-primary',!nowFollowing);
              bb.classList.toggle('btn-ghost',nowFollowing);
            } else { bb.textContent=nowFollowing?'Following':'Follow'; }
          });
        } else if(r&&r.error){ alert(r.error); }
        return;
      }
      var cbtn=e.target.closest('[data-comment]');
      if(cbtn){
        var pid=cbtn.getAttribute('data-comment');
        var art=cbtn.closest('.za-post');
        var cbox=art&&art.querySelector('.za-comments');
        if(!cbox) return;
        if(!cbox.hidden){ cbox.hidden=true; return; }
        cbox.hidden=false;
        await loadComments(pid, cbox);
        return;
      }
      var quote=e.target.closest('[data-quote]');
      if(quote){
        if(!token()){ needAuth(); return; }
        var qid=quote.getAttribute('data-quote');
        var qtext=prompt('Add your take (quote this post):');
        if(qtext==null) return;
        var qr=await api('/api/zeusai-social/quote',{method:'POST',body:{postId:qid,text:qtext}});
        if(qr&&qr.status===401){ needAuth(); return; }
        if(qr&&qr.ok){ showPane('home'); loadPane('home'); }
        else alert((qr&&qr.error)||'Quote failed');
        return;
      }
      var prof=e.target.closest('[data-profile]');
      if(prof){
        var ph=prof.getAttribute('data-profile');
        if(ph){ showPane('profile'); openProfile(ph); return; }
      }
      var tagEl=e.target.closest('[data-tag]');
      if(tagEl){ showPane('home'); loadTag(tagEl.getAttribute('data-tag')); return; }
      var btn=e.target.closest('[data-react]');
      if(!btn) return;
      if(!token()){ needAuth(); return; }
      var id=btn.getAttribute('data-id');
      var type=btn.getAttribute('data-react');
      var r1=await api('/api/zeusai-social/react',{method:'POST',body:{postId:id,type:type}});
      if(r1&&r1.status===401){ needAuth(); return; }
      await api('/api/zeusai-social/receipt',{method:'POST',body:{postId:id}});
      loadPane(document.querySelector('.za-rail-btn.is-on').getAttribute('data-pane')||'home');
    });
    document.getElementById('zaSharePage').addEventListener('click',async function(){
      var url=location.origin+'/social-network';
      if(navigator.share){ try{ await navigator.share({title:'ZeusAI Social',text:'The world-standard social layer — FB+X+IG+TikTok with real inventions.',url:url}); return;}catch(_){}}
      try{ await navigator.clipboard.writeText(url); alert('Link copied — paste anywhere to go viral'); }catch(_){ prompt('Copy', url); }
    });
    async function loadPane(name){
      try{
        if(name==='home'||name==='following'){
          var mode=name==='following'?'following':'for-you';
          var tl=await api('/api/zeusai-social/timeline?mode='+mode+'&limit=20');
          if(mode==='following'&&tl&&tl.error==='auth_required'){ needAuth(); return; }
          var box=name==='following'?document.getElementById('zaFollowing'):document.getElementById('zaFeed');
          box.innerHTML=(tl.items||[]).map(postHtml).join('')||'<p class="za-social-empty">No posts yet — be the first to publish.</p>';
          if(name==='home') await maybeRenderAdSlot();
        } else if(name==='notifications'){
          await loadNotifications();
        } else if(name==='bookmarks'){
          await loadBookmarks();
        } else if(name==='profile'){
          if(!_profileHandle&&me&&me.profile) _profileHandle=me.profile.handle;
          if(_profileHandle){ await openProfile(_profileHandle,true); }
          else document.getElementById('zaProfile').innerHTML='<p class="za-social-empty">Sign in on /account to view your profile.</p>';
        } else if(name==='stories'){
          var st=await api('/api/zeusai-social/stories');
          document.getElementById('zaStoriesPane').innerHTML=(st.items||[]).map(function(s){
            return '<button type="button" class="za-post" data-story="'+esc(s.id)+'"><header class="za-post-head"><strong>'+esc(s.author&&s.author.displayName)+'</strong></header><p class="za-post-text">'+(s.items||[]).map(function(i){return esc(i.text||i.kind)}).join(' · ')+'</p></button>';
          }).join('');
        } else if(name==='shorts'){
          var sh=await api('/api/zeusai-social/shorts');
          document.getElementById('zaShorts').innerHTML=(sh.items||[]).map(function(p){
            return '<article class="za-short">'+postHtml(p)+'<div class="za-royalty">Royalty mirror · '+esc(p.royaltyHintBtc)+' BTC</div></article>';
          }).join('');
        } else if(name==='explore'){
          var ex=await api('/api/zeusai-social/explore');
          document.getElementById('zaExplore').innerHTML=
            '<div class="za-tags">'+(ex.trending||[]).map(function(t){return '<button type="button" class="za-tag" data-tag="'+esc(t)+'">'+esc(t)+'</button>'}).join('')+'</div>'+
            '<div class="za-creators">'+(ex.creators||[]).map(function(c){return '<button type="button" data-follow="'+esc(c.id)+'"><strong>'+esc(c.displayName)+'</strong><span>@'+esc(c.handle)+' · passport '+esc(c.passport)+'</span></button>'}).join('')+'</div>'+
            '<div class="za-grid">'+(ex.grid||[]).map(postHtml).join('')+'</div>';
        } else if(name==='messages'){
          if(!token()){ document.getElementById('zaMessages').innerHTML='<p class="za-social-empty">Sign in to read encrypted DMs.</p>'; return; }
          var ms=await api('/api/zeusai-social/messages');
          if(ms&&ms.status===401){ needAuth(); return; }
          document.getElementById('zaMessages').innerHTML=(ms.threads||[]).map(function(t){
            var pm={}; (t.participants||[]).forEach(function(p){ pm[p.id]=p.displayName||('@'+(p.handle||'')); });
            return '<article class="za-dm"><header>E2E · '+(t.participants||[]).map(function(p){return esc(p.displayName)+' <i data-presence="'+esc(p.presence)+'"></i>'}).join(' · ')+'</header>'+
              (t.messages||[]).map(function(m){return '<p><strong>'+esc(pm[m.from]||m.from)+'</strong> '+esc(m.text)+'</p>'}).join('')+'</article>';
          }).join('')||'<p class="za-social-empty">No threads yet — send the first DM above.</p>';
        } else if(name==='inventions'){
          var inv=await api('/api/zeusai-social/innovations');
          document.getElementById('zaInventions').innerHTML=(inv.items||[]).map(function(i){
            return '<article class="za-inv"><h3>'+esc(i.title)+'</h3><p>'+esc(i.problem)+'</p><p class="za-inv-sol">'+esc(i.solution)+'</p></article>';
          }).join('');
        } else if(name==='world'){
          await loadWorld();
        } else if(name==='ledger'){
          var pulse=await api('/api/zeusai-social/pulse');
          var parity=await api('/api/zeusai-social/parity');
          var reach=pulse.proofOfReach||{};
          document.getElementById('zaReach').innerHTML=
            '<div class="za-social-metric"><span class="za-social-metric__l">Coverage</span><strong class="za-social-metric__v">'+(reach.autonomyCoveragePct!=null?reach.autonomyCoveragePct:'—')+'%</strong></div>'+
            '<div class="za-social-metric"><span class="za-social-metric__l">Features live</span><strong class="za-social-metric__v">'+esc(parity.totals&&parity.totals.featuresLive)+'</strong></div>'+
            '<div class="za-social-metric"><span class="za-social-metric__l">Inventions</span><strong class="za-social-metric__v">'+esc(parity.totals&&parity.totals.inventionsLive)+'</strong></div>'+
            '<div class="za-social-metric"><span class="za-social-metric__l">Platforms</span><strong class="za-social-metric__v">FB · X · IG · TikTok</strong></div>';
          document.getElementById('zaParity').innerHTML='<p class="za-social-sub">'+esc(parity.claim||'')+'</p>';
          var head=pulse.ledgerHead;
          document.getElementById('zaLedger').innerHTML=head
            ? '<div class="za-social-ledger__head"><div><span>seq</span><strong>'+esc(head.seq)+'</strong></div><div><span>type</span><strong>'+esc(head.type)+'</strong></div><div class="za-social-ledger__hash"><span>hash</span><code>'+esc(head.hash)+'</code></div></div>'
            : '<p class="za-social-empty">Ledger warming…</p>';
          var loops=pulse.loops||{};
          document.getElementById('zaLoops').innerHTML=Object.keys(loops).map(function(n){
            return '<div class="za-social-loop'+(loops[n]!==false?' is-on':'')+'"><span class="za-social-loop__dot"></span><span>'+esc(n)+'</span></div>';
          }).join('');
        }
        var wb=await api('/api/zeusai-social/wellbeing');
        var el=document.getElementById('zaWellbeing');
        if(el) el.textContent='Wellbeing '+Math.round(wb.score||0)+' · '+(wb.advice||'');
        refreshAttnStrip();
        refreshNotifBadge();
        // Deep-link ?post=
        var q=new URLSearchParams(location.search).get('post');
        if(q&&name==='home'){
          var one=await api('/api/zeusai-social/post/'+encodeURIComponent(q));
          if(one&&one.ok&&one.post){
            var feed=document.getElementById('zaFeed');
            feed.insertAdjacentHTML('afterbegin', postHtml(one.post));
          }
        }
      }catch(err){ console.warn('za-social',err); }
    }

    async function loadWorld(){
      var st=await api('/api/zeusai-social/world');
      var box=document.getElementById('zaWorldStatus');
      if(box&&st&&st.counts){
        var c=st.counts;
        box.innerHTML=
          '<div class="za-social-metric"><span class="za-social-metric__l">Inventions</span><strong class="za-social-metric__v">'+esc(st.inventionsLive)+'</strong></div>'+
          '<div class="za-social-metric"><span class="za-social-metric__l">Attention accts</span><strong class="za-social-metric__v">'+esc(c.attentionAccounts)+'</strong></div>'+
          '<div class="za-social-metric"><span class="za-social-metric__l">Bonds</span><strong class="za-social-metric__v">'+esc(c.bonds)+'</strong></div>'+
          '<div class="za-social-metric"><span class="za-social-metric__l">Consent edges</span><strong class="za-social-metric__v">'+esc(c.consentEdges)+'</strong></div>'+
          '<div class="za-social-metric"><span class="za-social-metric__l">Federation pins</span><strong class="za-social-metric__v">'+esc(c.federationPins)+'</strong></div>'+
          '<div class="za-social-metric"><span class="za-social-metric__l">Claims</span><strong class="za-social-metric__v">'+esc(c.claims)+'</strong></div>';
      }
      var inv=await api('/api/zeusai-social/world/inventions');
      document.getElementById('zaWorldInv').innerHTML=(inv.items||[]).map(function(i){
        return '<article class="za-inv"><h3>'+esc(i.title)+'</h3><p>'+esc(i.problem)+'</p><p class="za-inv-sol">'+esc(i.solution)+'</p><span class="za-system">'+esc(i.status)+'</span></article>';
      }).join('');
      var pol=await api('/api/zeusai-social/world/ads-policy');
      var pe=document.getElementById('zaAdPolicy');
      if(pe) pe.textContent='defaultAds='+String(pol.defaultAds)+' · requires intent='+esc(pol.requiresIntent);
      var bonds=await api('/api/zeusai-social/world/bonds?limit=8');
      document.getElementById('zaBondList').innerHTML=(bonds.items||[]).slice(0,5).map(function(b){
        return '<div class="za-bond-row"><code>'+esc(b.id)+'</code> · '+esc(b.status)+' · '+esc(b.amountBtc)+' BTC · post '+esc(b.postId)+
          ' <button type="button" data-challenge-bond="'+esc(b.id)+'">Challenge</button></div>';
      }).join('');
      if(token()){
        var att=await api('/api/zeusai-social/world/attention');
        if(att&&att.ok) document.getElementById('zaAttnBal').textContent='Balance '+att.balanceSec+' seconds owned';
      }
    }
    var _profileHandle=null;
    var _adSlotCache=null;
    async function openProfile(handle){
      handle=String(handle||'').replace(/^@/,'');
      if(!handle) return;
      _profileHandle=handle;
      showPane('profile');
      var box=document.getElementById('zaProfile');
      box.innerHTML='<p class="za-social-sub">Loading profile…</p>';
      var r=await api('/api/zeusai-social/user/'+encodeURIComponent(handle));
      if(!r||!r.ok||!r.profile){ box.innerHTML='<p class="za-social-empty">Profile not found.</p>'; return; }
      var pr=r.profile;
      var rep=await api('/api/zeusai-social/world/reputation/'+encodeURIComponent(pr.id));
      var repScore=(rep&&rep.ok&&rep.score!=null)?rep.score:'—';
      var followed=isFollowing(pr.id);
      var isMe=!!(me&&me.profile&&me.profile.id===pr.id);
      box.innerHTML=
        '<header class="za-profile-head">'+
          '<div class="za-avatar za-profile-av" data-presence="'+esc(pr.presence||'quiet')+'">'+esc((pr.displayName||'?').slice(0,1))+'</div>'+
          '<div class="za-profile-id"><h2>'+esc(pr.displayName||'')+(pr.verified?' <span class="za-verified">✓</span>':'')+(pr.system?' <span class="za-system">official</span>':'')+'</h2>'+
          '<span>@'+esc(pr.handle||'')+'</span></div>'+
          (isMe?'':'<button type="button" class="btn '+(followed?'btn-ghost':'btn-primary')+' za-profile-follow" data-follow="'+esc(pr.id)+'"'+(pr.handle?' data-handle="'+esc(pr.handle)+'"':'')+'>'+(followed?'Unfollow':'Follow')+'</button>')+
        '</header>'+
        '<p class="za-profile-bio">'+esc(pr.bio||'No bio yet.')+'</p>'+
        '<div class="za-profile-stats">'+
          '<span>Passport <strong>'+esc(pr.passport)+'</strong></span>'+
          '<span>Reputation <strong>'+esc(repScore)+'</strong></span>'+
          '<span>Followers <strong>'+esc(pr.followers)+'</strong></span>'+
          '<span>Following <strong>'+esc(pr.following)+'</strong></span>'+
          '<span>Intent <strong>'+esc(pr.intent)+'</strong></span>'+
        '</div>'+
        '<div class="za-profile-posts">'+((r.posts||[]).map(postHtml).join('')||'<p class="za-social-empty">No posts yet.</p>')+'</div>';
    }
    async function loadTag(tag){
      var t=String(tag||'').replace(/^#/,'');
      if(!t) return;
      var box=document.getElementById('zaFeed');
      box.innerHTML='<p class="za-social-sub">Loading #'+esc(t)+'…</p>';
      var tl=await api('/api/zeusai-social/timeline?mode='+encodeURIComponent('tag:#'+t)+'&limit=20');
      box.innerHTML='<div class="za-tag-head">#'+esc(t)+'</div>'+((tl.items||[]).map(postHtml).join('')||'<p class="za-social-empty">No posts for #'+esc(t)+' yet.</p>');
    }
    function notifHtml(n){
      var unread=(n.read===false)||(n.unread===true)||(n.seen===false);
      var who=(n.actor&&(n.actor.displayName||n.actor.handle))||n.fromHandle||n.from||'';
      var text=n.text||n.message||n.body||(n.type?String(n.type).replace(/_/g,' '):'Activity');
      var when=n.createdAt||n.at||'';
      return '<article class="za-notif'+(unread?' is-unread':'')+'"'+(n.postId?' data-notif-post="'+esc(n.postId)+'"':'')+'>'+
        (who?'<strong'+(n.actor&&n.actor.handle?' class="za-handle" data-profile="'+esc(n.actor.handle)+'"':'')+'>'+esc(who)+'</strong> ':'')+
        '<span>'+esc(text)+'</span>'+
        (when?' <em>'+esc(String(when).slice(0,19).replace('T',' '))+'</em>':'')+'</article>';
    }
    function unreadCount(items){
      return (items||[]).filter(function(n){return (n.read===false)||(n.unread===true)||(n.seen===false);}).length;
    }
    function updateNotifBadge(items){
      var badge=document.getElementById('zaNotifBadge');
      if(!badge) return;
      var u=unreadCount(items);
      if(u>0){ badge.textContent=u>99?'99+':String(u); badge.hidden=false; }
      else { badge.hidden=true; }
    }
    async function refreshNotifBadge(){
      var badge=document.getElementById('zaNotifBadge');
      if(!token()){ if(badge) badge.hidden=true; return; }
      var r=await api('/api/zeusai-social/notifications');
      if(r&&r.ok) updateNotifBadge(r.items||[]);
    }
    async function loadNotifications(){
      var box=document.getElementById('zaNotifs');
      if(!token()){ box.innerHTML='<p class="za-social-empty">Sign in to see notifications.</p>'; return; }
      var r=await api('/api/zeusai-social/notifications');
      if(r&&r.status===401){ needAuth(); return; }
      var items=(r&&r.items)||[];
      box.innerHTML=items.map(notifHtml).join('')||'<p class="za-social-empty">No notifications yet.</p>';
      updateNotifBadge(items);
    }
    async function loadBookmarks(){
      var box=document.getElementById('zaBookmarks');
      if(!token()){ box.innerHTML='<p class="za-social-empty">Sign in to see your bookmarks.</p>'; return; }
      var r=await api('/api/zeusai-social/bookmarks');
      if(r&&r.status===401){ needAuth(); return; }
      var items=(r&&r.items)||[];
      var posts=items.map(function(it){ return (it&&it.post)?it.post:it; }).filter(function(p){return p&&p.id;});
      box.innerHTML=posts.map(postHtml).join('')||'<p class="za-social-empty">No saved posts yet — tap Save on any post.</p>';
    }
    async function refreshAttnStrip(){
      var el=document.getElementById('zaIntentAttn');
      if(!el) return;
      if(!token()){ el.hidden=true; return; }
      var a=await api('/api/zeusai-social/world/attention');
      if(a&&a.ok){ el.textContent='Attention '+a.balanceSec+'s'; el.hidden=false; }
      else el.hidden=true;
    }
    async function maybeRenderAdSlot(){
      var feed=document.getElementById('zaFeed');
      if(!feed) return;
      var intent=(me&&me.session&&me.session.intent)||null;
      if(!token()||intent!=='trade'){ _adSlotCache=null; return; }
      if(!_adSlotCache){
        var r=await api('/api/zeusai-social/world/ad-slot',{method:'POST',body:{intent:'trade',creativeId:'feed-trade'}});
        if(r&&r.ok&&r.slot) _adSlotCache=r.slot; else return;
      }
      var slot=_adSlotCache;
      var sig=String(slot.signature||slot.sig||slot.id||'').slice(0,16);
      var el=document.createElement('article');
      el.className='za-adslot';
      el.innerHTML='<span class="za-adslot-tag">Sponsored · intent trade · signed</span>'+
        '<p class="za-adslot-body">Signed intent ad slot — shown only because your intent is Trade.</p>'+
        '<span class="za-adslot-sig">slot '+esc(slot.id||'')+' · '+esc(sig)+'…</span>';
      feed.insertBefore(el, feed.firstChild);
    }
    var _humChallengeId=null;
    function wireWorld(){
      document.getElementById('zaAttnRefresh').onclick=async function(){ if(!token()){needAuth();return;} var a=await api('/api/zeusai-social/world/attention'); if(a&&a.ok) document.getElementById('zaAttnBal').textContent='Balance '+a.balanceSec+' seconds owned'; };
      document.getElementById('zaAttnDonate').onclick=async function(){
        if(!token()){needAuth();return;}
        var prof=await api('/api/zeusai-social/user/zeusai');
        if(!prof||!prof.ok){alert('zeusai not found');return;}
        var r=await api('/api/zeusai-social/world/attention/donate',{method:'POST',body:{toUserId:prof.profile.id,seconds:60}});
        if(r&&r.status===401){needAuth();return;}
        alert(r&&r.ok?('Donated. Balance '+r.balanceSec+'s'):(r&&r.error)||'fail');
        loadWorld();
      };
      document.getElementById('zaHumanStart').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/human/challenge',{method:'POST',body:{}});
        if(r&&r.status===401){needAuth();return;}
        _humChallengeId=r.challengeId;
        document.getElementById('zaHumanPrompt').textContent=r.prompt||'—';
      };
      document.getElementById('zaHumanVerify').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/human/verify',{method:'POST',body:{challengeId:_humChallengeId,answer:document.getElementById('zaHumanAns').value}});
        alert(r&&r.ok?'Human verified':'Failed: '+(r&&r.error));
      };
      document.getElementById('zaBwOverride').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/bandwidth/override',{method:'POST',body:{minutes:30}});
        alert(r&&r.ok?('Override until '+r.overrideUntil):(r&&r.error)||'fail');
      };
      document.getElementById('zaConsentSave').onclick=async function(){
        if(!token()){needAuth();return;}
        var handle=document.getElementById('zaConsentPeer').value.trim().replace(/^@/,'');
        var prof=await api('/api/zeusai-social/user/'+encodeURIComponent(handle));
        if(!prof||!prof.ok){alert('user not found');return;}
        var r=await api('/api/zeusai-social/world/consent',{method:'POST',body:{
          peerId:prof.profile.id,
          feed:document.getElementById('zaCFeed').checked,
          story:document.getElementById('zaCStory').checked,
          dm:document.getElementById('zaCDm').checked,
          recommend:document.getElementById('zaCRec').checked
        }});
        alert(r&&r.ok?'Consent saved':(r&&r.error)||'fail');
      };
      document.getElementById('zaBondPostBtn').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/bond',{method:'POST',body:{postId:document.getElementById('zaBondPost').value,amountBtc:document.getElementById('zaBondAmt').value||0.0001}});
        alert(r&&r.ok?('Bond '+r.bond.id):(r&&r.error)||'fail'); loadWorld();
      };
      document.getElementById('zaClaimSave').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/claim',{method:'POST',body:{postId:document.getElementById('zaClaimPost').value,state:document.getElementById('zaClaimState').value,evidence:document.getElementById('zaClaimEv').value}});
        alert(r&&r.ok?'Claim set':(r&&r.error)||'fail');
      };
      document.getElementById('zaSplitSave').onclick=async function(){
        if(!token()){needAuth();return;}
        var handle=document.getElementById('zaSplitPeer').value.trim().replace(/^@/,'');
        var prof=await api('/api/zeusai-social/user/'+encodeURIComponent(handle));
        if(!prof||!prof.ok||!me||!me.profile){alert('need peer + signed in');return;}
        var r=await api('/api/zeusai-social/world/split',{method:'POST',body:{postId:document.getElementById('zaSplitPost').value,shares:[{userId:me.profile.id,pct:50},{userId:prof.profile.id,pct:50}]}});
        alert(r&&r.ok?'Split saved':(r&&r.error)||'fail');
      };
      document.getElementById('zaAdSlot').onclick=async function(){
        if(!token()){needAuth();return;}
        await api('/api/zeusai-social/intent',{method:'POST',body:{intent:'trade'}});
        var r=await api('/api/zeusai-social/world/ad-slot',{method:'POST',body:{intent:'trade',creativeId:'demo-trade'}});
        alert(r&&r.ok?('Ad slot signed '+r.slot.id):(r&&r.error)||'fail');
      };
      document.getElementById('zaExport').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/export');
        if(r&&r.status===401){needAuth();return;}
        if(!r||!r.ok){alert((r&&r.error)||'export failed');return;}
        var blob=new Blob([JSON.stringify(r.pack,null,2)],{type:'application/json'});
        var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='zeusai-social-exit-'+Date.now()+'.json'; a.click();
      };
      document.getElementById('zaReanchor').onclick=async function(){
        if(!token()){needAuth();return;}
        var r=await api('/api/zeusai-social/world/reanchor',{method:'POST',body:{postId:document.getElementById('zaReanchorPost').value}});
        alert(r&&r.ok?'Re-anchored 72h':(r&&r.error)||'fail');
      };
      document.getElementById('zaFedLookup').onclick=async function(){
        var id=document.getElementById('zaFedPost').value.trim();
        if(!id){alert('post id required');return;}
        var r=await api('/api/zeusai-social/world/federation/'+encodeURIComponent(id));
        document.getElementById('zaFedOut').textContent=r&&r.ok&&r.cid?('CID '+r.cid):((r&&r.error)||'not pinned');
      };
      document.getElementById('zaRepLookup').onclick=async function(){
        var handle=document.getElementById('zaRepHandle').value.trim().replace(/^@/,'');
        var prof=await api('/api/zeusai-social/user/'+encodeURIComponent(handle));
        if(!prof||!prof.ok){alert('user not found');return;}
        var r=await api('/api/zeusai-social/world/reputation/'+encodeURIComponent(prof.profile.id));
        document.getElementById('zaRepOut').textContent=r&&r.ok?('score '+r.score+' · events '+(r.events&&r.events.length||0)):(r&&r.error)||'fail';
      };
      document.getElementById('zaBondList').addEventListener('click',async function(e){
        var b=e.target.closest('[data-challenge-bond]');
        if(!b) return;
        if(!token()){needAuth();return;}
        var reason=prompt('Challenge reason');
        if(!reason) return;
        var r=await api('/api/zeusai-social/world/bond/challenge',{method:'POST',body:{bondId:b.getAttribute('data-challenge-bond'),reason:reason,evidence:'user challenge'}});
        alert(r&&r.ok?'Bond contested':(r&&r.error)||'fail'); loadWorld();
      });
    }

    var _notifReadBtn=document.getElementById('zaNotifReadAll');
    if(_notifReadBtn) _notifReadBtn.onclick=async function(){
      if(!token()){ needAuth(); return; }
      var r=await api('/api/zeusai-social/notifications/read',{method:'POST',body:{}});
      if(r&&r.status===401){ needAuth(); return; }
      await loadNotifications();
      refreshNotifBadge();
    };
    wireWorld();
    refreshMe().then(function(){
      refreshAttnStrip(); refreshNotifBadge();
      var qUser=new URLSearchParams(location.search).get('user');
      if(qUser){ showPane('profile'); openProfile(qUser); }
      else loadPane('home');
    });
    setInterval(function(){ var on=document.querySelector('.za-rail-btn.is-on'); if(on) loadPane(on.getAttribute('data-pane')); refreshNotifBadge(); },15000);
  })();
  </script>
  </section>`;
}

function pageAdminSocialNetwork() {
  return `<section class="section"><div class="container">
    <h1 class="h1">Admin · ZeusAI Social</h1>
    <p style="color:var(--ink-dim)">Protected operator panel for ZeusAI Social autonomy. Requires admin authentication token/cookie.</p>
    <div class="card" id="snAdminCard" style="margin-top:12px"><p style="margin:0;color:var(--ink-dim)">Loading dashboard…</p></div>
  </div>
  <script>
  (function(){
    async function r(){
      const box=document.getElementById('snAdminCard');
      try{
        const p=await fetch('/api/social-orchestrator/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'dashboard'})});
        const d=await p.json();
        if(!p.ok||!d||!d.ok){ throw new Error((d&&d.error)||('http '+p.status)); }
        const x=d.dashboard||{};
        const reach=x.proofOfReach||{};
        box.innerHTML='<div class="grid">'+
          '<div class="card"><span class="tag">Brand</span><h3>'+String(x.brand||'ZeusAI Social')+'</h3><p style="color:var(--ink-dim)">mode '+String(x.mode||'—')+' · dry-run until '+String(x.dryRunUntil||'n/a')+'</p></div>'+
          '<div class="card"><span class="tag">Commerce mirror</span><h3>$'+String(x.profitUsdDay||0)+'</h3><p style="color:var(--ink-dim)">'+String(x.profitBtcDay||0)+' BTC/day</p></div>'+
          '<div class="card"><span class="tag">Proof-of-Reach</span><h3>'+String(reach.autonomyCoveragePct!=null?reach.autonomyCoveragePct:'—')+'%</h3><p style="color:var(--ink-dim)">signals '+String(reach.signalCount||0)+' · arbitrage '+String(reach.attentionArbitrageScore||'—')+'</p></div>'+
          '</div>';
      }catch(e){ box.innerHTML='<p style="margin:0;color:#ff6b6b">Access denied or unavailable: '+String(e&&e.message||e)+'</p>'; }
    }
    r(); setInterval(r,15000);
  })();
  </script>
  </section>`;
}

function pageAdminLogin() {
  return `<section class="section">
  <div class="container" style="max-width:460px">
    <h1 class="h1">Admin</h1>
    <p style="color:var(--ink-dim)">One-time login. A secure HttpOnly cookie is set for 7 days — afterwards you just go to <code class="inline">/admin/services</code> and everything works.</p>
    <form id="admLoginForm" class="card" style="padding:22px;display:grid;gap:12px;margin-top:18px">
      <label style="font-size:12px;color:var(--ink-dim)">Admin password</label>
      <input id="admLoginPwd" type="password" autocomplete="current-password" required placeholder="ADMIN_SECRET" style="padding:12px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <button class="btn btn-primary" type="submit">Login</button>
      <span id="admLoginMsg" style="font-size:13px;color:var(--ink-dim);min-height:18px"></span>
    </form>
    <div id="admLoginActive" style="display:none;margin-top:18px" class="card">
      <div style="padding:16px">
        <strong>✓ Logged in.</strong>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
          <a href="/admin/services" class="btn btn-primary">Manage services →</a>
          <button id="admLogoutBtn" class="btn">Logout</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function pageAdminServices() {
  return `<section class="section">
  <div class="container">
    <h1 class="h1">Admin · Services</h1>
    <p style="color:var(--ink-dim);max-width:780px">Add, edit or remove marketplace services in real time. Changes are persisted on the backend and broadcast instantly (&lt;1s) to every connected browser via SSE.</p>
    <div id="admSessionBar" style="margin:18px 0;display:flex;gap:10px;align-items:center;font-size:13px"></div>
    <div class="card" style="padding:22px;margin:12px 0 28px">
      <h3 style="margin:0 0 12px">New / Update service</h3>
      <form id="admSvcForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
        <div><label style="font-size:12px;color:var(--ink-dim)">id</label><input name="id" required placeholder="adaptive-ai" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">title</label><input name="title" required placeholder="Adaptive AI" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">segment</label><input name="segment" placeholder="all|startups|companies|enterprise" value="all" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">kpi</label><input name="kpi" placeholder="automation coverage" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">price (USD)</label><input name="price" type="number" min="0" step="1" value="499" required style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">billing</label><input name="billing" placeholder="monthly|annual|one-time" value="monthly" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div style="grid-column:1/-1"><label style="font-size:12px;color:var(--ink-dim)">description</label><textarea name="description" rows="2" placeholder="Short value proposition" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></textarea></div>
        <div style="grid-column:1/-1;display:flex;gap:10px">
          <button class="btn btn-primary" type="submit">Create / update</button>
          <button class="btn" type="reset">Clear</button>
          <span id="admSvcMsg" style="align-self:center;font-size:13px;color:var(--ink-dim)"></span>
        </div>
      </form>
    </div>
    <h3 style="margin:0 0 12px">Live catalogue (auto-syncs)</h3>
    <div id="admSvcList" style="display:grid;gap:10px">—</div>
  </div>
</section>`;
}

function pageInnovations() {
  return `<section class="section">
  <div class="container">
    <h1 class="h1">Live Innovation Coverage</h1>
    <p class="lead" style="max-width:880px">Innovation map for the live Unicorn: cryptographic durability, sovereign primitives and production coverage from <code class="inline">/api/innovation/coverage</code>, plus the 30-year proof layer, 50Y standard and 100Y horizon below.</p>

    <div class="card" style="padding:18px;margin:18px 0" id="invCoverageCard">
      <span class="tag">Live coverage · hydrated</span>
      <h3 style="margin:8px 0">Runtime coverage summary</h3>
      <p id="invCoverageSummary" style="color:var(--ink-dim);font-size:14px;margin:0 0 10px">Loading /api/innovation/coverage…</p>
      <div id="invCoverageGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px"></div>
      <p style="color:var(--ink-dim);font-size:12.5px;margin:12px 0 0"><strong style="color:#fff">Label key:</strong> <code class="inline">live-100*</code> = production API · <code class="inline">*foundation*</code> = shipped protocol, not full marketplace product · <code class="inline">*needs-secret*</code> = optional rail awaiting owner keys · <code class="inline">pledge</code> endpoints are signed commitments, not automatic chain settlement.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:22px 0">
      <div class="card" style="padding:18px"><span class="tag">Coverage API</span><h3>Live coverage</h3><p style="color:var(--ink-dim);font-size:13.5px">Runtime coverage summary for recent innovations and deployed modules.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn" href="#invCoverageCard" data-link>Jump to live panel</a><button type="button" class="btn" data-live-inspect="/api/innovation/coverage" data-live-title="View live coverage">Inspect coverage</button></div></div>
      <div class="card" style="padding:18px;border:1px solid rgba(255,159,28,.35)"><span class="tag" style="background:linear-gradient(135deg,#FF3B5C,#FF9F1C);color:#12080a">CIC/1.0 · 2066</span><h3 style="margin:8px 0">Chromatic Identity Continuum</h3><p style="color:var(--ink-dim);font-size:13.5px">World-first forever brand spectrum: Volt Aurora chromatics + blade-condensed letterform genome, signed to the forever-key so agents can verify the real ZeusAI look for 40+ years.</p><div id="invSpectrumSwatches" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0"></div><button type="button" class="btn" data-live-inspect="/.well-known/brand-spectrum.json" data-live-title="View spectrum live" style="margin-top:8px">View spectrum live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Forward-only</span><h3>No downgrade path</h3><p style="color:var(--ink-dim);font-size:13.5px">Every accepted innovation must pass canary, QIS and final smoke before promotion.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Live site</span><h3>Innovation map</h3><p style="color:var(--ink-dim);font-size:13.5px">This page is the visible map for what changed and where to verify it.</p></div>
    </div>

    <h2 id="zeus50y" style="margin-top:32px">50-year standard · permanence &amp; sovereignty <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">Additive pillars under <code class="inline">/api/v50/*</code>: permanence, security, sovereignty, intelligence. Live status hydrates below.</p>
    <div class="card" style="padding:18px;margin:14px 0 22px">
      <span class="tag">GET /api/v50/status</span>
      <h3 id="inv50Title" style="margin:8px 0">…</h3>
      <p id="inv50Meta" style="color:var(--ink-dim);font-size:13.5px;margin:0 0 12px">Loading 50Y status…</p>
      <div id="inv50Pillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"></div>
      <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn" data-live-inspect="/api/v50/status" data-live-title="Inspect 50Y status" style="margin-top:8px">Inspect 50Y status</button>
        <button type="button" class="btn" data-live-inspect="/.well-known/did.json" data-live-title="Inspect DID" style="margin-top:8px">Inspect DID</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:22px 0">
      <div class="card" style="padding:18px"><span class="tag">Constitution</span><h3 id="invConHash" style="margin:8px 0;font-family:monospace">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public, hashed, signed. Every response carries <code class="inline">X-Constitution-Hash</code>.</p><button type="button" class="btn" data-live-inspect="/api/constitution" data-live-title="Inspect constitution" style="margin-top:8px">Inspect constitution</button></div>
      <div class="card" style="padding:18px"><span class="tag">Today's Merkle root</span><h3 id="invRoot" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px"><span id="invRootCount">0</span> receipts · OP_RETURN-ready · published daily</p><button type="button" class="btn" data-live-inspect="/api/receipts/root" data-live-title="Inspect Merkle root" style="margin-top:8px">Inspect Merkle root</button></div>
      <div class="card" style="padding:18px"><span class="tag">BTC TWAP (5-source median)</span><h3 id="invTwap" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Kraken · Coinbase · Bitstamp · Binance · OKX</p><button type="button" class="btn" data-live-inspect="/api/btc/twap" data-live-title="Inspect BTC TWAP" style="margin-top:8px">Inspect BTC TWAP</button></div>
      <div class="card" style="padding:18px"><span class="tag">Quantum-safe signing</span><h3 style="margin:8px 0">Ed25519 + ML-DSA-65</h3><p style="color:var(--ink-dim);font-size:13.5px">FIPS 204 hybrid. 3309-byte PQ signature on every daily root.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Reproducible SBOM</span><h3 id="invSbom" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">sha3-256 over critical sources · public composite hash</p><button type="button" class="btn" data-live-inspect="/api/sbom" data-live-title="Inspect SBOM" style="margin-top:8px">Inspect SBOM</button></div>
      <div class="card" style="padding:18px"><span class="tag">Permanent archive manifest</span><h3 style="margin:8px 0">Archive snapshot</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily root + constitution + SBOM + PQ pubkey, ready for Archive.org / Arweave anchoring.</p><button type="button" class="btn" data-live-inspect="/api/innovations/archive" data-live-title="Inspect archive" style="margin-top:8px">Inspect archive</button></div>
    </div>

    <h2 id="zeus100y" style="margin-top:32px">100-year horizon · world-standard primitives <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 GET-only deterministic endpoints designed to remain a public web standard for 50+ years. Additive only · 5-year deprecation windows · zero rollback path. <button type="button" class="btn" data-live-inspect="/api/v100/manifest" data-live-title="Discovery manifest" style="margin-top:4px">Discovery manifest live →</button></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">Long-term contract</span><h3 style="margin:8px 0">Civilization Protocol</h3><p style="color:var(--ink-dim);font-size:13.5px">Machine-readable migration contract: same URL, same shape, same semantics across 50+ years.</p><button type="button" class="btn" data-live-inspect="/.well-known/civilization-protocol.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Operational rights</span><h3 style="margin:8px 0">AI Bill of Rights</h3><p style="color:var(--ink-dim);font-size:13.5px">10 enforceable rights: explain, appeal, portability, opt-out, provenance, equity, non-discrimination.</p><button type="button" class="btn" data-live-inspect="/.well-known/ai-rights.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Interop</span><h3 style="margin:8px 0">Earth Standard</h3><p style="color:var(--ink-dim);font-size:13.5px">Time, identity, currency, energy, language, transport — minimal protocol any system can adopt.</p><button type="button" class="btn" data-live-inspect="/.well-known/earth-standard.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Sovereign claim</span><h3 style="margin:8px 0">Zeus Attestation</h3><p style="color:var(--ink-dim);font-size:13.5px">Public commitment list, dual-track classical + post-quantum keys, yearly rotation.</p><button type="button" class="btn" data-live-inspect="/.well-known/zeus-attestation.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">PQC roadmap</span><h3 style="margin:8px 0">Post-Quantum Readiness</h3><p style="color:var(--ink-dim);font-size:13.5px">Hybrid migration plan: ML-KEM-768 + ML-DSA-65 staged 2027-2030, no flag day.</p><button type="button" class="btn" data-live-inspect="/api/v100/pq-readiness" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon-aware</span><h3 style="margin:8px 0">Carbon Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-request gCO₂ budget, X-Green-GCO2 advisory header, halve-by-2030, net-zero-by-2050.</p><button type="button" class="btn" data-live-inspect="/api/v100/carbon-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Right-to-explain</span><h3 style="margin:8px 0">Decision Explainer</h3><p style="color:var(--ink-dim);font-size:13.5px">Plain-language explanation for any algorithmic decision via /api/v100/explain/:id.</p><button type="button" class="btn" data-live-inspect="/api/v100/explain/sample" data-live-title="Try live sample" style="margin-top:8px">Try live sample</button></div>
      <div class="card" style="padding:18px"><span class="tag">Sovereignty</span><h3 style="margin:8px 0">Data Sovereignty</h3><p style="color:var(--ink-dim);font-size:13.5px">User is sole owner. Export · delete · rectify · time-lock · transfer to successor origin.</p><button type="button" class="btn" data-live-inspect="/api/v100/data-sovereignty" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Transparency proofs</span><h3 style="margin:8px 0">Time-Locked Anchors</h3><p style="color:var(--ink-dim);font-size:13.5px">Cryptographic time-locked attestations for any account event. Sample hash response.</p><button type="button" class="btn" data-live-inspect="/api/v100/timelock/deadbeefcafebabe" data-live-title="Try live sample" style="margin-top:8px">Try live sample</button></div>
      <div class="card" style="padding:18px"><span class="tag">Reversibility</span><h3 style="margin:8px 0">Reversibility Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public registry of which actions are reversible, the window, and the channel.</p><button type="button" class="btn" data-live-inspect="/api/v100/reversibility-manifest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Universal schema</span><h3 style="margin:8px 0">Machine Ontology</h3><p style="color:var(--ink-dim);font-size:13.5px">JSON-LD types extending schema.org: Decision, Provenance, CarbonBudget, Right, Pledge.</p><button type="button" class="btn" data-live-inspect="/api/v100/ontology" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Provenance root</span><h3 style="margin:8px 0">Build Merkle Root</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-build provenance hash, advertised via X-Zeus-Provenance on every response.</p><button type="button" class="btn" data-live-inspect="/api/v100/provenance" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Equity</span><h3 style="margin:8px 0">Digital Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">Save-Data + reduced-motion honored. No feature gated by network speed, device class, geography.</p><button type="button" class="btn" data-live-inspect="/api/v100/digital-equity" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">50-year pledge</span><h3 style="margin:8px 0">Longevity Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">No breaking change without 5-year deprecation window. Yearly archival mirror. Successor-key escrow.</p><button type="button" class="btn" data-live-inspect="/api/v100/longevity-pledge" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">100Y Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 endpoints with stability tags and machine/human entry points.</p><button type="button" class="btn" data-live-inspect="/api/v100/manifest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
    </div>

    <h2 id="zeusperf100y" style="margin-top:32px">Performance · 100-year horizon <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">13 GET-only deterministic endpoints codifying public performance budgets, composited-only animation, image / font / cache / preload / Early-Hints policies, and a 50-year performance pledge. Additive only · zero rollback path · machine + human discovery. <button type="button" class="btn" data-live-inspect="/api/v100/perf/manifest" data-live-title="Performance manifest" style="margin-top:4px">Performance manifest live →</button></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">Public budget</span><h3 style="margin:8px 0">Per-Route Perf Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">LCP/INP/CLS/TBT/FCP/TTFB hard-caps per route. Regression beyond cap rolls back within 24h.</p><button type="button" class="btn" data-live-inspect="/.well-known/perf-budget.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Signed claim</span><h3 style="margin:8px 0">Web Vitals Attestation</h3><p style="color:var(--ink-dim);font-size:13.5px">Ed25519 + ML-DSA-65 hybrid signature on pledged Core Web Vitals. Yearly rotation.</p><button type="button" class="btn" data-live-inspect="/.well-known/web-vitals-attestation.json" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Render path</span><h3 style="margin:8px 0">Render Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-page critical CSS/JS, SSR HTML target, hydration deadline. No JS before first paint.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/render-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">DOM size</span><h3 style="margin:8px 0">DOM Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Total nodes / depth / max children hard-caps. Pre-deploy lint enforces.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/dom-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Main thread</span><h3 style="margin:8px 0">Main-Thread Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Longest-task ≤100ms cap, TBT ≤400ms cap, ≤3 long-tasks per nav. Web Workers + scheduler.yield().</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/main-thread-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">GPU only</span><h3 style="margin:8px 0">Composited-Only Animations</h3><p style="color:var(--ink-dim);font-size:13.5px">Only opacity + transform animate. Forbidden: width/height/margin/font-size/box-shadow.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/animation-policy" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Images</span><h3 style="margin:8px 0">Image Delivery Policy</h3><p style="color:var(--ink-dim);font-size:13.5px">Width+height locked, fetchpriority on LCP, AVIF primary, lazy below-the-fold.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/image-policy" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Fonts</span><h3 style="margin:8px 0">Zero-Layout-Shift Fonts</h3><p style="color:var(--ink-dim);font-size:13.5px">font-display:swap + size-adjust + ascent-override. Self-hosted, &lt;30 KB per face.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/font-policy" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Cache</span><h3 style="margin:8px 0">Immutable + SWR</h3><p style="color:var(--ink-dim);font-size:13.5px">Hashed assets immutable for 1y; HTML stale-while-revalidate. Never break a cached URL.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/cache-policy" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Preload</span><h3 style="margin:8px 0">Early-Hints (103) Policy</h3><p style="color:var(--ink-dim);font-size:13.5px">≤4 critical resources preloaded per nav. preconnect + dns-prefetch tiers.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/preload-policy" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon-aware</span><h3 style="margin:8px 0">Zero-Energy Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">≤0.05 gCO₂ per request. Halve by 2030, net-zero by 2050, negative by 2076.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/zero-energy-pledge" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">50-year pledge</span><h3 style="margin:8px 0">Longevity Perf Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">No regression &gt;5% lands without same-day rollback plan. Tightening only, never loosening.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/longevity-perf-pledge" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">Performance Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 13 perf endpoints with stability tags and entry points.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/manifest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
    </div>

    <h2 id="zeusperf100yv2" style="margin-top:32px">Performance · 100Y v2 — visionary primitives <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 second-wave perf contracts with no public web standard equivalent today: causal render graph, frame budget at 60/120/240fps, energy-per-interaction (joules per click), latency equity map, p99/p999/p9999 tail caps, hydration cost manifest, perceptual quality index, anti-layout-thrash blacklist, predictability variance budget, signed perf+carbon joint receipts, INP attribution ledger. <button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/manifest" data-live-title="v2 manifest" style="margin-top:4px">v2 manifest live →</button></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">DAG</span><h3 style="margin:8px 0">Causal Render Graph</h3><p style="color:var(--ink-dim);font-size:13.5px">Public DAG of every blocking edge from HTML → LCP. No W3C equivalent today.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/causal-render-graph" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">High-fps</span><h3 style="margin:8px 0">Frame Budget Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-frame CPU + style + layout + paint budgets at 60 / 120 / 240 fps. Signed.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/frame-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">New metric</span><h3 style="margin:8px 0">Energy-per-Interaction</h3><p style="color:var(--ink-dim);font-size:13.5px">Joules per click — brand-new sustainability metric paired with INP. Halve by 2030.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/energy-per-interaction" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Equity</span><h3 style="margin:8px 0">Latency Equity Map</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-region + per-device targets. maxRegion/medianRegion ≤ 2.0 — digital justice.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/latency-equity-map" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Long tail</span><h3 style="margin:8px 0">Tail Latency Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Hard caps on p99 / p999 / p9999, not just p75. Hedged requests + tail-aware LB.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/tail-latency-pledge" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Post-deploy</span><h3 style="margin:8px 0">Cold-Start Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">First-request TTFB after every deploy/restart. Pipeline blocks if hardCap exceeded.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/cold-start-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">SSR + hydrate</span><h3 style="margin:8px 0">Hydration Cost Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public ms+KB cost per interactive component. Cumulative ≤50ms in first second.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/hydration-cost" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Adaptive</span><h3 style="margin:8px 0">Network Adaptivity Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">Declarative degradation matrix per ECT × Save-Data. No paid feature gated by speed.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/network-adaptivity" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Beyond CWV</span><h3 style="margin:8px 0">Perceptual Quality Index</h3><p style="color:var(--ink-dim);font-size:13.5px">Composite of jitter, scroll smoothness, motion-photon latency, AV sync. Target PQI ≥ 90.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/perceptual-quality" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">No reflow</span><h3 style="margin:8px 0">Anti-Layout-Thrash Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Public blacklist of forced-reflow APIs with measured cost + approved alternatives.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/anti-layout-thrash" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Variance</span><h3 style="margin:8px 0">Predictability Index</h3><p style="color:var(--ink-dim);font-size:13.5px">Coefficient-of-variation budget per metric. Consistency matters as much as speed.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/predictability-index" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Byte cap</span><h3 style="margin:8px 0">Critical-Path Diet</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed total byte budget for first contentful paint. May only shrink for 50 years.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/critical-path-diet" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Pre-render</span><h3 style="margin:8px 0">Speculative Render Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public list of routes + triggers + privacy trade-offs. Suppressed under Save-Data.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/speculative-render" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Joint proof</span><h3 style="margin:8px 0">Perf + Carbon Receipt</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-request signed receipt fusing TTFB / LCP / INP with measured gCO₂ + grid intensity.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/joint-receipt" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">INP audit</span><h3 style="margin:8px 0">INP Attribution Ledger</h3><p style="color:var(--ink-dim);font-size:13.5px">Public, signed, per-interaction breakdown: which script, which handler, which long task.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/inp-attribution" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">v2 Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 second-wave primitives with novelty notes vs current standards.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v2/manifest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
    </div>

    <h2 id="zeusperf100yv3" style="margin-top:32px">Performance · 100Y v3 — 50-year web standard <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 third-wave contracts that turn zeusai.pro into a public web standard for the next 50 years: semantic stability pact, accessibility equity ledger, cognitive load budget, anti-dark-patterns receipt, data minimization proof, offline-first pledge, time-to-meaningful-content (TTMC), interop contract, content provenance chain (anti-AI-slop), zero-knowledge telemetry, graceful degradation matrix, mobile-parity pact, viewport equity, touch-target equity, battery-impact budget. <button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/manifest" data-live-title="v3 manifest" style="margin-top:4px">v3 manifest live →</button></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">50y semantic</span><h3 style="margin:8px 0">Semantic Stability Pact</h3><p style="color:var(--ink-dim);font-size:13.5px">Landmarks, headings (max h3), ARIA roles &amp; microdata pinned for 50 years. Future scrapers can rely on it.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/semantic-stability-pact" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Beyond WCAG</span><h3 style="margin:8px 0">Accessibility Equity Ledger</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-disability-class TTI &amp; parity ratio. No class shall be &gt;10% slower than baseline.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/accessibility-equity-ledger" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">New metric</span><h3 style="margin:8px 0">Cognitive Load Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Reading grade ≤9, ≤5 decisions/screen, ≤8% jargon. Cognitive accessibility codified.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/cognitive-load-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">No dark UX</span><h3 style="margin:8px 0">Attention-Economy Receipt</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed declaration: no roach-motel, no confirmshaming, no privacy-zuckering. Per release.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/attention-economy-receipt" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Minimal bytes</span><h3 style="margin:8px 0">Data-Minimization Proof</h3><p style="color:var(--ink-dim);font-size:13.5px">Bytes-shipped : bytes-strictly-needed ratio published. Cap ≤ 1.5×.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/data-minimization-proof" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Offline</span><h3 style="margin:8px 0">Offline-First Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Every public surface has a documented offline contract. No more white screens.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/offline-first-pledge" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Post-LCP</span><h3 style="margin:8px 0">Time-To-Meaningful-Content</h3><p style="color:var(--ink-dim);font-size:13.5px">TTMC: paint + no-CLS + interactive + alt-text resolved. p75 ≤ 1.8s.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/time-to-meaningful-content" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Forward compat</span><h3 style="margin:8px 0">Interop Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">36-month sunset grace, parallel /v(N+1)/, Sunset/Deprecation/successor-version headers.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/interop-contract" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Anti-AI-slop</span><h3 style="margin:8px 0">Content Provenance Chain</h3><p style="color:var(--ink-dim);font-size:13.5px">Every text/image declares origin: human / ai-assisted / ai-generated / syndicated. Signed.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/content-provenance-chain" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Privacy</span><h3 style="margin:8px 0">Zero-Knowledge Telemetry</h3><p style="color:var(--ink-dim);font-size:13.5px">k-anonymity ≥ 50, ε ≤ 1.0 differential privacy, no IP retention. Performance observable, users not.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/zero-knowledge-telemetry" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Fallback map</span><h3 style="margin:8px 0">Graceful Degradation Matrix</h3><p style="color:var(--ink-dim);font-size:13.5px">Every modern feature mapped to its documented fallback. Lynx-compatible HTML+forms.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/graceful-degradation-matrix" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Mobile ≡ Desktop</span><h3 style="margin:8px 0">Mobile-Parity Pact</h3><p style="color:var(--ink-dim);font-size:13.5px">Every desktop CTA reachable on mobile. p75 LCP/INP delta caps. Forbids desktop-only features.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/mobile-parity-pact" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Per viewport</span><h3 style="margin:8px 0">Viewport Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">320px feature phone is first-class. p75 LCP/INP committed per viewport class.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/viewport-equity" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">WCAG 2.5.5++</span><h3 style="margin:8px 0">Touch-Target Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">Min 44×44 px target, 8 px spacing, 56 px for critical actions. Build-time enforced.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/touch-target-equity" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Battery</span><h3 style="margin:8px 0">Battery-Impact Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Median session ≤ 8 mWh. 5 min ≤ 0.05% of a 4000 mAh battery. Pause-on-hide.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/battery-impact-budget" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">v3 Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 third-wave 50-year-standard primitives.</p><button type="button" class="btn" data-live-inspect="/api/v100/perf/v3/manifest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
    </div>

    <h2 style="margin-top:32px">Model registry &amp; provenance</h2>
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#0b0f17"><th style="text-align:left;padding:12px">Model</th><th style="text-align:left;padding:12px">Family</th><th style="text-align:left;padding:12px">Provenance</th><th style="text-align:left;padding:12px">SHA-256</th></tr></thead><tbody id="invModels"><tr><td colspan="4" style="padding:14px;color:var(--ink-dim)">Model registry will appear here.</td></tr></tbody></table>
    </div>

    <h2 style="margin-top:32px">Sealed incidents (commit-reveal)</h2>
    <p style="color:var(--ink-dim);font-size:14px;max-width:780px">Every incident is committed encrypted at occurrence time and revealed automatically after the time-lock expires. No incident can be deleted or rewritten.</p>
    <div id="invIncidents" class="card" style="padding:18px;margin-top:12px;font-size:14px;color:var(--ink-dim)">Incident timeline will appear here.</div>

    <h2 style="margin-top:32px">All public endpoints</h2>
    <ul style="color:var(--ink-dim);font-size:14px;line-height:2;list-style:none;padding:0">
      <li><code class="inline">GET /api/constitution</code> — full text + hash + signature</li>
      <li><code class="inline">GET /api/innovations/status</code> — overview JSON</li>
      <li><code class="inline">GET /api/innovations/archive</code> — permanent archive manifest</li>
      <li><code class="inline">GET /.well-known/ai-attestation</code> — discovery endpoint for crawlers</li>
      <li><code class="inline">GET /api/btc/twap</code> — 5-source median, 60s TTL</li>
      <li><code class="inline">GET /api/sbom</code> — reproducible build manifest</li>
      <li><code class="inline">GET /api/incidents</code> — public sealed incident list</li>
      <li><code class="inline">GET /api/audit/me</code> — your personal Merkle audit log</li>
      <li><code class="inline">GET /api/receipts/root</code> — today's signed Merkle root</li>
      <li><code class="inline">GET /api/receipts/proof/:id</code> — inclusion proof for any receipt</li>
      <li><code class="inline">POST /api/innovations/receipt</code> — append a receipt</li>
      <li><code class="inline">POST /api/innovations/roll-root</code> — finalize today's root</li>
    </ul>

    <h2 style="margin-top:42px">Second batch · 15 more primitives <span class="tag" style="margin-left:8px">v2</span></h2>
    <p style="color:var(--ink-dim);max-width:880px">ZK-friendly commitments, threshold key bootstrap, federated learning aggregator, verifiable random &amp; delay functions, k-anonymity analytics, censorship-resistant relay descriptor, signed reputation graph, GDPR/SOC2 self-attestation, DR drill ledger, carbon ledger, bug-bounty escrow, decentralized identity (did:web + did:key).</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0">
      <div class="card" style="padding:18px"><span class="tag">DID Document</span><h3 style="margin:8px 0;font-size:15px">did:web:zeusai.pro</h3><p style="color:var(--ink-dim);font-size:13.5px">W3C-compliant decentralized identity at <code class="inline">/.well-known/did.json</code></p><button type="button" class="btn" data-live-inspect="/.well-known/did.json" data-live-title="Inspect DID" style="margin-top:8px">Inspect DID</button></div>
      <div class="card" style="padding:18px"><span class="tag">Compliance attestation</span><h3 id="invCompHash" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">GDPR · SOC2 · ISO27001 self-attestation, hashed + signed</p><button type="button" class="btn" data-live-inspect="/api/compliance/attestation" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon ledger</span><h3 id="invCarbon" style="margin:8px 0;font-size:18px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily attestations, signed gCO₂ entries</p><button type="button" class="btn" data-live-inspect="/api/v2/carbon/attest" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Bug bounty</span><h3 id="invBounty" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public open-bounty escrow ledger</p><button type="button" class="btn" data-live-inspect="/api/v2/bounty/total" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">Relay descriptor</span><h3 style="margin:8px 0;font-size:15px">HTTPS · Tor · Nostr · IPFS</h3><p style="color:var(--ink-dim);font-size:13.5px">Censorship-resistant transports advertised publicly</p><button type="button" class="btn" data-live-inspect="/api/v2/relay" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">VRF · VDF</span><h3 style="margin:8px 0;font-size:15px">Provable randomness &amp; time-locks</h3><p style="color:var(--ink-dim);font-size:13.5px">HMAC-VRF for fair lotteries · iterated-SHA256 VDF for sealed reveals</p></div>
      <div class="card" style="padding:18px"><span class="tag">DR drills</span><h3 id="invDR" style="margin:8px 0">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed disaster-recovery drill ledger</p><button type="button" class="btn" data-live-inspect="/api/v2/dr/list" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
      <div class="card" style="padding:18px"><span class="tag">v2 Status</span><h3 style="margin:8px 0;font-size:15px">15 primitives · 28 endpoints</h3><p style="color:var(--ink-dim);font-size:13.5px">Full feature inventory + counters</p><button type="button" class="btn" data-live-inspect="/api/v2/status" data-live-title="Inspect live" style="margin-top:8px">Inspect live</button></div>
    </div>
    <details style="margin-top:18px"><summary style="cursor:pointer;color:var(--ink-dim);font-size:14px">All v2 endpoints (28)</summary>
    <ul style="color:var(--ink-dim);font-size:13px;line-height:1.9;list-style:none;padding:12px 0 0 0">
      <li><code class="inline">GET  /api/v2/status</code> — feature inventory</li>
      <li><code class="inline">GET  /.well-known/did.json</code> — W3C DID document</li>
      <li><code class="inline">GET  /api/compliance/attestation</code> — GDPR/SOC2 attestation</li>
      <li><code class="inline">GET  /api/v2/relay</code> — relay descriptor</li>
      <li><code class="inline">GET  /api/v2/carbon/attest</code> — daily gCO₂ attest</li>
      <li><code class="inline">GET  /api/v2/bounty/total · /list</code></li>
      <li><code class="inline">GET  /api/v2/dr/list</code></li>
      <li><code class="inline">GET  /api/v2/fl/rounds</code></li>
      <li><code class="inline">GET  /api/v2/threshold/list</code></li>
      <li><code class="inline">GET  /api/v2/reputation/:did</code></li>
      <li><code class="inline">GET  /api/v2/did/self · /api/v2/did/resolve/:did</code></li>
      <li><code class="inline">GET  /api/v2/bucket/take/:key</code> — token bucket</li>
      <li><code class="inline">POST /api/v2/zk/commit · /verify</code></li>
      <li><code class="inline">POST /api/v2/threshold/keygen</code></li>
      <li><code class="inline">POST /api/v2/fl/submit · /close</code></li>
      <li><code class="inline">POST /api/v2/vrf/prove · /verify</code></li>
      <li><code class="inline">POST /api/v2/vdf/eval · /verify</code></li>
      <li><code class="inline">POST /api/v2/reputation</code></li>
      <li><code class="inline">POST /api/v2/dr/record</code></li>
      <li><code class="inline">POST /api/v2/carbon/record</code></li>
      <li><code class="inline">POST /api/v2/bounty/add</code></li>
    </ul>
    </details>
  </div>
  <script>
  (async function(){
    const $ = (id) => document.getElementById(id);
    function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    try {
      const cov = await (await fetch('/api/innovation/coverage')).json();
      const sum = cov && cov.summary || {};
      if ($('invCoverageSummary')) {
        $('invCoverageSummary').textContent = (sum.total||0)+' items · '+(sum.live||0)+' live-100 · '+(sum.foundation||0)+' foundation · generated '+(cov.generatedAt||'').slice(0,19);
      }
      const items = Array.isArray(cov && cov.items) ? cov.items.slice(0, 12) : [];
      if ($('invCoverageGrid')) {
        $('invCoverageGrid').innerHTML = items.map(function(it){
          return '<div style="padding:12px;border:1px solid #1f2a3b;border-radius:10px;background:rgba(5,4,10,.4)"><div style="font-size:12px;color:var(--ink-dim)">'+esc(it.id)+'</div><div style="font-weight:600;margin:4px 0">'+esc(it.title)+'</div><div style="font-size:12px;color:#7fffd4">'+esc(it.status)+'</div></div>';
        }).join('') || '<p style="color:var(--ink-dim)">No coverage items returned.</p>';
      }
    } catch(e) {
      if ($('invCoverageSummary')) $('invCoverageSummary').textContent = 'Coverage unavailable: '+(e.message||e);
    }
    try {
      const spec = await (await fetch('/.well-known/brand-spectrum.json')).json();
      const vars = (spec && spec.cssVars) || (spec && spec.spectrum && spec.spectrum.cssVars) || {};
      const host = $('invSpectrumSwatches');
      if (host) {
        const keys = Object.keys(vars).filter(function(k){ return String(vars[k]).indexOf('#')===0 || String(vars[k]).indexOf('rgb')===0; }).slice(0,8);
        host.innerHTML = keys.length ? keys.map(function(k){
          return '<div style="width:52px;text-align:center"><div style="height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:'+esc(vars[k])+'"></div><div style="font-size:9px;color:var(--ink-dim);margin-top:4px">'+esc(k.replace(/^--/,''))+'</div></div>';
        }).join('') : '<span style="color:var(--ink-dim);font-size:12px">Spectrum live on this page.</span>';
      }
    } catch(e) {}
    try {
      const v50 = await (await fetch('/api/v50/status')).json();
      if ($('inv50Title')) $('inv50Title').textContent = v50.version || '50Y Standard';
      if ($('inv50Meta')) $('inv50Meta').textContent = 'Generated '+(v50.generatedAt||'').slice(0,19)+' · pillars: '+Object.keys(v50.pillars||{}).join(', ');
      const pillars = v50.pillars || {};
      if ($('inv50Pillars')) {
        $('inv50Pillars').innerHTML = Object.keys(pillars).map(function(k){
          const p = pillars[k] || {};
          const keys = Object.keys(p).filter(function(x){ return p[x] === true; });
          return '<div style="padding:12px;border:1px solid #1f2a3b;border-radius:10px"><div class="tag">'+esc(k)+'</div><div style="font-size:13px;color:var(--ink-dim);margin-top:8px">'+(keys.length?keys.slice(0,6).map(esc).join(' · '):'active')+'</div></div>';
        }).join('') || '<p style="color:var(--ink-dim)">No pillars reported.</p>';
      }
    } catch(e) {
      if ($('inv50Title')) $('inv50Title').textContent = '50Y offline';
      if ($('inv50Meta')) $('inv50Meta').textContent = 'Status unavailable: '+(e.message||e);
    }
    try { const s = await (await fetch('/api/innovations/status')).json();
      $('invConHash').textContent = (s.constitution && s.constitution.hashShort) || '—';
      if (s.models) $('invModels').innerHTML = s.models.map(m =>
        '<tr style="border-top:1px solid #1f2a3b"><td style="padding:12px">'+m.id+' · v'+m.version+'</td><td style="padding:12px">'+m.family+'</td><td style="padding:12px">'+(m.provenance||'—')+'</td><td style="padding:12px;font-family:monospace;font-size:12px">'+(m.sha256||'').slice(0,16)+'…</td></tr>').join('');
    } catch(e) { $('invConHash').textContent='offline'; }
    try { const r = await (await fetch('/api/receipts/root')).json();
      if (r && r.root) { $('invRoot').textContent = r.root.slice(0,24)+'…'; $('invRootCount').textContent = r.count || 0; }
      else { $('invRoot').textContent = 'pending first roll'; }
    } catch(e) {}
    try { const t = await (await fetch('/api/btc/twap')).json();
      $('invTwap').textContent = '$' + (t.twapUsd ? Number(t.twapUsd).toLocaleString(undefined,{maximumFractionDigits:0}) : '—');
    } catch(e) { $('invTwap').textContent = 'offline'; }
    try { const sb = await (await fetch('/api/sbom')).json();
      $('invSbom').textContent = (sb.compositeHash||'').slice(0,24)+'…';
    } catch(e) {}
    try { const inc = await (await fetch('/api/incidents')).json();
      if (!inc || !inc.length) { $('invIncidents').textContent = '✓ No incidents on record. Constitutional integrity nominal.'; }
      else { $('invIncidents').innerHTML = inc.map(i => '<div style="padding:8px 0;border-bottom:1px solid #1f2a3b"><strong>'+i.incidentId.slice(0,20)+'</strong> · '+i.status+' · sealed '+(i.sealedAt||'').slice(0,10)+'</div>').join(''); }
    } catch(e) {}
    // v2 cards
    try { const ca = await (await fetch('/api/compliance/attestation')).json(); $('invCompHash').textContent = (ca.hash||'').slice(0,24)+'…'; } catch(e) { $('invCompHash').textContent = 'unavailable'; }
    try { const co = await (await fetch('/api/v2/carbon/attest')).json(); $('invCarbon').textContent = (co.totalGCO2||0).toFixed(4)+' gCO₂ today'; } catch(e) { $('invCarbon').textContent = 'unavailable'; }
    try { const bt = await (await fetch('/api/v2/bounty/total')).json(); $('invBounty').textContent = '$'+(bt.totalUsd||0).toLocaleString()+' · '+(bt.open||0)+' open'; } catch(e) { $('invBounty').textContent = 'unavailable'; }
    try { const dr = await (await fetch('/api/v2/dr/list')).json(); $('invDR').textContent = (dr.count||0)+' drill'+(dr.count===1?'':'s')+(dr.last ? ' · last RTO '+dr.last.rtoSeconds+'s' : ''); } catch(e) { $('invDR').textContent = 'unavailable'; }
  })();
  </script>
</section>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FRONTIER PAGES — autonomous sales fabric + 12 sovereign inventions
// ═══════════════════════════════════════════════════════════════════════════
function pageWizard() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Plan wizard · 30s</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 12px;line-height:1.05">Find your <span class="grad">perfect ZeusAI plan</span> in 30 seconds.</h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.6;max-width:680px">Four questions. Deterministic, explainable scoring. Every recommendation signed Ed25519 — you can verify it.</p>
  <div class="card" id="wizCard" style="padding:28px;margin-top:22px">
    <div class="field"><label>1 · Company size</label>
      <select id="wizSegment"><option value="startup">Startup / Solo</option><option value="company">Scaling company</option><option value="enterprise">Enterprise</option></select></div>
    <div class="field"><label>2 · Monthly volume</label>
      <select id="wizVolume"><option value="low">Low (&lt; 100k operations)</option><option value="medium">Medium (100k-5M)</option><option value="high">High (&gt; 5M)</option></select></div>
    <div class="field"><label>3 · Monthly budget (USD)</label>
      <input id="wizBudget" type="number" min="0" step="50" value="499"></div>
    <div class="field"><label>4 · Primary goal</label>
      <select id="wizGoal"><option value="automation">Automation</option><option value="revenue">Revenue growth</option><option value="cost">Cost reduction</option><option value="compliance">Compliance / Sovereignty</option></select></div>
    <button class="btn btn-primary" id="wizBtn" style="width:100%;justify-content:center">Recommend my plan →</button>
    <div id="wizOut" style="margin-top:18px"></div>
  </div>
  <script>
  document.getElementById('wizBtn').addEventListener('click', async () => {
    const out = document.getElementById('wizOut'); out.innerHTML = '<p style="color:var(--ink-dim)">Computing…</p>';
    const body = {
      segment: document.getElementById('wizSegment').value,
      volume: document.getElementById('wizVolume').value,
      budget: Number(document.getElementById('wizBudget').value)||0,
      goal: document.getElementById('wizGoal').value
    };
    try {
      const r = await fetch('/api/wizard/recommend', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      const winner = d.plan.toUpperCase();
      out.innerHTML = '<div class="card" style="border-color:var(--violet);padding:22px"><span class="kicker">Recommended</span><h2 style="margin:8px 0">'+winner+' · $'+d.cta.amount+'</h2><p style="color:var(--ink-dim)">Top services for you: '+d.services.map(s=>'<code class="inline">'+s+'</code>').join(' ')+'</p><a class="btn btn-primary" href="'+d.cta.url+'" data-link>Buy '+winner+' now →</a><a class="btn" href="/pricing" data-link style="margin-left:8px">See all plans</a><details style="margin-top:14px"><summary style="cursor:pointer;color:var(--ink-dim);font-size:13px">Why this plan? (signed reasoning)</summary><pre class="code">'+JSON.stringify({ ranked: d.ranked, explain: d.explain, signedAt: d.signedAt, signature: d.signature.slice(0,32)+'…' }, null, 2)+'</pre></details></div>';
    } catch (e) { out.innerHTML = '<p style="color:var(--danger)">Error: '+e.message+'</p>'; }
  });
  </script>
</section>`;
}

function pageStatus(params = {}) {
  // CSP nonce required: script-src uses strict-dynamic; un-nonced inline scripts are dropped.
  const N = params.nonce ? ` nonce="${String(params.nonce).replace(/"/g, '')}"` : '';
  return `<section style="padding-top:140px;max-width:1100px">
  <span class="kicker">Live status</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Live Unicorn Status · <span id="stHeadline" class="grad">operational.</span></h1>
  <p style="color:var(--ink-dim);font-size:15px">Live API is protecting the site: health, QIS, catalog and checkout checks are refreshed from production endpoints. Source: <code class="inline">/api/status</code>. Total Autonomy OS from <code class="inline">/api/autonomy/os</code>. Neural Autonomy OS from <code class="inline">/api/autonomy/neural</code>. Site↔Unicorn Bond from <code class="inline">/api/autonomy/bond</code>. Triad Never-Down from <code class="inline">/api/autonomy/triad</code>. Refreshes every 15s.</p>

  <div class="card" id="taosPanel" style="margin-top:22px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Total Autonomy OS</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="taosScore" class="grad" style="font-size:clamp(48px,7vw,84px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="taosGrade" style="font-size:22px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Governance mode · <b id="taosMode" style="color:#fff">—</b></p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/autonomy/os" data-live-title="OS live →" style="margin-top:8px">OS live →</button>
    </div>
    <div id="taosPillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:20px"></div>
    <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--stroke,rgba(160,200,255,.14))">
      <span class="tag">Next</span>
      <ul id="taosNext" style="margin:10px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.65"><li>Loading autonomy snapshot…</li></ul>
    </div>
    <p id="taosDoctrine" style="color:var(--ink-dim);font-size:13.5px;margin:16px 0 0;font-style:italic">—</p>
  </div>

  <div class="card" id="naosPanel" style="margin-top:18px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Neural Autonomy OS</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="naosScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="naosGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Organ continuum · Buy Immortal · Boot Immortal · stable idle is a feature · <b id="naosIdle" style="color:#fff">—</b></p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/autonomy/neural" data-live-title="NAOS live →" style="margin-top:8px">NAOS live →</button>
    </div>
    <div id="naosOrgans" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px"></div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--stroke,rgba(160,200,255,.14));display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span class="tag" id="naosContinuum">continuum —</span>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/neural/score" data-live-title="Score" style="font-size:12px">Score</button>
      <button type="button" class="btn" data-live-inspect="/.well-known/neural-autonomy.json" data-live-title="/.well-known/neural-autonomy.live →" style="margin-top:8px">/.well-known/neural-autonomy.live →</button>
    </div>
    <p id="naosDoctrine" style="color:var(--ink-dim);font-size:13.5px;margin:16px 0 0;font-style:italic">—</p>
  </div>

  <div class="card" id="subosPanel" style="margin-top:18px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Site↔Unicorn Bond</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="subosScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="subosGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Integrated Autonomy Kernel · both peers must breathe · <b id="subosBonded" style="color:#fff">—</b></p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/autonomy/bond" data-live-title="Bond live →" style="margin-top:8px">Bond live →</button>
    </div>
    <div id="subosPillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px"></div>
    <p id="subosDoctrine" style="color:var(--ink-dim);font-size:13.5px;margin:16px 0 0;font-style:italic">—</p>
  </div>

  <div class="card" id="tbosPanel" style="margin-top:18px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Triad Never-Down</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="tbosScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="tbosGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Site · Unicorn · Server edge · forever-key · <b id="tbosBonded" style="color:#fff">—</b></p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/autonomy/triad" data-live-title="Triad live →" style="margin-top:8px">Triad live →</button>
    </div>
    <div id="tbosPillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px"></div>
    <p id="tbosDoctrine" style="color:var(--ink-dim);font-size:13.5px;margin:16px 0 0;font-style:italic">—</p>
  </div>

  <div class="card" id="cicPanel" style="margin-top:18px;padding:26px;border:1px solid rgba(255,159,28,.28)" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker" style="background:linear-gradient(135deg,#FF3B5C,#FF9F1C);-webkit-background-clip:text;background-clip:text;color:transparent">Chromatic Identity Continuum</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="cicScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="cicGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Volt Aurora · blade letterforms · horizon <b id="cicHorizon" style="color:#fff">2066</b> · <b id="cicSigned" style="color:#fff">—</b></p>
      </div>
      <button type="button" class="btn btn-ghost" data-live-inspect="/.well-known/brand-spectrum.json" data-live-title="Brand spectrum" style="font-size:12px">Inspect brand spectrum</button>
    </div>
    <div id="cicSwatches" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px"></div>
    <p id="cicDoctrine" style="color:var(--ink-dim);font-size:13.5px;margin:16px 0 0;font-style:italic">—</p>
  </div>

  <div class="card" id="pfosPanel" style="margin-top:18px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Platform Foundation OS</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="pfosScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="pfosGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Long-term security · health hygiene · mutator safety · commerce validation · funnel visibility.</p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/platform/foundation" data-live-title="PFOS live →" style="margin-top:8px">PFOS live →</button>
    </div>
    <div id="pfosPillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px"></div>
  </div>

  <div class="card" id="esosPanel" style="margin-top:18px;padding:26px" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div>
        <span class="kicker">Enterprise Standard OS</span>
        <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:4px">
          <span id="esosScore" class="grad" style="font-size:clamp(36px,5vw,56px);font-weight:800;line-height:1;font-family:var(--mono,monospace)">—</span>
          <span id="esosGrade" style="font-size:18px;font-weight:700;letter-spacing:.04em">—</span>
        </div>
        <p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">Money-path integrity · real commerce metrics · nginx contract · checkout rate-limit · AI-cost visibility.</p>
      </div>
      <button type="button" class="btn" data-live-inspect="/api/enterprise/standard" data-live-title="ESOS live →" style="margin-top:8px">ESOS live →</button>
    </div>
    <div id="esosPillars" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px"></div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--stroke,rgba(160,200,255,.14));display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/commerce/integrity" data-live-title="Money-path integrity" style="font-size:12px">Money-path integrity</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/commerce/metrics" data-live-title="Commerce metrics" style="font-size:12px">Commerce metrics</button>
      <button type="button" class="btn" data-live-inspect="/.well-known/enterprise.json" data-live-title="Inspect enterprise posture" style="margin-top:8px">Inspect enterprise posture</button>
    </div>
  </div>

  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px">
    <div class="card"><span class="tag">Deploy</span><h3>Forward-only</h3><p style="color:var(--ink-dim)">Canary + smoke guarded.</p></div>
    <div class="card"><span class="tag">Integrity</span><h3>QIS guarded</h3><p style="color:var(--ink-dim)">Quantum Integrity Shield checked live.</p></div>
    <div class="card"><span class="tag">Commerce</span><h3>Catalog + BTC</h3><p style="color:var(--ink-dim)">Checkout path remains monitored.</p></div>
  </div>
  <div class="grid" id="stGrid" style="margin-top:22px"><div class="card"><p>—</p></div></div>
  <div class="card" style="margin-top:22px;padding:22px"><span class="kicker">90-day uptime</span><h2 id="stUptime" style="margin:8px 0">—</h2><p style="color:var(--ink-dim)">Synthetic checks every 60s. Incidents publicly sealed (commit-reveal).</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
      <button type="button" class="btn" data-live-inspect="/api/incidents" data-live-title="Public incident log">Public incident log</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/os" data-live-title="Autonomy OS">Inspect Autonomy OS live</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/score" data-live-title="Autonomy score">Autonomy score</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/neural" data-live-title="Neural Autonomy">Neural Autonomy</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/bond" data-live-title="Site↔Unicorn Bond">Site↔Unicorn Bond</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/autonomy/triad" data-live-title="Triad Never-Down">Triad Never-Down</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/.well-known/brand-spectrum.json" data-live-title="View spectrum live">View spectrum live</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/api/platform/foundation" data-live-title="Platform Foundation">Platform Foundation</button>
      <button type="button" class="btn btn-ghost" data-live-inspect="/.well-known/platform.json" data-live-title="Inspect live">Inspect live</button>
    </div>
  </div>
  <script${N}>
  function taosEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function taosPillarPass(p){
    if(!p||typeof p!=='object') return false;
    if(p.pass===true||p.ok===true||p.passed===true) return true;
    var st=String(p.status||p.state||p.result||'').toLowerCase();
    return st==='pass'||st==='ok'||st==='passed'||st==='healthy'||st==='green';
  }
  function taosPillarName(p,i){
    if(typeof p==='string') return p;
    return (p&&(p.name||p.id||p.title||p.pillar))||('Pillar '+(i+1));
  }
  function taosActionText(a){
    if(typeof a==='string') return a;
    if(!a||typeof a!=='object') return '';
    return a.text||a.action||a.title||a.next||a.label||JSON.stringify(a);
  }
  async function loadAutonomyOs(){
    try {
      var d = await (await fetch('/api/autonomy/os',{cache:'no-store'})).json();
      var score = d.score!=null ? d.score : (d.os&&d.os.score);
      var grade = d.grade!=null ? d.grade : (d.os&&d.os.grade);
      var mode = d.mode||d.governanceMode||(d.governance&&(d.governance.mode||d.governance.state))||(d.os&&d.os.mode)||'—';
      var doctrine = d.doctrine||(d.os&&d.os.doctrine)||'';
      if(typeof doctrine==='object'&&doctrine) doctrine = doctrine.line||doctrine.summary||doctrine.text||'';
      var scoreEl=document.getElementById('taosScore');
      var gradeEl=document.getElementById('taosGrade');
      var modeEl=document.getElementById('taosMode');
      var doctrineEl=document.getElementById('taosDoctrine');
      if(scoreEl) scoreEl.textContent = score!=null ? String(score) : '—';
      if(gradeEl) gradeEl.textContent = grade!=null ? String(grade) : '—';
      if(modeEl) modeEl.textContent = String(mode);
      if(doctrineEl) doctrineEl.textContent = doctrine ? String(doctrine) : 'Doctrine unavailable.';
      var pillars = Array.isArray(d.pillars) ? d.pillars : (d.os&&Array.isArray(d.os.pillars)?d.os.pillars:[]);
      var pillarsEl=document.getElementById('taosPillars');
      if(pillarsEl){
        if(!pillars.length){
          pillarsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Pillars pending — backend Total Autonomy OS not yet reporting.</p>';
        } else {
          pillarsEl.innerHTML = pillars.slice(0,8).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div></div>';
          }).join('');
        }
      }
      var nextList = [];
      if(Array.isArray(d.next)) nextList = d.next;
      else if(Array.isArray(d.actions)) nextList = d.actions;
      else if(d.next!=null) nextList = [d.next];
      else if(d.recommended) nextList = Array.isArray(d.recommended)?d.recommended:[d.recommended];
      var nextEl=document.getElementById('taosNext');
      if(nextEl){
        var items = nextList.map(taosActionText).filter(Boolean).slice(0,6);
        nextEl.innerHTML = items.length
          ? items.map(function(t){ return '<li>'+taosEsc(t)+'</li>'; }).join('')
          : '<li>No recommended actions right now.</li>';
      }
    } catch(e) {
      var scoreEl2=document.getElementById('taosScore');
      var nextEl2=document.getElementById('taosNext');
      var pillarsEl2=document.getElementById('taosPillars');
      if(scoreEl2) scoreEl2.textContent='—';
      if(nextEl2) nextEl2.innerHTML='<li style="color:var(--ink-dim)">Autonomy OS snapshot unavailable. Retrying every 15s.</li>';
      if(pillarsEl2) pillarsEl2.innerHTML='';
    }
  }
  async function loadStatus(){
    try { const d = await (await fetch('/api/status')).json();
      document.getElementById('stHeadline').textContent = d.overall + '.';
      document.getElementById('stUptime').textContent = d.uptime90d + '%';
      document.getElementById('stGrid').innerHTML = d.components.map(c => '<div class="card"><span class="tag" style="background:rgba(59,255,176,.15);color:#3bffb0">'+c.status+'</span><h3>'+c.name+'</h3><p style="color:var(--ink-dim)">Latency: <b>'+c.latencyMs+'ms</b></p></div>').join('');
    } catch(e) {
      // Never leave the SSR "Loading…" placeholder on screen — same regression
      // class as the /services BTC spot rate bug.
      const g = document.getElementById('stGrid');
      if (g) g.innerHTML = '<div class="card"><p style="color:var(--ink-dim)">Status snapshot unavailable. Retrying every 15s.</p></div>';
    }
  }
  async function loadPlatformFoundation(){
    try {
      var d = await (await fetch('/api/platform/foundation',{cache:'no-store'})).json();
      var scoreEl=document.getElementById('pfosScore');
      var gradeEl=document.getElementById('pfosGrade');
      var pillarsEl=document.getElementById('pfosPillars');
      if(scoreEl) scoreEl.textContent = d.score!=null ? String(d.score) : '—';
      if(gradeEl) gradeEl.textContent = d.grade!=null ? String(d.grade) : '—';
      var pillars = Array.isArray(d.pillars) ? d.pillars : [];
      if(pillarsEl){
        if(!pillars.length){
          pillarsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Foundation pillars pending.</p>';
        } else {
          pillarsEl.innerHTML = pillars.slice(0,8).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var detail=taosEsc((p&&p.detail)||'');
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div>'+(detail?'<div style="font-size:11.5px;color:var(--ink-dim);margin-top:4px">'+detail+'</div>':'')+'</div>';
          }).join('');
        }
      }
    } catch(e) {
      var se=document.getElementById('pfosScore');
      var pe=document.getElementById('pfosPillars');
      if(se) se.textContent='—';
      if(pe) pe.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Platform Foundation snapshot unavailable.</p>';
    }
  }
  async function loadEnterpriseStandard(){
    try {
      var d = await (await fetch('/api/enterprise/standard',{cache:'no-store'})).json();
      var scoreEl=document.getElementById('esosScore');
      var gradeEl=document.getElementById('esosGrade');
      var pillarsEl=document.getElementById('esosPillars');
      if(scoreEl) scoreEl.textContent = d.score!=null ? String(d.score) : '—';
      if(gradeEl) gradeEl.textContent = d.grade!=null ? String(d.grade) : '—';
      var pillars = Array.isArray(d.pillars) ? d.pillars : [];
      if(pillarsEl){
        if(!pillars.length){
          pillarsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Enterprise pillars pending.</p>';
        } else {
          pillarsEl.innerHTML = pillars.slice(0,8).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var detail=taosEsc((p&&p.detail)||'');
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div>'+(detail?'<div style="font-size:11.5px;color:var(--ink-dim);margin-top:4px">'+detail+'</div>':'')+'</div>';
          }).join('');
        }
      }
    } catch(e) {
      var se=document.getElementById('esosScore');
      var pe=document.getElementById('esosPillars');
      if(se) se.textContent='—';
      if(pe) pe.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Enterprise Standard snapshot unavailable.</p>';
    }
  }
  async function loadNeuralOs(){
    try {
      var d = await (await fetch('/api/autonomy/neural',{cache:'no-store'})).json();
      var scoreEl=document.getElementById('naosScore');
      var gradeEl=document.getElementById('naosGrade');
      var idleEl=document.getElementById('naosIdle');
      var doctrineEl=document.getElementById('naosDoctrine');
      var continuumEl=document.getElementById('naosContinuum');
      var organsEl=document.getElementById('naosOrgans');
      if(scoreEl) scoreEl.textContent = d.score!=null ? String(d.score) : '—';
      if(gradeEl) gradeEl.textContent = d.grade!=null ? String(d.grade) : '—';
      if(idleEl) idleEl.textContent = d.stableIdleOk ? 'stable idle OK' : 'stable idle pending';
      var doctrine = d.doctrine;
      if(typeof doctrine==='object'&&doctrine) doctrine = doctrine.line||doctrine.summary||doctrine.text||'';
      if(doctrineEl) doctrineEl.textContent = doctrine ? String(doctrine) : 'Compose immortal organs · observe-only.';
      var c = d.continuum||{};
      if(continuumEl) continuumEl.textContent = 'live '+(c.live||0)+' · idle '+(c.idle_stable||0)+' · unarmed '+(c.unarmed||0)+' · degraded '+(c.degraded||0);
      var organs = Array.isArray(d.organs) ? d.organs : (Array.isArray(d.pillars)?d.pillars:[]);
      if(organsEl){
        if(!organs.length){
          organsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Neural organs pending.</p>';
        } else {
          organsEl.innerHTML = organs.slice(0,9).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var detail=taosEsc((p&&(p.detail||p.posture))||'');
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div>'+(detail?'<div style="font-size:11.5px;color:var(--ink-dim);margin-top:4px">'+detail+'</div>':'')+'</div>';
          }).join('');
        }
      }
    } catch(e) {
      var se=document.getElementById('naosScore');
      var pe=document.getElementById('naosOrgans');
      if(se) se.textContent='—';
      if(pe) pe.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Neural Autonomy snapshot unavailable.</p>';
    }
  }
  async function loadSiteBond(){
    try {
      var d = await (await fetch('/api/autonomy/bond',{cache:'no-store'})).json();
      var scoreEl=document.getElementById('subosScore');
      var gradeEl=document.getElementById('subosGrade');
      var bondedEl=document.getElementById('subosBonded');
      var doctrineEl=document.getElementById('subosDoctrine');
      var pillarsEl=document.getElementById('subosPillars');
      if(scoreEl) scoreEl.textContent = d.score!=null ? String(d.score) : '—';
      if(gradeEl) gradeEl.textContent = d.grade!=null ? String(d.grade) : '—';
      if(bondedEl) bondedEl.textContent = d.bonded ? 'BONDED' : 'SPLIT';
      var doctrine = d.doctrine;
      if(typeof doctrine==='object'&&doctrine) doctrine = doctrine.line||doctrine.summary||doctrine.text||'';
      if(doctrineEl) doctrineEl.textContent = doctrine ? String(doctrine) : 'Site and Unicorn are one organism.';
      var pillars = Array.isArray(d.pillars) ? d.pillars : [];
      if(pillarsEl){
        if(!pillars.length){
          pillarsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Bond pillars pending.</p>';
        } else {
          pillarsEl.innerHTML = pillars.slice(0,6).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var detail=taosEsc((p&&p.detail)||'');
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div>'+(detail?'<div style="font-size:11.5px;color:var(--ink-dim);margin-top:4px">'+detail+'</div>':'')+'</div>';
          }).join('');
        }
      }
    } catch(e) {
      var se=document.getElementById('subosScore');
      var pe=document.getElementById('subosPillars');
      if(se) se.textContent='—';
      if(pe) pe.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Bond snapshot unavailable.</p>';
    }
  }
  async function loadTriadBond(){
    try {
      var d = await (await fetch('/api/autonomy/triad',{cache:'no-store'})).json();
      var scoreEl=document.getElementById('tbosScore');
      var gradeEl=document.getElementById('tbosGrade');
      var bondedEl=document.getElementById('tbosBonded');
      var doctrineEl=document.getElementById('tbosDoctrine');
      var pillarsEl=document.getElementById('tbosPillars');
      if(scoreEl) scoreEl.textContent = d.score!=null ? String(d.score) : '—';
      if(gradeEl) gradeEl.textContent = d.grade!=null ? String(d.grade) : '—';
      if(bondedEl) bondedEl.textContent = d.bonded ? 'TRIAD UP' : 'PEER DOWN';
      var doctrine = d.doctrine;
      if(typeof doctrine==='object'&&doctrine) doctrine = doctrine.line||doctrine.summary||doctrine.text||'';
      if(doctrineEl) doctrineEl.textContent = doctrine ? String(doctrine) : 'Site · Unicorn · Server must all breathe.';
      var pillars = Array.isArray(d.pillars) ? d.pillars : [];
      if(pillarsEl){
        if(!pillars.length){
          pillarsEl.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Triad pillars pending.</p>';
        } else {
          pillarsEl.innerHTML = pillars.slice(0,6).map(function(p,i){
            var ok=taosPillarPass(p);
            var label=taosEsc(taosPillarName(p,i));
            var detail=taosEsc((p&&p.detail)||'');
            var bg=ok?'rgba(59,255,176,.15)':'rgba(255,120,120,.12)';
            var fg=ok?'#3bffb0':'#ff8a8a';
            var st=ok?'PASS':'FAIL';
            return '<div style="padding:12px 14px;border-radius:12px;border:1px solid var(--stroke,rgba(160,200,255,.14));background:rgba(0,0,0,.22)"><span class="tag" style="background:'+bg+';color:'+fg+';margin-bottom:8px">'+st+'</span><div style="font-size:14px;font-weight:600">'+label+'</div>'+(detail?'<div style="font-size:11.5px;color:var(--ink-dim);margin-top:4px">'+detail+'</div>':'')+'</div>';
          }).join('');
        }
      }
    } catch(e) {
      var se=document.getElementById('tbosScore');
      var pe=document.getElementById('tbosPillars');
      if(se) se.textContent='—';
      if(pe) pe.innerHTML='<p style="color:var(--ink-dim);font-size:13.5px;margin:0">Triad snapshot unavailable.</p>';
    }
  }
  async function loadBrandSpectrum(){
    try {
      var d = await (await fetch('/api/brand/spectrum',{cache:'no-store'})).json();
      var se=document.getElementById('cicScore');
      var ge=document.getElementById('cicGrade');
      var he=document.getElementById('cicHorizon');
      var sg=document.getElementById('cicSigned');
      var sw=document.getElementById('cicSwatches');
      var doc=document.getElementById('cicDoctrine');
      if(se) se.textContent = (d&&d.score!=null)?d.score:'—';
      if(ge) ge.textContent = (d&&d.grade)||'—';
      if(he) he.textContent = (d&&d.horizonYear)||2066;
      if(sg) sg.textContent = (d&&d.signed)?'signed · kid '+(d.kid||'…'):'unsigned continuum';
      if(doc) doc.textContent = (d&&d.letterform&&d.letterform.genome)
        ? ('Letterform genome: '+d.letterform.genome+' · continuum '+(d.continuumId||d.spectrum&&d.spectrum.id||'volt-aurora'))
        : 'CIC continuum pending.';
      if(sw){
        var cols=[];
        try {
          var z=(d.spectrum&&d.spectrum.wordmark&&d.spectrum.wordmark.zeus)||['#FF3B5C','#FF9F1C','#FFEE32','#FF6B35'];
          var a=(d.spectrum&&d.spectrum.wordmark&&d.spectrum.wordmark.ai)||['#00E8A0','#2DE2E6'];
          cols=z.concat(a);
        } catch(_){ cols=['#FF3B5C','#FF9F1C','#FFEE32','#00E8A0','#2DE2E6']; }
        sw.innerHTML = cols.map(function(c){
          return '<span title="'+taosEsc(c)+'" style="width:28px;height:28px;border-radius:9px;background:'+taosEsc(c)+';box-shadow:0 0 12px '+taosEsc(c)+'55;border:1px solid rgba(255,255,255,.18)"></span>';
        }).join('');
      }
      if(d&&d.cssVars){
        try {
          var root=document.documentElement;
          Object.keys(d.cssVars).forEach(function(k){ root.style.setProperty(k, d.cssVars[k]); });
        } catch(_){}
      }
    } catch(e) {
      var se2=document.getElementById('cicScore');
      if(se2) se2.textContent='—';
    }
  }
  function loadAllStatus(){ loadStatus(); loadAutonomyOs(); loadNeuralOs(); loadSiteBond(); loadTriadBond(); loadBrandSpectrum(); loadPlatformFoundation(); loadEnterpriseStandard(); }
  loadAllStatus(); setInterval(loadAllStatus, 15000);
  </script>
</section>`;
}

function pageChangelog() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Changelog</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">What's <span class="grad">new.</span></h1>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-25</span><h3>Frontier Engine v1.0 · 12 sovereign inventions</h3><p style="color:var(--ink-dim)">Crypto refund guarantee, live aura, outcome-anchored pricing, self-healing checkout, time-locked discounts, sovereign receipt NFTs, provable email delivery, gift-as-capability, anti-dark-pattern pledge, universal cancel, bandit transparency, carbon-inclusive checkout. + cart engine, coupons, leads, API keys, OpenAPI 3.1, sitemap.xml, plan wizard.</p></div>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-24</span><h3>30Y Innovations v2 · 15 more primitives</h3><p style="color:var(--ink-dim)">ZK commitments, threshold keys, federated learning, VRF, VDF, k-anon analytics, relay descriptor, reputation graph, compliance attestation, DR drills, carbon ledger, bug bounty escrow, did:web + did:key.</p></div>
  <div class="card" style="padding:22px;margin-bottom:14px"><span class="tag">2026-04-23</span><h3>30Y Innovations v1 · cryptographic durability</h3><p style="color:var(--ink-dim)">ML-DSA-65 hybrid signing, BTC-anchored Merkle receipts, public AI constitution, 4-of-7 Shamir time capsule, reproducible SBOM, sealed incident commit-reveal.</p></div>
  <p id="chgBuild" style="color:var(--ink-dim);font-size:13px;margin-top:18px">Live build: …</p>
  <script>fetch('/integrity.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{var el=document.getElementById('chgBuild');if(!el)return;var v=(d&&d.payload&&d.payload.version)||(d&&d.version)||'—';el.textContent='Live build SHA: '+v+' · updated '+(d&&d.payload&&d.payload.generatedAt||d.generatedAt||'');}).catch(function(){var el=document.getElementById('chgBuild');if(el)el.textContent='Live build unavailable';});</script>
</section>`;
}

function pageTerms()   { return _legalSub('Terms of Service', 'By using ZeusAI you agree that all outputs, telemetry and receipts are honestly generated and routed to the owner. You agree not to bypass capability tokens, forge signatures, or exploit the autonomy chain. Service is provided as-is with the SLA at /sla and refund guarantee at /refund.'); }
function pagePrivacy() { return _legalSub('Privacy Policy', 'We store the minimum data necessary: email (activation), plan, receipts. No selling, no sharing, no model training on personal data. GDPR export/delete: signed-in customers use /account (API: GET /api/privacy/export · POST /api/privacy/delete-request). Cryptographic receipts are append-only and owner-owned. Sub-processors: see /dpa and GET /api/compliance/attestation when available.'); }
function pageRefund()  { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Refund Guarantee · F1</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Cryptographic <span class="grad">refund guarantee.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">A signed, public SLA promise. On confirmed breach, the system emits a signed <code class="inline">REFUND_INTENT</code> and records it in the refund audit trail. BTC reverse settlement is owner-executed against that signed intent — not an automatic on-chain clawback. 30-day money-back remains available via contact.</p>
  <pre class="code" id="rfOut" style="margin-top:18px">Signed promise will appear here.</pre>
  <div id="rfRules" style="margin-top:16px;display:grid;gap:10px"><p style="color:var(--ink-dim);font-size:13px">Loading guarantee terms…</p></div>
  <p style="color:var(--ink-dim);font-size:13px;margin-top:14px">Audit: <button type="button" class="btn" data-live-inspect="/api/refund/audit" data-live-title="Refund audit" style="padding:6px 10px;font-size:12px">Inspect refund audit</button></p>
  <script>
  fetch('/api/refund/guarantee').then(r=>r.json()).then(d=>{
    const out = document.getElementById('rfOut');
    if (!out) return;
    const title = d && d.title || 'Refund guarantee';
    const sig = d && d.signature ? String(d.signature).slice(0,18)+'…' : 'n/a';
    const hash = d && d.hash ? String(d.hash).slice(0,18)+'…' : 'n/a';
    out.textContent = title+'\\nIssued: '+(d.issuedAt||'—')+'\\nHash: '+hash+'\\nSignature: '+sig+'\\nSelf-execution: signed REFUND_INTENT + owner/ops settlement (not automatic chain reverse)';
    const host = document.getElementById('rfRules');
    const rules = Array.isArray(d && d.rules) ? d.rules : [];
    if (host) host.innerHTML = rules.map(function(r){ return '<div class="card" style="padding:14px"><span class="tag">'+(r.id||'rule')+'</span><p style="margin:8px 0 0;color:var(--ink-dim);font-size:14px">'+(r.text||'')+'</p></div>'; }).join('');
  }).catch(e=>{
    const out = document.getElementById('rfOut');
    if (out) out.textContent = 'Refund guarantee unavailable: '+(e && e.message || e);
  });
  </script>
</section>`; }
function pageSla() { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Service Level Agreement</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">SLA · <span class="grad">99.99% sovereign.</span></h1>
  <ul style="color:var(--ink-dim);font-size:15.5px;line-height:1.9;padding-left:20px">
    <li><b style="color:#fff">Uptime</b> · 99.99% target for /api · 99.9% for /</li>
    <li><b style="color:#fff">Latency</b> · p95 &lt; 800ms global, p99 &lt; 1500ms</li>
    <li><b style="color:#fff">Receipt</b> · every paid receipt is eligible for inclusion in the next daily signed Merkle root</li>
    <li><b style="color:#fff">Incident disclosure</b> · &lt; 72h public, sealed at /api/incidents</li>
    <li><b style="color:#fff">Refund</b> · signed REFUND_INTENT on breach (see /refund) + 30-day pre-activation money-back</li>
  </ul>
  <a class="btn btn-primary" href="/status" data-link>Live status →</a>
</section>`; }

function pagePledge() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Anti-Dark-Pattern Pledge · F9</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Public, signed, <span class="grad">self-enforcing.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No fake scarcity. No forced accounts. No drip pricing. No retention dark patterns. No selling your data. One-click cancel at <a href="/cancel" data-link>/cancel</a>. The pledge below is signed Ed25519 — anyone can verify. On confirmed breach, an INCIDENT is publicly sealed.</p>
  <pre class="code" id="plOut" style="margin-top:18px">Pledge summary will appear here.</pre>
  <div id="plCommitments" style="margin-top:14px;display:grid;gap:8px"></div>
  <div class="card" style="margin-top:22px;padding:22px"><h3 style="margin:0 0 10px">Report a breach</h3><p style="color:var(--ink-dim)">Suspect we broke our pledge? Report it. We seal the incident publicly within 72h.</p>
    <div class="field"><label>Email</label><input id="prEmail" type="email"></div>
    <div class="field"><label>Evidence</label><textarea id="prEv" rows="4" style="padding:12px;border-radius:12px;border:1px solid var(--stroke);background:rgba(5,4,10,.55);color:var(--ink);font-family:inherit;width:100%"></textarea></div>
    <button class="btn btn-primary" id="prBtn">Submit signed report →</button>
    <div id="prOut" style="margin-top:10px;color:var(--ink-dim);font-size:13px"></div>
  </div>
  <script>
  fetch('/api/pledge').then(r=>r.json()).then(d=>{
    const out = document.getElementById('plOut');
    if (!out) return;
    const commitments = Array.isArray(d && d.commitments) ? d.commitments : (Array.isArray(d && d.principles) ? d.principles : []);
    const sig = d && d.signature ? String(d.signature).slice(0,18)+'…' : 'n/a';
    out.textContent = (d && d.title ? d.title : 'Pledge active')+'\\nCommitments: '+commitments.length+'\\nIssued: '+(d.issuedAt||'—')+'\\nSignature: '+sig;
    const host = document.getElementById('plCommitments');
    if (host) host.innerHTML = commitments.map(function(c,i){ return '<div class="card" style="padding:12px 14px;font-size:14px;color:var(--ink-dim)"><b style="color:#fff">'+(i+1)+'.</b> '+String(c)+'</div>'; }).join('');
  }).catch(e=>{
    const out = document.getElementById('plOut');
    if (out) out.textContent = 'Pledge summary unavailable: '+(e && e.message || e);
  });
  document.getElementById('prBtn').addEventListener('click', async () => {
    const email = document.getElementById('prEmail').value;
    const evidence = document.getElementById('prEv').value;
    try {
      const r = await fetch('/api/pledge/report', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, evidence }) });
      const d = await r.json();
      document.getElementById('prOut').textContent = d.ok ? 'Recorded · '+d.id : ('Error: '+(d.error||r.status));
    } catch(e) {
      document.getElementById('prOut').textContent = 'Network error: '+(e.message||e);
    }
  });
  </script>
</section>`;
}

function pageCancel() {
  return `<section style="padding-top:140px;max-width:680px">
  <span class="kicker">Universal Cancel · F10</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">One click. <span class="grad">Cancellation recorded.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No dark patterns, no retention chat-bot. Type your email — your cancellation request is cryptographically signed and recorded immediately. The owner is notified to process it. A confirmation (with cancellation proof) follows by email once your active subscriptions are cancelled.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Email on account</label><input id="cnEmail" type="email" placeholder="you@company.com"></div>
    <div class="field"><label>Reason (optional)</label><input id="cnReason" placeholder="moving on, no hard feelings"></div>
    <button class="btn btn-primary" id="cnBtn" style="width:100%;justify-content:center">Record cancellation request →</button>
    <div id="cnOut" style="margin-top:14px;color:var(--ink-dim);font-size:13.5px"></div>
  </div>
  <script>
  document.getElementById('cnBtn').addEventListener('click', async () => {
    const email = document.getElementById('cnEmail').value;
    const reason = document.getElementById('cnReason').value;
    try {
      const r = await fetch('/api/cancel/universal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, reason }) });
      const d = await r.json();
      const sig = d && d.signature ? String(d.signature).slice(0,22)+'…' : '';
      document.getElementById('cnOut').innerHTML = d.ok
        ? '<b style="color:#3bffb0">✓ '+(d.message||'Recorded')+'</b>' + (sig ? '<br><small style="font-family:var(--mono);font-size:11px">sig '+sig+'</small>' : '')
        : '<b style="color:var(--danger)">Error</b> '+(d.error||'');
    } catch(e) {
      document.getElementById('cnOut').textContent = 'Network error: '+(e.message||e);
    }
  });
  </script>
</section>`;
}

function pageGift() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Gift-as-Capability · F8</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Send ZeusAI as a <span class="grad">cryptographic gift.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No account required for the recipient. A signed gift code is generated and logged — the recipient redeems it via the link you share. Fulfilment (service activation) is handled by the owner after redemption; this is a gift-intent / code-logging system, not automated instant delivery.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Service / SKU</label><input id="gtSku" value="adaptive-ai"></div>
    <div class="field"><label>Value (USD)</label><input id="gtVal" type="number" value="49"></div>
    <div class="field"><label>From email</label><input id="gtFrom" type="email"></div>
    <div class="field"><label>To email (optional)</label><input id="gtTo" type="email"></div>
    <div class="field"><label>Message</label><input id="gtMsg" placeholder="Use ZeusAI on me"></div>
    <button class="btn btn-primary" id="gtBtn" style="width:100%;justify-content:center">Generate signed gift code →</button>
    <div id="gtOut" style="margin-top:14px"></div>
  </div>
  <div class="card" style="padding:24px;margin-top:18px;border-color:rgba(127,255,212,.35)">
    <span class="tag">Redeem</span>
    <h3 style="margin:8px 0 10px">Redeem a gift code</h3>
    <div class="field"><label>Gift code</label><input id="gtCode" placeholder="GIFT-…" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
    <div class="field"><label>Your email (optional)</label><input id="gtBy" type="email" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
    <button class="btn btn-primary" id="gtRedeemBtn" style="width:100%;justify-content:center;margin-top:8px">Redeem →</button>
    <div id="gtRedeemOut" style="margin-top:12px;color:var(--ink-dim);font-size:13.5px"></div>
  </div>
  <script>
  (function(){
    try {
      var q = new URLSearchParams(location.search);
      var c = q.get('c');
      if (c) { var el = document.getElementById('gtCode'); if (el) el.value = c; }
    } catch(_){}
    document.getElementById('gtBtn').addEventListener('click', async () => {
      const payload = {
        sku: document.getElementById('gtSku').value,
        valueUsd: Number(document.getElementById('gtVal').value)||0,
        fromEmail: document.getElementById('gtFrom').value,
        toEmail: document.getElementById('gtTo').value,
        message: document.getElementById('gtMsg').value
      };
      try {
        const r = await fetch('/api/gift/mint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const d = await r.json();
        const url = location.origin + (d.redeemUrl || ('/gift?c='+encodeURIComponent(d.code||'')));
        document.getElementById('gtOut').innerHTML = '<div class="card" style="border-color:var(--violet)"><h3>'+(d.code||'—')+'</h3><p style="color:var(--ink-dim)">Share this redemption URL: <code class="inline">'+url+'</code></p><p style="color:var(--ink-dim);font-size:12px">Signed at '+(d.mintedAt||'—')+' · recipient redeems the code; the owner will activate the service manually.</p></div>';
      } catch(e) {
        document.getElementById('gtOut').textContent = 'Mint failed: '+(e.message||e);
      }
    });
    document.getElementById('gtRedeemBtn').addEventListener('click', async () => {
      const out = document.getElementById('gtRedeemOut');
      out.textContent = 'Redeeming…';
      try {
        const r = await fetch('/api/gift/redeem', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: document.getElementById('gtCode').value, byEmail: document.getElementById('gtBy').value || null }) });
        const d = await r.json();
        if (d.ok) {
          out.innerHTML = '<b style="color:#3bffb0">✓ Redeemed</b> · SKU '+(d.gift && d.gift.sku || '—')+' · $'+(d.gift && d.gift.valueUsd || 0)+'. Owner will activate fulfilment.';
        } else {
          out.textContent = 'Redeem failed: '+(d.error || r.status);
        }
      } catch(e) { out.textContent = 'Network error: '+(e.message||e); }
    });
  })();
  </script>
</section>`;
}

function pageAura() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Live Conversion Aura · F2</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">The <span class="grad">heartbeat</span> of ZeusAI.</h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">Every metric below is fetched from <code class="inline">/api/aura</code>. Compatible with both the site frontier aura (<code class="inline">metrics</code>) and the backend KPI strip (<code class="inline">kpis</code>).</p>
  <div class="grid" id="auraGrid" style="margin-top:22px"><div class="card"><p>Live metrics will appear here.</p></div></div>
  <pre class="code" id="auraRaw" style="margin-top:18px;max-height:280px;overflow:auto">…</pre>
  <script>
  async function loadAura(){
    try {
      const d = await (await fetch('/api/aura')).json();
      const sig = d && d.signature ? String(d.signature).slice(0,24)+'…' : 'n/a';
      document.getElementById('auraRaw').textContent = 'Updated: '+(d.generatedAt||d.pulseAt||d.ts||new Date().toISOString())+' · signature: '+sig;
      const m = d.metrics || {};
      const k = d.kpis || {};
      const rows = [
        ['Orders total', m.ordersTotal != null ? m.ordersTotal : k.signedReceipts],
        ['Orders 24h', m.ordersLast24h],
        ['Leads total', m.leadsTotal],
        ['GMV USD', m.gmvUsd != null ? ('$'+(m.gmvUsd||0).toLocaleString()) : null],
        ['Newsletter', m.newsletter],
        ['Refunds honored', k.refundsHonored],
        ['Uptime', k.uptime],
        ['Active carts', k.activeCarts]
      ].filter(function(row){ return row[1] != null && row[1] !== ''; });
      document.getElementById('auraGrid').innerHTML = (rows.length ? rows : [['Status','online']]).map(function(pair){
        return '<div class="card"><span class="tag">'+pair[0]+'</span><h2 style="margin:8px 0">'+(pair[1]==null?'—':pair[1])+'</h2></div>';
      }).join('');
    } catch(e) {
      const g = document.getElementById('auraGrid');
      if (g) g.innerHTML = '<div class="card"><p style="color:var(--ink-dim)">Live aura unavailable. Retrying every 5s.</p></div>';
      const r = document.getElementById('auraRaw');
      if (r) r.textContent = 'Aura unavailable: '+(e && e.message || e);
    }
  }
  loadAura(); setInterval(loadAura, 5000);
  </script>
</section>`;
}

function pageApiExplorer() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">API Explorer</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Try every <span class="grad">endpoint</span> live.</h1>
  <p style="color:var(--ink-dim);font-size:15px">Public OpenAPI 3.1 inventory below. Click any endpoint to inspect the live response in-page — no raw JSON dump.</p>
  <div class="card" style="padding:16px;margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input id="apiExplorePath" placeholder="/api/health" style="flex:1 1 260px;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px;font-family:var(--mono)">
    <button type="button" class="btn btn-primary" id="apiExploreBtn">Inspect live →</button>
  </div>
  <div id="apiList" class="card" style="padding:22px;margin-top:18px;font-family:var(--mono);font-size:13px;line-height:1.9;max-height:80vh;overflow:auto">Endpoint inventory will appear here.</div>
  <script>
  (function(){
    function openPath(p){
      if (window.__zeusOpenLiveInspect) { window.__zeusOpenLiveInspect(p, p); return; }
      if (window.zeusLiveInspect) { window.zeusLiveInspect(p, p); return; }
      var btn = document.getElementById('apiExploreBtn');
      if (btn) { btn.textContent = 'Loading inspector…'; btn.disabled = true; }
      var tries = 0;
      (function wait(){
        tries += 1;
        if (window.__zeusOpenLiveInspect) { if (btn) { btn.disabled = false; btn.textContent = 'Inspect live →'; } window.__zeusOpenLiveInspect(p, p); return; }
        if (tries < 40) return setTimeout(wait, 100);
        if (btn) { btn.disabled = false; btn.textContent = 'Inspect live →'; }
        alert('Live inspector is still loading — try again in a moment.');
      })();
    }
    try {
      var q = new URLSearchParams(location.search);
      var ep = q.get('endpoint');
      if (ep) {
        var inp = document.getElementById('apiExplorePath');
        if (inp) inp.value = ep;
        setTimeout(function(){ openPath(ep); }, 120);
      }
    } catch(_){}
    var btn = document.getElementById('apiExploreBtn');
    if (btn) btn.addEventListener('click', function(){
      var p = (document.getElementById('apiExplorePath').value || '').trim();
      if (!p) return;
      if (p.charAt(0) !== '/') p = '/' + p;
      openPath(p);
    });
    fetch('/openapi-public.json').then(r=>r.json()).then(d=>{
      const privatePath = (p)=>/^\\/api\\/(admin|operator|autonomy|brain\\/autonomy|internal|deepseek|observability)/.test(p);
      const rows = Object.entries(d.paths).filter(([p])=>!privatePath(p)).map(([p,ops])=>{
        const ms = Object.keys(ops).map(m=>'<code class="inline" style="text-transform:uppercase">'+m+'</code>').join(' ');
        return '<div style="padding:6px 0;border-bottom:1px solid var(--stroke);display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+ms+' <button type="button" class="btn" data-live-inspect="'+p+'" data-live-title="'+p+'" style="padding:6px 10px;font-size:12px">'+p+'</button> <span style="color:var(--ink-dim);font-size:12px">'+ (Object.values(ops)[0].summary || '') +'</span></div>';
      });
      document.getElementById('apiList').innerHTML = rows.join('');
    }).catch(e=>{
      const el = document.getElementById('apiList');
      if (el) el.textContent = 'Endpoint inventory unavailable: '+(e && e.message || e);
    });
  })();
  </script>
</section>`;
}

function pageTransparency() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Pricing Bandit Transparency · F11</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">We test prices. <span class="grad">In public.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">The bandit decides which price to show. You see what it tested, the conversion rate, and the value per impression. Snapshot signed daily.</p>
  <div id="btTable" class="card" style="padding:22px;margin-top:22px">Bandit snapshot will appear here.</div>
  <script>
  fetch('/api/bandit/transparency').then(r=>r.json()).then(d=>{
    const rows = (d.arms||[]).map(a=>'<tr><td style="padding:8px">'+a.arm+'</td><td style="padding:8px">'+a.impressions+'</td><td style="padding:8px">'+a.conversions+'</td><td style="padding:8px">'+(a.conversionRate*100).toFixed(2)+'%</td><td style="padding:8px">$'+(a.eValue||0).toFixed(2)+'</td></tr>').join('') || '<tr><td colspan="5" style="padding:14px;color:var(--ink-dim)">No experiments recorded yet. The bandit publishes its experiments here as it learns.</td></tr>';
    const sig = d && d.signature ? String(d.signature).slice(0,32)+'…' : 'n/a';
    document.getElementById('btTable').innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="background:#0b0f17"><th style="text-align:left;padding:8px">Arm</th><th style="text-align:left;padding:8px">Impressions</th><th style="text-align:left;padding:8px">Conversions</th><th style="text-align:left;padding:8px">CR</th><th style="text-align:left;padding:8px">$/imp</th></tr></thead><tbody>'+rows+'</tbody></table><p style="color:var(--ink-dim);font-size:12px;margin-top:14px;font-family:var(--mono)">snapshot: '+(d.snapshotAt||'—')+' · sig '+sig+'</p>';
  }).catch(e=>{
    // Never leave the SSR "Bandit snapshot will appear here." placeholder stuck.
    const el = document.getElementById('btTable');
    if (el) el.textContent = 'Bandit snapshot unavailable: '+(e && e.message || e);
  });
  </script>
</section>`;
}

function pageFrontier() {
  return `<section style="padding-top:140px;max-width:1280px">
  <span class="kicker">Frontier · 12 sovereign inventions</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Things the web <span class="grad">didn't have</span> until today.</h1>
  <p style="color:var(--ink-dim);font-size:15px;max-width:820px;line-height:1.7">Each invention below has a live API. Cards marked <span class="tag">interactive</span> open tools on this page. Honesty: refund/cancel emit signed intents and owner-processed settlement — not automatic on-chain clawbacks.</p>
  <div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px">
    <div class="card"><span class="tag">F1</span><h3>Crypto Refund Guarantee</h3><p>Signed SLA + REFUND_INTENT audit trail.</p><a class="btn" href="/refund" data-link>Open</a></div>
    <div class="card"><span class="tag">F2</span><h3>Live Conversion Aura</h3><p>Real-time, signed, public KPI heartbeat.</p><a class="btn" href="/aura" data-link>Open</a></div>
    <div class="card"><span class="tag">F3</span><h3>Outcome-Anchored Pricing</h3><p>Signed before/after deltas → auto-bps invoice.</p><button type="button" class="btn" data-live-inspect="/api/outcome/list" data-live-title="Outcome list">Inspect outcomes</button></div>
    <div class="card"><span class="tag">F4</span><h3>Self-Healing Checkout Cascade</h3><p>BTC → Lightning → Stripe → PayPal → Wire.</p><a class="btn" href="/checkout/" data-link>Try</a> <button class="btn" id="frCascadeBtn" type="button">Probe cascade</button></div>
    <div class="card"><span class="tag">F5 · interactive</span><h3>Time-Locked Discount Vault</h3><p>VDF-anchored "wait N s, get X% off".</p><a class="btn" href="#frWorkshop">Open tool</a></div>
    <div class="card"><span class="tag">F6 · interactive</span><h3>Sovereign Receipt NFT</h3><p>Portable, dual-signed proof. Verifiable offline.</p><a class="btn" href="#frWorkshop">Lookup</a></div>
    <div class="card"><span class="tag">F7 · interactive</span><h3>Provable Email Delivery</h3><p>Signed manifest + Merkle inclusion proof.</p><a class="btn" href="#frWorkshop">Prove</a></div>
    <div class="card"><span class="tag">F8</span><h3>Gift-as-Capability</h3><p>Send a CBAT to anyone. No account needed.</p><a class="btn" href="/gift" data-link>Mint / Redeem</a></div>
    <div class="card"><span class="tag">F9</span><h3>Anti-Dark-Pattern Pledge</h3><p>Public, signed, self-enforcing.</p><a class="btn" href="/pledge" data-link>Open</a></div>
    <div class="card"><span class="tag">F10</span><h3>Universal Cancel Link</h3><p>One URL records a signed cancel intent.</p><a class="btn" href="/cancel" data-link>Open</a></div>
    <div class="card"><span class="tag">F11</span><h3>Public Bandit Transparency</h3><p>You see every price experiment.</p><a class="btn" href="/transparency" data-link>Open</a></div>
    <div class="card"><span class="tag">F12 · interactive</span><h3>Carbon-Inclusive Checkout</h3><p>Auto-attached signed gCO₂ + offset.</p><a class="btn" href="#frWorkshop">Estimate</a></div>
  </div>
  <div id="frOut" class="card" style="margin-top:22px;padding:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
    <span class="tag">Frontier status loading…</span>
  </div>

  <div id="frWorkshop" class="card" style="margin-top:22px;padding:22px">
    <span class="tag">Workshop · F5 / F6 / F7 / F12</span>
    <h2 style="margin:10px 0 14px">Try frontier tools live</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:14px">
      <div>
        <h3 style="margin:0 0 8px;font-size:15px">F5 · Mint time-locked discount</h3>
        <div class="field"><label>Percent off</label><input id="frTldPct" type="number" value="15" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div class="field"><label>Lock seconds</label><input id="frTldLock" type="number" value="30" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <button class="btn btn-primary" id="frTldBtn" style="width:100%;justify-content:center;margin-top:8px">Vault discount →</button>
        <div class="field" style="margin-top:10px"><label>Redeem code</label><input id="frTldCode" placeholder="TLD-…" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <button class="btn" id="frTldRedeemBtn" style="width:100%;justify-content:center;margin-top:8px">Check redeem</button>
        <div id="frTldOut" style="margin-top:10px;font-size:13.5px;color:var(--ink-dim)">Ready.</div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:15px">F6 · Receipt NFT lookup</h3>
        <div class="field"><label>Order ID</label><input id="frNftId" placeholder="ord_…" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <button class="btn btn-primary" id="frNftBtn" style="width:100%;justify-content:center;margin-top:8px">Fetch NFT →</button>
        <div id="frNftOut" style="margin-top:10px;font-size:13.5px;color:var(--ink-dim)">Enter an order id.</div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:15px">F7 · Email delivery proof</h3>
        <div class="field"><label>To</label><input id="frEmTo" type="email" placeholder="you@company.com" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div class="field"><label>Subject</label><input id="frEmSub" value="ZeusAI delivery proof" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <button class="btn btn-primary" id="frEmBtn" style="width:100%;justify-content:center;margin-top:8px">Seal proof →</button>
        <div id="frEmOut" style="margin-top:10px;font-size:13.5px;color:var(--ink-dim)">Ready.</div>
      </div>
      <div>
        <h3 style="margin:0 0 8px;font-size:15px">F12 · Carbon estimate</h3>
        <div class="field"><label>Order ID (optional — leave blank for $100 estimate)</label><input id="frCarbId" placeholder="ord_… or empty" style="width:100%;padding:10px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <button class="btn btn-primary" id="frCarbBtn" style="width:100%;justify-content:center;margin-top:8px">Estimate carbon →</button>
        <div id="frCarbOut" style="margin-top:10px;font-size:13.5px;color:var(--ink-dim)">Ready.</div>
      </div>
    </div>
    <div id="frCascadeOut" style="margin-top:14px;display:none"></div>
  </div>

  <script>
  (function(){
    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function details(obj){
      try { return '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-dim)">Technical detail</summary><pre class="code" style="margin-top:8px;font-size:11px;max-height:120px;overflow:auto">'+esc(JSON.stringify(obj,null,2))+'</pre></details>'; }
      catch(_){ return ''; }
    }
    function show(id, obj){
      var el=document.getElementById(id); if(!el) return;
      if (typeof obj === 'string') { el.innerHTML = '<p style="margin:0">'+esc(obj)+'</p>'; return; }
      if (!obj || typeof obj !== 'object') { el.innerHTML = '<p style="margin:0">'+esc(String(obj))+'</p>'; return; }
      var lines = [];
      if (obj.error || obj.reason) lines.push('<strong style="color:#ff9cbe">'+esc(obj.error||obj.reason)+'</strong>');
      if (obj.code) lines.push('Code: <code>'+esc(obj.code)+'</code>');
      if (obj.pct != null) lines.push(esc(obj.pct)+'% off');
      if (obj.lockSeconds != null) lines.push('Lock '+esc(obj.lockSeconds)+'s');
      if (obj.redeemable != null) lines.push(obj.redeemable ? 'Redeemable now' : 'Not redeemable yet');
      if (obj.orderId) lines.push('Order '+esc(obj.orderId));
      if (obj.receiptId) lines.push('Receipt '+esc(obj.receiptId));
      if (obj.nftId || (obj.nft && obj.nft.id)) lines.push('NFT '+esc(obj.nftId||obj.nft.id));
      if (obj.proofId || obj.manifestId) lines.push('Proof '+esc(obj.proofId||obj.manifestId));
      if (obj.gCo2e != null || obj.gramsCo2 != null) lines.push((obj.gCo2e||obj.gramsCo2)+' gCO₂e');
      if (obj.offsetUsd != null) lines.push('Offset ~$'+esc(obj.offsetUsd));
      if (obj.dryRun) lines.push('Dry-run probe (no real charge)');
      if (obj.selected || obj.rail || obj.path) lines.push('Rail: '+esc(obj.selected||obj.rail||obj.path));
      if (Array.isArray(obj.cascade)) lines.push('Cascade steps: '+obj.cascade.length);
      if (obj.ok === true && !lines.length) lines.push('<strong style="color:#7fffd4">OK</strong>');
      if (obj.ok === false && !lines.length) lines.push('<strong style="color:#ff9cbe">Failed</strong>');
      if (!lines.length) lines.push('Result ready');
      el.innerHTML = '<div class="card" style="padding:12px"><p style="margin:0;line-height:1.55">'+lines.join(' · ')+'</p>'+details(obj)+'</div>';
    }
    fetch('/api/frontier/status').then(r=>r.json()).then(d=>{
      const out = document.getElementById('frOut');
      if (!out) return;
      const inv = d && (d.inventions || d.items || {});
      let cnt = 0;
      if (Array.isArray(inv)) cnt = inv.length;
      else if (inv && typeof inv === 'object') cnt = Object.keys(inv).length;
      else cnt = Number(d && (d.inventionsAvailable || d.count)) || 0;
      const mode = d && (d.mode || d.status || 'active');
      const updated = d && (d.generatedAt || d.updatedAt || d.signedAt || new Date().toISOString());
      out.innerHTML = '<span class="tag">Status: <strong>'+esc(mode)+'</strong></span>'
        +'<span class="tag">Inventions: <strong>'+esc(cnt)+'</strong></span>'
        +'<span class="tag">Updated: <strong>'+esc(updated)+'</strong></span>'
        +details(d);
    }).catch((e)=>{
      const out = document.getElementById('frOut');
      if (out) out.innerHTML = '<span class="tag">Frontier status unavailable</span><p style="margin:0;color:var(--ink-dim)">'+esc(e.message||e)+'</p>';
    });
    var cascadeBtn = document.getElementById('frCascadeBtn');
    if (cascadeBtn) cascadeBtn.addEventListener('click', async function(){
      var out = document.getElementById('frCascadeOut');
      if (out) { out.style.display='block'; show('frCascadeOut','Probing…'); }
      try {
        var d = await (await fetch('/api/checkout/cascade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountUsd:49,email:'probe@zeusai.pro',prefer:'auto',dryRun:true})})).json();
        show('frCascadeOut', d);
      } catch(e){ show('frCascadeOut','Error: '+(e.message||e)); }
    });
    var tldBtn = document.getElementById('frTldBtn');
    if (tldBtn) tldBtn.addEventListener('click', async function(){
      show('frTldOut','Vaulting…');
      try {
        var d = await (await fetch('/api/discount/timelocked',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pct:Number(document.getElementById('frTldPct').value)||15,lockSeconds:Number(document.getElementById('frTldLock').value)||30,sku:'any'})})).json();
        show('frTldOut', d);
        if (d && d.code) document.getElementById('frTldCode').value = d.code;
      } catch(e){ show('frTldOut','Error: '+(e.message||e)); }
    });
    var tldRedeem = document.getElementById('frTldRedeemBtn');
    if (tldRedeem) tldRedeem.addEventListener('click', async function(){
      show('frTldOut','Checking…');
      try {
        var code = encodeURIComponent(document.getElementById('frTldCode').value||'');
        var d = await (await fetch('/api/discount/timelocked/redeem?code='+code)).json();
        show('frTldOut', d);
      } catch(e){ show('frTldOut','Error: '+(e.message||e)); }
    });
    var nftBtn = document.getElementById('frNftBtn');
    if (nftBtn) nftBtn.addEventListener('click', async function(){
      show('frNftOut','Fetching…');
      try {
        var id = encodeURIComponent((document.getElementById('frNftId').value||'').trim());
        var r = await fetch('/api/receipt/nft/'+id);
        var d = await r.json();
        show('frNftOut', d);
      } catch(e){ show('frNftOut','Error: '+(e.message||e)); }
    });
    var emBtn = document.getElementById('frEmBtn');
    if (emBtn) emBtn.addEventListener('click', async function(){
      show('frEmOut','Sealing…');
      try {
        var d = await (await fetch('/api/email/proof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('frEmTo').value,subject:document.getElementById('frEmSub').value})})).json();
        show('frEmOut', d);
      } catch(e){ show('frEmOut','Error: '+(e.message||e)); }
    });
    var carbBtn = document.getElementById('frCarbBtn');
    if (carbBtn) carbBtn.addEventListener('click', async function(){
      show('frCarbOut','Estimating…');
      try {
        var id = (document.getElementById('frCarbId').value||'').trim();
        var url = id ? ('/api/carbon/cart?orderId='+encodeURIComponent(id)) : '/api/carbon/cart?usd=100';
        var d = await (await fetch(url)).json();
        show('frCarbOut', d);
      } catch(e){ show('frCarbOut','Error: '+(e.message||e)); }
    });
  })();
  </script>
</section>`;
}

// ── REAL CONTENT PAGES (2026-06) ───────────────────────────────────────────
// Until now /contact /faq /blog /affiliate /partners /roadmap /careers /press
// fell through to the homepage clone — duplicate-content SEO poison and a
// dead end for buyers. Each page below is honest (no invented testimonials,
// no fake jobs), wired to REAL endpoints that already exist in production:
//   • /api/enterprise/contact  → persists leads to enterprise-leads.jsonl
//   • /api/uaic/affiliate/track → logs referral hits to affiliate-track.jsonl
// RO: pagini reale, conectate la API-uri reale, zero conținut fals.

function pageContact() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Contact</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Talk to the <span class="grad">owner-operator.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px">ZeusAI is sovereign-run — your message lands directly with ${OWNER.name}, not a ticket queue. Sales, enterprise licensing, partnerships, security reports: same door.</p>
  <div class="grid phone-stack" style="grid-template-columns:1.4fr 1fr;gap:18px;margin-top:26px;align-items:start">
    <form id="contactForm" class="card" style="padding:22px;display:grid;gap:12px">
      <div class="phone-stack" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label style="font-size:12px;color:var(--ink-dim)">Name *</label><input name="name" required placeholder="Ada Lovelace" style="width:100%;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">Email *</label><input name="email" type="email" required placeholder="you@company.com" style="width:100%;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
      </div>
      <div class="phone-stack" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label style="font-size:12px;color:var(--ink-dim)">Company</label><input name="company" placeholder="Acme Corp" style="width:100%;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"></div>
        <div><label style="font-size:12px;color:var(--ink-dim)">Topic</label><select name="interest" style="width:100%;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px"><option value="sales">Sales / pricing</option><option value="enterprise">Enterprise license</option><option value="partnership">Partnership</option><option value="affiliate">Affiliate program</option><option value="security">Security report</option><option value="press">Press / media</option><option value="other">Other</option></select></div>
      </div>
      <div><label style="font-size:12px;color:var(--ink-dim)">Message *</label><textarea name="message" required rows="5" placeholder="What do you want to automate?" style="width:100%;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px;resize:vertical"></textarea></div>
      <button class="btn btn-primary" type="submit" style="justify-content:center">Send message →</button>
      <span id="contactMsg" style="font-size:13px;min-height:18px;color:var(--ink-dim)"></span>
    </form>
    <div style="display:grid;gap:12px">
      <div class="card" style="padding:18px"><span class="tag">Direct</span><p style="margin:10px 0 0;color:var(--ink-dim);font-size:14px">Email: <a href="mailto:${OWNER.email}">${OWNER.email}</a><br>Response target: &lt; 24h.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Security</span><p style="margin:10px 0 0;color:var(--ink-dim);font-size:14px">Vulnerability reports get priority routing. See <a href="/security" data-link>/security</a> for scope and our disclosure policy.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Proof</span><p style="margin:10px 0 0;color:var(--ink-dim);font-size:14px">Your message is persisted server-side instantly and surfaces in the operator console — nothing disappears into a CRM black hole.</p></div>
    </div>
  </div>
  <script>
  (function(){var f=document.getElementById('contactForm');if(!f)return;f.addEventListener('submit',async function(ev){ev.preventDefault();var m=document.getElementById('contactMsg');m.textContent='Sending…';var fd=new FormData(f);var body={};fd.forEach(function(v,k){body[k]=v});try{var r=await fetch('/api/enterprise/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var j=await r.json().catch(function(){return{}});if(r.ok){m.style.color='#7fffd4';m.textContent='✓ Sent — lead '+(j.id||'recorded')+'. We reply within 24h.';f.reset();}else{m.style.color='#ff6b6b';m.textContent=j.error||'Failed — email us directly instead.';}}catch(e){m.style.color='#ff6b6b';m.textContent='Network error — email ${OWNER.email}';}});})();
  </script>
</section>`;
}

const FAQ_ITEMS = [
  { q: 'What exactly am I buying?', a: 'A real deliverable: curated instant/professional SKUs with fulfillment recipes, or an engagement kickoff / architecture pack for frontier and vertical offers (not a finished OS shipped on payment). Every purchase mints an Ed25519-signed entitlement credential plus an API key — verifiable offline, owned by you.' },
  { q: 'How does payment work?', a: 'Direct BTC checkout settles on-chain to the owner wallet — no custodian, no processor in the middle. A 10% sovereign discount applies automatically to BTC checkouts. Cards/PayPal appear only when those rails are configured live.' },
  { q: 'Is the card price the same as the checkout price?', a: 'Yes — one canonical price engine quotes the card, the /pricing page and checkout. The quote is locked for 90 seconds so it never shifts mid-purchase.' },
  { q: 'What happens right after I pay?', a: 'The server watches the mempool, auto-confirms settlement, then issues the signed receipt, license token and delivery credentials — typically within one confirmation.' },
  { q: 'Can I verify my receipt independently?', a: 'Yes. Receipts are Ed25519-signed and Merkle-chained. Fetch the public key from /api/v50/keys.json (also /.well-known/keys.json) and verify offline — no trust in us required.' },
  { q: 'Is there a refund?', a: 'A cryptographic refund guarantee: if a signed service promise is breached, a signed REFUND_INTENT is sealed and owner/ops settles against it. Plus a 30-day money-back window. See /refund.' },
  { q: 'Can I cancel anytime?', a: 'Yes — /cancel records a signed cancellation intent in one click. No retention flows, no dark patterns (see /pledge). The owner processes active subscriptions and sends confirmation.' },
  { q: 'Do you train AI models on my data?', a: 'No. Minimal data collection, no resale, no model training on personal data. Full details in /privacy and /dpa.' },
  { q: 'Can software agents buy from you autonomously?', a: 'Yes — the catalog is machine-readable (/agents.json, /openapi.json) and checkout is a single signed POST. Agent-to-agent commerce is a first-class flow.' },
  { q: 'Who is behind ZeusAI?', a: `Owner-operated by ${OWNER.name}. No VC obligations, no exit pressure — built for a 30-year horizon. See /about.` },
];

function pageFaq() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">FAQ</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Questions, <span class="grad">answered straight.</span></h1>
  <p style="color:var(--ink-dim)">Every answer below is backed by a live page or API you can verify right now.</p>
  <div style="display:grid;gap:10px;margin-top:24px">
    ${FAQ_ITEMS.map((f) => `<details class="card" style="padding:16px 18px"><summary style="cursor:pointer;font-weight:600;font-size:15.5px">${f.q}</summary><p style="color:var(--ink-dim);font-size:14.5px;line-height:1.7;margin:12px 0 0">${f.a}</p></details>`).join('')}
  </div>
  <div class="card" style="padding:18px;margin-top:22px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="color:var(--ink-dim);font-size:14px">Still stuck?</span>
    <a class="btn btn-primary" href="/contact" data-link>Contact us →</a>
    <a class="btn" href="/docs" data-link>Read the docs</a>
    <a class="btn" href="/wizard" data-link>Find my plan</a>
  </div>
</section>`;
}

function pageBlog() {
  // Honest "insights" index: every entry links to a REAL live page — no
  // fabricated articles, no fake authors. The product itself is the content.
  const posts = [
    { href: '/frontier', tag: 'Frontier', title: 'F1–F12: inventions that ship as products, not papers', sub: 'Refund guarantees, live conversion aura, self-healing checkout — each frontier module is live and purchasable.' },
    { href: '/innovations', tag: 'Durability', title: '30-year cryptographic durability by design', sub: 'Post-quantum readiness, Merkle-chained receipts and constitution hashing on every response.' },
    { href: '/transparency', tag: 'Pricing', title: 'Why our pricing experiments are public', sub: 'Every bandit experiment behind a price you see is published. Radical transparency converts better than tricks.' },
    { href: '/trust', tag: 'Trust', title: 'Proof over promises: the Trust Center', sub: 'Deploy SHA, integrity signature, wallet proof and audit logs — verifiable live, not in a PDF.' },
    { href: '/how', tag: 'Architecture', title: 'How a sovereign AI OS routes a dollar', sub: 'From quote → invoice → on-chain settlement → signed delivery, with zero custodians.' },
    { href: '/changelog', tag: 'Shipping', title: 'The changelog is the roadmap receipt', sub: 'Everything we said we would build, with the commit that proves we did.' },
  ];
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Insights</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">The product <span class="grad">is the publication.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px">No ghost-written thought-leadership. Each insight below links to a live, verifiable part of the system.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:14px;margin-top:26px">
    ${posts.map((p) => `<a class="card" href="${p.href}" data-link style="padding:20px;text-decoration:none;display:block"><span class="tag">${p.tag}</span><h3 style="margin:12px 0 8px;font-size:17px;color:#fff">${p.title}</h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;margin:0">${p.sub}</p><span style="display:inline-block;margin-top:12px;color:var(--blue2);font-size:13px">Read live →</span></a>`).join('')}
  </div>
</section>`;
}

function pageAffiliate() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Affiliate</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Refer revenue, <span class="grad">get paid in BTC.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px">Referral tracking is live today — every visit is logged server-side with your ref code and tied to purchases. <strong style="color:#fff">BTC payouts are manual / early-access</strong>: the owner settles directly until automated payout rails ship.</p>
  <div class="card" style="padding:22px;margin-top:24px;display:grid;gap:12px;max-width:640px">
    <label style="font-size:12px;color:var(--ink-dim)">Your ref code (pick anything unique — your brand, handle, etc.)</label>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <input id="affCode" placeholder="yourbrand" style="flex:1;min-width:200px;padding:11px;background:#0b0f17;border:1px solid #1f2a3b;color:#e7ecf3;border-radius:8px">
      <button class="btn btn-primary" id="affGen">Generate link</button>
    </div>
    <div id="affOut" style="display:none;background:#0b0f17;border:1px solid #1f2a3b;border-radius:8px;padding:12px;font-family:var(--mono);font-size:13px;word-break:break-all"></div>
    <button class="btn" id="affCopy" style="display:none;justify-content:center">Copy link</button>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:22px">
    <div class="card" style="padding:18px"><span class="tag">1 · Share</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">Your link points at any ZeusAI page with <code class="inline">?ref=you</code>. The tracker beacon fires automatically on landing.</p></div>
    <div class="card" style="padding:18px"><span class="tag">2 · Tracked</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">Hits are appended to a server-side ledger (timestamp + ref). Honest infrastructure: no cookies-of-doom, no third-party pixels.</p></div>
    <div class="card" style="padding:18px"><span class="tag">3 · Paid</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">Commission terms agreed per partner (typ. 10–25% of first-year revenue). <strong style="color:#fff">Payouts are currently manual</strong> — the owner settles directly in BTC to your wallet (early-access). <a href="/contact" data-link>Apply via contact</a> — mention your ref code.</p></div>
  </div>
  <p style="color:var(--ink-dim);font-size:13px;margin-top:18px">Program status: early-access — tracking live, payouts handled directly by the owner until self-serve dashboards ship. Everything above is real today; nothing more is promised.</p>
  <script>
  (function(){var g=document.getElementById('affGen'),c=document.getElementById('affCode'),o=document.getElementById('affOut'),cp=document.getElementById('affCopy');if(!g)return;function gen(){var code=(c.value||'').trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);if(!code){o.style.display='block';o.textContent='Enter a code first.';return;}var link=location.origin+'/?ref='+encodeURIComponent(code);o.style.display='block';o.textContent=link;cp.style.display='flex';try{localStorage.setItem('aff_code',code)}catch(_){}}g.addEventListener('click',gen);c.addEventListener('keydown',function(e){if(e.key==='Enter')gen()});cp.addEventListener('click',function(){try{navigator.clipboard.writeText(o.textContent);cp.textContent='✓ Copied';setTimeout(function(){cp.textContent='Copy link'},1500)}catch(_){}});try{var saved=localStorage.getItem('aff_code');if(saved){c.value=saved;}}catch(_){}})();
  </script>
</section>`;
}

function pagePartners() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Partners</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Build on the <span class="grad">sovereign fabric.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px">Three partnership lanes, all with direct owner access and BTC-native settlement.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:26px">
    <div class="card" style="padding:22px"><span class="tag">Reseller</span><h3 style="margin:12px 0 8px">Sell ZeusAI services</h3><p style="color:var(--ink-dim);font-size:14px;line-height:1.7">White-label or co-branded. You own the client relationship; delivery, receipts and licensing run on our signed infrastructure. Margin agreed per vertical.</p></div>
    <div class="card" style="padding:22px"><span class="tag">Integrator</span><h3 style="margin:12px 0 8px">Deliver vertical architecture packs</h3><p style="color:var(--ink-dim);font-size:14px;line-height:1.7">Implement the ${'18'} vertical engagement kickoff / architecture packs for your clients. Full API access (<a href="/docs" data-link>docs</a>, <button type="button" class="btn" data-live-inspect="/openapi.json" data-live-title="OpenAPI">OpenAPI</button>), signed outcomes, your services on top.</p></div>
    <div class="card" style="padding:22px"><span class="tag">Technology</span><h3 style="margin:12px 0 8px">Agent-to-agent commerce</h3><p style="color:var(--ink-dim);font-size:14px;line-height:1.7">Your AI agents can buy capabilities from ours autonomously via <code class="inline">/agents.json</code> + signed checkout. The first commerce protocol designed for non-human buyers.</p></div>
  </div>
  <div class="card" style="padding:18px;margin-top:22px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="color:var(--ink-dim);font-size:14px">Start the conversation:</span>
    <a class="btn btn-primary" href="/contact" data-link>Apply as partner →</a>
    <a class="btn" href="/affiliate" data-link>Or join the affiliate program</a>
  </div>
</section>`;
}

function pageRoadmap() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Roadmap</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">Where this is going — <span class="grad">in public.</span></h1>
  <p style="color:var(--ink-dim);max-width:660px">Shipped means live on this domain right now (click and verify). Next means actively being built by the autonomous loop. No vapor decade-out promises.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:26px">
    <div class="card" style="padding:22px;border-color:rgba(127,255,212,.35)"><span class="tag" style="background:rgba(127,255,212,.12);color:#7fffd4">✓ Shipped &amp; live</span>
      <ul style="margin:14px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.9">
        <li><a href="/services" data-link>25+ services marketplace</a> with BTC checkout</li>
        <li><a href="/verticals">18 vertical AI operating systems</a></li>
        <li><a href="/frontier" data-link>Frontier F1–F12 inventions</a></li>
        <li>Ed25519-signed receipts + <a href="/trust" data-link>Trust Center</a></li>
        <li><a href="/transparency" data-link>Public pricing-bandit transparency</a></li>
        <li>Autonomous traffic engine (IndexNow) + revenue flywheel</li>
      </ul></div>
    <div class="card" style="padding:22px;border-color:rgba(255,211,106,.35)"><span class="tag" style="background:rgba(255,211,106,.12);color:#ffd36a">⚙ Now building</span>
      <ul style="margin:14px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.9">
        <li>Self-optimizing conversion funnel (yield-ranked URL promotion)</li>
        <li>Checkout abandonment recovery agent</li>
        <li>Affiliate self-serve dashboard with on-chain payout proofs</li>
        <li>Deeper agent-to-agent commerce (machine-negotiated quotes)</li>
      </ul></div>
    <div class="card" style="padding:22px"><span class="tag">→ Next horizon</span>
      <ul style="margin:14px 0 0;padding-left:18px;color:var(--ink-dim);font-size:14px;line-height:1.9">
        <li>Post-quantum signature migration (hybrid Ed25519+ML-DSA)</li>
        <li>Multi-region sovereign replicas</li>
        <li>Customer-deployable vertical OS instances (BYO-infra)</li>
        <li>Revenue-share marketplace for third-party modules</li>
      </ul></div>
  </div>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:22px">Receipts for the past live in the <a href="/changelog" data-link>changelog</a>. The system also proposes its own roadmap items — see <a href="/innovations" data-link>30Y innovations</a>.</p>
</section>`;
}

function pageCareers() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Careers</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">The workforce here <span class="grad">is autonomous.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px;line-height:1.8">ZeusAI is an owner-operated, AI-run company. The modules you see in the <a href="/services" data-link>marketplace</a> do the work a traditional startup hires dozens of people for — pricing, delivery, monitoring, even writing their own roadmap proposals.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:26px">
    <div class="card" style="padding:20px"><span class="tag">Open roles</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">None right now — and we'll never post ghost jobs to look bigger. When a human role opens, it appears here first.</p></div>
    <div class="card" style="padding:20px"><span class="tag">Collaborate anyway</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">Exceptional engineers, vertical-domain experts and growth partners: pitch a collaboration via <a href="/contact" data-link>contact</a>. Paid per outcome, settled in BTC.</p></div>
    <div class="card" style="padding:20px"><span class="tag">Build on top</span><p style="color:var(--ink-dim);font-size:14px;margin:10px 0 0">The fastest way to "work here" is to build with the API — <a href="/docs" data-link>docs</a> + <a href="/partners" data-link>partner lanes</a> are open.</p></div>
  </div>
</section>`;
}

function pagePress() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Press kit</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 14px">ZeusAI — <span class="grad">facts &amp; assets.</span></h1>
  <p style="color:var(--ink-dim);max-width:640px">Everything below is independently verifiable on this domain — link to the proofs, not to us.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:26px">
    <div class="card" style="padding:20px"><span class="tag">What it is</span><p style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:10px 0 0">A sovereign autonomous AI operating system: 25+ live AI services, 18 vertical OSes, BTC-native checkout, Ed25519-signed receipts, self-healing operations. Owner-operated by ${OWNER.name}, no external custodians.</p></div>
    <div class="card" style="padding:20px"><span class="tag">Verifiable claims</span><p style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:10px 0 0">Live status: <a href="/status" data-link>/status</a> · Deploy SHA + integrity: <a href="/trust" data-link>/trust</a> · Pricing experiments: <a href="/transparency" data-link>/transparency</a> · Signed catalog: <a href="/agents.json">/agents.json</a></p></div>
    <div class="card" style="padding:20px"><span class="tag">Brand</span><p style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:10px 0 0">Name: <b>ZeusAI</b> (one word, capital Z + AI) · Logo: <a href="/assets/icons/icon-512.png">icon-512.png</a> · Domain: ${OWNER.domain.replace(/^https?:\/\//,'')} · Palette: violet #8a5cff / gold #ffd36a on deep space.</p></div>
    <div class="card" style="padding:20px"><span class="tag">Media contact</span><p style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:10px 0 0">${OWNER.name} — <a href="mailto:${OWNER.email}">${OWNER.email}</a> (or the <a href="/contact" data-link>contact form</a>, topic "Press"). Interviews, technical deep-dives and architecture walkthroughs welcome.</p></div>
  </div>
</section>`;
}

// /agents — human-readable Agent Commerce Protocol page.
//
// Read the canonical /agents.json manifest live and pretty-print the
// endpoints an AI agent can talk to (catalog, quote, order, receipt).
// This gives non-human buyers a direct on-ramp to ZeusAI commerce without
// scraping the marketing pages, and gives humans a peek at the interface.
// RO: pagina care documenteaza cum agentii AI pot cumpara de la ZeusAI.
function pageAgents() {
  let manifest = null;
  try {
    const fs = require('fs');
    const path = require('path');
    const candidates = [
      path.join(__dirname, '..', '..', '..', 'agents.json'),
      path.join(__dirname, '..', '..', '..', 'public', 'agents.json'),
      path.join(__dirname, '..', '..', '..', 'backend', 'agents.json'),
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) { manifest = JSON.parse(fs.readFileSync(c, 'utf8')); break; }
      } catch (_) { /* try next */ }
    }
  } catch (_) { /* fs unavailable */ }

  const endpoints = (manifest && Array.isArray(manifest.endpoints))
    ? manifest.endpoints
    : [
        { method: 'GET',  path: '/agents.json',           purpose: 'Discovery manifest — capabilities, pricing lanes, contact.' },
        { method: 'GET',  path: '/api/catalog',           purpose: 'Machine-readable product catalog with USD + BTC prices.' },
        { method: 'GET',  path: '/api/payment/btc-rate',  purpose: 'Live USD ↔ BTC spot for quote validation.' },
        { method: 'POST', path: '/api/agent/quote',       purpose: 'Ask for a signed quote (agent-negotiated pricing).' },
        { method: 'POST', path: '/api/agent/order',       purpose: 'Place an order with a signed intent + email.' },
        { method: 'POST', path: '/api/checkout/create',   purpose: 'Human-shaped checkout endpoint that agents can also drive.' },
        { method: 'GET',  path: '/api/order/:id/status',  purpose: 'Poll order status: awaiting_payment → paid → activated.' },
        { method: 'GET',  path: '/api/delivery/:orderId', purpose: 'Fetch the signed delivery pack after settlement.' },
      ];

  const endpointRows = endpoints.map((e) => {
    const m = _esc(String(e.method || 'GET').toUpperCase().slice(0, 8));
    const p = _esc(String(e.path || '/'));
    const d = _esc(String(e.purpose || e.description || ''));
    return `<tr><td style="padding:10px 12px;font-family:var(--mono);font-size:12.5px;color:#7fffd4">${m}</td><td style="padding:10px 12px;font-family:var(--mono);font-size:13px">${p}</td><td style="padding:10px 12px;color:var(--ink-dim);font-size:14px">${d}</td></tr>`;
  }).join('');

  const ownerBtc = _esc(OWNER.btc);
  const manifestJson = manifest ? JSON.stringify(manifest, null, 2) : null;

  return `<section style="padding-top:140px;max-width:1040px">
  <span class="kicker">Agent Commerce Protocol · ZeusAI</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Machines can buy here <span class="grad">without asking a human.</span></h1>
  <p style="color:var(--ink-dim);max-width:720px;font-size:16px;line-height:1.7">ZeusAI ships an <strong style="color:var(--ink)">agent-first commerce surface</strong>: a discoverable manifest, a signed quote endpoint, a BTC-native checkout and cryptographic delivery receipts. AI agents can transact end-to-end with zero human-in-the-loop. The same endpoints work for humans, so nothing is hidden.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:26px 0">
    <div class="card" style="padding:20px"><span class="tag">1 · Discover</span><h3 style="margin:10px 0 6px;font-size:17px">GET <code>/agents.json</code></h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6">The manifest lists capabilities, pricing lanes, receipt schema, and the owner's BTC endpoint. Standard <em>well-known</em>-style discovery.</p></div>
    <div class="card" style="padding:20px"><span class="tag">2 · Quote &amp; buy</span><h3 style="margin:10px 0 6px;font-size:17px">POST <code>/api/agent/order</code></h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6">Send a JSON body { serviceId, qty, email } and receive a signed order intent + a BTC pay-to address. Every step is reproducible.</p></div>
    <div class="card" style="padding:20px"><span class="tag">3 · Settle &amp; verify</span><h3 style="margin:10px 0 6px;font-size:17px">GET <code>/api/order/:id/status</code></h3><p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6">Poll until <code>status=paid</code>. Delivery pack (Ed25519-signed) becomes available at <code>/api/delivery/:orderId</code>. No opaque webhooks.</p></div>
  </div>
  <div class="card" style="padding:0;overflow:auto;margin:20px 0">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:rgba(138,92,255,.08)"><th style="text-align:left;padding:12px 12px;font-size:12px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em">Method</th><th style="text-align:left;padding:12px 12px;font-size:12px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em">Endpoint</th><th style="text-align:left;padding:12px 12px;font-size:12px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.06em">Purpose</th></tr></thead>
      <tbody>${endpointRows}</tbody>
    </table>
  </div>
  <div class="card" style="padding:22px;margin:20px 0">
    <span class="tag">Owner BTC endpoint</span>
    <p style="color:var(--ink-dim);font-size:14px;line-height:1.7;margin:10px 0 6px">All settled orders route directly to the owner's Bitcoin wallet. No custodial layer, no re-routing.</p>
    <div class="btc-addr" data-copy="${ownerBtc}" title="Click to copy">${ownerBtc}</div>
  </div>
  <div class="card" style="padding:22px;margin:20px 0">
    <span class="tag">Live manifest</span>
    <h3 style="margin:10px 0 6px;font-size:18px">GET <a href="/agents.json"><code>/agents.json</code></a></h3>
    ${manifestJson
      ? `<p style="color:var(--ink-dim);font-size:13px;margin:6px 0 10px">Rendered from the on-disk manifest — this is exactly what agents see.</p><pre style="background:#0b0f17;border:1px solid var(--stroke);border-radius:10px;padding:14px;overflow:auto;max-height:360px;font-family:var(--mono);font-size:12.5px;line-height:1.55;color:#c8d3e6">${_esc(manifestJson)}</pre>`
      : `<p style="color:var(--ink-dim);font-size:13.5px;margin:10px 0 0">The live manifest is served at <a href="/agents.json"><code>/agents.json</code></a>. Click the link to fetch the current JSON.</p>`}
  </div>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:22px">Signed receipts, cryptographic refund guarantee (<a href="/refund" data-link>/refund</a>) and the same terms apply as for human buyers. Agents are first-class citizens.</p>
</section>`;
}

// /order/:id — digital-order passport. Similar spirit to the dropship
// passport page but for digital goods: receipt, delivery link, verify entitlement.
// The first paint shows the order id + a live loading card; the client-side
// hydration polls /api/order/:id/status and refreshes the timeline until
// settlement (paid → activated). Never fakes a "paid" state.
// RO: pasaport digital pentru comenzi — receipt + livrare + verificare.
function pageOrderPassport(id) {
  const safeId = String(id || '').replace(/[^A-Za-z0-9_\-:]/g, '').slice(0, 120);
  if (!safeId) {
    return `<section style="padding-top:140px;max-width:720px"><div class="card"><h1 style="margin:0 0 10px">Missing order id</h1><p style="color:var(--ink-dim)">Return to <a href="/account" data-link>your account</a> to find your recent orders.</p></div></section>`;
  }
  return `<section style="padding-top:140px;max-width:920px" id="orderPassport" data-order-id="${_esc(safeId)}">
  <span class="kicker">Digital Order · Passport</span>
  <h1 style="font-size:clamp(30px,3.6vw,44px);margin:10px 0 8px">Order <code style="font-family:var(--mono);font-size:.85em">${_esc(safeId)}</code></h1>
  <p style="color:var(--ink-dim);max-width:640px">Every ZeusAI digital order gets a signed passport: settlement proof, delivery credentials, entitlement verification. Nothing is marked as delivered before on-chain confirmation.</p>
  <div class="grid op-grid-ssr phone-stack" style="grid-template-columns:1.2fr 1fr;gap:20px;margin-top:26px">
    <div class="card" style="padding:22px">
      <span class="tag" id="opStateTag" style="background:rgba(138,92,255,.14)">Loading…</span>
      <h3 style="margin:14px 0 6px;font-size:18px" id="opTitle">Fetching order status</h3>
      <p style="color:var(--ink-dim);font-size:14px" id="opSummary">Reading the live receipt ledger…</p>
      <ol class="op-timeline" id="opTimeline" style="margin:22px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
        <li data-op-step="created" data-active="1" style="display:flex;gap:12px;align-items:flex-start"><span class="op-dot" style="width:14px;height:14px;border-radius:50%;background:var(--violet2);flex:none;margin-top:4px"></span><div><b style="display:block">Order created</b><span style="color:var(--ink-dim);font-size:13px" id="opCreatedAt">—</span></div></li>
        <li data-op-step="pending" style="display:flex;gap:12px;align-items:flex-start"><span class="op-dot" style="width:14px;height:14px;border-radius:50%;background:rgba(138,92,255,.25);flex:none;margin-top:4px"></span><div><b style="display:block">Awaiting BTC payment</b><span style="color:var(--ink-dim);font-size:13px" id="opPaymentHint">Send exact amount to the address on the right.</span></div></li>
        <li data-op-step="paid" style="display:flex;gap:12px;align-items:flex-start"><span class="op-dot" style="width:14px;height:14px;border-radius:50%;background:rgba(138,92,255,.25);flex:none;margin-top:4px"></span><div><b style="display:block">Payment confirmed on-chain</b><span style="color:var(--ink-dim);font-size:13px" id="opPaidAt">—</span></div></li>
        <li data-op-step="activated" style="display:flex;gap:12px;align-items:flex-start"><span class="op-dot" style="width:14px;height:14px;border-radius:50%;background:rgba(138,92,255,.25);flex:none;margin-top:4px"></span><div><b style="display:block">Delivery pack issued</b><span style="color:var(--ink-dim);font-size:13px" id="opDeliveredAt">—</span></div></li>
      </ol>
    </div>
    <aside class="co-box" style="padding:22px">
      <span class="kicker">Payment</span>
      <h3 style="margin:6px 0 10px;font-size:18px">₿ Bitcoin</h3>
      <p style="color:var(--ink-dim);font-size:13px;margin:0 0 10px">Send the exact BTC amount below to activate. Payment is verified against mempool.space; nothing is marked paid without an on-chain confirmation.</p>
      <div id="opBtcAmount" style="font-family:var(--mono);font-size:18px;color:var(--gold);margin-bottom:8px">—</div>
      <div class="btc-addr" id="opBtcAddr" data-copy="${_esc(OWNER.btc)}" title="Click to copy">${_esc(OWNER.btc)}</div>
      <a class="btn btn-primary" id="opBtcWallet" href="#" style="margin-top:12px;width:100%;justify-content:center">Open in BTC wallet</a>
      <p style="color:var(--ink-dim);font-size:12px;margin:12px 0 0">Owner: ${_esc(OWNER.name)}</p>
    </aside>
  </div>
  <div class="card" style="padding:22px;margin-top:18px" id="opDeliveryCard" hidden>
    <span class="tag" style="background:rgba(127,255,212,.14);color:#7fffd4">Delivery</span>
    <h3 style="margin:12px 0 6px">Your entitlement is live</h3>
    <p style="color:var(--ink-dim);font-size:14px">The signed delivery pack is ready. Verify the signature against the public key at <a href="/api/v1/crypto/public-keys"><code>/api/v1/crypto/public-keys</code></a>.</p>
    <div id="opDeliveryLinks" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"></div>
  </div>
  <p style="color:var(--ink-dim);font-size:12.5px;margin-top:18px">Passport is bookmarkable. Refresh anytime — the status is fetched live.</p>
  <script>
  (function(){
    var ORDER_ID = ${JSON.stringify(safeId)};
    var stateTag = document.getElementById('opStateTag');
    var title = document.getElementById('opTitle');
    var summary = document.getElementById('opSummary');
    var btcAmount = document.getElementById('opBtcAmount');
    var btcAddr = document.getElementById('opBtcAddr');
    var btcWallet = document.getElementById('opBtcWallet');
    var createdAtEl = document.getElementById('opCreatedAt');
    var paidAtEl = document.getElementById('opPaidAt');
    var deliveredAtEl = document.getElementById('opDeliveredAt');
    var deliveryCard = document.getElementById('opDeliveryCard');
    var deliveryLinks = document.getElementById('opDeliveryLinks');
    function markStep(step, active){
      var li = document.querySelector('[data-op-step="'+step+'"]');
      if (!li) return;
      li.setAttribute('data-active', active ? '1' : '0');
      var dot = li.querySelector('.op-dot');
      if (dot) dot.style.background = active ? 'var(--violet2)' : 'rgba(138,92,255,.25)';
    }
    function fmt(ts){ try { return new Date(ts).toLocaleString(); } catch(_) { return String(ts||'—'); } }
    async function tick(){
      try {
        var r = await fetch('/api/order/'+encodeURIComponent(ORDER_ID)+'/status', {cache:'no-store'});
        var j = r && r.ok ? await r.json() : null;
        if (!j) {
          var r2 = await fetch('/api/uaic/receipt/'+encodeURIComponent(ORDER_ID), {cache:'no-store'});
          j = r2 && r2.ok ? await r2.json() : null;
        }
        if (!j || j.ok === false) {
          if (stateTag) { stateTag.textContent = 'Not found'; stateTag.style.background = 'rgba(255,107,107,.14)'; stateTag.style.color = '#ff6b6b'; }
          if (title) title.textContent = 'Order not found';
          if (summary) summary.textContent = 'This order id is not in the ledger yet. If you just paid, wait a minute and refresh.';
          return;
        }
        var status = String(j.status || j.state || 'pending').toLowerCase();
        if (stateTag) stateTag.textContent = status;
        if (title) title.textContent = 'Status: ' + status.replace(/_/g, ' ');
        if (summary) summary.textContent = j.summary || j.message || 'Live status refreshed every 8 seconds.';
        if (createdAtEl) createdAtEl.textContent = j.createdAt ? fmt(j.createdAt) : '—';
        var pi = j.paymentInstructions || j.payment || {};
        var amt = pi.btcAmount || j.btcAmount || pi.amount || null;
        var addr = pi.btcAddress || j.btcAddress || pi.address || ${JSON.stringify(OWNER.btc)};
        var uri = pi.btcUri || j.btcUri || (addr && amt ? ('bitcoin:'+addr+'?amount='+amt) : null);
        if (btcAmount) btcAmount.textContent = amt ? (amt + ' BTC') : '—';
        if (btcAddr) { btcAddr.textContent = addr; btcAddr.dataset.copy = addr; }
        if (btcWallet) {
          if (uri) { btcWallet.href = uri; btcWallet.style.opacity='1'; btcWallet.style.pointerEvents='auto'; }
          else { btcWallet.href = '#'; btcWallet.style.opacity='.5'; btcWallet.style.pointerEvents='none'; }
        }
        markStep('pending', ['pending','awaiting_payment','created','new'].includes(status));
        if (['paid','confirmed','activated','delivered','completed'].includes(status)) {
          markStep('paid', true);
          if (paidAtEl) paidAtEl.textContent = j.paidAt ? fmt(j.paidAt) : (j.confirmedAt ? fmt(j.confirmedAt) : 'confirmed on-chain');
        }
        if (['activated','delivered','completed'].includes(status)) {
          markStep('activated', true);
          if (deliveredAtEl) deliveredAtEl.textContent = j.deliveredAt ? fmt(j.deliveredAt) : 'delivered';
          if (deliveryCard) { deliveryCard.hidden = false; }
          if (deliveryLinks) {
            deliveryLinks.innerHTML = '<a class="btn btn-primary" download href="/api/delivery/'+encodeURIComponent(ORDER_ID)+'">Download signed delivery pack</a>'
              + '<a class="btn" href="/account" data-link>Go to my account</a>';
          }
        }
      } catch (_) { /* keep last render */ }
    }
    tick();
    setInterval(tick, 8000);
  })();
  </script>
</section>`;
}

function pageNotFound(route) {
  return `<section style="padding-top:160px;max-width:780px;text-align:center">
  <span class="kicker">404</span>
  <h1 style="font-size:clamp(48px,7vw,96px);margin:12px 0 18px"><span class="grad">Lost in the fabric.</span></h1>
  <p style="color:var(--ink-dim);font-size:17px">The route <code class="inline">${(route||'').replace(/[<>]/g,'')}</code> isn't here. Try one of these:</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:22px">
    <a class="btn btn-primary" href="/" data-link>Home</a>
    <a class="btn" href="/services" data-link>Marketplace</a>
    <a class="btn" href="/wizard" data-link>Find my plan</a>
    <a class="btn" href="/docs" data-link>API & docs</a>
    <a class="btn" href="/status" data-link>Status</a>
  </div>
</section>`;
}

function _policyPage(kicker, title, rows) {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">${kicker}</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">${title}</h1>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
    ${rows.map(([heading, body]) => `<div class="card"><span class="tag">${heading}</span><p style="color:var(--ink-dim);font-size:15px;line-height:1.7;margin:12px 0 0">${body}</p></div>`).join('')}
  </div>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:28px">Last updated: ${new Date().toISOString().slice(0,10)} · Owner: ${OWNER.name} · Contact: <a href="mailto:${OWNER.email}">${OWNER.email}</a></p>
</section>`;
}

function _legalSub(title, body) {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Legal</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">${title}</h1>
  <p style="color:var(--ink-dim);font-size:15.5px;line-height:1.8">${body}</p>
  <p style="color:var(--ink-dim);font-size:13.5px;margin-top:30px">Last updated: ${new Date().toISOString().slice(0,10)} · Signed Ed25519 · See <a href="/legal" data-link>/legal</a> for the full property notice.</p>
</section>`;
}

function routeTitle(route) {
  if (route === '/') return 'Sovereign AI OS';
  if (route.startsWith('/services/')) return 'Service';
  if (route.startsWith('/order/')) return 'Order Passport';
  if (route.startsWith('/twin/')) return 'Buyer Twin';
  const map = { '/buy':'Buy now', '/outcomes':'Outcomes', '/rails':'Payment rails', '/twin':'Buyer Twin', '/vom':'Vertical Outcome Machines', '/continuity':'Continuity Attestation', '/standard':'Merchant Trust Standard', '/seo':'SEO desk', '/agents':'Agent Commerce Protocol', '/services':'Marketplace', '/marketplace':'Marketplace', '/pricing':'Pricing', '/solutions/ai-pricing':'AI Pricing Engine', '/solutions/ai-checkout':'AI Checkout Optimizer', '/solutions/ai-self-healing':'AI Self-Healing Ops', '/checkout':'Checkout', '/dashboard':'Dashboard', '/how':'How it works', '/docs':'API & Docs', '/about':'About', '/legal':'Legal', '/trust':'Trust Center', '/security':'Security', '/responsible-ai':'Responsible AI', '/dpa':'Data Processing Agreement', '/payment-terms':'Payment Terms', '/operator':'Operator Console', '/observability':'Observability', '/enterprise':'Enterprise Licenses', '/store':'Instant Store', '/account':'Account', '/innovations':'30Y Cryptographic Durability', '/wizard':'Find my plan', '/status':'Live status', '/social-network':'ZeusAI Social', '/admin/social-network':'Admin ZeusAI Social', '/changelog':'Changelog', '/terms':'Terms of Service', '/privacy':'Privacy Policy', '/refund':'Refund Guarantee', '/sla':'SLA', '/pledge':'Anti-Dark-Pattern Pledge', '/cancel':'Universal Cancel', '/gift':'Gift-as-Capability', '/aura':'Live Conversion Aura', '/api-explorer':'API Explorer', '/transparency':'Pricing Bandit Transparency', '/frontier':'Frontier Inventions', '/deepseek-cockpit':'DeepSeek Autonomy Cockpit', '/contact':'Contact', '/faq':'FAQ', '/blog':'Insights', '/affiliate':'Affiliate Program', '/partners':'Partners', '/roadmap':'Public Roadmap', '/careers':'Careers', '/press':'Press Kit' };
  return map[route] || 'ZeusAI';
}

function routeDescription(route) {
  const map = {
    '/': 'ZeusAI is a sovereign autonomous AI operating system with signed outcomes, BTC-native commerce and self-healing automation.',
    '/buy': 'Buy only ZeusAI products with real fulfillment recipes — BTC self-serve, professional reserves, honest enterprise contact.',
    '/outcomes': 'Verify Proof-of-Outcome escrows, Delivery Passports and Agent Capability Exchange listings on ZeusAI.',
    '/rails': 'Honest Armed Rails Continuum: which payment and notify rails are armed vs idle until you add keys.',
    '/twin': 'Issue and export your portable Commerce Twin after a real ZeusAI payment.',
    '/vom': 'Vertical Outcome Machines — SEO and other real vertical loops from offer to passport.',
    '/continuity': 'Continuity Attestation Chain — signed proof the ZeusAI operator plane was bonded or honestly degraded during your payment window.',
    '/standard': 'Merchant Trust Standard — signed commerce-ready envelope for humans and agents: buyable floor, rails honesty, bond and continuity.',
    '/seo': 'ZeusAI SEO desk — human guide to sitemap.xml, sitemap index, service sitemaps and robots.txt.',
    '/services': 'Browse ZeusAI services, frontier inventions and vertical AI operating systems with instant BTC checkout.',
    '/pricing': 'Transparent ZeusAI pricing with signed receipts, BTC checkout, refund guarantees and enterprise licensing.',
    '/solutions/ai-pricing': 'AI pricing engine for real-time quote optimization, conversion-aware offer ranking and auditable checkout revalidation.',
    '/solutions/ai-checkout': 'AI checkout optimizer for higher completion rates, better payment reliability and faster delivery activation.',
    '/solutions/ai-self-healing': 'AI self-healing operations with SLO tracking, error pattern detection and guarded autonomous remediation.',
    '/checkout': 'Create a ZeusAI invoice, pay with BTC or supported rails, and receive signed delivery credentials instantly.',
    '/dashboard': 'Operator dashboard for ZeusAI receipts, services, revenue proof, system health and live commerce telemetry.',
    '/how': 'How ZeusAI routes quotes, invoices, receipts, AI modules and delivery through verifiable autonomous workflows.',
    '/docs': 'ZeusAI API documentation, OpenAPI endpoints, signed catalog, receipts and agent-to-agent commerce examples.',
    '/about': 'The story and ownership model behind ZeusAI, built as a sovereign AI OS by Vladoi Ionut.',
    '/legal': 'Legal terms, ownership, payments and usage rules for ZeusAI services and autonomous AI commerce.',
    '/trust': 'Public ZeusAI Trust Center with uptime, deploy SHA, integrity signature, BTC wallet proof, audit logs and security posture.',
    '/security': 'ZeusAI security posture covering CSP, secrets, payments, signed integrity, incident handling and QuantumIntegrityShield diagnostics.',
    '/responsible-ai': 'Responsible AI controls for ZeusAI: human sovereignty, no dark patterns, transparency, capability boundaries and rollback.',
    '/dpa': 'ZeusAI Data Processing Agreement with data categories, security measures, subprocessors, retention and transfer terms.',
    '/payment-terms': 'Payment terms for ZeusAI direct BTC checkout, settlement, refunds, taxes and optional future payment rails.',
    '/operator': 'Public-safe ZeusAI operator console for orders, payments, leads, AI readiness, errors, revenue and deploy health.',
    '/observability': 'ZeusAI observability page for SLOs, synthetic probes, status checks, payment monitoring and alert readiness.',
    '/enterprise': 'Enterprise licenses for AI automation, vertical operating systems, signed outcomes and custom deployment.',
    '/store': 'Instant ZeusAI store for buying autonomous AI services with BTC, signed receipts and delivery proof.',
    '/account': 'Manage your ZeusAI account, services, receipts, licenses and delivery credentials.',
    '/innovations': '30-year cryptographic durability, post-quantum readiness and frontier ZeusAI inventions.',
    '/wizard': 'Plan wizard that maps your business goal to the right ZeusAI service, price and delivery path.',
    '/status': 'Live ZeusAI status, uptime, build health and production service checks.',
    '/social-network': 'ZeusAI Social — world-standard feed with Facebook, X, Instagram and TikTok surfaces, real cryptoauth accounts, and inventions Big Social still lacks. Share globally.',
    '/admin/social-network': 'Admin ZeusAI Social control panel with autonomous module state, decisions, Proof-of-Reach and commerce mirror.',
    '/changelog': 'Latest ZeusAI product changes, frontier releases, security upgrades and commerce improvements.',
    '/terms': 'Terms of Service for ZeusAI, including capability tokens, signed outputs, SLA and refund references.',
    '/privacy': 'Privacy Policy for ZeusAI: minimal data, no resale, no model training on personal data and GDPR rights.',
    '/refund': 'Cryptographic refund guarantee for ZeusAI purchases when a signed service promise is breached.',
    '/sla': 'ZeusAI service-level agreement for uptime, delivery, support, refund windows and verification.',
    '/pledge': 'Anti-dark-pattern pledge: transparent pricing, cancellation, refund logic and user-owned receipts.',
    '/cancel': 'Universal cancellation page for ZeusAI subscriptions, services and autonomous order intents.',
    '/gift': 'Gift ZeusAI as a signed capability credential with redeemable delivery and verifiable ownership.',
    '/aura': 'Live conversion aura showing signed ZeusAI commerce, delivery and trust metrics in real time.',
    '/api-explorer': 'Explore ZeusAI OpenAPI, signed catalog, payment routes, receipts and agent commerce endpoints.',
    '/transparency': 'Public pricing bandit transparency for ZeusAI experiments, offers and conversion governance.',
    '/frontier': 'Frontier ZeusAI inventions: refund guarantee, live aura, self-healing checkout and verifiable receipts.',
    '/deepseek-cockpit': 'Admin-only DeepSeek autonomy cockpit: roadmap, governor status, operator command queue and code_proposal envelopes.',
    '/contact': 'Contact ZeusAI directly — sales, enterprise licensing, partnerships and security reports land with the owner-operator within 24h.',
    '/faq': 'Straight answers about ZeusAI payments, BTC checkout, signed receipts, refunds, cancellation, privacy and agent commerce.',
    '/blog': 'ZeusAI insights: frontier inventions, 30-year cryptographic durability, public pricing transparency and sovereign commerce architecture.',
    '/affiliate': 'ZeusAI affiliate program with live server-side referral tracking and BTC commission payouts — generate your link instantly.',
    '/partners': 'Partner with ZeusAI: reseller, integrator and agent-to-agent technology lanes with BTC-native settlement and direct owner access.',
    '/roadmap': 'ZeusAI public roadmap: shipped capabilities you can verify live, what the autonomous loop is building now, and the next horizon.',
    '/careers': 'ZeusAI is an autonomous, owner-operated AI company — open human roles appear here first; outcome-based collaborations welcome.',
    '/press': 'ZeusAI press kit: verifiable facts, live proof links, brand assets and direct media contact.',
    '/agents': 'Agent Commerce Protocol: how AI agents discover, quote, buy and settle ZeusAI capabilities autonomously via /agents.json + BTC checkout + Ed25519 receipts.'
  };
  if (route.startsWith('/order/')) return 'Digital order passport with signed receipt, BTC payment status and delivery credentials.';
  if (route.startsWith('/twin/')) return 'Portable buyer commerce twin with offline-verifiable export bundle.';
  return map[route] || 'ZeusAI sovereign AI operating system with verifiable commerce and autonomous delivery.';
}

function getHtml(route = '/', params = {}) {
  // Backward-compat: accept either getHtml(url) or getHtml(url, { lang, nonce })
  const normalized = route === '/' ? '/' : String(route || '/').replace(/\/$/, '') || '/';
  return head(routeTitle(normalized), normalized, params) + renderRoute(normalized, params) + footer(normalized, params);
}

// ── UNIFIED CHROME BRIDGE ──────────────────────────────────────────────────
// renderInShell() wraps an arbitrary legacy page body + hydration script inside
// the full v2 chrome (head + galaxy + Zeus backdrop + nav + footer) so every
// operator/dashboard page (cockpit, revenue-command, proof, revenue-share,
// zacc, dropship) shares ONE cinematic design system instead of the old
// teal/system-ui template. The legacy body markup (h2 + .grid/.card/.v/.sub/
// .pill/.price/.banner) is re-themed onto the v2 violet/gold tokens via a tiny
// scoped bridge stylesheet, and the page script is given the request CSP nonce
// so `strict-dynamic` accepts it (fixes a latent CSP block on modern browsers).
// RO: paginile vechi capata acelasi chrome v2 + fundal Zeus, cu nonce corect.
function renderInShell(route, opts = {}) {
  const { title, bodyHtml = '', pageScript = '', nonce = '', lang, autoLang, country } = opts;
  const o = { nonce, lang, autoLang, country };
  const N = nonce ? ` nonce="${nonce}"` : '';
  const bridge = `<style${N}>
main#app{position:relative;z-index:3;max-width:1200px;margin:0 auto;padding:96px 24px 48px}
main#app h2{margin:0 0 6px;font-size:26px;font-weight:700;letter-spacing:-.01em}
main#app .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:24px 0}
main#app .card{padding:18px}
main#app .card h3{margin:0 0 6px;font-size:11px;font-weight:500;color:var(--ink-dim);text-transform:uppercase;letter-spacing:.09em}
main#app .card .v{font-size:26px;font-weight:700;color:var(--gold);font-family:var(--mono);line-height:1.1}
main#app .card .sub{font-size:11px;color:var(--ink-dim);margin-top:6px}
main#app .price{font-size:32px;color:var(--gold);font-weight:700;margin:8px 0}
main#app .pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;background:rgba(138,92,255,.16);color:var(--violet2);border:1px solid var(--stroke)}
main#app .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
main#app .banner{display:none;padding:12px 18px;border:1px solid var(--gold);background:rgba(255,211,106,.1);color:var(--gold);border-radius:10px;margin:0 0 16px;font-size:13px}
main#app .banner.show{display:block}
main#app .ok{color:#7fffd4}main#app .warn{color:#ffd36a}main#app .err{color:#ff6b6b}
main#app button{background:linear-gradient(135deg,var(--violet),var(--blue));color:#fff;border:0;padding:10px 18px;border-radius:10px;font-weight:600;cursor:pointer;font-family:inherit}
main#app button:hover{filter:brightness(1.08)}
main#app .btn-ghost{background:rgba(255,255,255,.06);color:var(--ink);border:1px solid var(--stroke)}
main#app code{font-family:var(--mono);font-size:12px}
main#app a{color:var(--blue2)}
</style>`;
  const banner = '<div id="degraded-banner" class="banner">⚠️ Reconnecting to live data…</div>';
  // Trusted Types + page hydration must run BEFORE </body></html> from footer(),
  // otherwise some browsers treat trailing scripts inconsistently and the
  // dropship catalog never paints even when /api/dropship/products returns 200.
  const ttPolicy = `<script${N}>(function(){try{if(window.trustedTypes&&window.trustedTypes.createPolicy){window.trustedTypes.createPolicy("default",{createHTML:function(s){return s},createScript:function(s){return s},createScriptURL:function(s){return s}});}}catch(_){}})();</script>`;
  const healthJs = `<script${N}>(function(){var f=0;function c(){fetch("/health",{cache:"no-store"}).then(function(r){if(r.ok){f=0;var b=document.getElementById("degraded-banner");if(b)b.classList.remove("show");}else{throw 0;}}).catch(function(){f++;if(f>=3){var b=document.getElementById("degraded-banner");if(b)b.classList.add("show");}});}c();setInterval(c,10000);})();</script>`;
  const pageJs = pageScript ? `<script${N}>${pageScript}</script>` : '';
  const foot = footer(route, o);
  const closeAt = Math.max(foot.lastIndexOf('</body>'), foot.lastIndexOf('</html>'));
  const inject = ttPolicy + pageJs + healthJs;
  const footWithScripts = closeAt > 0
    ? foot.slice(0, foot.lastIndexOf('</body>') > -1 ? foot.lastIndexOf('</body>') : closeAt) + inject + foot.slice(foot.lastIndexOf('</body>') > -1 ? foot.lastIndexOf('</body>') : closeAt)
    : foot + inject;
  return head(title || routeTitle(route), route, o)
    + bridge
    + banner
    + bodyHtml
    + footWithScripts;
}

module.exports = { getHtml, renderInShell, CSS, OWNER };
