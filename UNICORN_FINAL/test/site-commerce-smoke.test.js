'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '31991';
process.env.PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
process.env.BTC_WALLET_ADDRESS = process.env.BTC_WALLET_ADDRESS || 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unicorn-site-commerce-'));
process.env.UNICORN_DATA_DIR = tmpRoot;
process.env.UNICORN_RECEIPTS_FILE = path.join(tmpRoot, 'commerce-receipts.json');

const { createServer } = require('../src/index');
const app = createServer();
const port = Number(process.env.PORT);
const base = `http://127.0.0.1:${port}`;
const wallet = process.env.BTC_WALLET_ADDRESS;
const expectedMinCatalogItems = Number(process.env.EXPECTED_MIN_CATALOG_ITEMS || 38);
const smokeEmail = 'smoke@zeusai.pro';

function cleanSmokeJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows)) return;
    const kept = rows.filter((row) => JSON.stringify(row).indexOf(smokeEmail) === -1 && JSON.stringify(row).indexOf('smoke-test-loopback') === -1);
    if (kept.length) fs.writeFileSync(filePath, JSON.stringify(kept, null, 2));
    else fs.rmSync(filePath, { force: true });
  } catch (_) {}
}

function cleanupSmokeArtifacts() {
  const dataDir = process.env.UNICORN_DATA_DIR || path.join(__dirname, '..', 'data');
  cleanSmokeJsonArray(path.join(dataDir, 'commerce-receipts.json'));
  cleanSmokeJsonArray(path.join(dataDir, 'commerce-deliveries.json'));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
}

async function request(path, options = {}) {
  const res = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  return { status: res.status, body, headers: res.headers, text };
}

async function requestFirstSseEvent(path) {
  const controller = new AbortController();
  const res = await fetch(base + path, { signal: controller.signal });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    const { value } = await reader.read();
    text += decoder.decode(value || new Uint8Array(), { stream: true });
  } finally {
    controller.abort();
    try { reader.releaseLock(); } catch (_) {}
  }
  const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
  let body = null;
  if (dataLine) body = JSON.parse(dataLine.slice(6));
  return { status: res.status, body, headers: res.headers, text };
}

function assertBtcInvoice(payload, label) {
  const btcAmount = Number(payload.btcAmount || payload.paymentInstructions?.btcAmount || payload.receipt?.btcAmount || 0);
  const btcUri = String(payload.btcUri || payload.paymentInstructions?.btcUri || payload.receipt?.btcUri || '');
  const btcAddress = String(payload.btcAddress || payload.paymentInstructions?.btcAddress || payload.receipt?.btcAddress || payload.receipt?.destination?.address || '');
  assert.ok(btcAmount > 0, `${label}: btcAmount must be > 0`);
  assert.ok(btcUri.includes(wallet) || btcAddress.includes(wallet), `${label}: invoice must route to owner BTC wallet`);
}

