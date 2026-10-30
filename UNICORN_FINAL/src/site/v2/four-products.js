'use strict';

const offerings = require('../../../backend/modules/product-offerings');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(usd, btc) {
  if (!(Number(usd) > 0)) return 'Free';
  const btcText = btc ? (' · ' + esc(btc) + ' BTC') : '';
  return '$' + Number(usd).toFixed(2) + btcText;
}

function trustBadge() {
  let label = '0 deliveries signed — be the first';
  try { label = offerings.proof().trustLabel; } catch (_) { /* honest fallback below */ }
  return '<p class="trust-badge"><a href="/witness.json">Signed delivery • Verifiable at /witness.json</a> <span>' + esc(label) + '</span></p>';
}

function leadForm(product, intent) {
  return '<form method="post" action="/api-product/signup" class="card" data-lead-form>'
    + '<input type="hidden" name="product" value="' + esc(product) + '"/>'
    + '<input type="hidden" name="intent" value="' + esc(intent) + '"/>'
    + '<label>Email <input type="email" name="email" required placeholder="you@company.com"/></label>'
    + '<label><input type="checkbox" name="optIn" value="true"/> Email me about this product. Leave this unchecked and no marketing email is sent.</label>'
    + '<button class="btn btn-primary" type="submit">Get free API key</button>'
    + '</form>';
}

function tierCards(product) {
  return offerings.tiersFor(product).map((tier) => {
    const quota = tier.quota == null ? 'unlimited' : String(tier.quota);
    return '<article class="card tier" data-tier-id="' + esc(product + '-' + tier.id) + '">'
      + '<h3>' + esc(tier.name) + '</h3>'
      + '<p>' + money(tier.usd, tier.btc) + (tier.interval ? ' / ' + esc(tier.interval) : '') + '</p>'
      + '<p>Quota ' + esc(quota) + (tier.note ? '. ' + esc(tier.note) : '') + '</p>'
      + '</article>';
  }).join('');
}

function pageProducts() {
  const products = offerings.shelfProducts();
  const bundles = require('../../../backend/modules/commercial-layer').bundlesPayload().bundles || [];
  const categories = [...new Set(products.map((item) => item.category))];
  const bundleHtml = bundles.map((bundle) => '<article class="card bundle-card"><h3>' + esc(bundle.name) + '</h3><p>Save ' + esc(bundle.discountPct) + '%</p><p>' + money(bundle.usd, bundle.btc) + '</p><p><a class="btn" href="' + esc(bundle.btcUri || '/products') + '">Buy with BTC</a></p></article>').join('');
  const filters = '<button type="button" class="chip" data-product-filter="all">All</button>'
    + categories.map((category) => '<button type="button" class="chip" data-product-filter="' + esc(category) + '">' + esc(category) + '</button>').join('');
  return '<section style="padding-top:140px" id="products">'
    + '<h1>55 AI services. Pay in BTC. Delivered in minutes.</h1>'
    + '<p>' + products.length + ' named offers. The count is the live shelf, not a fixed slogan.</p>'
    + '<section id="productBundles"><h2>Save with bundles</h2><div class="grid">' + bundleHtml + '</div></section>'
    + '<label for="productSearch">Search</label><input id="productSearch" type="search" placeholder="Search services" aria-label="Search services"/>'
    + '<div class="filters" id="productFilters">' + filters + '</div>'
    + '<div class="grid" id="productGrid">' + products.map((item) => '<article class="card product-card" data-category="' + esc(item.category) + '" data-name="' + esc(item.name) + '">'
    + '<span class="tag">' + esc(item.category) + '</span>'
    + '<h3><a href="/products/' + encodeURIComponent(item.id) + '" data-link>' + esc(item.name) + '</a></h3>'
    + '<p>' + esc(item.description) + '</p>'
    + '<p>' + money(item.usd, item.btc) + '</p>'
    + trustBadge()
    + '<p><a class="btn btn-primary" href="/products/' + encodeURIComponent(item.id) + '" data-link>Buy</a></p>'
    + '</article>').join('\n') + '</div>'
    + '</section>';
}

