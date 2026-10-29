'use strict';

function record(score) {
  let ledger = null;
  try { ledger = require('../../backend/modules/origin-gravity-os'); } catch (_) { ledger = null; }
  if (!ledger || typeof ledger.recordPublicDelivery !== 'function') {
    console.warn('[score] public ledger module has no recordPublicDelivery');
    return { ok: false, error: 'ledger_unavailable', ledger_id: null, url: null };
  }
  const id = score.ledger_id;
  const result = ledger.recordPublicDelivery({
    id,
    offerId: 'free_score',
    priceBtc: 0,
    priceUsd: 0,
    deliveryFileHash: score.report_hash,
    url: '/score/' + score.public_slug,
    at: score.created_at,
    founding: score.founding === true,
  });
  if (!result || result.ok === false) {
    console.warn('[score] ledger did not record:', result && result.reason);
    return { ok: false, error: result && result.reason, ledger_id: null, url: null };
  }
  return { ok: true, ledger_id: id, url: '/ledger/' + id };
}

module.exports = { record };
