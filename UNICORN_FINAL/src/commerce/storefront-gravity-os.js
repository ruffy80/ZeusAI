'use strict';

/**
 * Storefront Gravity OS — FDGP/1.0 First-Dollar Gravity Protocol
 *
 * Ranks the public catalog so a human sees a real self-serve SKU first.
 * Never invents paidHumans, GMV, visitors, or social reach. Billions still
 * require a real buyer + a confirmed settlement.
 */

const PROTOCOL = 'FDGP/1.0';
const DEFAULT_HERO_SKU = 'instant-resume-makeover';
const FIRST_DOLLAR_FLOOR_USD = 29;
const PUBLIC_URL = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';

const GHOST_METERED_IDS = new Set([
  'api-call',
  'free',
]);

const CONTACT_SHELF_IDS = new Set([
  'enterprise',
  'enterprise-tier',
  'global-giants',
  'sme',
  'mid-market',
  'wealth-engine',
  'legal-bot',
  'cloud-broker',
]);

const PUBLIC_SELF_SERVE_CORE_IDS = new Set([
  'starter',
  'pro',
  'ai-analysis',
  'data-export',
]);

function _buyability() {
  try { return require('./commerce-buyability'); } catch (_) { return null; }
}

function itemId(item) {
  if (!item) return '';
  if (typeof item === 'string') return item.trim();
  return String(item.id || item.serviceId || '').trim();
}

function itemPrice(item) {
  if (!item || typeof item !== 'object') return 0;
  const n = Number(
    item.priceUsd != null ? item.priceUsd
      : (item.priceUSD != null ? item.priceUSD
        : (item.price != null ? item.price : 0))
  );
  return Number.isFinite(n) ? n : 0;
}

function itemTier(item) {
  if (!item || typeof item !== 'object') return '';
  return String(item.tier || item.group || item.segment || item.category || '').trim().toLowerCase();
}

function isGhostMeteredItem(item) {
  const id = itemId(item);
  if (GHOST_METERED_IDS.has(id)) return true;
  const price = itemPrice(item);
  if (id === 'api-call' || (price > 0 && price < 1 && !/^instant-/i.test(id))) {
    return GHOST_METERED_IDS.has(id) || id === 'api-call';
  }
  return false;
}

function isContactShelf(item) {
  const id = itemId(item);
  if (CONTACT_SHELF_IDS.has(id)) return true;
  const tier = itemTier(item);
  if (tier === 'enterprise' || /^ent-/i.test(id)) return true;
  if (itemPrice(item) >= 5000) return true;
  return false;
}

function isInstantSelfServe(item) {
  const id = itemId(item);
  const tier = itemTier(item);
  if (/^instant-/i.test(id) || tier === 'instant') return itemPrice(item) >= FIRST_DOLLAR_FLOOR_USD;
  return false;
}

function rankBand(item) {
  const id = itemId(item);
  if (!id) return 90;
  if (isGhostMeteredItem(item)) return 80;
  if (id === DEFAULT_HERO_SKU) return 0;
  if (isInstantSelfServe(item)) return 10;
  if (PUBLIC_SELF_SERVE_CORE_IDS.has(id)) return 20;
  const tier = itemTier(item);
  if (/^professional-/i.test(id) || tier === 'professional') return 30;
  if (isContactShelf(item)) return 70;
  const buy = _buyability();
  if (buy && typeof buy.assessBuyability === 'function') {
    try {
      const a = buy.assessBuyability(item);
      if (a && a.buyable === true) return 40;
      if (a && a.mode === 'contact') return 70;
    } catch (_) { /* keep default band */ }
  }
  return 50;
}

function rankPublicCatalogItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  list.sort((a, b) => {
    const band = rankBand(a) - rankBand(b);
    if (band !== 0) return band;
    const pa = itemPrice(a);
    const pb = itemPrice(b);
    if (pa !== pb) return pa - pb;
    return itemId(a).localeCompare(itemId(b));
  });
  return list;
}

function filterStorefrontGhosts(items) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => !isGhostMeteredItem(item));
}

