#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

/**
 * UNICORN SHIELD — WATCHDOG + INTEGRITATE
 *
 * Protejează Unicorn:
 *   1. watchFiles()        — monitorizează backend/, frontend/ (client/), Nginx config
 *   2. watchProcesses()    — monitorizează PM2 + backend API
 *   3. autoRepair()        — reface fișiere lipsă din repo, repornește servicii
 *   4. emergencyRollback() — declanșează rollback prin orchestrator
 *   5. shieldLoop()        — buclă continuă de veghe
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const http   = require('http');
const { exec } = require('child_process');

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT              = path.join(__dirname, '..');
const SHIELD_INTERVAL   = parseInt(process.env.SHIELD_INTERVAL_MS   || '30000', 10); // 30s
const PROCESS_INTERVAL  = parseInt(process.env.SHIELD_PROC_MS        || '20000', 10); // 20s
const FAIL_THRESHOLD    = parseInt(process.env.SHIELD_FAIL_THRESHOLD || '3',     10);
const HEALTH_URL        = process.env.SHIELD_HEALTH_URL || 'http://127.0.0.1:3000/api/health';
const ORCH_URL          = process.env.SHIELD_ORCH_URL   || 'http://127.0.0.1:3000/api/orchestrator/notify';
const ROLLBACK_CMD      = process.env.SHIELD_ROLLBACK_CMD || 'bash scripts/rollback-last-backup.sh';
const REPAIR_CMD        = process.env.SHIELD_REPAIR_CMD   || 'pm2 startOrRestart ecosystem.config.js --only unicorn,unicorn-orchestrator,unicorn-health-guardian,unicorn-quantum-watchdog';
const MAX_LOG           = 400;

// Critical files that must exist at all times
const CRITICAL_FILES = [
  'backend/index.js',
  'src/index.js',
  'package.json',
  'ecosystem.config.js',
  'backend/modules/central-orchestrator.js',
  'backend/modules/auto-innovation-loop.js',
];

// Critical directories
const CRITICAL_DIRS = [
  'backend',
  'backend/modules',
  'src',
];

// Required PM2 process names
const CRITICAL_PROCESSES = [
  'unicorn',
  'unicorn-orchestrator',
  'unicorn-health-guardian',
  'unicorn-quantum-watchdog',
];

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  startedAt:            Date.now(),
  shieldCycles:         0,
  repairCount:          0,
  rollbackCount:        0,
  consecutiveFailures:  0,
  rollbackArmed:        true,
  anomalies:            [],
  log:                  [],
  // Track file checksums / mtimes
  fileSnapshots:        {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

function log(level, msg, extra) {
  const entry = { ts: ts(), level, msg, ...(extra ? { extra } : {}) };
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.shift();
  const icon = level === 'ERROR' ? '🚨' : level === 'WARN' ? '⚠️ ' : level === 'REPAIR' ? '🔧' : '🛡️ ';
  if (extra) console.log(`[Shield] ${entry.ts} ${icon} ${msg}`, extra);
  else       console.log(`[Shield] ${entry.ts} ${icon} ${msg}`);
}

function addAnomaly(type, detail) {
  const a = { ts: ts(), type, detail };
  state.anomalies.push(a);
  if (state.anomalies.length > 200) state.anomalies.shift();
  log('WARN', `Anomalie detectată: ${type}`, detail);
}

function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      resolve({
        ok:     !err,
        stdout: (stdout || '').trim().slice(0, 2000),
        stderr: (stderr || '').trim().slice(0, 1000),
      });
    });
  });
}

function httpGet(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, body }); }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

// ─── 1. watchFiles() ─────────────────────────────────────────────────────────
function watchFiles() {
  const issues = [];

  // Check critical files exist
  for (const rel of CRITICAL_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      issues.push({ type: 'missing_file', file: rel });
      addAnomaly('missing_file', { file: rel });
      continue;
    }
    // Check for suspicious zero-byte files
    try {
      const stat = fs.statSync(full);
      if (stat.size === 0) {
        issues.push({ type: 'empty_file', file: rel });
        addAnomaly('empty_file', { file: rel, size: stat.size });
      }
    } catch (e) {
      issues.push({ type: 'stat_error', file: rel, error: e.message });
    }
  }

  // Check critical directories exist
  for (const rel of CRITICAL_DIRS) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      issues.push({ type: 'missing_dir', dir: rel });
      addAnomaly('missing_dir', { dir: rel });
    }
  }

  // Check Nginx config if present
  const nginxConf = path.join(ROOT, 'scripts', 'nginx-unicorn.conf');
  if (!fs.existsSync(nginxConf)) {
    // Not critical if not on a server
    log('INFO', 'watchFiles — nginx config nu există local (normal în CI)');
  }

  if (issues.length === 0) {
    log('INFO', `watchFiles — toate fișierele critice (${CRITICAL_FILES.length}) intacte`);
  }

  return issues;
}

// ─── 2. watchProcesses() ─────────────────────────────────────────────────────
async function watchProcesses() {
  const issues = [];

  // Check backend API health
  const health = await httpGet(HEALTH_URL);
  if (!health.ok) {
    issues.push({ type: 'backend_down', url: HEALTH_URL, reason: health.error || health.status });
    addAnomaly('backend_down', { url: HEALTH_URL });
  }

  // Check PM2 process list
  const pm2Res = await run('pm2 jlist 2>/dev/null || echo "[]"');
  let pm2List = [];
  try {
    pm2List = JSON.parse(pm2Res.stdout || '[]');
  } catch {
    // pm2 not available (CI/dev environment)
    log('INFO', 'watchProcesses — pm2 nu e disponibil (mediu CI/dev, OK)');
    return issues;
  }

  const runningNames = pm2List
    .filter(p => p.pm2_env && p.pm2_env.status === 'online')
    .map(p => p.name);

  for (const proc of CRITICAL_PROCESSES) {
    if (!runningNames.includes(proc)) {
      // Only warn if pm2 has any processes at all (server env)
      if (pm2List.length > 0) {
        issues.push({ type: 'process_down', process: proc });
        addAnomaly('process_down', { process: proc, running: runningNames });
      }
    }
  }

  if (issues.length === 0) {
    log('INFO', `watchProcesses — backend OK, procese PM2 active: ${runningNames.join(', ') || 'n/a'}`);
  }

  return issues;
}

// ─── 3. autoRepair() ─────────────────────────────────────────────────────────
async function autoRepair(fileIssues = [], processIssues = []) {
  state.repairCount++;
  log('REPAIR', `autoRepair #${state.repairCount} — încep repararea`);

  // Repair missing/corrupt files from git
  for (const issue of fileIssues) {
    if (issue.type === 'missing_file' || issue.type === 'empty_file') {
      log('REPAIR', `autoRepair — refac fișierul ${issue.file} din repo`);
      const res = await run(`git checkout -- "${issue.file}" 2>&1 || git checkout HEAD -- "${issue.file}" 2>&1`);
      if (res.ok) log('REPAIR', `autoRepair — ${issue.file} refăcut cu succes`);
      else log('ERROR', `autoRepair — nu am putut reface ${issue.file}`, { stderr: res.stderr.slice(0, 200) });
    }
    if (issue.type === 'missing_dir') {
      log('REPAIR', `autoRepair — reconstruiesc directorul ${issue.dir}`);
      await run(`git checkout -- "${issue.dir}/" 2>&1 || true`);
    }
  }

  // Repair PM2 processes
  for (const issue of processIssues) {
    if (issue.type === 'process_down') {
      log('REPAIR', `autoRepair — repornesc procesul PM2: ${issue.process}`);
      const res = await run(`pm2 startOrRestart ecosystem.config.js --only ${issue.process} 2>&1`);
      if (!res.ok) {
        // Try full repair
        log('WARN', `autoRepair — pm2 restart eșuat pentru ${issue.process}, încercăm reparare completă`);
        await run(REPAIR_CMD);
      }
    }
    if (issue.type === 'backend_down') {
      log('REPAIR', 'autoRepair — repornim backend-ul');
      await run(REPAIR_CMD);
      // Give it time to start
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  log('REPAIR', `autoRepair #${state.repairCount} — finalizat`);
}

// ─── 4. emergencyRollback() ───────────────────────────────────────────────────
async function emergencyRollback(reason = 'shield_triggered') {
  state.rollbackCount++;
  state.rollbackArmed = false;

  log('ERROR', `emergencyRollback #${state.rollbackCount} — motiv: ${reason}`);

  // Notify orchestrator first
  try {
    const body = JSON.stringify({ event: 'emergency_rollback', reason, ts: ts() });
    const req = http.request(ORCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 3000,
    });
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch { /* ignore */ }

  // Execute rollback
  const res = await run(ROLLBACK_CMD, { timeout: 300000 });
  if (!res.ok) {
    log('ERROR', 'emergencyRollback — script de rollback a eșuat, încearcă git reset hard');
    await run('git reset --hard HEAD~1 2>&1 || true');
    await run(REPAIR_CMD);
  }

  await new Promise(r => setTimeout(r, 8000));
  const health = await httpGet(HEALTH_URL);
  if (health.ok) {
    log('REPAIR', 'emergencyRollback — sistem stabil după rollback');
    state.consecutiveFailures = 0;
    state.rollbackArmed = true;
  } else {
    log('ERROR', 'emergencyRollback — sistemul NU este stabil nici după rollback!');
  }
}

