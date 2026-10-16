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

function publicReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const out = {};
  for (const key of Object.keys(receipt)) {
    if (key === 'email' || key === 'customerId' || key === 'customerEmail' || key === 'metadata' || key === 'did') continue;
    out[key] = receipt[key];
  }
  return out;
}

function publicInvoice(inv) {
  if (!inv || typeof inv !== 'object') return null;
  const out = {};
  for (const key of Object.keys(inv)) {
    if (key === 'customerEmail' || key === 'metadata') continue;
    out[key] = inv[key];
  }
  return out;
}

module.exports = { lookupByEmail, publicInvoice, publicReceipt };
