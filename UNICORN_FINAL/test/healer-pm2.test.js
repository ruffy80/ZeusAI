'use strict';
/**
 * healer-pm2.test.js — Unit tests for scripts/healer-pm2.sh (the live self-healer
 * installed as /usr/local/bin/unicorn-healer.sh and run every 30s by
 * unicorn-healer.timer).
 *
 * These tests run the REAL bash script against real local health servers and a
 * fake `pm2` binary (a stub that records every invocation), asserting the
 * durable recovery guarantees that keep production from getting stuck down:
 *
 *   1. Everything healthy         → no restarts, no churn.
 *   2. Site-only outage           → heals ONLY unicorn-site (not the backend).
 *      (Historically the healer probed the site but only restarted the backend,
 *       so a site-only outage could never recover behind nginx's maintenance
 *       page.)
 *   3. Total outage + empty PM2   → `pm2 resurrect`, and any failed `pm2 restart`
 *      escalates to `pm2 startOrRestart ecosystem.config.js --only <app>` so a
 *      crashed/absent app is RECREATED instead of the healer giving up.
 */

const assert = require('assert');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'healer-pm2.sh');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  \u2713', name);
}

function startServer(status) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: status === 200 }));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'healer-test-'));
}

// Writes a fake `pm2` executable that records every invocation to FAKE_PM2_LOG
// and returns exit codes / jlist output driven by env vars.
function writeFakePm2(dir) {
  const p = path.join(dir, 'pm2');
  const body = [
    '#!/usr/bin/env bash',
    'echo "$*" >> "$FAKE_PM2_LOG"',
    'case "$1" in',
    '  jlist) printf \'%s\' "${FAKE_PM2_JLIST:-[]}"; exit 0;;',
    '  restart) exit "${FAKE_PM2_RESTART_RC:-0}";;',
    '  resurrect) exit "${FAKE_PM2_RESURRECT_RC:-0}";;',
    '  startOrRestart) exit "${FAKE_PM2_SOR_RC:-0}";;',
    '  save) exit 0;;',
    '  *) exit 0;;',
    'esac',
    ''
  ].join('\n');
  fs.writeFileSync(p, body, { mode: 0o755 });
  return p;
}

