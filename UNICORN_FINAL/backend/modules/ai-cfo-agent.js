// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';
/**
 * AI CFO Agent — truth-bound financial sense.
 * Never invents revenue. Reads reality-metrics (paid ledger) when available;
 * otherwise reports dataMode:'unarmed' with zeros.
 */

const _state = {
  name: 'ai-cfo-agent',
  label: 'AI CFO Agent',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'idle',
  revenue: 0,
  expenses: 0,
  cashReserve: 0,
  burnRate: 0,
  runway: 0,
  alerts: [],
  decisions: [],
  forecast: [],
  dataMode: 'unarmed',
  truthSource: null,
  _timer: null,
};

function _softReality() {
  try {
    const rm = require('./reality-metrics');
    if (rm && typeof rm.snapshot === 'function') return rm.snapshot();
  } catch (_) {}
  return null;
}

function _recalcFinancials() {
  const monthlyRevenue = _state.revenue;
  const monthlyExpenses = _state.expenses;
  _state.burnRate = Math.max(0, monthlyExpenses - monthlyRevenue);
  _state.runway = _state.burnRate > 0
    ? Math.round((_state.cashReserve / _state.burnRate) * 10) / 10
    : (monthlyRevenue > 0 ? 999 : 0);
}

function _generateForecast() {
  if (_state.dataMode !== 'live' || _state.revenue <= 0) return [];
  const months = [];
  let projRevenue = _state.revenue;
  let projExpenses = Math.max(_state.expenses, 0);
  // Conservative flat+small growth from last known live numbers (no RNG theater).
  for (let i = 1; i <= 6; i++) {
    projRevenue = Math.round(projRevenue * 1.03);
    projExpenses = Math.round(projExpenses * 1.01);
    months.push({
      month: i,
      projectedRevenue: projRevenue,
      projectedExpenses: projExpenses,
      projectedProfit: projRevenue - projExpenses,
      basis: 'live_ledger_extrapolation',
    });
  }
  return months;
}

function _makeDecision() {
  if (_state.dataMode !== 'live') {
    return {
      id: `dec_${Date.now()}`,
      decision: 'CFO unarmed — waiting for verified paid ledger (reality-metrics)',
      profitMargin: 0,
      runway: 0,
      timestamp: new Date().toISOString(),
      armed: false,
    };
  }
  const profitMargin = _state.revenue > 0
    ? ((_state.revenue - _state.expenses) / _state.revenue) * 100
    : 0;
  let decision;
  if (_state.revenue <= 0) {
    decision = 'No verified paid revenue yet — focus conversion, not spend';
  } else if (profitMargin > 40) {
    decision = `Profit margin ${Math.round(profitMargin)}% on live ledger — reinvest carefully`;
  } else if (profitMargin > 10) {
    decision = `Profit margin ${Math.round(profitMargin)}% — optimize cost categories with evidence`;
  } else {
    decision = `Low margin ${Math.round(profitMargin)}% — cut burn, accelerate paid conversion`;
  }
  return {
    id: `dec_${Date.now()}`,
    decision,
    profitMargin: Math.round(profitMargin * 10) / 10,
    runway: _state.runway,
    timestamp: new Date().toISOString(),
    armed: true,
  };
}

function refreshFromReality() {
  const snap = _softReality();
  if (!snap) {
    _state.dataMode = 'unarmed';
    _state.truthSource = null;
    _state.revenue = 0;
    _state.expenses = 0;
    _state.health = 'idle';
    _recalcFinancials();
    _state.forecast = [];
    return false;
  }
  const paidUsd = Number((snap.revenue && snap.revenue.paidUsd) || 0);
  const paidOrders = Number((snap.orders && snap.orders.paid) || 0);
  let realRevenue = paidUsd;
  let realExpenses = 0;
  let sourceLabel = 'reality-metrics.snapshot';
  try {
    const atro = require('./autonomous-treasury-reconciler');
    const rec = atro.reconcileLedger();
    if (rec && rec.ok && rec.totals) {
      realRevenue = Math.max(realRevenue, Number(rec.totals.trailing30dGrossUsd || rec.totals.grossRevenueUsd || 0));
      realExpenses = Number((
        Number(rec.totals.paymentRailFeesUsd || 0)
        + Number(rec.totals.affiliateLiabilityUsd || 0)
        + Number(rec.totals.aiFulfillmentCostUsd || 0)
      ).toFixed(2));
      sourceLabel = 'atro+reality-metrics';
    }
  } catch (_) {}
  _state.revenue = realRevenue;
  _state.expenses = realExpenses;
  _state.dataMode = 'live';
  _state.truthSource = sourceLabel;
  _state.health = (paidOrders > 0 || realRevenue > 0) ? 'good' : 'idle';
  _recalcFinancials();
  _state.forecast = _generateForecast();
  return true;
}

