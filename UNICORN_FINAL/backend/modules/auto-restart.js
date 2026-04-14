// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AUTO-RESTART MODULE ====================
// Monitorizează procesele critice și le repornește automat când se opresc.
// Suportă backoff exponențial și notificare la orchestrator.

const { execFile } = require('child_process');
const http = require('http');

const CHECK_INTERVAL_MS   = parseInt(process.env.AUTO_RESTART_INTERVAL_MS  || '30000', 10);
const MAX_RESTART_HISTORY = parseInt(process.env.AUTO_RESTART_MAX_HISTORY  || '200',   10);
const ORCHESTRATOR_URL    = process.env.ORCH_HEALTH_URL || 'http://127.0.0.1:3000/api/health';

const CRITICAL_PROCESSES = (
  process.env.SHIELD_REQUIRED_PROCS ||
  'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog,unicorn-shield,unicorn-health-daemon'
).split(',').map(p => p.trim()).filter(Boolean);

const _state = {
  name:           'auto-restart',
  label:          'Auto-Restart Engine',
  startedAt:      null,
  restartCount:   0,
  failCount:      0,
  lastRestart:    null,
  lastError:      null,
  health:         'good',
  restartLog:     [],
  running:        false,
  intervalHandle: null,
};

// Backoff per proces (exponential, max 5 min)
const _backoff = {};

function _safeExecPm2(args) {
  return new Promise((resolve) => {
    const allowed = ['restart', 'list', 'start'];
    if (!allowed.includes(args[0])) return resolve({ ok: false, out: 'forbidden' });
    execFile('pm2', args, { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: stdout || stderr || (err && err.message) || '' });
    });
  });
}

function _log(action, proc, success) {
  const entry = { ts: new Date().toISOString(), action, proc, success };
  _state.restartLog.unshift(entry);
  if (_state.restartLog.length > MAX_RESTART_HISTORY) _state.restartLog.length = MAX_RESTART_HISTORY;
  _state.lastRestart = entry.ts;
  if (success) _state.restartCount++; else _state.failCount++;
  console.log(`🔁 [auto-restart] ${action} "${proc}": ${success ? 'OK' : 'FAIL'}`);
}

function _isBackedOff(proc) {
  const b = _backoff[proc];
  if (!b) return false;
  return Date.now() < b.nextTry;
}

function _markFailed(proc) {
  const b = _backoff[proc] || { attempts: 0, nextTry: 0 };
  b.attempts++;
  const delay = Math.min(300000, 5000 * Math.pow(2, b.attempts - 1)); // 5s → 300s
  b.nextTry = Date.now() + delay;
  _backoff[proc] = b;
  console.warn(`⏳ [auto-restart] "${proc}" backoff ${Math.round(delay / 1000)}s (attempt ${b.attempts})`);
}

function _clearBackoff(proc) {
  delete _backoff[proc];
}

async function _getPm2List() {
  const { ok, out } = await _safeExecPm2(['list', '--no-color']);
  if (!ok) return {};
  const statuses = {};
  // Parse pm2 list output — format: │ <id> │ <name> │ ... │ <status> │ ...
  for (const line of out.split('\n')) {
    const m = line.match(/\│\s+\d+\s+\│\s+(\S+)\s+.*?\│\s+(online|stopped|errored|launching)\s+/i);
    if (m) statuses[m[1]] = m[2].toLowerCase();
  }
  return statuses;
}

async function checkAndRestart() {
  const statuses = await _getPm2List();
  let restarted = 0;

  for (const proc of CRITICAL_PROCESSES) {
    const status = statuses[proc];
    const needsRestart = status === 'stopped' || status === 'errored';

    if (!needsRestart) {
      _clearBackoff(proc); // reset backoff dacă e OK
      continue;
    }

    if (_isBackedOff(proc)) continue;

    const res = await _safeExecPm2(['restart', proc]);
    if (res.ok) {
      _log('restart', proc, true);
      _clearBackoff(proc);
      restarted++;
    } else {
      _log('restart-fail', proc, false);
      _markFailed(proc);
      _state.lastError = `Failed to restart ${proc}: ${res.out}`;
    }
  }

  return restarted;
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    checkAndRestart().catch(e => { _state.lastError = e.message; });
  }, CHECK_INTERVAL_MS);

  setImmediate(() => checkAndRestart().catch(e => { _state.lastError = e.message; }));
  console.log(`🔁 [auto-restart] Pornit — interval: ${CHECK_INTERVAL_MS}ms`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return {
    ..._state,
    watchedProcesses: CRITICAL_PROCESSES,
    backoffStatus:    Object.entries(_backoff).map(([p, b]) => ({
      proc: p, attempts: b.attempts, nextTryIn: Math.max(0, b.nextTry - Date.now()),
    })),
    memMB:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec: Math.round(process.uptime()),
  };
}

async function run(input = {}) {
  const restarted = await checkAndRestart();
  return {
    status:    'ok',
    module:    _state.name,
    restarted,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, checkAndRestart, name: 'auto-restart' };
