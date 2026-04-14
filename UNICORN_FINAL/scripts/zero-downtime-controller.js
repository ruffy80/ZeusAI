#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================
'use strict';

// ==================== ZERO DOWNTIME CONTROLLER ====================
// Coordonează repornirile fără downtime (graceful reload) pentru toate
// procesele PM2 critice. Verifică health ÎNAINTE și DUPĂ fiecare reload.
// Suportă rolling restart, graceful reload și recovery automată.
//
// Pornire standalone: node scripts/zero-downtime-controller.js
// Sau via PM2 entry-ul 'unicorn-zero-downtime' din ecosystem.config.js

const http      = require('http');
const https     = require('https');
const { execFile } = require('child_process');
const EventEmitter = require('events');

const HEALTH_URL        = process.env.ZDT_HEALTH_URL  || 'http://127.0.0.1:3000/api/health';
const CHECK_INTERVAL_MS = parseInt(process.env.ZDT_INTERVAL_MS   || '20000',  10);
const RELOAD_TIMEOUT_MS = parseInt(process.env.ZDT_RELOAD_TIMEOUT || '30000',  10);
const FAIL_THRESHOLD    = parseInt(process.env.ZDT_FAIL_THRESHOLD || '3',      10);
const HEALTH_OK_AFTER   = parseInt(process.env.ZDT_HEALTH_OK_AFTER || '3',     10); // confirmări consecutive

// Procese critice în ordinea priorității (restartate rolling)
const CRITICAL_PROCS = (process.env.ZDT_CRITICAL_PROCS ||
  'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog')
  .split(',').map(s => s.trim()).filter(Boolean);

// Whitelist PM2 comenzi permise
const PM2_ALLOWED_OPS = new Set(['reload', 'restart', 'list', 'describe', 'startOrRestart']);

const _state = {
  name:           'zero-downtime-controller',
  label:          'Zero-Downtime Controller',
  startedAt:      null,
  reloadCount:    0,
  recoveryCount:  0,
  lastReload:     null,
  lastRecovery:   null,
  lastError:      null,
  health:         'good',
  consecutiveFails: 0,
  consecutiveOk:    0,
  inReload:       false,
  running:        false,
  intervalHandle: null,
  log:            [],
};

const emitter = new EventEmitter();

// ── Utilitar log ─────────────────────────────────────────────────────────────
function _log(action, detail, ok = true) {
  const entry = { ts: new Date().toISOString(), action, detail, ok };
  _state.log.unshift(entry);
  if (_state.log.length > 100) _state.log.length = 100;
  _state.lastError = ok ? _state.lastError : detail;
  console.log(`[ZeroDT] ${entry.ts} [${ok ? 'OK' : 'FAIL'}] ${action}: ${detail}`);
  emitter.emit('log', entry);
}

// ── Verificare health backend ─────────────────────────────────────────────────
function _checkHealth() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      resolve({ ok, reason });
    };

    let parsedUrl;
    try { parsedUrl = new URL(HEALTH_URL); } catch {
      return finish(false, 'invalid-health-url');
    }
    const mod = parsedUrl.protocol === 'https:' ? https : http;

    const req = mod.get({
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     parsedUrl.pathname || '/api/health',
      headers:  { 'User-Agent': 'unicorn-zero-downtime/1.0' },
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return finish(false, `status:${res.statusCode}`);
        try {
          const json = JSON.parse(body);
          finish(json.status === 'ok', json.status === 'ok' ? 'health-ok' : `health-not-ok:${body.slice(0,80)}`);
        } catch {
          finish(false, 'invalid-json');
        }
      });
    });
    req.on('error', err => finish(false, err.message));
    req.setTimeout(8000, () => { req.destroy(); finish(false, 'timeout'); });
  });
}

// ── Execuție sigură PM2 ───────────────────────────────────────────────────────
function _pm2(args) {
  return new Promise((resolve) => {
    if (!PM2_ALLOWED_OPS.has(args[0])) {
      return resolve({ ok: false, out: `forbidden-pm2-op: ${args[0]}` });
    }
    execFile('pm2', args, { timeout: RELOAD_TIMEOUT_MS }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || stderr || (err && err.message) || '').slice(0, 500) });
    });
  });
}

// ── Graceful reload unui singur proces ──────────────────────────────────────
async function _gracefulReload(procName) {
  _log('graceful-reload', `starting reload for ${procName}`);

  // 1. Verificăm health-ul ÎNAINTE
  const before = await _checkHealth();
  if (!before.ok) {
    _log('graceful-reload-skip', `${procName}: health not ok before reload — skipping`, false);
    return { ok: false, reason: 'pre-reload-health-fail' };
  }

  // 2. PM2 reload (graceful — fara downtime pentru cluster mode)
  const reloadResult = await _pm2(['reload', procName]);
  if (!reloadResult.ok) {
    _log('graceful-reload-fail', `${procName}: pm2 reload failed: ${reloadResult.out}`, false);
    // Fallback la restart dacă reload eșuează
    _log('graceful-restart-fallback', `${procName}: trying restart as fallback`);
    await _pm2(['restart', procName]);
  }

  // 3. Așteptăm să pornească
  await new Promise(r => setTimeout(r, 3000));

  // 4. Verificăm health-ul DUPĂ
  let tries = 0;
  while (tries < 10) {
    const after = await _checkHealth();
    if (after.ok) {
      _log('graceful-reload-done', `${procName}: reload ok (${tries + 1} tries)`);
      _state.reloadCount++;
      _state.lastReload = new Date().toISOString();
      return { ok: true };
    }
    await new Promise(r => setTimeout(r, 2000));
    tries++;
  }

  _log('graceful-reload-timeout', `${procName}: health not recovered after reload`, false);
  return { ok: false, reason: 'post-reload-health-fail' };
}

