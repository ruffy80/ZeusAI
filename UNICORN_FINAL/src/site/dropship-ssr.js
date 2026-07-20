// =====================================================================
// Dropship SSR helpers — first-paint catalog cards + PDP HTML + JSON-LD.
// Used by /dropship and /dropship/product/:id so the store is never blank
// before JS hydrates. Pure string builders (no DOM).
// =====================================================================
'use strict';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[c]);
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moneyMaybe(n) {
  return Number.isFinite(Number(n)) ? money(n) : '\u2014';
}

function coverFor(slug) {
  const s = String(slug || 'product').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
  return '/api/dropship/cover/' + encodeURIComponent(s) + '.svg';
}

function safeImage(url, slug) {
  url = String(url || '').trim();
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return escapeHtml(url);
  if (url.charAt(0) === '/' && url.indexOf('/api/dropship/') === 0) return escapeHtml(url);
  return coverFor(slug);
}

function sourceMode(p) {
  const source = String(p.source || '').toLowerCase();
  const supplier = String(p.supplier || '').toLowerCase();
  // LIVE only for real supplier rails — never demo / world-feed scrapers.
  const isWorldFeed = source.indexOf('world') !== -1
    || source.indexOf('dummyjson') !== -1
    || source.indexOf('fakestore') !== -1
    || source.indexOf('escuela') !== -1
    || supplier === 'world-feed';
  const liveSources = ['ebay', 'aliexpress', 'etsy', 'external', 'cj', 'cjdropshipping'];
  const live = p.demoOnly !== true && !isWorldFeed && (
    p.live === true ||
    p.sourceMode === 'live' ||
    liveSources.indexOf(source) !== -1 ||
    (supplier && supplier !== 'manual' && supplier !== 'unknown' && supplier !== 'world-feed')
  );
  return { label: live ? 'LIVE' : 'ZEUS-CURATED', live };
}

function fulfillBadge(p) {
  const mode = (p.delivery && p.delivery.mode) || '';
  const automated = p.delivery && p.delivery.automated === true;
  // Publisher uses cj-global-dropship; accept legacy global-dropship too.
  if (automated && (mode === 'cj-global-dropship' || mode === 'global-dropship')) {
    return { label: 'AUTO-FULFIL', cls: 'ds-badge-live' };
  }
  return { label: 'DESK-FULFIL', cls: '' };
}

