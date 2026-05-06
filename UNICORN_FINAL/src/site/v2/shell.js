// UNICORN V2 — SSR shell + per-route HTML fragments
// Original work, © Vladoi Ionut. Cinematic single-page portal synced with Unicorn backend.
'use strict';

const { CSS } = require('./styles');
const { BUILD_ID, assetPath, browserAssetManifest } = require('./build-id');

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
          const live = dp.getPrice(p.id);
          if (live && Number(live.finalPrice) > 0) {
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
          const live = dp.getPrice(s.id);
          if (live && Number(live.finalPrice) > 0) {
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
    ? `<span class="tag" title="Auto-published from a backend module — appeared on the site without manual work" style="background:rgba(255,211,106,.10);color:#ffd36a;border:1px solid rgba(255,211,106,.30);font-size:10px;margin-left:6px">🤖 auto</span>`
    : '';
  return `<article class="card" data-product-id="${id}" data-price-source="${_esc(p.livePriceSource || 'marketplace')}" data-auto-published="${p.autoPublished ? '1' : '0'}" itemscope itemtype="https://schema.org/Product" style="display:flex;flex-direction:column;gap:8px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <span class="tag" style="background:rgba(138,92,255,.12);color:#bda4ff;border:1px solid rgba(138,92,255,.30);font-size:10px">${cat}</span>
      <span style="font-family:var(--mono);font-size:14px;color:var(--gold)" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="USD"/><span itemprop="price" data-pricing-value="${id}">${priceTxt}</span>${liveBadge}${autoBadge}</span>
    </div>
    <h3 style="margin:2px 0 0;font-size:14px;line-height:1.3" itemprop="name">${title}</h3>
    <p style="margin:0;color:var(--ink-dim);font-size:12px;line-height:1.4;flex:1" itemprop="description">${desc}</p>
    <a class="btn btn-ghost" href="/checkout?serviceId=${encodeURIComponent(id)}&plan=${encodeURIComponent(id)}" data-link aria-label="Buy ${title} with Bitcoin" style="font-size:12px;padding:6px 10px">Buy →</a>
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
  const priceTxt = price > 0 ? ('$' + price.toLocaleString('en-US')) : 'Free';
  const billing = price > 0 && (p.billing === 'monthly') ? '<small style="color:var(--ink-dim);font-weight:400">/mo</small>' : '';
  // When the live pricing engine produced this number, surface a small badge
  // so the user (and ops) can tell it is the AI-negotiated value, not a
  // static catalogue floor.
  const liveBadge = p.livePriceSource && p.livePriceSource !== 'static-fallback'
    ? `<span class="tag" title="Live AI-negotiated price · source=${_esc(p.livePriceSource)}${p.demandFactor ? ' · demand=' + Number(p.demandFactor).toFixed(2) : ''}" style="background:rgba(127,255,212,.12);color:#7fffd4;border:1px solid rgba(127,255,212,.35);font-size:10px;margin-left:6px">⚡ live${p.surgeActive ? ' · surge' : ''}</span>`
    : '';
  return `<article class="card" data-tier="${_esc(p.tier || '')}" data-product-id="${id}" data-price-source="${_esc(p.livePriceSource || 'static')}" itemscope itemtype="https://schema.org/Product" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">${_tierBadge(p.tier)}<span style="font-family:var(--mono);font-size:18px;color:var(--gold)" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="priceCurrency" content="USD"/><span itemprop="price" data-pricing-value="${id}">${priceTxt}</span>${billing}${liveBadge}</span></div>
    <h3 style="margin:4px 0 0;font-size:18px;line-height:1.25" itemprop="name">${title}</h3>
    <p style="margin:0;color:var(--ink-dim);font-size:13px;line-height:1.45;flex:1" itemprop="description">${desc}</p>
    <div style="display:flex;gap:8px;margin-top:6px"><a class="btn btn-primary" href="/checkout?plan=${encodeURIComponent(id)}" data-link aria-label="Buy ${title} with Bitcoin" style="flex:1;justify-content:center">Buy with BTC →</a><a class="btn btn-ghost" href="/services/${encodeURIComponent(id)}" data-link aria-label="View details for ${title}">Details</a></div>
  </article>`;
}
function _ssrCatalogGrid(items, opts) {
  const o = opts || {};
  if (!items || !items.length) {
    return `<div class="card"><p style="color:var(--ink-dim);margin:0">Catalog refreshing… open <a href="/api/services">/api/services</a> for the live JSON.</p></div>`;
  }
  const cards = items.map(_catalogCard).join('');
  const cols = o.minCol || 300;
  return `<div class="grid" id="${_esc(o.gridId || 'catalogGrid')}" style="grid-template-columns:repeat(auto-fill,minmax(${cols}px,1fr));gap:16px">${cards}</div>`;
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
  // 5) FAQPage on /how and /pricing — small but valuable for rich results.
  if (route === '/how' || route === '/pricing') {
    const faq = route === '/pricing' ? [
      { q: 'How do I pay?', a: 'Direct BTC checkout is the primary production rail. Card/Stripe, PayPal and NOWPayments appear only when configured in runtime env. Every receipt is Ed25519-signed and stored in your account.' },
      { q: 'Is there a refund?', a: 'Yes — a cryptographic refund guarantee: SLA breach → automatic refund, plus 30-day money-back, no questions asked.' },
      { q: 'Do you store my data?', a: 'Minimal data, no resale, no model training on personal data. See our DPA and Privacy Policy for full details.' }
    ] : [
      { q: 'What is ZeusAI?', a: 'A sovereign autonomous AI operating system that ships signed outcomes, BTC-native commerce, and self-healing automation.' },
      { q: 'How does delivery work?', a: 'Each purchase mints a verifiable capability credential. Delivery runs autonomously and posts proof to your account.' },
      { q: 'Can I cancel anytime?', a: 'Yes. The Universal Cancel page lets you cancel any subscription or order in one click — no dark patterns.' }
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
<!-- Preload the only font used above the fold; the rest are declared inline below. -->
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/SpaceGrotesk-Regular.woff2" crossorigin="anonymous"/>
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
   and the Google Fonts stylesheet finish loading in parallel.
   Keep this block tiny — it ships on every SSR response.
   ============================================================ */
@font-face{font-family:'Space Grotesk';src:url('/assets/fonts/SpaceGrotesk-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Space Grotesk';src:url('/assets/fonts/SpaceGrotesk-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'JetBrains Mono';src:url('/assets/fonts/JetBrainsMono-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Cinzel';src:url('/assets/fonts/Cinzel-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'Orbitron';src:url('/assets/fonts/Orbitron-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
:root{--bg:#05040a;--bg2:#0a0818;--ink:#e8ecff;--ink-dim:#8fa1d4;--violet:#8a5cff;--blue:#3ea0ff;--gold:#ffd36a;--stroke:rgba(163,138,255,.22);--radius:18px;--font:"Space Grotesk","Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden}
body{min-height:100vh;background:radial-gradient(1400px 900px at 50% 0%,rgba(138,92,255,.12),transparent 55%),radial-gradient(1200px 800px at 100% 100%,rgba(62,160,255,.08),transparent 60%),linear-gradient(180deg,#05040a 0%,#0a0818 100%)}
a{color:#6fd3ff;text-decoration:none}
img{max-width:100%;display:block}
.nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:18px 32px;backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);background:linear-gradient(180deg,rgba(5,4,10,.7),rgba(5,4,10,.3));border-bottom:1px solid var(--stroke)}
.btn{display:inline-block;padding:14px 20px;border-radius:14px;border:1px solid rgba(255,255,255,.18);color:#fff;text-decoration:none;background:rgba(255,255,255,.08)}
.btn.primary{background:linear-gradient(135deg,var(--violet),var(--blue));border-color:transparent}
.hero{position:relative;min-height:100vh;display:flex;align-items:center;padding:96px 7vw;overflow:hidden}
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
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>
<meta http-equiv="Pragma" content="no-cache"/>
<meta http-equiv="Expires" content="0"/>
<noscript><div style="position:relative;z-index:10;max-width:760px;margin:120px auto 20px;padding:18px 22px;border-radius:14px;background:rgba(138,92,255,.08);border:1px solid rgba(138,92,255,.3);color:#e8f4ff;font-family:system-ui,Arial">ZeusAI runs best with JavaScript enabled. Static pages, sitemap, and signed receipts are still available without it: visit <a href="/sitemap.xml" style="color:#8a5cff">/sitemap.xml</a>, <a href="/docs" style="color:#8a5cff">/docs</a>, or <a href="/api/services" style="color:#8a5cff">/api/services</a>.</div></noscript>
<div class="galaxy-bg" id="zeusCanvas" aria-hidden="true"></div>
<div class="zeus-page-bg" id="zeusPageBg" aria-hidden="true"><div class="zeus-page-bg__layer zeus-page-bg__layer--a"></div><div class="zeus-page-bg__layer zeus-page-bg__layer--b"></div><div class="zeus-page-bg__veil"></div></div>
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
<div class="brand"><div class="brand-logo brand-logo-photo"><picture><source type="image/avif" srcset="${assetPath('/assets/zeus/brand-88.avif')} 1x, ${assetPath('/assets/zeus/brand-176.avif')} 2x, ${assetPath('/assets/zeus/brand-264.avif')} 3x"/><source type="image/webp" srcset="${assetPath('/assets/zeus/brand-88.webp')} 1x, ${assetPath('/assets/zeus/brand-176.webp')} 2x, ${assetPath('/assets/zeus/brand-264.webp')} 3x"/><img src="${assetPath('/assets/zeus/brand-88.jpg')}" srcset="${assetPath('/assets/zeus/brand-88.jpg')} 1x, ${assetPath('/assets/zeus/brand-176.jpg')} 2x, ${assetPath('/assets/zeus/brand-264.jpg')} 3x" alt="Zeus" width="44" height="44" decoding="async" loading="lazy" onerror="this.style.display='none'"/></picture></div><div><span class="zeus-wordmark">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
<button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="nav-links">
  <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
</button>
<div class="nav-links" id="nav-links">
${L('/', 'Home')}${L('/services', 'Marketplace')}${L('/wizard', 'Find my plan')}${L('/store', 'Store')}${L('/crypto-fiat-bridge', 'Crypto Bridge')}<a href="/account" data-link data-customer-link${route === '/account' ? ' class="active"' : ''}>Account</a>${L('/enterprise', 'Enterprise')}${L('/pricing', 'Pricing')}${L('/innovations', 'Innovations')}${L('/frontier', 'Frontier')}${L('/docs', 'API')}${L('/status', 'Status')}
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
      <div class="brand" style="margin-bottom:14px"><div class="brand-logo"></div><div><span class="zeus-wordmark">Zeus<span class="ai">AI</span></span><small>Sovereign · Self-Evolving · Signed</small></div></div>
      <p style="color:var(--ink-dim);font-size:13.5px;line-height:1.6;max-width:360px">Autonomous AI operating system. Every module signed with W3C DID. Every outcome routed through Merkle-chained receipts. Property of ${OWNER.name}.</p>
    </div>
    <div><h3 class="footer-col-title">Product</h3><ul>
      <li><a href="/services" data-link>Marketplace</a></li>
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
      <li><a href="/openapi.json">OpenAPI 3.1</a></li>
      <li><a href="/seo/sitemap.xml">Sitemap</a></li>
      <li><a href="/snapshot">/snapshot</a></li>
      <li><a href="/stream">/stream (SSE)</a></li>
      <li><a href="/health">/health</a></li>
    </ul></div>
    <div><h3 class="footer-col-title">Trust</h3><ul>
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
    </ul></div>
    <div><h3 class="footer-col-title">Company</h3><ul>
      <li><a href="/about" data-link>About</a></li>
      <li><a href="/changelog" data-link>Changelog</a></li>
      <li><a href="/legal" data-link>Legal</a></li>
      <li><a href="/terms" data-link>Terms</a></li>
      <li><a href="/privacy" data-link>Privacy</a></li>
      <li><a href="/dpa" data-link>DPA</a></li>
      <li><a href="/payment-terms" data-link>Payment Terms</a></li>
      <li><a href="/operator" data-link>Operator Console</a></li>
      <li><a href="mailto:${OWNER.email}">${OWNER.email}</a></li>
      <li><a href="${OWNER.domain}">${OWNER.domain.replace(/^https?:\/\//,'')}</a></li>
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
<script${N} data-local-three-version="r160">
// 30Y-LTS: try locally vendored Three.js first, fall back to CDN only when absent.
// PERF: defer until the browser is idle (or 1.5 s after load) so Three.js parsing
// never blocks LCP / TBT. The galaxy canvas already has a CSS-only fallback
// painted for the first frame so deferring is purely additive.
(function loadThree(){
  function inject(){
    if (window.__zeusThreeLoaded) return; window.__zeusThreeLoaded = true;
    var s=document.createElement('script');
    s.src='${assetPath('/assets/vendor/three.min.js')}';
    s.async=true;
    s.onerror=function(){var f=document.createElement('script');f.src='https://unpkg.com/three@0.160.0/build/three.min.js';f.async=true;document.head.appendChild(f);};
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
<div id="zeus-buy-bar" class="zeus-buy-bar" hidden>
  <div class="zeus-buy-text"><b>Ready to deploy ZeusAI?</b><span>30-day refund · direct BTC owner wallet · cancel any time</span></div>
  <div class="zeus-buy-cta"><a class="btn btn-ghost btn-sm" href="/wizard" data-link>Find my plan</a><a class="btn btn-primary btn-sm" href="/services" data-link>Buy now →</a></div>
</div>
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
  // Sticky buy bar — shown after scroll on home/services/pricing
  try {
    var route = (document.documentElement.getAttribute('data-route')||'/');
    var bar = document.getElementById('zeus-buy-bar');
    // NB: this code lives inside a backtick template literal, so backslashes
    // get unescaped before reaching the browser. Use new RegExp(...) to keep
    // the literal slash intact (otherwise '/^\\/(...)/' -> '/^/(...)/' -> SyntaxError).
    if (bar && new RegExp('^/(?:|services|pricing|how|frontier)$').test(route)) {
      window.addEventListener('scroll', function(){ if (scrollY > 320) bar.hidden = false; }, { passive:true });
    }
  } catch(_){ }
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
.zeus-buy-bar{position:fixed;left:0;right:0;bottom:0;z-index:80;background:linear-gradient(180deg,rgba(8,10,18,0),rgba(5,4,10,.96) 40%);padding:12px 18px;display:flex;gap:16px;align-items:center;justify-content:space-between;border-top:1px solid rgba(120,140,200,.18);font:14px/1.4 system-ui;color:#e7ecf3}
.zeus-buy-text b{display:block;font-size:14.5px}.zeus-buy-text span{color:#9aa6bd;font-size:12.5px}
.zeus-buy-cta{display:flex;gap:8px}
.btn-sm{padding:8px 14px;font-size:13px}
[hidden]{display:none !important}
.zeus-buy-bar[hidden]{display:none !important}
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
  const _featured = []
    .concat(_byTier.instant.slice().sort((a,b)=>(a.priceUSD||0)-(b.priceUSD||0)).slice(0,2))
    .concat(_byTier.professional.slice().sort((a,b)=>(a.priceUSD||0)-(b.priceUSD||0)).slice(0,2))
    .concat(_byTier.enterprise.slice().sort((a,b)=>(a.priceUSD||0)-(b.priceUSD||0)).slice(0,2));
  const _featuredHtml = _featured.length
    ? `<section id="homeFeatured" style="margin:40px 0 0">
  <div class="section-title">
    <div><span class="kicker">Featured · ${_all.length} live products in catalog</span><h2>Buy a real ZeusAI service <span class="grad">in under a minute.</span></h2></div>
    <p>These are six concrete deliverables you can pay for right now in BTC. Full catalogue at <a href="/services" data-link>/services</a>.</p>
  </div>
  ${_ssrCatalogGrid(_featured, { gridId: 'homeFeaturedGrid', minCol: 280 })}
  <p style="text-align:center;margin:18px 0 0"><a class="btn btn-ghost" href="/services" data-link>See all ${_all.length} products →</a></p>
</section>` : '';
  return `<section class="hero">
  <div class="zeus-scene" aria-hidden="true">
    <picture><source type="image/avif" srcset="${assetPath('/assets/zeus/hero-640.avif')} 640w, ${assetPath('/assets/zeus/hero.jpg').replace(/\.jpg$/, '.avif')} 800w" sizes="100vw"/><source type="image/webp" srcset="${assetPath('/assets/zeus/hero-640.webp')} 640w" sizes="100vw"/><img id="zeusHeroImg" class="zeus-hero-image" src="${assetPath('/assets/zeus/hero-640.jpg')}" srcset="${assetPath('/assets/zeus/hero-640.jpg')} 640w, ${assetPath('/assets/zeus/hero.jpg')} 800w" sizes="100vw" data-zeus-src="${assetPath('/assets/zeus/hero.jpg')}" alt="" width="1600" height="900" decoding="async" fetchpriority="high" loading="eager" onerror="this.onerror=null;this.src='${assetPath('/assets/zeus/placeholder.svg')}'"/></picture>
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
      <span class="hero-eyebrow"><span class="dot"></span> Live · ${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</span>
      <h1>ZEUS AI / <span class="grad">Launch AI products faster.</span></h1>
      <p class="lead">Live autonomous AI commerce platform: ZeusAI turns modules, verticals and marketplaces into buyable AI services with direct BTC checkout, signed receipts and instant delivery.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/services" data-link>Buy AI Service →</a>
        <a class="btn" href="/status" data-link>Live Status</a>
        <a class="btn" href="/innovations" data-link>Innovations</a>
      </div>
      <div class="hero-stats" id="heroStats">
        <div class="hero-stat"><b id="statModules">169</b><span>Live modules</span></div>
        <div class="hero-stat"><b id="statVerticals">18</b><span>Verticals</span></div>
        <div class="hero-stat"><b id="statMarkets">41</b><span>Marketplaces</span></div>
        <div class="hero-stat"><b id="statChain">—</b><span>Chain length</span></div>
      </div>
      <div class="hero-stats" style="margin-top:14px">
        <div class="hero-stat"><b>Forward-only</b><span>Deploy guarded</span></div>
        <div class="hero-stat"><b>QIS intact</b><span>Integrity live</span></div>
        <div class="hero-stat"><b>BTC direct</b><span>Checkout promise</span></div>
        <div class="hero-stat"><b>Live API</b><span>Live API is protecting orders</span></div>
      </div>
    </div>
  </div>
</section>

${_featuredHtml}

<section id="commerceProof">
  <div class="section-title">
    <div><span class="kicker">Live commerce proof · ${_all.length} live products</span><h2>Tot ce am adăugat azi este <span class="grad">legat în site.</span></h2></div>
    <p>Nu doar API-uri ascunse: catalogul, checkout-ul BTC/BTCPay-ready, livrarea automată, portalul client și cockpit-ul admin sunt acum vizibile și testabile direct din interfață.</p>
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
      <a class="btn btn-primary" href="/checkout?plan=adaptive-ai" data-link>Test checkout →</a>
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
      <h3 id="commerceProofSmoke">EXPECTED_MIN_CATALOG_ITEMS=65</h3>
      <p>Post-deploy smoke validates catalog, checkout, confirmation, license, delivery, refund protection and cleanup.</p>
      <a class="btn btn-ghost" href="/health">Health JSON →</a>
    </div>
  </div>
</section>

<section id="finalLive">
  <div class="section-title">
    <div><span class="kicker">Final upgrade</span><h2>ZeusAI Final mode is <span class="grad">live now.</span></h2></div>
    <p>This section proves runtime integration in production: service sync, user services and real-time event stream.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    <div class="card"><span class="tag">Services sync</span><h3 id="fuServices">Loading…</h3><p>Source: <code class="inline">/api/services/list</code></p></div>
    <div class="card"><span class="tag">Realtime stream</span><h3 id="fuEvents">Connecting…</h3><p>Source: <code class="inline">/api/unicorn/events</code></p></div>
    <div class="card"><span class="tag">User services</span><h3 id="fuUser">Loading…</h3><p>Source: <code class="inline">/api/user/services</code></p></div>
    <div class="card"><span class="tag">AI registry</span><h3 id="fuAiCount">Loading…</h3><p>Source: <code class="inline">/api/ai/registry</code></p></div>
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
      <div class="card" style="margin:0"><span class="tag">Optimization score</span><h3 id="fuOptScore">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Rollback readiness</span><h3 id="fuRollback">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Strategy split</span><h3 id="fuStrategy">Loading…</h3></div>
    </div>
    <div class="pl-output" id="fuLoopOut" style="margin-top:10px">Waiting for loop snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Trust & Transparency Ledger</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Unified proof layer for integrity signatures, receipt auditability and owner revenue routing.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Integrity score</span><h3 id="fuTrustSig">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Paid receipts</span><h3 id="fuTrustReceipts">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Revenue proof</span><h3 id="fuRevTotal">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Payout channels</span><h3 id="fuRevMethods">Loading…</h3></div>
    </div>
    <div class="pl-output" id="fuTrustOut" style="margin-top:10px">Waiting for trust snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Resilience Drill Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Live failover drill to validate recovery posture and rollback speed.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Drill score</span><h3 id="fuDrillScore">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Avg recovery</span><h3 id="fuDrillRecovery">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Total runs</span><h3 id="fuDrillRuns">Loading…</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuDrillBtn">Run drill now</button></div>
    <div class="pl-output" id="fuDrillOut">Waiting for resilience snapshot…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Cinematic Auto-Tune</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">Reglează efectele vizuale automat, în funcție de performanța curentă.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">Profile</span><h3 id="fuTuneMode">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Intensity</span><h3 id="fuTuneIntensity">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Motion</span><h3 id="fuTuneMotion">Loading…</h3></div>
    </div>
    <div class="pl-actions" style="margin-top:10px"><button class="pl-btn" id="fuTuneBtn">Apply live profile</button></div>
    <div class="pl-output" id="fuTuneOut">Waiting for auto-tune profile…</div>
  </div>
  <div class="co-box" style="margin-top:16px">
    <h3 style="margin:0 0 8px">Performance Governance Console</h3>
    <p style="color:var(--ink-dim);font-size:13px;margin:0 0 12px">p95/p99 latency guardrails with adaptive cinematic downgrade policy.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div class="card" style="margin:0"><span class="tag">API latency</span><h3 id="fuPerfP95">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Render latency</span><h3 id="fuPerfP99">Loading…</h3></div>
      <div class="card" style="margin:0"><span class="tag">Mode</span><h3 id="fuPerfMode">Loading…</h3></div>
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
    <div class="panel pillar" data-pillar="giants" tabindex="0" role="button" aria-label="Open Giant Integration Fabric live view"><div class="ic">🌐</div><h3 class="pillar-title">Giant Integration Fabric</h3><p>42 hyperscalers and enterprise giants (AWS, Azure, GCP, SF, SAP, SNOW, OpenAI, NVIDIA…) behind a single markup‑aware bus.</p><span class="pillar-cta">Dispatch to giants →</span></div>
    <div class="panel pillar" data-pillar="monetize" tabindex="0" role="button" aria-label="Open Global Monetization Mesh live view"><div class="ic">🚀</div><h3 class="pillar-title">Global Monetization Mesh</h3><p>41 marketplaces, multi‑armed bandit pricing. 572M+ reach. Publish once, sell everywhere.</p><span class="pillar-cta">Publish listing →</span></div></div>
  <div id="pillarLive" class="pillar-live" aria-live="polite"></div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Live from the fabric</span><h2>Top services, <span class="grad">streaming from ZeusAI.</span></h2></div>
    <p>Pulled in real time from <code class="inline">/api/services</code>. When ZeusAI adds or reprices a service, this section updates automatically.</p>
  </div>
  <div class="grid" id="liveServices"><div class="card"><p>Loading live catalogue…</p></div></div>
</section>

<section>
  <div class="section-title">
    <div><span class="kicker">Verticals</span><h2>Eighteen industries. <span class="grad">One sovereign brain.</span></h2></div>
    <p>From finance to pharma, ZeusAI ships pre‑configured vertical OSes — each with its own compliance, pricing, and marketplace lineage.</p>
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
    <div><span class="kicker">Marketplace · Master Catalog · ${_esc(summary)}</span><h2>Every ZeusAI deliverable, <span class="grad">one sovereign storefront.</span></h2></div>
    <p>Strategic services + Frontier inventions + Vertical OSes + Adaptive AI modules — all live from the ZeusAI fabric. Buy any item directly in BTC. Receipt is Ed25519-signed and revenue routes 100% to the owner wallet.</p>
  </div>
  <div class="card" style="margin:16px 0 22px;background:linear-gradient(135deg,rgba(247,147,26,.10),rgba(127,90,240,.10));border:1px solid rgba(247,147,26,.45)">
    <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between">
      <div style="flex:1;min-width:280px">
        <span class="kicker">₿ Native Bitcoin commerce · zero custodian</span>
        <h3 style="margin:8px 0;font-size:22px">Pay any service direct in BTC. <span id="catBtcSpot" style="color:var(--gold);font-family:var(--mono);font-size:14px">live rate loading…</span></h3>
        <p style="color:var(--ink-dim);margin:0;font-size:14px">Owner wallet routes 100% of revenue. Each invoice generates an Ed25519 receipt + on-chain proof via mempool.space.</p>
        <div class="btc-addr" id="svcHeroBtcAddr" data-copy="${OWNER.btc}" title="Click to copy">${OWNER.btc}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;min-width:200px">
        <div id="catCounts" style="font-size:12px;color:var(--ink-dim);text-align:right;font-family:var(--mono)">${_esc(summary)}</div>
        <a class="btn btn-primary" href="/checkout?plan=custom" data-link>Quick BTC checkout →</a>
      </div>
    </div>
  </div>
  <div class="filters" id="catFilters" role="tablist" aria-label="Filter services by tier">
    <button class="chip on" data-group="all" type="button">All (${catalog.length})</button>
    <button class="chip" data-group="instant" type="button">⚡ Instant (${counts.instant || 0})</button>
    <button class="chip" data-group="professional" type="button">💼 Professional (${counts.professional || 0})</button>
    <button class="chip" data-group="enterprise" type="button">👑 Enterprise (${counts.enterprise || 0})</button>
  </div>
  <section id="autonomousLiveSection" style="margin:20px 0 30px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <h3 style="margin:0;font-size:20px;letter-spacing:-0.01em">⚡ Live from Unicorn fabric <small style="color:var(--ink-dim);font-size:12px;font-weight:400">— rendered server-side, refreshed live</small></h3>
      <span id="autonomousStatus" style="font-size:11px;color:var(--ink-dim);font-family:var(--mono)">${catalog.length} products SSR · hydrating…</span>
    </div>
    ${_ssrCatalogGrid(catalog, { gridId: 'catalogGrid', minCol: 300 })}
    <div id="autonomousServicesGrid" hidden></div>
  </section>
</section>`;
}

function pageService(id) {
  return `<section style="padding-top:140px" id="servicePage" data-id="${id}">
  <div id="serviceMain"><div class="card"><p>Loading service ${id}…</p></div></div>
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
  const fmt = (info) => '$' + Number(info.price).toLocaleString('en-US');
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Pricing · live AI-negotiated rates</span><h2>Fair. Sovereign. <span class="grad">Outcome‑aligned.</span></h2></div>
    <p>Simple plans for teams. Prices below are computed live by the ZeusAI dynamic-pricing engine (demand × peak × per-tier variance × surge). For enterprise verticals, ZeusAI ships outcome‑based pricing — you pay a share of measured value delivered, auto‑invoiced via the Value‑Proof Ledger.</p>
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
      <a class="btn" href="/checkout?plan=starter" data-link>Start Starter</a>
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
      <a class="btn btn-primary" href="/checkout?plan=pro" data-link>Go Growth</a>
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
      <a class="btn btn-gold" href="/checkout?plan=enterprise" data-link>Talk to Zeus</a>
    </div>
  </div>
</section>`;
}

function pageCheckout() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Checkout promise</span><h2>Pay direct in BTC. <span class="grad">Activation is automatic.</span></h2></div>
    <p>Every payment generates an Ed25519‑signed receipt appended to the Merkle chain. Keep this window open: ZeusAI watches settlement and unlocks delivery/license credentials automatically.</p>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:0 0 22px">
    <div class="card"><span class="tag">Step 1</span><h3>Select service</h3><p style="color:var(--ink-dim)">Choose plan/product and email so delivery can issue the entitlement.</p></div>
    <div class="card"><span class="tag">Step 2</span><h3>Quote / invoice</h3><p id="checkoutPaymentRailCopy" style="color:var(--ink-dim)">BTC quote and owner wallet are shown before payment. External providers appear only when configured live.</p></div>
    <div class="card"><span class="tag">Step 3</span><h3>Delivery / license</h3><p style="color:var(--ink-dim)">After settlement, receipt, license token, API key and onboarding delivery become available.</p></div>
  </div>
  <div class="checkout">
    <div class="co-box">
      <div class="co-method">
        <button class="chip on" data-method="btc">₿ Bitcoin</button>
      </div>
      <div id="coPanelBtc">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start">
          <div>
            <div class="field"><label for="coAmount">Amount (USD)</label><input id="coAmount" type="number" min="1" step="1" value=""/></div>
            <div class="field"><label for="coPlan">Plan / product</label><input id="coPlan" value="starter"/></div>
            <div class="field"><label for="coEmail">Email for activation</label><input id="coEmail" type="email" placeholder="you@company.com"/></div>
            <div class="field"><label for="coBtc">BTC quote</label><input id="coBtc" readonly value="computing…"/></div>
            <div class="btc-addr" id="btcAddr">${OWNER.btc}</div>
            <div id="coFxStrip" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
            <button class="btn btn-primary" id="coPay" style="margin-top:14px;width:100%;justify-content:center">Generate secure BTC invoice</button>
            <p style="color:var(--ink-dim);font-size:12px;margin-top:8px">Generating secure BTC invoice and order ID. After you send BTC, the server watches the mempool every 30s and auto‑issues a signed license on confirmation.</p>
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
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Plan</span><b id="sumPlan" style="color:#fff">starter</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Amount</span><b id="sumAmount" style="color:#fff">Loading price...</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0;border-bottom:1px solid var(--stroke)"><span>Owner</span><b style="color:#fff">${OWNER.name}</b></div>
      <div style="display:flex;justify-content:space-between;color:var(--ink-dim);font-size:14px;padding:10px 0"><span>Receipt</span><b style="color:var(--ok)">Ed25519 signed</b></div>
      <p style="color:var(--ink-dim);font-size:12.5px;line-height:1.6;margin-top:14px">Every receipt is routed by <code class="inline">sovereignRevenueRouter</code>. On enterprise plans, a share of delivered value is auto‑invoiced via the Value‑Proof Ledger.</p>
    </aside>
  </div>
</section>`;
}

function pageDashboard() {
  return `<section style="padding-top:140px">
  <div class="section-title">
    <div><span class="kicker">Dashboard</span><h2>My <span class="grad">ZeusAI</span></h2></div>
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
  <div class="grid" id="dashServices"><div class="card"><p>Loading services…</p></div></div>
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
    <div class="panel"><div class="ic">7</div><h3 class="pillar-title">Monetization Mesh</h3><p>41 marketplaces, multi‑armed bandit pricing. Publish once, sell everywhere.</p></div>
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
    <div><span class="kicker">API &amp; Docs</span><h2>Talk to <span class="grad">ZeusAI.</span></h2></div>
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
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-top:22px">
    <div class="card"><span class="tag">Node SDK quickstart</span><pre class="code">const order = await fetch('https://zeusai.pro/api/checkout/btc', {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ plan:'starter', amountUSD:49, customer:{ email:'you@company.com' } })
}).then(r => r.json());
console.log(order.receipt.id, order.btcUri);</pre></div>
    <div class="card"><span class="tag">Python SDK quickstart</span><pre class="code">import requests
order = requests.post('https://zeusai.pro/api/checkout/btc', json={
  'plan':'starter', 'amountUSD':49, 'customer':{'email':'you@company.com'}
}).json()
print(order['receipt']['id'], order.get('btcUri'))</pre></div>
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
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">Two years later, it is a running operating system for the AI era. 169 living modules. 18 pre‑wired vertical industries. 42 hyperscaler integrations. 41 marketplaces. One Zeus core. All of it owned by one person — ${OWNER.name} — and designed so that no one else can silently take a slice.</p>
  <p style="color:var(--ink-dim);font-size:17px;line-height:1.7">It is not a product. It is a sovereign thesis: that intelligence, value, and property can finally be unified inside a single cryptographic chassis. This is the chassis.</p>
  <div style="display:flex;gap:14px;margin-top:30px"><a class="btn btn-primary" href="/services" data-link>See the fabric</a><a class="btn" href="mailto:${OWNER.email}">Contact the owner</a></div>
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
  return `<section style="padding-top:140px;max-width:1180px">
  <span class="kicker">Trust Center · public proofs</span>
  <h1 style="font-size:clamp(34px,4.4vw,58px);margin:10px 0 18px">Operational trust, <span class="grad">signed and inspectable.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">This page combines uptime, deploy identity, integrity signatures, owner BTC routing, payment readiness, security posture, audit logs and incident history. No private secrets are exposed.</p>
  <div class="grid" id="trustGrid" style="margin-top:22px"><div class="card"><p>Loading trust center…</p></div></div>
  <div class="card" style="padding:22px;margin-top:18px"><span class="kicker">Integrity document</span><pre class="code" id="trustRaw">Loading…</pre></div>
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
    } catch(e) { grid.innerHTML='<div class="card"><p style="color:var(--danger)">Trust center unavailable: '+e.message+'</p></div>'; }
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
  <script>
  fetch('/api/operator/console').then(r=>r.json()).then(d=>{
    const cards=[['Orders', d.orders.total], ['Paid', d.orders.paid], ['Revenue', '$'+d.revenue.totalUsd], ['Payment rail', d.payments.mode], ['AI providers', d.ai.active+'/'+d.ai.total], ['Deploy', d.deploy.sha], ['Errors', d.errors.count], ['Webhooks', d.webhooks.status]];
    document.getElementById('opGrid').innerHTML=cards.map(c=>'<div class="card"><span class="tag">'+c[0]+'</span><h3>'+c[1]+'</h3></div>').join('');
    document.getElementById('opRaw').textContent='deploy '+(d.deploy.sha||'—')+' · payments '+(d.payments.mode||'—')+' · revenue $'+(d.revenue.totalUsd||0).toLocaleString();
  }).catch(e=>{ document.getElementById('opRaw').textContent=e.message; });
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
  }).catch(e=>{ document.getElementById('obsRaw').textContent=e.message; });
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
  const libValue = library.reduce((s, p) => s + Number(p.priceUSD || 0), 0);
  const renderLibrarySection = (cat, items) => {
    if (!items.length) return '';
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    return `<details class="library-cat-block" data-category="${_esc(cat)}" style="margin:0 0 18px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:10px;background:rgba(138,92,255,.06);border:1px solid rgba(138,92,255,.2);font-weight:600;font-size:13px"><span>${_esc(label)} · ${items.length} services</span><span style="color:var(--ink-dim);font-family:var(--mono);font-size:11px">click to expand</span></summary><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:10px">${items.map(_libraryCard).join('')}</div></details>`;
  };
  const renderTierSection = (tier, label, items) => {
    if (!items.length) return '';
    return `<details class="store-tier-block" data-tier="${tier}" open style="margin:0 0 30px"><summary style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-radius:12px;background:rgba(138,92,255,.08);border:1px solid rgba(138,92,255,.25);font-weight:600"><span>${_esc(label)} · ${items.length} products</span><span style="color:var(--ink-dim);font-family:var(--mono);font-size:12px">click to collapse</span></summary><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;margin-top:14px">${items.map(_catalogCard).join('')}</div></details>`;
  };
  const totalSellable = catalog.length + libCount;
  const totalCatalogueValue = totalUsd + libValue;
  return `<section class="enterprise-hero" style="padding-top:120px">
  <div style="max-width:1280px;margin:0 auto;padding:0 28px">
    <span class="kicker" style="color:#ffd36a">ZeusAI Store · ${totalSellable} sellable services across the curated catalogue + auto-published Unicorn library · $${totalCatalogueValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} total catalogue value</span>
    <h1 style="font-size:clamp(36px,5vw,64px);line-height:1.04;margin:14px 0 18px;letter-spacing:-0.02em;background:linear-gradient(135deg,#fff 0%,#ffd36a 40%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Buy it. Pay with BTC, card or wire. Use it instantly.</h1>
    <p style="color:var(--ink-dim);font-size:18px;max-width:900px;line-height:1.55">Every service ZeusAI offers — from $29 digital deliverables to enterprise licenses, plus every backend module auto-published from the live Unicorn — purchasable directly from this page. Bitcoin on-chain for instant fulfillment, Stripe for cards, SWIFT/SEPA wire for enterprise. Every artifact Ed25519-signed.</p>

    <div id="storeStats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin:30px 0 20px">
      <div class="card"><span class="tag">Instant</span><h3 style="margin:6px 0 0;font-size:24px">${counts.instant}</h3></div>
      <div class="card"><span class="tag">Professional</span><h3 style="margin:6px 0 0;font-size:24px">${counts.professional}</h3></div>
      <div class="card"><span class="tag">Enterprise</span><h3 style="margin:6px 0 0;font-size:24px">${counts.enterprise}</h3></div>
      <div class="card"><span class="tag" style="background:rgba(255,211,106,.10);color:#ffd36a;border:1px solid rgba(255,211,106,.30)">🤖 Auto-published</span><h3 style="margin:6px 0 0;font-size:24px" data-library-count>${libCount}</h3></div>
    </div>

    <div id="storeTabs" style="display:flex;gap:8px;margin:30px 0 10px;flex-wrap:wrap;border-bottom:1px solid rgba(138,92,255,.2);padding-bottom:4px">
      <button class="store-tab" data-tier="instant" type="button" style="background:linear-gradient(135deg,#8a5cff,#6d28d9);color:#fff;border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">⚡ Instant &lt;60s (${counts.instant})</button>
      <button class="store-tab" data-tier="professional" type="button" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">💼 Professional SaaS (${counts.professional})</button>
      <button class="store-tab" data-tier="enterprise" type="button" style="background:rgba(138,92,255,.1);color:var(--ink);border:0;padding:10px 22px;border-radius:6px 6px 0 0;cursor:pointer;font-weight:600;font-size:14px">👑 Enterprise Licenses (${counts.enterprise})</button>
    </div>
    <div id="storeTabNote" style="color:var(--ink-dim);font-size:13px;margin:6px 0 20px">All ${catalog.length} curated products + ${libCount} auto-published library services rendered server-side · live JS hydration refreshes prices via SSE.</div>

    <div id="storeGrid" style="margin:20px 0 40px">
      ${renderTierSection('instant', '⚡ Instant deliverables (under 60 seconds)', byTier.instant)}
      ${renderTierSection('professional', '💼 Professional SaaS', byTier.professional)}
      ${renderTierSection('enterprise', '👑 Enterprise licenses', byTier.enterprise)}
    </div>

    ${libCount > 0 ? `<div id="autoLibrary" style="margin:50px 0 80px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;border-top:1px solid rgba(138,92,255,.2);padding-top:30px">
        <div>
          <span class="kicker" style="color:#ffd36a">🤖 Auto-published Unicorn library · live</span>
          <h2 style="margin:6px 0 0;font-size:28px;line-height:1.2">Every backend module, on sale automatically.</h2>
        </div>
        <span style="color:var(--ink-dim);font-size:13px;font-family:var(--mono)" data-library-count-label>${libCount} services · auto-refreshed via SSE 24/7</span>
      </div>
      <p style="color:var(--ink-dim);font-size:14px;line-height:1.55;max-width:820px;margin:0 0 20px">Every <code style="font-size:12px;background:rgba(138,92,255,.1);padding:2px 6px;border-radius:4px">backend/modules/*.js</code> file becomes a sellable service the moment it loads. Categories below are derived from each module's domain; prices come live from the AI-negotiated <code style="font-size:12px;background:rgba(127,255,212,.1);padding:2px 6px;border-radius:4px">dynamic-pricing</code> engine. No manual catalogue work — the unicorn announces new services automatically.</p>
      <div id="autoLibraryGrid">
        ${libCategories.map(c => renderLibrarySection(c, libByCat[c])).join('')}
      </div>
    </div>` : ''}
    <div id="storeCheckout" style="margin:40px 0 80px"></div>
  </div>
</section>`;
}

function pageAccount() {
  // ────────────────────────────────────────────────────────────────────
  // Revolutionary cryptographic auth (Ed25519 + IndexedDB + encrypted vault).
  // SOLE auth surface on this site. No passwords. No emails for auth.
  // No SMS. No magic links. Private key never leaves the user's device.
  // Mobile + desktop parity by design (single responsive layout).
  // ────────────────────────────────────────────────────────────────────
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

<script>
(function(){
  if (window.__zeusCryptoAuthInit) return; window.__zeusCryptoAuthInit = true;
  // ── Polyfilled-safe Web Crypto check ──
  var subtle = (window.crypto && window.crypto.subtle) || null;
  if (!subtle || !window.indexedDB) {
    var s = document.getElementById('acaState');
    if (s) s.innerHTML = '<b style="color:#ff9c9c">This browser does not support Web Crypto / IndexedDB.</b><br><span style="color:var(--ink-dim);font-size:13px">Use any modern browser (Chrome, Firefox, Safari, Edge \u2265 2020).</span>';
    return;
  }

  var DB_NAME = 'zeus-cryptoauth';
  var STORE = 'keys';
  var KEY_ID = 'primary';
  var TOKEN_KEY = 'zeus_cryptoauth_token';
  var USERID_KEY = 'zeus_cryptoauth_userid';

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
    return subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  }
  function exportPublicRaw(kp) { return subtle.exportKey('raw', kp.publicKey); }
  function exportPrivatePkcs8(kp) { return subtle.exportKey('pkcs8', kp.privateKey); }
  function importPrivate(pkcs8) {
    return subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
  }
  function importPublic(raw) {
    return subtle.importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
  }
  function sign(privKey, data) {
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
  function api(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function(r){ return r.json().then(function(j){ return { status: r.status, body: j }; }); });
  }
  function apiGet(path, token) {
    return fetch(path, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
      .then(function(r){ return r.json().then(function(j){ return { status: r.status, body: j }; }); });
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
    $dlgBody.innerHTML = bodyHtml;
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
    $state.innerHTML = '<div style=\"color:#ff9c9c;font-weight:600\">' + html(msg) + '</div>';
  }
  function statusOk(msg) {
    $state.innerHTML = '<div style=\"color:#7cffb8;font-weight:600\">' + html(msg) + '</div>';
  }

  function renderLoggedIn(user) {
    $state.innerHTML =
      '<div style=\"display:flex;align-items:center;gap:12px;flex-wrap:wrap\">' +
        '<div style=\"width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#7cffb8,#8a5cff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;font-size:18px\">' + html((user.name || user.userId).slice(0,1).toUpperCase()) + '</div>' +
        '<div style=\"flex:1;min-width:200px\">' +
          '<div style=\"font-size:18px;font-weight:600\">' + html(user.name || 'Signed in') + '</div>' +
          '<div style=\"color:var(--ink-dim);font-size:13px\">' + (user.email ? html(user.email) + ' \u00b7 ' : '') + '<code style=\"font-size:12px;color:#9ab4ff\">' + html(user.userId) + '</code></div>' +
          '<div style=\"color:var(--ink-dim);font-size:12px;margin-top:4px\">Member since ' + html(new Date(user.createdAt).toLocaleDateString()) + '</div>' +
        '</div>' +
        '<span style=\"background:rgba(124,255,184,.15);color:#7cffb8;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600\">\u25cf Signed in</span>' +
      '</div>';
    $panels.innerHTML = '';
  }

  function renderLoggedOut() {
    $state.innerHTML =
      '<div style=\"font-size:15px;color:var(--ink-dim);line-height:1.55\">You are not signed in. Create a new account in 5 seconds (no email needed) or import your backup vault if you already have one.</div>';
    $panels.innerHTML =
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
          '<h3 style=\"margin:0 0 6px;font-size:15px\">Lost access? Import vault</h3>' +
          '<p style=\"color:var(--ink-dim);font-size:13px;margin:0 0 10px\">Restore from the <code style=\"color:#7cffb8\">.zeus-vault</code> backup file.</p>' +
          '<input id=\"acaVaultFile\" type=\"file\" accept=\".zeus-vault,.json,application/json\" style=\"width:100%;font-size:13px;color:#cdd5e6;margin-bottom:8px\">' +
          '<button id=\"acaImport\" class=\"btn btn-ghost\" style=\"width:100%;padding:10px\">Import &amp; sign in \u2192</button>' +
        '</div>' +
      '</div>';

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
    statusOk('Generating keypair\u2026');
    genKeypair().then(function(kp){
      return Promise.all([exportPublicRaw(kp), exportPrivatePkcs8(kp)]).then(function(arr){
        var publicRaw = arr[0], privatePkcs8 = arr[1];
        var publicKeyB64 = b64encode(publicRaw);
        return api('/api/cryptoauth/register', { publicKey: publicKeyB64, name: name, email: email }).then(function(r){
          if (r.status !== 200 || !r.body || !r.body.ok) throw new Error((r.body && r.body.error) || 'register_failed');
          var userId = r.body.userId;
          var challenge = r.body.challenge;
          // Sign challenge to immediately log in.
          return sign(kp.privateKey, utf8(challenge)).then(function(sig){
            return api('/api/cryptoauth/login', { userId: userId, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
              if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error('login_after_register_failed');
              return persistKeyAndAuth(kp.privateKey, publicKeyB64, userId, lr.body.token).then(function(){
                return promptBackupDownload(privatePkcs8, publicRaw, { userId: userId, name: name, email: email }).then(function(){
                  return refresh();
                });
              });
            });
          });
        });
      });
    }).catch(function(e){ statusError('Could not create account: ' + (e.message || e)); });
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
      return api('/api/cryptoauth/challenge', { userId: '', email: '', publicKey: rec.pub }).then(function(){
        // Compute userId from publicKey by asking for a challenge — but our endpoint needs userId or email.
        // We'll do a register-call which is idempotent (returns userId for an existing pub key).
        return api('/api/cryptoauth/register', { publicKey: rec.pub }).then(function(r){
          if (r.status !== 200 || !r.body || !r.body.ok) throw new Error((r.body && r.body.error) || 'challenge_failed');
          var userId = r.body.userId;
          var challenge = r.body.challenge;
          return sign(rec.priv, utf8(challenge)).then(function(sig){
            return api('/api/cryptoauth/login', { userId: userId, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
              if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error('login_failed');
              try { localStorage.setItem(TOKEN_KEY, lr.body.token); localStorage.setItem(USERID_KEY, userId); } catch(_){}
              return refresh();
            });
          });
        });
      });
    }).catch(function(e){ statusError('Sign in failed: ' + (e.message || e)); });
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
              return api('/api/cryptoauth/register', { publicKey: pubB64 }).then(function(r){
                if (r.status !== 200 || !r.body || !r.body.ok) throw new Error('recover_register_failed');
                var userId = r.body.userId;
                var challenge = r.body.challenge;
                return sign(privKey, utf8(challenge)).then(function(sig){
                  return api('/api/cryptoauth/recover', { publicKey: pubB64, challenge: challenge, signature: b64encode(sig) }).then(function(lr){
                    if (lr.status !== 200 || !lr.body || !lr.body.ok) throw new Error('recover_failed');
                    return persistKeyAndAuth(privKey, pubB64, userId, lr.body.token).then(refresh);
                  });
                });
              });
            });
          }).catch(function(){ statusError('Decryption failed. Wrong password or corrupted vault.'); });
        } catch (e) { statusError('Could not parse vault file.'); }
      };
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
      <button class="btn btn-ghost ent-module-cta" data-module="${m.id}" data-module-title="${m.title}" style="font-size:13px;padding:8px 14px">Request demo →</button>
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
    <p style="color:var(--ink-dim);font-size:19px;max-width:900px;line-height:1.55">Ten production-ready ZeusAI platforms plus a full module catalogue. Anchor pricing from <b style="color:#fff">$14M</b> to <b style="color:#fff">$150M</b>. Topstone deals up to <b style="color:#ffd36a">$2B</b>. Every license includes signed deliverables, sovereign key ceremony, 99.99%+ SLA, and a live <b style="color:#fff">autonomous negotiation desk</b> that closes without a human in the loop.</p>

    <div style="display:flex;gap:14px;flex-wrap:wrap;margin:28px 0 0">
      <a href="#enterprise-contact" class="btn btn-gold" data-link style="font-size:16px;padding:14px 26px">📩 Contact Enterprise Sales</a>
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
    <div id="entModulesGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-bottom:60px">${moduleCards}</div>

    <h2 id="enterprise-api" style="font-size:32px;letter-spacing:-0.01em;margin:60px 0 8px">API endpoints exposed</h2>
    <p style="color:var(--ink-dim);font-size:15px;max-width:800px;margin:0 0 24px">Every enterprise module is fully programmatic. Request a sandbox token via the contact form below — typical turnaround &lt; 4 hours.</p>
    <div style="margin-bottom:24px">${apiExamples}</div>
    <p style="color:var(--ink-dim);font-size:13px;margin-bottom:60px">📖 Full reference: <a href="/docs" data-link style="color:#6fd3ff">/docs</a> · 🧪 Sandbox available on request · 🔐 Every response is Ed25519-signed.</p>

    <h2 style="font-size:32px;letter-spacing:-0.01em;margin:60px 0 8px">Enterprise license catalogue</h2>
    <p style="color:var(--ink-dim);font-size:15px;max-width:800px;margin:0 0 24px">Ten pre-packaged Anchor &amp; Topstone licenses for hyperscalers and Fortune 50.</p>
    <div id="entProductsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:22px;margin-bottom:50px"></div>
    <div id="entNegotiator" style="margin:40px 0"></div>
    <div id="entDeals" style="margin:40px 0 60px"></div>

    <section id="enterprise-contact" style="margin:60px 0 80px;padding:40px;border:1px solid rgba(255,211,106,.3);border-radius:14px;background:linear-gradient(180deg,rgba(255,211,106,.04),rgba(138,92,255,.04))">
      <h2 style="font-size:32px;letter-spacing:-0.01em;margin:0 0 6px;background:linear-gradient(135deg,#ffd36a 0%,#8a5cff 100%);-webkit-background-clip:text;background-clip:text;color:transparent">Contact Enterprise Sales</h2>
      <p style="color:var(--ink-dim);font-size:15px;max-width:700px;margin:0 0 24px">Tell us about your scale, your stack, and what you need to ship. We reply within <b style="color:#fff">24 hours</b>. For procurement &amp; legal, ask for the deal-desk packet.</p>
      <form id="entContactForm" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:760px" novalidate>
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
  <span class="kicker">Crypto Bridge Suite</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Crypto ↔ Fiat intelligence, <span class="grad">non-custodial by design.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7;max-width:860px">ZeusAI computes optimal routing, fees and risk checks for crypto transfer workflows without ever holding funds. The platform only returns signed recommendations and owner-routed fee invoices.</p>

  <div class="grid" id="cbCards" style="margin-top:22px"><div class="card" style="padding:18px"><p>Loading services…</p></div></div>

  <div class="card" style="margin-top:22px;padding:18px">
    <span class="tag">Live BTC rate</span>
    <h3 id="cbRate" style="margin:8px 0">$…</h3>
    <p id="cbRateMeta" style="color:var(--ink-dim);font-size:13px;margin:0">Fetching live source…</p>
  </div>

  <div class="card" style="margin-top:22px;padding:18px">
    <h3 style="margin:0 0 8px">API endpoints</h3>
    <ul style="margin:0;padding-left:18px;color:var(--ink-dim);line-height:1.8">
      <li><code class="inline">GET /api/crypto-bridge/services</code></li>
      <li><code class="inline">GET /api/crypto-bridge/btc-rate</code></li>
      <li><code class="inline">POST /api/crypto-bridge/smart-routing</code></li>
      <li><code class="inline">GET /api/crypto-bridge/health</code></li>
    </ul>
  </div>

  <script>
  (async function(){
    try {
      const servicesResp = await fetch('/api/crypto-bridge/services');
      const servicesJson = await servicesResp.json();
      const services = Array.isArray(servicesJson && servicesJson.services) ? servicesJson.services : [];
      const host = document.getElementById('cbCards');
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
    } catch(_) {}

    try {
      const rateResp = await fetch('/api/crypto-bridge/btc-rate');
      const rateJson = await rateResp.json();
      var rate = Number(rateJson && (rateJson.rate || rateJson.usd || 0));
      if (rate > 0) {
        var rateEl = document.getElementById('cbRate');
        if (rateEl) rateEl.textContent = '$' + rate.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      var meta = document.getElementById('cbRateMeta');
      if (meta) meta.textContent = 'Source: ' + ((rateJson && rateJson.source) || 'unknown') + ' · updated now';
    } catch(_) {}
  })();
  </script>
</section>`;
}

function renderRoute(route, params = {}) {
  switch (route) {
    case '/': return pageHome();
    case '/services': return pageServices();
    case '/pricing': return pagePricing();
    case '/checkout': return pageCheckout();
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
    case '/account': return pageAccount();
    case '/auth': return pageAccount();
    case '/login': return pageAccount();
    case '/signup': return pageAccount();
    case '/admin/services': return pageAdminServices();
    case '/admin': return pageAdminLogin();
    case '/admin/login': return pageAdminLogin();
    case '/wizard': return pageWizard();
    case '/status': return pageStatus();
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
    case '/marketplace': return pageServices();
    default:
      if (route.startsWith('/services/')) return pageService(params.id || route.slice(10));
      return pageNotFound(route);
  }
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
    <div id="admSvcList" style="display:grid;gap:10px">Loading…</div>
  </div>
</section>`;
}

function pageInnovations() {
  return `<section class="section">
  <div class="container">
    <h1 class="h1">Live Innovation Coverage</h1>
    <p class="lead" style="max-width:880px">Innovation map for the live Unicorn: cryptographic durability, sovereign primitives and production coverage from <code class="inline">/api/innovation/coverage</code>, plus the 30-year proof layer below.</p>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:22px 0">
      <div class="card" style="padding:18px"><span class="tag">Coverage API</span><h3>Live coverage</h3><p style="color:var(--ink-dim);font-size:13.5px">Runtime coverage summary for recent innovations and deployed modules.</p><a href="/api/innovation/coverage" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Forward-only</span><h3>No downgrade path</h3><p style="color:var(--ink-dim);font-size:13.5px">Every accepted innovation must pass canary, QIS and final smoke before promotion.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Live site</span><h3>Innovation map</h3><p style="color:var(--ink-dim);font-size:13.5px">This page is the visible map for what changed and where to verify it.</p></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:22px 0">
      <div class="card" style="padding:18px"><span class="tag">Constitution</span><h3 id="invConHash" style="margin:8px 0;font-family:monospace">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public, hashed, signed. Every response carries <code class="inline">X-Constitution-Hash</code>.</p><a href="/api/constitution" target="_blank" rel="noopener" class="btn" style="margin-top:8px">View JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Today's Merkle root</span><h3 id="invRoot" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px"><span id="invRootCount">0</span> receipts · OP_RETURN-ready · published daily</p><a href="/api/receipts/root" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">BTC TWAP (5-source median)</span><h3 id="invTwap" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Kraken · Coinbase · Bitstamp · Binance · OKX</p><a href="/api/btc/twap" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Quantum-safe signing</span><h3 style="margin:8px 0">Ed25519 + ML-DSA-65</h3><p style="color:var(--ink-dim);font-size:13.5px">FIPS 204 hybrid. 3309-byte PQ signature on every daily root.</p></div>
      <div class="card" style="padding:18px"><span class="tag">Reproducible SBOM</span><h3 id="invSbom" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">sha3-256 over critical sources · public composite hash</p><a href="/api/sbom" target="_blank" rel="noopener" class="btn" style="margin-top:8px">View JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Permanent archive manifest</span><h3 style="margin:8px 0">Archive snapshot</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily root + constitution + SBOM + PQ pubkey, ready for Archive.org / Arweave anchoring.</p><a href="/api/innovations/archive" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
    </div>

    <h2 id="zeus100y" style="margin-top:32px">100-year horizon · world-standard primitives <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 GET-only deterministic endpoints designed to remain a public web standard for 50+ years. Additive only · 5-year deprecation windows · zero rollback path. <a href="/api/v100/manifest" target="_blank" rel="noopener">Discovery manifest →</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">Long-term contract</span><h3 style="margin:8px 0">Civilization Protocol</h3><p style="color:var(--ink-dim);font-size:13.5px">Machine-readable migration contract: same URL, same shape, same semantics across 50+ years.</p><a href="/.well-known/civilization-protocol.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Operational rights</span><h3 style="margin:8px 0">AI Bill of Rights</h3><p style="color:var(--ink-dim);font-size:13.5px">10 enforceable rights: explain, appeal, portability, opt-out, provenance, equity, non-discrimination.</p><a href="/.well-known/ai-rights.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Interop</span><h3 style="margin:8px 0">Earth Standard</h3><p style="color:var(--ink-dim);font-size:13.5px">Time, identity, currency, energy, language, transport — minimal protocol any system can adopt.</p><a href="/.well-known/earth-standard.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Sovereign claim</span><h3 style="margin:8px 0">Zeus Attestation</h3><p style="color:var(--ink-dim);font-size:13.5px">Public commitment list, dual-track classical + post-quantum keys, yearly rotation.</p><a href="/.well-known/zeus-attestation.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">PQC roadmap</span><h3 style="margin:8px 0">Post-Quantum Readiness</h3><p style="color:var(--ink-dim);font-size:13.5px">Hybrid migration plan: ML-KEM-768 + ML-DSA-65 staged 2027-2030, no flag day.</p><a href="/api/v100/pq-readiness" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon-aware</span><h3 style="margin:8px 0">Carbon Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-request gCO₂ budget, X-Green-GCO2 advisory header, halve-by-2030, net-zero-by-2050.</p><a href="/api/v100/carbon-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Right-to-explain</span><h3 style="margin:8px 0">Decision Explainer</h3><p style="color:var(--ink-dim);font-size:13.5px">Plain-language explanation for any algorithmic decision via /api/v100/explain/:id.</p><a href="/api/v100/explain/sample" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Sample JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Sovereignty</span><h3 style="margin:8px 0">Data Sovereignty</h3><p style="color:var(--ink-dim);font-size:13.5px">User is sole owner. Export · delete · rectify · time-lock · transfer to successor origin.</p><a href="/api/v100/data-sovereignty" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Transparency proofs</span><h3 style="margin:8px 0">Time-Locked Anchors</h3><p style="color:var(--ink-dim);font-size:13.5px">Cryptographic time-locked attestations for any account event. Sample hash response.</p><a href="/api/v100/timelock/deadbeefcafebabe" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Sample JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Reversibility</span><h3 style="margin:8px 0">Reversibility Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public registry of which actions are reversible, the window, and the channel.</p><a href="/api/v100/reversibility-manifest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Universal schema</span><h3 style="margin:8px 0">Machine Ontology</h3><p style="color:var(--ink-dim);font-size:13.5px">JSON-LD types extending schema.org: Decision, Provenance, CarbonBudget, Right, Pledge.</p><a href="/api/v100/ontology" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Provenance root</span><h3 style="margin:8px 0">Build Merkle Root</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-build provenance hash, advertised via X-Zeus-Provenance on every response.</p><a href="/api/v100/provenance" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Equity</span><h3 style="margin:8px 0">Digital Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">Save-Data + reduced-motion honored. No feature gated by network speed, device class, geography.</p><a href="/api/v100/digital-equity" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">50-year pledge</span><h3 style="margin:8px 0">Longevity Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">No breaking change without 5-year deprecation window. Yearly archival mirror. Successor-key escrow.</p><a href="/api/v100/longevity-pledge" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">100Y Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 endpoints with stability tags and machine/human entry points.</p><a href="/api/v100/manifest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
    </div>

    <h2 id="zeusperf100y" style="margin-top:32px">Performance · 100-year horizon <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">13 GET-only deterministic endpoints codifying public performance budgets, composited-only animation, image / font / cache / preload / Early-Hints policies, and a 50-year performance pledge. Additive only · zero rollback path · machine + human discovery. <a href="/api/v100/perf/manifest" target="_blank" rel="noopener">Performance manifest →</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">Public budget</span><h3 style="margin:8px 0">Per-Route Perf Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">LCP/INP/CLS/TBT/FCP/TTFB hard-caps per route. Regression beyond cap rolls back within 24h.</p><a href="/.well-known/perf-budget.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Signed claim</span><h3 style="margin:8px 0">Web Vitals Attestation</h3><p style="color:var(--ink-dim);font-size:13.5px">Ed25519 + ML-DSA-65 hybrid signature on pledged Core Web Vitals. Yearly rotation.</p><a href="/.well-known/web-vitals-attestation.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Render path</span><h3 style="margin:8px 0">Render Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-page critical CSS/JS, SSR HTML target, hydration deadline. No JS before first paint.</p><a href="/api/v100/perf/render-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">DOM size</span><h3 style="margin:8px 0">DOM Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Total nodes / depth / max children hard-caps. Pre-deploy lint enforces.</p><a href="/api/v100/perf/dom-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Main thread</span><h3 style="margin:8px 0">Main-Thread Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Longest-task ≤100ms cap, TBT ≤400ms cap, ≤3 long-tasks per nav. Web Workers + scheduler.yield().</p><a href="/api/v100/perf/main-thread-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">GPU only</span><h3 style="margin:8px 0">Composited-Only Animations</h3><p style="color:var(--ink-dim);font-size:13.5px">Only opacity + transform animate. Forbidden: width/height/margin/font-size/box-shadow.</p><a href="/api/v100/perf/animation-policy" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Images</span><h3 style="margin:8px 0">Image Delivery Policy</h3><p style="color:var(--ink-dim);font-size:13.5px">Width+height locked, fetchpriority on LCP, AVIF primary, lazy below-the-fold.</p><a href="/api/v100/perf/image-policy" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Fonts</span><h3 style="margin:8px 0">Zero-Layout-Shift Fonts</h3><p style="color:var(--ink-dim);font-size:13.5px">font-display:swap + size-adjust + ascent-override. Self-hosted, &lt;30 KB per face.</p><a href="/api/v100/perf/font-policy" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Cache</span><h3 style="margin:8px 0">Immutable + SWR</h3><p style="color:var(--ink-dim);font-size:13.5px">Hashed assets immutable for 1y; HTML stale-while-revalidate. Never break a cached URL.</p><a href="/api/v100/perf/cache-policy" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Preload</span><h3 style="margin:8px 0">Early-Hints (103) Policy</h3><p style="color:var(--ink-dim);font-size:13.5px">≤4 critical resources preloaded per nav. preconnect + dns-prefetch tiers.</p><a href="/api/v100/perf/preload-policy" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon-aware</span><h3 style="margin:8px 0">Zero-Energy Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">≤0.05 gCO₂ per request. Halve by 2030, net-zero by 2050, negative by 2076.</p><a href="/api/v100/perf/zero-energy-pledge" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">50-year pledge</span><h3 style="margin:8px 0">Longevity Perf Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">No regression &gt;5% lands without same-day rollback plan. Tightening only, never loosening.</p><a href="/api/v100/perf/longevity-perf-pledge" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">Performance Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 13 perf endpoints with stability tags and entry points.</p><a href="/api/v100/perf/manifest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
    </div>

    <h2 id="zeusperf100yv2" style="margin-top:32px">Performance · 100Y v2 — visionary primitives <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 second-wave perf contracts with no public web standard equivalent today: causal render graph, frame budget at 60/120/240fps, energy-per-interaction (joules per click), latency equity map, p99/p999/p9999 tail caps, hydration cost manifest, perceptual quality index, anti-layout-thrash blacklist, predictability variance budget, signed perf+carbon joint receipts, INP attribution ledger. <a href="/api/v100/perf/v2/manifest" target="_blank" rel="noopener">v2 manifest →</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">DAG</span><h3 style="margin:8px 0">Causal Render Graph</h3><p style="color:var(--ink-dim);font-size:13.5px">Public DAG of every blocking edge from HTML → LCP. No W3C equivalent today.</p><a href="/api/v100/perf/v2/causal-render-graph" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">High-fps</span><h3 style="margin:8px 0">Frame Budget Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-frame CPU + style + layout + paint budgets at 60 / 120 / 240 fps. Signed.</p><a href="/api/v100/perf/v2/frame-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">New metric</span><h3 style="margin:8px 0">Energy-per-Interaction</h3><p style="color:var(--ink-dim);font-size:13.5px">Joules per click — brand-new sustainability metric paired with INP. Halve by 2030.</p><a href="/api/v100/perf/v2/energy-per-interaction" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Equity</span><h3 style="margin:8px 0">Latency Equity Map</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-region + per-device targets. maxRegion/medianRegion ≤ 2.0 — digital justice.</p><a href="/api/v100/perf/v2/latency-equity-map" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Long tail</span><h3 style="margin:8px 0">Tail Latency Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Hard caps on p99 / p999 / p9999, not just p75. Hedged requests + tail-aware LB.</p><a href="/api/v100/perf/v2/tail-latency-pledge" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Post-deploy</span><h3 style="margin:8px 0">Cold-Start Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">First-request TTFB after every deploy/restart. Pipeline blocks if hardCap exceeded.</p><a href="/api/v100/perf/v2/cold-start-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">SSR + hydrate</span><h3 style="margin:8px 0">Hydration Cost Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public ms+KB cost per interactive component. Cumulative ≤50ms in first second.</p><a href="/api/v100/perf/v2/hydration-cost" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Adaptive</span><h3 style="margin:8px 0">Network Adaptivity Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">Declarative degradation matrix per ECT × Save-Data. No paid feature gated by speed.</p><a href="/api/v100/perf/v2/network-adaptivity" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Beyond CWV</span><h3 style="margin:8px 0">Perceptual Quality Index</h3><p style="color:var(--ink-dim);font-size:13.5px">Composite of jitter, scroll smoothness, motion-photon latency, AV sync. Target PQI ≥ 90.</p><a href="/api/v100/perf/v2/perceptual-quality" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">No reflow</span><h3 style="margin:8px 0">Anti-Layout-Thrash Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Public blacklist of forced-reflow APIs with measured cost + approved alternatives.</p><a href="/api/v100/perf/v2/anti-layout-thrash" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Variance</span><h3 style="margin:8px 0">Predictability Index</h3><p style="color:var(--ink-dim);font-size:13.5px">Coefficient-of-variation budget per metric. Consistency matters as much as speed.</p><a href="/api/v100/perf/v2/predictability-index" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Byte cap</span><h3 style="margin:8px 0">Critical-Path Diet</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed total byte budget for first contentful paint. May only shrink for 50 years.</p><a href="/api/v100/perf/v2/critical-path-diet" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Pre-render</span><h3 style="margin:8px 0">Speculative Render Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Public list of routes + triggers + privacy trade-offs. Suppressed under Save-Data.</p><a href="/api/v100/perf/v2/speculative-render" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Joint proof</span><h3 style="margin:8px 0">Perf + Carbon Receipt</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-request signed receipt fusing TTFB / LCP / INP with measured gCO₂ + grid intensity.</p><a href="/api/v100/perf/v2/joint-receipt" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">INP audit</span><h3 style="margin:8px 0">INP Attribution Ledger</h3><p style="color:var(--ink-dim);font-size:13.5px">Public, signed, per-interaction breakdown: which script, which handler, which long task.</p><a href="/api/v100/perf/v2/inp-attribution" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">v2 Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 second-wave primitives with novelty notes vs current standards.</p><a href="/api/v100/perf/v2/manifest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
    </div>

    <h2 id="zeusperf100yv3" style="margin-top:32px">Performance · 100Y v3 — 50-year web standard <span class="tag" style="vertical-align:middle">2076</span></h2>
    <p class="lead" style="max-width:880px;font-size:14.5px">15 third-wave contracts that turn zeusai.pro into a public web standard for the next 50 years: semantic stability pact, accessibility equity ledger, cognitive load budget, anti-dark-patterns receipt, data minimization proof, offline-first pledge, time-to-meaningful-content (TTMC), interop contract, content provenance chain (anti-AI-slop), zero-knowledge telemetry, graceful degradation matrix, mobile-parity pact, viewport equity, touch-target equity, battery-impact budget. <a href="/api/v100/perf/v3/manifest" target="_blank" rel="noopener">v3 manifest →</a></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0 22px">
      <div class="card" style="padding:18px"><span class="tag">50y semantic</span><h3 style="margin:8px 0">Semantic Stability Pact</h3><p style="color:var(--ink-dim);font-size:13.5px">Landmarks, headings (max h3), ARIA roles &amp; microdata pinned for 50 years. Future scrapers can rely on it.</p><a href="/api/v100/perf/v3/semantic-stability-pact" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Beyond WCAG</span><h3 style="margin:8px 0">Accessibility Equity Ledger</h3><p style="color:var(--ink-dim);font-size:13.5px">Per-disability-class TTI &amp; parity ratio. No class shall be &gt;10% slower than baseline.</p><a href="/api/v100/perf/v3/accessibility-equity-ledger" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">New metric</span><h3 style="margin:8px 0">Cognitive Load Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Reading grade ≤9, ≤5 decisions/screen, ≤8% jargon. Cognitive accessibility codified.</p><a href="/api/v100/perf/v3/cognitive-load-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">No dark UX</span><h3 style="margin:8px 0">Attention-Economy Receipt</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed declaration: no roach-motel, no confirmshaming, no privacy-zuckering. Per release.</p><a href="/api/v100/perf/v3/attention-economy-receipt" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Minimal bytes</span><h3 style="margin:8px 0">Data-Minimization Proof</h3><p style="color:var(--ink-dim);font-size:13.5px">Bytes-shipped : bytes-strictly-needed ratio published. Cap ≤ 1.5×.</p><a href="/api/v100/perf/v3/data-minimization-proof" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Offline</span><h3 style="margin:8px 0">Offline-First Pledge</h3><p style="color:var(--ink-dim);font-size:13.5px">Every public surface has a documented offline contract. No more white screens.</p><a href="/api/v100/perf/v3/offline-first-pledge" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Post-LCP</span><h3 style="margin:8px 0">Time-To-Meaningful-Content</h3><p style="color:var(--ink-dim);font-size:13.5px">TTMC: paint + no-CLS + interactive + alt-text resolved. p75 ≤ 1.8s.</p><a href="/api/v100/perf/v3/time-to-meaningful-content" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Forward compat</span><h3 style="margin:8px 0">Interop Contract</h3><p style="color:var(--ink-dim);font-size:13.5px">36-month sunset grace, parallel /v(N+1)/, Sunset/Deprecation/successor-version headers.</p><a href="/api/v100/perf/v3/interop-contract" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Anti-AI-slop</span><h3 style="margin:8px 0">Content Provenance Chain</h3><p style="color:var(--ink-dim);font-size:13.5px">Every text/image declares origin: human / ai-assisted / ai-generated / syndicated. Signed.</p><a href="/api/v100/perf/v3/content-provenance-chain" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Privacy</span><h3 style="margin:8px 0">Zero-Knowledge Telemetry</h3><p style="color:var(--ink-dim);font-size:13.5px">k-anonymity ≥ 50, ε ≤ 1.0 differential privacy, no IP retention. Performance observable, users not.</p><a href="/api/v100/perf/v3/zero-knowledge-telemetry" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Fallback map</span><h3 style="margin:8px 0">Graceful Degradation Matrix</h3><p style="color:var(--ink-dim);font-size:13.5px">Every modern feature mapped to its documented fallback. Lynx-compatible HTML+forms.</p><a href="/api/v100/perf/v3/graceful-degradation-matrix" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Mobile ≡ Desktop</span><h3 style="margin:8px 0">Mobile-Parity Pact</h3><p style="color:var(--ink-dim);font-size:13.5px">Every desktop CTA reachable on mobile. p75 LCP/INP delta caps. Forbids desktop-only features.</p><a href="/api/v100/perf/v3/mobile-parity-pact" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Per viewport</span><h3 style="margin:8px 0">Viewport Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">320px feature phone is first-class. p75 LCP/INP committed per viewport class.</p><a href="/api/v100/perf/v3/viewport-equity" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">WCAG 2.5.5++</span><h3 style="margin:8px 0">Touch-Target Equity</h3><p style="color:var(--ink-dim);font-size:13.5px">Min 44×44 px target, 8 px spacing, 56 px for critical actions. Build-time enforced.</p><a href="/api/v100/perf/v3/touch-target-equity" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Battery</span><h3 style="margin:8px 0">Battery-Impact Budget</h3><p style="color:var(--ink-dim);font-size:13.5px">Median session ≤ 8 mWh. 5 min ≤ 0.05% of a 4000 mAh battery. Pause-on-hide.</p><a href="/api/v100/perf/v3/battery-impact-budget" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Discovery</span><h3 style="margin:8px 0">v3 Manifest</h3><p style="color:var(--ink-dim);font-size:13.5px">Single index of all 15 third-wave 50-year-standard primitives.</p><a href="/api/v100/perf/v3/manifest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
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
      <div class="card" style="padding:18px"><span class="tag">DID Document</span><h3 style="margin:8px 0;font-size:15px">did:web:zeusai.pro</h3><p style="color:var(--ink-dim);font-size:13.5px">W3C-compliant decentralized identity at <code class="inline">/.well-known/did.json</code></p><a href="/.well-known/did.json" target="_blank" rel="noopener" class="btn" style="margin-top:8px">View JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Compliance attestation</span><h3 id="invCompHash" style="margin:8px 0;font-family:monospace;font-size:14px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">GDPR · SOC2 · ISO27001 self-attestation, hashed + signed</p><a href="/api/compliance/attestation" target="_blank" rel="noopener" class="btn" style="margin-top:8px">View JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Carbon ledger</span><h3 id="invCarbon" style="margin:8px 0;font-size:18px">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Daily attestations, signed gCO₂ entries</p><a href="/api/v2/carbon/attest" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Bug bounty</span><h3 id="invBounty" style="margin:8px 0">$…</h3><p style="color:var(--ink-dim);font-size:13.5px">Public open-bounty escrow ledger</p><a href="/api/v2/bounty/total" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">Relay descriptor</span><h3 style="margin:8px 0;font-size:15px">HTTPS · Tor · Nostr · IPFS</h3><p style="color:var(--ink-dim);font-size:13.5px">Censorship-resistant transports advertised publicly</p><a href="/api/v2/relay" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">VRF · VDF</span><h3 style="margin:8px 0;font-size:15px">Provable randomness &amp; time-locks</h3><p style="color:var(--ink-dim);font-size:13.5px">HMAC-VRF for fair lotteries · iterated-SHA256 VDF for sealed reveals</p></div>
      <div class="card" style="padding:18px"><span class="tag">DR drills</span><h3 id="invDR" style="margin:8px 0">…</h3><p style="color:var(--ink-dim);font-size:13.5px">Signed disaster-recovery drill ledger</p><a href="/api/v2/dr/list" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
      <div class="card" style="padding:18px"><span class="tag">v2 Status</span><h3 style="margin:8px 0;font-size:15px">15 primitives · 28 endpoints</h3><p style="color:var(--ink-dim);font-size:13.5px">Full feature inventory + counters</p><a href="/api/v2/status" target="_blank" rel="noopener" class="btn" style="margin-top:8px">Open JSON</a></div>
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
    try { const ca = await (await fetch('/api/compliance/attestation')).json(); $('invCompHash').textContent = (ca.hash||'').slice(0,24)+'…'; } catch(e) {}
    try { const co = await (await fetch('/api/v2/carbon/attest')).json(); $('invCarbon').textContent = (co.totalGCO2||0).toFixed(4)+' gCO₂ today'; } catch(e) {}
    try { const bt = await (await fetch('/api/v2/bounty/total')).json(); $('invBounty').textContent = '$'+(bt.totalUsd||0).toLocaleString()+' · '+(bt.open||0)+' open'; } catch(e) {}
    try { const dr = await (await fetch('/api/v2/dr/list')).json(); $('invDR').textContent = (dr.count||0)+' drill'+(dr.count===1?'':'s')+(dr.last ? ' · last RTO '+dr.last.rtoSeconds+'s' : ''); } catch(e) {}
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

function pageStatus() {
  return `<section style="padding-top:140px;max-width:1100px">
  <span class="kicker">Live status</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Live Unicorn Status · <span id="stHeadline" class="grad">operational.</span></h1>
  <p style="color:var(--ink-dim);font-size:15px">Live API is protecting the site: health, QIS, catalog and checkout checks are refreshed from production endpoints. Source: <code class="inline">/api/status</code>. Refreshes every 15s.</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px">
    <div class="card"><span class="tag">Deploy</span><h3>Forward-only</h3><p style="color:var(--ink-dim)">Canary + smoke guarded.</p></div>
    <div class="card"><span class="tag">Integrity</span><h3>QIS guarded</h3><p style="color:var(--ink-dim)">Quantum Integrity Shield checked live.</p></div>
    <div class="card"><span class="tag">Commerce</span><h3>Catalog + BTC</h3><p style="color:var(--ink-dim)">Checkout path remains monitored.</p></div>
  </div>
  <div class="grid" id="stGrid" style="margin-top:22px"><div class="card"><p>Loading…</p></div></div>
  <div class="card" style="margin-top:22px;padding:22px"><span class="kicker">90-day uptime</span><h2 id="stUptime" style="margin:8px 0">—</h2><p style="color:var(--ink-dim)">Synthetic checks every 60s. Incidents publicly sealed (commit-reveal).</p><a class="btn" href="/api/incidents" target="_blank">Public incident log</a></div>
  <script>
  async function loadStatus(){
    try { const d = await (await fetch('/api/status')).json();
      document.getElementById('stHeadline').textContent = d.overall + '.';
      document.getElementById('stUptime').textContent = d.uptime90d + '%';
      document.getElementById('stGrid').innerHTML = d.components.map(c => '<div class="card"><span class="tag" style="background:rgba(59,255,176,.15);color:#3bffb0">'+c.status+'</span><h3>'+c.name+'</h3><p style="color:var(--ink-dim)">Latency: <b>'+c.latencyMs+'ms</b></p></div>').join('');
    } catch(e) {}
  }
  loadStatus(); setInterval(loadStatus, 15000);
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
</section>`;
}

function pageTerms()   { return _legalSub('Terms of Service', 'By using ZeusAI you agree that all outputs, telemetry and receipts are honestly generated and routed to the owner. You agree not to bypass capability tokens, forge signatures, or exploit the autonomy chain. Service is provided as-is with the SLA at /sla and refund guarantee at /refund.'); }
function pagePrivacy() { return _legalSub('Privacy Policy', 'We store the minimum data necessary: email (activation), plan, receipts. No selling, no sharing, no model training on personal data. GDPR rights honoured at /api/privacy/dsr. Cryptographic receipts are append-only and owner-owned. Sub-processors disclosed at /api/compliance/attestation.'); }
function pageRefund()  { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Refund Guarantee · F1</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Cryptographic <span class="grad">refund guarantee.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">If we fail you, the system refunds itself. Below: live, signed promise. If breached, an autonomous compensator emits a signed REFUND_INTENT and the revenue router reverses the matching receipt within 24h.</p>
  <pre class="code" id="rfOut" style="margin-top:18px">Signed promise will appear here.</pre>
  <script>
  fetch('/api/refund/guarantee').then(r=>r.json()).then(d=>{
    const out = document.getElementById('rfOut');
    if (!out) return;
    const mode = d && (d.mode || d.status || 'active');
    const windowH = d && (d.refundWindowHours || d.windowHours || 24);
    const sig = d && d.signature ? String(d.signature).slice(0,18)+'…' : 'n/a';
    out.textContent = 'Mode: '+mode+'\nRefund window: '+windowH+'h\nSignature: '+sig;
  }).catch(()=>{});
  </script>
</section>`; }
function pageSla() { return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Service Level Agreement</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 22px">SLA · <span class="grad">99.99% sovereign.</span></h1>
  <ul style="color:var(--ink-dim);font-size:15.5px;line-height:1.9;padding-left:20px">
    <li><b style="color:#fff">Uptime</b> · 99.99% target for /api · 99.9% for /</li>
    <li><b style="color:#fff">Latency</b> · p95 &lt; 800ms global, p99 &lt; 1500ms</li>
    <li><b style="color:#fff">Receipt</b> · every API call &lt; 60s eligible for inclusion in the next signed Merkle root</li>
    <li><b style="color:#fff">Incident disclosure</b> · &lt; 72h public, sealed at /api/incidents</li>
    <li><b style="color:#fff">Refund</b> · auto on breach (see /refund)</li>
  </ul>
  <a class="btn btn-primary" href="/status" data-link>Live status →</a>
</section>`; }

function pagePledge() {
  return `<section style="padding-top:140px;max-width:980px">
  <span class="kicker">Anti-Dark-Pattern Pledge · F9</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Public, signed, <span class="grad">self-enforcing.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No fake scarcity. No forced accounts. No drip pricing. No retention dark patterns. No selling your data. One-click cancel at <a href="/cancel" data-link>/cancel</a>. The pledge below is signed Ed25519 — anyone can verify. On confirmed breach, an INCIDENT is publicly sealed.</p>
  <pre class="code" id="plOut" style="margin-top:18px">Pledge summary will appear here.</pre>
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
    const principles = Array.isArray(d && d.principles) ? d.principles.slice(0,4) : [];
    const sig = d && d.signature ? String(d.signature).slice(0,18)+'…' : 'n/a';
    out.textContent = 'Pledge active\nPrinciples: '+(principles.length ? principles.join(' | ') : 'available')+'\nSignature: '+sig;
  });
  document.getElementById('prBtn').addEventListener('click', async () => {
    const email = document.getElementById('prEmail').value;
    const evidence = document.getElementById('prEv').value;
    const r = await fetch('/api/pledge/report', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, evidence }) });
    const d = await r.json();
    document.getElementById('prOut').textContent = d.ok ? 'Recorded · '+d.id : 'Error';
  });
  </script>
</section>`;
}

function pageCancel() {
  return `<section style="padding-top:140px;max-width:680px">
  <span class="kicker">Universal Cancel · F10</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">One click. <span class="grad">Everything cancels.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No friction. No "are you sure". No retention chat-bot. Type your email — every active subscription is cancelled within 60 seconds. You receive a signed cryptographic confirmation by email.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Email on account</label><input id="cnEmail" type="email" placeholder="you@company.com"></div>
    <div class="field"><label>Reason (optional)</label><input id="cnReason" placeholder="moving on, no hard feelings"></div>
    <button class="btn btn-primary" id="cnBtn" style="width:100%;justify-content:center">Cancel everything · 1 click</button>
    <div id="cnOut" style="margin-top:14px;color:var(--ink-dim);font-size:13.5px"></div>
  </div>
  <script>
  document.getElementById('cnBtn').addEventListener('click', async () => {
    const email = document.getElementById('cnEmail').value;
    const reason = document.getElementById('cnReason').value;
    const r = await fetch('/api/cancel/universal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, reason }) });
    const d = await r.json();
    const sig = d && d.signature ? String(d.signature).slice(0,22)+'…' : '';
    document.getElementById('cnOut').innerHTML = d.ok
      ? '<b style="color:#3bffb0">✓ '+d.message+'</b>' + (sig ? '<br><small style="font-family:var(--mono);font-size:11px">sig '+sig+'</small>' : '')
      : '<b style="color:var(--danger)">Error</b>';
  });
  </script>
</section>`;
}

function pageGift() {
  return `<section style="padding-top:140px;max-width:880px">
  <span class="kicker">Gift-as-Capability · F8</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Send ZeusAI as a <span class="grad">cryptographic gift.</span></h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">No account required for the recipient. They click your link, redeem the signed capability, get the service activated.</p>
  <div class="card" style="padding:24px;margin-top:18px">
    <div class="field"><label>Service / SKU</label><input id="gtSku" value="adaptive-ai"></div>
    <div class="field"><label>Value (USD)</label><input id="gtVal" type="number" value=""></div>
    <div class="field"><label>From email</label><input id="gtFrom" type="email"></div>
    <div class="field"><label>To email (optional)</label><input id="gtTo" type="email"></div>
    <div class="field"><label>Message</label><input id="gtMsg" placeholder="Use ZeusAI on me 🎁"></div>
    <button class="btn btn-primary" id="gtBtn" style="width:100%;justify-content:center">Mint signed gift →</button>
    <div id="gtOut" style="margin-top:14px"></div>
  </div>
  <script>
  document.getElementById('gtBtn').addEventListener('click', async () => {
    const payload = {
      sku: document.getElementById('gtSku').value,
      valueUsd: Number(document.getElementById('gtVal').value)||0,
      fromEmail: document.getElementById('gtFrom').value,
      toEmail: document.getElementById('gtTo').value,
      message: document.getElementById('gtMsg').value
    };
    const r = await fetch('/api/gift/mint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const d = await r.json();
    document.getElementById('gtOut').innerHTML = '<div class="card" style="border-color:var(--violet)"><h3>'+d.code+'</h3><p style="color:var(--ink-dim)">Share this URL: <code class="inline">'+location.origin+d.redeemUrl+'</code></p><p style="color:var(--ink-dim);font-size:12px">Signed at '+d.mintedAt+'</p></div>';
  });
  </script>
</section>`;
}

function pageAura() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">Live Conversion Aura · F2</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">The <span class="grad">heartbeat</span> of ZeusAI.</h1>
  <p style="color:var(--ink-dim);font-size:16px;line-height:1.7">Every metric below is fetched from <code class="inline">/api/aura</code>, signed Ed25519 at the moment of generation. No mocks, no inflation.</p>
  <div class="grid" id="auraGrid" style="margin-top:22px"><div class="card"><p>Live metrics will appear here.</p></div></div>
  <pre class="code" id="auraRaw" style="margin-top:18px;max-height:280px;overflow:auto">…</pre>
  <script>
  async function loadAura(){
    const d = await (await fetch('/api/aura')).json();
    const sig = d && d.signature ? String(d.signature).slice(0,24)+'…' : 'n/a';
    document.getElementById('auraRaw').textContent = 'Updated: '+(d.generatedAt||new Date().toISOString())+' · signature: '+sig;
    const m = d.metrics;
    document.getElementById('auraGrid').innerHTML = [
      ['Orders total', m.ordersTotal],
      ['Orders 24h', m.ordersLast24h],
      ['Leads total', m.leadsTotal],
      ['GMV USD', '$'+(m.gmvUsd||0).toLocaleString()],
      ['Newsletter', m.newsletter]
    ].map(([k,v])=>'<div class="card"><span class="tag">'+k+'</span><h2 style="margin:8px 0">'+v+'</h2></div>').join('');
  }
  loadAura(); setInterval(loadAura, 5000);
  </script>
</section>`;
}

function pageApiExplorer() {
  return `<section style="padding-top:140px;max-width:1080px">
  <span class="kicker">API Explorer</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Try every <span class="grad">endpoint</span> live.</h1>
  <p style="color:var(--ink-dim);font-size:15px">OpenAPI 3.1 spec at <a href="/openapi.json" target="_blank">/openapi.json</a>. Below is the live endpoint inventory.</p>
  <div id="apiList" class="card" style="padding:22px;margin-top:18px;font-family:var(--mono);font-size:13px;line-height:1.9;max-height:80vh;overflow:auto">Endpoint inventory will appear here.</div>
  <script>
  fetch('/openapi.json').then(r=>r.json()).then(d=>{
    const rows = Object.entries(d.paths).map(([p,ops])=>{
      const ms = Object.keys(ops).map(m=>'<code class="inline" style="text-transform:uppercase">'+m+'</code>').join(' ');
      return '<div style="padding:6px 0;border-bottom:1px solid var(--stroke)">'+ms+' <a href="'+p+'" target="_blank" style="color:var(--violet2)">'+p+'</a> <span style="color:var(--ink-dim);font-size:12px">'+ (Object.values(ops)[0].summary || '') +'</span></div>';
    });
    document.getElementById('apiList').innerHTML = rows.join('');
  });
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
  });
  </script>
</section>`;
}

function pageFrontier() {
  return `<section style="padding-top:140px;max-width:1280px">
  <span class="kicker">Frontier · 12 sovereign inventions</span>
  <h1 style="font-size:clamp(34px,4.4vw,56px);margin:10px 0 18px">Things the web <span class="grad">didn't have</span> until today.</h1>
  <div class="grid" style="margin-top:22px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
    <div class="card"><span class="tag">F1</span><h3>Crypto Refund Guarantee</h3><p>Self-executing SLA. If breached, refund auto-issues.</p><a class="btn" href="/refund" data-link>Open</a></div>
    <div class="card"><span class="tag">F2</span><h3>Live Conversion Aura</h3><p>Real-time, signed, public KPI heartbeat.</p><a class="btn" href="/aura" data-link>Open</a></div>
    <div class="card"><span class="tag">F3</span><h3>Outcome-Anchored Pricing</h3><p>Signed before/after deltas → auto-bps invoice.</p><a class="btn" href="/api/outcome/list" target="_blank">JSON</a></div>
    <div class="card"><span class="tag">F4</span><h3>Self-Healing Checkout Cascade</h3><p>BTC → Lightning → Stripe → PayPal → Wire.</p><a class="btn" href="/checkout" data-link>Try</a></div>
    <div class="card"><span class="tag">F5</span><h3>Time-Locked Discount Vault</h3><p>VDF-anchored "wait N s, get X% off".</p></div>
    <div class="card"><span class="tag">F6</span><h3>Sovereign Receipt NFT</h3><p>Portable, dual-signed proof. Verifiable offline.</p></div>
    <div class="card"><span class="tag">F7</span><h3>Provable Email Delivery</h3><p>Signed manifest + Merkle inclusion proof.</p></div>
    <div class="card"><span class="tag">F8</span><h3>Gift-as-Capability</h3><p>Send a CBAT to anyone. No account needed.</p><a class="btn" href="/gift" data-link>Mint</a></div>
    <div class="card"><span class="tag">F9</span><h3>Anti-Dark-Pattern Pledge</h3><p>Public, signed, self-enforcing.</p><a class="btn" href="/pledge" data-link>Open</a></div>
    <div class="card"><span class="tag">F10</span><h3>Universal Cancel Link</h3><p>One URL cancels everything.</p><a class="btn" href="/cancel" data-link>Open</a></div>
    <div class="card"><span class="tag">F11</span><h3>Public Bandit Transparency</h3><p>You see every price experiment.</p><a class="btn" href="/transparency" data-link>Open</a></div>
    <div class="card"><span class="tag">F12</span><h3>Carbon-Inclusive Checkout</h3><p>Auto-attached signed gCO₂ + offset.</p></div>
  </div>
  <pre class="code" id="frOut" style="margin-top:22px;max-height:340px;overflow:auto">Frontier status will appear here.</pre>
  <script>
  fetch('/api/frontier/status').then(r=>r.json()).then(d=>{
    const out = document.getElementById('frOut');
    if (!out) return;
    const inv = d && (d.inventions || d.items || []);
    const cnt = Array.isArray(inv) ? inv.length : (d && d.count) || 0;
    const mode = d && (d.mode || d.status || 'active');
    const updated = d && (d.generatedAt || d.updatedAt || new Date().toISOString());
    out.textContent = 'Frontier status: '+mode+'\nInventions available: '+cnt+'\nUpdated: '+updated;
  }).catch((e)=>{
    const out = document.getElementById('frOut');
    if (out) out.textContent = 'Frontier status unavailable: '+(e.message||e);
  });
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
  const map = { '/services':'Marketplace', '/marketplace':'Marketplace', '/pricing':'Pricing', '/checkout':'Checkout', '/dashboard':'Dashboard', '/how':'How it works', '/docs':'API & Docs', '/about':'About', '/legal':'Legal', '/trust':'Trust Center', '/security':'Security', '/responsible-ai':'Responsible AI', '/dpa':'Data Processing Agreement', '/payment-terms':'Payment Terms', '/operator':'Operator Console', '/observability':'Observability', '/enterprise':'Enterprise Licenses', '/store':'Instant Store', '/account':'Account', '/innovations':'30Y Cryptographic Durability', '/wizard':'Find my plan', '/status':'Live status', '/changelog':'Changelog', '/terms':'Terms of Service', '/privacy':'Privacy Policy', '/refund':'Refund Guarantee', '/sla':'SLA', '/pledge':'Anti-Dark-Pattern Pledge', '/cancel':'Universal Cancel', '/gift':'Gift-as-Capability', '/aura':'Live Conversion Aura', '/api-explorer':'API Explorer', '/transparency':'Pricing Bandit Transparency', '/frontier':'Frontier Inventions' };
  return map[route] || 'ZeusAI';
}

function routeDescription(route) {
  const map = {
    '/': 'ZeusAI is a sovereign autonomous AI operating system with signed outcomes, BTC-native commerce and self-healing automation.',
    '/services': 'Browse ZeusAI services, frontier inventions and vertical AI operating systems with instant BTC checkout.',
    '/pricing': 'Transparent ZeusAI pricing with signed receipts, BTC checkout, refund guarantees and enterprise licensing.',
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
    '/frontier': 'Frontier ZeusAI inventions: refund guarantee, live aura, self-healing checkout and verifiable receipts.'
  };
  return map[route] || 'ZeusAI sovereign AI operating system with verifiable commerce and autonomous delivery.';
}

function getHtml(route = '/', params = {}) {
  // Backward-compat: accept either getHtml(url) or getHtml(url, { lang, nonce })
  return head(routeTitle(route), route, params) + renderRoute(route, params) + footer(route, params);
}

module.exports = { getHtml, CSS, OWNER };
