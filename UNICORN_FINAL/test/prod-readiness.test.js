'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.COMMERCE_WATCH_MS = '9999999';
process.env.INTERNAL_SETTLE_SECRET = 'test-settle-secret-prod-readiness';
delete process.env.RESEND_API_KEY;
delete process.env.BREVO_API_KEY;
delete process.env.SENDINBLUE_API_KEY;
delete process.env.MAILERSEND_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.AUDIT_SCAN_ALLOW_LOOPBACK;

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-readiness-'));
process.env.COMMERCE_DATA_DIR = path.join(tmp, 'commerce');

const commerce = require('../src/site/sovereign-commerce');
const engine = require('../src/site/v2/fulfillment-engine');
const audit = require('../src/commerce/audit-scan');
const integration = require('../src/commerce/integration-status');
const census = require('../backend/modules/module-census-os');

let passed = 0;
function check(name, fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.then(() => {
      passed += 1;
      console.log('✓', name);
    });
  }
  passed += 1;
  console.log('✓', name);
  return Promise.resolve();
}

function jsonReq(url, body, headers) {
  const req = Readable.from([JSON.stringify(body || {})]);
  req.url = url;
  req.method = 'POST';
  req.headers = Object.assign({ 'content-type': 'application/json' }, headers || {});
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
    end(chunk) {
      this.body += chunk || '';
    },
    json() {
      return this.body ? JSON.parse(this.body) : {};
    },
  };
}

function seed(id, extra) {
  const order = Object.assign({
    orderId: id,
    serviceId: 'instant-website-audit',
    serviceName: 'Instant Website Audit (AI)',
    status: 'pending',
    access_token: 'tok_' + id,
    amount_sats: 1000,
    amount_btc: 0.0001,
    subtotal_fiat: 49,
    currency: 'USD',
    buyer: { email: 'buyer-audit-test@example.com' },
    meta: {},
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    expires_at_ms: Date.now() + 3600000,
    txids: [],
  }, extra || {});
  commerce.ORDERS.set(id, order);
  return order;
}

async function post(orderId, body, headers) {
  const res = jsonRes();
  const handled = await commerce.handle(jsonReq('/api/order/' + orderId + '/provider-settle', body, headers), res, {});
  assert.equal(handled, true);
  return res;
}

