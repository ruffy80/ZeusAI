// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// ============================================================
// SERVICE WATCHDOG — AutoInnovation Reliability cycles #11 & #14
// Monitors internal/external services, restarts degraded ones,
// and wraps external HTTP calls with exponential-backoff retry.
// ============================================================

const http  = require('http');
const https = require('https');
const { execFile } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────
const WATCHDOG_INTERVAL_MS   = parseInt(process.env.WATCHDOG_INTERVAL_MS   || '30000', 10);
const WATCHDOG_FAIL_THRESHOLD = parseInt(process.env.WATCHDOG_FAIL_THRESHOLD || '3', 10);
const WATCHDOG_MAX_LOG        = parseInt(process.env.WATCHDOG_MAX_LOG        || '200', 10);
const WATCHDOG_BASE_BACKOFF_MS = parseInt(process.env.WATCHDOG_BASE_BACKOFF_MS || '2000', 10);
const WATCHDOG_MAX_BACKOFF_MS  = parseInt(process.env.WATCHDOG_MAX_BACKOFF_MS  || '300000', 10);

// Services to monitor (override via env WATCHDOG_SERVICES as JSON array)
const DEFAULT_SERVICES = [
  { name: 'backend',            url: 'http://127.0.0.1:3000/api/health', pm2: 'unicorn' },
  { name: 'health-guardian',    url: null,                                pm2: 'unicorn-health-guardian' },
  { name: 'zero-downtime',      url: null,                                pm2: 'unicorn-zero-downtime' },
  { name: 'ai-self-healing',    url: null,                                pm2: 'unicorn-ai-self-healing' },
  { name: 'system-shield',      url: null,                                pm2: 'unicorn-system-shield' },
];

let _services;
try {
  _services = process.env.WATCHDOG_SERVICES
    ? JSON.parse(process.env.WATCHDOG_SERVICES)
    : DEFAULT_SERVICES;
} catch {
  _services = DEFAULT_SERVICES;
}

// ── State ──────────────────────────────────────────────────────────────
const _state = {
  name:       'service-watchdog',
  startedAt:  null,
  running:    false,
  handle:     null,
  totalChecks: 0,
  totalRestarts: 0,
  totalFails: 0,
  log: [],
};

// Per-service failure counters and backoff state
const _counters = {};   // { [name]: { failures: number, backoffUntil: number } }