// ── Rolling restart pentru toate procesele critice ───────────────────────────
async function rollingRestart() {
  if (_state.inReload) {
    _log('rolling-restart-skip', 'already in reload cycle');
    return { ok: false, reason: 'in-progress' };
  }
  _state.inReload = true;
  _log('rolling-restart', `starting rolling restart for: ${CRITICAL_PROCS.join(', ')}`);
  const results = [];

  for (const proc of CRITICAL_PROCS) {
    const r = await _gracefulReload(proc);
    results.push({ proc, ...r });
    if (!r.ok) {
      _log('rolling-restart-warn', `${proc} reload failed — continuing with next`, false);
    }
    // Pauza între procese pentru a evita gap-uri de disponibilitate
    await new Promise(r => setTimeout(r, 2000));
  }

  _state.inReload = false;
  const allOk = results.every(r => r.ok);
  _log('rolling-restart-done', `completed. ok=${allOk}. ${results.map(r => `${r.proc}:${r.ok}`).join(' ')}`);
  return { ok: allOk, results };
}

// ── Recuperare urgentă ────────────────────────────────────────────────────────
async function emergencyRecovery() {
  _log('emergency-recovery', 'backend down — starting emergency recovery');
  _state.recoveryCount++;
  _state.lastRecovery = new Date().toISOString();

  // Restart toate procesele critice (nu reload)
  const r = await _pm2(['restart', ...CRITICAL_PROCS]);
  _log('emergency-recovery-restart', r.ok ? 'restart ok' : `restart failed: ${r.out}`, r.ok);

  await new Promise(rr => setTimeout(rr, 8000));

  const health = await _checkHealth();
  _log('emergency-recovery-health', health.ok ? 'health restored' : `health still down: ${health.reason}`, health.ok);
  return { ok: health.ok };
}

// ── Loop principal ────────────────────────────────────────────────────────────
async function _tick() {
  const health = await _checkHealth();

  if (health.ok) {
    _state.consecutiveFails = 0;
    _state.consecutiveOk++;
    if (_state.health !== 'good') {
      _state.health = 'good';
      _log('health-restored', `backend healthy again (${_state.consecutiveOk} consecutive ok)`);
    }
  } else {
    _state.consecutiveOk = 0;
    _state.consecutiveFails++;
    _state.health = _state.consecutiveFails >= FAIL_THRESHOLD ? 'critical' : 'degraded';
    _log('health-fail', `${health.reason} (${_state.consecutiveFails}/${FAIL_THRESHOLD})`, false);

    if (_state.consecutiveFails >= FAIL_THRESHOLD && !_state.inReload) {
      await emergencyRecovery();
      _state.consecutiveFails = 0;
    }
  }
}

// ── Pornire / Oprire ──────────────────────────────────────────────────────────
function init() {
  if (_state.running) return;
  _state.running  = true;
  _state.startedAt = new Date().toISOString();
  _log('init', `Zero-Downtime Controller started. interval=${CHECK_INTERVAL_MS}ms, threshold=${FAIL_THRESHOLD}`);

  // Prima verificare imediată
  _tick().catch(e => _log('tick-error', String(e.message), false));

  _state.intervalHandle = setInterval(() => {
    _tick().catch(e => _log('tick-error', String(e.message), false));
  }, CHECK_INTERVAL_MS);
}

function stop() {
  if (_state.intervalHandle) clearInterval(_state.intervalHandle);
  _state.running = false;
  _log('stop', 'Zero-Downtime Controller stopped');
}

function getStatus() {
  return {
    name:             _state.name,
    label:            _state.label,
    running:          _state.running,
    health:           _state.health,
    startedAt:        _state.startedAt,
    reloadCount:      _state.reloadCount,
    recoveryCount:    _state.recoveryCount,
    lastReload:       _state.lastReload,
    lastRecovery:     _state.lastRecovery,
    consecutiveFails: _state.consecutiveFails,
    consecutiveOk:    _state.consecutiveOk,
    inReload:         _state.inReload,
    criticalProcs:    CRITICAL_PROCS,
  };
}

function getLog(limit = 50) {
  return _state.log.slice(0, Math.max(1, Math.min(200, limit)));
}

// ── Export și standalone entry ────────────────────────────────────────────────
module.exports = { init, stop, getStatus, getLog, rollingRestart, emergencyRecovery, emitter };

if (require.main === module) {
  init();
  // Graceful shutdown
  process.on('SIGTERM', () => { stop(); process.exit(0); });
  process.on('SIGINT',  () => { stop(); process.exit(0); });
  // Semnalizăm că suntem gata (PM2 wait_ready)
  if (process.send) process.send('ready');
  _log('standalone', `Running standalone. PID=${process.pid}`);
}
