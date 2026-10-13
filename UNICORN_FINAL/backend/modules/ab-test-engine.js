'use strict';

/**
 * ABX/1.0 — advisory headline experiment.
 * A winner is a recommendation only. This module never changes the homepage
 * variant, and it never treats a missing count as a conversion.
 */

const PROTOCOL = 'ABX/1.0';
const MIN_IMPRESSIONS = 20;

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function evaluate(counts) {
  const imp = (counts && counts.impression) || {};
  const conv = (counts && counts.conversion) || {};
  const impression = { A: _num(imp.A), B: _num(imp.B) };
  const conversion = { A: _num(conv.A), B: _num(conv.B) };
  const enough = impression.A >= MIN_IMPRESSIONS && impression.B >= MIN_IMPRESSIONS;
  let winner = null;
  if (enough) {
    const rateA = conversion.A / impression.A;
    const rateB = conversion.B / impression.B;
    if (rateA !== rateB) winner = rateA > rateB ? 'A' : 'B';
  }
  return {
    ok: true,
    protocol: PROTOCOL,
    winner,
    promoted: false,
    appliedToHomepage: false,
    recommendationOnly: true,
    inventsConversions: false,
    minImpressions: MIN_IMPRESSIONS,
    enoughSample: enough,
    impression,
    conversion,
  };
}

function evaluateFromDesk() {
  let counts = { impression: { A: 0, B: 0 }, conversion: { A: 0, B: 0 } };
  try {
    counts = require('../../src/site/v2/discover-trust-os').eventCounts();
  } catch (_) { /* empty sample */ }
  return evaluate(counts);
}

module.exports = {
  PROTOCOL,
  MIN_IMPRESSIONS,
  evaluate,
  evaluateFromDesk,
};
