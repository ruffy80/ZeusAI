#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

/**
 * UNICORN MAIN ORCHESTRATOR
 *
 * Controlează TOT fluxul Unicorn:
 *   1. checkRepo()     — verifică branch main, detectează commit-uri noi / conflicte
 *   2. validateCode()  — rulează lint + teste
 *   3. deploy()        — execută deploy.sh pe Hetzner, reîncarcă Nginx, repornește PM2
 *   4. rollback()      — revine la commit-ul anterior, reconstruiește, validează
 *   5. notify()        — trimite rapoarte către shield și agentul de inovare
 *   6. orchestrate()   — buclă continuă de decizie
 */

'use strict';

const { exec }  = require('child_process');
const path      = require('path');
const http      = require('http');
const https     = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT           = path.join(__dirname, '..');
const POLL_MS        = parseInt(process.env.ORCH_POLL_MS        || '120000', 10); // 2 min
const SHIELD_URL     = process.env.ORCH_SHIELD_URL     || 'http://127.0.0.1:3000/api/quantum-integrity/status';
const HEALTH_URL     = process.env.ORCH_HEALTH_URL     || 'http://127.0.0.1:3000/api/health';
const INNOVATION_URL = process.env.ORCH_INNOVATION_URL || 'http://127.0.0.1:3000/api/innovation-loop/status';
const DEPLOY_CMD     = process.env.ORCH_DEPLOY_CMD     || 'bash scripts/deploy-hetzner.js 2>&1 || bash deploy.sh 2>&1';
const ROLLBACK_CMD   = process.env.ORCH_ROLLBACK_CMD   || 'bash scripts/rollback-last-backup.sh';
const LINT_CMD       = process.env.ORCH_LINT_CMD       || 'npm run lint --if-present';
const TEST_CMD       = process.env.ORCH_TEST_CMD       || 'npm test --if-present';
const MAX_LOG        = 300;

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  startedAt:        Date.now(),
  cycles:           0,
  lastCommitSha:    null,
  deployCount:      0,
  rollbackCount:    0,
  consecutiveErrors: 0,
  log:              [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

function log(level, msg, extra) {
  const entry = { ts: ts(), level, msg, ...(extra ? { extra } : {}) };
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.shift();
  const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️ ' : level === 'OK' ? '✅' : 'ℹ️ ';
  if (extra) console.log(`[MainOrch] ${entry.ts} ${prefix} ${msg}`, extra);
  else       console.log(`[MainOrch] ${entry.ts} ${prefix} ${msg}`);
}

function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      resolve({
        ok:     !err,
        code:   err ? err.code : 0,
        stdout: (stdout || '').trim().slice(0, 2000),
        stderr: (stderr || '').trim().slice(0, 1000),
      });
    });
  });
}

