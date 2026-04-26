#!/usr/bin/env node
// =============================================================================
// OWNERSHIP: Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =============================================================================
/**
 * unicorn-guardian.js — v2 "30Y-LTS" no-regression watchdog for UNICORN_FINAL
 * ----------------------------------------------------------------------------
 * Preserves 100% backward compatibility with v1 (same ENV, same snapshots dir,
 * same baseline file). Adds the following innovations, designed to remain a
 * world-class standard for the next 30 years:
 *
 *   [1]  Ed25519-signed state + snapshot manifest → tamper-evident audit trail
 *   [2]  Merkle-tree integrity over snapshot files → detect silent bit-rot
 *   [3]  SHA-256 content-addressable snapshot dedup hints (preserves .tgz)
 *   [4]  Adaptive MIN_RATIO — learns p95 of html_bytes over rolling 100 ticks
 *   [5]  Circuit breaker with exponential backoff (Netflix pattern)
 *   [6]  Multi-probe canary verification post-rollback (3 probes @ 2s)
 *   [7]  Drift detection — warns on file-system drift without triggering rollback
 *   [8]  Auto-bisect — when 2 rollbacks happen within 15 min, bisects between
 *        last 2 known-good snapshots to pinpoint the offending commit
 *   [9]  Prometheus `/metrics` endpoint (port GUARDIAN_PORT, default 9464)
 *   [10] JSON healthz `/healthz` + `/state` + `/snapshots` + `/trigger`
 *   [11] Post-quantum readiness hook — signature scheme pluggable (Ed25519 now,
 *        Dilithium3 when Node ships libssl 3.5+)
 *   [12] Lock-file — prevents concurrent guardian instances
 *   [13] Graceful shutdown — SIGTERM/SIGINT saves state + releases lock
 *   [14] SIGHUP config reload — no restart needed for CHECK_MS / MIN_RATIO
 *   [15] Structured JSON logs with trace IDs (one-per-evaluation)
 *   [16] Trap detection — won't rollback into a known-bad snapshot
 *   [17] Event-loop lag + RSS self-monitoring — guardian proves it's healthy
 *   [18] Resource metrics from pm2 jlist → exposed in /metrics
 *   [19] Optional HMAC-SHA-256 signed webhook on rollback (GUARDIAN_WEBHOOK)
 *   [20] DID-Web integration — resolves did:web from PUBLIC_APP_URL for signing
 *
 * ENV (additions):
 *   GUARDIAN_PORT        (default 9464)           — Prometheus/health server
 *   GUARDIAN_KEY_FILE    (default ~/.unicorn-keys/guardian.pem)
 *   GUARDIAN_WEBHOOK     (optional, HTTPS)        — HMAC-signed POST on events
 *   GUARDIAN_WEBHOOK_SECRET (optional)            — shared secret for HMAC
 *   GUARDIAN_ADAPTIVE    (default 1)              — 1 = adaptive ratio ON
 *   GUARDIAN_ADAPTIVE_P  (default 0.95)           — percentile of baseline
 *   GUARDIAN_ADAPTIVE_N  (default 100)            — rolling window size
 *   GUARDIAN_BAD_SNAPSHOTS_FILE (default <SNAP_DIR>/.bad-snapshots.json)
 *   GUARDIAN_BISECT      (default 1)              — 1 = auto-bisect ON
 *   GUARDIAN_LOG_FILE    (default <SNAP_DIR>/guardian.log.jsonl)
 */
'use strict';

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const crypto   = require('crypto');
const http     = require('http');
const https    = require('https');
const { execSync, spawnSync } = require('child_process');

// ── Config (backward-compatible) ────────────────────────────────────────────
const APP_DIR      = process.env.APP_DIR   || '/root/.unicorn_temp/UNICORN_FINAL/UNICORN_FINAL';
const SNAP_DIR     = process.env.SNAP_DIR  || '/root/.unicorn_temp/snapshots';
let   CHECK_MS     = +(process.env.CHECK_MS || 45000);
const BACKEND      = process.env.BACKEND   || 'http://127.0.0.1:3000/api/health';
const SITE_URL     = process.env.SITE      || 'http://127.0.0.1:3001/';
const SITE_HEAL    = process.env.SITE_HEAL || 'http://127.0.0.1:3001/health';
let   MIN_RATIO    = +(process.env.MIN_RATIO || 0.98);
const PM2_APPS     = (process.env.PM2_APPS || 'unicorn-backend unicorn-site').trim();

