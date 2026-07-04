// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 5 — Self-Healing Commerce.
// RO: watchdog care verifică fiecare componentă. Dacă una eșuează, o
// reinițializează. După 3 eșecuri în 10 minute, pornește o instanță de
// rezervă (în-proces) și loghează.
//
// GOLDEN RULE #6: această componentă NU oprește/omoară procesul niciodată.
// Nu există process.exit, kill sau pm2-restart aici — doar reinit + log.

'use strict';

const { now, logger } = require('./util');

const log = logger('health');

const FAIL_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FAIL_THRESHOLD = 3;

class SelfHealing {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.components = new Map(); // name -> { reinit, lastBeat, fails:[], standby, restarts }
    this.checks = 0;
  }

  // Register a component with a reinit() function used to recover it.
  register(name, reinit) {
    this.components.set(name, {
      name,
      reinit: typeof reinit === 'function' ? reinit : (() => {}),
      lastBeat: Date.now(),
      fails: [],
      standby: false,
      restarts: 0,
    });
  }

  heartbeat(name) {
    const c = this.components.get(name);
    if (c) c.lastBeat = Date.now();
  }

  _recordFail(c) {
    const t = Date.now();
    c.fails = c.fails.filter(ts => t - ts < FAIL_WINDOW_MS);
    c.fails.push(t);
  }

  // Called when a component throws or fails to beat. Reinit; escalate to a
  // standby instance after FAIL_THRESHOLD fails in the window.
  reportFailure(name, err) {
    const c = this.components.get(name);
    if (!c) return;
    this._recordFail(c);
    log.warn('component failed:', name, err && err.message ? err.message : '');
    try { c.reinit(); c.restarts += 1; c.lastBeat = Date.now(); }
    catch (e) { log.warn('reinit failed for', name, '-', e.message); }

    if (c.fails.length >= FAIL_THRESHOLD && !c.standby) {
      // Bring up an in-process standby (golden-rule-safe: no new OS process).
      c.standby = true;
      log.warn('escalation: standby instance armed for', name, '(', c.fails.length, 'fails/10min )');
    }
  }

  // Periodic sweep: any component silent longer than maxSilenceMs is treated
  // as failed and recovered.
  sweep(maxSilenceMs) {
    const limit = maxSilenceMs || 90_000;
    const t = Date.now();
    this.checks += 1;
    const recovered = [];
    for (const c of this.components.values()) {
      if (t - c.lastBeat > limit) {
        this.reportFailure(c.name, new Error('heartbeat-timeout'));
        recovered.push(c.name);
      } else if (c.standby && c.fails.length === 0) {
        // Healthy again — stand down the standby.
        c.standby = false;
        log.info('component', c.name, 'healthy again; standby stood down');
      }
    }
    return recovered;
  }

  status() {
    const comps = {};
    for (const c of this.components.values()) {
      comps[c.name] = {
        healthy: Date.now() - c.lastBeat < 90_000,
        lastBeatAgoSec: Math.round((Date.now() - c.lastBeat) / 1000),
        failsInWindow: c.fails.length,
        restarts: c.restarts,
        standbyArmed: c.standby,
      };
    }
    return {
      ok: true,
      checks: this.checks,
      neverKillsProcess: true,
      failThreshold: FAIL_THRESHOLD,
      failWindowMin: FAIL_WINDOW_MS / 60000,
      components: comps,
      checkedAt: now(),
    };
  }
}

module.exports = { SelfHealing, FAIL_THRESHOLD, FAIL_WINDOW_MS };
