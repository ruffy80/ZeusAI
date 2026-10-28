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
const fs = require('fs');
const path = require('path');

function deliveryDir() {
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

function writePaidDelivery(invoice, activation) {
  if (!invoice || invoice.id == null || invoice.id === '') {
    return { ok: false, error: 'invoice_required' };
  }
  const dir = deliveryDir();
  const id = String(invoice.id);
  const file = path.join(dir, id + '.json');
  if (fs.existsSync(file)) {
    return { ok: true, already: true, file, mock: isMock(invoice) };
  }
  const body = {
    orderId: id,
    status: 'delivered',
    serviceId: invoice.service || invoice.serviceId || null,
    email: invoice.customerEmail || (invoice.metadata && invoice.metadata.email) || null,
    amountBtc: invoice.amountBtc || null,
    priceUsd: invoice.priceUsd || null,
    paidAt: invoice.paidAt || new Date().toISOString(),
    txid: invoice.txid || null,
    mock: isMock(invoice),
    licenseId: activation && activation.licenseId ? activation.licenseId : null,
    // Real chain payment replaces a simulated txid. A mock file is a drill.
    note: isMock(invoice)
      ? 'MOCK drill. Not a collected payment. The live path is btcPaymentVerifier → _onPaidInvoice.'
      : 'Written automatically when the invoice was marked paid.',
  };
  fs.writeFileSync(file, JSON.stringify(body, null, 2));
  return { ok: true, file, mock: body.mock };
}

async function queueDeliveryEmail(invoice) {
  const to = invoice && (invoice.customerEmail || (invoice.metadata && invoice.metadata.email));
  if (!to) return { ok: false, error: 'no_email' };
  try {
    const bridge = require('../../modules/notificationMesh/bridge');
    if (bridge.meshEnabled()) return { ok: true, skipped: 'snm', reason: 'mesh_owns_delivery' };
  } catch (_) { /* legacy mailer below */ }
  const mailer = require('../email');
  return mailer.sendMail({
    to: String(to),
    subject: 'ZeusAI delivery ' + (invoice.service || invoice.serviceId || invoice.id),
    text: 'Order ' + invoice.id + ' for ' + (invoice.service || invoice.serviceId || 'service') + ' is ready.',
    type: 'service_delivered',
    userId: String(to),
    orderId: invoice.id,
  });
}

module.exports = { writePaidDelivery, queueDeliveryEmail, deliveryDir, isMock };
