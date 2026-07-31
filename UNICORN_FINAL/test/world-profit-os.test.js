/**
 * World-Profit-OS conversion pack — regression asserts.
 *
 * Verifies that the high-ROI shell.js/client.js/sovereign-commerce.js changes
 * shipped under the conversion pack are present. Keeps the test hermetic —
 * reads sources as text so it doesn't require booting the site server.
 */
'use strict';

process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SHELL_PATH = path.join(__dirname, '..', 'src', 'site', 'v2', 'shell.js');
const CLIENT_PATH = path.join(__dirname, '..', 'src', 'site', 'v2', 'client.js');
const SOVEREIGN_PATH = path.join(__dirname, '..', 'src', 'site', 'sovereign-commerce.js');
const STYLES_PATH = path.join(__dirname, '..', 'src', 'site', 'v2', 'styles.js');

const shell = fs.readFileSync(SHELL_PATH, 'utf8');
const client = fs.readFileSync(CLIENT_PATH, 'utf8');
const sovereign = fs.readFileSync(SOVEREIGN_PATH, 'utf8');
const styles = fs.readFileSync(STYLES_PATH, 'utf8');

let failed = 0;
function check(label, fn) {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log('  ok  ' + label);
  } catch (e) {
    failed += 1;
    // eslint-disable-next-line no-console
    console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e));
  }
}

// ── A) Home conversion ───────────────────────────────────────────
check('shell: hero eyebrow uses BTC-native save-10% copy', () => {
  assert.ok(shell.includes('₿ Native Bitcoin · save 10% · instant delivery'));
});
check('shell: hero headline keeps ZeusAI brand + Ship AI products signal', () => {
  assert.ok(/ZeusAI\s*<span class="grad">Ship AI products at machine speed\./.test(shell));
});
check('shell: Building the future sits above ZeusAI brand (no right panel)', () => {
  assert.ok(!shell.includes('hero-side hero-vision'), 'old right panel must be gone');
  assert.ok(!shell.includes('Building the AI feature'), 'old AI-feature copy must be gone');
  assert.ok(shell.includes('Building the future'), 'future line missing');
  const futureIdx = shell.indexOf('Building the future');
  const brandIdx = shell.indexOf('hero-brand');
  assert.ok(futureIdx > 0 && brandIdx > futureIdx, 'future line must precede brand headline');
});
check('styles: hero-future letterpress uses Orbitron + vibrant chroma', () => {
  assert.ok(styles.includes('.hero-future-type'), 'letterpress style missing');
  assert.ok(styles.includes('font-family:Orbitron'), 'Orbitron font missing');
  assert.ok(styles.includes('heroFutureShimmer'), 'shimmer motion missing');
  assert.ok(/#FF3B5C|#FF9F1C|#00E8A0|#2DE2E6/.test(styles), 'vibrant chroma missing');
});
check('shell: hero secondary link points to /wizard plan finder', () => {
  assert.ok(shell.includes('30-second plan finder'));
  assert.ok(/href="\/wizard"/.test(shell));
});
check('shell: buyer-trust hero stats render before Modules/Verticals row', () => {
  const trustIdx = shell.indexOf('Signed receipts');
  const modulesIdx = shell.indexOf('id="statModules"');
  assert.ok(trustIdx > 0 && modulesIdx > 0, 'both blocks must exist');
  assert.ok(trustIdx < modulesIdx, 'trust stats must precede modules stats');
});
check('shell: stats include #statBtcSave 10% BTC discount', () => {
  assert.ok(/id="statBtcSave"/.test(shell));
  assert.ok(/BTC discount/.test(shell));
});
check('shell: featured strip includes ONLY instant+professional (no enterprise picks)', () => {
  const featured = shell.match(/const _featured = \[\][\s\S]*?;\s*const _featuredHtml/);
  assert.ok(featured, 'featured block must exist');
  assert.ok(!/_byTier\.enterprise\.slice[^)]+\)\.slice\(0,2\)[\s\S]*?const _featuredHtml/.test(shell), 'enterprise tier should not be picked into featured');
});
check('shell: enterprise CTA row present after featured', () => {
  assert.ok(shell.includes('Explore Enterprise →'));
  assert.ok(shell.includes('Building at scale?'));
});
check('shell: _zaccBanner rendered AFTER _featuredHtml', () => {
  // Find each token in the home template body.
  const marker = shell.indexOf('${_featuredHtml}\n\n${_homeProofRail}\n\n${_zaccBanner}');
  assert.ok(marker > 0, 'template must interpolate featured before zacc banner');
});
check('shell: SSR containers homeLiveSales + homeBtcDiscount exist', () => {
  assert.ok(shell.includes('id="homeLiveSales"'));
  assert.ok(shell.includes('id="homeBtcDiscount"'));
  assert.ok(/Pay in BTC.*save 10%/s.test(shell));
});
check('shell: heroQuickBuy compact form exists with data-hero-quick-buy hook', () => {
  assert.ok(shell.includes('id="heroQuickBuy"'));
  assert.ok(shell.includes('data-hero-quick-buy'));
  assert.ok(shell.includes('Get BTC invoice →'));
});

