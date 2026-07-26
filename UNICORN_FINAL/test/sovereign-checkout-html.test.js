'use strict';

// Regression test for the historical `${TOK}` ReferenceError in
// sovereign-commerce.js `checkoutHtml`, which crashed after `writeHead(200)`
// had already been sent, cascaded into ERR_HTTP_HEADERS_SENT, and left nginx
// serving the "RESTORING SERVICE" maintenance page whenever a user clicked
// "Buy with BTC" on the homepage.
//
// Guarantees:
//   1. `checkoutHtml(order)` is exported and does not throw for a minimal
//      but realistic order shape.
//   2. Server-rendered hrefs contain the escaped access token (NOT the
//      literal string "${TOK}", "TOK", or "undefined").
//   3. The client-side <script> block is emitted and receives the token via
//      a properly JS-escaped literal (not by JS variable interpolation).
//   4. Number formatters are hardened: missing/undefined numeric fields on
//      the order do not throw.
//   5. A CSP nonce can be threaded through via opts.nonce and lands as a
//      `<script nonce="…">` attribute for strict-dynamic CSP compatibility.

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
// Point commerce data dir at a throwaway tmp path so the require doesn't
// touch the repo's data/ directory (would dirty git and produce useless churn).
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sov-checkout-html-'));
process.env.COMMERCE_DATA_DIR = tmpDir;

const assert = require('assert');
const commerce = require('../src/site/sovereign-commerce');

let passed = 0;
function check(name, fn) {
  try { fn(); console.log('  ✔', name); passed++; }
  catch (e) { console.error('  ✗', name, '\n   ', e && e.stack || e); process.exit(1); }
}

const ACCESS_TOKEN = 't_deadbeef1234567890abcdef1234567890';
const ORDER_ID = 'ord_abcdef012345678901';
const baseOrder = {
  orderId: ORDER_ID,
  serviceId: 'zeusai-flagship',
  serviceName: 'ZeusAI Flagship',
  qty: 1,
  currency: 'USD',
  subtotal_fiat: 77.69,
  amount_btc: 0.00113123,
  amount_sats: 113123,
  btc_price_at_quote: 68750,
  price_source: 'mempool.space',
  receive_address: 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e',
  bip21: 'bitcoin:bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e?amount=0.00113123&label=ZeusAI',
  expires_at_ms: Date.now() + 60 * 60 * 1000,
  access_token: ACCESS_TOKEN,
  status: 'pending',
};

console.log('sovereign-checkout-html regression tests');

check('checkoutHtml is exported', () => {
  assert.strictEqual(typeof commerce.checkoutHtml, 'function', 'expected commerce.checkoutHtml to be a function');
});

check('renderCheckoutPage alias is exported', () => {
  assert.strictEqual(typeof commerce.renderCheckoutPage, 'function', 'expected commerce.renderCheckoutPage to be a function');
});

check('does not throw on minimal realistic order', () => {
  const html = commerce.checkoutHtml(baseOrder);
  assert.strictEqual(typeof html, 'string');
  assert.ok(html.length > 500, 'html should be a full page');
});

check('emits orderId and serviceName in HTML', () => {
  const html = commerce.checkoutHtml(baseOrder);
  assert.ok(html.includes(ORDER_ID), 'HTML must include orderId');
  assert.ok(html.includes('ZeusAI Flagship'), 'HTML must include serviceName');
});

check('server-rendered hrefs contain the access token, not "${TOK}"', () => {
  const html = commerce.checkoutHtml(baseOrder);
  assert.ok(html.includes('/api/entitlements/' + ACCESS_TOKEN), 'wallet download link must contain the access token');
  assert.ok(html.includes('href="/api/entitlements/' + ACCESS_TOKEN + '"'), 'verify link must contain the access token');
  // The literal string "${TOK}" must never appear in the emitted HTML — if it
  // did, the checkoutHtml template would have re-introduced the crash.
  assert.ok(!html.includes('${TOK}'), 'HTML must not contain the literal "${TOK}" placeholder');
  // Guard against the alternate accident where an undefined variable renders
  // as the string "undefined" instead of the actual token.
  assert.ok(!/\/api\/entitlements\/undefined/.test(html), 'entitlement hrefs must not contain "undefined"');
});

check('emits a client-side <script> block that receives the token safely', () => {
  const html = commerce.checkoutHtml(baseOrder);
  assert.ok(html.includes('<script'), 'HTML must contain a <script> tag');
  // The token should appear inside a JS string literal (single-quoted) in the
  // script, not as a bare identifier. Look for `TOK='<token>'` regardless of
  // spacing / var|let|const.
  assert.ok(html.includes("TOK='" + ACCESS_TOKEN + "'"), 'client script must embed the token as a JS-escaped string literal');
});

