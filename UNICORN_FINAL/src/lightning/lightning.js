// C11: Lightning integration (forward-only)
// Integrates with LND node for invoice creation and payment status.
// Only enabled if LIGHTNING_ENABLED=1 in env.

const axios = require('axios');

const LND_REST_URL = process.env.LND_REST_URL || '';
const LND_MACAROON = process.env.LND_MACAROON || '';

async function createInvoice(amountSats, memo = "") {
  if (!LND_REST_URL || !LND_MACAROON) throw new Error('Lightning not configured');
  const res = await axios.post(LND_REST_URL + '/v1/invoices', {
    value: amountSats,
    memo,
  }, {
    headers: { 'Grpc-Metadata-macaroon': LND_MACAROON }
  });
  return res.data;
}

async function checkInvoice(rHash) {
  if (!LND_REST_URL || !LND_MACAROON) throw new Error('Lightning not configured');
  const res = await axios.get(LND_REST_URL + '/v1/invoice/' + rHash, {
    headers: { 'Grpc-Metadata-macaroon': LND_MACAROON }
  });
  return res.data;
}

module.exports = { createInvoice, checkInvoice };