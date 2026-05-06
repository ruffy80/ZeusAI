// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.269Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * programmatic-seo-engine (REAL implementation)
 * --------------------------------------------
 * Generates SEO landing pages — one per vertical OS — with full
 * server-rendered HTML, JSON-LD Product schema, OpenGraph + Twitter cards,
 * breadcrumbs, FAQ schema, and sitemap entries.
 *
 * No external dependencies. Deterministic output, suitable for caching.
 * RO+EN comments preserved.
 */

const NAME = 'programmatic-seo-engine';

const VERTICALS = [
  ['fintech-os',       'Fintech OS',       4999, 'compliance velocity & signed KPI'],
  ['health-os',        'HealthTech OS',    4999, 'HIPAA-aligned outcome billing'],
  ['retail-os',        'Retail OS',        3499, 'omnichannel conversion uplift'],
  ['logistics-os',     'Logistics OS',     3999, 'delivery SLA + carbon proof'],
  ['manufacturing-os', 'Manufacturing OS', 4499, 'OEE uplift, defect-rate proof'],
  ['energy-os',        'Energy OS',        4499, 'kWh optimization + carbon offset'],
  ['agri-os',          'AgriTech OS',      2999, 'yield-per-acre, water-use proof'],
  ['edu-os',           'EduTech OS',       2499, 'completion-rate, signed outcomes'],
  ['govtech-os',       'GovTech OS',       5999, 'audit trail + transparency feed'],
  ['legaltech-os',     'LegalTech OS',     3499, 'matter throughput + provable billing'],
  ['hospitality-os',   'Hospitality OS',   2799, 'RevPAR + guest NPS uplift'],
  ['media-os',         'Media OS',         2499, 'CPM + completion-rate proof'],
  ['gaming-os',        'Gaming OS',        2999, 'retention + MTX conversion proof'],
  ['realestate-os',    'RealEstate OS',    3299, 'time-to-close + yield proof'],
  ['mobility-os',      'Mobility OS',      3499, 'utilization + safety proof'],
  ['biotech-os',       'BioTech OS',       5499, 'experiment throughput + audit log'],
  ['security-os',      'Security OS',      4999, 'MTTD + MTTR signed KPI'],
  ['climate-os',       'ClimateTech OS',   3999, 'tCO2e abated + verified offset']
];

function listVerticals() { return VERTICALS.map(([id, title, priceUsd, kpi]) => ({ id, title, priceUsd, kpi })); }

function getVertical(slug) {
  const row = VERTICALS.find((r) => r[0] === String(slug || '').toLowerCase());
  if (!row) return null;
  return { id: row[0], title: row[1], priceUsd: row[2], kpi: row[3] };
}

function _esc(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function _buildJsonLd(v, baseUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: v.title,
    description: `${v.title} — turn-key vertical AI OS. KPI focus: ${v.kpi}. BTC-settled, signed-outcome billing.`,
    sku: v.id,
    brand: { '@type': 'Brand', name: 'ZeusAI / Unicorn' },
    url: `${baseUrl}/vertical/${v.id}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: String(v.priceUsd),
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/checkout?serviceId=${v.id}&amount=${v.priceUsd}&plan=${v.id}`
    }
  };
}

function _buildFaqLd(v) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `What is ${v.title}?`, acceptedAnswer: { '@type': 'Answer', text: `${v.title} is a vertical AI operating system pre-tuned for ${v.kpi}. Deploys in hours, not months, and ships signed KPI receipts.` } },
      { '@type': 'Question', name: 'How is it priced?',   acceptedAnswer: { '@type': 'Answer', text: `Flat $${v.priceUsd} USD per workspace, settleable in BTC. No seat tax. Outcome-anchored upgrades available.` } },
      { '@type': 'Question', name: 'How fast can I launch?', acceptedAnswer: { '@type': 'Answer', text: 'Same-day onboarding via /me/services. First signed KPI win typically within 7 days.' } }
    ]
  };
}

