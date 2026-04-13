#!/usr/bin/env node
'use strict';

const http = require('http');
const { exec } = require('child_process');

const CHECK_URL = process.env.HEALTH_GUARDIAN_URL || 'http://127.0.0.1:3000/api/health';
const SHIELD_URL = process.env.HEALTH_GUARDIAN_SHIELD_URL || 'http://127.0.0.1:3000/api/quantum-integrity/status';
const CHECK_INTERVAL_MS = Math.max(parseInt(process.env.HEALTH_GUARDIAN_INTERVAL_MS || '60000', 10), 10000);
const FAIL_THRESHOLD = Math.max(parseInt(process.env.HEALTH_GUARDIAN_FAIL_THRESHOLD || '3', 10), 1);
const HEAL_CMD = process.env.HEALTH_GUARDIAN_HEAL_CMD || 'systemctl restart unicorn';
const ROLLBACK_CMD = process.env.HEALTH_GUARDIAN_ROLLBACK_CMD || '';

let consecutiveFailures = 0;
let consecutiveIntegrityFailures = 0;

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

function checkShield() {
  return new Promise((resolve) => {
    const req = http.get(SHIELD_URL, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return resolve({ ok: false, reason: `status:${res.statusCode}` });
        }
        try {
          const json = JSON.parse(body || '{}');
          const integrity = String(json.integrity || '').toLowerCase();
          const ok = integrity === 'intact' || integrity === 'pending';
          resolve({ ok, reason: ok ? 'ok' : integrity || 'unknown' });
        } catch {
          resolve({ ok: false, reason: 'invalid-json' });
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
    }
    consecutiveFailures = 0;
    return;
  }

  consecutiveFailures += 1;
  log(`health check failed (${consecutiveFailures}/${FAIL_THRESHOLD})`, result.reason || result.body || 'unknown');

  if (consecutiveFailures >= FAIL_THRESHOLD) {
    log('triggering auto-heal...');
    await heal();
    consecutiveFailures = 0;
  }

  if (shield.ok) {
    if (consecutiveIntegrityFailures > 0) {
      log(`integrity restored after ${consecutiveIntegrityFailures} failure(s)`);
    }
    consecutiveIntegrityFailures = 0;
    return;
  }

  consecutiveIntegrityFailures += 1;
  log(`integrity check failed (${consecutiveIntegrityFailures}/${FAIL_THRESHOLD})`, shield.reason || 'unknown');
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

log(`started. interval=${CHECK_INTERVAL_MS}ms, threshold=${FAIL_THRESHOLD}, url=${CHECK_URL}, shield=${SHIELD_URL}`);
setInterval(loop, CHECK_INTERVAL_MS);
loop();
