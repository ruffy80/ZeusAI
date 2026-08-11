#!/usr/bin/env node
'use strict';

// =====================================================================
// hang-watchdog.js — "TCP accept but HTTP hang" detector + force-healer
//
// WHY THIS EXISTS (production outage 2026-08-11, zeusai.pro / :443):
//   TCP/TLS to the edge succeeds but HTTP hangs with 0 bytes. nginx is
//   accepting connections; the Node upstreams (unicorn-backend :3000,
//   unicorn-site :3001) are alive-enough to hold their listen sockets but
//   their event loop is frozen, so no request ever completes. Every probe
//   that only checks "is the port open?" reports the box healthy while the
//   whole site is down behind nginx's maintenance page.
//
// WHAT IT DOES:
//   For each target it (1) opens a raw TCP socket (proves accept), then
//   (2) issues an HTTP GET with a SHORT timeout. A socket that accepts but
//   never returns HTTP status bytes is the frozen-event-loop signature and
//   is force-recovered:
//     • pm2 restart <app> with DISABLE_SELF_MUTATION=1 (graceful first)
//     • if the app is still hung/absent → SIGKILL its PID, then
//       pm2 startOrRestart ecosystem.config.js --only <app> --update-env
//     • nginx -t && systemctl reload nginx
//   A graceful `pm2 restart` alone can itself HANG waiting for a frozen
//   worker to exit, so the kill escalation is what makes recovery durable.
//
// SAFETY / IDEMPOTENCY:
//   • One-shot by default (systemd-timer friendly). HANG_WATCHDOG_DAEMON=1
//     for a long-running loop.
//   • NEVER actuates unless HANG_WATCHDOG_ARM=1. Under CI / NODE_ENV=test
//     it hard-refuses to touch pm2/nginx even if armed.
//   • Consecutive-fail threshold + post-action cooldown + boot-grace via
//     pm2 uptime — cannot thrash pm2 on transient cold-boot blips.
//   • Only restarts the app whose probe is failing (site-only outage never
//     bounces a healthy backend).
//
// STACK: Unicorn Node + PM2 + nginx only. No Next.js / K8s.
// =====================================================================

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const lib = require('./lib/hang-detect');

const ARGV = process.argv.slice(2);
const DAEMON = String(process.env.HANG_WATCHDOG_DAEMON || '') === '1' && !ARGV.includes('--once');
const ARMED = String(process.env.HANG_WATCHDOG_ARM || '') === '1' || ARGV.includes('--arm');
const VERBOSE = ARGV.includes('--verbose') || String(process.env.HANG_WATCHDOG_VERBOSE || '') === '1';

const TCP_TIMEOUT_MS = Math.max(500, Number(process.env.HANG_WATCHDOG_TCP_TIMEOUT_MS) || 3000);
const HTTP_TIMEOUT_MS = Math.max(1000, Number(process.env.HANG_WATCHDOG_HTTP_TIMEOUT_MS) || 5000);
const FAIL_THRESHOLD = Math.max(1, Number(process.env.HANG_WATCHDOG_FAIL_THRESHOLD) || 3);
const COOLDOWN_SEC = Math.max(0, Number(process.env.HANG_WATCHDOG_COOLDOWN_SEC) || 180);
const BOOT_GRACE_SEC = Math.max(0, Number(process.env.HANG_WATCHDOG_BOOT_GRACE_SEC) || 90);
const INTERVAL_MS = Math.max(10_000, Number(process.env.HANG_WATCHDOG_INTERVAL_MS) || 30_000);

const APP_DIR = process.env.HANG_WATCHDOG_APP_DIR
  || process.env.APP_DIR
  || '/var/www/unicorn/UNICORN_FINAL';
const ECOSYSTEM_CFG = process.env.HANG_WATCHDOG_ECOSYSTEM
  || path.join(APP_DIR, 'ecosystem.config.js');
const PM2_BIN = process.env.PM2_BIN || 'pm2';

