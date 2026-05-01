// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';
// ============================================================================
// DISASTER RECOVERY AUTOPILOT
// Real backup → AWS S3, restore from latest backup, 24h cron scheduler.
// Credentials taken from env (DR_S3_*) so the autopilot runs on the owner's
// infra without per-tenant config.
// ============================================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

let cloud = null;
try { cloud = require('./cloud-providers'); } catch (_) {}

const _state = {
  name: 'disaster-recovery',
  label: 'Disaster Recovery Autopilot',
  startedAt: null,
  processCount: 0,
  lastRun: null,
  lastBackup: null,
  lastRestore: null,
  health: 'good',
  cronTimer: null,
  history: [],
};

function _historyPush(entry) {
  _state.history.push(entry);
  if (_state.history.length > 200) _state.history.shift();
}

function _config() {
  return {
    bucket: process.env.DR_S3_BUCKET || '',
    prefix: process.env.DR_S3_PREFIX || 'unicorn-backups/',
    region: process.env.DR_S3_REGION || process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.DR_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.DR_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    dataDir: process.env.DR_DATA_DIR || path.join(__dirname, '..', '..', 'data'),
    intervalMs: Number(process.env.DR_INTERVAL_MS) || 24 * 60 * 60 * 1000,
  };
}

function _walk(dir, baseDir = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) _walk(full, baseDir, out);
    else if (entry.isFile()) {
      try {
        const st = fs.statSync(full);
        if (st.size < 200 * 1024 * 1024) out.push({ rel: path.relative(baseDir, full), full, size: st.size });
      } catch (_) {}
    }
  }
  return out;
}

async function _buildArchive(dataDir) {
  const files = _walk(dataDir);
  const out = { meta: { ts: new Date().toISOString(), files: files.length, host: process.env.HOSTNAME || 'unicorn' }, files: [] };
  let totalBytes = 0;
  for (const f of files) {
    try {
      const buf = fs.readFileSync(f.full);
      out.files.push({ rel: f.rel, size: f.size, sha256: crypto.createHash('sha256').update(buf).digest('hex'), content_b64: buf.toString('base64') });
      totalBytes += f.size;
    } catch (_) {}
  }
  const json = Buffer.from(JSON.stringify(out));
  const gz = await gzip(json);
  return { gz, files: out.files.length, totalBytes, compressedBytes: gz.length, sha256: crypto.createHash('sha256').update(gz).digest('hex') };
}

