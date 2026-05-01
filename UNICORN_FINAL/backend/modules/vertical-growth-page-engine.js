// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-01T16:49:42.271Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Vladoi Ionut — vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/*
 * vertical-growth-page-engine (REAL implementation)
 * -------------------------------------------------
 * Renders conversion-optimized growth pages per vertical: hero + ROI
 * calculator + lead-capture form (POSTs to /api/lead) + social-proof
 * KPI ticker placeholder (filled client-side from /api/uaic/revenue/stream).
 *
 * Pure server-side HTML, no JS frameworks. Pairs with programmatic-seo-engine
 * (the SEO/index page) — this is the conversion page. RO+EN comments preserved.
 */

const NAME = 'vertical-growth-page-engine';

let seo = null;
try { seo = require('./programmatic-seo-engine.js'); } catch (_) {}

function _esc(s) { return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const ROI_DEFAULTS = {
  baselineUsd: 100000,
  upliftPct: 18,
  hoursReclaimedPerWeek: 12
};

function calcRoi(input) {
  const baseline = Math.max(0, Number((input && input.baselineUsd) || ROI_DEFAULTS.baselineUsd));
  const upliftPct = Math.max(0, Math.min(100, Number((input && input.upliftPct) || ROI_DEFAULTS.upliftPct)));
  const hoursWeek = Math.max(0, Number((input && input.hoursReclaimedPerWeek) || ROI_DEFAULTS.hoursReclaimedPerWeek));
  const annualUplift = +(baseline * (upliftPct / 100)).toFixed(2);
  const reclaimedHoursYear = hoursWeek * 52;
  const reclaimedDollarsYear = +(reclaimedHoursYear * 75).toFixed(2); // $75/hr blended
  return {
    baselineUsd: baseline,
    upliftPct,
    annualUpliftUsd: annualUplift,
    reclaimedHoursYear,
    reclaimedDollarsYear,
    totalAnnualValueUsd: +(annualUplift + reclaimedDollarsYear).toFixed(2)
  };
}

function renderGrowthHtml(slug, opts) {
  if (!seo || typeof seo.getVertical !== 'function') return null;
  const v = seo.getVertical(slug);
  if (!v) return null;
  const baseUrl = String((opts && opts.baseUrl) || 'https://zeusai-unicorn.com').replace(/\/+$/, '');
  const checkoutUrl = `${baseUrl}/checkout?serviceId=${v.id}&amount=${v.priceUsd}&plan=${v.id}`;
  const roi = calcRoi(opts && opts.roi);
  const paybackMonths = roi.totalAnnualValueUsd > 0 ? Math.max(0.1, +(v.priceUsd / (roi.totalAnnualValueUsd / 12)).toFixed(1)) : null;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${_esc(v.title)} — Growth Page · ZeusAI</title>
<meta name="description" content="${_esc(v.title)} growth page. ROI calculator, lead capture, signed KPI proof. ${_esc(v.kpi)}.">
<link rel="canonical" href="${baseUrl}/grow/${v.id}">
<meta name="robots" content="index,follow">
<style>
  body { font: 16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; max-width: 920px; margin: 0 auto; padding: 2rem 1rem; color: #111; background: #fff; }
  h1 { font-size: 2.25rem; margin: 0 0 .5rem; }
  .lede { font-size: 1.15rem; color: #333; margin: 0 0 1.5rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .card { border: 1px solid #e3e3e3; border-radius: 8px; padding: 1.25rem; background: #fafafa; }
  .big { font-size: 1.6rem; font-weight: 700; color: #0a7; }
  .small { font-size: .85rem; color: #666; }
  form { display: grid; gap: .5rem; }
  input { padding: .55rem .7rem; border: 1px solid #ccc; border-radius: 6px; font: inherit; }
  button { background: #111; color: #fff; padding: .7rem 1rem; border: 0; border-radius: 6px; cursor: pointer; font-weight: 600; }
  .ticker { background: #0b8a3e; color: #fff; padding: .5rem 1rem; border-radius: 6px; font-size: .9rem; margin: 1rem 0; }
  a.cta { display:inline-block; background:#0b8a3e; color:#fff; padding:1rem 1.75rem; border-radius:6px; text-decoration:none; font-weight:700; font-size:1.1rem; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>${_esc(v.title)} — turn KPI into signed revenue</h1>
<p class="lede">Pre-tuned vertical OS for <strong>${_esc(v.kpi)}</strong>. Deploys in hours. Every outcome ships with a cryptographic signed receipt.</p>
<div class="ticker" id="ticker">📈 Live KPI ticker connecting…</div>

<div class="grid">
  <div class="card">
    <h2>ROI estimate</h2>
    <p class="small">Baseline annual revenue: <strong>$${roi.baselineUsd.toLocaleString()}</strong></p>
    <p class="small">Expected uplift: <strong>${roi.upliftPct}%</strong></p>
    <p>Annual uplift value: <span class="big">$${roi.annualUpliftUsd.toLocaleString()}</span></p>
    <p>Reclaimed hours / year: <strong>${roi.reclaimedHoursYear}</strong> ≈ $${roi.reclaimedDollarsYear.toLocaleString()}</p>
    <p>Total annual value: <span class="big">$${roi.totalAnnualValueUsd.toLocaleString()}</span></p>
    ${paybackMonths !== null ? `<p>Payback: <strong>${paybackMonths} months</strong> at $${v.priceUsd}.</p>` : ''}
  </div>

  <div class="card">
    <h2>Get a 10-min walkthrough</h2>
    <p class="small">No spam. We send 1 calendar link, then go silent unless you reply.</p>
    <form id="leadForm" method="POST" action="/api/lead">
      <input name="email" type="email" required placeholder="you@company.com" autocomplete="email">
      <input name="name" type="text" placeholder="Your name" autocomplete="name">
      <input name="company" type="text" placeholder="Company">
      <input type="hidden" name="vertical" value="${_esc(v.id)}">
      <input type="hidden" name="source" value="vertical-growth-page">
      <input type="text" name="hp" style="display:none" tabindex="-1" autocomplete="off">
      <button type="submit">Request walkthrough →</button>
    </form>
  </div>
</div>

<p style="margin-top:2rem; text-align:center;">
  <a class="cta" href="${_esc(checkoutUrl)}">Buy ${_esc(v.title)} — $${v.priceUsd} →</a>
</p>

<p class="small" style="margin-top:2rem;">
  KPI proof: <a href="/api/uaic/receipts">/api/uaic/receipts</a> · Live transparency: <a href="/transparency/live">/transparency/live</a> · Sitemap: <a href="/sitemap.xml">/sitemap.xml</a>
</p>

<script>
(function(){
  try {
    var es = new EventSource('/api/uaic/revenue/stream');
    var t = document.getElementById('ticker');
    es.onmessage = function(e){
      try {
        var d = JSON.parse(e.data);
        if (d && d.gmvUsd != null) t.textContent = '📈 Live GMV: $' + Number(d.gmvUsd).toLocaleString() + ' · ' + (d.orders||0) + ' orders';
      } catch(_){ /* keep last */ }
    };
    es.onerror = function(){ es.close(); };
  } catch(_){}
})();
</script>
</body>
</html>`;
}

function getStatus(opts) {
  return {
    ok: true,
    name: NAME,
    title: 'Vertical Growth Page Engine',
    domain: 'growth',
    summary: 'Renders conversion pages per vertical with ROI calculator, lead capture, and live KPI ticker.',
    seoAttached: !!seo,
    payout: { rail: 'btc-direct', btcAddress: (opts && opts.btcWallet) || process.env.LEGAL_OWNER_BTC || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e' },
    generatedAt: new Date().toISOString()
  };
}

function run(input) {
  if (input && input.slug) return renderGrowthHtml(input.slug, input);
  return { ok: true, message: 'Provide { slug } to render growth page.' };
}

module.exports = { name: NAME, calcRoi, renderGrowthHtml, getStatus, run };
