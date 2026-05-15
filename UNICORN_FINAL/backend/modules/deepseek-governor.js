// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-15T07:00:14.374Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// DeepSeek Governor — strict allowlist executor (PR: DeepSeek autonomy)
//
// Goal: let DeepSeek (or any other LLM/operator) trigger a small, bounded
// set of *internal* recovery actions on the Unicorn backend WITHOUT giving
// it the ability to:
//   - eval / exec arbitrary shell
//   - write arbitrary files (especially under backend/modules/ or src/)
//   - commit / push / deploy
//   - restart arbitrary OS services as root
//
// Every action is a hardcoded enum dispatched to a known internal function.
// There is no dynamic require(), no eval(), no shell="true", no template
// command interpolation. The systemd `restart_service` action records
// *intent only* — it never spawns systemctl/pm2 from inside Node — so an
// attacker who controls the LLM response cannot escalate privileges.
//
// Bilingual comments preserved per repo convention (EN + RO).
// Comentarii bilingve păstrate conform convenției repo.
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// -------- Configuration / Configurație ---------------------------------
const RATE_LIMIT_PER_HOUR = parseInt(process.env.DEEPSEEK_GOVERNOR_HOURLY_LIMIT || '10', 10);
const RATE_LIMIT_PER_DAY  = parseInt(process.env.DEEPSEEK_GOVERNOR_DAILY_LIMIT  || '30', 10);
const RUN_TEST_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_GOVERNOR_RUN_TEST_TIMEOUT_MS || '30000', 10);
const LOG_PATH            = process.env.DEEPSEEK_GOVERNOR_LOG_PATH
                          || path.join(__dirname, '..', '..', 'data', 'logs', 'deepseek-governor.log');
const LOG_MAX_BYTES       = parseInt(process.env.DEEPSEEK_GOVERNOR_LOG_MAX_BYTES || String(2 * 1024 * 1024), 10);

// Allowed action names. Anything else is rejected with HTTP 400.
// Numele acțiunilor permise. Orice altceva → respins (400).
const ALLOWED_ACTIONS = Object.freeze([
  'none',
  'read_status',
  'prices_sync',
  'checkout_fix',
  'run_test',
  'restart_service',
]);

// Allowlist of service names that `restart_service` is permitted to *flag*.
// Lista de servicii pentru care `restart_service` poate semnala intenție.
const RESTARTABLE_SERVICES = Object.freeze([
  'unicorn-backend',
  'unicorn-frontend',
  'unicorn-site',
  'pricing-module',
]);

// -------- In-memory state / Stare in-memory -----------------------------
const _rateState = new Map();      // key (ip) -> [{ts, day}]
const _seenRequestIds = new Map(); // requestId -> {result, expiresAt}
const REQUEST_ID_TTL_MS = 5 * 60 * 1000;

let _refs = {
  livePricingBroker: null,
  logger: null,
};

// -------- Logging / Logare ----------------------------------------------
function _ensureLogDir() {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  } catch (_) { /* best effort */ }
}

function _rotateIfNeeded() {
  try {
    const stat = fs.statSync(LOG_PATH);
    if (stat.size > LOG_MAX_BYTES) {
      fs.renameSync(LOG_PATH, LOG_PATH + '.1');
    }
  } catch (_) { /* file missing is fine */ }
}

function _appendLog(entry) {
  try {
    _ensureLogDir();
    _rotateIfNeeded();
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', { encoding: 'utf8' });
  } catch (_) { /* never throw from logging */ }
  if (_refs.logger && typeof _refs.logger.info === 'function') {
    try { _refs.logger.info('[deepseek-governor]', entry); } catch (_) { /* noop */ }
  }
}

// -------- Rate limiting / Limitare rată ---------------------------------
function _rateAllow(ip) {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo  = now - 24 * 60 * 60 * 1000;
  const arr = (_rateState.get(ip) || []).filter(ts => ts > dayAgo);
  const hourCount = arr.filter(ts => ts > hourAgo).length;
  if (hourCount >= RATE_LIMIT_PER_HOUR) return { ok: false, reason: 'hourly_limit', hourCount, dayCount: arr.length };
  if (arr.length >= RATE_LIMIT_PER_DAY) return { ok: false, reason: 'daily_limit', hourCount, dayCount: arr.length };
  arr.push(now);
  _rateState.set(ip, arr);
  return { ok: true, hourCount: hourCount + 1, dayCount: arr.length };
}

