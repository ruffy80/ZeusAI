// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.343Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.967Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.687Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.550Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:24.007Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SLO TRACKER
 * Tracks per-route p99 latency, error rates, and error budgets.
 * No external dependencies — pure in-memory ring buffer.
 *
 * SLO defaults (overridable via env):
 *   - p99 latency < SLO_P99_MS (default 500ms)
 *   - error rate < SLO_ERROR_BUDGET (default 0.001 = 0.1%)
 *   - window: SLO_WINDOW_SEC seconds (default 300 = 5 min)
 */

'use strict';

const P99_THRESHOLD_MS = parseInt(process.env.SLO_P99_MS || '500', 10);
const ERROR_BUDGET = parseFloat(process.env.SLO_ERROR_BUDGET || '0.001');
const WINDOW_MS = parseInt(process.env.SLO_WINDOW_SEC || '300', 10) * 1000;
const MAX_SAMPLES_PER_ROUTE = 2000;

class SLOTracker {
  constructor() {
    // Map<route, { samples: Array<{ts,durationMs,isError}> }>
    this.routes = new Map();
    this.globalSamples = [];
  }

  /**
   * Record a single request observation.
   * @param {string} route  - e.g. 'GET /api/health'
   * @param {number} durationMs
   * @param {boolean} isError
   */
  record(route, durationMs, isError) {
    if (!this.routes.has(route)) {
      this.routes.set(route, { samples: [] });
    }
    const bucket = this.routes.get(route);
    const entry = { ts: Date.now(), durationMs, isError: Boolean(isError) };
    bucket.samples.push(entry);
    if (bucket.samples.length > MAX_SAMPLES_PER_ROUTE) {
      bucket.samples.shift();
    }
    this.globalSamples.push({ ...entry, route });
    if (this.globalSamples.length > 10000) this.globalSamples.shift();
  }

  /**
   * Returns p99 latency for a route within the current window.
   */
  getP99(route) {
    const samples = this._windowedSamples(route);
    if (!samples.length) return 0;
    const sorted = samples.map(s => s.durationMs).sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.99);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  /**
   * Returns fraction of error budget remaining (0 = exhausted, >0 = remaining).
   */
  getErrorBudgetRemaining(route) {
    const samples = this._windowedSamples(route);
    if (!samples.length) return ERROR_BUDGET;
    const errorRate = samples.filter(s => s.isError).length / samples.length;
    return Math.max(0, ERROR_BUDGET - errorRate);
  }

  /**
   * Returns true when the route is within SLO bounds.
   */
  isHealthy(route) {
    if (route === 'all') {
      return [...this.routes.keys()].every(r => this.isHealthy(r));
    }
    return this.getP99(route) < P99_THRESHOLD_MS && this.getErrorBudgetRemaining(route) > 0;
  }

  getAllRoutes() {
    return [...this.routes.keys()];
  }

  getRouteStats(route) {
    const samples = this._windowedSamples(route);
    if (!samples.length) {
      return { route, p99: 0, errorRate: 0, budgetRemaining: ERROR_BUDGET, healthy: true, sampleCount: 0 };
    }
    const p99 = this.getP99(route);
    const errorRate = samples.filter(s => s.isError).length / samples.length;
    return {
      route,
      p99,
      errorRate: parseFloat(errorRate.toFixed(6)),
      budgetRemaining: parseFloat(this.getErrorBudgetRemaining(route).toFixed(6)),
      healthy: this.isHealthy(route),
      sampleCount: samples.length,
      thresholds: { p99Ms: P99_THRESHOLD_MS, errorBudget: ERROR_BUDGET, windowMs: WINDOW_MS },
    };
  }

  getAllStats() {
    return [...this.routes.keys()].map(r => this.getRouteStats(r));
  }

  _windowedSamples(route) {
    const bucket = this.routes.get(route);
    if (!bucket) return [];
    const cutoff = Date.now() - WINDOW_MS;
    return bucket.samples.filter(s => s.ts >= cutoff);
  }
}

// Singleton
const tracker = new SLOTracker();
module.exports = tracker;
module.exports.SLOTracker = SLOTracker;
