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
// Data: 2026-04-11T11:25:28.353Z
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
 * INNOVATION CIRCUIT BREAKER
 * If 3 consecutive experiments lose profit → pause innovation for 1 hour.
 * Self-healing is NEVER affected by this breaker.
 * States: CLOSED (normal) | OPEN (paused) | HALF_OPEN (testing recovery)
 */

'use strict';

class InnovationCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.pauseDurationMs = options.pauseDurationMs || 60 * 60 * 1000; // 1 hour
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
    this.history = []; // last 100 outcomes
  }

  /**
   * Returns true when innovation should be suppressed.
   * Self-healing must NEVER consult this method.
   */
  isOpen() {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.pauseDurationMs) {
        // Transition to HALF_OPEN: allow one probe experiment
        this.state = 'HALF_OPEN';
        console.log('[CircuitBreaker] HALF_OPEN: pause expired, allowing probe experiment');
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful experiment (profit > baseline).
   */
  recordSuccess(detail = {}) {
    this.consecutiveFailures = 0;
    const prev = this.state;
    this.state = 'CLOSED';
    this._pushHistory({ outcome: 'SUCCESS', ts: Date.now(), detail });
    if (prev !== 'CLOSED') {
      console.log('[CircuitBreaker] CLOSED: experiment succeeded, innovation resumed');
    }
  }

  /**
   * Record a failed experiment (profit <= baseline).
   */
  recordFailure(detail = {}) {
    this.consecutiveFailures++;
    this._pushHistory({ outcome: 'FAILURE', ts: Date.now(), detail, consecutiveCount: this.consecutiveFailures });

    if (this.state === 'HALF_OPEN') {
      // Probe failed → reopen
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.warn(`[CircuitBreaker] OPEN (probe failed): innovation paused for ${this.pauseDurationMs / 60000} minutes`);
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold && this.state === 'CLOSED') {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.warn(
        `[CircuitBreaker] OPEN: ${this.consecutiveFailures} consecutive profit losses. ` +
        `Innovation paused for ${this.pauseDurationMs / 60000} minutes.`
      );
    }
  }

  getStatus() {
    const pauseRemainingMs =
      this.state === 'OPEN' ? Math.max(0, this.pauseDurationMs - (Date.now() - this.openedAt)) : 0;
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      pauseRemainingMs,
      pauseRemainingMin: Math.ceil(pauseRemainingMs / 60000),
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
      recentHistory: this.history.slice(-10),
    };
  }

  _pushHistory(entry) {
    this.history.push(entry);
    if (this.history.length > 100) this.history.shift();
  }
}

// Singleton
const breaker = new InnovationCircuitBreaker();
module.exports = breaker;
module.exports.InnovationCircuitBreaker = InnovationCircuitBreaker;