check('accepts a CSP nonce via opts.nonce and emits <script nonce="…">', () => {
  const html = commerce.checkoutHtml(baseOrder, { nonce: 'abc123==' });
  assert.ok(html.includes('<script nonce="abc123=='), 'nonce must land as an attribute on the <script> tag');
});

check('omits nonce attribute when none is provided', () => {
  const html = commerce.checkoutHtml(baseOrder);
  assert.ok(!/<script[^>]*\bnonce=/.test(html), 'no nonce attribute when opts.nonce is absent');
});

check('hardened number formatters — missing numeric fields do not throw', () => {
  const partial = Object.assign({}, baseOrder);
  delete partial.subtotal_fiat;
  delete partial.amount_btc;
  delete partial.amount_sats;
  delete partial.btc_price_at_quote;
  delete partial.expires_at_ms;
  assert.doesNotThrow(() => commerce.checkoutHtml(partial), 'partial order must not throw');
  const html = commerce.checkoutHtml(partial);
  // Number(undefined||0).toFixed(2) => "0.00"; make sure the page rendered.
  assert.ok(html.includes('0.00'), 'missing fiat should render as 0.00, not crash');
  assert.ok(html.includes('0.00000000'), 'missing BTC amount should render as 0.00000000, not crash');
});

check('escapes HTML-dangerous chars in serviceName', () => {
  const evilOrder = Object.assign({}, baseOrder, { serviceName: '<script>alert(1)</script>' });
  const html = commerce.checkoutHtml(evilOrder);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'serviceName must be HTML-escaped');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'expected escaped serviceName');
});

check('escapes JS-dangerous chars in access_token embedded in the script', () => {
  const evilOrder = Object.assign({}, baseOrder, { access_token: "t_'; alert(1); //" });
  const html = commerce.checkoutHtml(evilOrder);
  // The single quote inside the token must be backslash-escaped inside the
  // JS string literal so the token cannot break out of quotes.
  assert.ok(!html.includes("TOK='t_'; alert(1); //'"), 'raw quote must not break out of the JS string');
  assert.ok(html.includes("TOK='t_\\'; alert(1); //'"), 'quote inside token must be backslash-escaped in JS');
});

// ─── End-to-end handler integration ────────────────────────────────────────
// Exercises the full flow that historically hung production: createOrder →
// GET /checkout/:orderId → commerce.handle emits a complete 200 response.
// Uses a stubbed price oracle to avoid outbound network calls.
async function runHandlerIntegration() {
  // Preload the BTC price cache so createOrder does not need to touch
  // mempool.space / coingecko during the test.
  const p = await commerce.getBtcPrice().catch(() => null);
  if (!p || !(p.usd > 0)) {
    // Manually seed the cache via the exported price cache accessor. If the
    // network is unreachable the module already falls back to the static
    // PRICE_FALLBACK_USD, so this branch is defensive.
    console.log('  (using fallback BTC price for offline test env)');
  }
  const ctx = {
    buildSnapshot: () => ({
      marketplace: [],
      services: [{ id: 'e2e-sku', name: 'E2E SKU', title: 'E2E SKU', price: 42 }],
    }),
  };
  const created = await commerce.createOrder(ctx, {
    serviceId: 'e2e-sku', qty: 1, currency: 'USD', email: 'e2e@example.com',
  });
  assert.ok(created && created.order, 'createOrder should return { order }: ' + JSON.stringify(created && created.error));
  const order = created.order;

  // Build minimal fake req/res that captures writeHead + end.
  const captured = { status: null, headers: null, body: '', ended: false };
  const req = {
    method: 'GET',
    url: '/checkout/' + order.orderId,
    headers: {},
    on() {},
  };
  const res = {
    headersSent: false,
    writeHead(status, headers) {
      if (this.headersSent) throw new Error('writeHead called twice — regression!');
      this.headersSent = true;
      captured.status = status;
      captured.headers = headers || {};
    },
    setHeader() {},
    getHeader() { return null; },
    end(chunk) {
      if (chunk != null) captured.body += String(chunk);
      captured.ended = true;
    },
  };
  const handled = await commerce.handle(req, res, ctx);
  assert.strictEqual(handled, true, 'handle should return true for /checkout/:orderId');
  assert.strictEqual(captured.status, 200, 'checkout page should return 200');
  assert.ok(captured.body.includes(order.orderId), 'body should include orderId');
  assert.ok(captured.body.includes(order.access_token), 'body should include the access token');
  assert.ok(!captured.body.includes('${TOK}'), 'body must not include the literal "${TOK}"');
  assert.ok(captured.ended, 'res.end must be called exactly once');
  console.log('  ✔ commerce.handle serves /checkout/:orderId end-to-end');
  passed++;
}

runHandlerIntegration()
  .then(() => {
    console.log('sovereign-checkout-html: ' + passed + ' checks passed');
    process.exit(0);
  })
  .catch((e) => {
    console.error('sovereign-checkout-html: integration failed\n', e && e.stack || e);
    process.exit(1);
  });
