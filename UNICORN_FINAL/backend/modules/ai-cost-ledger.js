// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-31T11:14:36.191Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =====================================================================
// AI COST LEDGER — Zeus AI Unicorn
//
// Real, persistent token/cost accounting for every AI provider call.
// Replaces the previously-static `costStrategy` config block with a live,
// append-only ledger that survives restarts and powers budget alerting.
//
//   • Storage: data/ai-cost/ledger.json — rolling window of the most
//     recent entries (capped), atomic write (.tmp → rename).
//   • record(): logs {provider, model, task, tokens, costUsd, ts}.
//   • summary(): aggregates spend over a window, grouped by provider/task.
//   • Budget: AI_MONTHLY_BUDGET_USD (default 100) with alert threshold
//     AI_BUDGET_ALERT_THRESHOLD (default 0.8). overBudget / alerting flags
//     are derived from real current-month spend.
//   • estimateCost(): real cost from a built-in $/1M-token price table.
// =====================================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'ai-cost');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const MAX_ENTRIES = parseInt(process.env.AI_COST_MAX_ENTRIES || '20000', 10);

const MONTHLY_BUDGET_USD = parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '100');
const ALERT_THRESHOLD = (() => {
  const t = parseFloat(process.env.AI_BUDGET_ALERT_THRESHOLD || '0.8');
  return Number.isFinite(t) && t > 0 && t <= 1 ? t : 0.8;
})();

// Cost per 1M tokens (USD). Blended input/output estimate per model/provider.
const PRICE_PER_M = {
  'gpt-4o': 5.0,
  'gpt-4o-mini': 0.15,
  'claude-3-5-sonnet': 3.0,
  'gemini-1.5-pro': 7.5,
  'gemini-1.5-flash': 0.075,
  'deepseek-chat': 0.14,
  'deepseek-reasoner': 0.55,
  'deepseek-coder': 0.14,
  'mistral-large': 2.7,
  'mistral-small': 0.14,
  'groq-llama3-70b': 0.27,
  'llama3-8b-8192': 0.07,
  'qwen-2.5-72b': 0.3,
  'command-r-plus': 3.0,
  'command-r': 0.5,
};
const DEFAULT_PRICE_PER_M = parseFloat(process.env.AI_DEFAULT_PRICE_PER_M || '0.5');

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {
  console.error('[ai-cost] mkdir failed — persistence disabled:', e.message);
}

/** @type {Array<{provider:string,model:string,task:string,tokens:number,costUsd:number,ts:number}>} */
let _entries = _load();

function _load() {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[ai-cost] load failed, starting empty:', e.message);
    return [];
  }
}

function _save() {
  try {
    const tmp = LEDGER_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_entries));
    fs.renameSync(tmp, LEDGER_FILE);
    return true;
  } catch (e) {
    console.error('[ai-cost] save failed:', e.message);
    return false;
  }
}

function pricePerMillion(model) {
  const key = String(model || '').toLowerCase();
  if (PRICE_PER_M[key] != null) return PRICE_PER_M[key];
  // Loose prefix match (e.g. "gpt-4o-2024-…" → "gpt-4o").
  for (const k of Object.keys(PRICE_PER_M)) {
    if (key.startsWith(k)) return PRICE_PER_M[k];
  }
  return DEFAULT_PRICE_PER_M;
}

/**
 * Estimate USD cost for a token count on a given model.
 * @returns {{model:string, tokens:number, pricePerMillion:number, costUsd:number}}
 */
function estimateCost(model, tokens) {
  const t = Math.max(0, parseInt(tokens, 10) || 0);
  const ppm = pricePerMillion(model);
  return {
    model: String(model || 'unknown'),
    tokens: t,
    pricePerMillion: ppm,
    costUsd: +((t / 1e6) * ppm).toFixed(8),
  };
}

/**
 * Record a real AI call. costUsd is used when provided, otherwise derived
 * from model + tokens. Always returns the persisted entry.
 */
