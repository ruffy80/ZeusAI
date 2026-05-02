// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-02T21:19:36.504Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');

const APP_ROOT = path.join(__dirname, '..', '..');
const LOG_PATH = process.env.AUTH_GUARDIAN_LOG_PATH || path.join(APP_ROOT, 'logs', 'auth-guardian.log');
const INTERVAL_MS = Math.max(30_000, parseInt(process.env.AUTH_GUARDIAN_INTERVAL_MS || '300000', 10));
const REPAIR_WINDOW_MS = Math.max(10_000, parseInt(process.env.AUTH_GUARDIAN_REPAIR_WINDOW_MS || '30000', 10));
const PROBE_TIMEOUT_MS = Math.max(3000, parseInt(process.env.AUTH_GUARDIAN_PROBE_TIMEOUT_MS || '10000', 10));
const BACKUP_INTERVAL_MS = Math.max(300_000, parseInt(process.env.AUTH_GUARDIAN_BACKUP_INTERVAL_MS || String(60 * 60 * 1000), 10));
const BASE_URL = process.env.AUTH_GUARDIAN_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const TEST_EMAIL = String(process.env.AUTH_GUARDIAN_TEST_EMAIL || '').trim().toLowerCase();
const TEST_PASSWORD = String(process.env.AUTH_GUARDIAN_TEST_PASSWORD || '').trim();
const TEST_NAME = String(process.env.AUTH_GUARDIAN_TEST_NAME || 'Auth Guardian').trim();
const ALERT_WEBHOOK = String(process.env.AUTH_GUARDIAN_ALERT_WEBHOOK || '').trim();
const ENABLED = !['0', 'false', 'no', 'off'].includes(String(process.env.AUTH_GUARDIAN_ENABLED || '1').toLowerCase());

const _state = {
  name: 'auth-guardian',
  enabled: ENABLED,
  startedAt: null,
  running: false,
  degraded: false,
  lastProbeAt: null,
  lastProbeOk: null,
  lastError: null,
  lastRepairAt: null,
  lastRepairResult: null,
  failures: 0,
  recoveries: 0,
  _timer: null,
  _cycleBusy: false,
  _lastBackupAt: 0,
};

function _appendLog(event, data = {}) {
  const row = { ts: new Date().toISOString(), event, ...data };
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, JSON.stringify(row) + '\n');
  } catch (_) {}
}

function _jsonRequest(targetUrl, method, payload, timeout = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    try {
      const u = new URL(targetUrl);
      const body = payload ? JSON.stringify(payload) : '';
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (_) {}
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json, raw });
        });
      });
      req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
      req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      resolve({ ok: false, status: 0, error: e.message });
    }
  });
}