// ── B) Catalog card BTC discount microcopy ───────────────────────
check('shell: _catalogCard adds "10% BTC discount applied" microcopy for priced items', () => {
  const idx = shell.indexOf('function _catalogCard');
  const nextFn = shell.indexOf('function _ssrCatalogGrid');
  const block = shell.slice(idx, nextFn);
  assert.ok(block.includes('10% BTC discount applied'));
});

// ── C) Services page ─────────────────────────────────────────────
check('shell: pageServices sticky CTA now routes to /wizard plan finder', () => {
  const idx = shell.indexOf('function pageServices');
  const end = shell.indexOf('function pageService', idx + 1);
  const block = shell.slice(idx, end);
  assert.ok(block.includes('Find my plan →'));
  assert.ok(/href="\/wizard"/.test(block));
});
check('shell: services wallet clarified as revenue destination + unique invoice guidance', () => {
  const idx = shell.indexOf('function pageServices');
  const end = shell.indexOf('function pageService', idx + 1);
  const block = shell.slice(idx, end);
  assert.ok(/Revenue destination.*unique.*invoice/i.test(block));
});
check('shell: filters row includes wizard chip', () => {
  assert.ok(/class="chip"[^>]*href="\/wizard"/.test(shell));
});
check('shell: What you receive section renders 3 deliverable descriptions', () => {
  assert.ok(shell.includes('What you receive'));
  assert.ok(shell.includes('Website Audit'));
  assert.ok(shell.includes('Logo Kit'));
  assert.ok(shell.includes('SEO Pack'));
});

// ── D) Service detail ────────────────────────────────────────────
check('shell: service detail replaces unlock widget with 3-step BTC delivery timeline', () => {
  const idx = shell.indexOf('function pageService(id)');
  const end = shell.indexOf('function pagePricing');
  const block = shell.slice(idx, end);
  assert.ok(block.includes('svcDeliveryTimeline'));
  assert.ok(block.includes('Pay BTC'));
  assert.ok(block.includes('Mempool confirm'));
  assert.ok(block.includes('Signed delivery'));
  assert.ok(!block.includes('svcStoryRun'), 'legacy simulation button must be removed');
  assert.ok(!block.includes('{orderId}'), 'debug {orderId} placeholder must be removed');
});
check('shell: service detail /mo suffix guarded by billing/tier check', () => {
  const idx = shell.indexOf('function pageService(id)');
  const end = shell.indexOf('function pagePricing');
  const block = shell.slice(idx, end);
  assert.ok(/s\.billing === 'monthly'|billing === "monthly"/.test(block) || block.includes("s.billing === 'monthly'"));
  assert.ok(block.includes('#svcUpsell') || block.includes('id="svcUpsell"'));
});
check('client: hydrateServiceUpsell fetches /api/upsell and renders recommend buttons', () => {
  assert.ok(client.includes('hydrateServiceUpsell'));
  assert.ok(client.includes('/api/upsell?service='));
  assert.ok(client.includes('data-sovereign-buy'));
});
check('client: hydrateServiceDetail uses delivery timeline (no unlock simulation overwrite)', () => {
  const idx = client.indexOf('async function hydrateServiceDetail');
  const end = client.indexOf('async function hydrateServiceUpsell', idx + 1);
  const block = client.slice(idx, end > idx ? end : idx + 8000);
  assert.ok(block.includes('svcDeliveryTimeline'));
  assert.ok(block.includes('svcUpsell'));
  assert.ok(!block.includes('Checkout unlock sequence'));
  assert.ok(!block.includes('Run activation simulation'));
});

