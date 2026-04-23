#!/usr/bin/env node
'use strict';

const http = require('http');
const { exec } = require('child_process');

const STATUS_URL = process.env.QIS_WATCHDOG_URL || 'http://127.0.0.1:3000/api/quantum-integrity/status';
const INTERVAL_MS = Math.max(parseInt(process.env.QIS_WATCHDOG_INTERVAL_MS || '45000', 10), 10000);
const FAIL_THRESHOLD = Math.max(parseInt(process.env.QIS_WATCHDOG_FAIL_THRESHOLD || '2', 10), 1);
const REPAIR_CMD = process.env.QIS_WATCHDOG_REPAIR_CMD || 'pm2 restart unicorn unicorn-orchestrator unicorn-health-guardian';
const ROLLBACK_CMD = process.env.QIS_WATCHDOG_ROLLBACK_CMD || 'bash scripts/rollback-last-backup.sh';

let failures = 0;
let rollbackArmed = true;

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra) console.log(`[QIS-Watchdog] ${ts} ${msg}`, extra);
  else console.log(`[QIS-Watchdog] ${ts} ${msg}`);
}

function getStatus() {
  return new Promise((resolve) => {
    const req = http.get(STATUS_URL, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve({ ok: false, reason: `http:${res.statusCode}` });
        try {
          const json = JSON.parse(body || '{}');
          const integrity = String(json.integrity || '').toLowerCase();
          resolve({ ok: integrity === 'intact' || integrity === 'pending', integrity, body: json });
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

function run(cmd, label) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        log(`${label} failed`, { error: err.message, stderr: (stderr || '').slice(0, 250) });
        return resolve(false);
      }
      log(`${label} ok`, { stdout: (stdout || '').slice(0, 250) });
      resolve(true);
    });
  });
}

async function tick() {
  const status = await getStatus();
  if (status.ok) {
    if (failures > 0) log(`integrity restored after ${failures} failure(s)`);
    failures = 0;
    rollbackArmed = true;
    return;
  }

  failures += 1;
  log(`integrity degraded (${failures}/${FAIL_THRESHOLD})`, status.reason || status.integrity || 'unknown');

  if (failures < FAIL_THRESHOLD) return;

  await run(REPAIR_CMD, 'repair command');

  const postRepair = await getStatus();
  if (!postRepair.ok && rollbackArmed && ROLLBACK_CMD) {
    await run(ROLLBACK_CMD, 'rollback command');
    rollbackArmed = false;
  }
  failures = 0;
}

log(`started: url=${STATUS_URL} interval=${INTERVAL_MS}ms threshold=${FAIL_THRESHOLD}`);
setInterval(tick, INTERVAL_MS);
tick();
