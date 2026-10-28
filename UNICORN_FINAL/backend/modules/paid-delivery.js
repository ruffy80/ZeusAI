'use strict';

/**
 * Paid delivery writer.
 *
 * The real trigger is an on-chain match in btcPaymentVerifier, which calls
 * _onPaidInvoice. That path writes the file and queues the buyer email.
 *
 * MOCK: a drill may call writePaidDelivery with mock:true or a txid that
 * starts with "simulated-". The file is marked mock and is not revenue.
 * Replace that drill with a confirmed chain payment before treating the
 * file as a collected sale.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function deliveryDir(override) {
  if (override) {
    fs.mkdirSync(override, { recursive: true });
    return override;
  }
  const preferred = process.env.ZEUS_DELIVERY_DIR || '/opt/zeusai/deliveries';
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch (_) {
    const fallback = path.join(__dirname, '..', '..', 'data', 'deliveries');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function isMock(invoice) {
  if (!invoice) return false;
  if (invoice.mock === true) return true;
  return String(invoice.txid || '').startsWith('simulated-');
}

function artifactFor(invoice) {
  const serviceId = invoice && (invoice.service || invoice.serviceId);
  if (!serviceId || isMock(invoice)) return '';
  try {
    const shelf = require('../../src/commerce/public-shelf');
    const engine = require('../../src/site/v2/fulfillment-engine');
    const item = shelf.byId(serviceId) || {
      id: serviceId,
      title: serviceId,
      mode: 'btc',
      clock: 'minutes',
      priceUsd: Number(invoice.priceUsd) || 0,
    };
    return String(engine.buyerFile(item) || '');
  } catch (_) {
    return '';
  }
}

function writePaidDelivery(invoice, activation, opts) {
  if (!invoice || invoice.id == null || invoice.id === '') {
    return { ok: false, error: 'invoice_required' };
  }
  const dir = deliveryDir(opts && opts.dir);
  const id = String(invoice.id);
  const file = path.join(dir, id + '.json');
  if (fs.existsSync(file)) {
    return { ok: true, already: true, file, mock: isMock(invoice), granted: false };
  }
  const mock = isMock(invoice);
  const token = mock ? null : crypto.randomBytes(24).toString('hex');
  const body = {
    orderId: id,
    status: mock ? 'drill' : 'delivered',
    serviceId: invoice.service || invoice.serviceId || null,
    email: invoice.customerEmail || (invoice.metadata && invoice.metadata.email) || null,
    amountBtc: invoice.amountBtc || null,
    priceUsd: invoice.priceUsd || null,
    paidAt: invoice.paidAt || new Date().toISOString(),
    txid: invoice.txid || null,
    mock,
    tokenHash: token ? crypto.createHash('sha256').update(token).digest('hex') : null,
    artifact: mock ? '' : artifactFor(invoice),
    licenseId: activation && activation.licenseId ? activation.licenseId : null,
    note: mock
      ? 'MOCK drill. Not a collected payment. The live path is btcPaymentVerifier → _onPaidInvoice.'
      : 'Written automatically when the invoice was marked paid.',
  };
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  return { ok: true, file, mock, token, granted: !mock };
}

function openDelivery(orderId, token, dir) {
  const file = path.join(deliveryDir(dir), String(orderId || '') + '.json');
  let body = null;
  try { body = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { body = null; }
  if (!body || body.mock || !body.tokenHash) return { ok: false, error: 'not_found', granted: false };
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(String(body.tokenHash));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'not_found', granted: false };
  }
  return { ok: true, granted: true, serviceId: body.serviceId, content: body.artifact || '' };
}

async function queueDeliveryEmail(invoice, token) {
  const to = invoice && (invoice.customerEmail || (invoice.metadata && invoice.metadata.email));
  if (!to) return { ok: false, error: 'no_email' };
  if (isMock(invoice)) return { ok: false, error: 'drill' };
  const mailer = require('../email');
  const link = token ? (' Retrieve it with order ' + invoice.id + ' and access token ' + token + '.') : '';
  return mailer.sendMail({
    to: String(to),
    subject: 'ZeusAI delivery ' + (invoice.service || invoice.serviceId || invoice.id),
    text: 'Order ' + invoice.id + ' for ' + (invoice.service || invoice.serviceId || 'service') + ' is ready.' + link,
  });
}

module.exports = { writePaidDelivery, openDelivery, queueDeliveryEmail, deliveryDir, isMock };
