// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnkmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// acquisition-engine.js — Digital Acquisition Intelligence Engine
// Motor de achiziții digitale pentru Unicorn SaaS
// =============================================================================
// Functions / Funcții:
//   1. Target Scanner       — find digital products/SaaS to acquire
//   2. Valuation Model      — ARR-multiple, EBITDA, revenue multiple
//   3. ROI Estimator        — projected return after integration
//   4. Integration Cost     — effort/time/risk assessment
//   5. Deal Pipeline        — CRM-style pipeline for acquisition candidates
//   6. Strategic Fit Scorer — how well a target fits Unicorn's stack
//   7. Market signals       — track acquisition opportunities in real-time
// =============================================================================

'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const express = require('express');

// ── Storage ───────────────────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, '../../data/acquisition-engine');
const PIPELINE_F  = path.join(DATA_DIR, 'pipeline.json');
const SIGNALS_F   = path.join(DATA_DIR, 'market-signals.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

/** @type {AcquisitionTarget[]} */
let _pipeline = _loadJson(PIPELINE_F, []);

/** @type {MarketSignal[]} */
let _signals = _loadJson(SIGNALS_F, []);

// ── §1  VALUATION MODELS ──────────────────────────────────────────────────

/**
 * valuate — compute acquisition price range using multiple methods
 * Calculează intervalul de preț de achiziție folosind metode multiple
 */
function valuate({
  arrUsd      = 0,
  mrrUsd      = 0,
  ebitdaUsd   = 0,
  revenueUsd  = 0,
  growthRate  = 0,    // % MoM
  churnRate   = 5,    // % monthly
  customers   = 0,
  category    = 'saas', // saas | marketplace | tool | data | infra
}) {
  const arr = arrUsd || mrrUsd * 12;

  // ARR Multiple — standard SaaS valuation (based on growth + retention)
  let arrMultiple = 3;
  if (growthRate >= 20 && churnRate <= 2)  arrMultiple = 8;
  else if (growthRate >= 10 && churnRate <= 5)  arrMultiple = 5;
  else if (growthRate >= 5)                arrMultiple = 4;
  else if (churnRate > 10)                 arrMultiple = 2;

  // Adjust for category
  const categoryMult = { saas: 1.0, marketplace: 1.3, data: 1.5, infra: 1.2, tool: 0.8 };
  arrMultiple *= (categoryMult[category] || 1.0);

  const arrValuation   = +(arr * arrMultiple).toFixed(0);

  // Revenue multiple (for non-subscription businesses)
  const revMultiple    = category === 'marketplace' ? 2.5 : 1.5;
  const revValuation   = +(revenueUsd * revMultiple).toFixed(0);

  // EBITDA multiple
  const ebitdaMultiple = growthRate >= 15 ? 15 : growthRate >= 5 ? 10 : 7;
  const ebitdaValuation = ebitdaUsd > 0 ? +(ebitdaUsd * ebitdaMultiple).toFixed(0) : null;

  // Customer value
  const customerValuation = customers > 0 ? customers * (arr > 0 ? arr / customers * 3 : 500) : 0;

  const low  = Math.min(...[arrValuation, revValuation, ebitdaValuation, customerValuation].filter(v => v && v > 0));
  const high = Math.max(...[arrValuation, revValuation, ebitdaValuation, customerValuation].filter(v => v && v > 0));
  const mid  = +((low + high) / 2).toFixed(0);

  return {
    valuationRange: { low, mid, high },
    methods: {
      arrMultiple:     { multiple: +arrMultiple.toFixed(1), value: arrValuation },
      revenueMultiple: { multiple: revMultiple, value: revValuation },
      ebitdaMultiple:  ebitdaUsd > 0 ? { multiple: ebitdaMultiple, value: ebitdaValuation } : null,
      customerValue:   customers > 0  ? { perCustomer: +(customerValuation / customers).toFixed(0), value: +customerValuation.toFixed(0) } : null,
    },
    recommendedOffer: +((mid * 0.85)).toFixed(0), // 15% discount to midpoint
  };
}

// ── §2  ROI ESTIMATOR ─────────────────────────────────────────────────────

/**
 * estimateROI — projected return on acquisition
 */
function estimateROI({
  purchasePriceUsd,
  arrUsd,
  growthRatePct     = 5,  // expected annual growth after integration
  synergyRevUsd     = 0,  // additional revenue from cross-sell
  integrationCostUsd = 0,
  integrationMonths  = 6,
  holdYears          = 5,
}) {
  let revenue = arrUsd;
  let cumRevenue = 0;
  const yearlyProjections = [];
  for (let y = 1; y <= holdYears; y++) {
    revenue = revenue * (1 + growthRatePct / 100);
    if (y > integrationMonths / 12) revenue += synergyRevUsd;
    cumRevenue += revenue;
    yearlyProjections.push({ year: y, projectedARR: +revenue.toFixed(0), cumRevenue: +cumRevenue.toFixed(0) });
  }
  const totalCost  = purchasePriceUsd + integrationCostUsd;
  const roi        = totalCost > 0 ? +((cumRevenue - totalCost) / totalCost * 100).toFixed(1) : null;
  const paybackYrs = arrUsd > 0 ? +(purchasePriceUsd / arrUsd).toFixed(1) : null;

  return {
    purchasePriceUsd,
    integrationCostUsd,
    totalCostUsd:       totalCost,
    projectedRevenue5yr: +cumRevenue.toFixed(0),
    roi5yr:             roi,
    paybackYears:       paybackYrs,
    irr:                roi !== null ? +(roi / holdYears).toFixed(1) : null,
    yearlyProjections,
    verdict: roi !== null
      ? roi >= 200 ? 'Excellent ROI — acquire aggressively'
      : roi >= 100 ? 'Good ROI — proceed with standard diligence'
      : roi >= 50  ? 'Moderate ROI — negotiate price down 20%+'
      : 'Poor ROI — pass or require significant price reduction'
      : 'Insufficient data',
  };
}

// ── §3  STRATEGIC FIT SCORER ──────────────────────────────────────────────

/**
 * scoreStrategicFit — how well a target fits Unicorn's strategy
 */
function scoreStrategicFit({
  hasComplementaryTech  = false,  // APIs, data, modules we don't have
  customerOverlap       = 0,      // % overlap with our existing customer base (0-100)
  competitorElimination = false,  // would this remove a direct competitor?
  hasDistributionChannel = false,  // new channel / marketplace
  teamRetention         = false,  // key team willing to stay
  techDebt              = 'low',  // low | medium | high
  ipStrength            = 'medium', // none | weak | medium | strong | patent
  complianceBurden      = 'low',  // low | medium | high
}) {
  let score = 0;
  if (hasComplementaryTech)    score += 25;
  if (customerOverlap > 30)    score -= 15; // high overlap = less additive
  else if (customerOverlap < 10) score += 15;
  if (competitorElimination)   score += 20;
  if (hasDistributionChannel)  score += 15;
  if (teamRetention)           score += 10;

  const techDebtScore  = { low: 10, medium: 5, high: -10 }[techDebt] || 0;
  const ipScore        = { none: 0, weak: 2, medium: 5, strong: 10, patent: 15 }[ipStrength] || 0;
  const complianceScore = { low: 5, medium: 0, high: -10 }[complianceBurden] || 0;
  score += techDebtScore + ipScore + complianceScore;

  const capped = Math.max(0, Math.min(100, score));
  return {
    fitScore: capped,
    grade:    capped >= 70 ? 'A' : capped >= 50 ? 'B' : capped >= 30 ? 'C' : 'D',
    recommendation: capped >= 70 ? 'High priority — strategic must-have'
      : capped >= 50 ? 'Good fit — proceed with full diligence'
      : capped >= 30 ? 'Moderate fit — only if price is right'
      : 'Poor fit — not recommended',
  };
}

// ── §4  DEAL PIPELINE ─────────────────────────────────────────────────────

const PIPELINE_STAGES = ['scout', 'initial-interest', 'nda-signed', 'due-diligence', 'offer-made', 'negotiating', 'signed', 'closed', 'passed'];

/**
 * addTarget — add acquisition target to pipeline
 */
function addTarget({ name, url = '', category = 'saas', arrUsd = 0, mrrUsd = 0, customers = 0, askingPrice = 0, notes = '', stage = 'scout' }) {
  const id = `acq_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const valuation = valuate({ arrUsd, mrrUsd, customers, category });
  const target = {
    id, name, url, category, arrUsd, mrrUsd, customers, askingPrice, notes,
    stage,
    valuation,
    addedAt:   new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history:   [{ stage, ts: new Date().toISOString() }],
  };
  _pipeline.push(target);
  _persist();
  return target;
}

/**
 * updateTargetStage — advance or update a target in the pipeline
 */
function updateTargetStage(id, { stage, notes } = {}) {
  const t = _pipeline.find(p => p.id === id);
  if (!t) return null;
  if (stage && PIPELINE_STAGES.includes(stage)) {
    t.stage = stage;
    t.history.push({ stage, ts: new Date().toISOString() });
  }
  if (notes) t.notes = notes;
  t.updatedAt = new Date().toISOString();
  _persist();
  return t;
}

/**
 * getPipelineSummary — CRM-style funnel view
 */
function getPipelineSummary() {
  const byStage = {};
  for (const stage of PIPELINE_STAGES) {
    const targets = _pipeline.filter(t => t.stage === stage);
    byStage[stage] = {
      count: targets.length,
      totalAskingPrice: targets.reduce((s, t) => s + (t.askingPrice || 0), 0),
      targets: targets.map(t => ({ id: t.id, name: t.name, arrUsd: t.arrUsd, askingPrice: t.askingPrice, valuation: t.valuation?.valuationRange?.mid })),
    };
  }
  return {
    totalTargets: _pipeline.length,
    stages: byStage,
    topOpportunities: _pipeline
      .filter(t => !['passed', 'closed'].includes(t.stage))
      .sort((a, b) => (b.arrUsd || 0) - (a.arrUsd || 0))
      .slice(0, 5),
  };
}

// ── §5  MARKET SIGNALS ────────────────────────────────────────────────────

/** 
 * addMarketSignal — log an acquisition opportunity signal
 * Loghează un semnal de oportunitate de achiziție
 */
function addMarketSignal({ type, description, sourceUrl = '', urgency = 'medium', estimatedARR = 0 }) {
  const signal = {
    id:          `sig_${Date.now()}`,
    ts:          new Date().toISOString(),
    type,        // 'company-for-sale' | 'competitor-weakening' | 'asset-listed' | 'team-available' | 'distressed'
    description,
    sourceUrl,
    urgency,     // low | medium | high | critical
    estimatedARR,
    actioned:    false,
  };
  _signals.unshift(signal);
  if (_signals.length > 500) _signals.pop();
  _persist();
  return signal;
}

function getSignals({ urgency = null, actioned = null, limit = 50 } = {}) {
  let s = _signals;
  if (urgency !== null) s = s.filter(x => x.urgency === urgency);
  if (actioned !== null) s = s.filter(x => x.actioned === actioned);
  return s.slice(0, limit);
}

// ── §6  HELPERS ───────────────────────────────────────────────────────────

function _persist() {
  try {
    fs.writeFileSync(PIPELINE_F, JSON.stringify(_pipeline.slice(-1000), null, 2));
    fs.writeFileSync(SIGNALS_F,  JSON.stringify(_signals.slice(-500), null, 2));
  } catch (_) {}
}

function _loadJson(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) {}
  return def;
}

// ── §7  REST ROUTER ───────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.post('/valuate', express.json(), (req, res) => {
    res.json({ ok: true, valuation: valuate(req.body || {}) });
  });

  r.post('/roi', express.json(), (req, res) => {
    res.json({ ok: true, roi: estimateROI(req.body || {}) });
  });

  r.post('/fit', express.json(), (req, res) => {
    res.json({ ok: true, ...scoreStrategicFit(req.body || {}) });
  });

  r.get('/pipeline', (_req, res) => {
    res.json({ ok: true, ...getPipelineSummary() });
  });

  r.get('/pipeline/:id', (req, res) => {
    const t = _pipeline.find(p => p.id === req.params.id);
    if (!t) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, target: t });
  });

  r.post('/pipeline', express.json(), (req, res) => {
    const t = addTarget(req.body || {});
    res.json({ ok: true, target: t });
  });

  r.patch('/pipeline/:id', express.json(), (req, res) => {
    const t = updateTargetStage(req.params.id, req.body || {});
    if (!t) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, target: t });
  });

  r.get('/signals', (req, res) => {
    const { urgency, actioned, limit } = req.query;
    res.json({ ok: true, signals: getSignals({ urgency, actioned: actioned != null ? actioned === 'true' : null, limit: limit ? Number(limit) : 50 }) });
  });

  r.post('/signals', express.json(), (req, res) => {
    const s = addMarketSignal(req.body || {});
    res.json({ ok: true, signal: s });
  });

  return r;
}

function getStatus() {
  const summary = getPipelineSummary();
  return {
    name:             'acquisition-engine',
    label:            'Digital Acquisition Intelligence Engine',
    health:           'good',
    pipelineTargets:  summary.totalTargets,
    activeSignals:    _signals.filter(s => !s.actioned).length,
    stages:           Object.keys(summary.stages).filter(s => summary.stages[s].count > 0).join(', ') || 'empty',
  };
}

module.exports = {
  valuate,
  estimateROI,
  scoreStrategicFit,
  addTarget,
  updateTargetStage,
  getPipelineSummary,
  addMarketSignal,
  getSignals,
  getStatus,
  router,
  PIPELINE_STAGES,
};
