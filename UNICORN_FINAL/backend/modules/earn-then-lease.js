'use strict';

/**
 * Earn-Then-Lease — ETL/1.0
 *
 * The public model catalog can be read with no key. A priced row becomes
 * callable only after confirmed customer cash exists, and only inside the
 * share of that cash the cost ledger has not already spent.
 *
 * Confirmed cash is reality-metrics on-chain paidUsd plus settled PayPal,
 * NOWPayments, and Stripe receipts. Smoke receipts stay out. Catalog margin
 * and profit-potential ranges are not cash.
 *
 * inventsProfit stays false. setProbes() is for tests; production never
 * treats a probe as revenue.
 */

const PROTOCOL = 'ETL/1.0';
const FREE_FALLBACK = 'mistralai/mistral-7b-instruct:free';

const probes = {
  confirmed: null,
  spentUsd: null,
};

function setProbes(next) {
  const n = next || {};
  probes.confirmed = n.confirmed || null;
  probes.spentUsd = Number.isFinite(n.spentUsd) ? n.spentUsd : null;
}

function clearProbes() {
  probes.confirmed = null;
  probes.spentUsd = null;
}

function profitFraction() {
  const n = Number(process.env.MODEL_LEASE_PROFIT_FRACTION);
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  return 0.25;
}

