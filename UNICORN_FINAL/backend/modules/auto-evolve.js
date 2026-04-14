// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AUTO-EVOLVE MODULE ====================
// Motor de auto-evoluție: analizează metrici, identifică tipare de degradare,
// propune și aplică micro-optimizări autonome pentru a îmbunătăți continuu sistemul.

const os   = require('os');
const http = require('http');

const EVOLVE_INTERVAL_MS = parseInt(process.env.AUTO_EVOLVE_INTERVAL_MS || '600000', 10); // 10 min
const BACKEND_URL        = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:3000';

const _state = {
  name:          'auto-evolve',
  label:         'Auto-Evolve Engine',
  startedAt:     null,
  evolveCount:   0,
  lastEvolve:    null,
  lastError:     null,
  health:        'good',
  generation:    0,       // generația curentă a sistemului
  improvements:  [],      // ultimele 30 îmbunătățiri aplicate
  insights:      [],      // insight-uri generate
  running:       false,
  intervalHandle: null,
  metrics: {
    avgResponseTimeMs: 0,
    errorRatePct:      0,
    uptimePct:         100,
    memUsedPct:        0,
    cpuLoad:           0,
    innovationScore:   0,
  },
  evolutionHistory: [],
};

// ── Colectare metrici interne ────────────────────────────────────────────────
function _collectSystemMetrics() {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  _state.metrics.memUsedPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  _state.metrics.cpuLoad    = Math.round(load[0] * 10) / 10; // 1-min avg
}

// ── Analiză metrici și generare insights ─────────────────────────────────────
function _analyzeAndGenerateInsights() {
  const insights = [];
  const { memUsedPct, cpuLoad, errorRatePct } = _state.metrics;

  if (memUsedPct > 75) {
    insights.push({ type: 'memory', severity: 'warning', msg: `Memorie ${memUsedPct}% — recomand GC sau reducere cache` });
  }
  if (cpuLoad > (os.cpus().length * 0.8)) {
    insights.push({ type: 'cpu', severity: 'warning', msg: `CPU load ${cpuLoad} — posibil bottleneck` });
  }
  if (errorRatePct > 5) {
    insights.push({ type: 'errors', severity: 'critical', msg: `Rata erori ${errorRatePct}% > 5% — trigger recovery` });
  }
  if (insights.length === 0) {
    insights.push({ type: 'health', severity: 'info', msg: 'Sistem stabil — nicio îmbunătățire necesară' });
  }

  _state.insights = insights;
  return insights;
}

// ── Aplicare micro-optimizări ────────────────────────────────────────────────
function _applyMicroOptimizations(insights) {
  const applied = [];

  for (const insight of insights) {
    if (insight.type === 'memory' && global.gc) {
      global.gc();
      applied.push({ action: 'gc', reason: insight.msg, ts: new Date().toISOString() });
    }
    // Alte micro-optimizări pot fi adăugate aici
  }

  return applied;
}

// ── Evoluție: increment generație dacă s-au aplicat optimizări ──────────────
function _evolve(applied) {
  if (applied.length > 0) {
    _state.generation++;
    _state.evolveCount++;
    const entry = {
      generation: _state.generation,
      ts:         new Date().toISOString(),
      applied,
      insights:   _state.insights.length,
    };
    _state.evolutionHistory.unshift(entry);
    if (_state.evolutionHistory.length > 30) _state.evolutionHistory.length = 30;
    _state.improvements.unshift(...applied);
    if (_state.improvements.length > 30) _state.improvements.length = 30;
    console.log(`🧬 [auto-evolve] Generația ${_state.generation} — ${applied.length} optimizări aplicate`);
  }
  _state.lastEvolve = new Date().toISOString();
  _state.metrics.innovationScore = Math.min(100, _state.generation * 2 + _state.evolveCount);
}

// ── Ciclu complet de evoluție ────────────────────────────────────────────────
async function runEvolveCycle() {
  _state.health = 'evolving';
  _collectSystemMetrics();
  const insights = _analyzeAndGenerateInsights();
  const applied  = _applyMicroOptimizations(insights);
  _evolve(applied);
  _state.health = 'good';
  return { generation: _state.generation, applied: applied.length, insights: insights.length };
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    runEvolveCycle().catch(e => { _state.lastError = e.message; });
  }, EVOLVE_INTERVAL_MS);

  setImmediate(() => runEvolveCycle().catch(e => { _state.lastError = e.message; }));
  console.log(`🧬 [auto-evolve] Pornit — interval: ${EVOLVE_INTERVAL_MS}ms`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return {
    ..._state,
    memMB:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
  };
}

async function run(input = {}) {
  const result = await runEvolveCycle();
  return {
    status:    'ok',
    module:    _state.name,
    ...result,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, runEvolveCycle, name: 'auto-evolve' };
