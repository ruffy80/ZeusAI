// =====================================================================
// hang-watchdog.test.js — guards for the "TCP accept but HTTP hang"
// watchdog shipped after the 2026-08-11 zeusai.pro outage (nginx accepts
// :443 but Node upstreams never complete a request).
//
// Coverage:
//   1. Pure classification logic (lib/hang-detect.js) — refused / hang /
//      http_error / healthy, per-app restart targeting, idempotency gate,
//      restart env carries DISABLE_SELF_MUTATION=1.
//   2. End-to-end DETECTION smoke: a real TCP server that accepts but never
//      writes an HTTP response is classified as `hang`, a healthy HTTP
//      server as `healthy`, and the watchdog never touches pm2/nginx when
//      unarmed or under CI/NODE_ENV=test.
//   3. Ops artifacts present (systemd units, installer wiring, bounded
//      diagnose-and-repair SSH).
// =====================================================================
'use strict';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');

const lib = require('../scripts/lib/hang-detect');

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('\u2713', name); });
}

// ── 1. classifyProbe ──────────────────────────────────────────────────
function unitClassify() {
  const S = lib.STATES;

  const refused = lib.classifyProbe({ tcpOk: false });
  assert.equal(refused.state, S.REFUSED);
  assert.equal(refused.actionable, true);
  assert.equal(refused.hung, false);

  const healthy = lib.classifyProbe({ tcpOk: true, httpResponded: true, httpCode: 200 });
  assert.equal(healthy.state, S.HEALTHY);
  assert.equal(healthy.actionable, false);

  const redirect = lib.classifyProbe({ tcpOk: true, httpResponded: true, httpCode: 302 });
  assert.equal(redirect.state, S.HEALTHY, '3xx is a live listener → healthy');

  const httpErr = lib.classifyProbe({ tcpOk: true, httpResponded: true, httpCode: 503 });
  assert.equal(httpErr.state, S.HTTP_ERROR);
  assert.equal(httpErr.actionable, true);
  assert.equal(httpErr.hung, false, '5xx answered ≠ frozen loop → no SIGKILL');

  const hangTimeout = lib.classifyProbe({ tcpOk: true, httpResponded: false, httpTimedOut: true });
  assert.equal(hangTimeout.state, S.HANG);
  assert.equal(hangTimeout.actionable, true);
  assert.equal(hangTimeout.hung, true, 'accept + timeout is THE outage signature');

  const hangNoBytes = lib.classifyProbe({ tcpOk: true, httpResponded: false, httpTimedOut: false });
  assert.equal(hangNoBytes.state, S.HANG, 'accept + 0 bytes is also a hang');
  assert.equal(hangNoBytes.hung, true);
}

// ── 2. decideRestartTargets ─────────────────────────────────────────────
function unitDecide() {
  const S = lib.STATES;
  const mk = (state) => lib.classifyProbe(
    state === S.HANG ? { tcpOk: true, httpResponded: false, httpTimedOut: true }
      : state === S.REFUSED ? { tcpOk: false }
        : state === S.HTTP_ERROR ? { tcpOk: true, httpResponded: true, httpCode: 500 }
          : { tcpOk: true, httpResponded: true, httpCode: 200 }
  );

  // Site-only outage MUST restart only the site.
  const siteOnly = lib.decideRestartTargets([
    { name: 'backend', app: 'unicorn-backend', classification: mk(S.HEALTHY) },
    { name: 'site', app: 'unicorn-site', classification: mk(S.HANG) },
  ]);
  assert.deepEqual(siteOnly.apps, ['unicorn-site']);
  assert.deepEqual(siteOnly.hungApps, ['unicorn-site']);
  assert.equal(siteOnly.anyHung, true);

  // Backend refused (no listener) is actionable but not hung.
  const backendRefused = lib.decideRestartTargets([
    { name: 'backend', app: 'unicorn-backend', classification: mk(S.REFUSED) },
    { name: 'site', app: 'unicorn-site', classification: mk(S.HEALTHY) },
  ]);
  assert.deepEqual(backendRefused.apps, ['unicorn-backend']);
  assert.deepEqual(backendRefused.hungApps, []);
  assert.equal(backendRefused.anyHung, false);

  // All healthy → nothing to do.
  const allOk = lib.decideRestartTargets([
    { name: 'backend', app: 'unicorn-backend', classification: mk(S.HEALTHY) },
    { name: 'site', app: 'unicorn-site', classification: mk(S.HEALTHY) },
  ]);
  assert.deepEqual(allOk.apps, []);
  assert.equal(allOk.anyHung, false);

  // Dedupe when two probes map to the same app.
  const dedup = lib.decideRestartTargets([
    { name: 'a', app: 'unicorn-backend', classification: mk(S.HANG) },
    { name: 'b', app: 'unicorn-backend', classification: mk(S.HTTP_ERROR) },
  ]);
  assert.deepEqual(dedup.apps, ['unicorn-backend']);
  assert.deepEqual(dedup.hungApps, ['unicorn-backend']);
}

