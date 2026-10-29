'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { citationBlock } = require('./routes');

function publishFromInvoice(invoice) {
  if (process.env.NODE_ENV === 'test' && process.env.WITNESS_PUBLISH !== '1') return null;
  if (!invoice || invoice.mock === true || String(invoice.txid || '').startsWith('simulated-')) return null;
  const orderId = String(invoice.orderId || invoice.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const offerId = String(invoice.serviceId || invoice.service || '').trim();
  if (!orderId || !offerId) return null;
  let text = '';
  try {
    text = require('../../src/site/v2/fulfillment-engine').buyerFile({ id: offerId, priceUsd: invoice.priceUsd });
  } catch (_) { text = ''; }
  text = String(text || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]');
  if (!text.includes('Public offer URL:')) text += '\n' + citationBlock(offerId);
  const root = path.join(process.env.ZEUS_DELIVERY_DIR || '/opt/zeusai/deliveries', orderId);
  fs.mkdirSync(root, { recursive: true });
  const filename = 'delivery.md';
  fs.writeFileSync(path.join(root, filename), text);
  const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({
    orderId,
    offerId,
    filename,
    sha256,
  }));
  return { hash: sha256, url: '/deliveries/' + orderId + '/' + filename };
}

module.exports = { publishFromInvoice };