function record(entry = {}) {
  const tokens = Math.max(0, parseInt(entry.tokens, 10) || 0);
  const model = String(entry.model || 'unknown');
  const costUsd = (typeof entry.costUsd === 'number' && entry.costUsd >= 0)
    ? +entry.costUsd.toFixed(8)
    : estimateCost(model, tokens).costUsd;
  const row = {
    provider: String(entry.provider || 'unknown'),
    model,
    task: String(entry.task || 'chat'),
    tokens,
    costUsd,
    ts: entry.ts && Number.isFinite(entry.ts) ? entry.ts : Date.now(),
  };
  _entries.push(row);
  if (_entries.length > MAX_ENTRIES) _entries = _entries.slice(_entries.length - MAX_ENTRIES);
  _save();
  return row;
}

function _monthStartMs(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/**
 * Aggregate spend over a time window.
 * @param {object} [opts] { sinceMs, untilMs }
 */
function summary(opts = {}) {
  const since = Number.isFinite(opts.sinceMs) ? opts.sinceMs : 0;
  const until = Number.isFinite(opts.untilMs) ? opts.untilMs : Date.now();
  const byProvider = {};
  const byTask = {};
  let totalCost = 0;
  let totalTokens = 0;
  let calls = 0;
  for (const e of _entries) {
    if (e.ts < since || e.ts > until) continue;
    calls++;
    totalCost += e.costUsd;
    totalTokens += e.tokens;
    byProvider[e.provider] = byProvider[e.provider] || { costUsd: 0, tokens: 0, calls: 0 };
    byProvider[e.provider].costUsd += e.costUsd;
    byProvider[e.provider].tokens += e.tokens;
    byProvider[e.provider].calls += 1;
    byTask[e.task] = byTask[e.task] || { costUsd: 0, tokens: 0, calls: 0 };
    byTask[e.task].costUsd += e.costUsd;
    byTask[e.task].tokens += e.tokens;
    byTask[e.task].calls += 1;
  }
  const round = (n) => +n.toFixed(8);
  for (const k of Object.keys(byProvider)) byProvider[k].costUsd = round(byProvider[k].costUsd);
  for (const k of Object.keys(byTask)) byTask[k].costUsd = round(byTask[k].costUsd);
  return {
    calls,
    totalTokens,
    totalCostUsd: round(totalCost),
    byProvider,
    byTask,
    windowSinceMs: since,
    windowUntilMs: until,
  };
}

/** Current-month spend + budget state derived from real entries. */
function budget(now = Date.now()) {
  const monthSummary = summary({ sinceMs: _monthStartMs(now), untilMs: now });
  const spent = monthSummary.totalCostUsd;
  const ratio = MONTHLY_BUDGET_USD > 0 ? spent / MONTHLY_BUDGET_USD : 0;
  return {
    monthlyBudgetUsd: MONTHLY_BUDGET_USD,
    spentUsd: spent,
    remainingUsd: +(Math.max(0, MONTHLY_BUDGET_USD - spent)).toFixed(8),
    usedRatio: +ratio.toFixed(4),
    alertThreshold: ALERT_THRESHOLD,
    alerting: ratio >= ALERT_THRESHOLD,
    overBudget: spent > MONTHLY_BUDGET_USD,
    monthStartMs: _monthStartMs(now),
  };
}

function clear() {
  const n = _entries.length;
  _entries = [];
  _save();
  return n;
}

function getStatus() {
  return {
    active: true,
    module: 'ai-cost-ledger',
    entries: _entries.length,
    maxEntries: MAX_ENTRIES,
    budget: budget(),
    timestamp: new Date().toISOString(),
  };
}

function router(express, opts = {}) {
  const r = express.Router();
  const adminGuard = typeof opts.adminGuard === 'function'
    ? opts.adminGuard
    : (req, res, next) => next();

  r.get('/summary', (req, res) => {
    const days = parseInt(req.query.days, 10);
    const sinceMs = Number.isFinite(days) && days > 0
      ? Date.now() - days * 86400000
      : _monthStartMs();
    res.json({ ok: true, budget: budget(), summary: summary({ sinceMs }) });
  });

  r.get('/estimate', (req, res) => {
    res.json(estimateCost(req.query.model, req.query.tokens));
  });

  r.post('/record', adminGuard, (req, res) => {
    const row = record(req.body || {});
    res.json({ ok: true, entry: row, budget: budget() });
  });

  return r;
}

module.exports = {
  record,
  summary,
  budget,
  estimateCost,
  pricePerMillion,
  clear,
  getStatus,
  router,
  PRICE_PER_M,
};
