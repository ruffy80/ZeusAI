// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ==================== AUTO-REPAIR MODULE ====================
// Detectează și repară automat probleme: procese căzute, fișiere lipsă,
// configurații incorecte, conexiuni eșuate.

const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const REPAIR_INTERVAL_MS = parseInt(process.env.AUTO_REPAIR_INTERVAL_MS || '60000', 10);
const MAX_REPAIRS        = parseInt(process.env.AUTO_REPAIR_MAX           || '100',   10);

const _state = {
  name:           'auto-repair',
  label:          'Auto-Repair Engine',
  startedAt:      null,
  repairCount:    0,
  lastRepair:     null,
  lastError:      null,
  health:         'good',
  repairLog:      [],   // ultimele 50 reparații
  running:        false,
  intervalHandle: null,
};

// ── Criterii de reparație ────────────────────────────────────────────────────
const REQUIRED_DIRS = [
  path.join(__dirname, '..', '..', 'logs'),
  path.join(__dirname, '..', '..', 'scripts'),
];

function _safeExecPm2(args) {
  return new Promise((resolve) => {
    const allowed = ['restart', 'list', 'describe'];
    if (!allowed.includes(args[0])) return resolve({ ok: false, out: 'forbidden' });
    execFile('pm2', args, { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: stdout || stderr || (err && err.message) || '' });
    });
  });
}

function _log(action, detail, success = true) {
  const entry = {
    ts:      new Date().toISOString(),
    action,
    detail,
    success,
  };
  _state.repairLog.unshift(entry);
  if (_state.repairLog.length > 50) _state.repairLog.length = 50;
  _state.lastRepair = entry.ts;
  if (success) _state.repairCount++;
  console.log(`🔧 [auto-repair] ${action}: ${detail}`);
}

// ── Reparație directoare lipsă ───────────────────────────────────────────────
function _repairDirs() {
  let fixed = 0;
  for (const dir of REQUIRED_DIRS) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        _log('mkdir', dir);
        fixed++;
      } catch (e) {
        _log('mkdir-fail', `${dir}: ${e.message}`, false);
        _state.lastError = e.message;
      }
    }
  }
  return fixed;
}

// ── Reparație procese PM2 moarte ────────────────────────────────────────────
async function _repairProcesses() {
  let fixed = 0;
  const CRITICAL_PROCS = (process.env.SHIELD_REQUIRED_PROCS || 'unicorn').split(',').map(p => p.trim()).filter(Boolean);

  const { ok, out } = await _safeExecPm2(['list', '--no-color']);
  if (!ok) return fixed;

  for (const proc of CRITICAL_PROCS) {
    // Caută procesul în output-ul pm2 list
    const stopped = out.includes(proc) && (out.includes('stopped') || out.includes('errored'));
    if (stopped) {
      const res = await _safeExecPm2(['restart', proc]);
      _log('pm2-restart', `${proc}: ${res.ok ? 'OK' : res.out}`, res.ok);
      if (res.ok) fixed++;
    }
  }
  return fixed;
}

// ── Ciclu complet de reparație ───────────────────────────────────────────────
async function runRepairCycle() {
  if (_state.repairCount >= MAX_REPAIRS) return;
  _state.health = 'repairing';

  const dirFixed   = _repairDirs();
  const procFixed  = await _repairProcesses();
  const totalFixed = dirFixed + procFixed;

  _state.health = 'good';
  if (totalFixed > 0) {
    console.log(`✅ [auto-repair] Ciclu complet: ${totalFixed} reparații.`);
  }
  return totalFixed;
}

function start() {
  if (_state.running) return;
  _state.running      = true;
  _state.startedAt    = new Date().toISOString();
  _state.intervalHandle = setInterval(() => {
    runRepairCycle().catch(e => { _state.lastError = e.message; });
  }, REPAIR_INTERVAL_MS);

  // Primul ciclu imediat
  setImmediate(() => runRepairCycle().catch(e => { _state.lastError = e.message; }));
  console.log(`🛠️  [auto-repair] Pornit — interval: ${REPAIR_INTERVAL_MS}ms`);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
}

function getStatus() {
  return {
    ..._state,
    memMB:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptimeSec:  Math.round(process.uptime()),
  };
}

async function run(input = {}) {
  const total = await runRepairCycle();
  return {
    status:    'ok',
    module:    _state.name,
    repairs:   total,
    timestamp: new Date().toISOString(),
    input,
  };
}

start();

module.exports = { start, stop, run, getStatus, runRepairCycle, name: 'auto-repair' };