// ── Helpers ────────────────────────────────────────────────────────────
function _log(event, service, ok, detail) {
  const entry = { ts: new Date().toISOString(), event, service, ok, detail };
  _state.log.unshift(entry);
  if (_state.log.length > WATCHDOG_MAX_LOG) _state.log.length = WATCHDOG_MAX_LOG;
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} [service-watchdog] ${event} "${service}"${detail ? ': ' + detail : ''}`);
}

function _counter(name) {
  if (!_counters[name]) _counters[name] = { failures: 0, backoffUntil: 0 };
  return _counters[name];
}

function _isBackedOff(name) {
  return Date.now() < _counter(name).backoffUntil;
}

function _markFail(name) {
  const c = _counter(name);
  c.failures++;
  const delay = Math.min(WATCHDOG_MAX_BACKOFF_MS, WATCHDOG_BASE_BACKOFF_MS * Math.pow(2, c.failures - 1));
  c.backoffUntil = Date.now() + delay;
  _state.totalFails++;
  return delay;
}

function _clearFail(name) {
  if (_counters[name]) {
    _counters[name].failures = 0;
    _counters[name].backoffUntil = 0;
  }
}

// ── HTTP probe ─────────────────────────────────────────────────────────
function _probe(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false, reason: 'no-url' });
    const lib = url.startsWith('https') ? https : http;
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve({ ok: false, reason: 'timeout' }); }
    }, timeoutMs);
    try {
      const req = lib.get(url, (res) => {
        clearTimeout(timer);
        if (done) return;
        done = true;
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const j = JSON.parse(body);
              resolve({ ok: j.status === 'ok' || j.healthy === true || j.alive === true, body: body.slice(0, 200) });
            } catch {
              resolve({ ok: res.statusCode === 200 });
            }
          } else {
            resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
          }
        });
      });
      req.on('error', (e) => {
        clearTimeout(timer);
        if (!done) { done = true; resolve({ ok: false, reason: e.message }); }
      });
    } catch (e) {
      clearTimeout(timer);
      if (!done) { done = true; resolve({ ok: false, reason: e.message }); }
    }
  });
}

// ── PM2 restart ────────────────────────────────────────────────────────
function _pm2Restart(pm2Name) {
  return new Promise((resolve) => {
    if (!pm2Name) return resolve({ ok: false, reason: 'no pm2 name' });
    execFile('pm2', ['restart', pm2Name], { timeout: 20000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: stdout || stderr || (err && err.message) || '' });
    });
  });
}

// ── Per-service check ──────────────────────────────────────────────────
async function _checkService(svc) {
  _state.totalChecks++;
  if (_isBackedOff(svc.name)) {
    _log('backed-off', svc.name, false, `next try in ${Math.ceil((_counter(svc.name).backoffUntil - Date.now()) / 1000)}s`);
    return;
  }

  let ok = true;
  let reason = '';

  if (svc.url) {
    const probe = await _probe(svc.url);
    ok = probe.ok;
    reason = probe.reason || '';
  } else if (svc.pm2) {
    // No URL to probe — PM2 process-level liveness is handled by unicorn-health-guardian.
    // Treat as healthy here; the guardian will restart it if PM2 reports the process down.
    ok = true;
  }

  if (ok) {
    _clearFail(svc.name);
    _log('check-ok', svc.name, true);
  } else {
    const c = _counter(svc.name);
    _log('check-fail', svc.name, false, reason);
    const delay = _markFail(svc.name);

    if (c.failures >= WATCHDOG_FAIL_THRESHOLD && svc.pm2) {
      _log('restart-triggered', svc.name, false, `${c.failures} consecutive failures`);
      const result = await _pm2Restart(svc.pm2);
      _state.totalRestarts++;
      _log('restart', svc.name, result.ok, result.out.slice(0, 100));
      console.warn(`⏳ [service-watchdog] "${svc.name}" backoff ${Math.round(delay / 1000)}s`);
    }
  }
}

// ── Main watch loop ────────────────────────────────────────────────────
async function _cycle() {
  for (const svc of _services) {
    try {
      await _checkService(svc);
    } catch (e) {
      _log('error', svc.name, false, e.message);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Start the watchdog loop.
 */
function start() {
  if (_state.running) return;
  _state.running = true;
  _state.startedAt = new Date().toISOString();
  // Run first cycle immediately then on interval
  _cycle().catch(() => {});
  _state.handle = setInterval(() => _cycle().catch(() => {}), WATCHDOG_INTERVAL_MS);
  console.log(`🐕 [service-watchdog] started — interval ${WATCHDOG_INTERVAL_MS}ms, threshold ${WATCHDOG_FAIL_THRESHOLD}`);
}

/**
 * Stop the watchdog loop.
 */
function stop() {
  if (!_state.running) return;
  _state.running = false;
  if (_state.handle) { clearInterval(_state.handle); _state.handle = null; }
  console.log('🛑 [service-watchdog] stopped');
}

/**
 * Get current status snapshot.
 */
function getStatus() {
  return {
    name:           _state.name,
    running:        _state.running,
    startedAt:      _state.startedAt,
    interval:       WATCHDOG_INTERVAL_MS,
    failThreshold:  WATCHDOG_FAIL_THRESHOLD,
    totalChecks:    _state.totalChecks,
    totalRestarts:  _state.totalRestarts,
    totalFails:     _state.totalFails,
    services:       _services.map(s => {
      const c = _counters[s.name] || { failures: 0, backoffUntil: 0 };
      return {
        name:      s.name,
        url:       s.url,
        pm2:       s.pm2,
        failures:  c.failures,
        backedOff: _isBackedOff(s.name),
      };
    }),
    recentLog: _state.log.slice(0, 20),
  };
}

/**
 * withRetry — wraps an async fn with exponential-backoff retry.
 * @param {Function} fn          - async function to execute
 * @param {Object}   opts
 * @param {number}   opts.maxAttempts  - max attempts (default 4)
 * @param {number}   opts.baseMs       - initial backoff ms (default 500)
 * @param {number}   opts.maxMs        - max backoff ms (default 30000)
 * @param {Function} opts.shouldRetry  - (err) => bool (default: always true)
 * @returns {Promise<*>}
 */
async function withRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts || 4;
  const baseMs      = opts.baseMs      || 500;
  const maxMs       = opts.maxMs       || 30000;
  const shouldRetry = opts.shouldRetry || (() => true);

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
      console.warn(`⏳ [withRetry] attempt ${attempt}/${maxAttempts} for ${fn.name || 'anonymous'} failed (${err.message}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

start();

module.exports = { start, stop, getStatus, withRetry };
