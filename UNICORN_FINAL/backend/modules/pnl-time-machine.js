// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.339Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const NAME = 'pnl-time-machine';

const deps = {
  profitAutopilot: null,
  subscriptionEngine: null,
  zacc: null,
  tenantBilling: null,
  dynamicPricing: null,
  marketplace: null,
};

const state = {
  runs: 0,
  lastRunAt: 0,
  lastInput: null,
  lastOutput: null,
  lastError: null,
};

function configure(nextDeps = {}) {
  Object.assign(deps, nextDeps || {});
  return { ok: true, name: NAME };
}

function _safe(fn, fallback = null) {
  try { return fn(); } catch (_) { return fallback; }
}

function _clamp(num, min, max) {
  const n = Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function _seedRng(seedText) {
  let h = 2166136261 >>> 0;
  const s = String(seedText || 'zeus-pnl-seed');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rnd() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _boxMuller(rnd) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function _percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function _deriveBaseline(input = {}) {
  const autopilot = deps.profitAutopilot && typeof deps.profitAutopilot.getStatus === 'function'
    ? _safe(() => deps.profitAutopilot.getStatus(), null)
    : null;
  const sub = deps.subscriptionEngine && typeof deps.subscriptionEngine.getStatus === 'function'
    ? _safe(() => deps.subscriptionEngine.getStatus(), null)
    : null;
  const zacc = deps.zacc && typeof deps.zacc.status === 'function'
    ? _safe(() => deps.zacc.status(), null)
    : null;

  const mrr = Math.max(0, Number(sub && sub.mrr ? sub.mrr : 0));
  const low = Math.max(0, Number(autopilot && autopilot.profitPotentialUsd && autopilot.profitPotentialUsd.low ? autopilot.profitPotentialUsd.low : 0));
  const pub = Math.max(0, Number(zacc && zacc.publisher && zacc.publisher.published ? zacc.publisher.published : 0));
  const zaccBaseline = pub * 450;

  const baselineMonthlyRevenueUsd = Math.max(
    1000,
    Number(input.baselineMonthlyRevenueUsd || 0) || 0,
    mrr,
    low,
    zaccBaseline
  );

  return {
    baselineMonthlyRevenueUsd,
    inferredFrom: {
      subscriptionMrr: mrr,
      profitAutopilotLow: low,
      zaccPublished: pub,
    },
  };
}

function _simulate(input = {}) {
  const baseline = _deriveBaseline(input);
  const monthsSet = Array.isArray(input.horizonsMonths) && input.horizonsMonths.length
    ? input.horizonsMonths.map((x) => _clamp(x, 1, 36))
    : [1, 3, 12];
  const labelByMonths = { 1: 'next30', 3: 'next90', 12: 'next365' };

  const trials = _clamp(input.trials || 3000, 100, 10000);
  const monthlyGrowthRate = _clamp(input.monthlyGrowthRate ?? 0.06, -0.5, 0.6);
  const volatility = _clamp(input.volatility ?? 0.2, 0, 1.2);
  const grossMargin = _clamp(input.grossMargin ?? 0.58, 0.05, 0.95);
  const fixedCostsMonthly = _clamp(input.fixedCostsMonthly ?? 12000, 0, 2_000_000);
  const seed = String(input.seed || process.env.PNL_TIME_MACHINE_SEED || 'zeus-pnl-2026');
  const rnd = _seedRng(seed);

  const scenarios = {
    conservative: { growthAdj: -0.03, marginAdj: -0.06 },
    base: { growthAdj: 0, marginAdj: 0 },
    aggressive: { growthAdj: 0.04, marginAdj: 0.05 },
  };

  function runScenario(scenarioName, months) {
    const cfg = scenarios[scenarioName] || scenarios.base;
    const outcomes = [];

    for (let t = 0; t < trials; t += 1) {
      let revenue = baseline.baselineMonthlyRevenueUsd;
      let sumProfit = 0;

      for (let m = 0; m < months; m += 1) {
        const shock = _boxMuller(rnd) * volatility;
        const growth = monthlyGrowthRate + cfg.growthAdj + shock * 0.08;
        revenue = Math.max(0, revenue * (1 + growth));
        const margin = _clamp(grossMargin + cfg.marginAdj + shock * 0.03, 0.01, 0.97);
        const monthProfit = revenue * margin - fixedCostsMonthly;
        sumProfit += monthProfit;
      }

      outcomes.push(sumProfit);
    }

    outcomes.sort((a, b) => a - b);
    const sum = outcomes.reduce((acc, x) => acc + x, 0);
    const mean = sum / outcomes.length;
    return {
      scenario: scenarioName,
      meanProfitUsd: Math.round(mean),
      p10ProfitUsd: Math.round(_percentile(outcomes, 0.1)),
      p50ProfitUsd: Math.round(_percentile(outcomes, 0.5)),
      p90ProfitUsd: Math.round(_percentile(outcomes, 0.9)),
      lossProbabilityPct: Math.round((outcomes.filter((x) => x < 0).length / outcomes.length) * 10000) / 100,
    };
  }

  const horizons = {};
  for (const months of monthsSet) {
    const label = labelByMonths[months] || `m${months}`;
    horizons[label] = {
      months,
      conservative: runScenario('conservative', months),
      base: runScenario('base', months),
      aggressive: runScenario('aggressive', months),
    };
  }

  const output = {
    ok: true,
    name: NAME,
    generatedAt: new Date().toISOString(),
    assumptions: {
      baselineMonthlyRevenueUsd: Math.round(baseline.baselineMonthlyRevenueUsd),
      monthlyGrowthRate,
      volatility,
      grossMargin,
      fixedCostsMonthly,
      trials,
    },
    inferredFrom: baseline.inferredFrom,
    horizons,
  };

  state.runs += 1;
  state.lastRunAt = Date.now();
  state.lastInput = {
    baselineMonthlyRevenueUsd: Math.round(baseline.baselineMonthlyRevenueUsd),
    monthlyGrowthRate,
    volatility,
    grossMargin,
    fixedCostsMonthly,
    trials,
    horizonsMonths: monthsSet,
  };
  state.lastOutput = output;
  return output;
}

function getStatus() {
  const baseline = _deriveBaseline({});
  return {
    ok: true,
    name: NAME,
    runs: state.runs,
    lastRunAt: state.lastRunAt ? new Date(state.lastRunAt).toISOString() : null,
    baselineMonthlyRevenueUsd: Math.round(baseline.baselineMonthlyRevenueUsd),
    inferredFrom: baseline.inferredFrom,
    hasLastOutput: !!state.lastOutput,
    lastError: state.lastError,
  };
}

async function runAction(input = {}) {
  const action = String(input.action || 'status').toLowerCase();
  try {
    if (action === 'simulate' || action === 'run' || action === 'forecast') return _simulate(input);
    if (action === 'last') return state.lastOutput || _simulate(input);
    return getStatus();
  } catch (e) {
    state.lastError = e && e.message ? e.message : String(e);
    return { ok: false, error: state.lastError };
  }
}

module.exports = { name: NAME, configure, getStatus, process: runAction, runAction };
