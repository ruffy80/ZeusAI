'use strict';

/**
 * Commercial desk. Every number is read from an existing store.
 * A missing store is null, not a zero that pretends to be measured.
 * This module does not set a price.
 */
function status() {
  let paidHumans = null;
  let paidSource = 'unavailable';
  try {
    const honesty = require('../../../backend/modules/live-honesty-os');
    if (honesty && typeof honesty.paidHumansCount === 'function') {
      const n = Number(honesty.paidHumansCount());
      if (Number.isFinite(n) && n >= 0) {
        paidHumans = n;
        paidSource = 'origin-gravity';
      }
    }
  } catch (_) { /* store missing */ }

  let funnel = null;
  try {
    const fi = require('../../../backend/modules/funnel-intelligence');
    if (fi && typeof fi.summary === 'function') funnel = fi.summary();
  } catch (_) { funnel = null; }

  const window30 = funnel && funnel.windows ? funnel.windows.last30d : null;
  const num = (value) => (window30 && Number.isFinite(Number(value)) ? Number(value) : null);
  const storedProducts = funnel && Array.isArray(funnel.topProducts)
    ? funnel.topProducts.slice(0, 8).map((row) => ({
      id: row && row.id ? String(row.id).slice(0, 80) : '',
      paid: row && Number.isFinite(Number(row.paid)) ? Number(row.paid) : null,
      delivered: row && Number.isFinite(Number(row.delivered)) ? Number(row.delivered) : null,
      revenueUsd: row && Number.isFinite(Number(row.revenueUsd)) ? Number(row.revenueUsd) : null,
    })).filter((row) => row.id)
    : null;

  return {
    ok: true,
    invented: false,
    measuredAt: new Date().toISOString(),
    paidHumans,
    paidSource,
    visits30d: num(window30 && window30.sessions),
    pageViews30d: num(window30 && window30.pageViews),
    offerViews30d: num(window30 && window30.productViews),
    checkoutStarts30d: num(window30 && window30.checkoutStarts),
    paidEvents30d: num(window30 && window30.paid),
    delivered30d: num(window30 && window30.delivered),
    revenueUsd30d: num(window30 && window30.revenueUsd),
    conversion30d: funnel && funnel.conversion30d ? funnel.conversion30d : null,
    storedProducts,
    emergencyStop: String(process.env.GROWTH_EMERGENCY_STOP || '') === '1',
    primaryOffer: {
      id: 'instant-website-audit',
      delivers: 'A Markdown audit file. A score is written only when a model provider key is armed.',
      refund: '/refund',
      price: null,
      priceNote: 'Read GET /api/price/instant-website-audit. This desk does not copy a dollar amount.',
    },
    note: 'Null means that store did not load. Counts are stored events, not an estimate of the open web.',
  };
}

function esc(value) {
  return String(value == null ? '—' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function page() {
  const data = status();
  const row = (label, value) => '<div class="card" style="padding:16px"><div style="font-size:12px;color:var(--ink-dim)">' + esc(label) + '</div><div style="font-size:28px;font-weight:800;margin-top:4px">' + esc(value) + '</div></div>';
  return `<section class="hero" style="min-height:auto;padding:48px 0 12px">
  <div class="hero-copy">
    <span class="hero-eyebrow"><span class="dot"></span> Commercial desk</span>
    <h1>What was measured. <span class="grad">Nothing estimated.</span></h1>
    <p class="lead">Visits, offer views, checkouts, payments, and deliveries come from the stored funnel. Paid humans come from the origin ledger. The price of the audit is not copied here.</p>
    <p><a class="btn btn-primary" href="/services/instant-website-audit" data-link>Open the audit offer</a> <a class="btn" href="/api/commercial/status" data-allow-raw="1">JSON</a></p>
  </div>
</section>
<section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
  ${row('Paid humans', data.paidHumans)}
  ${row('Visits, 30d', data.visits30d)}
  ${row('Page views, 30d', data.pageViews30d)}
  ${row('Offer views, 30d', data.offerViews30d)}
  ${row('Checkouts, 30d', data.checkoutStarts30d)}
  ${row('Paid events, 30d', data.paidEvents30d)}
  ${row('Deliveries, 30d', data.delivered30d)}
  ${row('Revenue USD, 30d', data.revenueUsd30d)}
</section>
<p style="color:var(--ink-dim);font-size:14px;line-height:1.6">Stored product ids: ${
  data.storedProducts && data.storedProducts.length
    ? data.storedProducts.map((row) => esc(row.id) + ' (paid ' + esc(row.paid) + ', usd ' + esc(row.revenueUsd) + ')').join('; ')
    : '—'
}. ${esc(data.note)} Emergency stop: ${data.emergencyStop ? 'on' : 'off'}.</p>`;
}

module.exports = { status, page };