function renderLandingHtml(slug, opts) {
  const v = getVertical(slug);
  if (!v) return null;
  const baseUrl = String((opts && opts.baseUrl) || 'https://zeusai-unicorn.com').replace(/\/+$/, '');
  const btcWallet = String((opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e');
  const usdPerBtc = Math.max(1, Number(opts && opts.btcSpotUsd) || 95000);
  const btcAmount = +(v.priceUsd / usdPerBtc).toFixed(8);
  const checkoutUrl = `${baseUrl}/checkout?serviceId=${v.id}&amount=${v.priceUsd}&plan=${v.id}`;
  const ldProduct = _buildJsonLd(v, baseUrl);
  const ldFaq = _buildFaqLd(v);
  const ldBreadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Verticals', item: `${baseUrl}/verticals` },
      { '@type': 'ListItem', position: 3, name: v.title,     item: `${baseUrl}/vertical/${v.id}` }
    ]
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${_esc(v.title)} — Vertical AI OS by ZeusAI</title>
<meta name="description" content="${_esc(v.title)} — turn-key vertical AI OS focused on ${_esc(v.kpi)}. BTC-settled, signed-outcome billing. Deploy in hours.">
<link rel="canonical" href="${baseUrl}/vertical/${v.id}">
<meta property="og:title" content="${_esc(v.title)} — ZeusAI Vertical OS">
<meta property="og:description" content="Vertical AI OS focused on ${_esc(v.kpi)}. BTC-settled.">
<meta property="og:type" content="product">
<meta property="og:url" content="${baseUrl}/vertical/${v.id}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${_esc(v.title)} — ZeusAI">
<meta name="twitter:description" content="Vertical AI OS — ${_esc(v.kpi)}.">
<script type="application/ld+json">${JSON.stringify(ldProduct)}</script>
<script type="application/ld+json">${JSON.stringify(ldFaq)}</script>
<script type="application/ld+json">${JSON.stringify(ldBreadcrumb)}</script>
<style>
  /* Zeus full-bleed page background — same hero/brand alternation as the
     v2 shell. Deterministic per slug so each vertical always shows the
     same Zeus. Low opacity preserves text legibility. */
  html { min-height: 100%; }
  body::before { content:""; position:fixed; inset:0; z-index:-2; background-image:url("/assets/zeus/${ ((v.id||'').length % 2 === 0) ? 'hero.jpg' : 'brand.jpg' }"); background-size:cover; background-position:center; background-repeat:no-repeat; opacity:.16; pointer-events:none; }
  body::after  { content:""; position:fixed; inset:0; z-index:-1; background:linear-gradient(180deg, rgba(250,250,250,.78), rgba(250,250,250,.92)); pointer-events:none; }
  body { font: 16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width: 880px; margin: 2rem auto; padding: 0 1rem; color: #111; background: transparent; position: relative; }
  header { border-bottom: 1px solid #ddd; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 2rem; margin: 0 0 .25rem; }
  .kpi { display:inline-block; background:#0b8a3e; color:#fff; padding:.25rem .5rem; border-radius:4px; font-size:.85rem; }
  .price { font-size: 2rem; font-weight: 700; color: #0a0; margin: 1rem 0; }
  .btc { font-family: ui-monospace, Menlo, monospace; font-size: .85rem; color: #555; word-break: break-all; }
  a.cta { display:inline-block; background:#111; color:#fff; padding:.85rem 1.5rem; border-radius:6px; text-decoration:none; font-weight:600; }
  ul { padding-left: 1.25rem; }
  nav.breadcrumb { font-size: .85rem; color: #666; margin-bottom: 1rem; }
  nav.breadcrumb a { color: #06c; text-decoration: none; }
  section { margin: 1.5rem 0; }
  footer { font-size: .85rem; color: #777; border-top: 1px solid #ddd; margin-top: 2rem; padding-top: 1rem; }
</style>
</head>
<body>
<nav class="breadcrumb"><a href="/">Home</a> › <a href="/verticals">Verticals</a> › ${_esc(v.title)}</nav>
<header>
  <span class="kpi">KPI: ${_esc(v.kpi)}</span>
  <h1>${_esc(v.title)}</h1>
  <p>Turn-key vertical AI OS — pre-tuned for <strong>${_esc(v.kpi)}</strong>. Signed KPI receipts on every outcome. BTC-settled, no seat tax.</p>
</header>

<section>
  <div class="price">$${v.priceUsd} <span style="font-size:.6em;color:#666;">USD / workspace</span></div>
  <div class="btc">≈ ${btcAmount} BTC → <code>${_esc(btcWallet)}</code></div>
  <p style="margin-top:1rem;"><a class="cta" href="${_esc(checkoutUrl)}">Buy ${_esc(v.title)} →</a></p>
</section>

<section>
  <h2>What you get</h2>
  <ul>
    <li>Pre-configured agents for ${_esc(v.kpi)}.</li>
    <li>Signed KPI receipts (cryptographic proof of outcome).</li>
    <li>BTC-direct settlement to your wallet — no payment processor lock-in.</li>
    <li>Universal 1-click cancel; GDPR data export &amp; delete.</li>
    <li>SLA: 99.9% site uptime, 99.99% API uptime, &lt;2.5s checkout probe.</li>
  </ul>
</section>

<section>
  <h2>FAQ</h2>
  <h3>What is ${_esc(v.title)}?</h3>
  <p>${_esc(v.title)} is a vertical AI operating system pre-tuned for ${_esc(v.kpi)}. Deploys in hours, not months, and ships signed KPI receipts.</p>
  <h3>How is it priced?</h3>
  <p>Flat $${v.priceUsd} USD per workspace, settleable in BTC. No seat tax. Outcome-anchored upgrades available.</p>
  <h3>How fast can I launch?</h3>
  <p>Same-day onboarding via <a href="/me/services">/me/services</a>. First signed KPI win typically within 7 days.</p>
</section>

<footer>
  ZeusAI / Unicorn — owner-controlled, BTC-native. <a href="/transparency/live">Live transparency feed</a> · <a href="/sitemap.xml">Sitemap</a>
</footer>
</body>
</html>`;
}

function buildSitemapEntries(baseUrl) {
  const base = String(baseUrl || 'https://zeusai-unicorn.com').replace(/\/+$/, '');
  return VERTICALS.map(([id]) => ({ loc: `${base}/vertical/${id}`, changefreq: 'weekly', priority: '0.8' }));
}

function getStatus(opts) {
  return {
    ok: true,
    name: NAME,
    title: 'Programmatic SEO Engine',
    domain: 'seo',
    summary: 'Generates SEO landing pages + JSON-LD Product/FAQ/Breadcrumb schema for 18 vertical OSes.',
    verticalsCount: VERTICALS.length,
    sampleVerticals: listVerticals().slice(0, 3),
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) {
  if (input && input.slug) return renderLandingHtml(input.slug, input);
  return { verticals: listVerticals() };
}

module.exports = { name: NAME, listVerticals, getVertical, renderLandingHtml, buildSitemapEntries, getStatus, run };
