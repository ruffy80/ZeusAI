// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.685Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// predictive-scaler.js
// Modul autonom: monitorizează traficul și scalează procesele PM2 automat pe baza predicțiilor AI.

'use strict';

const { execSync } = require('child_process');
const os = require('os');
let lastScale = Date.now();
let lastProcs = 1;
let pm2Available;
const PM2_SCALE_APP = process.env.PREDICTIVE_SCALER_APP || process.env.PM2_SCALE_APP || 'unicorn-site';
// SAFETY CAPS (2026-05-29). Historically this module used RANDOM fake metrics and
// scaled unicorn-site up to 8 workers * ~1.4 GB = ~11 GB RSS → OOM thrash on the
// 8 GB box. It is now: (1) OFF by default (fail-safe), (2) driven by REAL os
// metrics, (3) hard memory-guarded, (4) capped low. Enable explicitly with
// PREDICTIVE_SCALER_ENABLED=1 only on a node with measured headroom.
// PLAFOANE DE SIGURANȚĂ: implicit oprit, metrici reale, gardă de memorie, cap mic.
const MAX_PROCS = Math.max(1, parseInt(process.env.PREDICTIVE_SCALER_MAX || '2', 10));
const MIN_PROCS = Math.max(1, parseInt(process.env.PREDICTIVE_SCALER_MIN || '1', 10));
const MIN_FREE_MB = parseInt(process.env.PREDICTIVE_SCALER_MIN_FREE_MB || '1200', 10);
const SCALE_UP_LOAD_RATIO = parseFloat(process.env.PREDICTIVE_SCALER_UP_LOAD || '0.85'); // loadavg/core
const SCALE_DOWN_LOAD_RATIO = parseFloat(process.env.PREDICTIVE_SCALER_DOWN_LOAD || '0.35');

function hasPm2() {
  if (pm2Available !== undefined) return pm2Available;
  try {
    execSync('command -v pm2', { stdio: 'ignore' });
    pm2Available = true;
  } catch (_) {
    pm2Available = false;
    console.warn('[predictive-scaler] PM2 unavailable, autoscaling disabled for this runtime.');
  }
  return pm2Available;
}

function getTrafficMetrics() {
  // REAL metrics only (no random/demo data). loadavg normalized per core +
  // actual free memory. Metrici reale: încărcare pe nucleu + memorie liberă reală.
  const cores = Math.max(1, os.cpus().length);
  const load1 = os.loadavg()[0] || 0;
  return {
    loadRatio: load1 / cores,
    freeMb: Math.round(os.freemem() / (1024 * 1024)),
  };
}

function predictNeededProcs(metrics) {
  // Scale up only under REAL sustained load AND with memory headroom.
  if (metrics.loadRatio > SCALE_UP_LOAD_RATIO && metrics.freeMb >= MIN_FREE_MB) {
    return Math.min(lastProcs + 1, MAX_PROCS);
  }
  // Scale down when comfortably idle.
  if (metrics.loadRatio < SCALE_DOWN_LOAD_RATIO) {
    return Math.max(lastProcs - 1, MIN_PROCS);
  }
  return lastProcs;
}

function autoScale() {
  const metrics = getTrafficMetrics();
  const needed = predictNeededProcs(metrics);
  if (needed === lastProcs || Date.now() - lastScale <= 60000) return;
  // Hard memory guard: never scale UP without headroom, regardless of prediction.
  if (needed > lastProcs && metrics.freeMb < MIN_FREE_MB) {
    console.warn(`[predictive-scaler] Refusing scale-up: free=${metrics.freeMb}MB < ${MIN_FREE_MB}MB`);
    return;
  }
  try {
    if (!hasPm2()) return;
    // Snapshot real PM2 state once and decide off it. Counting instances by
    // name covers cluster mode where pm2 jlist returns N rows (one per worker).
    const list = execSync('pm2 jlist', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const apps = JSON.parse(list || '[]');
    const matches = apps.filter(app => app && app.name === PM2_SCALE_APP);
    if (matches.length === 0) {
      console.warn(`[predictive-scaler] PM2: ${PM2_SCALE_APP} app not found, skipping scaling.`);
      return;
    }
    const currentRunning = matches.length;
    if (currentRunning === needed) {
      // Already at target — flip our local cursor so we don't keep retrying.
      lastProcs = needed;
      lastScale = Date.now();
      return;
    }
    try {
      execSync(`pm2 scale ${PM2_SCALE_APP} ${needed}`, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[predictive-scaler] Scaled ${PM2_SCALE_APP} ${currentRunning}\u2192${needed} procs (loadRatio=${metrics.loadRatio.toFixed(2)}, free=${metrics.freeMb}MB)`);
    } catch (e) {
      const out = String((e && (e.stderr || e.stdout || e.message)) || '');
      // PM2 prints "Nothing to do" when scale target equals current — that's a
      // success no-op, not an error worth restarting the autoscaler over.
      if (/Nothing to do/i.test(out)) {
        lastProcs = needed;
        lastScale = Date.now();
        return;
      }
      console.warn('[predictive-scaler] Scaling failed:', (e && e.message) || out);
      return;
    }
    lastProcs = needed;
    lastScale = Date.now();
  } catch (e) {
    console.warn('[predictive-scaler] Scaling failed:', e && e.message);
  }
}

// Rulează la fiecare 2 minute
// .unref() so the timer does not keep the Node event loop alive on its own.
// In production the HTTP server keeps the loop active, so scaling still runs;
// in test/CLI contexts the process can exit cleanly once its work is done
// (otherwise tests that load src/index.js hang forever and CI deploys time out).
// Replica workers in PM2 cluster mode set PREDICTIVE_SCALER_DISABLED=1 so only
// instance 0 issues `pm2 scale` (avoid N workers racing on the same command).
// FAIL-SAFE: OFF unless PREDICTIVE_SCALER_ENABLED=1 is explicitly set. This
// prevents the historical random-metric OOM storm from ever auto-arming.
// IMPLICIT OPRIT: pornește doar cu PREDICTIVE_SCALER_ENABLED=1.
let _scalerTimer = null;
if (process.env.PREDICTIVE_SCALER_ENABLED === '1' && process.env.PREDICTIVE_SCALER_DISABLED !== '1') {
  _scalerTimer = setInterval(autoScale, 120000);
  if (typeof _scalerTimer.unref === 'function') _scalerTimer.unref();
}

module.exports = { autoScale };
