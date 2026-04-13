#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-13T19:44:00.000Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * SYSTEM SHIELD — Scut autonom pentru fișiere, procese şi deploy-uri
 *
 * Responsabilități:
 *   1. Monitorizare fișiere critice în timp real (chokidar fs.watch)
 *   2. Monitorizare procese PM2 la fiecare PROCESS_POLL_MS
 *   3. Reparare fișiere corupte/lipsă din git (git checkout -- <file>)
 *   4. Repornire procese căzute via pm2 restart
 *   5. Deploy-lock: blochează deploy-uri incomplete (lock file)
 *   6. HTTP API pe portul SHIELD_PORT (/status, /lock, /unlock, /heal)
 *
 * Env vars:
 *   SHIELD_PORT           — portul HTTP intern (default: 3099)
 *   SHIELD_PROCESS_POLL   — interval poll procese ms (default: 30000)
 *   SHIELD_FILE_RESTORE   — 'true' să restaureze din git (default: true)
 *   SHIELD_REQUIRED_PROCS — procese PM2 obligatorii (csv, default: unicorn,unicorn-orchestrator,unicorn-health-guardian)
 *   SHIELD_CRITICAL_FILES — fișiere critice de monitorizat (csv)
 *   SHIELD_LOCK_FILE      — calea lock-ului de deploy (default: /tmp/unicorn-deploy.lock)
 *   SHIELD_NOTIFY_URL     — URL orchestrator pentru notificări (POST)
 */

'use strict';

const path       = require('path');
const fs         = require('fs');
const { exec, execSync } = require('child_process');
const http       = require('http');

// ─── Config ───────────────────────────────────────────────────────────────────
const ROOT             = path.join(__dirname, '..');                         // UNICORN_FINAL/
const SHIELD_PORT      = parseInt(process.env.SHIELD_PORT || '3099', 10);
const PROCESS_POLL_MS  = Math.max(parseInt(process.env.SHIELD_PROCESS_POLL || '30000', 10), 10000);
const FILE_RESTORE     = String(process.env.SHIELD_FILE_RESTORE || 'true').toLowerCase() !== 'false';
const LOCK_FILE        = process.env.SHIELD_LOCK_FILE || '/tmp/unicorn-deploy.lock';
const NOTIFY_URL       = process.env.SHIELD_NOTIFY_URL || process.env.ORCHESTRATOR_NOTIFY_URL || '';
const MAX_LOG          = 300;
const HEAL_COOLDOWN_MS = parseInt(process.env.SHIELD_HEAL_COOLDOWN_MS || '60000', 10);

const REQUIRED_PROCS = (process.env.SHIELD_REQUIRED_PROCS ||
  'unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog,unicorn-platform-connector')
  .split(',').map((s) => s.trim()).filter(Boolean);

const DEFAULT_CRITICAL_FILES = [
  path.join(ROOT, 'backend/index.js'),
  path.join(ROOT, 'ecosystem.config.js'),
  path.join(ROOT, 'package.json'),
  path.join(ROOT, 'scripts/health-guardian.js'),
  path.join(ROOT, 'scripts/system-shield.js'),
  path.join(ROOT, 'scripts/rollback-last-backup.sh'),
  path.join(ROOT, 'autonomous-orchestrator.js'),
];

const CRITICAL_FILES = process.env.SHIELD_CRITICAL_FILES
  ? process.env.SHIELD_CRITICAL_FILES.split(',').map((f) => f.trim())
  : DEFAULT_CRITICAL_FILES;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  startedAt:       new Date().toISOString(),
  watchedFiles:    [],
  missingFiles:    [],
  restoredFiles:   [],
  missingProcs:    [],
  restarted:       [],
  deployLocked:    false,
  deployLockInfo:  null,
  healCount:       0,
  errors:          0,
  eventLog:        [],
};

const lastHealAt = {};  // procName → timestamp

function log(type, msg, extra) {
  const entry = { ts: new Date().toISOString(), type, msg };
  if (extra !== undefined) entry.extra = typeof extra === 'string' ? extra.slice(0, 300) : extra;
  state.eventLog.push(entry);
  if (state.eventLog.length > MAX_LOG) state.eventLog.shift();
  // Use separate args (not template literal format) to avoid tainted-format-string
  console.log('[SystemShield]', entry.ts, '[' + String(type) + ']', String(msg), extra !== undefined ? extra : '');
}

// ─── Validation helpers ───────────────────────────────────────────────────────

// PM2 process names: alphanumeric, hyphen, underscore, dot only
const SAFE_PROC_NAME_RE = /^[a-zA-Z0-9_.\-]+$/;
function isSafeProcName(name) { return SAFE_PROC_NAME_RE.test(name); }

// Ensure filePath stays within ROOT to prevent path traversal
function isSafeFilePath(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(path.resolve(ROOT) + path.sep) || resolved === path.resolve(ROOT);
}



