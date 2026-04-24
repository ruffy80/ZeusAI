// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== LOG MONITOR MODULE ====================
// Monitorizează log-urile sistemului în timp real:
// - Detectează erori critice, excepții, crash-uri
// - Agregă statistici pe nivel (ERROR, WARN, INFO)
// - Alertează orchestratorul când erorile depășesc pragul

const fs   = require('fs');
const path = require('path');

const MONITOR_INTERVAL_MS  = parseInt(process.env.LOG_MONITOR_INTERVAL_MS  || '30000', 10);
const ERROR_THRESHOLD      = parseInt(process.env.LOG_MONITOR_ERROR_THRESH  || '10',   10); // erori/min → alertă
const LOGS_DIR             = path.join(__dirname, '..', '..', 'logs');

const _state = {
  name:          'log-monitor',
  label:         'Log Monitor',
  startedAt:     null,
  scanCount:     0,
  lastScan:      null,
  lastError:     null,
  health:        'good',
  running:       false,
  intervalHandle: null,
  stats: {
    errorCount:  0,
    warnCount:   0,
    infoCount:   0,
    criticalCount: 0,
    lastErrors:  [],   // ultimele 20 erori
  },
  fileOffsets: {},   // offset per fișier (citire incrementală)
};

// ── Pattern-uri de detectare ─────────────────────────────────────────────────
const PATTERNS = [
  { re: /\b(CRITICAL|FATAL|EMERGENCY)\b/i,   level: 'critical' },
  { re: /\b(ERROR|Exception|TypeError|ReferenceError|SyntaxError|ENOENT|ECONNREFUSED)\b/i, level: 'error' },
  { re: /\b(WARN|WARNING|Deprecat)\b/i,       level: 'warn' },
  { re: /\b(INFO|info)\b/,                    level: 'info' },
];

function _classifyLine(line) {
  for (const { re, level } of PATTERNS) {
    if (re.test(line)) return level;
  }
  return null;
}

function _scanFile(fp) {
  let offset = _state.fileOffsets[fp] || 0;
  let stat;
  try { stat = fs.statSync(fp); } catch { return; }

  if (stat.size < offset) {
    // Fișier rotit (mai mic decât offsetul anterior) — resetăm
    offset = 0;
  }
  if (stat.size === offset) return; // Nimic nou

  let chunk;
  try {
    const fd  = fs.openSync(fp, 'r');
    const len = stat.size - offset;
    chunk     = Buffer.alloc(Math.min(len, 65536)); // max 64KB per scan
    const read = fs.readSync(fd, chunk, 0, chunk.length, offset);
    fs.closeSync(fd);
    _state.fileOffsets[fp] = offset + read;
    chunk = chunk.slice(0, read);
  } catch { return; }

  const lines = chunk.toString('utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const level = _classifyLine(line);
    if (!level) continue;

    _state.stats[level + 'Count'] = (_state.stats[level + 'Count'] || 0) + 1;

    if (level === 'error' || level === 'critical') {
      const entry = { ts: new Date().toISOString(), file: path.basename(fp), level, line: line.slice(0, 200) };
      _state.stats.lastErrors.unshift(entry);
      if (_state.stats.lastErrors.length > 20) _state.stats.lastErrors.length = 20;
    }
  }
}

function _scanAllLogs() {
  if (!fs.existsSync(LOGS_DIR)) return;
  let files;
  try { files = fs.readdirSync(LOGS_DIR); } catch { return; }

  for (const file of files) {
    if (!/\.(log|txt)$/i.test(file)) continue;
    _scanFile(path.join(LOGS_DIR, file));
  }

  _state.scanCount++;
  _state.lastScan = new Date().toISOString();

  // Alertă dacă depășim pragul de erori
  if (_state.stats.errorCount + _state.stats.criticalCount > ERROR_THRESHOLD) {
    _state.health = 'degraded';
    console.warn(`⚠️  [log-monitor] ${_state.stats.errorCount} erori detectate în log-uri!`);
  } else {
    _state.health = 'good';
  }
}

function start() {
  if (_state.running) return;
  if (process.env.DISABLE_SELF_MUTATION === '1') {
    console.log('[log-monitor] disabled via DISABLE_SELF_MUTATION=1');
    return;
  }
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    try { _scanAllLogs(); } catch (e) { _state.lastError = e.message; }
  }, MONITOR_INTERVAL_MS);

  setImmediate(() => { try { _scanAllLogs(); } catch (e) { _state.lastError = e.message; } });
  console.log(`📋 [log-monitor] Pornit — interval: ${MONITOR_INTERVAL_MS}ms`);
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

function resetStats() {
  _state.stats.errorCount    = 0;
  _state.stats.warnCount     = 0;
  _state.stats.infoCount     = 0;
  _state.stats.criticalCount = 0;
  _state.stats.lastErrors    = [];
}

async function run(input = {}) {
  _scanAllLogs();
  return {
    status:    'ok',
    module:    _state.name,
    stats:     _state.stats,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, resetStats, name: 'log-monitor' };
