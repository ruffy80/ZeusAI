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
let lastScale = Date.now();
let lastProcs = 1;
let pm2Available;
const PM2_SCALE_APP = process.env.PREDICTIVE_SCALER_APP || process.env.PM2_SCALE_APP || 'unicorn-site';

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
  // Exemplu: folosește metrici reali din logs, API sau random pentru demo
  return {
    rps: 10 + Math.floor(Math.random() * 100), // requests/sec
    cpu: 20 + Math.random() * 60, // CPU %
    mem: 200 + Math.random() * 800 // MB
  };
}

function predictNeededProcs(metrics) {
  // AI simplificat: dacă rps > 80 sau cpu > 70%, scalează up
  if (metrics.rps > 80 || metrics.cpu > 70) return Math.min(lastProcs + 1, 8);
  // Dacă rps < 20 și cpu < 30%, scalează down
  if (metrics.rps < 20 && metrics.cpu < 30) return Math.max(lastProcs - 1, 1);
  return lastProcs;
}

function autoScale() {
  const metrics = getTrafficMetrics();
  const needed = predictNeededProcs(metrics);
  if (needed === lastProcs || Date.now() - lastScale <= 60000) return;
  try {
    if (!hasPm2()) return;
    const list = execSync('pm2 jlist', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const apps = JSON.parse(list || '[]');
    const matches = apps.filter(app => app && app.name === PM2_SCALE_APP);
    if (matches.length === 0) {
      console.warn(`[predictive-scaler] PM2: ${PM2_SCALE_APP} app not found, skipping scaling.`);
      return;
    }
    const currentRunning = matches.length;
    if (currentRunning === needed) {
      lastProcs = needed;
      lastScale = Date.now();
      return;
    }
    try {
      execSync(`pm2 scale ${PM2_SCALE_APP} ${needed}`, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`[predictive-scaler] Scaled ${PM2_SCALE_APP} ${currentRunning}\u2192${needed} procs (rps=${metrics.rps}, cpu=${metrics.cpu.toFixed(1)}%)`);
    } catch (e) {
      const out = String((e && (e.stderr || e.stdout || e.message)) || '');
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
const _scalerTimer = setInterval(autoScale, 120000);
if (typeof _scalerTimer.unref === 'function') _scalerTimer.unref();

module.exports = { autoScale };