// ── 3. shouldAct (idempotency / cooldown / boot-grace) ──────────────────
function unitShouldAct() {
  assert.equal(lib.shouldAct({ consecutiveFails: 1, threshold: 3 }).act, false, 'below threshold holds');
  assert.equal(lib.shouldAct({ consecutiveFails: 3, threshold: 3 }).act, true, 'threshold met acts');

  const grace = lib.shouldAct({ consecutiveFails: 5, threshold: 3, bootUptimeSec: 10, bootGraceSec: 90 });
  assert.equal(grace.act, false);
  assert.ok(/boot_grace/.test(grace.reason));

  const cooldown = lib.shouldAct({
    consecutiveFails: 5, threshold: 3, now: 1000, lastActionEpoch: 950, cooldownSec: 180,
  });
  assert.equal(cooldown.act, false);
  assert.ok(/cooldown/.test(cooldown.reason));

  const afterCooldown = lib.shouldAct({
    consecutiveFails: 5, threshold: 3, now: 2000, lastActionEpoch: 950, cooldownSec: 180,
  });
  assert.equal(afterCooldown.act, true);
}

// ── 4. buildRestartEnv / isCiOrTest ─────────────────────────────────────
function unitEnv() {
  const env = lib.buildRestartEnv('unicorn-backend', { FOO: 'bar' });
  assert.equal(env.DISABLE_SELF_MUTATION, '1', 'backend recovery MUST disable self-mutation');
  assert.equal(env.ENABLE_AUTO_RESTART, '0', 'recovery must not re-arm in-process auto-restart');
  assert.equal(env.FOO, 'bar', 'base env preserved');

  assert.equal(lib.isCiOrTest({ NODE_ENV: 'test' }), true);
  assert.equal(lib.isCiOrTest({ CI: 'true' }), true);
  assert.equal(lib.isCiOrTest({ GITHUB_ACTIONS: 'true' }), true);
  assert.equal(lib.isCiOrTest({ NODE_ENV: 'production' }), false);
}

// ── 5. end-to-end detection smoke (no pm2/nginx side effects) ───────────
function listenOnEphemeral(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

async function smokeDetection() {
  // A server that ACCEPTS TCP but never writes an HTTP response — the exact
  // "accept but hang" failure mode from the outage.
  const hangServer = net.createServer(() => { /* swallow the socket forever */ });
  // A healthy HTTP server for the "site".
  const okServer = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });

  const hangPort = await listenOnEphemeral(hangServer);
  const okPort = await listenOnEphemeral(okServer);

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hangwd-'));

  // Configure the watchdog to probe our fixtures with short timeouts, unarmed.
  process.env.HANG_WATCHDOG_BACKEND_PORT = String(hangPort);
  process.env.HANG_WATCHDOG_SITE_PORT = String(okPort);
  process.env.HANG_WATCHDOG_HTTP_TIMEOUT_MS = '1000';
  process.env.HANG_WATCHDOG_TCP_TIMEOUT_MS = '1000';
  process.env.HANG_WATCHDOG_FAIL_THRESHOLD = '3';
  process.env.HANG_WATCHDOG_BOOT_GRACE_SEC = '0';
  process.env.HANG_WATCHDOG_STATE_DIR = stateDir;
  delete process.env.HANG_WATCHDOG_ARM; // unarmed → dry-run

  delete require.cache[require.resolve('../scripts/hang-watchdog')];
  const wd = require('../scripts/hang-watchdog');

  try {
    let last;
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      last = await wd.tick();
    }
    const backend = last.results.find((r) => r.name === 'backend');
    const site = last.results.find((r) => r.name === 'site');

    assert.equal(backend.classification.state, lib.STATES.HANG,
      `backend must be classified hang (got ${backend.classification.state})`);
    assert.equal(backend.tcpOk, true, 'TCP accept succeeded (proves it is a hang, not refused)');
    assert.equal(site.classification.state, lib.STATES.HEALTHY, 'healthy site stays healthy');

    // After 3 consecutive fails the gate opens, but UNARMED → dry-run only.
    assert.equal(last.healthy, false);
    const backendAction = last.acted.find((a) => a.app === 'unicorn-backend');
    assert.ok(backendAction, 'backend should reach an action decision after threshold');
    assert.equal(backendAction.dryRun, true, 'unarmed watchdog must NOT actuate — dry-run only');
    assert.ok(!last.acted.some((a) => a.app === 'unicorn-site'),
      'healthy site must never be restarted');
  } finally {
    hangServer.close();
    okServer.close();
    delete process.env.HANG_WATCHDOG_BACKEND_PORT;
    delete process.env.HANG_WATCHDOG_SITE_PORT;
    delete process.env.HANG_WATCHDOG_STATE_DIR;
  }
}

