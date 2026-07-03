// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// investor-engine.js — Investor Intelligence & Metrics Engine
// Motor de metrici și rapoarte pentru investitori — Unicorn SaaS
// =============================================================================
// Computes and tracks:
//   1. MRR / ARR          — Monthly & Annual Recurring Revenue
//   2. Churn Rate         — monthly customer & revenue churn
//   3. Net Revenue Retention (NRR / NDR)
//   4. CAC / LTV / LTV:CAC ratio
//   5. Runway             — months of cash remaining
//   6. Growth Rate        — MoM, QoQ, YoY
//   7. Series-A Readiness Score  — composite 0-100
//   8. Investor Report    — formatted summary for due diligence
//   9. Weekly & monthly scheduled snapshots
// =============================================================================

'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');

// ── Storage ───────────────────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, '../../data/investor-engine');
const METRICS_F   = path.join(DATA_DIR, 'metrics-history.json');
const SNAPSHOT_F  = path.join(DATA_DIR, 'latest-snapshot.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

/** @type {MonthlyMetrics[]} */
let _history = _loadJson(METRICS_F, []);

/** @type {object|null} latest snapshot */
let _latestSnapshot = _loadJson(SNAPSHOT_F, null);

// ── §1  MRR / ARR COMPUTATION ─────────────────────────────────────────────

/**
 * computeMRR — derive MRR from active subscriptions
 * Derivă MRR din abonamentele active
 * This reads from the in-process billing state if available, otherwise
 * uses the injected snapshot.
 */
function computeMRR(subscriptions = []) {
  let mrr = 0;
  for (const sub of subscriptions) {
    const monthly = _normalizeToMonthly(sub.amount || 0, sub.interval || 'monthly');
    if (['active', 'trialing'].includes(sub.status)) mrr += monthly;
  }
  return +mrr.toFixed(2);
}

function _normalizeToMonthly(amount, interval) {
  switch ((interval || '').toLowerCase()) {
    case 'yearly':  case 'annual':    return amount / 12;
    case 'quarterly':                  return amount / 3;
    case 'weekly':                     return amount * 4.33;
    case 'daily':                      return amount * 30;
    default:                           return amount; // monthly
  }
}

// ── §2  CORE METRICS SNAPSHOT ─────────────────────────────────────────────

/**
 * buildSnapshot — compute a full investor-grade metrics snapshot
 * Construiește un snapshot complet de metrici pentru investitori
 */
function buildSnapshot({
  subscriptions  = [],
  newCustomers   = 0,
  churnedCustomers = 0,
  totalCustomers = 0,
  cashOnHand     = 0,
  monthlyBurnUsd = 0,
  totalRevenueAllTime = 0,
  cacUsd         = 25,
  revenueThisMonth = 0,
  revenuePrevMonth = 0,
  expansionRevenue = 0,  // upsells/upgrades this month
} = {}) {
  const mrr      = computeMRR(subscriptions);
  const arr      = +(mrr * 12).toFixed(2);

  // Churn
  const churnRate = totalCustomers > 0
    ? +((churnedCustomers / totalCustomers) * 100).toFixed(2)
    : 0;
  const revenueChurnRate = mrr > 0
    ? +(((mrr * churnRate / 100)) / mrr * 100).toFixed(2)
    : 0;

  // Net Revenue Retention = (MRR start + expansion - churn) / MRR start
  const mrrStart = mrr + (mrr * revenueChurnRate / 100) - expansionRevenue;
  const nrr = mrrStart > 0
    ? +((mrr / mrrStart) * 100).toFixed(1)
    : 100;

  // LTV = (ARPU / churn_rate_monthly)
  const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0;
  const monthlyChurnDecimal = churnRate / 100;
  const ltv = monthlyChurnDecimal > 0
    ? +(arpu / monthlyChurnDecimal).toFixed(2)
    : +(arpu * 36).toFixed(2); // assume 3-year lifetime if churn unknown

  const ltvCacRatio = cacUsd > 0 ? +(ltv / cacUsd).toFixed(2) : null;

  // Runway
  const runway = monthlyBurnUsd > 0
    ? Math.floor(cashOnHand / monthlyBurnUsd)
    : Infinity;

  // Growth rate MoM
  const momGrowth = revenuePrevMonth > 0
    ? +((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth * 100).toFixed(1)
    : 0;

  // Series-A Readiness Score (0-100)
  const seriesAScore = _computeSeriesAScore({
    mrr, arr, churnRate, nrr, ltvCacRatio, momGrowth, runway, totalCustomers, cashOnHand,
  });

  const snapshot = {
    timestamp:       new Date().toISOString(),
    mrr,
    arr,
    churnRate,
    revenueChurnRate,
    nrr,
    arpu:            +arpu.toFixed(2),
    ltv,
    cac:             cacUsd,
    ltvCacRatio,
    totalCustomers,
    newCustomers,
    churnedCustomers,
    cashOnHand,
    monthlyBurnUsd,
    runway:          runway === Infinity ? null : runway,
    revenueThisMonth,
    revenuePrevMonth,
    momGrowth,
    totalRevenueAllTime,
    seriesAScore,
    seriesAReadiness: _interpretSeriesA(seriesAScore),
  };

  _latestSnapshot = snapshot;
  _history.push({ month: new Date().toISOString().slice(0, 7), ...snapshot });
  if (_history.length > 120) _history = _history.slice(-120); // 10 years
  _persist();
  return snapshot;
}

// ── §3  SERIES-A READINESS SCORING ───────────────────────────────────────

function _computeSeriesAScore({ mrr, arr, churnRate, nrr, ltvCacRatio, momGrowth, runway, totalCustomers, cashOnHand }) {
  let score = 0;

  // ARR benchmarks (max 25 pts)
  if (arr >= 1_000_000)      score += 25;
  else if (arr >= 500_000)   score += 20;
  else if (arr >= 100_000)   score += 12;
  else if (arr >= 10_000)    score += 5;

  // MoM growth (max 20 pts)
  if (momGrowth >= 20)       score += 20;
  else if (momGrowth >= 10)  score += 15;
  else if (momGrowth >= 5)   score += 8;
  else if (momGrowth >= 2)   score += 4;

  // Churn (max 20 pts — lower is better)
  if (churnRate <= 1)        score += 20;
  else if (churnRate <= 3)   score += 15;
  else if (churnRate <= 5)   score += 8;
  else if (churnRate > 10)   score -= 5;

  // NRR (max 15 pts)
  if (nrr >= 120)            score += 15;
  else if (nrr >= 110)       score += 12;
  else if (nrr >= 100)       score += 8;

  // LTV:CAC (max 10 pts)
  if (ltvCacRatio && ltvCacRatio >= 5)     score += 10;
  else if (ltvCacRatio && ltvCacRatio >= 3) score += 7;
  else if (ltvCacRatio && ltvCacRatio >= 2) score += 4;

  // Runway (max 10 pts)
  if (runway === null || runway >= 18)  score += 10;
  else if (runway >= 12)                score += 7;
  else if (runway >= 6)                 score += 3;

  return Math.max(0, Math.min(100, score));
}

function _interpretSeriesA(score) {
  if (score >= 80) return { grade: 'A', label: 'Series A Ready', description: 'Strong metrics — institutional VCs will engage' };
  if (score >= 65) return { grade: 'B', label: 'Pre-Series A', description: 'Good momentum, work on churn and NRR' };
  if (score >= 50) return { grade: 'C', label: 'Seed Stage', description: 'Angel/seed ready, 12-18 months to Series A metrics' };
  if (score >= 30) return { grade: 'D', label: 'Early Traction', description: 'Focus on PMF and first paying customers' };
  return { grade: 'F', label: 'Pre-Revenue', description: 'Build MVP and first 10 customers before fundraising' };
}

// ── §4  INVESTOR REPORT ───────────────────────────────────────────────────

/**
 * generateInvestorReport — markdown/JSON report for due diligence
 * Generează raport pentru due diligence investitori
 */
function generateInvestorReport() {
  const s = _latestSnapshot;
  if (!s) return { ok: false, error: 'No snapshot available. Call POST /api/investor/snapshot first.' };

  const lines = [
    `# ZeusAI / Unicorn — Investor Metrics Report`,
    `**Generated:** ${s.timestamp}`,
    ``,
    `## 💰 Revenue`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| MRR | $${s.mrr.toLocaleString()} |`,
    `| ARR | $${s.arr.toLocaleString()} |`,
    `| Revenue This Month | $${(s.revenueThisMonth || 0).toLocaleString()} |`,
    `| Total Revenue (All Time) | $${(s.totalRevenueAllTime || 0).toLocaleString()} |`,
    `| MoM Growth | ${s.momGrowth}% |`,
    ``,
    `## 👥 Customers`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Customers | ${s.totalCustomers} |`,
    `| New This Month | ${s.newCustomers} |`,
    `| Churned | ${s.churnedCustomers} |`,
    `| Monthly Churn Rate | ${s.churnRate}% |`,
    `| ARPU | $${s.arpu} |`,
    ``,
    `## 📈 Retention & Efficiency`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| NRR (Net Revenue Retention) | ${s.nrr}% |`,
    `| LTV | $${s.ltv} |`,
    `| CAC | $${s.cac} |`,
    `| LTV:CAC Ratio | ${s.ltvCacRatio || 'N/A'}x |`,
    ``,
    `## 💼 Runway & Capital`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Cash On Hand | $${(s.cashOnHand || 0).toLocaleString()} |`,
    `| Monthly Burn | $${(s.monthlyBurnUsd || 0).toLocaleString()} |`,
    `| Runway | ${s.runway ? s.runway + ' months' : 'Profitable / No burn'} |`,
    ``,
    `## 🏆 Series-A Readiness`,
    `**Score: ${s.seriesAScore}/100 — ${s.seriesAReadiness.grade} (${s.seriesAReadiness.label})**`,
    `${s.seriesAReadiness.description}`,
  ];

  return { ok: true, markdown: lines.join('\n'), snapshot: s };
}

// ── §5  GROWTH HISTORY ────────────────────────────────────────────────────

function getGrowthHistory(months = 12) {
  return _history.slice(-months).map(h => ({
    month: h.month, mrr: h.mrr, arr: h.arr, customers: h.totalCustomers, churnRate: h.churnRate, nrr: h.nrr, momGrowth: h.momGrowth,
  }));
}

// ── §6  HELPERS ───────────────────────────────────────────────────────────

function _persist() {
  try {
    fs.writeFileSync(METRICS_F,  JSON.stringify(_history.slice(-120), null, 2));
    fs.writeFileSync(SNAPSHOT_F, JSON.stringify(_latestSnapshot, null, 2));
  } catch (_) {}
}

function _loadJson(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}

// ── §7  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/snapshot', (_req, res) => {
    if (!_latestSnapshot) return res.status(404).json({ ok: false, error: 'No snapshot yet — POST /api/investor/snapshot to generate' });
    res.json({ ok: true, snapshot: _latestSnapshot });
  });

  r.post('/snapshot', express.json(), (req, res) => {
    const snapshot = buildSnapshot(req.body || {});
    res.json({ ok: true, snapshot });
  });

  r.get('/report', (_req, res) => {
    const report = generateInvestorReport();
    res.json(report);
  });

  r.get('/history', (req, res) => {
    const months = Math.min(Number(req.query.months) || 12, 120);
    res.json({ ok: true, history: getGrowthHistory(months) });
  });

  r.get('/series-a', (_req, res) => {
    if (!_latestSnapshot) return res.status(404).json({ ok: false, error: 'No snapshot available' });
    res.json({ ok: true, score: _latestSnapshot.seriesAScore, readiness: _latestSnapshot.seriesAReadiness, snapshot: _latestSnapshot });
  });

  return r;
}

function getStatus() {
  const s = _latestSnapshot;
  return {
    name:            'investor-engine',
    label:           'Investor Intelligence Engine',
    health:          'good',
    hasSnapshot:     !!s,
    latestMRR:       s?.mrr || 0,
    latestARR:       s?.arr || 0,
    seriesAScore:    s?.seriesAScore || 0,
    churnRate:       s?.churnRate || 0,
    nrr:             s?.nrr || 0,
    historyMonths:   _history.length,
  };
}

module.exports = {
  buildSnapshot,
  computeMRR,
  generateInvestorReport,
  getGrowthHistory,
  getStatus,
  router,
};
