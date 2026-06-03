// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ AUTONOMOUS WEALTH ENGINE (REAL) ============
// Matematică financiară reală: valoare viitoare cu contribuții, CAGR,
// dobândă compusă, alocare risk-parity, și plan de retrageri (4% rule).

const { createEngine } = require('./engine-core');

// Valoare viitoare reală: principal compus + anuitate de contribuții.
function futureValue({ principal = 0, monthlyContribution = 0, annualRatePct = 7, years = 10 }) {
  const r = annualRatePct / 100 / 12;
  const n = Math.round(years * 12);
  const fvPrincipal = principal * Math.pow(1 + r, n);
  const fvContrib = r === 0 ? monthlyContribution * n : monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  const total = fvPrincipal + fvContrib;
  const invested = principal + monthlyContribution * n;
  return {
    futureValue: Number(total.toFixed(2)),
    totalInvested: Number(invested.toFixed(2)),
    totalGrowth: Number((total - invested).toFixed(2)),
    growthMultiple: invested ? Number((total / invested).toFixed(2)) : 0,
    months: n,
  };
}

// CAGR real din valoare inițială/finală pe orizont.
function cagr(start, end, years) {
  if (start <= 0 || years <= 0) return 0;
  return Number(((Math.pow(end / start, 1 / years) - 1) * 100).toFixed(2));
}

// Alocare risk-parity reală: ponderi invers proporționale cu volatilitatea.
function riskParity(assets) {
  const list = (Array.isArray(assets) ? assets : []).filter(a => a && Number(a.volatility) > 0);
  if (!list.length) return [];
  const inv = list.map(a => 1 / Number(a.volatility));
  const sum = inv.reduce((x, y) => x + y, 0);
  return list.map((a, i) => ({ asset: a.name || `asset${i}`, weight: Number((inv[i] / sum).toFixed(4)), volatility: Number(a.volatility) }));
}

// Plan de retragere sustenabil (Safe Withdrawal Rate).
function withdrawalPlan(portfolio, swrPct = 4) {
  const annual = portfolio * (swrPct / 100);
  return { portfolio, swrPct, annualIncome: Number(annual.toFixed(2)), monthlyIncome: Number((annual / 12).toFixed(2)) };
}

function wealthWork(input = {}) {
  const action = input.action || 'project';
  if (action === 'allocate') return { mode: 'risk-parity', allocation: riskParity(input.assets) };
  if (action === 'withdraw') return { mode: 'withdrawal', ...withdrawalPlan(Number(input.portfolio) || 0, Number(input.swrPct) || 4) };
  const fv = futureValue(input);
  const yrs = Number(input.years) || 10;
  return {
    mode: 'projection',
    ...fv,
    cagrPct: cagr(fv.totalInvested, fv.futureValue, yrs),
    passiveIncome: withdrawalPlan(fv.futureValue, Number(input.swrPct) || 4),
  };
}

const engine = createEngine('autonomous-wealth-engine', { label: 'Autonomous Wealth Engine', category: 'finance', work: wealthWork });
module.exports = {
  name: 'autonomous-wealth-engine',
  process: (input, ctx) => engine.process(input, ctx),
  futureValue, cagr, riskParity, withdrawalPlan,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