const BACKEND_APP = process.env.HANG_WATCHDOG_BACKEND_APP || 'unicorn-backend';
const SITE_APP = process.env.HANG_WATCHDOG_SITE_APP || 'unicorn-site';

// Probe targets. Endpoints match the outage runbook: backend /api/health,
// site /health. `liveUrl` (process-only /health/live) is a corroborating
// signal: hang on BOTH the app health and /health/live ⇒ truly frozen.
const TARGETS = [
  {
    name: 'backend',
    app: BACKEND_APP,
    host: '127.0.0.1',
    port: Number(process.env.HANG_WATCHDOG_BACKEND_PORT || 3000),
    path: process.env.HANG_WATCHDOG_BACKEND_PATH || '/api/health',
    livePath: '/health/live',
  },
  {
    name: 'site',
    app: SITE_APP,
    host: '127.0.0.1',
    port: Number(process.env.HANG_WATCHDOG_SITE_PORT || 3001),
    path: process.env.HANG_WATCHDOG_SITE_PATH || '/health',
    livePath: '/health/live',
  },
];

let STATE_DIR = process.env.HANG_WATCHDOG_STATE_DIR || '/var/lib/zeus-hang-watchdog';
try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
} catch (_) {
  STATE_DIR = path.join(require('os').tmpdir(), 'zeus-hang-watchdog');
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); } catch (_e) { /* best-effort */ }
}
const STATE_FILE = path.join(STATE_DIR, 'state.json');

function log(...args) {
  console.log('[hang-watchdog]', new Date().toISOString(), ...args);
}
function vlog(...args) { if (VERBOSE) log(...args); }

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {}; } catch (_) { return {}; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch (_) { /* best-effort */ }
}

// ── low-level probes ────────────────────────────────────────────────
function tcpConnect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (_) { /* noop */ }
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
  });
}

function httpGet(host, port, pathName, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: pathName, timeout: timeoutMs,
      headers: { 'User-Agent': 'zeus-hang-watchdog/1.0', Accept: '*/*' } }, (res) => {
      const code = res.statusCode || 0;
      // Drain (bounded) so the socket can close; we only care about status.
      res.on('data', () => {});
      res.on('end', () => resolve({ responded: true, timedOut: false, code }));
      res.on('error', () => resolve({ responded: true, timedOut: false, code }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ responded: false, timedOut: true, code: 0 }); });
    req.on('error', () => resolve({ responded: false, timedOut: false, code: 0 }));
  });
}

async function probeTarget(t) {
  const tcpOk = await tcpConnect(t.host, t.port, TCP_TIMEOUT_MS);
  let http1 = { responded: false, timedOut: false, code: 0 };
  let liveResponded = false;
  if (tcpOk) {
    http1 = await httpGet(t.host, t.port, t.path, HTTP_TIMEOUT_MS);
    // Corroborate a hang against the process-only liveness endpoint.
    if (!http1.responded) {
      const live = await httpGet(t.host, t.port, t.livePath, Math.min(HTTP_TIMEOUT_MS, 3000));
      liveResponded = !!live.responded;
    }
  }
  const classification = lib.classifyProbe({
    tcpOk,
    httpResponded: http1.responded,
    httpTimedOut: http1.timedOut,
    httpCode: http1.code,
  });
  return {
    name: t.name,
    app: t.app,
    host: t.host,
    port: t.port,
    path: t.path,
    tcpOk,
    httpCode: http1.code,
    httpResponded: http1.responded,
    httpTimedOut: http1.timedOut,
    liveResponded,
    classification,
  };
}

// ── pm2 helpers (only ever called when ARMED and not CI/test) ─────────
function pm2(args, timeoutMs) {
  return execFileSync(PM2_BIN, args, { timeout: timeoutMs || 30_000, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString();
}
function pm2Safe(args, timeoutMs) {
  try { return { ok: true, out: pm2(args, timeoutMs) }; } catch (e) { return { ok: false, err: e }; }
}

function pm2Uptimes() {
  // Returns { appName: uptimeSeconds }. Empty on any failure.
  const r = pm2Safe(['jlist'], 8000);
  if (!r.ok) return {};
  let list;
  try { list = JSON.parse(r.out || '[]'); } catch (_) { return {}; }
  const out = {};
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || !p.name || !p.pm2_env) continue;
    const created = Number(p.pm2_env.created_at || p.pm2_env.pm_uptime || 0);
    if (created > 0) out[p.name] = Math.max(0, Math.floor((Date.now() - created) / 1000));
  }
  return out;
}