// ── 6. armed-but-CI refuses to actuate ──────────────────────────────────
async function smokeCiRefusesActuation() {
  const hangServer = net.createServer(() => {});
  const okServer = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
  const hangPort = await listenOnEphemeral(hangServer);
  const okPort = await listenOnEphemeral(okServer);
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hangwd-ci-'));

  process.env.HANG_WATCHDOG_BACKEND_PORT = String(hangPort);
  process.env.HANG_WATCHDOG_SITE_PORT = String(okPort);
  process.env.HANG_WATCHDOG_HTTP_TIMEOUT_MS = '1000';
  process.env.HANG_WATCHDOG_TCP_TIMEOUT_MS = '1000';
  process.env.HANG_WATCHDOG_FAIL_THRESHOLD = '1';
  process.env.HANG_WATCHDOG_BOOT_GRACE_SEC = '0';
  process.env.HANG_WATCHDOG_STATE_DIR = stateDir;
  process.env.HANG_WATCHDOG_ARM = '1'; // ARMED, but NODE_ENV=test must still refuse
  // PM2_BIN points at a non-existent binary; if the guard failed this would throw.
  process.env.PM2_BIN = '/nonexistent/pm2-should-never-run';

  delete require.cache[require.resolve('../scripts/hang-watchdog')];
  const wd = require('../scripts/hang-watchdog');
  try {
    const res = await wd.tick();
    const backendAction = res.acted.find((a) => a.app === 'unicorn-backend');
    assert.ok(backendAction, 'threshold=1 → immediate action decision');
    assert.equal(backendAction.refusedCi, true,
      'armed watchdog under NODE_ENV=test MUST refuse to touch pm2/nginx');
  } finally {
    hangServer.close();
    okServer.close();
    delete process.env.HANG_WATCHDOG_ARM;
    delete process.env.PM2_BIN;
    delete process.env.HANG_WATCHDOG_BACKEND_PORT;
    delete process.env.HANG_WATCHDOG_SITE_PORT;
    delete process.env.HANG_WATCHDOG_STATE_DIR;
  }
}

// ── 7. ops artifacts present + wired ────────────────────────────────────
function opsArtifacts() {
  const root = path.join(__dirname, '..');
  const svc = fs.readFileSync(path.join(root, 'scripts', 'hang-watchdog.service'), 'utf8');
  const timer = fs.readFileSync(path.join(root, 'scripts', 'hang-watchdog.timer'), 'utf8');
  const installer = fs.readFileSync(path.join(root, 'scripts', 'install-healer.sh'), 'utf8');
  const wd = fs.readFileSync(path.join(root, 'scripts', 'hang-watchdog.js'), 'utf8');
  const diagnose = fs.readFileSync(
    path.join(root, '..', '.github', 'workflows', 'diagnose-and-repair.yml'), 'utf8');

  assert.ok(/Type=oneshot/.test(svc), 'service must be oneshot (timer-driven)');
  assert.ok(/TimeoutStartSec=\d+/.test(svc), 'service must be time-bounded (never hang forever)');
  assert.ok(/zeus-hang-watchdog\.disabled/.test(svc), 'service must honor a kill-switch file');
  assert.ok(/hang-watchdog\.js/.test(svc), 'service must run the watchdog script');
  assert.ok(/OnUnitInactiveSec=/.test(timer), 'timer must re-arm on a cadence');

  assert.ok(/hang-watchdog\.service/.test(installer) && /hang-watchdog\.timer/.test(installer),
    'installer must deploy the hang-watchdog units');

  assert.ok(/DISABLE_SELF_MUTATION/.test(wd), 'watchdog must set DISABLE_SELF_MUTATION on restart');
  assert.ok(/SIGKILL/.test(wd), 'watchdog must escalate a hung app to SIGKILL');
  assert.ok(/reloadNginx|systemctl.*nginx/.test(wd), 'watchdog must reload nginx after recovery');

  assert.ok(/timeout .*540s|timeout --signal=KILL 540s/.test(diagnose),
    'diagnose-and-repair self-heal SSH must be hard-bounded so it cannot hang forever');
}

(async () => {
  await check('classifyProbe distinguishes hang vs refused vs http_error vs healthy', unitClassify);
  await check('decideRestartTargets restarts only the failing app (site-only stays scoped)', unitDecide);
  await check('shouldAct enforces threshold + boot-grace + cooldown (idempotent)', unitShouldAct);
  await check('buildRestartEnv forces DISABLE_SELF_MUTATION=1 + isCiOrTest guard', unitEnv);
  await check('detection smoke: accept-but-hang → hang, healthy stays healthy, dry-run when unarmed', smokeDetection);
  await check('armed watchdog under CI/NODE_ENV=test refuses to actuate pm2/nginx', smokeCiRefusesActuation);
  await check('ops artifacts present + wired (systemd units, installer, bounded diagnose SSH)', opsArtifacts);

  console.log('\n✅ hang-watchdog:', passed, 'tests passed');
  process.exit(0);
})().catch((e) => {
  console.error('\u2717 hang-watchdog test failed:', e && e.stack || e);
  process.exit(1);
});
