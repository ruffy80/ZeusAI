'use strict';

/**
 * Buyer-facing receipt and invoice views.
 * A lookup by email returns a count. It does not return the ledger.
 * A public invoice keeps the payment fields and drops the buyer record.
 */

function lookupByEmail(email, receipts, orderId) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.indexOf('@') < 1) {
    return { status: 400, body: { ok: false, error: 'email_required' } };
  }
  const id = String(orderId || '').trim();
  if (!id) {
    return { status: 400, body: { ok: false, error: 'order_required' } };
  }
  const list = Array.isArray(receipts) ? receipts : [];
  const matched = list.some((row) => {
    if (!row || String(row.id || '') !== id) return false;
    return String(row.email || '').toLowerCase() === clean;
  });
  return { status: 200, body: { ok: true, matched } };
}

const SECRET_KEYS = new Set([
  'email', 'customerId', 'customerEmail', 'metadata', 'did',
  'access_token', 'accessToken', 'orderAccessToken', 'license',
  'apiKey', 'webhookSecret', 'tokenHash',
]);

function publicReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const out = {};
  for (const key of Object.keys(receipt)) {
    if (SECRET_KEYS.has(key)) continue;
    out[key] = receipt[key];
  }
  return out;
}

function publicInvoice(inv) {
  if (!inv || typeof inv !== 'object') return null;
  const out = {};
  for (const key of Object.keys(inv)) {
    if (SECRET_KEYS.has(key)) continue;
    out[key] = inv[key];
  }
  return out;
}

function viewForCaller(receipt, token, same) {
  const equals = typeof same === 'function' ? same : ((a, b) => a && a === b);
  if (equals(token, receipt && receipt.access_token)) return receipt;
  if (receipt && receipt.license && equals(token, receipt.license.token)) return receipt;
  return publicReceipt(receipt);
}

module.exports = { lookupByEmail, publicInvoice, publicReceipt, viewForCaller, SECRET_KEYS };
