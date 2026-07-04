// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// capital-protection.js — Capital Protection & Risk Defense Engine
// Motor de protecție capital și apărare risc pentru Unicorn SaaS
// =============================================================================
// Responsibilities / Responsabilități:
//   1. Budget Limits       — daily/monthly spend caps per category
//   2. Spend Tracking      — real-time spend ledger with rollup
//   3. Risk Scoring        — automated risk assessment per operation
//   4. Runaway Detection   — detect runaway tasks / infinite loops
//   5. Emergency Shutdown  — hard-stop autonomous systems on threshold breach
//   6. Profit Lock         — protect earned revenue from re-spend
//   7. Capital Defense     — preserve minimum operating capital
//   8. REST router         — /api/capital/* endpoints
// =============================================================================

'use strict';

const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');
const express      = require('express');

// ── Config / Configurare ──────────────────────────────────────────────────
const DEFAULT_DAILY_SPEND_LIMIT   = Number(process.env.CAPITAL_DAILY_LIMIT   || 500);   // USD
const DEFAULT_MONTHLY_SPEND_LIMIT = Number(process.env.CAPITAL_MONTHLY_LIMIT || 10000); // USD
const DEFAULT_SINGLE_OP_LIMIT     = Number(process.env.CAPITAL_OP_LIMIT      || 200);   // USD per single operation
const EMERGENCY_RESERVE_USD       = Number(process.env.CAPITAL_RESERVE       || 1000);  // minimum buffer
const RISK_SHUTDOWN_THRESHOLD     = Number(process.env.CAPITAL_RISK_THRESHOLD || 90);   // risk score 0-100
const PROFIT_LOCK_PCT             = Number(process.env.CAPITAL_PROFIT_LOCK    || 30);   // lock 30% of profit

const DATA_DIR     = path.join(__dirname, '../../data/capital-protection');
const LEDGER_FILE  = path.join(DATA_DIR, 'ledger.json');
const STATE_FILE   = path.join(DATA_DIR, 'state.json');

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// ── In-memory state / Stare în memorie ───────────────────────────────────
const bus = new EventEmitter();
bus.setMaxListeners(30);

let _emergencyMode = false;
let _lastEmergencyAt = null;

/** @type {Array<{id:string,ts:string,category:string,amountUsd:number,description:string,approved:boolean}>} */
let _ledger = _loadJson(LEDGER_FILE, []);

/** @type {{totalRevenue:number, totalSpend:number, lockedProfit:number, operatingCapital:number}} */
let _capitalState = _loadJson(STATE_FILE, {
  totalRevenue:     0,
  totalSpend:       0,
  lockedProfit:     0,
  operatingCapital: 0,
});

/** @type {Map<string,{count:number,totalSpend:number,lastAt:string}>} Running task registry */
const _activeTasks = new Map();

/** @type {Array<{ts:string,event:string,detail:string,riskScore:number}>} */
const _riskLog = [];

// ── §1  SPEND TRACKING ────────────────────────────────────────────────────

function _todayKey()  { return new Date().toISOString().slice(0, 10); }
function _monthKey()  { return new Date().toISOString().slice(0, 7); }

/** getSpendSummary — roll up ledger by time window */
function getSpendSummary() {
  const today = _todayKey();
  const month = _monthKey();
  let dailySpend = 0, monthlySpend = 0;
  for (const entry of _ledger) {
    if (entry.ts.startsWith(today)) dailySpend += entry.amountUsd;
    if (entry.ts.startsWith(month))  monthlySpend += entry.amountUsd;
  }
  return {
    dailySpend,
    monthlySpend,
    dailyLimit:   DEFAULT_DAILY_SPEND_LIMIT,
    monthlyLimit: DEFAULT_MONTHLY_SPEND_LIMIT,
    dailyRemaining:   Math.max(0, DEFAULT_DAILY_SPEND_LIMIT   - dailySpend),
    monthlyRemaining: Math.max(0, DEFAULT_MONTHLY_SPEND_LIMIT - monthlySpend),
    emergencyMode:    _emergencyMode,
    lockedProfit:     _capitalState.lockedProfit,
    operatingCapital: _capitalState.operatingCapital,
  };
}

// ── §2  RISK SCORING ──────────────────────────────────────────────────────

/**
 * scoreOperation — computes risk score 0-100 for a proposed spend
 * Calculează scor de risc 0-100 pentru o cheltuială propusă
 */
