#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(process.env.LIVE_SYNC_ROOT || path.join(__dirname, '..'));
const LOG_DIR = path.join(ROOT, 'logs');
const STATE_FILE = path.join(LOG_DIR, 'live-sync-forward.state.json');
const LOCK_FILE = path.join(LOG_DIR, 'live-sync-forward.lock');
const WATCH_INTERVAL_MS = Math.max(3000, parseInt(process.env.LIVE_SYNC_INTERVAL_MS || '10000', 10));
const QUIET_MS = Math.max(1000, parseInt(process.env.LIVE_SYNC_QUIET_MS || '2500', 10));
const INSTALL_ON_MANIFEST = process.env.LIVE_SYNC_INSTALL_ON_MANIFEST !== '0';
const ENABLED = process.env.LIVE_SYNC_ENABLED !== '0';
const PM2_CMD = process.env.LIVE_SYNC_PM2_CMD || 'pm2';
const PM2_ARGS = (process.env.LIVE_SYNC_PM2_ARGS || 'startOrRestart ecosystem.config.js --update-env')
  .split(/\s+/)
  .filter(Boolean);
const PRECHECK_CMD = process.env.LIVE_SYNC_PRECHECK_CMD || process.execPath;
const PRECHECK_ARGS = (process.env.LIVE_SYNC_PRECHECK_ARGS || 'scripts/preflight-forward-only.js')
  .split(/\s+/)
  .filter(Boolean);

const WATCH_TARGETS = [
  'backend',
  'src',
  'scripts',
  'templates',
  'templates_saas_2026',
  'ecosystem.config.js',
  'package.json',
  'package-lock.json',
];

const IGNORE_PREFIXES = [
  '.git',
  'logs',
  'data',
  'snapshots',
  '.archive',
  'client/build',
  'client/build_mirror',
  '.build-sha',
];

const FORWARD_ONLY_BANNED_PATTERNS = [
  /(^|\/)rollback(\/|\.|-)/i,
  /(^|\/)revert(\/|\.|-)/i,
  /(^|\/)downgrade(\/|\.|-)/i,
  /(^|\/)restore(\/|\.|-)/i,
  /(^|\/)backup(\/|\.|-)/i,
  /(^|\/)snapshot(\/|\.|-)/i,
];

const state = {
  startedAt: new Date().toISOString(),
  lastScanAt: null,
  lastSyncAt: null,
  lastBuildSha: null,
  pending: [],
  pendingSince: 0,
  inFlight: false,
  lastError: null,
};

function log(message, extra = {}) {
  const entry = { ts: new Date().toISOString(), msg: message, ...extra };
  console.log(JSON.stringify(entry));
}

function ensureDir(dirPath) {
  try { fs.mkdirSync(dirPath, { recursive: true }); } catch (_) {}
}

function writeState() {
  try {
    ensureDir(LOG_DIR);
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (loaded && typeof loaded === 'object') {
      state.lastSyncAt = loaded.lastSyncAt || null;
      state.lastBuildSha = loaded.lastBuildSha || null;
    }
  } catch (_) {}
}

function acquireLock() {
  try {
    ensureDir(LOG_DIR);
    if (fs.existsSync(LOCK_FILE)) {
      const pid = Number(String(fs.readFileSync(LOCK_FILE, 'utf8')).split('\n')[0] || 0);
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          log('live-sync-already-running', { pid });
          process.exit(0);
        } catch (_) {}
      }
    }
    fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}\n`, { mode: 0o600 });
  } catch (error) {
    log('live-sync-lock-failed', { error: String(error.message || error) });
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

function isIgnored(relPath) {
  const normalized = relPath.split(path.sep).join('/');
  return IGNORE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'));
}

function walk(target, out = []) {
  const fullPath = path.join(ROOT, target);
  if (!fs.existsSync(fullPath)) return out;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    const rel = path.relative(ROOT, fullPath);
    if (!isIgnored(rel)) out.push({ rel, fullPath, mtimeMs: stat.mtimeMs, size: stat.size });
    return out;
  }
  if (!stat.isDirectory()) return out;
  for (const entry of fs.readdirSync(fullPath, { withFileTypes: true })) {
    const next = path.join(fullPath, entry.name);
    const rel = path.relative(ROOT, next);
    if (isIgnored(rel)) continue;
    if (entry.isDirectory()) walk(rel, out);
    else if (entry.isFile()) {
      const fileStat = fs.statSync(next);
      out.push({ rel, fullPath: next, mtimeMs: fileStat.mtimeMs, size: fileStat.size });
    }
  }
  return out;
}

function snapshot() {
  const files = new Map();
  for (const target of WATCH_TARGETS) {
    for (const entry of walk(target)) {
      files.set(entry.rel, `${Math.trunc(entry.mtimeMs)}:${entry.size}`);
    }
  }
  return files;
}

function diffSnapshots(previous, current) {
  const changed = [];
  const keys = new Set([...previous.keys(), ...current.keys()]);
  for (const key of keys) {
    if (previous.get(key) !== current.get(key)) changed.push(key);
  }
  return changed;
}

function isForwardOnlySafe(changedFiles) {
  const unsafe = changedFiles.filter((file) => FORWARD_ONLY_BANNED_PATTERNS.some((pattern) => pattern.test(file)));
  if (unsafe.length) {
    return { ok: false, reason: 'rollback-path-detected', files: unsafe };
  }
  return { ok: true };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd: ROOT,
      env: process.env,
      timeout: options.timeout || 600000,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error && typeof error.code === 'number' ? error.code : 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        error: error ? String(error.message || error) : null,
      });
    });
  });
}

function gitShortSha() {
  try {
    const result = require('child_process').execSync(`git -C ${JSON.stringify(ROOT)} rev-parse --short=12 HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] });
    return String(result).trim();
  } catch (_) {
    return `live-${Date.now().toString(36)}`;
  }
}