function applyStorefrontGravity(catalog, options = {}) {
  if (!catalog || typeof catalog !== 'object') return catalog;
  const includeSynthetic = options.includeSynthetic === true;
  let items = Array.isArray(catalog.items) ? catalog.items.slice() : [];
  if (!includeSynthetic) {
    items = filterStorefrontGhosts(items);
    items = rankPublicCatalogItems(items);
  }
  const cheapest = cheapestSelfServe(items);
  return {
    ...catalog,
    items,
    gravity: {
      protocol: PROTOCOL,
      inventsHumans: false,
      inventsGmv: false,
      defaultHeroSku: DEFAULT_HERO_SKU,
      cheapestSelfServeId: cheapest && cheapest.id ? cheapest.id : null,
      cheapestSelfServeUsd: cheapest ? itemPrice(cheapest) : null,
      ranked: !includeSynthetic,
      ghostsFiltered: includeSynthetic ? 0 : Math.max(0, (Array.isArray(catalog.items) ? catalog.items.length : 0) - items.length),
    },
  };
}

function pickHeroQuickPicks(items, limit = 6) {
  const ranked = rankPublicCatalogItems(filterStorefrontGhosts(items))
    .filter((p) => itemPrice(p) >= FIRST_DOLLAR_FLOOR_USD && !isContactShelf(p));
  const out = [];
  const seen = new Set();
  const hero = ranked.find((p) => itemId(p) === DEFAULT_HERO_SKU);
  if (hero) {
    out.push(hero);
    seen.add(DEFAULT_HERO_SKU);
  }
  for (const p of ranked) {
    if (out.length >= limit) break;
    const id = itemId(p);
    if (!id || seen.has(id)) continue;
    out.push(p);
    seen.add(id);
  }
  return out;
}

function cheapestSelfServe(items) {
  const picks = pickHeroQuickPicks(items, 1);
  return picks[0] || null;
}

function whyZeroRevenue(paidHumans) {
  const n = Number(paidHumans);
  if (Number.isFinite(n) && n > 0) {
    return {
      code: 'settlements_exist',
      message: n + ' confirmed paid human' + (n === 1 ? '' : 's') + '. GMV is only what those settlements paid.',
    };
  }
  return {
    code: 'no_confirmed_settlement',
    message: 'Zero revenue because no human has completed a confirmed payment. Catalog, BTC checkout, and delivery exist. Modules do not invent buyers or GMV.',
  };
}

function discovery(opts = {}) {
  let paidHumans = 0;
  let originOpen = true;
  try {
    const ogp = require('../../backend/modules/origin-gravity-os');
    const st = ogp.getStatus();
    paidHumans = Number(st && st.paidHumans) || 0;
    originOpen = st && st.originOpen !== false;
  } catch (_) { /* genesis unread */ }

  let cheapest = null;
  try {
    const unified = require('./unified-catalog');
    cheapest = cheapestSelfServe(unified.all() || []);
  } catch (_) { /* catalog optional */ }
  if (opts.items) cheapest = cheapestSelfServe(opts.items) || cheapest;

  const sku = cheapest && itemId(cheapest) ? itemId(cheapest) : DEFAULT_HERO_SKU;
  const usd = cheapest ? itemPrice(cheapest) : 39;
  const why = whyZeroRevenue(paidHumans);

  return {
    protocol: PROTOCOL,
    name: 'storefront-gravity-os',
    ok: true,
    inventsHumans: false,
    inventsGmv: false,
    inventsVisitors: false,
    paidHumans,
    originOpen,
    firstDollar: {
      serviceId: sku,
      title: (cheapest && (cheapest.title || cheapest.name)) || 'Instant Resume + LinkedIn Makeover',
      priceUsd: usd,
      buyUrl: PUBLIC_URL.replace(/\/$/, '') + '/checkout/?plan=' + encodeURIComponent(sku),
      page: '/first-dollar',
      rail: 'btc',
    },
    whyZero: why,
    nextHumanAction: paidHumans > 0
      ? 'Keep the same BTC checkout path. Additional rails need PayPal/NOWPayments/Stripe secrets in GitHub → PM2.'
      : 'Open /buy, pick the $' + usd + ' SKU, pay BTC to the owner wallet. Origin #1 mints only after on-chain confirmation.',
    generatedAt: new Date().toISOString(),
  };
}