async function run() {
  cleanupSmokeArtifacts();
  await new Promise((resolve) => app.listen(port, '127.0.0.1', resolve));
  try {
    for (const path of ['/', '/services', '/checkout', '/pricing', '/dashboard', '/snapshot']) {
      const r = await request(path);
      assert.equal(r.status, 200, `${path} should return 200`);
    }

    const routeExpectations = {
      '/terms': 'Terms of Service — ZEUSAI',
      '/privacy': 'Privacy Policy — ZEUSAI',
      '/refund': 'Refund Guarantee — ZEUSAI',
      '/sla': 'SLA — ZEUSAI',
      '/gift': 'Gift-as-Capability — ZEUSAI',
      '/aura': 'Live Conversion Aura — ZEUSAI',
      '/api-explorer': 'API Explorer — ZEUSAI',
      '/transparency': 'Pricing Bandit Transparency — ZEUSAI',
      '/trust': 'Trust Center — ZEUSAI',
      '/security': 'Security — ZEUSAI',
      '/responsible-ai': 'Responsible AI — ZEUSAI',
      '/dpa': 'Data Processing Agreement — ZEUSAI',
      '/payment-terms': 'Payment Terms — ZEUSAI',
      '/operator': 'Operator Console — ZEUSAI',
      '/observability': 'Observability — ZEUSAI',
      '/changelog': 'Changelog — ZEUSAI'
    };
    for (const [path, title] of Object.entries(routeExpectations)) {
      const r = await request(path);
      assert.equal(r.status, 200, `${path} should return 200`);
      assert.ok(r.text.includes(`<title>${title}</title>`), `${path} should render its own title`);
      assert.ok(!r.text.includes('<title>Sovereign AI OS — ZEUSAI</title>'), `${path} must not fall back to homepage title`);
    }

    const robots = await request('/robots.txt');
    assert.equal(robots.status, 200, '/robots.txt should return 200');
    assert.match(robots.text, /Sitemap:\s*https:\/\/zeusai\.pro\/sitemap\.xml/);

    const sitemap = await request('/sitemap.xml');
    assert.equal(sitemap.status, 200, '/sitemap.xml should return 200');
    assert.match(sitemap.text, /<loc>https:\/\/zeusai\.pro\/terms<\/loc>/);

    const integrity = await request('/.well-known/unicorn-integrity.json');
    assert.equal(integrity.status, 200, '/.well-known/unicorn-integrity.json should return 200');
    assert.equal(integrity.body.alg, 'Ed25519');

    for (const path of ['/api/trust/center', '/api/operator/console', '/api/observability/status', '/api/secret-sync/status', '/api/payments/config/status', '/api/security/pq/status', '/api/commerce/protocol', '/api/innovation/coverage', '/api/checkout/synthetic-probe', '/api/capability/credential/smoke']) {
      const r = await request(path);
      assert.equal(r.status, 200, `${path} should return 200`);
      assert.equal(r.body.ok, true, `${path} should return ok:true`);
    }

    const paymentStatus = await request('/api/payments/config/status');
    assert.equal(paymentStatus.body.primaryRail, 'btc-direct');
    assert.equal(paymentStatus.body.primaryPayout.address, wallet);
    assert.equal(paymentStatus.body.nowpayments.requiredForCurrentMode, false);

    const secretStatus = await request('/api/secret-sync/status');
    assert.ok(secretStatus.body.requiredOperationalSecrets.includes('BTC_WALLET_ADDRESS'));
    assert.ok(!secretStatus.body.requiredOperationalSecrets.includes('NOWPAYMENTS_API_KEY'));
    assert.ok(secretStatus.body.optionalProviderSecrets.includes('NOWPAYMENTS_API_KEY'));
    assert.equal(secretStatus.body.autoPopulate.enabled, true);
    assert.equal(secretStatus.body.autoPopulate.fillsAliases, true);
    assert.equal(secretStatus.body.autoPopulate.generatesInternalRuntimeSecrets, true);
    assert.ok(secretStatus.body.configured.some(item => item.name === 'OWNER_BTC_ADDRESS' && item.configured));
    assert.ok(secretStatus.body.configured.some(item => item.name === 'ADMIN_TOKEN' && item.configured));

    const coverage = await request('/api/innovation/coverage');
    assert.equal(coverage.status, 200);
    assert.ok(coverage.body.summary.total >= 12);
    assert.ok(coverage.body.items.some(item => item.id === 'frontier-f1-f12' && item.status.startsWith('live')));
    assert.ok(coverage.body.items.some(item => item.id === 'passkey-auth' && item.status === 'live-100-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'transparency-ledger' && item.status === 'live-100-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'global-compliance-autopilot' && item.status === 'live-foundation'));
    assert.ok(coverage.body.items.some(item => item.id === 'autonomous-money-machine' && item.status === 'live-100-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'unicorn-commerce-connector' && item.status === 'live-100-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'future-invention-foundry' && item.status === 'live-rd-foundation'));
    assert.ok(coverage.body.items.some(item => item.id === 'billion-scale-revenue-foundation' && item.status === 'live-foundation-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'billion-scale-activation-orchestrator' && item.status === 'live-activation-api'));
    assert.ok(coverage.body.items.some(item => item.id === 'nowpayments' && item.status.includes('optional-later')));
    assert.ok(coverage.body.secrets.featureSummary.totalKnownSecrets >= 1);

    // Test query-string resilience on critical endpoints
    const healthWithQuery = await request('/health?cachebuster=123&debug=1');
    assert.equal(healthWithQuery.status, 200, '/health with query params should return 200');
    assert.equal(healthWithQuery.body.ok, true, '/health with query params should return ok:true');

    const snapshotWithQuery = await request('/snapshot?format=json&v=latest');
    assert.equal(snapshotWithQuery.status, 200, '/snapshot with query params should return 200');
    assert.ok(snapshotWithQuery.body.services, '/snapshot with query params should return services');

    const streamWithQuery = await requestFirstSseEvent('/stream?user=demo&session=abc');
    assert.equal(streamWithQuery.status, 200, '/stream with query params should return 200');
    assert.ok(streamWithQuery.body.services, '/stream with query params should return services');

    const catalog = await request('/api/catalog/master');
    assert.equal(catalog.status, 200);
    assert.ok(Array.isArray(catalog.body.items), 'catalog.items must be an array');
    assert.ok(
      catalog.body.items.length >= expectedMinCatalogItems,
      `master catalog must expose at least ${expectedMinCatalogItems} service deliverables`
    );
    assert.equal(catalog.body.connector.payout.btcAddress, wallet);
    assert.ok(catalog.body.counts.strategicPackages >= 5, 'catalog must expose billion-scale strategic packages');
    assert.ok(catalog.body.counts.activationProducts >= 1, 'catalog must expose Unicorn activation product');
    assert.ok(catalog.body.counts.unicornAuto >= 1, 'catalog must auto-commercialize Unicorn modules');
    assert.ok(catalog.body.counts.futurePrimitives >= 7, 'catalog must expose future invention primitives');
    assert.ok(catalog.body.items.some(item => item.group === 'billion-scale-activation' && item.checkout.btcAddress === wallet));
    assert.ok(catalog.body.items.some(item => item.group === 'billion-scale-package' && item.checkout.btcAddress === wallet));
    assert.ok(catalog.body.items.some(item => item.group === 'future-invention' && item.checkout.btcAddress === wallet));

    const billionStatus = await request('/api/billion-scale/status');
    assert.equal(billionStatus.status, 200);
    assert.equal(billionStatus.body.ok, true);
    assert.equal(billionStatus.body.payout.btcAddress, wallet);
    assert.ok(billionStatus.body.maxPackageUsd >= 1000000);

    const billionPackages = await request('/api/billion-scale/packages');
    assert.equal(billionPackages.status, 200);
    assert.equal(billionPackages.body.ok, true);
    assert.ok(billionPackages.body.items.every(item => item.checkout.btcAddress === wallet));

    const billionDashboard = await request('/api/billion-scale/dashboard');
    assert.equal(billionDashboard.status, 200);
    assert.equal(billionDashboard.body.ok, true);
    assert.equal(billionDashboard.body.payout.btcAddress, wallet);

    const billionEconomics = await request('/api/billion-scale/marketplace-economics');
    assert.equal(billionEconomics.status, 200);
    assert.equal(billionEconomics.body.ok, true);
    assert.ok(billionEconomics.body.annualRevenueUsd >= 1000000000);

    const billionProposal = await request('/api/billion-scale/deal-desk/proposal', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'zeusai-sovereign-ai-private-deployment', company: 'Smoke Enterprise' })
    });
    assert.equal(billionProposal.status, 200);
    assert.equal(billionProposal.body.ok, true);
    assert.equal(billionProposal.body.btcCheckout.btcAddress, wallet);

    const billionVerticalPages = await request('/api/billion-scale/vertical-pages');
    assert.equal(billionVerticalPages.status, 200);
    assert.equal(billionVerticalPages.body.ok, true);
    assert.ok(billionVerticalPages.body.count >= 10);

    const activationStatus = await request('/api/billion-scale/activation/status');
    assert.equal(activationStatus.status, 200);
    assert.equal(activationStatus.body.ok, true);
    assert.equal(activationStatus.body.payout.btcAddress, wallet);
    assert.ok(activationStatus.body.summary.capabilityCount >= 8);

    const activationModules = await request('/api/billion-scale/activation/modules');
    assert.equal(activationModules.status, 200);
    assert.equal(activationModules.body.ok, true);
    assert.ok(activationModules.body.generatedControlModules.some(item => item.id === 'billion-scale-activation-orchestrator'));

    const activationRun = await request('/api/billion-scale/activation/run', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'zeusai-revenue-machine', company: 'Smoke Activation Buyer' })
    });
    assert.equal(activationRun.status, 200);
    assert.equal(activationRun.body.ok, true);
    assert.equal(activationRun.body.payout.btcAddress, wallet);

    const commerceStatus = await request('/api/unicorn-commerce/status');
    assert.equal(commerceStatus.status, 200);
    assert.equal(commerceStatus.body.ok, true);
    assert.equal(commerceStatus.body.payout.btcAddress, wallet);
    assert.ok(commerceStatus.body.sellsFuturePrimitives >= 7);

    const futurePrimitives = await request('/api/unicorn-commerce/future-primitives');
    assert.equal(futurePrimitives.status, 200);
    assert.equal(futurePrimitives.body.ok, true);
    assert.ok(futurePrimitives.body.items.every(item => item.autonomy.claimsGuardrail));

    const btcSpot = await request('/api/btc/spot');
    assert.equal(btcSpot.status, 200);
    assert.ok(Number(btcSpot.body.usdPerBtc) > 0, 'BTC spot rate must be positive');
    assert.equal(btcSpot.body.btcAddress, wallet);

    // Test /api/btc/spot with query params (should be ignored but not break)
    const btcSpotWithQuery = await request('/api/btc/spot?cache=0&format=extended');
    assert.equal(btcSpotWithQuery.status, 200, '/api/btc/spot with query params should return 200');
    assert.ok(Number(btcSpotWithQuery.body.usdPerBtc) > 0, '/api/btc/spot with query params should return valid rate');

    const uiCheckout = await request('/api/uaic/order', {
      method: 'POST',
      body: JSON.stringify({ method: 'BTC', plan: 'adaptive-ai', amount_usd: 499, email: smokeEmail })
    });
    assert.equal(uiCheckout.status, 200);
    assert.equal(uiCheckout.body.ok, true);
    assertBtcInvoice(uiCheckout.body, '/api/uaic/order');
    const receiptId = uiCheckout.body.receipt.id;

    const receiptBeforePay = await request('/api/receipt/' + encodeURIComponent(receiptId));
    assert.equal(receiptBeforePay.status, 200);
    assert.equal(receiptBeforePay.body.receipt.status, 'pending');

    const confirm = await request('/api/payments/btc/confirm', {
      method: 'POST',
      body: JSON.stringify({ receiptId, txid: 'smoke-test-loopback', amount: 499 })
    });
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.ok, true);
    assert.equal(confirm.body.receipt.status, 'paid');

    const license = await request('/api/license/' + encodeURIComponent(receiptId));
    assert.equal(license.status, 200);
    assert.ok(license.body.license && license.body.license.token, 'paid receipt must deliver a license token');

    const delivery = await request('/api/delivery/' + encodeURIComponent(receiptId));
    assert.equal(delivery.status, 200);
    assert.equal(delivery.body.ok, true);
    assert.equal(delivery.body.delivery.status, 'delivered');
    assert.ok(Array.isArray(delivery.body.delivery.items) && delivery.body.delivery.items.length >= 1, 'paid receipt must create delivery items');
    assert.ok(delivery.body.delivery.items[0].files.length >= 2, 'delivery must expose downloadable files');

    const apiKeyDelivery = await request('/api/delivery/' + encodeURIComponent(receiptId) + '?format=api-key&serviceId=adaptive-ai');
    assert.equal(apiKeyDelivery.status, 200);
    assert.ok(apiKeyDelivery.body.delivery.apiKey && apiKeyDelivery.body.delivery.apiKey.startsWith('zai_'), 'delivery must expose a service API key');

    const onboardingDelivery = await request('/api/delivery/' + encodeURIComponent(receiptId) + '?format=onboarding&serviceId=adaptive-ai');
    assert.equal(onboardingDelivery.status, 200);
    assert.ok(Array.isArray(onboardingDelivery.body.delivery.requiredInputs), 'delivery must expose onboarding inputs');

    const unauthorizedRefund = await request('/api/admin/commerce/refund', {
      method: 'POST',
      body: JSON.stringify({ receiptId, reason: 'smoke-test' })
    });
    assert.equal(unauthorizedRefund.status, 401, 'admin refund must require admin authorization');

    const directCheckout = await request('/api/checkout/btc', {
      method: 'POST',
      body: JSON.stringify({ plan: 'adaptive-ai', amountUSD: 499, customer: { email: smokeEmail } })
    });
    assert.equal(directCheckout.status, 200);
    assert.equal(directCheckout.body.ok, true);
    assertBtcInvoice(directCheckout.body, '/api/checkout/btc');

    const buy = await request('/api/services/buy', {
      method: 'POST',
      body: JSON.stringify({ serviceId: 'adaptive-ai', paymentMethod: 'BTC', amount: 499, email: smokeEmail })
    });
    assert.equal(buy.status, 200);
    assert.equal(buy.body.ok, true);
    assert.equal(buy.body.status, 'awaiting_payment');
    assertBtcInvoice(buy.body, '/api/services/buy');

    const html = await request('/');
    assert.match(html.text, /\/assets\/app\.css\?v=[a-z0-9]+/);
    assert.match(html.text, /\/assets\/app\.js\?v=[a-z0-9]+/);

    const sw = await request('/sw.js');
    assert.equal(sw.status, 200);
    assert.match(sw.text, /const V = 'unicorn-v2-[a-z0-9]+'/);
    assert.match(sw.text, /network-first with cache fallback/);

    const reset = await request('/sw-reset');
    assert.equal(reset.status, 200);
    assert.match(reset.text, /unregister/);

    console.log('site commerce smoke test passed');
  } finally {
    await new Promise((resolve, reject) => app.close((err) => err ? reject(err) : resolve()));
    cleanupSmokeArtifacts();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
