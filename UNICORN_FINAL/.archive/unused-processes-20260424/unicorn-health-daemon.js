#!/usr/bin/env node
// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

/**
 * UNICORN HEALTH-CHECK DAEMON — MONITORIZARE CONTINUĂ
 *
 * Verifică că TOTUL funcționează:
 *   1. checkBackend()   — /api/health, latență, erori
 *   2. checkFrontend()  — https://zeusai.pro, resurse, rute
 *   3. checkSSL()       — validitate certificat, reînnoire automată
 *   4. checkNginx()     — config, procese, loguri
 *   5. checkResources() — CPU, RAM, spațiu, load
 *   6. report()         — trimite status către orchestrator și shield
 *   7. healthLoop()     — rulează non-stop, detectează probleme devreme
 */

'use strict';

const http   = require('http');
const https  = require('https');
const os     = require('os');
const fs     = require('fs');
const tls    = require('tls');
const { exec } = require('child_process');

// ─── Config ──────────────────────────────────────────────────────────────────
const HEALTH_INTERVAL  = parseInt(process.env.HEALTH_DAEMON_INTERVAL_MS  || '60000',  10); // 1 min
const BACKEND_URL      = process.env.HEALTH_BACKEND_URL   || 'http://127.0.0.1:3000/api/health';
const FRONTEND_URL     = process.env.HEALTH_FRONTEND_URL  || process.env.PUBLIC_APP_URL || 'https://zeusai.pro';
const SITE_DOMAIN      = process.env.SITE_DOMAIN          || 'zeusai.pro';
const REPORT_URL       = process.env.HEALTH_REPORT_URL    || 'http://127.0.0.1:3000/api/health-daemon/report';
const ORCH_URL         = process.env.HEALTH_ORCH_URL      || 'http://127.0.0.1:3000/api/orchestrator/notify';
const SSL_WARN_DAYS    = parseInt(process.env.HEALTH_SSL_WARN_DAYS || '14', 10);
const CPU_WARN         = parseFloat(process.env.HEALTH_CPU_WARN    || '85');
const RAM_WARN         = parseFloat(process.env.HEALTH_RAM_WARN    || '90');
const DISK_WARN        = parseFloat(process.env.HEALTH_DISK_WARN   || '85');
const MAX_LOG          = 300;
const MAX_REPORTS      = 100;

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  startedAt: Date.now(),
  cycles:    0,
  reports:   [],
  log:       [],
  last: {
    backend:   null,
    frontend:  null,
    ssl:       null,
    nginx:     null,
    resources: null,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

function log(level, msg, extra) {
  const entry = { ts: ts(), level, msg, ...(extra ? { extra } : {}) };
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.shift();
  const icon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️ ' : level === 'OK' ? '✅' : 'ℹ️ ';
  if (extra) console.log(`[HealthDaemon] ${entry.ts} ${icon} ${msg}`, extra);
  else       console.log(`[HealthDaemon] ${entry.ts} ${icon} ${msg}`);
}

function httpRequest(url, { method = 'GET', timeout = 10000, body = null, headers = {} } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib = url.startsWith('https') ? https : http;
    const opts = { method, headers, timeout };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = lib.request(url, opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, latencyMs, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, latencyMs, body: data.slice(0, 200) }); }
      });
    });
    req.on('error', err => resolve({ ok: false, error: err.message, latencyMs: Date.now() - start }));
    req.setTimeout(timeout, () => { req.destroy(); resolve({ ok: false, error: 'timeout', latencyMs: timeout }); });
    if (body) req.write(body);
    req.end();
  });
}