function scoreOperation({ amountUsd = 0, category = 'general', frequency = 1 }) {
  let score = 0;
  const summary = getSpendSummary();

  // Size vs single-op limit
  if (amountUsd > DEFAULT_SINGLE_OP_LIMIT * 2) score += 40;
  else if (amountUsd > DEFAULT_SINGLE_OP_LIMIT) score += 20;
  else if (amountUsd > DEFAULT_SINGLE_OP_LIMIT * 0.5) score += 10;

  // Daily budget utilization
  const dailyUtil = (summary.dailySpend + amountUsd) / DEFAULT_DAILY_SPEND_LIMIT;
  if (dailyUtil > 1.0) score += 35;
  else if (dailyUtil > 0.8) score += 20;
  else if (dailyUtil > 0.6) score += 10;

  // Monthly budget utilization
  const monthlyUtil = (summary.monthlySpend + amountUsd) / DEFAULT_MONTHLY_SPEND_LIMIT;
  if (monthlyUtil > 1.0) score += 25;
  else if (monthlyUtil > 0.8) score += 10;

  // High-frequency operations
  if (frequency > 100) score += 20;
  else if (frequency > 50) score += 10;

  // Emergency reserve check
  if (_capitalState.operatingCapital - amountUsd < EMERGENCY_RESERVE_USD) score += 30;

  // Emergency mode doubles all risk
  if (_emergencyMode) score = Math.min(100, score * 2);

  return Math.min(100, score);
}

// ── §3  BUDGET ENFORCEMENT ────────────────────────────────────────────────

/**
 * requestSpend — gate for any autonomous spending. Returns {approved, riskScore, reason}
 * Poartă pentru orice cheltuială autonomă. Returnează {approved, riskScore, reason}
 */
