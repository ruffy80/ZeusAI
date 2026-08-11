'use strict';

// =====================================================================
// lib/hang-detect.js — pure, side-effect-free helpers that power
// scripts/hang-watchdog.js. Kept separate so the interesting decision
// logic (classification, idempotency, cooldown, per-app restart mapping,
// restart env) is unit-testable WITHOUT touching the network, pm2 or
// nginx. No require() of http/net/child_process here on purpose.
//
// The outage this defends against: nginx accepts the TCP/TLS connection
// but the Node upstream never writes an HTTP response — "TCP accept but
// HTTP hang". A naive probe that only checks connectivity sees the open
// socket and calls the box healthy while every real request hangs with
// 0 bytes. We therefore need probe results rich enough to tell apart:
//   • refused / no-listener  (process dead) — connect fails
//   • hang                   (accept but no HTTP bytes) — connect ok, http timeout
//   • http_error             (accept + responds, but !2xx/3xx)
//   • healthy                (accept + 2xx/3xx)
// Only `hang`, `refused` and `http_error` are actionable outages.
// =====================================================================

const HEALTHY = 'healthy';
const HANG = 'hang';
const REFUSED = 'refused';
const HTTP_ERROR = 'http_error';

/**
 * Classify a single probe from its low-level observations.
 *
 * @param {object} p
 * @param {boolean} p.tcpOk       TCP connect to host:port succeeded.
 * @param {boolean} [p.httpResponded] Server sent HTTP status bytes.
 * @param {boolean} [p.httpTimedOut]  HTTP request exceeded the short timeout.
 * @param {number|null} [p.httpCode]  HTTP status code (0/null if none).
 * @returns {{state:string, actionable:boolean, hung:boolean}}
 */
function classifyProbe(p) {
  const tcpOk = !!(p && p.tcpOk);
  const responded = !!(p && p.httpResponded);
  const timedOut = !!(p && p.httpTimedOut);
  const code = Number((p && p.httpCode) || 0);

  if (!tcpOk) {
    // Could not even open the socket → no listener / process gone.
    return { state: REFUSED, actionable: true, hung: false };
  }

  if (responded && code >= 200 && code < 400) {
    return { state: HEALTHY, actionable: false, hung: false };
  }

  if (responded && code >= 400) {
    // Listener answered but with an error status. Actionable but NOT a
    // frozen event loop, so it does not justify a SIGKILL escalation.
    return { state: HTTP_ERROR, actionable: true, hung: false };
  }

  // TCP accepted but no complete HTTP response (timeout or 0 bytes) → the
  // canonical "accept but hang". This is the frozen-event-loop signature.
  if (timedOut || !responded) {
    return { state: HANG, actionable: true, hung: true };
  }

  return { state: HTTP_ERROR, actionable: true, hung: false };
}

/**
 * Given a map of probeName → classification and a probe→app mapping,
 * return the de-duplicated, order-stable list of PM2 apps that need a
 * restart, and whether any of them is in a hung state (which upgrades the
 * restart to a forced SIGKILL). A site-only outage must restart ONLY the
 * site — never pointlessly bounce a healthy backend, and vice-versa.
 *
 * @param {Array<{name:string, app:string, classification:object}>} probes
 * @returns {{apps:string[], hungApps:string[], anyHung:boolean}}
 */
function decideRestartTargets(probes) {
  const apps = [];
  const hungApps = [];
  const seen = new Set();
  const seenHung = new Set();
  for (const pr of probes || []) {
    if (!pr || !pr.app || !pr.classification) continue;
    if (!pr.classification.actionable) continue;
    if (!seen.has(pr.app)) {
      seen.add(pr.app);
      apps.push(pr.app);
    }
    if (pr.classification.hung && !seenHung.has(pr.app)) {
      seenHung.add(pr.app);
      hungApps.push(pr.app);
    }
  }
  return { apps, hungApps, anyHung: hungApps.length > 0 };
}

/**
 * Idempotency / safety gate. A watchdog tick should only actuate when the
 * failure has persisted (consecutive fails ≥ threshold), the app is out of
 * its boot-grace window (a cold-booting Node legitimately returns nothing
 * for a few seconds), and we are outside the post-action cooldown so we do
 * not thrash pm2 on every 30s tick while a restart is still settling.
 *
 * @returns {{act:boolean, reason:string}}
 */
function shouldAct(opts) {
  const o = opts || {};
  const consecutiveFails = Number(o.consecutiveFails || 0);
  const threshold = Math.max(1, Number(o.threshold || 3));
  const now = Number(o.now || 0);
  const lastActionEpoch = Number(o.lastActionEpoch || 0);
  const cooldownSec = Math.max(0, Number(o.cooldownSec || 0));
  const bootUptimeSec = o.bootUptimeSec == null ? null : Number(o.bootUptimeSec);
  const bootGraceSec = Math.max(0, Number(o.bootGraceSec || 0));

  if (bootUptimeSec != null && bootUptimeSec >= 0 && bootUptimeSec < bootGraceSec) {
    return { act: false, reason: `boot_grace(${bootUptimeSec}s/${bootGraceSec}s)` };
  }
  if (consecutiveFails < threshold) {
    return { act: false, reason: `below_threshold(${consecutiveFails}/${threshold})` };
  }
  if (lastActionEpoch > 0 && cooldownSec > 0) {
    const since = now - lastActionEpoch;
    if (since < cooldownSec) {
      return { act: false, reason: `cooldown(${since}s/${cooldownSec}s)` };
    }
  }
  return { act: true, reason: `threshold_met(${consecutiveFails}/${threshold})` };
}

/**
 * Build the environment overrides used when (re)starting an app. The
 * backend MUST come up with DISABLE_SELF_MUTATION=1 so its autonomous
 * self-construction loop cannot rewrite source / thrash while we are
 * trying to recover. Site restarts inherit the same safety knob (it is a
 * no-op there but keeps the two paths identical and future-proof).
 *
 * @param {string} app
 * @param {object} [baseEnv]
 * @returns {object}
 */
function buildRestartEnv(app, baseEnv) {
  const env = Object.assign({}, baseEnv || {});
  env.DISABLE_SELF_MUTATION = '1';
  // Never let a recovery restart re-arm the in-process self-heal/ZDT loops
  // that historically suicide-looped the box during exactly this outage.
  env.QIS_AUTO_HEAL_ENABLED = env.QIS_AUTO_HEAL_ENABLED || 'false';
  env.ENABLE_AUTO_RESTART = '0';
  return env;
}

/** True in any environment where we must never actuate pm2/nginx. */
function isCiOrTest(env) {
  const e = env || {};
  return String(e.CI || '') === 'true'
    || String(e.GITHUB_ACTIONS || '') === 'true'
    || String(e.NODE_ENV || '') === 'test';
}

module.exports = {
  STATES: { HEALTHY, HANG, REFUSED, HTTP_ERROR },
  classifyProbe,
  decideRestartTargets,
  shouldAct,
  buildRestartEnv,
  isCiOrTest,
};