function pageProduct(id) {
  const item = offerings.productById(id);
  if (!item) return '';
  const sample = offerings.sampleFor(id);
  const related = offerings.relatedProducts(id, item.category);
  const sampleHtml = sample
    ? '<pre>' + esc(sample.text) + '</pre>'
    : '<p>sample coming soon</p>';
  const qr = item.btcUri ? ('/api/qr?d=' + encodeURIComponent(item.btcUri)) : '';
  const address = (item.btcUri || '').replace(/^bitcoin:/, '').split('?')[0];
  const relatedHtml = related.map((row) => '<a href="/products/' + encodeURIComponent(row.id) + '" data-link>' + esc(row.name) + '</a>').join(' · ');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    description: item.description,
    sku: item.id,
    offers: {
      '@type': 'Offer',
      price: item.usd,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: 'https://zeusai.pro/products/' + item.id,
    },
  };
  return '<section style="padding-top:140px" id="productDetail" data-product-id="' + esc(item.id) + '">'
    + '<script type="application/ld+json">' + JSON.stringify(schema).replace(/</g, '\\u003c') + '</script>'
    + '<p class="kicker">' + esc(item.category) + '</p>'
    + '<h1>' + esc(item.name) + '</h1>'
    + '<p>' + esc(item.description) + '</p>'
    + '<p>Live price ' + money(item.usd, item.btc) + '</p>'
    + trustBadge()
    + '<h2>Sample output</h2>' + sampleHtml
    + '<h2>Buy with BTC</h2>'
    + '<p>Amount ' + esc(item.btc) + ' BTC</p>'
    + '<p>Address <code>' + esc(address) + '</code></p>'
    + (qr ? '<img alt="Bitcoin QR" width="180" height="180" src="' + esc(qr) + '"/>' : '')
    + '<p><a class="btn btn-primary" href="' + esc(require('../../commerce/pay-options').checkoutHref(item.id, 'btc')) + '">Buy with BTC</a></p>'
    + require('../../commerce/pay-options').payOptionsHtml(item.id)
    + '<h2>Related services</h2><p>' + (relatedHtml || 'No other offer shares this category yet.') + '</p>'
    + '</section>';
}

function pageApiProduct() {
  const proof = offerings.proof();
  return '<section style="padding-top:140px" id="apiProduct">'
    + '<h1>Verifiable delivery API. Every delivery signed with Ed25519. Public ledger. Zero trust required.</h1>'
    + '<p>Marketplaces, AI agencies, freelancers, and escrow services can ask ZeusAI to sign a delivery receipt with the same key published at /witness.json.</p>'
    + '<ol><li>POST /api/v1/witness with the delivery payload.</li><li>Read the signed receipt.</li><li>The client verifies it at the verification link or with the public key.</li></ol>'
    + '<p>Signed deliveries on record: ' + esc(proof.signedDeliveries) + '. Witness contracts: ' + esc(proof.witnessCount) + '. ' + esc(proof.trustLabel) + '</p>'
    + '<form method="post" action="/api/v1/witness/demo" class="card"><label>Sample delivery <textarea name="delivery" maxlength="500">Sample delivery for signature check.</textarea></label><button class="btn btn-primary" type="submit">Sign a sample</button></form>'
    + '<p>This demo signs a sample. It is not a customer delivery and it is not added to the paid ledger.</p>'
    + '<section id="apiPricing"><h2>Pricing</h2><div class="grid">' + tierCards('witness') + '</div></section>'
    + '<p><a class="btn" href="/api-product/docs" data-link>API docs</a> <a class="btn" href="/api-product/pricing" data-link>Pricing</a></p>'
    + leadForm('witness', 'free_api_key')
    + '</section>';
}

