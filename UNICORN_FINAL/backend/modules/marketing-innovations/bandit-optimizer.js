// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/bandit-optimizer.js
//
// Multi-armed bandit (Thompson Sampling, Beta(α, β) priors) used to
// pick the best-performing content variant per campaign over time.
//
// State is in-memory (campaign → arm → {alpha, beta, impressions, clicks,
// conversions, revenueUsd}) with optional JSONL persistence at
// data/marketing/bandit.jsonl for crash-safe restart.
//
// Pure additive · zero deps.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'marketing');
const LOG_FILE = process.env.MARKETING_BANDIT_FILE || path.join(DATA_DIR, 'bandit.jsonl');

const _state = new Map(); // campaign → Map(armId → arm)

function _ensureDir() {
  try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch (_) {}
}

function _key(campaign) {
  return String(campaign || 'default').slice(0, 64);
}

function _arm(campaign, armId) {
  const c = _key(campaign);
  if (!_state.has(c)) _state.set(c, new Map());
  const arms = _state.get(c);
  if (!arms.has(armId)) {
    arms.set(armId, {
      armId,
      alpha: 1, // Beta prior
      beta: 1,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenueUsd: 0,
      lastUpdate: new Date().toISOString(),
    });
  }
  return arms.get(armId);
}

function _persist(evt) {
  try {
    _ensureDir();
    fs.appendFileSync(LOG_FILE, JSON.stringify(evt) + '\n');
  } catch (_) { /* persistence is best-effort */ }
}

/** Standard normal via Box-Muller. */
function _gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Sample from Gamma(shape, 1) using Marsaglia & Tsang. shape > 0. */
function _gamma(shape) {
  if (shape < 1) {
    const u = Math.random();
    return _gamma(shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x = _gaussian();
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * Math.pow(x, 4)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Sample from Beta(alpha, beta). */
function _beta(alpha, beta) {
  const x = _gamma(alpha);
  const y = _gamma(beta);
  return x / (x + y);
}

/**
 * Record an impression (variant shown).
 */
function impression(campaign, armId, n) {
  const arm = _arm(campaign, armId);
  arm.impressions += Math.max(1, n || 1);
  arm.lastUpdate = new Date().toISOString();
  _persist({ ts: arm.lastUpdate, type: 'impression', campaign: _key(campaign), armId, n: n || 1 });
  return arm;
}

/**
 * Record a click. Updates Beta posterior: α += 1 (success).
 */
function click(campaign, armId) {
  const arm = _arm(campaign, armId);
  arm.clicks += 1;
  arm.alpha += 1;
  if (arm.impressions === 0) arm.impressions = 1;
  arm.lastUpdate = new Date().toISOString();
  _persist({ ts: arm.lastUpdate, type: 'click', campaign: _key(campaign), armId });
  return arm;
}

/**
 * Record a no-click (impression without click). β += 1 (failure).
 */
function noClick(campaign, armId, n) {
  const arm = _arm(campaign, armId);
  const k = Math.max(1, n || 1);
  arm.beta += k;
  arm.lastUpdate = new Date().toISOString();
  _persist({ ts: arm.lastUpdate, type: 'no_click', campaign: _key(campaign), armId, n: k });
  return arm;
}

/**
 * Record a downstream conversion with optional revenue (USD).
 */
function conversion(campaign, armId, opts) {
  const arm = _arm(campaign, armId);
  arm.conversions += 1;
  const r = Math.max(0, Number((opts && opts.revenueUsd) || 0));
  arm.revenueUsd += r;
  arm.lastUpdate = new Date().toISOString();
  _persist({ ts: arm.lastUpdate, type: 'conversion', campaign: _key(campaign), armId, revenueUsd: r });
  return arm;
}

/**
 * Pick the best arm for a campaign via Thompson Sampling.
 * Returns null if no arms exist.
 */
function pickBest(campaign) {
  const arms = _state.get(_key(campaign));
  if (!arms || arms.size === 0) return null;
  let best = null;
  let bestSample = -1;
  for (const arm of arms.values()) {
    const sample = _beta(arm.alpha, arm.beta);
    if (sample > bestSample) { bestSample = sample; best = { ...arm, sample }; }
  }
  return best;
}

/** Snapshot of arms for a campaign sorted by posterior mean (α/(α+β)). */
function summary(campaign) {
  const arms = _state.get(_key(campaign));
  if (!arms) return { campaign: _key(campaign), arms: [], totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalRevenueUsd: 0 };
  const items = Array.from(arms.values()).map((a) => ({
    ...a,
    posteriorMean: a.alpha / (a.alpha + a.beta),
    ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
    cvr: a.clicks > 0 ? a.conversions / a.clicks : 0,
  })).sort((x, y) => y.posteriorMean - x.posteriorMean);
  const tot = items.reduce((acc, a) => {
    acc.totalImpressions += a.impressions;
    acc.totalClicks += a.clicks;
    acc.totalConversions += a.conversions;
    acc.totalRevenueUsd += a.revenueUsd;
    return acc;
  }, { totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalRevenueUsd: 0 });
  return { campaign: _key(campaign), arms: items, ...tot };
}

/** All campaigns overview. */
function overview() {
  const out = [];
  for (const c of _state.keys()) out.push(summary(c));
  return { campaigns: out, generatedAt: new Date().toISOString() };
}

/** For tests — clear in-memory state without touching the persistence file. */
function _resetForTests() {
  _state.clear();
}

module.exports = {
  impression,
  click,
  noClick,
  conversion,
  pickBest,
  summary,
  overview,
  _resetForTests,
};
