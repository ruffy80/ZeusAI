'use strict';

const contracts = require('../witness/contracts');

function attach(score) {
  const payload = {
    type: 'business_score',
    domain: score.domain,
    score_total: score.score_total,
    sub_scores: score.sub_scores,
    scored_at: score.created_at,
    offer_id: 'free_score',
    delivery_file_hash: score.report_hash || null,
  };
  const saved = contracts.saveSigned(payload, 'business_score:' + score.domain, String(score.created_at || '').slice(0, 10));
  if (!saved || saved.ok === false) {
    console.warn('[score] witness was not stored:', saved && saved.error);
    return { ok: false, error: saved && saved.error, witness_id: null, url: null };
  }
  return { ok: true, witness_id: saved.contract.id, url: '/witness/' + saved.contract.id };
}

module.exports = { attach };