// ── E) Checkout page ─────────────────────────────────────────────
check('shell: pageCheckout has "You are buying" header with plan + amount', () => {
  const idx = shell.indexOf('function pageCheckout');
  const end = shell.indexOf('function pageSolution');
  const block = shell.slice(idx, end);
  assert.ok(block.includes('You are buying'));
  assert.ok(block.includes('id="checkoutBuyingPlan"'));
  assert.ok(block.includes('id="checkoutBuyingAmount"'));
});
check('shell: pageCheckout details "What happens after I send BTC?" block present', () => {
  assert.ok(shell.includes('What happens after I send BTC?'));
  assert.ok(shell.includes('id="checkoutFaq"'));
});
check('shell: pageCheckout offers sovereign-invoice button for catalog-like plans', () => {
  const idx = shell.indexOf('function pageCheckout');
  const end = shell.indexOf('function pageSolution');
  const block = shell.slice(idx, end);
  assert.ok(block.includes('Skip form — open sovereign invoice'));
});
check('styles: co-qr canvas has max-width guard for responsiveness', () => {
  assert.ok(/\.co-qr canvas\{[^}]*max-width:min\(320px,100%\)/.test(styles));
});

// ── F) Pricing ───────────────────────────────────────────────────
check('shell: legacy "Conversion optimizer is calibrating…" placeholder is removed', () => {
  assert.ok(!shell.includes('Conversion optimizer is calibrating'));
});
check('shell: pricing cross-links to /services one-time catalog', () => {
  assert.ok(shell.includes('id="pricingCatalogCrossLink"'));
  assert.ok(/Open one-time catalog/.test(shell));
});

// ── G) Trust center ──────────────────────────────────────────────
check('shell: trust center SSR static cards render BEFORE loading grid', () => {
  const idx = shell.indexOf('function pageTrustCenter');
  const end = shell.indexOf('function pageSecurity') > 0 ? shell.indexOf('function pageSecurity') : shell.indexOf('function pageAura');
  const block = shell.slice(idx, end > 0 ? end : idx + 4000);
  assert.ok(block.includes('id="trustStaticGrid"'));
  assert.ok(block.includes('/integrity.json'));
  assert.ok(block.includes('/refund'));
  assert.ok(block.includes('/pledge'));
  assert.ok(block.includes('/.well-known/keys.json'));
  const staticIdx = block.indexOf('id="trustStaticGrid"');
  const dynIdx = block.indexOf('id="trustGrid"');
  assert.ok(staticIdx > 0 && dynIdx > 0 && staticIdx < dynIdx, 'static grid must precede dynamic grid');
});

// ── H) client.js profit wiring ───────────────────────────────────
check('client: hydrateHomeProof paints homeLiveSales via /api/commerce/recent-sales', () => {
  assert.ok(client.includes('hydrateHomeProof'));
  assert.ok(client.includes('/api/commerce/recent-sales?limit=8'));
  assert.ok(client.includes('homeLiveSalesBody'));
});
check('client: bindHeroQuickBuy wires #heroQuickBuy submit to sovereignBuy', () => {
  assert.ok(client.includes('bindHeroQuickBuy'));
  assert.ok(client.includes("document.getElementById('heroQuickBuy')"));
  assert.ok(client.includes('window.sovereignBuy'));
  assert.ok(client.includes("localStorage.setItem('u_email'"));
});
check('client: post-paid gift-mint card appended after license issuance', () => {
  assert.ok(client.includes('postPaidGiftCard'));
  assert.ok(client.includes("fetch('/api/gift/mint'"));
  assert.ok(client.includes('id="ppGiftBtn"'));
});
check('sovereign: checkoutHtml grant surface exposes gift-mint block', () => {
  assert.ok(sovereign.includes('id="giftBtn"'));
  assert.ok(sovereign.includes("fetch('/api/gift/mint'"));
});

// ── I) upsell-engine module ──────────────────────────────────────
check('upsell-engine: recommend() returns { recommendations: [] } shape', () => {
  const mod = require('../backend/modules/upsell-engine');
  assert.equal(typeof mod.recommend, 'function');
  const out = mod.recommend({ anchor: 'adaptive-ai', cart: [] });
  assert.ok(out && Array.isArray(out.recommendations), 'recommendations must be an array');
});

// ── Guardrail: Buy-BTC checkoutHtml fix must not regress ─────────
check('sovereign: accessTokenJs + headersSent guards remain in checkoutHtml', () => {
  assert.ok(sovereign.includes('accessTokenJs'));
  assert.ok(sovereign.includes('res.headersSent'));
});

if (failed > 0) {
  // eslint-disable-next-line no-console
  console.error('world-profit-os.test.js: ' + failed + ' assertion(s) failed.');
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log('world-profit-os.test.js: OK');
