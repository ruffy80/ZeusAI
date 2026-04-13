// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T03:10:20.532Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AI CFO AGENT ====================
// Agent AI CFO — management financiar autonom: bugete, cash flow, investiții, alerte

const _state = {
  name: 'ai-cfo-agent',
  label: 'AI CFO Agent',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  health: 'good',
  revenue: 0,
  expenses: 0,
  cashReserve: 50000,
  burnRate: 0,
  runway: 0,
  alerts: [],
  decisions: [],
  forecast: [],
};

const EXPENSE_CATEGORIES = [
  'infrastructure', 'marketing', 'salaries', 'tools/SaaS', 'legal', 'support',
];

const INVESTMENT_OPTIONS = [
  'increase ad spend', 'hire AI engineer', 'expand to new market',
  'acquire micro-SaaS', 'build new feature', 'launch partner program',
];

function _recalcFinancials() {
  const monthlyRevenue = _state.revenue;
  const monthlyExpenses = _state.expenses;
  _state.burnRate = Math.max(0, monthlyExpenses - monthlyRevenue);
  _state.runway = _state.burnRate > 0
    ? Math.round((_state.cashReserve / _state.burnRate) * 10) / 10
    : 999;
}

function _generateForecast() {
  const months = [];
  let projRevenue = _state.revenue || 10000;
  let projExpenses = _state.expenses || 7000;
  for (let i = 1; i <= 6; i++) {
    projRevenue = Math.round(projRevenue * (1 + (0.05 + Math.random() * 0.15)));
    projExpenses = Math.round(projExpenses * (1 + (0.02 + Math.random() * 0.05)));
    months.push({
      month: i,
      projectedRevenue: projRevenue,
      projectedExpenses: projExpenses,
      projectedProfit: projRevenue - projExpenses,
    });
  }
  return months;
}

function _makeDecision() {
  const profitMargin = _state.revenue > 0
    ? ((_state.revenue - _state.expenses) / _state.revenue) * 100
    : 0;
  let decision;
  if (profitMargin > 40) {
    decision = `💰 Profit margin ${Math.round(profitMargin)}% — Recomand: ${INVESTMENT_OPTIONS[Math.floor(Math.random() * INVESTMENT_OPTIONS.length)]}`;
  } else if (profitMargin > 10) {
    decision = `📊 Profit margin ${Math.round(profitMargin)}% — Recomand: optimizare costuri ${EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)]}`;
  } else {
    decision = `⚠️ Marjă scăzută ${Math.round(profitMargin)}% — Recomand: reducere cheltuieli & accelerare vânzări`;
  }
  return {
    id: `dec_${Date.now()}`,
    decision,
    profitMargin: Math.round(profitMargin * 10) / 10,
    runway: _state.runway,
    timestamp: new Date().toISOString(),
  };
}

function init() {
  _state.startedAt = new Date().toISOString();
  _state.revenue = Math.round(8000 + Math.random() * 42000);
  _state.expenses = Math.round(_state.revenue * (0.4 + Math.random() * 0.35));
  _recalcFinancials();
  _state.forecast = _generateForecast();
  _state.decisions.push(_makeDecision());
  // Autonomous financial review every 30 minutes
  setInterval(() => {
    _state.revenue = Math.round(_state.revenue * (1 + (Math.random() * 0.1 - 0.02)));
    _state.expenses = Math.round(_state.expenses * (1 + (Math.random() * 0.06 - 0.01)));
    _recalcFinancials();
    _state.forecast = _generateForecast();
    const dec = _makeDecision();
    _state.decisions.unshift(dec);
    if (_state.decisions.length > 50) _state.decisions.pop();
    if (_state.runway < 3) {
      _state.alerts.unshift({ level: 'CRITICAL', message: `Runway only ${_state.runway} months!`, timestamp: new Date().toISOString() });
    }
    if (_state.alerts.length > 100) _state.alerts.pop();
    _state.lastRun = new Date().toISOString();
  }, 30 * 60 * 1000);
  console.log('💹 AI CFO Agent activat.');
}

async function process(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  if (input.revenue !== undefined) _state.revenue = Number(input.revenue);
  if (input.expenses !== undefined) _state.expenses = Number(input.expenses);
  if (input.cashReserve !== undefined) _state.cashReserve = Number(input.cashReserve);
  _recalcFinancials();
  _state.forecast = _generateForecast();
  const dec = _makeDecision();
  _state.decisions.unshift(dec);
  return {
    status: 'ok',
    module: _state.name,
    label: _state.label,
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
  return {
    ..._state,
    profit: _state.revenue - _state.expenses,
    latestDecision: _state.decisions[0] || null,
    forecastMonths: _state.forecast.length,
  };
}

init();

module.exports = { process, getStatus, init, name: 'ai-cfo-agent' };