function lockDeploy(reason = '') {
  const info = { lockedAt: new Date().toISOString(), reason, pid: process.pid };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(info, null, 2), 'utf8');
  state.deployLocked  = true;
  state.deployLockInfo = info;
  log('DEPLOY_LOCK', `Deploy blocat: ${reason}`, info);
}

function unlockDeploy() {
  try { fs.unlinkSync(LOCK_FILE); } catch (e) {
    if (e.code !== 'ENOENT') log('UNLOCK_ERR', e.message);
  }
  state.deployLocked   = false;
  state.deployLockInfo = null;
  log('DEPLOY_UNLOCK', 'Deploy deblocat');
}

function isDeployLocked() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      let info;
      try {
        info = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8') || '{}');
      } catch (parseErr) {
        log('LOCK_PARSE_ERR', parseErr.message);
        info = {};
      }
      state.deployLocked   = true;
      state.deployLockInfo = info;
      // Auto-expire lock după 30 minute
      const age = Date.now() - new Date(info.lockedAt || 0).getTime();
      if (age > 30 * 60 * 1000) {
        log('DEPLOY_LOCK_EXPIRED', 'Lock expirat automat (> 30 min), deblocare');
        unlockDeploy();
        return false;
      }
      return true;
    }
  } catch (e) {
    log('LOCK_CHECK_ERR', e.message);
  }
  state.deployLocked   = false;
  state.deployLockInfo = null;
  return false;
}

// ─── File Watcher ─────────────────────────────────────────────────────────────

function startFileWatcher() {
  let chokidar;
  try { chokidar = require('chokidar'); } catch { chokidar = null; }

  if (!chokidar) {
    log('WATCHER_WARN', 'chokidar nu este disponibil, se foloseste polling');
    _startPollingWatcher();
    return;
  }

  const watcher = chokidar.watch(CRITICAL_FILES, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
  });

  watcher.on('add',    (f) => log('FILE_ADDED',   f));
  watcher.on('unlink', (f) => { log('FILE_DELETED', f); _handleMissingFile(f); });
  watcher.on('change', (f) => log('FILE_CHANGED', f));
  watcher.on('error',  (e) => { state.errors++; log('WATCHER_ERROR', e.message); });

  state.watchedFiles = CRITICAL_FILES.slice();
  log('WATCHER_STARTED', `Monitorizez ${CRITICAL_FILES.length} fișiere critice`);
}

function _startPollingWatcher() {
  // Fallback: verifică existenţa fișierelor la fiecare 60s
  const knownHashes = {};
  for (const f of CRITICAL_FILES) {
    try { knownHashes[f] = fs.statSync(f).mtimeMs; } catch { knownHashes[f] = null; }
  }
  setInterval(() => {
    for (const f of CRITICAL_FILES) {
      try {
        const mtime = fs.statSync(f).mtimeMs;
        if (knownHashes[f] === null) {
          log('FILE_RESTORED_EXT', f);
          knownHashes[f] = mtime;
        } else if (mtime !== knownHashes[f]) {
          log('FILE_CHANGED_POLL', f);
          knownHashes[f] = mtime;
        }
      } catch {
        if (knownHashes[f] !== null) {
          log('FILE_DELETED_POLL', f);
          knownHashes[f] = null;
          _handleMissingFile(f);
        }
      }
    }
  }, 60000);
  state.watchedFiles = CRITICAL_FILES.slice();
}

function _handleMissingFile(filePath) {
  state.missingFiles.push({ file: filePath, at: new Date().toISOString() });
  if (!FILE_RESTORE) {
    log('FILE_MISSING', filePath, 'restaurare dezactivata');
    _notify('file_missing', { file: filePath });
    return;
  }
  _restoreFileFromGit(filePath);
}

