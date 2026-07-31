'use strict';

process.env.DISABLE_SELF_MUTATION = '1';
process.env.NODE_ENV = 'test';
process.env.COMMERCE_WATCH_MS = '9999999';
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || 'test-admin-secret-payment-rails';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');

const ROOT = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'payment-rails-perfection-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let failed = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log('  ok  ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + label + ' — ' + (e && e.message ? e.message : e));
  }
}

function seedOrder(commerce, overrides) {
  const order = Object.assign({
    orderId: 'ord_payrails01',
    serviceId: 'starter',
    serviceName: 'Starter',
    status: 'pending',
    access_token: 't_payrails01',
    amount_sats: 123456,
    amount_btc: 0.00123456,
    subtotal_fiat: 49,
    currency: 'USD',
    buyer: { email: 'buyer@example.com' },
    meta: {},
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    expires_at_ms: Date.now() + 3600000,
    txids: [],
  }, overrides || {});
  commerce.ORDERS.set(order.orderId, order);
  return order;
}

function jsonReq(url, body) {
  const req = Readable.from([JSON.stringify(body || {})]);
  req.url = url;
  req.method = 'POST';
  req.headers = { 'content-type': 'application/json' };
  req.socket = { remoteAddress: '127.0.0.1' };
  return req;
}

function jsonRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers || {};
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(chunk) {
      this.body += chunk || '';
    },
    json() {
      return this.body ? JSON.parse(this.body) : {};
    },
  };
}

