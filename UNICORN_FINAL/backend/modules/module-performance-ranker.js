// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// module-performance-ranker.js — Internal Performance Ranking Engine
// Motor de clasificare a performanței interne pentru Unicorn SaaS
// =============================================================================
// Ranks:
//   • Modules by: call count, error rate, avg latency, revenue contribution
//   • Agents  by: success rate, autonomy score, task throughput
//   • Verticals by: revenue, growth rate, margin
//   • Systems  by: ROI, reliability, strategic value
// Used by: ZAC profit maximizer, self-healing engine, capital allocator
// =============================================================================

'use strict';

const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');
const express      = require('express');

// ── Storage ───────────────────────────────────────────────────────────────
const DATA_DIR   = path.join(__dirname, '../../data/module-ranker');
const RANKS_FILE = path.join(DATA_DIR, 'rankings.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

const bus = new EventEmitter();
bus.setMaxListeners(20);

// ── In-memory telemetry store ─────────────────────────────────────────────

/** @type {Map<string, ModuleTelemetry>} moduleName → telemetry */
const _telemetry = new Map();

/** @type {Map<string, AgentTelemetry>} agentName → telemetry */
const _agents = new Map();

/** @type {Map<string, VerticalTelemetry>} verticalName → telemetry */
const _verticals = new Map();

// ── §1  TELEMETRY RECORDING ───────────────────────────────────────────────

/**
 * recordModuleCall — record a module invocation result
 * Înregistrează rezultatul unei invocări de modul
 */
function recordModuleCall({ module, latencyMs = 0, success = true, revenueUsd = 0, costUsd = 0 }) {
  if (!module) return;
  let t = _telemetry.get(module);
  if (!t) {
    t = { module, calls: 0, errors: 0, totalLatency: 0, totalRevenue: 0, totalCost: 0, lastCall: null, createdAt: new Date().toISOString() };
    _telemetry.set(module, t);
  }
  t.calls         += 1;
  t.errors        += success ? 0 : 1;
  t.totalLatency  += latencyMs;
  t.totalRevenue  += revenueUsd;
  t.totalCost     += costUsd;
  t.lastCall       = new Date().toISOString();
}

/**
 * recordAgentAction — record an autonomous agent action result
 */
function recordAgentAction({ agent, success = true, taskType = 'generic', confidenceScore = 0.5, revenueImpact = 0 }) {
  if (!agent) return;
  let a = _agents.get(agent);
  if (!a) {
    a = { agent, actions: 0, successes: 0, totalConfidence: 0, totalRevenue: 0, taskTypes: {}, createdAt: new Date().toISOString() };
    _agents.set(agent, a);
  }
  a.actions          += 1;
  a.successes        += success ? 1 : 0;
  a.totalConfidence  += confidenceScore;
  a.totalRevenue     += revenueImpact;
  a.taskTypes[taskType] = (a.taskTypes[taskType] || 0) + 1;
  a.lastAction = new Date().toISOString();
}

/**
 * recordVerticalRevenue — record revenue for a business vertical
 */
function recordVerticalRevenue({ vertical, revenueUsd, costUsd = 0, customers = 0 }) {
  if (!vertical) return;
  let v = _verticals.get(vertical);
  if (!v) {
    v = { vertical, totalRevenue: 0, totalCost: 0, customers: 0, transactions: 0, createdAt: new Date().toISOString() };
    _verticals.set(vertical, v);
  }
  v.totalRevenue   += revenueUsd;
  v.totalCost      += costUsd;
  v.customers      += customers;
  v.transactions   += 1;
  v.lastActivity    = new Date().toISOString();
}

// ── §2  RANKING COMPUTATION ───────────────────────────────────────────────

/**
 * getModuleRankings — sorted list of modules by composite score
 * Score = (successRate * 0.4) + (revenueNorm * 0.3) + (latencyScore * 0.2) + (callsNorm * 0.1)
 */
function getModuleRankings({ limit = 50, order = 'desc' } = {}) {
  const all = [..._telemetry.values()];
  if (!all.length) return [];

  const maxRev = Math.max(...all.map(t => t.totalRevenue), 1);
  const maxCalls = Math.max(...all.map(t => t.calls), 1);
  const maxLatency = Math.max(...all.map(t => t.calls > 0 ? t.totalLatency / t.calls : 0), 1);

  const ranked = all.map(t => {
    const successRate   = t.calls > 0 ? (t.calls - t.errors) / t.calls : 1;
    const revenueNorm   = t.totalRevenue / maxRev;
    const avgLatency    = t.calls > 0 ? t.totalLatency / t.calls : 0;
    const latencyScore  = 1 - (avgLatency / maxLatency);
    const callsNorm     = t.calls / maxCalls;

    const score = (successRate * 0.4) + (revenueNorm * 0.3) + (latencyScore * 0.2) + (callsNorm * 0.1);
    const roi   = t.totalCost > 0 ? ((t.totalRevenue - t.totalCost) / t.totalCost) * 100 : null;

    return {
      module:      t.module,
      score:       +score.toFixed(4),
      calls:       t.calls,
      errorRate:   t.calls > 0 ? +((t.errors / t.calls) * 100).toFixed(1) : 0,
      avgLatencyMs: +avgLatency.toFixed(1),
      totalRevenue: +t.totalRevenue.toFixed(2),
      totalCost:   +t.totalCost.toFixed(4),
      roi:         roi !== null ? +roi.toFixed(1) : null,
      lastCall:    t.lastCall,
      rank:        0,
    };
  });

  ranked.sort((a, b) => order === 'desc' ? b.score - a.score : a.score - b.score);
  ranked.forEach((m, i) => { m.rank = i + 1; });
  return ranked.slice(0, limit);
}

/**
 * getAgentRankings — sorted autonomous agents by autonomy & success
 */
function getAgentRankings({ limit = 30 } = {}) {
  const all = [..._agents.values()];
  if (!all.length) return [];
  const maxRev = Math.max(...all.map(a => a.totalRevenue), 1);

  return all.map(a => {
    const successRate    = a.actions > 0 ? a.successes / a.actions : 0;
    const avgConfidence  = a.actions > 0 ? a.totalConfidence / a.actions : 0;
    const revenueNorm    = a.totalRevenue / maxRev;
    const score          = (successRate * 0.5) + (avgConfidence * 0.3) + (revenueNorm * 0.2);
    return {
      agent:         a.agent,
      score:         +score.toFixed(4),
      actions:       a.actions,
      successRate:   +((a.successes / Math.max(a.actions, 1)) * 100).toFixed(1),
      avgConfidence: +avgConfidence.toFixed(3),
      totalRevenue:  +a.totalRevenue.toFixed(2),
      topTaskType:   Object.entries(a.taskTypes).sort((x, y) => y[1] - x[1])[0]?.[0] || 'unknown',
      lastAction:    a.lastAction,
    };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map((v, i) => ({ ...v, rank: i + 1 }));
}

/**
 * getVerticalRankings — sorted verticals by revenue & margin
 */
function getVerticalRankings({ limit = 20 } = {}) {
  const all = [..._verticals.values()];
  if (!all.length) return [];
  return all.map(v => ({
    vertical:     v.vertical,
    totalRevenue: +v.totalRevenue.toFixed(2),
    totalCost:    +v.totalCost.toFixed(2),
    profit:       +(v.totalRevenue - v.totalCost).toFixed(2),
    margin:       v.totalRevenue > 0 ? +((v.totalRevenue - v.totalCost) / v.totalRevenue * 100).toFixed(1) : 0,
    customers:    v.customers,
    transactions: v.transactions,
    avgRevPerTx:  v.transactions > 0 ? +(v.totalRevenue / v.transactions).toFixed(2) : 0,
  })).sort((a, b) => b.profit - a.profit).slice(0, limit).map((v, i) => ({ ...v, rank: i + 1 }));
}

/**
 * getWeakLinks — returns bottom N modules, agents, verticals for remediation
 */
function getWeakLinks() {
  const worstModules   = getModuleRankings({ limit: 200, order: 'asc' }).slice(0, 5);
  const worstAgents    = getAgentRankings().reverse().slice(0, 3);
  const worstVerticals = getVerticalRankings({ limit: 100 }).reverse().slice(0, 3);

  return {
    worstModules,
    worstAgents,
    worstVerticals,
    remediationSuggestions: [
      ...worstModules.map(m => ({ type: 'module', name: m.module, action: m.errorRate > 20 ? 'fix-errors' : 'optimize-latency', priority: m.errorRate > 20 ? 'high' : 'medium' })),
      ...worstAgents.map(a => ({ type: 'agent', name: a.agent, action: 'retrain-or-replace', priority: 'medium' })),
      ...worstVerticals.map(v => ({ type: 'vertical', name: v.vertical, action: v.margin < 0 ? 'reprice-or-exit' : 'grow', priority: v.margin < 0 ? 'critical' : 'low' })),
    ],
  };
}

/**
 * getHighROIOpportunities — find which modules/agents to invest in
 */
function getHighROIOpportunities() {
  const top = getModuleRankings({ limit: 10 });
  return top.filter(m => m.roi !== null && m.roi > 50).map(m => ({
    module:     m.module,
    roi:        m.roi,
    suggestion: `Increase allocation to ${m.module} — ROI ${m.roi}%`,
  }));
}

// ── §3  BACKGROUND SNAPSHOT ───────────────────────────────────────────────

function _saveSnapshot() {
  try {
    fs.writeFileSync(RANKS_FILE, JSON.stringify({
      modules:   getModuleRankings({ limit: 100 }),
      agents:    getAgentRankings(),
      verticals: getVerticalRankings(),
      savedAt:   new Date().toISOString(),
    }, null, 2));
  } catch (_) {}
}

setInterval(_saveSnapshot, 5 * 60_000).unref(); // snapshot every 5 min

// ── §4  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/modules',      (_req, res) => res.json({ ok: true, rankings: getModuleRankings() }));
  r.get('/agents',       (_req, res) => res.json({ ok: true, rankings: getAgentRankings() }));
  r.get('/verticals',    (_req, res) => res.json({ ok: true, rankings: getVerticalRankings() }));
  r.get('/weak-links',   (_req, res) => res.json({ ok: true, ...getWeakLinks() }));
  r.get('/opportunities',(_req, res) => res.json({ ok: true, opportunities: getHighROIOpportunities() }));

  r.post('/record/module', express.json(), (req, res) => {
    recordModuleCall(req.body || {});
    res.json({ ok: true });
  });
  r.post('/record/agent', express.json(), (req, res) => {
    recordAgentAction(req.body || {});
    res.json({ ok: true });
  });
  r.post('/record/vertical', express.json(), (req, res) => {
    recordVerticalRevenue(req.body || {});
    res.json({ ok: true });
  });

  return r;
}

function getStatus() {
  return {
    name:        'module-performance-ranker',
    label:       'Module Performance Ranker',
    health:      'good',
    trackedModules:   _telemetry.size,
    trackedAgents:    _agents.size,
    trackedVerticals: _verticals.size,
    topModule:   getModuleRankings({ limit: 1 })[0]?.module || null,
    topAgent:    getAgentRankings({ limit: 1 })[0]?.agent   || null,
  };
}

module.exports = {
  recordModuleCall,
  recordAgentAction,
  recordVerticalRevenue,
  getModuleRankings,
  getAgentRankings,
  getVerticalRankings,
  getWeakLinks,
  getHighROIOpportunities,
  getStatus,
  router,
  bus,
};