function httpGet(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
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

// ─── 1. checkRepo() ───────────────────────────────────────────────────────────
async function checkRepo() {
  log('INFO', 'checkRepo — verifică branch main și commit-uri noi');

  // Fetch latest from origin
  const fetch = await run('git fetch origin main --quiet 2>&1');

  // Get current HEAD sha
  const headRes = await run('git rev-parse HEAD');
  const localSha = headRes.stdout;

  // Get remote sha
  const remoteRes = await run('git rev-parse origin/main');
  const remoteSha = remoteRes.stdout;

  const newCommits = localSha !== remoteSha;

  // Detect conflicts (unmerged paths)
  const conflictRes = await run('git diff --name-only --diff-filter=U 2>&1');
  const hasConflicts = conflictRes.stdout.length > 0;

  // Check for missing critical files
  const criticalFiles = [
    'backend/index.js',
    'src/index.js',
    'package.json',
    'ecosystem.config.js',
  ];
  const missingFiles = criticalFiles.filter(f => {
    const fs = require('fs');
    return !fs.existsSync(path.join(ROOT, f));
  });

  // Recent commits summary
  const logRes = await run('git log --oneline -5 origin/main 2>/dev/null || git log --oneline -5');

  const result = {
    localSha,
    remoteSha,
    newCommits,
    hasConflicts,
    missingFiles,
    recentLog: logRes.stdout,
    fetchOk: fetch.ok,
  };

  if (newCommits) log('INFO', `checkRepo — commit nou detectat: ${remoteSha.slice(0, 8)}`, { localSha: localSha.slice(0, 8), remoteSha: remoteSha.slice(0, 8) });
  if (hasConflicts) log('WARN', 'checkRepo — conflicte detectate!', { files: conflictRes.stdout });
  if (missingFiles.length) log('WARN', 'checkRepo — fișiere lipsă!', { missingFiles });
  if (!newCommits && !hasConflicts && !missingFiles.length) log('OK', 'checkRepo — repo intact, fără schimbări');

  // Track last known commit
  if (!newCommits) state.lastCommitSha = localSha;
  else state.lastCommitSha = remoteSha;

  return result;
}

// ─── 2. validateCode() ────────────────────────────────────────────────────────
async function validateCode() {
  log('INFO', 'validateCode — rulează lint + teste');

  const lintRes = await run(LINT_CMD, { timeout: 60000 });
  const testRes = await run(TEST_CMD, { timeout: 90000 });

  const ok = lintRes.ok && testRes.ok;

  if (!lintRes.ok) log('WARN', 'validateCode — lint a eșuat', { stderr: lintRes.stderr.slice(0, 400) });
  if (!testRes.ok) log('WARN', 'validateCode — teste au eșuat', { stderr: testRes.stderr.slice(0, 400) });
  if (ok) log('OK', 'validateCode — lint + teste OK');

  return { ok, lint: { ok: lintRes.ok, output: lintRes.stdout }, tests: { ok: testRes.ok, output: testRes.stdout } };
}

// ─── 3. deploy() ──────────────────────────────────────────────────────────────
async function deploy() {
  state.deployCount++;
  log('INFO', `deploy #${state.deployCount} — execută deploy pe Hetzner`);

  // Pull latest code first
  const pullRes = await run('git pull origin main --rebase 2>&1 || git pull origin main 2>&1');
  if (!pullRes.ok) {
    log('WARN', 'deploy — git pull a eșuat (continuăm cu codul local)', { err: pullRes.stderr.slice(0, 300) });
  }

  // Run deploy command
  const deployRes = await run(DEPLOY_CMD, { timeout: 300000 });

  if (!deployRes.ok) {
    log('ERROR', 'deploy — deploy.sh a eșuat', { stderr: deployRes.stderr.slice(0, 500) });
    return { ok: false, reason: 'deploy_failed', output: deployRes.stderr };
  }

  // Validate after deploy
  await new Promise(r => setTimeout(r, 5000));
  const health = await httpGet(HEALTH_URL);
  if (!health.ok) {
    log('ERROR', 'deploy — health check a eșuat după deploy; declanșăm rollback');
    return { ok: false, reason: 'post_deploy_health_fail', health };
  }

  log('OK', `deploy #${state.deployCount} — deploy reușit, backend healthy`);
  return { ok: true, deployOutput: deployRes.stdout.slice(0, 500) };
}

// ─── 4. rollback() ────────────────────────────────────────────────────────────
async function rollback(reason = 'manual') {
  state.rollbackCount++;
  log('WARN', `rollback #${state.rollbackCount} — motiv: ${reason}`);

  const rollRes = await run(ROLLBACK_CMD, { timeout: 300000 });

  if (!rollRes.ok) {
    // Fallback: revert one commit and restart PM2
    log('WARN', 'rollback — script de rollback a eșuat, încearcă git revert HEAD~1');
    await run('git revert HEAD~1 --no-edit 2>&1 || git reset --hard HEAD~1 2>&1');
    await run('npm install --production 2>&1');
    await run(`pm2 startOrRestart "${path.join(ROOT, 'ecosystem.config.js')}" --only unicorn,unicorn-orchestrator 2>&1`);
  }

  await new Promise(r => setTimeout(r, 8000));
  const health = await httpGet(HEALTH_URL);
  const stable = health.ok;

  if (stable) log('OK', 'rollback — sistem stabil după rollback');
  else log('ERROR', 'rollback — sistemul NU este stabil nici după rollback!');

  return { ok: stable, rollbackOutput: rollRes.stdout.slice(0, 300) };
}

// ─── 5. notify() ──────────────────────────────────────────────────────────────
async function notify(event, payload = {}) {
  const message = { ts: ts(), event, ...payload };

  // Notify via backend event endpoint (fire-and-forget)
  const targets = [
    `http://127.0.0.1:3000/api/orchestrator/notify`,
    `http://127.0.0.1:3000/api/quantum-integrity/notify`,
  ];

  for (const url of targets) {
    try {
      const body = JSON.stringify(message);
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 3000,
      });
      req.on('error', () => {}); // fire-and-forget
      req.write(body);
      req.end();
    } catch { /* ignore */ }
  }

  log('INFO', `notify — eveniment trimis: ${event}`);
}