// Run via async spawn (NOT spawnSync): the health servers live in THIS process's
// event loop, so blocking it with spawnSync would make the child's curl probes
// hang. Async spawn keeps the servers responsive while the healer runs.
function runHealer(env) {
  return new Promise((resolve) => {
    const child = spawn('bash', [SCRIPT], {
      env: Object.assign({}, process.env, env),
      encoding: 'utf8',
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const to = setTimeout(() => child.kill('SIGKILL'), 25000);
    child.on('close', (code) => { clearTimeout(to); resolve({ status: code, stdout, stderr }); });
  });
}

async function scenario(opts) {
  const dir = mkTmp();
  const pm2 = writeFakePm2(dir);
  const pm2Log = path.join(dir, 'pm2.log');
  const ecosystem = path.join(dir, 'ecosystem.config.js');
  fs.writeFileSync(ecosystem, 'module.exports = { apps: [] };\n');

  const backend = await startServer(opts.backendStatus);
  const site = await startServer(opts.siteStatus);

  const env = Object.assign({
    PM2_BIN: pm2,
    FAKE_PM2_LOG: pm2Log,
    HEALTH_URL: `http://127.0.0.1:${backend.port}/api/health`,
    SITE_HEALTH_URL: `http://127.0.0.1:${site.port}/health`,
    STATE_DIR: path.join(dir, 'state'),
    LOG_FILE: path.join(dir, 'healer.log'),
    APP_DIR: dir,
    ECOSYSTEM_CFG: ecosystem,
    FAIL_THRESHOLD: '1',
    FAIL_WINDOW_SEC: '600',
    BOOT_GRACE_SEC: '0',
    POST_RESTART_WAIT_SEC: '0',
    CHECK_TIMEOUT_SEC: '5',
    WEBHOOK_URL: '',
  }, opts.env || {});

  const res = await runHealer(env);
  backend.server.close();
  site.server.close();

  const pm2Calls = fs.existsSync(pm2Log) ? fs.readFileSync(pm2Log, 'utf8') : '';
  return { res, pm2Calls, dir };
}

(async () => {
  console.log('healer-pm2 — recovery behavior');

  // ── Scenario 1: everything healthy → no restarts ──────────────────────────
  {
    const { res, pm2Calls } = await scenario({
      backendStatus: 200,
      siteStatus: 200,
      env: { FAKE_PM2_JLIST: '[{"name":"unicorn-backend","pm2_env":{"created_at":1,"status":"online"}}]' },
    });
    check('healthy: exits 0', () => assert.strictEqual(res.status, 0));
    check('healthy: never restarts anything', () => {
      assert.ok(!/^restart /m.test(pm2Calls), `unexpected restart:\n${pm2Calls}`);
      assert.ok(!/^startOrRestart /m.test(pm2Calls), `unexpected startOrRestart:\n${pm2Calls}`);
      assert.ok(!/^resurrect/m.test(pm2Calls), `unexpected resurrect:\n${pm2Calls}`);
    });
  }

  // ── Scenario 2: site-only outage → heal ONLY the site ─────────────────────
  {
    const { res, pm2Calls } = await scenario({
      backendStatus: 200,
      siteStatus: 500,
      env: {
        FAKE_PM2_JLIST: '[{"name":"unicorn-backend","pm2_env":{"created_at":1,"status":"online"}}]',
        FAKE_PM2_RESTART_RC: '0',
      },
    });
    check('site-down: exits 0', () => assert.strictEqual(res.status, 0));
    check('site-down: restarts unicorn-site', () =>
      assert.ok(/^restart unicorn-site\b/m.test(pm2Calls), `expected site restart:\n${pm2Calls}`));
    check('site-down: does NOT restart unicorn-backend', () =>
      assert.ok(!/^restart unicorn-backend\b/m.test(pm2Calls), `backend should be left alone:\n${pm2Calls}`));
    check('site-down: no resurrect (daemon has procs)', () =>
      assert.ok(!/^resurrect/m.test(pm2Calls), `unexpected resurrect:\n${pm2Calls}`));
    check('site-down: no escalation when restart succeeds', () =>
      assert.ok(!/^startOrRestart /m.test(pm2Calls), `unexpected escalation:\n${pm2Calls}`));
  }

  // ── Scenario 3: total outage, empty PM2 list, restart fails → escalate ─────
  {
    const { res, pm2Calls } = await scenario({
      backendStatus: 500,
      siteStatus: 500,
      env: {
        FAKE_PM2_JLIST: '[]',        // daemon has no processes → must resurrect
        FAKE_PM2_RESTART_RC: '1',    // app absent → plain restart fails
        FAKE_PM2_SOR_RC: '0',        // recreate from ecosystem succeeds
        FAKE_PM2_RESURRECT_RC: '0',
      },
    });
    check('total-down: exits 0', () => assert.strictEqual(res.status, 0));
    check('total-down: resurrects empty PM2 daemon', () =>
      assert.ok(/^resurrect\b/m.test(pm2Calls), `expected resurrect:\n${pm2Calls}`));
    check('total-down: escalates backend to startOrRestart from ecosystem', () =>
      assert.ok(/^startOrRestart .*--only unicorn-backend\b/m.test(pm2Calls), `expected backend recreate:\n${pm2Calls}`));
    check('total-down: escalates site to startOrRestart from ecosystem', () =>
      assert.ok(/^startOrRestart .*--only unicorn-site\b/m.test(pm2Calls), `expected site recreate:\n${pm2Calls}`));
    check('total-down: persists PM2 state with save', () =>
      assert.ok(/^save\b/m.test(pm2Calls), `expected pm2 save:\n${pm2Calls}`));
  }

  console.log(`\n\u2705 healer-pm2: ${passed} tests passed\n`);
  process.exit(0);
})().catch((err) => {
  console.error('\u274c healer-pm2 test failed:', err && err.stack || err);
  process.exit(1);
});
