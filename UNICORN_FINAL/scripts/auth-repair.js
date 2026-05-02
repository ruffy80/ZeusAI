#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.AUTH_GUARDIAN_DB_PATH || process.env.DB_PATH || path.join(APP_ROOT, 'data', 'unicorn.db');
const BACKUP_DIR = process.env.AUTH_GUARDIAN_BACKUP_DIR || path.join(APP_ROOT, 'backups', 'auth-db');
const LOG_PATH = process.env.AUTH_GUARDIAN_LOG_PATH || path.join(APP_ROOT, 'logs', 'auth-guardian.log');

function appendLog(payload) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...payload }) + '\n');
  } catch (_) {}
}

function quickCheck(filePath) {
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(filePath, { readonly: true, fileMustExist: true });
    const row = db.prepare('PRAGMA quick_check').get();
    const v = String((row && (row.quick_check || Object.values(row)[0])) || '').toLowerCase();
    return v === 'ok';
  } catch (_) {
    return false;
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

function latestValidBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^unicorn-auth-.*\.db$/.test(f))
    .map((f) => path.join(BACKUP_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const f of files) {
    if (quickCheck(f)) return f;
  }
  return null;
}

function restoreFromBackup() {
  const src = latestValidBackup();
  if (!src) return { ok: false, reason: 'no_valid_backup' };
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const pre = `${DB_PATH}.pre-restore-${Date.now()}`;
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, pre);
  fs.copyFileSync(src, DB_PATH);
  return { ok: quickCheck(DB_PATH), src, pre };
}

function checkSecrets() {
  const jwt = String(process.env.JWT_SECRET || '').trim();
  const session = String(process.env.SESSION_SECRET || '').trim();
  return {
    jwtOk: !!jwt && jwt !== 'unicorn-jwt-secret-change-in-prod',
    sessionOk: !!session,
  };
}

function restartBackend() {
  try {
    execFileSync('docker-compose', ['restart', 'backend'], { cwd: '/opt/unicorn', stdio: 'ignore' });
    return { ok: true, mode: 'docker-compose backend' };
  } catch (_) {}
  try {
    execFileSync('pm2', ['restart', 'unicorn-backend', '--update-env'], { cwd: '/var/www/unicorn/UNICORN_FINAL', stdio: 'ignore' });
    execFileSync('pm2', ['save', '--force'], { stdio: 'ignore' });
    return { ok: true, mode: 'pm2 unicorn-backend' };
  } catch (e) {
    return { ok: false, mode: 'none', error: e && e.message ? e.message : String(e) };
  }
}

function run() {
  const out = {
    dbPath: DB_PATH,
    dbExists: fs.existsSync(DB_PATH),
    dbIntegrityOk: fs.existsSync(DB_PATH) ? quickCheck(DB_PATH) : false,
    secrets: checkSecrets(),
    restore: null,
    restart: null,
    ok: false,
  };

  if (out.dbExists && !out.dbIntegrityOk) {
    out.restore = restoreFromBackup();
    out.dbIntegrityOk = fs.existsSync(DB_PATH) ? quickCheck(DB_PATH) : false;
  }

  out.restart = restartBackend();
  out.ok = out.dbIntegrityOk && out.secrets.jwtOk && out.restart.ok;

  appendLog({ event: 'auth-repair', result: out });
  process.stdout.write(JSON.stringify(out));
  return out.ok ? 0 : 1;
}

process.exit(run());