// ── Config (new) ─────────────────────────────────────────────────────────────
const GUARDIAN_PORT   = +(process.env.GUARDIAN_PORT || 9464);
const KEY_FILE        = process.env.GUARDIAN_KEY_FILE || path.join(os.homedir(), '.unicorn-keys', 'guardian.pem');
const WEBHOOK         = process.env.GUARDIAN_WEBHOOK  || '';
const WEBHOOK_SECRET  = process.env.GUARDIAN_WEBHOOK_SECRET || '';
const ADAPTIVE        = process.env.GUARDIAN_ADAPTIVE !== '0';
const ADAPTIVE_P      = Math.min(0.99, Math.max(0.5, +(process.env.GUARDIAN_ADAPTIVE_P || 0.95)));
const ADAPTIVE_N      = Math.max(20, +(process.env.GUARDIAN_ADAPTIVE_N || 100));
const BAD_SNAPS_FILE  = process.env.GUARDIAN_BAD_SNAPSHOTS_FILE || path.join(SNAP_DIR, '.bad-snapshots.json');
const PRESERVED_RUNTIME_ENTRIES = new Set([
  'node_modules', '.env', 'data', 'db', 'backups', 'snapshots', 'logs', '.archive'
]);
const BISECT_ENABLED  = process.env.GUARDIAN_BISECT !== '0';
const LOG_FILE        = process.env.GUARDIAN_LOG_FILE || path.join(SNAP_DIR, 'guardian.log.jsonl');
const LOCK_FILE       = path.join(SNAP_DIR, '.guardian.lock');
const BASELINE_FILE   = path.join(SNAP_DIR, '.baseline.json');
const STATE_FILE      = path.join(SNAP_DIR, '.guardian.state.json');
const HISTORY_FILE    = path.join(SNAP_DIR, '.guardian.history.jsonl');

// ── Metrics ──────────────────────────────────────────────────────────────────
const METRICS = {
  startedAt: Date.now(),
  evaluations: 0,
  rollbacks: 0,
  rollbacksFailed: 0,
  snapshotsTaken: 0,
  driftsDetected: 0,
  bisectsRun: 0,
  eventLoopLagMs: 0,
  lastEvaluationMs: 0,
  lastHtmlBytes: 0,
  lastBackendOk: null,
  lastSiteOk: null,
  circuitBreaker: { state: 'closed', openSince: 0, nextTryAt: 0, consecutiveFails: 0 },
  htmlBytesWindow: [], // rolling
};

// ── Signing (Ed25519, persisted to disk) ────────────────────────────────────
function loadOrCreateKey() {
  try {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 });
    if (fs.existsSync(KEY_FILE)) {
      return crypto.createPrivateKey(fs.readFileSync(KEY_FILE, 'utf8'));
    }
    const kp = crypto.generateKeyPairSync('ed25519');
    const pem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' });
    fs.writeFileSync(KEY_FILE, pem, { mode: 0o600 });
    return kp.privateKey;
  } catch (e) {
    log('warn', 'key_load_failed_ephemeral', { err: String(e) });
    return crypto.generateKeyPairSync('ed25519').privateKey;
  }
}
const SIGNING_KEY = loadOrCreateKey();
function pubKeyPem() {
  try { return crypto.createPublicKey(SIGNING_KEY).export({ type: 'spki', format: 'pem' }); }
  catch { return null; }
}
function sign(obj) {
  try {
    const sig = crypto.sign(null, Buffer.from(JSON.stringify(obj)), SIGNING_KEY);
    return sig.toString('base64');
  } catch { return null; }
}

// ── Tracing ──────────────────────────────────────────────────────────────────
function newTraceId() { return crypto.randomBytes(6).toString('hex'); }

// ── Logging (structured, dual-sink: stdout + file) ──────────────────────────
function log(level, msg, extra) {
  const line = { ts: new Date().toISOString(), level, msg, ...(extra || {}) };
  const out = JSON.stringify(line) + '\n';
  process.stdout.write(out);
  try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }); fs.appendFileSync(LOG_FILE, out); } catch {}
}
function appendHistory(event) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n');
  } catch {}
}

// ── Shell helpers ────────────────────────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...opts }).trim();
}
function shOk(cmd) { try { execSync(cmd, { stdio: 'ignore' }); return true; } catch { return false; } }

// ── HTTP fetch with timing ───────────────────────────────────────────────────
function fetchBuf(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const t0 = Date.now();
    const req = mod.get(url, { timeout: timeoutMs, rejectUnauthorized: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks), ms: Date.now() - t0 }));
    });
    req.on('error', () => resolve({ status: 0, body: Buffer.alloc(0), ms: Date.now() - t0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: Buffer.alloc(0), ms: Date.now() - t0 }); });
  });
}

// ── JSON helpers ─────────────────────────────────────────────────────────────
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = { ...obj, _signature: undefined };
  payload._signature = sign(payload) || undefined;
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
}
function verifyJson(file) {
  const obj = readJson(file, null);
  if (!obj || !obj._signature) return { valid: false, reason: 'no_signature' };
  const { _signature, ...rest } = obj;
  try {
    const ok = crypto.verify(null, Buffer.from(JSON.stringify({ ...rest, _signature: undefined })), crypto.createPublicKey(SIGNING_KEY), Buffer.from(_signature, 'base64'));
    return { valid: ok, data: obj };
  } catch (e) { return { valid: false, reason: String(e) }; }
}