function requestSpend({ amountUsd, category = 'general', description = '', taskId = null }) {
  if (_emergencyMode) {
    _logRisk({ event: 'spend_blocked_emergency', detail: `${category}: $${amountUsd}`, riskScore: 100 });
    return { approved: false, riskScore: 100, reason: 'Emergency mode active — all autonomous spend blocked' };
  }

  if (amountUsd <= 0) return { approved: true, riskScore: 0, reason: 'Zero-cost operation' };

  const frequency = taskId ? (_activeTasks.get(taskId)?.count || 0) : 0;
  const riskScore = scoreOperation({ amountUsd, category, frequency });

  if (riskScore >= RISK_SHUTDOWN_THRESHOLD) {
    _logRisk({ event: 'spend_high_risk', detail: `${category}: $${amountUsd} riskScore=${riskScore}`, riskScore });
    bus.emit('highRisk', { amountUsd, category, riskScore });
    return { approved: false, riskScore, reason: `Risk score ${riskScore} exceeds threshold ${RISK_SHUTDOWN_THRESHOLD}` };
  }

  const summary = getSpendSummary();
  if (summary.dailySpend + amountUsd > DEFAULT_DAILY_SPEND_LIMIT) {
    _logRisk({ event: 'daily_limit_breach', detail: `$${amountUsd}`, riskScore });
    return { approved: false, riskScore, reason: `Daily limit $${DEFAULT_DAILY_SPEND_LIMIT} would be exceeded` };
  }
  if (summary.monthlySpend + amountUsd > DEFAULT_MONTHLY_SPEND_LIMIT) {
    _logRisk({ event: 'monthly_limit_breach', detail: `$${amountUsd}`, riskScore });
    return { approved: false, riskScore, reason: `Monthly limit $${DEFAULT_MONTHLY_SPEND_LIMIT} would be exceeded` };
  }

  // Approved — record
  const entry = {
    id:          `spend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts:          new Date().toISOString(),
    category,
    amountUsd,
    description,
    taskId,
    riskScore,
    approved:    true,
  };
  _ledger.push(entry);
  if (_ledger.length > 10000) _ledger = _ledger.slice(-10000);
  _capitalState.totalSpend += amountUsd;
  _persist();
  return { approved: true, riskScore, reason: 'Within budget limits', entryId: entry.id };
}

// ── §4  REVENUE RECORDING & PROFIT LOCK ──────────────────────────────────

/**
 * recordRevenue — log incoming revenue and compute profit lock
 * Înregistrează veniturile primite și calculează blocarea profitului
 */
function recordRevenue(amountUsd, source = 'payment') {
  if (amountUsd <= 0) return;
  _capitalState.totalRevenue += amountUsd;
  // Lock PROFIT_LOCK_PCT% of each earned dollar
  const locked = amountUsd * (PROFIT_LOCK_PCT / 100);
  _capitalState.lockedProfit += locked;
  _capitalState.operatingCapital += amountUsd - locked;
  _persist();
  bus.emit('revenue', { amountUsd, source, lockedProfit: _capitalState.lockedProfit });
}

// ── §5  RUNAWAY TASK DETECTION ────────────────────────────────────────────

/**
 * registerTask / unregisterTask — track autonomous task lifecycle
 */
function registerTask(taskId, { maxCalls = 1000, maxSpendUsd = 50 } = {}) {
  _activeTasks.set(taskId, { count: 0, totalSpend: 0, startedAt: new Date().toISOString(), maxCalls, maxSpendUsd });
}

function tickTask(taskId, spendUsd = 0) {
  const t = _activeTasks.get(taskId);
  if (!t) return { ok: true };
  t.count += 1;
  t.totalSpend += spendUsd;
  if (t.count > t.maxCalls) {
    _logRisk({ event: 'runaway_calls', detail: `task ${taskId} exceeded ${t.maxCalls} calls`, riskScore: 80 });
    unregisterTask(taskId);
    return { ok: false, reason: `Runaway task: exceeded ${t.maxCalls} calls` };
  }
  if (t.totalSpend > t.maxSpendUsd) {
    _logRisk({ event: 'runaway_spend', detail: `task ${taskId} spent $${t.totalSpend}`, riskScore: 80 });
    unregisterTask(taskId);
    return { ok: false, reason: `Runaway spend: $${t.totalSpend} > $${t.maxSpendUsd}` };
  }
  return { ok: true };
}

function unregisterTask(taskId) {
  _activeTasks.delete(taskId);
}

// ── §6  EMERGENCY MODE ────────────────────────────────────────────────────

function activateEmergency(reason = 'manual') {
  _emergencyMode  = true;
  _lastEmergencyAt = new Date().toISOString();
  _logRisk({ event: 'emergency_activated', detail: reason, riskScore: 100 });
  bus.emit('emergency', { reason, activatedAt: _lastEmergencyAt });
  console.error('[capital-protection] 🚨 EMERGENCY MODE ACTIVATED:', reason);
}

function deactivateEmergency(reason = 'manual') {
  _emergencyMode = false;
  _logRisk({ event: 'emergency_deactivated', detail: reason, riskScore: 0 });
  bus.emit('emergencyLifted', { reason });
  console.log('[capital-protection] ✅ Emergency mode deactivated:', reason);
}

// ── §7  INTERNAL HELPERS ──────────────────────────────────────────────────

function _logRisk({ event, detail, riskScore }) {
  _riskLog.unshift({ ts: new Date().toISOString(), event, detail, riskScore });
  if (_riskLog.length > 500) _riskLog.pop();
  if (riskScore >= 70) console.warn(`[capital-protection] ⚠️  ${event}: ${detail}`);
}

function _persist() {
  try {
    fs.writeFileSync(LEDGER_FILE, JSON.stringify(_ledger.slice(-5000), null, 2));
    fs.writeFileSync(STATE_FILE,  JSON.stringify(_capitalState, null, 2));
  } catch (_) {}
}

function _loadJson(file, def) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return def;
}

// ── §8  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/status', (_req, res) => {
    res.json({
      ok: true,
      emergencyMode: _emergencyMode,
      lastEmergencyAt: _lastEmergencyAt,
      activeTasks: _activeTasks.size,
      ...getSpendSummary(),
      riskLogCount: _riskLog.length,
    });
  });

  r.get('/ledger', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    res.json({ ok: true, ledger: _ledger.slice(-limit) });
  });

  r.get('/risk-log', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    res.json({ ok: true, riskLog: _riskLog.slice(0, limit) });
  });

  r.post('/spend-request', express.json(), (req, res) => {
    const { amountUsd, category, description, taskId } = req.body || {};
    if (!amountUsd) return res.status(400).json({ ok: false, error: 'amountUsd required' });
    res.json(requestSpend({ amountUsd: Number(amountUsd), category, description, taskId }));
  });

  r.post('/record-revenue', express.json(), (req, res) => {
    const { amountUsd, source } = req.body || {};
    if (!amountUsd) return res.status(400).json({ ok: false, error: 'amountUsd required' });
    recordRevenue(Number(amountUsd), source);
    res.json({ ok: true, capitalState: _capitalState });
  });

  r.post('/emergency/activate', express.json(), (req, res) => {
    activateEmergency((req.body || {}).reason || 'api-request');
    res.json({ ok: true, emergencyMode: true });
  });

  r.post('/emergency/deactivate', express.json(), (req, res) => {
    deactivateEmergency((req.body || {}).reason || 'api-request');
    res.json({ ok: true, emergencyMode: false });
  });

  return r;
}

// ── Status export ─────────────────────────────────────────────────────────
function getStatus() {
  return {
    name:          'capital-protection',
    label:         'Capital Protection Engine',
    health:        _emergencyMode ? 'emergency' : 'good',
    emergencyMode: _emergencyMode,
    ...getSpendSummary(),
    activeTasks:   _activeTasks.size,
    riskEvents:    _riskLog.length,
  };
}

module.exports = {
  requestSpend,
  recordRevenue,
  registerTask,
  tickTask,
  unregisterTask,
  activateEmergency,
  deactivateEmergency,
  getSpendSummary,
  scoreOperation,
  getStatus,
  router,
  bus,
  // Constants exposed for testing / override
  DEFAULT_DAILY_SPEND_LIMIT,
  DEFAULT_MONTHLY_SPEND_LIMIT,
  EMERGENCY_RESERVE_USD,
  PROFIT_LOCK_PCT,
};