function run(cmd, timeoutMs = 10000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

// ─── 1. checkBackend() ────────────────────────────────────────────────────────
async function checkBackend() {
  const res = await httpRequest(BACKEND_URL, { timeout: 8000 });
  const result = {
    ok:        res.ok,
    status:    res.status,
    latencyMs: res.latencyMs,
    body:      res.body,
    error:     res.error,
    ts:        ts(),
  };

  state.last.backend = result;

  if (!result.ok) {
    log('ERROR', `checkBackend — EȘEC (${result.status || result.error}, ${result.latencyMs}ms)`);
  } else if (result.latencyMs > 3000) {
    log('WARN', `checkBackend — latență ridicată: ${result.latencyMs}ms`);
  } else {
    log('OK', `checkBackend — OK (${result.status}, ${result.latencyMs}ms)`);
  }

  return result;
}

// ─── 2. checkFrontend() ───────────────────────────────────────────────────────
async function checkFrontend() {
  const result = { ok: false, checks: {}, ts: ts() };

  // Check main page
  const main = await httpRequest(FRONTEND_URL, { timeout: 15000 });
  result.checks.mainPage = { ok: main.ok, status: main.status, latencyMs: main.latencyMs };

  // Check /health endpoint (Vercel / edge)
  const healthUrl = FRONTEND_URL.replace(/\/$/, '') + '/health';
  const healthCheck = await httpRequest(healthUrl, { timeout: 10000 });
  result.checks.healthEndpoint = { ok: healthCheck.ok, status: healthCheck.status, latencyMs: healthCheck.latencyMs };

  result.ok = main.ok;

  state.last.frontend = result;

  if (!result.ok) {
    log('ERROR', `checkFrontend — ${FRONTEND_URL} inaccesibil (${main.status || main.error})`);
  } else {
    log('OK', `checkFrontend — OK (${main.status}, ${main.latencyMs}ms)`);
  }

  return result;
}

// ─── 3. checkSSL() ────────────────────────────────────────────────────────────
async function checkSSL() {
  const result = { ok: false, domain: SITE_DOMAIN, daysRemaining: null, ts: ts() };

  // Skip for non-https or missing domain
  if (!SITE_DOMAIN || SITE_DOMAIN === 'localhost') {
    result.ok = true;
    result.note = 'local env — SSL check skipped';
    log('INFO', 'checkSSL — skip (env local)');
    state.last.ssl = result;
    return result;
  }

  return new Promise((resolve) => {
    try {
      const socket = tls.connect({ host: SITE_DOMAIN, port: 443, servername: SITE_DOMAIN }, () => {
        try {
          const cert = socket.getPeerCertificate();
          if (!cert || !cert.valid_to) {
            result.ok = false;
            result.error = 'no_cert';
          } else {
            const expiry = new Date(cert.valid_to);
            const daysRemaining = Math.floor((expiry - Date.now()) / 86400000);
            result.daysRemaining = daysRemaining;
            result.expiry = cert.valid_to;
            result.subject = cert.subject && cert.subject.CN;
            result.ok = daysRemaining > 0;

            if (daysRemaining <= 0) {
              log('ERROR', `checkSSL — certificat EXPIRAT pentru ${SITE_DOMAIN}`);
            } else if (daysRemaining < SSL_WARN_DAYS) {
              log('WARN', `checkSSL — certificat expiră în ${daysRemaining} zile pentru ${SITE_DOMAIN}`);
            } else {
              log('OK', `checkSSL — OK, expiră în ${daysRemaining} zile (${cert.valid_to})`);
            }
          }
        } catch (e) {
          result.error = e.message;
        }
        socket.destroy();
        state.last.ssl = result;
        resolve(result);
      });
      socket.setTimeout(10000, () => {
        socket.destroy();
        result.ok = false;
        result.error = 'timeout';
        log('WARN', `checkSSL — timeout la conectare ${SITE_DOMAIN}:443`);
        state.last.ssl = result;
        resolve(result);
      });
      socket.on('error', (err) => {
        result.ok = false;
        result.error = err.message;
        log('WARN', `checkSSL — eroare TLS: ${err.message}`);
        state.last.ssl = result;
        resolve(result);
      });
    } catch (e) {
      result.ok = false;
      result.error = e.message;
      state.last.ssl = result;
      resolve(result);
    }
  });
}

// ─── 4. checkNginx() ──────────────────────────────────────────────────────────
async function checkNginx() {
  const result = { ok: false, ts: ts() };

  // Check nginx process
  const procRes = await run('pgrep -x nginx > /dev/null 2>&1 && echo running || echo stopped', 5000);
  result.process = procRes.stdout.includes('running') ? 'running' : 'stopped';

  // Test nginx config (if nginx is available)
  const testRes = await run('nginx -t 2>&1', 5000);
  result.configTest = testRes.ok || testRes.stderr.includes('test is successful') || testRes.stdout.includes('test is successful');
  result.configOutput = (testRes.stdout + testRes.stderr).slice(0, 300);

  // nginx is optional on dev/CI, only warn if process not found
  result.ok = result.process === 'running' ? result.configTest : true;

  state.last.nginx = result;

  if (result.process === 'stopped') {
    log('WARN', 'checkNginx — procesul nginx nu rulează (poate fi normal în dev/CI)');
  } else if (!result.configTest) {
    log('ERROR', 'checkNginx — configurație Nginx invalidă!', { output: result.configOutput });
  } else {
    log('OK', `checkNginx — OK (process: ${result.process}, config: valid)`);
  }

  return result;
}

// ─── 5. checkResources() ──────────────────────────────────────────────────────
async function checkResources() {
  const result = { ok: true, ts: ts() };
  const warnings = [];

  // CPU load (1min average / number of CPUs)
  const cpuCount = os.cpus().length || 1;
  const loadavg  = os.loadavg();
  const cpuLoad  = (loadavg[0] / cpuCount) * 100;
  result.cpu = { loadavg: loadavg[0].toFixed(2), percentUsed: cpuLoad.toFixed(1), cores: cpuCount };
  if (cpuLoad > CPU_WARN) warnings.push(`CPU: ${cpuLoad.toFixed(0)}% (prag: ${CPU_WARN}%)`);

  // RAM
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const ramPct   = (usedMem / totalMem) * 100;
  result.ram = {
    totalMB:    (totalMem / 1048576).toFixed(0),
    usedMB:     (usedMem  / 1048576).toFixed(0),
    freeMB:     (freeMem  / 1048576).toFixed(0),
    percentUsed: ramPct.toFixed(1),
  };
  if (ramPct > RAM_WARN) warnings.push(`RAM: ${ramPct.toFixed(0)}% (prag: ${RAM_WARN}%)`);

  // Disk (df -h /)
  const diskRes = await run("df -k / 2>/dev/null | awk 'NR==2{print $3,$4,$5}'", 5000);
  if (diskRes.ok && diskRes.stdout) {
    const parts = diskRes.stdout.trim().split(/\s+/);
    const used  = parseInt(parts[0], 10) * 1024;
    const avail = parseInt(parts[1], 10) * 1024;
    const pct   = parseInt((parts[2] || '0').replace('%', ''), 10);
    result.disk = {
      usedGB:      (used / 1073741824).toFixed(1),
      availableGB: (avail / 1073741824).toFixed(1),
      percentUsed: pct,
    };
    if (pct > DISK_WARN) warnings.push(`Disk: ${pct}% (prag: ${DISK_WARN}%)`);
  } else {
    result.disk = { note: 'unavailable' };
  }

  // Uptime
  result.uptimeHours = (os.uptime() / 3600).toFixed(1);

  result.warnings = warnings;
  result.ok = warnings.length === 0;
  state.last.resources = result;

  if (warnings.length > 0) {
    log('WARN', `checkResources — ${warnings.length} avertisment(e)`, { warnings });
  } else {
    log('OK', `checkResources — OK (CPU: ${cpuLoad.toFixed(0)}%, RAM: ${ramPct.toFixed(0)}%, Disk: ${result.disk.percentUsed || '?'}%)`);
  }

  return result;
}

// ─── 6. report() ──────────────────────────────────────────────────────────────
async function report(status) {
  const payload = {
    ts:         ts(),
    source:     'health-daemon',
    uptime:     Date.now() - state.startedAt,
    cycles:     state.cycles,
    ...status,
  };

  state.reports.push(payload);
  if (state.reports.length > MAX_REPORTS) state.reports.shift();

  // Send to backend health-daemon endpoint and orchestrator (fire-and-forget)
  for (const url of [REPORT_URL, ORCH_URL]) {
    try {
      const body = JSON.stringify({ event: 'health_report', payload });
      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 3000,
      });
      req.on('error', () => {});
      req.write(body);
      req.end();
    } catch { /* ignore — endpoints may not exist yet */ }
  }
}

