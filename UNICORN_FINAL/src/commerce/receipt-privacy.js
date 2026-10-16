'use strict';

/**
 * Buyer-facing receipt and invoice views.
 * A lookup by email returns a count. It does not return the ledger.
 * A public invoice keeps the payment fields and drops the buyer record.
 */

function lookupByEmail(email, receipts) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.indexOf('@') < 1) {
    return { status: 400, body: { ok: false, error: 'email_required' } };
  }
  const list = Array.isArray(receipts) ? receipts : [];
  let count = 0;
  for (const row of list) {
    if (String((row && row.email) || '').toLowerCase() === clean) count += 1;
  }
  return { status: 200, body: { ok: true, count } };
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

module.exports = { lookupByEmail, publicInvoice };
