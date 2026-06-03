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
const RESTART_COOLDOWN_MS = parseInt(process.env.CPA_RESTART_COOLDOWN_MS || '300000', 10);
const MIN_CONSECUTIVE_BREACHES = parseInt(process.env.CPA_RESTART_MIN_CONSECUTIVE_BREACHES || '3', 10);
const BREACH_RESET_MS = parseInt(process.env.CPA_BREACH_RESET_MS || '180000', 10);

// ── Golden Rule #6 guards (transient/cold-start latency must NOT kill backend) ──
// Fereastra SLO (5 min) reține sample-ul de cold-start după un deploy/restart;
// primul request poate dura secunde bune cât se încălzesc cache-urile. În acest
// interval doar OBSERVĂM breach-urile, nu escaladăm niciodată la restart.
const PROCESS_WARMUP_MS = parseInt(process.env.CPA_WARMUP_MS || '120000', 10);
// Latency-only breach (errorRate ~0, error budget intact) = serviciu LENT dar
// SĂNĂTOS. Un restart pe lentoare îl face mai lent (cache rece) și intră în buclă.
// Restart-ul rămâne posibil DOAR la epuizarea reală a error budget-ului.
const RESTART_ON_LATENCY_ONLY = process.env.CPA_RESTART_ON_LATENCY === '1'; // default OFF

class ControlPlaneAgent {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60000;
    this._healingActive  = true; // immutable — NEVER set false
    this.decisionLog     = [];
    this.healthScore     = 100; // 0–100
    this.lastHealAt      = null;
    this.rollbackHistory = [];
    this.startedAt       = Date.now();
    this.routeBreachState = new Map();

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
    if (process.env.DISABLE_SELF_MUTATION === '1') {
      console.log('[CPA] disabled via DISABLE_SELF_MUTATION=1');
      return;
    }
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
    const now = Date.now();
    const prev = this.routeBreachState.get(route) || { count: 0, lastBreachAt: 0, lastRestartAt: 0 };
    const withinResetWindow = (now - prev.lastBreachAt) <= BREACH_RESET_MS;
    const nextCount = withinResetWindow ? (prev.count + 1) : 1;

    const state = {
      count: nextCount,
      lastBreachAt: now,
      lastRestartAt: prev.lastRestartAt,
    };
    this.routeBreachState.set(route, state);

    const p99 = Number(stats && stats.p99);
    const thresholdP99 = Number(stats && stats.thresholds && stats.thresholds.p99Ms);
    const errorRatePct = Number(stats && stats.errorRate) * 100;
    const budgetRemainingPct = Number(stats && stats.budgetRemaining) * 100;

    const reason = [
      `SLO breach on route "${route}"`,
      `p99=${Number.isFinite(p99) ? p99 : 'n/a'}ms (threshold=${Number.isFinite(thresholdP99) ? thresholdP99 : 'n/a'}ms)`,
      `errorRate=${Number.isFinite(errorRatePct) ? errorRatePct.toFixed(3) : 'n/a'}%`,
      `budgetRemaining=${Number.isFinite(budgetRemainingPct) ? budgetRemainingPct.toFixed(4) : 'n/a'}%`,
    ].join(', ');

    // ── Transient-latency guard (Golden Rule #6) ──────────────────────
    // (a) Warm-up grace: imediat după pornire/deploy, cold-start-ul rămâne în
    //     fereastra SLO de 5 min și ridică artificial p99. Observăm, nu restartăm.
    const uptimeMs = now - this.startedAt;
    const inWarmup = uptimeMs < PROCESS_WARMUP_MS;
    // (b) Latency-only: error budget intact ⇒ lent dar sănătos ⇒ nu restartăm.
    const budgetExhausted = Number.isFinite(budgetRemainingPct) ? budgetRemainingPct <= 0 : false;
    const latencyOnly = !budgetExhausted;

    if (inWarmup || (latencyOnly && !RESTART_ON_LATENCY_ONLY)) {
      const why = inWarmup
        ? `warmup grace (${Math.round(uptimeMs / 1000)}s/${Math.round(PROCESS_WARMUP_MS / 1000)}s)`
        : 'latency-only breach (error budget intact)';
      await this._logDecision(
        'SLO_BREACH_OBSERVED',
        `${reason}, action=observe-only [${why}]`,
        { route, stats, state, inWarmup, latencyOnly }
      );
      // Nu acumulăm spre restart pe lentoare tranzitorie.
      state.count = 0;
      this.routeBreachState.set(route, state);
      return;
    }

    if (state.count < MIN_CONSECUTIVE_BREACHES) {
      await this._logDecision(
        'SLO_BREACH_OBSERVED',
        `${reason}, consecutiveBreaches=${state.count}/${MIN_CONSECUTIVE_BREACHES}`,
        { route, stats, state }
      );
      return;
    }

    const inCooldown = (now - state.lastRestartAt) < RESTART_COOLDOWN_MS;
    if (inCooldown) {
      const msRemaining = Math.max(0, RESTART_COOLDOWN_MS - (now - state.lastRestartAt));
      await this._logDecision(
        'RESTART_SUPPRESSED_COOLDOWN',
        `${reason}, cooldownMsRemaining=${msRemaining}`,
        { route, stats, state }
      );
      return;
    }

    await this._logDecision('RESTART', reason, { route, stats });
    this.lastHealAt = new Date().toISOString();
    await this.onRestart('unicorn-backend', reason);
    state.lastRestartAt = now;
    state.count = 0;
    this.routeBreachState.set(route, state);
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
    const routeBreaches = Array.from(this.routeBreachState.entries()).map(([route, st]) => ({
      route,
      consecutiveBreaches: st.count,
      lastBreachAt: st.lastBreachAt ? new Date(st.lastBreachAt).toISOString() : null,
      lastRestartAt: st.lastRestartAt ? new Date(st.lastRestartAt).toISOString() : null,
    }));
    return {
      active: this._healingActive,
      healingActive: this._healingActive,
      healthScore:   this.healthScore,
      lastHealAt:    this.lastHealAt,
      uptimeMs:      Date.now() - this.startedAt,
      restartPolicy: {
        minConsecutiveBreaches: MIN_CONSECUTIVE_BREACHES,
        cooldownMs: RESTART_COOLDOWN_MS,
        breachResetMs: BREACH_RESET_MS,
      },
      routeBreaches,
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
if (process.env.DISABLE_SELF_MUTATION !== '1') {
  agent.start();
} else {
  console.log('[CPA] module-level auto-start suppressed (DISABLE_SELF_MUTATION=1)');
}
module.exports = agent;
module.exports.ControlPlaneAgent = ControlPlaneAgent;
