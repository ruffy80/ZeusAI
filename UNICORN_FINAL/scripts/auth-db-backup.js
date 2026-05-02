#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.AUTH_GUARDIAN_DB_PATH || process.env.DB_PATH || path.join(APP_ROOT, 'data', 'unicorn.db');
const BACKUP_DIR = process.env.AUTH_GUARDIAN_BACKUP_DIR || path.join(APP_ROOT, 'backups', 'auth-db');
const KEEP = Math.max(1, parseInt(process.env.AUTH_GUARDIAN_BACKUP_KEEP || '24', 10));

function log(msg) {
  const ts = new Date().toISOString();
  process.stdout.write(`[auth-db-backup] ${ts} ${msg}\n`);
}

function openDb(filePath) {
  const Database = require('better-sqlite3');
  return new Database(filePath, { readonly: true, fileMustExist: true });
}

function quickCheck(filePath) {
  let db;
  try {
    db = openDb(filePath);
    const row = db.prepare('PRAGMA quick_check').get();
    return String((row && (row.quick_check || Object.values(row)[0])) || '').toLowerCase() === 'ok';
  } catch (_) {
    return false;
  } finally {
    try { if (db) db.close(); } catch (_) {}
  }
}

function run() {
  if (!fs.existsSync(DB_PATH)) {
    log(`skip: db not found at ${DB_PATH}`);
    return 0;
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dst = path.join(BACKUP_DIR, `unicorn-auth-${stamp}.db`);
  fs.copyFileSync(DB_PATH, dst);

  if (!quickCheck(dst)) {
    fs.rmSync(dst, { force: true });
    throw new Error(`backup integrity failed for ${dst}`);
  }

  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^unicorn-auth-.*\.db$/.test(f))
    .map((f) => path.join(BACKUP_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const old of files.slice(KEEP)) {
    fs.rmSync(old, { force: true });
  }

  log(`ok: ${dst} (kept ${Math.min(files.length, KEEP)}/${KEEP})`);
  return 0;
}

try {
  process.exit(run());
} catch (e) {
  console.error('[auth-db-backup] ERROR:', e && e.message ? e.message : e);
  process.exit(1);
}