function ownerCapUsd() {
  const n = Number(process.env.MODEL_LEASE_MAX_PROMPT_USD);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

function flatBudgetUsd() {
  const n = Number(process.env.AI_MONTHLY_BUDGET_USD || '100');
  if (Number.isFinite(n) && n > 0) return n;
  return 0;
}

function isFreeId(id) {
  return /:free$/i.test(String(id || ''));
}

function isFreeRow(row) {
  if (!row) return false;
  if (row.promptPerM === 0) return true;
  if (row.promptPerM == null && isFreeId(row.id)) return true;
  return false;
}

function _round(n) {
  return Math.round(Number(n) * 100) / 100;
}

function _onchain() {
  try {
    const snap = require('./reality-metrics').snapshot();
    const paidUsd = Number(snap && snap.revenue && snap.revenue.paidUsd) || 0;
    const paidOrders = Number(snap && snap.orders && snap.orders.paid) || 0;
    return {
      paidUsd: paidUsd > 0 ? paidUsd : 0,
      paidOrders: paidOrders > 0 ? paidOrders : 0,
    };
  } catch (_) {
    return { paidUsd: 0, paidOrders: 0 };
  }
}

function _paidHumans() {
  try {
    const st = require('./origin-gravity-os').getStatus();
    const n = Number(st && st.paidHumans) || 0;
    return n > 0 ? n : 0;
  } catch (_) {
    return 0;
  }
}

function _providerCash() {
  let usd = 0;
  let count = 0;
  try {
    const uaic = require('../../src/commerce/uaic');
    const rows = typeof uaic.getReceipts === 'function' ? uaic.getReceipts() : [];
    for (const r of rows) {
      if (!r || String(r.status) !== 'paid') continue;
      const conf = r.confirmation || {};
      const net = String(conf.network || '').toLowerCase();
      let settled = false;
      if (net === 'paypal' && (conf.captureId || conf.paypalOrderId || conf.orderId)) settled = true;
      if (net === 'nowpayments' && (conf.paymentId || conf.orderId)) settled = true;
      if (net === 'stripe' && (conf.sessionId || conf.txId || conf.txid)) settled = true;
      if (!settled) continue;
      const amt = Number(r.amount != null ? r.amount : (r.amountUsd != null ? r.amountUsd : r.priceUsd));
      if (!(amt > 0)) continue;
      usd += amt;
      count += 1;
    }
  } catch (_) { /* provider ledger missing — keep the on-chain number */ }
  return { usd: _round(usd), count };
}

function confirmedCash() {
  if (probes.confirmed) {
    const c = probes.confirmed;
    const paidUsd = Number(c.paidUsd) || 0;
    return {
      paidUsd: paidUsd > 0 ? _round(paidUsd) : 0,
      onchainUsd: Number(c.onchainUsd) || 0,
      providerUsd: Number(c.providerUsd) || 0,
      paidOrders: Number(c.paidOrders) || 0,
      paidHumans: Number(c.paidHumans) || 0,
      source: 'test-probe',
    };
  }
  const chain = _onchain();
  const provider = _providerCash();
  return {
    paidUsd: _round(chain.paidUsd + provider.usd),
    onchainUsd: chain.paidUsd,
    providerUsd: provider.usd,
    paidOrders: chain.paidOrders + provider.count,
    paidHumans: _paidHumans(),
    source: 'reality-metrics+provider-receipts',
  };
}

function monthSpentUsd() {
  if (probes.spentUsd != null) return probes.spentUsd;
  try {
    const b = require('./ai-cost-ledger').budget();
    const n = Number(b && b.spentUsd);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    return null;
  }
}

function rung() {
  const cash = confirmedCash();
  const spentRaw = monthSpentUsd();
  const spendKnown = spentRaw != null;
  const spent = spendKnown ? spentRaw : 0;
  const fraction = profitFraction();
  const flat = flatBudgetUsd();
  const share = cash.paidUsd * fraction;
  const earnedCapUsd = _round(Math.min(flat, share));
  const remainingUsd = spendKnown ? _round(Math.max(0, earnedCapUsd - spent)) : 0;
  const cap = ownerCapUsd();
  const open = cash.paidUsd > 0 && remainingUsd > 0;
  const maxPromptUsdPerMillion = open
    ? _round(cap == null ? remainingUsd : Math.min(cap, remainingUsd))
    : 0;
  return {
    protocol: PROTOCOL,
    inventsProfit: false,
    lane: open ? 'earned' : 'free',
    confirmedUsd: cash.paidUsd,
    onchainUsd: cash.onchainUsd,
    providerUsd: cash.providerUsd,
    paidOrders: cash.paidOrders,
    paidHumans: cash.paidHumans,
    cashPending: cash.paidHumans > 0 && cash.paidUsd <= 0,
    source: cash.source,
    fraction,
    flatBudgetUsd: flat,
    ownerCapUsd: cap,
    earnedCapUsd,
    spentUsd: _round(spent),
    spendKnown,
    remainingUsd,
    maxPromptUsdPerMillion,
    payers: ['ai-cost-ledger', 'ai-cfo-agent'],
    note: open
      ? 'Confirmed cash opened the earned lane. A priced catalog row is callable inside the remaining share. ai-cost-ledger records the spend. ai-cfo-agent reads the same paid ledger.'
      : 'No confirmed cash is left for AI. Only rows with prompt price 0 or a :free id are callable. Paid rows stay listed. The flat monthly budget does not open them.',
  };
}

function providerCallable(name, costTier, modelId, promptPerM) {
  const r = rung();
  const provider = String(name || '');
  if (r.lane === 'earned') return { ok: true, lane: 'earned', reason: null };
  if (provider === 'openrouter') {
    if (promptPerM > 0) {
      return { ok: false, lane: 'free', reason: 'openrouter_paid_before_profit' };
    }
    if (promptPerM === 0 || isFreeId(modelId)) {
      return { ok: true, lane: 'free', reason: null };
    }
    return { ok: false, lane: 'free', reason: 'openrouter_paid_before_profit' };
  }
  if (Number(costTier) >= 2) {
    return { ok: false, lane: 'free', reason: 'paid_provider_before_profit' };
  }
  return { ok: true, lane: 'free', reason: null };
}

module.exports = {
  PROTOCOL,
  FREE_FALLBACK,
  setProbes,
  clearProbes,
  profitFraction,
  ownerCapUsd,
  isFreeId,
  isFreeRow,
  confirmedCash,
  rung,
  providerCallable,
};
