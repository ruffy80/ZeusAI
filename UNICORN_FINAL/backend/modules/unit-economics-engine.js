// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// unit-economics-engine.js — Unit Economics Intelligence for Unicorn SaaS
// Motor de unit economics pentru platforma Unicorn SaaS multi-tenant
// =============================================================================
// Tracks per-task and per-module profitability, computes:
//   • Profit per task / cost per task / margin per task
//   • Compute cost / retry cost / failure cost
//   • Customer Acquisition Cost (CAC) / Customer Lifetime Value (CLV)
//   • Margin per module / per vertical / per marketplace
//   • Net profit optimization recommendations
// =============================================================================

'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');

// ── Storage ────────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, '../../data/unit-economics');
const DATA_FILE = path.join(DATA_DIR, 'records.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

/** @type {Array<UnitRecord>} */
let _records = _load();

// ── Constants ──────────────────────────────────────────────────────────────
// Estimated server cost per compute-second (USD) / Costul estimat per secundă compute
const COMPUTE_COST_PER_SEC  = Number(process.env.COMPUTE_COST_PER_SEC  || 0.000015);
// Estimated cost per AI token (USD) / Costul estimat per token AI
const AI_COST_PER_TOKEN     = Number(process.env.AI_COST_PER_TOKEN     || 0.000002);
// Cost per retry attempt / Costul per re-încercare
const RETRY_COST_USD        = Number(process.env.RETRY_COST_USD        || 0.001);
// Sales & marketing cost per acquired customer / Costul marketing per client nou
const DEFAULT_CAC            = Number(process.env.DEFAULT_CAC            || 25);

// ── §1  RECORDING API ──────────────────────────────────────────────────────

/**
 * recordTask — log a completed task unit economics record
 * Înregistrează unit economics pentru o sarcină completată
 * @param {object} opts
 */
function recordTask({
  taskId,
  module,
  vertical     = 'platform',
  marketplace  = 'direct',
  revenueUsd   = 0,
  computeSecs  = 0,
  aiTokens     = 0,
  retries      = 0,
  failed       = false,
  customerId   = null,
  isNewCustomer = false,
}) {
  const computeCost = computeSecs * COMPUTE_COST_PER_SEC;
  const aiCost      = aiTokens    * AI_COST_PER_TOKEN;
  const retryCost   = retries     * RETRY_COST_USD;
  const failureCost = failed      ? (computeCost + aiCost + retryCost) : 0; // sunk cost

  const totalCost   = computeCost + aiCost + retryCost;
  const profit      = revenueUsd - totalCost;
  const margin      = revenueUsd > 0 ? (profit / revenueUsd) * 100 : (failed ? -100 : 0);

  const record = {
    id:           taskId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts:           new Date().toISOString(),
    module:       module || 'unknown',
    vertical,
    marketplace,
    revenueUsd,
    computeCost,
    aiCost,
    retryCost,
    failureCost,
    totalCost,
    profit,
    margin,
    failed,
    customerId,
    isNewCustomer,
    // For CLV tracking
    cacContribution: isNewCustomer ? DEFAULT_CAC : 0,
  };

  _records.push(record);
  if (_records.length > 50000) _records = _records.slice(-50000);
  _persistDebounced();
  return record;
}

// ── §2  ANALYTICS ──────────────────────────────────────────────────────────

/** getTaskSummary — aggregate across all records */
function getTaskSummary(windowHours = 24) {
  const since = Date.now() - windowHours * 3600_000;
  const window = _records.filter(r => new Date(r.ts).getTime() >= since);
  return _aggregate(window, `last_${windowHours}h`);
}

/** getModuleRankings — profit margin per module, descending */
function getModuleRankings() {
  const byModule = {};
  for (const r of _records) {
    if (!byModule[r.module]) byModule[r.module] = { module: r.module, revenue: 0, cost: 0, profit: 0, tasks: 0, failures: 0 };
    const m = byModule[r.module];
    m.revenue += r.revenueUsd;
    m.cost     += r.totalCost;
    m.profit   += r.profit;
    m.tasks    += 1;
    if (r.failed) m.failures += 1;
  }
  return Object.values(byModule)
    .map(m => ({
      ...m,
      margin:       m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) + '%' : '0%',
      failureRate:  m.tasks > 0   ? ((m.failures / m.tasks) * 100).toFixed(1) + '%' : '0%',
      roi:          m.cost > 0    ? ((m.profit / m.cost) * 100).toFixed(1) + '%' : 'N/A',
    }))
    .sort((a, b) => b.profit - a.profit);
}

/** getVerticalRankings — profit per vertical */
function getVerticalRankings() {
  return _rankBy('vertical');
}

/** getMarketplaceRankings — profit per marketplace */
function getMarketplaceRankings() {
  return _rankBy('marketplace');
}

/** getCustomerLTV — estimated lifetime value per customer */
function getCustomerLTV(customerId) {
  const customerRecords = _records.filter(r => r.customerId === customerId);
  if (!customerRecords.length) return null;
  const totalRevenue  = customerRecords.reduce((s, r) => s + r.revenueUsd, 0);
  const totalProfit   = customerRecords.reduce((s, r) => s + r.profit, 0);
  const sessions      = customerRecords.length;
  const avgOrderValue = totalRevenue / sessions;
  const cac           = customerRecords.find(r => r.isNewCustomer)?.cacContribution || DEFAULT_CAC;
  return {
    customerId,
    totalRevenue: +totalRevenue.toFixed(2),
    totalProfit:  +totalProfit.toFixed(2),
    ltv:          +totalProfit.toFixed(2),
    cac,
    ltvCacRatio:  cac > 0 ? +(totalProfit / cac).toFixed(2) : null,
    sessions,
    avgOrderValue: +avgOrderValue.toFixed(2),
    firstSeen:    customerRecords[0].ts,
    lastSeen:     customerRecords[customerRecords.length - 1].ts,
  };
}

