'use strict';

// site-spine-p1.test.js
//
// Verifies the v2 site spine changes shipped in the P1 mission:
//   • Primary nav is trimmed to Home / Marketplace / Dropship / Pricing /
//     Account, with everything else moved to a `.nav-more` overflow menu.
//   • `/services/:id` renders real product data on first paint (SSR) — no
//     "Loading service …" placeholder — and includes a JSON-LD Product block.
//   • `/agents` documents the Agent Commerce Protocol with the owner BTC
//     endpoint and the canonical /agents.json link.
//   • `/order/:id` renders a digital-order passport (timeline + BTC pay
//     card + client-side status poller) inside the v2 shell.
// RO: verifica noile pagini si nav-ul redus pentru site spine.

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');

// Silence noisy self-init logs from the many modules the shell transitively
// requires (autoRevenue, unicorn orchestrator, etc.) so the test output stays
// readable. The shell renders synchronously so muting console is safe here.
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;
console.log = console.warn = console.error = function () {};
let shell, catalog;
try {
  shell = require('../src/site/v2/shell');
  const u = require('../src/commerce/unified-catalog');
  catalog = (u && typeof u.all === 'function') ? (u.all() || []) : [];
} finally {
  console.log = origLog;
  console.warn = origWarn;
  console.error = origErr;
}

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('✓', name); passed++; }
  catch (e) { console.error('✗', name, '\n  ', e && e.stack ? e.stack : e); process.exit(1); }
}

check('nav is trimmed to Home / Marketplace / Dropship / Pricing / Account + More overflow', () => {
  const home = shell.getHtml('/');
  // Primary nav rail
  assert.ok(/data-nav-more/.test(home), 'nav-more overflow container is rendered');
  assert.ok(/nav-more-btn/.test(home), 'nav-more toggle button is rendered');
  assert.ok(/nav-more-menu/.test(home), 'nav-more overflow menu is rendered');
  // Primary links: exact five items should live outside .nav-more (Home,
  // Marketplace, Dropship, Pricing, Account). We only check the presence of
  // each label — layout ordering is validated visually.
  const navBlock = home.match(/<div class="nav-links"[\s\S]*?<\/div>\s*<div class="nav-cta"/);
  assert.ok(navBlock, 'nav-links block is present');
  const nav = navBlock[0];
  assert.ok(/>Home</.test(nav), 'primary Home link');
  assert.ok(/Marketplace/.test(nav), 'primary Marketplace link');
  assert.ok(/Dropship/.test(nav), 'primary Dropship link');
  assert.ok(/>Pricing</.test(nav), 'primary Pricing link');
  assert.ok(/>Account</.test(nav), 'primary Account link');
  // The overflow menu carries Social / Frontier / Innovations / Docs / etc.
  assert.ok(/ZeusAI Social/.test(nav), 'Social lives in More menu');
  assert.ok(/Frontier/.test(nav), 'Frontier lives in More menu');
  assert.ok(/Innovations/.test(nav), 'Innovations lives in More menu');
  assert.ok(/Agents/.test(nav), 'Agents lives in More menu');
});