function pm2Pids(app) {
  const r = pm2Safe(['jlist'], 8000);
  if (!r.ok) return [];
  let list;
  try { list = JSON.parse(r.out || '[]'); } catch (_) { return []; }
  const pids = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (p && p.name === app && p.pid && Number(p.pid) > 0) pids.push(Number(p.pid));
  }
  return pids;
}

function reloadNginx() {
  try {
    execFileSync('nginx', ['-t'], { timeout: 15_000, stdio: 'ignore' });
  } catch (_) {
    log('nginx -t failed — skipping reload to avoid taking the edge down');
    return false;
  }
  try {
    execFileSync('systemctl', ['reload', 'nginx'], { timeout: 15_000, stdio: 'ignore' });
    log('nginx reloaded');
    return true;
  } catch (_) {
    try {
      execFileSync('systemctl', ['restart', 'nginx'], { timeout: 20_000, stdio: 'ignore' });
      log('nginx restarted (reload failed)');
      return true;
    } catch (_e) {
      log('nginx reload/restart failed');
      return false;
    }
  }
}

// Force-recover one app. Graceful restart first; escalate to SIGKILL + a
// from-ecosystem recreate when the app is hung or absent from pm2.
function forceRecoverApp(app, hung) {
  const env = lib.buildRestartEnv(app, process.env);
  const childEnv = Object.assign({}, process.env, env);

  log(`recovering ${app} (hung=${hung}) with DISABLE_SELF_MUTATION=1`);

  if (hung) {
    // A frozen event loop can ignore SIGINT; PM2's graceful restart would
    // then block until kill_timeout. Send SIGKILL to the live PID(s) first
    // so the restart lands on a dead process and returns promptly.
    for (const pid of pm2Pids(app)) {
      try {
        process.kill(pid, 'SIGKILL');
        log(`SIGKILL sent to ${app} pid=${pid}`);
      } catch (_) { /* already gone */ }
    }
  }

  // Try a targeted restart with the safety env applied.
  const restart = (() => {
    try {
      execFileSync(PM2_BIN, ['restart', app, '--update-env'],
        { timeout: 45_000, stdio: 'ignore', env: childEnv });
      return true;
    } catch (_) { return false; }
  })();

  if (restart) {
    log(`pm2 restart ${app} ok`);
  } else if (fs.existsSync(ECOSYSTEM_CFG)) {
    // Absent / errored in pm2 (max_restarts exhausted, post-kill) — a plain
    // restart cannot bring it back. Recreate from source-of-truth config.
    log(`pm2 restart ${app} failed — recreating from ${ECOSYSTEM_CFG}`);
    try {
      execFileSync(PM2_BIN, ['startOrRestart', ECOSYSTEM_CFG, '--only', app, '--update-env'],
        { timeout: 60_000, stdio: 'ignore', cwd: APP_DIR, env: childEnv });
      log(`recreated ${app} from ecosystem`);
    } catch (_) {
      log(`ERROR: could not recreate ${app} from ecosystem`);
    }
  } else {
    log(`ERROR: ecosystem config missing (${ECOSYSTEM_CFG}) — cannot recreate ${app}`);
  }
  pm2Safe(['save'], 15_000);
}

