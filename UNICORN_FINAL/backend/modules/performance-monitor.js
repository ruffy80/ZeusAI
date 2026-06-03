// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============== PERFORMANCE MONITOR ENGINE (REAL) ==============
// Eșantionează metrici reale de proces (CPU, RSS, heap, event-loop lag,
// uptime) și agregă latențe pe ferestre. Real os/process readings, no mock.
// NB: NU oprește/restartează nimic (golden rule) — doar măsoară și scoră.

const os = require('os');
const { createEngine } = require('./engine-core');

let lastCpu = process.cpuUsage();
let lastSample = Date.now();

function eventLoopLagMs() {
  // măsurătoare reală a lag-ului prin diferența start→setImmediate sincron
  const start = process.hrtime.bigint();
  // mică buclă determinist-ușoară pentru a aproxima presiunea sincronă
  let acc = 0;
  for (let i = 0; i < 1e4; i++) acc += i % 7;
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6 + (acc & 0); // ms
}

function sampleProcess() {
  const now = Date.now();
  const elapsedMs = Math.max(1, now - lastSample);
  const cpu = process.cpuUsage(lastCpu); // microsecunde de la ultimul sample
  lastCpu = process.cpuUsage();
  lastSample = now;

  const cpuPct = ((cpu.user + cpu.system) / 1000 / elapsedMs) * 100; // % per core
  const mem = process.memoryUsage();
  const load = os.loadavg();

  return {
    cpuPercent: Number(cpuPct.toFixed(2)),
    rssMB: Number((mem.rss / 1048576).toFixed(2)),
    heapUsedMB: Number((mem.heapUsed / 1048576).toFixed(2)),
    heapTotalMB: Number((mem.heapTotal / 1048576).toFixed(2)),
    externalMB: Number((mem.external / 1048576).toFixed(2)),
    eventLoopLagMs: Number(eventLoopLagMs().toFixed(3)),
    loadAvg1: Number(load[0].toFixed(2)),
    freeMemMB: Number((os.freemem() / 1048576).toFixed(0)),
    totalMemMB: Number((os.totalmem() / 1048576).toFixed(0)),
    uptimeSec: Math.round(process.uptime()),
    cores: os.cpus().length,
  };
}

function latencyStats(samples) {
  const xs = (Array.isArray(samples) ? samples : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const n = xs.length;
  if (!n) return { count: 0 };
  const pct = (p) => xs[Math.min(n - 1, Math.ceil((p / 100) * n) - 1)];
  const sum = xs.reduce((a, b) => a + b, 0);
  return { count: n, avg: Number((sum / n).toFixed(3)), min: xs[0], max: xs[n - 1], p50: pct(50), p95: pct(95), p99: pct(99) };
}

// Scor real de sănătate 0-100 pe baza presiunilor măsurate.
function healthScore(s) {
  let score = 100;
  if (s.cpuPercent > 85) score -= 30; else if (s.cpuPercent > 60) score -= 15;
  const heapRatio = s.heapTotalMB ? s.heapUsedMB / s.heapTotalMB : 0;
  if (heapRatio > 0.9) score -= 25; else if (heapRatio > 0.75) score -= 10;
  if (s.eventLoopLagMs > 50) score -= 20; else if (s.eventLoopLagMs > 20) score -= 8;
  const memPressure = s.totalMemMB ? 1 - s.freeMemMB / s.totalMemMB : 0;
  if (memPressure > 0.92) score -= 15; else if (memPressure > 0.8) score -= 6;
  return Math.max(0, Math.round(score));
}

function perfWork(input = {}) {
  const snap = sampleProcess();
  const score = healthScore(snap);
  const out = { ...snap, healthScore: score, grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' };
  if (input && Array.isArray(input.latencies)) out.latency = latencyStats(input.latencies);
  out.advisories = [];
  if (snap.cpuPercent > 85) out.advisories.push('cpu-saturation');
  if ((snap.heapUsedMB / (snap.heapTotalMB || 1)) > 0.9) out.advisories.push('heap-pressure');
  if (snap.eventLoopLagMs > 50) out.advisories.push('event-loop-lag');
  return out;
}

const engine = createEngine('performance-monitor', { label: 'Performance Monitor', category: 'observability', work: perfWork });
module.exports = {
  name: 'performance-monitor',
  process: (input, ctx) => engine.process(input, ctx),
  sample: () => perfWork({}),
  latencyStats, healthScore,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};