function productCardHtml(p) {
  const mode = sourceMode(p);
  const fulfil = fulfillBadge(p);
  const slug = p.slug || p.id || p.title;
  const img = safeImage(p.image, slug);
  const fb = coverFor(slug);
  const margin = Math.max(0, Math.round(Number(p.marginPct) || 0));
  const pid = encodeURIComponent(p.id);
  const shelf = p.shelf && p.shelf.rank
    ? ('<span class="ds-badge ds-badge-shelf">SHELF #' + p.shelf.rank +
      (p.shelf.fitness != null ? (' \u00b7 ' + Math.round(Number(p.shelf.fitness))) : '') + '</span>')
    : '';
  return (
    '<article class="ds-product" data-ssr="1">' +
      '<a class="ds-media" href="/dropship/product/' + pid + '">' +
        '<span class="ds-media-fallback">' + escapeHtml(p.category || 'product') + '</span>' +
        (img
          ? '<img src="' + img + '" alt="' + escapeHtml(p.title || '') +
            '" loading="lazy" decoding="async" data-cover="' + escapeHtml(fb) +
            '" onerror="this.onerror=null;this.src=this.getAttribute(&quot;data-cover&quot;)||&quot;/api/dropship/cover/fallback.svg&quot;">'
          : '') +
      '</a>' +
      '<div class="ds-product-body">' +
        '<div class="ds-badges">' +
          '<span class="ds-badge ' + (mode.live ? 'ds-badge-live' : '') + '">' + mode.label + '</span>' +
          '<span class="ds-badge ' + fulfil.cls + '">' + fulfil.label + '</span>' +
          shelf +
          '<span class="ds-badge ds-badge-margin">Proof-of-Margin \u00b7 ' + margin + '% margin</span>' +
        '</div>' +
        '<a class="ds-product-title" href="/dropship/product/' + pid + '">' +
          escapeHtml(p.title || 'Untitled product') + '</a>' +
        '<div class="ds-product-price">' + money(p.priceUsd) + '</div>' +
        '<div class="ds-product-meta">' +
          '<a class="ds-detail-link" href="/dropship/product/' + pid + '">View details \u2192</a>' +
          '<button class="ds-buy" type="button" data-buy data-pid="' + escapeHtml(p.id) +
            '" data-title="' + escapeHtml(p.title || '') + '">Buy BTC</button>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

function productGridHtml(items) {
  if (!items || !items.length) {
    return '<div class="ds-empty" data-ds-boot="1">Preparing catalog\u2026</div>';
  }
  return items.map(productCardHtml).join('');
}

function relatedHtml(items) {
  if (!items || !items.length) return '';
  return (
    '<section class="ds-related" aria-label="Also margin-qualified">' +
      '<div class="ds-section-head" style="margin-bottom:18px">' +
        '<div><span class="ds-kicker">AOV lift</span><h2 style="font-size:28px">Also margin-qualified.</h2></div>' +
        '<p class="ds-section-note">Ranked by the same profit engine that listed this SKU.</p>' +
      '</div>' +
      '<div class="ds-product-grid">' + items.map(productCardHtml).join('') + '</div>' +
    '</section>'
  );
}

function productPdpHtml(p, compare, related) {
  const mode = sourceMode(p);
  const fulfil = fulfillBadge(p);
  const slug = p.slug || p.id || p.title;
  const img = safeImage(p.image, slug);
  const fb = coverFor(slug);
  const price = Number(p.priceUsd) || 0;
  const proof = p.proofOfMargin || {};
  const cost = Number(p.costUsd != null ? p.costUsd : proof.costUsd);
  const shipping = Number(p.shippingUsd != null ? p.shippingUsd : proof.shippingUsd);
  const profit = Number(p.netProfitUsd != null ? p.netProfitUsd : proof.netProfitUsd);
  const overhead = Number.isFinite(Number(proof.feeUsd))
    ? Number(proof.feeUsd)
    : (Number.isFinite(cost) && Number.isFinite(shipping) && Number.isFinite(profit)
      ? Math.max(0, price - cost - shipping - profit) : NaN);
  const margin = Math.max(0, Math.round(Number(p.marginPct != null ? p.marginPct : proof.marginPct) || 0));
  const eta = (p.delivery && p.delivery.etaDays) || '7-21';
  const fulfilNote = fulfil.label === 'AUTO-FULFIL'
    ? 'Supplier dispatch after on-chain confirmation.'
    : 'Zeus Fulfillment Desk queues dispatch after payment (1\u20133 business days).';

  let compareBlock = '';
  if (compare && compare.ok) {
    compareBlock =
      '<div class="ds-compare">' +
        '<div class="ds-proof-head"><strong>Margin OS \u00b7 vs platform tax</strong>' +
          '<span>KEEP +$' + Number(compare.platformTaxAvoidedUsd || 0).toFixed(2) + '</span></div>' +
        '<div class="ds-proof-row"><span>Zeus net margin (BTC direct)</span><strong>' +
          moneyMaybe(compare.zeusNetMarginUsd) + '</strong></div>' +
        '<div class="ds-proof-row"><span>Shopify-class after card fees*</span><strong>' +
          moneyMaybe(compare.shopifyApproxNetUsd) + '</strong></div>' +
        '<p class="ds-delivery-note">*Illustrative card take-rate on the same retail; Zeus has $0 SaaS cut on the sale.</p>' +
      '</div>';
  }

  const media =
    '<div class="ds-pdp-media">' +
      '<span class="ds-media-fallback">' + escapeHtml(p.category || 'product') + '</span>' +
      (img
        ? '<img src="' + img + '" alt="' + escapeHtml(p.title || '') +
          '" loading="eager" decoding="async" fetchpriority="high" data-cover="' + escapeHtml(fb) +
          '" onerror="this.onerror=null;this.src=this.getAttribute(&quot;data-cover&quot;)||&quot;/api/dropship/cover/fallback.svg&quot;">'
        : '') +
    '</div>';

  return (
    '<div class="ds-pdp-grid" data-ssr-pdp="1">' + media +
      '<div class="ds-pdp-copy">' +
        '<div class="ds-badges">' +
          '<span class="ds-badge ' + (mode.live ? 'ds-badge-live' : '') + '">' + mode.label + '</span>' +
          '<span class="ds-badge ' + fulfil.cls + '">' + fulfil.label + '</span>' +
          '<span class="ds-badge">' + escapeHtml(p.category || 'general') + '</span>' +
        '</div>' +
        '<h1 style="margin-top:20px">' + escapeHtml(p.title || 'Product') + '</h1>' +
        '<div class="ds-pdp-price">' + money(price) + '</div>' +
        '<p class="ds-pdp-desc">' +
          escapeHtml(p.description || 'Product details are being prepared by the autonomy stack.') +
        '</p>' +
        '<div class="ds-proof">' +
          '<div class="ds-proof-head"><strong>Proof-of-Margin</strong><span>' + margin + '% MARGIN</span></div>' +
          '<div class="ds-proof-row"><span>Retail price</span><strong>' + moneyMaybe(price) + '</strong></div>' +
          '<div class="ds-proof-row"><span>Source cost</span><strong>' + moneyMaybe(cost) + '</strong></div>' +
          '<div class="ds-proof-row"><span>Catalog shipping estimate</span><strong>' + moneyMaybe(shipping) + '</strong></div>' +
          '<div class="ds-proof-row"><span>Processing + platform</span><strong>' + moneyMaybe(overhead) + '</strong></div>' +
          '<div class="ds-proof-row ds-proof-net"><span>Net margin</span><strong>' + moneyMaybe(profit) + '</strong></div>' +
        '</div>' +
        compareBlock +
        '<button class="ds-pdp-buy" type="button" id="dp-buy" data-buy data-pid="' +
          escapeHtml(p.id) + '">Buy with BTC \u2192</button>' +
        '<p class="ds-delivery-note">Live destination quote required before invoice \u00b7 ETA ' +
          escapeHtml(String(eta)) + ' days \u00b7 ' + escapeHtml(fulfilNote) + '</p>' +
      '</div>' +
    '</div>' +
    relatedHtml(related)
  );
}

function jsonLdProduct(p) {
  if (!p || !p.id) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title || 'Product',
    description: p.description || '',
    image: p.image || undefined,
    sku: p.id,
    category: p.category || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: String(Number(p.priceUsd) || 0),
      availability: 'https://schema.org/InStock',
      url: 'https://zeusai.pro/dropship/product/' + encodeURIComponent(p.id),
    },
  };
  return '<script type="application/ld+json">' +
    JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

function categoryOptionsHtml(categories, selected) {
  const opts = ['<option value="">All categories</option>'];
  for (const c of categories || []) {
    const sel = selected && selected === c ? ' selected' : '';
    opts.push('<option value="' + escapeHtml(c) + '"' + sel + '>' + escapeHtml(c) + '</option>');
  }
  return opts.join('');
}

module.exports = {
  escapeHtml,
  money,
  productCardHtml,
  productGridHtml,
  productPdpHtml,
  relatedHtml,
  jsonLdProduct,
  categoryOptionsHtml,
  sourceMode,
  fulfillBadge,
};