function _gcRequestIds() {
  const now = Date.now();
  for (const [k, v] of _seenRequestIds) {
    if (v.expiresAt <= now) _seenRequestIds.delete(k);
  }
}

// -------- Action handlers / Handlere acțiuni ----------------------------
function _action_none() {
  return { ok: true, action: 'none', note: 'no operation performed' };
}

function _action_read_status() {
  // Curated, public-safe status snapshot — no secrets, no full file reads.
  // Snapshot de status curat — fără secrete, fără citire de fișiere arbitrare.
  const mem = process.memoryUsage();
  return {
    ok: true,
    action: 'read_status',
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    memory: { rssMb: +(mem.rss / 1024 / 1024).toFixed(1), heapUsedMb: +(mem.heapUsed / 1024 / 1024).toFixed(1) },
    nodeEnv: process.env.NODE_ENV || 'development',
    pricingSnapshotAvailable: !!(_refs.livePricingBroker && typeof _refs.livePricingBroker.getSnapshot === 'function'),
    timestamp: new Date().toISOString(),
  };
}

async function _action_prices_sync() {
  const broker = _refs.livePricingBroker;
  if (!broker || typeof broker._refresh !== 'function') {
    return { ok: false, action: 'prices_sync', reason: 'broker_unavailable' };
  }
  try {
    await broker._refresh();
    const snap = (typeof broker.getSnapshot === 'function') ? broker.getSnapshot() : null;
    return {
      ok: true,
      action: 'prices_sync',
      itemsCount: snap && Array.isArray(snap.items) ? snap.items.length : 0,
      btcRate: snap && snap.btcRate ? snap.btcRate.usd || null : null,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, action: 'prices_sync', reason: 'refresh_failed', error: String(e && e.message || e).slice(0, 200) };
  }
}

async function _action_checkout_fix() {
  // Read-only fix: re-validates pricing snapshot freshness and flags the
  // checkout subsystem as healthy/unhealthy. Does NOT mutate user data or
  // re-issue payments. If you need a destructive checkout repair, do it
  // through a human-reviewed admin endpoint, not through the governor.
  const broker = _refs.livePricingBroker;
  const snapshotOk = !!(broker && typeof broker.getSnapshot === 'function' && broker.getSnapshot());
  return {
    ok: true,
    action: 'checkout_fix',
    pricingSnapshotOk: snapshotOk,
    note: 'read-only health check; no mutations performed',
    timestamp: new Date().toISOString(),
  };
}

function _action_run_test() {
  return new Promise((resolve) => {
    // Sandbox: spawn npm test with NO shell, NO inherited stdin, hard
    // timeout, captured stdout/stderr truncated. The child cannot escalate
    // because it's started with the parent's uid/gid (whatever the unicorn
    // user has) and shell=false prevents command injection.
    // În sandbox: spawn fără shell, timeout dur, ieșire trunchiată.
    const cwd = path.resolve(__dirname, '..', '..');
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn('npm', ['test', '--silent'], {
      cwd,
      env: { ...process.env, NODE_ENV: 'test', CI: '1' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) { /* noop */ }
      resolve({
        ok: false,
        action: 'run_test',
        reason: 'timeout',
        timeoutMs: RUN_TEST_TIMEOUT_MS,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-2000),
      });
    }, RUN_TEST_TIMEOUT_MS);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); if (stdout.length > 50000) stdout = stdout.slice(-40000); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); if (stderr.length > 50000) stderr = stderr.slice(-40000); });
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, action: 'run_test', reason: 'spawn_error', error: String(e && e.message || e).slice(0, 200) });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        action: 'run_test',
        exitCode: code,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-2000),
      });
    });
  });
}

function _action_restart_service(params) {
  // INTENT ONLY — we never spawn systemctl/pm2 from inside Node.
  // A separate (human-owned) supervisor watches the log for "restart_request"
  // entries and decides whether to act. This keeps the privilege boundary
  // strictly at the OS level.
  // DOAR INTENȚIE — nu invocăm systemctl/pm2 din Node. Un supervisor uman
  // urmărește log-ul pentru "restart_request" și decide.
  const svc = params && typeof params.service === 'string' ? params.service : '';
  if (!RESTARTABLE_SERVICES.includes(svc)) {
    return { ok: false, action: 'restart_service', reason: 'service_not_allowed', allowed: RESTARTABLE_SERVICES };
  }
  return {
    ok: true,
    action: 'restart_service',
    mode: 'intent-logged',
    service: svc,
    note: 'restart intent recorded; no exec performed by governor — supervisor must consume the log entry',
    timestamp: new Date().toISOString(),
  };
}