// ─── 6. orchestrate() — buclă principală ─────────────────────────────────────
async function orchestrate() {
  state.cycles++;
  log('INFO', `orchestrate — ciclu #${state.cycles}`);

  try {
    // Step 1: Check repo
    const repoStatus = await checkRepo();

    // Step 2: If there are new commits, validate and deploy
    if (repoStatus.newCommits) {
      log('INFO', 'orchestrate — commit nou detectat, validăm codul');
      const validation = await validateCode();

      if (validation.ok) {
        log('INFO', 'orchestrate — validare OK, declanșăm deploy');
        const deployResult = await deploy();

        if (!deployResult.ok) {
          log('ERROR', 'orchestrate — deploy eșuat, declanșăm rollback');
          await notify('deploy_failed', { reason: deployResult.reason });
          const rb = await rollback('deploy_failed');
          await notify('rollback_done', { stable: rb.ok });
        } else {
          await notify('deploy_success', { cycle: state.cycles });
        }
      } else {
        log('WARN', 'orchestrate — validare eșuată, NU facem deploy');
        await notify('validation_failed', { lint: validation.lint.ok, tests: validation.tests.ok });
      }
    }

    // Step 3: Check for conflicts or missing files — repair via shield notification
    if (repoStatus.hasConflicts || repoStatus.missingFiles.length > 0) {
      await notify('repo_issues', {
        conflicts: repoStatus.hasConflicts,
        missingFiles: repoStatus.missingFiles,
      });
    }

    // Step 4: Health ping
    const health = await httpGet(HEALTH_URL);
    if (!health.ok) {
      state.consecutiveErrors++;
      log('ERROR', `orchestrate — backend unhealthy (${state.consecutiveErrors} consecutive)`);
      if (state.consecutiveErrors >= 3) {
        log('ERROR', 'orchestrate — 3 eșecuri consecutive, declanșăm rollback de urgență');
        await rollback('consecutive_health_failure');
        state.consecutiveErrors = 0;
      }
    } else {
      if (state.consecutiveErrors > 0) {
        log('OK', `orchestrate — backend recuperat după ${state.consecutiveErrors} eșec(uri)`);
      }
      state.consecutiveErrors = 0;
    }

    log('OK', `orchestrate — ciclu #${state.cycles} finalizat`);

  } catch (err) {
    log('ERROR', `orchestrate — eroare neașteptată în ciclu #${state.cycles}`, { error: err.message });
    await notify('orchestrator_error', { error: err.message, cycle: state.cycles });
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function main() {
  log('INFO', '🎼 Unicorn Main Orchestrator pornit');

  // Initial cycle after short delay
  setTimeout(() => orchestrate().catch(e => log('ERROR', 'initial orchestrate failed', { error: e.message })), 10000);

  // Recurring orchestration loop
  setInterval(() => orchestrate().catch(e => log('ERROR', 'orchestrate loop error', { error: e.message })), POLL_MS);

  // Keep process alive
  process.on('uncaughtException', err => log('ERROR', 'uncaughtException', { error: err.message }));
  process.on('unhandledRejection', err => log('ERROR', 'unhandledRejection', { error: String(err) }));
}

main();