function init() {
  if (_state.startedAt) return getStatus();
  _state.startedAt = new Date().toISOString();
  refreshFromReality();
  _state.decisions = [_makeDecision()];
  if (_state._timer) clearInterval(_state._timer);
  _state._timer = setInterval(() => {
    refreshFromReality();
    const dec = _makeDecision();
    _state.decisions.unshift(dec);
    if (_state.decisions.length > 50) _state.decisions.pop();
    if (_state.dataMode === 'live' && _state.runway > 0 && _state.runway < 3) {
      _state.alerts.unshift({
        level: 'CRITICAL',
        message: `Runway only ${_state.runway} months on live burn model`,
        timestamp: new Date().toISOString(),
      });
      if (_state.alerts.length > 100) _state.alerts.pop();
    }
    _state.lastRun = new Date().toISOString();
  }, 30 * 60 * 1000);
  if (typeof _state._timer.unref === 'function') _state._timer.unref();
  console.log(
    _state.dataMode === 'live'
      ? '💹 AI CFO Agent activat (live ledger).'
      : '💹 AI CFO Agent idle (unarmed — no simulated revenue).'
  );
  return getStatus();
}

async function processInput(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  refreshFromReality();
  if (input.revenue !== undefined && Number.isFinite(Number(input.revenue))) {
    // Explicit operator override only — still labelled as override, not invent.
    _state.revenue = Number(input.revenue);
    _state.dataMode = 'override';
    _state.truthSource = 'operator_input';
  }
  if (input.expenses !== undefined && Number.isFinite(Number(input.expenses))) {
    _state.expenses = Number(input.expenses);
  }
  if (input.cashReserve !== undefined && Number.isFinite(Number(input.cashReserve))) {
    _state.cashReserve = Number(input.cashReserve);
  }
  _recalcFinancials();
  _state.forecast = _generateForecast();
  const dec = _makeDecision();
  _state.decisions.unshift(dec);
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
    dataMode: _state.dataMode,
    simulated: false,
    financials: {
      revenue: _state.revenue,
      expenses: _state.expenses,
      profit: _state.revenue - _state.expenses,
      cashReserve: _state.cashReserve,
      burnRate: _state.burnRate,
      runway: _state.runway === 999 ? 'profitable — no burn' : `${_state.runway} months`,
    },
    latestDecision: dec,
    forecast: _state.forecast,
    timestamp: _state.lastRun,
  };
}

function getStatus() {
  refreshFromReality();
  return {
    name: _state.name,
    label: _state.label,
    startedAt: _state.startedAt,
    processCount: _state.processCount,
    lastRun: _state.lastRun,
    health: _state.health,
    revenue: _state.revenue,
    expenses: _state.expenses,
    cashReserve: _state.cashReserve,
    burnRate: _state.burnRate,
    runway: _state.runway,
    alerts: _state.alerts.slice(0, 5),
    decisions: _state.decisions.slice(0, 5),
    forecast: _state.forecast,
    profit: _state.revenue - _state.expenses,
    latestDecision: _state.decisions[0] || null,
    forecastMonths: _state.forecast.length,
    dataMode: _state.dataMode,
    simulated: false,
    armed: _state.dataMode === 'live',
    truthSource: _state.truthSource || 'unarmed',
  };
}

// Auto-arm on require — but NEVER invent numbers (refreshFromReality may be unarmed).
init();

module.exports = { process: processInput, getStatus, init, refreshFromReality, name: 'ai-cfo-agent' };