function stampBuildSha() {
  const sha = gitShortSha();
  try {
    fs.writeFileSync(path.join(ROOT, '.build-sha'), `${sha}\n`, { mode: 0o644 });
  } catch (error) {
    log('live-sync-build-sha-write-failed', { error: String(error.message || error), sha });
  }
  state.lastBuildSha = sha;
  return sha;
}

async function validateJavaScript(files) {
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    if (file.startsWith('client/build') || file.startsWith('client/build_mirror')) continue;
    const result = await run(process.execPath, ['--check', path.join(ROOT, file)], { timeout: 30000 });
    if (!result.ok) {
      return { ok: false, file, error: (result.stderr || result.error || '').trim() };
    }
  }
  return { ok: true };
}

async function runPreflight() {
  const result = await run(PRECHECK_CMD, PRECHECK_ARGS, { timeout: 900000 });
  if (!result.ok) {
    return { ok: false, error: (result.stderr || result.stdout || result.error || '').trim() };
  }
  return { ok: true };
}

async function refresh() {
  if (state.inFlight) return;
  state.inFlight = true;
  try {
    const changedFiles = state.pending.slice();
    if (!changedFiles.length) return;

    log('live-sync-refresh-start', { changedFiles });

    const safety = isForwardOnlySafe(changedFiles);
    if (!safety.ok) {
      state.lastError = safety.reason;
      log('live-sync-refresh-skip', { reason: safety.reason, files: safety.files });
      return;
    }

    const jsValidation = await validateJavaScript(changedFiles);
    if (!jsValidation.ok) {
      state.lastError = `syntax:${jsValidation.file}`;
      log('live-sync-refresh-skip', { reason: 'syntax-check-failed', ...jsValidation });
      return;
    }

    const preflight = await runPreflight();
    if (!preflight.ok) {
      state.lastError = 'forward-only-preflight-failed';
      log('live-sync-refresh-skip', { reason: 'forward-only-preflight-failed', error: preflight.error.slice(0, 1000) });
      return;
    }

    if (INSTALL_ON_MANIFEST && changedFiles.some((file) => file === 'package.json' || file === 'package-lock.json')) {
      const installResult = await run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], { timeout: 900000 });
      if (!installResult.ok) {
        state.lastError = installResult.error || 'npm-install-failed';
        log('live-sync-install-failed', { stderr: installResult.stderr.slice(0, 500) });
        return;
      }
    }

    const sha = stampBuildSha();
    const pm2Result = await run(PM2_CMD, PM2_ARGS, { timeout: 900000 });
    if (!pm2Result.ok) {
      state.lastError = pm2Result.error || 'pm2-reload-failed';
      log('live-sync-pm2-failed', { stderr: pm2Result.stderr.slice(0, 500) });
      return;
    }

    state.lastSyncAt = new Date().toISOString();
    state.lastError = null;
    state.pending = [];
    state.pendingSince = 0;
    writeState();
    log('live-sync-refresh-done', { buildSha: sha, pm2: PM2_ARGS.join(' ') });
  } finally {
    state.inFlight = false;
  }
}

let previous = snapshot();
readState();
acquireLock();
ensureDir(LOG_DIR);
writeState();
log('live-sync-online', { root: ROOT, intervalMs: WATCH_INTERVAL_MS, quietMs: QUIET_MS, pm2: PM2_ARGS.join(' ') });

const timer = setInterval(async () => {
  try {
    const current = snapshot();
    const changed = diffSnapshots(previous, current);
    previous = current;
    state.lastScanAt = new Date().toISOString();

    if (changed.length) {
      state.pending = Array.from(new Set([...state.pending, ...changed]));
      state.pendingSince = state.pendingSince || Date.now();
      log('live-sync-changes-detected', { changed });
      writeState();
    }

    if (state.pending.length && state.pendingSince && (Date.now() - state.pendingSince) >= QUIET_MS) {
      await refresh();
      writeState();
    }
  } catch (error) {
    state.lastError = String(error.message || error);
    log('live-sync-tick-failed', { error: state.lastError });
    writeState();
  }
}, WATCH_INTERVAL_MS);

function shutdown(signal) {
  clearInterval(timer);
  writeState();
  releaseLock();
  log('live-sync-stop', { signal });
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (!ENABLED) {
  log('live-sync-disabled', { reason: 'LIVE_SYNC_ENABLED=0' });
  shutdown('disabled');
}