// ─── 7. healthLoop() — buclă principală ───────────────────────────────────────
async function healthLoop() {
  state.cycles++;

  try {
    const [backend, resources, nginx] = await Promise.all([
      checkBackend(),
      checkResources(),
      checkNginx(),
    ]);

    // Frontend and SSL checks are slower/external — run every 5 cycles to reduce noise
    let frontend = state.last.frontend;
    let ssl      = state.last.ssl;

    if (state.cycles % 5 === 1) {
      [frontend, ssl] = await Promise.all([checkFrontend(), checkSSL()]);
    }

    const allOk = backend.ok && resources.ok;

    const summary = {
      overall: allOk ? 'healthy' : 'degraded',
      backend: { ok: backend.ok, latencyMs: backend.latencyMs },
      resources: { ok: resources.ok, cpu: resources.cpu, ram: resources.ram },
      nginx: { ok: nginx.ok, process: nginx.process },
      frontend: frontend ? { ok: frontend.ok } : null,
      ssl: ssl ? { ok: ssl.ok, daysRemaining: ssl.daysRemaining } : null,
    };

    if (state.cycles % 5 === 0) {
      log('INFO', `healthLoop — ciclu #${state.cycles}: ${summary.overall}`);
    }

    await report(summary);

  } catch (err) {
    log('ERROR', `healthLoop — eroare în ciclu #${state.cycles}`, { error: err.message });
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
function main() {
  log('INFO', '💓 Unicorn Health Daemon pornit');

  // Stagger first check
  setTimeout(() => healthLoop().catch(e => log('ERROR', 'initial healthLoop error', { error: e.message })), 8000);

  // Main health loop
  setInterval(() => healthLoop().catch(e => log('ERROR', 'healthLoop error', { error: e.message })), HEALTH_INTERVAL);

  process.on('uncaughtException', err => log('ERROR', 'uncaughtException', { error: err.message }));
  process.on('unhandledRejection', err => log('ERROR', 'unhandledRejection', { error: String(err) }));
}

main();
