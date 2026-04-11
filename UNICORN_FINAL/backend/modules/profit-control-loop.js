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
 * PROFIT CONTROL LOOP (Master Autonomous Control Loop)
 *
 * Integrates all three systems into a single objective: maximize long-term profit.
 *
 * Every LOOP_INTERVAL_MS (default 5 min):
 *   1. HEAL  — always runs first, cannot be blocked (delegates to ControlPlaneAgent)
 *   2. EVALUATE — compute reward signal from ProfitAttributionService
 *   3. INNOVATE — if circuit breaker is CLOSED and reward > 0, promote best variant
 *   4. SCALE — placeholder hook for HPA / Karpenter resource adjustment
 *
 * Reward function: (actual_profit - baseline_profit) - cost_of_experimentation
 *
 * Safety invariants:
 *   - Healing runs regardless of circuit breaker state
 *   - Innovation is gated by circuit breaker
 *   - All decisions are logged with full reasoning
 */

'use strict';

const circuitBreaker    = require('./circuit-breaker');
const controlPlane      = require('./control-plane-agent');
const profitService     = require('./profit-attribution');
const shadowTester      = require('./shadow-tester');
const autonomousInnov   = require('./autonomousInnovation');

const LOOP_INTERVAL_MS  = parseInt(process.env.PROFIT_LOOP_INTERVAL_MS || '300000', 10); // 5 min
const REWARD_WINDOW_MS  = parseInt(process.env.REWARD_WINDOW_MS || '86400000', 10);      // 1 day
const MIN_REWARD        = parseFloat(process.env.MIN_REWARD || '0');

class ProfitControlLoop {
  constructor() {
    this.rewardHistory  = [];
    this.cycleCount     = 0;
    this.lastCycleAt    = null;
    this.startedAt      = Date.now();
    this._interval      = null;
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick().catch(e => console.error('[PCL] cycle error:', e)), LOOP_INTERVAL_MS);
    console.log(`[PCL] 🎯 Profit Control Loop started (cycle every ${LOOP_INTERVAL_MS / 60000} min)`);
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  async _tick() {
    this.cycleCount++;
    this.lastCycleAt = new Date().toISOString();
    console.log(`[PCL] Cycle #${this.cycleCount} starting`);

    // ── Step 1: HEALING (always runs, unblockable) ────────────────
    // Control Plane Agent already runs its own timer; we log the current state
    const sloStatus = controlPlane.getStatus();
    const healthScore = sloStatus.healthScore;

    // ── Step 2: REWARD SIGNAL ─────────────────────────────────────
    const metrics = profitService.getMetrics();
    const reward  = metrics.averageProfitPerEvent - metrics.baseline;
    this.rewardHistory.push({ ts: Date.now(), reward, healthScore, cycle: this.cycleCount });
    if (this.rewardHistory.length > 1000) this.rewardHistory.shift();

    console.log(`[PCL] healthScore=${healthScore}, avgProfit=${metrics.averageProfitPerEvent}, reward=${reward.toFixed(4)}`);

    // ── Step 3: INNOVATION (gated by circuit breaker) ─────────────
    if (!circuitBreaker.isOpen()) {
      await this._innovationStep(reward);
    } else {
      const cb = circuitBreaker.getStatus();
      console.warn(`[PCL] Innovation PAUSED — circuit breaker OPEN (${cb.pauseRemainingMin} min remaining)`);
    }

    // ── Step 4: PROMOTE shadow variants ready for A/B ─────────────
    this._promoteShadowVariants();

    // ── Step 5: RESOURCE OPTIMIZATION HOOK ───────────────────────
    await this._optimizeResources(reward, healthScore);
  }

  async _innovationStep(reward) {
    if (reward > MIN_REWARD) {
      // Generate a new innovation and log success
      try {
        const innov = autonomousInnov.generateNewInnovation();
        circuitBreaker.recordSuccess({ innovId: innov && innov.id, reward });
        console.log(`[PCL] ✨ Innovation generated: ${innov && innov.id}`);
      } catch (e) {
        console.error('[PCL] Innovation generation error:', e.message);
        circuitBreaker.recordFailure({ error: e.message, reward });
      }
    } else {
      // Reward <= threshold → count as innovation failure
      circuitBreaker.recordFailure({ reason: 'reward_below_threshold', reward });
      console.log(`[PCL] ⚠️  Reward below threshold (${reward.toFixed(4)}) — innovation failure recorded`);
    }
  }

  _promoteShadowVariants() {
    const variants = shadowTester.getAllVariants();
    for (const v of variants) {
      if (v.status === 'SHADOW' && v.readyForAB) {
        try {
          shadowTester.promoteToAB(v.id);
          console.log(`[PCL] 📈 Shadow variant ${v.id} promoted to A/B (uplift=${(v.avgUplift * 100).toFixed(2)}%)`);
        } catch (e) {
          console.error(`[PCL] Failed to promote shadow variant ${v.id}:`, e.message);
        }
      }
    }
  }

  async _optimizeResources(reward, healthScore) {
    // Placeholder: in production, call K8s HPA / Karpenter API here.
    // Policy:
    //   - If reward > 0 AND healthScore >= 95: hold current capacity (protect experiment)
    //   - If reward <= 0 AND healthScore >= 90: scale down idle replicas
    if (reward <= 0 && healthScore >= 90) {
      console.log('[PCL] 💡 Resource optimization: reward non-positive, recommending scale-down of idle replicas');
      // this.onScaleDown() — wire to K8s HPA in production
    }
  }

  getStatus() {
    const latest = this.rewardHistory.slice(-10);
    const avgReward = latest.length
      ? latest.reduce((s, r) => s + r.reward, 0) / latest.length
      : 0;
    return {
      running: this._interval !== null,
      cycleCount: this.cycleCount,
      lastCycleAt: this.lastCycleAt,
      uptimeMs: Date.now() - this.startedAt,
      avgRecentReward: parseFloat(avgReward.toFixed(4)),
      circuitBreaker: circuitBreaker.getStatus(),
      profitMetrics: profitService.getMetrics(),
      shadowMetrics: shadowTester.getMetrics(),
    };
  }

  getRewardHistory(limit = 50) {
    return this.rewardHistory.slice(-limit);
  }
}

const loop = new ProfitControlLoop();
loop.start();
module.exports = loop;
module.exports.ProfitControlLoop = ProfitControlLoop;
