// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AUTO-OPTIMIZE MODULE ====================
// Optimizează automat performanța sistemului:
// - Garbage collection Node.js
// - Compresie logs vechi
// - Curățare fișiere temporare
// - Ajustare parametri în funcție de încărcare

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const OPTIMIZE_INTERVAL_MS  = parseInt(process.env.AUTO_OPTIMIZE_INTERVAL_MS || '300000', 10); // 5 min
const LOG_MAX_SIZE_MB        = parseInt(process.env.AUTO_OPTIMIZE_LOG_MAX_MB  || '50',    10);
const LOG_MAX_AGE_DAYS       = parseInt(process.env.AUTO_OPTIMIZE_LOG_AGE_DAYS || '7',   10);
const LOGS_DIR               = path.join(__dirname, '..', '..', 'logs');

const _state = {
  name:            'auto-optimize',
  label:           'Auto-Optimize Engine',
  startedAt:       null,
  optimizeCount:   0,
  lastOptimize:    null,
  lastError:       null,
  health:          'good',
  optimizeLog:     [],
  running:         false,
  intervalHandle:  null,
  metrics:         {
    logsCleaned:     0,
    gcRuns:          0,
    tmpCleaned:      0,
    cpuLoadAvg:      [],
    memFreeMB:       0,
    diskUsagePct:    0,
  },
};

function _log(action, detail, success = true) {
  const entry = { ts: new Date().toISOString(), action, detail, success };
  _state.optimizeLog.unshift(entry);
  if (_state.optimizeLog.length > 50) _state.optimizeLog.length = 50;
  _state.lastOptimize = entry.ts;
  if (success) _state.optimizeCount++;
  console.log(`⚡ [auto-optimize] ${action}: ${detail}`);
}

// ── 1. GC dacă memoria e mare ────────────────────────────────────────────────
function _gcIfNeeded() {
  const used = process.memoryUsage();
  const heapPct = Math.round((used.heapUsed / used.heapTotal) * 100);
  if (heapPct > 80 && global.gc) {
    global.gc();
    _state.metrics.gcRuns++;
    _log('gc', `Heap ${heapPct}% → GC declanșat`);
  }
}

// ── 2. Curățare log-uri vechi / mari ────────────────────────────────────────
function _cleanLogs() {
  if (!fs.existsSync(LOGS_DIR)) return 0;
  let cleaned = 0;
  const cutoff = Date.now() - LOG_MAX_AGE_DAYS * 86400 * 1000;
  const maxBytes = LOG_MAX_SIZE_MB * 1024 * 1024;

  let files;
  try { files = fs.readdirSync(LOGS_DIR); } catch { return 0; }

  for (const file of files) {
    if (!/\.(log|txt)$/i.test(file)) continue;
    const fp = path.join(LOGS_DIR, file);
    try {
      const stat = fs.statSync(fp);
      const tooOld  = stat.mtimeMs < cutoff;
      const tooBig  = stat.size > maxBytes;

      if (tooOld) {
        fs.unlinkSync(fp);
        _log('log-delete', `${file} (vechi ${LOG_MAX_AGE_DAYS}z)`);
        cleaned++;
      } else if (tooBig) {
        // Trunchiere: păstrăm ultimele 10000 bytes
        const fd = fs.openSync(fp, 'r+');
        const tail = Buffer.alloc(10000);
        const read = fs.readSync(fd, tail, 0, 10000, stat.size - 10000);
        fs.ftruncateSync(fd, 0);
        fs.writeSync(fd, tail, 0, read, 0);
        fs.closeSync(fd);
        _log('log-truncate', `${file} (${Math.round(stat.size / 1024 / 1024)}MB)`);
        cleaned++;
      }
    } catch (e) {
      _state.lastError = e.message;
    }
  }
  _state.metrics.logsCleaned += cleaned;
  return cleaned;
}

// ── 3. Colectare metrici sistem ──────────────────────────────────────────────
function _collectMetrics() {
  const load = os.loadavg();
  _state.metrics.cpuLoadAvg = load.map(l => Math.round(l * 100) / 100);
  _state.metrics.memFreeMB  = Math.round(os.freemem() / 1024 / 1024);
  _state.metrics.memTotalMB = Math.round(os.totalmem() / 1024 / 1024);
  _state.metrics.memUsedPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
}

// ── Ciclu complet ─────────────────────────────────────────────────────────────
async function runOptimizeCycle() {
  _state.health = 'optimizing';
  _gcIfNeeded();
  const logsCleaned = _cleanLogs();
  _collectMetrics();
  _state.health = 'good';

  return { logsCleaned, metrics: _state.metrics };
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    runOptimizeCycle().catch(e => { _state.lastError = e.message; });
  }, OPTIMIZE_INTERVAL_MS);

  setImmediate(() => runOptimizeCycle().catch(e => { _state.lastError = e.message; }));
  console.log(`⚡ [auto-optimize] Pornit — interval: ${OPTIMIZE_INTERVAL_MS}ms`);
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
  const result = await runOptimizeCycle();
  return {
    status:    'ok',
    module:    _state.name,
    ...result,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, runOptimizeCycle, name: 'auto-optimize' };