function _restoreFileFromGit(filePath) {
  if (!isSafeFilePath(filePath)) {
    log('FILE_RESTORE_BLOCKED', `Path unsafe, skipping restore: ${filePath}`);
    return;
  }
  const relPath = path.relative(ROOT, filePath);
  // Validate relPath contains no shell-special characters
  if (/[;&|`$<>\\]/.test(relPath)) {
    log('FILE_RESTORE_BLOCKED', `Path contains unsafe characters: ${relPath}`);
    return;
  }
  log('FILE_RESTORE', `Restaurare din git: ${relPath}`);
  const { execFile } = require('child_process');
  execFile('git', ['-C', ROOT, 'checkout', '--', relPath], (err) => {
    if (err) {
      log('FILE_RESTORE_ERR', relPath, err.message);
      _notify('file_restore_failed', { file: relPath, error: err.message });
    } else {
      log('FILE_RESTORE_OK', relPath);
      state.restoredFiles.push({ file: filePath, at: new Date().toISOString() });
      _notify('file_restored', { file: relPath });
    }
  });
}

// ─── Process Monitor ─────────────────────────────────────────────────────────

function startProcessMonitor() {
  setInterval(_checkProcesses, PROCESS_POLL_MS);
  setTimeout(_checkProcesses, 5000); // verificare inițială
  log('PROCESS_MONITOR_STARTED', `Poll la fiecare ${PROCESS_POLL_MS}ms, procese: ${REQUIRED_PROCS.join(', ')}`);
}

function _checkProcesses() {
  exec('pm2 jlist', { timeout: 10000 }, (err, stdout) => {
    if (err) {
      log('PM2_UNAVAILABLE', err.message);
      return;
    }
    let list;
    try { list = JSON.parse(stdout || '[]'); } catch { list = []; }

    const online = new Set(
      list
        .filter((p) => p?.pm2_env?.status === 'online')
        .map((p) => String(p.name || '').trim())
    );

    const missing = REQUIRED_PROCS.filter((name) => !online.has(name));
    state.missingProcs = missing;

    if (missing.length === 0) return;

    log('PROCESSES_DOWN', `Procese căzute: ${missing.join(', ')}`);
    for (const procName of missing) _restartProcess(procName);
  });
}

function _restartProcess(procName) {
  if (!isSafeProcName(procName)) {
    log('RESTART_BLOCKED', `Process name contains unsafe characters: ${procName}`);
    return;
  }
  const now = Date.now();
  const last = lastHealAt[procName] || 0;
  if (now - last < HEAL_COOLDOWN_MS) {
    log('HEAL_COOLDOWN', `${procName} — cooldown activ, aştept`);
    return;
  }
  lastHealAt[procName] = now;
  state.healCount++;

  log('RESTART_PROC', `pm2 restart ${procName}`);
  const { execFile } = require('child_process');
  execFile('pm2', ['restart', procName], { timeout: 15000 }, (err, stdout) => {
    if (err) {
      log('RESTART_ERR', procName, err.message);
      _notify('process_restart_failed', { process: procName, error: err.message });
      // Încercare startOrRestart dacă restart a eşuat
      execFile('pm2', ['startOrRestart', 'ecosystem.config.js', '--only', procName], { cwd: ROOT, timeout: 20000 }, (err2) => {
        if (err2) log('START_ERR', procName, err2.message);
        else { log('START_OK', procName); state.restarted.push({ process: procName, at: new Date().toISOString() }); }
      });
    } else {
      log('RESTART_OK', procName);
      state.restarted.push({ process: procName, at: new Date().toISOString(), out: (stdout || '').slice(0, 100) });
      _notify('process_restarted', { process: procName });
    }
  });
}

// ─── Notificare Orchestrator ──────────────────────────────────────────────────

function _notify(event, data) {
  if (!NOTIFY_URL) return;
  const payload = JSON.stringify({ source: 'system-shield', event, data, ts: new Date().toISOString() });
  try {
    const url = new URL(NOTIFY_URL);
    const mod = url.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout:  5000,
    }, (res) => { res.resume(); });
    req.on('error', (e) => { log('NOTIFY_ERR', `${NOTIFY_URL}: ${e.message}`); });
    req.write(payload);
    req.end();
  } catch { /* ignore */ }
}

// ─── HTTP API ─────────────────────────────────────────────────────────────────

function startAPI() {
  const server = http.createServer((req, res) => {
    const { method, url } = req;

    if (url === '/status' || url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ...state,
        eventLog: state.eventLog.slice(-50),
        deployLocked: isDeployLocked(),
      }));
    }

    if (url === '/lock' && method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let reason = '';
        try { reason = JSON.parse(body).reason || ''; } catch { /* noop */ }
        lockDeploy(reason || 'locked via API');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ locked: true, info: state.deployLockInfo }));
      });
      return;
    }

    if (url === '/unlock' && method === 'POST') {
      unlockDeploy();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ locked: false }));
    }

    if (url === '/heal' && method === 'POST') {
      log('MANUAL_HEAL', 'Declanşat via API');
      _checkProcesses();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ triggered: true }));
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.listen(SHIELD_PORT, '127.0.0.1', () => {
    log('API_STARTED', `Shield HTTP API pe 127.0.0.1:${SHIELD_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log('API_WARN', `Port ${SHIELD_PORT} ocupat — API HTTP dezactivat`);
    } else {
      log('API_ERROR', err.message);
    }
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

log('SHIELD_START', `System Shield pornit — PID ${process.pid}`);
log('CONFIG', 'Config', {
  port:         SHIELD_PORT,
  pollMs:       PROCESS_POLL_MS,
  fileRestore:  FILE_RESTORE,
  lockFile:     LOCK_FILE,
  requiredProcs: REQUIRED_PROCS,
  criticalFiles: CRITICAL_FILES.length,
});

isDeployLocked(); // încarcă starea curentă a lock-ului
startFileWatcher();
startProcessMonitor();
startAPI();

// Menţine procesul viu
process.on('uncaughtException', (err) => {
  state.errors++;
  log('UNCAUGHT', err.message, err.stack ? err.stack.slice(0, 300) : '');
});
process.on('unhandledRejection', (reason) => {
  state.errors++;
  log('UNHANDLED_REJECTION', String(reason).slice(0, 200));
});
