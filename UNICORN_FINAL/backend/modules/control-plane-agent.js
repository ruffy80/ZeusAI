// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T20:56:24.790Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:15:50.123Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T12:11:52.880Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T11:25:28.353Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:52:40.338Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T10:50:35.961Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:40.681Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T09:27:11.544Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-11T08:29:24.001Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * CONTROL PLANE AGENT (Self-Healing Orchestrator)
 *
 * Responsibilities:
 *   1. Poll SLO tracker every HEAL_INTERVAL_MS (default 30s)
 *   2. Detect health degradation → trigger rollback or service restart
 *   3. Evaluate pending canaries
 *   4. Log every decision with full reasoning (decision provenance)
 *   5. CANNOT be disabled by the innovation layer (self-healing is immutable)
 *
 * Healing decisions:
 *   - SLO breach (p99 > threshold or error budget exhausted) → ROLLBACK + RESTART
 *   - Canary evaluation due → promote or reject
 *
 * Integration hooks:
 *   - onRollback(version, reason)   — override to call ArgoCD / GitHub Actions
 *   - onRestart(service, reason)    — override to call K8s rollout / PM2 restart
 *   - onCanaryPromote(canaryId)     — override to apply Istio weight 100%
 *   - onCanaryReject(canaryId)      — override to remove canary from Istio VS
 */

'use strict';

const sloTracker     = require('./slo-tracker');
const canaryCtrl     = require('./canary-controller');
const circuitBreaker = require('./circuit-breaker');

const HEAL_INTERVAL_MS   = parseInt(process.env.HEAL_INTERVAL_MS   || '30000', 10);
const CANARY_EVAL_MS     = parseInt(process.env.CANARY_EVAL_MS     || '60000', 10);
const MAX_DECISIONS      = 1000;

class ControlPlaneAgent {
  constructor() {
    this._healingActive  = true; // immutable — NEVER set false
    this.decisionLog     = [];
    this.healthScore     = 100; // 0–100
    this.lastHealAt      = null;
    this.rollbackHistory = [];
    this.startedAt       = Date.now();

    // Pluggable action hooks (override in production)
    this.onRollback      = async (version, reason) => {
      console.warn(`[CPA] 🔄 ROLLBACK to ${version}: ${reason}`);
    };
    this.onRestart       = async (service, reason) => {
      console.warn(`[CPA] ♻️  RESTART ${service}: ${reason}`);
    };
    this.onCanaryPromote = async (canaryId) => {
      console.log(`[CPA] 🚀 PROMOTE canary ${canaryId}`);
    };
    this.onCanaryReject  = async (canaryId) => {
      console.warn(`[CPA] ⛔ REJECT canary ${canaryId}`);
    };

    this._healInterval   = null;
    this._canaryInterval = null;
  }

  start() {
    if (this._healInterval) return; // already running
    this._healInterval = setInterval(() => this._healTick().catch(e => console.error('[CPA] heal error:', e)), HEAL_INTERVAL_MS);
    this._canaryInterval = setInterval(() => this._canaryTick().catch(e => console.error('[CPA] canary error:', e)), CANARY_EVAL_MS);
    console.log(`[CPA] 🛡️  Control Plane Agent started (heal every ${HEAL_INTERVAL_MS / 1000}s)`);
  }

  stop() {
    // Note: healing is designed to always run, but we expose stop() for test teardown
    if (this._healInterval)   clearInterval(this._healInterval);
    if (this._canaryInterval) clearInterval(this._canaryInterval);
    this._healInterval = null;
    this._canaryInterval = null;
  }

  // ── Healing tick ─────────────────────────────────────────────────