(async () => {
  await check('NOWPayments partially_paid is not confirmed or emitted', () => {
    const nowPayments = require('../backend/modules/nowPayments');
    global._unicornEventBus = new EventEmitter();
    let emitted = false;
    global._unicornEventBus.on('payment:confirmed', () => { emitted = true; });
    const result = nowPayments.processWebhook({
      payment_id: 'np_partial_1',
      payment_status: 'partially_paid',
      order_id: 'ord_partial01',
      price_amount: 49,
      actually_paid: 12,
      invoice_id: 'inv_partial_1',
    });
    assert.equal(result.status, 'partially_paid');
    assert.equal(emitted, false);
    assert.equal(result.confirmedAt, undefined);
  });

  await check('NOWPayments confirmed emit includes settlement fields', () => {
    const nowPayments = require('../backend/modules/nowPayments');
    global._unicornEventBus = new EventEmitter();
    let evt = null;
    global._unicornEventBus.on('payment:confirmed', (payload) => { evt = payload; });
    nowPayments.processWebhook({
      payment_id: 'np_confirmed_1',
      payment_status: 'confirmed',
      order_id: 'ord_confirmed01',
      price_amount: 49,
      actually_paid: 49,
      invoice_id: 'inv_confirmed_1',
    });
    assert.equal(evt && evt.price_amount, 49);
    assert.equal(evt && evt.actually_paid, 49);
    assert.equal(evt && evt.invoice_id, 'inv_confirmed_1');
    assert.equal(evt && evt.order_id, 'ord_confirmed01');
  });

  await check('markOrderPaidFromProvider keeps PayPal refs out of txids', () => {
    const commerce = require('../src/site/sovereign-commerce');
    const order = seedOrder(commerce, { orderId: 'ord_paypalrefs01' });
    const result = commerce.markOrderPaidFromProvider(order.orderId, { provider: 'paypal', providerRef: 'CAPTURE123' });
    const saved = commerce.ORDERS.get(order.orderId);
    assert.equal(result.ok, true);
    assert.deepEqual(saved.txids, []);
    assert.ok(saved.provider_refs.some((r) => r.provider === 'paypal' && r.ref === 'CAPTURE123'));
    assert.equal(saved.paid_via, 'paypal');
    assert.equal(saved.provider_settle.providerRef, 'CAPTURE123');
  });

  await check('PayPal capture amount mismatch rejects with 402 before paid', async () => {
    process.env.PAYPAL_CLIENT_ID = 'paypal_client_test_123';
    process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test_123';
    const commerce = require('../src/site/sovereign-commerce');
    const order = seedOrder(commerce, {
      orderId: 'ord_paypalmismatch01',
      access_token: 't_mismatch01',
      subtotal_fiat: 49,
      meta: { paypalOrderId: 'PAYPALORDER1' },
    });
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      const text = String(url);
      if (text.includes('/v1/oauth2/token')) {
        return { ok: true, json: async () => ({ access_token: 'access-token' }) };
      }
      if (text.includes('/v2/checkout/orders/PAYPALORDER1/capture')) {
        return {
          ok: true,
          json: async () => ({
            status: 'COMPLETED',
            purchase_units: [{
              reference_id: order.orderId,
              custom_id: 'external-cart-id',
              payments: { captures: [{ id: 'CAPTURE_MISMATCH', status: 'COMPLETED', amount: { value: '48.00', currency_code: 'USD' } }] },
            }],
          }),
        };
      }
      throw new Error('unexpected fetch ' + text);
    };
    try {
      const res = jsonRes();
      const handled = await commerce.handle(jsonReq('/api/order/' + order.orderId + '/paypal/capture', {
        access_token: order.access_token,
        paypalOrderId: 'PAYPALORDER1',
      }), res, {});
      assert.equal(handled, true);
      assert.equal(res.statusCode, 402);
      assert.match(res.json().detail, /amount_mismatch/);
      assert.equal(commerce.ORDERS.get(order.orderId).status, 'pending');
    } finally {
      global.fetch = originalFetch;
    }
  });

  await check('settle-ready requires PayPal webhook and NOWPayments IPN', () => {
    delete process.env.NOWPAYMENTS_API_KEY;
    delete process.env.NOWPAYMENTS_IPN_SECRET;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_SECRET;
    delete process.env.PAYPAL_WEBHOOK_ID;
    const paymentGateway = require('../backend/modules/paymentGateway');
    process.env.NOWPAYMENTS_API_KEY = 'np_live_test_key_abcdef123456';
    assert.ok(!paymentGateway.getPaymentMethods().some((m) => m.id === 'nowpayments'));
    process.env.NOWPAYMENTS_IPN_SECRET = 'np_ipn_secret_abcdef123456';
    assert.ok(paymentGateway.getPaymentMethods().some((m) => m.id === 'nowpayments' && m.settleReady));
    process.env.PAYPAL_CLIENT_ID = 'paypal_client_test_123';
    process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test_123';
    assert.ok(!paymentGateway.getPaymentMethods().some((m) => m.id === 'paypal'));
    process.env.PAYPAL_WEBHOOK_ID = 'WH-123456789';
    assert.ok(paymentGateway.getPaymentMethods().some((m) => m.id === 'paypal' && m.settleReady));
    const siteSrc = read('src/index.js');
    const backendSrc = read('backend/index.js');
    assert.ok(siteSrc.includes('paypalSettleReady') && siteSrc.includes('nowSettleReady'));
    assert.ok(backendSrc.includes('paypalSettleReady') && backendSrc.includes('nowSettleReady'));
  });

  await check('provider settle queue module exists and persists JSONL', () => {
    assert.ok(read('src/site/sovereign-commerce.js').includes('function revokeOrderFromProvider'));
    assert.ok(read('backend/index.js').includes('PAYMENT.CAPTURE.REFUNDED'));
    assert.ok(read('backend/index.js').includes('provider-revoke'));
    const queue = require('../src/commerce/provider-settle-queue');
    assert.equal(typeof queue.enqueue, 'function');
    assert.equal(typeof queue.start, 'function');
    assert.equal(typeof queue.getStatus, 'function');
    const enqueued = queue.enqueue({
      orderId: 'ord_queue01',
      provider: 'nowpayments',
      providerRef: 'np_payment_1',
      amountUsd: 49,
      meta: { invoiceId: 'inv_queue_1' },
    });
    assert.equal(enqueued.ok, true);
    const queueFile = path.join(process.env.COMMERCE_DATA_DIR, 'settle-queue.jsonl');
    assert.ok(fs.existsSync(queueFile));
    assert.match(fs.readFileSync(queueFile, 'utf8'), /ord_queue01/);
  });

  await check('source contains provider-settle expected amount and invoice checks', () => {
    const commerceSrc = read('src/site/sovereign-commerce.js');
    assert.ok(commerceSrc.includes('provider_amount_mismatch'));
    assert.ok(commerceSrc.includes('paypal_capture_amount_mismatch'));
    assert.ok(commerceSrc.includes('meta.invoiceId'));
  });

  await check('settle queue alerts Telegram on discard; email includes BTC address; explorer fallback', () => {
    const queueSrc = read('src/commerce/provider-settle-queue.js');
    assert.ok(queueSrc.includes('sendTelegram'));
    assert.ok(queueSrc.includes('Provider settle queue discarded'));
    const commerceSrc = read('src/site/sovereign-commerce.js');
    assert.ok(commerceSrc.includes('btcAddress: out.order.receive_address'));
    assert.ok(commerceSrc.includes('httpJsonExplorer'));
    assert.ok(commerceSrc.includes('blockstream.info/api'));
    const monitorSrc = read('scripts/unicorn-payment-monitor.js');
    assert.ok(monitorSrc.includes('resolveTxidFromExplorers'));
    assert.ok(monitorSrc.includes('blockstream.info/api'));
    const backendSrc = read('backend/index.js');
    assert.ok(backendSrc.includes('missing_or_invalid_txid'));
  });

  if (failed) {
    console.error('payment-rails-perfection.test.js: ' + failed + ' failed');
    process.exit(1);
  }
  console.log('payment-rails-perfection.test.js: all assertions passed');
  process.exit(0);
})();