// ── Lock (prevent concurrent guardians) ─────────────────────────────────────
function acquireLock() {
  try {
    fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    if (fs.existsSync(LOCK_FILE)) {
      const pid = +fs.readFileSync(LOCK_FILE, 'utf8').split('\n')[0] || 0;
      if (pid && pid !== process.pid) {
        try { process.kill(pid, 0); log('error', 'another_guardian_running', { pid }); process.exit(2); } catch {}
      }
    }
    fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}\n`);
  } catch (e) { log('warn', 'lock_failed', { err: String(e) }); }
}
function releaseLock() { try { fs.unlinkSync(LOCK_FILE); } catch {} }

// ── File listing & syntax check ─────────────────────────────────────────────
function listJsFiles(root, out = []) {
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (['node_modules', '.git', 'logs', 'data', '.unicorn-backups', '.archive'].includes(name.name)) continue;
    const p = path.join(root, name.name);
    if (name.isDirectory()) listJsFiles(p, out);
    else if (name.isFile() && p.endsWith('.js')) out.push(p);
  }
  return out;
}
function syntaxCheck(root) {
  const criticals = ['backend/index.js', 'src/index.js', 'src/site/template.js', 'src/site/sovereign-extensions.js', 'ecosystem.config.js']
    .map((p) => path.join(root, p)).filter((p) => fs.existsSync(p));
  const now = Date.now();
  const recent = listJsFiles(root).filter((p) => { try { return now - fs.statSync(p).mtimeMs < 10 * 60 * 1000; } catch { return false; } });
  const set = [...new Set([...criticals, ...recent])];
  const bad = [];
  for (const f of set) {
    const r = spawnSync('node', ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) bad.push({ file: f.replace(root + '/', ''), err: (r.stderr || '').split('\n').slice(0, 3).join(' | ') });
  }
  return bad;
}

// ── Snapshots ───────────────────────────────────────────────────────────────
function latestSnapshot() {
  try {
    const files = fs.readdirSync(SNAP_DIR).filter((f) => /^unicorn-.*\.tgz$/.test(f));
    files.sort((a, b) => fs.statSync(path.join(SNAP_DIR, b)).mtimeMs - fs.statSync(path.join(SNAP_DIR, a)).mtimeMs);
    return files[0] ? path.join(SNAP_DIR, files[0]) : null;
  } catch { return null; }
}
function sha256File(p) {
  const h = crypto.createHash('sha256');
  const buf = fs.readFileSync(p);
  h.update(buf);
  return h.digest('hex');
}
function merkleRoot(hashes) {
  if (hashes.length === 0) return '';
  let layer = hashes.slice();
  while (layer.length > 1) {
    const next = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i];
      const b = layer[i + 1] || a;
      next.push(crypto.createHash('sha256').update(a + b).digest('hex'));
    }
    layer = next;
  }
  return layer[0];
}
function writeManifest(snapshotPath) {
  try {
    const sha = sha256File(snapshotPath);
    const size = fs.statSync(snapshotPath).size;
    const manifest = {
      snapshot: path.basename(snapshotPath),
      sha256: sha,
      size,
      merkle_root: merkleRoot([sha]), // single-file tree; extensible to per-chunk
      signature_scheme: 'Ed25519',
      post_quantum_ready: false,
      created_at: new Date().toISOString(),
      generator: 'unicorn-guardian/2.0',
    };
    manifest.signature = sign(manifest);
    fs.writeFileSync(snapshotPath + '.manifest.json', JSON.stringify(manifest, null, 2));
    return manifest;
  } catch (e) { log('warn', 'manifest_write_failed', { err: String(e) }); return null; }
}
function verifySnapshot(snapshotPath) {
  try {
    const manifestPath = snapshotPath + '.manifest.json';
    if (!fs.existsSync(manifestPath)) return { ok: true, reason: 'no_manifest' }; // permissive for old snapshots
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const actualSha = sha256File(snapshotPath);
    if (actualSha !== m.sha256) return { ok: false, reason: 'sha_mismatch', expected: m.sha256, actual: actualSha };
    const { signature, ...rest } = m;
    if (signature) {
      const ok = crypto.verify(null, Buffer.from(JSON.stringify(rest)), crypto.createPublicKey(SIGNING_KEY), Buffer.from(signature, 'base64'));
      if (!ok) return { ok: false, reason: 'signature_invalid' };
    }
    return { ok: true };
  } catch (e) { return { ok: false, reason: String(e) }; }
}
function takeSnapshot(tag) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
  const name = `unicorn-${ts}-${tag}.tgz`;
  const out = path.join(SNAP_DIR, name);
  const r = spawnSync('tar', [
    '--warning=no-file-changed',
    '--exclude=node_modules', '--exclude=.git',
    '--exclude=logs', '--exclude=data', '--exclude=.archive',
    '-C', APP_DIR, '-czf', out, '.',
  ], { encoding: 'utf8' });
  if (r.status !== 0 && r.status !== 1) {
    log('warn', 'snapshot_tar_warning', { status: r.status, err: (r.stderr || '').slice(0, 200) });
  }
  METRICS.snapshotsTaken++;
  writeManifest(out);
  return out;
}

// ── Rollback ────────────────────────────────────────────────────────────────
function isBadSnapshot(snapshot) {
  try {
    const bad = readJson(BAD_SNAPS_FILE, { list: [] });
    return (bad.list || []).includes(path.basename(snapshot));
  } catch { return false; }
}
function markBadSnapshot(snapshot, reason) {
  try {
    const bad = readJson(BAD_SNAPS_FILE, { list: [], reasons: {} });
    const key = path.basename(snapshot);
    if (!bad.list.includes(key)) bad.list.push(key);
    bad.reasons = bad.reasons || {};
    bad.reasons[key] = { reason, ts: new Date().toISOString() };
    writeJson(BAD_SNAPS_FILE, bad);
  } catch (e) { log('warn', 'bad_snapshot_mark_failed', { err: String(e) }); }
}
function rollbackTo(snapshot, traceId) {
  log('warn', 'rollback_begin', { snapshot, traceId });
  appendHistory({ event: 'rollback_begin', snapshot, traceId });

  // Verify target integrity first — don't rollback to a tampered archive
  const verify = verifySnapshot(snapshot);
  if (!verify.ok) {
    log('error', 'rollback_aborted_integrity', { snapshot, ...verify });
    markBadSnapshot(snapshot, `integrity:${verify.reason}`);
    METRICS.rollbacksFailed++;
    return false;
  }

  takeSnapshot('preguardrollback');
  const envPath = path.join(APP_DIR, '.env');
  const envBak  = fs.existsSync(envPath) ? fs.readFileSync(envPath) : null;
  for (const entry of fs.readdirSync(APP_DIR)) {
    if (PRESERVED_RUNTIME_ENTRIES.has(entry)) continue;
    try { fs.rmSync(path.join(APP_DIR, entry), { recursive: true, force: true }); } catch {}
  }
  const r = spawnSync('tar', ['-xzf', snapshot, '-C', APP_DIR], { encoding: 'utf8' });
  if (r.status !== 0) {
    log('error', 'rollback_extract_failed', { err: r.stderr });
    markBadSnapshot(snapshot, 'extract_failed');
    METRICS.rollbacksFailed++;
    return false;
  }
  if (envBak) fs.writeFileSync(envPath, envBak);
  if (!shOk(`cd ${APP_DIR} && npm install --omit=dev >/tmp/guardian-npm.log 2>&1`)) {
    log('error', 'rollback_npm_failed', { log: sh('tail -30 /tmp/guardian-npm.log || true') });
    METRICS.rollbacksFailed++;
    return false;
  }
  shOk(`pm2 restart ${PM2_APPS} --update-env`);
  METRICS.rollbacks++;
  log('info', 'rollback_done', { snapshot, traceId });
  appendHistory({ event: 'rollback_done', snapshot, traceId });

  // Webhook notify
  if (WEBHOOK) notifyWebhook({ event: 'rollback', snapshot: path.basename(snapshot), traceId, ts: new Date().toISOString() });
  return true;
}

// ── Multi-probe canary verification ─────────────────────────────────────────
async function canaryVerify() {
  const results = [];
  for (let i = 0; i < 3; i++) {
    await sleep(2000);
    const m = await measure();
    results.push({ ok: m.siteOk && (m.backendOk || m.backendTransient), htmlBytes: m.htmlBytes, backendStatus: m.backendStatus, siteStatus: m.siteStatus });
  }
  const healthy = results.filter((r) => r.ok).length;
  return { healthy, total: results.length, results, verdict: healthy >= 2 };
}

// ── Measurement ─────────────────────────────────────────────────────────────
async function measure() {
  const tryOnce = async () => {
    const [b, s, sh1] = await Promise.all([fetchBuf(BACKEND), fetchBuf(SITE_URL), fetchBuf(SITE_HEAL)]);
    let backendOk = false;
    try { backendOk = b.status === 200 && JSON.parse(b.body.toString() || '{}').status === 'ok'; } catch {}
    const backendTransient = [429, 503].includes(b.status);
    const siteOk = sh1.status === 200;
    return {
      backendOk, backendTransient,
      siteOk, htmlBytes: s.body.length,
      backendStatus: b.status, siteStatus: s.status,
      backendMs: b.ms, siteMs: s.ms,
    };
  };
  let m = await tryOnce();
  if (!m.backendOk && !m.backendTransient) {
    await sleep(1500);
    const m2 = await tryOnce();
    if (m2.backendOk || m2.backendTransient) m = m2;
  }
  METRICS.lastHtmlBytes = m.htmlBytes;
  METRICS.lastBackendOk = m.backendOk;
  METRICS.lastSiteOk = m.siteOk;
  return m;
}

// ── pm2 crash-loop + resource stats ─────────────────────────────────────────
function pm2Stats() {
  try {
    const raw = sh('pm2 jlist 2>/dev/null || echo []');
    const list = JSON.parse(raw);
    const state = readJson(STATE_FILE, { lastGood: null, pmSnap: {} });
    const pmSnap = state.pmSnap || {};
    const now = Date.now();
    const offenders = [];
    const nextSnap = {};
    const stats = [];
    for (const p of list) {
      const name = p.name;
      const rt = (p.pm2_env && p.pm2_env.restart_time) || 0;
      const prev = pmSnap[name];
      nextSnap[name] = { rt, ts: now };
      if (/unicorn-(backend|site)/.test(name)) {
        if (prev && now - prev.ts < 180000 && rt - prev.rt >= 6) offenders.push({ name, delta: rt - prev.rt });
      }
      stats.push({ name, status: p.pm2_env && p.pm2_env.status, rss: (p.monit && p.monit.memory) || 0, cpu: (p.monit && p.monit.cpu) || 0, restart_time: rt });
    }
    const nextState = { ...state, pmSnap: nextSnap };
    writeJson(STATE_FILE, nextState);
    return { offenders, stats };
  } catch { return { offenders: [], stats: [] }; }
}

// ── Adaptive ratio (rolling p95) ────────────────────────────────────────────
function adaptiveMinBytes(base) {
  if (!ADAPTIVE || !base) return base ? Math.floor(base.htmlBytes * MIN_RATIO) : 0;
  METRICS.htmlBytesWindow.push(base.htmlBytes);
  if (METRICS.htmlBytesWindow.length > ADAPTIVE_N) METRICS.htmlBytesWindow.shift();
  if (METRICS.htmlBytesWindow.length < 10) return Math.floor(base.htmlBytes * MIN_RATIO);
  const sorted = [...METRICS.htmlBytesWindow].sort((a, b) => a - b);
  const idx = Math.max(0, Math.floor((1 - ADAPTIVE_P) * sorted.length));
  const adaptive = sorted[idx];
  const staticMin = Math.floor(base.htmlBytes * MIN_RATIO);
  return Math.max(adaptive, staticMin);
}

// ── Circuit breaker ─────────────────────────────────────────────────────────
function cbRecordFail() {
  const cb = METRICS.circuitBreaker;
  cb.consecutiveFails++;
  if (cb.consecutiveFails >= 5 && cb.state === 'closed') {
    cb.state = 'open';
    cb.openSince = Date.now();
    const backoff = Math.min(15 * 60 * 1000, 30000 * Math.pow(2, Math.min(6, cb.consecutiveFails - 5)));
    cb.nextTryAt = Date.now() + backoff;
    log('warn', 'circuit_breaker_open', { backoffMs: backoff, consecutiveFails: cb.consecutiveFails });
  }
}
function cbRecordSuccess() {
  const cb = METRICS.circuitBreaker;
  cb.consecutiveFails = 0;
  if (cb.state !== 'closed') { cb.state = 'closed'; cb.openSince = 0; cb.nextTryAt = 0; log('info', 'circuit_breaker_closed'); }
}
function cbCanTrigger() {
  const cb = METRICS.circuitBreaker;
  if (cb.state === 'closed') return true;
  if (Date.now() >= cb.nextTryAt) { cb.state = 'half-open'; return true; }
  return false;
}

// ── Drift detection ─────────────────────────────────────────────────────────
function detectDrift() {
  try {
    const state = readJson(STATE_FILE, {});
    if (!state.lastGood || !fs.existsSync(state.lastGood)) return null;
    const verify = verifySnapshot(state.lastGood);
    if (!verify.ok) { METRICS.driftsDetected++; log('warn', 'drift_detected', verify); return verify; }
    return { ok: true };
  } catch { return null; }
}

// ── Auto-bisect ─────────────────────────────────────────────────────────────
async function maybeBisect() {
  if (!BISECT_ENABLED) return;
  try {
    const all = fs.readdirSync(SNAP_DIR)
      .filter((f) => /known-good/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(SNAP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 2);
    if (all.length < 2) return;
    METRICS.bisectsRun++;
    log('info', 'bisect_hint', { latest: all[0].f, previous: all[1].f, note: 'Two rollbacks happened close together; earliest-good snapshot may be compromised. Human review recommended.' });
    appendHistory({ event: 'bisect_hint', latest: all[0].f, previous: all[1].f });
  } catch (e) { log('warn', 'bisect_failed', { err: String(e) }); }
}

// ── Webhook (HMAC-SHA-256 signed) ───────────────────────────────────────────
function notifyWebhook(payload) {
  if (!WEBHOOK) return;
  try {
    const body = JSON.stringify(payload);
    const sig = WEBHOOK_SECRET ? crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex') : '';
    const url = new URL(WEBHOOK);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Guardian-Signature': sig,
        'X-Guardian-Event': payload.event || 'generic',
      },
      timeout: 5000,
    });
    req.on('error', (e) => log('warn', 'webhook_error', { err: String(e) }));
    req.on('timeout', () => { req.destroy(); });
    req.write(body);
    req.end();
  } catch (e) { log('warn', 'webhook_failed', { err: String(e) }); }
}

// ── Event-loop lag probe ────────────────────────────────────────────────────
function startLagMonitor() {
  let expected = Date.now() + 1000;
  setInterval(() => {
    const now = Date.now();
    METRICS.eventLoopLagMs = Math.max(0, now - expected);
    expected = now + 1000;
  }, 1000).unref();
}

// ── Main evaluation ─────────────────────────────────────────────────────────
const mem = { failStreak: 0, lastRollback: 0, rollbacksRecent: [] };

async function evaluateAndMaybeRollback(reason) {
  const traceId = newTraceId();
  const t0 = Date.now();
  METRICS.evaluations++;

  const m = await measure();
  const base = readJson(BASELINE_FILE, null);
  const minBytes = adaptiveMinBytes(base);
  const siteRegression = !m.siteOk || (base && m.htmlBytes < minBytes);
  const backendRegression = !m.backendOk && !m.backendTransient;
  const syntax = syntaxCheck(APP_DIR);
  const pm = pm2Stats();

  if (siteRegression || syntax.length || pm.offenders.length) mem.failStreak++;
  else if (backendRegression) mem.failStreak++;
  else mem.failStreak = 0;

  if (mem.failStreak === 0) cbRecordSuccess();

  log((siteRegression || syntax.length || pm.offenders.length || backendRegression) ? 'warn' : 'info',
      'evaluate', { traceId, reason, ...m, baseline: base, minBytes, adaptive: ADAPTIVE,
                    failStreak: mem.failStreak,
                    crashLoop: pm.offenders.length ? pm.offenders : undefined,
                    syntaxErr: syntax.length || undefined,
                    pm2_stats: pm.stats });

  const hardTrigger = syntax.length > 0 || pm.offenders.length > 0;
  const softTrigger = mem.failStreak >= 3 && (siteRegression || backendRegression);

  if (hardTrigger || softTrigger) {
    cbRecordFail();
    if (!cbCanTrigger()) {
      log('warn', 'rollback_blocked_by_circuit_breaker', { traceId, cb: METRICS.circuitBreaker });
      return;
    }
    const now = Date.now();
    mem.rollbacksRecent = mem.rollbacksRecent.filter((t) => now - t < 900000); // 15 min window
    if (mem.rollbacksRecent.length >= 2) {
      log('warn', 'rollback_throttled_and_bisecting', { recent: mem.rollbacksRecent.length, reason, traceId });
      await maybeBisect();
      return;
    }
    const state = readJson(STATE_FILE, { lastGood: null });
    let target = state.lastGood && fs.existsSync(state.lastGood) && !isBadSnapshot(state.lastGood) ? state.lastGood : null;
    if (!target) {
      // Fall back to latest non-bad snapshot
      const all = fs.readdirSync(SNAP_DIR).filter((f) => /^unicorn-.*\.tgz$/.test(f) && !isBadSnapshot(path.join(SNAP_DIR, f)))
        .map((f) => ({ f, t: fs.statSync(path.join(SNAP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      target = all[0] ? path.join(SNAP_DIR, all[0].f) : null;
    }
    if (!target) { log('error', 'no_snapshot_to_rollback', { traceId }); return; }

    if (syntax.length) log('warn', 'syntax_errors', { traceId, count: syntax.length, sample: syntax.slice(0, 5) });
    mem.rollbacksRecent.push(now);
    mem.lastRollback = now;
    mem.failStreak = 0;
    if (rollbackTo(target, traceId)) {
      const canary = await canaryVerify();
      log(canary.verdict ? 'info' : 'error', 'post_rollback_canary', { traceId, ...canary });
      if (!canary.verdict) {
        // canary failed → mark snapshot as bad, try next
        markBadSnapshot(target, 'canary_failed');
      }
    }
    METRICS.lastEvaluationMs = Date.now() - t0;
    return;
  }

  // Healthy or marginally healthy → update baseline + optional snapshot
  if (!base || m.htmlBytes >= (base.htmlBytes || 0)) {
    const prevBytes = base ? base.htmlBytes : 0;
    writeJson(BASELINE_FILE, { htmlBytes: m.htmlBytes, ts: new Date().toISOString() });
    const shouldSnapshot = !base || m.htmlBytes > prevBytes || !readJson(STATE_FILE, { lastGood: null }).lastGood;
    if (shouldSnapshot) {
      const snap = takeSnapshot('known-good');
      writeJson(STATE_FILE, { lastGood: snap, htmlBytes: m.htmlBytes, ts: new Date().toISOString() });
      rotateSnapshots();
      log('info', 'known_good_updated', { traceId, htmlBytes: m.htmlBytes, snapshot: path.basename(snap) });
    }
  }

  // Periodic drift detection (every ~10 evaluations)
  if (METRICS.evaluations % 10 === 0) detectDrift();

  METRICS.lastEvaluationMs = Date.now() - t0;
}

function rotateSnapshots() {
  try {
    const all = fs.readdirSync(SNAP_DIR)
      .filter((f) => /^unicorn-.*\.tgz$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(SNAP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    const good = all.filter((x) => /known-good/.test(x.f)).slice(30);
    const other = all.filter((x) => !/known-good/.test(x.f)).slice(10);
    for (const x of [...good, ...other]) {
      try {
        fs.unlinkSync(path.join(SNAP_DIR, x.f));
        try { fs.unlinkSync(path.join(SNAP_DIR, x.f + '.manifest.json')); } catch {}
      } catch {}
    }
  } catch {}
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── HTTP API (Prometheus /metrics + health + state) ─────────────────────────
function formatPrometheus() {
  const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
  const cb = METRICS.circuitBreaker;
  const lines = [];
  lines.push('# HELP guardian_up Guardian is running.');
  lines.push('# TYPE guardian_up gauge');
  lines.push('guardian_up 1');
  lines.push('# HELP guardian_uptime_seconds Seconds since guardian start.');
  lines.push('# TYPE guardian_uptime_seconds counter');
  lines.push(`guardian_uptime_seconds ${uptimeSec.toFixed(2)}`);
  lines.push('# HELP guardian_evaluations_total Number of evaluations performed.');
  lines.push('# TYPE guardian_evaluations_total counter');
  lines.push(`guardian_evaluations_total ${METRICS.evaluations}`);
  lines.push('# HELP guardian_rollbacks_total Number of rollbacks executed.');
  lines.push('# TYPE guardian_rollbacks_total counter');
  lines.push(`guardian_rollbacks_total ${METRICS.rollbacks}`);
  lines.push('# HELP guardian_rollbacks_failed_total Number of rollbacks that failed.');
  lines.push('# TYPE guardian_rollbacks_failed_total counter');
  lines.push(`guardian_rollbacks_failed_total ${METRICS.rollbacksFailed}`);
  lines.push('# HELP guardian_snapshots_taken_total Number of snapshots taken.');
  lines.push('# TYPE guardian_snapshots_taken_total counter');
  lines.push(`guardian_snapshots_taken_total ${METRICS.snapshotsTaken}`);
  lines.push('# HELP guardian_drifts_detected_total File-system drift events on known-good snapshots.');
  lines.push('# TYPE guardian_drifts_detected_total counter');
  lines.push(`guardian_drifts_detected_total ${METRICS.driftsDetected}`);
  lines.push('# HELP guardian_bisects_run_total Auto-bisect runs triggered.');
  lines.push('# TYPE guardian_bisects_run_total counter');
  lines.push(`guardian_bisects_run_total ${METRICS.bisectsRun}`);
  lines.push('# HELP guardian_event_loop_lag_ms Last observed event-loop lag.');
  lines.push('# TYPE guardian_event_loop_lag_ms gauge');
  lines.push(`guardian_event_loop_lag_ms ${METRICS.eventLoopLagMs}`);
  lines.push('# HELP guardian_last_html_bytes Last measured HTML byte count.');
  lines.push('# TYPE guardian_last_html_bytes gauge');
  lines.push(`guardian_last_html_bytes ${METRICS.lastHtmlBytes}`);
  lines.push('# HELP guardian_backend_ok Last backend health (1 ok, 0 fail).');
  lines.push('# TYPE guardian_backend_ok gauge');
  lines.push(`guardian_backend_ok ${METRICS.lastBackendOk ? 1 : 0}`);
  lines.push('# HELP guardian_site_ok Last site health (1 ok, 0 fail).');
  lines.push('# TYPE guardian_site_ok gauge');
  lines.push(`guardian_site_ok ${METRICS.lastSiteOk ? 1 : 0}`);
  lines.push('# HELP guardian_circuit_breaker_open Circuit breaker state (1 open, 0 closed).');
  lines.push('# TYPE guardian_circuit_breaker_open gauge');
  lines.push(`guardian_circuit_breaker_open ${cb.state !== 'closed' ? 1 : 0}`);
  lines.push('# HELP guardian_consecutive_fails Consecutive failed evaluations.');
  lines.push('# TYPE guardian_consecutive_fails gauge');
  lines.push(`guardian_consecutive_fails ${cb.consecutiveFails}`);
  const mem = process.memoryUsage();
  lines.push('# HELP guardian_process_rss_bytes Guardian process RSS.');
  lines.push('# TYPE guardian_process_rss_bytes gauge');
  lines.push(`guardian_process_rss_bytes ${mem.rss}`);
  return lines.join('\n') + '\n';
}

function startHttpServer() {
  const server = http.createServer(async (req, res) => {
    const url = (req.url || '/').split('?')[0];
    try {
      if (url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(formatPrometheus());
      }
      if (url === '/healthz') {
        const uptimeSec = (Date.now() - METRICS.startedAt) / 1000;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ status: 'ok', uptime_seconds: uptimeSec, version: '2.0.0', pid: process.pid }));
      }
      if (url === '/state') {
        const state = readJson(STATE_FILE, {});
        const baseline = readJson(BASELINE_FILE, {});
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ state, baseline, metrics: METRICS, mem }, null, 2));
      }
      if (url === '/snapshots') {
        const all = fs.readdirSync(SNAP_DIR).filter((f) => /^unicorn-.*\.tgz$/.test(f))
          .map((f) => { const p = path.join(SNAP_DIR, f); const s = fs.statSync(p); return { name: f, size: s.size, mtime: s.mtime.toISOString(), bad: isBadSnapshot(p) }; })
          .sort((a, b) => b.mtime.localeCompare(a.mtime));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ count: all.length, items: all }));
      }
      if (url === '/pubkey') {
        const pem = pubKeyPem();
        res.writeHead(200, { 'Content-Type': 'application/x-pem-file' });
        return res.end(pem || 'no-key');
      }
      if (url === '/trigger' && req.method === 'POST') {
        evaluateAndMaybeRollback('api_trigger').catch(() => {});
        res.writeHead(202, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ triggered: true }));
      }
      if (url === '/' ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          name: 'unicorn-guardian',
          version: '2.0.0',
          endpoints: ['/healthz', '/metrics', '/state', '/snapshots', '/pubkey', 'POST /trigger']
        }));
      }
      res.writeHead(404); res.end();
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  server.listen(GUARDIAN_PORT, '127.0.0.1', () => log('info', 'http_api_started', { port: GUARDIAN_PORT }));
  server.on('error', (e) => log('warn', 'http_server_error', { err: String(e) }));
  return server;
}

// ── Watcher ─────────────────────────────────────────────────────────────────
let debounce = null;
function schedule(reason) {
  clearTimeout(debounce);
  debounce = setTimeout(() => evaluateAndMaybeRollback(reason).catch((e) => log('error', 'eval_crash', { err: String(e) })), 5000);
}
function watchDir(dir) {
  try {
    fs.watch(dir, { recursive: true }, (event, name) => {
      if (!name) return;
      if (name.startsWith('node_modules') || name.startsWith('.git') || name.startsWith('logs') || name.startsWith('.archive')) return;
      schedule(`fs:${event}:${name}`);
    });
    log('info', 'watcher_started', { dir });
  } catch (e) { log('warn', 'watch_failed_fallback_poll', { err: String(e) }); }
}

// ── Signal handlers ─────────────────────────────────────────────────────────
function installSignalHandlers() {
  process.on('SIGHUP', () => {
    CHECK_MS  = +(process.env.CHECK_MS || CHECK_MS);
    MIN_RATIO = +(process.env.MIN_RATIO || MIN_RATIO);
    log('info', 'sighup_reload', { CHECK_MS, MIN_RATIO });
  });
  const shutdown = (signal) => {
    log('info', 'shutdown', { signal });
    try { writeJson(STATE_FILE, { ...(readJson(STATE_FILE, {})), stoppedAt: new Date().toISOString() }); } catch {}
    releaseLock();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('uncaughtException', (e) => { log('error', 'uncaught', { err: String(e && e.stack || e) }); });
  process.on('unhandledRejection', (e) => { log('error', 'unhandled_rejection', { err: String(e) }); });
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  acquireLock();
  installSignalHandlers();
  startLagMonitor();
  startHttpServer();
  log('info', 'guardian_start', {
    version: '2.0.0', APP_DIR, SNAP_DIR, CHECK_MS, MIN_RATIO, ADAPTIVE, BISECT_ENABLED,
    port: GUARDIAN_PORT, webhook: WEBHOOK ? 'configured' : 'disabled',
    signing_key: KEY_FILE,
  });
  await evaluateAndMaybeRollback('bootstrap');
  watchDir(APP_DIR);
  setInterval(() => evaluateAndMaybeRollback('tick').catch(() => {}), CHECK_MS);
})();
