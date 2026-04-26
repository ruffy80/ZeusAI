// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-26T18:05:59.241Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

/**
 * ZeusAutonomousCore (ZAC) — central brain for UNICORN_FINAL.
 *
 * Responsibilities:
 *   1. Scan ecosystem (modules + capabilities).
 *   2. Complete the live site (inject missing pages — non-destructive).
 *   3. Open the site<->unicorn bridge (WebSocket + REST fallback).
 *   4. Run self-healing loop (10s).
 *   5. Run profit maximizer (hourly).
 *   6. Run self-innovator (daily 03:00).
 *   7. Run self-developer (auto-generate stubs on demand).
 *
 * Two execution modes:
 *   - In-process: required by backend/index.js → returns init({mesh}) handle.
 *   - Standalone: `node backend/modules/zeusAutonomousCore/index.js` → boots
 *     all loops, intended for systemd.
 *
 * Strict rules:
 *   - Never overwrite a working module file.
 *   - Never block the host process: all timers .unref().
 *   - On unrecoverable target failure, mark needs_manual_review and continue.
 *   - All auto-mutations gated behind ZAC_AUTO_APPLY=1.
 */
const path = require('path');
const fs = require('fs');

const { scan } = require('./ecosystemScanner');
const { createSelfHealer } = require('./selfHealer');
const { createSiteSyncBridge } = require('./siteSyncBridge');
const { createSelfInnovator } = require('./selfInnovator');
const { createSelfDeveloper } = require('./selfDeveloper');
const { createProfitMaximizer } = require('./profitMaximizer');
const { completeSite } = require('./siteCompleter');

const VERSION = '1.0.0';
const STARTED_AT = new Date().toISOString();

const state = {
  startedAt: STARTED_AT,
  scan: null,
  siteCompletion: null,
  healer: null,
  bridge: null,
  innovator: null,
  developer: null,
  profit: null,
  alerts: [],
  isStarted: false,
};

function recordAlert(a) {
  state.alerts.push({ ts: new Date().toISOString(), ...a });
  if (state.alerts.length > 100) state.alerts.shift();
  // eslint-disable-next-line no-console
  console.warn('[ZAC/ALERT]', JSON.stringify(a));
}

function bootstrap({
  unicornRoot = path.resolve(__dirname, '../../..'),
  enableBridge = process.env.ZAC_DISABLE_BRIDGE !== '1',
  enableHealer = process.env.ZAC_DISABLE_HEALER !== '1',
  enableInnovator = process.env.ZAC_DISABLE_INNOVATOR !== '1',
  enableProfit = process.env.ZAC_DISABLE_PROFIT !== '1',
  completeSiteOnBoot = process.env.ZAC_DISABLE_SITE_COMPLETE !== '1',
} = {}) {
  if (state.isStarted) return getStatus();

  // 1. Ecosystem scan
  try {
    state.scan = scan({});
  } catch (e) {
    recordAlert({ kind: 'scan-failed', error: e.message });
    state.scan = { error: e.message };
  }

  // 2. Site completion (non-destructive)
  if (completeSiteOnBoot) {
    try {
      state.siteCompletion = completeSite({ unicornRoot });
    } catch (e) {
      recordAlert({ kind: 'site-complete-failed', error: e.message });
    }
  }

  // 3. Bridge
  if (enableBridge) {
    state.bridge = createSiteSyncBridge();
    try { state.bridge.start(); } catch (e) { recordAlert({ kind: 'bridge-failed', error: e.message }); }
  }

  // 4. Healer
  if (enableHealer) {
    state.healer = createSelfHealer({ onAlert: recordAlert });
    state.healer.start();
  }

  // 5. Profit maximizer
  if (enableProfit) {
    state.profit = createProfitMaximizer();
    state.profit.start();
  }

  // 6. Innovator (daily)
  if (enableInnovator) {
    state.innovator = createSelfInnovator();
    state.innovator.start();
  }

  // 7. Developer (on-demand only)
  state.developer = createSelfDeveloper();

  state.isStarted = true;
  // eslint-disable-next-line no-console
  console.log(banner());
  return getStatus();
}