function pageApiDocs() {
  return '<section style="padding-top:140px" id="apiDocs">'
    + '<h1>Witness API docs</h1>'
    + '<h2>POST /api/v1/witness</h2>'
    + '<pre>curl -X POST https://zeusai.pro/api/v1/witness -H "Authorization: Bearer zk_..." -H "Content-Type: application/json" -d \'{"delivery":{"order":"example"}}\'</pre>'
    + '<p>Auth: API key. Free tier is 100 deliveries a month. Pro is 5,000. Enterprise has no monthly cap in this table. The counter resets each calendar month.</p>'
    + '<h2>GET /api/v1/witness/:id</h2><p>Returns the stored signed receipt.</p>'
    + '<h2>GET /api/v1/verify/:id</h2><p>Returns valid true only when the Ed25519 signature checks against the stored payload.</p>'
    + '<h2>GET /api/v1/pubkey</h2><p>The same public key as /witness.json. A client verifies by checking the signature over the canonical payload with this key. No ZeusAI account is required for that check.</p>'
    + '<p>POST /api/v1/witness appears once in this document as the write call.</p>'
    + '</section>';
}

function pageApiPricing() {
  return '<section style="padding-top:140px"><h1>Witness API pricing</h1><div class="grid">' + tierCards('witness') + '</div>' + leadForm('witness', 'free_api_key') + '</section>';
}

function pageOrchestrator() {
  const proof = offerings.proof();
  return '<section style="padding-top:140px" id="orchestrator">'
    + '<h1>One orchestrator. All your modules. Zero conflicts. Self-healing.</h1>'
    + '<p>Managing multiple AI agents, schedulers, and cron jobs leads to conflicts, duplicate work, and silent failures.</p>'
    + '<p>The running facade is one scheduler, per-resource locks, circuit breakers, predictive health, auto-repair that only observes, and an incident autopsy file when a capability fails.</p>'
    + '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="120" role="img" aria-label="Orchestrator architecture"><rect x="8" y="30" width="140" height="48" fill="none" stroke="#8a5cff"/><text x="20" y="58" fill="#e8eef8">Capabilities</text><rect x="180" y="30" width="140" height="48" fill="none" stroke="#8a5cff"/><text x="210" y="58" fill="#e8eef8">Locks</text><rect x="352" y="30" width="140" height="48" fill="none" stroke="#8a5cff"/><text x="368" y="58" fill="#e8eef8">Health</text><rect x="520" y="30" width="100" height="48" fill="none" stroke="#8a5cff"/><text x="536" y="58" fill="#e8eef8">Repair</text></svg>'
    + '<pre>const { UnifiedOrchestrator } = require("@zeusai/orchestrator");\nconst orch = new UnifiedOrchestrator();\norch.registerCapabilities();\nawait orch.withLock("orders", () => orch.safeRun("syncPrices", () => orch.syncPrices()));</pre>'
    + '<p>Use it for an AI agent platform, a workflow product, or a DevOps team that already has too many timers.</p>'
    + '<p>Signed deliveries recorded here: ' + esc(proof.signedDeliveries) + '. ' + esc(proof.trustLabel) + '</p>'
    + '<div class="grid">' + tierCards('orchestrator') + '</div>'
    + '<p><a class="btn btn-primary" href="/orchestrator/playground" data-link>Open the playground</a> <a class="btn" href="/orchestrator/docs" data-link>Docs</a></p>'
    + leadForm('orchestrator', 'request_access')
    + '</section>';
}

function pageOrchestratorDocs() {
  return '<section style="padding-top:140px"><h1>Orchestrator SDK docs</h1>'
    + '<p>The package is <code>@zeusai/orchestrator</code> in this repository under an MIT license. It is not on the public npm registry. Install it from the repo: <code>npm install ./packages/zeusai-orchestrator</code>.</p>'
    + '<h2>Register a capability</h2><pre>orch.registerCapabilities();</pre>'
    + '<h2>Locks</h2><pre>await orch.withLock("orders", async () => work());</pre>'
    + '<h2>Circuit breakers</h2><pre>await orch.safeRun("syncPrices", () => orch.syncPrices());</pre>'
    + '<h2>Predictive health</h2><pre>orch.updatePrediction("syncPrices", 120);</pre>'
    + '<h2>systemd</h2><pre>ExecStart=/usr/bin/node backend/modules/orchestrator/index.js</pre>'
    + '<h2>Docker</h2><pre>CMD ["node", "backend/modules/orchestrator/index.js"]</pre>'
    + '<h2>Migration</h2><p>Keep the old orchestrators loaded. Point new work at this facade. Do not delete the old processes from this page.</p>'
    + '</section>';
}