  async _healTick() {
    const routes = sloTracker.getAllRoutes();
    let allHealthy = true;

    for (const route of routes) {
      if (!sloTracker.isHealthy(route)) {
        allHealthy = false;
        const stats = sloTracker.getRouteStats(route);
        await this._handleSLOBreach(route, stats);
      }
    }

    // Update health score based on ratio of healthy routes
    if (routes.length) {
      const healthyCount = routes.filter(r => sloTracker.isHealthy(r)).length;
      this.healthScore = Math.round((healthyCount / routes.length) * 100);
    } else {
      this.healthScore = 100; // no data = assume healthy
    }

    if (allHealthy && routes.length) {
      // Gradually restore health score
      this.healthScore = Math.min(100, this.healthScore + 1);
    }
  }

  async _handleSLOBreach(route, stats) {
    const reason = [
      `SLO breach on route "${route}"`,
      `p99=${stats.p99}ms (threshold=${stats.thresholds.p99Ms}ms)`,
      `errorRate=${(stats.errorRate * 100).toFixed(3)}%`,
      `budgetRemaining=${(stats.budgetRemaining * 100).toFixed(4)}%`,
    ].join(', ');

    await this._logDecision('RESTART', reason, { route, stats });
    this.lastHealAt = new Date().toISOString();
    await this.onRestart('unicorn-backend', reason);
    this.rollbackHistory.push({ ts: Date.now(), action: 'RESTART', reason, route });
    if (this.rollbackHistory.length > 100) this.rollbackHistory.shift();
  }

  // ── Canary tick ───────────────────────────────────────────────────

  async _canaryTick() {
    const now = Date.now();
    for (const canary of Object.values(Object.fromEntries(canaryCtrl.canaries))) {
      if (canary.status !== 'EVALUATING') continue;
      if (now < canary.nextEvalAt) continue;

      const result = canaryCtrl.evaluate(canary.id);
      if (!result) continue;

      if (result.action === 'PROMOTE') {
        await this._logDecision('CANARY_PROMOTE', result.reason, result.stats);
        await this.onCanaryPromote(canary.id);
        // Record innovation success to reset circuit breaker
        circuitBreaker.recordSuccess({ canaryId: canary.id, uplift: result.stats && result.stats.uplift });
      } else if (result.action === 'REJECT') {
        await this._logDecision('CANARY_REJECT', result.reason, result.stats);
        await this.onCanaryReject(canary.id);
        // Count as innovation failure for circuit breaker
        circuitBreaker.recordFailure({ canaryId: canary.id, uplift: result.stats && result.stats.uplift });
      }
    }
  }

  // ── Decision provenance ───────────────────────────────────────────

  async _logDecision(action, reasoning, metadata = {}) {
    const entry = {
      id:        require('crypto').randomBytes(6).toString('hex'),
      ts:        new Date().toISOString(),
      agent:     'ControlPlaneAgent',
      action,
      reasoning,
      metadata,
    };
    this.decisionLog.push(entry);
    if (this.decisionLog.length > MAX_DECISIONS) this.decisionLog.shift();
    console.log(`[CPA] [${action}] ${reasoning}`);
    return entry;
  }

  // ── Public API ────────────────────────────────────────────────────

  getStatus() {
    return {
      healingActive: this._healingActive,
      healthScore:   this.healthScore,
      lastHealAt:    this.lastHealAt,
      uptimeMs:      Date.now() - this.startedAt,
      sloStats:      sloTracker.getAllStats(),
      circuitBreaker: circuitBreaker.getStatus(),
    };
  }

  getDecisionLog(limit = 50) {
    return this.decisionLog.slice(-limit);
  }

  getRollbackHistory(limit = 20) {
    return this.rollbackHistory.slice(-limit);
  }

  /**
   * Force a manual rollback. Healing must always be callable from outside.
   */
  async forceRollback(version, reason) {
    await this._logDecision('MANUAL_ROLLBACK', reason, { version });
    await this.onRollback(version, reason);
  }
}

const agent = new ControlPlaneAgent();
agent.start();
module.exports = agent;
module.exports.ControlPlaneAgent = ControlPlaneAgent;
