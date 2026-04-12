// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:56:24.793Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.127Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.884Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.358Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.341Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.965Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.685Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.548Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:24.004Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * PROFIT ATTRIBUTION SERVICE
 * Instruments every user action with a real-time profit signal.
 *
 * Supports:
 *   - order: gross margin (configurable per-action)
 *   - subscription: high-margin SaaS revenue
 *   - ad_click: full click value
 *   - api_usage: API billing margin
 *
 * Reward function: (actual_profit - baseline_profit) - cost_of_experimentation
 *
 * All data is in-memory with a rolling 30-day window.
 */

'use strict';

const crypto = require('crypto');

const MARGINS = {
  order:        parseFloat(process.env.MARGIN_ORDER        || '0.15'),
  subscription: parseFloat(process.env.MARGIN_SUBSCRIPTION || '0.80'),
  ad_click:     parseFloat(process.env.MARGIN_AD_CLICK     || '1.00'),
  api_usage:    parseFloat(process.env.MARGIN_API_USAGE    || '0.60'),
  default:      parseFloat(process.env.MARGIN_DEFAULT      || '0.10'),
};

const LTV_WEIGHT_DECAY  = parseFloat(process.env.LTV_DECAY     || '0.95');
const BASELINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_EVENTS        = 50000;

class ProfitAttributionService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60000;
    this.events       = [];  // all profit events
    this.experiments  = new Map(); // id → { name, cost, samples }
    this.userHistory  = new Map(); // userId → last 100 events
    this._baselineCache = { value: null, computedAt: 0 };
  }

  /**
   * Record a profit-generating event.
   * @returns {number} attributed profit
   */
  record(event) {
    const { userId = 'anon', action, value = 0, experimentId = null, variantId = null, meta = {} } = event;
    const margin = this._computeMargin(action, value, meta);
    const ltv = this._getLTV(userId);
    const attributed = margin + ltv * this._ltvMultiplier(action);

    const entry = {
      id: crypto.randomBytes(6).toString('hex'),
      ts: Date.now(),
      userId,
      action,
      value,
      margin,
      ltv,
      attributed,
      experimentId,
      variantId,
    };

    this.events.push(entry);
    if (this.events.length > MAX_EVENTS) this.events.shift();

    // Per-user history
    if (!this.userHistory.has(userId)) this.userHistory.set(userId, []);
    const hist = this.userHistory.get(userId);
    hist.push(entry);
    if (hist.length > 100) hist.shift();

    // Track per-experiment
    if (experimentId) {
      if (!this.experiments.has(experimentId)) {
        this.experiments.set(experimentId, { name: experimentId, cost: 0, samples: [], createdAt: Date.now() });
      }
      this.experiments.get(experimentId).samples.push({ ts: entry.ts, variantId, attributed });
    }

    return attributed;
  }

  /**
   * Core reward function for the control loop.
   * reward = (actual_profit - baseline_profit) - cost_of_experimentation
   */
  computeReward(experimentId, windowMs = BASELINE_WINDOW_MS) {
    const exp = this.experiments.get(experimentId);
    if (!exp || !exp.samples.length) return 0;

    const cutoff = Date.now() - windowMs;
    const recent = exp.samples.filter(s => s.ts >= cutoff);
    if (!recent.length) return 0;

    const actual   = recent.reduce((s, e) => s + e.attributed, 0) / recent.length;
    const baseline = this._getBaseline(windowMs);
    const cost     = exp.cost || 0;
    return (actual - baseline) - cost;
  }

  /**
   * Set the experimentation cost for a given experiment.
   */
  setExperimentCost(experimentId, cost) {
    if (!this.experiments.has(experimentId)) {
      this.experiments.set(experimentId, { name: experimentId, cost, samples: [], createdAt: Date.now() });
    } else {
      this.experiments.get(experimentId).cost = cost;
    }
  }

  /**
   * Compare a specific variant against control within an experiment.
   */
  compareVariants(experimentId, variantId, controlId = 'control', windowMs = BASELINE_WINDOW_MS) {
    const exp = this.experiments.get(experimentId);
    if (!exp) return null;

    const cutoff = Date.now() - windowMs;
    const variantSamples  = exp.samples.filter(s => s.ts >= cutoff && s.variantId === variantId);
    const controlSamples  = exp.samples.filter(s => s.ts >= cutoff && s.variantId === controlId);

    const avg = arr => arr.length ? arr.reduce((s, e) => s + e.attributed, 0) / arr.length : 0;
    const variantAvg  = avg(variantSamples);
    const controlAvg  = avg(controlSamples);
    const uplift      = controlAvg ? (variantAvg - controlAvg) / controlAvg : 0;

    return {
      experimentId,
      variantId,
      controlId,
      variantAvg: parseFloat(variantAvg.toFixed(4)),
      controlAvg: parseFloat(controlAvg.toFixed(4)),
      uplift: parseFloat(uplift.toFixed(6)),
      variantSamples: variantSamples.length,
      controlSamples: controlSamples.length,
    };
  }

  getMetrics() {
    const cutoff = Date.now() - BASELINE_WINDOW_MS;
    const recent = this.events.filter(e => e.ts >= cutoff);
    const total  = recent.reduce((s, e) => s + e.attributed, 0);
    return {
      totalEventsRecorded: this.events.length,
      recentEvents: recent.length,
      averageProfitPerEvent: recent.length ? parseFloat((total / recent.length).toFixed(4)) : 0,
      totalAttributedProfit: parseFloat(total.toFixed(4)),
      activeExperiments: this.experiments.size,
      baseline: parseFloat(this._getBaseline(BASELINE_WINDOW_MS).toFixed(4)),
    };
  }

  // ── Private ──────────────────────────────────────────────────────

  _computeMargin(action, value, _meta) {
    const rate = MARGINS[action] !== undefined ? MARGINS[action] : MARGINS.default;
    return value * rate;
  }

  _ltvMultiplier(action) {
    const multipliers = { subscription: 0.05, order: 0.02, ad_click: 0.01, api_usage: 0.03 };
    return multipliers[action] || 0.01;
  }

  _getLTV(userId) {
    const hist = this.userHistory.get(userId) || [];
    if (!hist.length) return 0;
    // Exponential decay: older events count less
    return hist.reduceRight((acc, e, i) => acc + e.margin * Math.pow(LTV_WEIGHT_DECAY, i), 0);
  }

  _getBaseline(windowMs) {
    const now = Date.now();
    if (this._baselineCache.value !== null && now - this._baselineCache.computedAt < 60_000) {
      return this._baselineCache.value;
    }
    const cutoff = now - windowMs;
    const events = this.events.filter(e => e.ts >= cutoff && e.experimentId === null);
    const value  = events.length ? events.reduce((s, e) => s + e.attributed, 0) / events.length : 0;
    this._baselineCache = { value, computedAt: now };
    return value;
  }
}

const service = new ProfitAttributionService();
module.exports = service;
module.exports.ProfitAttributionService = ProfitAttributionService;
