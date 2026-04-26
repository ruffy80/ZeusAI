// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:59.246Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SelfHealer — periodic 10s health check.
 * - Pings backend (http://127.0.0.1:3000/health) and site (http://127.0.0.1:3000/health)
 * - Tracks consecutive failures per target.
 * - Triggers restart strategy after 3 failures (PM2 / kill PID / shell hook).
 * - Calls onAlert() when needs_manual_review is reached.
 *
 * Lightweight, never crashes the host process. All loops .unref() so they don't
 * keep test runners alive.
 */
const http = require('http');
const { execFile } = require('child_process');

const DEFAULT_TARGETS = [
  { name: 'backend', url: 'http://127.0.0.1:3000/health' },
  { name: 'site',    url: 'http://127.0.0.1:3000/health' },
];

function ping(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 500;
      res.resume();
      resolve({ ok, status: res.statusCode || 0 });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
    req.on('error',   (e) => resolve({ ok: false, status: 0, error: e.message }));
  });
}

function pm2Restart(processName) {
  return new Promise((resolve) => {
    execFile('pm2', ['restart', processName, '--update-env'], { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), error: err && err.message });
    });
  });
}

function createSelfHealer({ targets = DEFAULT_TARGETS, intervalMs = 10000, maxFailures = 3, onAlert = () => {}, autoRestart = true } = {}) {
  const state = new Map(targets.map((t) => [t.name, { ...t, fails: 0, lastSeen: null, status: 'unknown', manualReview: false }]));
  let timer = null;
  const history = [];

  async function tick() {
    for (const target of state.values()) {
      const result = await ping(target.url);
      if (result.ok) {
        target.fails = 0;
        target.lastSeen = new Date().toISOString();
        target.status = 'healthy';
      } else {
        target.fails += 1;
        target.status = `unhealthy(${result.error || result.status})`;
        history.push({ at: new Date().toISOString(), name: target.name, status: target.status });
        if (history.length > 200) history.shift();
        if (autoRestart && target.fails === maxFailures) {
          // Try PM2 restart for known services
          const pmName = target.name === 'backend' ? 'unicorn-backend'
                       : target.name === 'site'    ? 'unicorn-site'
                       : null;
          if (pmName) {
            const r = await pm2Restart(pmName);
            history.push({ at: new Date().toISOString(), name: target.name, action: 'pm2-restart', ok: r.ok });
          }
        }
        if (target.fails >= maxFailures + 2 && !target.manualReview) {
          target.manualReview = true;
          try { onAlert({ kind: 'needs_manual_review', target: target.name, fails: target.fails }); } catch (_) {}
        }
      }
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    tick().catch(() => {});
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function getStatus() {
    return {
      running: !!timer,
      intervalMs,
      maxFailures,
      targets: Array.from(state.values()).map((t) => ({
        name: t.name, status: t.status, fails: t.fails, lastSeen: t.lastSeen, manualReview: t.manualReview,
      })),
      recentEvents: history.slice(-20),
    };
  }

  return { start, stop, tick, getStatus };
}

module.exports = { createSelfHealer, ping, pm2Restart };