(async function main() {
  await check('a buyer access token cannot mark an order paid', async () => {
    const order = seed('ord_tokenhole01');
    const res = await post(order.orderId, {
      access_token: order.access_token,
      provider: 'paypal',
      providerRef: 'FAKE',
      amountUsd: 49,
    });
    assert.equal(res.statusCode, 401);
    assert.equal(commerce.ORDERS.get(order.orderId).status, 'pending');
  });

  await check('paypal settle requires the verified amount', async () => {
    const order = seed('ord_amountreq01');
    const headers = { 'x-internal-settle-secret': process.env.INTERNAL_SETTLE_SECRET };
    const missing = await post(order.orderId, { provider: 'paypal', providerRef: 'CAP1' }, headers);
    assert.equal(missing.statusCode, 402);
    assert.equal(missing.json().error, 'provider_amount_required');
    assert.equal(commerce.ORDERS.get(order.orderId).status, 'pending');
    const wrong = await post(order.orderId, { provider: 'paypal', providerRef: 'CAP1', amountUsd: 1 }, headers);
    assert.equal(wrong.statusCode, 402);
    assert.equal(wrong.json().error, 'provider_amount_mismatch');
    assert.equal(commerce.ORDERS.get(order.orderId).status, 'pending');
  });

  await check('a verified paypal amount settles once', async () => {
    const order = seed('ord_paidonce01');
    const headers = { 'x-internal-settle-secret': process.env.INTERNAL_SETTLE_SECRET };
    const body = { provider: 'paypal', providerRef: 'CAP99', amountUsd: 49, currency: 'USD' };
    const first = await post(order.orderId, body, headers);
    assert.equal(first.statusCode, 200);
    assert.equal(commerce.ORDERS.get(order.orderId).status, 'paid');
    const entitlement = commerce.ORDERS.get(order.orderId).entitlement_id;
    const second = await post(order.orderId, body, headers);
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().duplicate, true);
    assert.equal(commerce.ORDERS.get(order.orderId).entitlement_id, entitlement);
  });

  await check('nowpayments waiting does not fulfill', async () => {
    const order = seed('ord_npwait01');
    const headers = { 'x-internal-settle-secret': process.env.INTERNAL_SETTLE_SECRET };
    const res = await post(order.orderId, {
      provider: 'nowpayments',
      providerRef: 'np1',
      amountUsd: 49,
      paymentStatus: 'waiting',
    }, headers);
    assert.equal(res.statusCode, 202);
    assert.equal(res.json().ok, false);
    assert.equal(commerce.ORDERS.get(order.orderId).status, 'pending');
  });

  await check('recovery records NOT CONFIGURED and does not claim a send', async () => {
    seed('ord_mailidle01');
    const out = await commerce.recoverStuckPending({ stuckAfterMs: 1000, notifyOwner: false });
    assert.equal(out.mailStatus, 'NOT CONFIGURED');
    assert.ok(out.requiredEnv.includes('RESEND_API_KEY'));
    assert.ok(out.requiredEnv.includes('BREVO_API_KEY'));
    assert.ok(out.requiredEnv.includes('SMTP_PASS'));
    const order = commerce.ORDERS.get('ord_mailidle01');
    assert.equal(order.email_recovery.status, 'NOT CONFIGURED');
    assert.equal(order.email_recovery.sent, false);
    assert.equal(order.email_recovery.reason, 'email_unconfigured');
    const res = jsonRes();
    const req = Readable.from([]);
    req.url = '/api/order/ord_mailidle01/status';
    req.method = 'GET';
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    await commerce.handle(req, res, {});
    const status = res.json();
    assert.equal(status.email_recovery.status, 'NOT CONFIGURED');
    assert.equal(status.email_recovery.sent, false);
    assert.equal(JSON.stringify(status).includes('buyer-audit-test@example.com'), false);
  });

  await check('integration status names missing mail and stripe without secrets', () => {
    const snap = integration.snapshot();
    assert.equal(snap.rails.email.status, 'NOT CONFIGURED');
    assert.equal(snap.rails.stripe.status, 'NOT CONFIGURED');
    assert.equal(snap.rails.websiteAudit.status, 'OPERATIONAL');
    assert.equal(JSON.stringify(snap).includes('sk_'), false);
    assert.ok(snap.rails.email.requiredEnv.includes('SMTP_PASS'));
  });

  await check('the audit fetches the submitted page and scores only that page', async () => {
    const pages = {
      '/alpha': '<!DOCTYPE html><html lang="en"><head><title>Alpha Audit Title</title><meta name="description" content="Alpha description from the fetched page."><link rel="canonical" href="http://127.0.0.1/alpha"></head><body><h1>Alpha</h1><img src="/a.png" alt="a"></body></html>',
      '/beta': '<!DOCTYPE html><html><head><title>Beta Only Title</title></head><body><h1>One</h1><h1>Two</h1><img src="/b.png"></body></html>',
    };
    const server = http.createServer((req, res) => {
      const html = pages[req.url] || '';
      res.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'max-age=30' });
      res.end(html);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    process.env.AUDIT_SCAN_ALLOW_LOOPBACK = '1';
    try {
      const alpha = await engine.fulfillService({
        id: 'ord-audit-alpha',
        serviceId: 'instant-website-audit',
        status: 'paid',
        meta: { inputs: { url: 'http://127.0.0.1:' + port + '/alpha' } },
      }, 'instant-website-audit');
      assert.ok(alpha.content.includes('Alpha Audit Title'));
      assert.ok(alpha.content.includes('Measured score: 6 of 6'));
      assert.equal(alpha.content.includes('Beta Only Title'), false);
      const beta = await engine.fulfillService({
        id: 'ord-audit-beta',
        serviceId: 'instant-website-audit',
        status: 'paid',
        meta: { inputs: { url: 'http://127.0.0.1:' + port + '/beta' } },
      }, 'instant-website-audit');
      assert.ok(beta.content.includes('Beta Only Title'));
      assert.ok(beta.content.includes('Measured score: 2 of 6'));
      assert.equal(beta.content.includes('Alpha Audit Title'), false);
      assert.ok(beta.content.includes('Images missing an alt attribute: 1'));
    } finally {
      delete process.env.AUDIT_SCAN_ALLOW_LOOPBACK;
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await check('a blocked or failed fetch does not invent a score', async () => {
    const blocked = await audit.scan('http://169.254.169.254/latest/meta-data');
    assert.equal(blocked.fetched, false);
    assert.equal(blocked.score, null);
    assert.equal(blocked.reason, 'blocked_host');
    const file = await engine.fulfillService({
      id: 'ord-audit-fail',
      serviceId: 'instant-website-audit',
      status: 'paid',
      meta: { inputs: { url: 'http://169.254.169.254/latest/meta-data' } },
    }, 'instant-website-audit');
    assert.ok(file.content.includes('No score is filled in'));
    assert.ok(file.content.includes('blocked_host'));
    assert.equal(file.content.includes('Measured score:'), false);
    const preview = engine.buyerFile({
      id: 'instant-website-audit',
      title: 'Instant Website Audit (AI)',
      description: 'The file is a Markdown audit.',
      priceUsd: 49,
      mode: 'checkout',
      clock: 'minutes',
    });
    assert.ok(preview.includes('No score is filled in'));
    assert.equal(preview.includes('Measured score:'), false);
  });

  await check('census does not flag a key-rejection file as a stub', () => {
    census.clearCache();
    const row = census.find('paymentGateway');
    assert.ok(row);
    assert.equal(row.placeholder, false);
    const discovery = census.discovery();
    assert.ok(discovery.files > 600);
    assert.equal(discovery.placeholders, 0);
  });

  await check('a card invoice keeps NOWPayments as the provider and card as the request', () => {
    const attr = require('../src/commerce/invoice-attribution');
    const order = seed('ord_attrcard01', { meta: { rail: 'card' }, buyer: { email: 'buyer-audit-test@example.com' } });
    attr.stampOpen(order, { requestedRail: 'card', provider: 'nowpayments', transactionId: 'np_inv_1', paymentStatus: 'waiting' });
    assert.equal(order.invoice.provider, 'nowpayments');
    assert.equal(order.invoice.requestedRail, 'card');
    assert.equal(order.invoice.invoiceStatus, 'open');
    const headers = { 'x-internal-settle-secret': process.env.INTERNAL_SETTLE_SECRET };
    return post(order.orderId, {
      provider: 'nowpayments',
      providerRef: 'np_pay_9',
      amountUsd: 49,
      paymentStatus: 'finished',
    }, headers).then((res) => {
      assert.equal(res.statusCode, 200);
      const saved = commerce.ORDERS.get(order.orderId);
      assert.equal(saved.invoice.provider, 'nowpayments');
      assert.equal(saved.invoice.requestedRail, 'card');
      assert.equal(saved.invoice.transactionId, 'np_pay_9');
      assert.equal(saved.invoice.paymentStatus, 'paid');
      assert.equal(saved.invoice.product, 'instant-website-audit');
      assert.equal(saved.invoice.amount, 49);
      assert.equal(saved.invoice.currency, 'USD');
      assert.equal(saved.paid_via, 'nowpayments');
      const view = attr.publicView(saved);
      assert.equal(JSON.stringify(view).includes('buyer-audit-test@example.com'), false);
    });
  });

  await check('a stripe settlement is not recorded as NOWPayments or Bitcoin', () => {
    const attr = require('../src/commerce/invoice-attribution');
    const order = seed('ord_attrstripe01', { meta: { selectedRail: 'card' } });
    attr.stampOpen(order, { requestedRail: 'card', provider: 'nowpayments' });
    const headers = { 'x-internal-settle-secret': process.env.INTERNAL_SETTLE_SECRET };
    return post(order.orderId, {
      provider: 'stripe',
      providerRef: 'pi_test_1',
      amountUsd: 49,
      currency: 'USD',
    }, headers).then((res) => {
      assert.equal(res.statusCode, 200);
      const saved = commerce.ORDERS.get(order.orderId);
      assert.equal(saved.invoice.provider, 'stripe');
      assert.equal(saved.invoice.transactionId, 'pi_test_1');
      assert.equal(saved.paid_via, 'stripe');
      assert.equal(attr.railFromInvoice({ metadata: { provider: 'stripe' } }), 'stripe');
      assert.equal(attr.railFromInvoice({ metadata: { provider: 'nowpayments' } }), 'nowpayments');
      assert.equal(attr.railFromInvoice({}), 'btc');
    });
  });

  await check('business modules report load state without a fake customer count', () => {
    const snap = integration.snapshot();
    assert.equal(snap.businessModules.aiDna.status, 'OPERATIONAL');
    assert.equal(snap.businessModules.aiDelivery.status, 'OPERATIONAL');
    assert.equal(snap.businessModules.aiVault.status, 'OPERATIONAL');
    assert.equal(snap.businessModules.aiConcierge.externalModel, 'NOT CONFIGURED');
    assert.equal(typeof snap.businessModules.aiWorkspace.customerInstances, 'number');
    assert.equal(JSON.stringify(snap.businessModules).includes('sk_'), false);
  });

  console.log('✅ prod-readiness: ' + passed + ' tests passed');
  process.exit(0);
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
