#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const { exec } = require('child_process');

const CHECK_URL          = process.env.HEALTH_GUARDIAN_URL          || 'http://127.0.0.1:3000/api/health';
const SHIELD_URL         = process.env.HEALTH_GUARDIAN_SHIELD_URL   || 'http://127.0.0.1:3000/api/quantum-integrity/status';
// URL extern public (ex. https://zeusai.pro sau https://zeusai.pro/health)
const EXTERNAL_URL       = process.env.HEALTH_GUARDIAN_EXTERNAL_URL || process.env.PUBLIC_APP_URL || process.env.EDGE_HEALTH_URL || '';
// URL orchestrator pentru notificări (POST JSON)
const ORCHESTRATOR_URL   = process.env.HEALTH_GUARDIAN_ORCHESTRATOR_URL || 'http://127.0.0.1:3000/api/orchestrator/check';
const CHECK_INTERVAL_MS  = Math.max(parseInt(process.env.HEALTH_GUARDIAN_INTERVAL_MS   || '60000', 10), 10000);
const EXTERNAL_INTERVAL_MS = Math.max(parseInt(process.env.HEALTH_GUARDIAN_EXTERNAL_MS || '120000', 10), 30000);
const FAIL_THRESHOLD     = Math.max(parseInt(process.env.HEALTH_GUARDIAN_FAIL_THRESHOLD || '3', 10), 1);
const HEAL_CMD           = process.env.HEALTH_GUARDIAN_HEAL_CMD     || 'systemctl restart unicorn';
const ROLLBACK_CMD       = process.env.HEALTH_GUARDIAN_ROLLBACK_CMD || '';

let consecutiveFailures          = 0;
let consecutiveIntegrityFailures = 0;
let consecutiveExternalFailures  = 0;

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra) {
    console.log(`[HealthGuardian] ${ts} ${msg}`, extra);
  } else {
    console.log(`[HealthGuardian] ${ts} ${msg}`);
  }
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(CHECK_URL, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return resolve({ ok: false, reason: `status:${res.statusCode}`, body: body.slice(0, 200) });
        }
        try {
          const json = JSON.parse(body || '{}');
          if (json.status === 'ok') {
            return resolve({ ok: true });
          }
          return resolve({ ok: false, reason: 'health-not-ok', body: body.slice(0, 200) });
        } catch {
          return resolve({ ok: false, reason: 'invalid-json', body: body.slice(0, 200) });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, reason: err.message }));
    req.setTimeout(8000, () => {
      req.destroy(new Error('timeout'));
      resolve({ ok: false, reason: 'timeout' });
    });
  });
}

/** Verifică URL-ul public extern (https://zeusai.pro) */
function checkExternal() {
  if (!EXTERNAL_URL) return Promise.resolve({ ok: true, skipped: true });
  return new Promise((resolve) => {
    let parsedUrl;
    try { parsedUrl = new URL(EXTERNAL_URL); } catch {
      return resolve({ ok: false, reason: 'invalid-url' });
    }
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const checkPath = (parsedUrl.pathname && parsedUrl.pathname !== '/') ? parsedUrl.pathname : '/health';
    const opts = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     checkPath,
      method:   'GET',
      timeout:  12000,
      headers:  { 'User-Agent': 'unicorn-health-guardian/1.0' },
    };
    const req = mod.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          return resolve({ ok: true, status: res.statusCode });
        }
        resolve({ ok: false, reason: `external:status:${res.statusCode}`, body: body.slice(0, 100) });
      });
    });
    req.on('error', (err) => resolve({ ok: false, reason: `external:${err.message}` }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'external:timeout' }); });
    req.end();
  });
}

/** Notifică orchestratorul cu un event */
function notifyOrchestrator(event, details) {
  if (!ORCHESTRATOR_URL) return;
  const payload = JSON.stringify({ source: 'health-guardian', event, details, ts: new Date().toISOString() });
  try {
    const url = new URL(ORCHESTRATOR_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout:  5000,
    }, (res) => { res.resume(); });
    req.on('error', (e) => { log(`orchestrator notify failed: ${ORCHESTRATOR_URL}: ${e.message}`); });
    req.write(payload);
    req.end();
  } catch { /* ignore */ }
}

