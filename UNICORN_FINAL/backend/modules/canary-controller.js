// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.879Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.352Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.337Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.960Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.680Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.543Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:24.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * CANARY CONTROLLER
 * Statistical promotion/rejection of canary deployments.
 *
 * Algorithm:
 *   1. Register a canary version alongside a stable (baseline) version.
 *   2. Collect profit samples for both versions during ramp stages.
 *   3. Use Welch's t-test approximation to decide promotion vs rollback.
 *   4. Ramp traffic: 5% → 20% → 50% → 100% (each stage = RAMP_STEP_MS).
 *   5. Log every decision to the decision provenance log.
 *
 * This module does NOT directly call Kubernetes or Istio — it emits
 * decisions that the Control Plane Agent and downstream K8s manifests consume.
 */

'use strict';

const crypto = require('crypto');
const profitService = require('./profit-attribution');

const UPLIFT_THRESHOLD   = parseFloat(process.env.CANARY_UPLIFT_THRESHOLD || '0.02'); // 2%
const MIN_SAMPLES        = parseInt(process.env.CANARY_MIN_SAMPLES || '30', 10);
const RAMP_STEP_MS       = parseInt(process.env.CANARY_RAMP_STEP_MS || '300000', 10); // 5 min
const TRAFFIC_RAMP_STEPS = [0.05, 0.20, 0.50, 1.0];

class CanaryController {
  constructor() {
    this.canaries    = new Map(); // id → canary state
    this.decisionLog = [];
  }

  /**
   * Register a new canary deployment.
   */
  register(spec) {
    const id = spec.id || crypto.randomBytes(6).toString('hex');
    const canary = {
      id,
      version: spec.version || id,
      baseline: spec.baseline || 'stable',
      status: 'EVALUATING',
      currentWeight: TRAFFIC_RAMP_STEPS[0],
      rampStepIndex: 0,
      registeredAt: Date.now(),
      nextEvalAt: Date.now() + RAMP_STEP_MS,
      samples: [],
      baselineSamples: [],
    };
    this.canaries.set(id, canary);
    console.log(`[CanaryController] Registered canary ${id} v${canary.version}`);
    return canary;
  }

  /**
   * Record a profit sample for a canary or baseline.
   */
  recordSample(canaryId, isCanary, profit) {
    const canary = this.canaries.get(canaryId);
    if (!canary) return;
    if (isCanary) {
      canary.samples.push(profit);
      if (canary.samples.length > 1000) canary.samples.shift();
    } else {
      canary.baselineSamples.push(profit);
      if (canary.baselineSamples.length > 1000) canary.baselineSamples.shift();
    }
  }

  /**
   * Evaluate a canary — call periodically (e.g., every RAMP_STEP_MS).
   * Returns { action: 'PROMOTE' | 'REJECT' | 'CONTINUE', canary, stats }
   */
  evaluate(canaryId) {
    const canary = this.canaries.get(canaryId);
    if (!canary || canary.status !== 'EVALUATING') return null;

    const { samples, baselineSamples } = canary;

    if (samples.length < MIN_SAMPLES || baselineSamples.length < MIN_SAMPLES) {
      return { action: 'CONTINUE', reason: `Insufficient samples (canary=${samples.length}, baseline=${baselineSamples.length})`, canary };
    }

    const canaryMean   = this._mean(samples);
    const baselineMean = this._mean(baselineSamples);
    const uplift       = baselineMean > 0 ? (canaryMean - baselineMean) / baselineMean : 0;
    const pValue       = this._welchTTestPValue(samples, baselineSamples);
    const significant  = pValue < 0.05;

    const stats = {
      canaryMean:   parseFloat(canaryMean.toFixed(4)),
      baselineMean: parseFloat(baselineMean.toFixed(4)),
      uplift:       parseFloat(uplift.toFixed(6)),
      pValue:       parseFloat(pValue.toFixed(6)),
      significant,
      canaryN:      samples.length,
      baselineN:    baselineSamples.length,
    };

    let action;
    let reason;

    if (significant && uplift > UPLIFT_THRESHOLD) {
      if (canary.rampStepIndex < TRAFFIC_RAMP_STEPS.length - 1) {
        // Advance ramp stage
        canary.rampStepIndex++;
        canary.currentWeight = TRAFFIC_RAMP_STEPS[canary.rampStepIndex];
        canary.nextEvalAt = Date.now() + RAMP_STEP_MS;
        action = 'CONTINUE';
        reason = `Ramp advanced to ${(canary.currentWeight * 100).toFixed(0)}% traffic (uplift=${(uplift * 100).toFixed(2)}%)`;
      } else {
        action = 'PROMOTE';
        reason = `Canary promoted: uplift=${(uplift * 100).toFixed(2)}%, p=${pValue.toFixed(4)}`;
        canary.status = 'PROMOTED';
      }
    } else if (significant && uplift < -0.01) {
      action = 'REJECT';
      reason = `Canary rejected: uplift=${(uplift * 100).toFixed(2)}%, p=${pValue.toFixed(4)}`;
      canary.status = 'REJECTED';
    } else {
      // Not yet significant — keep gathering data
      canary.nextEvalAt = Date.now() + RAMP_STEP_MS;
      action = 'CONTINUE';
      reason = `Insufficient evidence (p=${pValue.toFixed(4)}, uplift=${(uplift * 100).toFixed(2)}%)`;
    }

    this._logDecision(canaryId, action, reason, stats);
    return { action, reason, canary, stats };
  }

  getCanary(id) {
    return this.canaries.get(id) || null;
  }

  getAllCanaries() {
    return [...this.canaries.values()].map(c => ({
      id: c.id,
      version: c.version,
      status: c.status,
      currentWeight: c.currentWeight,
      rampStep: c.rampStepIndex,
      canaryN: c.samples.length,
      baselineN: c.baselineSamples.length,
      registeredAt: new Date(c.registeredAt).toISOString(),
    }));
  }

  getDecisionLog(limit = 50) {
    return this.decisionLog.slice(-limit);
  }

  // ── Private ──────────────────────────────────────────────────────

  _mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  _variance(arr) {
    if (arr.length < 2) return 0;
    const m = this._mean(arr);
    return arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1);
  }

  /**
   * Welch's t-test p-value approximation.
   * Uses a normal approximation for the t-distribution (valid for n > 30).
   */
  _welchTTestPValue(a, b) {
    if (a.length < 2 || b.length < 2) return 1;
    const meanA = this._mean(a);
    const meanB = this._mean(b);
    const varA  = this._variance(a);
    const varB  = this._variance(b);
    const se    = Math.sqrt(varA / a.length + varB / b.length);
    if (se === 0) return meanA === meanB ? 1 : 0;
    const t = Math.abs(meanA - meanB) / se;
    // Normal CDF approximation for p-value (two-tailed)
    return 2 * (1 - this._normalCDF(t));
  }

  /**
   * Standard normal CDF approximation (Abramowitz & Stegun 26.2.17).
   */
  _normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    const pdf  = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    return 1 - pdf * poly;
  }

  _logDecision(canaryId, action, reason, stats) {
    const entry = {
      ts: new Date().toISOString(),
      agent: 'CanaryController',
      canaryId,
      action,
      reason,
      stats,
    };
    this.decisionLog.push(entry);
    if (this.decisionLog.length > 500) this.decisionLog.shift();
    console.log(`[CanaryController] ${action} ${canaryId}: ${reason}`);
  }
}

const controller = new CanaryController();
module.exports = controller;
module.exports.CanaryController = CanaryController;