/** getNetProfitOptimizations — recommendations to improve margin */
function getNetProfitOptimizations() {
  const modules = getModuleRankings();
  const suggestions = [];

  // High failure rate modules
  const highFailure = modules.filter(m => parseFloat(m.failureRate) > 20);
  for (const m of highFailure.slice(0, 3)) {
    suggestions.push({
      type:     'reduce-failures',
      module:   m.module,
      priority: 'high',
      impact:   `Reduce failure rate from ${m.failureRate} to <5% → recover $${(m.cost * 0.2).toFixed(2)} in retry costs`,
    });
  }

  // Negative margin modules
  const negativeProfitModules = modules.filter(m => m.profit < 0);
  for (const m of negativeProfitModules.slice(0, 3)) {
    suggestions.push({
      type:     'reprice-or-retire',
      module:   m.module,
      priority: 'critical',
      impact:   `Module is unprofitable: -$${Math.abs(m.profit).toFixed(2)} profit. Raise price or retire.`,
    });
  }

  // High cost, low revenue
  const highCostLowRev = modules.filter(m => m.cost > 10 && m.revenue < m.cost * 0.5);
  for (const m of highCostLowRev.slice(0, 2)) {
    suggestions.push({
      type:     'cost-optimization',
      module:   m.module,
      priority: 'medium',
      impact:   `High compute cost $${m.cost.toFixed(2)} vs revenue $${m.revenue.toFixed(2)}. Optimize or batch.`,
    });
  }

  // Top performer to scale
  if (modules[0]) {
    suggestions.push({
      type:     'scale-winner',
      module:   modules[0].module,
      priority: 'opportunity',
      impact:   `Top performer with $${modules[0].profit.toFixed(2)} profit. Increase allocation.`,
    });
  }

  return suggestions;
}

// ── §3  INTERNAL HELPERS ───────────────────────────────────────────────────

function _aggregate(records, label) {
  if (!records.length) return { label, totalTasks: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, margin: '0%' };
  const totalRevenue = records.reduce((s, r) => s + r.revenueUsd, 0);
  const totalCost    = records.reduce((s, r) => s + r.totalCost,  0);
  const totalProfit  = records.reduce((s, r) => s + r.profit,     0);
  const failures     = records.filter(r => r.failed).length;
  return {
    label,
    totalTasks:    records.length,
    totalRevenue:  +totalRevenue.toFixed(4),
    totalCost:     +totalCost.toFixed(4),
    totalProfit:   +totalProfit.toFixed(4),
    margin:        totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '0%',
    avgCostPerTask: +(totalCost / records.length).toFixed(6),
    avgRevenuePerTask: +(totalRevenue / records.length).toFixed(4),
    failureRate:   records.length > 0 ? ((failures / records.length) * 100).toFixed(1) + '%' : '0%',
  };
}

function _rankBy(field) {
  const byField = {};
  for (const r of _records) {
    const key = r[field] || 'unknown';
    if (!byField[key]) byField[key] = { [field]: key, revenue: 0, cost: 0, profit: 0, tasks: 0 };
    byField[key].revenue += r.revenueUsd;
    byField[key].cost    += r.totalCost;
    byField[key].profit  += r.profit;
    byField[key].tasks   += 1;
  }
  return Object.values(byField)
    .map(v => ({
      ...v,
      margin: v.revenue > 0 ? ((v.profit / v.revenue) * 100).toFixed(1) + '%' : '0%',
    }))
    .sort((a, b) => b.profit - a.profit);
}

let _persistTimer = null;
function _persistDebounced() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(_records.slice(-20000), null, 2)); } catch (_) {}
  }, 5000);
}

function _load() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (_) {}
  return [];
}

// ── §4  REST ROUTER ────────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/summary', (req, res) => {
    const hours = Number(req.query.hours) || 24;
    res.json({ ok: true, summary: getTaskSummary(hours) });
  });

  r.get('/modules', (_req, res) => {
    res.json({ ok: true, rankings: getModuleRankings() });
  });

  r.get('/verticals', (_req, res) => {
    res.json({ ok: true, rankings: getVerticalRankings() });
  });

  r.get('/marketplaces', (_req, res) => {
    res.json({ ok: true, rankings: getMarketplaceRankings() });
  });

  r.get('/optimizations', (_req, res) => {
    res.json({ ok: true, suggestions: getNetProfitOptimizations() });
  });

  r.get('/ltv/:customerId', (req, res) => {
    const result = getCustomerLTV(req.params.customerId);
    if (!result) return res.status(404).json({ ok: false, error: 'Customer not found' });
    res.json({ ok: true, ...result });
  });

  r.post('/record', express.json(), (req, res) => {
    const record = recordTask(req.body || {});
    res.json({ ok: true, record });
  });

  return r;
}

function getStatus() {
  const summary24h = getTaskSummary(24);
  return {
    name:           'unit-economics-engine',
    label:          'Unit Economics Intelligence',
    health:         'good',
    totalRecords:   _records.length,
    last24h:        summary24h,
    topModule:      getModuleRankings()[0]?.module || null,
  };
}

module.exports = {
  recordTask,
  getTaskSummary,
  getModuleRankings,
  getVerticalRankings,
  getMarketplaceRankings,
  getCustomerLTV,
  getNetProfitOptimizations,
  getStatus,
  router,
};