function shutdown() {
  if (!state.isStarted) return { ok: true, alreadyStopped: true };
  try { state.healer && state.healer.stop(); } catch (_) {}
  try { state.bridge && state.bridge.stop(); } catch (_) {}
  try { state.innovator && state.innovator.stop(); } catch (_) {}
  try { state.profit && state.profit.stop(); } catch (_) {}
  state.isStarted = false;
  return { ok: true };
}

function banner() {
  return [
    '',
    '╔══════════════════════════════════════════════════════════════════╗',
    '║          ⚡ ZEUS AUTONOMOUS CORE ACTIVAT ⚡                       ║',
    '╠══════════════════════════════════════════════════════════════════╣',
    `║  Version: ${VERSION.padEnd(54)}║`,
    `║  Started: ${STARTED_AT.padEnd(54)}║`,
    '║  Toate modulele profitabile: activate și orchestrate.            ║',
    '║  Conexiune site ←→ unicorn: WebSocket + fallback REST.           ║',
    '║  Sistem autonom: auto-repair, auto-innovate, auto-develop.       ║',
    '║  Profit maxim urmărit continuu. Intervenție umană: ZERO.         ║',
    '║  Pentru oprire:   systemctl stop zac                             ║',
    '║  Loguri live:     journalctl -u zac -f                           ║',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
  ].join('\n');
}

function getStatus() {
  return {
    version: VERSION,
    startedAt: STARTED_AT,
    running: state.isStarted,
    scan: state.scan && {
      moduleCount: state.scan.moduleCount,
      profitCount: state.scan.profitCount,
      orchestrationCount: state.scan.orchestrationCount,
      healingCount: state.scan.healingCount,
      topProfit: (state.scan.profit || []).slice(0, 10).map((m) => m.name),
    },
    siteCompletion: state.siteCompletion,
    bridge: state.bridge ? state.bridge.getStatus() : null,
    healer: state.healer ? state.healer.getStatus() : null,
    profit: state.profit ? state.profit.getStatus() : null,
    innovator: state.innovator ? state.innovator.getStatus() : null,
    developer: state.developer ? state.developer.getStatus() : null,
    alerts: state.alerts.slice(-25),
  };
}

// Persist a small heartbeat file so external tools can verify ZAC is alive.
function writeHeartbeat() {
  try {
    const dir = path.resolve(__dirname, '../../../data/zac');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'heartbeat.json'), JSON.stringify({
      ts: new Date().toISOString(), pid: process.pid, version: VERSION,
    }));
  } catch (_) {}
}

const _heartbeatTimer = setInterval(writeHeartbeat, 30_000);
if (typeof _heartbeatTimer.unref === 'function') _heartbeatTimer.unref();

module.exports = {
  bootstrap,
  shutdown,
  getStatus,
  recordAlert,
  VERSION,
  banner,
  // sub-engines exposed for tests / advanced usage:
  scan,
  createSelfHealer,
  createSiteSyncBridge,
  createSelfInnovator,
  createSelfDeveloper,
  createProfitMaximizer,
  completeSite,
};

// Standalone mode (systemd entrypoint)
if (require.main === module) {
  // Survive transient errors so systemd doesn't churn restart-loops.
  process.on('uncaughtException',  (e) => { try { recordAlert({ kind: 'uncaughtException',  error: e.message }); } catch (_) {} });
  process.on('unhandledRejection', (e) => { try { recordAlert({ kind: 'unhandledRejection', error: (e && e.message) || String(e) }); } catch (_) {} });

  bootstrap();
  // Keep alive forever
  const _keepalive = setInterval(() => writeHeartbeat(), 60_000);
  // Do NOT unref — we want the process to stay up under systemd.
  process.on('SIGINT',  () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  // eslint-disable-next-line no-unused-vars
  void _keepalive;
}