// -------- Dispatcher / Dispecer ----------------------------------------
async function dispatch({ action, params, requestId, actor, ip }) {
  const safeAction = String(action || '').trim();
  const safeRequestId = String(requestId || '').trim().slice(0, 128);
  const safeIp = String(ip || 'unknown').slice(0, 64);

  if (!ALLOWED_ACTIONS.includes(safeAction)) {
    const entry = { ts: new Date().toISOString(), ip: safeIp, actor: actor || 'admin', action: safeAction, requestId: safeRequestId, ok: false, reason: 'action_not_allowed' };
    _appendLog(entry);
    return { status: 400, body: { error: 'action_not_allowed', allowed: ALLOWED_ACTIONS } };
  }

  // Idempotency by requestId / Idempotență după requestId
  _gcRequestIds();
  if (safeRequestId && _seenRequestIds.has(safeRequestId)) {
    const cached = _seenRequestIds.get(safeRequestId);
    return { status: 200, body: { ...cached.result, cached: true, requestId: safeRequestId } };
  }

  // Rate limiting (skipped only in test env so the suite is deterministic)
  if (process.env.NODE_ENV !== 'test') {
    const rl = _rateAllow(safeIp);
    if (!rl.ok) {
      const entry = { ts: new Date().toISOString(), ip: safeIp, actor: actor || 'admin', action: safeAction, requestId: safeRequestId, ok: false, reason: rl.reason };
      _appendLog(entry);
      return { status: 429, body: { error: 'rate_limited', reason: rl.reason, hourCount: rl.hourCount, dayCount: rl.dayCount } };
    }
  }

  let result;
  try {
    switch (safeAction) {
      case 'none':            result = _action_none(); break;
      case 'read_status':     result = _action_read_status(); break;
      case 'prices_sync':     result = await _action_prices_sync(); break;
      case 'checkout_fix':    result = await _action_checkout_fix(); break;
      case 'run_test':        result = await _action_run_test(); break;
      case 'restart_service': result = _action_restart_service(params); break;
      default:                result = { ok: false, reason: 'unreachable' };
    }
  } catch (e) {
    result = { ok: false, action: safeAction, reason: 'handler_threw', error: String(e && e.message || e).slice(0, 200) };
  }

  const logEntry = {
    ts: new Date().toISOString(),
    ip: safeIp,
    actor: actor || 'admin',
    action: safeAction,
    requestId: safeRequestId,
    ok: !!result.ok,
    ...(safeAction === 'restart_service' && result.ok ? { restart_request: result.service } : {}),
    summary: result.reason || result.note || (result.ok ? 'success' : 'failed'),
  };
  _appendLog(logEntry);

  if (safeRequestId) {
    _seenRequestIds.set(safeRequestId, { result, expiresAt: Date.now() + REQUEST_ID_TTL_MS });
  }

  return { status: result.ok ? 200 : 422, body: { ...result, requestId: safeRequestId || null } };
}

function getStatus() {
  _gcRequestIds();
  // Aggregate rate state without leaking individual IPs.
  let totalLastHour = 0;
  let totalLastDay = 0;
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo  = now - 24 * 60 * 60 * 1000;
  for (const arr of _rateState.values()) {
    for (const ts of arr) {
      if (ts > dayAgo) totalLastDay++;
      if (ts > hourAgo) totalLastHour++;
    }
  }
  return {
    ok: true,
    allowedActions: ALLOWED_ACTIONS,
    restartableServices: RESTARTABLE_SERVICES,
    limits: { perHourPerIp: RATE_LIMIT_PER_HOUR, perDayPerIp: RATE_LIMIT_PER_DAY, runTestTimeoutMs: RUN_TEST_TIMEOUT_MS },
    aggregate: { actionsLastHour: totalLastHour, actionsLastDay: totalLastDay, trackedIps: _rateState.size, pendingRequestIds: _seenRequestIds.size },
    logPath: LOG_PATH,
  };
}

function configure(refs) {
  if (refs && typeof refs === 'object') {
    if ('livePricingBroker' in refs) _refs.livePricingBroker = refs.livePricingBroker;
    if ('logger' in refs)            _refs.logger = refs.logger;
  }
  return getStatus();
}

// Test-only reset / Reset doar pentru teste
function _resetForTests() {
  _rateState.clear();
  _seenRequestIds.clear();
}

module.exports = {
  ALLOWED_ACTIONS,
  RESTARTABLE_SERVICES,
  dispatch,
  getStatus,
  configure,
  _resetForTests,
};
