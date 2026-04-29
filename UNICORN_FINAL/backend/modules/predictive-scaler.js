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
  if (needed !== lastProcs && Date.now() - lastScale > 60000) {
    try {
      // Verifică dacă unicorn există în PM2
      const list = execSync('pm2 jlist').toString();
      if (!list.includes('"name":"unicorn"')) {
        console.warn('[predictive-scaler] PM2: unicorn app not found, skipping scaling.');
        return;
      }
      execSync(`pm2 scale unicorn ${needed}`);
      lastProcs = needed;
      lastScale = Date.now();
      console.log(`[predictive-scaler] Scaled unicorn to ${needed} procs (rps=${metrics.rps}, cpu=${metrics.cpu.toFixed(1)}%)`);
    } catch (e) {
      console.warn('[predictive-scaler] Scaling failed:', e.message);
    }
  }
}

// Rulează la fiecare 2 minute
setInterval(autoScale, 120000);

module.exports = { autoScale };