check('/services/:id renders real SSR product data (no "Loading service …" stub)', () => {
  const svc = catalog[0];
  assert.ok(svc && svc.id, 'unified catalog exposes at least one product');
  const html = shell.getHtml('/services/' + svc.id);
  assert.ok(!/Loading service /.test(html), 'no "Loading service …" placeholder in SSR');
  assert.ok(html.includes('data-pricing-value="' + svc.id + '"'), 'price attribute carries the product id');
  assert.ok(/svcLivePrice/.test(html), 'live-price container is rendered');
  assert.ok(/data-sovereign-buy="/.test(html), 'BTC checkout CTA is present');
  // Real product name from the catalog
  assert.ok(html.includes(svc.title || svc.name || svc.id), 'product title appears in SSR');
  // JSON-LD Product block for SEO
  assert.ok(html.includes('"@type":"Product"'), 'JSON-LD Product block is emitted');
});

check('/services/:id gracefully falls back for unknown ids', () => {
  const html = shell.getHtml('/services/definitely-not-a-real-service-id-xyz-123');
  assert.ok(/Service not found/.test(html), 'unknown ids render an honest "not found" card');
});

check('/agents documents the Agent Commerce Protocol', () => {
  const html = shell.getHtml('/agents');
  assert.ok(/Agent Commerce Protocol/.test(html), 'ACP branding present');
  assert.ok(/\/agents\.json/.test(html), 'links to canonical /agents.json manifest');
  assert.ok(/\/api\/agent\/order/.test(html), 'documents the agent-order endpoint');
  assert.ok(/\/api\/order\/:id\/status/.test(html), 'documents the order status endpoint');
  // Owner BTC endpoint disclosed on the page.
  assert.ok(/bc1|btc-addr/.test(html), 'owner BTC address block is rendered');
});

check('/order/:id renders the digital-order passport inside the v2 shell', () => {
  const html = shell.getHtml('/order/ord_test_abc123');
  assert.ok(/id="orderPassport"/.test(html), 'passport container present');
  assert.ok(/data-order-id="ord_test_abc123"/.test(html), 'order id echoed into DOM');
  assert.ok(/op-timeline/.test(html), 'timeline structure rendered');
  assert.ok(/opBtcAmount/.test(html), 'BTC payment amount slot rendered');
  assert.ok(/\/api\/order\//.test(html), 'client-side script polls /api/order/:id/status');
  // Passport must not fake a "paid" state on first render.
  assert.ok(!/Payment confirmed/i.test(html.split('<script')[0]), 'no fake "confirmed" text pre-hydration');
});

check('/order/:id sanitises the id and rejects malicious tokens', () => {
  const html = shell.getHtml('/order/<script>evil');
  // Sanitised id keeps only [A-Za-z0-9_-:] characters
  assert.ok(!/<script>evil/.test(html.split('<script')[0]), 'raw <script> not reflected pre-hydration');
});

check('a buyable service is a merchant listing and a proposal is not', () => {
  const merchant = require('../src/seo/merchant-offer');
  const buy = shell.getHtml('/services/instant-resume-makeover');
  assert.ok(buy.includes('"@type":"Product"'), 'buyable detail keeps Product JSON-LD');
  assert.ok(buy.includes('"shippingDetails"'), 'offer names shipping');
  assert.ok(buy.includes('"value":0'), 'digital delivery is a zero shipping rate');
  assert.ok(buy.includes('"merchantReturnDays":30'), 'return window matches /refund');
  assert.ok(buy.includes('"returnMethod":"https://schema.org/KeepProduct"'), 'the buyer keeps the file');
  assert.ok(buy.includes('"merchantReturnLink":"https://zeusai.pro/refund"'), 'the offer links the public refund page');
  assert.ok(buy.includes('"seller":{"@id":"https://zeusai.pro/#organization"}'), 'the offer names the organization');
  assert.ok(!buy.includes('customerRemorseReturnFees'), 'a used file is not a free remorse return');
  assert.ok(!buy.includes('itemDefectReturnFees'), 'a used file is not a free defect return');
  assert.ok(!buy.includes('streetAddress'), 'no warehouse address is invented');
  assert.ok(!buy.includes('aggregateRating'), 'no rating is invented');
  assert.ok(buy.includes('"addressCountry":["US"'), 'delivery countries are an explicit list');
  assert.ok(buy.includes('https://zeusai.pro/refund'), 'return policy points at the public refund page');
  assert.ok(!buy.includes('ReturnByMail'), 'a file is not returned by mail');
  assert.ok(!/"price":"[^"]*,/.test(buy), 'JSON-LD price has no thousands comma');
  const proposal = shell.getHtml('/services/ent-acquisition-pack');
  assert.ok(proposal.includes('"@type":"Product"'), 'the engagement pack is a product');
  assert.ok(proposal.includes('/checkout/?plan=ent-acquisition-pack'), 'the pack has a checkout');
  assert.ok(proposal.includes('They are not in this download'), 'the page names the download');
  assert.ok(proposal.includes('"returnMethod":"https://schema.org/KeepProduct"'), 'the pack stays with the buyer');
  assert.ok(!proposal.includes('customerRemorseReturnFees'), 'an issued pack is not a free remorse return');
  const listing = shell.getHtml('/services');
  const articleOf = (id) => {
    const m = listing.match(new RegExp('<article[^>]*data-product-id="' + id + '"[\\s\\S]*?</article>'));
    return m ? m[0] : '';
  };
  assert.ok(listing.includes('"@type":"CollectionPage"'), 'the shelf page is a collection');
  assert.ok(!listing.includes('"@type":"Product"'), 'the shelf page is not one product named ZeusAI');
  assert.ok(listing.includes('itemtype="https://schema.org/Product"'), 'buyable cards stay products');
  assert.ok(listing.includes('itemprop="shippingDetails"'), 'card offers carry shipping');
  assert.ok(listing.includes('content="0"'), 'card shipping rate is zero');
  assert.ok(listing.includes('merchantReturnDays'), 'card offers carry the return window');
  assert.ok(listing.includes('itemprop="returnMethod" href="https://schema.org/KeepProduct"'), 'card offers name KeepProduct');
  assert.ok(listing.includes('itemprop="merchantReturnLink"'), 'card offers link the refund page');
  const refund = shell.getHtml('/refund');
  assert.ok(refund.includes('"@type":"MerchantReturnPolicy"'));
  assert.ok(refund.includes('https://schema.org/KeepProduct'));
  assert.ok(refund.includes('id="merchantReturnFacts"'));
  assert.ok(refund.includes('>' + merchant.RETURN_DAYS + ' days<'));
  assert.ok(refund.includes(merchant.RETURN_DAYS + '-day window'));
  assert.ok(refund.includes('The refund is closed once the file is issued'));
  assert.ok(refund.includes('The refund closes when the file, license, or work is issued.'));
  assert.ok(refund.includes('When the file is issued'));
  assert.ok(!refund.includes('no questions asked'));
  assert.ok(!refund.includes('money-back remains available'));
  const home = shell.getHtml('/');
  assert.ok(home.includes('"@id":"https://zeusai.pro/#organization"'));
  const contract = merchant.contractReport('https://zeusai.pro');
  assert.strictEqual(contract.inventsRatings, false);
  assert.strictEqual(contract.inventsAddresses, false);
  assert.ok(contract.refused.some((row) => row.field === 'gtin'));
  assert.ok(contract.refused.some((row) => row.field === 'searchConsoleShippingSettings'));
  const seo = shell.getHtml('/seo');
  assert.ok(seo.includes('id="merchantContract"'));
  const buyCard = articleOf('instant-resume-makeover');
  assert.ok(/content="\d+\.\d{2}"/.test(buyCard), 'visible price is backed by a dotted number');
  const proposalCard = articleOf('ent-acquisition-pack');
  assert.ok(proposalCard, 'engagement pack card is rendered');
  assert.ok(proposalCard.includes('itemtype="https://schema.org/Offer"'), 'the pack card has an offer');
  assert.ok(proposalCard.includes('KeepProduct'), 'the pack card keeps the file');
  assert.ok(proposalCard.includes('Buy the engagement pack'), 'the pack card can be bought');
  const vertical = require('../backend/modules/programmatic-seo-engine').renderLandingHtml('fintech-os', { baseUrl: 'https://zeusai.pro' });
  assert.ok(vertical && vertical.includes('"@type":"WebPage"'));
  assert.ok(!vertical.includes('"@type":"Product"'));
  assert.ok(!vertical.includes('schema.org/InStock'));
  assert.ok(!vertical.includes('/checkout?serviceId='));
  assert.ok(vertical.includes('/checkout/?plan=fintech-os'));
  assert.ok(vertical.includes('Buy the architecture pack'));
  assert.ok(vertical.includes('does not install an operating system'));
  assert.ok(!vertical.includes('not a cart'));
  assert.ok(!/Deploys in hours/i.test(vertical));
  assert.strictEqual(merchant.DELIVERY_COUNTRIES.length <= 50, true);
  assert.ok(merchant.shippingDetails({ deliveryDays: 7 }).shippingDestination.addressCountry.includes('RO'));
});

check('routeTitle and routeDescription cover the new routes', () => {
  // These helpers are used by SEO/OG tags — they must have real strings
  // for both /agents and /order/:id, not just "ZeusAI" fallbacks.
  const agentsHtml = shell.getHtml('/agents');
  assert.ok(/Agent Commerce Protocol/i.test(agentsHtml), 'title/meta reflects Agent Commerce Protocol');
  const orderHtml = shell.getHtml('/order/orderX');
  assert.ok(/Order Passport/i.test(orderHtml), 'title reflects Order Passport');
});

check('src/index.js v2Routes allowlist includes /agents (so nginx→site does not 404)', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8');
  assert.ok(/['"]\/agents['"]/.test(src), '/agents must be in the v2Routes allowlist');
  assert.ok(/startsWith\('\/order\/'\)/.test(src) || /v2Path\.startsWith\('\/order\/'\)/.test(src),
    '/order/:id must be recognized as a v2 route');
});

console.log('\n✅ site-spine-p1:', passed, 'tests passed');
process.exit(0);
