// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== RESOURCE MONITOR MODULE ====================
// Monitorizează resursele sistemului în timp real:
// - CPU, RAM, Disk
// - Heap Node.js
// - Generează alerte când pragurile sunt depășite
// - Stochează istoricul pentru analiză trend

const os = require('os');
const fs = require('fs');

const MONITOR_INTERVAL_MS = parseInt(process.env.RESOURCE_MONITOR_INTERVAL_MS || '15000', 10);
const CPU_WARN_PCT        = parseInt(process.env.HEALTH_CPU_WARN               || '85',   10);
const RAM_WARN_PCT        = parseInt(process.env.HEALTH_RAM_WARN               || '90',   10);
const DISK_WARN_PCT       = parseInt(process.env.HEALTH_DISK_WARN              || '85',   10);
const HISTORY_MAX         = 60; // ultimele 60 de probe

const _state = {
  name:          'resource-monitor',
  label:         'Resource Monitor',
  startedAt:     null,
  scanCount:     0,
  lastScan:      null,
  lastError:     null,
  health:        'good',
  running:       false,
  intervalHandle: null,
  alerts:        [],   // ultimele 20 alerte
  current: {
    cpuLoadAvg1:  0,
    cpuLoadAvg5:  0,
    cpuLoadAvg15: 0,
    cpuCores:     os.cpus().length,
    cpuLoadPct:   0,
    memTotalMB:   Math.round(os.totalmem() / 1024 / 1024),
    memFreeMB:    0,
    memUsedPct:   0,
    heapUsedMB:   0,
    heapTotalMB:  0,
    heapPct:      0,
    diskUsedPct:  0,
    uptimeSec:    0,
  },
  history: [],   // array de snapshots
};

// ── Colectare metrici ─────────────────────────────────────────────────────────
function _collect() {
  const load    = os.loadavg();
  const cores   = os.cpus().length;
  const memFree = os.freemem();
  const memTotal = os.totalmem();
  const mem     = process.memoryUsage();

  _state.current.cpuLoadAvg1  = Math.round(load[0] * 100) / 100;
  _state.current.cpuLoadAvg5  = Math.round(load[1] * 100) / 100;
  _state.current.cpuLoadAvg15 = Math.round(load[2] * 100) / 100;
  _state.current.cpuLoadPct   = Math.round((load[0] / cores) * 100);
  _state.current.memFreeMB    = Math.round(memFree / 1024 / 1024);
  _state.current.memUsedPct   = Math.round(((memTotal - memFree) / memTotal) * 100);
  _state.current.heapUsedMB   = Math.round(mem.heapUsed / 1024 / 1024);
  _state.current.heapTotalMB  = Math.round(mem.heapTotal / 1024 / 1024);
  _state.current.heapPct      = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  _state.current.uptimeSec    = Math.round(process.uptime());
  _state.current.ts           = new Date().toISOString();

  // Disk usage dintr-un fișier de sistem (Linux)
  try {
    const statVFS = fs.statfsSync ? fs.statfsSync('/') : null;
    if (statVFS) {
      const total = statVFS.blocks * statVFS.bsize;
      const free  = statVFS.bfree  * statVFS.bsize;
      _state.current.diskUsedPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
    }
  } catch { /* statfs poate lipsi pe unele sisteme */ }

  // Stocăm în history
  const snap = { ...(_state.current) };
  _state.history.unshift(snap);
  if (_state.history.length > HISTORY_MAX) _state.history.length = HISTORY_MAX;

  _state.scanCount++;
  _state.lastScan = _state.current.ts;
}

// ── Generare alerte ──────────────────────────────────────────────────────────
function _checkAlerts() {
  const { cpuLoadPct, memUsedPct, diskUsedPct } = _state.current;
  const alerts = [];
  const now = new Date().toISOString();

  if (cpuLoadPct > CPU_WARN_PCT) {
    alerts.push({ ts: now, type: 'cpu',  level: 'warning', value: cpuLoadPct, threshold: CPU_WARN_PCT,
      msg: `CPU ${cpuLoadPct}% > ${CPU_WARN_PCT}%` });
  }
  if (memUsedPct > RAM_WARN_PCT) {
    alerts.push({ ts: now, type: 'ram',  level: 'warning', value: memUsedPct, threshold: RAM_WARN_PCT,
      msg: `RAM ${memUsedPct}% > ${RAM_WARN_PCT}%` });
  }
  if (diskUsedPct > DISK_WARN_PCT) {
    alerts.push({ ts: now, type: 'disk', level: 'warning', value: diskUsedPct, threshold: DISK_WARN_PCT,
      msg: `Disk ${diskUsedPct}% > ${DISK_WARN_PCT}%` });
  }

  for (const alert of alerts) {
    console.warn(`⚠️  [resource-monitor] ${alert.msg}`);
    _state.alerts.unshift(alert);
  }
  if (_state.alerts.length > 20) _state.alerts.length = 20;

  _state.health = alerts.some(a => a.level === 'critical') ? 'critical'
    : alerts.length > 0 ? 'degraded' : 'good';

  return alerts;
}

function _scan() {
  _collect();
  return _checkAlerts();
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    try { _scan(); } catch (e) { _state.lastError = e.message; }
  }, MONITOR_INTERVAL_MS);

  setImmediate(() => { try { _scan(); } catch (e) { _state.lastError = e.message; } });
  console.log(`📊 [resource-monitor] Pornit — interval: ${MONITOR_INTERVAL_MS}ms`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return { ..._state };
}

function getMetrics() {
  return _state.current;
}

async function run(input = {}) {
  const alerts = _scan();
  return {
    status:   'ok',
    module:   _state.name,
    metrics:  _state.current,
    alerts,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, getMetrics, name: 'resource-monitor' };