// ── one tick ──────────────────────────────────────────────────────────
async function tick() {
  const results = [];
  for (const t of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await probeTarget(t));
  }

  const summary = results.map((r) => `${r.name}=${r.classification.state}`
    + `(tcp=${r.tcpOk ? 1 : 0},code=${r.httpCode},live=${r.liveResponded ? 1 : 0})`).join(' ');

  const decision = lib.decideRestartTargets(
    results.map((r) => ({ name: r.name, app: r.app, classification: r.classification }))
  );

  const state = readState();
  const now = Math.floor(Date.now() / 1000);

  // Track consecutive fails per app WITH hysteresis.
  // A single flapping "healthy" tick between two hangs used to reset the
  // counter to 0, so a oneshot systemd timer (every ~45s) never reached
  // threshold and never SIGKILL'd a intermittently-frozen backend. Require
  // HEALTHY_CLEAR consecutive healthy observations before clearing fails.
  const HEALTHY_CLEAR = Math.max(1, Number(process.env.HANG_WATCHDOG_HEALTHY_CLEAR) || 2);
  const failing = new Set(decision.apps);
  state.fails = state.fails || {};
  state.okStreak = state.okStreak || {};
  state.lastAction = state.lastAction || {};
  for (const t of TARGETS) {
    if (failing.has(t.app)) {
      state.fails[t.app] = Number(state.fails[t.app] || 0) + 1;
      state.okStreak[t.app] = 0;
    } else {
      state.okStreak[t.app] = Number(state.okStreak[t.app] || 0) + 1;
      if (state.okStreak[t.app] >= HEALTHY_CLEAR) state.fails[t.app] = 0;
    }
  }

  if (decision.apps.length === 0) {
    writeState(state);
    log(`healthy · ${summary}`);
    return { healthy: true, results, acted: [], summary };
  }

  log(`OUTAGE · ${summary} · actionable=${decision.apps.join(',')} hung=${decision.hungApps.join(',') || 'none'}`);

  const ciOrTest = lib.isCiOrTest(process.env);
  const uptimes = (ARMED && !ciOrTest) ? pm2Uptimes() : {};
  const acted = [];

  for (const app of decision.apps) {
    const gate = lib.shouldAct({
      consecutiveFails: state.fails[app],
      threshold: FAIL_THRESHOLD,
      now,
      lastActionEpoch: Number(state.lastAction[app] || 0),
      cooldownSec: COOLDOWN_SEC,
      bootUptimeSec: uptimes[app] != null ? uptimes[app] : null,
      bootGraceSec: BOOT_GRACE_SEC,
    });

    if (!gate.act) {
      log(`hold ${app}: ${gate.reason}`);
      continue;
    }

    if (!ARMED) {
      log(`DRY-RUN would force-recover ${app} (set HANG_WATCHDOG_ARM=1 to actuate)`);
      acted.push({ app, dryRun: true });
      continue;
    }
    if (ciOrTest) {
      log(`REFUSING to actuate ${app} under CI/NODE_ENV=test`);
      acted.push({ app, refusedCi: true });
      continue;
    }

    forceRecoverApp(app, decision.hungApps.includes(app));
    state.lastAction[app] = now;
    state.fails[app] = 0;
    acted.push({ app, recovered: true, hung: decision.hungApps.includes(app) });
  }

  if (ARMED && !ciOrTest && acted.some((a) => a.recovered)) {
    reloadNginx();
  }

  writeState(state);
  return { healthy: false, results, acted, summary };
}

async function main() {
  vlog(`config armed=${ARMED} daemon=${DAEMON} ci/test=${lib.isCiOrTest(process.env)} `
    + `threshold=${FAIL_THRESHOLD} cooldown=${COOLDOWN_SEC}s bootGrace=${BOOT_GRACE_SEC}s `
    + `httpTimeout=${HTTP_TIMEOUT_MS}ms state=${STATE_FILE}`);

  if (!DAEMON) {
    await tick();
    // Exit 0 in one-shot mode so the systemd timer / CI never sees a
    // "failure" for an outage it already handled (or a dry-run detection).
    process.exit(0);
  }

  log(`daemon armed · probing every ${INTERVAL_MS}ms`);
  await tick().catch((e) => log('tick error', e && e.message));
  setInterval(() => { tick().catch((e) => log('tick error', e && e.message)); }, INTERVAL_MS);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[hang-watchdog] fatal', e && e.message);
    process.exit(1);
  });
}

module.exports = { probeTarget, tick, TARGETS };
