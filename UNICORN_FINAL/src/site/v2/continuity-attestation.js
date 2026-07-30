'use strict';

/**
 * Continuity Attestation (CAC/1.0) — additive CSS / trust-panel helpers.
 * Public claim: cryptographic proof of operator continuity during payment windows.
 * Does not invent uptime guarantees. CTAs use Live Inspect (never raw JSON tabs).
 */

const CAC_CSS = `
/* Continuity Attestation Chain — CAC/1.0 */
.cac-trust-panel {
  margin: 1.5rem 0;
  padding: 1.25rem 1.35rem;
  border: 1px solid color-mix(in srgb, var(--stroke, rgba(160,200,255,.14)) 88%, #0d9488 12%);
  border-radius: 14px;
  background:
    linear-gradient(165deg, color-mix(in srgb, #0d9488 7%, transparent), transparent 55%),
    color-mix(in srgb, rgba(5,4,10,.55) 94%, #042f2e 6%);
}
.cac-trust-panel h2 {
  margin: 0 0 0.45rem;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
}
.cac-trust-panel p {
  margin: 0 0 0.85rem;
  color: var(--ink-dim, #9aa6bd);
  font-size: 0.92rem;
  line-height: 1.55;
  max-width: 42rem;
}
.cac-trust-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
`;

function injectCss(html) {
  if (!html || typeof html !== 'string') return html;
  if (html.includes('/* Continuity Attestation Chain')) return html;
  if (html.includes('</style>')) {
    return html.replace('</style>', `${CAC_CSS}\n</style>`);
  }
  return html;
}

function trustPanelHtml() {
  return `<aside class="cac-trust-panel" data-cac-panel="1" aria-label="Continuity attestation">
  <h2>Continuity Attestation Chain</h2>
  <p>Every paid order can mint a signed Continuity Passport — cryptographic proof that ZeusAI’s operator plane was bonded (or honestly degraded) during your payment window. Escrow holds money. Delivery Proof Seal seals packs. CAC seals <em>continuity</em>.</p>
  <div class="cac-trust-actions">
    <a class="btn btn-primary" href="/continuity" data-link>Open Continuity desk</a>
    <button type="button" class="btn btn-ghost" data-live-inspect="/api/cac/status" data-live-title="Live CAC status">Live CAC status</button>
    <button type="button" class="btn btn-ghost" data-live-inspect="/.well-known/continuity.json" data-live-title="Well-known CAC">Well-known CAC</button>
  </div>
</aside>`;
}

function trustCardHtml() {
  return `<div class="card" data-cac-trust-card="1"><span class="tag">CAC/1.0 Continuity</span><h3 style="margin:6px 0;font-size:16px">/continuity</h3><p style="color:var(--ink-dim);font-size:12.5px;margin:0">Signed Continuity Passports bind paid orders to observed operator-plane heartbeats — never a fake 100% uptime claim.</p><div style="margin-top:8px"><a class="btn btn-ghost" href="/continuity" data-link>Open Continuity desk →</a></div></div>`;
}

module.exports = {
  protocol: 'CAC/1.0',
  invent: 'Continuity Attestation Chain — signed operator continuity for paid windows',
  CAC_CSS,
  injectCss,
  trustPanelHtml,
  trustCardHtml,
};