async function _probeLogin() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    return { ok: false, reason: 'missing_test_credentials' };
  }
  const login = await _jsonRequest(`${BASE_URL}/api/customer/login`, 'POST', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (login.ok && login.status === 200) return { ok: true, stage: 'login' };

  const code = (login.json && login.json.error) || '';
  if (login.status === 401 && (code === 'email_not_found' || code === 'invalid_credentials' || code === 'wrong_password')) {
    const signup = await _jsonRequest(`${BASE_URL}/api/customer/signup`, 'POST', {
      name: TEST_NAME,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (!signup.ok && signup.status !== 409) {
      return { ok: false, reason: 'signup_failed', login, signup };
    }
    const retry = await _jsonRequest(`${BASE_URL}/api/customer/login`, 'POST', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    return { ok: !!(retry.ok && retry.status === 200), reason: retry.ok ? 'recovered_after_signup' : 'login_failed_after_signup', retry };
  }

  return { ok: false, reason: 'login_failed', login };
}

function _runScript(relPath, timeout = 25_000) {
  return new Promise((resolve) => {
    const script = path.join(APP_ROOT, relPath);
    execFile(process.execPath, [script], { cwd: APP_ROOT, timeout }, (err, stdout, stderr) => {
      let parsed = null;
      try { parsed = stdout ? JSON.parse(String(stdout).trim()) : null; } catch (_) {}
      resolve({ ok: !err, parsed, stdout: String(stdout || ''), stderr: String(stderr || ''), error: err ? err.message : null });
    });
  });
}

async function _sendAlert(payload) {
  if (!ALERT_WEBHOOK) return;
  const out = await _jsonRequest(ALERT_WEBHOOK, 'POST', payload, 10_000);
  _appendLog('alert-sent', { ok: out.ok, status: out.status || 0 });
}

async function _runRepair() {
  _state.lastRepairAt = new Date().toISOString();
  const repair = await _runScript('scripts/auth-repair.js', 25_000);
  _state.lastRepairResult = repair.parsed || { ok: repair.ok, error: repair.error || repair.stderr.slice(0, 500) };
  _appendLog('repair-run', { ok: repair.ok, result: _state.lastRepairResult });

  const deadline = Date.now() + REPAIR_WINDOW_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5_000));
    const probe = await _probeLogin();
    if (probe.ok) {
      _state.degraded = false;
      _state.recoveries += 1;
      _appendLog('repair-success', { probe });
      return { ok: true, probe };
    }
  }

  _state.degraded = true;
  _appendLog('repair-failed', { withinMs: REPAIR_WINDOW_MS, result: _state.lastRepairResult });
  await _sendAlert({
    text: '[AuthGuardian] login recovery failed after repair window',
    source: 'auth-guardian',
    degraded: true,
    baseUrl: BASE_URL,
    result: _state.lastRepairResult,
  });
  return { ok: false };
}

async function _backupMaybe() {
  if (Date.now() - _state._lastBackupAt < BACKUP_INTERVAL_MS) return;
  _state._lastBackupAt = Date.now();
  const backup = await _runScript('scripts/auth-db-backup.js', 20_000);
  _appendLog('backup', { ok: backup.ok, error: backup.error || null });
}

async function _cycle() {
  if (_state._cycleBusy || !_state.running) return;
  _state._cycleBusy = true;
  try {
    await _backupMaybe();
    _state.lastProbeAt = new Date().toISOString();
    const probe = await _probeLogin();
    _state.lastProbeOk = !!probe.ok;
    if (probe.ok) {
      _state.degraded = false;
      _appendLog('probe-ok', { probe });
      return;
    }

    _state.failures += 1;
    _state.lastError = probe.reason || 'probe_failed';
    _appendLog('probe-fail', { failures: _state.failures, probe });
    await _runRepair();
  } catch (e) {
    _state.lastError = e.message;
    _appendLog('cycle-error', { error: e.message });
  } finally {
    _state._cycleBusy = false;
  }
}

function start() {
  if (!_state.enabled || _state.running) return;
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  _appendLog('start', { intervalMs: INTERVAL_MS, baseUrl: BASE_URL });
  _cycle().catch(() => {});
  _state._timer = setInterval(() => { _cycle().catch(() => {}); }, INTERVAL_MS);
  if (_state._timer && _state._timer.unref) _state._timer.unref();
  console.log(`🛡️ [auth-guardian] started — interval ${INTERVAL_MS}ms`);
}

function stop() {
  if (_state._timer) clearInterval(_state._timer);
  _state._timer = null;
  _state.running = false;
  _appendLog('stop');
}

function getStatus() {
  return {
    name: _state.name,
    enabled: _state.enabled,
    running: _state.running,
    startedAt: _state.startedAt,
    degraded: _state.degraded,
    lastProbeAt: _state.lastProbeAt,
    lastProbeOk: _state.lastProbeOk,
    lastError: _state.lastError,
    lastRepairAt: _state.lastRepairAt,
    lastRepairResult: _state.lastRepairResult,
    failures: _state.failures,
    recoveries: _state.recoveries,
    baseUrl: BASE_URL,
  };
}

async function run(input = {}) {
  await _cycle();
  return { status: 'ok', module: _state.name, input, state: getStatus(), ts: new Date().toISOString() };
}

module.exports = { start, stop, getStatus, run, name: 'auth-guardian' };