function pagePlayground() {
  return '<section style="padding-top:140px" id="orchPlayground"><h1>Orchestrator playground</h1>'
    + '<p>Registers two mock capabilities on a fresh in-process orchestrator and runs them on one lock. This request is rate limited. It is not the 60-second SDK example.</p>'
    + '<form method="post" action="/api/v1/orchestrator/sandbox"><button class="btn btn-primary" type="submit">Run two capabilities</button></form>'
    + '</section>';
}

function pageSnm() {
  const proof = offerings.proof();
  const delivered = proof.snmDelivered24h;
  return '<section style="padding-top:140px" id="snm">'
    + '<h1>Notifications with cryptographic proof. No spam. No email dependency.</h1>'
    + '<p>Transactional mail often misses the inbox, and a sender cannot show a customer an independent receipt. This mesh signs every notification with the same Ed25519 key.</p>'
    + '<p>Order: WebSocket, then Web Push, then Nostr, then SMTP as the last fallback. A channel that fails stays failed in the receipt.</p>'
    + '<p>Delivered in the last 24 hours, from the SNM receipt log: ' + esc(delivered) + '. Zero means zero.</p>'
    + '<p>Use it for order confirmations, invoice notices, compliance notices, and agent-to-agent messages.</p>'
    + '<div class="grid">' + tierCards('snm') + '</div>'
    + '<p><a class="btn btn-primary" href="/snm/verify" data-link>Verify a signature</a> <a class="btn" href="/snm/docs" data-link>Docs</a></p>'
    + leadForm('snm', 'free_api_key')
    + '</section>';
}

function pageSnmDocs() {
  return '<section style="padding-top:140px"><h1>SNM docs</h1>'
    + '<h2>POST /api/v1/notify</h2>'
    + '<pre>curl -X POST https://zeusai.pro/api/v1/notify -H "Authorization: Bearer zk_..." -H "Content-Type: application/json" -d \'{"payload":"order ready","userId":"buyer"}\'</pre>'
    + '<p>The default product route signs the payload and records each channel as not contacted. POST /api/v1/notify/channels attempts the four real channels and stores each result.</p>'
    + '<h2>GET /api/v1/notify/:receiptId</h2><p>Returns the stored signed notification.</p>'
    + '<h2>GET /api/v1/pubkey</h2><p>Public key for an independent check.</p>'
    + '<p>Channel choice is fixed: websocket, webpush, nostr, smtp-fallback. The live deliver() function stops at the first channel that returns ok. The channel probe used by this product asks every channel and does not change a failure into a success.</p>'
    + '</section>';
}

function pageSnmVerify() {
  return '<section style="padding-top:140px" id="snmVerify"><h1>Verify a signed notification</h1>'
    + '<form method="post" action="/api/v1/notify/verify"><label>Signed JSON <textarea name="signed" maxlength="8000"></textarea></label><button class="btn btn-primary" type="submit">Verify</button></form>'
    + '<p>Paste the signed object. The checker uses the existing Ed25519 verify function.</p>'
    + '</section>';
}

function pageConsolidatedPricing() {
  return '<section id="fourProductPricing"><h2>Infrastructure tiers</h2>'
    + '<h3>Witness API</h3><div class="grid">' + tierCards('witness') + '</div>'
    + '<h3>Orchestrator SDK</h3><div class="grid">' + tierCards('orchestrator') + '</div>'
    + '<h3>Notification mesh</h3><div class="grid">' + tierCards('snm') + '</div>'
    + '</section>';
}