// ─── 5. shieldLoop() — buclă principală ──────────────────────────────────────
async function shieldLoop() {
  state.shieldCycles++;

  try {
    // Watch files
    const fileIssues = watchFiles();

    // Watch processes
    const processIssues = await watchProcesses();

    const totalIssues = fileIssues.length + processIssues.length;

    if (totalIssues > 0) {
      state.consecutiveFailures++;
      log('WARN', `shieldLoop — ${totalIssues} problemă(e) detectate (consecutiv: ${state.consecutiveFailures})`);

      // Auto-repair
      await autoRepair(fileIssues, processIssues);

      // Emergency rollback if too many consecutive failures
      if (state.consecutiveFailures >= FAIL_THRESHOLD && state.rollbackArmed) {
        log('ERROR', `shieldLoop — ${FAIL_THRESHOLD} eșecuri consecutive, declanșăm rollback de urgență`);
        await emergencyRollback(`${FAIL_THRESHOLD}_consecutive_failures`);
      }
    } else {
      if (state.consecutiveFailures > 0) {
        log('INFO', `shieldLoop — ecosistemul recuperat după ${state.consecutiveFailures} eșec(uri)`);
      }
      state.consecutiveFailures = 0;
      state.rollbackArmed = true;
      if (state.shieldCycles % 10 === 0) {
        log('INFO', `shieldLoop — ciclu #${state.shieldCycles}: ecosistem sănătos ✓`);
      }
    }

  } catch (err) {
    log('ERROR', `shieldLoop — eroare neașteptată în ciclu #${state.shieldCycles}`, { error: err.message });
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
function main() {
  log('INFO', '🛡️  Unicorn Shield pornit');

  // File watching — periodic polling
  setInterval(() => shieldLoop().catch(e => log('ERROR', 'shieldLoop error', { error: e.message })), SHIELD_INTERVAL);

  // Process watching — separate (faster) interval
  setInterval(() => watchProcesses()
    .then(issues => {
      if (issues.length > 0) autoRepair([], issues).catch(() => {});
    })
    .catch(e => log('ERROR', 'process watch error', { error: e.message })),
    PROCESS_INTERVAL
  );

  // Initial check after brief delay
  setTimeout(() => shieldLoop().catch(e => log('ERROR', 'initial shieldLoop error', { error: e.message })), 5000);

  process.on('uncaughtException', err => log('ERROR', 'uncaughtException', { error: err.message }));
  process.on('unhandledRejection', err => log('ERROR', 'unhandledRejection', { error: String(err) }));
}

main();
