'use strict';

/**
 * unicorn-case-study-proof-engine — case studies only from confirmed paid orders.
 * Zero paid orders yields an empty list.
 */

function list() {
  let paid = 0;
  let usd = 0;
  try {
    const snap = require('./reality-metrics').snapshot();
    paid = Number(snap && snap.orders && snap.orders.paid) || 0;
    usd = Number(snap && snap.revenue && snap.revenue.paidUsd) || 0;
  } catch (_) {
    paid = 0;
    usd = 0;
  }
  const cases = paid > 0
    ? [{ source: 'reality-metrics', paidOrders: paid, paidUsd: usd }]
    : [];
  return { ok: true, inventsCases: false, cases };
}

function getStatus() {
  const body = list();
  return { ok: true, name: 'unicorn-case-study-proof-engine', inventsCases: false, cases: body.cases.length };
}

module.exports = { list, getStatus, name: 'unicorn-case-study-proof-engine' };