function homeSection() {
  const proof = offerings.proof();
  const count = offerings.shelfProducts().length;
  return '<section id="fourProducts">'
    + '<h2>Four products</h2>'
    + '<article class="card"><h3>Services</h3><p>' + count + ' AI services. Pay in BTC.</p><p>' + esc(proof.trustLabel) + '</p><p><a class="btn btn-primary" href="/products" data-link>Explore all ' + count + ' services →</a></p></article>'
    + '<article class="card"><h3>Infrastructure APIs</h3><p>Witness contracts on record: ' + esc(proof.witnessCount) + '. SNM deliveries in 24h: ' + esc(proof.snmDelivered24h) + '.</p><p><a class="btn" href="/api-product" data-link>Witness API</a> <a class="btn" href="/snm" data-link>SNM</a></p></article>'
    + '<article class="card"><h3>Developer tools</h3><p>One orchestrator process. Conflicts in the public ledger of this page: not measured here, so none are claimed.</p><p><a class="btn" href="/orchestrator" data-link>Orchestrator SDK</a></p></article>'
    + '</section>';
}

function meta(route) {
  const id = route.startsWith('/products/') ? decodeURIComponent(route.slice('/products/'.length).split('/')[0]) : '';
  const item = id ? offerings.productById(id) : null;
  if (item) {
    return {
      title: item.name + ' — ZeusAI service',
      description: item.description.slice(0, 180) || 'Live ZeusAI service price and Bitcoin checkout.',
    };
  }
  const map = {
    '/products': ['55 AI services', 'Pay in BTC for a named ZeusAI file. Prices come from one quote.'],
    '/api-product': ['Verifiable delivery API', 'Ed25519 signed delivery receipts and a public verification key.'],
    '/api-product/docs': ['Witness API docs', 'POST /api/v1/witness, verification, and the public key.'],
    '/api-product/pricing': ['Witness API pricing', 'Free, Pro, and Enterprise quotas. The paid prices come from the quote engine.'],
    '/orchestrator': ['One orchestrator', 'Locks, circuit breakers, and health for modules you already run.'],
    '/orchestrator/docs': ['Orchestrator SDK docs', 'Register a capability, take a lock, and deploy the existing facade.'],
    '/orchestrator/playground': ['Orchestrator playground', 'Run two mock capabilities on one lock.'],
    '/snm': ['Notification mesh', 'Signed notifications over WebSocket, Web Push, Nostr, and SMTP last.'],
    '/snm/docs': ['SNM docs', 'POST /api/v1/notify and verify the Ed25519 signature.'],
    '/snm/verify': ['Verify a notification', 'Paste a signed notification and check it with the public key.'],
  };
  const row = map[route];
  if (!row) return null;
  return { title: row[0], description: row[1] };
}

function render(route) {
  if (route === '/products') return pageProducts();
  if (route.startsWith('/products/')) {
    const id = decodeURIComponent(route.slice('/products/'.length).split('/')[0] || '');
    return pageProduct(id) || '<section style="padding-top:140px"><h1>Service not found.</h1></section>';
  }
  if (route === '/api-product') return pageApiProduct();
  if (route === '/api-product/docs') return pageApiDocs();
  if (route === '/api-product/pricing') return pageApiPricing();
  if (route === '/orchestrator') return pageOrchestrator();
  if (route === '/orchestrator/docs') return pageOrchestratorDocs();
  if (route === '/orchestrator/playground') return pagePlayground();
  if (route === '/snm') return pageSnm();
  if (route === '/snm/docs') return pageSnmDocs();
  if (route === '/snm/verify') return pageSnmVerify();
  if (route === '/ledger') return pageLedger();
  return '';
}

function pageLedger() {
  const ledger = offerings.ledgerJson();
  const rows = (ledger.deliveries || []).map((row) => '<li>' + esc(row.offerId || row.id || 'delivery') + ' · ' + esc(row.url || '') + '</li>').join('');
  return '<section style="padding-top:140px" id="publicLedger"><h1>Public ledger</h1>'
    + '<p>Public deliveries: ' + esc(ledger.count) + '. Paid humans: ' + esc(ledger.paidHumans) + '. Signed deliveries: ' + esc(ledger.signedDeliveries) + '.</p>'
    + (ledger.count ? '<ul>' + rows + '</ul>' : '<p>0 deliveries signed — be the first</p>')
    + '<p><a href="/ledger.json">ledger.json</a> · <a href="/witness.json">witness.json</a></p>'
    + '</section>';
}

module.exports = {
  render,
  meta,
  homeSection,
  pageConsolidatedPricing,
  pageProducts,
};