function firstDollarHtml() {
  const d = discovery();
  const sku = d.firstDollar.serviceId;
  const usd = d.firstDollar.priceUsd;
  const why = d.whyZero.message;
  let head = `  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>First Dollar · ZeusAI</title>
  <meta name="description" content="Honest first-dollar path. paidHumans is never invented."/>
  <link rel="canonical" href="${PUBLIC_URL.replace(/\/$/, '')}/first-dollar"/>`;
  try {
    const wivp = require('./world-index-os');
    head = wivp.shareHead({
      title: 'First Dollar · ZeusAI',
      description: 'Honest first-dollar path. paidHumans is never invented. Cheapest self-serve SKU with live BTC checkout.',
      path: '/first-dollar',
      protocol: PROTOCOL,
    });
  } catch (_) { /* share head optional */ }
  return `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body style="margin:0;background:#07080f;color:#e8eef8;font:16px/1.55 system-ui,sans-serif">
  <main style="max-width:720px;margin:0 auto;padding:48px 20px 80px">
    <p style="letter-spacing:.12em;text-transform:uppercase;font-size:11px;color:#00e8a0">FDGP/1.0 · First-Dollar Gravity</p>
    <h1 style="font-size:clamp(28px,5vw,44px);line-height:1.1;margin:8px 0 12px">Revenue starts with one confirmed payment.</h1>
    <p style="color:#9aa6bd">${why}</p>
    <p style="font-family:ui-monospace,monospace;font-size:13px;color:#cdd6e4">paidHumans = <b style="color:#00ffa3">${d.paidHumans}</b> · cheapest self-serve = <b>$${usd}</b> · ${sku}</p>
    <p style="margin:28px 0">
      <a href="/checkout/?plan=${encodeURIComponent(sku)}" style="display:inline-block;background:linear-gradient(135deg,#00e8a0,#2de2e6);color:#05060e;font-weight:800;padding:14px 22px;border-radius:12px;text-decoration:none">Buy ${sku} · $${usd} BTC</a>
      <a href="/buy" style="display:inline-block;margin-left:10px;color:#2de2e6">All buyable SKUs →</a>
    </p>
    <ul style="color:#9aa6bd;padding-left:18px">
      <li>BTC to the owner wallet is live. PayPal / card / NOWPayments stay dark until those secrets are in GitHub → PM2.</li>
      <li>Facebook / X / TikTok ads and posts stay dark until gaze tokens exist. Telegram is an operator rail, not a public post.</li>
      <li>Unicorn modules do not mint GMV. Origin #1 is the first confirmed settlement.</li>
    </ul>
    <p style="font-size:13px;color:#7aa9ff"><a href="/.well-known/first-dollar.json" style="color:#7aa9ff">/.well-known/first-dollar.json</a> · <a href="/.well-known/origin-gravity.json" style="color:#7aa9ff">origin-gravity.json</a> · <a href="/visible-world" style="color:#7aa9ff">World Index</a></p>
  </main>
</body>
</html>`;
}

module.exports = {
  PROTOCOL,
  DEFAULT_HERO_SKU,
  FIRST_DOLLAR_FLOOR_USD,
  GHOST_METERED_IDS,
  CONTACT_SHELF_IDS,
  PUBLIC_SELF_SERVE_CORE_IDS,
  itemId,
  itemPrice,
  isGhostMeteredItem,
  isContactShelf,
  rankBand,
  rankPublicCatalogItems,
  filterStorefrontGhosts,
  applyStorefrontGravity,
  pickHeroQuickPicks,
  cheapestSelfServe,
  whyZeroRevenue,
  discovery,
  firstDollarHtml,
};