function heal() {
  return new Promise((resolve) => {
    exec(HEAL_CMD, (err, stdout, stderr) => {
      if (err) {
        log('heal command failed', { error: err.message, stderr: (stderr || '').slice(0, 250) });
        return resolve(false);
      }
      log('heal command executed', { stdout: (stdout || '').slice(0, 250) });
      resolve(true);
    });
  });
}

async function loop() {
  const [result, shield] = await Promise.all([checkHealth(), checkShield()]);
  if (result.ok) {
    if (consecutiveFailures > 0) {
      log(`health restored after ${consecutiveFailures} failure(s)`);
      notifyOrchestrator('health_restored', { url: CHECK_URL });
    }
    consecutiveFailures = 0;
  } else {
    consecutiveFailures += 1;
    log(`health check failed (${consecutiveFailures}/${FAIL_THRESHOLD})`, result.reason || result.body || 'unknown');
    notifyOrchestrator('health_failure', { url: CHECK_URL, reason: result.reason, failures: consecutiveFailures });

    if (consecutiveFailures >= FAIL_THRESHOLD) {
      log('triggering auto-heal...');
      await heal();
      consecutiveFailures = 0;
    }
  }

  if (shield.ok) {
    if (consecutiveIntegrityFailures > 0) {
      log(`integrity restored after ${consecutiveIntegrityFailures} failure(s)`);
    }
    consecutiveIntegrityFailures = 0;
  } else {
    consecutiveIntegrityFailures += 1;
    log(`integrity check failed (${consecutiveIntegrityFailures}/${FAIL_THRESHOLD})`, shield.reason || 'unknown');
    notifyOrchestrator('integrity_failure', { reason: shield.reason, failures: consecutiveIntegrityFailures });
    if (consecutiveIntegrityFailures >= FAIL_THRESHOLD) {
      log('triggering integrity heal...');
      await heal();
      if (ROLLBACK_CMD) {
        await new Promise((resolve) => {
          exec(ROLLBACK_CMD, (err, stdout, stderr) => {
            if (err) {
              log('rollback command failed', { error: err.message, stderr: (stderr || '').slice(0, 250) });
            } else {
              log('rollback command executed', { stdout: (stdout || '').slice(0, 250) });
            }
            resolve();
          });
        });
      }
      consecutiveIntegrityFailures = 0;
    }
  }
}

async function externalLoop() {
  const result = await checkExternal();
  if (result.skipped) return;

  if (result.ok) {
    if (consecutiveExternalFailures > 0) {
      log(`external health restored after ${consecutiveExternalFailures} failure(s)`, { url: EXTERNAL_URL });
      notifyOrchestrator('external_restored', { url: EXTERNAL_URL });
    }
    consecutiveExternalFailures = 0;
    return;
  }

  consecutiveExternalFailures += 1;
  log(`external health check failed (${consecutiveExternalFailures}/${FAIL_THRESHOLD})`, { url: EXTERNAL_URL, reason: result.reason });
  notifyOrchestrator('external_failure', { url: EXTERNAL_URL, reason: result.reason, failures: consecutiveExternalFailures });

  if (consecutiveExternalFailures >= FAIL_THRESHOLD) {
    log('external down threshold reached — triggering heal', { url: EXTERNAL_URL });
    await heal();
    consecutiveExternalFailures = 0;
  }
}

const externalInfo = EXTERNAL_URL ? `, external=${EXTERNAL_URL}` : ' (no external URL configured)';
log(`started. interval=${CHECK_INTERVAL_MS}ms, threshold=${FAIL_THRESHOLD}, url=${CHECK_URL}, shield=${SHIELD_URL}${externalInfo}`);
setInterval(loop, CHECK_INTERVAL_MS);
loop();

if (EXTERNAL_URL) {
  setInterval(externalLoop, EXTERNAL_INTERVAL_MS);
  setTimeout(externalLoop, 10000); // primă verificare externă după 10s
}
