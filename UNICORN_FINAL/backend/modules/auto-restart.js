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

// Live PM2 topology is unicorn-backend + unicorn-site (see deploy-atomic-forward
// RETIRED_PM2_APPS). Legacy guardian/watchdog names were phantoms → restarter no-op.
const CRITICAL_PROCESSES = (
  process.env.SHIELD_REQUIRED_PROCS ||
  process.env.QIS_REQUIRED_PROCESSES ||
  'unicorn-backend,unicorn-site'
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
  probe:          'idle',
  unseen:         [],
  restartLog:     [],
  running:        false,
  intervalHandle: null,
};

// Backoff per proces (exponential, max 5 min)
const _backoff = {};

function _safeExecPm2(args) {
  return new Promise((resolve) => {
    const allowed = ['restart', 'list', 'jlist', 'start'];
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

function parsePm2Jlist(raw) {
  let rows;
  try { rows = JSON.parse(raw); } catch (_) { return null; }
  if (!Array.isArray(rows)) return null;
  const statuses = {};
  for (const row of rows) {
    const name = row && row.name;
    const status = row && row.pm2_env && row.pm2_env.status;
    if (!name || !status) continue;
    statuses[String(name)] = String(status).toLowerCase();
  }
  return statuses;
}

function parsePm2Table(out) {
  const statuses = {};
  const re = /│\s+\d+\s+│\s+(\S+)\s+.*?│\s+(online|stopped|errored|launching|stopping|waiting restart)\s+/i;
  for (const line of String(out || '').split('\n')) {
    const m = line.match(re);
    if (m) statuses[m[1]] = m[2].toLowerCase();
  }
  return statuses;
}

// hold: probe failed, leave backoff alone.
// absent: pm2 answered and this app is not in the list. Do not invent a start.
// clear: process is up.
// restart: process is stopped or errored.
function planRestart(statuses, proc) {
  if (!statuses) return 'hold';
  if (!Object.prototype.hasOwnProperty.call(statuses, proc)) return 'absent';
  const status = String(statuses[proc] || '').toLowerCase();
  if (status === 'online' || status === 'launching') return 'clear';
  if (status === 'stopped' || status === 'errored' || status === 'stopping' || status === 'waiting restart') return 'restart';
  return 'hold';
}

// jlist is authoritative. A table that still has the PM2 grid but no parsed
// row is a failed probe: do not treat that as an empty process list.
function probeFromCommands(jlist, table) {
  if (jlist && jlist.ok) {
    const parsed = parsePm2Jlist(jlist.out);
    if (parsed) return { ok: true, statuses: parsed, source: 'jlist' };
  }
  if (!table || !table.ok) {
    return { ok: false, statuses: null, source: 'unavailable', error: 'pm2 list failed' };
  }
  const parsed = parsePm2Table(table.out);
  if (!Object.keys(parsed).length && /│/.test(String(table.out || ''))) {
    return { ok: false, statuses: null, source: 'table-unparsed', error: 'pm2 table did not parse' };
  }
  return { ok: true, statuses: parsed, source: 'table' };
}

async function readPm2Statuses() {
  const listed = await _safeExecPm2(['jlist']);
  const table = listed.ok && parsePm2Jlist(listed.out)
    ? null
    : await _safeExecPm2(['list', '--no-color']);
  return probeFromCommands(listed, table);
}

async function checkAndRestart() {
  const probe = await readPm2Statuses();
  if (!probe.ok) {
    _state.probe = probe.source;
    _state.health = 'unknown';
    _state.unseen = [];
    _state.lastError = probe.error || 'pm2 list failed';
    return 0;
  }
  _state.probe = probe.source;
  const unseen = [];
  let restarted = 0;
  let attention = false;

  for (const proc of CRITICAL_PROCESSES) {
    const plan = planRestart(probe.statuses, proc);
    if (plan === 'clear') {
      _clearBackoff(proc);
      continue;
    }
    attention = true;
    if (plan !== 'restart') {
      if (plan === 'absent') unseen.push(proc);
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

  _state.unseen = unseen;
  _state.health = attention ? 'degraded' : 'good';
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

// Do NOT autostart on require. Orphan backend processes (PPID=1 after a
// botched pm2 restart) kept this timer alive for hours/days and spam
// `pm2 restart unicorn-backend` forever. Arm only when ENABLE_AUTO_RESTART=1
// AND the caller invokes start() from the live PM2-managed process.
if (String(process.env.ENABLE_AUTO_RESTART || '0') === '1') {
  start();
}

module.exports = {
  start,
  stop,
  run,
  getStatus,
  checkAndRestart,
  parsePm2Jlist,
  parsePm2Table,
  planRestart,
  probeFromCommands,
  name: 'auto-restart',
};