async function backupToS3({ overrideBucket, overridePrefix } = {}) {
  const cfg = _config();
  const bucket = overrideBucket || cfg.bucket;
  const prefix = overridePrefix || cfg.prefix;
  if (!cloud) return { ok: false, error: 'sdk_missing' };
  if (!bucket) return { ok: false, error: 'no_bucket', message: 'Set DR_S3_BUCKET env to enable real backups' };
  if (!cfg.accessKeyId || !cfg.secretAccessKey) return { ok: false, error: 'no_credentials', message: 'Set DR_AWS_ACCESS_KEY_ID + DR_AWS_SECRET_ACCESS_KEY' };

  const t0 = Date.now();
  const { gz, files, totalBytes, compressedBytes, sha256 } = await _buildArchive(cfg.dataDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = prefix.replace(/\/?$/, '/') + 'backup-' + stamp + '.json.gz';
  const up = await cloud.s3Upload({
    bucket, key, body: gz, region: cfg.region,
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
    contentType: 'application/gzip',
  });
  const result = {
    ok: !!up.ok, real: !!up.real, bucket, key, files, totalBytes, compressedBytes, sha256,
    durationMs: Date.now() - t0, error: up.error, message: up.message,
  };
  _state.lastBackup = result;
  _historyPush({ kind: 'backup', ts: new Date().toISOString(), ok: result.ok, key, files, bytes: compressedBytes });
  return result;
}

async function restoreFromBackup({ key, dryRun = true, restoreDir, overrideBucket } = {}) {
  const cfg = _config();
  const bucket = overrideBucket || cfg.bucket;
  if (!cloud) return { ok: false, error: 'sdk_missing' };
  if (!bucket) return { ok: false, error: 'no_bucket' };
  if (!cfg.accessKeyId || !cfg.secretAccessKey) return { ok: false, error: 'no_credentials' };

  let targetKey = key;
  if (!targetKey) {
    const list = await cloud.s3ListLatest({
      bucket, prefix: cfg.prefix, region: cfg.region,
      accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, limit: 1,
    });
    if (!list.ok || !list.items?.length) return { ok: false, error: 'no_backups_found' };
    targetKey = list.items[0].key;
  }

  const dl = await cloud.s3Download({
    bucket, key: targetKey, region: cfg.region,
    accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey,
  });
  if (!dl.ok) return { ok: false, error: dl.error, message: dl.message };

  const json = JSON.parse((await gunzip(dl.body)).toString('utf8'));
  const out = { ok: true, real: true, bucket, key: targetKey, files: json.files.length, restored: 0, dryRun, errors: [] };
  if (!dryRun) {
    const target = restoreDir || cfg.dataDir + '.restore-' + Date.now();
    fs.mkdirSync(target, { recursive: true });
    for (const f of json.files) {
      try {
        const dest = path.join(target, f.rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, Buffer.from(f.content_b64, 'base64'));
        out.restored++;
      } catch (e) { out.errors.push({ rel: f.rel, error: e.message }); }
    }
    out.restoreDir = target;
  }
  _state.lastRestore = { ts: new Date().toISOString(), bucket, key: targetKey, files: out.files, restored: out.restored, dryRun };
  _historyPush({ kind: 'restore', ts: new Date().toISOString(), ok: true, key: targetKey, files: out.files, dryRun });
  return out;
}

function startCron() {
  const cfg = _config();
  if (_state.cronTimer) return { ok: true, alreadyRunning: true };
  if (!cfg.bucket) {
    console.log('⚠️  [disaster-recovery] DR_S3_BUCKET not set — autopilot disabled');
    return { ok: false, error: 'no_bucket' };
  }
  _state.cronTimer = setInterval(() => {
    backupToS3().then((r) => {
      console.log('🛟 [disaster-recovery] backup ' + (r.ok ? 'OK' : 'FAIL') + ' key=' + (r.key || '') + ' files=' + (r.files || 0) + ' bytes=' + (r.compressedBytes || 0) + ' err=' + (r.error || '-'));
    }).catch((e) => console.log('🛟 [disaster-recovery] backup ERROR ' + e.message));
  }, cfg.intervalMs);
  if (_state.cronTimer.unref) _state.cronTimer.unref();
  console.log('🦄 [disaster-recovery] autopilot armed · interval=' + cfg.intervalMs + 'ms · bucket=' + cfg.bucket);
  return { ok: true, intervalMs: cfg.intervalMs, bucket: cfg.bucket };
}

function stopCron() {
  if (_state.cronTimer) { clearInterval(_state.cronTimer); _state.cronTimer = null; return { ok: true, stopped: true }; }
  return { ok: true, stopped: false };
}

function init() {
  _state.startedAt = new Date().toISOString();
  console.log('🦄 Disaster Recovery Autopilot loaded.');
  if (String(process.env.DR_AUTOPILOT_ENABLED || '0') === '1') startCron();
}

async function processFn(input = {}) {
  _state.processCount++;
  _state.lastRun = new Date().toISOString();
  if (input.action === 'backup') return await backupToS3(input);
  if (input.action === 'restore') return await restoreFromBackup(input);
  if (input.action === 'start-cron') return startCron();
  if (input.action === 'stop-cron') return stopCron();
  return { status: 'ok', module: _state.name, label: _state.label, hint: 'send {action: backup|restore|start-cron|stop-cron}' };
}

function getStatus() {
  const cfg = _config();
  return {
    name: _state.name, label: _state.label, startedAt: _state.startedAt,
    cronArmed: !!_state.cronTimer, intervalMs: cfg.intervalMs,
    bucket: cfg.bucket || null, region: cfg.region,
    credentialsConfigured: !!(cfg.accessKeyId && cfg.secretAccessKey),
    lastBackup: _state.lastBackup,
    lastRestore: _state.lastRestore,
    history: _state.history.slice(-20),
    health: _state.health,
  };
}

init();

module.exports = { process: processFn, getStatus, init, backupToS3, restoreFromBackup, startCron, stopCron, name: 'disaster-recovery' };
